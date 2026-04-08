/* ── modules/ColumnEditorSidebar.js ───────────────────────────────────
   Seitenleiste zum Hinzufügen neuer Spalten (Schema Editor).
   ──────────────────────────────────────────────────────────────────── */

import { state, DUCK_TYPES } from './state.js';
import { setStatus, esc } from './utils.js';

export const ColumnEditorSidebar = {
    isOpen: false,
    currentTable: null,
    currentSchema: null,

    /**
     * Initialisiert die Sidebar (einmalig) und fügt sie dem DOM hinzu.
     */
    _init() {
        if (document.getElementById('column-editor-sidebar')) return;

        const style = document.createElement('style');
        style.textContent = `
            .column-sidebar {
                position: fixed; top: 0; right: -420px; width: 400px; height: 100%;
                background: var(--surface); border-left: 1px solid var(--border);
                z-index: 5000; transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5);
                color: var(--text); font-family: var(--font-sans);
            }
            .column-sidebar.open { right: 0; }
            .cs-header { padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
            .cs-header h3 { margin: 0; font-size: 16px; color: var(--accent); }
            .cs-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
            .cs-section-title { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 1px; margin-bottom: 10px; }
            .cs-group { display: flex; flex-direction: column; gap: 6px; }
            .cs-label { font-size: 12px; font-weight: 600; }
            .cs-hint { font-size: 10px; color: var(--muted); line-height: 1.4; }
            
            .cs-input, .cs-select, .cs-textarea {
                background: var(--surface2); border: 1px solid var(--border);
                border-radius: 6px; color: var(--text); padding: 8px 10px; font-size: 13px; outline: none;
            }
            .cs-input:focus, .cs-select:focus, .cs-textarea:focus { border-color: var(--accent); }
            
            /* Dropdown Styling */
            .cs-select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 10px center; background-size: 14px; padding-right: 30px; }
            .cs-select option { background: var(--surface2); color: var(--text); }

            /* Custom Checkbox Styling */
            .cs-check-group input[type="checkbox"] {
                appearance: none; -webkit-appearance: none;
                width: 16px; height: 16px;
                border: 1px solid var(--border); border-radius: 4px;
                background: var(--surface2); cursor: pointer;
                position: relative; transition: all 0.2s;
                margin: 0; flex-shrink: 0;
            }
            .cs-check-group input[type="checkbox"]:checked {
                background: var(--accent); border-color: var(--accent);
            }
            .cs-check-group input[type="checkbox"]:checked::after {
                content: '✓'; position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%); color: #000; font-size: 11px; font-weight: bold;
            }

            .cs-check-group { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 4px 0; }
            .cs-check-group input { margin-top: 3px; }
            .cs-footer { padding: 20px; border-top: 1px solid var(--border); display: flex; gap: 10px; }
            .btn-save { flex: 1; background: var(--accent); color: #000; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; }
            .btn-cancel { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 10px 15px; border-radius: 6px; cursor: pointer; }
            .cs-divider { height: 1px; background: var(--border); margin: 10px 0; }
        `;
        document.head.appendChild(style);

        const sidebar = document.createElement('div');
        sidebar.id = 'column-editor-sidebar';
        sidebar.className = 'column-sidebar';
        sidebar.innerHTML = `
            <div class="cs-header">
                <h3>Neue Spalte hinzufügen</h3>
                <button class="btn-cancel" style="padding: 4px 8px; border:none;" id="cs-close-x">✕</button>
            </div>
            <div class="cs-body">
                <div class="cs-section">
                    <div class="cs-section-title">Allgemein</div>
                    <div class="cs-group">
                        <label class="cs-label">Name</label>
                        <input type="text" id="cs-name" class="cs-input" placeholder="z.B. user_id">
                        <div class="cs-hint">Empfehlung: Kleinbuchstaben und Unterstriche verwenden.</div>
                    </div>
                    <div class="cs-group" style="margin-top:12px;">
                        <label class="cs-label">Beschreibung (Optional)</label>
                        <input type="text" id="cs-desc" class="cs-input" placeholder="Wofür ist diese Spalte?">
                    </div>
                </div>

                <div class="cs-divider"></div>

                <div class="cs-section">
                    <div class="cs-section-title">Datentyp</div>
                    <div class="cs-group">
                        <label class="cs-label">Typ</label>
                        <select id="cs-type" class="cs-select">
                            <option value="">Wählen Sie einen Spaltentyp aus...</option>
                            ${DUCK_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    </div>
                    <label class="cs-check-group" style="margin-top:10px;">
                        <input type="checkbox" id="cs-is-array">
                        <div>
                            <div class="cs-label">Als Array definieren</div>
                            <div class="cs-hint">Spalte als mehrdimensionales Array variabler Länge.</div>
                        </div>
                    </label>
                </div>

                <div class="cs-divider"></div>

                <div class="cs-section">
                    <div class="cs-section-title">Standardwert</div>
                    <div class="cs-group">
                        <input type="text" id="cs-default" class="cs-input" placeholder="NULL">
                        <div class="cs-hint">Literal oder Ausdruck (Ausdrücke in Klammern, z.B. (now())).</div>
                    </div>
                </div>

                <div class="cs-divider"></div>

                <div class="cs-section">
                    <div class="cs-section-title">Fremdschlüssel</div>
                    <button class="btn-cancel" style="width:100%; font-size:12px;" id="cs-add-fk-btn">🔗 Fremdschlüssel hinzufügen</button>
                    <div id="cs-fk-area" style="display:none; flex-direction:column; gap:8px; margin-top:10px;">
                        <input type="text" id="cs-fk-ref-table" class="cs-input" placeholder="Zieltabelle (z.B. users)">
                        <input type="text" id="cs-fk-ref-col" class="cs-input" placeholder="Zielspalte (z.B. id)">
                    </div>
                </div>

                <div class="cs-divider"></div>

                <div class="cs-section">
                    <div class="cs-section-title">Einschränkungen</div>
                    <label class="cs-check-group">
                        <input type="checkbox" id="cs-is-pk">
                        <div>
                            <div class="cs-label">Ist Primärschlüssel</div>
                            <div class="cs-hint">Eindeutiger Bezeichner für Zeilen.</div>
                        </div>
                    </label>
                    <label class="cs-check-group">
                        <input type="checkbox" id="cs-is-nullable" checked>
                        <div>
                            <div class="cs-label">Zulassen Nullable</div>
                            <div class="cs-hint">Spalte darf NULL-Werte enthalten.</div>
                        </div>
                    </label>
                    <label class="cs-check-group">
                        <input type="checkbox" id="cs-is-unique">
                        <div>
                            <div class="cs-label">Ist einzigartig</div>
                            <div class="cs-hint">Werte müssen zeilenübergreifend eindeutig sein.</div>
                        </div>
                    </label>
                    <div class="cs-group" style="margin-top:12px;">
                        <label class="cs-label">CHECK-Beschränkung (Optional)</label>
                        <textarea id="cs-check-constraint" class="cs-textarea" rows="2" placeholder='Länge("name") < 500'></textarea>
                    </div>
                </div>
            </div>
            <div class="cs-footer">
                <button class="btn-cancel" id="cs-close">Abbrechen</button>
                <button class="btn-save" id="cs-save">Spalte speichern</button>
            </div>
        `;
        document.body.appendChild(sidebar);

        // Event Listener
        document.getElementById('cs-close').onclick = () => this.close();
        document.getElementById('cs-close-x').onclick = () => this.close();
        document.getElementById('cs-save').onclick = () => this.save();
        
        document.getElementById('cs-add-fk-btn').onclick = () => {
            const area = document.getElementById('cs-fk-area');
            area.style.display = area.style.display === 'none' ? 'flex' : 'none';
        };
    },

    /**
     * Öffnet die Seitenleiste für eine bestimmte Tabelle.
     */
    open(table, schema) {
        this._init();
        this.currentTable = table;
        this.currentSchema = schema;
        document.querySelector('.cs-header h3').textContent = `Spalte zu "${table}" hinzufügen`;
        
        // Reset fields
        document.getElementById('cs-name').value = '';
        document.getElementById('cs-type').value = 'VARCHAR';
        document.getElementById('cs-is-array').checked = false;
        document.getElementById('cs-default').value = '';
        document.getElementById('cs-is-pk').checked = false;
        document.getElementById('cs-is-nullable').checked = true;
        document.getElementById('cs-is-unique').checked = false;
        document.getElementById('cs-check-constraint').value = '';
        document.getElementById('cs-fk-area').style.display = 'none';
        document.getElementById('cs-fk-ref-table').value = '';
        document.getElementById('cs-fk-ref-col').value = '';

        document.getElementById('column-editor-sidebar').classList.add('open');
        this.isOpen = true;
        
        setTimeout(() => document.getElementById('cs-name').focus(), 350);
    },

    close() {
        document.getElementById('column-editor-sidebar')?.classList.remove('open');
        this.isOpen = false;
    },

    async save() {
        const name = document.getElementById('cs-name').value.trim();
        const type = document.getElementById('cs-type').value;
        const isArray = document.getElementById('cs-is-array').checked;
        const defVal = document.getElementById('cs-default').value.trim();
        const isPk = document.getElementById('cs-is-pk').checked;
        const isNullable = document.getElementById('cs-is-nullable').checked;
        const isUnique = document.getElementById('cs-is-unique').checked;
        const check = document.getElementById('cs-check-constraint').value.trim();
        const fkTable = document.getElementById('cs-fk-ref-table').value.trim();
        const fkCol = document.getElementById('cs-fk-ref-col').value.trim();

        if (!name) {
            setStatus('Bitte geben Sie einen Spaltennamen an.', 'error');
            return;
        }

        if (!type) {
            setStatus('Bitte wählen Sie einen Datentyp aus.', 'error');
            return;
        }

        // SQL-Generierung
        let columnDef = `${esc(name)} ${type}${isArray ? '[]' : ''}`;
        
        if (isPk) columnDef += ' PRIMARY KEY';
        if (!isNullable) columnDef += ' NOT NULL';
        if (isUnique) columnDef += ' UNIQUE';
        if (defVal) columnDef += ` DEFAULT ${defVal}`;
        if (check) columnDef += ` CHECK (${check})`;
        if (fkTable && fkCol) columnDef += ` REFERENCES ${esc(fkTable)}(${esc(fkCol)})`;

        const schemaPrefix = this.currentSchema ? `${esc(this.currentSchema)}.` : '';
        const sql = `ALTER TABLE ${schemaPrefix}${esc(this.currentTable)} ADD COLUMN ${columnDef};`;

        setStatus('Spalte wird hinzugefügt...', 'info');
        
        try {
            const dbType = state.dbMode === 'remote' ? 'remote' : 'local';
            await window.api.dbQuery(sql, null, dbType);
            
            setStatus(`Spalte "${name}" erfolgreich hinzugefügt.`, 'success');
            this.close();
            
            // UI Aktualisieren
            if (typeof window.refreshTableList === 'function') {
                await window.refreshTableList();
            }
            
            // Tabelle neu laden
            if (typeof window._reloadCurrentTableData === 'function') {
                await window._reloadCurrentTableData();
            }
        } catch (err) {
            console.error('[ColumnEditorSidebar] Fehler:', err);
            setStatus(`Fehler: ${err.message || err}`, 'error');
        }
    }
};

// Globaler Zugriff
window.ColumnEditorSidebar = ColumnEditorSidebar;