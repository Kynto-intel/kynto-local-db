/* ── TableGridEditor/CellTextEditorSidebar.js ──────────────────────────
   Ein dedizierter Text-Editor für Zelleninhalte in der Seitenleiste.
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

export const CellTextEditorSidebar = {
    isOpen: false,
    _el: null,
    _context: null,

    _init() {
        if (this._el) return;

        const style = document.createElement('style');
        style.textContent = `
            .cell-text-sidebar {
                position: fixed; top: 0; right: -620px; width: 600px; height: 100%;
                background: var(--surface); border-left: 1px solid var(--border);
                z-index: 8000; transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5);
                color: var(--text); font-family: var(--font-sans);
            }
            .cell-text-sidebar.open { right: 0; }
            .cts-header { 
                padding: 16px 20px; border-bottom: 1px solid var(--border); 
                display: flex; justify-content: space-between; align-items: center; 
                background: var(--surface1);
            }
            .cts-header h3 { margin: 0; font-size: 13px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; }
            .cts-body { flex: 1; padding: 0; display: flex; flex-direction: column; background: #00000022; }
            .cts-textarea {
                flex: 1; background: transparent; border: none; color: var(--text);
                padding: 24px; font-size: 14px; font-family: var(--font-mono);
                resize: none; outline: none; line-height: 1.7;
            }
            .cts-footer { 
                padding: 16px 20px; border-top: 1px solid var(--border); 
                display: flex; gap: 12px; justify-content: flex-end; 
                background: var(--surface1);
            }
            .cts-btn-save { background: var(--accent); color: #000; border: none; padding: 8px 24px; border-radius: 6px; font-weight: 800; cursor: pointer; font-size: 12px; }
            .cts-btn-cancel { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; }
            .cts-btn-save:hover { opacity: 0.9; }
            .cts-btn-cancel:hover { background: var(--surface2); color: var(--text); }
        `;
        document.head.appendChild(style);

        this._el = document.createElement('div');
        this._el.className = 'cell-text-sidebar';
        this._el.innerHTML = `
            <div class="cts-header">
                <h3 id="cts-title">Zellen-Editor</h3>
                <button class="cts-btn-cancel" style="padding: 4px 8px; border:none;" id="cts-close-x">✕</button>
            </div>
            <div class="cts-body">
                <textarea class="cts-textarea" id="cts-input" spellcheck="false" placeholder="Zelleninhalt..."></textarea>
            </div>
            <div class="cts-footer">
                <button class="cts-btn-cancel" id="cts-close">Abbrechen</button>
                <button class="cts-btn-save" id="cts-save">Speichern</button>
            </div>
        `;
        document.body.appendChild(this._el);

        this._el.querySelector('#cts-close').onclick = () => this.close();
        this._el.querySelector('#cts-close-x').onclick = () => this.close();
        this._el.querySelector('#cts-save').onclick = () => this.save();
    },

    open(td, ri, col, val) {
        this._init();
        this._context = { td, ri, col };
        this._el.querySelector('#cts-title').textContent = `Spalte bearbeiten: ${col}`;
        const input = this._el.querySelector('#cts-input');
        input.value = val ?? '';
        this._el.classList.add('open');
        this.isOpen = true;
        setTimeout(() => input.focus(), 350);
    },

    close() {
        this._el?.classList.remove('open');
        this.isOpen = false;
    },

    async save() {
        const newVal = this._el.querySelector('#cts-input').value;
        const { td, ri, col } = this._context;
        try {
            await window.TableGridEditor.performCellUpdate(state.currentTable, col, newVal, ri, td);
            this.close();
        } catch (err) {
            setStatus('Fehler beim Speichern: ' + err.message, 'error');
        }
    }
};

window.CellTextEditorSidebar = CellTextEditorSidebar;