// @ts-nocheck — painel biblioteca LCSC (JSON estático do sync).
/** @typedef {{ id: number; name: string; path: string; leaf?: boolean; children?: CatalogNode[] }} CatalogNode */
/** @typedef {{ uuid: string; title: string; lcsc: string | null; package: string | null; catalogId: number | null; catalogPath: string | null; category: string | null; thumb: string | null }} LibComponent */

/**
 * @param {{ dataUrl?: string; onMessage?: (m: string) => void }} opts
 */
export function initLcscLibrary(opts = {}) {
  const dataUrl = opts.dataUrl ?? './lcsc-library.json';
  const onMessage = opts.onMessage ?? (() => {});

  const root = document.getElementById('lcscLibrary');
  const treeHost = document.getElementById('lcscTree');
  const listHost = document.getElementById('lcscList');
  const detailHost = document.getElementById('lcscDetail');
  const breadcrumb = document.getElementById('lcscBreadcrumb');
  const searchInput = document.getElementById('lcscSearch');
  const metaEl = document.getElementById('lcscMeta');

  if (!root || !treeHost || !listHost) return;

  /** @type {null | { catalogTree: CatalogNode[]; components: LibComponent[]; meta: Record<string, unknown> }} */
  let data = null;
  /** @type {number | null} */
  let filterCatalogId = null;
  /** @type {Set<number>} */
  let descendantIds = new Set();
  /** @type {LibComponent | null} */
  let selected = null;
  const expanded = new Set();

  /** @type {Map<number, Set<number>>} */
  const descendantsById = new Map();

  function buildDescendantMap(nodes) {
    const walk = (node) => {
      const ids = new Set([node.id]);
      for (const ch of node.children ?? []) {
        for (const id of walk(ch)) ids.add(id);
      }
      descendantsById.set(node.id, ids);
      return ids;
    };
    for (const n of nodes) walk(n);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, q) {
    const t = String(text ?? '');
    if (!q) return escapeHtml(t);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(t).replace(re, '<mark>$1</mark>');
  }

  function filteredComponents() {
    if (!data) return [];
    const q = (searchInput?.value ?? '').trim().toLowerCase();
    return data.components.filter((c) => {
      if (filterCatalogId != null) {
        if (c.catalogId == null || !descendantIds.has(c.catalogId)) return false;
      }
      if (!q) return true;
      return (
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.lcsc && c.lcsc.toLowerCase().includes(q)) ||
        (c.catalogPath && c.catalogPath.toLowerCase().includes(q)) ||
        (c.package && c.package.toLowerCase().includes(q))
      );
    });
  }

  function renderTreeNodes(nodes, depth = 0) {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      const hasChildren = (node.children?.length ?? 0) > 0;
      const open = expanded.has(node.id) || depth === 0;
      const row = document.createElement('div');
      row.className = 'lcsc-tree-row' + (filterCatalogId === node.id ? ' active' : '');
      row.style.paddingLeft = `${8 + depth * 12}px`;
      if (hasChildren) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'lcsc-tree-toggle';
        toggle.textContent = open ? '▾' : '▸';
        toggle.onclick = (ev) => {
          ev.stopPropagation();
          if (expanded.has(node.id)) expanded.delete(node.id);
          else expanded.add(node.id);
          renderTree();
        };
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'lcsc-tree-toggle spacer';
        spacer.textContent = '·';
        row.appendChild(spacer);
      }
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'lcsc-tree-label';
      label.textContent = node.name;
      label.title = node.path;
      label.onclick = () => {
        filterCatalogId = node.id;
        descendantIds = descendantsById.get(node.id) ?? new Set([node.id]);
        selected = null;
        renderAll();
      };
      row.appendChild(label);
      frag.appendChild(row);
      if (hasChildren && open) {
        frag.appendChild(renderTreeNodes(node.children, depth + 1));
      }
    }
    return frag;
  }

  function renderTree() {
    if (!data) return;
    treeHost.replaceChildren();
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'lcsc-tree-all' + (filterCatalogId == null ? ' active' : '');
    allBtn.textContent = 'Todos';
    allBtn.onclick = () => {
      filterCatalogId = null;
      descendantIds = new Set();
      selected = null;
      renderAll();
    };
    treeHost.appendChild(allBtn);
    treeHost.appendChild(renderTreeNodes(data.catalogTree));
  }

  function renderList() {
    const q = (searchInput?.value ?? '').trim();
    const rows = filteredComponents().slice(0, 500);
    if (!rows.length) {
      listHost.innerHTML = '<p class="muted lcsc-empty">Nenhum componente neste filtro.</p>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'lcsc-table';
    table.innerHTML = '<thead><tr><th>Title (PartNO)</th><th>Footprint</th></tr></thead>';
    const tb = document.createElement('tbody');
    for (const c of rows) {
      const tr = document.createElement('tr');
      if (selected?.uuid === c.uuid) tr.classList.add('sel');
      tr.innerHTML = `<td>${highlight(c.title, q)}</td><td class="muted">${highlight(c.package || '—', q)}</td>`;
      tr.onclick = () => {
        selected = c;
        renderList();
        renderDetail();
      };
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    listHost.replaceChildren(table);
    if (filteredComponents().length > 500) {
      const note = document.createElement('p');
      note.className = 'muted lcsc-cap';
      note.textContent = `Mostrando 500 de ${filteredComponents().length} — refine a busca ou categoria.`;
      listHost.appendChild(note);
    }
  }

  function renderDetail() {
    if (!detailHost) return;
    if (!selected) {
      detailHost.innerHTML = '<p class="muted">Selecione um componente.</p>';
      if (breadcrumb) breadcrumb.textContent = filterCatalogId ? 'Filtro por categoria ativo' : 'Proto EDA › Biblioteca LCSC';
      return;
    }
    const c = selected;
    const img = c.thumb
      ? `<img class="lcsc-thumb" src="${escapeHtml(c.thumb)}" alt="" loading="lazy">`
      : '<div class="lcsc-thumb placeholder">Sem preview</div>';
    detailHost.innerHTML = `
      ${img}
      <div class="field"><label>Title</label><input readonly value="${escapeHtml(c.title)}"></div>
      <div class="field"><label>LCSC#</label><input readonly id="lcscPartField" value="${escapeHtml(c.lcsc || '')}"></div>
      <div class="field"><label>Package</label><input readonly value="${escapeHtml(c.package || '')}"></div>
      <div class="field"><label>Categoria LCSC</label><input readonly value="${escapeHtml(c.category || '')}"></div>
      <button type="button" class="primary" id="lcscCopy">Copiar LCSC#</button>
    `;
    document.getElementById('lcscCopy')?.addEventListener('click', () => {
      const v = c.lcsc || '';
      if (!v) {
        onMessage('Sem número LCSC.');
        return;
      }
      navigator.clipboard?.writeText(v).then(
        () => onMessage(`LCSC ${v} copiado.`),
        () => onMessage(v),
      );
    });
    if (breadcrumb) {
      breadcrumb.textContent = [
        'Proto EDA',
        'Biblioteca LCSC',
        c.catalogPath || c.category || 'Sem classificação',
        c.lcsc || c.title,
      ].join(' › ');
    }
  }

  function renderMeta() {
    if (!metaEl || !data) return;
    metaEl.textContent = `${data.meta.component_count} peças · ${data.meta.classified ?? 0} classificadas`;
  }

  function renderAll() {
    renderTree();
    renderList();
    renderDetail();
    renderMeta();
  }

  async function ensureData() {
    if (data) return true;
    try {
      const res = await fetch(dataUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      data = await res.json();
      buildDescendantMap(data.catalogTree ?? []);
      expanded.clear();
      for (const n of data.catalogTree ?? []) expanded.add(n.id);
      renderAll();
      return true;
    } catch (e) {
      listHost.innerHTML = `<p class="muted lcsc-empty">Não foi possível carregar <code>${escapeHtml(dataUrl)}</code>.<br>
        Gera o JSON: <code>node --experimental-sqlite tools/easyeda-lib-sync/sync.mjs export-json</code></p>`;
      onMessage(`Biblioteca LCSC: ${e.message}`);
      return false;
    }
  }

  function open() {
    root.hidden = false;
    document.body.classList.add('lcsc-open');
    ensureData();
  }

  function close() {
    root.hidden = true;
    document.body.classList.remove('lcsc-open');
  }

  document.getElementById('openLcscLib')?.addEventListener('click', open);
  document.getElementById('lcscClose')?.addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  searchInput?.addEventListener('input', () => {
    renderList();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) close();
  });
}
