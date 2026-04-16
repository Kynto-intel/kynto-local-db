/* ── modules/table-definition-editor.js ─────────────────────────────────
   Tabellen-Definition Editor: Bearbeite Spalten, Typen, Constraints
   ──────────────────────────────────────────────────────────────────── */

import { state } from './state.js';
import { setStatus, escH } from './utils.js';

// PostgreSQL Datentypen mit Beschreibungen
const POSTGRES_TYPES = [
    // Text Types
    { category: 'Text', name: 'text', desc: 'Zeichenkette variabler Länge', icon: 'T' },
    { category: 'Text', name: 'varchar', desc: 'Zeichenkette variabler Länge', icon: 'T' },
    { category: 'Text', name: 'char', desc: 'Zeichenkette fester Länge', icon: 'T' },
    { category: 'Text', name: 'uuid', desc: 'Universell eindeutiger Bezeichner', icon: 'T' },

    // Numeric Types
    { category: 'Numerisch', name: 'int2', desc: 'Vorzeichenbehaftete Zwei-Byte-Ganzzahl', icon: '#' },
    { category: 'Numerisch', name: 'int4', desc: 'Vorzeichenbehaftete Vier-Byte-Ganzzahl', icon: '#' },
    { category: 'Numerisch', name: 'int8', desc: 'Vorzeichenbehaftete Acht-Byte-Ganzzahl', icon: '#' },
    { category: 'Numerisch', name: 'float4', desc: 'Einfachgenauigkeit Gleitkommazahl (4 Bytes)', icon: '#' },
    { category: 'Numerisch', name: 'float8', desc: 'Gleitkommazahl doppelter Genauigkeit (8 Bytes)', icon: '#' },
    { category: 'Numerisch', name: 'numeric', desc: 'Exakte numerische Genauigkeit', icon: '#' },
    { category: 'Numerisch', name: 'decimal', desc: 'Exakte numerische Genauigkeit', icon: '#' },

    // Date/Time Types
    { category: 'Datum & Zeit', name: 'date', desc: 'Kalenderdatum (Jahr, Monat, Tag)', icon: '📅' },
    { category: 'Datum & Zeit', name: 'time', desc: 'Tageszeit (keine Zeitzone)', icon: '📅' },
    { category: 'Datum & Zeit', name: 'timetz', desc: 'Tageszeit, einschließlich Zeitzone', icon: '📅' },
    { category: 'Datum & Zeit', name: 'timestamp', desc: 'Datum und Uhrzeit (ohne Zeitzone)', icon: '📅' },
    { category: 'Datum & Zeit', name: 'timestamptz', desc: 'Datum und Uhrzeit, einschließlich Zeitzone', icon: '📅' },

    // Boolean Type
    { category: 'Boolean', name: 'bool', desc: 'Logischer boolescher Wert (wahr/falsch)', icon: '⊙' },

    // Binary Types
    { category: 'Binär', name: 'bytea', desc: 'Binärzeichenkette variabler Länge', icon: 'B' },

    // JSON Types
    { category: 'JSON', name: 'json', desc: 'Textuelle JSON-Daten, zerlegt', icon: '{}' },
    { category: 'JSON', name: 'jsonb', desc: 'Binäre JSON-Daten, zerlegt', icon: '{}' },
];

// Hilfsfunktion: Icon für Datentyp ermitteln
function getTypeIcon(typeName) {
    const found = POSTGRES_TYPES.find(t => t.name === typeName);
    if (found) return found.icon;
    if (['int2','int4','int8','float4','float8','numeric','decimal'].includes(typeName)) return '#';
    if (['text','varchar','char','uuid'].includes(typeName)) return 'T';
    if (['bool'].includes(typeName)) return '⊙';
    if (['timestamp','timestamptz','date','time','timetz'].includes(typeName)) return '📅';
    return '#';
}

