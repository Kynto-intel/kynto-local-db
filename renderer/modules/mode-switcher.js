/* ══════════════════════════════════════════════════════════════════════
   modules/mode-switcher.js  —  Remote-Verbindungsanzeige im Header
   
   Zeigt NUR ob Remote verbunden ist oder nicht — kein Modus-Umschalter.
   Der Modus wird automatisch durch Klick in der Sidebar gesetzt.
   ══════════════════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { switchDB, switchToPGlite, switchToRemote } from './sidebar/index.js'; // Beibehalten, da diese Funktionen noch benötigt werden

export function initModeSwitcher() {
    // Startzustand
    state.dbMode = 'duck';
    state.pgMode = false;
    updateRemoteStatus();
}

// ── Remote-Status im Header aktualisieren ─────────────────────────────

export function updateRemoteStatus() {
    // Funktion bleibt bestehen, da sie von anderen Modulen aufgerufen wird,
    // aber ihr Inhalt wird geleert, da das Element nicht mehr existiert.
    return;
}

// ── switchMode bleibt als API für sync-center.js ──────────────────────
// (wird intern von sync-center aufgerufen nach erfolgreichem Connect)

export async function switchMode(mode) {
    if (mode === 'remote' && state.remoteConnectionString) {
        await switchToRemote(state.remoteConnectionString);
    } else if (mode === 'pglite' && state.pgId) {
        await switchToPGlite(state.pgId);
    } else if (mode === 'duck') {
        await switchDB(state.activeDbId);
    }
    updateRemoteStatus();
}

// updateLabel bleibt für Abwärtskompatibilität
export function updateLabel() { updateRemoteStatus(); }