/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Storage Settings Tab Module                                             │
 * │ Verwaltet: Media Path, Storage-Einstellungen                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

export const storageTab = {
    name: 'storage',
    id: 'pane-storage',

    /**
     * Initialisiert Event-Listener
     */
    init() {
        const btnBrowseStorage = document.getElementById('btn-browse-storage');
        if (btnBrowseStorage) {
            btnBrowseStorage.addEventListener('click', async () => {
                try {
                    const path = await window.api.selectFolder();
                    if (path) {
                        const input = document.getElementById('setting-storage-mediaPath');
                        if (input) input.value = path;
                    }
                } catch (err) {
                    console.error('Fehler beim Öffnen des Ordner-Dialogs:', err);
                    setStatus('Konnte Ordner-Dialog nicht öffnen.', 'error');
                }
            });
        }
    },

    /**
     * Lädt die Storage-Einstellungen
     */
    async load(settings) {
        const storage = settings.storage || {};

        const mediaPathInput = document.getElementById('setting-storage-mediaPath');
        if (mediaPathInput) mediaPathInput.value = storage.mediaPath || '';
    },

    /**
     * Speichert die Storage-Einstellungen
     */
    save(formData) {
        return {
            storage: {
                mediaPath: formData.get('setting-storage-mediaPath')?.trim() || ''
            }
        };
    },

    /**
     * Wendet die Storage-Einstellungen an
     */
    async apply(settings) {
        if (!settings.storage) return;
        state.storageSettings = { ...settings.storage };
    }
};
