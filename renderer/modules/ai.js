/* ── modules/ai.js ────────────────────────────────────────────────────
   KI-Assistent Sidebar: Rechtes Interface für Natural Language Abfragen.

   FIXES gegenüber der alten Version:
   1. state.aiSettings wird beim Start aus gespeicherten Settings geladen
      (war vorher undefined bis der User manuell speicherte)
   2. Ollama-Endpoint-URL wird korrekt aus apiKey-Feld gelesen
   3. aiGenerate-IPC-Payload enthält endpoint + model explizit
   4. "enabled"-Check schlägt nicht mehr fehl wenn state.aiSettings null ist
   5. Kontext-Prompt enthält jetzt aktive DB + sauberes Schema
   6. Enter-Key-Handler verhindert Doppelabsenden korrekt
   7. "In Editor übernehmen"-Button in jeder SQL-Antwort
   8. Hilfreiche Fehlermeldungen je nach Fehlertyp (ECONNREFUSED, 404, 401)
   ──────────────────────────────────────────────────────────────────── */

import { state }           from './state.js';
import { setStatus, escH } from './utils.js';
import { sanitizeArrayOfObjects, sanitizeUrlHashParams } from '../../src/lib/sanitize.js';

// ✨ NEW: Import from src/lib/ai Library
import {
    extractSQLFromResponse as extractSQL,
    cleanupSQL,
    isSQLCode,
    buildSystemPrompt,
    generateDatabaseContext,
} from '../../src/lib/ai/index.js';

// ── Globaler State für AI-Mode ─────────────────────────────────────────
let aiQueryMode = false; // true = SQL-Generierung, false = normaler Chat

