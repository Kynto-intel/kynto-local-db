/* ── TableGridEditor/DeleteConfirmationDialogs.js ──────────────────────────
   Bestätigungs-Dialoge für das Löschen von Spalten, Tabellen und Zeilen.
   Nutzt window.api (IPC), state und setStatus aus dem Kynto-Framework.
   ────────────────────────────────────────────────────────────────────────── */

import { state }     from '../state.js';
import { esc, escH, setStatus } from '../utils.js';
import { refreshTableList }     from '../sidebar/index.js';

// ── CSS (einmalig injizieren) ──────────────────────────────────────────────
(function injectStyles() {
    if (document.getElementById('kynto-confirm-dialog-styles')) return;
    const style = document.createElement('style');
    style.id    = 'kynto-confirm-dialog-styles';
    style.textContent = `
        .kynto-modal-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.55);
            display: flex; align-items: center; justify-content: center;
            z-index: 9000;
            animation: kyntoFadeIn .15s ease;
        }
        @keyframes kyntoFadeIn { from { opacity:0 } to { opacity:1 } }

        .kynto-modal {
            background: var(--surface1, #1e1e2e);
            border: 1px solid var(--border, #333);
            border-radius: 10px;
            padding: 24px;
            min-width: 360px;
            max-width: 520px;
            width: 90vw;
            box-shadow: 0 20px 60px rgba(0,0,0,.5);
            animation: kyntoSlideIn .15s ease;
        }
        @keyframes kyntoSlideIn { from { transform:translateY(-10px); opacity:0 } to { transform:translateY(0); opacity:1 } }

        .kynto-modal h3 {
            margin: 0 0 12px;
            font-size: 15px;
            color: var(--fg, #cdd6f4);
            line-height: 1.4;
            word-break: break-word;
        }
        .kynto-modal p {
            font-size: 13px;
            color: var(--muted, #888);
            margin: 0 0 12px;
            line-height: 1.6;
        }
        .kynto-modal-actions {
            display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;
        }
        .kynto-btn {
            padding: 7px 16px; border-radius: 6px; border: 1px solid var(--border, #333);
            font-size: 13px; cursor: pointer; transition: all .15s;
        }
        .kynto-btn-cancel {
            background: transparent; color: var(--fg, #cdd6f4);
        }
        .kynto-btn-cancel:hover { background: var(--surface2, #313244); }

        .kynto-btn-danger {
            background: #dc2626; color: #fff; border-color: #dc2626;
        }
        .kynto-btn-danger:hover { background: #b91c1c; }
        .kynto-btn-danger:disabled { opacity: .6; cursor: not-allowed; }

        .kynto-checkbox-row {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px; background: var(--surface2, #313244);
            border-radius: 6px; margin-top: 8px;
        }
        .kynto-checkbox-row input[type=checkbox] { margin-top: 2px; accent-color: var(--accent, #cba6f7); }
        .kynto-checkbox-label { font-size: 13px; color: var(--fg, #cdd6f4); }
        .kynto-checkbox-desc  { font-size: 11px; color: var(--muted, #888); margin-top: 2px; }

        .kynto-warning-box {
            background: rgba(234,179,8,.1); border: 1px solid rgba(234,179,8,.4);
            border-radius: 6px; padding: 10px 12px; margin-top: 10px; font-size: 12px;
            color: #fbbf24; line-height: 1.5;
        }
    `;
    document.head.appendChild(style);
})();

// ── Interne Helfer ─────────────────────────────────────────────────────

/**
 * Zeigt ein modales Dialog-Fenster.
 * @param {{ title:string, body:string, confirmLabel?:string, onConfirm:function, dangerous?:boolean }} opts
 * @returns {{ overlay:HTMLElement, setLoading:(v:boolean)=>void, close:()=>void }}
 */
function createConfirmModal({ title, body, confirmLabel = 'Löschen', onConfirm, dangerous = true }) {
    const overlay = document.createElement('div');
    overlay.className = 'kynto-modal-overlay';

    overlay.innerHTML = `
        <div class="kynto-modal" role="dialog" aria-modal="true">
            <h3>${title}</h3>
            <div class="kynto-modal-body">${body}</div>
            <div class="kynto-modal-actions">
                <button class="kynto-btn kynto-btn-cancel" data-action="cancel">Abbrechen</button>
                <button class="kynto-btn ${dangerous ? 'kynto-btn-danger' : 'kynto-btn-primary'}" data-action="confirm">
                    ${escH(confirmLabel)}
                </button>
            </div>
        </div>
    `;

    const btnConfirm = overlay.querySelector('[data-action="confirm"]');
    const btnCancel  = overlay.querySelector('[data-action="cancel"]');

    const close = () => overlay.remove();

    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    btnConfirm.addEventListener('click', () => {
        btnConfirm.disabled = true;
        btnConfirm.textContent = 'Wird gelöscht…';
        onConfirm({ close });
    });

    document.body.appendChild(overlay);
    btnConfirm.focus();

    return {
        overlay,
        close,
        setLoading: (v) => {
            btnConfirm.disabled    = v;
            btnConfirm.textContent = v ? 'Wird gelöscht…' : escH(confirmLabel);
        },
    };
}

