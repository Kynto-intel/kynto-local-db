/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ AI Settings Tab Module  v2.0                                            │
 * │ Verwaltet: AI Provider, API Key, Model, KI-Gedächtnis                  │
 * │                                                                         │
 * │ NEU in v2.0:                                                            │
 * │  - Statistiken (Einträge, Sessions, Nachrichten) im Status-Card        │
 * │  - Erweitertes Preview-Grid mit confidence, source, version            │
 * │  - Alle Tabellen-Namen aus kynto_knowledge.js importiert               │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { state } from '../state.js';
import {
    createKyntoKnowledgeTable,
    dropKyntoKnowledgeTables,
    checkKnowledgeActive,
    getKnowledgeStats,
    KY_TABLE_NAME,
    KY_CHAT_TABLE,
    KY_SESSIONS_TABLE,
    KY_TAGS_TABLE,
    KY_RELATIONS_TABLE,
    KY_AUDIT_TABLE,
} from '../../../src/lib/ai/kynto_knowledge.js';

export const aiTab = {
    name: 'ai',
    id: 'pane-ai',

    init() {
        const providerSelect = document.getElementById('setting-ai-provider');
        if (providerSelect) {
            providerSelect.addEventListener('change', () => this.updateAIUI());
        }
        this.injectMemorySection();
    },

    // ─────────────────────────────────────────────────────────────────────
    _makeDbAdapter() {
        return {
            query: (sql, params = []) =>
                window.api.dbQuery(
                    sql,
                    params,
                    state.dbMode === 'remote' ? 'remote' : 'local'
                ),
        };
    },

    // ─────────────────────────────────────────────────────────────────────
    // Gedächtnis-Sektion ins Settings-Pane injizieren
    // ─────────────────────────────────────────────────────────────────────

    async injectMemorySection() {
        const pane = document.getElementById(this.id);
        if (!pane || document.getElementById('kynto-memory-section')) return;

        const section = document.createElement('div');
        section.id = 'kynto-memory-section';
        section.style.cssText = `
            margin-top: 28px;
            padding-top: 18px;
            border-top: 1px solid var(--border, rgba(255,255,255,0.1));
        `;

        // ── Überschrift ───────────────────────────────────────────────────
        const heading = document.createElement('div');
        heading.style.cssText = `
            display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
            font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.12em; color: var(--accent, #c29a40);
        `;
        heading.innerHTML = `<span>🧠</span> KI-Gedächtnis <span style="font-weight:400;opacity:0.6;font-size:10px;text-transform:none;letter-spacing:0">v2.0</span>`;
        section.appendChild(heading);

        // ── Info-Karte ────────────────────────────────────────────────────
        const infoCard = document.createElement('div');
        infoCard.style.cssText = `
            padding: 12px 14px;
            background: rgba(194,154,64,0.06);
            border: 1px solid rgba(194,154,64,0.18);
            border-radius: 8px; font-size: 11px; line-height: 1.6;
            color: var(--text); opacity: 0.9; margin-bottom: 14px;
        `;
        infoCard.innerHTML = `
            Das Gedächtnis v2.0 speichert SQL-Regeln, Tabellenstrukturen und Vorlieben
            <strong>dauerhaft</strong> — inkl. Audit-Trail, Tags, Relationen und
            vollständigem Chat-Verlauf mit Session-Tracking.
        `;
        section.appendChild(infoCard);

        // ── Stats-Card (wird nach Aktivierung befüllt) ────────────────────
        const statsCard = document.createElement('div');
        statsCard.id = 'kynto-stats-card';
        statsCard.style.cssText = `
            display: none;
            margin-bottom: 14px;
            padding: 12px 14px;
            background: rgba(34,197,94,0.05);
            border: 1px solid rgba(34,197,94,0.15);
            border-radius: 8px;
            font-size: 11px;
            color: var(--text);
        `;
        section.appendChild(statsCard);

        // ── Aktivierungs-Button ───────────────────────────────────────────
        const btn = document.createElement('button');
        btn.id = 'btn-ai-create-table';
        btn.style.cssText = `
            width: 100%; padding: 10px 16px;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            border: none; border-radius: 8px;
            background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
            color: #18181b; font-weight: 700; font-size: 12px; font-family: inherit;
            cursor: pointer; transition: all 0.15s;
            box-shadow: 0 2px 14px rgba(194,154,64,0.2);
        `;
        section.appendChild(btn);

        // ── Deaktivierungs-Button ─────────────────────────────────────────
        const btnDeactivate = document.createElement('button');
        btnDeactivate.id = 'btn-ai-drop-table';
        btnDeactivate.style.cssText = `
            width: 100%; margin-top: 8px; padding: 8px 16px;
            display: none; align-items: center; justify-content: center; gap: 6px;
            border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
            background: rgba(239,68,68,0.07); color: #ef4444;
            font-weight: 600; font-size: 11px; font-family: inherit;
            cursor: pointer; transition: all 0.15s;
        `;
        btnDeactivate.innerHTML = `🗑️ Gedächtnis deaktivieren & löschen`;
        section.appendChild(btnDeactivate);

        // ── Wissen-Preview ────────────────────────────────────────────────
        const previewWrapper = document.createElement('div');
        previewWrapper.id = 'kynto-memory-preview';
        previewWrapper.style.cssText = `margin-top: 16px; display: none;`;

        const previewHeading = document.createElement('div');
        previewHeading.style.cssText = `
            font-size: 11px; font-weight: 600; color: var(--muted, #6b6b7e);
            margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;
        `;
        previewHeading.innerHTML = `
            <span>📋 Gespeichertes Wissen</span>
            <button id="btn-refresh-knowledge"
                    style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;padding:0">
                ↻ aktualisieren
            </button>
        `;
        previewWrapper.appendChild(previewHeading);

        const tableEl = document.createElement('div');
        tableEl.id = 'kynto-knowledge-table-preview';
        tableEl.style.cssText = `
            border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
            overflow: hidden; font-size: 11px;
        `;
        previewWrapper.appendChild(tableEl);
        section.appendChild(previewWrapper);
        pane.appendChild(section);

        // ── Events ────────────────────────────────────────────────────────
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.textContent = '⏳ Initialisiere Schema…';

            const db = this._makeDbAdapter();
            try {
                const result = await createKyntoKnowledgeTable(db);
                if (result.success) {
                    if (typeof window.refreshTableList === 'function') window.refreshTableList();
                    await this._updateMemoryStatus(btn, btnDeactivate, previewWrapper, tableEl, statsCard);
                } else {
                    btn.disabled = false;
                    btn.textContent = '❌ Fehler beim Erstellen';
                    console.error('[ai-tab] Schema-Fehler:', result.error);
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = '❌ Fehler beim Erstellen';
                console.error('[ai-tab] Schema-Fehler:', err);
            }
        });

        btnDeactivate.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = window.confirm(
                '⚠️ Sicher?\n\nDas löscht alle 6 Gedächtnis-Tabellen:\n' +
                `• ${KY_TABLE_NAME}\n• ${KY_CHAT_TABLE}\n• ${KY_SESSIONS_TABLE}\n` +
                `• ${KY_TAGS_TABLE}\n• ${KY_RELATIONS_TABLE}\n• ${KY_AUDIT_TABLE}\n\n` +
                'Alle Daten gehen unwiderruflich verloren! Fortfahren?'
            );
            if (!confirmed) return;

            btnDeactivate.disabled = true;
            btnDeactivate.textContent = '⏳ Lösche alle Tabellen…';

            const db = this._makeDbAdapter();
            try {
                const result = await dropKyntoKnowledgeTables(db);
                if (result.success) {
                    if (typeof window.refreshTableList === 'function') window.refreshTableList();
                    await this._updateMemoryStatus(btn, btnDeactivate, previewWrapper, tableEl, statsCard);
                } else {
                    btnDeactivate.disabled = false;
                    btnDeactivate.innerHTML = `🗑️ Gedächtnis deaktivieren & löschen`;
                    console.error('[ai-tab] Lösch-Fehler:', result.error);
                }
            } catch (err) {
                btnDeactivate.disabled = false;
                btnDeactivate.innerHTML = `🗑️ Gedächtnis deaktivieren & löschen`;
                console.error('[ai-tab] Lösch-Fehler:', err);
            }
        });

        document.addEventListener('click', async (e) => {
            if (e.target.id === 'btn-refresh-knowledge') {
                await this._loadKnowledgePreview(tableEl);
                const db = this._makeDbAdapter();
                await this._updateStatsCard(db, statsCard);
            }
        });

        await this._updateMemoryStatus(btn, btnDeactivate, previewWrapper, tableEl, statsCard);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Status aktualisieren
    // ─────────────────────────────────────────────────────────────────────

    async _updateMemoryStatus(btn, btnDeactivate, previewWrapper, tableEl, statsCard) {
        const db       = this._makeDbAdapter();
        const isActive = await checkKnowledgeActive(db);

        if (isActive) {
            btn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                🧠 KI-Gedächtnis v2 ist aktiv
            `;
            btn.style.background = 'rgba(34,197,94,0.12)';
            btn.style.color      = '#4ade80';
            btn.style.border     = '1px solid rgba(34,197,94,0.25)';
            btn.style.boxShadow  = 'none';
            btn.style.cursor     = 'default';
            btn.disabled         = true;

            btnDeactivate.style.display = 'flex';
            btnDeactivate.disabled      = false;
            btnDeactivate.innerHTML     = `🗑️ Gedächtnis deaktivieren & löschen`;

            previewWrapper.style.display = 'block';
            statsCard.style.display      = 'block';

            await Promise.all([
                this._loadKnowledgePreview(tableEl),
                this._updateStatsCard(db, statsCard),
            ]);
        } else {
            btn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                KI-Gedächtnis aktivieren
            `;
            btn.style.background = 'linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50))';
            btn.style.color      = '#18181b';
            btn.style.border     = 'none';
            btn.style.cursor     = 'pointer';
            btn.disabled         = false;

            btnDeactivate.style.display  = 'none';
            previewWrapper.style.display = 'none';
            statsCard.style.display      = 'none';
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Statistik-Card befüllen
    // ─────────────────────────────────────────────────────────────────────

    async _updateStatsCard(db, statsCard) {
        try {
            const s = await getKnowledgeStats(db);
            statsCard.innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
                    <div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="font-size:18px;font-weight:700;color:#4ade80">${s.knowledge?.active ?? 0}</div>
                        <div style="font-size:10px;color:var(--muted)">Wissens-Einträge</div>
                    </div>
                    <div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="font-size:18px;font-weight:700;color:var(--accent,#c29a40)">${s.chat?.total ?? 0}</div>
                        <div style="font-size:10px;color:var(--muted)">Chat-Nachrichten</div>
                    </div>
                    <div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <div style="font-size:18px;font-weight:700;color:#60a5fa">${s.sessions?.total ?? 0}</div>
                        <div style="font-size:10px;color:var(--muted)">Sessions</div>
                    </div>
                </div>
                <div style="font-size:10px;color:var(--muted);opacity:0.7">
                    Ø Wichtigkeit: ${s.knowledge?.avgImportance ?? '—'}/5 &nbsp;·&nbsp;
                    6 Tabellen aktiv: ${KY_TABLE_NAME}, ${KY_CHAT_TABLE}, ${KY_SESSIONS_TABLE}, ${KY_TAGS_TABLE}, ${KY_RELATIONS_TABLE}, ${KY_AUDIT_TABLE}
                </div>
            `;
        } catch (err) {
            statsCard.innerHTML = `<div style="color:var(--muted);font-size:11px">Statistiken nicht verfügbar: ${err.message}</div>`;
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Wissen-Preview-Grid
    // ─────────────────────────────────────────────────────────────────────

    async _loadKnowledgePreview(container) {
        container.innerHTML = `
            <div style="padding:10px;color:var(--muted);font-size:11px">⏳ Lade Wissens-Einträge…</div>
        `;

        try {
            const db   = this._makeDbAdapter();
            const rows = await db.query(`
                SELECT "id","category","topic","content","summary",
                       "importance","confidence","source","version",
                       "access_count","updated_at"
                FROM   "${KY_TABLE_NAME}"
                WHERE  "is_active" = TRUE
                ORDER  BY "importance" DESC, "access_count" DESC, "updated_at" DESC
                LIMIT  50
            `);

            if (!rows || rows.length === 0) {
                container.innerHTML = `
                    <div style="padding:12px;color:var(--muted);font-size:11px;text-align:center">
                        Noch keine Einträge gespeichert.
                    </div>
                `;
                return;
            }

            const headerStyle = `
                background: var(--surface2, #27272c); color: var(--muted, #6b6b7e);
                font-weight: 700; font-size: 10px; text-transform: uppercase;
                letter-spacing: 0.08em; padding: 6px 10px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            `;

            // Grid: Kategorie | Thema | Inhalt | Wichtig | Konfidenz | Abgerufen
            let html = `
                <div style="display:grid;grid-template-columns:0.8fr 1.2fr 2fr 32px 32px 32px;${headerStyle}">
                    <span>Kategorie</span>
                    <span>Thema</span>
                    <span>Inhalt / Zusammenfassung</span>
                    <span style="text-align:center" title="Wichtigkeit">⭐</span>
                    <span style="text-align:center" title="Konfidenz">🎯</span>
                    <span style="text-align:center" title="Abrufe">👁</span>
                </div>
            `;

            const escHtml = (s) =>
                String(s ?? '')
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            const truncate = (str, n = 55) =>
                str && str.length > n ? str.slice(0, n) + '…' : (str || '');

            rows.forEach((row, i) => {
                const bg      = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
                const display = row.summary
                    ? `<em style="opacity:0.7">${escHtml(truncate(row.summary, 55))}</em>`
                    : escHtml(truncate(row.content, 55));
                const stars   = '★'.repeat(Math.min(5, Math.max(1, row.importance || 1)));

                html += `
                    <div style="
                        display:grid;grid-template-columns:0.8fr 1.2fr 2fr 32px 32px 32px;
                        padding:6px 10px;font-size:11px;line-height:1.4;
                        background:${bg};border-bottom:1px solid rgba(255,255,255,0.04);
                        align-items:start;gap:4px;
                    " title="${escHtml(row.content)} [v${row.version}|${row.source}]">
                        <span style="color:var(--accent,#c29a40);font-weight:600">
                            ${escHtml(row.category)}
                        </span>
                        <span style="font-weight:500">${escHtml(truncate(row.topic, 28))}</span>
                        <span style="color:var(--muted,#6b6b7e)">${display}</span>
                        <span style="text-align:center;color:var(--accent,#c29a40);font-size:9px">${stars}</span>
                        <span style="text-align:center;color:var(--muted,#6b6b7e);font-size:10px">${row.confidence ?? '—'}</span>
                        <span style="text-align:center;color:var(--muted,#6b6b7e);font-size:10px">${row.access_count ?? 0}</span>
                    </div>
                `;
            });

            html += `
                <div style="
                    padding:6px 10px; font-size:10px; color:var(--muted);
                    background:var(--surface2,#27272c);
                    border-top:1px solid rgba(255,255,255,0.06);
                    display:flex; justify-content:space-between;
                ">
                    <span>${rows.length} Einträge geladen</span>
                    <span style="opacity:0.6">⭐=Wichtigkeit · 🎯=Konfidenz/10 · 👁=Abrufe</span>
                </div>
            `;

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `
                <div style="padding:10px;color:var(--error,#ef4444);font-size:11px">
                    ⚠️ Fehler beim Laden: ${err.message}
                </div>
            `;
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Provider-UI
    // ─────────────────────────────────────────────────────────────────────

    updateAIUI() {
        const providerSelect = document.getElementById('setting-ai-provider');
        const apiKeyInput    = document.getElementById('setting-ai-apiKey');
        if (!providerSelect || !apiKeyInput) return;

        const isOllama = providerSelect.value === 'ollama';
        const label    = document.querySelector('label[for="setting-ai-apiKey"]');

        apiKeyInput.type = isOllama ? 'text' : 'password';
        if (label) label.textContent = isOllama ? 'Ollama Endpoint URL:' : 'API Key:';
        apiKeyInput.placeholder = isOllama ? 'http://localhost:11434' : 'sk-…';

        let hint = document.getElementById('ollama-hint');
        if (isOllama) {
            if (!hint) {
                hint = document.createElement('div');
                hint.id = 'ollama-hint';
                hint.style.cssText = 'font-size:11px;color:var(--accent);margin-top:5px;opacity:0.8;';
                hint.textContent = 'ℹ️ Ollama muss lokal gestartet sein (Standard: Port 11434).';
                apiKeyInput.parentNode.appendChild(hint);
            }
            hint.style.display = 'block';
            if (!apiKeyInput.value.trim()) apiKeyInput.value = 'http://localhost:11434';
        } else if (hint) {
            hint.style.display = 'none';
        }
    },

    // ─────────────────────────────────────────────────────────────────────
    async load(settings) {
        const ai = settings.ai || {};
        const enabledInput   = document.getElementById('setting-ai-enabled');
        const providerSelect = document.getElementById('setting-ai-provider');
        const apiKeyInput    = document.getElementById('setting-ai-apiKey');
        const modelInput     = document.getElementById('setting-ai-model');

        if (enabledInput)   enabledInput.checked   = ai.enabled  || false;
        if (providerSelect) providerSelect.value    = ai.provider || 'ollama';
        if (apiKeyInput)    apiKeyInput.value       = ai.apiKey   || '';
        if (modelInput)     modelInput.value        = ai.model    || '';

        this.updateAIUI();
    },

    save(formData) {
        return {
            ai: {
                enabled:  formData.get('setting-ai-enabled') === 'on',
                provider: formData.get('setting-ai-provider') || 'ollama',
                apiKey:   formData.get('setting-ai-apiKey')   || '',
                model:    formData.get('setting-ai-model')    || '',
            },
        };
    },

    async apply(settings) {
        if (!settings.ai) return;
        state.aiSettings = { ...settings.ai };
    },
};