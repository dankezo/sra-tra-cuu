const assert=require('node:assert/strict'), fs=require('node:fs'),vn=require('./_vn_logic');
const data=JSON.parse(fs.readFileSync('data/vn-ingredients.json','utf8'));
const dm=JSON.parse(fs.readFileSync('data/vn-domestic-list.json','utf8'));
const snap=vn.snapshot({...data,domestic:dm}),index=snap.configure(vn.SIMPLE_POLICY,'2026-09-23');
const forteka=snap.records.find(r=>r.sdk==='460410140226');
assert.equal(forteka.product,'Forteka');assert.match(forteka.registrant,/Anabion/);assert.doesNotMatch(forteka.registrant,/BIOCAD/);
for(const a of index.audit.filter(a=>a.tagId==='TAG_XANH_LA')) {
 assert.ok(a.record.inn && a.expiry>='2026-09-23' && a.expiry>vn.addMonths(a.record.renewed || a.record.issued,36));assert.ok(vn.chemicalSdk(a.record.sdk,a.record.oldSdk));
 assert.notEqual(index.domestic(a.record.inn,a.record.strength,a.record.form,'2'),'blocked');
 assert.equal(a.tagId,'TAG_XANH_LA');
}
assert.ok((index.tagStats.TAG_XANH_LA||0)>0);
assert.ok((index.tagStats.TAG_CAM_CMO||0)>0);
assert.ok((index.tagStats.TAG_XAM_LICH_SU||0)>0);
const small=vn.relatedIndex([{id:'1',inn:'Paracetamol'},{id:'2',inn:'paracetamóle 5mg / abcxyg 6mg'},{id:'3',inn:'Notparacetamol'},{id:'4',inn:''}]);
assert.deepEqual(small.find(['Paracetamol']).map(h=>h.record.id),['1','2']);
assert.equal(small.find(['Paracetamol'])[1].kind,'Gần khớp cách viết');
assert.deepEqual(small.find([]),[]);assert.deepEqual(small.find(['Notparacetamol']).map(h=>h.record.id),['3']);
assert.equal(small.find(['Paracetamol','paracetamole']).length,2);
console.log('PASS: green tag >3y grant + >18m remaining, domestic CMO tag, DAV registrant, component comparison');
console.log(index.tagStats);

const asOf='2026-09-24';
const abrocto=snap.configure(vn.SIMPLE_POLICY,asOf).audit.filter(a=>a.record.product==='Abrocto');
assert.equal(abrocto.length,2);
assert.ok(abrocto.every(a=>a.tagId==='TAG_XANH_LA' || a.tagId==='TAG_VANG_XAC_MINH'));
const base={...abrocto[0].record,issued:'2024-01-01',renewed:'',expiry:'2027-01-01'};
assert.equal(vn.assess(base,vn.SIMPLE_POLICY,asOf).reason,'shortTerm');
assert.equal(vn.tagFromReason('shortTerm'),'TAG_VANG_XAC_MINH');
assert.equal(vn.assess({...base,expiry:'2026-12-31'},vn.SIMPLE_POLICY,asOf).reason,'shortTerm');
assert.equal(vn.assess({...base,issued:'2020-01-01',expiry:'2026-09-23'},vn.SIMPLE_POLICY,asOf).reason,'expired');
assert.equal(vn.assess({...base,issued:'2020-01-01',renewed:'2025-01-01'},vn.SIMPLE_POLICY,asOf).reason,'shortTerm');
assert.equal(vn.tagFromReason('domestic'),'TAG_CAM_CMO');
assert.equal(vn.tagFromReason('eligible'),'TAG_XANH_LA');
assert.deepEqual(vn.defaultSelectedTags(),['TAG_XANH_LA']);
console.log('PASS: tag mapping, three-year cycle is yellow, expired/history and CMO tags');
