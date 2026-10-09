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
  const labels = {CEP:'CEP', DMF_US:'DMF US · II', WHO_PQ:'WHO PQ'};
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
  const cardState = r => r.certificates.some(c => state(c) === 'bad') ? 'bad' : r.certificates.some(c => state(c) === 'good') ? 'good' : 'unknown';
  function render() {
    $('results').innerHTML = results.length ? results.slice(0, limit).map((r, i) => {
      const status = cardState(r);
      const types = [...new Set(r.certificates.map(c => c.type))];
      return `<article class="supplier-card ${selected === i ? 'selected' : ''}"><div class="card-top"><button class="supplier-name" data-open="${i}">${esc(r.company.canonical_name)}</button><button class="save-button" data-save="${i}">${bag.some(b => b.key === r.key) ? '✓ Đã lưu' : '+ Bag'}</button></div><p class="card-meta">${esc(countryText(r.company))} · Nhà máy chưa xác định</p><p class="card-substances">${esc([...new Set(r.certificates.map(c => substances.get(c.substance_id).inn))].slice(0, 3).join(' · '))}</p><div class="chips">${types.map(t => { const certs = r.certificates.filter(c => c.type === t); const s = certs.some(c => state(c) === 'bad') ? 'bad' : certs.some(c => state(c) === 'good') ? 'good' : 'unknown'; return `<span class="chip ${s}" title="Bản ghi có nguồn chính thức; xem từng trạng thái trong panel">${esc(labels[t] || t)} · ${s === 'good' ? 'Nguồn chính thức' : s === 'bad' ? 'Có hồ sơ không còn hiệu lực' : 'Chưa rõ'}</span>`; }).join('')}<span class="chip">GMP / CPP: chưa có dữ liệu</span></div><p class="card-meta status-dot ${status}">● ${status === 'bad' ? 'Có hồ sơ không còn hiệu lực — xem nguồn' : status === 'good' ? 'Có hồ sơ chính thức còn hiệu lực / Active' : 'Chưa rõ trạng thái'} · ${r.certificates.length} bản ghi</p></article>`;
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
      if (s.cas === query || norm(s.inn) === normalized || synonyms.some(x => norm(x) === normalized)) terms.push(norm(s.inn), ...synonyms.map(norm));
    }
    terms = [...new Set(terms.filter(Boolean))];
    const groups = new Map();
    for (const entry of indexed) {
      const {cert, company, text, companyText} = entry;
      if (!terms.some(t => text.includes(` ${t} `) || companyText.includes(` ${t} `))) continue;
      if ($('country').value && company.country !== $('country').value) continue;
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
    const url = safeUrl(c.source_url);
    return `<article class="source-record"><strong>${esc(labels[c.type] || c.type)} · ${esc(c.identifier)}</strong> <span class="chip ${state(c)}">${esc(states[c.status] || c.status)}</span><dl><dt>Hoạt chất / subject</dt><dd>${esc(substances.get(c.substance_id)?.inn)}</dd><dt>Chủ hồ sơ gốc</dt><dd>${esc(c.holder)}</dd><dt>Trạng thái gốc</dt><dd>${esc(c.raw_status)}</dd><dt>Loại CEP</dt><dd>${esc(c.cep_type || '—')}</dd><dt>Ngày cấp / nộp</dt><dd>${date(c.issued_at)}</dd><dt>Hạn / kết thúc</dt><dd>${date(c.expires_at)}</dd><dt>Ngày file nguồn</dt><dd>${date(c.source_file_date)}${c.date_basis === 'quarter_end' ? ' (cuối quý)' : ''}</dd><dt>Ngày lấy dữ liệu</dt><dd>${date(c.fetched_at)}</dd></dl>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở bản nguồn ${esc(c.source)} ↗</a>` : ''}${c.type === 'CEP' ? ' · <button type="button" data-print="'+c.id+'">In phiếu tra cứu CEP / PDF</button>' : ''}</article>`;
  }
  function open(i) {
    selected = i;
    const r = results[i];
    $('source-content').innerHTML = `<p><strong>${esc(r.company.canonical_name)}</strong></p><p class="muted">Tên chủ hồ sơ được giữ nguyên. Không suy luận địa chỉ nhà máy. Xác minh = khớp bản dữ liệu chính thức, tách biệt với hiệu lực.</p>` + [...r.certificates].sort((a,b) => (state(a) === 'good' ? 0:1)-(state(b) === 'good' ? 0:1) || a.type.localeCompare(b.type)).map(sourceRecord).join('');
    $('source-panel').hidden = false; render(); $('panel-close').focus();
  }
  $('search-form').addEventListener('submit', e => { e.preventDefault(); search(); });
  $('filters').addEventListener('change', search);
  document.querySelectorAll('[data-query]').forEach(b => b.addEventListener('click', () => { $('query').value = b.dataset.query; search(); }));
  $('results').addEventListener('click', e => { const openButton = e.target.closest('[data-open]'); if (openButton) open(+openButton.dataset.open); const save = e.target.closest('[data-save]'); if (save) { const r = results[+save.dataset.save]; if (!bag.some(b => b.key === r.key)) { bag.push({key:r.key, snapshot:structuredClone(r), saved_at:new Date().toISOString(), note:'', docs:{}, quote:{status:'not_sent'}}); saveBag(); render(); notice('Đã lưu snapshot NCC vào Bag'); } } });
  $('panel-close').addEventListener('click', () => { $('source-panel').hidden = true; selected = null; render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('source-panel').hidden) $('panel-close').click(); });
  $('more').addEventListener('click', () => { limit += 40; render(); });
  try {
    const bytes = Uint8Array.from(atob($('api-data').textContent.trim()), c => c.charCodeAt(0));
    data = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    companies = new Map(data.companies.map(c => [c.id,c])); substances = new Map(data.substances.map(s => [s.id,s]));
    indexed = data.certificates.map(cert => ({cert, company:companies.get(cert.company_id), text:` ${norm(substances.get(cert.substance_id).inn)} `, companyText:` ${norm(companies.get(cert.company_id).canonical_name)} `}));
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
