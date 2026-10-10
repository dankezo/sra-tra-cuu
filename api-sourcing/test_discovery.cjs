const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const query='Milk thistle extract DER 30-44:1; 57% silymarin';
 await page.route('**/search?*',r=>r.fulfill({json:{results:[{url:'https://supplier.example/milk-thistle',title:query}],providers:[{provider:'brave'}],configured:['brave'],elapsed_ms:12,pending:0}}));
 await page.route('**/discover?*',r=>r.fulfill({json:{listings:[]}}));
 await page.route('**/harvest?*',r=>r.fulfill({json:{listings:[{company:'Evidence Supplier Ltd',ingredient:query,source_url:'https://supplier.example/milk-thistle',profile_url:'https://supplier.example/milk-thistle',raw_snippet:'Evidence Supplier Ltd offers '+query,verification:'supplier_claimed'}],sources:[{url:'https://supplier.example/milk-thistle',status:'read',count:1}]}}));
 await page.route('**/labels?*',r=>r.fulfill({json:{items:[{raw:query,vi:'Cao kế sữa DER 30-44:1; 57% silymarin'}]}}));
 await page.goto('http://127.0.0.1:8766/api-sourcing/');await page.waitForFunction(()=>window.APISRC_READY);
 await page.locator('#query').fill(query);await page.locator('#search-form').evaluate(form=>form.requestSubmit());
 await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('Evidence Supplier Ltd')&&!document.querySelector('#results').hidden);
 await page.waitForFunction(()=>document.querySelector('#results').textContent.includes('AI hỗ trợ'));
 await page.locator('#web-suppliers').click();assert.equal(await page.locator('.supplier-card').filter({hasText:'Evidence Supplier Ltd'}).count(),1);assert.ok((await page.locator('#harvest-status').innerText()).includes('1 NCC'));
 await page.locator('.supplier-card').filter({hasText:'Evidence Supplier Ltd'}).locator('[data-open]').click();assert.ok((await page.locator('#source-content').innerText()).includes('Evidence Supplier Ltd offers'));
 await page.locator('#panel-close').click();await page.locator('.supplier-card').filter({hasText:'Evidence Supplier Ltd'}).locator('[data-save]').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('apisrc-bag-v1'))[0]);assert.equal(saved.snapshot.certificates[0].type,'LISTING');assert.equal(saved.snapshot.vietnamese_names[query],'Cao kế sữa DER 30-44:1; 57% silymarin · AI hỗ trợ');
 assert.equal(await page.locator('#bag-export').count(),0);assert.deepEqual(errors,[]);console.log('PASS: web page → evidenced supplier card → source quote → Bag with AI Vietnamese name');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
