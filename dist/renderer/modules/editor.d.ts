export function setExecCallback(fn: any): void;
export function setSelectionCallback(fn: any): void;
export function initEditor(): Promise<void>;
/** Provider lesen state.knownColumns live — kein Re-Register nötig */
export function updateAutocomplete(): void;
/**
 * Ermittelt die auszuführende Query.
 * 1. Markierter Text (Selection) — wie MonacoEditor.tsx getValueInRange
 * 2. Statement am Cursor (durch Semikolon getrennt)
 * @returns {{ sql: string, startLine: number }}
 */
export function getSelectedQuery(): {
    sql: string;
    startLine: number;
};
/**
 * Setzt eine Fehlermarkierung (rote Wellenlinie).
 * Analog zu monacoRef.current.editor.setModelMarkers in MonacoEditor.tsx.
 */
export function setEditorError(message: any, line?: number, column?: number): void;
/** Alle Fehlermarkierungen löschen */
export function clearEditorMarkers(): void;
/** Theme wechseln */
export function setEditorTheme(dark: any): void;
/** Layout neu berechnen (nach Panel-Resize) */
export function refreshEditor(): void;
export let monacoInstance: any;
