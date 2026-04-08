/* ── modules/editor.js ────────────────────────────────────────────────
   Monaco Editor — analog zu MonacoEditor.tsx.

   Verbesserungen gegenüber der alten Version:
   ① executeQueryRef-Pattern  — kein stale-closure Bug bei _execSQL
   ② Debounced onChange       — spart unnötige State-Writes (wie useDebounce)
   ③ onDidChangeCursorSelection — Selection-Tracking aus MonacoEditor.tsx
   ④ save-query Action Ctrl+S — fehlte komplett
   ⑤ explain-code Rechtsklick — wie MonacoEditor.tsx
   ⑥ toggle-ai Ctrl+I        — wie MonacoEditor.tsx
   ⑦ Model-Markers Reset beim Mount — wie im Original
   ⑧ wordWrap: 'on'           — wie MonacoEditor.tsx options
   ──────────────────────────────────────────────────────────────────── */

import { state }               from './state.js';
import { setStatus }           from './utils.js';
import { InlineAIController }  from './SQLEditor/InlineWidget.js';
import { setupDefinitions }    from './SQLEditor/useAddDefinitions.js';
import { formatSql }           from '../../src/lib/format-sql.js';
import { format, quoteIdent, quoteLiteral } from '../../src/lib/pg-format.js';
import { sqlEventParser }      from '../../src/lib/sql-event-parser.js';

// ✨ NEW: Import from src/lib/ai Library
import { createAIHelper, cleanupSQL, extractSQLFromResponse } from '../../src/lib/ai/index.js';

const MONACO_URL = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs';
export let monacoInstance = null;

// ── ① executeQueryRef — kein stale-closure Bug ────────────────────────
// MonacoEditor.tsx: const executeQueryRef = useRef(executeQuery)
//                   executeQueryRef.current = executeQuery  (jeder Render)
// Hier: Alle Callbacks in einem Ref-Objekt — addAction-Closures greifen
//       immer auf die *aktuelle* Funktion zu, nicht auf die beim Mount.
const _ref = {
    execSQL:      () => {},
    hasSelection: (_v) => {},
};
export function setExecCallback(fn)      { _ref.execSQL      = fn; }
export function setSelectionCallback(fn) { _ref.hasSelection = fn; }

