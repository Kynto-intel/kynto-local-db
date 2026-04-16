/**
 * 🍳 Kynto AI Recipes - Frontend UI
 * 
 * BUGFIX v2:
 * - runForReal() rief collectFormValues() auf NACHDEM der Tab gewechselt wurde
 *   → alle Form-Elemente waren weg → masterPrompt wurde '' → KI scheiterte
 * - Fix: Recipe-State + Job-Params werden in runPreview() eingefroren (frozen*)
 * - Fix: runForReal() nutzt recipe-commit-draft (nur DB-Schreiben, KEIN neuer AI-Call)
 * - Fix: pendingDraftResults speichert die vom Dry Run berechneten Ergebnisse
 */

import { state } from '../../../renderer/modules/state.js';
import { setStatus } from '../../../renderer/modules/utils.js';

// ============================================================================
// 🔒 MODUL-STATE (Wichtig für den Fix!)
// ============================================================================

let currentRecipe = {
  name: '',
  targetTable: '',
  inputColumns: [],
  outputColumns: [],
  masterPrompt: '',
  sourceType: 'column',
  sourceConfig: {},
  flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
};

// FIX: Eingefrorener Zustand zum Zeitpunkt des Previews
let frozenRecipe = null;      // Snapshot von currentRecipe beim Dry Run Start
let frozenJobParams = null;   // Snapshot der Job-Parameter beim Dry Run Start
let pendingDraftResults = null; // Ergebnisse des Dry Runs (zum späteren Committen)

let currentJobId = null;
let activeTab = 'setup';

// ============================================================================
// 🎨 STYLES
// ============================================================================

