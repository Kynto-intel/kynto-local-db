/* ── TableGridEditor/TableDefinition.js ────────────────────────────────────
   Zeigt die SQL-Definition einer Tabelle oder View (read-only).
   Nutzt Monaco-Editor falls verfügbar (state.editor-Kontext), sonst <pre>.
   ────────────────────────────────────────────────────────────────────────── */

import { state }                from '../state.js';
import { escH, setStatus }      from '../utils.js';
import { isViewLike, isView, isMaterializedView } from './TableEntity.utils.js';

// ── CSS (einmalig injizieren) ──────────────────────────────────────────────
(function injectStyles() {
    if (document.getElementById('kynto-tabledef-styles')) return;
    const style = document.createElement('style');
    style.id    = 'kynto-tabledef-styles';
    style.textContent = `
        .kynto-tabledef-wrap {
            display: flex; flex-direction: column; height: 100%;
            background: var(--surface0, #181825);
        }
        .kynto-tabledef-toolbar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 12px;
            border-bottom: 1px solid var(--border, #333);
            background: var(--surface1, #1e1e2e);
            flex-shrink: 0;
        }
        .kynto-tabledef-toolbar span {
            font-size: 13px; color: var(--muted, #888);
        }
        .kynto-tabledef-toolbar code {
            color: var(--fg, #cdd6f4); font-size: 12px;
            background: var(--surface2, #313244); padding: 1px 6px; border-radius: 4px;
        }
        .kynto-tabledef-toolbar-right {
            display: flex; gap: 8px;
        }
        .kynto-tabledef-btn {
            padding: 5px 12px; border-radius: 5px; font-size: 12px; cursor: pointer;
            border: 1px solid var(--border, #333);
            background: var(--surface2, #313244); color: var(--fg, #cdd6f4);
            transition: background .15s;
        }
        .kynto-tabledef-btn:hover { background: var(--surface3, #45475a); }

        .kynto-tabledef-editor-wrap {
            flex: 1; position: relative; overflow: hidden;
        }
        /* Fallback-Code-Ansicht falls kein Monaco */
        .kynto-tabledef-pre {
            margin: 0; padding: 16px;
            font-size: 13px; font-family: monospace;
            color: var(--fg, #cdd6f4);
            white-space: pre-wrap; word-break: break-all;
            overflow: auto; height: 100%;
            box-sizing: border-box;
            line-height: 1.65;
        }
        .kynto-tabledef-loading {
            display: flex; align-items: center; justify-content: center;
            height: 100%; color: var(--muted, #888); font-size: 14px; gap: 10px;
        }
        .kynto-tabledef-error {
            padding: 16px; color: #f38ba8; font-size: 13px; font-family: monospace;
        }
        .kynto-tabledef-footer {
            display: flex; align-items: center; justify-content: space-between;
            padding: 4px 12px; border-top: 1px solid var(--border, #333);
            background: var(--surface1, #1e1e2e); flex-shrink: 0;
            font-size: 11px; color: var(--muted, #888);
        }
    `;
    document.head.appendChild(style);
})();

// ── Öffentliche Klasse ─────────────────────────────────────────────────────

export class TableDefinition {
    /**
     * @param {object} opts
     * @param {object} opts.entity      – Entity-Objekt mit { id, schema, name, entity_type }
     * @param {string} opts.dbId        – aktive Datenbank-ID
     * @param {string} opts.resolvedSchema – Das bereits aufgelöste Schema (z.B. 'public')
     * @param {string} opts.dbType      – 'local' (PGlite) oder 'remote' (PostgreSQL)
     * @param {HTMLElement} opts.container – Ziel-Element für das Rendern
     */
    constructor({ entity, dbId, container, resolvedSchema, dbType = 'local' }) {
        this.entity    = entity;
        this.dbId      = dbId;
        this.container = container;
        this.resolvedSchema = resolvedSchema || entity?.schema || 'public';
        this.dbType    = dbType;  // FIX: dbType speichern
        this._monacoEditor = null;
    }

