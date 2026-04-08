/* ── modules/settings.js ──────────────────────────────────────────────
   Logik für das Einstellungs-Modal.
   Lädt das HTML-Template, initialisiert Event-Listener und
   verwaltet das Speichern/Laden der spezifischen Einstellungen.
   ──────────────────────────────────────────────────────────────────── */

import { state } from './state.js';
import { applyTheme, loadUISettings } from './ui.js';
import { refreshDBList, switchDB } from './sidebar.js';
import { switchMode } from './mode-switcher.js';
import { setStatus, setEditorVal } from './utils.js';
import { wireSyncEvents } from './sync-center.js';
import { SQL_TEMPLATES } from './SQLEditor/SQLTemplates/SQLEditor.queries.js';

/**
 * Zentrales Settings-Objekt für den Zugriff auf SQL-Templates und Quickstarts.
 */
export const settings = {
    getTemplates: () => SQL_TEMPLATES.filter(t => t.type === 'template'),
    // Nutzt die gleiche Logik wie in der korrigierten Quickstarts.js
    getQuickstarts: () => SQL_TEMPLATES.filter(t => t.type !== 'template')
};

let settingsModal;

/**
 * Initialisiert das Einstellungs-Modal.
 * Lädt das HTML-Template, fügt es dem DOM hinzu und registriert Event-Listener.
 */
export async function initSettings() {
    try {
        // Lade das HTML aus dem Unterordner
        const html = await window.api.readFile('renderer/templates/settings-modal.html');
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);

        // CSS für einen größeren Vorlagen-Bereich injizieren
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

        // Jetzt, wo das HTML im DOM ist, Referenzen zuweisen
        settingsModal = document.getElementById('settings-modal');
        const settingsCancel = document.getElementById('settings-cancel');
        const settingsSave = document.getElementById('settings-save');
        const btnCreateDB = document.getElementById('settings-create-db');
        
        // Sucht nach dem Einstellungs-Button (probiert verschiedene IDs)
        const btnOpenSettings = document.getElementById('btn-settings') || 
                               document.getElementById('btn-open-settings');
        
        // Navigation innerhalb des Modals initialisieren
        const navItems = document.querySelectorAll('.settings-sidebar .nav-item');
        const panes    = document.querySelectorAll('.settings-pane');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                navItems.forEach(i => i.classList.toggle('active', i === item));
                panes.forEach(p => p.classList.toggle('active', p.id === target));
            });
        });

        // Sync-Center Events binden
        wireSyncEvents();

        const providerSelect = document.getElementById('setting-ai-provider');
        if (providerSelect) {
            providerSelect.addEventListener('change', updateAIUI);
        }

        // Einstellungen beim Start einmalig anwenden
        const currentSettings = await window.api.loadSettings();
        applySettings(currentSettings);

        if (btnOpenSettings) {
            btnOpenSettings.addEventListener('click', async () => {
                await loadSettingsUI(); // Werte aus der Datei in die Inputs laden
                await loadAndRenderApiKeys(); // Lade API Keys wenn Modal öffnet
                settingsModal.classList.add('open');
            });
        }

        // Neue Datenbank aus den Einstellungen heraus erstellen
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

        // Klick auf den Button im DB-Reiter wechselt zum Sync-Center-Reiter
        document.getElementById('btn-open-sync-center')?.addEventListener('click', () => {
            const navSync = document.querySelector('.nav-item[data-target="pane-sync"]');
            if (navSync) {
                navSync.click();
            }
        });

        // ─────────────────────────────────────────────────────────────
        // API Keys Button - WICHTIG: Muss hier registriert werden!
        // ─────────────────────────────────────────────────────────────
        const btnGenerateApiKey = document.getElementById('btn-generate-api-key');
        console.log('[initSettings] API Key Button:', btnGenerateApiKey ? '✅ FOUND' : '❌ NOT FOUND');
        if (btnGenerateApiKey) {
            btnGenerateApiKey.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[API Key Button] Clicked!');
                await generateNewApiKey();
            });
        }

        // Dokumentations Button
        const btnApiKeysDocs = document.getElementById('btn-api-keys-documentation');
        if (btnApiKeysDocs) {
            btnApiKeysDocs.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.showApiKeyDocumentation();
            });
        }

        // Close Button im Docs Modal
        const closeDocsBtn = document.getElementById('close-api-docs');
        if (closeDocsBtn) {
            closeDocsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const docsModal = document.getElementById('api-keys-docs-modal');
                if (docsModal) {
                    docsModal.classList.remove('open');
                }
            });
        }

        // Close Docs Modal beim Außen klicken
        const docsModal = document.getElementById('api-keys-docs-modal');
        if (docsModal) {
            docsModal.addEventListener('click', (e) => {
                if (e.target === docsModal) {
                    docsModal.classList.remove('open');
                }
            });
        }

        // Event-Listener für Media-Pfad Auswahl (Ordner-Dialog) mit Fehlerbehandlung
        document.getElementById('btn-browse-storage')?.addEventListener('click', async () => {
            try {
                const path = await window.api.selectFolder();
                if (path) {
                    const input = document.getElementById('setting-storage-mediaPath');
                    if (input) input.value = path;
                }
            } catch (err) {
                console.error('Fehler beim Öffnen des Ordner-Dialogs:', err);
                setStatus('Ordner-Dialog konnte nicht geöffnet werden.', 'error');
            }
        });

        // Modal schließen / Speichern
        settingsCancel.addEventListener('click', () => settingsModal.classList.remove('open'));
        settingsSave.addEventListener('click', saveSettingsUI);
        settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.remove('open'); });

    } catch (err) {
        console.error('Fehler beim Initialisieren der Settings:', err);
    }
}