export function initRecipeStyles() {
  if (document.getElementById('kynto-recipe-styles')) return;

  const style = document.createElement('style');
  style.id = 'kynto-recipe-styles';
  style.textContent = `
    #recipe-modal-overlay {
      position: fixed; inset: 0; z-index: 3000;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.15s ease;
    }
    #recipe-modal {
      width: 780px; max-width: 95vw; max-height: 90vh;
      background: var(--surface, #18181b);
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 12px;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      overflow: hidden;
      animation: slideUp 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    .recipe-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(180deg, rgba(194,154,64,0.06) 0%, transparent 100%);
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .recipe-header-title { display: flex; align-items: center; gap: 10px; }
    .recipe-header-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
      display: flex; align-items: center; justify-content: center; font-size: 16px;
      box-shadow: 0 4px 12px rgba(194,154,64,0.3);
    }
    .recipe-header h2 { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
    .recipe-header p { font-size: 12px; color: var(--muted, #6b6b7e); margin-top: 1px; }
    .recipe-close-btn {
      background: var(--surface2); border: 1px solid rgba(255,255,255,0.08);
      color: var(--muted); cursor: pointer; padding: 6px 8px; border-radius: 6px;
      font-size: 12px; transition: all 0.15s; line-height: 1;
    }
    .recipe-close-btn:hover { color: var(--text); background: var(--surface3); }
    .recipe-tabs {
      display: flex; border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 0 24px; background: var(--surface); flex-shrink: 0;
    }
    .recipe-tab {
      background: none; border: none; color: var(--muted);
      padding: 10px 16px; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; position: relative;
      transition: color 0.15s; margin-bottom: -1px;
    }
    .recipe-tab:hover { color: var(--text); }
    .recipe-tab.active { color: var(--accent, #c29a40); border-bottom: 2px solid var(--accent, #c29a40); }
    .recipe-content { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .recipe-content::-webkit-scrollbar { width: 4px; }
    .recipe-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .recipe-section { margin-bottom: 20px; }
    .recipe-section-title {
      font-size: 11px; font-weight: 700; color: var(--accent, #c29a40);
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;
      display: flex; align-items: center; gap: 6px;
    }
    .recipe-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .recipe-field { margin-bottom: 12px; }
    .recipe-field label {
      display: block; font-size: 11px; font-weight: 600;
      color: var(--muted, #6b6b7e); margin-bottom: 5px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .recipe-field input, .recipe-field select, .recipe-field textarea {
      width: 100%; background: var(--surface2, #27272c);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
      color: var(--text); font-size: 13px; font-family: inherit;
      padding: 9px 12px; transition: border-color 0.15s; box-sizing: border-box;
    }
    .recipe-field input:focus, .recipe-field select:focus, .recipe-field textarea:focus {
      outline: none; border-color: rgba(194,154,64,0.4);
      box-shadow: 0 0 0 2px rgba(194,154,64,0.08);
    }
    .recipe-field textarea { height: 120px; resize: vertical; font-size: 12px; line-height: 1.5; }
    .recipe-field select option { background: var(--surface2); }
    .recipe-field .field-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .recipe-flags { display: flex; flex-wrap: wrap; gap: 8px; }
    .recipe-flag {
      display: flex; align-items: center; gap: 6px;
      background: var(--surface2); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px; padding: 6px 10px; cursor: pointer;
      transition: all 0.15s; font-size: 12px; color: var(--muted);
    }
    .recipe-flag:hover { border-color: rgba(194,154,64,0.3); color: var(--text); }
    .recipe-flag input[type=checkbox] { accent-color: var(--accent, #c29a40); }
    .recipe-flag.checked { border-color: rgba(194,154,64,0.3); color: var(--accent, #c29a40); background: rgba(194,154,64,0.06); }
    .recipe-templates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .recipe-template-btn {
      background: var(--surface2); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 10px 12px; cursor: pointer; text-align: left;
      transition: all 0.15s; color: var(--text);
    }
    .recipe-template-btn:hover { border-color: rgba(194,154,64,0.3); background: rgba(194,154,64,0.04); }
    .recipe-template-btn .tmpl-icon { font-size: 16px; margin-bottom: 4px; }
    .recipe-template-btn .tmpl-name { font-size: 12px; font-weight: 600; }
    .recipe-template-btn .tmpl-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .column-mapper {
      background: var(--surface2); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 12px;
    }
    .column-mapper-title { font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
    .column-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 32px; }
    .column-chip {
      background: rgba(194,154,64,0.1); border: 1px solid rgba(194,154,64,0.25);
      color: var(--accent, #c29a40); padding: 3px 10px; border-radius: 20px;
      font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer;
      transition: all 0.15s;
    }
    .column-chip:hover { background: rgba(194,154,64,0.2); }
    .column-chip.output-chip { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.25); color: #22c55e; }
    .column-chip .chip-remove { opacity: 0.6; font-size: 10px; }
    .column-chip .chip-remove:hover { opacity: 1; }
    .recipe-progress { padding: 0; }
    .progress-bar-track { height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
    .progress-bar-fill {
      height: 100%; background: linear-gradient(90deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
      border-radius: 3px; transition: width 0.3s ease;
      box-shadow: 0 0 8px rgba(194,154,64,0.3);
    }
    .progress-stats { display: flex; gap: 16px; font-size: 12px; margin-bottom: 12px; }
    .progress-stat { display: flex; flex-direction: column; gap: 2px; }
    .progress-stat-value { font-weight: 700; font-size: 16px; color: var(--text); }
    .progress-stat-label { color: var(--muted); font-size: 11px; }
    .progress-stat.success .progress-stat-value { color: #22c55e; }
    .progress-stat.error .progress-stat-value { color: #ef4444; }
    .recipe-log {
      background: var(--surface2); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px; padding: 10px 12px; height: 200px;
      overflow-y: auto; font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 11px; line-height: 1.6;
    }
    .recipe-log::-webkit-scrollbar { width: 4px; }
    .recipe-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
    .log-entry { margin-bottom: 2px; }
    .log-entry.info { color: var(--muted); }
    .log-entry.success { color: #22c55e; }
    .log-entry.error { color: #ef4444; }
    .log-entry.warning { color: #f59e0b; }
    .log-time { opacity: 0.5; margin-right: 6px; }
    .draft-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .draft-table th {
      padding: 8px 10px; text-align: left; color: var(--muted);
      border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 600;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .draft-table td {
      padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text); max-width: 200px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .draft-table tr:hover td { background: rgba(255,255,255,0.02); }
    .draft-null { color: var(--muted); font-style: italic; }

    /* FIX-INDICATOR: Zeigt ob es sich um einen Commit (kein neuer AI-Call) handelt */
    .commit-badge {
      background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);
      color: #22c55e; padding: 4px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600;
    }

    .recipe-footer {
      padding: 14px 24px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
      background: var(--surface);
    }
    .recipe-footer-status { font-size: 12px; color: var(--muted); }
    .btn-recipe-primary {
      padding: 9px 20px;
      background: linear-gradient(135deg, var(--accent, #c29a40), var(--accent-hi, #d4aa50));
      color: #18181b; border: none; border-radius: 7px; font-weight: 700;
      font-size: 12px; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 12px rgba(194,154,64,0.2); transition: all 0.15s;
    }
    .btn-recipe-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(194,154,64,0.28); }
    .btn-recipe-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-recipe-secondary {
      padding: 9px 16px; background: var(--surface2);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;
      color: var(--muted); font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .btn-recipe-secondary:hover { color: var(--text); border-color: rgba(255,255,255,0.15); }
    .btn-recipe-danger {
      padding: 9px 16px; background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25); border-radius: 7px;
      color: #ef4444; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .btn-recipe-danger:hover { background: rgba(239,68,68,0.18); }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// 📋 RECIPE TEMPLATES
// ============================================================================

const RECIPE_TEMPLATES = [
  {
    id: 'seo',
    icon: '🔍',
    name: 'SEO-Optimierung',
    desc: 'Keywords + Meta-Titel generieren',
    masterPrompt: `Du bist ein SEO-Experte. Analysiere die Produktbeschreibung und erstelle:
- 5 relevante SEO-Keywords
- Einen Meta-Titel (max. 60 Zeichen)

Antworte NUR im JSON-Format. Wenn du keine guten Keywords findest, setze null.`,
    outputColumns: ['seo_keywords', 'meta_title'],
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'translate',
    icon: '🌐',
    name: 'Übersetzen',
    desc: 'Text in andere Sprache übersetzen',
    masterPrompt: `Du bist ein professioneller Übersetzer ins Englische.
Übersetze den gegebenen deutschen Text ins Englische.
Gib NUR die Übersetzung aus, keine Erklärungen.`,
    outputColumns: ['text_en'],
    flags: { strictFacts: false, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'categorize',
    icon: '🏷️',
    name: 'Kategorisieren',
    desc: 'Einträge automatisch kategorisieren',
    masterPrompt: `Du bist ein Daten-Klassifikator.
Analysiere den Text und ordne ihn einer Kategorie zu.
Mögliche Kategorien: [Technik, Finanzen, Marketing, HR, Sonstiges]
Antworte NUR mit dem Kategorie-Namen, sonst nichts.`,
    outputColumns: ['kategorie'],
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'summarize',
    icon: '📝',
    name: 'Zusammenfassen',
    desc: 'Langen Text in 2-3 Sätze fassen',
    masterPrompt: `Du bist ein Text-Zusammenfasser.
Fasse den gegebenen Text in 2-3 prägnanten Sätzen zusammen.
Antworte NUR mit der Zusammenfassung. Wenn kein Text vorhanden, antworte mit null.`,
    outputColumns: ['zusammenfassung'],
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'web_enrich',
    icon: '🕷️',
    name: 'Web-Anreicherung',
    desc: 'Firmendaten aus dem Internet ergänzen',
    masterPrompt: `Du bist ein Daten-Anreicherungs-Agent.
Extrahiere aus dem bereitgestellten Webseiten-Inhalt:
- Den CEO/Gründer der Firma
- Das Gründungsjahr
- Die Branche

Wenn eine Information nicht im Text steht, setze null. Erfinde NICHTS.`,
    outputColumns: ['ceo', 'gruendungsjahr', 'branche'],
    sourceType: 'web_search',
    searchTemplate: '{firmenname} über uns',
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'sentiment',
    icon: '😊',
    name: 'Sentiment-Analyse',
    desc: 'Stimmung in Texten erkennen',
    masterPrompt: `Du bist ein Sentiment-Analytor.
Analysiere die Stimmung im Text.
Mögliche Werte: "positiv", "negativ", "neutral"
Antworte NUR mit einem dieser drei Wörter.`,
    outputColumns: ['sentiment'],
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
  },
  {
    id: 'url_extract',
    icon: '🔗',
    name: 'URL-Inhalts-Extraktor',
    desc: 'Besucht URLs aus einer Spalte und füllt Daten aus',
    masterPrompt: `Du bist ein präziser Daten-Extraktor. 
Analysiere den bereitgestellten Inhalt der Webseite sorgfältig und extrahiere Informationen für die gewünschten Felder wie Produktname, Beschreibung und Preis. 
Extrahiere den Preis bitte inklusive Währung (z.B. "49,99 €") und erstelle eine prägnante Zusammenfassung für die Beschreibung.
Falls eine Information nicht eindeutig gefunden werden kann, versuche eine begründete Vermutung basierend auf dem Kontext zu treffen oder setze null.`,
    outputColumns: ['produkt_name', 'beschreibung', 'preis'],
    sourceType: 'url_column',
    urlColumn: 'url', // Standard-Vorschlag für den Spaltennamen
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true, forcePlaywright: true },
  },
];

// ============================================================================
// 🍳 RECIPE MODAL
// ============================================================================

export function openRecipeModal(targetTable = null) {
  initRecipeStyles();

  if (targetTable) currentRecipe.targetTable = targetTable;

  // Reset frozen state on new modal open
  frozenRecipe = null;
  frozenJobParams = null;
  pendingDraftResults = null;
  currentJobId = null;
  activeTab = 'setup';

  const overlay = document.createElement('div');
  overlay.id = 'recipe-modal-overlay';
  overlay.innerHTML = buildModalHTML();
  document.body.appendChild(overlay);

  bindModalEvents();
  populateTableSelect();

  if (currentRecipe.targetTable) {
    populateColumnSelectors(currentRecipe.targetTable);
  }
}

function buildModalHTML() {
  return `
    <div id="recipe-modal">
      <div class="recipe-header">
        <div class="recipe-header-title">
          <div class="recipe-header-icon">🍳</div>
          <div>
            <h2>KI-Rezept erstellen</h2>
            <p>Verarbeite Tabellendaten automatisch mit KI</p>
          </div>
        </div>
        <button class="recipe-close-btn" id="recipe-close">✕ Schließen</button>
      </div>
      <div class="recipe-tabs">
        <button class="recipe-tab active" data-tab="setup">⚙️ Einrichten</button>
        <button class="recipe-tab" data-tab="templates">📋 Vorlagen</button>
        <button class="recipe-tab" data-tab="run">▶ Ausführen</button>
      </div>
      <div class="recipe-content" id="recipe-tab-content">
        ${buildSetupTab()}
      </div>
      <div class="recipe-footer">
        <div class="recipe-footer-status" id="recipe-status">Bereit</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-recipe-secondary" id="recipe-cancel-btn">Abbrechen</button>
          <button class="btn-recipe-primary" id="recipe-preview-btn">
            👁 Vorschau (Dry Run)
          </button>
          <button class="btn-recipe-primary" id="recipe-run-btn" style="display:none">
            💾 Ergebnisse in DB schreiben
          </button>
        </div>
      </div>
    </div>
  `;
}

function buildSetupTab() {
  const tables = Object.keys(state.knownColumns || {});
  const tableOptions = tables.map(t =>
    `<option value="${t}" ${t === currentRecipe.targetTable ? 'selected' : ''}>${t}</option>`
  ).join('');

  return `
    <div class="recipe-section">
      <div class="recipe-section-title">🎯 Grundeinstellungen</div>
      <div class="recipe-row">
        <div class="recipe-field">
          <label>Rezept-Name</label>
          <input type="text" id="recipe-name" placeholder="z.B. SEO Keywords generieren" value="${currentRecipe.name || ''}">
        </div>
        <div class="recipe-field">
          <label>Zieltabelle</label>
          <select id="recipe-table">
            <option value="">– Tabelle wählen –</option>
            ${tableOptions}
          </select>
        </div>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">📥 Eingabe-Spalten (was die KI lesen darf)</div>
      <div class="column-mapper" id="input-cols-area">
        <div class="column-mapper-title">Klicke auf Spalten um sie auszuwählen:</div>
        <div class="column-chips" id="available-input-cols">
          <span style="color:var(--muted);font-size:12px">Erst eine Tabelle wählen...</span>
        </div>
        <div style="margin-top:8px;">
          <div class="column-mapper-title">Ausgewählt:</div>
          <div class="column-chips" id="selected-input-cols">
            <span style="color:var(--muted);font-size:12px;font-style:italic">Keine</span>
          </div>
        </div>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">📤 Ausgabe-Spalten (was die KI befüllen soll)</div>
      <div class="recipe-field">
        <input type="text" id="output-col-input" placeholder="Spaltenname eingeben und Enter drücken">
        <div class="field-hint">Spalten müssen bereits in der Tabelle existieren</div>
      </div>
      <div class="column-chips" id="selected-output-cols">
        <span style="color:var(--muted);font-size:12px;font-style:italic">Noch keine Output-Spalten</span>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">🌐 Web-Quelle (optional)</div>
      <div class="recipe-field">
        <label>Datenquelle</label>
        <select id="recipe-source-type">
          <option value="column" ${currentRecipe.sourceType === 'column' ? 'selected' : ''}>Nur Tabellen-Daten (kein Web)</option>
          <option value="url_column" ${currentRecipe.sourceType === 'url_column' ? 'selected' : ''}>URL aus Spalte laden</option>
          <option value="web_search" ${currentRecipe.sourceType === 'web_search' ? 'selected' : ''}>Web-Suche basierend auf Tabellenwerten</option>
        </select>
      </div>
      <div id="source-config-area" style="display:${currentRecipe.sourceType !== 'column' ? 'block' : 'none'}">
        <div class="recipe-row">
          <div class="recipe-field">
            <label id="source-config-label">${currentRecipe.sourceType === 'url_column' ? 'URL-Spalte' : 'Such-Template'}</label>
            <input type="text" id="source-config-value" placeholder="z.B. website_url oder {firma} CEO" value="${currentRecipe.sourceConfig?.urlColumn || currentRecipe.sourceConfig?.searchTemplate || ''}">
          </div>
          <div class="recipe-field">
            <label>Filter-Schlüsselwörter (Komma getrennt)</label>
            <input type="text" id="source-keywords" placeholder="CEO, Gründer, about us" value="${(currentRecipe.sourceConfig?.keywords || []).join(', ')}">
          </div>
        </div>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">🤖 Master Prompt</div>
      <div class="recipe-field">
        <textarea id="recipe-master-prompt" placeholder="Du bist ein Daten-Extraktor...">${currentRecipe.masterPrompt || ''}</textarea>
        <div class="field-hint">Anti-Halluzinations-Regeln werden automatisch hinzugefügt.</div>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">🛡️ Anti-Halluzinations-Regeln</div>
      <div class="recipe-flags" id="recipe-flags">
        <label class="recipe-flag ${currentRecipe.flags.strictFacts ? 'checked' : ''}">
          <input type="checkbox" id="flag-strict" ${currentRecipe.flags.strictFacts ? 'checked' : ''}> Strikte Fakten-Treue
        </label>
        <label class="recipe-flag ${currentRecipe.flags.jsonOutput ? 'checked' : ''}">
          <input type="checkbox" id="flag-json" ${currentRecipe.flags.jsonOutput ? 'checked' : ''}> Nur JSON-Ausgabe
        </label>
        <label class="recipe-flag ${currentRecipe.flags.noBlaBla ? 'checked' : ''}">
          <input type="checkbox" id="flag-noblabla" ${currentRecipe.flags.noBlaBla ? 'checked' : ''}> Kein Bla-Bla
        </label>
      </div>
    </div>

    <div class="recipe-section">
      <div class="recipe-section-title">⚙️ Ausführungs-Optionen</div>
      <div class="recipe-row">
        <div class="recipe-field">
          <label>Maximale Zeilen</label>
          <input type="number" id="recipe-max-rows" value="${currentRecipe._maxRows || 10}" min="1" max="1000">
        </div>
        <div class="recipe-field">
          <label>WHERE-Klausel (optional)</label>
          <input type="text" id="recipe-where" placeholder='z.B. seo_keywords IS NULL' value="${currentRecipe.whereClause || ''}">
        </div>
      </div>
    </div>
  `;
}

function buildTemplatesTab() {
  return `
    <div class="recipe-section">
      <div class="recipe-section-title">📋 Vorlagen</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px">Klicke auf eine Vorlage um den Master Prompt vorzufüllen.</p>
      <div class="recipe-templates">
        ${RECIPE_TEMPLATES.map(t => `
          <button class="recipe-template-btn" data-template-id="${t.id}">
            <div class="tmpl-icon">${t.icon}</div>
            <div class="tmpl-name">${t.name}</div>
            <div class="tmpl-desc">${t.desc}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function buildRunTab(progress = null) {
  if (!progress) {
    return `
      <div style="text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">▶</div>
        <p style="font-size:14px">Klicke <strong>Vorschau (Dry Run)</strong> um zu starten.</p>
      </div>
    `;
  }

  const pct = progress.progress || 0;
  const statusColor = progress.status === 'done' ? '#22c55e'
    : progress.status === 'error' ? '#ef4444'
    : 'var(--accent)';

  // FIX: Zeige ob Commit-Modus (kein neuer AI-Call nötig)
  const commitHint = progress.done && pendingDraftResults?.length > 0
    ? `<span class="commit-badge">✅ Bereit zum Committen — KI läuft NICHT nochmal</span>`
    : '';

  return `
    <div class="recipe-progress">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700;color:${statusColor}">
          ${progress.status === 'running' ? '⚡ KI arbeitet...'
          : progress.status === 'paused' ? '⏸ Safety Stop – Ergebnisse prüfen'
          : progress.status === 'done' ? '✅ Dry Run fertig – Vorschau unten'
          : '🟡 Bereit'}
        </span>
        <div style="display:flex;align-items:center;gap:8px">
          ${commitHint}
          <span style="font-size:12px;color:var(--muted)">${pct}%</span>
        </div>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="progress-stats">
        <div class="progress-stat">
          <span class="progress-stat-value">${progress.processedRows || 0}/${progress.totalRows || '?'}</span>
          <span class="progress-stat-label">Verarbeitet</span>
        </div>
        <div class="progress-stat success">
          <span class="progress-stat-value">✅ ${progress.successRows || 0}</span>
          <span class="progress-stat-label">Erfolgreich</span>
        </div>
        <div class="progress-stat error">
          <span class="progress-stat-value">❌ ${progress.errorRows || 0}</span>
          <span class="progress-stat-label">Fehler</span>
        </div>
      </div>

      ${progress.draftResults?.length > 0 ? buildDraftPreview(progress.draftResults) : ''}

      <div style="font-size:11px;font-weight:700;color:var(--muted);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.05em">
        📋 Live Log
      </div>
      <div class="recipe-log" id="recipe-log-window">
        ${(progress.logs || []).map(l => `
          <div class="log-entry ${l.type}">
            <span class="log-time">${l.time}</span>${l.message}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildDraftPreview(draftResults) {
  if (!draftResults?.length) return '';
  const cols = Object.keys(draftResults[0].data || {});
  if (!cols.length) return '';

  return `
    <div style="margin:10px 0;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">
        👁 Vorschau — wird noch NICHT gespeichert
      </div>
      <div style="overflow:auto;max-height:180px;border:1px solid rgba(255,255,255,0.06);border-radius:6px">
        <table class="draft-table">
          <thead><tr>
            <th>ID</th>
            ${cols.map(c => `<th>${c}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${draftResults.slice(0, 15).map(r => `
              <tr>
                <td>${r.rowId ?? '–'}</td>
                ${cols.map(c => `<td title="${r.data[c] ?? ''}">${
                  r.data[c] === null ? '<span class="draft-null">null</span>'
                  : String(r.data[c]).substring(0, 50)
                }</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================================
// 🔗 EVENT BINDING
// ============================================================================

function bindModalEvents() {
  const overlay = document.getElementById('recipe-modal-overlay');

  overlay.querySelector('#recipe-close').addEventListener('click', closeRecipeModal);
  overlay.querySelector('#recipe-cancel-btn').addEventListener('click', closeRecipeModal);

  overlay.querySelectorAll('.recipe-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      // FIX: Formular-Werte speichern bevor Tab gewechselt wird
      if (activeTab === 'setup') collectFormValues();

      overlay.querySelectorAll('.recipe-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;

      const content = overlay.querySelector('#recipe-tab-content');
      if (activeTab === 'setup') {
        content.innerHTML = buildSetupTab();
        bindSetupEvents();
        populateTableSelect();
        if (currentRecipe.targetTable) populateColumnSelectors(currentRecipe.targetTable);
      } else if (activeTab === 'templates') {
        content.innerHTML = buildTemplatesTab();
        bindTemplateEvents();
      } else if (activeTab === 'run') {
        content.innerHTML = buildRunTab();
      }
    });
  });

  overlay.querySelector('#recipe-preview-btn').addEventListener('click', runPreview);
  overlay.querySelector('#recipe-run-btn').addEventListener('click', runForReal);

  bindSetupEvents();
}

function bindSetupEvents() {
  const overlay = document.getElementById('recipe-modal-overlay');
  if (!overlay) return;

  const tableSelect = overlay.querySelector('#recipe-table');
  if (tableSelect) {
    tableSelect.addEventListener('change', (e) => {
      currentRecipe.targetTable = e.target.value;
      populateColumnSelectors(e.target.value);
    });
  }

  const outputInput = overlay.querySelector('#output-col-input');
  if (outputInput) {
    outputInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = outputInput.value.trim().replace(/[^a-zA-Z0-9_äöüÄÖÜß\s\-()]/g, '');
        if (val && !currentRecipe.outputColumns.includes(val)) {
          currentRecipe.outputColumns.push(val);
          outputInput.value = '';
          renderOutputChips();
        }
      }
    });
  }

  const sourceType = overlay.querySelector('#recipe-source-type');
  if (sourceType) {
    sourceType.addEventListener('change', (e) => {
      currentRecipe.sourceType = e.target.value;
      const configArea = overlay.querySelector('#source-config-area');
      const label = overlay.querySelector('#source-config-label');
      if (e.target.value === 'column') {
        configArea.style.display = 'none';
      } else {
        configArea.style.display = 'block';
        label.textContent = e.target.value === 'url_column' ? 'URL-Spalte' : 'Such-Template (z.B. {firma} CEO)';
      }
    });
  }

  ['strict', 'json', 'noblabla'].forEach(id => {
    const cb = overlay.querySelector(`#flag-${id}`);
    if (!cb) return;
    cb.addEventListener('change', (e) => {
      const key = id === 'strict' ? 'strictFacts' : id === 'json' ? 'jsonOutput' : 'noBlaBla';
      currentRecipe.flags[key] = e.target.checked;
      cb.parentElement.classList.toggle('checked', e.target.checked);
    });
  });
}

function bindTemplateEvents() {
  const overlay = document.getElementById('recipe-modal-overlay');
  if (!overlay) return;

  overlay.querySelectorAll('.recipe-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = RECIPE_TEMPLATES.find(t => t.id === btn.dataset.templateId);
      if (!tpl) return;

      currentRecipe.masterPrompt = tpl.masterPrompt;
      currentRecipe.outputColumns = [...tpl.outputColumns];
      currentRecipe.flags = { ...tpl.flags };
      if (tpl.sourceType) currentRecipe.sourceType = tpl.sourceType;

      currentRecipe.sourceConfig = {};
      if (tpl.searchTemplate) currentRecipe.sourceConfig.searchTemplate = tpl.searchTemplate;
      if (tpl.urlColumn) currentRecipe.sourceConfig.urlColumn = tpl.urlColumn;

      // Wechsel zu Setup
      overlay.querySelectorAll('.recipe-tab').forEach(t => t.classList.remove('active'));
      overlay.querySelector('[data-tab="setup"]').classList.add('active');
      activeTab = 'setup';
      overlay.querySelector('#recipe-tab-content').innerHTML = buildSetupTab();
      bindSetupEvents();
      populateTableSelect();
      if (currentRecipe.targetTable) populateColumnSelectors(currentRecipe.targetTable);

      setRecipeStatus(`✅ Vorlage "${tpl.name}" geladen`);
    });
  });
}

function populateTableSelect() {
  const select = document.getElementById('recipe-table');
  if (!select) return;
  const tables = Object.keys(state.knownColumns || {});
  select.innerHTML = '<option value="">– Tabelle wählen –</option>' +
    tables.map(t => `<option value="${t}" ${t === currentRecipe.targetTable ? 'selected' : ''}>${t}</option>`).join('');
}

function populateColumnSelectors(tableName) {
  const overlay = document.getElementById('recipe-modal-overlay');
  if (!overlay) return;

  const cols = state.knownColumns?.[tableName] || [];
  const availableArea = overlay.querySelector('#available-input-cols');
  if (!availableArea) return;

  availableArea.innerHTML = cols.map(col => `
    <span class="column-chip" data-col="${col}" title="Klicken zum Auswählen">
      ${col} <span style="opacity:0.5">+</span>
    </span>
  `).join('') || '<span style="color:var(--muted);font-size:12px">Keine Spalten gefunden</span>';

  availableArea.querySelectorAll('.column-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const col = chip.dataset.col;
      if (!currentRecipe.inputColumns.includes(col)) {
        currentRecipe.inputColumns.push(col);
        renderInputChips();
      }
    });
  });

  renderInputChips();
  renderOutputChips();
}

