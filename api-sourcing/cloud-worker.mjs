import {readCompass,publicPageUrl} from './enrichment.mjs';
import {harvestPages} from './harvest.mjs';
// Public HTML stays on Pages; API keys, shared cache and quotas stay here.
const PROVIDERS = {brave:'BRAVE_SEARCH_API_KEY',tavily:'TAVILY_API_KEY',exa:'EXA_API_KEY'};
const CAPS = {brave:100,tavily:900,exa:100};
export const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function safeUrl(value) {
 try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export async function reserve(db,provider,period,cap) {
 return !!await db.prepare('INSERT INTO apisrc_cloud_usage VALUES(?,?,1) ON CONFLICT(provider,period) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').bind(provider,period,cap).first();
}
async function readJson(response) {
 if(!response.ok)throw new Error('HTTP_'+response.status);
 // Bound upstream output before parsing; never log an upstream URL, key, or error body.
 const reader=response.body.getReader(),parts=[];let size=0;
 try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000)throw new Error('PayloadTooLarge');parts.push(value);} }
 finally { await reader.cancel(); }
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function upstream(provider,query,env,fetcher=fetch,page=0) {
 const signal=AbortSignal.timeout(4500);let response,raw;
 const variants=['',' GMP CPP COPP manufacturing site',' bulk API exporter pharmaceutical ingredients',' API manufacturer CEP quality dossier',' pharmaceutical API producer contact'];
 const expanded=provider==='tavily' ? query.replace(/ API manufacturer supplier GMP CEP$/, '')+' API supplier'+variants[page] : query+(provider==='brave' ? '' : variants[page]);
 if(provider==='brave') {
  response=await fetcher('https://api.search.brave.com/res/v1/web/search?'+new URLSearchParams({q:query,count:'6',offset:String(page)}),{headers:{'X-Subscription-Token':env.BRAVE_SEARCH_API_KEY},signal});
  raw=(await readJson(response)).web?.results || [];
 } else if(provider==='tavily') {
  response=await fetcher('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.TAVILY_API_KEY},body:JSON.stringify({query:expanded,search_depth:'ultra-fast',max_results:6,include_answer:false,include_raw_content:false,auto_parameters:false,include_domains:['pharmasources.com','cphi-online.com']}),signal});
  raw=(await readJson(response)).results || [];
 } else if(provider==='exa') {
  response=await fetcher('https://api.exa.ai/search',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':env.EXA_API_KEY},body:JSON.stringify({query:expanded,type:'fast',numResults:6}),signal});
  raw=(await readJson(response)).results || [];
 } else throw new Error('UnsupportedProvider');
 if(!Array.isArray(raw))throw new Error('InvalidPayload');
 const fetched_at=new Date().toISOString();
 return {provider,results:raw.slice(0,6).filter(r=>safeUrl(r.url)).map(r=>({title:String(r.title||'').slice(0,400),url:safeUrl(r.url),snippet:String(r.description||r.content||r.text||'').slice(0,1500),provider,verification:'unknown',fetched_at}))};
}
async function run(provider,query,key,env,page=0) {
 const db=env.DB,at=Date.now();
 const lease=await db.prepare('INSERT INTO apisrc_cloud_lease VALUES(?,?) ON CONFLICT(cache_key) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<? RETURNING cache_key').bind(key,at+15000,at).first();
 if(!lease)return {provider,results:[],error:'InProgress'};
 try {
  const period=new Date().toISOString().slice(0,7);
  if(!await reserve(db,provider,period,CAPS[provider]))throw new Error('QuotaReached');
  if(!await reserve(db,'all_daily',new Date().toISOString().slice(0,10),30))throw new Error('DailyQuotaReached');
  const payload=await upstream(provider,query,env,fetch,page);
  await save(db,key,payload,payload.results.length ? 7*86400000 : 300000);
  return payload;
 } catch(error) {
  const code=/^(HTTP_\d{3}|QuotaReached|DailyQuotaReached|PayloadTooLarge|InvalidPayload)$/.test(error.message)?error.message:'ProviderUnavailable';
  const payload={provider,results:[],error:code};await save(db,key,payload,300000);return payload;
 } finally { await db.prepare('DELETE FROM apisrc_cloud_lease WHERE cache_key=?').bind(key).run(); }
}
async function save(db,key,payload,ttl) {
 await db.prepare('INSERT INTO apisrc_cloud_cache VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at').bind(key,JSON.stringify(payload),new Date().toISOString(),Date.now()+ttl).run();
}
async function enrich(kind,input,env,ctx) {
 const key=kind+(kind==='pages'?':v5:':':v2:')+JSON.stringify(input),at=Date.now(),db=env.DB;
 const existing=await db.prepare('SELECT payload,expires_at FROM apisrc_cloud_cache WHERE cache_key=?').bind(key).first();
 if(existing && existing.expires_at>at)return {...JSON.parse(existing.payload),cached:true};
 const lease=await db.prepare('INSERT INTO apisrc_cloud_lease VALUES(?,?) ON CONFLICT(cache_key) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<? RETURNING cache_key').bind(key,at+30000,at).first();
 if(!lease)return {pending:true};
 const task=(async()=>{try{
  if(!await reserve(db,kind,new Date().toISOString().slice(0,10),10))throw new Error('QuotaReached');
  const payload=kind==='directory'?await readCompass(input,env):await harvestPages(input,env);
  await save(db,key,payload,kind==='directory'?7*86400000:kind==='pages'&&payload.sources.some(s=>s.status==='unavailable')?300000:30*86400000);return payload;
 }catch(error){const payload={error:'SourceUnavailable',reason:/^(SourceHTTP_\d{3}|QuotaReached|InvalidSource|ReaderFetchFailed|ReaderBodyFailed|SourceBlocked|SourceUnreadable|SourceIdentityMissing)$/.test(error.message)?error.message:'ReadFailed',pending:false};await save(db,key,payload,300000);return payload}
 finally{await db.prepare('DELETE FROM apisrc_cloud_lease WHERE cache_key=?').bind(key).run()}})();
 ctx.waitUntil(task.catch(()=>{}));let timer;
 try{return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),4700)})])}finally{clearTimeout(timer)}
}
export async function search(query,env,ctx,page=0) {
 const started=Date.now(),names=Object.keys(PROVIDERS).filter(p=>env[PROVIDERS[p]]),outputs=[];let pending=0;
 const finish=()=>({results:[...new Map(outputs.flatMap(p=>p.results).map(r=>[r.url,r])).values()],providers:outputs,configured:names,pending,elapsed_ms:Date.now()-started});
 async function lookup(provider){
  const key=(provider==='tavily'?'search:v4:page'+page+':':page?'search:v2:page'+page+':':'search:v1:')+provider+':'+normalize(query);
  const cached=await env.DB.prepare('SELECT payload,expires_at FROM apisrc_cloud_cache WHERE cache_key=?').bind(key).first();
  if(cached){const payload=JSON.parse(cached.payload);if(payload.results.length||cached.expires_at>Date.now()){
   if(cached.expires_at<Date.now())ctx.waitUntil(run(provider,query,key,env,page).catch(()=>{}));
   outputs.push({...payload,cached:true,stale:cached.expires_at<Date.now()});return;
  }}
  pending++;try{outputs.push(await run(provider,query,key,env,page))}catch{outputs.push({provider,results:[],error:'StorageUnavailable'})}finally{pending--}
 }
 const task=(async()=>{await Promise.all(names.slice(0,2).map(lookup));if(!outputs.some(p=>p.results.length)&&Date.now()-started<4900&&names[2])await lookup(names[2]);return finish()})();
 ctx.waitUntil(task.catch(()=>{}));let timer;
 try{return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve(finish()),5000)})])}finally{clearTimeout(timer)}
}

