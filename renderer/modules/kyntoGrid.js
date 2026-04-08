/* ── modules/kyntoGrid.js ──────────────────────────────────────────────────
   KyntoGrid – Realtime-fähige Tabellen-Komponente für PostgreSQL.
   Reines Vanilla JS, ersetzt den React-basierten Ansatz vollständig.

   Verantwortlichkeiten:
     • Bindet KyntoRealtime an eine Tabelle wenn diese geöffnet wird
     • Steuert Start/Stop des Realtime-Listeners beim Tab-Wechsel
     • Zeigt Realtime-Status in der Action-Bar an
     • Integriert sich nahtlos in Kyntos views.js / action-bar.js

   Verwendung (wird von views.js / openTableInEditor aufgerufen):
     KyntoGrid.attach(entity, schema)   → startet Realtime wenn btn-realtime aktiv
     KyntoGrid.detach()                 → stoppt Realtime

   Der btn-realtime Button in action-bar.js steuert ob Realtime aktiv ist.
   ────────────────────────────────────────────────────────────────────────── */

import { state }     from './state.js';
import { setStatus } from './utils.js';
import { KyntoRealtime } from './useKyntoRealtime.js';
import { EMPTY_OBJ, EMPTY_ARR, noop } from '../../src/lib/void.js';
import { isNonNullable } from '../../src/lib/isNonNullable.js';
import { KyntoEvents } from '../../src/lib/kynto-events.js';

// ── Konfiguration ──────────────────────────────────────────────────────────

const CONFIG = {
    /** Standard-Polling-Intervall - SCHNELL für flüssiges Realtime */
    pollInterval:     500,      // schneller: 500ms statt 3000ms
    /** Minimales Intervall (verhindert DB-Spam) */
    minInterval:      100,
    /** Maximales Intervall */
    maxInterval:     30000,
    /** Trigger automatisch installieren bei Aktivierung */
    autoInstallTrigger: false,
    /** Debounce-Zeit für Reload (verhindert mehrfache Updates schnell hintereinander) */
    debounceMs:       250,
};

// ── Öffentliche API ────────────────────────────────────────────────────────