function renderInputChips() {
  const overlay = document.getElementById('recipe-modal-overlay');
  const area = overlay?.querySelector('#selected-input-cols');
  if (!area) return;

  if (!currentRecipe.inputColumns.length) {
    area.innerHTML = '<span style="color:var(--muted);font-size:12px;font-style:italic">Keine</span>';
    return;
  }

  area.innerHTML = currentRecipe.inputColumns.map(col => `
    <span class="column-chip">
      ${col} <span class="chip-remove" data-remove="${col}">✕</span>
    </span>
  `).join('');

  area.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentRecipe.inputColumns = currentRecipe.inputColumns.filter(c => c !== btn.dataset.remove);
      renderInputChips();
    });
  });
}

function renderOutputChips() {
  const overlay = document.getElementById('recipe-modal-overlay');
  const area = overlay?.querySelector('#selected-output-cols');
  if (!area) return;

  if (!currentRecipe.outputColumns.length) {
    area.innerHTML = '<span style="color:var(--muted);font-size:12px;font-style:italic">Noch keine Output-Spalten</span>';
    return;
  }

  area.innerHTML = currentRecipe.outputColumns.map(col => `
    <span class="column-chip output-chip">
      ${col} <span class="chip-remove" data-remove="${col}">✕</span>
    </span>
  `).join('');

  area.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentRecipe.outputColumns = currentRecipe.outputColumns.filter(c => c !== btn.dataset.remove);
      renderOutputChips();
    });
  });
}

