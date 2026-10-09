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
  return { norm, safeUrl, state, termsMatch };
})();
if (typeof module !== 'undefined') module.exports = ApiSourcing;
if (typeof document !== 'undefined') (async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const { norm, safeUrl, state } = ApiSourcing;
  const labels = {CEP:'CEP', DMF_US:'DMF US · II', WHO_PQ:'WHO PQ', LISTING:'NCC tuyên bố'};
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
    $('results').innerHTML = results.length ? results.slice(0, limit).map((r, i) => {
      const status = cardState(r);
      const types = [...new Set(r.certificates.map(c => c.type))];
      return `<article class="supplier-card ${selected === i ? 'selected' : ''}"><div class="card-top"><button class="supplier-name" data-open="${i}">${esc(r.company.canonical_name)}</button><button class="save-button" data-save="${i}">${bag.some(b => b.key === r.key) ? '✓ Đã lưu' : '+ Bag'}</button></div><p class="card-meta">${esc(countryText(r.company))} · Nhà máy chưa xác định</p><p class="card-substances">${esc([...new Set(r.certificates.map(c => substances.get(c.substance_id).inn))].slice(0, 3).join(' · '))}</p><div class="chips">${types.map(t => { const certs = r.certificates.filter(c => c.type === t); const s = certs.some(c => state(c) === 'bad') ? 'bad' : certs.some(c => state(c) === 'good') ? 'good' : certs.some(c=>state(c)==='claim') ? 'claim' : 'unknown'; return `<span class="chip ${s}" title="${t === 'LISTING' ? 'Tuyên bố của NCC; chưa xác minh' : 'Bản ghi có nguồn chính thức; xem từng trạng thái trong panel'}">${esc(labels[t] || t)} · ${s === 'good' ? 'Nguồn chính thức' : s === 'bad' ? 'Có hồ sơ không còn hiệu lực' : s === 'claim' ? 'Chưa xác minh' : 'Chưa rõ'}</span>`; }).join('')}<span class="chip">GMP / CPP: chưa có dữ liệu</span></div><p class="card-meta status-dot ${status}">● ${status === 'bad' ? 'Có hồ sơ không còn hiệu lực — xem nguồn' : status === 'good' ? 'Bản nguồn: còn hiệu lực / Active' : status==='claim' ? 'Chỉ có tuyên bố của NCC, chưa xác minh' : 'Chưa rõ trạng thái'} · ${r.certificates.length} bản ghi</p></article>`;
    }).join('') : '<div class="empty">Chưa có kết quả khớp trong các nguồn đã nạp. Có thể tìm web bổ trợ hoặc mở cổng nguồn ở bên dưới.</div>';
    $('more').hidden = results.length <= limit;
  }
  function search() {
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
      const kind = $('certificate').value;
      if (kind && (cert.type !== kind || actual !== 'good' || kind === 'CEP' && !['Chemical', 'Chemical and TSE'].includes(cert.cep_type))) continue;
      if (!groups.has(company.id)) groups.set(company.id, {company, certificates:[], key:`${company.id}:${normalized}`, query});
      groups.get(company.id).certificates.push(cert);
    }
    results = [...groups.values()].sort((a,b) => (cardState(a) === 'good' ? 0 : 1) - (cardState(b) === 'good' ? 0 : 1) || a.company.canonical_name.localeCompare(b.company.canonical_name));
    selected = null; limit = 40; $('source-panel').hidden = true; render();
    $('result-status').textContent = `${results.length.toLocaleString('vi-VN')} NCC / chủ hồ sơ · ${results.reduce((n,r) => n+r.certificates.length, 0).toLocaleString('vi-VN')} hồ sơ · ${(performance.now()-started).toFixed(0)} ms`;
    $('web-button').disabled = false;
  }
  function sourceRecord(c) {
    const url = safeUrl(c.source_url), subject = substances.get(c.substance_id);
    return `<article class="source-record"><strong>${esc(labels[c.type] || c.type)} · ${esc(c.identifier)}</strong> <span class="chip ${state(c)}">${esc(states[c.status] || c.status)}</span><dl><dt>Hoạt chất / subject</dt><dd>${esc(subject?.inn)}</dd><dt>CAS / UNII</dt><dd>${esc([subject?.cas,subject?.unii].filter(Boolean).join(' / ') || 'Chưa chuẩn hóa')}</dd><dt>Chủ hồ sơ gốc</dt><dd>${esc(c.holder)}</dd><dt>Trạng thái gốc</dt><dd>${esc(c.raw_status)}</dd><dt>Loại CEP</dt><dd>${esc(c.cep_type || '—')}</dd><dt>Ngày cấp / nộp</dt><dd>${date(c.issued_at)}</dd><dt>Hạn / kết thúc</dt><dd>${date(c.expires_at)}</dd><dt>Ngày file nguồn</dt><dd>${date(c.source_file_date)}${c.date_basis === 'quarter_end' ? ' (cuối quý)' : ''}</dd><dt>Ngày lấy dữ liệu</dt><dd>${date(c.fetched_at)}</dd></dl>${safeUrl(subject?.normalization_source) ? `<p><a href="${esc(safeUrl(subject.normalization_source))}" target="_blank" rel="noopener noreferrer">Nguồn chuẩn hóa hoạt chất ↗</a> · ${date(subject.normalization_fetched_at)}</p>` : ''}${c.type === 'LISTING' ? `<blockquote>${esc(c.raw_snippet || 'Chưa có đoạn bằng chứng')}</blockquote>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở bản nguồn ${esc(c.source)} ↗</a>` : ''}${c.type === 'CEP' ? ' · <button type="button" data-print="'+c.id+'">In phiếu tra cứu CEP / PDF</button>' : ''}</article>`;
  }
  function open(i) {
    selected = i;
    const r = results[i];
    $('source-content').innerHTML = `<p><strong>${esc(r.company.canonical_name)}</strong></p><p class="muted">Tên chủ hồ sơ được giữ nguyên. Không suy luận địa chỉ nhà máy. Mỗi hồ sơ giữ nguồn và mức xác minh riêng; tuyên bố của NCC không phải xác nhận của cơ quan cấp.</p>` + [...r.certificates].sort((a,b) => (state(a) === 'good' ? 0:1)-(state(b) === 'good' ? 0:1) || a.type.localeCompare(b.type)).map(sourceRecord).join('');
    $('source-panel').hidden = false; render(); $('panel-close').focus();
    const references = [...new Map(r.certificates.flatMap(c => vnRefs(substances.get(c.substance_id).inn)).map(ref => [ref.sdk,ref])).values()];
    $('source-content').insertAdjacentHTML('beforeend', `<article class="source-record"><strong>Đối chiếu DAV theo hoạt chất</strong><p class="muted">${references.length ? references.map(ref=>esc(ref.sdk)+' · hạn '+date(ref.expiry)).join('<br>') : 'Chưa tìm thấy SĐK thuốc còn hạn khớp cách chuẩn hóa trong bản DAV đã nạp.'}</p><p class="muted">Bản DAV: ${esc(data.vn?.updated || 'Chưa nạp')}. Không xác nhận nguồn API/nhà máy đã được DAV duyệt. Chưa có dữ liệu SĐK nguyên liệu riêng.</p><p><a href="https://eudragmdp.ema.europa.eu/" target="_blank" rel="noopener noreferrer">Tra GMP EU ↗</a> · <a href="https://www.cphi.com/" target="_blank" rel="noopener noreferrer">Tra CPHI ↗</a> · <a href="https://www.pharmasources.com/" target="_blank" rel="noopener noreferrer">PharmaSources ↗</a></p><p class="muted">GMP / CPP / tham dự CPHI: chưa có dữ liệu đã kiểm chứng cho NCC này.</p></article>`);
  }
  $('search-form').addEventListener('submit', e => { e.preventDefault(); search(); });
  $('filters').addEventListener('change', search);
  $('vn-filter').addEventListener('change', search);
  document.querySelectorAll('[data-query]').forEach(b => b.addEventListener('click', () => { $('query').value = b.dataset.query; search(); }));
  $('results').addEventListener('click', e => { const openButton = e.target.closest('[data-open]'); if (openButton) open(+openButton.dataset.open); const save = e.target.closest('[data-save]'); if (save) { const r = results[+save.dataset.save]; if (!bag.some(b => b.key === r.key)) { const snapshot = structuredClone(r); snapshot.substances = [...new Set(r.certificates.map(c => c.substance_id))].map(id => structuredClone(substances.get(id))); bag.push({key:r.key, snapshot, saved_at:new Date().toISOString(), note:'', docs:{}, quote:{status:'not_sent'}}); saveBag(); render(); notice('Đã lưu snapshot NCC vào Bag'); } } });
  $('panel-close').addEventListener('click', () => { $('source-panel').hidden = true; selected = null; render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('source-panel').hidden) $('panel-close').click(); });
  $('more').addEventListener('click', () => { limit += 40; render(); });
  let webGeneration=0;
  const cloudEndpoint=$('api-endpoint')?.content || '';
  const useCloud=!!cloudEndpoint && !['127.0.0.1','localhost'].includes(location.hostname);
  const accessFromLink=new URLSearchParams(location.hash.slice(1)).get('access');
  if(accessFromLink && /^[A-Za-z0-9_-]{32,128}$/.test(accessFromLink)) {
    sessionStorage.setItem('apisrc_web_access',accessFromLink);history.replaceState(null,'',location.pathname+location.search);
  }
  $('web-access-form').addEventListener('submit',e=>{e.preventDefault();sessionStorage.setItem('apisrc_web_access',$('web-access-code').value.trim());$('web-access-code').value='';$('web-access').close();$('web-button').click();});
  $('web-access-cancel').addEventListener('click',()=>$('web-access').close());
  $('web-button').addEventListener('click', async () => {
    const generation=++webGeneration;
    $('web-results').hidden=false; $('web-status').textContent='Đang tìm web bổ trợ · giới hạn chờ 3 giây…';
    $('web-content').innerHTML=''; $('web-button').disabled=true;
    try {
      const access=sessionStorage.getItem('apisrc_web_access');
      if(useCloud && !access){$('web-access').showModal();$('web-status').textContent='Nhập mã truy cập để tìm thêm trên web.';return;}
      const response=await fetch((useCloud ? cloudEndpoint+'/search' : './search')+'?q='+encodeURIComponent($('query').value.trim()),{signal:AbortSignal.timeout(4200),headers:useCloud ? {Authorization:'Bearer '+access} : {}});
      if(response.status===401){sessionStorage.removeItem('apisrc_web_access');$('web-access').showModal();throw new Error('Mã truy cập chưa đúng. Nhập lại mã để tìm web.');}
      if (!response.ok) throw new Error(useCloud ? 'Dịch vụ tìm web đang bận. Thử lại sau.' : 'Chưa có backend tìm web. Chạy server.py để bật các API.');
      const payload=await response.json(); if(generation!==webGeneration)return;
      $('web-status').textContent=`${payload.results.length} nguồn web · ${payload.elapsed_ms} ms${payload.providers.some(p=>p.cached) ? ' · từ cache' : ''}${payload.pending ? ' · nguồn chậm đang được lưu nền; có thể tìm lại sau' : ''}${!payload.configured.length ? ' · chưa cấu hình provider' : ''}${payload.providers.filter(p=>p.error).map(p=>' · '+p.provider+': lỗi kết nối'+(p.http_status ? ' '+p.http_status : '')).join('')}`;
      $('web-content').innerHTML=payload.results.map(r=>`<article class="supplier-card"><a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title || r.url)}</a><p>${esc(r.snippet)}</p><span class="chip">Nguồn web · chưa xác minh</span> <span class="muted">${esc(r.provider)} · ${date(r.fetched_at)}</span></article>`).join('');
    } catch(error) { if(generation===webGeneration)$('web-status').textContent=error.name==='TimeoutError' ? 'Nguồn web chậm. Kết quả chính thức vẫn sẵn sàng; tác vụ nền có thể lưu cho lần tìm sau.' : error.message; }
    finally { if(generation===webGeneration)$('web-button').disabled=false; }
  });
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
      return `<div class="health-card"><strong>${source}</strong><p>${data.certificates.filter(c => c.source === source).length.toLocaleString('vi-VN')} bản ghi</p><p>Ngày file: ${date(run?.source_file_date)}</p><p>Ngày tải: ${date(run?.finished_at)}</p><p>${failure?.status === 'error' ? 'Lần cập nhật mới nhất lỗi; đang giữ bản trước.' : 'Đã nhập bản dữ liệu nguồn'}</p></div>`;
    }).join('') + '</div>';
    $('search-button').disabled = false;
    $('result-status').textContent = `${data.certificates.length.toLocaleString('vi-VN')} hồ sơ sẵn sàng · nhập hoạt chất để tìm`;
    $('results').innerHTML = '<div class="empty">Tìm nhà cung cấp từ EDQM CEP, FDA DMF Type II và WHO PQ. Chọn hoạt chất mẫu để bắt đầu.</div>';
    window.APISRC_READY = true;
    // Optional module extension points below are filled by later stages.
    window.APISRC_UI = {data, companies, substances, bag, saveBag, bagCount, notice, esc, date, sourceRecord, search, render, $};
    document.dispatchEvent(new Event('apisrc-ready'));
  } catch (error) { $('result-status').textContent = 'Không đọc được chỉ mục: ' + error.message; }
})();

