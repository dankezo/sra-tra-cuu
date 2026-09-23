/* Snapshot of current results and an indexed component join against DAV. */
function SraCompare(options) {
  const {dialog,records,fold,countryName}=options;
  const el=id=>document.getElementById('compare-'+id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pageSize=40;
  let index=null, timer=0, s={entries:[],left:[],right:[],focus:null,lp:0,rp:0}, exporting=false;
  const assessment=r=>options.assessments().get(r.id);
  const reason=r=>options.reasons[assessment(r)?.reason] || 'chưa đủ dữ liệu';
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
      const r=entry.row;
      return `<button type="button" class="compare-row" data-compare-row="${s.lp*pageSize+j}" aria-pressed="${s.focus===entry}"><span class="compare-tag">${esc(countryName(entry.cc))}</span><strong>${esc(r[2] || 'Chưa có tên thuốc')}</strong><span>${esc(r[1] || 'Chưa có hoạt chất')}</span><small>${esc(r[4] || 'Chưa có hàm lượng')} · ${esc(r[3] || 'Chưa có dạng')}</small><small>${entry.cc==='VN'?'Công ty đăng ký: ':''}${esc(r[5] || 'Chưa có công ty')}</small></button>`;
    }).join('') || '<p class="compare-empty">Không có kết quả trong phạm vi này.</p>';
    pager('left',s.left.length,s.lp);
    el('context').textContent=s.focus ? 'Đối chiếu riêng: '+(s.focus.row[2] || s.focus.row[1]) : 'Đối chiếu toàn bộ '+s.left.length.toLocaleString('vi-VN')+' kết quả hiện tại';
    el('all').disabled=!s.focus;
  }
  function paintRight(){
    const q=fold(el('right-query').value);
    s.right=s.hits.filter(hit=>(!el('eligible').checked || assessment(hit.record)?.reason==='eligible') && (!q || fold([hit.record.sdk,hit.record.product,hit.record.inn,hit.record.registrant,hit.record.strength].join(' ')).includes(q)));
    s.rp=Math.min(s.rp,Math.max(0,Math.ceil(s.right.length/pageSize)-1));
    el('right-count').textContent='· '+s.right.length.toLocaleString('vi-VN');
    el('right').innerHTML=s.right.slice(s.rp*pageSize,(s.rp+1)*pageSize).map(hit=>{
      const r=hit.record, a=assessment(r);
      return `<article class="compare-row"><span class="compare-tag">${esc(hit.kind)} · ${esc(hit.matched.join(', '))}</span><strong>${esc(r.product || 'Chưa có tên thuốc')}</strong><span>${esc(r.inn)}</span><small>${esc(r.strength || 'Chưa có hàm lượng')} · ${esc(r.form || 'Chưa có dạng')}</small><small>Công ty đăng ký: ${esc(r.registrant || 'Chưa có dữ liệu')}</small><small>SĐK: ${esc(r.sdk)} · Hạn: ${esc(a?.expiry || r.expiry || 'Chưa rõ')}</small><span class="compare-verdict ${a?.reason==='eligible'?'ok':''}">${esc(reason(r))}</span><button type="button" class="quiet-button compare-copy" data-copy-sdk="${esc(r.sdk)}">Sao chép SĐK</button></article>`;
    }).join('') || '<p class="compare-empty">Không có hồ sơ DAV khớp thành phần trong phạm vi này. Thử bỏ lọc DAV đạt điều kiện hoặc đổi từ khóa.</p>';
    pager('right',s.right.length,s.rp);
  }
  function relate(){
    if(!index)index=SraVn.relatedIndex(records);
    const texts=[...new Set(scoped().flatMap(e=>[e.row[1],...Object.values(e.row._inns || {})]))];
    s.hits=index.find(texts).sort((a,b)=>Number(b.exact)-Number(a.exact) || a.record.product.localeCompare(b.record.product,'vi') || a.record.id.localeCompare(b.record.id));
    s.rp=0;paintLeft();paintRight();
  }
  function filterLeft(){
    const q=fold(el('left-query').value);
    s.left=s.entries.filter(e=>!q || e.search.includes(q));s.lp=0;s.focus=null;relate();
  }
  el('left-query').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(filterLeft,160);});
  el('right-query').addEventListener('input',()=>{s.rp=0;paintRight();});
  el('eligible').addEventListener('change',()=>{s.rp=0;paintRight();});
  el('all').addEventListener('click',()=>{s.focus=null;relate();});
  el('close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    clearTimeout(timer);document.getElementById('compare-toggle').setAttribute('aria-pressed','false');
    s={entries:[],left:[],right:[],hits:[],focus:null,lp:0,rp:0};
    el('left').replaceChildren();el('right').replaceChildren();
  });
  dialog.addEventListener('click',async ev=>{
    const row=ev.target.closest('[data-compare-row]');
    if(row){s.focus=s.left[Number(row.dataset.compareRow)];relate();return;}
    const page=ev.target.closest('[data-compare-page]');
    if(page){const [side,direction]=page.dataset.comparePage.split(':');if(side==='left'){s.lp+=Number(direction);paintLeft();el('left').scrollTop=0;}else{s.rp+=Number(direction);paintRight();el('right').scrollTop=0;}return;}
    const copy=ev.target.closest('[data-copy-sdk]');
    if(copy){try {await navigator.clipboard.writeText(copy.dataset.copySdk);el('status').textContent='Đã sao chép SĐK.';}catch(_){el('status').textContent='SĐK: '+copy.dataset.copySdk;}}
  });
  el('export').addEventListener('click',async()=>{
    if(exporting)return;
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
  return {open(){
    const entries=options.getResults();
    for(const e of entries)e.search=e.row._search || fold(e.row.slice(1,6).join(' '));
    s={entries,left:[],right:[],hits:[],focus:null,lp:0,rp:0};
    el('left-query').value='';el('right-query').value='';el('eligible').checked=options.vnEnabled();el('status').textContent='';
    dialog.showModal();filterLeft();
  }};
}
