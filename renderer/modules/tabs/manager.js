/* ── tabs/manager.js ──────────────────────────────────────────────────
   Tab State Management & Business Logic (Native, kein electron-tabs)
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { uid } from '../utils.js';
import { getEditorVal, setEditorVal } from '../utils.js';

export const tabManager = {
    tabs: [],
    activeTabId: null,
    onActivate: () => {},

    createTab(sql = '', title = null, source = null) {
        const id = uid();
        const isTableTab = title && !title.match(/^Query\s*\d+$/i);
        
        const tab = {
            id,
            title: title || `Query ${this.tabs.length + 1}`,
            sql,
            tableName: isTableTab ? title : null,
            source: source || (isTableTab ? state.dbMode : null)  // Speichere source mit Tab
        };

        this.tabs.push(tab);
        this.activeTabId = id;
        
        state.sqlTabs = this.tabs;
        state.activeTab = id;

        return tab;
    },

    activateTab(id) {
        console.log('[tabs.manager] activateTab START - id:', id, 'currentActiveTab:', this.activeTabId);
        const currentTab = this.getTab(this.activeTabId);
        
        if (currentTab) {
            // ✅ WICHTIG: Nur den SQL speichern, NICHT die tableName!
            // Die tableName soll konstant bleiben für jeden Tab
            // Sie wird nur in openTableInEditor() aktualisiert wenn eine neue Tabelle geladen wird
            currentTab.sql = getEditorVal(state);
            console.log('[tabs.manager] Speichere SQL für alten Tab ID:', this.activeTabId);
        }

        const tab = this.getTab(id);
        console.log('[tabs.manager] Neue Tab zum Aktivieren:', tab ? { id: tab.id, title: tab.title, tableName: tab.tableName, source: tab.source } : 'NICHT GEFUNDEN');
        
        if (tab) {
            this.activeTabId = id;
            state.activeTab = id;
            console.log('[tabs.manager] state.activeTab setzen auf:', id);

            // Editor ZUERST aktualisieren
            setEditorVal(state, tab.sql || '');
            
            // ✅ WICHTIG: state.currentTable MUSS VOR dem Callback gesetzt sein!
            // Wenn es eine Tabelle ist, setze state.currentTable damit openTableInEditor() es abrufen kann
            if (tab.tableName) {
                state.currentTable = tab.tableName;
                console.log('[tabs.manager] Setze state.currentTable auf:', tab.tableName);
            } else {
                state.currentTable = null;
                console.log('[tabs.manager] SQL-Query Tab, kein tableName gesetzt');
            }

            // Dann Spalten-Metadaten
            if (tab.tableName && state.knownColumns && state.knownColumns[tab.tableName]) {
                state.currentCols = state.knownColumns[tab.tableName];
            } else {
                state.currentCols = [];
            }

            // Callback mit aktuellem SQL aufrufen (Editor ist jetzt aktualisiert)
            // WICHTIG: Wenn es ein Tabellen-Tab ist, pass die tableName UND source mit!
            // Das verhindert Race Conditions wenn schnell zwischen Tabs gewechselt wird
            if (tab.tableName) {
                // Für Tabellen-Tabs: onActivate(null, tableName, source)
                console.log('[tabs.manager] activateTab FERTIG - Rufe onActivate auf mit tableName:', tab.tableName, 'source:', tab.source);
                this.onActivate(null, tab.tableName, tab.source);
            } else {
                // Für SQL-Tabs: onActivate(sql)
                console.log('[tabs.manager] activateTab FERTIG - Rufe onActivate für SQL-Tab auf');
                this.onActivate(tab.sql || '');
            }
        }
    },

    closeTab(id) {
        if (this.tabs.length <= 1) return false;

        const idx = this.tabs.findIndex(t => t.id === id);
        if (idx === -1) return false;

        this.tabs.splice(idx, 1);
        state.sqlTabs = this.tabs;

        if (this.activeTabId === id) {
            const nextIdx = Math.min(idx, this.tabs.length - 1);
            this.activeTabId = this.tabs[nextIdx].id;
            state.activeTab = this.activeTabId;
        }

        return true;
    },

    getTab(id) {
        return this.tabs.find(t => t.id === id);
    },

    getTabs() {
        return [...this.tabs];
    },

    getActiveTab() {
        return this.getTab(this.activeTabId);
    },

    reorderTabs(fromIndex, toIndex) {
        const tab = this.tabs.splice(fromIndex, 1)[0];
        this.tabs.splice(toIndex, 0, tab);
        state.sqlTabs = this.tabs;
    },

    setOnActivateCallback(fn) {
        this.onActivate = fn;
    }
};
