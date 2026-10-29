// Canvas PCB (SVG) — trilhas, pads, contorno; interação mínima.
import { createViewport, toWorld, zoomAt, pan, snapPoint } from '../core/model.js';
import { FOOTPRINTS } from '../core/pcb-library.js';
import { addTrack, footprintBBox, runPcbDrc, syncPcbFromSchematic, computeRatsnest, addVia, addRouteTrack, addPour, addOutlinePour, padWorld } from '../core/pcb-model.js';
import { pourKeepoutBoxes } from '../core/pcb-copper.js';
import { createPcbWebGl } from './pcb-webgl.js';
import type { Project } from '../core/types.js';
import type { PcbBoard } from '../core/pcb-types.js';

const NS = 'http://www.w3.org/2000/svg';

export function createPcbView(svgEl, opts) {
  const { getProject, onChange, onMessage, webglCanvas } = opts;
  let vp = createViewport();
  let glRenderer = webglCanvas ? createPcbWebGl(webglCanvas) : null;
  let useWebGl = !!glRenderer;
  let selection = new Set();
  let drag = null;
  let panning = null;
  let trackPts = null;
  let trackMode = false;
  let viaMode = false;
  let showRats = true;
  let activeLayer: 'top' | 'bottom' = 'top';
  let routeMode = false;
  let routeStart = null;
  let routeNet = '';
  let rotDrag = null;
  let pourMode = false;
  let pourPts = null;
  let drcMarkers: { x: number; y: number; message: string }[] = [];

  const el = (n, a = {}, p) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  };
  const pts = (P) => P.map((p) => `${p.x},${p.y}`).join(' ');

  function board(): PcbBoard | null {
    return getProject().pcb ?? null;
  }

  function render() {
    const project = getProject();
    const b = project.pcb;
    svgEl.textContent = '';
    if (!b) {
      el('text', { x: '20', y: '40', fill: '#64748b' }, svgEl).textContent = 'Clique em "Atualizar do esquemático" para gerar a PCB.';
      return;
    }
    const r = svgEl.getBoundingClientRect();
    const g = el('g', { transform: `scale(${vp.scale}) translate(${-vp.x} ${-vp.y})` }, svgEl);
    el('polyline', { class: 'pcb-outline', points: pts(b.outline), fill: 'none' }, g);
    for (const pour of b.pours ?? []) {
      if (pour.layer !== activeLayer && activeLayer === 'bottom' && pour.layer === 'top') { /* ainda visível em modo bottom */ }
      el('polygon', {
        class: 'pcb-pour',
        points: pts(pour.points),
        'data-net': pour.net,
      }, g);
      for (const box of pourKeepoutBoxes(b, pour)) {
        el('rect', {
          class: 'pcb-pour-cut',
          x: String(box.x),
          y: String(box.y),
          width: String(box.w),
          height: String(box.h),
        }, g);
      }
    }
    for (const t of b.tracks) {
      if (t.layer === 'bottom' && activeLayer === 'top') continue;
      el('polyline', {
        class: 'pcb-track' + (t.layer === 'bottom' ? ' bottom' : ''),
        points: pts(t.points),
        'stroke-width': String(t.width),
      }, g);
    }
    if (showRats) {
      for (const rn of computeRatsnest(b)) {
        el('line', {
          class: 'pcb-rats',
          x1: String(rn.x1), y1: String(rn.y1), x2: String(rn.x2), y2: String(rn.y2),
        }, g);
      }
    }
    for (const v of b.vias ?? []) {
      el('circle', { class: 'pcb-via', cx: String(v.x), cy: String(v.y), r: String(v.diameter / 2) }, g);
    }
    for (const fp of b.footprints) {
      const def = FOOTPRINTS[fp.kind];
      const fg = el('g', {
        class: 'pcb-fp' + (selection.has(fp.id) ? ' sel' : ''),
        transform: `translate(${fp.x} ${fp.y}) rotate(${fp.rot})`,
      }, g);
      el('rect', {
        x: String(-def.w / 2), y: String(-def.h / 2), width: String(def.w), height: String(def.h),
        class: 'pcb-body',
      }, fg);
      for (const p of def.pads) {
        const net = fp.padNets[p.num] ?? '';
        el('rect', {
          class: 'pcb-pad' + (net ? ' net' : ''),
          x: String(p.x - p.w / 2), y: String(p.y - p.h / 2), width: String(p.w), height: String(p.h),
          'data-net': net,
        }, fg);
      }
      el('text', { class: 'pcb-ref', x: String(-def.w / 2), y: String(-def.h / 2 - 4) }, fg).textContent = fp.ref;
    }
    if (trackPts?.length) el('polyline', { class: 'pcb-track preview', points: pts(trackPts), 'stroke-dasharray': '4 3' }, g);
    if (pourPts?.length) el('polyline', { class: 'pcb-pour preview', points: pts(pourPts), 'stroke-dasharray': '4 3' }, g);
    for (const m of drcMarkers) {
      el('circle', {
        class: 'pcb-drc-mark',
        cx: String(m.x),
        cy: String(m.y),
        r: '5',
      }, g);
    }
    const st = document.getElementById('pcbStatus');
    if (st) st.textContent = `${b.footprints.length} fp · ${b.tracks.length} trilhas · ${(b.vias ?? []).length} vias · ${(b.pours ?? []).length} pours · ${useWebGl ? (glRenderer?.isView3d?.() ? 'WebGL 3D' : 'WebGL') : 'SVG'} · zoom ${vp.scale.toFixed(2)}`;
    if (useWebGl && glRenderer && webglCanvas) {
      svgEl.style.display = 'none';
      webglCanvas.style.display = 'block';
      const r = webglCanvas.getBoundingClientRect();
      glRenderer.render(b, vp, r.width || 800, r.height || 600);
    } else {
      svgEl.style.display = 'block';
      if (webglCanvas) webglCanvas.style.display = 'none';
    }
  }

  function ptr(e) {
    const el = (useWebGl && webglCanvas) ? webglCanvas : svgEl;
    const rect = el.getBoundingClientRect();
    return toWorld(vp, e.clientX - rect.left, e.clientY - rect.top);
  }

  function finishPourLocal(net = 'GND') {
    const b = board();
    if (!b || !pourPts || pourPts.length < 3) { pourMode = false; pourPts = null; render(); return; }
    addPour(b, pourPts, net, activeLayer);
    pourMode = false; pourPts = null; onChange(); onMessage?.(`Pour ${net} adicionado.`); render();
  }

  function hitPadNet(pt) {
    const b = board();
    if (!b) return '';
    for (const fp of b.footprints) {
      for (const p of FOOTPRINTS[fp.kind].pads) {
        const w = padWorld(fp, p.num);
        if (!w) continue;
        if (Math.abs(pt.x - w.x) <= p.w / 2 + 2 && Math.abs(pt.y - w.y) <= p.h / 2 + 2) {
          return fp.padNets[p.num] ?? '';
        }
      }
    }
    return '';
  }

  function hitFp(pt) {
    const b = board();
    if (!b) return null;
    for (let i = b.footprints.length - 1; i >= 0; i--) {
      const fp = b.footprints[i];
      const box = footprintBBox(fp);
      if (pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h) return fp.id;
    }
    return null;
  }

  svgEl.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) { panning = { x: e.clientX, y: e.clientY }; return; }
    const p = snapPoint(ptr(e), { alt: e.altKey });
    if (viaMode) {
      const b = board();
      if (b) { addVia(b, p.x, p.y); onChange(); onMessage?.('Via adicionada.'); render(); }
      return;
    }
    if (routeMode) {
      if (!routeStart) {
        routeStart = p;
        routeNet = hitPadNet(p);
        onMessage?.(`Walkaround: destino${routeNet ? ` (rede ${routeNet})` : ''}.`);
        render();
        return;
      }
      const b = board();
      if (b) {
        const net = routeNet || hitPadNet(p) || hitPadNet(routeStart) || '';
        addRouteTrack(b, routeStart, p, net, activeLayer, 2);
        onChange();
        onMessage?.(`Rota walkaround${net ? ` (${net})` : ''}.`);
      }
      routeStart = null;
      routeNet = '';
      routeMode = false;
      render();
      return;
    }
    if (pourMode) {
      if (!pourPts) pourPts = [];
      pourPts.push(p);
      render();
      return;
    }
    if (trackMode) {
      if (!trackPts) trackPts = [];
      trackPts.push(p);
      render();
      return;
    }
    const id = hitFp(p);
    if (id) {
      selection = new Set([id]);
      drag = { id, start: p, last: p };
    } else selection.clear();
    render();
  });

  svgEl.addEventListener('mousemove', (e) => {
    if (panning) {
      vp = pan(vp, e.clientX - panning.x, e.clientY - panning.y);
      panning = { x: e.clientX, y: e.clientY };
      render();
      return;
    }
    if (drag) {
      drag.last = snapPoint(ptr(e), { alt: e.altKey });
      render();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (panning) { panning = null; return; }
    if (drag) {
      const b = board();
      const fp = b?.footprints.find((f) => f.id === drag.id);
      if (fp) {
        fp.x += drag.last.x - drag.start.x;
        fp.y += drag.last.y - drag.start.y;
        onChange();
        onMessage?.(`Movido ${fp.ref}.`);
      }
      drag = null;
      render();
    }
  });

  svgEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    vp = zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    render();
  }, { passive: false });

  function onGlDown(e: MouseEvent) {
    if (!useWebGl || !glRenderer?.isView3d() || e.button !== 0) return;
    if (trackMode || routeMode || pourMode || viaMode || drag) return;
    rotDrag = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
  function onGlMove(e: MouseEvent) {
    if (!rotDrag || !glRenderer) return;
    glRenderer.addRotation((e.clientX - rotDrag.x) * 0.012, (e.clientY - rotDrag.y) * 0.012);
    rotDrag = { x: e.clientX, y: e.clientY };
    render();
  }
  function onGlUp() { rotDrag = null; }
  if (webglCanvas) {
    webglCanvas.addEventListener('mousedown', onGlDown);
    webglCanvas.addEventListener('wheel', (e) => {
      if (!useWebGl) return;
      e.preventDefault();
      const rect = webglCanvas.getBoundingClientRect();
      vp = zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      render();
    }, { passive: false });
    window.addEventListener('mousemove', onGlMove);
    window.addEventListener('mouseup', onGlUp);
  }

  return {
    render,
    syncFromSch() {
      const r = syncPcbFromSchematic(getProject());
      onChange();
      onMessage?.(`PCB: +${r.added} novos, ${r.updated} atualizados${r.skipped.length ? `; ignorados: ${r.skipped.slice(0, 2).join(', ')}` : ''}.`);
      render();
    },
    runDrc() {
      const b = board();
      if (!b) {
        drcMarkers = [];
        render();
        return [];
      }
      const issues = runPcbDrc(b);
      drcMarkers = issues
        .filter((i) => i.x != null && i.y != null)
        .map((i) => ({ x: i.x!, y: i.y!, message: i.message }));
      render();
      return issues;
    },
    clearDrc() {
      drcMarkers = [];
      render();
    },
    startTrack() {
      trackMode = true;
      trackPts = null;
      onMessage?.('Modo trilha (top): cliques no canvas; Enter termina; Esc cancela.');
    },
    finishTrack() {
      if (pourMode) { finishPourLocal('GND'); return; }
      const b = board();
      if (!b || !trackPts || trackPts.length < 2) { trackMode = false; trackPts = null; render(); return; }
      addTrack(b, trackPts, '', activeLayer, 2);
      trackMode = false;
      trackPts = null;
      onChange();
      onMessage?.('Trilha adicionada.');
      render();
    },
    cancelTrack() {
      trackMode = false; viaMode = false; routeMode = false; pourMode = false;
      trackPts = null; routeStart = null; routeNet = ''; pourPts = null; render();
    },
    isTrackMode: () => trackMode,
    startRoute() {
      routeMode = true; routeStart = null; trackMode = false; viaMode = false; pourMode = false;
      onMessage?.('Walkaround (L): origem e destino.');
    },
    startPour() {
      pourMode = true; pourPts = null; trackMode = false; routeMode = false;
      onMessage?.('Copper pour: cliques no polígono; Enter fecha; Esc cancela.');
    },
    finishPour(net = 'GND') { finishPourLocal(net); },
    pourOutline(net = 'GND') {
      const b = board();
      if (!b) return;
      addOutlinePour(b, net, 8, activeLayer);
      onChange(); onMessage?.(`Pour ${net} no contorno.`); render();
    },
    toggleWebGl() {
      if (!glRenderer) { onMessage?.('WebGL2 indisponível neste navegador.'); return; }
      useWebGl = !useWebGl; render();
    },
    toggleView3d() {
      if (!glRenderer) { onMessage?.('WebGL2 indisponível neste navegador.'); return; }
      useWebGl = true;
      glRenderer.setView3d(!glRenderer.isView3d());
      if (glRenderer.isView3d()) glRenderer.resetRotation();
      onMessage?.(glRenderer.isView3d() ? 'Vista 3D — arraste para rodar.' : 'Vista 2D (WebGL).');
      render();
    },
    getViewport: () => vp,
    startVia() { viaMode = true; trackMode = false; trackPts = null; onMessage?.('Clique para colocar via; Esc cancela.'); },
    toggleRats() { showRats = !showRats; render(); },
    setLayer(layer: 'top' | 'bottom') { activeLayer = layer; render(); },
    getLayer: () => activeLayer,
    fit() { vp = createViewport(); render(); },
  };
}
