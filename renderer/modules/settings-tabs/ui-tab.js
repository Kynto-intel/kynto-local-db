/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ UI Settings Tab Module                                                  │
 * │ Verwaltet: Theme, Language, Sidebar, UI Scroll                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';
import { applyTheme, loadUISettings } from '../ui.js';
import { setStatus } from '../utils.js';

export const uiTab = {
    name: 'ui',
    id: 'pane-ui',
    
    /**
     * Initialisiert Event-Listener für den UI Tab
     */
    init() {
        const themeSelect = document.getElementById('setting-theme');
        const languageSelect = document.getElementById('setting-language');

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                state.isDark = (e.target.value === 'dark');
                applyTheme(state.isDark);
            });
        }

        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                if (window.languageSwitcher?.switchLanguage) {
                    window.languageSwitcher.switchLanguage(e.target.value);
                }
            });
        }
    },

    /**
     * Lädt die UI-Einstellungen aus der Datei
     */
    async load(settings) {
        const ui = settings.ui || {};
        
        const themeSelect = document.getElementById('setting-theme');
        const languageSelect = document.getElementById('setting-language');
        const sidebarCheckbox = document.getElementById('setting-sidebar');
        const virtualScrollCheckbox = document.getElementById('setting-ui-virtualScrolling');

        if (themeSelect) themeSelect.value = settings.theme || 'dark';
        if (languageSelect) languageSelect.value = settings.language || 'en';
        if (sidebarCheckbox) sidebarCheckbox.checked = !!ui.sidebar;
        if (virtualScrollCheckbox) virtualScrollCheckbox.checked = !!ui.virtualScrolling;
    },

    /**
     * Speichert die UI-Einstellungen
     */
    save(formData) {
        return {
            theme: formData.get('setting-theme') || 'dark',
            language: formData.get('setting-language') || 'en',
            ui: {
                sidebar: formData.get('setting-sidebar') === 'on',
                virtualScrolling: formData.get('setting-ui-virtualScrolling') === 'on'
            }
        };
    },

    /**
     * Wendet die Einstellungen an
     */
    async apply(settings) {
        if (settings.theme) {
            state.isDark = (settings.theme === 'dark');
            applyTheme(state.isDark);
        }

        if (settings.language && window.languageSwitcher?.switchLanguage) {
            window.languageSwitcher.switchLanguage(settings.language);
        }
    }
};