/**
 * Wendet die Einstellungen sofort auf die UI und den Editor an.
 */
export function applySettings(s) {
    if (!s || typeof s !== 'object') return;

    // 1. Theme (Dark/Light)
    if (s.theme) {
        state.isDark = (s.theme === 'dark');
        applyTheme(s.theme === 'dark');
    }

    // 2. Editor-Anpassungen
    if (s.editor) {
        const fontSize = Math.max(8, Math.min(72, parseInt(s.editor.fontSize) || 14));
        
        // Globalen State aktualisieren, damit andere Module darauf zugreifen können
        state.editorSettings = { ...s.editor, fontSize };
        
        // CSS Variable für das gesamte Dokument setzen
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
        // Dynamische Zeilenhöhe für die Tabelle berechnen (Font-Size + Padding)
        document.documentElement.style.setProperty('--table-row-height', `${fontSize + 18}px`);
        
        // Monaco Instanz direkt ansprechen
        if (state.editor) {
            const showLines = s.editor.lineNumbers !== false; // Default auf true
            state.editor.updateOptions({
                lineNumbers: showLines ? 'on' : 'off',
                fontSize: fontSize
            });
            // Monaco braucht layout() statt refresh()
            setTimeout(() => state.editor.layout(), 50);
        }
    }

    // 3. KI-Assistent Einstellungen in den State übernehmen
    if (s.ai) {
        state.aiSettings = { ...s.ai };
    }

    // 4. Speicher-Einstellungen (Bilder & Videos)
    if (s.storage) {
        state.storageSettings = { ...s.storage };
    }
}

/**
 * Aktualisiert die KI-UI-Elemente (Labels, Platzhalter, Hinweise) basierend auf dem Provider.
 */
function updateAIUI() {
    const providerSelect = document.getElementById('setting-ai-provider');
    const apiKeyInput = document.getElementById('setting-ai-apiKey');
    if (!providerSelect || !apiKeyInput) return;

    const isOllama = providerSelect.value === 'ollama';
    const label = document.querySelector('label[for="setting-ai-apiKey"]');
    
    // Typ anpassen: URL soll für Ollama sichtbar sein (Text), Cloud-Keys bleiben verborgen (Password)
    apiKeyInput.type = isOllama ? 'text' : 'password';

    // Label und Platzhalter dynamisch anpassen
    if (label) label.textContent = isOllama ? 'Ollama Endpoint URL:' : 'API Key:';
    apiKeyInput.placeholder = isOllama ? 'http://localhost:11434' : 'sk-...';
    
    // Speziellen Hinweis-Text nur für Ollama einblenden
    let hint = document.getElementById('ollama-hint');
    if (isOllama) {
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'ollama-hint';
            hint.style.cssText = 'font-size:11px; color:var(--accent); margin-top:5px; opacity:0.8;';
            hint.textContent = 'ℹ️ Ollama muss lokal gestartet sein (Standard: Port 11434).';
            apiKeyInput.parentNode.appendChild(hint);
        }
        hint.style.display = 'block';
        if (!apiKeyInput.value.trim()) apiKeyInput.value = 'http://localhost:11434';
    } else if (hint) {
        hint.style.display = 'none';
    }
}

