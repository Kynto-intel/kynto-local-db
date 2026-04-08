/* ── modules/table-rows/get-cell-value-mutation.js ───────────────────
   Portierung der Get-Cell-Value Logik von TypeScript nach JavaScript.
   Ermöglicht das Abrufen eines einzelnen Zellwerts basierend auf Primärschlüsseln.
   ──────────────────────────────────────────────────────────────────── */

import { setStatus } from '../utils.js';
import { state } from '../state.js';

/**
 * Erstellt das SQL-Statement zum Abrufen eines Zellwerts.
 * @param {Object} params - Parameter (table, column, pkMatch)
 * @returns {string} Das fertige SQL-Statement.
 */
export function getCellValueSql({ table, column, pkMatch }) {
    const schemaPrefix = table.schema ? `"${table.schema}".` : '"main".';
    const tableName = `"${table.name}"`;
    
    const whereClause = Object.entries(pkMatch)
        .map(([key, value]) => {
            if (value === null) return `"${key}" IS NULL`;

            const formattedValue = typeof value === 'string' 
                ? `'${value.replace(/'/g, "''")}'` 
                : value;
                
            return `"${key}" = ${formattedValue}`;
        })
        .join(' AND ');

    return `SELECT "${column}" FROM ${schemaPrefix}${tableName} WHERE ${whereClause} LIMIT 1`;
}

/**
 * Führt die Abfrage aus, um einen spezifischen Zellwert zu erhalten.
 * Nutzt die im Projekt vorhandene IPC-API (window.api).
 */
export async function getCellValue({ table, column, pkMatch }) {
    try {
        const sql = getCellValueSql({ table, column, pkMatch });
        const mode = state.dbMode || 'pglite';
        
        // Map dbMode zu dbType für database-engine
        const dbType = mode === 'pglite' ? 'local' : 
                       mode === 'remote' ? 'remote' : 
                       'local';
        
        // Nutze neue database-engine für beide DB-Typen
        const result = await window.api.dbQuery(sql, null, dbType);
        return (result && result.length > 0) ? result[0][column] : undefined;

    } catch (err) {
        console.error('Fehler in getCellValue:', err);
        // Optional: Status-Meldung bei Fehlern direkt hier setzen
        setStatus(`Fehler beim Abrufen der Zelle: ${err.message}`, 'error');
        throw err;
    }
}

/**
 * Ein Wrapper, der das Verhalten von useMutation imitiert (für UI-Zwecke).
 * Falls du React/TanStack Query im Frontend nutzt, kann dies als Basis dienen.
 */
export const getCellValueMutation = {
    mutate: async (vars, { onSuccess, onError } = {}) => {
        try {
            const data = await getCellValue(vars);
            if (onSuccess) onSuccess(data);
            return data;
        } catch (err) {
            const errorMsg = err.message || 'Zellwert konnte nicht geladen werden.';
            if (onError) {
                onError(err);
            } else {
                setStatus(errorMsg, 'error');
            }
        }
    }
};