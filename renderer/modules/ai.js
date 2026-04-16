/* ── modules/ai.js ────────────────────────────────────────────────────────────
   KI-Assistent Sidebar: Rechtes Interface für Natural Language Abfragen.

   CHANGES v2.0:
   - Langzeitgedächtnis vollständig repariert (memoryActive-Bug gefixt)
   - Boolean-safe checkKnowledgeActive (PGlite gibt "true" als String zurück)
   - saveChatMessage mit erweitertem API (contentType, tokenCount, latencyMs, model)
   - ensureSession wird beim Init aufgerufen
   - Antwortzeit (latencyMs) wird gemessen und gespeichert
   - contentType-Erkennung (sql / text)
   - Gedächtnis-Badge zeigt Wissens-Anzahl an
   ──────────────────────────────────────────────────────────────────────────── */

import { state }           from './state.js';
import { setStatus, escH } from './utils.js';
import { sanitizeArrayOfObjects, sanitizeUrlHashParams } from '../../src/lib/sanitize.js';

// ✨ AI-Bibliothek
import {
    extractSQLFromResponse as extractSQL,
    cleanupSQL,
    isSQLCode,
    buildSystemPrompt,
    generateDatabaseContext,
} from '../../src/lib/ai/index.js';

// 🍳 Recipe Modal
import {
    openRecipeModal,
    openRecipeModalForTable,
    setupRecipeProgressListener,
} from '../../src/lib/ai/recipe-ui.js';

// 🧠 Langzeitgedächtnis v2
import {
    checkKnowledgeActive,
    getKnowledgeForPrompt,
    saveChatMessage,
    getRecentChat,
    ensureSession,
    getKnowledgeStats,
    KY_TABLE_NAME,
} from '../../src/lib/ai/kynto_knowledge.js';

// ── Globaler State ─────────────────────────────────────────────────────────
let aiQueryMode = false;

// Session-ID für diese Browser-Session (stabil über Navigationen)
const SESSION_ID = (() => {
    const stored = sessionStorage.getItem('kynto_session_id');
    if (stored) return stored;
    const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try { sessionStorage.setItem('kynto_session_id', id); } catch {}
    return id;
})();

// ── Hilfsfunktion: DB-Adapter ──────────────────────────────────────────────
function makeDbAdapter() {
    return {
        query: (sql, params = []) =>
            window.api.dbQuery(
                sql,
                params,
                state.dbMode === 'remote' ? 'remote' : 'local'
            ),
    };
}

// ── Sidebar aufbauen ───────────────────────────────────────────────────────