/**
 * Lädt die gespeicherten Einstellungen und befüllt die UI-Elemente im Modal.
 */
async function loadSettingsUI() {
    const s = await window.api.loadSettings();
    
    // Sicherheits-Checks, falls Pfade im Objekt fehlen
    const ui = s.ui || {};
    const editor = s.editor || {};
    const db = s.database || {};
    const ai = s.ai || {};
    const tpl = s.templates || {};
    const storage = s.storage || {};

    if (document.getElementById('setting-theme')) document.getElementById('setting-theme').value = s.theme || 'dark';
    if (document.getElementById('setting-sidebar')) document.getElementById('setting-sidebar').checked = !!ui.sidebar;
    if (document.getElementById('setting-ui-virtualScrolling')) document.getElementById('setting-ui-virtualScrolling').checked = !!ui.virtualScrolling;

    if (document.getElementById('setting-editor-fontSize')) document.getElementById('setting-editor-fontSize').value = editor.fontSize || 14;
    if (document.getElementById('setting-editor-lineNumbers')) document.getElementById('setting-editor-lineNumbers').checked = !!editor.lineNumbers;
    if (document.getElementById('setting-editor-autocomplete')) document.getElementById('setting-editor-autocomplete').checked = !!editor.autocomplete;

    if (document.getElementById('setting-db-autoLimit')) document.getElementById('setting-db-autoLimit').value = db.autoLimit || 500;
    if (document.getElementById('setting-db-autoCheckpoint')) document.getElementById('setting-db-autoCheckpoint').checked = !!db.autoCheckpoint;

    if (document.getElementById('setting-ai-enabled')) document.getElementById('setting-ai-enabled').checked = !!ai.enabled;
    if (document.getElementById('setting-ai-provider')) document.getElementById('setting-ai-provider').value = ai.provider || 'ollama';
    if (document.getElementById('setting-ai-apiKey')) document.getElementById('setting-ai-apiKey').value = ai.apiKey || '';
    if (document.getElementById('setting-ai-model')) document.getElementById('setting-ai-model').value = ai.model || '';
    if (document.getElementById('sync-conn-input')) document.getElementById('sync-conn-input').value = s.remoteConnectionString || '';

    // Kategorie: Lagerung für Bilder und Videos
    if (document.getElementById('setting-storage-mediaPath')) document.getElementById('setting-storage-mediaPath').value = storage.mediaPath || '';

    // Neue Tab-Einstellungen: SQL Vorlagen
    if (document.getElementById('setting-tpl-showQuickstarts')) document.getElementById('setting-tpl-showQuickstarts').checked = tpl.showQuickstarts !== false;

    // Vorlagen-Liste im UI rendern, um die Verbindung zu bestätigen
    const tplList = document.getElementById('settings-tpl-list');
    if (tplList) {
        const templates = settings.getTemplates();
        const quickstarts = settings.getQuickstarts();
        const total = [...templates, ...quickstarts];

        tplList.innerHTML = total.length 
            ? total.map(t => `<div class="settings-tpl-item" data-id="${t.id}" style="font-size:11px; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); color:var(--text); display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: background 0.2s;">
                <span>${t.type === 'template' ? '📄' : '⚡'} <strong>${t.title}</strong></span>
                <span style="opacity:0.5; font-size:9px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:3px;">${t.type.toUpperCase()}</span>
              </div>`).join('')
            : '<div class="desc">Keine Vorlagen in SQLEditor.queries.js gefunden.</div>';

        // Event-Listener hinzufügen, damit die Vorlagen auch aus den Einstellungen geladen werden können
        tplList.querySelectorAll('.settings-tpl-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.05)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            item.addEventListener('click', () => {
                const tplId = item.dataset.id;
                const template = total.find(t => t.id === tplId);
                if (template) {
                    setEditorVal(state, template.sql);
                    if (window.showView) window.showView('editor');
                    settingsModal.classList.remove('open'); // Schließt das Modal nach der Auswahl
                    setStatus(`Vorlage "${template.title}" geladen.`, 'success');
                }
            });
        });
    }
}

