const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.SRA_BROWSER_CHANNEL || 'chrome'});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));
 await page.locator('#mq').waitFor();
 await page.waitForFunction(()=>!document.getElementById('boot-screen') || document.getElementById('boot-screen').classList.contains('is-done'));
 assert.equal(await page.locator('#compare-right-count').count(),1);
 const done=()=>page.waitForFunction(()=>{
   const hit=document.querySelector('#tra-hit').textContent||'';
   const note=document.querySelector('#vn-note').textContent||'';
   return !hit.includes('Đang') && /dòng|Không có kết quả|Vui lòng chọn/.test(hit+note);
 });
 const compared=()=>page.waitForFunction(()=>document.querySelector('#compare-status').textContent==='Đã đối chiếu · 100%');
 const count=async()=>parseInt((await page.locator('#tra-hit').innerText()).replaceAll('.','')) || 0;
 const openTags=async()=>{
   if(!(await page.locator('#vn-tag-filter').evaluate(el=>el.open))) await page.locator('#vn-tag-filter summary').click();
 };
 const closeTags=async()=>{
   if(await page.locator('#vn-tag-filter').evaluate(el=>el.open)) await page.locator('#vn-tag-filter summary').click();
 };
 const clickTagAction=async(id)=>{
   await openTags();
   await page.locator(id).click();
   await closeTags();
 };
 // Default green is on — search without extra tags still applies green VN filter.
 await page.locator('#mq').fill('Abrocto');await page.locator('#mgo').click();await done();
 const abroctoCard=page.locator('#med-groups details[data-cc=VN]');
 await abroctoCard.evaluate(el=>el.open=true);
 await page.waitForFunction(()=>document.querySelectorAll('#med-groups details[data-cc=VN] tbody tr').length>=1);
 const abroctoText=await abroctoCard.innerText();
 assert.match(abroctoText,/893100584024|893100009600/);
 await page.locator('[data-remove-term]').click();await done();
 await clickTagAction('#vn-tag-clear');await done();
 assert.match(await page.locator('#vn-note').innerText(),/ít nhất một phân loại/);
 await clickTagAction('#vn-tag-all');await done();
 await page.locator('#mq').fill('Forteka'); await page.locator('#mgo').click();await done();
 const vnCard=page.locator('#med-groups details[data-cc=VN]');
 assert.ok(await vnCard.count());
 await vnCard.evaluate(el=>el.open=true);await vnCard.locator('tbody tr').first().waitFor();
 assert.match(await vnCard.locator('thead').innerText(),/Công ty đăng ký/iu);
 assert.match(await vnCard.locator('td.co').first().innerText(),/Anabion/);
 assert.doesNotMatch(await vnCard.locator('td.co').first().innerText(),/BIOCAD/);
 assert.match(await vnCard.locator('td.nm').first().innerText(),/460410140226/);
 await page.locator('[data-remove-term]').click();await done();
 await clickTagAction('#vn-tag-green');await done();
 await page.locator('#mq').fill('paracetam');await page.locator('#mgo').click();await done();
 const withGreen=await count();
 await clickTagAction('#vn-tag-all');await done();
 const withAll=await count();
 assert.ok(withAll>=withGreen && withGreen>0);
 assert.equal(await page.locator('#vn-only, #vn-help').count(),0);
 assert.match(await page.locator('#vn-tag-count').innerText(),/Đã chọn: 4/);
 const saveEvent=page.waitForEvent('download');await page.locator('#filter-save').click();const saved=await saveEvent,file=await saved.path();
 const settings=JSON.parse(fs.readFileSync(file,'utf8'));assert.ok(Array.isArray(settings.vnTags));assert.equal(settings.vnTags.length,4);assert.equal(settings.vnPolicy,undefined);
 await clickTagAction('#vn-tag-green');await done();
 await page.waitForFunction((n)=>{
   const hit=document.querySelector('#tra-hit').textContent||'';
   return !hit.includes('Đang') && (parseInt(hit.replaceAll('.',''))||0)===n;
 }, withGreen);
 assert.equal(await count(),withGreen);
 await page.locator('#filter-file').setInputFiles(file);await done();
 await page.waitForFunction((n)=>{
   const hit=document.querySelector('#tra-hit').textContent||'';
   return !hit.includes('Đang') && (parseInt(hit.replaceAll('.',''))||0)===n;
 }, withAll);
 assert.equal(await count(),withAll);
 await clickTagAction('#vn-tag-green');await done();
 await page.locator('#compare-toggle').click();await page.locator('#vn-compare').waitFor({state:'visible'});await compared();
 assert.equal(await page.locator('#compare-toggle').getAttribute('aria-pressed'),'true');
 assert.ok(await page.locator('#compare-left .compare-row').count()>0);
 assert.ok(await page.locator('#compare-right .compare-row').count()>0);
 const leftTotal=parseInt((await page.locator('#compare-left-count').innerText()).replace(/[^0-9]/g,''));assert.equal(leftTotal,withGreen);
 await page.locator('#compare-left .compare-row').first().click();await compared();assert.match(await page.locator('#compare-context').innerText(),/Đối chiếu riêng/);
 await page.locator('#compare-all').click();await compared();assert.match(await page.locator('#compare-context').innerText(),/toàn bộ/);
 const totalDAV=parseInt((await page.locator('#compare-right-count').innerText()).replace(/[^0-9]/g,''));
 assert.ok(totalDAV>0);
 const downloadEvent=page.waitForEvent('download');await page.locator('#compare-export').click();const download=await downloadEvent;
 assert.match(download.suggestedFilename(),/\.xlsx$/);await download.saveAs(path.resolve('qa-compare.xlsx'));
 fs.writeFileSync('qa-compare-counts.json',JSON.stringify({left:leftTotal,right:totalDAV}));
 for(const width of [390,768,1440]) {
  await page.setViewportSize({width,height:900});
  assert.ok(await page.locator('#vn-compare').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog overflow '+width);
  await page.screenshot({path:`qa-compare-${width}.png`});
 }
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('compare-toggle').getAttribute('aria-pressed')!=='true');
 assert.deepEqual(errors,[]);
 console.log('PASS: VN tag multi-filter, compare uses selected tags, save/load vnTags');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
