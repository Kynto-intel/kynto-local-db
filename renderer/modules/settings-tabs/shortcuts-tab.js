/* ── settings-tabs/shortcuts-tab.js ────────────────────────────────────────
   Verwaltung der Tastaturkürzel (Shortcuts)
   ────────────────────────────────────────────────────────────────────────── */
const SHORTCUTS = {
    'shortcut-execute':      ['execute', 'F5'],
    'shortcut-format':       ['format', 'Shift+Alt+F'],
    'shortcut-save':         ['save', 'Ctrl+S'],
    'shortcut-magic-search': ['magicSearch', 'Ctrl+K'],
    'shortcut-find':         ['find', 'Ctrl+F'],
    'shortcut-replace':      ['replace', 'Ctrl+H'],
    'shortcut-sidebar':      ['toggleSidebar', 'Ctrl+B'],
    'shortcut-new-query':    ['newQuery', 'Ctrl+N']
};

export const shortcutsTab = {
    name: 'shortcuts',
    id: 'pane-shortcuts',
    init: () => {},

    async load(settings) {
        const s = settings.shortcuts || {};
        for (const [id, [key, def]] of Object.entries(SHORTCUTS)) {
            const el = document.getElementById(id);
            if (el) el.value = s[key] || def;
        }
    },

    save() {
        const shortcuts = {};
        for (const [id, [key, def]] of Object.entries(SHORTCUTS))
            shortcuts[key] = document.getElementById(id)?.value || def;
        return { shortcuts };
    },

    async apply(settings) {
        console.info('[Shortcuts] Applied:', settings.shortcuts);
    }
};