/**
 * Speichert die aktuellen Werte der UI-Elemente im Modal in den Einstellungen.
 */
async function saveSettingsUI() {
    try {
        const data = {
            theme: document.getElementById('setting-theme')?.value || 'dark',
            ui: {
                sidebar: document.getElementById('setting-sidebar')?.checked || false,
                virtualScrolling: document.getElementById('setting-ui-virtualScrolling')?.checked || false
            },
            editor: {
                fontSize: parseInt(document.getElementById('setting-editor-fontSize')?.value) || 14,
                lineNumbers: document.getElementById('setting-editor-lineNumbers')?.checked ?? true,
                autocomplete: document.getElementById('setting-editor-autocomplete')?.checked ?? true
            },
            database: {
                autoLimit: parseInt(document.getElementById('setting-db-autoLimit')?.value) || 500,
                autoCheckpoint: document.getElementById('setting-db-autoCheckpoint')?.checked ?? true
            },
            ai: {
                enabled: document.getElementById('setting-ai-enabled')?.checked || false,
                provider: document.getElementById('setting-ai-provider')?.value || 'ollama',
                apiKey: document.getElementById('setting-ai-apiKey')?.value || '',
                model: document.getElementById('setting-ai-model')?.value || ''
            },
            storage: {
                mediaPath: document.getElementById('setting-storage-mediaPath')?.value.trim() || ''
            },
            remoteConnectionString: document.getElementById('sync-conn-input')?.value.trim() || '',
            templates: {
                showQuickstarts: document.getElementById('setting-tpl-showQuickstarts')?.checked ?? true
            }
        };

        await window.api.saveSettings(data);
        applySettings(data);
        
        settingsModal.classList.remove('open');
        setStatus('Einstellungen gespeichert.', 'success');
        await loadUISettings(); 
    } catch (err) {
        console.error('Fehler beim Speichern der Einstellungen:', err);
        setStatus('Fehler beim Speichern!', 'error');
    }
}

// ════════════════════════════════════════════════════════════════════════
// API KEYS Management
// ════════════════════════════════════════════════════════════════════════

/**
 * Generiere einen eindeutigen, sicheren API Key (64 Zeichen hexadecimal)
 */
function generateUniqueApiKey() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(x => x.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

/**
 * Laden und rendern der API Keys
 */
async function loadAndRenderApiKeys() {
    try {
        const apiKeys = await window.api.loadApiKeys() || [];
        const listContainer = document.getElementById('api-keys-list');
        
        if (!listContainer) return;
        
        if (apiKeys.length === 0) {
            listContainer.innerHTML = '<div style="color: var(--muted); font-size: 12px; text-align: center; padding: 40px 20px;">Noch keine API Keys generiert.</div>';
            return;
        }
        
        listContainer.innerHTML = apiKeys.map((key, idx) => {
            // Token standardmäßig maskiert
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
        
        // Event Listener für alle Buttons
        console.log('[loadAndRenderApiKeys] Registriere Event Listener...');
        apiKeys.forEach((key, idx) => {
            // Copy Button
            const copyBtn = document.getElementById(`copy-${idx}`);
            if (copyBtn) {
                console.log(`[loadAndRenderApiKeys] Copy Button ${idx} registriert`);
                copyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`[Copy Button ${idx}] Clicked! Token: ${key.token.substring(0, 10)}...`);
                    window.copyApiKey(key.token);
                });
            }
            
            // Delete Button
            const deleteBtn = document.getElementById(`delete-${idx}`);
            if (deleteBtn) {
                console.log(`[loadAndRenderApiKeys] Delete Button ${idx} registriert`);
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`[Delete Button ${idx}] Clicked!`);
                    window.deleteApiKey(idx);
                });
            }
            
            // Toggle Visibility Button
            const toggleBtn = document.getElementById(`toggle-visibility-${idx}`);
            const keyDisplay = document.getElementById(`key-display-${idx}`);
            if (toggleBtn && keyDisplay) {
                console.log(`[loadAndRenderApiKeys] Toggle Button ${idx} registriert`);
                let isVisible = false;
                const maskedToken = '●'.repeat(key.token.length);
                
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isVisible = !isVisible;
                    keyDisplay.textContent = isVisible ? key.token : maskedToken;
                    toggleBtn.textContent = isVisible ? '🙈' : '👁️';
                    console.log(`[Toggle ${idx}] Visibility: ${isVisible}`);
                });
            }
        });
        
    } catch (err) {
        console.error('Fehler beim Laden der API Keys:', err);
    }
}

