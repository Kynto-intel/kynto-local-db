/* ── modules/SQLEditor/useAddDefinitions.js ──────────────────────────
   Portierung der Intellisense-Logik aus der TS-Version.
   Bietet Autocomplete, Signature Help und natives Formatting.
   ──────────────────────────────────────────────────────────────────── */

/** Standard SQL Keywords & Funktionen für das Autocomplete */
const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'INSERT INTO', 
    'UPDATE', 'DELETE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 
    'VALUES', 'SET', 'HAVING', 'AS', 'DISTINCT', 'AND', 'OR', 'IN', 'IS NULL'
];

const SQL_FUNCTIONS = [
    { label: 'COUNT', detail: 'Zählt die Zeilen', signature: 'COUNT(*)' },
    { label: 'SUM', detail: 'Summiert Werte', signature: 'SUM(spalte)' },
    { label: 'AVG', detail: 'Mittelwert', signature: 'AVG(spalte)' },
    { label: 'MAX', detail: 'Maximum', signature: 'MAX(spalte)' },
    { label: 'MIN', detail: 'Minimum', signature: 'MIN(spalte)' },
    { label: 'UPPER', detail: 'In Großbuchstaben umwandeln', signature: 'UPPER(text)' }
];

import { formatSql } from '../../../src/lib/format-sql.js';

/**
 * Initialisiert die Sprach-Definitionen für Monaco.
 * @param {Object} monaco - Die Monaco-Instanz.
 * @param {Object} state - Der globale App-State.
 * @returns {Object} Ein Objekt mit dispose-Funktionen.
 */
