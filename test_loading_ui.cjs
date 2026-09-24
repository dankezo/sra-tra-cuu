const {chromium}=require(process.env.SRA_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(!localStorage.getItem('qa-page-seeded')){localStorage.setItem('sra-page','0');localStorage.setItem('qa-page-seeded','1');}
  window.bootValues=[];window.sawRowLoading=false;
  new MutationObserver(()=>{
   const p=document.getElementById('boot-progress');if(p && window.bootValues.at(-1)!==p.value)window.bootValues.push(p.value);
   if(document.querySelector('.cg-loading'))window.sawRowLoading=true;
  }).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});
 });
 await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));
 const pill=await page.locator('.boot-spinner').evaluate(e=>{const s=getComputedStyle(e);return {animation:s.animationName,w:parseFloat(s.width),h:parseFloat(s.height),background:s.backgroundImage};});
 assert.equal(pill.animation,'boot-spin');assert.ok(pill.w>pill.h*2);assert.match(pill.background,/linear-gradient/);
 assert.equal(await page.locator('#boot-progress').count(),1);await page.screenshot({path:'qa-boot-pill.png'});
 const ready=()=>page.waitForFunction(()=>!document.querySelector('.search-filters').inert&&!document.getElementById('vn-only').disabled);
 await ready();
 const progress=await page.evaluate(()=>bootValues);assert.equal(progress.at(-1),100);assert.ok(progress.length>10);assert.ok(progress.every((n,i)=>!i||n>=progress[i-1]));
 assert.equal(await page.locator('#page-size').inputValue(),'50');assert.equal(await page.evaluate(()=>localStorage.getItem('sra-page')),'50');
 await page.locator('#mgo').click();await page.waitForFunction(()=>!document.querySelector('#compare-toggle').disabled);
 const card=page.locator('#med-groups details[data-cc=VN]');await card.locator('summary').click();
 await page.waitForFunction(()=>document.querySelectorAll('#med-groups details[data-cc=VN] tbody tr').length===50&&!document.querySelector('#med-groups details[data-cc=VN]').hasAttribute('aria-busy'));
 assert.ok(await page.evaluate(()=>sawRowLoading));assert.match(await card.locator('.cg-n').innerText(),/54\.752/);
 await card.locator('.more').click();await page.waitForFunction(()=>document.querySelectorAll('#med-groups details[data-cc=VN] tbody tr').length===100);
 await page.locator('#page-size').selectOption('100');await page.waitForFunction(()=>!document.querySelector('#compare-toggle').disabled);
 await page.waitForFunction(()=>document.querySelectorAll('#med-groups details[data-cc=VN] tbody tr').length===100);
 assert.equal(await page.evaluate(()=>localStorage.getItem('sra-page')),'100');
 await page.evaluate(()=>localStorage.setItem('sra-page','20000'));await page.reload();await ready();
 assert.equal(await page.locator('#page-size').inputValue(),'50');assert.equal(await page.evaluate(()=>localStorage.getItem('sra-page')),'50');
 assert.deepEqual(errors,[]);
 console.log('PASS: capsule loader, monotonic progress to 100%, legacy all/20000 -> 50, large country opens 50, load more, selectable saved page size');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
