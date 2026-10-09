"""Bounded parallel web search; durable cache, no LLM or browser in the critical path."""
import concurrent.futures
import importlib.util
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import requests
from pipeline import session, now, norm

ROOT=Path(__file__).resolve().parent
POOL=concurrent.futures.ThreadPoolExecutor(max_workers=4,thread_name_prefix='apisrc-search')
INFLIGHT={}
LOCK=threading.Lock()
KEYS={'tavily':'TAVILY_API_KEY','exa':'EXA_API_KEY','brave':'BRAVE_SEARCH_API_KEY','google':'GOOGLE_CSE_API_KEY','jina':'JINA_API_KEY','firecrawl':'FIRECRAWL_API_KEY','serpapi':'SERPAPI_API_KEY','hasdata':'HASDATA_API_KEY'}


def load_env():
    path=ROOT.parent/'.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key,value=line.split('=',1);os.environ.setdefault(key.strip(),value.strip().strip('"').strip("'"))
    for canonical,legacy in [('GOOGLE_CSE_API_KEY','GOOGLE_SEARCH_API_KEY'),('GOOGLE_CSE_CX','GOOGLE_SEARCH_ENGINE_ID')]:
        if not os.environ.get(canonical) and os.environ.get(legacy):os.environ[canonical]=os.environ[legacy]


def configured(name):
    if name=='ddgs':
        return importlib.util.find_spec('ddgs') is not None
    return bool(os.environ.get(KEYS.get(name,''))) and (name!='google' or bool(os.environ.get('GOOGLE_CSE_CX')))


def providers():
    return [p.strip() for p in os.environ.get('APISRC_SEARCH_PROVIDERS','brave,tavily,exa').split(',') if configured(p.strip())]


def safe_url(url):
    p=urlparse(url)
    return p.scheme=='https' and bool(p.hostname) and not p.username and not p.password


def reserve_quota(provider):
    month=datetime.now(timezone.utc).strftime('%Y-%m-%d' if provider=='google' else '%Y-%m')
    defaults={'brave':100,'tavily':900,'exa':100,'serpapi':100,'hasdata':20,'firecrawl':25,'google':90,'jina':100}
    period='DAILY' if provider=='google' else 'MONTHLY'
    cap=int(os.environ.get('APISRC_'+provider.upper()+'_'+period+'_CAP',str(defaults.get(provider,500))))
    with session() as con:
        con.execute('BEGIN IMMEDIATE')
        con.execute('INSERT OR IGNORE INTO apisrc_usage(provider,month) VALUES(?,?)',(provider,month))
        if con.execute('SELECT requests FROM apisrc_usage WHERE provider=? AND month=?',(provider,month)).fetchone()[0]>=cap:
            raise ValueError('Local usage cap reached')
        con.execute('UPDATE apisrc_usage SET requests=requests+1 WHERE provider=? AND month=?',(provider,month))


def search_provider(provider,query):
    timeout=min(8,max(1,float(os.environ.get('APISRC_PROVIDER_TIMEOUT_SECONDS','4'))))
    key=os.environ.get(KEYS.get(provider,''),'')
    reserve_quota(provider)
    started=time.perf_counter()
    if provider=='tavily':
        r=requests.post('https://api.tavily.com/search',headers={'Authorization':'Bearer '+key},json={'query':query,'search_depth':'ultra-fast','max_results':6,'include_answer':False,'include_raw_content':False,'auto_parameters':False},timeout=timeout)
        r.raise_for_status();raw=r.json().get('results',[])
    elif provider=='exa':
        r=requests.post('https://api.exa.ai/search',headers={'x-api-key':key},json={'query':query,'type':'fast','numResults':6},timeout=timeout)
        r.raise_for_status();raw=r.json().get('results',[])
    elif provider=='brave':
        r=requests.get('https://api.search.brave.com/res/v1/web/search',headers={'X-Subscription-Token':key},params={'q':query,'count':6},timeout=timeout)
        r.raise_for_status();raw=r.json().get('web',{}).get('results',[])
    elif provider=='google':
        r=requests.get('https://www.googleapis.com/customsearch/v1',params={'key':key,'cx':os.environ['GOOGLE_CSE_CX'],'q':query,'num':6},timeout=timeout)
        r.raise_for_status();raw=r.json().get('items',[])
    elif provider=='serpapi':
        r=requests.get('https://serpapi.com/search.json',params={'engine':'google','api_key':key,'q':query,'num':6},timeout=timeout)
        r.raise_for_status();payload=r.json()
        if payload.get('error'):raise ValueError('Search API reported an error')
        raw=payload.get('organic_results',[])
    elif provider=='hasdata':
        r=requests.get('https://api.hasdata.com/scrape/google/serp',headers={'x-api-key':key},params={'q':query},timeout=timeout)
        r.raise_for_status();raw=r.json().get('organicResults',[])
    elif provider=='firecrawl':
        r=requests.post('https://api.firecrawl.dev/v2/search',headers={'Authorization':'Bearer '+key},json={'query':query,'limit':6,'sources':['web'],'timeout':int(timeout*1000)},timeout=timeout)
        r.raise_for_status();payload=r.json()
        if not payload.get('success'):raise ValueError('Search API reported an error')
        raw=payload.get('data',{}).get('web',[])
    elif provider=='ddgs':
        from ddgs import DDGS
        raw=DDGS(timeout=timeout).text(query,backend='duckduckgo',max_results=6)
    elif provider=='jina':
        r=requests.get('https://s.jina.ai/',params={'q':query},headers={'Authorization':'Bearer '+key,'Accept':'application/json','X-Timeout':'3'},timeout=timeout)
        r.raise_for_status();raw=r.json().get('data',[])
    else:
        raise ValueError('Unsupported search provider')
    results=[]
    for item in raw[:6]:
        url=item.get('url') or item.get('link') or item.get('href')
        if not url or not safe_url(url):continue
        results.append({'title':str(item.get('title',''))[:400],'url':url,'snippet':str(item.get('content') or item.get('description') or item.get('snippet') or item.get('body') or '')[:1500],
                        'provider':provider,'verification':'unknown','fetched_at':now()})
    return {'results':results,'provider':provider,'elapsed_ms':round((time.perf_counter()-started)*1000)}


