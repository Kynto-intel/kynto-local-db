/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Database Settings Tab Module                                            │
 * │ Verwaltet: Auto Limit, Auto Checkpoint                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';

export const databaseTab = {
    name: 'database',
    id: 'pane-database',

    /**
     * Initialisiert Event-Listener
     */
    init() {
        // Listeners können hier hinzugefügt werden
    },

    /**
     * Lädt die Database-Einstellungen
     */
    async load(settings) {
        const db = settings.database || {};

        const autoLimitInput = document.getElementById('setting-db-autoLimit');
        const autoCheckpointInput = document.getElementById('setting-db-autoCheckpoint');

        if (autoLimitInput) autoLimitInput.value = db.autoLimit || 500;
        if (autoCheckpointInput) autoCheckpointInput.checked = db.autoCheckpoint !== false;
    },

    /**
     * Speichert die Database-Einstellungen
     */
    save(formData) {
        return {
            database: {
                autoLimit: parseInt(formData.get('setting-db-autoLimit') || '500'),
                autoCheckpoint: formData.get('setting-db-autoCheckpoint') === 'on',
                activeType: formData.get('setting-db-type') || 'pglite',
                postgresqlConnectionString: formData.get('setting-db-postgres-conn') || ''
            }
        };
    },

    /**
     * Wendet die Database-Einstellungen an
     */
    async apply(settings) {
        if (!settings.database) return;
        state.databaseSettings = { ...settings.database };
    }
};