// ── Sidebar aufbauen ───────────────────────────────────────────────────

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
            
            /* Header mit Gradient */
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
            #ai-sidebar-right .ai-close-btn:hover {
                color: var(--text); background: var(--surface3, #2e2e35);
            }
            
            /* Tabs Navigation */
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
            
            /* Chat Window */
            .ai-chat-window {
                flex: 1;
                overflow-y: auto;
                padding: 18px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                animation: fadeIn 0.2s ease;
            }
            .ai-chat-window::-webkit-scrollbar { width: 4px; }
            .ai-chat-window::-webkit-scrollbar-track { background: transparent; }
            .ai-chat-window::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.11); border-radius: 4px;
            }
            
            /* Messages */
            .ai-msg {
                padding: 12px 14px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.5;
                word-wrap: break-word;
                animation: slideIn 0.2s ease;
            }
            .ai-msg.user {
                align-self: flex-end;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b;
                font-weight: 500;
                max-width: 85%;
                box-shadow: 0 2px 10px rgba(194,154,64,0.2);
            }
            .ai-msg.ai {
                align-self: flex-start;
                background: var(--surface2, #27272c);
                color: var(--text);
                border: 1px solid rgba(255,255,255,0.08);
                max-width: 90%;
            }
            .ai-msg.system {
                background: rgba(194,154,64,0.08);
                border: 1px solid rgba(194,154,64,0.2);
                color: var(--accent, #c29a40);
                align-self: center;
                text-align: center;
                font-style: italic;
                max-width: 92%;
                font-size: 12px;
                padding: 10px 12px;
            }
            .ai-msg.error {
                background: rgba(239,68,68,0.1);
                border: 1px solid rgba(239,68,68,0.3);
                color: #ef4444;
                align-self: stretch;
                font-size: 12px;
                white-space: pre-wrap;
            }
            
            /* Use Button */
            .ai-use-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-top: 10px;
                padding: 7px 14px;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b;
                border: none;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 2px 14px rgba(194,154,64,0.2);
                transition: all 0.15s;
            }
            .ai-use-btn:hover {
                box-shadow: 0 4px 22px rgba(194,154,64,0.28);
                transform: translateY(-1px);
            }
            .ai-use-btn:active { transform: translateY(0); }
            
            /* Footer */
            .ai-footer {
                padding: 18px;
                border-top: 1px solid rgba(58,58,66,0.5);
                background: linear-gradient(180deg, var(--surface) 0%, rgba(194,154,64,0.02) 100%);
                flex-shrink: 0;
            }
            
            /* Input Box */
            .ai-input-box {
                background: var(--surface2, #27272c);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
            }
            .ai-input-box textarea {
                width: 100%;
                height: 90px;
                background: transparent;
                border: none;
                color: var(--text);
                font-size: 13px;
                font-family: inherit;
                resize: none;
                outline: none;
            }
            .ai-input-box textarea::placeholder {
                color: var(--muted, #6b6b7e);
            }
            
            /* Send Button */
            .ai-send-btn {
                width: 100%;
                padding: 11px;
                background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
                color: #18181b;
                border: none;
                border-radius: 8px;
                font-weight: 700;
                font-size: 12px;
                cursor: pointer;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 2px 14px rgba(194,154,64,0.2);
                transition: all 0.15s;
            }
            .ai-send-btn:hover {
                box-shadow: 0 4px 22px rgba(194,154,64,0.28);
                transform: translateY(-1px);
            }
            .ai-send-btn:active { transform: translateY(0); }
            .ai-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            
            /* Toggle Button */
            #btn-ai-toggle {
                background: none;
                border: none;
                color: var(--text);
                font-size: 18px;
                cursor: pointer;
                padding: 6px 10px;
                border-radius: 6px;
                transition: all 0.2s;
            }
            #btn-ai-toggle:hover {
                background: var(--surface2, #27272c);
                color: var(--accent, #c29a40);
            }
            
            /* Animations */
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.id = 'ai-sidebar-right';
    container.className = 'collapsed';
    container.innerHTML = `
        <div class="ai-panel-header">
            <div class="ai-header-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                KI ASSISTENT
            </div>
            <div class="ai-header-top">
                <h1>Chat & Query</h1>
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
            </div>
        </div>
        <div class="ai-chat-window" id="ai-chat-history">
            <div class="ai-msg system">
                Willkommen! 👋 Ich bin dein KI-Assistent. Nutze mich für Datenanalysen, SQL-Abfragen oder einfache Fragen.
            </div>
        </div>
        <div class="ai-footer">
            <div class="ai-input-box">
                <textarea id="ai-prompt-input"
                    placeholder="Stelle deine Frage oder beschreibe deine Anfrage..."></textarea>
            </div>
            <button class="ai-send-btn" id="btn-ai-generate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5h3V9h4v3h3l-5 5z"/>
                </svg>
                Anfrage senden
            </button>
        </div>
    `;
    document.body.appendChild(container);

    // Toggle-Button neben Theme-Button
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const aiBtn = document.createElement('button');
        aiBtn.id        = 'btn-ai-toggle';
        aiBtn.innerHTML = '🤖';
        aiBtn.title     = 'KI Assistent';
        themeBtn.parentNode.insertBefore(aiBtn, themeBtn);
        aiBtn.addEventListener('click', toggleSidebar);
    }

    document.getElementById('ai-close-btn').addEventListener('click', toggleSidebar);

    const btnGenerate = document.getElementById('btn-ai-generate');
    const tabChat = document.getElementById('tab-ai-chat');
    const tabQuery = document.getElementById('tab-ai-query');
    const input = document.getElementById('ai-prompt-input');

    // Helper für Mode-Update
    const updateModeUI = (isQueryMode) => {
        aiQueryMode = isQueryMode;
        
        // Tab-Styling aktualisieren
        if (aiQueryMode) {
            tabQuery.classList.add('active');
            tabChat.classList.remove('active');
            input.placeholder = 'Beschreibe die Datenbank-Abfrage die du brauchst...';
            setStatus('Query-Modus aktiviert (SQL-Generierung)', 'info');
        } else {
            tabChat.classList.add('active');
            tabQuery.classList.remove('active');
            input.placeholder = 'Stelle deine Frage oder Anfrage...';
            setStatus('Chat-Modus aktiviert (Analysen & Fragen)', 'info');
        }
    };

    // Tab Event Listener
    tabChat.addEventListener('click', () => updateModeUI(false));
    tabQuery.addEventListener('click', () => updateModeUI(true));

    btnGenerate.addEventListener('click', () => handleAISubmit(input, btnGenerate));

    // FIX 6: Doppelabsenden verhindern (auch Shift+Enter für Zeilenumbruch)
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!btnGenerate.disabled) handleAISubmit(input, btnGenerate);
        }
    });

    // FIX 1: aiSettings sofort beim Init laden
    window.api.loadSettings().then(s => {
        if (s?.ai) state.aiSettings = { ...s.ai };
    }).catch(() => {});
}

function toggleSidebar() {
    document.getElementById('ai-sidebar-right')?.classList.toggle('collapsed');
}