export const KyntoGrid = {

    /**
     * Bindet Realtime-Beobachtung an eine Tabelle.
     * Wird von openTableInEditor in views.js aufgerufen.
     *
     * @param {{ name: string, schema: string, entity_type: string }} entity
     * @param {boolean} [forceStart] – Startet auch wenn btn-realtime aus ist
     */
    async attach(entity, forceStart = false) {
        console.log('[KyntoGrid.attach] Aufruf mit entity:', entity?.name, 'forceStart:', forceStart);
        
        if (!isNonNullable(entity?.name)) {
            console.warn('[KyntoGrid.attach] Keine Tabelle angegeben');
            return;
        }

        // Alten Listener sauber beenden
        this.detach();

        const table  = entity.name;
        const schema = entity.schema || 'public';

        // Nur starten wenn Realtime im State aktiv ist ODER forceStart
        if (!state.realtimeActive && !forceStart) {
            console.debug(`[KyntoGrid.attach] Realtime inaktiv – kein Listener für ${table}.`);
            return;
        }

        console.info(`[KyntoGrid.attach] Starte Realtime für ${schema}.${table}`);

        try {
            await KyntoRealtime.start({
                table,
                schema,
                interval:       CONFIG.pollInterval,
                installTrigger: CONFIG.autoInstallTrigger,
                onReload:       _reloadGrid || noop,
            });

            console.log('[KyntoGrid.attach] KyntoRealtime.start erfolgreich');

            // Status-Badge aktualisieren
            _updateRealtimeBadge(true);
        } catch (err) {
            console.error('[KyntoGrid.attach] Fehler beim Start:', err);
            setStatus(`Realtime-Fehler: ${err.message}`, 'error');
        }
    },

    /**
     * Trennt den Realtime-Listener.
     * Wird aufgerufen wenn Tabelle gewechselt oder Dashboard geöffnet wird.
     */
    detach() {
        if (KyntoRealtime.isRunning()) {
            KyntoRealtime.stop();
            _updateRealtimeBadge(false);
            console.info('[KyntoGrid] Detach: Realtime gestoppt.');
        }
    },

    /**
     * Schaltet Realtime für die aktuelle Tabelle ein/aus.
     * Wird von btn-realtime in action-bar.js aufgerufen.
     */
    async toggle() {
        if (KyntoRealtime.isRunning()) {
            state.realtimeActive = false;
            this.detach();
            setStatus('Echtzeit-Synchronisierung gestoppt', 'info');
        } else {
            state.realtimeActive = true;
            const entity = {
                name:   state.currentTable,
                schema: state.currentSchema || 'public',
            };
            await this.attach(entity, true);
            setStatus(
                KyntoRealtime.isListening()
                    ? `✨ Flüssiges Realtime: LISTEN/NOTIFY aktiv (${entity.name})`
                    : `⚡ Realtime mit 500ms Polling aktiv (${entity.name})`,
                'success'
            );
        }

        // Action-Bar neu zeichnen damit btn-realtime den korrekten Status zeigt
        if (typeof window.initActionBar === 'function') {
            window.initActionBar();
        }
    },

    /**
     * Ändert das Polling-Intervall zur Laufzeit.
     * @param {number} ms
     */
    setInterval(ms) {
        CONFIG.pollInterval = Math.max(CONFIG.minInterval, Math.min(CONFIG.maxInterval, ms));
        // Neustart wenn aktiv
        if (KyntoRealtime.isRunning()) {
            const tbl = KyntoRealtime.currentTable();
            this.attach({ name: tbl, schema: state.currentSchema || 'public' }, true);
        }
    },

    /**
     * Installiert den PostgreSQL NOTIFY-Trigger auf der aktuellen Tabelle.
     * Ermöglicht echtes Push-Realtime statt Polling.
     */
    async installTrigger() {
        if (!state.currentTable) {
            setStatus('Keine Tabelle aktiv.', 'error');
            return;
        }
        await KyntoRealtime.installTrigger(
            state.currentSchema || 'public',
            state.currentTable
        );
    },

    /**
     * Entfernt den NOTIFY-Trigger von der aktuellen Tabelle.
     */
    async removeTrigger() {
        if (!state.currentTable) return;
        await KyntoRealtime.removeTrigger(
            state.currentSchema || 'public',
            state.currentTable
        );
    },

    /** Manuell eine Änderung signalisieren (z.B. nach eigenem INSERT/UPDATE) */
    notifyChange(table, operation = 'MANUAL') {
        KyntoEvents.notify(
            table ?? state.currentTable,
            operation,
            state.currentSchema || 'public'
        );
    },

    /** Gibt aktuellen Status zurück */
    status() {
        return {
            running:   KyntoRealtime.isRunning(),
            listening: KyntoRealtime.isListening(),
            table:     KyntoRealtime.currentTable(),
            interval:  CONFIG.pollInterval,
            mode:      KyntoRealtime.isListening() ? 'pg_notify' : 'polling',
        };
    },
};

// Globaler Zugriff
window.KyntoGrid = KyntoGrid;

