/* ══════════════════════════════════════════════════════════════════════
   database-selector.js  —  UI-Modul für Datenbank-Auswahl
   
   Ermöglicht dem Nutzer:
   - Zwischen PGlite und PostgreSQL zu wechseln
   - PostgreSQL-Verbindung zu konfigurieren
   - Status und Verbindungstest anzuzeigen
   ══════════════════════════════════════════════════════════════════════ */

import { state } from './state.js';

export const databaseSelector = {
    initialized: false,
    statusEl: null,
    modalEl: null,
    currentDb: null,

    /**
     * Initialisiert den Database-Selector
     */
    async initialize() {
        if (this.initialized) return;

        // Starte mit aktuellem Datenbank-Status
        await this.updateStatus();

        // Event-Listener für Settings ändern
        document.addEventListener('settings:changed', () => this.updateStatus());

        this.initialized = true;
        console.log('[DatabaseSelector] Initialisiert');
    },

    /**
     * Ruft den aktuellen Status der Datenbank ab
     */
    async updateStatus() {
        try {
            const status = await window.api.dbStatus();
            this.currentDb = status.activeDatabase;
            state.dbMode = status.activeDatabase?.type === 'postgresql' ? 'remote' : 'pglite';
            
            console.log('[DatabaseSelector] Status aktualisiert:', this.currentDb);
            
            // UI aktualisieren wenn Element existiert
            if (this.statusEl) {
                this.renderStatus();
            }
        } catch (err) {
            console.error('[DatabaseSelector] Fehler beim Status-Abruf:', err);
        }
    },

    /**
     * Rendert den Status-Anzeiger
     */
    renderStatus() {
        if (!this.statusEl) return;

        const type = this.currentDb?.type || 'unknown';
        const icon = type === 'postgresql' ? '🔗' : '💾';
        const label = type === 'postgresql' ? 'PostgreSQL' : 'PGlite';
        
        this.statusEl.innerHTML = `
            <div class="db-status">
                <span class="db-icon">${icon}</span>
                <span class="db-label">${label}</span>
                <button class="db-switch-btn" id="btn-db-settings">
                    ⚙️ Einstellungen
                </button>
            </div>
        `;
        
        // Event Listener hinzufügen (CSP-konform)
        const settingsBtn = this.statusEl.querySelector('#btn-db-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openModal());
        }
    },

    /**
     * Öffnet das Modal zur PostgreSQL-Konfiguration
     */
    openModal() {
        if (!this.modalEl) {
            this.createModal();
        }
        this.modalEl.style.display = 'flex';
        this.renderModal();
    },

    /**
     * Erstellt das Modal-HTML
     */
    createModal() {
        this.modalEl = document.createElement('div');
        this.modalEl.className = 'db-selector-modal';
        this.modalEl.innerHTML = `
            <div class="db-modal-content">
                <div class="db-modal-header">
                    <h2>Datenbankverbindung</h2>
                    <button class="close-btn" id="btn-modal-close">✕</button>
                </div>

                <div class="db-modal-body">
                    <div class="db-info-pglite">
                        <h3>📦 PGlite (Standard)</h3>
                        <p>Eingebettete PostgreSQL-Datenbank. Funktioniert offline, keine Konfiguration nötig.</p>
                        <button class="btn-primary" id="btn-use-pglite">
                            Verwende PGlite
                        </button>
                    </div>

                    <hr>

                    <div class="db-info-postgresql">
                        <h3>🔗 PostgreSQL (Remote Server)</h3>
                        <p>Verbinde zu einem externen PostgreSQL-Server für größere Datenmengen.</p>
                        
                        <div class="form-group">
                            <label for="pg-connection">Connection String:</label>
                            <input 
                                type="text" 
                                id="pg-connection" 
                                placeholder="postgresql://user:password@localhost:5432/dbname"
                                value=""
                            >
                            <small>Format: postgresql://user:pass@host:port/database</small>
                        </div>

                        <div class="form-actions">
                            <button class="btn-secondary" id="btn-test-pg">
                                🧪 Verbindung testen
                            </button>
                            <button class="btn-primary" id="btn-use-pg" disabled>
                                🔗 PostgreSQL verbinden
                            </button>
                        </div>

                        <div id="pg-test-result"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.modalEl);

        // Event Listener statt inline onclick (CSP-konform)
        this.modalEl.querySelector('#btn-modal-close').addEventListener('click', () => this.closeModal());
        this.modalEl.querySelector('#btn-use-pglite').addEventListener('click', () => this.switchToPGlite());
        this.modalEl.querySelector('#btn-test-pg').addEventListener('click', () => this.testPostgreSQL());
        this.modalEl.querySelector('#btn-use-pg').addEventListener('click', () => this.switchToPostgreSQL());
        this.modalEl.addEventListener('click', (e) => { 
            if (e.target === this.modalEl) this.closeModal(); 
        });

        // CSS hinzufügen
        this.injectCSS();
    },

    /**
     * Rendert den Modal-Inhalt
     */
    renderModal() {
        const connInput = document.getElementById('pg-connection');
        const testBtn = document.getElementById('btn-test-pg');
        const useBtn = document.getElementById('btn-use-pg');
        const resultDiv = document.getElementById('pg-test-result');
        const pgStatus = document.querySelector('.db-info-postgresql');

        if (this.currentDb?.type === 'postgresql') {
            connInput.value = this.currentDb.connectionString || '';
            pgStatus.style.opacity = '0.7';
            useBtn.textContent = '✓ Aktiv';
            useBtn.disabled = true;
        } else {
            connInput.value = '';
            pgStatus.style.opacity = '1';
            useBtn.textContent = '🔗 PostgreSQL verbinden';
            useBtn.disabled = true;
            resultDiv.innerHTML = '';
        }

        const pgliteBtn = document.getElementById('btn-use-pglite');
        if (this.currentDb?.type === 'pglite') {
            pgliteBtn.textContent = '✓ Aktiv';
            pgliteBtn.disabled = true;
        } else {
            pgliteBtn.textContent = 'Verwende PGlite';
            pgliteBtn.disabled = false;
        }
    },

    /**
     * Testet die PostgreSQL-Verbindung
     */
    async testPostgreSQL() {
        const connInput = document.getElementById('pg-connection');
        const connectionString = connInput.value.trim();
        const resultDiv = document.getElementById('pg-test-result');
        const useBtn = document.getElementById('btn-use-pg');

        if (!connectionString) {
            resultDiv.innerHTML = '<div class="error">⚠️ Bitte geben Sie einen Connection String ein</div>';
            return;
        }

        resultDiv.innerHTML = '<div class="info">🔄 Teste Verbindung...</div>';
        useBtn.disabled = true;

        try {
            const result = await window.api.postgresqlConnect(connectionString);

            if (result.ok) {
                resultDiv.innerHTML = `
                    <div class="success">
                        ✓ Verbindung erfolgreich!<br>
                        <small>Server: ${result.version}</small>
                    </div>
                `;
                useBtn.disabled = false;
            } else {
                resultDiv.innerHTML = `<div class="error">✗ Verbindung fehlgeschlagen: ${result.error}</div>`;
                useBtn.disabled = true;
            }
        } catch (err) {
            resultDiv.innerHTML = `<div class="error">✗ Fehler: ${err}</div>`;
            useBtn.disabled = true;
        }
    },

    /**
     * Wechselt zu PGlite
     */
    async switchToPGlite() {
        try {
            console.log('[DatabaseSelector] Wechsle zu PGlite...');
            const result = await window.api.dbSwitch({ type: 'pglite', id: 'default' });
            
            if (result.ok) {
                // Settings aktualisieren
                await window.api.saveSettings({
                    database: {
                        activeType: 'pglite',
                        postgresqlConnectionString: ''
                    }
                });

                // State aktualisieren
                state.dbMode = 'pglite';
                
                console.log('[DatabaseSelector] ✓ Zu PGlite gewechselt');
                
                // UI aktualisieren
                await this.updateStatus();
                this.renderModal();
                
                // Event auslösen
                document.dispatchEvent(new CustomEvent('db:switched', { detail: { type: 'pglite' } }));
            } else {
                alert(`Fehler beim Wechsel: ${result.error}`);
            }
        } catch (err) {
            console.error('[DatabaseSelector] Fehler beim PGlite-Wechsel:', err);
            alert(`Fehler: ${err}`);
        }
    },

    /**
     * Wechselt zu PostgreSQL
     */
    async switchToPostgreSQL() {
        const connInput = document.getElementById('pg-connection');
        const connectionString = connInput.value.trim();

        if (!connectionString) {
            alert('Bitte geben Sie einen PostgreSQL Connection String ein!');
            return;
        }

        try {
            console.log('[DatabaseSelector] Wechsle zu PostgreSQL...');
            const result = await window.api.dbSwitch({ 
                type: 'postgresql', 
                connectionString 
            });

            if (result.ok) {
                // Settings aktualisieren
                await window.api.saveSettings({
                    database: {
                        activeType: 'postgresql',
                        postgresqlConnectionString: connectionString
                    }
                });

                // State aktualisieren
                state.dbMode = 'remote';

                console.log('[DatabaseSelector] ✓ Zu PostgreSQL gewechselt');

                // UI aktualisieren
                await this.updateStatus();
                this.renderModal();

                // Event auslösen
                document.dispatchEvent(new CustomEvent('db:switched', { detail: { type: 'postgresql', connectionString } }));
            } else {
                alert(`Fehler beim Wechsel: ${result.error}`);
            }
        } catch (err) {
            console.error('[DatabaseSelector] Fehler beim PostgreSQL-Wechsel:', err);
            alert(`Fehler: ${err}`);
        }
    },

    /**
     * Schließt das Modal
     */
    closeModal() {
        if (this.modalEl) {
            this.modalEl.style.display = 'none';
        }
    },

    /**
     * Injiziert CSS-Styles
     */
    injectCSS() {
        if (document.getElementById('db-selector-styles')) return;

        const style = document.createElement('style');
        style.id = 'db-selector-styles';
        style.textContent = `
            .db-status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #27272a;
                border-radius: 6px;
                font-size: 13px;
            }

            .db-icon {
                font-size: 16px;
            }

            .db-label {
                flex: 1;
            }

            .db-switch-btn {
                padding: 4px 8px;
                background: #3f3f46;
                border: 1px solid #52525b;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }

            .db-switch-btn:hover {
                background: #52525b;
            }

            .db-selector-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                align-items: center;
                justify-content: center;
            }

            .db-modal-content {
                background: #27272a;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }

            .db-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #3f3f46;
            }

            .db-modal-header h2 {
                margin: 0;
                font-size: 18px;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #a1a1aa;
                transition: color 0.2s;
            }

            .close-btn:hover {
                color: #fff;
            }

            .db-modal-body {
                padding: 20px;
            }

            .db-info-pglite, .db-info-postgresql {
                border: 1px solid #3f3f46;
                border-radius: 6px;
                padding: 16px;
                background: #1f1f23;
            }

            .db-info-pglite h3, .db-info-postgresql h3 {
                margin-top: 0;
                margin-bottom: 8px;
                font-size: 15px;
            }

            .db-info-postgresql p, .db-info-pglite p {
                margin: 8px 0;
                font-size: 13px;
                color: #a1a1aa;
            }

            .form-group {
                margin: 12px 0;
            }

            .form-group label {
                display: block;
                margin-bottom: 4px;
                font-size: 13px;
                font-weight: 500;
            }

            .form-group input {
                width: 100%;
                padding: 8px 12px;
                background: #18181b;
                border: 1px solid #3f3f46;
                border-radius: 4px;
                color: #fff;
                font-family: monospace;
                font-size: 12px;
                box-sizing: border-box;
            }

            .form-group input:focus {
                outline: none;
                border-color: #52525b;
                background: #27272a;
            }

            .form-group small {
                display: block;
                margin-top: 4px;
                color: #71717a;
                font-size: 11px;
            }

            hr {
                border: none;
                border-top: 1px solid #3f3f46;
                margin: 16px 0;
            }

            .form-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }

            .form-actions button {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
            }

            .btn-primary {
                background: #3b82f6;
                color: white;
            }

            .btn-primary:hover:not(:disabled) {
                background: #2563eb;
            }

            .btn-primary:disabled {
                background: #52525b;
                color: #71717a;
                cursor: not-allowed;
            }

            .btn-secondary {
                background: #52525b;
                color: white;
            }

            .btn-secondary:hover {
                background: #71717a;
            }

            #pg-test-result {
                margin-top: 12px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
            }

            .info {
                background: #1e40af;
                color: #93c5fd;
                border: 1px solid #3b82f6;
            }

            .success {
                background: #064e3b;
                color: #6ee7b7;
                border: 1px solid #10b981;
            }

            .error {
                background: #7f1d1d;
                color: #fca5a5;
                border: 1px solid #ef4444;
            }
        `;
        document.head.appendChild(style);
    }
};

// Exportiere auch eine Initialisierungs-Funktion für einfachere Integration
export async function initDatabaseSelector() {
    await databaseSelector.initialize();
}
