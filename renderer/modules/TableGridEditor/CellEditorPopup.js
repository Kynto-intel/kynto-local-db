/* ── TableGridEditor/CellEditorPopup.js ──────────────────────────────────
   Kompaktes Popup für schnelles Editieren von Zellen.
   Erscheint beim Doppelklick direkt unter der Zelle.
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { CellTextEditorSidebar } from './CellTextEditorSidebar.js';

export const CellEditorPopup = {
    _el: null,
    _targetTd: null,
    _context: null,

    /** Initialisiert das Popup im DOM */
    _init() {
        if (this._el) return;
        
        const style = document.createElement('style');
        style.textContent = `
            .tge-cell-popup {
                position: fixed; background: var(--surface);
                border: 1px solid var(--border); border-radius: 8px;
                display: none; flex-direction: column; width: 280px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.6); z-index: 7000;
                padding: 10px; gap: 8px; backdrop-filter: blur(15px);
                animation: tge-popup-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes tge-popup-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .tge-cell-popup.open { display: flex; }
            .tge-popup-textarea {
                background: var(--surface2); border: 1px solid var(--border);
                border-radius: 6px; color: var(--text); padding: 8px;
                font-size: 12px; font-family: var(--font-mono);
                resize: vertical; min-height: 60px; outline: none;
            }
            .tge-popup-textarea:focus { border-color: var(--accent); }
            .tge-popup-actions { display: flex; justify-content: space-between; align-items: center; }
            .tge-popup-btn-null {
                background: rgba(255,255,255,0.05); border: 1px solid var(--border);
                color: var(--muted); font-size: 10px; padding: 4px 8px;
                border-radius: 4px; cursor: pointer; transition: all 0.2s;
            }
            .tge-popup-btn-null:hover { background: var(--error); color: white; border-color: var(--error); }
            .tge-popup-expand {
                cursor: pointer; opacity: 0.6; transition: opacity 0.2s;
                display: flex; align-items: center; justify-content: center;
            }
            .tge-popup-expand:hover { opacity: 1; color: var(--accent); }
        `;
        document.head.appendChild(style);

        this._el = document.createElement('div');
        this._el.className = 'tge-cell-popup';
        this._el.innerHTML = `
            <textarea class="tge-popup-textarea" id="tge-popup-input"></textarea>
            <div class="tge-popup-actions">
                <button class="tge-popup-btn-null" id="tge-popup-null">∅ Auf NULL setzen</button>
                <div class="tge-popup-expand" id="tge-popup-expand" title="Sidebar öffnen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </div>
            </div>
        `;
        document.body.appendChild(this._el);

        // Event-Binding
        this._el.querySelector('#tge-popup-null').onclick = () => this.setNull();
        this._el.querySelector('#tge-popup-expand').onclick = () => this.expand();
        this._el.querySelector('#tge-popup-input').onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.save(); }
            if (e.key === 'Escape') this.close();
        };

        window.addEventListener('mousedown', (e) => {
            if (this._el.classList.contains('open') && !this._el.contains(e.target)) this.close();
        });
    },

    /** Öffnet das Popup an der Zelle */
    open(td, ri, col, val) {
        this._init();
        this._targetTd = td;
        this._context = { ri, col };

        const rect = td.getBoundingClientRect();
        this._el.style.top = `${rect.bottom + 5}px`;
        this._el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
        
        const input = this._el.querySelector('#tge-popup-input');
        input.value = val ?? '';
        
        this._el.classList.add('open');
        setTimeout(() => input.focus(), 50);
    },

    async save() {
        const newVal = this._el.querySelector('#tge-popup-input').value;
        const { ri, col } = this._context;
        await window.TableGridEditor.performCellUpdate(state.currentTable, col, newVal, ri, this._targetTd);
        this.close();
    },

    async setNull() {
        const { ri, col } = this._context;
        await window.TableGridEditor.performCellUpdate(state.currentTable, col, 'NULL', ri, this._targetTd);
        this.close();
    },

    expand() {
        const { ri, col } = this._context;
        const currentVal = this._el.querySelector('#tge-popup-input').value;
        this.close();
        
        if (window.CellTextEditorSidebar) {
            window.CellTextEditorSidebar.open(this._targetTd, ri, col, currentVal);
        }
    },

    close() {
        if (this._el) {
            this._el.classList.remove('open');
            this._targetTd = null;
        }
    }
};

window.CellEditorPopup = CellEditorPopup;