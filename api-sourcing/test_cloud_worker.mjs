import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{reserve,search,upstream,safeUrl} from './cloud-worker.mjs';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./cloud-schema.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){
  return {bind(...args){
   return {async first(){return sqlite.prepare(sql).get(...args) || null;},async run(){return sqlite.prepare(sql).run(...args);}};
  }};
 }};
}
test('public search needs no code and rejects hostile browser origins',async()=>{
 const db=database(),env={DB:db,BRAVE_SEARCH_API_KEY:'secret'},ctx={waitUntil(){}};
 db.sqlite.prepare('INSERT INTO apisrc_cloud_cache VALUES(?,?,?,?)').run('search:v1:brave:test api manufacturer supplier gmp cep',JSON.stringify({provider:'brave',results:[{url:'https://example.com/proof'}]}),'2026-10-10',Date.now()+60000);
 const response=await worker.fetch(new Request('https://example.com/search?q=test',{headers:{Origin:'https://dankezo.github.io'}}),env,ctx);
 assert.equal(response.status,200);assert.equal((await response.json()).results.length,1);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://dankezo.github.io');
 assert.equal((await worker.fetch(new Request('https://example.com/health',{headers:{Origin:'https://evil.example'}}),env,ctx)).status,403);
 assert.equal((await (await worker.fetch(new Request('https://example.com/health'),env,ctx)).json()).requires_access_code,false);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM apisrc_cloud_usage').get().n,0);db.sqlite.close();
});
test('atomic quota permits exactly the cap under concurrent attempts',async()=>{
 const db=database();const result=await Promise.all(Array.from({length:20},()=>reserve(db,'brave','2026-10',3)));
 assert.equal(result.filter(Boolean).length,3);assert.equal(db.sqlite.prepare('SELECT requests FROM apisrc_cloud_usage').get().requests,3);db.sqlite.close();
});
test('fresh shared cache avoids upstream and quota writes',async()=>{
 const db=database(),query='amlodipine API';
 db.sqlite.prepare('INSERT INTO apisrc_cloud_cache VALUES(?,?,?,?)').run('search:v1:brave:amlodipine api',JSON.stringify({provider:'brave',results:[{url:'https://example.com'}]}),'2026-10-09',Date.now()+60000);
 const pending=[],result=await search(query,{DB:db,BRAVE_SEARCH_API_KEY:'secret'},{waitUntil(p){pending.push(p);}});await Promise.all(pending);
 assert.equal(result.results.length,1);assert.equal(result.providers[0].cached,true);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM apisrc_cloud_usage').get().n,0);db.sqlite.close();
});
test('upstream response is bounded, safe and contains no credentials',async()=>{
 const result=await upstream('brave','amlodipine',{BRAVE_SEARCH_API_KEY:'secret'},async(url,options)=>{
  assert.equal(options.headers['X-Subscription-Token'],'secret');return Response.json({web:{results:[{url:'javascript:alert(1)'},{url:'https://example.com',title:'Supplier',description:'Evidence'}]}});
 });
 assert.equal(result.results.length,1);assert.equal(result.results[0].verification,'unknown');assert.ok(!JSON.stringify(result).includes('secret'));
 assert.equal(safeUrl('https://user:password@example.com'),'');
 await assert.rejects(upstream('brave','test',{BRAVE_SEARCH_API_KEY:'secret'},async()=>new Response('x'.repeat(1000001))),/PayloadTooLarge/);
});
test('cache lease deduplicates simultaneous requests across instances',async()=>{
 const db=database(),pending=[],ctx={waitUntil(p){pending.push(p);}},env={DB:db,BRAVE_SEARCH_API_KEY:'test'};
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return Response.json({web:{results:[{url:'https://example.com'}]}});};
 try {await Promise.all([search('single query',env,ctx),search('single query',env,ctx)]);await Promise.all(pending);assert.equal(calls,1);}
 finally {globalThis.fetch=previous;db.sqlite.close();}
});
test('search combines broad web and directory engines before returning',async()=>{
 const db=database(),pending=[],previous=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,options)=>{const isTavily=url.includes('tavily');seen.push(isTavily?'tavily':'brave');if(isTavily){assert.deepEqual(JSON.parse(options.body).include_domains,['pharmasources.com','cphi-online.com']);await new Promise(resolve=>setTimeout(resolve,30));return Response.json({results:[{url:'https://pharmasources.com/product',title:'Supplier'}]});}return Response.json({web:{results:[{url:'https://supplier.example/product'}]}});};
 try{const result=await search('paracetamol API manufacturer supplier GMP CEP',{DB:db,BRAVE_SEARCH_API_KEY:'private',TAVILY_API_KEY:'private'},{waitUntil(p){pending.push(p)}});await Promise.all(pending);assert.equal(result.results.length,2);assert.deepEqual(seen,['brave','tavily']);assert.equal(result.pending,0);}finally{globalThis.fetch=previous;db.sqlite.close()}
});
test('additional rounds use separate cache keys and Brave result offsets',async()=>{
 const db=database(),pending=[],ctx={waitUntil(p){pending.push(p);}},env={DB:db,BRAVE_SEARCH_API_KEY:'test'};
 const previous=globalThis.fetch,offsets=[];
 globalThis.fetch=async(url)=>{const page=new URL(url).searchParams.get('offset');offsets.push(page);return Response.json({web:{results:[{url:'https://example.com/page'+page}]}});};
 try {const first=await search('round test',env,ctx,0),second=await search('round test',env,ctx,1);await Promise.all(pending);
 assert.notEqual(first.results[0].url,second.results[0].url);assert.deepEqual(offsets,['0','1']);
 const cached=await search('round test',env,ctx,1);assert.equal(cached.providers[0].cached,true);assert.equal(offsets.length,2);
 for(const page of ['-1','5','1.1','foo'])assert.equal((await worker.fetch(new Request('https://example.com/search?q=test&page='+page),env,ctx)).status,400);
 } finally {globalThis.fetch=previous;db.sqlite.close();}
});
