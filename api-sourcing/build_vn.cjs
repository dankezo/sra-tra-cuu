// Reuse the DAV policy and ingredient normalization already used by the medicine app.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const SraVn=require('../_vn_logic.js');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/vn-ingredients.json'),'utf8'));
const evidence=JSON.parse(fs.readFileSync(path.join(root,'data/vn-evidence.json'),'utf8')).items||[];
const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
const index={};
for(const row of data.records){
 const r=Object.fromEntries(data.columns.map((k,i)=>[k,row[i]]));
 const a=SraVn.assess(r,{},today,evidence);
 if(['revoked','expired','missingExpiry','notChemical','notCommercial'].includes(a.reason) || !SraVn.dateValue(r.expiry) || r.expiry<today)continue;
 for(const ingredient of SraVn.components(r.inn)){
  const key=SraVn.key(ingredient);if(!key)continue;
  index[key]||=[];
  if(index[key].length<20 && !index[key].some(x=>x.sdk===r.sdk))index[key].push({sdk:r.sdk,inn:r.inn,expiry:r.expiry,reason:a.reason});
 }
}
fs.writeFileSync(path.join(__dirname,'vn-index.json'),JSON.stringify({source:data.url,updated:data.updated,assessed_at:today,index}));
console.log('DAV ingredient keys:',Object.keys(index).length);
