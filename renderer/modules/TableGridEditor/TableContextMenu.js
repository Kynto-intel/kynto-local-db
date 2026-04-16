/* ── TableGridEditor/TableContextMenu.js ──────────────────────────────────
   Kontextmenü für das Daten-Grid (Rechtsklick-Aktionen).
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { CellTextEditorSidebar } from './CellTextEditorSidebar.js';
import { EMPTY_OBJ } from '../../../src/lib/void.js';

const ICONS = {
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    filter: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    magic: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
    delete: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
};

export const TableContextMenu = {
    _menu: null,

    /** Initialisiert das Menü-Element im DOM */
    init() {
        if (this._menu) return;

        const style = document.createElement('style');
        style.textContent = `
            .tge-context-menu {
                position: fixed; background: var(--surface2);
                border: 1px solid var(--border); border-radius: 6px;
                display: none; flex-direction: column; min-width: 180px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 6000;
                padding: 4px; backdrop-filter: blur(10px);
            }
            .tge-context-menu.open { display: flex; }
            .tge-menu-item {
                padding: 8px 12px; cursor: pointer; color: var(--text);
                font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 10px;
                transition: all 0.15s ease; border-radius: 4px;
            }
            .tge-menu-item svg { opacity: 0.7; flex-shrink: 0; }
            .tge-menu-item:hover svg { opacity: 1; }
            .tge-menu-item:hover { background: var(--accent); color: #000; }
            .tge-menu-sep { height: 1px; background: var(--border); margin: 4px; opacity: 0.5; }
        `;
        document.head.appendChild(style);

        this._menu = document.createElement('div');
        this._menu.className = 'tge-context-menu';
        document.body.appendChild(this._menu);

        // Schließen bei Klick außerhalb
        window.addEventListener('click', () => this.close());
        window.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('td')) this.close();
        });
    },

    /** Öffnet das Menü an der Mausposition */
    show(e, options = EMPTY_OBJ) {
        const { rowIndex, colName, cellValue, rowData, TableGridEditor } = options;
        this.init();
        e?.preventDefault?.();
        e?.stopPropagation?.();

        const isCell = rowIndex !== undefined && colName;

        this._menu.innerHTML = isCell ? `
            <div class="tge-menu-item" data-action="copy-cell">${ICONS.copy} Zelle kopieren</div>
            <div class="tge-menu-item" data-action="copy-row">${ICONS.copy} Zeile kopieren</div>
            <div class="tge-menu-item" data-action="refresh">${ICONS.refresh} Ansicht aktualisieren</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="filter">${ICONS.filter} Nach Wert filtern</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="edit">${ICONS.edit} Im Editor öffnen</div>
            <div class="tge-menu-item" data-action="fake-data">${ICONS.magic} Testdaten generieren</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="delete" style="color:var(--error)">${ICONS.delete} Zeile löschen</div>
        ` : `
            <div class="tge-menu-item" data-action="insert">${ICONS.plus} Neue Zeile einfügen</div>
            <div class="tge-menu-item" data-action="fake-data">${ICONS.magic} Testdaten generieren</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="refresh">${ICONS.refresh} Ansicht aktualisieren</div>
        `;

        this._menu.style.top  = `${e.clientY}px`;
        this._menu.style.left = `${e.clientX}px`;
        this._menu.classList.add('open');

        // Alten Handler nullen bevor neu gesetzt wird (verhindert Stapeln)
        this._menu.onclick = null;
        this._menu.onclick = async (me) => {
            const item = me.target.closest('.tge-menu-item');
            if (!item) return;
            const action = item.dataset.action;

            if (action === 'copy-cell') {
                navigator.clipboard.writeText(String(cellValue ?? 'NULL'));
                setStatus('Zelle in Zwischenablage kopiert', 'success');
            }
            else if (action === 'copy-row') {
                navigator.clipboard.writeText(JSON.stringify(rowData, null, 2));
                setStatus('Ganze Zeile als JSON kopiert', 'success');
            }
            else if (action === 'filter') {
                state.currentFilters[colName] = String(cellValue);
                const { updateTableQuery } = await import('../executor.js');
                updateTableQuery();
            }
            else if (action === 'edit') {
                const td = e.target.closest('td');
                if (window.CellTextEditorSidebar) {
                    window.CellTextEditorSidebar.open(td, rowIndex, colName, cellValue);
                }
            }
            else if (action === 'fake-data') {
                if (TableGridEditor && typeof TableGridEditor.handleFillWithFakeData === 'function') {
                    await TableGridEditor.handleFillWithFakeData(options.tableName || state.currentTable, 50);
                }
            }
            else if (action === 'refresh') {
                TableGridEditor?.switchView('data');
            }
            else if (action === 'insert') {
                TableGridEditor?.insertRow();
            }
            else if (action === 'delete') {
                // TableGridEditor.deleteRows existiert bereits und erledigt alles:
                // _getDbId() → state.pgId, confirmDeleteRows, onSuccess → switchView('data')
                // Einziger originaler Bug: rows:[rowIndex] statt rows:[rowData]
                TableGridEditor?.deleteRows({ rows: [rowData] });
            }

            this.close();
        };
    },

    close() {
        if (this._menu) this._menu.classList.remove('open');
    },
};

window.TableContextMenu = TableContextMenu;