// ── ② Debounce (wie useDebounce(value, 1000) in MonacoEditor.tsx) ─────
function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── Styles ─────────────────────────────────────────────────────────────
function injectEditorStyles() {
    if (document.getElementById('editor-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'editor-dynamic-styles';
    style.textContent = `
        #editor-wrap { width: 100%; height: 400px; border-radius: 4px; overflow: hidden; }
        .editor-area { gap: 0 !important; }
        .builder-bar { margin-bottom: 8px; }

        #editor-wrap, .controls {
            max-height: 0; opacity: 0; overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }
        .sql-visible #editor-wrap {
            max-height: 450px; opacity: 1; margin-bottom: 8px;
            pointer-events: auto; border-bottom: 1px solid var(--border);
        }
        .sql-visible .controls {
            max-height: 100px; opacity: 1; padding-bottom: 12px; pointer-events: auto;
        }

        /* ── AskAI Inline Widget ─────────────────────────────────────── */
        .ai-inline-widget {
            background: var(--surface1, #1e1e22) !important;
            border: 1px solid var(--accent, #c29a40); border-radius: 12px;
            padding: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
            width: 420px; z-index: 5000;
        }
        .ai-widget-header {
            font-size: 11px; font-weight: bold; color: var(--accent, #c29a40);
            margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;
        }
        .ai-widget-content textarea {
            width: 100%; height: 80px;
            background: var(--surface2, #121214) !important;
            color: var(--text, #eeeeee); border: 1px solid var(--border, #333);
            border-radius: 6px; padding: 10px; font-family: inherit;
            font-size: 13px; resize: none; outline: none; margin-bottom: 10px;
        }
        .ai-widget-content textarea:focus { border-color: var(--accent); }
        .ai-widget-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .ai-widget-actions button {
            padding: 6px 14px; border-radius: 6px; font-size: 12px;
            font-weight: bold; cursor: pointer; transition: all 0.2s;
        }
        .ai-btn-confirm { background: var(--accent, #c29a40); color: #000; border: none; }
        .ai-btn-cancel  { background: transparent; color: var(--muted); border: 1px solid var(--border); }
        .ai-btn-confirm:hover { opacity: 0.9; transform: translateY(-1px); }
        .ai-key-badge {
            font-size: 9px; background: rgba(0,0,0,0.2); padding: 1px 4px;
            border-radius: 4px; margin-left: 8px;
            border: 1px solid rgba(255,255,255,0.1); opacity: 0.8;
        }

        /* ── Monaco Suggest-Widget: nuklearer Fix ────────────────────── */
        .suggest-widget {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 13px !important; line-height: 18px !important;
        }
        .suggest-widget .monaco-list-row .label-name {
            display: inline-block !important; opacity: 1 !important; visibility: visible !important;
        }
        .suggest-widget, .editor-widget.suggest-widget {
            background: #1e1e22 !important; border: 1px solid #c29a40 !important;
        }
        .suggest-widget .monaco-list { width: 100% !important; }
        .suggest-widget *:not(.codicon) { color: #eeeeee !important; }
        .suggest-widget .monaco-list-row {
            background: #1e1e22 !important; display: flex !important; width: 100% !important;
        }
        .suggest-widget .monaco-list-row.focused,
        .suggest-widget .monaco-list-row.focused:hover { background: #c29a40 !important; }
        .suggest-widget .monaco-list-row.focused *:not(.codicon) { color: #000000 !important; }
        .suggest-widget .monaco-list-row .contents {
            flex: 1 1 auto !important; overflow: hidden !important;
            display: flex !important; flex-direction: row !important; width: 100% !important;
        }
        .suggest-widget .monaco-list-row .contents .main .left,
        .suggest-widget .monaco-list-row .contents .left {
            width: auto !important; min-width: 200px !important;
            display: flex !important; flex-direction: row !important;
        }
        .suggest-widget .monaco-list-row .contents .main {
            flex: 1 1 auto !important; flex-direction: row !important;
            display: flex !important; min-width: 200px !important;
            flex: 1 !important; visibility: visible !important;
        }
        .suggest-widget .monaco-list-row .contents .main .right { display: flex !important; }
        .suggest-widget .monaco-list-row:not(.focused):hover { background: #2a2a30 !important; }
        .suggest-details, .suggest-widget .suggest-details-container {
            background: #1e1e22 !important; border-left: 1px solid #c29a40 !important;
        }
        .suggest-details * { color: #eeeeee !important; }
        .monaco-hover { background: #1e1e22 !important; border: 1px solid #c29a40 !important; }
        .monaco-hover * { color: #eeeeee !important; }
    `;
    document.head.appendChild(style);
}

// ── Monaco dynamisch laden ─────────────────────────────────────────────
function loadMonaco() {
    return new Promise(resolve => {
        // Falls Monaco schon geladen ist (z.B. durch HMR), direkt zurückgeben
        if (window.monaco) { resolve(window.monaco); return; }
        const script = document.createElement('script');
        script.src = `${MONACO_URL}/loader.js`;
        script.onload = () => {
            window.require.config({ paths: { vs: MONACO_URL } });
            window.require(['vs/editor/editor.main'], resolve);
        };
        document.head.appendChild(script);
    });
}

// ── Editor initialisieren ──────────────────────────────────────────────

export async function initEditor() {
    const wrap     = document.getElementById('editor-wrap');
    const fallback = document.getElementById('sql-fallback');
    injectEditorStyles();

    const monaco  = await loadMonaco();
    monacoInstance = monaco;
    if (fallback) fallback.style.display = 'none';

    // ── Custom Themes ──────────────────────────────────────────────────
    monaco.editor.defineTheme('sql-dark', {
        base: 'vs-dark', inherit: true,
        rules: [
            { token: 'keyword', foreground: 'c29a40', fontStyle: 'bold' },
            { token: 'string',  foreground: 'ce9178' },
            { token: 'number',  foreground: 'b5cea8' },
            { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        ],
        colors: {
            'editor.background':              '#121214',
            'editor.foreground':              '#eeeeee',
            'editorLineNumber.foreground':    '#555566',
            'editor.lineHighlightBackground': '#1e1e2280',
            'editorCursor.foreground':        '#c29a40',
            'editorSuggestWidget.background':               '#1e1e22',
            'editorSuggestWidget.border':                   '#c29a40',
            'editorSuggestWidget.foreground':               '#eeeeee',
            'editorSuggestWidget.selectedBackground':       '#c29a40',
            'editorSuggestWidget.selectedForeground':       '#000000',
            'editorSuggestWidget.highlightForeground':      '#ffcc66',
            'editorSuggestWidget.focusHighlightForeground': '#000000',
            'editorHoverWidget.background':    '#1e1e22',
            'editorHoverWidget.border':        '#c29a40',
            'editorHoverWidget.foreground':    '#eeeeee',
            'scrollbarSlider.background':      '#c29a4033',
            'scrollbarSlider.hoverBackground': '#c29a4066',
        },
    });
    monaco.editor.defineTheme('sql-light', {
        base: 'vs', inherit: true, rules: [],
        colors: {
            'editorSuggestWidget.background':          '#ffffff',
            'editorSuggestWidget.border':              '#c29a40',
            'editorSuggestWidget.foreground':          '#1a1a1a',
            'editorSuggestWidget.selectedBackground':  '#c29a40',
            'editorSuggestWidget.selectedForeground':  '#000000',
            'editorSuggestWidget.highlightForeground': '#c29a40',
            'editorHoverWidget.background':            '#ffffff',
            'editorHoverWidget.border':                '#c29a40',
        },
    });

    // ── Editor-Instanz erstellen ───────────────────────────────────────
    state.editor = monaco.editor.create(wrap, {
        value:                      '',
        language:                   'pgsql',
        theme:                      state.isDark ? 'sql-dark' : 'sql-light',
        fontSize:                   state.editorSettings?.fontSize || 14,
        minimap:                    { enabled: false },
        automaticLayout:            true,
        scrollBeyondLastLine:       false,
        padding:                    { top: 10, bottom: 10 },
        fontFamily:                 'var(--font-mono)',
        tabSize:                    2,
        wordWrap:                   'on',              // ⑧ wie MonacoEditor.tsx
        renderLineHighlight:        'all',
        cursorSmoothCaretAnimation: 'on',
        cursorBlinking:             'smooth',
        bracketPairColorization:    { enabled: true },
        suggest: { showIcons: true, maxVisibleSuggestions: 12, shareSuggestWidget: false },
        fixedOverflowWidgets:       true,
    });

    // Funktionen global verfügbar machen für die Browser-Konsole (löst den ReferenceError)
    window.format = format;
    window.quoteIdent = quoteIdent;
    window.quoteLiteral = quoteLiteral;
    window.pgFormat = { format, quoteIdent, quoteLiteral };
    console.log("pg-format vollständig verbunden: format, quoteIdent und quoteLiteral sind jetzt global verfügbar.");

    // ── ⑦ Model-Markers beim Mount zurücksetzen (wie MonacoEditor.tsx) ─
    const initModel = state.editor.getModel();
    if (initModel) monaco.editor.setModelMarkers(initModel, 'owner', []);

    // Fokus per Klick auf den Wrapper
    wrap.style.cursor = 'text';
    wrap.addEventListener('click', () => state.editor.focus());

    // ── ③ Selection-Tracking (onHasSelection aus MonacoEditor.tsx) ─────
    state.editor.onDidChangeCursorSelection(({ selection }) => {
        const noSelection =
            selection.startLineNumber === selection.endLineNumber &&
            selection.startColumn     === selection.endColumn;
        _ref.hasSelection(!noSelection);
    });

    // ── ② Debounced onChange (wie useDebounce(value, 1000)) ───────────
    const flushChange = debounce((value) => {
        const tab = state.sqlTabs.find(t => t.id === state.activeTab);
        if (tab && tab.sql !== value) tab.sql = value;
    }, 1000);
    state.editor.onDidChangeModelContent(() => {
        const currentSql = state.editor.getValue();
        
        // TEST: Was erkennt der Parser?
        const events = sqlEventParser.getTableEvents(currentSql);
        if (events.length > 0) {
            console.log("Erkannte SQL-Ereignisse:", events);
        }
        
        flushChange(currentSql);
    });

    // ── Editor-Actions ─────────────────────────────────────────────────

    // SQL ausführen — Ctrl+Enter
    state.editor.addAction({
        id: 'run-query', label: 'SQL ausführen',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        contextMenuGroupId: 'operation', contextMenuOrder: 0,
        run: () => _ref.execSQL(),                         // ① kein stale closure
    });

    // ④ SQL speichern — Ctrl+S (neu!)
    state.editor.addAction({
        id: 'save-query', label: 'Query speichern',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        contextMenuGroupId: 'operation', contextMenuOrder: 1,
        run: () => {
            const tab = state.sqlTabs.find(t => t.id === state.activeTab);
            if (tab) {
                tab.sql = state.editor.getValue();
                window.api?.saveTab?.(tab).catch?.(() => {});
                setStatus('Query gespeichert.', 'success');
            }
        },
    });

    // ⑤ Code erklären — Rechtsklick (wie MonacoEditor.tsx "Explain Code")
    state.editor.addAction({
        id: 'explain-code', label: 'Code erklären (KI)',
        contextMenuGroupId: 'operation', contextMenuOrder: 2,
        run: () => {
            const selected = state.editor.getModel()
                .getValueInRange(state.editor.getSelection());
            const aiInput = document.getElementById('ai-prompt-input');
            if (aiInput) {
                aiInput.value = `Erkläre mir diesen SQL-Code:\n\n${selected}`;
                document.getElementById('btn-ai-generate')?.click();
                document.getElementById('ai-sidebar-right')?.classList.remove('collapsed');
            }
        },
    });

    // KI Inline — Ctrl+K (SQL-Generator mit direktem Feedback)
    const aiController = new InlineAIController(state.editor);
    state.editor.addAction({
        id: 'ask-ai-inline', label: 'KI Inline Assistent (SQL-Modus)',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        contextMenuGroupId: 'navigation', contextMenuOrder: 0,
        run: async () => {
            try {
                // ✨ NEW: Nutze createAIHelper aus src/lib/ai
                const aiHelper = await createAIHelper(state);
                
                aiController.show(async (prompt) => {
                    try {
                        // Generate SQL using the helper
                        const sqlCode = await aiHelper.generateSQL(prompt);
                        
                        if (state.editor && sqlCode) {
                            state.editor.setValue(sqlCode);
                            state.editor.focus();
                            setStatus('✅ SQL generiert und eingefügt!', 'success');
                        } else {
                            setStatus('⚠️ Kein SQL in der Antwort gefunden', 'warning');
                        }
                    } catch (err) {
                        console.error('[InlineAI] Error:', err);
                        setStatus(`❌ Fehler: ${err.message}`, 'error');
                    }
                });
            } catch (err) {
                console.error('[InlineAI] Helper Error:', err);
                setStatus(`❌ AI Helper Fehler: ${err.message}`, 'error');
            }
        },
    });

    // ⑥ KI-Sidebar Toggle — Ctrl+I (wie MonacoEditor.tsx toggle-ai-assistant)
    state.editor.addAction({
        id: 'toggle-ai-assistant', label: 'KI Assistent ein/ausblenden',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
        run: () => document.getElementById('ai-sidebar-right')?.classList.toggle('collapsed'),
    });

    // SQL formatieren — Shift+Alt+F
    state.editor.addAction({
        id: 'format-sql', label: 'SQL formatieren',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
        contextMenuGroupId: 'modification', contextMenuOrder: 0,
        run: (ed) => ed.setValue(formatSql(ed.getValue())),
    });

    // ── Intellisense Provider (einmalig registrieren) ──────────────────
    state.completionProvider = setupDefinitions(monaco, state);

    // Schema-Hover Provider
    monaco.languages.registerHoverProvider('pgsql', {
        provideHover: (model, position) => {
            const word = model.getWordAtPosition(position);
            if (!word) return;
            const tableName = state.knownTables.find(
                t => t.toLowerCase() === word.word.toLowerCase()
            );
            if (!tableName) return;
            const cols = state.knownColumns[tableName] || [];
            return {
                range: new monaco.Range(
                    position.lineNumber, word.startColumn,
                    position.lineNumber, word.endColumn
                ),
                contents: [
                    { value: `**Tabelle:** \`${quoteIdent(tableName)}\`` },
                    { value: cols.length > 0 ? `**Spalten:** ${cols.map(c => `\`${c}\``).join(', ')}` : '*Keine Spalteninfos*' },
                ],
            };
        },
    });
}

// ── Public API ─────────────────────────────────────────────────────────

/** Provider lesen state.knownColumns live — kein Re-Register nötig */
export function updateAutocomplete() { /* intentionally empty */ }

/**
 * Ermittelt die auszuführende Query.
 * 1. Markierter Text (Selection) — wie MonacoEditor.tsx getValueInRange
 * 2. Statement am Cursor (durch Semikolon getrennt)
 * @returns {{ sql: string, startLine: number }}
 */
export function getSelectedQuery() {
    if (!state.editor) return { sql: '', startLine: 1 };

    const selection = state.editor.getSelection();
    const model     = state.editor.getModel();

    // 1. Markierter Text hat Vorrang
    if (selection && !selection.isEmpty()) {
        return { sql: model.getValueInRange(selection), startLine: selection.startLineNumber };
    }

    // 2. Statement am Cursor finden
    const position = state.editor.getPosition();
    const text     = model.getValue();
    const offset   = model.getOffsetAt(position);

    const lastSemi  = text.lastIndexOf(';', offset - 1);
    const nextSemi  = text.indexOf(';', offset);
    const startIdx  = lastSemi === -1 ? 0 : lastSemi + 1;
    const endIdx    = nextSemi === -1 ? text.length : nextSemi;

    const rawStatement     = text.substring(startIdx, endIdx);
    const trimmedStatement = rawStatement.trim();

    const leadingWS         = rawStatement.match(/^\s*/)[0];
    const actualStartOffset = startIdx + leadingWS.length;
    const startLine         = model.getPositionAt(actualStartOffset).lineNumber;
    const sql = trimmedStatement || text;

    // Analysiere die Selektion auf Tabellen-Ereignisse (CREATE, INSERT etc.)
    const events = sqlEventParser.getTableEvents(sql);

    return { sql, startLine: trimmedStatement ? startLine : 1, events };
}

/**
 * Setzt eine Fehlermarkierung (rote Wellenlinie).
 * Analog zu monacoRef.current.editor.setModelMarkers in MonacoEditor.tsx.
 */
export function setEditorError(message, line = 1, column = 1) {
    if (!state.editor || !monacoInstance) return;
    const model = state.editor.getModel();
    if (!model) return;
    const safeLine = Math.min(line, model.getLineCount());
    monacoInstance.editor.setModelMarkers(model, 'owner', [{
        startLineNumber: safeLine,
        startColumn:     column,
        endLineNumber:   safeLine,
        endColumn:       model.getLineMaxColumn(safeLine),
        message,
        severity: monacoInstance.MarkerSeverity.Error,
    }]);
    state.editor.revealLineInCenter(safeLine);
}

/** Alle Fehlermarkierungen löschen */
export function clearEditorMarkers() {
    if (!state.editor || !monacoInstance) return;
    monacoInstance.editor.setModelMarkers(state.editor.getModel(), 'owner', []);
}

/** Theme wechseln */
export function setEditorTheme(dark) {
    monacoInstance?.editor.setTheme(dark ? 'sql-dark' : 'sql-light');
}

/** Layout neu berechnen (nach Panel-Resize) */
export function refreshEditor() {
    setTimeout(() => state.editor?.layout(), 20);
}