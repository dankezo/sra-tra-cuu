const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
export function compassListings(text,url,query) {
 if(!text.includes('URL Source: '+url))throw new Error('SourceIdentityMissing');if(/captcha|access denied|verify you are human/i.test(text.slice(0,600)))throw new Error('SourceBlocked');
 const countries={India:'IN',China:'CN',Iran:'IR','U.S.A':'US',USA:'US',Japan:'JP',Germany:'DE',Ireland:'IE',Canada:'CA',Italy:'IT',Spain:'ES',France:'FR',Switzerland:'CH',Algeria:'DZ'};
 const headings=[...text.matchAll(/^### \[([^\]\n]{2,250})\]\((https:\/\/www\.pharmacompass\.com\/(?:api-manufacturers|pharma-services|pharma-excipients)\/[^\s)]+)\)/gm)],seen=new Set();
 return headings.map((m,i)=>{
  const block=text.slice(m.index,headings[i+1]?.index||text.length).split(/\n##? Looking for /)[0];
  const country=block.slice(m[0].length).split('\n').map(s=>s.trim()).find(Boolean)||'';
  return {company:m[1],country:countries[country]||null,country_text:/^[A-Za-z. ]{2,40}$/.test(country)?country:'',website:safeUrl(block.match(/\[Website\]\((https:[^)]+)\)/)?.[1]),profile_url:safeUrl(m[2]),source_url:url,ingredient:query,raw_snippet:block.slice(0,1800),verification:'supplier_claimed',source:'PharmaCompass',fetched_at:new Date().toISOString()};
 }).filter(r=>{if(seen.has(r.company))return false;seen.add(r.company);return true}).slice(0,60);
}
export function publicPageUrl(input) {
 const url=safeUrl(input);if(!url)return '';const u=new URL(url);
 if(u.port && u.port!=='443'||/^(?:localhost|[\d.]+|\[)/i.test(u.hostname)||/\.(?:local|internal|onion)$/.test(u.hostname)||/(?:^|\.)fda\.gov$/.test(u.hostname))return '';
 return url;
}
async function boundedText(response) {
 if(!response.ok)throw new Error('SourceHTTP_'+response.status);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000)throw new Error('SourceTooLarge');chunks.push(value)}}finally{try{await reader.cancel()}catch{}}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return new TextDecoder().decode(bytes);
}
const unescape=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g,t=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&nbsp;':' '})[t]);
const blocked=text=>/access denied|verify you are human|aliyunCaptcha|captcha-element|cf-chl-|just a moment|Title: Verification|Access Verification|Please slide to verify|requiring CAPTCHA|_waf_/i.test(text.replace(/\\/g,'').slice(0,22000));
const cleanHtml=html=>unescape(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/(?:p|div|h[1-6]|li|section)>/gi,'\n\n').replace(/<[^>]*>/g,' ').replace(/[ \t]+/g,' '));
async function readerQuota(env,provider,cap) {
 if(!env.DB)return false;
 const period=new Date().toISOString().slice(0,7);
 return !!await env.DB.prepare('INSERT INTO apisrc_cloud_usage(provider,period,requests) VALUES(?,?,1) ON CONFLICT(provider,period) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').bind(provider,period,cap).first();
}
export function directoryProducts(text,url,query) {
 if(!/(?:^|\.)(?:cphi-online\.com|pharmasources\.com)$/.test(new URL(url).hostname))return [];
 const fold=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),out=[];
 if(new URL(url).hostname.endsWith('pharmasources.com')){
  const primary=text.split(/Other Products From This Supplier|Similar Products From Other Supplier/)[0],heading=primary.match(/^# ([^\n]{2,400})$/m);
  const seller=primary.match(/\[!\[([^\]\n]{3,250})\]\(https:\/\/cimg\.cphi\.cn\/[^)]+\)[\s\S]{0,1800}?\]\((https:\/\/www\.pharmasources\.com\/company-home\/[^\s)]+)\)/);
  if(heading&&seller&&(` ${fold(heading[1])} `).includes(` ${fold(query)} `))out.push({company:seller[1],ingredient:heading[1],source_url:url,profile_url:safeUrl(seller[2]),source:'PharmaSources',raw_snippet:primary.slice(heading.index).slice(0,5000),supplier_role:/Is Manufacturer\s+No/.test(primary)?'seller':'not_verified',verification:'supplier_claimed',fetched_at:new Date().toISOString()});
 }
 for(const match of text.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let root;try{root=JSON.parse(match[1])}catch{continue}
  for(const product of Array.isArray(root)?root:root['@graph']||[root]){
   if(!['Product','Drug'].includes(product['@type'])||typeof product.name!=='string'||!(` ${fold(product.name)} `).includes(` ${fold(query)} `))continue;
   const maker=product.manufacturer;
   if(!maker||typeof maker.name!=='string'||maker.name.length<3||maker.name.length>250)continue;
   const website=text.match(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>\s*Website\s*<\/a>/i)?.[1];
   const country=cleanHtml(text.slice(text.indexOf('Country/Region:'),text.indexOf('Country/Region:')+550)).match(/Country\/Region:\s*(India|China|Germany|USA|United Kingdom)\b/)?.[1];
   out.push({company:maker.name,ingredient:product.name,website:safeUrl(website),country:({India:'IN',China:'CN',Germany:'DE',USA:'US','United Kingdom':'GB'})[country]||null,source_url:url,profile_url:safeUrl(maker.url)||url,source:new URL(url).hostname,raw_snippet:JSON.stringify(product,null,2).slice(0,5000),verification:'supplier_claimed',fetched_at:new Date().toISOString()});
  }
 }
 return out.slice(0,20);
}
export async function readPage(url,env,fetcher=fetch) {
 if(!publicPageUrl(url))throw new Error('InvalidSource');
 // Ordinary public HTTP first. PharmaCompass needs Jina's heading/link format.
 if(!new URL(url).hostname.endsWith('pharmacompass.com'))try{
  let target=url,response;const signal=AbortSignal.timeout(5000);
  for(let i=0;i<4;i++){response=await fetcher(target,{redirect:'manual',signal});if(![301,302,303,307,308].includes(response.status))break;target=publicPageUrl(new URL(response.headers.get('Location'),target).href);if(!target)throw new Error('InvalidSource');}
  const html=await boundedText(response);if(blocked(html))throw new Error('SourceBlocked');
  if(/application\/ld\+json/i.test(html)&&/cphi-online\.com$/.test(new URL(url).hostname))return html;
  const text=/text\/html/i.test(response.headers.get('Content-Type')||'')||/^\s*<!?html/i.test(html)?cleanHtml(html):html;
  if(text.trim().length>80)return 'URL Source: '+url+'\n\n'+text;
 }catch{}
 try{
  const text=await boundedText(await fetcher('https://r.jina.ai/'+url,{headers:env.JINA_API_KEY?{Authorization:'Bearer '+env.JINA_API_KEY}:{},signal:AbortSignal.timeout(7000)}));
  if(blocked(text))throw new Error('SourceBlocked');if(text.trim().length>80)return text;
 }catch{}
 if(env.EXA_API_KEY&&await readerQuota(env,'exa_contents',20))try{
  const body=JSON.parse(await boundedText(await fetcher('https://api.exa.ai/contents',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':env.EXA_API_KEY},signal:AbortSignal.timeout(4000),body:JSON.stringify({urls:[url],text:{maxCharacters:20000}})})));
  const row=body.results?.find(r=>safeUrl(r.url).replace(/\/$/,'')===url.replace(/\/$/,''));if(row?.text&&!blocked(row.text))return 'URL Source: '+url+'\n\n'+row.text;
 }catch{}
 if(env.FIRECRAWL_API_KEY&&await readerQuota(env,'firecrawl',25))try{
  const body=JSON.parse(await boundedText(await fetcher('https://api.firecrawl.dev/v2/scrape',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.FIRECRAWL_API_KEY},signal:AbortSignal.timeout(9000),body:JSON.stringify({url,formats:['markdown'],onlyMainContent:true,timeout:8000})})));
  if(body.success&&body.data?.markdown&&!blocked(body.data.markdown))return 'URL Source: '+url+'\n\n'+body.data.markdown;
 }catch{}
 throw new Error('SourceUnreadable');
}
export async function readCompass(query,env,fetcher=fetch) {
 const slug=query.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const url='https://www.pharmacompass.com/listed-active-pharmaceutical-ingredients/'+slug;
 return {listings:compassListings(await readPage(url,env,fetcher),url,query),source_url:url};
}