// ============================================================================
// ▶ JOB EXECUTION — BUGFIX HIER
// ============================================================================

async function runPreview() {
  if (!validateRecipe()) return;

  // ─── FIX SCHRITT 1: Formular-Werte einsammeln BEVOR Tab gewechselt wird ───
  collectFormValues();

  // ─── FIX SCHRITT 2: Recipe + Job-Params einfrieren ───────────────────────
  frozenRecipe = JSON.parse(JSON.stringify(currentRecipe));
  frozenJobParams = buildJobParams();
  pendingDraftResults = null; // Alte Ergebnisse löschen

  console.log('[Recipe] Frozen recipe:', frozenRecipe.masterPrompt?.substring(0, 50));

  setRecipeStatus('⏳ Starte Dry Run...');

  // Tab wechseln (NACH dem Einfrieren!)
  const overlay = document.getElementById('recipe-modal-overlay');
  overlay.querySelectorAll('.recipe-tab').forEach(t => t.classList.remove('active'));
  overlay.querySelector('[data-tab="run"]').classList.add('active');
  activeTab = 'run';
  overlay.querySelector('#recipe-tab-content').innerHTML = buildRunTab({
    status: 'running',
    progress: 0,
    totalRows: frozenRecipe._maxRows || 10,
    processedRows: 0, successRows: 0, errorRows: 0, logs: [],
  });

  const previewBtn = overlay.querySelector('#recipe-preview-btn');
  if (previewBtn) previewBtn.disabled = true;

  try {
    await window.api.recipeRunJob({
      recipe: frozenRecipe,
      ...frozenJobParams,
      dryRun: true,
      maxRows: frozenRecipe._maxRows || 10,
    });
  } catch (err) {
    console.error('[Recipe] Preview Error:', err);
    setRecipeStatus('❌ Fehler: ' + err.message);
  } finally {
    const btn = document.getElementById('recipe-preview-btn');
    if (btn) btn.disabled = false;
  }
}

