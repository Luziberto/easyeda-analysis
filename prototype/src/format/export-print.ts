import type { Project } from '../core/types.js';
import { exportSheetSvg } from './export-svg.js';

/** HTML imprimível com todas as folhas (Salvar como PDF no navegador). */
export function exportPrintHtml(project: Project): string {
  const parts = [`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proto EDA</title>`,
    `<style>body{font-family:sans-serif;margin:16px}h2{page-break-before:always}h2:first-of-type{page-break-before:auto}.sheet{margin:12px 0}</style></head><body>`,
    `<h1>Projeto Proto EDA</h1><p>${project.sheets.length} folha(s)</p>`];
  for (const sheet of project.sheets) {
    parts.push(`<h2>${escapeHtml(sheet.name)}</h2><div class="sheet">${exportSheetSvg(sheet)}</div>`);
  }
  parts.push('</body></html>');
  return parts.join('');
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function openPrintPreview(project: Project) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(exportPrintHtml(project));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
