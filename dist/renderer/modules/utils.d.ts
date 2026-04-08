/**
 * Status-Bar + Header-Info gleichzeitig setzen.
 * @param {string} msg
 * @param {'error'|'success'|''} type
 */
export function setStatus(msg: string, type?: "error" | "success" | ""): void;
/**
 * Aktuellen SQL-Editor-Inhalt lesen.
 * Bevorzugt markierten Text, falls vorhanden (Smart Run).
 */
export function getEditorVal(state: any): any;
/** SQL-Editor-Inhalt setzen */
export function setEditorVal(state: any, v: any): void;
/**
 * Datei im Browser-Download-Dialog speichern.
 * @param {string} content
 * @param {string} mime
 * @param {string} name  Dateiname inkl. Extension
 */
export function dlBlob(content: string, mime: string, name: string): void;
export function uid(): string;
export function esc(n: any): any;
export function escH(s: any): string;