// ── Öffentliche Dialog-Funktionen ──────────────────────────────────────────

/**
 * Zeigt den Bestätigungs-Dialog zum Löschen einer Spalte.
 * @param {{ columnName: string, tableName: string, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteColumn({ columnName, tableName, dbId, onSuccess }) {
    let withCascade = false;

    const bodyHtml = () => `
        <p>Möchtest du die Spalte wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        <div class="kynto-checkbox-row" id="cascade-row">
            <input type="checkbox" id="chk-cascade" ${withCascade ? 'checked' : ''}>
            <div>
                <div class="kynto-checkbox-label">Spalte mit CASCADE löschen?</div>
                <div class="kynto-checkbox-desc">Löscht die Spalte und alle abhängigen Objekte</div>
            </div>
        </div>
        ${withCascade ? `<div class="kynto-warning-box">⚠️ Alle abhängigen Objekte werden rekursiv entfernt.</div>` : ''}
    `;

    const modal = createConfirmModal({
        title:        `Spalte "${escH(columnName)}" löschen`,
        body:         bodyHtml(),
        confirmLabel: 'Spalte löschen',
        onConfirm:    async ({ close }) => {
            try {
                const cascadeClause = withCascade ? ' CASCADE' : '';
                await window.api.query(
                    `ALTER TABLE ${esc(tableName)} DROP COLUMN ${esc(columnName)}${cascadeClause}`,
                    dbId
                );
                setStatus(`Spalte "${columnName}" erfolgreich gelöscht.`, 'success');
                onSuccess?.();
            } catch (err) {
                setStatus(`Fehler beim Löschen: ${err.message}`, 'error');
            } finally {
                close();
                await refreshTableList();
            }
        },
    });

    // Cascade-Checkbox live aktualisieren
    const onChange = (e) => {
        if (e.target.id !== 'chk-cascade') return;
        withCascade = e.target.checked;
        modal.overlay.querySelector('.kynto-modal-body').innerHTML = bodyHtml();
        // Checkbox-State wiederherstellen & Listener neu setzen
        const chk = modal.overlay.querySelector('#chk-cascade');
        if (chk) chk.checked = withCascade;
    };
    modal.overlay.addEventListener('change', onChange);
}

/**
 * Zeigt den Bestätigungs-Dialog zum Löschen einer Tabelle.
 * @param {{ tableName: string, schema: string, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteTable({ tableName, schema, dbId, onSuccess }) {
    let withCascade = false;

    const bodyHtml = () => `
        <p>Möchtest du die Tabelle wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        <div class="kynto-checkbox-row">
            <input type="checkbox" id="chk-tbl-cascade" ${withCascade ? 'checked' : ''}>
            <div>
                <div class="kynto-checkbox-label">Tabelle mit CASCADE löschen?</div>
                <div class="kynto-checkbox-desc">Löscht die Tabelle und alle abhängigen Objekte</div>
            </div>
        </div>
        ${withCascade ? `<div class="kynto-warning-box">⚠️ Alle abhängigen Objekte werden rekursiv entfernt (Views, Foreign Keys, …).</div>` : ''}
    `;

    const modal = createConfirmModal({
        title:        `Tabelle "${escH(tableName)}" löschen`,
        body:         bodyHtml(),
        confirmLabel: 'Tabelle löschen',
        onConfirm:    async ({ close }) => {
            try {
                const cascadeClause = withCascade ? ' CASCADE' : '';
                const sql = `DROP TABLE IF EXISTS ${esc(schema)}.${esc(tableName)}${cascadeClause}`;
                
                // Richtige API basierend auf DB-Typ wählen
                if (state.dbMode === 'remote' && state.remoteConnectionString) {
                    // Remote-PostgreSQL verwenden
                    await window.api.dbQuery(sql, null, 'remote');
                } else {
                    // PGlite nutzen
                    await window.api.pgQuery(sql, dbId);
                }
                
                setStatus(`Tabelle "${tableName}" erfolgreich gelöscht.`, 'success');
                onSuccess?.();
            } catch (err) {
                console.error('[confirmDeleteTable] Fehler:', err);
                setStatus(`Fehler beim Löschen: ${err.message}`, 'error');
            } finally {
                close();
                await refreshTableList();
            }
        },
    });

    modal.overlay.addEventListener('change', () => {
        const chk = modal.overlay.querySelector('#chk-tbl-cascade');
        if (!chk) return;
        withCascade = chk.checked;
        modal.overlay.querySelector('.kynto-modal-body').innerHTML = bodyHtml();
        const chk2 = modal.overlay.querySelector('#chk-tbl-cascade');
        if (chk2) chk2.checked = withCascade;
    });
}

/**
 * Zeigt den Bestätigungs-Dialog zum Löschen von Zeilen.
 * @param {{ rows: Array, allRowsSelected: boolean, numRows: number, table: object, filters: Array, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteRows({ rows, allRowsSelected, numRows, table, filters = [], dbId, onSuccess }) {
    const rowCount    = allRowsSelected ? numRows : rows.length;
    const rowLabel    = rowCount > 1 ? `${rowCount} Zeilen` : '1 Zeile';
    const selectLabel = allRowsSelected ? 'alle' : 'die ausgewählten';

    // PGlite kennt nur "public" – "main" ist ein DuckDB/SQLite-Schema-Name
    const schema = (!table.schema || table.schema === 'main') ? 'public' : table.schema;
    const tableName = table.name;

    // Bestimme ob Remote oder PGlite basierend auf state.dbMode
    const isRemote = state.dbMode === 'remote' && state.remoteConnectionString;
    
    const runQuery = (sql) => {
        if (isRemote) {
            // Remote-PostgreSQL: nutzt state.serverConnectionString (globale Konfiguration)
            return window.api.dbQuery(sql, null, 'remote');
        } else {
            // PGlite: mit expliziter dbId
            return window.api.pgQuery(sql, dbId);
        }
    };

    createConfirmModal({
        title:        `${rowLabel} löschen`,
        body:         `<p>Möchtest du wirklich ${selectLabel} ${rowLabel} löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>`,
        confirmLabel: 'Zeilen löschen',
        onConfirm:    async ({ close }) => {
            try {
                if (allRowsSelected && filters.length === 0) {
                    const sql = `DELETE FROM ${esc(schema)}.${esc(tableName)}`;
                    console.debug('[confirmDeleteRows] DELETE all query:', sql);
                    await runQuery(sql);
                    setStatus(`Alle Zeilen aus "${tableName}" gelöscht.`, 'success');

                } else if (allRowsSelected && filters.length > 0) {
                    const where = buildWhereClause(filters);
                    const sql = `DELETE FROM ${esc(schema)}.${esc(tableName)} WHERE ${where}`;
                    console.debug('[confirmDeleteRows] DELETE filtered query:', sql);
                    await runQuery(sql);
                    setStatus(`Gefilterte Zeilen aus "${tableName}" gelöscht.`, 'success');

                } else {
                    // Primärschlüssel-Spalte ermitteln.
                    // table.columns kann undefined sein wenn _currentEntity keine Spalten hat –
                    // dann auf state.columnMetadata (von pgDescribe befüllt) zurückfallen.
                    const cols = (table.columns?.length > 0)
                        ? table.columns
                        : (state.columnMetadata || []).map(c => ({
                            name:         c.column_name || c.name,
                            isPrimaryKey: c.is_primary_key || c.pk || false,
                          }));

                    // PK über isPrimaryKey, dann ersten Eintrag, dann ersten rowData-Key
                    const pkCol = cols.find((c) => c.isPrimaryKey)?.name
                                ?? cols[0]?.name
                                ?? Object.keys(rows[0] || {})[0];

                    if (!pkCol) {
                        throw new Error(
                            `Kein Primärschlüssel in "${tableName}" gefunden – ` +
                            `keine Spalteninformationen verfügbar.`
                        );
                    }

                    for (const row of rows) {
                        const pkVal = row[pkCol];
                        if (pkVal === undefined || pkVal === null) {
                            console.warn('[confirmDeleteRows] PK-Wert fehlt für Zeile:', row);
                            continue;
                        }
                        const sql = `DELETE FROM ${esc(schema)}.${esc(tableName)} WHERE ${esc(pkCol)} = ${formatSqlValue(pkVal)}`;
                        console.debug('[confirmDeleteRows] DELETE single row query:', sql);
                        await runQuery(sql);
                    }
                    setStatus(`${rowLabel} erfolgreich gelöscht.`, 'success');
                }
                onSuccess?.();
            } catch (err) {
                console.error('[confirmDeleteRows] Fehler bei:', { schema, tableName, dbMode: state.dbMode, isRemote, error: err });
                setStatus(`Fehler beim Löschen: ${err.message}`, 'error');
            } finally {
                close();
                // Sidebar-Tabellenliste aktualisieren (z.B. Zeilenzahl)
                refreshTableList().catch(() => {});
            }
        },
    });
}

// ── SQL-Hilfsfunktionen ────────────────────────────────────────────────────

function formatSqlValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return `'${String(val).replaceAll("'", "''")}'`;
}

function buildWhereClause(filters) {
    return filters
        .map((f) => `${esc(f.column)} ${f.operator ?? '='} ${formatSqlValue(f.value)}`)
        .join(' AND ');
}