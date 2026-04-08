/* ══════════════════════════════════════════════════════════════════════
   modules/pglite-ui.js  —  UI-Bridge für Säule B (PGlite)
   
   Integriert PGlite in die bestehende Sidebar und den Query-Tab.
   Der Nutzer kann zwischen DuckDB und PGlite-Datenbanken wechseln,
   ohne dass sich die UI ändert — gleiche Oberfläche, anderer Motor.
   
   ══════════════════════════════════════════════════════════════════════ */

import { state }    from './state.js';
import { setStatus } from './utils.js';

// Aktive PGlite-Datenbank-ID (null = PGlite nicht aktiv)
let activePgId = null;
import { switchMode } from './mode-switcher.js';
import { refreshDBList } from './sidebar.js';

// ── PGlite DB-Liste in Sidebar einfügen ───────────────────────────────

/**
 * In der neuen Version übernimmt sidebar.js das Rendering beider DB-Typen.
 */
export async function renderPGliteList() {
    await refreshDBList();
}

// ── Erstellen / Öffnen ─────────────────────────────────────────────────

export async function createPGliteDB() {
    const id = await window.api.pgCreateDB();
    if (id) {
        await switchToPGlite(id);
        setStatus('App-Datenbank erstellt.', 'success');
    }
}

export async function openPGliteDB() {
    const id = await window.api.pgOpenDB();
    if (id) {
        await switchToPGlite(id);
        setStatus('App-Datenbank geöffnet.', 'success');
    }
}

// ── PGlite als aktive DB setzen ────────────────────────────────────────

/**
 * Wechselt den aktiven Datenbank-Kontext auf PGlite.
 * Alle folgenden SQL-Abfragen gehen an PGlite statt DuckDB.
 */
export async function switchToPGlite(pgId) {
    activePgId = pgId;

    state.pgId    = pgId;

    await renderPGliteList();
    await switchMode('pglite'); // Dies aktualisiert state.dbMode, pgMode und lädt das Dashboard neu
    
    const safeName = (typeof pgId === 'string' ? pgId : String(pgId || '')).split(/[/\\]/).pop().replace('.pgdata', '');
    setStatus(`🐘 PGlite aktiv: ${safeName}`, 'success');
}

/**
 * Tabellenliste für die aktive PGlite-DB laden und in Sidebar rendern.
 */
async function refreshPGliteTables(pgId) {
    const tableListEl = document.getElementById('table-list');
    const selTable    = document.getElementById('sel-table');

    try {
        const tables  = await window.api.pgTables(pgId);
        const columns = await window.api.pgColumns(pgId);

        // knownTables/knownColumns im State aktualisieren
        state.knownTables  = tables.map(t => t.name);
        state.knownColumns = {};
        columns.forEach(row => {
            if (!state.knownColumns[row.table_name]) state.knownColumns[row.table_name] = [];
            state.knownColumns[row.table_name].push(row.column_name);
        });

        if (tableListEl) {
            tableListEl.innerHTML = tables.length
                ? tables.map(t => {
                    const isActive = state.currentTable === t.name;
                    return `
                        <div class="table-item ${isActive ? 'active' : ''}">
                            <span class="table-name" data-name="${t.name}">🐘 ${t.name}</span>
                        </div>
                    `;
                }).join('')
                : '<div class="empty-list">Keine Tabellen.</div>';

            tableListEl.querySelectorAll('.table-name').forEach(el =>
                el.addEventListener('click', () => pgQuickView(el.dataset.name)));
        }

        if (selTable) {
            selTable.innerHTML = '<option value="">Tabelle…</option>' +
                tables.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
        }

    } catch (err) {
        console.error('[pglite-ui] refreshPGliteTables:', err);
    }
}

/**
 * Schnellansicht einer PGlite-Tabelle (analog zu quickView in executor.js).
 */
async function pgQuickView(tableName) {
    state.currentTable   = tableName;
    state.currentSort    = { col: null, dir: 'ASC' };
    state.currentFilters = {};

    // UI-Highlighting aktualisieren
    document.querySelectorAll('#table-list .table-item').forEach(el => {
        const name = el.querySelector('.table-name')?.dataset.name;
        el.classList.toggle('active', name === tableName);
    });

    try {
        // SQL über PGlite-IPC ausführen
        const result = await window.api.pgQuery(
            `SELECT * FROM "${tableName}" LIMIT 500`,
            state.pgId
        );

        // Gleiche Render-Pipeline wie DuckDB nutzen
        const { showView, renderTableView } = await import('./views.js');
        showView('table');
        renderTableView(result);
        setStatus(`🐘 ${result.length} Zeilen aus "${tableName}"`, 'success');
    } catch (err) {
        setStatus('PGlite Fehler: ' + err, 'error');
    }
}

// ── Öffentliche API ────────────────────────────────────────────────────

export function getActivePgId()  { return activePgId; }
export function isPGliteMode()   { return state.pgMode === true; }

/**
 * PGlite-UI initialisieren — in app.js aufrufen.
 */
export async function initPGliteUI() {
    await renderPGliteList();
}