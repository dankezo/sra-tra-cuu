/* Persistent SVG nodes and one animation frame loop for dragging and navigation. */
function SraCountryMap(svg, world, options) {
  const centers = {AT:[14,47.6],BE:[4.7,50.6],BG:[25.5,42.7],HR:[16.4,45.1],CY:[33.3,35],CZ:[15.4,49.8],DK:[10,56],EE:[25.5,58.7],FI:[26,64],FR:[2.5,46.5],DE:[10.4,51.1],GR:[23,39],HU:[19.5,47.2],IE:[-8,53.3],IT:[12.5,42.5],LV:[24.6,57],LT:[24,55.3],LU:[6.13,49.61],MT:[14.38,35.94],NL:[5.4,52.2],PL:[19,52],PT:[-8,39.5],RO:[25,46],SK:[19.5,48.7],SI:[14.8,46.1],ES:[-3.7,40.2],SE:[16,63],US:[-100,39],GB:[-3,55],JP:[138,37],CH:[8.2,46.8],CA:[-105,57],AU:[134,-25],NO:[10,63],IS:[-19,65],LI:[9.55,47.16]};
  const tiny = ['MT','LI','LU'];
  centers.VN = [106,16];
  const regionSelect = document.getElementById('map-region');
  let view = 'globe', rotation = [-12,-35,0], center = [12,51], scale = 440;
  let animation = 0, renderFrame = 0, drag = null, suppressClickUntil = 0;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const delta = (a,b) => ((b-a+540)%360)-180;
  const iso = f => f.properties.ISO_A2_EH || f.properties.ISO_A2;
  const root = d3.select(svg);
  const ocean = root.append('path').attr('fill','#e3eeeb').attr('stroke','#c6d9d2');
  const grid = root.append('path').attr('fill','none').attr('stroke','#d4e2dc').attr('stroke-width',.5).attr('pointer-events','none');
  const graticule = d3.geoGraticule10();
  const paths = root.append('g').selectAll('path').data(world.features).join('path');
  paths.append('title');
  const points = root.append('g').selectAll('circle').data(tiny).join('circle').attr('r',4);
  points.append('title');
  function stop() { cancelAnimationFrame(animation); animation = 0; }
  function render() {
    document.getElementById('map-wrap').hidden = view === 'list';
    if (view === 'list') return;
    const globe = view === 'globe';
    const projection = globe ? d3.geoOrthographic().rotate(rotation).scale(151).translate([200,165]).precision(.5)
      : d3.geoMercator().center(center).scale(scale).translate([200,165]).clipExtent([[0,0],[400,330]]).precision(.5);
    const path = d3.geoPath(projection);
    const eligible = new Set(options.eligible());
    const selected = options.selected();
    svg.dataset.centerLon = String(globe ? -rotation[0] : center[0]);
    svg.dataset.centerLat = String(globe ? -rotation[1] : center[1]);
    svg.dataset.view = view;
    svg.dataset.focusedCountry = selected;
    ocean.attr('d', globe ? path({type:'Sphere'}) : null);
    grid.attr('d', globe ? path(graticule) : null);
    paths.each(function(f) {
      const c = iso(f), selectable = eligible.has(c) && !tiny.includes(c);
      const node = d3.select(this), shape = path(f);
      node.attr('d',shape).attr('class',`land ${selectable ? 'eligible' : ''} ${selected === c ? 'active' : ''}`)
        .attr('data-country',selectable ? c : null).attr('role',selectable ? 'button' : null)
        .attr('tabindex',selectable && shape ? 0 : null).attr('aria-label',selectable ? options.label(c) : null)
        .attr('aria-pressed',selectable ? String(selected === c) : null);
      node.select('title').text(eligible.has(c) ? options.label(c) : f.properties.NAME);
    });
    points.each(function(c) {
      const p = centers[c], xy = projection(p);
      const visible = eligible.has(c) && xy && xy[0]>=0 && xy[0]<=400 && xy[1]>=0 && xy[1]<=330 && (!globe || d3.geoDistance(p,[-rotation[0],-rotation[1]])<Math.PI/2);
      d3.select(this).attr('cx',xy[0]).attr('cy',xy[1]).attr('display',visible ? null : 'none')
        .attr('class',`land eligible ${selected === c ? 'active' : ''}`).attr('data-country',c)
        .attr('role','button').attr('tabindex',visible ? 0 : -1).attr('aria-label',options.label(c)).attr('aria-pressed',String(selected === c))
        .select('title').text(options.label(c));
    });
    document.getElementById('map-left').hidden = !globe;
    document.getElementById('map-right').hidden = !globe;
    document.getElementById('map-caption').textContent = selected ? options.label(selected) + ' · Đang xem kết quả' : 'Kéo để xoay · Bấm một nước để xem thuốc.';
  }
  function queueRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
  }
  function move(targetRotation, targetCenter = center, targetScale = scale, immediate = false) {
    stop();
    const fromR = rotation.slice(), fromC = center.slice(), fromS = scale, start = performance.now();
    const duration = immediate || reduced() || view === 'list' ? 0 : 650;
    function frame(now) {
      const t = duration ? Math.min(1,(now-start)/duration) : 1;
      const eased = d3.easeCubicInOut(t);
      rotation = [fromR[0]+delta(fromR[0],targetRotation[0])*eased,fromR[1]+(targetRotation[1]-fromR[1])*eased,0];
      center = [fromC[0]+(targetCenter[0]-fromC[0])*eased,fromC[1]+(targetCenter[1]-fromC[1])*eased];
      scale = fromS+(targetScale-fromS)*eased;
      render();
      if (t<1) animation = requestAnimationFrame(frame); else animation = 0;
    }
    if (!duration) frame(start); else animation = requestAnimationFrame(frame);
  }
  function focus(cc, immediate = false) {
    if (!centers[cc]) { render(); return; }
    const p = centers[cc];
    regionSelect.value = ['CA','US'].includes(cc) ? 'america' : ['JP','AU','VN'].includes(cc) ? 'asia' : 'europe';
    move([-p[0],-p[1],0],p,['CA','US'].includes(cc) ? 145 : cc==='AU' ? 210 : cc==='JP' ? 480 : 670,immediate);
  }
  svg.addEventListener('pointerdown', ev => {
    if (ev.button!==0 || !ev.isPrimary || view==='list') return;
    stop();
    const rect = svg.getBoundingClientRect();
    drag = {id:ev.pointerId,x:ev.clientX,y:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,time:performance.now(),vx:0,vy:0,moved:false,ratio:400/rect.width};
  });
  svg.addEventListener('pointermove', ev => {
    if (!drag || drag.id!==ev.pointerId) return;
    if (!drag.moved && Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<5) return;
    if (!drag.moved) { drag.moved = true; svg.setPointerCapture(ev.pointerId); svg.classList.add('dragging'); }
    const now = performance.now(), elapsed = Math.max(8,now-drag.time);
    const dx = (ev.clientX-drag.lastX)*drag.ratio, dy = (ev.clientY-drag.lastY)*drag.ratio;
    if (view==='globe') {
      rotation[0] += dx*.4; rotation[1] = clamp(rotation[1]-dy*.4,-85,85);
      drag.vx = clamp(dx*.4/elapsed,-.35,.35); drag.vy = clamp(-dy*.4/elapsed,-.25,.25);
    } else {
      center[0] -= dx/scale*180/Math.PI; center[1] = clamp(center[1]+dy/scale*180/Math.PI,-80,80);
    }
    drag.lastX = ev.clientX; drag.lastY = ev.clientY; drag.time = now;
    queueRender();
  });
  function endDrag(ev) {
    if (!drag || drag.id!==ev.pointerId) return;
    const ended = drag; drag = null; svg.classList.remove('dragging');
    if (svg.hasPointerCapture(ev.pointerId)) svg.releasePointerCapture(ev.pointerId);
    if (!ended.moved) return;
    suppressClickUntil = performance.now()+350;
    if (ev.type==='pointercancel' || reduced() || view!=='globe' || performance.now()-ended.time>80) return;
    let previous = performance.now(), vx = ended.vx, vy = ended.vy;
    function coast(now) {
      const elapsed = Math.min(32,now-previous); previous = now;
      const decay = Math.exp(-elapsed/110); vx*=decay; vy*=decay;
      rotation[0] += vx*elapsed; rotation[1] = clamp(rotation[1]+vy*elapsed,-85,85);
      render();
      if (Math.abs(vx)+Math.abs(vy)>.003) animation=requestAnimationFrame(coast); else animation=0;
    }
    animation=requestAnimationFrame(coast);
  }
  svg.addEventListener('pointerup',endDrag);
  svg.addEventListener('pointercancel',endDrag);
  svg.addEventListener('lostpointercapture',ev => { if (drag && drag.id===ev.pointerId) { drag=null; svg.classList.remove('dragging'); } });
  svg.addEventListener('click',ev => { if (performance.now()<suppressClickUntil) return; const el=ev.target.closest('[data-country]'); if (el) options.onSelect(el.dataset.country); });
  svg.addEventListener('keydown',ev => { if (ev.key==='Enter'||ev.key===' ') { const el=ev.target.closest('[data-country]'); if(el) {ev.preventDefault();options.onSelect(el.dataset.country);} } });
  regionSelect.addEventListener('change',ev => {
    const presets={europe:[[-12,-35,0],[12,51],440],america:[[105,-35,0],[-105,48],190],asia:[[-130,-5,0],[130,5],180],world:[[0,-15,0],[0,0],60]};
    move(...presets[ev.target.value]);
  });
  document.getElementById('map-left').addEventListener('click',()=>move([rotation[0]+35,rotation[1],0]));
  document.getElementById('map-right').addEventListener('click',()=>move([rotation[0]-35,rotation[1],0]));
  return {render,focus,setView(next) { stop(); view=next; if(options.selected()) focus(options.selected(),true); else render(); }};
}
