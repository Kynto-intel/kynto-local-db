/* ── TableGridEditor/ViewEntityAutofixSecurityModal.js ─────────────────────
   Modal zum automatischen Beheben der View-Security (security_invoker=on).
   ────────────────────────────────────────────────────────────────────────── */

import { esc, escH, setStatus } from '../utils.js';
import { isViewLike } from './TableEntity.utils.js';

// ── CSS (einmalig injizieren) ──────────────────────────────────────────────
(function injectStyles() {
    if (document.getElementById('kynto-autofix-styles')) return;
    const style = document.createElement('style');
    style.id    = 'kynto-autofix-styles';
    style.textContent = `
        .kynto-autofix-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.6);
            display: flex; align-items: center; justify-content: center;
            z-index: 9100;
            animation: kyntoFadeIn .15s ease;
        }
        .kynto-autofix-modal {
            background: var(--surface1, #1e1e2e);
            border: 1px solid var(--border, #333);
            border-radius: 10px;
            padding: 28px;
            width: min(760px, 94vw);
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 24px 72px rgba(0,0,0,.6);
            animation: kyntoSlideIn .15s ease;
        }
        .kynto-autofix-modal h3 {
            margin: 0 0 10px;
            font-size: 16px;
            color: var(--fg, #cdd6f4);
        }
        .kynto-autofix-modal p {
            font-size: 13px;
            color: var(--muted, #888);
            margin: 0 0 20px;
            line-height: 1.6;
        }
        .kynto-autofix-modal code {
            background: var(--surface2, #313244);
            padding: 1px 5px;
            border-radius: 4px;
            font-size: 12px;
            color: var(--accent, #cba6f7);
        }
        .kynto-autofix-cols {
            display: flex; gap: 20px; margin-top: 8px;
        }
        .kynto-autofix-col {
            flex: 1; border: 1px solid var(--border, #333);
            border-radius: 8px; overflow: hidden;
        }
        .kynto-autofix-col-head {
            padding: 10px 14px;
            background: var(--surface2, #313244);
            font-size: 12px; font-weight: 600; font-family: monospace;
            color: var(--fg, #cdd6f4);
            border-bottom: 1px solid var(--border, #333);
        }
        .kynto-autofix-col-body {
            padding: 14px;
            font-size: 12px; font-family: monospace;
            color: var(--muted, #888);
            white-space: pre-wrap;
            min-height: 160px;
            line-height: 1.6;
            overflow-x: auto;
        }
        .kynto-autofix-col-body.loading {
            display: flex; align-items: center; justify-content: center;
            color: var(--muted, #888);
        }
        .kynto-autofix-actions {
            display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px;
        }
        .kynto-autofix-btn {
            padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border, #333);
            font-size: 13px; cursor: pointer; transition: all .15s;
        }
        .kynto-autofix-btn-cancel  { background: transparent; color: var(--fg, #cdd6f4); }
        .kynto-autofix-btn-cancel:hover { background: var(--surface2, #313244); }
        .kynto-autofix-btn-confirm { background: var(--accent, #cba6f7); color: #1e1e2e; border-color: var(--accent, #cba6f7); font-weight: 600; }
        .kynto-autofix-btn-confirm:hover { opacity: .85; }
        .kynto-autofix-btn-confirm:disabled { opacity: .5; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
})();

// ── Öffentliche Funktion ───────────────────────────────────────────────────

/**
 * Öffnet den Autofix-Security-Dialog für eine View.
 *
 * @param {{ entity: object, dbId: string, onSuccess?: function }} opts
 *   entity – das Entity-Objekt mit { schema, name, entity_type }
 *   dbId   – aktive Datenbank-ID
 */
export async function openAutofixSecurityModal({ entity, dbId, onSuccess }) {
    if (!isViewLike(entity)) return;

    // Overlay aufbauen
    const overlay = document.createElement('div');
    overlay.className = 'kynto-autofix-overlay';
    overlay.innerHTML = `
        <div class="kynto-autofix-modal" role="dialog" aria-modal="true">
            <h3>View-Sicherheit automatisch beheben</h3>
            <p>
                Das Setzen von <code>security_invoker=on</code> stellt sicher, dass die View mit den
                Berechtigungen des abfragenden Benutzers ausgeführt wird – das reduziert das Risiko
                unbeabsichtigter Datenzugriffe.
            </p>
            <div class="kynto-autofix-cols">
                <div class="kynto-autofix-col">
                    <div class="kynto-autofix-col-head">Bestehende Abfrage</div>
                    <div class="kynto-autofix-col-body loading" id="af-existing">⏳ Wird geladen…</div>
                </div>
                <div class="kynto-autofix-col">
                    <div class="kynto-autofix-col-head">Aktualisierte Abfrage</div>
                    <div class="kynto-autofix-col-body loading" id="af-updated">⏳ Wird geladen…</div>
                </div>
            </div>
            <div class="kynto-autofix-actions">
                <button class="kynto-autofix-btn kynto-autofix-btn-cancel" id="af-cancel">Abbrechen</button>
                <button class="kynto-autofix-btn kynto-autofix-btn-confirm" id="af-confirm" disabled>Bestätigen</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const elExisting = overlay.querySelector('#af-existing');
    const elUpdated  = overlay.querySelector('#af-updated');
    const btnConfirm = overlay.querySelector('#af-confirm');
    const btnCancel  = overlay.querySelector('#af-cancel');

    const close = () => overlay.remove();
    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // View-Definition laden
    let viewDef = '';
    try {
        // DuckDB kennt kein information_schema.views für alle Fälle,
        // daher nutzen wir duckdb_views() wenn verfügbar, sonst Fallback.
        let rows;
        try {
            rows = await window.api.query(
                `SELECT sql FROM duckdb_views() WHERE schema_name = ${formatStr(entity.schema)} AND view_name = ${formatStr(entity.name)}`,
                dbId
            );
            viewDef = rows?.[0]?.sql ?? '';
        } catch {
            // Fallback: Generische SHOW CREATE VIEW (funktioniert z.B. bei SQLite)
            rows = await window.api.query(
                `SELECT sql FROM sqlite_master WHERE type='view' AND name = ${formatStr(entity.name)}`,
                dbId
            );
            viewDef = rows?.[0]?.sql ?? '';
        }

        if (!viewDef) viewDef = `-- Definition für "${entity.schema}.${entity.name}" nicht gefunden`;

        const existingText = `create view ${entity.schema}.${entity.name} as\n${viewDef}`;
        const updatedText  = `create view ${entity.schema}.${entity.name}\n  with (security_invoker = on) as\n${viewDef}`;

        elExisting.classList.remove('loading');
        elUpdated.classList.remove('loading');
        elExisting.textContent = existingText;
        elUpdated.textContent  = updatedText;
        btnConfirm.disabled    = false;
    } catch (err) {
        elExisting.textContent = `Fehler beim Laden: ${err.message}`;
        elUpdated.textContent  = '–';
    }

    // Bestätigen → ALTER VIEW ausführen
    btnConfirm.addEventListener('click', async () => {
        btnConfirm.disabled    = true;
        btnConfirm.textContent = 'Wird angewendet…';

        const sql = `ALTER VIEW "${entity.schema}"."${entity.name}" SET (security_invoker = on);`;
        try {
            await window.api.query(sql, dbId);
            setStatus('View-Sicherheit erfolgreich aktualisiert.', 'success');
            onSuccess?.();
            close();
        } catch (err) {
            setStatus(`Fehler beim Autofix: ${err.message}`, 'error');
            btnConfirm.disabled    = false;
            btnConfirm.textContent = 'Bestätigen';
        }
    });
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────
function formatStr(val) {
    return `'${String(val).replaceAll("'", "''")}'`;
}