export function initAISidebar() {
    if (!document.getElementById('ai-sidebar-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-sidebar-styles';
        style.textContent = `
            /* ── KI-Assistent Sidebar ─────────────────────────────────────────── */
            #ai-sidebar-right {
                position: fixed;
                right: 0; top: 0; bottom: 0;
                width: 380px;
                background: var(--surface, #18181b);
                border-left: 1px solid rgba(255,255,255,0.11);
                display: flex;
                flex-direction: column;
                z-index: 2000;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: -8px 0 8px rgba(0,0,0,0.2), -1px 0 0 rgba(255,255,255,0.06);
            }
            #ai-sidebar-right.collapsed { transform: translateX(100%); }
            
            #ai-sidebar-right .ai-panel-header {
                padding: 20px 20px 0;
                background: linear-gradient(180deg, rgba(194,154,64,0.05) 0%, transparent 100%);
                flex-shrink: 0;
            }
            #ai-sidebar-right .ai-header-label {
                display: flex; align-items: center; gap: 7px;
                color: var(--accent, #c29a40); font-size: 10px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 13px;
            }
            #ai-sidebar-right .ai-header-top {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 18px;
            }
            #ai-sidebar-right h1 {
                font-size: 16px; font-weight: 700; color: var(--text);
                letter-spacing: -0.02em;
            }
            #ai-sidebar-right .ai-close-btn {
                background: var(--surface2, #27272c); border: 1px solid rgba(255,255,255,0.11);
                color: var(--muted, #6b6b7e); font-size: 14px; cursor: pointer;
                padding: 5px 8px; line-height: 1; border-radius: 5px;
                transition: all 0.15s; flex-shrink: 0;
            }
            #ai-sidebar-right .ai-close-btn:hover { color: var(--text); background: var(--surface3, #2e2e35); }
            
            .ai-tabs-container {
                display: flex; border-bottom: 1px solid rgba(58,58,66,0.5);
                margin: 0 -20px; padding: 0 20px;
            }
            .ai-tab {
                background: none; border: none; color: var(--muted, #6b6b7e);
                padding: 0 2px 11px; margin-right: 20px;
                font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
                position: relative; transition: color 0.15s; margin-bottom: -1px;
            }
            .ai-tab:hover { color: var(--text); }
            .ai-tab.active { color: var(--accent, #c29a40); }
            .ai-tab.active::after {
                content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
                background: linear-gradient(90deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                border-radius: 2px 2px 0 0;
                box-shadow: 0 0 8px rgba(194,154,64,0.28);
            }
            .ai-memory-badge {
                margin-left: auto; margin-bottom: 1px;
                display: flex; align-items: center; gap: 4px;
                font-size: 10px; font-weight: 600; color: #4ade80;
                padding: 2px 8px; border-radius: 20px;
                background: rgba(34,197,94,0.1);
                border: 1px solid rgba(34,197,94,0.2);
                white-space: nowrap; cursor: default;
            }
            .ai-chat-window {
                flex: 1; overflow-y: auto; padding: 18px;
                display: flex; flex-direction: column; gap: 14px;
                animation: fadeIn 0.2s ease;
            }
            .ai-chat-window::-webkit-scrollbar { width: 4px; }
            .ai-chat-window::-webkit-scrollbar-track { background: transparent; }
            .ai-chat-window::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.11); border-radius: 4px; }
            .ai-msg {
                padding: 12px 14px; border-radius: 8px;
                font-size: 13px; line-height: 1.5; word-wrap: break-word;
                animation: slideIn 0.2s ease;
            }
            .ai-msg.user {
                align-self: flex-end;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b; font-weight: 500; max-width: 85%;
                box-shadow: 0 2px 10px rgba(194,154,64,0.2);
            }
            .ai-msg.ai {
                align-self: flex-start; background: var(--surface2, #27272c);
                color: var(--text); border: 1px solid rgba(255,255,255,0.08); max-width: 90%;
            }
            .ai-msg.system {
                background: rgba(194,154,64,0.08); border: 1px solid rgba(194,154,64,0.2);
                color: var(--accent, #c29a40); align-self: center; text-align: center;
                font-style: italic; max-width: 92%; font-size: 12px; padding: 10px 12px;
            }
            .ai-msg.error {
                background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
                color: #ef4444; align-self: stretch; font-size: 12px; white-space: pre-wrap;
            }
            .ai-use-btn {
                display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;
                padding: 7px 14px;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b; border: none; border-radius: 6px;
                font-size: 11px; font-weight: 700; cursor: pointer;
                box-shadow: 0 2px 14px rgba(194,154,64,0.2); transition: all 0.15s;
            }
            .ai-use-btn:hover { box-shadow: 0 4px 22px rgba(194,154,64,0.28); transform: translateY(-1px); }
            .ai-use-btn:active { transform: translateY(0); }
            .ai-footer {
                padding: 18px; border-top: 1px solid rgba(58,58,66,0.5);
                background: linear-gradient(180deg, var(--surface) 0%, rgba(194,154,64,0.02) 100%);
                flex-shrink: 0;
            }
            .ai-input-box {
                background: var(--surface2, #27272c); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px; padding: 12px; margin-bottom: 12px;
            }
            .ai-input-box textarea {
                width: 100%; height: 90px; background: transparent; border: none;
                color: var(--text); font-size: 13px; font-family: inherit; resize: none; outline: none;
            }
            .ai-input-box textarea::placeholder { color: var(--muted, #6b6b7e); }
            .ai-send-btn {
                width: 100%; padding: 11px;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b; border: none; border-radius: 8px; font-weight: 700;
                font-size: 12px; cursor: pointer; font-family: inherit;
                display: flex; align-items: center; justify-content: center; gap: 6px;
                box-shadow: 0 2px 14px rgba(194,154,64,0.2); transition: all 0.15s;
            }
            .ai-send-btn:hover { box-shadow: 0 4px 22px rgba(194,154,64,0.28); transform: translateY(-1px); }
            .ai-send-btn:active { transform: translateY(0); }
            .ai-send-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
            .ai-recipe-btn {
                width: 100%; margin-top: 10px; padding: 10px;
                background: rgba(194,154,64,0.08); border: 1px solid rgba(194,154,64,0.25);
                border-radius: 8px; color: var(--accent, #c29a40); font-size: 12px;
                font-weight: 700; cursor: pointer; font-family: inherit;
                display: flex; align-items: center; justify-content: center; gap: 7px;
                transition: all 0.15s;
            }
            .ai-recipe-btn:hover { background: rgba(194,154,64,0.15); border-color: rgba(194,154,64,0.4); transform: translateY(-1px); }
            #btn-ai-toggle {
                background: none; border: none; color: var(--muted, #6b6b7e);
                font-size: 16px; cursor: pointer; width: 32px; height: 32px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 8px; transition: all 0.2s;
            }
            #btn-ai-toggle:hover { background: var(--surface2, #27272c); color: var(--accent, #c29a40); }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
            .ai-msg.typing {
                align-self: flex-start; background: var(--surface2, #27272c);
                border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
                display: flex; gap: 4px; padding: 12px 14px; width: fit-content;
            }
            .typing-dot {
                width: 6px; height: 6px; background: var(--muted, #6b6b7e);
                border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both;
            }
            .typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .typing-dot:nth-child(2) { animation-delay: -0.16s; }
            @keyframes typingBounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
            }
        `;
        document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.id = 'ai-sidebar-right';
    container.className = 'collapsed';
    container.innerHTML = `
        <div class="ai-panel-header">
            <div class="ai-header-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                    <path d="M12 12l3-5.2M12 12l3 5.2M12 12H7"/>
                </svg>
                ${window.i18n?.t('settings.nav.ai') || 'KI ASSISTENT'}
            </div>
            <div class="ai-header-top">
                <h1>${window.i18n?.t('ai.title') || 'Chat & Query'}</h1>
                <button class="ai-close-btn" id="ai-close-btn" title="Schließen">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="ai-tabs-container">
                <button class="ai-tab active" id="tab-ai-chat" data-mode="chat">💬 Chat</button>
                <button class="ai-tab" id="tab-ai-query" data-mode="query">📊 Query</button>
                <button class="ai-tab" id="tab-ai-recipe" data-mode="recipe">🍳 Rezepte</button>
                <div class="ai-memory-badge" id="ai-memory-badge" style="display:none" title="Langzeitgedächtnis aktiv">
                    🧠 <span id="ai-memory-count"></span>
                </div>
            </div>
        </div>
        <div class="ai-chat-window" id="ai-chat-history">
            <div class="ai-msg system">
                ${window.i18n?.t('ai.welcome_msg') || 'Hallo! Ich bin Kynto. Wie kann ich dir heute bei deinen Daten helfen?'}
            </div>
        </div>
        <div class="ai-chat-window" id="ai-recipe-panel" style="display:none; flex-direction:column; gap:12px; padding:18px;">
            <div class="ai-msg system">
                🍳 <strong>KI-Rezepte</strong><br>
                Verarbeite Tabellendaten automatisch mit KI — SEO, Übersetzen, Kategorisieren und mehr.
            </div>
            <button class="ai-recipe-btn" id="btn-open-recipe-modal">
                🍳 Neues Rezept erstellen
            </button>
            <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:4px">
                Wähle zuerst eine Tabelle im Editor, dann klicke hier.
            </div>
        </div>
        <div class="ai-footer">
            <div class="ai-input-box">
                <textarea id="ai-prompt-input" placeholder="Frage stellen…"></textarea>
            </div>
            <button class="ai-send-btn" id="btn-ai-generate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5h3V9h4v3h3l-5 5z"/>
                </svg>
                Senden
            </button>
        </div>
    `;
    document.body.appendChild(container);

    // Toggle-Button
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const aiBtn = document.createElement('button');
        aiBtn.id        = 'btn-ai-toggle';
        aiBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
                <path d="M12 12l3-5.2M12 12l3 5.2M12 12H7"/>
            </svg>
        `;
        aiBtn.title     = 'KI Assistent';
        themeBtn.parentNode.insertBefore(aiBtn, themeBtn);
        aiBtn.addEventListener('click', toggleSidebar);
    }

    document.getElementById('ai-close-btn').addEventListener('click', toggleSidebar);
    setupRecipeProgressListener();

    // Gedächtnis-Badge
    _checkAndShowMemoryBadge();

    // Tabs
    const tabChat    = document.getElementById('tab-ai-chat');
    const tabQuery   = document.getElementById('tab-ai-query');
    const tabRecipe  = document.getElementById('tab-ai-recipe');
    const chatHistory = document.getElementById('ai-chat-history');
    const recipePanel = document.getElementById('ai-recipe-panel');
    const footer      = container.querySelector('.ai-footer');

    const updateModeUI = (isQueryMode) => {
        aiQueryMode = isQueryMode;
        if (isQueryMode) {
            tabQuery.classList.add('active');  tabChat.classList.remove('active');
            input.placeholder = 'SQL-Frage stellen…';
            setStatus('SQL-Modus aktiv', 'info');
        } else {
            tabChat.classList.add('active');   tabQuery.classList.remove('active');
            input.placeholder = 'Frage stellen…';
            setStatus('Chat-Modus aktiv', 'info');
        }
    };

    const hideRecipePanel = () => {
        recipePanel.style.display = 'none';
        chatHistory.style.display = 'flex';
        footer.style.display = 'block';
    };

    tabChat.addEventListener('click',  () => { hideRecipePanel(); updateModeUI(false); });
    tabQuery.addEventListener('click', () => { hideRecipePanel(); updateModeUI(true);  });

    tabRecipe.addEventListener('click', () => {
        [tabChat, tabQuery, tabRecipe].forEach(t => t.classList.remove('active'));
        tabRecipe.classList.add('active');
        chatHistory.style.display = 'none';
        recipePanel.style.display = 'flex';
        footer.style.display = 'none';
        aiQueryMode = false;
    });

    document.getElementById('btn-open-recipe-modal').addEventListener('click', () => {
        const currentTable = state.currentTable;
        currentTable ? openRecipeModalForTable(currentTable) : openRecipeModal();
    });

    const btnGenerate = document.getElementById('btn-ai-generate');
    const input       = document.getElementById('ai-prompt-input');

    btnGenerate.addEventListener('click', () => handleAISubmit(input, btnGenerate));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!btnGenerate.disabled) handleAISubmit(input, btnGenerate);
        }
    });

    // Settings sofort laden
    window.api.loadSettings().then(s => {
        if (s?.ai) state.aiSettings = { ...s.ai };
    }).catch(() => {});
}

function toggleSidebar() {
    document.getElementById('ai-sidebar-right')?.classList.toggle('collapsed');
}

// ── Gedächtnis-Badge (zeigt Anzahl aktiver Wissens-Einträge) ──────────────

async function _checkAndShowMemoryBadge() {
    const badge = document.getElementById('ai-memory-badge');
    const count = document.getElementById('ai-memory-count');
    if (!badge) return;
    try {
        const db     = makeDbAdapter();
        const active = await checkKnowledgeActive(db);
        if (active) {
            badge.style.display = 'flex';
            // Wissens-Anzahl asynchron nachladen
            const { getKnowledgeStats } = await import('../../src/lib/ai/kynto_knowledge.js');
            const stats = await getKnowledgeStats(db).catch(() => null);
            if (count && stats?.knowledge?.active != null) {
                count.textContent = `Gedächtnis · ${stats.knowledge.active} Einträge`;
            } else if (count) {
                count.textContent = 'Gedächtnis aktiv';
            }
        } else {
            badge.style.display = 'none';
        }
    } catch {
        badge.style.display = 'none';
    }
}

// ── Zentrale KI-Anfrage ────────────────────────────────────────────────────

/**
 * Sendet eine Anfrage an die KI.
 * - Lädt Langzeit-Wissen in den System-Prompt (wenn Tabelle aktiv)
 * - Lädt den Chat-Verlauf der aktuellen Session
 * - Speichert user + assistant Nachrichten persistent
 * - Misst Antwortzeit (latencyMs)
 *
 * @param {string}  prompt
 * @param {boolean} forceQueryMode
 * @returns {Promise<string>}
 */
export async function getAICompletion(prompt, forceQueryMode = false) {
    let settings = state.aiSettings;
    if (!settings) {
        const saved = await window.api.loadSettings();
        settings = saved?.ai || {};
        state.aiSettings = settings;
    }

    if (!settings.enabled) throw new Error('KI ist in den Einstellungen deaktiviert.');

    const provider     = settings.provider || 'ollama';
    const isOllama     = provider === 'ollama';
    const rawEndpoint  = settings.apiKey?.trim() || 'http://localhost:11434';
    const endpoint     = isOllama ? sanitizeUrlHashParams(rawEndpoint) : null;
    const model        = (settings.model || '').trim() || (isOllama ? 'llama3' : '');

    if (isOllama && !model)             throw new Error('Kein Modell konfiguriert.');
    if (!isOllama && !settings.apiKey?.trim()) throw new Error(`Kein API-Key für ${provider}.`);

    // ── Gedächtnis laden ────────────────────────────────────────────────
    let memoryContext = '';
    let chatHistory   = [];
    let memoryActive  = false;

    try {
        const db = makeDbAdapter();

        // ▶ Fix: checkKnowledgeActive ist jetzt Boolean-safe (auch "true"-String)
        memoryActive = await checkKnowledgeActive(db);

        console.debug('[AI] memoryActive:', memoryActive, '| SESSION_ID:', SESSION_ID);

        if (memoryActive) {
            // Session sicherstellen
            await ensureSession(db, SESSION_ID, {
                dbMode:      state.dbMode,
                activeTable: state.currentTable,
            }).catch(() => {});

            // Wissen + Verlauf laden
            [memoryContext, chatHistory] = await Promise.all([
                getKnowledgeForPrompt(db, { limit: 50 }),
                getRecentChat(db, { limit: 30, sessionId: SESSION_ID }),
            ]);
        }
    } catch (err) {
        console.warn('[AI] Gedächtnis nicht verfügbar:', err.message);
    }

    // ── System-Prompt aufbauen ──────────────────────────────────────────
    const useQueryMode = forceQueryMode || aiQueryMode;
    const dbContext    = generateDatabaseContext(state);
    let systemPrompt   = buildSystemPrompt(useQueryMode ? 'query' : 'chat', dbContext);

    if (memoryContext) {
        systemPrompt += `\n\n${memoryContext}`;
    }

    // ── Payload ─────────────────────────────────────────────────────────
    const payload = {
        provider,
        endpoint,
        model,
        apiKey:      isOllama ? '' : settings.apiKey,
        prompt,
        systemPrompt,
        settings,
        chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
        dbMode:      state.dbMode || 'pglite',
        pgId:        state.pgId || state.activeDbId,
    };

    const sanitizedPayload = sanitizeArrayOfObjects([payload])[0];
    console.debug('[AI] Sende (sanitiert):', sanitizedPayload);

    // ── KI-Anfrage mit Zeitmessung ──────────────────────────────────────
    const t0 = Date.now();
    const response = await window.api.aiGenerate(payload);
    const latencyMs = Date.now() - t0;

    // ── Nachrichten persistent speichern ─────────────────────────────
    // ▶ Fix: Speicherung nur wenn memoryActive = true (und das wird jetzt korrekt ermittelt)
    if (memoryActive) {
        try {
            const db = makeDbAdapter();

            // contentType erkennen (SQL oder normaler Text)
            const responseContentType = isSQLCode(cleanupSQL(extractSQL(response))) ? 'sql' : 'text';

            await saveChatMessage(db, 'user', prompt, SESSION_ID, {
                contentType: 'text',
                model,
            });
            await saveChatMessage(db, 'assistant', response, SESSION_ID, {
                contentType: responseContentType,
                latencyMs,
                model,
            });

            console.debug(`[AI] Chat gespeichert. Latenz: ${latencyMs}ms, contentType: ${responseContentType}`);

            // Gedächtnis-Badge aktualisieren
            _checkAndShowMemoryBadge();
        } catch (err) {
            console.warn('[AI] Chat-Verlauf konnte nicht gespeichert werden:', err.message);
        }
    }

    return response;
}

// ── Submit-Handler ─────────────────────────────────────────────────────────

async function handleAISubmit(inputEl, btn) {
    const prompt = inputEl.value.trim();
    if (!prompt) return;

    appendMessage(prompt, 'user');
    inputEl.value   = '';
    btn.disabled    = true;
    btn.textContent = '⌛ KI arbeitet…';

    const typingIndicator = showTypingIndicator();

    try {
        const responseText = await getAICompletion(prompt);
        removeTypingIndicator(typingIndicator);

        const result = (responseText || '').trim();
        if (!result) throw new Error('Die KI hat eine leere Antwort geliefert.');

        appendAIResponse(result);
        setStatus('Antwort empfangen.', 'success');

    } catch (err) {
        removeTypingIndicator(typingIndicator);
        console.error('AI Error:', err);

        const endpoint = state.aiSettings?.apiKey?.trim() || 'http://localhost:11434';
        const model    = state.aiSettings?.model || 'llama3';

        let userMsg = `Fehler: ${err.message}`;
        if (err.message?.includes('ECONNREFUSED') || err.message?.includes('Failed to fetch')) {
            userMsg = `Ollama nicht erreichbar unter "${endpoint}".\n→ Terminal öffnen und "ollama serve" ausführen.`;
        } else if (err.message?.includes('404')) {
            userMsg = `Modell "${model}" nicht gefunden.\n→ Mit "ollama pull ${model}" installieren.`;
        } else if (err.message?.includes('401') || err.message?.includes('403')) {
            userMsg = `Authentifizierungsfehler — API-Key ungültig oder abgelaufen.`;
        } else if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
            userMsg = `Anfrage Timeout — Ollama antwortet nicht.\nErster Start kann langsam sein, bitte nochmal versuchen.`;
        }
        appendMessage(userMsg, 'error');

    } finally {
        btn.disabled    = false;
        btn.textContent = '✨ Anfrage senden';
    }
}

// ── Nachrichten rendern ────────────────────────────────────────────────────

function showTypingIndicator() {
    const history = document.getElementById('ai-chat-history');
    if (!history) return null;
    const msg = document.createElement('div');
    msg.className = 'ai-msg typing';
    msg.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
    return msg;
}

function removeTypingIndicator(indicator) {
    if (indicator?.parentNode) indicator.parentNode.removeChild(indicator);
}

function appendMessage(text, role) {
    const history = document.getElementById('ai-chat-history');
    if (!history) return;
    const msg = document.createElement('div');
    msg.className   = `ai-msg ${role}`;
    msg.textContent = text;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
}

function appendAIResponse(text) {
    const history = document.getElementById('ai-chat-history');
    if (!history) return;

    const msg = document.createElement('div');
    msg.className = 'ai-msg ai';

    let sqlToUse      = extractSQL(text);
    sqlToUse          = cleanupSQL(sqlToUse);
    const isLikelySQL = isSQLCode(sqlToUse);

    const escapedText   = escH(text);
    const formattedText = escapedText.replace(/\n/g, '<br>');
    msg.innerHTML = `<div style="white-space:pre-wrap;word-break:break-word;">${formattedText}</div>`;

    if (isLikelySQL) {
        const useBtn = document.createElement('button');
        useBtn.className = 'ai-use-btn';
        useBtn.innerHTML = '▶ In Editor übernehmen';
        useBtn.addEventListener('click', () => {
            if (state.editor?.setValue) {
                state.editor.setValue(sqlToUse);
            } else {
                const fb = document.getElementById('sql-fallback');
                if (fb) fb.value = sqlToUse;
            }
            document.getElementById('ai-sidebar-right')?.classList.add('collapsed');
            state.editor?.focus?.();
            setStatus('✅ SQL aus KI übernommen!', 'success');
        });
        msg.appendChild(document.createElement('br'));
        msg.appendChild(useBtn);
    }

    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
}