export function setupDefinitions(monaco, state) {
    const disposables = [];

    // 1. Native Formatting Provider (Übernommen aus useAddDefinitions.ts)
    // Ermöglicht Monaco, das SQL nativ über das Kontextmenü oder Shortcuts zu formatieren.
    const formatProvider = monaco.languages.registerDocumentFormattingEditProvider('pgsql', {
        provideDocumentFormattingEdits(model) {
            const value = model.getValue();
            const formatted = formatSql(value);
            return [{
                range: model.getFullModelRange(),
                text: formatted
            }];
        }
    });
    disposables.push(formatProvider);

    // 2. Zustandsverwaltung (Analog zu pgInfoRef in TS)
    // Anstatt die Daten fest zu verdrahten, nutzen wir eine Getter-Funktion.
    // Diese stellt sicher, dass die Provider immer die aktuellsten Daten aus dem
    // globalen State lesen, ohne dass die Provider neu registriert werden müssen.
    const getLatestInfo = () => {
        const isReady = state.knownTables && state.knownTables.length > 0;
        
        return {
            isReady,
            tableColumns: state.knownColumns || {},
            knownTables: state.knownTables || [],
            keywords: SQL_KEYWORDS,
            functions: SQL_FUNCTIONS
        };
    };

    // 3. Completion Item Provider
    const completionProvider = monaco.languages.registerCompletionItemProvider('pgsql', {
        triggerCharacters: ['.', ' ', '('],
        provideCompletionItems: (model, position) => {
            const info = getLatestInfo();
            // "Reaktivitäts"-Check: Wenn noch keine Daten da sind, gar nicht erst suchen.
            if (!info.isReady && !info.keywords.length) return { suggestions: [] };

            const lineContent = model.getLineContent(position.lineNumber);
            const textUntilPosition = lineContent.substring(0, position.column - 1);
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            const suggestions = [];

            // ── Kontext-Check: Wurde ein Punkt getippt? (z.B. "users.") ────────
            const dotMatch = textUntilPosition.match(/\b(\w+)\.$/);

            if (dotMatch) {
                const tableName = dotMatch[1];
                const columns = info.tableColumns[tableName] || [];

                columns.forEach(col => {
                    suggestions.push({
                        label: col,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: col,
                        range: range,
                        detail: `Spalte aus ${tableName}`,
                        sortText: 'a' // Höchste Priorität im Kontext
                    });
                });

                return { suggestions };
            }

            // ── Globale Vorschläge (Keywords, Funktionen, Tabellen) ──────────

            // Keywords
            info.keywords.forEach(kw => {
                suggestions.push({
                    label: kw,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: kw,
                    range: range,
                    sortText: 'e' // Keywords als Fallback nach unten
                });
            });

            // Funktionen
            info.functions.forEach(fn => {
                // Extrahiere Platzhalter aus der Signatur (z.B. "text" aus "UPPER(text)")
                const paramMatch = fn.signature.match(/\((.*)\)/);
                const placeholder = paramMatch ? paramMatch[1] : '';
                const snippet = placeholder ? `${fn.label}(\${1:${placeholder}})` : `${fn.label}()`;

                suggestions.push({
                    label: fn.label,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: snippet,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: range,
                    detail: fn.detail,
                    documentation: fn.signature,
                    sortText: 'd'
                });
            });

            // Tabellen-Vorschläge
            state.knownTables.forEach(table => {
                suggestions.push({
                    label: table,
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: table,
                    range: range,
                    detail: 'Tabelle',
                    sortText: 'b'
                });
            });

            // Spalten-Vorschläge (Globaler Fallback wenn kein Punkt vorhanden)
            Object.keys(info.tableColumns).forEach(table => {
                info.tableColumns[table].forEach(col => {
                    suggestions.push({
                        label: col,
                        kind: monaco.languages.CompletionItemKind.Field,
                        insertText: col,
                        range: range,
                        detail: `Spalte aus ${table}`,
                        sortText: 'c'
                    });
                });
            });

            return { suggestions };
        }
    });
    disposables.push(completionProvider);

    // 4. Signature Help Provider
    // Zeigt Hilfestellungen zu Parametern an, wenn der User '(' oder ',' tippt.
    const signatureProvider = monaco.languages.registerSignatureHelpProvider('pgsql', {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: (model, position) => {
            const lineContent = model.getLineContent(position.lineNumber);
            const textUntilPosition = lineContent.substring(0, position.column - 1);
            
            // Wir suchen nach dem Wort unmittelbar vor der öffnenden Klammer
            // Beispiel: "SELECT COUNT(" -> findet "COUNT"
            const match = textUntilPosition.match(/\b(\w+)\s*\($/);
            if (!match) return null;

            const funcName = match[1].toUpperCase();
            const func = SQL_FUNCTIONS.find(f => f.label === funcName);

            if (!func) return null;

            // Einfache Extraktion der Parameter-Labels aus dem Signatur-String
            const paramMatch = func.signature.match(/\((.*)\)/);
            const paramLabel = paramMatch ? paramMatch[1] : '';

            return {
                value: {
                    signatures: [{
                        label: func.signature,
                        documentation: func.detail,
                        parameters: paramLabel ? [{ label: paramLabel }] : []
                    }],
                    activeSignature: 0,
                    activeParameter: 0
                },
                dispose: () => {}
            };
        }
    });
    disposables.push(signatureProvider);

    // 5. Hover Provider (Dokumentation)
    // Zeigt ein Informations-Fenster an, wenn der User mit der Maus über ein Wort fährt.
    const hoverProvider = monaco.languages.registerHoverProvider('pgsql', {
        provideHover: (model, position) => {
            const word = model.getWordAtPosition(position);
            if (!word) return null;

            const func = SQL_FUNCTIONS.find(f => f.label === word.word.toUpperCase());
            if (func) {
                return {
                    range: new monaco.Range(
                        position.lineNumber, word.startColumn,
                        position.lineNumber, word.endColumn
                    ),
                    contents: [
                        { value: `**${func.label}**` },
                        { value: func.detail }
                    ]
                };
            }
            return null;
        }
    });
    disposables.push(hoverProvider);

    return {
        dispose: () => disposables.forEach(d => d.dispose())
    };
}