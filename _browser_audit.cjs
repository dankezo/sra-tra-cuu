const { chromium } = require(process.env.SRA_PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
(async()=>{
const file='data/company-link-audit.json';
const audit=JSON.parse(fs.readFileSync(file,'utf8'));
const browser=await chromium.launch({headless:true});
const urls=Object.keys(audit.sites).filter(u=>!audit.sites[u].reachable);
let next=0;
await Promise.all(Array.from({length:5},async()=>{
 const page=await browser.newPage();
 while(next<urls.length){
  const url=urls[next++];
  try {
   const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:22000});
   const body=(await page.locator('body').innerText({timeout:3000})).slice(0,20000);
   const title=await page.title();
   const reachable=!!res && res.ok() && body.length>150 && !/just a moment|access denied|attention required|verify you are human|domain is for sale/i.test(title+' '+body.slice(0,600));
   audit.sites[url]={...audit.sites[url],browserStatus:res?.status(),url:page.url(),title,reachable,browserChecked:true,excerpt:body.slice(0,600)};
  }catch(e){audit.sites[url].browserError=e.message.split('\n')[0];}
 }
 await page.close();
}));
fs.writeFileSync(file,JSON.stringify(audit,null,2));
await browser.close();
console.log('Reachable',Object.values(audit.sites).filter(v=>v.reachable).length,'/',Object.keys(audit.sites).length);
console.log(Object.entries(audit.sites).filter(([u,v])=>!v.reachable).map(([u,v])=>u+' '+(v.title||v.error)).join('\n'));
})();
