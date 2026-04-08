/**
 * In der neuen Version übernimmt sidebar.js das Rendering beider DB-Typen.
 */
export function renderPGliteList(): Promise<void>;
export function createPGliteDB(): Promise<void>;
export function openPGliteDB(): Promise<void>;
/**
 * Wechselt den aktiven Datenbank-Kontext auf PGlite.
 * Alle folgenden SQL-Abfragen gehen an PGlite statt DuckDB.
 */
export function switchToPGlite(pgId: any): Promise<void>;
export function getActivePgId(): any;
export function isPGliteMode(): boolean;
/**
 * PGlite-UI initialisieren — in app.js aufrufen.
 */
export function initPGliteUI(): Promise<void>;