async function runForReal() {
  if (!confirm(
    '⚠️ Ergebnisse in die Datenbank schreiben?\n\n' +
    `${pendingDraftResults?.length || 0} Zeilen werden aktualisiert.\n` +
    'Diese Aktion kann nicht rückgängig gemacht werden.'
  )) return;

  // ─── FIX: Nutze eingefrorenen Zustand, NICHT die (verschwundenen) Form-Elemente ───
  const recipeToUse = frozenRecipe || currentRecipe;
  const paramsToUse = frozenJobParams || buildJobParams();

  const overlay = document.getElementById('recipe-modal-overlay');
  const runBtn = overlay?.querySelector('#recipe-run-btn');
  if (runBtn) runBtn.disabled = true;

  setRecipeStatus('⏳ Schreibe in Datenbank...');

  try {
    if (pendingDraftResults?.length > 0) {
      // ─── FIX SCHRITT 3: Commit-Pfad — KI läuft NICHT nochmal ───────────────
      // Nutze die bereits berechneten Ergebnisse, schreibe sie nur in die DB
      console.log('[Recipe] Committing', pendingDraftResults.length, 'draft results (no new AI call)');

      await window.api.recipeCommitDraft({
        recipe: recipeToUse,
        draftResults: pendingDraftResults,
        pgId: paramsToUse.pgId,
        dbMode: paramsToUse.dbMode,
      });

      setRecipeStatus(`✅ ${pendingDraftResults.length} Zeilen erfolgreich gespeichert!`);
      setStatus('✅ KI-Rezept erfolgreich in DB geschrieben!', 'success');
      pendingDraftResults = null; // Verbraucht
    } else {
      // Fallback: Kein Dry Run vorab → direkt schreiben mit AI
      console.log('[Recipe] No draft results cached, running fresh write job');
      await window.api.recipeRunJob({
        recipe: recipeToUse,
        ...paramsToUse,
        dryRun: false,
        maxRows: recipeToUse._maxRows || 10,
      });
      setStatus('✅ KI-Rezept ausgeführt!', 'success');
    }
  } catch (err) {
    console.error('[Recipe] Write Error:', err);
    setRecipeStatus('❌ Fehler beim Schreiben: ' + err.message);
  } finally {
    const btn = document.querySelector('#recipe-run-btn');
    if (btn) btn.disabled = false;
  }
}

