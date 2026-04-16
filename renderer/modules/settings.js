/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ REFACTORED: Settings Module (Main Coordinator)                          │
 * │ Lädt das Modal-Template und koordiniert alle Tab-Module                 │
 * │ Alle spezifischen Logiken sind in settings-tabs/ ausgelagert            │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from './state.js';
import { applyTheme, loadUISettings } from './ui.js';
import { refreshDBList, switchDB } from './sidebar/index.js';
import { setStatus } from './utils.js';
import { wireSyncEvents } from './sync-center.js';
import { initApiSettingsTab } from './settings-api-tab.js';
import { initMaintenanceTab } from '../../src/main/config/DBMaintenance/maintenance-ui.js';
import { initAllTabs, loadAllTabs, applyAllTabs, saveAllTabs } from './settings-tabs/index.js';
import { settings as templatesSettings } from './settings-tabs/templates-tab.js';

let settingsModal;

/**
 * Initialisiert das Einstellungs-Modal und alle Tabs
 */
export async function initSettings() {
    try {
        // Lade das HTML-Template
        const html = await window.api.readFile('renderer/templates/settings-modal.html');
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);

        // ⏸️ updateDOM() nicht hier aufrufen - wird zentral durch app.js aufgerufen

        // CSS für Vorlagen-Bereich
        const style = document.createElement('style');
        style.id = 'settings-custom-tpl-styles';
        style.textContent = `
            #settings-tpl-list {
                max-height: 600px !important;
                overflow-y: auto;
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--surface2);
            }
        `;
        document.head.appendChild(style);

        // Modal-Referenz
        settingsModal = document.getElementById('settings-modal');
        const settingsCancel = document.getElementById('settings-cancel');
        const settingsSave = document.getElementById('settings-save');
        const btnCreateDB = document.getElementById('settings-create-db');
        const btnOpenSettings = document.getElementById('btn-settings') || 
                               document.getElementById('btn-open-settings');

        // ═════════════════════════════════════════════════════════════════
        // TAB-Navigation einrichten
        // ═════════════════════════════════════════════════════════════════
        const navItems = document.querySelectorAll('.settings-sidebar .nav-item');
        const panes = document.querySelectorAll('.settings-pane');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                navItems.forEach(i => i.classList.toggle('active', i === item));
                panes.forEach(p => p.classList.toggle('active', p.id === target));
            });
        });

        // ═════════════════════════════════════════════════════════════════
        // ALLE TABS INITIALISIEREN (von den Tab-Modulen)
        // ═════════════════════════════════════════════════════════════════
        initAllTabs();

        // Externe Tabs (noch nicht in settings-tabs/ da sie früher schon existierten)
        wireSyncEvents();
        initApiSettingsTab();
        initMaintenanceTab();

        // ═════════════════════════════════════════════════════════════════
        // BUTTON-EVENTS
        // ═════════════════════════════════════════════════════════════════

        // Einstellungen beim Start anwenden
        const currentSettings = await window.api.loadSettings();
        applySettings(currentSettings);
        
        // WICHTIG: Auch die Tab-Felder mit den Werten befüllen für später
        // wenn der User das Modal öffnet
        await loadAllTabs(currentSettings).catch(err => 
            console.error('[settings] Fehler beim Load aller Tabs beim Start:', err)
        );

        // Öffnen Button
        if (btnOpenSettings) {
            btnOpenSettings.addEventListener('click', async () => {
                await loadSettingsUI();
                settingsModal.classList.add('open');
            });
        }

        // Neue DB erstellen
        if (btnCreateDB) {
            btnCreateDB.addEventListener('click', async () => {
                const id = await window.api.createDB();
                if (id) {
                    await refreshDBList();
                    await switchDB(id);
                    settingsModal.classList.remove('open');
                }
            });
        }

        // Sync-Center Button
        document.getElementById('btn-open-sync-center')?.addEventListener('click', () => {
            const navSync = document.querySelector('.nav-item[data-target="pane-sync"]');
            if (navSync) navSync.click();
        });

        // Speichern & Abbrechen
        settingsCancel.addEventListener('click', () => settingsModal.classList.remove('open'));
        settingsSave.addEventListener('click', saveSettingsUI);
        settingsModal.addEventListener('click', e => {
            if (e.target === settingsModal) settingsModal.classList.remove('open');
        });

    } catch (err) {
        console.error('Fehler beim Initialisieren der Settings:', err);
    }
}

