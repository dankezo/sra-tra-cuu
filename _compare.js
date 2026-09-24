/* Snapshot of current results and an indexed component join against DAV. */
function SraCompare(options) {
  const {dialog,records,fold,countryName}=options;
  const el=id=>document.getElementById('compare-'+id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageSize=40;
  const loupe='<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  let generation=0, leftTimer=0, rightTimer=0, s={entries:[],left:[],right:[],hits:[],focus:null,lp:0,rp:0}, exporting=false;
  const innCache=new Map(), metaCache=new WeakMap();
  const keys=text=>{if(!innCache.has(text))innCache.set(text,[...new Set(SraVn.components(text).map(SraVn.key))]);return innCache.get(text);};
  const formKey=raw=>fold(raw || '').replace(/\s+/g,' ').trim();
  const strengthKey=raw=>SraData.strengthKey(raw || '');
  function meta(e){
    if(!metaCache.has(e.row))metaCache.set(e.row,{keys:[...new Set([e.row[1],...Object.values(e.row._inns||{})].flatMap(keys))],form:formKey(e.row[3]),strength:strengthKey(e.row[4])});
    return metaCache.get(e.row);
  }
  let stats=new Map(), eligible=[], assessed=null;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function chunks(rows,visit,gen,label){
    let clock=performance.now();
    for(let i=0;i<rows.length;i++){
      visit(rows[i],i);
      if(i%256===0 && performance.now()-clock>10){
        el('status').textContent=label+' '+Math.floor((i+1)/rows.length*100)+'%';
        await pause();if(gen!==generation || !dialog.open)return false;clock=performance.now();
      }
    }
    return gen===generation && dialog.open;
  }
  async function prepare(gen){
    const current=options.assessments();if(assessed===current)return true;
    const next=new Map(), good=[];
    if(!await chunks(records,r=>{
      const a=current.get(r.id);
      const tags=new Set(options.selectedTags ? options.selectedTags() : []);
      if(!tags.size || !a || !tags.has(a.tagId))return;
      good.push(r);
      for(const k of keys(r.inn)){
        if(!next.has(k))next.set(k,{sdk:new Set(),form:new Set(),strength:new Set(),missingForm:false,missingStrength:false});
        const x=next.get(k);x.sdk.add((r.sdk.match(/^\d{12}/)||[])[0] || r.sdk.trim().toUpperCase());
        if(r.form.trim())x.form.add(formKey(r.form));else x.missingForm=true;
        if(r.strength.trim())x.strength.add(strengthKey(r.strength));else x.missingStrength=true;
      }
    },gen,'Đang thống kê DAV…'))return false;
    stats=next;eligible=good;assessed=current;return true;
  }
  function limits(){return ['sdk','form','strength'].map(type=>({type,on:el(type+'-on').checked,value:Number(el(type+'-choice').value==='other'?el(type+'-max').value:el(type+'-choice').value)}));}
  function allowed(k, rules){const x=stats.get(k);return !!x && rules.every(r=>!r.on || (Number.isInteger(r.value)&&r.value>0 && (r.type==='sdk'?x.sdk.size<=r.value:!x[r.type==='form'?'missingForm':'missingStrength'] && x[r.type].size===r.value)));}
  function facets(side, forms, strengths){
    for(const [type,values,label] of [['form',forms,'Mọi dạng bào chế'],['strength',strengths,'Mọi hàm lượng']]){
      const select=el(side+'-'+type), prior=select.value;
      select.innerHTML='<option value="">'+label+'</option>'+[...values].sort((a,b)=>a[1].localeCompare(b[1],'vi')).map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('');
      if([...select.options].some(o=>o.value===prior))select.value=prior;
    }
  }
  function matchFacets(side,form,strength){return (!el(side+'-form').value||el(side+'-form').value===form)&&(!el(side+'-strength').value||el(side+'-strength').value===strength);}
  const assessment=r=>options.assessments().get(r.id);
  const reason=r=>options.reasons[assessment(r)?.reason] || 'chưa đủ dữ liệu';
  function companyHtml(name, vn){
    if(!name) return esc(vn ? 'Chưa có công ty đăng ký' : 'Chưa có công ty');
    const link=options.companyLink(name);
    const tip={official:'Website công ty',profile:'Giới thiệu công ty',search:'Google Search'}[link.kind] || 'Google Search';
    return `<a class="compare-co" href="${esc(link.url)}" target="_blank" rel="noopener" title="${esc(tip)}">${esc(name)}</a>`;
  }
  function sourceBtn(url, product, agency){
    if(!url) return '';
    return `<a class="compare-source" href="${esc(url)}" data-copy-product="${esc(product || '')}" target="_blank" rel="noopener" title="Mở ${esc(agency || 'nguồn')}; sao chép tên thuốc">${loupe}<span class="visually-hidden">Mở nguồn và sao chép tên thuốc</span></a>`;
  }
  function scoped(){return s.focus?[s.focus]:s.left;}
  function pager(side,n,p){
    const pages=Math.max(1,Math.ceil(n/pageSize));
    el(side+'-page').textContent=`${p+1} / ${pages}`;
    dialog.querySelector(`[data-compare-page="${side}:-1"]`).disabled=p===0;
    dialog.querySelector(`[data-compare-page="${side}:1"]`).disabled=p+1>=pages;
  }
  function paintLeft(){
    el('left-count').textContent='· '+s.left.length.toLocaleString('vi-VN');
    el('left').innerHTML=s.left.slice(s.lp*pageSize,(s.lp+1)*pageSize).map((entry,j)=>{
      const r=entry.row, vn=entry.cc==='VN', src=options.sourceOf(entry.cc, r);
      return `<article class="compare-row" data-compare-row="${s.lp*pageSize+j}" aria-pressed="${s.focus===entry}" tabindex="0">`+
        sourceBtn(src.url, r[2], src.agency)+
        `<span class="compare-tag">${esc(countryName(entry.cc))}</span>`+
        `<strong>${esc(r[2] || 'Chưa có tên thuốc')}</strong>`+
        `<span><span class="compare-k">Hoạt chất</span> ${esc(r[1] || 'Chưa có hoạt chất')}</span>`+
        `<small><span class="compare-k">Hàm lượng</span> ${esc(r[4] || 'Chưa có hàm lượng')} · <span class="compare-k">Dạng</span> ${esc(options.formLabel(r[3]))}</small>`+
        `<small><span class="compare-k">${vn?'Công ty đăng ký':'Công ty'}</span> ${companyHtml(r[5], vn)}</small>`+
        (vn ? `<small><span class="compare-k">SĐK</span> ${esc(r[8] || '—')} · <span class="compare-k">Hạn</span> ${esc(options.assessments().get(r[7])?.record?.expiry || options.assessments().get(r[7])?.expiry || 'chưa rõ')}</small>` : '')+
      `</article>`;
    }).join('') || '<p class="compare-empty">Không có kết quả trong phạm vi này.</p>';
    pager('left',s.left.length,s.lp);
    el('context').textContent=s.focus ? 'Đối chiếu riêng: '+(s.focus.row[2] || s.focus.row[1]) : 'Đối chiếu toàn bộ '+s.left.length.toLocaleString('vi-VN')+' kết quả hiện tại';
    el('all').disabled=!s.focus && !s.reverse;
    if(s.reverse)el('context').textContent='Hoạt chất từ DAV: '+s.reverse.inn;
  }
  function paintRight(){
    const q=fold(el('right-query').value), rules=limits();
    const davUrl='https://dichvucong.dav.gov.vn/congbothuoc/index';
    s.right=s.hits.filter(hit=>matchFacets('right',formKey(hit.record.form),strengthKey(hit.record.strength)) && hit.matched.some(k=>allowed(k,rules)) && (!q || fold([hit.record.sdk,hit.record.product,hit.record.inn,hit.record.registrant,hit.record.strength].join(' ')).includes(q)));
    s.rp=Math.min(s.rp,Math.max(0,Math.ceil(s.right.length/pageSize)-1));
    el('right-count').textContent='· '+s.right.length.toLocaleString('vi-VN');
    el('right').innerHTML=s.right.slice(s.rp*pageSize,(s.rp+1)*pageSize).map((hit,j)=>{
      const r=hit.record, a=assessment(r);
      return `<article class="compare-row" data-compare-dav="${s.rp*pageSize+j}" tabindex="0" aria-pressed="${s.reverse===r}">`+
        sourceBtn(davUrl, r.product, 'DAV')+
        `<span class="compare-tag">${esc(hit.kind)} · ${esc(hit.matched.join(', '))}</span>`+
        `<strong>${esc(r.product || 'Chưa có tên thuốc')}</strong>`+
        `<span><span class="compare-k">Hoạt chất</span> ${esc(r.inn || 'Chưa có hoạt chất')}</span>`+
        `<small><span class="compare-k">Hàm lượng</span> ${esc(r.strength || 'Chưa có hàm lượng')} · <span class="compare-k">Dạng</span> ${esc(options.formLabel(r.form))}</small>`+
        `<small><span class="compare-k">Công ty đăng ký</span> ${companyHtml(r.registrant, true)}</small>`+
        `<small><span class="compare-k">SĐK</span> ${esc(r.sdk || '—')} · <span class="compare-k">Hạn</span> ${esc(a?.expiry || r.expiry || 'Chưa rõ')}</small>`+
        `<span class="compare-verdict ok">${esc(reason(r))}${a?.tagId ? ' · ' + esc((options.tagLabel && options.tagLabel(a.tagId)) || a.tagId) : ''}</span>`+
        `<button type="button" class="quiet-button compare-copy" data-copy-sdk="${esc(r.sdk)}">Sao chép SĐK</button>`+
      `</article>`;
    }).join('') || '<p class="compare-empty">Không có hồ sơ DAV đạt bộ lọc VN khớp thành phần trong phạm vi này. Thử đổi từ khóa hoặc chọn dòng khác bên trái.</p>';
    pager('right',s.right.length,s.rp);
  }
  async function refresh(){
    const gen=++generation;
    el('export').disabled=true;el('status').textContent='Đang đối chiếu… 0%';
    await pause();if(gen!==generation||!dialog.open)return;
    if(!await prepare(gen))return;
    const q=fold(el('left-query').value), left=[], wanted=new Set();
    const reverse=s.reverse?new Set(keys(s.reverse.inn)):null;
    if(!await chunks(s.entries,e=>{
      const m=meta(e);
      if((!q||e.search.includes(q))&&matchFacets('left',m.form,m.strength)){
        // Reverse selection narrows only the left pane; keep the DAV candidate list stable.
        if(!s.focus || s.focus===e)for(const k of m.keys)wanted.add(k);
        if(!reverse || m.keys.some(k=>reverse.has(k)))left.push(e);
      }
    },gen,'Đang lọc kết quả…'))return;
    const hits=[], forms=new Map(), strengths=new Map();
    if(!await chunks(eligible,r=>{
      const matched=keys(r.inn).filter(k=>wanted.has(k));if(!matched.length)return;
      hits.push({record:r,matched,kind:'Khớp thành phần'});
      if(r.form)forms.set(formKey(r.form),r.form);
      if(r.strength)strengths.set(strengthKey(r.strength),r.strength);
    },gen,'Đang ghép DAV…'))return;
    s.left=left;s.hits=hits;s.lp=0;s.rp=0;
    facets('right',forms,strengths);paintLeft();paintRight();
    el('status').textContent='Đã đối chiếu · 100%';el('export').disabled=false;
  }
  function filterLeft(){s.focus=null;refresh();}
  function focusRow(ix){s.focus=s.left[Number(ix)];s.reverse=null;refresh();}
  function focusDAV(ix){s.reverse=s.right[Number(ix)]?.record;s.focus=null;refresh();}
  el('left-query').addEventListener('input',()=>{clearTimeout(leftTimer);el('export').disabled=true;leftTimer=setTimeout(filterLeft,160);});
  el('right-query').addEventListener('input',()=>{clearTimeout(rightTimer);rightTimer=setTimeout(()=>{s.rp=0;paintRight();},160);});
  for(const side of ['left','right'])for(const field of ['form','strength'])el(side+'-'+field).addEventListener('change',()=>{if(side==='left')filterLeft();else{s.rp=0;paintRight();}});
  for(const type of ['sdk','form','strength']){
    el(type+'-choice').addEventListener('change',()=>{
      const custom=el(type+'-choice').value==='other';el(type+'-max').hidden=!custom;
      if(custom)el(type+'-max').focus();s.rp=0;paintRight();
    });
    for(const suffix of ['on','max'])el(type+'-'+suffix).addEventListener('input',()=>{s.rp=0;paintRight();});
  }
  el('all').addEventListener('click',()=>{s.focus=null;s.reverse=null;refresh();});
  el('close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    generation++;clearTimeout(leftTimer);clearTimeout(rightTimer);document.getElementById('compare-toggle').setAttribute('aria-pressed','false');
    s={entries:[],left:[],right:[],hits:[],focus:null,lp:0,rp:0};
    el('left').replaceChildren();el('right').replaceChildren();
  });
  dialog.addEventListener('keydown',ev=>{
    if(ev.target.closest('a,button,input,select,textarea'))return;
    const dav=ev.target.closest('[data-compare-dav]');
    if(dav && (ev.key==='Enter'||ev.key===' ')){ev.preventDefault();focusDAV(dav.dataset.compareDav);return;}
    const row=ev.target.closest('[data-compare-row]');
    if(row && (ev.key==='Enter' || ev.key===' ')){ev.preventDefault();focusRow(row.dataset.compareRow);}
  });
  dialog.addEventListener('click',async ev=>{
    const page=ev.target.closest('[data-compare-page]');
    if(page){const [side,dir]=page.dataset.comparePage.split(':');if(side==='left'){s.lp+=Number(dir);paintLeft();}else{s.rp+=Number(dir);paintRight();}el(side).scrollTop=0;return;}
    const dav=ev.target.closest('[data-compare-dav]');
    if(dav && !ev.target.closest('a,button')){focusDAV(dav.dataset.compareDav);return;}
    if(ev.target.closest('a, button, input, select, textarea, label')){
      const copy=ev.target.closest('[data-copy-sdk]');
      if(copy){try {await navigator.clipboard.writeText(copy.dataset.copySdk);el('status').textContent='Đã sao chép SĐK.';}catch(_){el('status').textContent='SĐK: '+copy.dataset.copySdk;}}
      const src=ev.target.closest('a.compare-source');
      if(src && src.dataset.copyProduct) el('status').textContent='Đã sao chép tên thuốc — dán vào ô tìm của nguồn.';
      return;
    }
    const row=ev.target.closest('[data-compare-row]');
    if(row){focusRow(row.dataset.compareRow);return;}

  });
  el('export').addEventListener('click',async()=>{
    if(exporting)return;
    paintRight();
    exporting=true;el('export').disabled=true;el('status').textContent='Đang tạo Excel…';
    // Snapshot scope before awaiting ZIP creation; changing pages cannot change the export.
    const left=scoped().slice(),right=s.right.slice();
    try {
      const output=await SraExcel.build([
        {name:'Kết quả chính',headers:['Quốc gia','Hoạt chất','Tên thuốc','Dạng bào chế','Hàm lượng','Công ty (VN: công ty đăng ký)','SĐK VN','Nguồn'],rows:left.map(e=>[countryName(e.cc),...e.row.slice(1,6),e.row[8] || '',options.sourceUrl(e.cc)])},
        {name:'DAV đối chiếu',headers:['ID DAV','SĐK','Tên thuốc','Hoạt chất','Hàm lượng','Dạng bào chế','Công ty đăng ký','Ngày hết hạn trong DAV','Hạn xét','Trạng thái bộ lọc VN','Hoạt chất khớp','Mức khớp','Nguồn'],rows:right.map(h=>{const r=h.record;return [r.id,r.sdk,r.product,r.inn,r.strength,r.form,r.registrant,r.expiry,assessment(r)?.expiry || '',reason(r),h.matched.join('; '),h.kind,'https://dichvucong.dav.gov.vn/congbothuoc/index'];})}
      ]);
      const url=URL.createObjectURL(new Blob([output],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=url;a.download='so-sanh-thuoc-DAV.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      el('status').textContent=`Đã xuất ${left.length.toLocaleString('vi-VN')} kết quả và ${right.length.toLocaleString('vi-VN')} hồ sơ DAV.`;
    } catch(error){el('status').textContent='Không xuất được Excel: '+error.message;}
    finally {exporting=false;el('export').disabled=false;}
  });
  return {async open(){
    dialog.querySelector('.compare-panes').inert=true;dialog.querySelector('.compare-actions').inert=true;
    dialog.showModal();el('status').textContent='Đang nạp kết quả… 0%';el('export').disabled=true;
    const gen=++generation;await pause();if(gen!==generation||!dialog.open)return;
    const entries=options.getResults(),forms=new Map(),strengths=new Map();
    if(!await chunks(entries,e=>{
      e.search=e.row._search || fold(e.row.slice(1,6).join(' '));const m=meta(e);
      if(e.row[3])forms.set(m.form,e.row[3]);if(e.row[4])strengths.set(m.strength,e.row[4]);
    },gen,'Đang chuẩn bị so sánh…'))return;
    s={entries,left:[],right:[],hits:[],focus:null,reverse:null,lp:0,rp:0};
    el('left-query').value='';el('right-query').value='';
    for(const side of ['left','right'])for(const type of ['form','strength'])el(side+'-'+type).value='';
    facets('left',forms,strengths);
    dialog.querySelector('.compare-panes').inert=false;dialog.querySelector('.compare-actions').inert=false;
    await refresh();
  }};
}
