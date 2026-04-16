/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Templates Settings Tab Module                                           │
 * │ Verwaltet: SQL Templates, Quickstarts                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';
import { setStatus, setEditorVal } from '../utils.js';
import { SQL_TEMPLATES } from '../SQLEditor/SQLTemplates/SQLEditor.queries.js';

/**
 * Zentrales Settings-Objekt für externe Nutzung
 */
export const settings = {
    getTemplates: () => SQL_TEMPLATES.filter(t => t.type === 'template'),
    getQuickstarts: () => SQL_TEMPLATES.filter(t => t.type !== 'template')
};

export const templatesTab = {

    /**
     * Initialisiert Event-Listener
     */
    init() {
        // wird von load() aufgerufen
    },

    /**
     * Lädt die Templates
     */
    async load(settings) {
        const tpl = settings.templates || {};

        const showQuickstartsInput = document.getElementById('setting-tpl-showQuickstarts');
        if (showQuickstartsInput) {
            showQuickstartsInput.checked = tpl.showQuickstarts !== false;
        }

        this.renderTemplatesList();
    },

    /**
     * Rendert die Templates-Liste
     */
    renderTemplatesList() {
        const tplList = document.getElementById('settings-tpl-list');
        if (!tplList) return;

        const templates = settings.getTemplates();
        const quickstarts = settings.getQuickstarts();
        const total = [...templates, ...quickstarts];

        tplList.innerHTML = total.length
            ? total.map(t => `
                <div class="settings-tpl-item" data-id="${t.id}" style="
                    font-size:11px; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05);
                    color:var(--text); display:flex; justify-content:space-between; align-items:center;
                    cursor:pointer; transition: background 0.2s;
                ">
                    <span>${t.type === 'template' ? '📄' : '⚡'} <strong>${t.title}</strong></span>
                    <span style="opacity:0.5; font-size:9px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:3px;">
                        ${t.type.toUpperCase()}
                    </span>
                </div>
            `).join('')
            : '<div class="desc">Keine Vorlagen in SQLEditor.queries.js gefunden.</div>';

        // Event-Listener
        tplList.querySelectorAll('.settings-tpl-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(255,255,255,0.05)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });

            item.addEventListener('click', () => {
                const tplId = item.dataset.id;
                const template = total.find(t => t.id === tplId);
                if (template) {
                    setEditorVal(state, template.sql);
                    if (window.showView) window.showView('editor');
                    setStatus(`Vorlage "${template.title}" geladen.`, 'success');
                }
            });
        });
    },

    /**
     * Speichert die Templates-Einstellungen
     */
    save(formData) {
        return {
            templates: {
                showQuickstarts: formData.get('setting-tpl-showQuickstarts') === 'on'
            }
        };
    },

    /**
     * Wendet die Templates-Einstellungen an
     */
    async apply(settings) {
        // Templates sind nur Einstellungen, keine echte "Anwendung"
    }
};