/**
 * Hilfsfunktion: Baue Job-Parameter aus aktuellem App-State
 */
function buildJobParams() {
  const settings = state.aiSettings || {};
  return {
    pgId: state.pgId || state.activeDbId,
    dbMode: state.dbMode || 'local',
    provider: settings.provider || 'ollama',
    ollamaEndpoint: settings.provider === 'ollama' ? (settings.apiKey || 'http://localhost:11434') : 'http://localhost:11434',
    ollamaModel: settings.model || 'llama3',
    apiKey: settings.provider !== 'ollama' ? settings.apiKey : '',
  };
}

// ============================================================================
// 🔄 IPC PROGRESS LISTENER
// ============================================================================

let progressListenerSetup = false;

export function setupRecipeProgressListener() {
  if (progressListenerSetup) return;
  progressListenerSetup = true;

  window.api.on('recipe-job-progress', (progress) => {
    const overlay = document.getElementById('recipe-modal-overlay');
    if (!overlay || activeTab !== 'run') return;

    // FIX SCHRITT 4: Ergebnisse cachen wenn Dry Run fertig
    if (progress.done && progress.draftResults?.length > 0) {
      pendingDraftResults = progress.draftResults;
      console.log('[Recipe] Cached', pendingDraftResults.length, 'draft results for commit');
    }

    const content = overlay.querySelector('#recipe-tab-content');
    content.innerHTML = buildRunTab(progress);

    // Auto-scroll Log
    const logWin = content.querySelector('#recipe-log-window');
    if (logWin) logWin.scrollTop = logWin.scrollHeight;

    // Zeige "Schreiben"-Button wenn Ergebnisse da
    if (progress.safetyStop || (progress.done && progress.draftResults?.length > 0)) {
      setRecipeStatus(
        progress.safetyStop
          ? '⏸ Safety Stop! Ergebnisse oben prüfen, dann "Schreiben" klicken.'
          : `✅ ${progress.successRows} Zeilen bereit — klicke "Schreiben" um zu committen`
      );
      const runBtn = overlay.querySelector('#recipe-run-btn');
      if (runBtn) runBtn.style.display = 'flex';
    }

    if (progress.done && !progress.draftResults?.length) {
      setRecipeStatus(`Fertig: ${progress.successRows} ✅ / ${progress.errorRows} ❌`);
    }

    currentJobId = progress.jobId;
  });
}