// ── REALTIME EVENT LISTENER: Neue Zeilen hinzufügen ────────────────────────
// Wenn KyntoRealtime neue Zeilen findet, werden sie hier direkt ins Grid eingefügt
window.addEventListener('kynto:realtime-update', async (event) => {
    const { type, table, newRows, rowCount } = event.detail || EMPTY_OBJ;
    const rowsToAdd = newRows || EMPTY_ARR;
    
    console.log(`[KyntoGrid Realtime Listener] Event erhalten: ${type} für ${table}, ${rowsToAdd.length} neue Zeilen`);
    
    // Nur verarbeiten wenn wir die gleiche Tabelle anschauen
    if (table === state.currentTable && type === 'INSERT' && rowsToAdd.length > 0) {
        try {
            // Rufe handleRealtimeUpdate aus views.js auf um neue Zeilen einzufügen
            if (typeof window.handleRealtimeUpdate === 'function') {
                console.log('[KyntoGrid Realtime] Füge neue Zeilen ins Grid ein...');
                window.handleRealtimeUpdate(rowsToAdd);
                
                // Visuelle Indikation - neue Zeilen werden mit Highlight eingefügt
                setStatus(`✨ ${rowsToAdd.length} neue Zeile(n) hinzugefügt - Echtzeit!`, 'success');
            } else {
                console.log('[KyntoGrid Realtime] handleRealtimeUpdate nicht verfügbar, nutze Fallback');
                // Fallback: kurzer Refresh wenn direct append nicht möglich
                if (typeof window.openTableInEditor === 'function') {
                    await window.openTableInEditor(table, state.currentSchema);
                }
            }
        } catch (err) {
            console.error('[KyntoGrid Realtime Listener] Fehler beim Anhängen:', err);
        }
    }
});

// ── Private Hilfsfunktionen ────────────────────────────────────────────────

/**
 * Lädt die Grid-Daten neu.
 * Nutzt openTableInEditor wenn verfügbar, sonst execSQL.
 */
async function _reloadGrid(table, schema) {
    try {
        if (typeof window.openTableInEditor === 'function') {
            await window.openTableInEditor(table, schema, state.currentTableType || 'table');
        } else if (typeof window.execSQL === 'function') {
            await window.execSQL(`SELECT * FROM "${schema}"."${table}" LIMIT 1000`);
        }
    } catch (err) {
        console.warn('[KyntoGrid] Reload fehlgeschlagen:', err.message);
    }
}

/**
 * Aktualisiert das Realtime-Badge / den btn-realtime Button.
 */
function _updateRealtimeBadge(active) {
    const btn = document.getElementById('btn-realtime');
    if (!btn) return;

    const mode = KyntoRealtime.isListening() ? 'LISTEN/NOTIFY' : 'Polling';

    if (active) {
        btn.style.color       = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
        btn.innerHTML = `📡 Echtzeit: AKTIV <span style="font-size:9px;opacity:0.6">(${mode})</span>`;
        btn.title = `Echtzeit aktiv via ${mode}. Klicken zum Deaktivieren.`;
    } else {
        btn.style.color       = '#ffffff';
        btn.style.borderColor = 'var(--border)';
        btn.innerHTML = '📡 Echtzeit inaktiv';
        btn.title = 'Echtzeit-Synchronisierung aktivieren.';
    }
}

// ── Integration: openTableInEditor Hook ───────────────────────────────────
// Dieser Hook wird SOFORT installiert (nicht DOMContentLoaded),
// um sicherzustellen, dass er aktiv ist, wenn openTableInEditor aufgerufen wird.

const installKyntoGridHook = () => {
    // Nur EINMAL installieren (check Flag)
    if (window.openTableInEditor?._kyntoWrapped) return;
    
    if (typeof window.openTableInEditor === 'function') {
        const _original = window.openTableInEditor;
        window.openTableInEditor = async function(tableName, schema, entityType) {
            console.log('[KyntoGrid Hook] openTableInEditor aufgerufen für:', tableName);
            
            KyntoGrid.detach();
            await _original.apply(this, arguments);
            
            if (state.realtimeActive) {
                console.log('[KyntoGrid Hook] Realtime aktiv, attach...');
                await KyntoGrid.attach({
                    name:        tableName,
                    schema:      schema || 'public',
                    entity_type: entityType || 'table',
                });
            }
            
            if (typeof window.initActionBar === 'function') {
                window.initActionBar();
            }
        };
        window.openTableInEditor._kyntoWrapped = true;
        console.debug('[KyntoGrid] openTableInEditor Hook installiert.');
    }
};

// Sofort versuchen zu installieren
installKyntoGridHook();

// Fallback: Bei Timeout nochmal versuchen (für späte verfügbar Machen)
setTimeout(installKyntoGridHook, 100);
setTimeout(installKyntoGridHook, 500);
