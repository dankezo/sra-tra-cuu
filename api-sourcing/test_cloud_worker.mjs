import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{authorized,reserve,search,upstream,safeUrl} from './cloud-worker.mjs';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./cloud-schema.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){
  return {bind(...args){
   return {async first(){return sqlite.prepare(sql).get(...args) || null;},async run(){return sqlite.prepare(sql).run(...args);}};
  }};
 }};
}
test('protected search rejects missing code and hostile origin',async()=>{
 const env={APISRC_ACCESS_KEY:'valid-private-access-code'},ctx={waitUntil(){}};
 assert.equal((await worker.fetch(new Request('https://example.com/search?q=test'),env,ctx)).status,401);
 assert.equal((await worker.fetch(new Request('https://example.com/health',{headers:{Origin:'https://evil.example'}}),env,ctx)).status,403);
 assert.equal(await authorized(new Request('https://example.com',{headers:{Authorization:'Bearer valid-private-access-code'}}),env),true);
 assert.equal(await authorized(new Request('https://example.com',{headers:{Authorization:'Bearer different-private-access-code'}}),env),false);
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
test('additional rounds use separate cache keys and Brave result offsets',async()=>{
 const db=database(),pending=[],ctx={waitUntil(p){pending.push(p);}},env={DB:db,BRAVE_SEARCH_API_KEY:'test'};
 const previous=globalThis.fetch,offsets=[];
 globalThis.fetch=async(url)=>{const page=new URL(url).searchParams.get('offset');offsets.push(page);return Response.json({web:{results:[{url:'https://example.com/page'+page}]}});};
 try {const first=await search('round test',env,ctx,0),second=await search('round test',env,ctx,1);await Promise.all(pending);
 assert.notEqual(first.results[0].url,second.results[0].url);assert.deepEqual(offsets,['0','1']);
 const cached=await search('round test',env,ctx,1);assert.equal(cached.providers[0].cached,true);assert.equal(offsets.length,2);
 const auth={headers:{Authorization:'Bearer valid-private-access-code'}};
 for(const page of ['-1','5','1.1','foo'])assert.equal((await worker.fetch(new Request('https://example.com/search?q=test&page='+page,auth),{...env,APISRC_ACCESS_KEY:'valid-private-access-code'},ctx)).status,400);
 } finally {globalThis.fetch=previous;db.sqlite.close();}
});