/**
 * Dialog für API Key Label
 */
function showApiKeyLabelDialog() {
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
        
        function cleanup(result) {
            div.remove();
            resolve(result);
        }
        
        // OK Button
        btnOk.addEventListener('click', () => {
            const value = input.value.trim();
            cleanup(value || null);
        });
        
        // Cancel Button
        btnCancel.addEventListener('click', () => {
            cleanup(null);
        });
        
        // Enter-Taste
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                cleanup(value || null);
            }
        });
        
        // Focus auf Input
        input.focus();
        input.select();
    });
}

/**
 * Neuen API Key generieren
 */
async function generateNewApiKey() {
    console.log('[API Keys] Generating new key...');
    
    const token = generateUniqueApiKey();
    const label = await showApiKeyLabelDialog();
    
    if (!label) {
        console.log('[API Keys] Abgebrochen');
        return; // Abgebrochen
    }
    
    try {
        console.log('[API Keys] Adding key:', label);
        const success = await window.api.addApiKey({
            token,
            label,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            used: false  // Status ob der Token bereits verwendet wurde
        });
        
        if (!success) {
            throw new Error('API Key konnte nicht gespeichert werden');
        }
        
        console.log('[API Keys] Saved successfully, reloading list');
        await loadAndRenderApiKeys();
        setStatus(`✅ API Key generiert: ${label}`, 'success');
    } catch (err) {
        console.error('[API Keys] Fehler beim Generieren:', err);
        setStatus(`❌ Fehler: ${err.message}`, 'error');
    }
}

/**
 * Global Funktionen für Copy & Delete
 */
window.copyApiKey = function(token) {
    console.log('[copyApiKey] Copying token:', token.substring(0, 10) + '...');
    navigator.clipboard.writeText(token).then(() => {
        setStatus('✅ API Key kopiert zur Zwischenablage!', 'success');
    }).catch(err => {
        console.error('[copyApiKey] Fehler:', err);
        setStatus('❌ Fehler beim Kopieren!', 'error');
    });
};

window.deleteApiKey = async function(idx) {
    console.log('[deleteApiKey] Deleting index:', idx);
    if (!confirm('Diesen API Key wirklich löschen?')) return;
    
    try {
        const success = await window.api.deleteApiKey(idx);
        if (success) {
            await loadAndRenderApiKeys();
            setStatus('✅ API Key gelöscht', 'success');
        } else {
            setStatus('❌ Fehler beim Löschen!', 'error');
        }
    } catch (err) {
        console.error('[deleteApiKey] Fehler:', err);
        setStatus('❌ Fehler beim Löschen!', 'error');
    }
};

/**
 * Zeige API Keys Dokumentation Modal
 */
window.showApiKeyDocumentation = function() {
    const docsModal = document.getElementById('api-keys-docs-modal');
    if (docsModal) {
        docsModal.classList.add('open');
        console.log('[showApiKeyDocumentation] Modal angezeigt');
    }
};

/**
 * Initialisiert die API Key Events
 */
export function initApiKeyEvents() {
    const btnGenerate = document.getElementById('btn-generate-api-key');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', generateNewApiKey);
    }
    
    // Keys laden wenn Modal geöffnet wird
    const btnOpenSettings = document.getElementById('btn-settings') || document.getElementById('btn-open-settings');
    if (btnOpenSettings) {
        const originalListener = btnOpenSettings.onclick;
        btnOpenSettings.addEventListener('click', async () => {
            await loadAndRenderApiKeys();
        });
    }
}