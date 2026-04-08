/* ── TableGridEditor/TableEntity.utils.js ──────────────────────────────────
   Utility-Funktionen für den Table-Grid-Editor.
   ────────────────────────────────────────────────────────────────────────── */

import { esc } from '../utils.js';

// ── Lint-Hilfsfunktion ─────────────────────────────────────────────────────
/**
 * Prüft ob ein Entity einen bestimmten Lint hat.
 * @param {string} entityName
 * @param {string} lintName
 * @param {string[]} lintLevels  z.B. ['ERROR', 'WARN']
 * @param {Array}  lints
 * @param {string} schema
 * @returns {{ hasLint: boolean, count: number, matchingLint: object|null }}
 */
export function getEntityLintDetails(entityName, lintName, lintLevels, lints, schema) {
    const matchingLint =
        (lints ?? []).find(
            (lint) =>
                lint?.metadata?.name   === entityName &&
                lint?.metadata?.schema === schema      &&
                lint?.name             === lintName    &&
                lintLevels.includes(lint?.level)
        ) ?? null;

    return {
        hasLint:      matchingLint !== null,
        count:        matchingLint ? 1 : 0,
        matchingLint,
    };
}

// ── SQL-Formatierung ───────────────────────────────────────────────────────

/**
 * Formatiert Tabellenzeilen als SQL-INSERT-Statement.
 * Unterstützt: NULL, ARRAY, JSON/JSONB, bool, number, text, varchar, citext …
 *
 * @param {{ schema: string, name: string, columns: Array<{name:string, dataType:string, format:string}> }} table
 * @param {Array<object>} rows
 * @returns {string}
 */
export function formatTableRowsToSQL(table, rows) {
    if (!rows || rows.length === 0) return '';

    const columns = table.columns.map((col) => `"${col.name}"`).join(', ');
    
    // Robust qualified reference: esc() handles multi-part names like "postgres_server.public"
    const qualifiedSchema = esc(table.schema || 'public');
    const qualifiedTable  = esc(table.name);

    const tableRef = `${qualifiedSchema}.${qualifiedTable}`;
    const valuesSets = rows
        .map((row) => {
            const filteredRow = { ...row };
            if ('idx' in filteredRow) delete filteredRow.idx;

            const values = Object.entries(filteredRow).map(([key, val]) => {
                const colDef   = table.columns.find((col) => col.name === key) ?? {};
                const dataType = colDef.dataType;
                const format   = colDef.format;

                const stringFormats = ['text', 'varchar'];

                if (val === null || val === undefined) {
                    return 'null';
                } else if (dataType === 'ARRAY') {
                    const array = Array.isArray(val) ? val : JSON.parse(val);
                    return formatArrayForSql(array);
                } else if (typeof format === 'string' && format.includes('json')) {
                    // JSON/JSONB: Stringify, escape single quotes, wrap in single quotes
                    return JSON.stringify(val)
                        .replace(/\\"/g, '"')
                        .replace(/'/g, "''")
                        .replace('"', "'")
                        .replace(/.$/, "'");
                } else if (
                    typeof format   === 'string' &&
                    typeof val      === 'string' &&
                    stringFormats.includes(format)
                ) {
                    return `'${val.replaceAll("'", "''")}'`;
                } else if (typeof val === 'number' || typeof val === 'boolean') {
                    return `${val}`;
                } else if (typeof val === 'string') {
                    return `'${val.replaceAll("'", "''")}'`;
                } else {
                    return `'${val}'`;
                }
            });

            return `(${values.join(', ')})`;
        })
        .join(', ');

    return `INSERT INTO ${tableRef} (${columns}) VALUES ${valuesSets};`;
}

// ── Interne Hilfsfunktionen ────────────────────────────────────────────────

/**
 * Erzeugt ein zufälliges Dollar-Quote-Tag, das im String nicht vorkommt.
 * @param {string} str
 * @returns {string}
 */
function safeDollarQuote(str) {
    let tag;
    let attempts = 0;
    do {
        const inner = Math.random().toString(36).substring(2, 15);
        tag = `$x${inner}$`;
        attempts++;
        if (attempts > 100) throw new Error('Konnte kein eindeutiges Dollar-Quote-Tag erzeugen.');
    } while (str.includes(tag));
    return `${tag}${str}${tag}`;
}

/**
 * Rekursive Formatierung von Arrays für SQL-Literals.
 * @param {unknown[]} arr
 * @returns {string}
 */
function formatArrayForSql(arr) {
    let result = 'ARRAY[';

    arr.forEach((item, index) => {
        if (Array.isArray(item)) {
            result += formatArrayForSql(item);
        } else if (typeof item === 'string') {
            result += `'${item.replaceAll("'", "''")}'`;
        } else if (item !== null && item !== undefined && typeof item === 'object') {
            result += `${safeDollarQuote(JSON.stringify(item))}::json`;
        } else {
            result += `${item}`;
        }

        if (index < arr.length - 1) result += ',';
    });

    result += ']';
    return result;
}

// ── Entity-Typ-Hilfsfunktionen ─────────────────────────────────────────────
// Angepasst an DuckDB / Kynto – kein Supabase-spezifischer entity_type nötig.

export const ENTITY_TYPE = {
    TABLE:             'table',
    VIEW:              'view',
    MATERIALIZED_VIEW: 'materialized_view',
    FOREIGN_TABLE:     'foreign_table',
};

/** @param {object} entity */
export const isTableLike        = (entity) => entity?.entity_type === ENTITY_TYPE.TABLE;
export const isView             = (entity) => entity?.entity_type === ENTITY_TYPE.VIEW;
export const isMaterializedView = (entity) => entity?.entity_type === ENTITY_TYPE.MATERIALIZED_VIEW;
export const isForeignTable     = (entity) => entity?.entity_type === ENTITY_TYPE.FOREIGN_TABLE;
export const isViewLike         = (entity) => isView(entity) || isMaterializedView(entity);
