/* ── sidebar/utils.js ──────────────────────────────────────────────
   Hilfs-Funktionen: Timeouts, Remote Loading Spinner, etc.
   ──────────────────────────────────────────────────────────────── */

import { state } from '../state.js';

// ── Farb-Presets ──────────────────────────────────────────────────
export const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];

// ── Timeout-Wrapper ───────────────────────────────────────────────
// Wirft nach `ms` Millisekunden einen Fehler falls das Promise nicht antwortet.
export function withTimeout(promise, ms, label = 'Operation') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: Timeout nach ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Remote-Lade-Spinner mit Abbrechen-Button ──────────────────────
let _remoteAbortController = null;

export function showRemoteLoading(tableListEl, onCancel) {
    if (_remoteAbortController) _remoteAbortController.abort();
    _remoteAbortController = { aborted: false, abort() { this.aborted = true; } };

    tableListEl.innerHTML = `
        <div style="padding:14px 10px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent);
                      border-top-color:transparent;border-radius:50%;
                      animation:_sb_spin .7s linear infinite;flex-shrink:0"></span>
                Verbinde mit Remote…
            </div>
            <button id="btn-remote-cancel" style="background:none;border:1px solid var(--border);
                    color:var(--muted);font-size:11px;padding:4px 10px;border-radius:5px;
                    cursor:pointer;transition:color .15s,border-color .15s">
                ✕ Abbrechen
            </button>
        </div>
        <style>@keyframes _sb_spin{to{transform:rotate(360deg)}}</style>`;

    const btn = document.getElementById('btn-remote-cancel');
    if (btn) btn.addEventListener('click', () => {
        _remoteAbortController.abort();
        onCancel();
    });

    return _remoteAbortController;
}

// ── Hilfsfunktion: Tabellenname normalisieren ──────────────────────
// FIX: duckdb_tables() liefert 'table_name', PGlite liefert 'name' - beide abdecken
export function tableName(t) {
    return t.table_name ?? t.name ?? t.Name ?? '';
}

// ── Layout-Styles injizieren ──────────────────────────────────────
export function injectLayoutStyles() {
    if (!document.getElementById('sidebar-layout-fix')) {
        const style = document.createElement('style');
        style.id = 'sidebar-layout-fix';
        style.textContent = `
            #sidebar {
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                overflow: hidden !important;
                background: var(--surface1, #1c1c20);
                border-right: 1px solid var(--border, rgba(255,255,255,0.08));
            }
            #db-section {
                flex: 0 0 auto !important;
                min-height: 42px !important;
                max-height: 240px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }
            #db-list {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            }
            #db-list::-webkit-scrollbar { width: 4px; }
            #db-list::-webkit-scrollbar-track { background: transparent; }
            #db-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }

            .sb-section {
                display: flex;
                flex-direction: column;
                transition: all 0.2s ease;
            }

            #sidebar .sb-section.grow {
                flex: 1 1 auto !important;
                min-height: 120px !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            #table-list {
                flex: 1 1 0 !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow-y: auto !important;
                display: flex;
                flex-direction: column;
                padding-bottom: 20px;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            }

            .table-item img {
                opacity: 0.6;
                transition: opacity 0.2s ease;
            }
            .table-item:hover img {
                opacity: 1;
            }

            #table-list::-webkit-scrollbar { width: 4px; }
            #table-list::-webkit-scrollbar-track { background: transparent; }
            #table-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            #table-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

            #sidebar .sb-section.grow-half {
                flex: 0 0 180px !important;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            
            #sidebar .sb-section.collapsed {
                flex: 0 0 34px !important;
                min-height: 34px !important;
            }

            /* ── Import Area: Dezent & Kompakt ── */
            .import-area {
                padding: 12px;
                background: rgba(0,0,0,0.15);
                border-top: 1px solid var(--border);
                flex-shrink: 0;
            }
            
            #drop-zone {
                border: 1px dashed rgba(255,255,255,0.1);
                padding: 10px;
                border-radius: 8px;
                text-align: center;
                font-size: 11px;
                color: var(--muted);
                cursor: pointer;
                transition: all 0.2s ease;
                background: rgba(255,255,255,0.02);
            }
            
            #drop-zone:hover {
                border-color: var(--accent);
                background: rgba(194, 154, 64, 0.05);
                color: var(--text);
            }

            .import-btns {
                display: flex;
                gap: 4px;
                margin-top: 8px;
                margin-bottom: 10px;
            }
            
            .import-btns .btn {
                flex: 1;
                padding: 4px 2px;
                font-size: 9px;
                opacity: 0.6;
                background: var(--surface2);
                border: 1px solid rgba(255,255,255,0.05);
            }

            /* ── Sidebar Dropdown ── */
            .sb-dropdown {
                position: relative;
                margin-left: auto;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .table-item:hover .sb-dropdown {
                opacity: 1;
            }
            .sb-dropdown-trigger {
                background: none;
                border: none;
                color: var(--muted);
                cursor: pointer;
                padding: 2px 8px;
                font-size: 16px;
                border-radius: 4px;
            }
            .sb-dropdown-content {
                display: none;
                position: fixed;
                background: var(--surface2, #1c1c20);
                border: 1px solid var(--border);
                border-radius: 6px;
                min-width: 140px;
                z-index: 99999;
                box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                padding: 4px;
            }
            .sb-dropdown-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                font-size: 11px;
                color: var(--text);
                cursor: pointer;
                border-radius: 4px;
                white-space: nowrap;
            }
            .sb-dropdown-item svg {
                flex-shrink: 0;
                opacity: 0.7;
            }
            .sb-dropdown-item:hover {
                background: rgba(255,255,255,0.05);
            }
            .sb-dropdown-item.delete:hover {
                color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }
            .sb-dropdown-sep {
                height: 1px;
                background: var(--border);
                margin: 4px;
                opacity: 0.3;
            }

            /* ── Untermenüs für Dropdowns ── */
            .sb-dropdown-item.has-submenu {
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .sb-dropdown-item.has-submenu::after {
                content: '›';
                font-size: 14px;
                opacity: 0.5;
                margin-left: 8px;
            }
            .sb-submenu {
                display: none;
                position: absolute;
                left: 100%;
                top: -5px;
                background: var(--surface2, #1c1c20);
                border: 1px solid var(--border);
                border-radius: 6px;
                min-width: 240px;
                z-index: 1001;
                box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                padding: 4px;
            }
            .sb-dropdown-item.has-submenu:hover > .sb-submenu {
                display: block;
            }
        `;
        document.head.appendChild(style);
    }
}