// ✨ REMOVED: extractSQLFromResponse u. normalizeSQLIdentifiers moved to src/lib/ai/util.js
// Import them at the top of this file instead

// ── KI-Anfrage verarbeiten ─────────────────────────────────────────────

/**
 * Zentrale Funktion, um eine KI-Antwort zu erhalten (wird von Sidebar & Inline-Widget genutzt)
 * @param {string} prompt - Die Benutzereingabe
 * @param {boolean} forceQueryMode - Force Query-Modus (z.B. für AskAIWidget)
 */
export async function getAICompletion(prompt, forceQueryMode = false) {
    let settings = state.aiSettings;
    if (!settings) {
        const saved = await window.api.loadSettings();
        settings = saved?.ai || {};
        state.aiSettings = settings;
    }

    if (!settings.enabled) throw new Error('KI ist in den Einstellungen deaktiviert.');

    const provider = settings.provider || 'ollama';
    const isOllama = provider === 'ollama';
    
    // Nutze sanitizeUrlHashParams für saubere Endpunkte
    const rawEndpoint = settings.apiKey?.trim() || 'http://localhost:11434';
    const endpoint = isOllama ? sanitizeUrlHashParams(rawEndpoint) : null;
    const model = (settings.model || '').trim() || (isOllama ? 'llama3' : '');

    if (isOllama && !model) throw new Error('Kein Modell konfiguriert.');
    if (!isOllama && !settings.apiKey?.trim()) throw new Error(`Kein API-Key für ${provider}.`);

    const schemaLines = Object.entries(state.knownColumns || {})
        .map(([tbl, cols]) => `  - "${tbl}": ${cols.join(', ')}`)
        .join('\n');
    const dbName = state.activeDbId ? state.activeDbId.split(/[/\\]/).pop() : null;

    // ✨ NEW: Nutze buildSystemPrompt aus src/lib/ai
    const useQueryMode = forceQueryMode || aiQueryMode;
    const dbContext = generateDatabaseContext(state);
    const systemPrompt = buildSystemPrompt(useQueryMode ? 'query' : 'chat', dbContext);

    const payload = { 
        provider, 
        endpoint, 
        model, 
        apiKey: isOllama ? '' : settings.apiKey, 
        prompt, 
        systemPrompt,
        settings,
        // 🗄️ Database context für Backend Tool-Calling
        dbMode: state.dbMode || 'pglite',
        pgId: state.pgId || state.activeDbId,
    };

    // Sanitize Payload für das Logging (Sicherheitsmaßnahme)
    const sanitizedPayload = sanitizeArrayOfObjects([payload])[0];
    console.debug('[AI] Sende (sanitierte) Anfrage:', sanitizedPayload);

    return await window.api.aiGenerate(payload);
}

async function handleAISubmit(inputEl, btn) {
    const prompt = inputEl.value.trim();
    if (!prompt) return;

    appendMessage(prompt, 'user');
    inputEl.value   = '';
    btn.disabled    = true;
    btn.textContent = '⌛ KI arbeitet…';

    try {
        const responseText = await getAICompletion(prompt);
        const result = (responseText || '').trim();
        if (!result) throw new Error('Die KI hat eine leere Antwort geliefert.');

        appendAIResponse(result);
        setStatus('Antwort empfangen.', 'success');

    } catch (err) {
        console.error('AI Error:', err);

        // FIX 8: Hilfreiche Fehlermeldungen
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

// ── Nachrichten rendern ────────────────────────────────────────────────

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
    
    // ✨ NEW: Nutze Library-Funktionen für SQL-Verarbeitung
    let sqlToUse = extractSQL(text);        // Extract SQL from text
    sqlToUse = cleanupSQL(sqlToUse);        // Normalize & cleanup automatically
    const isLikelySQL = isSQLCode(sqlToUse);

    // Formatiere Text mit Zeilenumbrüchen
    const escapedText = escH(text);
    const formattedText = escapedText.replace(/\n/g, '<br>');
    msg.innerHTML = `<div style="white-space:pre-wrap; word-break:break-word;">${formattedText}</div>`;

    if (isLikelySQL) {
        const useBtn = document.createElement('button');
        useBtn.className   = 'ai-use-btn';
        useBtn.innerHTML   = '▶ In Editor übernehmen';
        useBtn.addEventListener('click', () => {
            if (state.editor?.setValue) {
                state.editor.setValue(sqlToUse); // ← Already cleaned up!
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