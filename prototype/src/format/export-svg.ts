import type { Sheet } from '../core/types.js';
import { SYMBOLS, defFor } from '../core/library.js';
import { junctions } from '../core/connectivity.js';

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const pts = (P: { x: number; y: number }[]) => P.map((p) => `${p.x},${p.y}`).join(' ');

/** SVG como string (sem DOM — testável em Node). */
export function exportSheetSvg(sheet: Sheet): string {
  const pad = 40;
  let minX = 0, minY = 0, maxX = 400, maxY = 300;
  for (const s of sheet.symbols) {
    minX = Math.min(minX, s.x - 40); maxX = Math.max(maxX, s.x + 40);
    minY = Math.min(minY, s.y - 40); maxY = Math.max(maxY, s.y + 40);
  }
  for (const w of sheet.wires) for (const p of w.points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const ox = minX - pad, oy = minY - pad;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  parts.push(`<g transform="translate(${-ox} ${-oy})">`);

  for (const wire of sheet.wires) {
    const stroke = wire.kind === 'bus' ? '#1d4ed8' : '#15803d';
    const sw = wire.kind === 'bus' ? 3 : 1.5;
    parts.push(`<polyline fill="none" stroke="${stroke}" stroke-width="${sw}" points="${esc(pts(wire.points))}"/>`);
  }
  for (const j of junctions(sheet)) parts.push(`<circle cx="${j.x}" cy="${j.y}" r="3" fill="#15803d"/>`);
  for (const s of sheet.symbols) {
    if (s.kind === 'annotate') {
      parts.push(`<text x="${s.x}" y="${s.y}" font-size="11" fill="#1e293b">${esc(String(s.value ?? s.ref))}</text>`);
      continue;
    }
    const def = defFor(s);
    const mx = s.mirror ? -1 : 1;
    parts.push(`<g transform="translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${mx} 1)">`);
    for (const d of def.paths) parts.push(`<path d="${esc(d)}" fill="none" stroke="#7f1d1d" stroke-width="1.5"/>`);
    for (const p of def.pins) parts.push(`<circle cx="${p.x}" cy="${p.y}" r="2" fill="#dc2626"/>`);
    parts.push('</g>');
    const label = def.role ? esc(String(s.net ?? '')) : esc(s.ref);
    parts.push(`<text x="${s.x + (def.role === 'label' ? 2 : -10)}" y="${s.y - (def.role === 'label' ? 3 : 14)}" font-size="9" fill="${def.role ? '#047857' : '#1e293b'}">${label}</text>`);
  }
  parts.push('</g></svg>');
  return parts.join('');
}

export { exportSheetSvg as renderSheetSvg };
