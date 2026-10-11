const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.SRA_BROWSER_CHANNEL||'chrome'});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const gate=new Promise(resolve=>{release=resolve});let snapshots=0,excels=0;const queries=[];
  await page.route('**/discover?*',route=>route.fulfill({json:{listings:[],cached:true}}));
  await page.route('**/harvest?*',route=>route.fulfill({json:{listings:[],sources:[]}}));
  await page.route('**/labels?*',route=>route.fulfill({json:{items:[]}}));
  page.on('request',r=>{if(r.url().includes('/excel.js'))excels++});
  await page.route('**/snapshot.json.gz?*',async route=>{snapshots++;await gate;await route.continue()});
  await page.route('**/search?*',async route=>{const q=new URL(route.request().url()).searchParams.get('q');queries.push(q);await route.fulfill({json:{results:[{url:'https://example.com/'+q,title:q,provider:'brave'}],providers:[],configured:['brave'],pending:0,elapsed_ms:1}})});
  const url=process.env.APISRC_TEST_URL||'http://127.0.0.1:8766/api-sourcing/';
  const started=Date.now();await page.goto(url,{waitUntil:'domcontentloaded'});const shellMs=Date.now()-started;
  assert.ok(await page.locator('#search-button').isEnabled());assert.equal(await page.locator('#auto-web').count(),0);
  await page.locator('[data-query=amlodipine]').click();await page.waitForFunction(()=>document.querySelector('#web-content').children.length===1);
  assert.deepEqual(queries,['amlodipine']);assert.equal(await page.evaluate(()=>!!window.APISRC_READY),false);
  assert.ok(await page.locator('#search-progress').isVisible());
  await page.locator('[data-query=metformin]').click();await page.waitForFunction(()=>document.querySelector('#web-content').textContent.includes('metformin'));
  release();await page.waitForFunction(()=>window.APISRC_READY);await page.locator('#profiles-tab').click();await page.locator('#search-progress').waitFor({state:'hidden'});
  assert.match(await page.locator('#results').innerText(),/Metformin/i);assert.doesNotMatch(await page.locator('#results').innerText(),/Amlodipine/i);
  assert.equal(excels,0,'Excel runtime is deferred until export');
  await page.waitForFunction(async()=>{const cache=await caches.open('apisrc-snapshot-v2');return (await cache.keys()).length===1});
  const before=snapshots,warmStart=Date.now();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.APISRC_READY);const warmMs=Date.now()-warmStart;
  assert.equal(snapshots,before,'warm reload must not download the snapshot again');
  const failed=await browser.newPage();await failed.route('**/snapshot.json.gz?*',route=>route.fulfill({status:503,body:'unavailable'}));
  await failed.route('**/search?*',route=>route.fulfill({json:{results:[{url:'https://example.com/recovery',title:'Web still works'}],providers:[],configured:['brave'],pending:0,elapsed_ms:1}}));
  await failed.goto(url);await failed.locator('[data-query=amlodipine]').click();await failed.locator('#search-progress').waitFor({state:'hidden'});
  assert.match(await failed.locator('#web-content').innerText(),/Web still works/);assert.match(await failed.locator('#result-status').innerText(),/Dữ liệu nguồn/);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:'early web search; latest query; cached snapshot; lazy Excel; source outage',shellMs,warmMs,snapshotRequests:snapshots}));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
