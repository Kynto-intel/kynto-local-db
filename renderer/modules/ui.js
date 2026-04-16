/* ── modules/ui.js ────────────────────────────────────────────────────
   Theme-Wechsel, Sidebar/Builder-Toggle, UI-Einstellungen persistent.
   ──────────────────────────────────────────────────────────────────── */

import { state }          from './state.js';
import { setEditorTheme } from './editor.js'; // Import hinzugefügt
import { buildChart }     from './views/chart/index.js';

// ── Theme ──────────────────────────────────────────────────────────────

export function applyTheme(dark) {
    state.isDark = dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.getElementById('theme-toggle').textContent = dark ? '🌙' : '☀️';
    setEditorTheme(dark); // Editor-Theme anpassen
    
    // Optimierung 5: Chart erst im nächsten Frame neu bauen, 
    // damit die CSS-Variablen des neuen Themes bereits wirken.
    if (state.chartInst) requestAnimationFrame(() => buildChart());
}

// ── UI-Settings persistieren ───────────────────────────────────────────

export async function saveUISettings() {
    const sidebar    = document.getElementById('sidebar');
    const editorArea = document.querySelector('.editor-area');
    const favSection = document.getElementById('btn-toggle-fav')?.closest('.sb-section');
    const histSection = document.getElementById('btn-toggle-hist')?.closest('.sb-section');
    const systemSection = document.getElementById('btn-toggle-system')?.closest('.sb-section');
    
    await window.api.saveSettings({
        ui: {
            sidebar: sidebar.classList.contains('collapsed'),
            builder: editorArea.classList.contains('collapsed'),
            fav:     favSection?.classList.contains('collapsed') ?? false,
            hist:    histSection?.classList.contains('collapsed') ?? false,
            system:  systemSection?.classList.contains('collapsed') ?? false,
        },
        isDark:   state.isDark,
    }).catch(err => console.error('Fehler beim Speichern der UI-Settings:', err));
}

export async function loadUISettings() {
    const s = await window.api.loadSettings().catch(() => ({}));
    const ui = s.ui || {};

    const sidebar    = document.getElementById('sidebar');
    const editorArea = document.querySelector('.editor-area');

    if (ui.sidebar) sidebar.classList.add('collapsed');
    if (ui.builder) editorArea.classList.add('collapsed');
    if (ui.fav) {
        const sec = document.getElementById('btn-toggle-fav')?.closest('.sb-section');
        sec?.classList.add('collapsed');
    }
    if (ui.hist) {
        const sec = document.getElementById('btn-toggle-hist')?.closest('.sb-section');
        sec?.classList.add('collapsed');
    }
    if (ui.system) {
        const sec = document.getElementById('btn-toggle-system')?.closest('.sb-section');
        sec?.classList.add('collapsed');
    }
    if (typeof s.isDark === 'boolean') applyTheme(s.isDark);
}

// ── Event-Listener ─────────────────────────────────────────────────────

export function initUIControls() {
    const sidebar    = document.getElementById('sidebar');
    const editorArea = document.querySelector('.editor-area');

    // Theme
    document.getElementById('theme-toggle').addEventListener('click', () => {
        applyTheme(!state.isDark);
        saveUISettings();
    });

    // Sidebar togglen
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        delete sidebar.dataset.autoOpened; // Verhindert Auto-Close nach manuellem Klick
        saveUISettings();
    });

    // Auto-Open Sidebar bei Annäherung an den linken Bildschirmrand
    document.addEventListener('mousemove', (e) => {
        if (sidebar.classList.contains('collapsed') && e.clientX <= 40) {
            sidebar.classList.remove('collapsed');
            sidebar.dataset.autoOpened = 'true';
        }
    });

    // Auto-Close Sidebar wenn die Maus den Bereich verlässt
    sidebar.addEventListener('mouseleave', () => {
        if (sidebar.dataset.autoOpened === 'true') {
            sidebar.classList.add('collapsed');
            delete sidebar.dataset.autoOpened;
        }
    });

    // Builder (Editor) togglen
    const btnBuilder = document.getElementById('btn-toggle-builder');
    if (btnBuilder) {
        btnBuilder.addEventListener('click', () => {
            editorArea.classList.toggle('collapsed');
            saveUISettings();
        });
    }

    // Sidebar-Sektionen togglen
    ['btn-toggle-fav', 'btn-toggle-hist', 'btn-toggle-system'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            btn.closest('.sb-section').classList.toggle('collapsed');
            saveUISettings();
        });
    });

    // Checkbox-Styles per JS injizieren (kein extra CSS-File nötig)
    const style = document.createElement('style');
    style.textContent = `
        /* Sidebar im eingeklappten Zustand komplett auf 0 setzen */
        #sidebar.collapsed {
            width: 0 !important;
            min-width: 0 !important;
            overflow: hidden;
            border-right: none !important;
        }
        .custom-select-check {
            appearance: none; -webkit-appearance: none;
            width: 14px; height: 14px;
            border: 1.5px solid var(--muted); border-radius: 3px;
            background: transparent; cursor: pointer;
            position: relative; display: inline-block;
            vertical-align: middle; transition: all 0.1s;
        }
        .custom-select-check:checked {
            background: var(--accent); border-color: var(--accent);
        }
        .custom-select-check:checked::after {
            content: ''; position: absolute; left: 4px; top: 1px;
            width: 3px; height: 6px;
            border: solid #000; border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }
        .custom-select-check:hover { border-color: var(--accent); }
    `;
    document.head.appendChild(style);
}