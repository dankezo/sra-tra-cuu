"""Cached public-page reading off the search path; direct, Jina, optional Crawl4AI."""
import argparse
import asyncio
import ipaddress
import json
import os
import re
import socket
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
import requests
import gateway
from pipeline import session, now


def public_url(url):
    p=urlparse(url)
    if p.scheme!='https' or not p.hostname or p.username or p.password or p.port not in (None,443):
        raise ValueError('Only public HTTPS URLs accepted')
    for info in socket.getaddrinfo(p.hostname,443):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError('Private/network-local address rejected')
    return p


def robots_allowed(url):
    p=public_url(url)
    r=requests.get('https://'+p.netloc+'/robots.txt',timeout=8,allow_redirects=False)
    if r.status_code==404:return
    r.raise_for_status()
    if 300<=r.status_code<400:raise ValueError('Robots redirect needs review')
    parser=RobotFileParser();parser.parse(r.text.splitlines())
    if not parser.can_fetch('ApiSourcing',url):raise ValueError('robots.txt disallows this page')


def is_challenge(text):
    return any(term in text.lower() for term in ('cf-chl-', 'g-recaptcha','verify you are human','cf_app_waf','access denied','captcha-delivery.com','just a moment...'))


async def crawl4ai(url):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    config=BrowserConfig(headless=True,chrome_channel='chrome',verbose=False,text_mode=True,light_mode=True)
    async with AsyncWebCrawler(config=config) as crawler:
        result=await asyncio.wait_for(crawler.arun(url=url,config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS,page_timeout=12000,check_robots_txt=True)),timeout=18)
        if not result.success:raise ValueError('Crawl4AI page read failed')
        if is_challenge(result.html):raise ValueError('Challenge requires manual verification')
        return result.markdown.raw_markdown


def read(url,engine='direct',refresh=False):
    public_url(url)
    if urlparse(url).hostname in ('www.accessdata.fda.gov','accessdata.fda.gov'):
        raise ValueError('Use fda_access connector, not the general reader')
    key='page:v1:'+engine+':'+url
    with session() as con:
        cached=con.execute('SELECT * FROM apisrc_cache WHERE cache_key=?',(key,)).fetchone()
    if cached and not refresh and cached['expires_at']>time.time():
        result=json.loads(cached['payload']);result['cached']=True;return result
    started=time.perf_counter();status='ok';error=None
    try:
        robots_allowed(url)
        if engine=='jina':
            headers={'X-Timeout':'8','X-Retain-Images':'none'}
            if os.environ.get('JINA_API_KEY'):headers['Authorization']='Bearer '+os.environ['JINA_API_KEY']
            response=requests.get('https://r.jina.ai/'+url,headers=headers,timeout=12)
            response.raise_for_status();text=response.text
        elif engine=='firecrawl':
            if not os.environ.get('FIRECRAWL_API_KEY'):raise ValueError('Firecrawl key is not configured')
            gateway.reserve_quota('firecrawl')
            response=requests.post('https://api.firecrawl.dev/v2/scrape',headers={'Authorization':'Bearer '+os.environ['FIRECRAWL_API_KEY']},
                                   json={'url':url,'formats':['markdown'],'onlyMainContent':True,'timeout':10000},timeout=12)
            response.raise_for_status();result=response.json()
            if not result.get('success'):raise ValueError('Firecrawl page read failed')
            text=result.get('data',{}).get('markdown','')
            if not text:raise ValueError('Firecrawl returned no page text')
        elif engine=='crawl4ai':
            text=asyncio.run(crawl4ai(url))
        elif engine=='direct':
            response=requests.get(url,timeout=10,allow_redirects=False,headers={'User-Agent':'ApiSourcing/1.0 public-source-index'})
            response.raise_for_status()
            if 300<=response.status_code<400:raise ValueError('Redirect requires review of the target URL')
            text=response.text
        else:raise ValueError('Unknown reader engine')
        if is_challenge(text):raise ValueError('Challenge requires manual verification')
        payload={'url':url,'engine':engine,'fetched_at':now(),'text':text[:200000],'verification':'supplier_claimed','cached':False}
        with session() as con:
            con.execute('INSERT INTO apisrc_cache VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at',
                        (key,json.dumps(payload),now(),time.time()+86400*30))
        return payload
    except Exception as exc:
        status='blocked' if isinstance(exc,ValueError) else 'error';error=type(exc).__name__;raise
    finally:
        with session() as con:
            con.execute('INSERT INTO apisrc_fetch_log(source_url,engine,fetched_at,duration_ms,status,error) VALUES(?,?,?,?,?,?)',(url,engine,now(),round((time.perf_counter()-started)*1000),status,error))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('url');p.add_argument('--engine',choices=['direct','jina','crawl4ai','firecrawl'],default='direct');p.add_argument('--refresh',action='store_true');args=p.parse_args()
    result=read(args.url,args.engine,args.refresh)
    print(json.dumps({k:v for k,v in result.items() if k!='text'}))
