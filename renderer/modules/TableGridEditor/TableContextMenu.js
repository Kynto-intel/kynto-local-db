/* ── TableGridEditor/TableContextMenu.js ──────────────────────────────────
   Kontextmenü für das Daten-Grid (Rechtsklick-Aktionen).
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { CellTextEditorSidebar } from './CellTextEditorSidebar.js';
import { EMPTY_OBJ } from '../../../src/lib/void.js';

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
                display: none; flex-direction: column; min-width: 160px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 6000;
                padding: 4px; backdrop-filter: blur(10px);
            }
            .tge-context-menu.open { display: flex; }
            .tge-menu-item {
                padding: 8px 12px; cursor: pointer; color: var(--text);
                font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 10px;
                transition: all 0.15s ease; border-radius: 4px;
            }
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

        const isCell = options.rowIndex !== undefined && options.colName;

        this._menu.innerHTML = isCell ? `
            <div class="tge-menu-item" data-action="copy-cell">📋 Zelle Kopieren</div>
            <div class="tge-menu-item" data-action="copy-row">📄 Zeile Kopieren</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="filter">🔍 Nach Wert filtern</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="edit">✏️ In großem Editor öffnen</div>
            <div class="tge-menu-item" data-action="fake-data">✨ Testdaten generieren</div>
            <div class="tge-menu-item" data-action="delete" style="color:var(--error)">🗑️ Zeile Löschen</div>
        ` : `
            <div class="tge-menu-item" data-action="refresh">🔄 Ansicht aktualisieren</div>
            <div class="tge-menu-item" data-action="insert">➕ Neue Zeile einfügen</div>
            <div class="tge-menu-sep"></div>
            <div class="tge-menu-item" data-action="fake-data">✨ Testdaten generieren</div>
            <div class="tge-menu-item" data-action="delete" style="color:var(--error)">🗑️ Zeile Löschen</div>
        `;

        this._menu.style.top = `${e.clientY}px`;
        this._menu.style.left = `${e.clientX}px`;
        this._menu.classList.add('open');

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
                // Sucht das DOM-Element der Zelle (wird für Live-Update benötigt)
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
                TableGridEditor.switchView('data');
            }
            else if (action === 'insert') {
                TableGridEditor.insertRow();
            }
            else if (action === 'delete') {
                TableGridEditor.deleteRows({ rows: [rowIndex] });
            }
            this.close();
        };
    },

    close() {
        if (this._menu) this._menu.classList.remove('open');
    }
};

window.TableContextMenu = TableContextMenu;