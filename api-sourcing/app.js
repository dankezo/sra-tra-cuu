const ApiSourcing = (() => {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
    if(!base)return 'INN: '+String(raw || '')+' (chưa chuẩn hóa tên Việt)';
    // Labels only: preserve salt/isomer/hydrate distinctions in the source record and search.
    const remainder=text.slice(base.length).trim(),forms={besylate:'besilat',besilate:'besilat',besilat:'besilat',benzoate:'benzoat',benzoat:'benzoat',hydrochloride:'hydroclorid',hydrochlorid:'hydroclorid',hcl:'hydroclorid',maleate:'maleat',mesylate:'mesilat',mesilate:'mesilat',sulfate:'sulfat',sulphate:'sulfat',sodium:'natri',potassium:'kali',calcium:'calci',magnesium:'magnesi',succinate:'succinat',fumarate:'fumarat',tartrate:'tartrat',phosphate:'phosphat',monohydrate:'monohydrat',dihydrate:'dihydrat',trihydrate:'trihydrat',anhydrous:'khan'};
    const annotation=remainder.search(/\b(process|site)\b/),formText=annotation<0 ? remainder : remainder.slice(0,annotation).trim();
    const standards=formText.match(/\b(usp|ep|bp|ip)\b/g) || [];
    let translated=formText.split(' ').filter(t=>t && !standards.includes(t)).map(t=>forms[t]||t);
    return names[base]+(translated.length ? ' · dạng '+translated.join(' ') : ' · dạng theo nguồn')+(standards.length ? ' · chuẩn '+standards.map(s=>s.toUpperCase()).join('/') : '')+(annotation<0 ? '' : ' · ghi chú nguồn: '+remainder.slice(annotation));
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
      return [i+1,r.company.canonical_name,country,safeUrl(r.company.website) ? {text:r.company.website,link:r.company.website} : 'Chưa xác minh',names.join('\n'),names.map(viName).join('\n'),...['CEP','DMF_US','WHO_PQ','GMP','COPP'].map(t=>certCell(item,t)),refs.length ? {text:'Có · thuốc theo hoạt chất: '+refs.map(ref=>ref.sdk).join(', ')+'; chưa xác nhận nguồn API',link:safeUrl(vn?.source)} : 'Không'];
    })},{name:'Email mau',headers:['STT','Tên công ty','Hoạt chất gốc / dạng','Tiêu đề','Nội dung email có thể sửa','Ghi chú'],rows:bag.map((item,i)=>{const r=item.snapshot,draft=item.email || emailDraft(r);return [i+1,r.company.canonical_name,ingredientNames(r).join('\n'),draft.subject,draft.body,'Chưa gửi. Thư mẫu dựa trên các dạng hoạt chất trong snapshot.'];}).concat([['','','','','','Không = chưa có bằng chứng trong snapshot, không kết luận chứng chỉ không tồn tại. Có = có bản nguồn; đọc trạng thái/hạn, không tự kết luận đủ điều kiện nhập khẩu.'],['','','','','','DAV chỉ đối chiếu thuốc theo hoạt chất trong bản dữ liệu '+(vn?.updated || 'chưa nạp')+', không xác nhận API/nhà máy. GMP và CPP/COPP tự nhập phải có link bằng chứng; chưa xác minh.']])}];
  };
  return { norm, safeUrl, state, termsMatch, viName, googleUrl, matchesCertificates, mergeWeb, ingredientNames, emailDraft, bagSheets };
})();
if (typeof module !== 'undefined') module.exports = ApiSourcing;
if (typeof document !== 'undefined') (async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const { norm, safeUrl, state, viName, googleUrl, matchesCertificates, mergeWeb } = ApiSourcing;
  const labels = {CEP:'CEP · EDQM', DMF_US:'DMF US · II', WHO_PQ:'WHO PQ', LISTING:'NCC tuyên bố'};
  const explanations = {
    CEP:'CEP là chứng nhận do EDQM (cơ quan chất lượng thuốc châu Âu) cấp về việc kiểm soát chất lượng nguyên liệu theo Dược điển châu Âu. CEP không thay thế chứng nhận GMP; xem loại CEP và trạng thái từng hồ sơ.',
    DMF_US:'DMF US là hồ sơ kỹ thuật nộp FDA của Mỹ. Type II gồm dược chất, chất trung gian và vật liệu dùng trong sản xuất thuốc. Active nghĩa là hồ sơ đang hoạt động, không có nghĩa FDA đã phê duyệt.',
    WHO_PQ:'WHO PQ API là nguyên liệu được WHO tiền thẩm định: đánh giá chất lượng hồ sơ và việc tuân thủ GMP của cơ sở liên quan. Chỉ áp dụng cho nguyên liệu và cơ sở trong hồ sơ đó.',
    LISTING:'Đây là thông tin do nhà cung cấp tự công bố trên website. Đoạn trích giúp kiểm tra họ nói gì; chưa phải xác nhận của cơ quan quản lý.',
    GMP_CPP:'GMP đánh giá cơ sở và phạm vi sản xuất. CPP/COPP là chứng nhận sản phẩm dược theo mẫu WHO, do cơ quan có thẩm quyền cấp; WHO PQ API là chương trình khác.',
    SAVE:'Lưu nhà cung cấp và các hồ sơ đang xem vào Bag để ghi chú, xuất Excel và soạn email.',
    WEBSITE:'Website công ty hoặc tập đoàn được ghép theo tên từ danh sách đã rà soát. Link này giúp liên hệ và xem sản phẩm; không xác nhận nhà máy, chứng chỉ hay còn hàng.'
  };
  const helpChip = (type, text, status='') => `<button type="button" class="chip term-chip ${status}" data-help="${type}" aria-describedby="term-help">${esc(text)} <span aria-hidden="true">ⓘ</span></button>`;
  const companyLink = company => { const url=safeUrl(company.website),tip=`Website công ty / tập đoàn${company.website_checked_at ? ' · rà soát '+date(company.website_checked_at) : ''}. Chưa xác nhận nhà máy hay chứng chỉ.`; return `<a class="company-link" data-help="WEBSITE" data-help-text="${esc(tip)}" aria-describedby="term-help" href="${esc(url || googleUrl($('query').value.trim(),company.canonical_name))}" target="_blank" rel="noopener noreferrer">${url ? 'Website công ty / tập đoàn' : 'Tìm website công ty'} ↗</a>`; };
  const hideHelp = () => { $('term-help').hidden=true; };
  function showHelp(button) {
    if(!document.body.contains(button))return hideHelp();
    const tooltip=$('term-help'); tooltip.textContent=button.dataset.helpText || explanations[button.dataset.help]; tooltip.hidden=false;
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
  let data, companies, substances, indexed, results = [], selected = null, limit = 40;
  let bag = [];
  try { const stored = JSON.parse(localStorage.getItem('apisrc-bag-v1') || '[]'); if (Array.isArray(stored)) bag = stored; } catch {}
  const bagCount = () => $('bag-count').textContent = bag.length;
  bagCount();
  const saveBag = () => { try { localStorage.setItem('apisrc-bag-v1', JSON.stringify(bag)); bagCount(); return true; } catch { notice('Không lưu được Bag. Hãy sao lưu trước khi đóng trang.'); return false; } };
  const countryName = code => { try { return new Intl.DisplayNames(['vi'], {type:'region'}).of(code); } catch { return code; } };
  const countryText = company => company.country ? `${countryName(company.country)} (${company.country})` : 'Quốc gia chưa rõ từ nguồn';
  const cardState = r => r.certificates.some(c => state(c) === 'bad') ? 'bad' : r.certificates.some(c => state(c) === 'good') ? 'good' : r.certificates.some(c=>state(c)==='claim') ? 'claim' : 'unknown';
  const vnRefs = text => !data?.vn ? [] : (data.vn.index[SraVn.key(text)] || []).filter(r => r.expiry >= new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}));
  function render() {
    hideHelp();
    $('results').innerHTML = results.length ? results.slice(0, limit).map((r, i) => {
      const status = cardState(r);
      const types = [...new Set(r.certificates.map(c => c.type))];
      return `<article class="supplier-card ${selected === i ? 'selected' : ''}"><div class="card-top"><button class="supplier-name" data-open="${i}">${esc(r.company.canonical_name)}</button><button class="save-button" data-save="${i}" data-help="SAVE" aria-label="Lưu nhà cung cấp vào Bag" aria-describedby="term-help">${bag.some(b => b.key === r.key) ? '✓' : '+'}</button></div><p>${companyLink(r.company)}</p><p class="card-meta">${esc(countryText(r.company))} · Nhà máy chưa xác định</p><p class="card-substances">${[...new Set(r.certificates.map(c => substances.get(c.substance_id).inn))].slice(0,3).map(name=>`<span class="ingredient-line">${esc(name)} <span class="vi-name">${esc(viName(name))}</span></span>`).join('')}</p><div class="chips">${types.map(t => { const certs = r.certificates.filter(c => c.type === t); const s = certs.some(c => state(c) === 'bad') ? 'bad' : certs.some(c => state(c) === 'good') ? 'good' : certs.some(c=>state(c)==='claim') ? 'claim' : 'unknown'; return helpChip(t, (labels[t] || t) + ' · ' + (s === 'good' ? 'Nguồn chính thức' : s === 'bad' ? 'Có hồ sơ không còn hiệu lực' : s === 'claim' ? 'Chưa xác minh' : 'Chưa rõ'), s); }).join('')}${helpChip('GMP_CPP','GMP · CPP/COPP: chưa có dữ liệu')}</div><p class="card-meta status-dot ${status}">● ${status === 'bad' ? 'Có hồ sơ không còn hiệu lực — xem nguồn' : status === 'good' ? 'Bản nguồn: còn hiệu lực / Active' : status==='claim' ? 'Chỉ có tuyên bố của NCC, chưa xác minh' : 'Chưa rõ trạng thái'} · ${r.certificates.length} bản ghi</p></article>`;
    }).join('') : '<div class="empty">Chưa có kết quả khớp trong các nguồn đã nạp. Có thể tìm web bổ trợ hoặc mở cổng nguồn ở bên dưới.</div>';
    $('more').hidden = results.length <= limit;
  }
  function search({web=false}={}) {
    if (!data) return;
    const started = performance.now();
    const query = $('query').value.trim();
    if (!query) return;
    const normalized = norm(query);
    let terms = [normalized];
    for (const s of data.substances) {
      const synonyms = JSON.parse(s.synonyms || '[]');
      if (s.cas === query || s.unii === query.toUpperCase() || norm(s.inn) === normalized || synonyms.some(x => norm(x) === normalized)) terms.push(norm(s.inn), ...synonyms.map(norm));
    }
    terms = [...new Set(terms.filter(Boolean))];
    const groups = new Map();
    for (const entry of indexed) {
      const {cert, company, text, companyText} = entry;
      if (!terms.some(t => text.includes(` ${t} `) || companyText.includes(` ${t} `))) continue;
      if ($('country').value && company.country !== $('country').value) continue;
      if ($('vn-filter').checked && !vnRefs(substances.get(cert.substance_id).inn).length) continue;
      const want = $('status').value, actual = state(cert);
      if (want && want !== actual) continue;
      if (!groups.has(company.id)) groups.set(company.id, {company, certificates:[], key:`${company.id}:${normalized}`, query});
      groups.get(company.id).certificates.push(cert);
    }
    const types=[...document.querySelectorAll('[data-cert]:checked')].map(c=>c.dataset.cert);
    $('certificate-summary').textContent=types.length ? types.map(t=>labels[t] || (t==='COPP' ? 'CPP/COPP' : t)).join(' + ') : 'Chọn nhiều chứng chỉ';
    results = [...groups.values()].filter(r=>matchesCertificates(r.certificates,types,$('certificate-mode').value==='all')).sort((a,b) => (cardState(a) === 'good' ? 0 : 1) - (cardState(b) === 'good' ? 0 : 1) || a.company.canonical_name.localeCompare(b.company.canonical_name));
    selected = null; limit = 40; $('source-panel').hidden = true; render();
    $('result-status').textContent = `${results.length.toLocaleString('vi-VN')} NCC / chủ hồ sơ · ${results.reduce((n,r) => n+r.certificates.length, 0).toLocaleString('vi-VN')} hồ sơ · ${(performance.now()-started).toFixed(0)} ms`;
    $('web-button').disabled = false;
    $('google-search').href=googleUrl(query);
    if(webQuery!==query){webQuery=query;webPage=-1;webRows=[];webGeneration++;webAbort?.abort();$('web-content').innerHTML='';$('web-results').hidden=true;}
    if(web && $('auto-web').checked)void searchWeb(false,false);
  }
  function sourceRecord(c) {
    const url = safeUrl(c.source_url), subject = substances.get(c.substance_id);
    return `<article class="source-record">${helpChip(c.type, labels[c.type] || c.type)} <strong>${esc(c.identifier)}</strong> <span class="chip ${state(c)}">${esc(states[c.status] || c.status)}</span><dl><dt>Hoạt chất / subject</dt><dd>${esc(subject?.inn)}<br><span class="vi-name">${esc(viName(subject?.inn))}</span></dd><dt>CAS / UNII</dt><dd>${esc([subject?.cas,subject?.unii].filter(Boolean).join(' / ') || 'Chưa chuẩn hóa')}</dd><dt>Chủ hồ sơ gốc</dt><dd>${esc(c.holder)}</dd><dt>Trạng thái gốc</dt><dd>${esc(c.raw_status)}</dd><dt>Loại CEP</dt><dd>${esc(c.cep_type || '—')}</dd><dt>Ngày cấp / nộp</dt><dd>${date(c.issued_at)}</dd><dt>Hạn / kết thúc</dt><dd>${date(c.expires_at)}</dd><dt>Ngày file nguồn</dt><dd>${date(c.source_file_date)}${c.date_basis === 'quarter_end' ? ' (cuối quý)' : ''}</dd><dt>Ngày lấy dữ liệu</dt><dd>${date(c.fetched_at)}</dd></dl>${safeUrl(subject?.normalization_source) ? `<p><a href="${esc(safeUrl(subject.normalization_source))}" target="_blank" rel="noopener noreferrer">Nguồn chuẩn hóa hoạt chất ↗</a> · ${date(subject.normalization_fetched_at)}</p>` : ''}${c.type === 'LISTING' ? `<blockquote>${esc(c.raw_snippet || 'Chưa có đoạn bằng chứng')}</blockquote>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở bản nguồn ${esc(c.source)} ↗</a>` : ''}${c.type === 'CEP' ? ' · <button type="button" data-print="'+c.id+'">In phiếu tra cứu CEP / PDF</button>' : ''}</article>`;
  }
  function open(i) {
    selected = i;
    const r = results[i];
    $('source-content').innerHTML = `<p><strong>${esc(r.company.canonical_name)}</strong></p><p>${companyLink(r.company)} <a href="${esc(googleUrl(r.query,r.company.canonical_name))}" target="_blank" rel="noopener noreferrer">Tìm hoạt chất + công ty trên Google ↗</a></p>${safeUrl(r.company.website) ? `<p class="muted">${esc(new URL(r.company.website).hostname)} · Rà soát ${date(r.company.website_checked_at)}${safeUrl(r.company.website_source) ? ` · <a href="${esc(safeUrl(r.company.website_source))}" target="_blank" rel="noopener noreferrer">Nguồn đối chiếu ↗</a>` : ''}</p>` : '<p class="muted">Chưa có website đã rà soát cho tên công ty này. Link trên mở tìm kiếm, không phải website đã xác minh.</p>'}<h3 class="source-heading">Hồ sơ & chứng chỉ</h3><p class="muted">Tên chủ hồ sơ được giữ nguyên. Không suy luận địa chỉ nhà máy. Mỗi hồ sơ giữ nguồn và mức xác minh riêng; tuyên bố của NCC không phải xác nhận của cơ quan cấp.</p>` + [...r.certificates].sort((a,b) => (state(a) === 'good' ? 0:1)-(state(b) === 'good' ? 0:1) || a.type.localeCompare(b.type)).map(sourceRecord).join('');
    $('source-panel').hidden = false; render(); $('panel-close').focus();
    const references = [...new Map(r.certificates.flatMap(c => vnRefs(substances.get(c.substance_id).inn)).map(ref => [ref.sdk,ref])).values()];
    $('source-content').insertAdjacentHTML('beforeend', `<article class="source-record"><strong>Đối chiếu DAV theo hoạt chất</strong><p class="muted">${references.length ? references.map(ref=>esc(ref.sdk)+' · hạn '+date(ref.expiry)).join('<br>') : 'Chưa tìm thấy SĐK thuốc còn hạn khớp cách chuẩn hóa trong bản DAV đã nạp.'}</p><p class="muted">Bản DAV: ${esc(data.vn?.updated || 'Chưa nạp')}. Không xác nhận nguồn API/nhà máy đã được DAV duyệt. Chưa có dữ liệu SĐK nguyên liệu riêng.</p><p><a href="https://eudragmdp.ema.europa.eu/" target="_blank" rel="noopener noreferrer">Tra GMP EU ↗</a> · <a href="https://www.cphi.com/" target="_blank" rel="noopener noreferrer">Tra CPHI ↗</a> · <a href="https://www.pharmasources.com/" target="_blank" rel="noopener noreferrer">PharmaSources ↗</a></p><p class="muted">GMP / CPP-COPP / tham dự CPHI: chưa có dữ liệu đã kiểm chứng cho NCC này.</p></article>`);
  }
  $('search-form').addEventListener('submit', e => { e.preventDefault(); search({web:true}); });
  $('filters').addEventListener('change', ()=>search());
  $('vn-filter').addEventListener('change', ()=>search());
  document.querySelectorAll('[data-query]').forEach(b => b.addEventListener('click', () => { $('query').value = b.dataset.query; search({web:true}); }));
  $('query').addEventListener('input',()=>{$('google-search').href=googleUrl($('query').value.trim());});
  $('auto-web').addEventListener('change',()=>{if($('auto-web').checked && $('query').value.trim())void searchWeb(false,false);});
  $('results').addEventListener('click', e => { const openButton = e.target.closest('[data-open]'); if (openButton) open(+openButton.dataset.open); const save = e.target.closest('[data-save]'); if (save) { const r = results[+save.dataset.save]; if (!bag.some(b => b.key === r.key)) { const snapshot = structuredClone(r); snapshot.substances = [...new Set(r.certificates.map(c => c.substance_id))].map(id => structuredClone(substances.get(id))); bag.push({key:r.key, snapshot, saved_at:new Date().toISOString(), note:'', docs:{}, quote:{status:'not_sent'}}); saveBag(); render(); notice('Đã lưu snapshot NCC vào Bag'); } } });
  $('panel-close').addEventListener('click', () => { $('source-panel').hidden = true; selected = null; render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('source-panel').hidden) $('panel-close').click(); });
  $('more').addEventListener('click', () => { limit += 40; render(); });
  let webGeneration=0,webQuery='',webPage=-1,webRows=[],webAbort;
  const cloudEndpoint=$('api-endpoint')?.content || '';
  const useCloud=!!cloudEndpoint && !['127.0.0.1','localhost'].includes(location.hostname);
  const accessFromLink=new URLSearchParams(location.hash.slice(1)).get('access');
  if(accessFromLink && /^[A-Za-z0-9_-]{32,128}$/.test(accessFromLink)) {
    sessionStorage.setItem('apisrc_web_access',accessFromLink);history.replaceState(null,'',location.pathname+location.search);
  }
  $('web-access-form').addEventListener('submit',e=>{e.preventDefault();sessionStorage.setItem('apisrc_web_access',$('web-access-code').value.trim());$('web-access-code').value='';$('web-access').close();$('web-button').click();});
  $('web-access-cancel').addEventListener('click',()=>$('web-access').close());
  async function searchWeb(more=true,interactive=true) {
    const query=$('query').value.trim();if(query.length<2)return;
    if(webQuery!==query){webQuery=query;webPage=-1;webRows=[];$('web-content').innerHTML='';}
    if(!more && webPage>=0)return;
    const page=more ? webPage+1 : 0;
    if(page>4){notice('Đã tìm 5 lượt cho hoạt chất này. Có thể tìm tiếp trên Google.');return;}
    webAbort?.abort();webAbort=new AbortController();
    const generation=++webGeneration;
    $('web-results').hidden=false; $('web-status').textContent='Đang tìm web bổ trợ · giới hạn chờ 3 giây…';
    $('web-button').disabled=true;
    try {
      const access=sessionStorage.getItem('apisrc_web_access');
      if(useCloud && !access){if(interactive)$('web-access').showModal();$('web-status').textContent='Tìm trong dữ liệu đã nạp luôn sẵn sàng. Bấm “Tìm thêm trên web” để nhập mã truy cập một lần cho phiên này.';return;}
      const response=await fetch((useCloud ? cloudEndpoint+'/search' : './search')+'?'+new URLSearchParams({q:query,page}),{signal:AbortSignal.any([webAbort.signal,AbortSignal.timeout(4200)]),headers:useCloud ? {Authorization:'Bearer '+access} : {}});
      if(generation!==webGeneration)return;
      if(response.status===401){sessionStorage.removeItem('apisrc_web_access');if(interactive)$('web-access').showModal();throw new Error('Mã truy cập chưa đúng. Bấm tìm thêm để nhập lại.');}
      if (!response.ok) throw new Error(useCloud ? 'Dịch vụ tìm web đang bận. Thử lại sau.' : 'Chưa có backend tìm web. Chạy server.py để bật các API.');
      const payload=await response.json(); if(generation!==webGeneration)return;
      const before=webRows.length;webRows=mergeWeb(webRows,payload.results || []);
      if(payload.results?.length || !payload.pending && !payload.providers?.some(p=>p.error))webPage=page;
      $('web-status').textContent=`Thêm ${webRows.length-before} URL mới · đang giữ ${webRows.length} nguồn · lượt ${page+1} · ${payload.elapsed_ms} ms${payload.providers?.some(p=>p.cached) ? ' · từ cache' : ''}${payload.pending ? ' · nguồn chậm đang lưu nền; bấm tìm thêm để thử lại lượt này' : ''}${!payload.configured?.length ? ' · chưa cấu hình provider' : ''}${payload.providers?.some(p=>p.error) ? ' · một số nguồn chưa trả kết quả; có thể thử lại' : ''}`;
      $('web-content').innerHTML=webRows.map(r=>`<article class="supplier-card"><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title || r.url)}</a><p>${esc(r.snippet)}</p><span class="chip">Nguồn web · chưa xác minh</span> <span class="muted">${esc(r.provider)} · ${date(r.fetched_at)}</span></article>`).join('');
    } catch(error) { if(generation===webGeneration)$('web-status').textContent=error.name==='TimeoutError' ? 'Nguồn web chậm. Kết quả chính thức vẫn sẵn sàng; tác vụ nền có thể lưu cho lần tìm sau.' : error.message; }
    finally { if(generation===webGeneration)$('web-button').disabled=false; }
  }
  $('web-button').addEventListener('click',()=>void searchWeb());
  try {
    const bytes = Uint8Array.from(atob($('api-data').textContent.trim()), c => c.charCodeAt(0));
    data = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    companies = new Map(data.companies.map(c => [c.id,c])); substances = new Map(data.substances.map(s => [s.id,s]));
    const listings=(data.listings||[]).map(l=>({...l,id:'listing:'+l.id,type:'LISTING',identifier:'Listing',status:'unknown',raw_status:'NCC tuyên bố, chưa xác minh',holder:companies.get(l.company_id).canonical_name}));
    indexed = [...data.certificates,...listings].map(cert => ({cert, company:companies.get(cert.company_id), text:` ${norm(substances.get(cert.substance_id).inn)} `, companyText:` ${norm(companies.get(cert.company_id).canonical_name)} `}));
    const counts = [...new Set(data.companies.map(c => c.country).filter(Boolean))].sort();
    $('country').innerHTML += counts.map(c => `<option value="${esc(c)}">${esc(countryName(c))} (${esc(c)})</option>`).join('');
    $('suggestions').innerHTML = data.substances.filter(s => s.inn.length < 75).slice(0,2500).map(s => `<option value="${esc(s.inn)}"></option>`).join('');
    $('source-health').innerHTML = '<div class="health-grid">' + ['EDQM','FDA','WHO'].map(source => {
      const run = data.runs.find(r => r.source === source && r.status === 'ok'), failure = data.runs.find(r => r.source === source);
      return `<div class="health-card">${helpChip({EDQM:'CEP',FDA:'DMF_US',WHO:'WHO_PQ'}[source],source)}<p>${data.certificates.filter(c => c.source === source).length.toLocaleString('vi-VN')} bản ghi</p><p>Ngày file: ${date(run?.source_file_date)}</p><p>Ngày tải: ${date(run?.finished_at)}</p><p>${failure?.status === 'error' ? 'Lần cập nhật mới nhất lỗi; đang giữ bản trước.' : 'Đã nhập bản dữ liệu nguồn'}</p></div>`;
    }).join('') + '</div>';
    $('search-button').disabled = false;
    $('result-status').textContent = `${data.certificates.length.toLocaleString('vi-VN')} hồ sơ sẵn sàng · nhập hoạt chất để tìm`;
    $('results').innerHTML = '<div class="empty">Tìm nhà cung cấp từ EDQM CEP, FDA DMF Type II và WHO PQ. Chọn hoạt chất mẫu để bắt đầu.</div>';
    window.APISRC_READY = true;
    // Optional module extension points below are filled by later stages.
    window.APISRC_UI = {data, companies, substances, bag, saveBag, bagCount, notice, esc, date, sourceRecord, search, render, vnRefs, $};
    document.dispatchEvent(new Event('apisrc-ready'));
  } catch (error) { $('result-status').textContent = 'Không đọc được chỉ mục: ' + error.message; }
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
    try { const bytes=await SraExcel.build(ApiSourcing.bagSheets(bag,data.vn,vnRefs));await SraExcel.downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'API-Sourcing-Bag-'+new Date().toISOString().slice(0,10)+'.xlsx');notice('Đã xuất Excel: Nhà cung cấp + Email mẫu.'); }
    catch {notice('Chưa xuất được Excel; Bag vẫn được giữ.');}
    finally{$('bag-excel').disabled=false;}
  });
  $('bag-export').addEventListener('click', () => {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exported_at:new Date().toISOString(),items:bag},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='api-sourcing-bag.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