// ============================================================================
// 🔧 HELPERS
// ============================================================================

/**
 * FIX: collectFormValues() darf currentRecipe.masterPrompt NUR setzen wenn
 * die Elemente tatsächlich im DOM existieren. Sonst alten Wert behalten.
 */
function collectFormValues() {
  const nameEl = document.getElementById('recipe-name');
  if (nameEl) currentRecipe.name = nameEl.value || '';

  const promptEl = document.getElementById('recipe-master-prompt');
  if (promptEl) currentRecipe.masterPrompt = promptEl.value || '';

  const whereEl = document.getElementById('recipe-where');
  if (whereEl) currentRecipe.whereClause = whereEl.value || '';

  const maxRowsEl = document.getElementById('recipe-max-rows');
  if (maxRowsEl) currentRecipe._maxRows = parseInt(maxRowsEl.value || '10');

  const sourceVal = document.getElementById('source-config-value')?.value || '';
  const sourceKw = document.getElementById('source-keywords')?.value || '';

  if (currentRecipe.sourceType === 'url_column') {
    currentRecipe.sourceConfig = { urlColumn: sourceVal, keywords: sourceKw.split(',').map(s => s.trim()).filter(Boolean) };
  } else if (currentRecipe.sourceType === 'web_search') {
    currentRecipe.sourceConfig = { searchTemplate: sourceVal, keywords: sourceKw.split(',').map(s => s.trim()).filter(Boolean) };
  }
}

