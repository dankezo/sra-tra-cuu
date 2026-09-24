/* Match ingredient components only, never product names or arbitrary substrings. */
(function(root) {
  const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
  function components(text) {
    let value = fold(text).replace(/(\d),(\d)/g, '$1.$2');
    // Parentheses usually describe salt equivalents; retain the named ingredient outside.
    for (let i = 0; i < 5; i++) value = value.replace(/\([^()]*\)/g, ' ');
    value = value.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|µg|g|kg|ml|l|iu|ui|meq|mmol|%)(?=\W|$)/g, ' ');
    return value.split(/[;+\/,\n]|\s+(?:and|va|&|\*)\s+/).map(part => part
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ').trim()).filter(part => part.length >= 3 && /[a-z]/.test(part));
  }
  function key(text) {
    return text.split(' ').map(word => {
      if (word === 'acetaminophen') return 'paracetamol';
      if (word === 'aciclovir') return 'acyclovir';
      if (word === 'sodium') return 'natri';
      if (['hydrochloride', 'hydrocloride', 'hydroclorid', 'hcl'].includes(word)) return 'hydrochlorid';
      if (['dihydrochloride', 'dihydroclorid'].includes(word)) return 'dihydrochlorid';
      // Limited spelling variants (paracetamole, cefixime/cefixim), not edit-distance guessing.
      return word.length >= 7 ? word.replace(/e$/, '') : word;
    }).join(' ');
  }
  function create(ingredients) {
    const keys = new Set(ingredients.flatMap(components).map(key));
    const cache = new Map();
    return { size: keys.size, matches(text) {
      if (!cache.has(text)) cache.set(text, components(text).some(part => keys.has(key(part))));
      return cache.get(text);
    }};
  }
  const DEFAULTS = {months:24, excludeShort:true, chemicalOnly:true, excludeDomestic:true, group:'2'};
  // Tag filter policy: green needs >18 months remaining and grant cycle >3 years.
  const SIMPLE_POLICY = Object.freeze({months:18, excludeShort:true, chemicalOnly:true, excludeDomestic:true, excludeDomesticRecords:true, group:'2'});
  const DEFAULT_TAG_CONFIGS = Object.freeze([
    {
      id: 'TAG_XANH_LA',
      colorHex: '#22c55e',
      bgClass: 'tag-green',
      label: 'Sẵn sàng dự thầu',
      shortTitle: 'Đủ điều kiện thầu thương mại (TT 40/2025)',
      description: 'SĐK còn hạn > 18 tháng, chu kỳ cấp trên 3 năm (thường 5 năm), pháp lý sạch, không dính Danh mục 93 cấm nhập khẩu.',
      defaultChecked: true,
    },
    {
      id: 'TAG_VANG_XAC_MINH',
      colorHex: '#eab308',
      bgClass: 'tag-amber',
      label: 'Cần xác minh / Hạn ngắn',
      shortTitle: 'Rủi ro kỹ thuật / Đang nộp gia hạn',
      description: 'SĐK hạn còn lại ≤ 18 tháng, hoặc cấp kỳ hạn ≤ 3 năm, hoặc đã nộp giấy tiếp nhận gia hạn. Dùng để dóng dữ liệu ngoại, cân nhắc khi chào thầu.',
      defaultChecked: false,
    },
    {
      id: 'TAG_CAM_CMO',
      colorHex: '#f97316',
      bgClass: 'tag-orange',
      label: 'Bẫy Danh mục 93 (CMO)',
      shortTitle: 'Khớp Danh mục 93 nội địa (TT 03/2024)',
      description: 'Trùng hoạt chất + hàm lượng + dạng bào chế với danh mục 93. Cấm hàng nhập khẩu chào thầu; cơ hội đặt gia công (CMO) trong nước.',
      defaultChecked: false,
    },
    {
      id: 'TAG_XAM_LICH_SU',
      colorHex: '#64748b',
      bgClass: 'tag-slate',
      label: 'Lịch sử / Đã hết hạn',
      shortTitle: 'SĐK đã hết hiệu lực / Thu hồi',
      description: 'SĐK đã dừng lưu hành, thu hồi, thiếu hạn hoặc ngoài loại mục tiêu. Giữ để tra cứu tiền lệ cấp phép khi dóng quốc tế.',
      defaultChecked: false,
    },
  ]);
  function tagFromReason(reason) {
    if (reason === 'domestic') return 'TAG_CAM_CMO';
    if (reason === 'eligible') return 'TAG_XANH_LA';
    if (reason === 'renewalReview' || reason === 'shortTerm' || reason === 'nearExpiry') return 'TAG_VANG_XAC_MINH';
    return 'TAG_XAM_LICH_SU';
  }
  function defaultSelectedTags(configs = DEFAULT_TAG_CONFIGS) {
    return configs.filter((t) => t.defaultChecked).map((t) => t.id);
  }
  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    const d = new Date(value + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value ? value : '';
  }
  function addMonths(value, months) {
    const [y,m,d] = value.split('-').map(Number), last = new Date(Date.UTC(y,m-1+months+1,0)).getUTCDate();
    return new Date(Date.UTC(y,m-1+months,Math.min(d,last))).toISOString().slice(0,10);
  }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function chemicalSdk(sdk, oldSdk='') {
    const s = String(sdk || '').trim().toUpperCase();
    const numeric = s.match(/^(\d{12})(?=$|\s|\()/);
    if (numeric) return numeric[1][3] === '1' || (['6','7'].includes(numeric[1][3]) && /^(VD|VN|VN2|VN3|GC)-\d/.test(String(oldSdk).trim().toUpperCase()));
    return /^(VD|VN|VN2|VN3|GC)-\d/.test(s);
  }
  function assess(record, options, asOf, evidence=[]) {
    const o = {...DEFAULTS, ...options}, flags = record.flags;
    const sdk = record.sdk.trim();
    const validEvidence = evidence.filter(e => [sdk, record.oldSdk].includes(e.sdk) && e.sdk &&
      /^https:\/\/(?:[\w-]+\.)*(?:dav\.gov\.vn|moh\.gov\.vn|chinhphu\.vn|vbpl\.vn)\//.test(e.source || '') &&
      dateValue(e.decisionDate) && e.decisionDate <= asOf);
    if ((flags & 12) || validEvidence.some(e=>e.kind==='revoked')) return {reason:'revoked'};
    if (!(flags & 1)) return {reason:'inactive'};
    if (o.chemicalOnly && !chemicalSdk(sdk,record.oldSdk)) return {reason:'type'};
    let expiry = dateValue(record.expiry), start = dateValue(record.renewed) || dateValue(record.issued), source = 'DAV';
    let fixedExtension = false;
    for (const e of validEvidence.filter(e=>e.kind==='extension').sort((a,b)=>a.decisionDate.localeCompare(b.decisionDate))) {
      if (dateValue(e.validUntil) && e.validUntil > expiry) {
        expiry = e.validUntil; start = dateValue(e.validFrom); source = e.source; fixedExtension = true;
      }
    }
    const continuation = (record.receiptDate && record.receiptDate <= asOf && record.receiptId && (flags & 16)) ||
      validEvidence.some(e=>e.kind==='continuation' && (!e.validUntil || e.validUntil >= asOf));
    // A receipt is not a fresh 3/5-year authorization. Never invent an expiry.
    if ((!expiry || expiry < asOf || ((flags & 2) && !fixedExtension)) && continuation) return {reason:'renewalReview', expiry, source};
    if (expiry && expiry < asOf) return {reason:'expired', expiry, source};
    if ((flags & 2) && !fixedExtension) return {reason:'expired', expiry, source};
    if (!expiry || ((flags & 32) && !fixedExtension)) return {reason:'unknownExpiry', expiry, source};
    if (!start || start > expiry || start > asOf) return {reason:'unknownTerm', expiry, source};
    if (o.excludeShort && expiry <= addMonths(start,36)) return {reason:'shortTerm', expiry, source};
    if (expiry < addMonths(asOf, Number(o.months))) return {reason:'nearExpiry', expiry, source};
    if (!components(record.inn).length) return {reason:'missingInn', expiry, source};
    return {reason:'eligible', expiry, source};
  }
  function amounts(text) {
    const s = fold(text).replace(/(\d),(\d)/g,'$1.$2').replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g,'$1$2$3');
    const parts = s.split(/\s*[;+\/]\s*/);
    const values = parts.map(part => {
      const m = part.trim().match(/^(\d+(?:\.\d+)?)\s*(mg|g|mcg|ug|µg|iu|ui)$/);
      if (!m) return null;
      return /^(iu|ui)$/.test(m[2]) ? Number(m[1])+'iu' : Number((Number(m[1]) * (m[2]==='g'?1000:/^(mcg|ug|µg)$/.test(m[2])?.001:1)).toPrecision(12))+'mg';
    });
    return values.every(v=>v!==null) ? values : null;
  }
  function formType(text) {
    const s=fold(text);
    if (/liposom|nano|lyophili|dong kho|prefilled|pre-filled|depot|long.acting|orodispers|disintegrat|dispersible|efferv|sui|subling|buccal|duoi luoi|hoa tan nhanh|intravitreal|intraocular|nhan cau|dinh lieu|cartridge|syringe|pen\b/.test(s)) return 'special';
    if (/gastro.?resist|enteric|tan (o|trong) ruot|magensaftresist|maagsapresist|dojelit/.test(s)) return 'enteric';
    if (/modified.release|prolonged.release|extended.release|sustained.release|controlled.release|retard|liberation prolongee|liberacion prolongada|liberacao prolongada|rilascio (prolungato|modificato)|verlaengerte|verlangerte|modifizierte|giai phong (co kiem soat|keo dai|cham)|phong thich (keo dai|cham)/.test(s)) return 'modified';
    // Unrecognized release qualifiers must not fall through to an ordinary tablet.
    if (/release|liberation|liberacion|liberacao|rilascio|freisetz|giai phong|phong thich/.test(s)) return 'special';
    if (/inject|infusion|tiem|truyen/.test(s)) return 'injection';
    if (/capsul|vien nang|kapsel|gelule/.test(s)) return 'capsule';
    if (/tablet|comprim|tablett|vien nen|^vien$/.test(s)) return 'tablet';
    return '';
  }
  const signature = text => components(text).map(key).sort().join('|');
  function paired(text,strength) {
    const inn=components(text).map(key), dose=amounts(strength);
    return dose && dose.length===inn.length ? inn.map((s,i)=>s+':'+dose[i]).sort().join('|') : '';
  }
  function domesticMatcher(rows) {
    const groups=new Map(), cache=new Map();
    for(const row of rows) {const sig=signature(row.inn); if(!groups.has(sig))groups.set(sig,[]);groups.get(sig).push(row);}
    return (inn,strength,form,group='2') => {
      const cacheKey=JSON.stringify([inn,strength,form,group]);
      if(cache.has(cacheKey))return cache.get(cacheKey);
      const candidates=(groups.get(signature(inn)) || []).filter(r=>r.group===group);
      let result='unlisted';
      if(!candidates.length) {
        const keys=components(inn).map(key);
        // Possible salt/base variant: flag for checking; no molecular-weight conversion is guessed.
        for(const [sig, rs] of groups) {
          const other=sig.split('|');
          if(rs.some(r=>r.group===group) && keys.length===other.length && keys.every(k=>other.some(v=>k===v || k.startsWith(v+' ') || v.startsWith(k+' ')))) {result='review';break;}
        }
      }
      if(candidates.length) {
        const p=paired(inn,strength), f=formType(form);
        result=!p || !f || f==='special' ? 'review' : 'different';
        for(const r of candidates) {
          if(!p || p!==paired(r.inn,r.strength))continue;
          const rf=formType(r.form);
          if(f && f!=='special' && (rf===f || (r.form==='Viên' && ['capsule','tablet'].includes(f)))) {result='blocked';break;}
        }
      }
      cache.set(cacheKey,result);return result;
    };
  }
  function snapshot(data) {
    const records=(data.records || []).map(row=>Object.fromEntries(data.columns.map((name,i)=>[name,data.table ? data.table[row[i]] : row[i]])));
    const domestic=domesticMatcher(data.domestic?.rows || []);
    return {records, configure(options={}, asOf=today()) {
      const o={...SIMPLE_POLICY, ...options};
      const stats={}, tagStats={}, eligible=[], audit=[];
      for(const r of records) {
        const a=assess(r,o,asOf,data.evidence?.items || []);
        const dom=domestic(r.inn,r.strength,r.form,o.group || '2');
        // DM93 technical-cell match wins the CMO tag even when the registration is otherwise usable.
        const reason=dom==='blocked' ? 'domestic' : a.reason;
        const tagId=tagFromReason(reason);
        stats[reason]=(stats[reason]||0)+1;
        tagStats[tagId]=(tagStats[tagId]||0)+1;
        const entry={record:r,...a, reason, tagId, domestic:dom};
        audit.push(entry);
        if(tagId==='TAG_XANH_LA')eligible.push(r.inn);
      }
      const byTag=new Map();
      for(const entry of audit){
        if(!byTag.has(entry.tagId))byTag.set(entry.tagId,[]);
        byTag.get(entry.tagId).push(entry);
      }
      function indexFor(selectedTags){
        const tags=new Set(selectedTags || []);
        const inns=audit.filter(e=>tags.has(e.tagId)).map(e=>e.record.inn);
        return create(inns);
      }
      function recordsFor(selectedTags){
        const tags=new Set(selectedTags || []);
        return audit.filter(e=>tags.has(e.tagId)).map(e=>e.record);
      }
      return {...create(eligible), stats, tagStats, audit, domestic, asOf, indexFor, recordsFor, byTag};
    }};
  }
  function relatedIndex(records) {
    const index=new Map();
    records.forEach((record,i)=>{for(const k of new Set(components(record.inn).map(key))) {if(!index.has(k))index.set(k,[]);index.get(k).push(i);}});
    return {find(texts) {
      const wanted=new Map();
      for(const text of texts) for(const part of components(text)) {const k=key(part);if(!wanted.has(k))wanted.set(k,new Set());wanted.get(k).add(part);}
      const hits=new Map();
      for(const [k,parts] of wanted) for(const i of index.get(k)||[]) {
        if(!hits.has(i))hits.set(i,{record:records[i],matched:[],exact:false});
        const hit=hits.get(i);hit.matched.push(k);
        if(components(records[i].inn).some(p=>parts.has(p)))hit.exact=true;
      }
      return [...hits.values()].map(hit=>({...hit,kind:hit.exact?'Khớp thành phần':'Gần khớp cách viết'}));
    }};
  }
  const api = {components, key, create, DEFAULTS, SIMPLE_POLICY, DEFAULT_TAG_CONFIGS, tagFromReason, defaultSelectedTags, relatedIndex, chemicalSdk, assess, addMonths, dateValue, amounts, formType, domesticMatcher, snapshot};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SraVn = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