/**
 * Wendet Einstellungen sofort an die UI und den Editor an
 */
export function applySettings(s) {
    if (!s || typeof s !== 'object') return;

    // 1. Theme
    if (s.theme) {
        state.isDark = (s.theme === 'dark');
        applyTheme(s.theme === 'dark');
    }

    // 2. Language
    if (s.language && window.languageSwitcher?.switchLanguage) {
        window.languageSwitcher.switchLanguage(s.language);
    }

    // Alle Tabs anwenden
    applyAllTabs(s).catch(err => console.error('Fehler beim Anwenden der Tabs:', err));
}

/**
 * Lädt die gespeicherten Einstellungen und befüllt die UI
 */
async function loadSettingsUI() {
    try {
        const s = await window.api.loadSettings();
        
        // Alle Tabs laden
        await loadAllTabs(s);
        
    } catch (err) {
        console.error('Fehler beim Laden der Settings UI:', err);
    }
}

/**
 * Speichert die aktuellen Werte aus der UI
 */
async function saveSettingsUI() {
    try {
        console.log('[settings] Speichern gestartet...');
        
        // 🔧 WICHTIG: Erst die aktuellen kompletten Settings laden!
        const currentSettings = await window.api.loadSettings();
        
        // Schritt 1: FormData mit allen Input-Elementen aufbauen
        const formData = new FormData();
        settingsModal.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
            if (el.type === 'checkbox') {
                formData.set(el.id, el.checked ? 'on' : 'off');
            } else if (el.value) {
                formData.set(el.id, el.value);
            }
        });

        console.log('[settings] FormData erfasst:', Object.fromEntries(formData));

        // Schritt 2: Alle Tabs ihre Speicherfunktionen aufrufen lassen
        const tabData = saveAllTabs(formData);
        
        // 🔧 Schritt 3: INTELLIGENTER Merge - behalte sensitive Settings wenn nicht aktualisiert
        // Wenn tabData keine speziellen database-einstellungen hat, behalte die aktuellen
        const mergedData = {
            ...currentSettings,
            ...tabData,
            // Nested Object Merges - aber mit Protection für sensitive Daten
            ui: { ...(currentSettings.ui || {}), ...(tabData.ui || {}) },
            editor: { ...(currentSettings.editor || {}), ...(tabData.editor || {}) },
            ai: { ...(currentSettings.ai || {}), ...(tabData.ai || {}) },
            apis: { ...(currentSettings.apis || {}), ...(tabData.apis || {}) },
            templates: { ...(currentSettings.templates || {}), ...(tabData.templates || {}) },
            storage: { ...(currentSettings.storage || {}), ...(tabData.storage || {}) },
            // 🚨 KRITISCH: Preserve Database wenn nicht vom TabData editiert
            database: tabData.database && (tabData.database.postgresqlConnectionString !== "" || tabData.database.activeType === "postgresql") 
                ? { ...(currentSettings.database || {}), ...tabData.database }
                : currentSettings.database
        };

        console.log('[settings] Endgültige Daten zum Speichern:', mergedData);
        
        // Schritt 4: Über IPC speichern
        const result = await window.api.saveSettings(mergedData);
        console.log('[settings] Speicher-Ergebnis:', result);
        
        // Schritt 5: Einstellungen anwenden
        applySettings(mergedData);

        // Schritt 6: UI aktualisieren
        settingsModal.classList.remove('open');
        setStatus('✅ Einstellungen gespeichert.', 'success');
        await loadUISettings();

    } catch (err) {
        console.error('❌ Fehler beim Speichern der Einstellungen:', err);
        setStatus('❌ Fehler beim Speichern!', 'error');
    }
}

/**
 * Export für externe Nutzung (z.B. für SQL Templates)
 */
export const settings = {
    getTemplates: () => templatesSettings.getTemplates(),
    getQuickstarts: () => templatesSettings.getQuickstarts()
};
