const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH || 'playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('_search_ui.html','utf8');
 await page.setContent(html.slice(html.indexOf('<dialog'),html.indexOf('</dialog>')+9)+'<button id="compare-toggle"></button>');
 await page.addStyleTag({content:fs.readFileSync('_search_ui.css','utf8')});
 for(const f of ['_vn_logic.js','_data_logic.js','_compare.js'])await page.addScriptTag({path:f});
 await page.evaluate(()=>{
  const records=[['1','Alpha','tablet','10mg'],['2','Alpha','capsule','20mg'],['3','Alpha + Beta','tablet','30mg'],['4','Beta','tablet','40mg'],['5','Gamma','',''],['1','Alpha','tablet','0.01g']].map(([sdk,inn,form,strength],i)=>({id:String(i),sdk,inn,form,strength,product:'Drug '+i,registrant:'Co',expiry:'2030-01-01'}));
  const assessments=new Map(records.map(record=>[record.id,{record,reason:'eligible'}]));
  const rows=[['US','Alpha','Left A','tablet','10mg','Co'],['US','Beta','Left B','capsule','40mg','Co'],['US','Alpha + Beta','Left AB','tablet','30mg','Co'],['US','Gamma','Left C','tablet','50mg','Co']];
  window.SraExcel={build:async sheets=>{window.exported=sheets;return new Uint8Array([1]);}};
  window.compare=SraCompare({dialog:document.getElementById('vn-compare'),records,assessments:()=>assessments,reasons:{eligible:'đủ điều kiện'},countryName:x=>x,fold:x=>String(x).toLowerCase(),getResults:()=>rows.map(row=>({row,cc:'US'})),companyLink:()=>({url:'https://example.com'}),formLabel:x=>x,sourceOf:()=>({}),sourceUrl:()=>''});
  return compare.open();
 });
 const done=()=>page.waitForFunction(()=>document.getElementById('compare-status').textContent==='Đã đối chiếu · 100%');
 const right=()=>page.locator('#compare-right .compare-row').count();
 assert.equal(await right(),6);
 await page.locator('#compare-sdk-max').fill('2');await page.locator('#compare-sdk-on').check();assert.equal(await right(),3); // Beta and Gamma, global component counts
 await page.locator('#compare-form-on').check();assert.equal(await right(),2); // missing form does not qualify
 await page.locator('#compare-strength-max').fill('2');await page.locator('#compare-strength-on').check();assert.equal(await right(),2);
 await page.locator('#compare-right .compare-row').filter({hasText:'Drug 3'}).click();await done();
 assert.equal(await page.locator('#compare-left .compare-row').count(),2);
 assert.match(await page.locator('#compare-left').innerText(),/Left B/);assert.match(await page.locator('#compare-left').innerText(),/Left AB/);
 await page.locator('#compare-left-form').selectOption('capsule');await done();assert.equal(await page.locator('#compare-left .compare-row').count(),1);
 await page.locator('#compare-left-form').selectOption('');await done();
 await page.locator('#compare-all').click();await done();assert.equal(await page.locator('#compare-left .compare-row').count(),4);
 await page.locator('#compare-left .compare-row').filter({hasText:'Left A'}).first().click();await done();assert.equal(await right(),0); // only matched Alpha must satisfy every rule
 await page.locator('#compare-all').click();await done();
 await page.locator('#compare-right-strength').selectOption('40mg');assert.equal(await right(),1);
 await page.locator('#compare-export').click();await page.waitForFunction(()=>!!window.exported);
 assert.deepEqual(await page.evaluate(()=>exported.map(s=>s.rows.length)),[4,1]);
 await page.locator('#compare-sdk-max').fill('0');assert.equal(await right(),0);
 await page.locator('#compare-sdk-on').uncheck();await page.locator('#compare-form-on').uncheck();await page.locator('#compare-strength-on').uncheck();
 await page.locator('#compare-right-strength').selectOption('');assert.equal(await right(),6);
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.locator('#vn-compare').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS: global distinct SDK/form/strength counts, missing values, same-component rules, bidirectional matching, dropdowns, Excel scope and responsive layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
