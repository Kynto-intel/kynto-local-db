/* ══════════════════════════════════════════════════════════════════════
   sync-center-progress.js
   
   Empfängt Live-Progress-Events vom Main-Process und zeigt sie in
   der UI an. Tabellen erscheinen live während des Syncs.
   
   FIX: Korrekte API-Aufruf-Signaturen (preload.js):
     syncPGliteToServer(pgId, cs, tables)  → pgId zuerst
     syncServerToLocal(cs, pgId, tables)   → cs zuerst
   ══════════════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────────────
const syncState = {
    running:     false,
    tables:      [],   // [{ name, status, rowsTotal, rowsDone, error }]
    totalTables: 0,
    pct:         0,
    lastMsg:     '',
};

// ── DOM-Elemente ───────────────────────────────────────────────────────
const EL = {
    progressBarContainer: () => document.getElementById('sync-progress-bar-container'),
    progressBar:          () => document.getElementById('sync-progress-bar'),
    progressLabel:        () => document.getElementById('sync-progress-label'),
    tableList:            () => document.getElementById('sync-table-list'),
};

// ── Live-Progress empfangen ────────────────────────────────────────────

function startListeningToSyncProgress() {
    // Alten Listener zuerst entfernen
    if (window.api?.offSyncProgress) {
        window.api.offSyncProgress();
    }

    // State zurücksetzen
    syncState.tables      = [];
    syncState.totalTables = 0;
    syncState.running     = true;
    syncState.pct         = 0;
    syncState.lastMsg     = 'Starte Synchronisation...';

    renderProgress();
    renderTableList();
    EL.progressBarContainer()?.style.setProperty('display', 'block', 'important');

    window.api.onSyncProgress((data) => {
        const { msg, pct, tableName, tableIndex, total, status,
                rowsDone, rowsTotal, error, done } = data;

        // Globalen Fortschritt aktualisieren
        syncState.pct     = pct ?? syncState.pct;
        syncState.lastMsg = msg || syncState.lastMsg;

        if (total) syncState.totalTables = total;

        // Tabelle im State aktualisieren oder hinzufügen
        if (tableName) {
            let entry = syncState.tables.find(t => t.name === tableName);
            if (!entry) {
                entry = { name: tableName, status: 'running', rowsDone: 0, rowsTotal: 0, error: null };
                syncState.tables.push(entry);
            }
            if (status !== undefined) entry.status    = status;
            if (rowsDone  != null)    entry.rowsDone  = rowsDone;
            if (rowsTotal != null)    entry.rowsTotal = rowsTotal;
            if (error)                entry.error     = error;
        }

        // Fertig?
        if (done) {
            syncState.running = false;
            syncState.pct     = 100;
            setTimeout(() => {
                EL.progressBarContainer()?.style.setProperty('display', 'none', 'important');
            }, 1500);
        }

        renderProgress();
        renderTableList();
    });
}

function stopListeningToSyncProgress() {
    if (window.api?.offSyncProgress) {
        window.api.offSyncProgress();
    }
    syncState.running = false;
    EL.progressBarContainer()?.style.setProperty('display', 'none', 'important');
}

// ── UI Render ──────────────────────────────────────────────────────────

function renderProgress() {
    const bar   = EL.progressBar();
    const label = EL.progressLabel();
    if (bar)   bar.style.width   = `${syncState.pct}%`;
    if (label) label.textContent = syncState.lastMsg;
}

function renderTableList() {
    const list = EL.tableList();
    if (!list) return;

    list.innerHTML = '';

    syncState.tables.forEach(t => {
        const row = document.createElement('div');
        row.className = `sync-table-row sync-table-row--${t.status}`;

        const icon = t.status === 'done'    ? '✓'
                   : t.status === 'error'   ? '✗'
                   : t.status === 'running' ? '⟳'
                   : '○';

        const progress = (t.rowsTotal > 0)
            ? `${t.rowsDone.toLocaleString()} / ${t.rowsTotal.toLocaleString()} Zeilen`
            : t.status === 'done' ? '0 Zeilen' : '';

        row.innerHTML = `
            <span class="sync-table-icon">${icon}</span>
            <span class="sync-table-name">${t.name}</span>
            <span class="sync-table-progress">${progress}</span>
            ${t.error ? `<span class="sync-table-error" title="${t.error}">Fehler: ${t.error}</span>` : ''}
        `;
        list.appendChild(row);
    });

    // Zur neuesten Zeile scrollen
    list.scrollTop = list.scrollHeight;
}

// ── CSS für die Tabellenliste ──────────────────────────────────────────
const SYNC_CSS = `
.sync-table-row { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 4px; font-size: 13px; transition: background 0.2s; }
.sync-table-row--running  { background: rgba(59, 130, 246, 0.1); color: #93c5fd; }
.sync-table-row--done     { background: rgba(34, 197, 94, 0.1);  color: #86efac; }
.sync-table-row--error    { background: rgba(239, 68, 68, 0.1);  color: #fca5a5; }
.sync-table-icon          { font-size: 14px; min-width: 16px; }
.sync-table-name          { flex: 1; font-family: monospace; }
.sync-table-progress      { color: #9ca3af; font-size: 11px; min-width: 140px; text-align: right; }
.sync-table-error         { color: #ef4444; font-size: 11px; cursor: help; }
`;

(function injectCSS() {
    if (document.getElementById('sync-progress-styles')) return;
    const style = document.createElement('style');
    style.id = 'sync-progress-styles';
    style.textContent = SYNC_CSS;
    document.head.appendChild(style);
})();

// ── Sync starten ──────────────────────────────────────────────────────
//
// FIX: Korrekte Reihenfolge der Parameter laut preload.js:
//   syncServerToLocal(cs, pgId, tables)  → connectionString zuerst, dann pgId
//   syncPGliteToServer(pgId, cs, tables) → pgId zuerst, dann connectionString

async function startPullFromServer(connectionString, pgId) {
    startListeningToSyncProgress();
    try {
        // KORREKT: syncServerToLocal(cs, pgId, tables) — cs zuerst laut preload.js
        const result = await window.api.syncServerToLocal(connectionString, pgId, null);
        console.log('[Sync] Pull Ergebnis:', result);
        return result;
    } catch (err) {
        console.error('[Sync] Pull Fehler:', err);
        return { ok: false, transferred: [], errors: [String(err.message || err)] };
    } finally {
        stopListeningToSyncProgress();
        if (typeof window.refreshTableList === 'function') {
            window.refreshTableList();
        }
    }
}

async function startGoLive(connectionString, pgId) {
    startListeningToSyncProgress();
    try {
        // KORREKT: syncPGliteToServer(pgId, cs, tables) — pgId zuerst laut preload.js
        const result = await window.api.syncPGliteToServer(pgId, connectionString, null);
        console.log('[Sync] Go-Live Ergebnis:', result);
        return result;
    } catch (err) {
        console.error('[Sync] Go-Live Fehler:', err);
        return { ok: false, transferred: [], errors: [String(err.message || err)] };
    } finally {
        stopListeningToSyncProgress();
    }
}

export { startPullFromServer, startGoLive };