const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.SRA_BROWSER_CHANNEL||'chrome'});
 const page=await browser.newPage({viewport:{width:1360,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APISRC_TEST_URL||'http://127.0.0.1:8766/api-sourcing/');
 await page.waitForFunction(()=>window.APISRC_READY);
 const timings=[];
 for(const query of ['amlodipine','paracetamol','metformin','103-90-2']){
  await page.locator('#query').fill(query);await page.locator('#search-button').click();
  const message=await page.locator('#result-status').innerText();assert.match(message,/\d+ NCC/);
  assert.ok(await page.locator('.supplier-card').count()>0);
  const ms=Number(message.match(/(\d+) ms/)[1]);timings.push({query,ms,message});assert.ok(ms<1000);
 }
 await page.locator('#query').fill('Swapnroop Drugs and Pharmaceuticals');await page.locator('#search-button').click();
 assert.equal(await page.locator('.supplier-card').count(),1);assert.equal(await page.locator('.chip.good').count(),0);
 assert.match(await page.locator('.chip.claim').innerText(),/Chưa xác minh/);
 await page.locator('[data-open]').click();assert.ok(await page.locator('#source-content blockquote').isVisible());
 assert.match(await page.locator('#source-content').innerText(),/tuyên bố của NCC không phải xác nhận/);await page.locator('#panel-close').click();
 await page.locator('#query').fill('amlodipine');await page.locator('#search-button').click();
 await page.locator('#filters summary').click();await page.locator('#certificate').selectOption('CEP');
 assert.ok(await page.locator('.supplier-card').count()>0);
 await page.locator('[data-open]').first().click();assert.ok(await page.locator('#source-panel').isVisible());
 assert.match(await page.locator('#source-content').innerText(),/Ngày file nguồn/);
 await page.evaluate(()=>{window.print=()=>{window.printCalled=true}});
 await page.locator('[data-print]').first().click();
 assert.ok(await page.evaluate(()=>window.printCalled));
 assert.match(await page.locator('#print-report').innerText(),/không thay thế chứng chỉ CEP/);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.locator('#panel-close').click();
 await page.locator('[data-save]').first().click();assert.equal(await page.locator('#bag-count').innerText(),'1');
 await page.locator('#bag-toggle').click();await page.locator('[data-field=note]').fill('QA note <script>');await page.locator('[data-field=note]').press('Tab');
 await page.locator('#bag-close').click();await page.reload();await page.waitForFunction(()=>window.APISRC_READY);
 await page.locator('#bag-toggle').click();assert.equal(await page.locator('[data-field=note]').inputValue(),'QA note <script>');
 await page.locator('#bag-close').click();
 await page.locator('#query').fill('amlodipine');await page.locator('#search-button').click();
 for(const width of [360,390,768,1360]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);
  await page.locator('[data-open]').first().click();assert.ok(await page.locator('#source-panel').isVisible());await page.locator('#panel-close').click();
 }
 await page.setViewportSize({width:1360,height:950});await page.screenshot({path:'qa-api-sourcing-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-open]').first().click();await page.screenshot({path:'qa-api-sourcing-mobile.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:'search → source → Bag → reload; filters; responsive; no JS errors',timings}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
