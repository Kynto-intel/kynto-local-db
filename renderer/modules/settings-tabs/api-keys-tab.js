/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ API Keys Settings Tab Module                                            │
 * │ Verwaltet: API Key Generation, Display, Copy, Delete                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { setStatus } from '../utils.js';

export const apiKeysTab = {
    name: 'api-keys',
    id: 'pane-api-keys',

    /**
     * Initialisiert Event-Listener
     */
    init() {
        const btnGenerateApiKey = document.getElementById('btn-generate-api-key');
        if (btnGenerateApiKey) {
            btnGenerateApiKey.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.generateNewApiKey();
            });
        }

        const btnApiKeysDocs = document.getElementById('btn-api-keys-documentation');
        if (btnApiKeysDocs) {
            btnApiKeysDocs.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showDocumentation();
            });
        }

        const closeDocsBtn = document.getElementById('close-api-docs');
        if (closeDocsBtn) {
            closeDocsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const docsModal = document.getElementById('api-keys-docs-modal');
                if (docsModal) docsModal.classList.remove('open');
            });
        }

        const docsModal = document.getElementById('api-keys-docs-modal');
        if (docsModal) {
            docsModal.addEventListener('click', (e) => {
                if (e.target === docsModal) {
                    docsModal.classList.remove('open');
                }
            });
        }
    },

    /**
     * Lädt und zeigt die API Keys an
     */
    async load() {
        await this.loadAndRenderApiKeys();
    },

    /**
     * Generiert einen eindeutigen API Key
     */
    generateUniqueApiKey() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(x => x.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    },

    /**
     * Dialog für API Key Label
     */
    async showApiKeyLabelDialog() {
        return new Promise((resolve) => {
            const div = document.createElement('div');
            div.id = 'api-key-dialog';
            div.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: var(--surface2);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            `;

            content.innerHTML = `
                <h3 style="margin-top: 0; color: var(--text);">API Key Label</h3>
                <p style="color: var(--muted); font-size: 12px; margin: 12px 0;">
                    Gib einen Namen für diesen API Key ein (z.B. "Frontend App", "Mobile Client")
                </p>
                <input type="text" id="api-key-label-input" placeholder="z.B. Frontend App" 
                    style="width: 100%; padding: 10px; background: var(--surface); border: 1px solid var(--border); 
                           border-radius: 6px; color: var(--text); box-sizing: border-box; margin-bottom: 16px;"
                    value="API Key ${new Date().toLocaleDateString()}">
                <div style="display: flex; gap: 10px;">
                    <button id="api-key-dialog-ok" class="btn btn-primary" style="flex: 1;">OK</button>
                    <button id="api-key-dialog-cancel" class="btn" style="flex: 1;">Abbrechen</button>
                </div>
            `;

            div.appendChild(content);
            document.body.appendChild(div);

            const input = document.getElementById('api-key-label-input');
            const btnOk = document.getElementById('api-key-dialog-ok');
            const btnCancel = document.getElementById('api-key-dialog-cancel');

            const cleanup = (result) => {
                div.remove();
                resolve(result);
            };

            btnOk.addEventListener('click', () => {
                const value = input.value.trim();
                cleanup(value || null);
            });

            btnCancel.addEventListener('click', () => cleanup(null));

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = input.value.trim();
                    cleanup(value || null);
                }
            });

            input.focus();
            input.select();
        });
    },

    /**
     * Lädt und rendert die API Keys
     */
    async loadAndRenderApiKeys() {
        try {
            const apiKeys = await window.api.loadApiKeys() || [];
            const listContainer = document.getElementById('api-keys-list');

            if (!listContainer) return;

            if (apiKeys.length === 0) {
                listContainer.innerHTML = '<div style="color: var(--muted); font-size: 12px; text-align: center; padding: 40px 20px;">Noch keine API Keys generiert.</div>';
                return;
            }

            listContainer.innerHTML = apiKeys.map((key, idx) => {
                const maskedToken = '●'.repeat(key.token.length);
                return `
                <div class="api-key-card" style="${key.used ? 'opacity: 0.6; background: var(--surface); border-color: #666;' : ''}">
                    <div style="flex: 1;">
                        <div class="key-label" style="margin-bottom: 4px; color: var(--text); font-weight: 500;">
                            ${key.label || 'API Key ' + (idx + 1)}
                            ${key.used ? ' <span style="color: #888; font-size: 10px;">[VERWENDET]</span>' : ''}
                        </div>
                        <div class="key-display" style="font-size: 10px; color: #a3be8c; word-break: break-all; font-family: var(--font-mono);">
                            <span id="key-display-${idx}">${maskedToken}</span>
                            <button class="btn" id="toggle-visibility-${idx}" style="padding: 2px 6px; font-size: 10px; margin-left: 8px; background: transparent; color: var(--accent); border: none; cursor: pointer;">👁️</button>
                        </div>
                        ${key.lastUsed ? `<div style="font-size: 9px; color: var(--muted); margin-top: 4px;">Verwendet: ${new Date(key.lastUsed).toLocaleString('de-DE')}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 6px; flex-direction: column;">
                        <button class="btn btn-copy" id="copy-${idx}" style="padding: 6px 10px; font-size: 10px;">📋 Copy</button>
                        <button class="btn btn-delete" id="delete-${idx}" style="padding: 6px 10px; font-size: 10px;">🗑️ Delete</button>
                    </div>
                </div>
                `;
            }).join('');

            // Event Listener
            apiKeys.forEach((key, idx) => {
                const copyBtn = document.getElementById(`copy-${idx}`);
                if (copyBtn) {
                    copyBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.copyApiKey(key.token);
                    });
                }

                const deleteBtn = document.getElementById(`delete-${idx}`);
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.deleteApiKey(idx);
                    });
                }

                const toggleBtn = document.getElementById(`toggle-visibility-${idx}`);
                const keyDisplay = document.getElementById(`key-display-${idx}`);
                if (toggleBtn && keyDisplay) {
                    let isVisible = false;
                    const maskedToken = '●'.repeat(key.token.length);

                    toggleBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        isVisible = !isVisible;
                        keyDisplay.textContent = isVisible ? key.token : maskedToken;
                        toggleBtn.textContent = isVisible ? '🙈' : '👁️';
                    });
                }
            });
        } catch (err) {
            console.error('Fehler beim Laden der API Keys:', err);
        }
    },

    /**
     * Generiert einen neuen API Key
     */
    async generateNewApiKey() {
        const token = this.generateUniqueApiKey();
        const label = await this.showApiKeyLabelDialog();

        if (!label) return;

        try {
            const success = await window.api.addApiKey({
                token,
                label,
                createdAt: new Date().toISOString(),
                lastUsed: null,
                used: false
            });

            if (!success) {
                throw new Error('API Key konnte nicht gespeichert werden');
            }

            await this.loadAndRenderApiKeys();
            setStatus(`✅ API Key generiert: ${label}`, 'success');
        } catch (err) {
            console.error('Fehler beim Generieren:', err);
            setStatus(`❌ Fehler: ${err.message}`, 'error');
        }
    },

    /**
     * Kopiert einen API Key
     */
    copyApiKey(token) {
        navigator.clipboard.writeText(token).then(() => {
            setStatus('✅ API Key kopiert zur Zwischenablage!', 'success');
        }).catch(err => {
            console.error('Fehler:', err);
            setStatus('❌ Fehler beim Kopieren!', 'error');
        });
    },

    /**
     * Löscht einen API Key
     */
    async deleteApiKey(idx) {
        if (!confirm('Diesen API Key wirklich löschen?')) return;

        try {
            const success = await window.api.deleteApiKey(idx);
            if (success) {
                await this.loadAndRenderApiKeys();
                setStatus('✅ API Key gelöscht', 'success');
            } else {
                setStatus('❌ Fehler beim Löschen!', 'error');
            }
        } catch (err) {
            console.error('Fehler:', err);
            setStatus('❌ Fehler beim Löschen!', 'error');
        }
    },

    /**
     * Zeigt die Dokumentation
     */
    showDocumentation() {
        const docsModal = document.getElementById('api-keys-docs-modal');
        if (docsModal) {
            docsModal.classList.add('open');
        }
    }
};