if (typeof document !== 'undefined') document.addEventListener('apisrc-ready', () => {
  const {data, bag, saveBag, notice, esc, date, $, render, substances} = window.APISRC_UI;
  const documentLabels = {gmp:'GMP / CPP-COPP của nhà máy', cep:'CEP hoặc hồ sơ chất lượng API', coa:'CoA lô', stability:'Số liệu ổn định', license:'Giấy phép sản xuất', authorization:'Thư ủy quyền / Letter of access', legal:'Hợp pháp hóa lãnh sự / căn cứ miễn'};
  function paintBag() {
    $('bag-content').innerHTML = bag.length ? bag.map((item,i) => {
      const r = item.snapshot;
      const quote = item.quote || {status:'not_sent'};
      const docs = item.docs || {};
      const subject = `Request for quotation: ${r.query}`;
      const body = `Dear ${r.company.canonical_name},\n\nPlease quote ${r.query}: price, MOQ, lead time, availability and manufacturing site. Please provide current GMP/CPP, CEP or quality dossier, CoA, stability data and letter of authorization.\n\nOur public-source references: ${r.certificates.map(c => c.type+' '+c.identifier).join('; ')}.\n\nBest regards,\nBao An Pharma`;
      return `<article class="bag-item" data-bag="${i}"><h3>${esc(r.company.canonical_name)}</h3><p>${esc(r.query)} · <span class="muted">Lưu ${date(item.saved_at)} · snapshot ${r.certificates.length} hồ sơ</span></p><details><summary>Nguồn tại lúc lưu</summary>${r.certificates.map(c=>`<p class="muted">${esc(c.type)} ${esc(c.identifier)} · ${esc(c.raw_status)} · ngày file ${date(c.source_file_date)} · lấy ${date(c.fetched_at)} <a target="_blank" rel="noopener noreferrer" href="${esc(ApiSourcing.safeUrl(c.source_url))}">Nguồn ↗</a></p>`).join('')}</details><label>Ghi chú<textarea data-field="note" maxlength="5000">${esc(item.note)}</textarea></label><details><summary>Checklist hồ sơ DAV</summary><p class="muted">Tự kiểm tra tài liệu nhận được và hạn dùng. Cần pháp chế xác nhận; không tự suy luận miễn hồ sơ từ SĐK thuốc.</p><div class="docs">${Object.entries(documentLabels).map(([key,label])=>`<label><input type="checkbox" data-doc="${key}" ${docs[key]?.received ? 'checked':''}>${label}</label><input type="date" aria-label="Hạn ${label}" data-expiry="${key}" value="${esc(docs[key]?.expiry || '')}">`).join('')}</div></details><details><summary>Theo dõi báo giá</summary><label>Trạng thái <select data-quote="status">${[['not_sent','Chưa gửi'],['sent','Đã gửi (tự ghi nhận)'],['replied','Đã trả lời'],['no_reply','Chưa phản hồi']].map(([v,l])=>`<option value="${v}" ${quote.status===v?'selected':''}>${l}</option>`).join('')}</select></label> <label>Giá <input data-quote="quoted_price" value="${esc(quote.quoted_price||'')}" maxlength="100"></label> <label>Đơn vị <input data-quote="price_unit" value="${esc(quote.price_unit||'')}" maxlength="80" placeholder="USD/kg"></label> <label>Ngày <input type="date" data-quote="price_date" value="${esc(quote.price_date||'')}"></label></details><div class="bag-actions"><a href="mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Soạn email hỏi giá</a><button type="button" data-copy-quote="${i}">Sao chép nội dung WhatsApp</button><button type="button" data-remove-bag="${i}">Bỏ khỏi Bag</button></div><p class="muted">Soạn thư không thay đổi trạng thái sang “đã gửi”. Không có email / số điện thoại NCC đã xác minh.</p></article>`;
    }).join('') : '<p class="empty">Bag chưa có NCC. Bấm + Bag trên một thẻ tìm kiếm.</p>';
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
    if (target.dataset.quote) { item.quote[target.dataset.quote] = target.value; if (target.dataset.quote === 'status' && target.value === 'sent') item.quote.sent_at = new Date().toISOString(); }
    saveBag();
  });
  $('bag-content').addEventListener('click', async e => {
    const remove=e.target.closest('[data-remove-bag]');
    if (remove) { bag.splice(+remove.dataset.removeBag,1); saveBag(); paintBag(); render(); }
    const copy=e.target.closest('[data-copy-quote]');
    if (copy) { const r=bag[+copy.dataset.copyQuote].snapshot; try { await navigator.clipboard.writeText(`Dear ${r.company.canonical_name}, please quote ${r.query}: MOQ, price, delivery and current GMP/CEP/CoA documents. Bao An Pharma.`); notice('Đã sao chép nội dung để bạn gửi WhatsApp'); } catch { notice('Không truy cập được clipboard; dùng nút soạn email.'); } }
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
