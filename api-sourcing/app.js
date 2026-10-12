const ApiSourcing = (() => {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyLegalSuffix = 'private|pvt|limited|ltd|inc|incorporated|llc|llp|corporation|corp|co|company|plc|gmbh|ag|kg|sa|s a|spa|s p a|srl|s r l|bv|b v|nv|n v|pte';
  const companyNameKey = (name,country='') => {
    let key=norm(name).replace(/^m s /,'');
    // Some public holders include the city/country after the legal name. Keep the raw record unchanged.
    if(/^[a-z]{2}$/i.test(country)){const place=key.match(new RegExp('^(.*\\b(?:'+companyLegalSuffix+'))\\s+.+\\s+'+norm(country)+'$'));if(place)key=place[1];}
    return key.replace(new RegExp('(?:\\s+(?:'+companyLegalSuffix+'))+$'),'').trim();
  };
  const matchingProfiles = (company,profiles) => {
    const key=companyNameKey(company.canonical_name,company.country);if(key.replace(/ /g,'').length<3)return [];
    const matches=profiles.filter(r=>companyNameKey(r.company.canonical_name,r.company.country)===key && (!company.country || !r.company.country || company.country===r.company.country));
    // Several source spellings can share a name; show each original, never combine identities or evidence.
    return new Set(matches.map(r=>r.company.country).filter(Boolean)).size>1 ? [] : matches;
  };
  const safeUrl = s => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const state = (c, date = new Date().toISOString().slice(0, 10)) => {
    if (['expired', 'suspended', 'withdrawn', 'inactive'].includes(c.status) || c.expires_at && c.expires_at < date) return 'bad';
    if (c.verification === 'supplier_claimed') return 'claim';
    if (c.verification === 'official_verified' && ['valid', 'active'].includes(c.status)) return 'good';
    return 'unknown';
  };
  const termsMatch = (text, terms) => terms.some(term => (` ${norm(text)} `).includes(` ${norm(term)} `));
  const viName = raw => {
    const text=norm(raw), names={amlodipine:'Amlodipin',amlodipin:'Amlodipin',acetaminophen:'Paracetamol',paracetamol:'Paracetamol',metformin:'Metformin',amoxicillin:'Amoxicilin',amoxicilin:'Amoxicilin',cefalexin:'Cefalexin',cephalexin:'Cefalexin',atorvastatin:'Atorvastatin',rosuvastatin:'Rosuvastatin',valsartan:'Valsartan',losartan:'Losartan',omeprazole:'Omeprazol',omeprazol:'Omeprazol',pantoprazole:'Pantoprazol',esomeprazole:'Esomeprazol',ciprofloxacin:'Ciprofloxacin',levofloxacin:'Levofloxacin',azithromycin:'Azithromycin',simvastatin:'Simvastatin',clopidogrel:'Clopidogrel',fluconazole:'Fluconazol',fluconazol:'Fluconazol',ibuprofen:'Ibuprofen',diclofenac:'Diclofenac',telmisartan:'Telmisartan'};
    const base=Object.keys(names).find(n=>text===n || text.startsWith(n+' '));
    if(!base)return 'Chưa có tên Việt';
    // Labels only: preserve salt/isomer/hydrate distinctions in the source record and search.
    const remainder=text.slice(base.length).trim(),forms={besylate:'besilat',besilate:'besilat',besilat:'besilat',benzoate:'benzoat',benzoat:'benzoat',hydrochloride:'hydroclorid',hydrochlorid:'hydroclorid',hcl:'hydroclorid',maleate:'maleat',mesylate:'mesilat',mesilate:'mesilat',sulfate:'sulfat',sulphate:'sulfat',sodium:'natri',potassium:'kali',calcium:'calci',magnesium:'magnesi',succinate:'succinat',fumarate:'fumarat',tartrate:'tartrat',phosphate:'phosphat',monohydrate:'monohydrat',dihydrate:'dihydrat',trihydrate:'trihydrat',anhydrous:'khan'};
    const annotation=remainder.search(/\b(process|site)\b/),formText=annotation<0 ? remainder : remainder.slice(0,annotation).trim();
    const standards=formText.match(/\b(usp|ep|bp|ip)\b/g) || [];
    const tokens=formText.split(' ').filter(t=>t && !standards.includes(t));
    if(tokens.some(t=>!forms[t]))return 'Chưa có tên Việt';
    const translated=tokens.map(t=>forms[t]);
    return names[base]+(translated.length ? ' · dạng '+translated.join(' ') : '')+(standards.length ? ' · chuẩn '+standards.map(s=>s.toUpperCase()).join('/') : '')+(annotation<0 ? '' : ' · ghi chú nguồn: '+remainder.slice(annotation));
  };
  const googleUrl = (query,company='') => 'https://www.google.com/search?'+new URLSearchParams({q:[query,company,'API supplier'].filter(Boolean).join(' ')});
  const matchesCertificates = (certs,types,all=false) => !types.length || (all ? types.every(t=>certs.some(c=>c.type===t && state(c)==='good' && (t!=='CEP' || ['Chemical','Chemical and TSE'].includes(c.cep_type)))) : types.some(t=>certs.some(c=>c.type===t && state(c)==='good' && (t!=='CEP' || ['Chemical','Chemical and TSE'].includes(c.cep_type)))));
  const mergeWeb = (old,added) => [...new Map([...old,...added].filter(r=>safeUrl(r.url)).map(r=>[safeUrl(r.url).replace(/\/$/,''),r])).values()];
  const ingredientNames = r => [...new Set((r.substances || []).map(s=>s.inn).filter(Boolean))];
  const emailDraft = (r,kind='quote') => {
    const names=ingredientNames(r).join('; ') || r.query;
    return {subject:(kind==='documents' ? 'API dossier request: ' : 'Request for quotation: ')+names,
      body:`Dear ${r.company.canonical_name},\n\n${kind==='documents' ? 'Please provide the current quality and regulatory dossier for' : 'Please quote price, MOQ, lead time, availability and pack size for'}:\n${names}.\n\nPlease identify the exact salt/hydrate form, manufacturer and manufacturing site. Please provide GMP evidence and scope, CEP (if available) or API quality dossier, batch CoA, stability/retest period and letter of access/authorization. For CPP/COPP, please confirm applicability and issuing authority; do not substitute WHO PQ for this certificate.\n\nPublic-source references (to be reconfirmed): ${(r.certificates || []).map(c=>c.type+' '+c.identifier).join('; ')}.\nIntended market: Vietnam. Please confirm documents available for our regulatory review.\n\nBest regards,\nBao An Pharma`};
  };
  const bagSheets = (bag,vn,refsFor=()=>[]) => {
    const certCell=(item,type)=>{
      const certs=(item.snapshot.certificates || []).filter(c=>c.type===type && c.verification==='official_verified' && safeUrl(c.source_url));
      if(certs.length){const c=certs.find(c=>state(c)==='good') || certs[0];return {text:'Có · '+c.identifier+' · '+(c.raw_status || c.status),link:safeUrl(c.source_url)};}
      const doc=item.docs?.[{GMP:'gmp',COPP:'copp',CEP:'cep'}[type]];
      return doc?.received && safeUrl(doc.source) ? {text:'Có · tự nhập, chưa xác minh'+(doc.expiry ? ' · hạn '+doc.expiry : ''),link:safeUrl(doc.source)} : 'Không';
    };
    return [{name:'Nha cung cap',headers:['STT','Tên công ty','Nước','Website','Hoạt chất gốc / dạng','Tên hoạt chất tiếng Việt / dạng','CEP','DMF US','WHO PQ API','GMP','CPP/COPP','DAV'],rows:bag.map((item,i)=>{
      const r=item.snapshot,names=ingredientNames(r),refs=[...new Map(names.flatMap(refsFor).map(ref=>[ref.sdk,ref])).values()];
      let country=r.company.country || 'Chưa rõ';try{if(r.company.country)country=new Intl.DisplayNames(['vi'],{type:'region'}).of(r.company.country)+' ('+r.company.country+')';}catch{}
      return [i+1,r.company.canonical_name,country,safeUrl(r.company.website) ? {text:r.company.website,link:r.company.website} : 'Chưa xác minh',names.join('\n'),names.map(name=>viName(name)==='Chưa có tên Việt' ? '—' : viName(name)).join('\n'),...['CEP','DMF_US','WHO_PQ','GMP','COPP'].map(t=>certCell(item,t)),refs.length ? {text:'Có · thuốc theo hoạt chất: '+refs.map(ref=>ref.sdk).join(', ')+'; chưa xác nhận nguồn API',link:safeUrl(vn?.source)} : 'Không'];
    })},{name:'Email mau',headers:['STT','Tên công ty','Hoạt chất gốc / dạng','Tiêu đề','Nội dung email có thể sửa','Ghi chú'],rows:bag.map((item,i)=>{const r=item.snapshot,draft=item.email || emailDraft(r);return [i+1,r.company.canonical_name,ingredientNames(r).join('\n'),draft.subject,draft.body,'Chưa gửi. Thư mẫu dựa trên các dạng hoạt chất trong snapshot.'];}).concat([['','','','','','Không = chưa có bằng chứng trong snapshot, không kết luận chứng chỉ không tồn tại. Có = có bản nguồn; đọc trạng thái/hạn, không tự kết luận đủ điều kiện nhập khẩu.'],['','','','','','DAV chỉ đối chiếu thuốc theo hoạt chất trong bản dữ liệu '+(vn?.updated || 'chưa nạp')+', không xác nhận API/nhà máy. GMP và CPP/COPP tự nhập phải có link bằng chứng; chưa xác minh.']])}];
  };
  return { norm, companyNameKey, matchingProfiles, safeUrl, state, termsMatch, viName, googleUrl, matchesCertificates, mergeWeb, ingredientNames, emailDraft, bagSheets };
})();
if (typeof module !== 'undefined') module.exports = ApiSourcing;
if (typeof document !== 'undefined') (async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const { norm, companyNameKey, matchingProfiles, safeUrl, state, viName, googleUrl, matchesCertificates, mergeWeb } = ApiSourcing;
  const portals=[
    ['CPHI','Danh mục doanh nghiệp và sản phẩm dược; thông tin do NCC công bố.','cphi-online.com',q=>'https://www.cphi-online.com/live/search/searchresults46v4.jsp?'+new URLSearchParams({name:q})],
    ['PharmaCompass','Danh mục API và nhà cung cấp; đọc hồ sơ nguồn để kiểm chứng.','pharmacompass.com',q=>'https://www.pharmacompass.com/listed-active-pharmaceutical-ingredients/'+q.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')],
    ['PharmaSources','Sàn sản phẩm dược và nguyên liệu; có thể yêu cầu xác minh truy cập.','pharmasources.com'],
    ['Pharmaoffer','Sàn tìm nhà sản xuất API và liên hệ thương mại.','pharmaoffer.com',q=>norm(q)==='amlodipine'?'https://pharmaoffer.com/api-excipient-supplier/calcium-channel-blockers/amlodipine':''],
    ['EDQM','Cơ quan cấp CEP; hồ sơ công khai về nguyên liệu theo Dược điển châu Âu.','extranet.edqm.eu',q=>'https://extranet.edqm.eu/4DLink1/4DCGI/Query_CEP?'+new URLSearchParams({vSelectName:'1',Case_TSE:'none',vContains:'1',vContainsDate:'1',vtsubName:q,vtsubDateBegin:'',vtsubDateBtwBegin:'',vtsubDateBtwEnd:'',SWTP:'1',OK:'Search'})],
    ['FDA DMF','Danh sách chủ hồ sơ DMF; Active không phải FDA phê duyệt sản phẩm.','fda.gov'],
    ['WHO PQ','Danh sách API được WHO tiền thẩm định.','extranet.who.int'],
    ['EudraGMDP','Tra đăng ký cơ sở API: bật Enable API Search, nhập hoạt chất vào API Name rồi Search. Đăng ký API không phải chứng chỉ GMP.','eudragmdp.ema.europa.eu',()=> 'https://eudragmdp.ema.europa.eu/inspections/view/apiReg/SearchAPIRegHome.xhtml'],
    ['MHRA','Đăng ký cơ sở sản xuất, nhập khẩu và phân phối API tại UK.','cms.mhra.gov.uk',q=>'https://cms.mhra.gov.uk/mhra/api-reg?'+new URLSearchParams({'f[0]':'reference_api_active_substance_term:'+q.toUpperCase()})],
    ['NMPA','Cổng dữ liệu NMPA: mở website để tra cứu trong thanh tìm kiếm của cổng.','datasearch.nmpa.gov.cn',()=> 'https://datasearch.nmpa.gov.cn/datasearch/home-index.html']
  ];
  function sourceExplanation(url){const host=new URL(url).hostname;return portals.find(p=>host===p[2]||host.endsWith('.'+p[2]))?.[1]||'Trang tìm được trên mạng. Kiểm tra nội dung gốc, danh tính công ty và ngày cập nhật trước khi dùng.';}
  function updateSourceSearches(q){
    $('google-search').href=googleUrl(q);
    $('source-searches').innerHTML=portals.filter(p=>!['EDQM','FDA DMF','WHO PQ'].includes(p[0])).map(([name,tip,host,native])=>{
      const direct=native&&(q||['EudraGMDP','NMPA'].includes(name)) ? native(q) : '';
      if(name==='Pharmaoffer'&&!direct)return `<form action="https://pharmaoffer.com/api-excipient-supplier/search" method="post" target="_blank" rel="noopener noreferrer"><input type="hidden" name="search" value="${esc(q)}"><button type="submit" title="${esc(tip)} Tìm trực tiếp tại Pharmaoffer.">Pharmaoffer ↗</button></form>`;
      return `<a href="${esc(direct || 'https://www.google.com/search?'+new URLSearchParams({q:'site:'+host+' '+q}))}" title="${esc(tip)} ${direct?'Tra tại website.':'Tìm trong website qua Google, đã điền từ khóa.'}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`;
    }).join('');
    const edqm=$('official-sources').querySelector('[data-source=EDQM]');if(edqm)edqm.href=q?portals.find(p=>p[0]==='EDQM')[3](q):'https://extranet.edqm.eu/publications/recherches_CEP.shtml';
  }
  updateSourceSearches('');
  const labels = {CEP:'CEP · EDQM', DMF_US:'DMF US · II', WHO_PQ:'WHO PQ', LISTING:'NCC tuyên bố'};
  const explanations = {
    PROFILES:'Hồ sơ nguyên liệu công khai từ EDQM, FDA và WHO. Bấm thẻ để xem nguồn và ngày danh sách.',
    ONLINE:'Nhà cung cấp và trang web tìm được trên mạng. Thẻ nhà cung cấp ở trên, link ở dưới. Chứng chỉ do công ty giới thiệu cần kiểm tra ở nguồn cấp.',
    CEP:'CEP do EDQM cấp, chứng minh chất lượng nguyên liệu đáp ứng Dược điển châu Âu. CEP không thay thế chứng nhận GMP.',
    DMF_US:'DMF US Type II là hồ sơ kỹ thuật nguyên liệu nộp FDA (Mỹ). Active nghĩa là hồ sơ đang hoạt động, không có nghĩa FDA đã phê duyệt.',
    WHO_PQ:'API được WHO tiền thẩm định về chất lượng và cơ sở sản xuất. Chỉ áp dụng cho đúng nguyên liệu và cơ sở ghi trong hồ sơ.',
    LISTING:'Nhà cung cấp tự công bố sản phẩm trên web. Bấm thẻ để xem đoạn trích và nguồn; cơ quan quản lý chưa xác nhận thông tin này.',
    GMP_CPP:'GMP xác nhận điều kiện sản xuất của cơ sở. CPP/COPP là chứng nhận sản phẩm dược do cơ quan quản lý cấp theo mẫu WHO. Chưa nạp nguồn cho hai mục này.',
    SAVE:'Bấm + để lưu vào Bag. Bấm ✓ để bỏ lưu. Trong Bag có thể ghi chú và tải Excel.',
    SOURCE_DATE:'Ngày ghi trên danh sách do cơ quan công bố, không phải ngày sửa từng hồ sơ. FDA dùng mốc cuối quý. Ngày tải nguồn là ngày hệ thống lấy danh sách về.',
    PROFILE_MATCH:'Đối chiếu tên sau khi chuẩn hóa hậu tố pháp nhân và địa điểm ghi kèm. Bấm thẻ để xem từng hồ sơ gốc. Chưa xác nhận cùng nhà máy hay chứng chỉ cho sản phẩm đang chào.',
    WEBSITE:'Website công ty hoặc tập đoàn được ghép theo tên từ danh sách đã rà soát. Link này giúp liên hệ và xem sản phẩm; không xác nhận nhà máy, chứng chỉ hay còn hàng.'
  };
  const helpChip = (type, text, status='') => `<button type="button" class="chip term-chip ${status}" data-help="${type}" aria-describedby="term-help">${esc(text)} <span aria-hidden="true">ⓘ</span></button>`;
  const companyLink = company => {const website=safeUrl(company.website),profile=safeUrl(company.profile_url),url=website||profile,tip=website ? (company.website_origin==='directory'?'Website do directory liệt kê; chưa xác minh danh tính công ty hay chứng chỉ.':`Website công ty / tập đoàn · rà soát ${date(company.website_checked_at)}. Chưa xác nhận nhà máy hay chứng chỉ.`) : profile?'Trang NCC trên directory; đây không phải website công ty đã xác minh.':'Tìm tên công ty và hoạt chất trên Google để đối chiếu website.';return `<a class="company-link" data-help="WEBSITE" data-help-text="${esc(tip)}" aria-describedby="term-help" href="${esc(url||googleUrl($('query').value.trim(),company.canonical_name))}" target="_blank" rel="noopener noreferrer">${website?(company.website_origin==='directory'?'Website · directory':'Website công ty / tập đoàn'):profile?'Trang NCC · '+esc(new URL(profile).hostname.replace(/^www\./,'')):'Tìm website công ty'} ↗</a>`;};
  const hideHelp = () => { $('term-help').hidden=true; };
  function showHelp(button) {
    if(!document.body.contains(button))return hideHelp();
    const tooltip=$('term-help');(button.closest('dialog')||document.body).appendChild(tooltip);tooltip.textContent=button.dataset.helpText || explanations[button.dataset.help]; tooltip.hidden=false;
    const rect=button.getBoundingClientRect(); tooltip.style.width=Math.min(320,innerWidth-24)+'px';
    tooltip.style.left=Math.max(12,Math.min(rect.left,innerWidth-tooltip.offsetWidth-12))+'px';
    tooltip.style.top=Math.max(12,Math.min(rect.bottom+8,innerHeight-tooltip.offsetHeight-12))+'px';
  }
  document.addEventListener('pointerover',e=>{const button=e.target.closest('[data-help]');if(button)showHelp(button);});
  document.addEventListener('pointerout',e=>{const button=e.target.closest('[data-help]');if(button && !button.contains(e.relatedTarget) && document.activeElement!==button)hideHelp();});
  document.addEventListener('focusin',e=>{if(e.target.matches('[data-help]'))showHelp(e.target);});
  document.addEventListener('focusout',e=>{if(e.target.matches('[data-help]'))hideHelp();});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-help]');if(button)showHelp(button);else hideHelp();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHelp();});
  window.addEventListener('resize',hideHelp);
  document.addEventListener('scroll',()=>{const button=document.querySelector('[data-help]:hover') || document.activeElement?.closest('[data-help]');if(button && button.getBoundingClientRect().bottom>0 && button.getBoundingClientRect().top<innerHeight)showHelp(button);else hideHelp();},true);
  const states = {valid:'Còn hiệu lực', active:'Active', expired:'Hết hạn', suspended:'Đình chỉ', withdrawn:'Đã rút', inactive:'Inactive', unknown:'Chưa rõ'};
  const date = s => s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('vi-VN') : 'Không công bố';
  const notice = text => { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => $('toast').hidden = true, 4000); };
  let data, companies, substances, indexed, results = [], selected = null, limit = 40, profileCount = 0, profileCandidates = [];
  let resolveData, searchGeneration=0, searchBusy=false;
  const dataReady=new Promise(resolve=>{resolveData=resolve;});
  let bag = [];
  try { const stored = JSON.parse(localStorage.getItem('apisrc-bag-v1') || '[]'); if (Array.isArray(stored)) bag = stored; } catch {}
  const bagCount = () => $('bag-count').textContent = bag.length;
  bagCount();
  const saveBag = () => { try { localStorage.setItem('apisrc-bag-v1', JSON.stringify(bag)); bagCount(); return true; } catch { notice('Không lưu được Bag. Hãy sao lưu trước khi đóng trang.'); return false; } };
  const countryName = code => { try { return new Intl.DisplayNames(['vi'], {type:'region'}).of(code); } catch { return code; } };
  const countryText = company => company.country ? `${countryName(company.country)} (${company.country})${company.country_origin==='directory'?' · NCC công bố':''}` : 'Quốc gia chưa rõ từ nguồn';
  const cardState = r => r.certificates.some(c => state(c) === 'bad') ? 'bad' : r.certificates.some(c => state(c) === 'good') ? 'good' : r.certificates.some(c=>state(c)==='claim') ? 'claim' : 'unknown';
  const vnRefs = text => !data?.vn ? [] : (data.vn.index[SraVn.key(text)] || []).filter(r => r.expiry >= new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}));
  function render() {
    hideHelp();
    const card = (r, i) => {
      const status = cardState(r), matched=i>=profileCount && matchingProfiles(r.company,profileCandidates).length;
      const types = [...new Set(r.certificates.map(c => c.type))];
      return `<article data-card="${i}" tabindex="0" aria-haspopup="dialog" aria-label="Xem nguồn ${esc(r.company.canonical_name)}" class="supplier-card ${selected === i ? 'selected' : ''}"><div class="card-top"><button class="supplier-name" data-open="${i}">${esc(r.company.canonical_name)}</button><div class="card-actions">${matched?helpChip('PROFILE_MATCH','Khớp tên hồ sơ','good profile-match'):''}<button class="save-button" data-save="${i}" data-help="SAVE" aria-pressed="${bag.some(b=>b.key===r.key)}" aria-label="${bag.some(b=>b.key===r.key) ? 'Bỏ lưu' : 'Lưu'} nhà cung cấp vào Bag" aria-describedby="term-help">${bag.some(b => b.key === r.key) ? '✓' : '+'}</button></div></div><p>${companyLink(r.company)}</p><p class="card-meta">${esc(countryText(r.company))} · ${r.certificates.some(c=>c.supplier_role==='seller') ? 'Bên bán / phân phối (theo nguồn)' : 'Nhà máy chưa xác định'}</p><p class="card-substances">${[...new Set(r.certificates.map(c => substances.get(c.substance_id).inn))].slice(0,3).map(name=>`<span class="ingredient-line">${esc(name)}</span>`).join('')}</p><div class="chips">${types.map(t => { const certs = r.certificates.filter(c => c.type === t); const s = certs.some(c => state(c) === 'bad') ? 'bad' : certs.some(c => state(c) === 'good') ? 'good' : certs.some(c=>state(c)==='claim') ? 'claim' : 'unknown'; return helpChip(t, (labels[t] || t) + ' · ' + (s === 'good' ? 'Nguồn chính thức' : s === 'bad' ? 'Có hồ sơ không còn hiệu lực' : s === 'claim' ? 'Chưa xác minh' : 'Chưa rõ'), s); }).join('')}${helpChip('GMP_CPP','GMP · CPP/COPP: chưa có dữ liệu')}</div><p class="card-meta status-dot ${status}">● ${status === 'bad' ? 'Có hồ sơ không còn hiệu lực — xem nguồn' : status === 'good' ? 'Bản nguồn: còn hiệu lực / Active' : status==='claim' ? 'Chỉ có tuyên bố của NCC, chưa xác minh' : 'Chưa rõ trạng thái'} · ${r.certificates.length} bản ghi</p></article>`;
    };
    $('results').innerHTML = profileCount ? results.slice(0, Math.min(profileCount,limit)).map(card).join('') : '<div class="empty">Chưa có hồ sơ khớp.</div>';
    $('online-suppliers').innerHTML = results.slice(profileCount,profileCount+limit).map((r,i)=>card(r,profileCount+i)).join('');
    $('more').hidden = Math.max(profileCount,results.length-profileCount) <= limit;
  }
  function search() {
    if (!data) return;
    const query = $('query').value.trim();
    if (!query) return;
    const normalized = norm(query);
    let terms = [normalized];
    for (const s of data.substances) {
      const synonyms = JSON.parse(s.synonyms || '[]');
      if (s.cas === query || s.unii === query.toUpperCase() || norm(s.inn) === normalized || synonyms.some(x => norm(x) === normalized)) terms.push(norm(s.inn), ...synonyms.map(norm));
    }
    terms = [...new Set(terms.filter(Boolean))];
    const groups = new Map(), onlineGroups = new Map(), candidates = new Map();
    const countries=[...document.querySelectorAll('[data-country]:checked')].map(n=>n.dataset.country), allCountries=document.querySelector('[data-country-all]').checked, statuses=[...document.querySelectorAll('[data-status]:checked')].map(n=>n.dataset.status);
    for (const entry of indexed) {
      const {cert, company, text, companyText} = entry;
      if (!terms.some(t => text.includes(` ${t} `) || companyText.includes(` ${t} `))) continue;
      if(cert.type!=='LISTING'){
        if(!candidates.has(company.id))candidates.set(company.id,{company,certificates:[]});
        candidates.get(company.id).certificates.push(cert);
      }
      if(!allCountries&&!countries.includes(company.country||'?'))continue;
      if(!statuses.includes(state(cert)))continue;
      const target=cert.type==='LISTING' ? onlineGroups : groups;
      if (!target.has(company.id)) target.set(company.id, {company, certificates:[], key:`${company.id}:${normalized}`, query});
      target.get(company.id).certificates.push(cert);
    }
    const types=[...document.querySelectorAll('[data-cert]:checked')].map(c=>c.dataset.cert);
    $('certificate-summary').textContent=types.length ? types.map(t=>labels[t] || (t==='COPP' ? 'CPP/COPP' : t)).join(' + ') : 'Chọn nhiều chứng chỉ';
    const filtered=group=>[...group.values()].filter(r=>matchesCertificates(r.certificates,types,$('certificate-mode').value==='all')).sort((a,b)=>(cardState(a)==='good'?0:1)-(cardState(b)==='good'?0:1)||a.company.canonical_name.localeCompare(b.company.canonical_name));
    const profiles=filtered(groups), online=filtered(onlineGroups);
    profileCandidates=[...candidates.values()];
    profileCount=profiles.length;results=[...profiles,...online];
    selected=null;limit=40;if($('source-panel').open)$('source-panel').close();$('source-panel').hidden=true;render();
    updateSourceSearches(query);
    $('google-search').href=googleUrl(query);
    if(webQuery!==query){webQuery=query;webRows=[];webGeneration++;webAbort?.abort();$('web-content').innerHTML='';}
  }
  async function submitSearch() {
    const query=$('query').value.trim();if(query.length<2)return;
    const generation=++searchGeneration;searchBusy=true;
    $('search-progress').hidden=false;$('progress-title').textContent='Đang tìm nhà cung cấp';
    $('progress-detail').textContent='Đối chiếu hồ sơ và tìm web cùng lúc · chờ tối đa khoảng 7 giây.';
    $('results').setAttribute('aria-busy','true');$('results').hidden=true;$('online-suppliers').hidden=true;
    const local=dataReady.then(ready=>{if(ready && generation===searchGeneration && $('query').value.trim()===query)search();});
    const web=searchWeb(),directory=dataReady.then(ready=>ready&&generation===searchGeneration?discoverSuppliers(query,generation):null);let timer;
    try {await Promise.race([Promise.allSettled([local,web,directory]),new Promise(resolve=>{timer=setTimeout(resolve,6500);})]);}
    finally {clearTimeout(timer);if(generation===searchGeneration){searchBusy=false;$('search-progress').hidden=true;$('results').hidden=false;$('online-suppliers').hidden=false;$('results').setAttribute('aria-busy','false');if(!data)$('result-status').textContent='Dữ liệu nguồn chưa sẵn sàng. Bạn vẫn có thể xem kết quả Online.';}}
  }
  function addSupplierListings(listings,query) {
        for(const item of listings){
          const ingredient=item.ingredient||query,substance=data.substances.find(s=>norm(s.inn)===norm(ingredient));
          if(!item.company||!safeUrl(item.source_url)||item.verification!=='supplier_claimed')continue;
          let company=[...companies.values()].find(c=>norm(c.canonical_name)===norm(item.company));
          if(!company){company={id:'web:'+norm(item.company),canonical_name:item.company,country:item.country,website:safeUrl(item.website)||null,website_source:item.source_url,website_origin:'directory'};companies.set(company.id,company);}
          else if(!safeUrl(company.website)&&safeUrl(item.website)){company.website=safeUrl(item.website);company.website_source=item.source_url;company.website_origin='directory';}
          company.profile_url ||= safeUrl(item.profile_url);
          if(!company.country && item.country){company.country=item.country;company.country_origin='directory';}
          let subject=substance;if(!subject){subject={id:'web:'+norm(ingredient),inn:ingredient,synonyms:'[]'};substances.set(subject.id,subject);if(!data.substances.some(s=>s.id===subject.id))data.substances.push(subject);}
          const id='directory:'+item.profile_url+':'+norm(item.company)+':'+norm(ingredient);if(indexed.some(e=>e.cert.id===id))continue;
          const cert={...item,id,type:'LISTING',identifier:'Nguồn NCC',status:'unknown',raw_status:'Directory liệt kê, chưa xác minh',holder:item.company,company_id:company.id,substance_id:subject.id};
          indexed.push({cert,company,text:` ${norm(ingredient)} `,companyText:` ${norm(company.canonical_name)} `});
        }
  }
  async function discoverSuppliers(query,generation) {
    const substance=data.substances.find(s=>s.cas===query||norm(s.inn)===norm(query)),ingredient=substance?.inn||query;
    try {
      for(let attempt=0;attempt<4;attempt++){
        if(generation!==searchGeneration)return;
        const response=await fetch(cloudEndpoint+'/discover?'+new URLSearchParams({q:ingredient}),{signal:AbortSignal.timeout(6000)});
        if(!response.ok)throw new Error('DirectoryUnavailable');const payload=await response.json();
        if(generation!==searchGeneration || $('query').value.trim()!==query)return;
        if(payload.pending){if(attempt<3){await new Promise(resolve=>setTimeout(resolve,2000));continue;}return;}
        if(payload.error)throw new Error('DirectoryUnavailable');
        const listings=payload.listings||[];
        addSupplierListings(listings,query);
        if(!$('source-panel').open)search();return;
      }
    } catch {}
  }
  const harvested=new Set();
  async function harvestWebPages(query,generation,rows) {
    if(!await dataReady || generation!==searchGeneration)return;
    const ingredient=data.substances.find(s=>s.cas===query||norm(s.inn)===norm(query))?.inn||query;
    const candidates=[...new Set(rows.filter(r=>ApiSourcing.termsMatch([r.title,r.snippet,r.url].join(' '),[ingredient,query])).map(r=>safeUrl(r.url)).filter(url=>url&&!/(?:pharmacompass\.com|fda\.gov|who\.int|edqm\.eu|pubchem)/i.test(new URL(url).hostname)))].sort((a,b)=>Number(/pharmasources\.com|cphi-online\.com/.test(b))-Number(/pharmasources\.com|cphi-online\.com/.test(a)));
    const byHost=new Map();for(const url of candidates){const host=new URL(url).hostname.replace(/^www\./,'');if(!byHost.has(host))byHost.set(host,url);}const urls=[...byHost.values()].slice(0,3);
    if(!urls.length)return;const key=JSON.stringify([query,urls]);if(harvested.has(key))return;harvested.add(key);
    try {
      for(let attempt=0;attempt<6;attempt++){
        if(generation!==searchGeneration)return;
        const response=await fetch(cloudEndpoint+'/harvest?'+new URLSearchParams({q:ingredient,urls:JSON.stringify(urls)}),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Unavailable');const payload=await response.json();
        if(generation!==searchGeneration||$('query').value.trim()!==query)return;
        if(payload.pending){if(attempt<5){await new Promise(resolve=>setTimeout(resolve,2000));continue;}harvested.delete(key);return;}
        if(payload.error)throw new Error('Unavailable');addSupplierListings(payload.listings||[],query);if(!$('source-panel').open)search();
        return;
      }
    } catch {harvested.delete(key);}
  }
  function sourceRecord(c) {
    const url = safeUrl(c.source_url), subject = substances.get(c.substance_id);
    return `<article class="source-record">${helpChip(c.type, labels[c.type] || c.type)} <strong>${esc(c.identifier)}</strong> <span class="chip ${state(c)}">${esc(states[c.status] || c.status)}</span><dl><dt>Hoạt chất / subject</dt><dd>${esc(subject?.inn)}</dd><dt>CAS / UNII</dt><dd>${esc([subject?.cas,subject?.unii].filter(Boolean).join(' / ') || 'Chưa chuẩn hóa')}</dd><dt>Chủ hồ sơ gốc</dt><dd>${esc(c.holder)}</dd><dt>Trạng thái gốc</dt><dd>${esc(c.raw_status)}</dd><dt>Loại CEP</dt><dd>${esc(c.cep_type || '—')}</dd><dt>Ngày cấp / nộp</dt><dd>${date(c.issued_at)}</dd><dt>Hạn / kết thúc</dt><dd>${date(c.expires_at)}</dd><dt><button type="button" class="date-help" data-help="SOURCE_DATE" aria-describedby="term-help">Ngày danh sách ⓘ</button></dt><dd>${date(c.source_file_date)}${c.date_basis === 'quarter_end' ? ' (cuối quý)' : ''}</dd><dt>Ngày tải nguồn</dt><dd>${date(c.fetched_at)}</dd></dl>${safeUrl(subject?.normalization_source) ? `<p><a href="${esc(safeUrl(subject.normalization_source))}" target="_blank" rel="noopener noreferrer">Nguồn chuẩn hóa hoạt chất ↗</a> · ${date(subject.normalization_fetched_at)}</p>` : ''}${c.type === 'LISTING' ? `<blockquote>${esc(c.raw_snippet || 'Chưa có đoạn bằng chứng')}</blockquote>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở bản nguồn ${esc(c.source)} ↗</a>` : ''}${c.type === 'CEP' ? ' · <button type="button" data-print="'+c.id+'">In phiếu tra cứu CEP / PDF</button>' : ''}</article>`;
  }
  function open(i) {
    selected = i;
    const r = results[i];
    $('source-content').innerHTML = `<p><strong>${esc(r.company.canonical_name)}</strong></p><p>${companyLink(r.company)} <a href="${esc(googleUrl(r.query,r.company.canonical_name))}" target="_blank" rel="noopener noreferrer">Tìm hoạt chất + công ty trên Google ↗</a></p>${safeUrl(r.company.website) ? `<p class="muted">${esc(new URL(r.company.website).hostname)} · Rà soát ${date(r.company.website_checked_at)}${safeUrl(r.company.website_source) ? ` · <a href="${esc(safeUrl(r.company.website_source))}" target="_blank" rel="noopener noreferrer">Nguồn đối chiếu ↗</a>` : ''}</p>` : '<p class="muted">Chưa có website đã rà soát cho tên công ty này. Link trên mở trang NCC tại directory hoặc tìm Google; chưa phải website công ty đã xác minh.</p>'}<h3 class="source-heading">Hồ sơ & chứng chỉ</h3><p class="muted">Tên chủ hồ sơ được giữ nguyên. Không suy luận địa chỉ nhà máy. Mỗi hồ sơ giữ nguồn và mức xác minh riêng; tuyên bố của NCC không phải xác nhận của cơ quan cấp.</p>` + [...r.certificates].sort((a,b) => (state(a) === 'good' ? 0:1)-(state(b) === 'good' ? 0:1) || a.type.localeCompare(b.type)).map(sourceRecord).join('');
    $('source-panel').hidden = false; render(); $('source-panel').showModal(); $('panel-close').focus();
    if(i>=profileCount){
      const matches=matchingProfiles(r.company,profileCandidates);
      if(matches.length)$('source-content').querySelector('.source-heading').insertAdjacentHTML('beforebegin',`<details class="matched-profile"><summary>Khớp tên hồ sơ · ${esc(matches[0].company.canonical_name)}</summary><p>Tên đã đối chiếu sau khi chuẩn hóa hậu tố pháp nhân và địa điểm ghi kèm. Mỗi hồ sơ nguồn vẫn giữ riêng; kiểm tra pháp nhân, địa chỉ nhà máy và đúng dạng hoạt chất trước khi sử dụng.</p>${matches.map(m=>m.certificates.map(sourceRecord).join('')).join('')}</details>`);
    }
    const references = [...new Map(r.certificates.flatMap(c => vnRefs(substances.get(c.substance_id).inn)).map(ref => [ref.sdk,ref])).values()];
    $('source-content').insertAdjacentHTML('beforeend', `<article class="source-record"><strong>Đối chiếu DAV theo hoạt chất</strong><p class="muted">${references.length ? references.map(ref=>esc(ref.sdk)+' · hạn '+date(ref.expiry)).join('<br>') : 'Chưa tìm thấy SĐK thuốc còn hạn khớp cách chuẩn hóa trong bản DAV đã nạp.'}</p><p class="muted">Bản DAV: ${esc(data.vn?.updated || 'Chưa nạp')}. Không xác nhận nguồn API/nhà máy đã được DAV duyệt. Chưa có dữ liệu SĐK nguyên liệu riêng.</p><p><a href="https://eudragmdp.ema.europa.eu/" target="_blank" rel="noopener noreferrer">Tra GMP EU ↗</a> · <a href="https://www.cphi.com/" target="_blank" rel="noopener noreferrer">Tra CPHI ↗</a> · <a href="https://www.pharmasources.com/" target="_blank" rel="noopener noreferrer">PharmaSources ↗</a></p><p class="muted">GMP / CPP-COPP / tham dự CPHI: chưa có dữ liệu đã kiểm chứng cho NCC này.</p></article>`);
  }
  $('search-form').addEventListener('submit', e => { e.preventDefault(); void submitSearch(); });
  $('filters').addEventListener('change', e=>{
    const n=e.target;
    if(n.matches('[data-country-all]'))document.querySelectorAll('[data-country]').forEach(c=>c.checked=false);
    if(n.matches('[data-country]'))document.querySelector('[data-country-all]').checked=false;
    if(n.matches('[data-status-all]'))document.querySelectorAll('[data-status]').forEach(c=>c.checked=n.checked);
    const statusBoxes=[...document.querySelectorAll('[data-status]')], chosen=statusBoxes.filter(c=>c.checked), all=document.querySelector('[data-status-all]');all.checked=chosen.length===statusBoxes.length;all.indeterminate=!!chosen.length&&!all.checked;
    const countries=[...document.querySelectorAll('[data-country]:checked')].map(c=>c.dataset.country==='?'?'Chưa rõ':countryName(c.dataset.country));
    $('country-summary').textContent=document.querySelector('[data-country-all]').checked?'Tất cả quốc gia':countries.length>2?countries.length+' quốc gia':countries.join(' + ')||'Chưa chọn quốc gia';
    $('status-summary').textContent=all.checked?'Tất cả trạng thái':chosen.length?chosen.length+' trạng thái':'Chưa chọn trạng thái';
    search();
  });
  document.addEventListener('click',e=>document.querySelectorAll('#filters details[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;}));
  $('mobile-views').addEventListener('click',e=>{const button=e.target.closest('[data-view]');if(!button)return;$('results-view').dataset.mobileView=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));hideHelp();});
  $('query').addEventListener('input',()=>updateSourceSearches($('query').value.trim()));
  $('results-view').addEventListener('click', e => {
    const save=e.target.closest('[data-save]');
    if(save){const r=results[+save.dataset.save], existing=bag.findIndex(b=>b.key===r.key);
      if(existing>=0)bag.splice(existing,1);
      else{const snapshot=structuredClone(r);snapshot.substances=[...new Set(r.certificates.map(c=>c.substance_id))].map(id=>structuredClone(substances.get(id)));bag.push({key:r.key,snapshot,saved_at:new Date().toISOString(),note:'',docs:{},quote:{status:'not_sent'}});}
      saveBag();render();notice(existing>=0?'Đã bỏ lưu NCC':'Đã lưu NCC vào Bag');return;
    }
    const openButton=e.target.closest('[data-open]');if(openButton){open(+openButton.dataset.open);return;}
    if(e.target.closest('button,a,input,select,summary'))return;
    const card=e.target.closest('[data-card]');if(card)open(+card.dataset.card);
  });
  $('results-view').addEventListener('keydown',e=>{if(e.target.matches('[data-card]')&&['Enter',' '].includes(e.key)){e.preventDefault();open(+e.target.dataset.card);}});
  async function closePanel() {
    const panel=$('source-panel');if(!panel.open||panel.dataset.closing)return;
    panel.dataset.closing='true';hideHelp();
    const motion=panel.animate([{transform:getComputedStyle(panel).transform,opacity:getComputedStyle(panel).opacity},{transform:matchMedia('(max-width:760px)').matches?'translateY(100%)':'translateY(12px) scale(.96)',opacity:0}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:180,easing:'ease-in',fill:'forwards'});
    await motion.finished;panel.close();motion.cancel();delete panel.dataset.closing;
  }
  $('panel-close').addEventListener('click',closePanel);
  $('source-panel').addEventListener('cancel',e=>{e.preventDefault();void closePanel();});
  $('source-panel').addEventListener('close',()=>{$('source-panel').hidden=true;const index=selected;selected=null;search();if(index!==null)$('results-view').querySelector('[data-card="'+index+'"]')?.focus();});
  $('source-panel').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)void closePanel();});
  $('more').addEventListener('click', () => { limit += 40; render(); });
  let webGeneration=0,webQuery='',webRows=[],webAbort;
  const cloudEndpoint=$('api-endpoint')?.content || '';
  const useCloud=!!cloudEndpoint && !['127.0.0.1','localhost'].includes(location.hostname);
  // Remove legacy access fragments from old bookmarks; search no longer uses a code.
  if(new URLSearchParams(location.hash.slice(1)).has('access'))history.replaceState(null,'',location.pathname+location.search);
  async function searchWeb() {
    const query=$('query').value.trim();if(query.length<2)return;
    if(webQuery!==query){webQuery=query;webRows=[];$('web-content').innerHTML='';}
    const page=0;
    webAbort?.abort();webAbort=new AbortController();
    const generation=++webGeneration;
    $('web-status').textContent='Đang tìm web…';
    try {
      const response=await fetch((useCloud ? cloudEndpoint+'/search' : './search')+'?'+new URLSearchParams({q:query,page}),{signal:AbortSignal.any([webAbort.signal,AbortSignal.timeout(6200)])});
      if(generation!==webGeneration)return;
      if (!response.ok) throw new Error(useCloud ? 'Dịch vụ tìm web đang bận. Thử lại sau.' : 'Chưa có backend tìm web. Chạy server.py để bật các API.');
      const payload=await response.json(); if(generation!==webGeneration)return;
      webRows=mergeWeb(webRows,payload.results || []);
      void harvestWebPages(query,searchGeneration,payload.results||[]);
      $('web-status').textContent=webRows.length ? '' : payload.pending ? 'Nguồn web đang xử lý.' : 'Chưa tìm thấy link phù hợp.';
      $('web-content').innerHTML=webRows.map(r=>`<article class="supplier-card"><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title || r.url)}</a><p class="web-snippet">${esc(String(r.snippet||'').replace(/<[^>]*>/g,'').slice(0,600))}</p><p class="source-explanation">${esc(sourceExplanation(r.url))}</p><span class="chip">Nguồn web · chưa xác minh</span> <span class="muted">${esc(r.provider)} · ${date(r.fetched_at)}</span></article>`).join('');
    } catch(error) { if(generation===webGeneration)$('web-status').textContent=error.name==='TimeoutError' ? 'Nguồn web chậm. Hồ sơ vẫn sẵn sàng; tác vụ nền có thể lưu cho lần tìm sau.' : error.message; }
  }
  try {
    const dataUrl=new URL($('api-data').content,location.href).href;
    let cache,response;
    try {cache=await caches.open('apisrc-snapshot-v2');response=await cache.match(dataUrl);} catch {}
    const cached=!!response;
    if(!response){response=await fetch(dataUrl,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Không tải được dữ liệu nguồn. Tải lại trang để thử lại.');}
    const saved=response.clone();
    data=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    if(data.format!==2)throw new Error('Phiên bản dữ liệu chưa phù hợp. Tải lại trang để cập nhật.');
    for(const [key,value] of Object.entries(data))if(value?.fields && value?.rows)data[key]=value.rows.map(row=>Object.fromEntries(value.fields.map((field,i)=>[field,row[i]])));
    if(cache && !cached)void cache.put(dataUrl,saved).then(async()=>{for(const key of await cache.keys())if(key.url!==dataUrl)await cache.delete(key);}).catch(()=>{});
    companies = new Map(data.companies.map(c => [c.id,c])); substances = new Map(data.substances.map(s => [s.id,s]));
    const listings=(data.listings||[]).map(l=>({...l,id:'listing:'+l.id,type:'LISTING',identifier:'Listing',status:'unknown',raw_status:'NCC tuyên bố, chưa xác minh',holder:companies.get(l.company_id).canonical_name}));
    indexed = [...data.certificates,...listings].map(cert => ({cert, company:companies.get(cert.company_id), text:` ${norm(substances.get(cert.substance_id).inn)} `, companyText:` ${norm(companies.get(cert.company_id).canonical_name)} `}));
    const counts = [...new Set(data.companies.map(c => c.country).filter(Boolean))].sort();
    $('country-options').innerHTML = '<label><input type="checkbox" data-country="?"> Chưa rõ quốc gia</label>'+counts.map(c=>`<label><input type="checkbox" data-country="${esc(c)}"> ${esc(countryName(c))} (${esc(c)})</label>`).join('');
    $('suggestions').innerHTML = data.substances.filter(s => s.inn.length < 75).slice(0,2500).map(s => `<option value="${esc(s.inn)}"></option>`).join('');
    const publicSources=JSON.parse($('public-sources').textContent),officialLinks={EDQM:'https://extranet.edqm.eu/publications/recherches_CEP.shtml',FDA:'https://www.fda.gov/drugs/drug-master-files-dmfs/list-drug-master-files-dmfs',WHO:'https://extranet.who.int/prequal/medicines/prequalified/active-pharmaceutical-ingredients'};
    const sourceRows=[
      ['EDQM','CEP: tên nguyên liệu, chủ CEP, số hồ sơ, loại CEP và trạng thái.','Đối chiếu số CEP và dạng nguyên liệu; kiểm tra bản còn hiệu lực. CEP không thay cho GMP.',officialLinks.EDQM,'https://www.edqm.eu/en/web/edqm/actions-on-ceps'],
      ['FDA','DMF: số hồ sơ, chủ hồ sơ, nguyên liệu (subject), loại hồ sơ và Active/Inactive.','Danh sách cập nhật theo quý. Type II là hồ sơ nguyên liệu; Active không có nghĩa FDA phê duyệt. Không công khai toàn văn DMF.',officialLinks.FDA,officialLinks.FDA],
      ['WHO','WHO PQ API: nguồn API và cơ sở sản xuất được WHO đánh giá.','Đối chiếu đúng nguyên liệu và cơ sở trong danh sách; không áp dụng cho mọi sản phẩm của công ty.',officialLinks.WHO,officialLinks.WHO],
      ['MHRA','Đăng ký cơ sở sản xuất, nhập khẩu và phân phối hoạt chất tại UK. Có bộ lọc hoạt chất trên website.','Kiểm tra pháp nhân, địa chỉ cơ sở và loại hoạt động. Đăng ký API không phải chứng chỉ GMP.',publicSources.MHRA.source_url,'https://www.gov.uk/guidance/medicines-register-to-manufacture-import-or-distributor-active-substances'],
      ['EudraGMDP','GMP/GDP, đăng ký API, giấy phép cơ sở và thông báo không tuân thủ.','Ở mục API REG, bật Enable API Search và nhập API Name. Chọn Search Registrant Sites hoặc Search 3rd Country Sites. Đăng ký API không thay cho chứng chỉ GMP.','https://eudragmdp.ema.europa.eu/inspections/view/apiReg/SearchAPIRegHome.xhtml','https://www.ema.europa.eu/en/human-regulatory-overview/research-development/compliance-research-development/good-manufacturing-practice/eudragmdp-database']
    ];
    $('official-sources').innerHTML='<details><summary>5 cổng hồ sơ công khai · cách đọc & dữ liệu</summary><div class="source-table-wrap"><table class="source-table"><caption>Cách đối chiếu hồ sơ tại từng cổng</caption><thead><tr><th scope="col">Cổng hồ sơ</th><th scope="col">Tra được gì?</th><th scope="col">Cách đọc kết quả</th><th scope="col">Dữ liệu trong công cụ</th></tr></thead><tbody>'+sourceRows.map(([source,scope,use,url,guide])=>{
      const run=data.runs.find(r=>r.source===source&&r.status==='ok'),count=data.certificates.filter(c=>c.source===source).length;
      const imported=run?`${count.toLocaleString('vi-VN')} bản ghi đã nạp.<br>Ngày danh sách: ${date(run.source_file_date)}<br>Ngày tải: ${date(run.finished_at)}`:source==='MHRA'?`${publicSources.MHRA.count} đăng ký trong bản đối chiếu ${date(publicSources.MHRA.fetched_at)}.<br>Tra hoạt chất trực tiếp trên website; chưa ghép vào thẻ Hồ sơ.`:'Tra trực tuyến; chưa ghép dữ liệu vào thẻ Hồ sơ.';
      return `<tr><th scope="row"><a data-source="${esc(source)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source)} ↗</a></th><td>${esc(scope)}</td><td>${esc(use)} <a href="${esc(guide)}" target="_blank" rel="noopener noreferrer">Giải thích từ cơ quan ↗</a></td><td>${imported}</td></tr>`;
    }).join('')+'</tbody></table></div></details>';
    $('source-health').innerHTML = '<div class="health-grid">' + ['EDQM','FDA','WHO'].map(source => {
      const run = data.runs.find(r => r.source === source && r.status === 'ok'), failure = data.runs.find(r => r.source === source);
      return `<div class="health-card">${helpChip({EDQM:'CEP',FDA:'DMF_US',WHO:'WHO_PQ'}[source],source)}<p>${data.certificates.filter(c => c.source === source).length.toLocaleString('vi-VN')} bản ghi</p><p>Ngày danh sách: ${date(run?.source_file_date)}</p><p>Ngày tải: ${date(run?.finished_at)}</p><p>${failure?.status === 'error' ? 'Lần cập nhật mới nhất lỗi; đang giữ bản trước.' : 'Đã nhập bản dữ liệu nguồn'}</p></div>`;
    }).join('') + '</div>';
    updateSourceSearches($('query').value.trim());
    $('search-button').disabled = false;
    $('result-status').textContent = '';
    $('results').innerHTML = '<div class="empty">Nhập hoạt chất để tìm nhà cung cấp.</div>';
    window.APISRC_READY = true;
    // Optional module extension points below are filled by later stages.
    window.APISRC_UI = {data, companies, substances, bag, saveBag, bagCount, notice, esc, date, sourceRecord, search, render, vnRefs, $};
    document.dispatchEvent(new Event('apisrc-ready'));
    resolveData(true);if(!searchBusy)$('search-progress').hidden=true;
  } catch (error) { resolveData(false);if(!searchBusy)$('search-progress').hidden=true;$('result-status').textContent = 'Không đọc được chỉ mục: ' + error.message; }
})();