export default {
 async fetch(request,env,ctx) {
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGINS||'https://dankezo.github.io').split(',');
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin && allowed.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, OPTIONS';}
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  if(origin && !allowed.includes(origin))return reply({error:'OriginDenied'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return reply({error:'MethodNotAllowed'},405);
  if(url.pathname==='/health')return reply({service:'API Sourcing',version:'4',discovery:['PharmaCompass','PharmaSources','CPHI','websites from web search'],page_reader:!!env.JINA_API_KEY,ingredient_translation:false,providers:Object.keys(PROVIDERS).filter(p=>env[PROVIDERS[p]]),shared_cache:!!env.DB,requires_access_code:false});
  if(url.pathname==='/discover'){
   const q=(url.searchParams.get('q')||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9 ,().+\/-]{1,199}$/.test(q))return reply({error:'InvalidQuery'},400);
   try{return reply(await enrich('directory',q.toLowerCase(),env,ctx))}catch{return reply({error:'SourceUnavailable'},503)}
  }
  if(url.pathname==='/harvest'){
   const query=(url.searchParams.get('q')||'').trim();let urls;
   try{urls=JSON.parse(url.searchParams.get('urls')||'[]')}catch{return reply({error:'InvalidSources'},400)}
   if(query.length<2||query.length>200||!Array.isArray(urls)||!urls.length||urls.length>3||urls.some(u=>typeof u!=='string'||u.length>1000||!publicPageUrl(u)))return reply({error:'InvalidSources'},400);
   try{return reply(await enrich('pages',{query,urls:[...new Set(urls)].sort()},env,ctx))}catch{return reply({error:'SourceUnavailable'},503)}
  }
  if(url.pathname!=='/search')return reply({error:'NotFound'},404);
  const q=(url.searchParams.get('q')||'').trim();
  if(q.length<2||q.length>200)return reply({error:'InvalidQuery'},400);
  const pageText=url.searchParams.get('page') || '0';
  if(!/^[0-4]$/.test(pageText))return reply({error:'InvalidPage'},400);
  try {return reply(await search(q+' API manufacturer supplier GMP CEP',env,ctx,Number(pageText)));}
  catch {return reply({error:'SearchUnavailable'},503);}
 },
 async scheduled(_controller,env,ctx) {
  // Query cache may stay stale for up to 30 days; usage only needs this and last month.
  const cutoff=new Date(Date.now()-62*86400000).toISOString().slice(0,7);
  ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM apisrc_cloud_cache WHERE expires_at<?').bind(Date.now()-30*86400000),env.DB.prepare('DELETE FROM apisrc_cloud_lease WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM apisrc_cloud_usage WHERE period<?').bind(cutoff)]));
 }
};