export const TableDefinitionEditor = {
    isOpen: false,
    mode: null, // 'create' oder 'edit'
    currentTable: null,
    columns: [],

    // CREATE & EDIT mode properties
    tableName: '',
    tableDescription: '',
    enableRLS: true,
    enableRealtime: false,

    /**
     * Initialisieren und zu DOM hinzufügen
     */
    _init() {
        if (document.getElementById('table-def-editor')) return;

        const editor = document.createElement('div');
        editor.id = 'table-def-editor';
        editor.className = 'tde-sidebar';
        editor.setAttribute('data-mode', this.mode);
        editor.innerHTML = this._getHTML();
        document.body.appendChild(editor);

        this._attachStyles();
        this._attachEventListeners();
    },

    /**
     * Neue Tabelle erstellen - öffne CREATE mode
     */
    async createNew() {
        this._init();
        this.mode = 'create';
        this.currentTable = null;
        this.isOpen = true;
        this.tableName = '';
        this.tableDescription = '';
        this.enableRLS = true;
        this.enableRealtime = false;
        this.columns = [
            { name: 'id', type: 'int4', default: "nextval('neue_tabelle_id_seq')", isPrimary: true, isNullable: false },
            { name: 'created_at', type: 'timestamptz', default: 'now()', isPrimary: false, isNullable: false },
        ];

        this._render();

        setTimeout(() => {
            const sidebar = document.querySelector('.tde-sidebar');
            if (sidebar) sidebar.classList.add('open');
        }, 0);
    },

    /**
     * Editor öffnen für eine bestimmte Tabelle (EDIT mode)
     */
    async open(tableName) {
        this._init();
        this.mode = 'edit';
        this.currentTable = tableName;
        this.tableName = tableName;
        this.tableDescription = '';
        this.enableRLS = true;
        this.enableRealtime = false;
        this.isOpen = true;

        try {
            const dbMode = state.dbMode || 'pglite';
            const dbId = dbMode === 'pglite' ? state.pgId : state.activeDbId;

            const cols = dbMode === 'pglite'
                ? await window.api.pgDescribe?.(dbId, tableName) ?? []
                : await window.api.dbDescribe?.(tableName, dbId, 'remote') ?? [];

            this.columns = cols.map(c => ({
                name: c.column_name || c.name || '',
                type: c.column_type || c.type || 'text',
                default: c.column_default || c.default || '',
                isPrimary: c.is_primary_key || c.isPrimary || false,
                isNullable: (c.null === 'YES' || c.nullable === true),
            }));

            this._render();

            setTimeout(() => {
                const sidebar = document.querySelector('.tde-sidebar');
                if (sidebar) sidebar.classList.add('open');
            }, 0);
        } catch (err) {
            console.error('Fehler beim Öffnen des Spalten-Editors:', err);
            setStatus('Fehler beim Laden der Spalten: ' + err.message, 'error');
        }
    },

    /**
     * Editor schließen
     */
    close() {
        const sidebar = document.querySelector('.tde-sidebar');
        if (sidebar) sidebar.classList.remove('open');
        this.isOpen = false;
    },

    /**
     * Neue Spalte hinzufügen
     */
    addColumn() {
        this.columns.push({
            name: `spalte_${this.columns.length + 1}`,
            type: 'text',
            default: '',
            isPrimary: false,
            isNullable: true,
        });
        this._renderColumns();
    },

    /**
     * Spalte löschen
     */
    removeColumn(index) {
        if (this.columns[index]?.isPrimary) return; // Primary key nicht löschen
        this.columns.splice(index, 1);
        this._renderColumns();
    },

    /**
     * Spalte aktualisieren
     */
    updateColumn(index, field, value) {
        if (this.columns[index]) {
            this.columns[index][field] = value;
            // Wenn isPrimary geändert wurde, Icon in select aktualisieren
            if (field === 'type') {
                // Typ-Icon im Row aktualisieren
                this._renderColumns();
            } else {
                this.columns[index][field] = value;
            }
        }
    },

    /**
     * Spalten speichern
     */
    async save() {
        try {
            const nameInput = document.getElementById('tde-table-name');
            if (nameInput) this.tableName = nameInput.value.trim();

            if (!this.tableName) {
                setStatus('Bitte Tabellenname eingeben', 'error');
                nameInput?.focus();
                return;
            }

            const mode = state.dbMode || 'pglite';
            const dbId = mode === 'pglite' ? state.pgId : state.activeDbId;

            // TODO: SQL-Befehle generieren und ausführen
            setStatus(this.mode === 'create' ? 'Tabelle erstellt' : 'Tabelle gespeichert', 'success');
            this.close();
        } catch (err) {
            console.error('Fehler beim Speichern:', err);
            setStatus('Fehler beim Speichern: ' + err.message, 'error');
        }
    },

    /**
     * Nur Spalten-Liste re-rendern (ohne kompletten DOM-Rebuild)
     */
    _renderColumns() {
        const container = document.getElementById('table-columns-list');
        if (!container) return;

        container.innerHTML = this.columns.map((col, idx) => {
            const icon = getTypeIcon(col.type);
            const isPrimary = col.isPrimary;

            return `
            <div class="tde-column-row" data-idx="${idx}">
                <div class="col-drag">⠿</div>
                <div class="col-name">
                    <div class="tde-field-wrap">
                        <input type="text" value="${escH(col.name)}"
                            onchange="window.TableDefEditor.updateColumn(${idx}, 'name', this.value)"
                            ${isPrimary ? 'class="is-primary-key"' : ''}>
                        ${isPrimary ? '<span class="tde-pk-icon" title="Primärschlüssel">🔗</span>' : '<span class="tde-link-icon">🔗</span>'}
                    </div>
                </div>
                <div class="col-type">
                    <div class="tde-type-wrap">
                        <span class="tde-type-icon">${escH(icon)}</span>
                        <select onchange="window.TableDefEditor.updateColumn(${idx}, 'type', this.value)">
                            ${this._getTypeOptions(col.type)}
                        </select>
                    </div>
                </div>
                <div class="col-default">
                    <div class="tde-field-wrap">
                        <input type="text" placeholder="NULL" value="${escH(col.default)}"
                            onchange="window.TableDefEditor.updateColumn(${idx}, 'default', this.value)">
                        <span class="tde-list-icon">☰</span>
                    </div>
                </div>
                <div class="col-primary">
                    <input type="checkbox" ${isPrimary ? 'checked' : ''}
                        onchange="window.TableDefEditor.updateColumn(${idx}, 'isPrimary', this.checked)">
                </div>
                <div class="col-actions">
                    <button class="tde-col-settings" title="Einstellungen">⚙</button>
                    <button class="tde-col-delete" title="Spalte löschen"
                        onclick="window.TableDefEditor.removeColumn(${idx})"
                        ${isPrimary ? 'disabled' : ''}>✕</button>
                </div>
            </div>
        `;
        }).join('');
    },

    /**
     * Vollständiger Render (nach open/createNew)
     */
    _render() {
        const sidebar = document.querySelector('.tde-sidebar');
        if (!sidebar) return;
        sidebar.setAttribute('data-mode', this.mode);
        sidebar.innerHTML = this._getHTML();
        this._renderColumns();
        this._attachEventListeners();
    },

    /**
     * Generiere Typ-Optionen für Select
     */
    _getTypeOptions(selectedType) {
        let html = '';
        let currentCategory = '';

        POSTGRES_TYPES.forEach(type => {
            if (type.category !== currentCategory) {
                if (currentCategory) html += '</optgroup>';
                currentCategory = type.category;
                html += `<optgroup label="${escH(type.category)}">`;
            }
            html += `<option value="${escH(type.name)}" ${type.name === selectedType ? 'selected' : ''}>
                ${escH(type.name)}
            </option>`;
        });

        if (currentCategory) html += '</optgroup>';
        return html;
    },

    /**
     * HTML Struktur
     */
    _getHTML() {
        const isEdit = this.mode === 'edit';
        const titleLabel = isEdit
            ? `Update table <span class="tde-table-badge">${escH(this.tableName)}</span>`
            : `Erstellen Sie eine neue Tabelle`;

        const saveLabel = isEdit ? 'Save' : 'Erstellen';

        return `
            <div class="tde-overlay"></div>
            <div class="tde-panel">
                <!-- Header -->
                <div class="tde-header">
                    <h1>${titleLabel}</h1>
                    <button class="tde-close" onclick="window.TableDefEditor.close()">✕</button>
                </div>

                <!-- Body Scroll -->
                <div class="tde-body">

                    <!-- Name & Description -->
                    <section class="tde-section tde-section-info">
                        <div class="tde-form-row">
                            <label class="tde-label">Name</label>
                            <input type="text" class="tde-input" id="tde-table-name"
                                placeholder="z.B. users, orders, products"
                                value="${escH(this.tableName)}"
                                onchange="window.TableDefEditor.tableName = this.value">
                        </div>
                        <div class="tde-form-row">
                            <label class="tde-label">Description</label>
                            <input type="text" class="tde-input" id="tde-table-desc"
                                placeholder="Optional"
                                value="${escH(this.tableDescription)}"
                                onchange="window.TableDefEditor.tableDescription = this.value">
                        </div>
                    </section>

                    <div class="tde-divider"></div>

                    <!-- RLS & Realtime -->
                    <section class="tde-section tde-section-options">
                        <!-- RLS -->
                        <div class="tde-option-row">
                            <label class="tde-checkbox-label">
                                <input type="checkbox" id="tde-rls" ${this.enableRLS ? 'checked' : ''}
                                    onchange="window.TableDefEditor.enableRLS = this.checked; window.TableDefEditor._updateRLSWarning()">
                                <span class="tde-option-title">
                                    Enable Row Level Security (RLS)
                                    <span class="tde-badge-recommended">RECOMMENDED</span>
                                </span>
                            </label>
                            <p class="tde-help-text">Restrict access to your table by enabling RLS and writing Postgres policies.</p>
                        </div>

                        <!-- RLS Warning Box -->
                        <div class="tde-rls-warning" id="tde-rls-warning" style="${this.enableRLS ? '' : 'display:none'}">
                            <div class="tde-warning-icon">🔒</div>
                            <div class="tde-warning-body">
                                <strong>Policies are required to query data</strong>
                                <p>You need to create an access policy before you can query data from this table. Without a policy, querying this table will return an <u>empty array</u> of results.</p>
                                <button class="tde-doc-btn">📖 Documentation</button>
                            </div>
                        </div>

                        <!-- Realtime -->
                        <div class="tde-option-row">
                            <label class="tde-checkbox-label">
                                <input type="checkbox" id="tde-realtime" ${this.enableRealtime ? 'checked' : ''}
                                    onchange="window.TableDefEditor.enableRealtime = this.checked">
                                <span class="tde-option-title">Enable Realtime</span>
                            </label>
                            <p class="tde-help-text">Broadcast changes on this table to authorized subscribers.</p>
                        </div>
                    </section>

                    <div class="tde-divider"></div>

                    <!-- Spalten Section -->
                    <section class="tde-section">
                        <div class="tde-section-header">
                            <h2>Columns</h2>
                            <button class="tde-btn-secondary tde-about-types">↗ About data types</button>
                        </div>

                        <div class="tde-columns-table">
                            <div class="tde-columns-header">
                                <div class="col-drag"></div>
                                <div class="col-name">Name <span class="tde-info-icon" title="Spaltenname">ⓘ</span></div>
                                <div class="col-type">Type</div>
                                <div class="col-default">Default Value <span class="tde-info-icon" title="Standardwert">ⓘ</span></div>
                                <div class="col-primary">Primary</div>
                                <div class="col-actions"></div>
                            </div>
                            <div id="table-columns-list" class="tde-columns-rows"></div>
                        </div>

                        <button class="tde-add-column" onclick="window.TableDefEditor.addColumn()">
                            Add column
                        </button>
                    </section>

                    <!-- Fremdschlüssel Section -->
                    <section class="tde-section">
                        <h2>Foreign keys</h2>
                        <div class="tde-fk-empty">
                            <button class="tde-fk-btn" onclick="">Add foreign key relation</button>
                        </div>
                    </section>

                </div>

                <!-- Footer -->
                <div class="tde-footer">
                    <button class="tde-btn-cancel" onclick="window.TableDefEditor.close()">Cancel</button>
                    <button class="tde-btn-save" onclick="window.TableDefEditor.save()">
                        ${saveLabel} <kbd>Ctrl ↵</kbd>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * RLS-Warnbox ein-/ausblenden
     */
    _updateRLSWarning() {
        const warn = document.getElementById('tde-rls-warning');
        if (warn) warn.style.display = this.enableRLS ? '' : 'none';
    },

    /**
     * Styles injizieren
     */
    _attachStyles() {
        if (document.getElementById('table-def-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'table-def-editor-styles';
        style.textContent = `
            /* ── Sidebar Shell ── */
            .tde-sidebar {
                position: fixed;
                inset: 0;
                z-index: 9999;
                pointer-events: none;
            }

            .tde-sidebar.open {
                pointer-events: all;
            }

            .tde-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.5);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .tde-sidebar.open .tde-overlay {
                opacity: 1;
            }

            .tde-panel {
                position: absolute;
                top: 0;
                right: 0;
                width: 680px;
                max-width: 100vw;
                height: 100%;
                background: #1c1c1f;
                border-left: 1px solid #2a2a2e;
                display: flex;
                flex-direction: column;
                transform: translateX(100%);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }

            .tde-sidebar.open .tde-panel {
                transform: translateX(0);
            }

            /* ── Header ── */
            .tde-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #2a2a2e;
                background: #1c1c1f;
                flex-shrink: 0;
            }

            .tde-header h1 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #ededed;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tde-table-badge {
                background: #2a2a2e;
                border: 1px solid #3a3a3e;
                color: #a0a0a8;
                padding: 2px 10px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
            }

            .tde-close {
                background: none;
                border: none;
                color: #666;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.15s;
                line-height: 1;
            }

            .tde-close:hover {
                color: #ccc;
                background: rgba(255,255,255,0.06);
            }

            /* ── Body ── */
            .tde-body {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                scrollbar-width: thin;
                scrollbar-color: #333 transparent;
            }

            .tde-body::-webkit-scrollbar { width: 6px; }
            .tde-body::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

            .tde-section {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .tde-divider {
                height: 1px;
                background: #2a2a2e;
                flex-shrink: 0;
            }

            /* ── Name / Description Form ── */
            .tde-section-info {
                gap: 16px;
            }

            .tde-form-row {
                display: grid;
                grid-template-columns: 100px 1fr;
                align-items: center;
                gap: 16px;
            }

            .tde-label {
                font-size: 13px;
                color: #a0a0a8;
                font-weight: 400;
            }

            .tde-input {
                background: #141416;
                border: 1px solid #2a2a2e;
                color: #ededed;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                outline: none;
                transition: border-color 0.2s;
                font-family: inherit;
                width: 100%;
                box-sizing: border-box;
            }

            .tde-input:focus {
                border-color: #3ecf8e;
            }

            .tde-input::placeholder {
                color: #444;
            }

            /* ── Options (RLS / Realtime) ── */
            .tde-section-options {
                gap: 16px;
            }

            .tde-option-row {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .tde-checkbox-label {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
            }

            .tde-checkbox-label input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
                accent-color: #3ecf8e;
                flex-shrink: 0;
            }

            .tde-option-title {
                font-size: 13px;
                color: #ededed;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tde-badge-recommended {
                display: inline-block;
                background: rgba(62, 207, 142, 0.12);
                color: #3ecf8e;
                font-size: 9px;
                font-weight: 700;
                padding: 2px 7px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 1px solid rgba(62, 207, 142, 0.25);
            }

            .tde-help-text {
                margin: 0 0 0 26px;
                font-size: 12px;
                color: #666;
                line-height: 1.5;
            }

            /* ── RLS Warning Box ── */
            .tde-rls-warning {
                display: flex;
                gap: 12px;
                background: #1a1a1e;
                border: 1px solid #2a2a2e;
                border-radius: 8px;
                padding: 14px 16px;
                margin-top: -4px;
            }

            .tde-warning-icon {
                font-size: 20px;
                flex-shrink: 0;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #242428;
                border-radius: 6px;
                border: 1px solid #2e2e34;
            }

            .tde-warning-body strong {
                display: block;
                font-size: 13px;
                color: #ededed;
                margin-bottom: 6px;
            }

            .tde-warning-body p {
                margin: 0 0 10px;
                font-size: 12px;
                color: #888;
                line-height: 1.5;
            }

            .tde-warning-body p u {
                color: #ededed;
                text-decoration: underline;
                text-decoration-color: #555;
            }

            .tde-doc-btn {
                background: #242428;
                border: 1px solid #333;
                color: #ccc;
                padding: 5px 12px;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .tde-doc-btn:hover {
                background: #2e2e34;
                border-color: #444;
            }

            /* ── Columns Section ── */
            .tde-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .tde-section-header h2 {
                margin: 0;
                font-size: 13px;
                font-weight: 600;
                color: #ededed;
            }

            .tde-btn-secondary {
                background: transparent;
                border: 1px solid #2e2e34;
                color: #a0a0a8;
                padding: 5px 12px;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
                display: inline-flex;
                align-items: center;
                gap: 5px;
            }

            .tde-btn-secondary:hover {
                border-color: #555;
                color: #ededed;
            }

            /* ── Columns Table ── */
            .tde-columns-table {
                border: 1px solid #2a2a2e;
                border-radius: 8px;
                overflow: hidden;
                background: #141416;
            }

            .tde-columns-header {
                display: grid;
                grid-template-columns: 28px 1fr 130px 1fr 60px 60px;
                gap: 0;
                padding: 8px 10px;
                background: #1a1a1e;
                border-bottom: 1px solid #2a2a2e;
                font-size: 11px;
                font-weight: 600;
                color: #666;
                text-transform: none;
            }

            .tde-columns-header .col-name,
            .tde-columns-header .col-type,
            .tde-columns-header .col-default,
            .tde-columns-header .col-primary {
                padding: 0 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .tde-info-icon {
                color: #444;
                font-size: 11px;
                cursor: help;
            }

            .tde-columns-rows {
                max-height: 380px;
                overflow-y: auto;
            }

            .tde-column-row {
                display: grid;
                grid-template-columns: 28px 1fr 130px 1fr 60px 60px;
                align-items: center;
                border-bottom: 1px solid #1e1e22;
                transition: background 0.15s;
            }

            .tde-column-row:last-child {
                border-bottom: none;
            }

            .tde-column-row:hover {
                background: rgba(255,255,255,0.015);
            }

            /* Drag handle */
            .col-drag {
                color: #333;
                font-size: 14px;
                cursor: grab;
                text-align: center;
                padding: 10px 0;
                user-select: none;
            }

            .col-drag:hover { color: #666; }

            /* Field wrap for inputs with icons */
            .tde-field-wrap {
                position: relative;
                display: flex;
                align-items: center;
                border-right: 1px solid #1e1e22;
                height: 100%;
            }

            .tde-field-wrap input {
                width: 100%;
                background: transparent;
                border: none;
                color: #ededed;
                padding: 9px 28px 9px 10px;
                font-size: 12px;
                outline: none;
                font-family: 'ui-monospace', 'Cascadia Code', 'Fira Code', monospace;
            }

            .tde-field-wrap input:focus {
                background: rgba(62, 207, 142, 0.03);
            }

            .tde-field-wrap input.is-primary-key {
                color: #ededed;
            }

            .tde-pk-icon,
            .tde-link-icon,
            .tde-list-icon {
                position: absolute;
                right: 8px;
                font-size: 12px;
                color: #444;
                pointer-events: none;
                flex-shrink: 0;
            }

            .tde-pk-icon { color: #3ecf8e; }

            /* Type select */
            .tde-type-wrap {
                display: flex;
                align-items: center;
                border-right: 1px solid #1e1e22;
                height: 100%;
                gap: 0;
            }

            .tde-type-icon {
                padding: 0 8px;
                font-size: 11px;
                color: #666;
                font-family: monospace;
                flex-shrink: 0;
                border-right: 1px solid #1e1e22;
                height: 100%;
                display: flex;
                align-items: center;
            }

            .tde-type-wrap select {
                background: transparent;
                border: none;
                color: #ededed;
                padding: 9px 8px;
                font-size: 12px;
                outline: none;
                cursor: pointer;
                flex: 1;
                font-family: 'ui-monospace', monospace;
            }

            .tde-type-wrap select option,
            .tde-type-wrap select optgroup {
                background: #1c1c1f;
                color: #ededed;
            }

            /* Primary col */
            .col-primary {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100%;
                border-right: 1px solid #1e1e22;
            }

            .col-primary input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
                accent-color: #3ecf8e;
            }

            /* Actions col */
            .col-actions {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                padding: 0 6px;
            }

            .tde-col-settings {
                background: none;
                border: none;
                color: #444;
                font-size: 13px;
                cursor: pointer;
                padding: 3px;
                border-radius: 3px;
                transition: color 0.15s;
                line-height: 1;
            }

            .tde-col-settings:hover { color: #888; }

            .tde-col-delete {
                background: none;
                border: none;
                color: #555;
                font-size: 13px;
                cursor: pointer;
                padding: 3px;
                border-radius: 3px;
                transition: color 0.15s;
                line-height: 1;
            }

            .tde-col-delete:hover { color: #ef4444; }
            .tde-col-delete:disabled { color: #2e2e34; cursor: not-allowed; }

            /* Add column button */
            .tde-add-column {
                align-self: center;
                background: transparent;
                border: 1px dashed #2e2e34;
                color: #666;
                padding: 8px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
                margin-top: 4px;
            }

            .tde-add-column:hover {
                border-color: #3ecf8e;
                color: #3ecf8e;
                background: rgba(62, 207, 142, 0.04);
            }

            /* ── Foreign Keys ── */
            .tde-fk-empty {
                border: 1px dashed #2e2e34;
                border-radius: 8px;
                padding: 20px;
                display: flex;
                justify-content: center;
            }

            .tde-fk-btn {
                background: transparent;
                border: 1px solid #2e2e34;
                color: #888;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.15s;
                font-family: inherit;
            }

            .tde-fk-btn:hover {
                border-color: #555;
                color: #ccc;
            }

            /* ── Footer ── */
            .tde-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 20px;
                border-top: 1px solid #2a2a2e;
                background: #1a1a1e;
                flex-shrink: 0;
            }

            .tde-btn-cancel {
                padding: 7px 16px;
                border-radius: 6px;
                border: 1px solid #2e2e34;
                background: transparent;
                color: #a0a0a8;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.15s;
                font-family: inherit;
            }

            .tde-btn-cancel:hover {
                background: rgba(255,255,255,0.04);
                border-color: #444;
                color: #ededed;
            }

            .tde-btn-save {
                padding: 7px 16px;
                border-radius: 6px;
                border: 1px solid #3ecf8e;
                background: #3ecf8e;
                color: #000;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: inherit;
            }

            .tde-btn-save:hover {
                background: #34be7f;
                border-color: #34be7f;
            }

            .tde-btn-save kbd {
                background: rgba(0,0,0,0.2);
                border: 1px solid rgba(0,0,0,0.15);
                border-radius: 3px;
                padding: 1px 5px;
                font-size: 10px;
                font-family: inherit;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Event Listeners
     */
    _attachEventListeners() {
        const sidebar = document.querySelector('.tde-sidebar');
        if (!sidebar) return;

        const overlay = sidebar.querySelector('.tde-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.close());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && this.isOpen) this.save();
        });
    },
};

// Global verfügbar machen
window.TableDefEditor = TableDefinitionEditor;