    /** Rendert die Definition in den Container. */
    async render() {
        const { entity, dbId, container } = this;

        console.log('[TableDefinition] Rendering with params:', { 
            entity: entity?.name, 
            schema: entity?.schema,
            dbId, 
            dbType: this.dbType,
            resolvedSchema: this.resolvedSchema
        });

        container.innerHTML = `
            <div class="kynto-tabledef-wrap">
                <div class="kynto-tabledef-toolbar">
                    <span>Definition von <code>${escH(entity.schema)}.${escH(entity.name)}</code>
                        &nbsp;<span style="color:var(--muted,#888)">(Nur lesen)</span>
                    </span>
                    <div class="kynto-tabledef-toolbar-right">
                        <button class="kynto-tabledef-btn" id="tdef-copy">📋 Kopieren</button>
                        <button class="kynto-tabledef-btn" id="tdef-open-sql">SQL-Editor öffnen</button>
                    </div>
                </div>
                <div class="kynto-tabledef-editor-wrap" id="tdef-editor-wrap">
                    <div class="kynto-tabledef-loading">⏳ Definition wird geladen…</div>
                </div>
                <div class="kynto-tabledef-footer">
                    <span id="tdef-footer-info"></span>
                    <span>Schreibgeschützt</span>
                </div>
            </div>
        `;

        const editorWrap   = container.querySelector('#tdef-editor-wrap');
        const footerInfo   = container.querySelector('#tdef-footer-info');
        const btnCopy      = container.querySelector('#tdef-copy');
        const btnOpenSql   = container.querySelector('#tdef-open-sql');

        // Definition laden
        let definition = '';
        try {
            definition = await this._loadDefinition(entity, dbId, this.resolvedSchema, this.dbType);
            console.log('[TableDefinition] Definition loaded successfully, length:', definition.length);
        } catch (err) {
            console.error('[TableDefinition] Rendering error:', err);
            editorWrap.innerHTML = `<div class="kynto-tabledef-error">⚠️ Fehler beim Laden: ${escH(String(err))}</div>`;
            return;
        }

        const prepend  = this._buildPrepend(entity);
        const fullSql  = prepend + definition;
        const lineCount = fullSql.split('\n').length;
        footerInfo.textContent = `${lineCount} Zeilen`;

        // Versuche Monaco zu nutzen, sonst <pre>-Fallback
        const monacoLoaded = await this._tryRenderMonaco(editorWrap, fullSql);
        if (!monacoLoaded) {
            this._renderFallback(editorWrap, fullSql);
        }

        // Aktionen
        btnCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(fullSql)
                .then(() => setStatus('SQL in Zwischenablage kopiert.', 'success'))
                .catch(() => setStatus('Kopieren fehlgeschlagen.', 'error'));
        });

        btnOpenSql.addEventListener('click', () => {
            this._openInSqlEditor(fullSql);
        });
    }

    /** Räumt Monaco auf (falls aktiv). */
    destroy() {
        if (this._monacoEditor) {
            try { this._monacoEditor.dispose(); } catch {}
            this._monacoEditor = null;
        }
    }

    // ── Private Methoden ───────────────────────────────────────────────────

    async _loadDefinition(entity, dbId, resolvedSchema, dbType) {
        if (isViewLike(entity)) {
            // Views: Nutze information_schema für PGlite/PostgreSQL, duckdb_views für DuckDB
            try {
                if (dbType === 'local' || dbType === 'remote') {
                    // PGlite/PostgreSQL: Nutze information_schema
                    const schema = (resolvedSchema || '').split('.').pop() || 'public';
                    const sql = `
                        SELECT view_definition as sql FROM information_schema.views
                        WHERE table_schema = '${_esc(schema)}' AND table_name = '${_esc(entity.name)}'
                    `;
                    const rows = await window.api.dbQuery(sql, null, dbType);
                    if (rows?.[0]?.sql) return rows[0].sql;
                } else {
                    // DuckDB: Nutze duckdb_views()
                    const dbFilter = (entity.database && !['main', 'memory', 'undefined'].includes(entity.database))
                        ? ` AND database_name = '${_esc(entity.database)}'`
                        : '';
                    const rows = await window.api.query(
                        `SELECT sql FROM duckdb_views()
                         WHERE schema_name = '${_esc((resolvedSchema || '').split('.').pop())}' AND view_name = '${_esc(entity.name)}'${dbFilter}`,
                        dbId
                    );
                    if (rows?.[0]?.sql) return rows[0].sql;
                }
            } catch (err) {
                console.warn('[TableDefinition] View definition (attempt 1) failed:', err);
            }
            // Fallback: INFORMATION_SCHEMA für alle DB-Typen
            try {
                const schema = (resolvedSchema || '').split('.').pop() || 'public';
                if (dbType === 'local' || dbType === 'remote') {
                    const rows = await window.api.dbQuery(
                        `SELECT view_definition as sql FROM information_schema.views WHERE table_schema = '${_esc(schema)}' AND table_name = '${_esc(entity.name)}'`,
                        null,
                        dbType
                    );
                    if (rows?.[0]?.sql) return rows[0].sql;
                }
            } catch (err) {
                console.warn('[TableDefinition] View definition (fallback) failed:', err);
            }
            return '-- Keine Definition gefunden';
        } else {
            // Tabellen: Für PGlite/PostgreSQL nutze information_schema, für DuckDB duckdb_tables
            try {
                if (dbType === 'local' || dbType === 'remote') {
                    // PGlite/PostgreSQL: Fallback zu information_schema Spalten
                    const schema = (resolvedSchema || '').split('.').pop() || 'public';
                    return await this._buildTableDdlFromSchema(entity, dbType, schema);
                } else {
                    // DuckDB: duckdb_tables()
                    const dbFilter = (entity.database && !['main', 'memory', 'undefined'].includes(entity.database))
                        ? ` AND database_name = '${_esc(entity.database)}'`
                        : '';
                    const rows = await window.api.query(
                        `SELECT sql FROM duckdb_tables()
                         WHERE schema_name = '${_esc((resolvedSchema || '').split('.').pop())}' AND view_name = '${_esc(entity.name)}'${dbFilter}`,
                        dbId
                    );
                    if (rows?.[0]?.sql) return rows[0].sql;
                }
            } catch (err) {
                console.warn('[TableDefinition] Table definition query failed:', err);
            }
            // Fallback: Spalten sammeln und DDL generieren
            const schema = (resolvedSchema || '').split('.').pop() || 'public';
            if (dbType === 'local' || dbType === 'remote') {
                return await this._buildTableDdlFromSchema(entity, dbType, schema);
            } else {
                return '-- Tabellendefinition nicht verfügbar';
            }
        }
    }

    async _buildTableDdlFromSchema(entity, dbType, schema) {
        try {
            console.log('[TableDefinition] Building table DDL from schema:', { entity: entity.name, schema, dbType });
            
            // Versuche zuerst mit dem gegebenen Schema
            let cols = await this._getColumnsForTable(entity.name, schema, dbType);
            
            // Falls keine Spalten gefunden, versuche andere Schemas
            if (!cols?.length) {
                console.log('[TableDefinition] Keine Spalten mit Schema "' + schema + '" gefunden, versuche andere Schemas...');
                const schemas = ['public', 'main', entity.schema, 'information_schema'];
                for (const trySchema of schemas) {
                    if (trySchema === schema) continue; // Bereits versucht
                    if (!trySchema) continue;
                    console.log('[TableDefinition] Versuche Schema:', trySchema);
                    cols = await this._getColumnsForTable(entity.name, trySchema, dbType);
                    if (cols?.length) {
                        console.log('[TableDefinition] ✓ Spalten gefunden in Schema:', trySchema);
                        schema = trySchema;
                        break;
                    }
                }
            }
            
            if (!cols?.length) {
                const errMsg = `Keine Spalten gefunden für ${entity.name} (dbType: ${dbType})`;
                console.warn('[TableDefinition]', errMsg);
                return '-- ' + errMsg;
            }
            
            const colsDdl = cols.map((c) => {
                let line = `  "${c.column_name}" ${c.data_type}`;
                if (c.column_default) line += ` DEFAULT ${c.column_default}`;
                if (c.is_nullable === 'NO') line += ' NOT NULL';
                return line;
            }).join(',\n');
            return `CREATE TABLE "${schema}"."${entity.name}" (\n${colsDdl}\n);`;
        } catch (e) {
            const errMsg = `[TableDefinition] _buildTableDdlFromSchema error: ${e.message || e}`;
            console.error(errMsg);
            return '-- ' + errMsg;
        }
    }

    async _getColumnsForTable(tableName, schema, dbType) {
        try {
            const sql = `
                SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
                 WHERE table_schema = '${_esc(schema)}' AND table_name = '${_esc(tableName)}'
                 ORDER BY ordinal_position
            `;
            console.log('[TableDefinition] _getColumnsForTable - Query für Schema "' + schema + '"');
            const cols = await window.api.dbQuery(sql, null, dbType);
            return cols;
        } catch (e) {
            console.warn('[TableDefinition] _getColumnsForTable failed for schema "' + schema + '":', e.message || e);
            return [];
        }
    }

    _buildPrepend(entity) {
        const schema = entity.schema || 'public';
        if (isView(entity))
            return `create view ${schema}.${entity.name} as\n`;
        if (isMaterializedView(entity))
            return `create materialized view ${schema}.${entity.name} as\n`;
        return '';
    }

    async _tryRenderMonaco(container, sql) {
        // Nutze den globalen Monaco, falls bereits geladen (z.B. über state.editor)
        if (typeof window.monaco === 'undefined') return false;

        try {
            container.innerHTML = '';
            const editorDiv = document.createElement('div');
            editorDiv.style.cssText = 'width:100%; height:100%';
            container.appendChild(editorDiv);

            const theme = document.documentElement.classList.contains('light') ? 'vs' : 'vs-dark';
            this._monacoEditor = window.monaco.editor.create(editorDiv, {
                value:          sql,
                language:       'sql',
                theme,
                readOnly:       true,
                domReadOnly:    true,
                minimap:        { enabled: false },
                fontSize:       state.editorSettings?.fontSize ?? 13,
                wordWrap:       'on',
                scrollBeyondLastLine: false,
                fixedOverflowWidgets: true,
            });
            return true;
        } catch {
            return false;
        }
    }

    _renderFallback(container, sql) {
        container.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className = 'kynto-tabledef-pre';
        pre.textContent = sql;
        container.appendChild(pre);
    }

    _openInSqlEditor(sql) {
        // Kynto: Inhalt in den SQL-Editor laden und öffnen
        if (state.editor) {
            state.editor.setValue(sql);
        }
        // Editor-Bereich aufklappen
        const area = document.querySelector('.editor-area');
        if (area && !area.classList.contains('sql-visible')) {
            area.classList.add('sql-visible');
            if (state.editor) setTimeout(() => state.editor.layout(), 50);
        }
        setStatus('SQL-Definition in Editor geladen.', 'info');
    }
}

// ── Interne Hilfsfunktion ──────────────────────────────────────────────────
function _esc(str) {
    return String(str).replaceAll("'", "''");
}