if (typeof document !== 'undefined') document.addEventListener('apisrc-ready', () => {
  const {data, bag, saveBag, notice, esc, date, $, render, substances, vnRefs} = window.APISRC_UI;
  const documentLabels = {gmp:'GMP của cơ sở / phạm vi sản xuất', copp:'CPP/COPP (nếu áp dụng)', cep:'CEP hoặc hồ sơ chất lượng API', coa:'CoA lô', stability:'Số liệu ổn định', license:'Giấy phép sản xuất', authorization:'Thư ủy quyền / Letter of access', legal:'Hợp pháp hóa lãnh sự / căn cứ miễn'};
  function paintBag() {
    $('bag-content').innerHTML = bag.length ? bag.map((item,i) => {
      const r = item.snapshot;
      const quote = item.quote || {status:'not_sent'};
      const docs = item.docs || {};
      const email = item.email || ApiSourcing.emailDraft(r);
      const {subject,body}=email;
      return `<article class="bag-item" data-bag="${i}"><h3>${i+1}. ${esc(r.company.canonical_name)}</h3><p>${esc(ApiSourcing.ingredientNames(r).join('; ') || r.query)} · <span class="muted">Lưu ${date(item.saved_at)} · snapshot ${r.certificates.length} hồ sơ</span></p><details><summary>Nguồn tại lúc lưu</summary>${r.certificates.map(c=>`<p class="muted">${esc(c.type)} ${esc(c.identifier)} · ${esc(c.raw_status)} · ngày file ${date(c.source_file_date)} · lấy ${date(c.fetched_at)} <a target="_blank" rel="noopener noreferrer" href="${esc(ApiSourcing.safeUrl(c.source_url))}">Nguồn ↗</a></p>`).join('')}</details><label>Ghi chú<textarea data-field="note" maxlength="5000">${esc(item.note)}</textarea></label><details><summary>Checklist hồ sơ DAV</summary><p class="muted">Tự kiểm tra tài liệu nhận được và hạn dùng. Cần pháp chế xác nhận; không tự suy luận miễn hồ sơ từ SĐK thuốc.</p><div class="docs">${Object.entries(documentLabels).map(([key,label])=>`<label><input type="checkbox" data-doc="${key}" ${docs[key]?.received ? 'checked':''}>${label}</label><div><input type="date" aria-label="Hạn ${label}" data-expiry="${key}" value="${esc(docs[key]?.expiry || '')}"><input type="url" aria-label="Link bằng chứng ${label}" data-doc-source="${key}" value="${esc(docs[key]?.source || '')}" placeholder="https://… link bằng chứng"></div>`).join('')}</div></details><details><summary>Theo dõi báo giá</summary><label>Trạng thái <select data-quote="status">${[['not_sent','Chưa gửi'],['sent','Đã gửi (tự ghi nhận)'],['replied','Đã trả lời'],['no_reply','Chưa phản hồi']].map(([v,l])=>`<option value="${v}" ${quote.status===v?'selected':''}>${l}</option>`).join('')}</select></label> <label>Giá <input data-quote="quoted_price" value="${esc(quote.quoted_price||'')}" maxlength="100"></label> <label>Đơn vị <input data-quote="price_unit" value="${esc(quote.price_unit||'')}" maxlength="80" placeholder="USD/kg"></label> <label>Ngày <input type="date" data-quote="price_date" value="${esc(quote.price_date||'')}"></label></details><details class="email-editor"><summary>Soạn email hỏi giá · mở để sửa / chọn và copy</summary><label>Chọn mẫu<select data-email-template><option value="quote" ${email.kind!=='documents' ? 'selected' : ''}>Hỏi giá theo hoạt chất và dạng</option><option value="documents" ${email.kind==='documents' ? 'selected' : ''}>Yêu cầu hồ sơ chất lượng</option></select></label><label>Tiêu đề<input data-email="subject" maxlength="1000" value="${esc(subject)}"></label><label>Nội dung<textarea data-email="body" maxlength="12000">${esc(body)}</textarea></label><p class="muted">Có thể sửa trực tiếp, chọn văn bản và copy. Bản sửa được lưu vào Bag và worksheet Email mẫu.</p><a data-mailto href="mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Mở ứng dụng email</a></details><div class="bag-actions"><button type="button" data-remove-bag="${i}">Bỏ khỏi Bag</button></div><p class="muted">Soạn thư không thay đổi trạng thái sang “đã gửi”. Không có email / số điện thoại NCC đã xác minh.</p></article>`;
    }).join('') : '<p class="empty">Bag chưa có NCC. Bấm + trên một thẻ tìm kiếm.</p>';
  }
  $('bag-toggle').addEventListener('click', () => {paintBag(); $('bag-dialog').showModal();});
  $('bag-close').addEventListener('click', () => $('bag-dialog').close());
  $('bag-content').addEventListener('change', e => {
    const node = e.target.closest('[data-bag]'); if (!node) return;
    const item = bag[+node.dataset.bag], target=e.target;
    item.docs ||= {}; item.quote ||= {status:'not_sent'};
    if (target.dataset.field === 'note') item.note = target.value;
    if (target.dataset.doc) { item.docs[target.dataset.doc] ||= {}; item.docs[target.dataset.doc].received = target.checked; }
    if (target.dataset.expiry) { item.docs[target.dataset.expiry] ||= {}; item.docs[target.dataset.expiry].expiry = target.value; }
    if (target.dataset.docSource) { item.docs[target.dataset.docSource] ||= {}; item.docs[target.dataset.docSource].source = target.value; }
    if (target.matches('[data-email-template]')) { item.email={...ApiSourcing.emailDraft(item.snapshot,target.value),kind:target.value}; saveBag(); paintBag(); return; }
    if (target.dataset.quote) { item.quote[target.dataset.quote] = target.value; if (target.dataset.quote === 'status' && target.value === 'sent') item.quote.sent_at = new Date().toISOString(); }
    saveBag();
  });
  $('bag-content').addEventListener('click', async e => {
    const remove=e.target.closest('[data-remove-bag]');
    if (remove) { bag.splice(+remove.dataset.removeBag,1); saveBag(); paintBag(); render(); }

  });

  $('bag-content').addEventListener('input',e=>{
    const node=e.target.closest('[data-bag]');if(!node || !e.target.dataset.email)return;
    const item=bag[+node.dataset.bag];item.email ||= ApiSourcing.emailDraft(item.snapshot);
    item.email[e.target.dataset.email]=e.target.value;saveBag();
    node.querySelector('[data-mailto]').href='mailto:?subject='+encodeURIComponent(item.email.subject)+'&body='+encodeURIComponent(item.email.body);
  });
  $('bag-excel').addEventListener('click',async()=>{
    if(!bag.length)return notice('Bag chưa có nhà cung cấp.');
    $('bag-excel').disabled=true;
    try { if(!window.SraExcel)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./excel.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('ExcelUnavailable'));};document.head.appendChild(script);});const bytes=await SraExcel.build(ApiSourcing.bagSheets(bag,data.vn,vnRefs));await SraExcel.downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'API-Sourcing-Bag-'+new Date().toISOString().slice(0,10)+'.xlsx');notice('Đã xuất Excel: Nhà cung cấp + Email mẫu.'); }
    catch {notice('Chưa xuất được Excel; Bag vẫn được giữ.');}
    finally{$('bag-excel').disabled=false;}
  });
  $('source-content').addEventListener('click', e => {
    const button=e.target.closest('[data-print]'); if (!button) return;
    const c=data.certificates.find(c=>c.id===+button.dataset.print);
    if (!c || c.source!=='EDQM' || c.verification!=='official_verified') return;
    const subject=substances.get(c.substance_id);
    const report=$('print-report');
    report.innerHTML=`<h1>Phiếu tra cứu CEP</h1><p>Bảo An Pharma · phiếu nội bộ, không thay thế chứng chỉ CEP</p><dl><dt>Tên nguyên liệu</dt><dd>${esc(subject.inn)}</dd><dt>Chủ CEP</dt><dd>${esc(c.holder)}</dd><dt>Số CEP</dt><dd>${esc(c.identifier)}</dd><dt>Ngày cấp</dt><dd>${date(c.issued_at)}</dd><dt>Trạng thái</dt><dd>${esc(c.raw_status)}</dd><dt>Loại CEP</dt><dd>${esc(c.cep_type)}</dd><dt>Chuyên luận Ph.Eur.</dt><dd>${esc(c.monograph || 'Không công bố')}</dd><dt>Ngày gia hạn dự kiến</dt><dd>${date(c.renewal_due)}</dd><dt>Ngày hết hạn/kết thúc</dt><dd>${date(c.expires_at)}</dd><dt>Ngày file EDQM TXT</dt><dd>${date(c.source_file_date)} (${esc(c.date_basis)})</dd><dt>Ngày lấy file</dt><dd>${date(c.fetched_at)}</dd><dt>Ngày lập phiếu</dt><dd>${new Date().toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})}</dd></dl><p><a href="https://extranet.edqm.eu/publications/recherches_CEP.shtml">Tra cứu trực tiếp EDQM</a></p><p>Nguồn: <a href="${esc(ApiSourcing.safeUrl(c.source_url))}">${esc(c.source_url)}</a></p><p>Chưa xác nhận lại trạng thái trực tuyến tại ngày lập phiếu. Các mốc của bản dữ liệu được giữ riêng. Cần kèm chứng chỉ CEP điện tử, chữ ký EDQM và thư ủy quyền/letter of access nếu áp dụng; pháp chế kiểm tra đầy đủ hồ sơ trước khi nộp DAV.</p>`;
    report.hidden=false; window.print();
  });
  window.addEventListener('afterprint', ()=>$('print-report').hidden=true);
});
