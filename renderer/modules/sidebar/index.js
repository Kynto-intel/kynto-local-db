/* ── sidebar/index.js ──────────────────────────────────────────────
   Main Entry Point: Re-exports aller öffentlichen Funktionen
   Callbacks werden hier gesetzt
   ──────────────────────────────────────────────────────────────── */

// ── Initialisierung ────────────────────────────────────────────────
import { initPersistenceState, restoreRemoteState } from './persistence.js';

// Initialisiere Persistence beim Laden
initPersistenceState();

// ── Re-exports: DB-List ────────────────────────────────────────────
export {
    refreshDBList,
    switchDB,
    switchToPGlite,
    switchToRemote,
    initDBButtons,
    initRenameDBModal,
    openRenameDBModal,
    setClearResultsCallback,
    setQuickViewCallback,
} from './db-list.js';

// ── Re-exports: Table-List ────────────────────────────────────────
export { refreshTableList, setTableListCallbacks, dropTable, initRenameModal, openRenameTableModal as openRenameModal } from './table-list.js';

// ── Re-exports: Persistence ───────────────────────────────────────
export {
    saveRemoteConnection,
    loadRemoteConnection,
    saveDBName,
    loadDBNames,
    getDisplayName,
    saveTableColor,
    saveTableOrder,
    restoreRemoteState,
} from './persistence.js';

// ── Re-exports: Search ────────────────────────────────────────────
export { initSidebarSearch } from './search.js';

// ── Public API: Callbacks setzen ───────────────────────────────────
/**
 * Setzt die Callbacks für Quick-View und Clear-Results
 * @param {Function} qv - Quick-View Callback
 * @param {Function} cr - Clear-Results Callback
 */
export async function setSidebarCallbacks(qv, cr) {
    const { setQuickViewCallback, setClearResultsCallback } = await import('./db-list.js');
    const { setTableListCallbacks } = await import('./table-list.js');

    setClearResultsCallback(cr);
    setQuickViewCallback(qv);
    setTableListCallbacks(qv, cr);
}

// ── Abwärtskompatibilität ─────────────────────────────────────────
export function setPGliteCallback() {
    // Legacy - bereits integriert in setTableListCallbacks
}

export function setRemoteCallback() {
    // Legacy - bereits integriert in setTableListCallbacks
}
