/**
 * Prüft ob ein Entity einen bestimmten Lint hat.
 * @param {string} entityName
 * @param {string} lintName
 * @param {string[]} lintLevels  z.B. ['ERROR', 'WARN']
 * @param {Array}  lints
 * @param {string} schema
 * @returns {{ hasLint: boolean, count: number, matchingLint: object|null }}
 */
export function getEntityLintDetails(entityName: string, lintName: string, lintLevels: string[], lints: any[], schema: string): {
    hasLint: boolean;
    count: number;
    matchingLint: object | null;
};
/**
 * Formatiert Tabellenzeilen als SQL-INSERT-Statement.
 * Unterstützt: NULL, ARRAY, JSON/JSONB, bool, number, text, varchar, citext …
 *
 * @param {{ schema: string, name: string, columns: Array<{name:string, dataType:string, format:string}> }} table
 * @param {Array<object>} rows
 * @returns {string}
 */
export function formatTableRowsToSQL(table: {
    schema: string;
    name: string;
    columns: Array<{
        name: string;
        dataType: string;
        format: string;
    }>;
}, rows: Array<object>): string;
export namespace ENTITY_TYPE {
    let TABLE: string;
    let VIEW: string;
    let MATERIALIZED_VIEW: string;
    let FOREIGN_TABLE: string;
}
export function isTableLike(entity: object): boolean;
export function isView(entity: any): boolean;
export function isMaterializedView(entity: any): boolean;
export function isForeignTable(entity: any): boolean;
export function isViewLike(entity: any): boolean;
