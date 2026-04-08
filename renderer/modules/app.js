/* ══════════════════════════════════════════════════════════════════════
   modules/app.js  — Zentraler Einstiegspunkt
   ══════════════════════════════════════════════════════════════════════ */

import { state }                                          from './state.js';
import { initEditor, setExecCallback, refreshEditor }     from './editor.js';
import {
    refreshDBList, refreshTableList,
    initDBButtons, initRenameModal, initRenameDBModal,
    setSidebarCallbacks, restoreRemoteState,
    setPGliteCallback
}                                                          from './sidebar.js';
import { execSQL, quickView, initBuilderButtons, setExecutorCallbacks } from './executor.js';
import { esc }                                             from './utils.js';
import { initActionBar }                                   from './action-bar.js';
import { 
    showView, initViewTabs, clearResults, initCellModal,
    openTableInEditor, handleRealtimeUpdate, showDashboard
} from './views.js';
import { initSettings }                                    from './settings.js';
import {
    loadHistory, initHistoryControls,
    loadFavorites, initFavoriteControls
}                                                          from './history.js';
import { initImportControls, initExportControls }          from './io.js';
import { newTab, initTabsDragAndDrop, setTabActivateCallback } from './tabs.js';
import { initUIControls, loadUISettings }                  from './ui.js';
import { initVisualizer, setVisualizerRefresh }            from './visualizer.js';
import { initAISidebar }                                   from './ai.js';
import { initPGliteUI, switchToPGlite, createPGliteDB }    from './pglite-ui.js';
import { initSyncCenter }                                  from './sync-center.js';
import { initModeSwitcher }                                from './mode-switcher.js';
import { KyntoGrid }                                       from './kyntoGrid.js';
import { KyntoRealtime }                                   from './useKyntoRealtime.js';
import { KyntoStorage }                                    from '../../src/components/Storage/KyntoStorage.js';

// ── Module global verfügbar machen ────────────────────────────────────────
window.KyntoGrid = KyntoGrid;
window.KyntoRealtime = KyntoRealtime;
window.handleRealtimeUpdate = handleRealtimeUpdate;
window.execSQL = execSQL;
window.openTableInEditor = openTableInEditor;window.showDashboard = showDashboard;
// ── Zirkuläre Abhängigkeiten per Callback auflösen ─────────────────────
setSidebarCallbacks(quickView, clearResults);
setPGliteCallback(switchToPGlite);
setExecCallback(execSQL);
setExecutorCallbacks(refreshTableList, showView, clearResults);
setTabActivateCallback((sql, tableName, source) => {
    console.log('[app.tab-callback] Tab activated - SQL exists:', !!sql, 'tableName:', tableName, 'source:', source);
    
    // Wenn tableName übergeben wurde (Tabellen-Tab), lade diese Tabelle DIREKT
    // Das verhindert Race Conditions
    if (tableName) {
        console.log('[app.tab-callback] Loading table:', tableName, 'from source:', source);
        openTableInEditor(tableName, null, 'table', source);
    } else if (sql && sql.trim()) {
        console.log('[app.tab-callback] Executing SQL:', sql.substring(0, 80));
        execSQL(sql);
    } else {
        console.log('[app.tab-callback] No SQL and no table, clearing results');
        clearResults(); // Leert die Anzeige bei leeren Tabs
    }
});
setVisualizerRefresh(() => {
    // Wenn Typ-Highlighting aktiviert/deaktiviert wird, Grid neu rendern
    if (typeof TableGridEditor?.renderCurrentData === 'function') {
        console.log('[app] Visualizer-Refresh: Rendern Grid neu mit magicEyeActive:', state.magicEyeActive);
        TableGridEditor.renderCurrentData();
    }
});

