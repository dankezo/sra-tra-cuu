const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.SRA_BROWSER_CHANNEL || 'chrome'});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));
 assert.equal(await page.locator('#compare-right-count').count(),1);
 const done=()=>page.waitForFunction(()=>/dòng|Không có kết quả/.test(document.querySelector('#tra-hit').textContent));
 const count=async()=>parseInt((await page.locator('#tra-hit').innerText()).replaceAll('.','')) || 0;
 await page.locator('#mq').fill('Forteka'); await page.locator('#mgo').click();await done();
 const vnCard=page.locator('#med-groups details[data-cc=VN]');
 assert.ok(await vnCard.count());
 await vnCard.evaluate(el=>el.open=true);await vnCard.locator('tbody tr').first().waitFor();
 assert.match(await vnCard.locator('thead').innerText(),/Công ty đăng ký/iu);
 assert.match(await vnCard.locator('td.co').first().innerText(),/Anabion/);
 assert.doesNotMatch(await vnCard.locator('td.co').first().innerText(),/BIOCAD/);
 assert.match(await vnCard.locator('td.nm').first().innerText(),/460410140226/);
 await page.locator('[data-remove-term]').click();await done();
 await page.locator('#mq').fill('paracetam');await page.locator('#mgo').click();await done();
 const before=await count();await page.locator('#vn-only').check();await done();const after=await count();
 assert.ok(after>0 && after<before);
 assert.equal(await page.locator('#vn-settings, #vn-months, #vn-group').count(),0);
 await page.locator('#vn-help summary').click();assert.match(await page.locator('#vn-help').innerText(),/36 tháng/);
 await page.locator('#vn-help summary').click();
 const saveEvent=page.waitForEvent('download');await page.locator('#filter-save').click();const saved=await saveEvent,file=await saved.path();
 const settings=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(settings.vnOnly,true);assert.equal(settings.vnPolicy,undefined);
 await page.locator('#vn-only').uncheck();await done();assert.equal(await count(),before);
 await page.locator('#filter-file').setInputFiles(file);await done();assert.equal(await count(),after);
 await page.locator('#vn-only').uncheck();await done();
 await page.locator('#compare-toggle').click();await page.locator('#vn-compare').waitFor({state:'visible'});
 assert.equal(await page.locator('#compare-toggle').getAttribute('aria-pressed'),'true');
 assert.ok(await page.locator('#compare-left .compare-row').count()>0);
 assert.ok(await page.locator('#compare-right .compare-row').count()>0);
 const leftTotal=parseInt((await page.locator('#compare-left-count').innerText()).replace(/[^0-9]/g,''));assert.equal(leftTotal,before);
 await page.locator('#compare-left .compare-row').first().click();assert.match(await page.locator('#compare-context').innerText(),/Đối chiếu riêng/);
 await page.locator('#compare-all').click();assert.match(await page.locator('#compare-context').innerText(),/toàn bộ/);
 const totalDAV=parseInt((await page.locator('#compare-right-count').innerText()).replace(/[^0-9]/g,''));
 await page.locator('#compare-eligible').check();
 const eligibleDAV=parseInt((await page.locator('#compare-right-count').innerText()).replace(/[^0-9]/g,''));assert.ok(eligibleDAV>0 && eligibleDAV<totalDAV);
 await page.locator('#compare-eligible').uncheck();
 await page.locator('#compare-right-query').fill('nonexistent-zzzz');assert.equal(await page.locator('#compare-right .compare-row').count(),0);
 await page.locator('#compare-right-query').fill('');
 const downloadEvent=page.waitForEvent('download');await page.locator('#compare-export').click();const download=await downloadEvent;
 assert.match(download.suggestedFilename(),/\.xlsx$/);await download.saveAs(path.resolve('qa-compare.xlsx'));
 fs.writeFileSync('qa-compare-counts.json',JSON.stringify({left:leftTotal,right:totalDAV}));
 for(const width of [360,768,1440]) {
  await page.setViewportSize({width,height:950});
  assert.ok(await page.locator('#vn-compare').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog overflow '+width);
  await page.screenshot({path:`qa-compare-${width}.png`});
 }
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('compare-toggle').getAttribute('aria-pressed')!=='true');
 for(const width of [360,390,768,1440]) {
  await page.setViewportSize({width,height:950});await page.locator('#tra').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
 }
 await page.locator('[data-view=list]').click();assert.equal(await page.locator('#country-list [data-country]').count(),37);
 await page.locator('#country-list [data-country=VN]').click();await done();assert.equal(await page.locator('#med-groups details').count(),1);
 assert.equal(await page.locator('#med-groups details').getAttribute('data-cc'),'VN');
 await page.locator('#country-all').click();await done();
 await page.locator('[data-remove-term]').click();await done();
 const all=await count();assert.ok(all>500000);
 const start=Date.now();await page.locator('#compare-toggle').click();
 await page.locator('#compare-right .compare-row').first().waitFor();
 assert.equal(parseInt((await page.locator('#compare-left-count').innerText()).replace(/[^0-9]/g,'')),all);
 console.log('All-results comparison opened in',Date.now()-start,'ms');
 await page.locator('#compare-close').click();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({before,after,leftTotal,totalDAV,eligibleDAV}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