// ── Color-Picker Styles injizieren ────────────────────────────────
export function injectColorPickerStyles() {
    if (!document.getElementById('sidebar-color-picker-styles')) {
        const style = document.createElement('style');
        style.id = 'sidebar-color-picker-styles';
        style.textContent = `
            .color-picker-popup {
                position: fixed;
                background: var(--surface2);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 8px;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
                z-index: 5000;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
            .color-swatch {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.1);
                transition: transform 0.1s;
            }
            .color-swatch:hover {
                transform: scale(1.2);
            }
            .color-swatch.clear {
                grid-column: span 4;
                width: 100%;
                height: auto;
                font-size: 10px;
                text-align: center;
                color: var(--muted);
                padding: 4px 0;
            }
            .table-item.dragging {
                opacity: 0.4;
                border: 1px dashed var(--accent);
            }
            .table-item.drag-over {
                border-top: 2px solid var(--accent);
            }
            .table-item {
                cursor: grab;
                transition: background 0.2s, color 0.2s;
            }
            .table-item.active {
                background: rgba(194, 154, 64, 0.12) !important;
                color: var(--accent) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Ein asynchroner Ersatz für window.prompt().
 * Erzeugt ein modales Overlay mit Eingabefeld, das sich in das App-Design einfügt.
 */
export function showInputModal(title, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.75); display: flex; align-items: center;
            justify-content: center; z-index: 10000; backdrop-filter: blur(2px);
        `;
        
        const modal = document.createElement('div');
        modal.style = `
            background: var(--surface2, #1c1c20); padding: 20px;
            border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,0.1));
            width: 340px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        `;
        
        modal.innerHTML = `
            <div style="margin-bottom: 12px; color: var(--text, #fff); font-size: 14px; font-weight: 500;">${title}</div>
            <input type="text" id="modal-input" value="${defaultValue}" style="
                width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--border);
                color: #fff; border-radius: 6px; margin-bottom: 20px; outline: none; font-size: 13px;
            ">
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="modal-cancel" style="padding: 6px 14px; background: transparent; border: 1px solid var(--border); color: var(--muted); cursor: pointer; border-radius: 6px; font-size: 12px;">Abbrechen</button>
                <button id="modal-ok" style="padding: 6px 14px; background: var(--accent, #c29a40); border: none; color: #000; cursor: pointer; border-radius: 6px; font-weight: 600; font-size: 12px;">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const input = modal.querySelector('#modal-input');
        input.focus();
        input.select();
        
        const cleanup = (val) => {
            document.body.removeChild(overlay);
            resolve(val);
        };
        
        modal.querySelector('#modal-ok').onclick = () => cleanup(input.value);
        modal.querySelector('#modal-cancel').onclick = () => cleanup(null);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') cleanup(input.value);
            if (e.key === 'Escape') cleanup(null);
        };
    });
}