def cache_key(provider,query):
    return 'search:v1:'+provider+':'+norm(query)


def cached(provider,query):
    with session() as con:
        row=con.execute('SELECT * FROM apisrc_cache WHERE cache_key=?',(cache_key(provider,query),)).fetchone()
    return (json.loads(row['payload']),row['expires_at']<time.time()) if row else (None,False)


def work(provider,query):
    try:
        payload=search_provider(provider,query)
        with session() as con:
            con.execute('INSERT INTO apisrc_cache VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at',
                        (cache_key(provider,query),json.dumps(payload),now(),time.time()+86400*int(os.environ.get('APISRC_CACHE_DAYS','7'))))
        return payload
    except Exception as error:
        # Never log exception text: some services include their key in request URLs.
        payload={'provider':provider,'results':[],'error':type(error).__name__}
        if isinstance(error,requests.HTTPError) and error.response is not None:payload['http_status']=error.response.status_code
        with session() as con:
            con.execute('INSERT INTO apisrc_cache VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at',
                        (cache_key(provider,query),json.dumps(payload),now(),time.time()+300))
        return payload


def submit(provider,query):
    key=cache_key(provider,query)
    with LOCK:
        existing=INFLIGHT.get(key)
        if existing is not None and not existing.done():return existing
        future=POOL.submit(work,provider,query);INFLIGHT[key]=future
        if len(INFLIGHT)>200:
            for old in list(INFLIGHT):
                if INFLIGHT[old].done():INFLIGHT.pop(old,None)
        return future


def search(query):
    started=time.perf_counter()
    if not 2<=len(query.strip())<=200:raise ValueError('Query must have 2–200 characters')
    query=query.strip()+' API manufacturer supplier GMP CEP'
    outputs=[];pending=[];used=[]
    names=providers()
    deadline=min(5,max(.1,float(os.environ.get('APISRC_WEB_DEADLINE_SECONDS','3'))))
    end=time.perf_counter()+deadline
    next_provider=0
    remaining=set()
    while not any(o['results'] for o in outputs) and time.perf_counter()<end:
        while len(remaining)<2 and next_provider<len(names):
            provider=names[next_provider];next_provider+=1;used.append(provider)
            payload,stale=cached(provider,query)
            if payload:
                payload['cached']=True;payload['stale']=stale;outputs.append(payload)
                if stale:
                    future=submit(provider,query)
                    if not payload['results']:remaining.add(future);pending.append(future)
                if payload['results']:break
            else:
                future=submit(provider,query);remaining.add(future);pending.append(future)
        if any(o['results'] for o in outputs) or not remaining:break
        if time.perf_counter()<end:
            done,remaining=concurrent.futures.wait(remaining,timeout=max(0,end-time.perf_counter()),return_when=concurrent.futures.FIRST_COMPLETED)
            outputs.extend(f.result() for f in done)
    results={}
    for output in outputs:
        for r in output['results']:results.setdefault(r['url'].rstrip('/'),r)
    return {'results':list(results.values()),'providers':outputs,'pending':sum(not f.done() for f in pending),
            'elapsed_ms':round((time.perf_counter()-started)*1000),'configured':names,'attempted':used,
            'note':'Web snippets are discovery evidence only; not verified certificates.'}


load_env()