// ── App starten ────────────────────────────────────────────────────────
(async () => {
    try {
        console.log('[app] 0. Remote-State wiederherstellen');
        // Remote-State aus localStorage wiederherstellen
        restoreRemoteState();

        // CRITICAL: Initialize PGlite database BEFORE creating first tab
        // This ensures state.pgId is set before Dashboard tries to query
        console.log('[app] 1. PGlite UI initialisieren...');
        await initPGliteUI();
        console.log('[app] 2. DB List laden...');
        await refreshDBList();
        
        // If no pgId set yet, initialize from first available DB
        if (!state.pgId) {
            console.log('[app] 3. pgId nicht gesetzt - initialisiere...');
            const pgList = await window.api.pgListDBs().catch(() => []);
            if (pgList.length > 0) {
                state.pgId = pgList[0].id;
                state.activeDbId = pgList[0].id;  // For compatibility
                state.dbMode = 'pglite';
                console.log('[app] PGlite initialized:', state.pgId);
            }
        } else {
            console.log('[app] 3. pgId schon gesetzt:', state.pgId);
        }

        // 3.5 Storage-System initialisieren (Browser-seitig für OPFS)
        console.log('[app] 3.5 KyntoStorage initialisieren...');
        await KyntoStorage.init({
            adapter: 'opfs',
            pgQuery: window.api.pgQuery,
            pgId:    state.pgId,
        }).catch(err => console.error('[app] KyntoStorage Fehler:', err));

        // 1. SQL-Editor initialisieren und auf Abschluss warten (Wichtig für Monaco!)
        console.log('[app] 4. SQL-Editor initialisieren...');
    await initEditor();

    // Popout-Button
    document.getElementById('btn-popout-sql')?.addEventListener('click', () => {
        const area = document.querySelector('.editor-area');
        const isVisible = area.classList.toggle('sql-visible');
        if (isVisible && state.editor) {
            refreshEditor();
            state.editor.focus();
        }
    });

    // Storage Manager Button verknüpfen
    document.getElementById('btn-open-storage')?.addEventListener('click', () => {
        if (window.api && typeof window.api.openStorageManager === 'function') {
            window.api.openStorageManager();
        } else {
            console.error("Storage Manager API nicht gefunden. Überprüfe preload.js und main.js!");
        }
    });

    // Storage Manager Sichtbarkeit steuern (Events vom Main Process)
    if (window.api?.onShowStorageManager) {
        window.api.onShowStorageManager(() => {
            console.log('[app] Storage Manager Signal erhalten');
        });
    }

    // Dashboard Button im Header verknüpfen
    document.getElementById('btn-dashboard-header')?.addEventListener('click', () => {
        console.log('[app] Dashboard Header-Button geklickt');
        if (typeof showDashboard === 'function') {
            showDashboard();
        } else {
            console.error('[app] showDashboard nicht verfügbar');
        }
    });

    // 2. Ersten SQL-Tab anlegen
    newTab('', 'Query 1');

    // 3. Alle UI-Steuerelemente verdrahten
    initUIControls();        // Theme-Toggle, Sidebar, Builder-Toggle
    initVisualizer();        // Heatmap, Typ-Highlighting, Validierung
    initViewTabs();          // Tabelle / Chart / Schema Tabs
    initAISidebar();         // KI-Assistent (rechte Sidebar)
    await initSettings();    // Einstellungs-Modal
    initCellModal();         // Detail-Ansicht bei Doppelklick
    initActionBar();         // RLS, Indexberater etc.
    window.initActionBar = initActionBar; // Globale Verfügbarkeit für TableGridEditor & andere Module
    initBuilderButtons();    // Run-Button
    initRenameModal();       // Tabelle umbenennen
    initRenameDBModal();     // Datenbank umbenennen (Anzeigename)
    initFavoriteControls();  // Favorit speichern Modal
    initHistoryControls();   // Verlauf leeren
    initImportControls();    // Drag & Drop + Format-Buttons (nur für Import!)
    initExportControls();    // CSV / JSON / SQL-Dump
    initDBButtons();         // PGlite Datenbank öffnen

    // 4. Modus-Umschalter nach PGlite UI verfügbar ist
    initModeSwitcher();      // 🐘/☁️ Modus-Umschalter im Header

    // Tab-Drag-Target für Sidebar-Tabellen
    initTabsDragAndDrop(async (name) => {
        newTab('', name);
    });

    // 5. Gespeicherte UI-Einstellungen laden
    await loadUISettings();

    // 6. Persistierte Daten laden
    await loadHistory();
    await loadFavorites();

    // 6.5 Sync-Center (ProgressSQL Server-Verbindung) initialisieren
    await initSyncCenter();

    // 6.6 Datenbank-Liste aktualisieren (falls Remote-DB auto-verbunden wurde)
    await refreshDBList();

    // 6.7 Sync-Center (ProgressSQL Server-Verbindung) und DB-Logik kombinieren
    // (database-selector entfernt - Modus wird über Sync-Center und sidebar verwaltet)

    // 7. Lade Tabellenliste (DBs sind schon geladen)
    console.log('[app] 7. Tabellenliste laden...');
    await refreshTableList();

    // 8. Zeige Dashboard als Startpunkt
    console.log('[app] 8. Dashboard zeigen...');
    showDashboard(true);  // ← Zeige All-Databases Dashboard beim Start
    console.log('[app] ✅ Initialisierung complete!');

    } catch (err) {
        console.error('[app] Fehler bei der Initialisierung:', err);
    }
})().catch(err => {
    console.error('[app] FATAL ERROR:', err);
    console.error(err.stack);
});