function validateRecipe() {
  if (!currentRecipe.targetTable) {
    setRecipeStatus('❌ Bitte eine Tabelle wählen');
    return false;
  }
  if (!currentRecipe.outputColumns.length) {
    setRecipeStatus('❌ Bitte mindestens eine Output-Spalte angeben');
    return false;
  }
  // FIX: Auch den aktuellen DOM-Wert prüfen falls noch im Setup-Tab
  const promptEl = document.getElementById('recipe-master-prompt');
  const prompt = promptEl?.value || currentRecipe.masterPrompt;
  if (!prompt?.trim()) {
    setRecipeStatus('❌ Master Prompt ist leer');
    return false;
  }
  return true;
}

function setRecipeStatus(msg) {
  const statusEl = document.getElementById('recipe-status');
  if (statusEl) statusEl.textContent = msg;
}

function closeRecipeModal() {
  document.getElementById('recipe-modal-overlay')?.remove();
}

export function openRecipeModalForTable(tableName) {
  currentRecipe = {
    name: `Rezept für ${tableName}`,
    targetTable: tableName,
    inputColumns: [],
    outputColumns: [],
    masterPrompt: '',
    sourceType: 'column',
    sourceConfig: {},
    flags: { strictFacts: true, jsonOutput: true, noBlaBla: true },
    _maxRows: 10,
  };
  openRecipeModal(tableName);
}