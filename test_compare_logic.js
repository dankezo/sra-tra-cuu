const assert=require('node:assert/strict'), fs=require('node:fs'),vn=require('./_vn_logic');
const data=JSON.parse(fs.readFileSync('data/vn-ingredients.json','utf8'));
const dm=JSON.parse(fs.readFileSync('data/vn-domestic-list.json','utf8'));
const snap=vn.snapshot({...data,domestic:dm}),index=snap.configure(vn.SIMPLE_POLICY,'2026-09-23');
const forteka=snap.records.find(r=>r.sdk==='460410140226');
assert.equal(forteka.product,'Forteka');assert.match(forteka.registrant,/Anabion/);assert.doesNotMatch(forteka.registrant,/BIOCAD/);
for(const a of index.audit.filter(a=>a.reason==='eligible')) {
 assert.ok(a.record.inn && a.expiry>='2029-09-23');assert.ok(vn.chemicalSdk(a.record.sdk,a.record.oldSdk));
 assert.notEqual(index.domestic(a.record.inn,a.record.strength,a.record.form,'2'),'blocked');
}
const small=vn.relatedIndex([{id:'1',inn:'Paracetamol'},{id:'2',inn:'paracetamóle 5mg / abcxyg 6mg'},{id:'3',inn:'Notparacetamol'},{id:'4',inn:''}]);
assert.deepEqual(small.find(['Paracetamol']).map(h=>h.record.id),['1','2']);
assert.equal(small.find(['Paracetamol'])[1].kind,'Gần khớp cách viết');
assert.deepEqual(small.find([]),[]);assert.deepEqual(small.find(['Notparacetamol']).map(h=>h.record.id),['3']);
assert.equal(small.find(['Paracetamol','paracetamole']).length,2);
console.log('PASS: fixed 36-month policy, domestic exclusions, DAV registrant, component comparison and deduplication');
console.log(index.stats);
