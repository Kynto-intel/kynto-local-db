/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Editor Settings Tab Module                                              │
 * │ Verwaltet: Font Size, Line Numbers, Autocomplete                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';

export const editorTab = {
    name: 'editor',
    id: 'pane-editor',

    /**
     * Initialisiert Event-Listener für den Editor Tab
     */
    init() {
        const fontSizeInput = document.getElementById('setting-editor-fontSize');
        
        if (fontSizeInput) {
            fontSizeInput.addEventListener('change', (e) => {
                const fontSize = Math.max(8, Math.min(72, parseInt(e.target.value) || 14));
                document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
                document.documentElement.style.setProperty('--table-row-height', `${fontSize + 18}px`);
                
                if (state.editor) {
                    state.editor.updateOptions({ fontSize });
                    setTimeout(() => state.editor.layout(), 50);
                }
            });
        }
    },

    /**
     * Lädt die Editor-Einstellungen
     */
    async load(settings) {
        const editor = settings.editor || {};

        const fontSizeInput = document.getElementById('setting-editor-fontSize');
        const lineNumbersInput = document.getElementById('setting-editor-lineNumbers');
        const autocompleteInput = document.getElementById('setting-editor-autocomplete');

        if (fontSizeInput) fontSizeInput.value = editor.fontSize || 14;
        if (lineNumbersInput) lineNumbersInput.checked = editor.lineNumbers !== false;
        if (autocompleteInput) autocompleteInput.checked = editor.autocomplete !== false;
    },

    /**
     * Speichert die Editor-Einstellungen
     */
    save(formData) {
        return {
            editor: {
                fontSize: parseInt(formData.get('setting-editor-fontSize') || '14'),
                lineNumbers: formData.get('setting-editor-lineNumbers') === 'on',
                autocomplete: formData.get('setting-editor-autocomplete') === 'on'
            }
        };
    },

    /**
     * Wendet die Editor-Einstellungen an
     */
    async apply(settings) {
        if (!settings.editor) return;

        const fontSize = Math.max(8, Math.min(72, parseInt(settings.editor.fontSize) || 14));

        state.editorSettings = { ...settings.editor, fontSize };
        
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
        document.documentElement.style.setProperty('--table-row-height', `${fontSize + 18}px`);

        if (state.editor) {
            const showLines = settings.editor.lineNumbers !== false;
            state.editor.updateOptions({
                lineNumbers: showLines ? 'on' : 'off',
                fontSize: fontSize
            });
            setTimeout(() => state.editor.layout(), 50);
        }
    }
};
