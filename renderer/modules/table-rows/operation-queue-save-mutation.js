/* ── modules/table-rows/operation-queue-save-mutation.js ─────────────
   Portierung der Operation-Queue Logik von TypeScript nach JavaScript.
   Erlaubt das gleichzeitige Speichern mehrerer Tabellen-Operationen
   innerhalb einer SQL-Transaktion.
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

// Importe der SQL-Generatoren (Diese Dateien müssen im selben Ordner liegen)
// Hinweis: Wir importieren hier die SQL-Builder Funktionen
import { getTableRowUpdateSql } from './table-row-update-mutation.js'; 
import { getTableRowCreateSql } from './table-row-create-mutation.js'; 
import { getTableRowDeleteSql } from './table-row-delete-mutation.js'; 

/**
 * Operationstypen analog zum TS-Enum
 */
export const QueuedOperationType = {
    EDIT_CELL_CONTENT: 'EDIT_CELL_CONTENT',
    ADD_ROW: 'ADD_ROW',
    DELETE_ROW: 'DELETE_ROW'
};

/**
 * Sortiert Operationen, um Abhängigkeiten zu wahren (z.B. erst Löschen, dann Einfügen).
 */
function sortOperations(operations) {
    const operationOrder = {
        [QueuedOperationType.DELETE_ROW]: 0,
        [QueuedOperationType.ADD_ROW]: 1,
        [QueuedOperationType.EDIT_CELL_CONTENT]: 2,
    };

    return [...operations].sort((a, b) => operationOrder[a.type] - operationOrder[b.type]);
}

/**
 * Generiert das SQL für eine einzelne Operation aus der Queue.
 */
function getOperationSql(operation) {
    switch (operation.type) {
        case QueuedOperationType.EDIT_CELL_CONTENT: {
            const { payload } = operation;
            return getTableRowUpdateSql({
                table: {
                    id: payload.table.id,
                    name: payload.table.name,
                    schema: payload.table.schema,
                },
                configuration: { identifiers: payload.rowIdentifiers || payload.identifiers },
                payload: { [payload.columnName]: payload.newValue },
                enumArrayColumns: payload.enumArrayColumns ?? [],
                returning: false,
            });
        }
        case QueuedOperationType.ADD_ROW: {
            const { payload } = operation;
            // Interne Felder wie __tempId entfernen
            const { __tempId, idx, ...cleanRowData } = payload.rowData;
            return getTableRowCreateSql({
                table: { id: payload.table.id, name: payload.table.name, schema: payload.table.schema },
                payload: cleanRowData,
                enumArrayColumns: payload.enumArrayColumns ?? [],
                returning: false,
            });
        }
        case QueuedOperationType.DELETE_ROW: {
            const { payload } = operation;
            const mockRow = { idx: 0, ...payload.rowIdentifiers };
            return getTableRowDeleteSql({
                table: payload.table,
                rows: [mockRow],
            });
        }
        default:
            console.warn(`Unbekannter Operationstyp: ${operation.type}`);
            return null;
    }
}

/**
 * Führt alle Operationen in einer Transaktion aus.
 */
export async function saveOperationQueue({ projectRef, operations }) {
    if (!operations || operations.length === 0) return { result: [] };
    
    const mode = state.dbMode || 'pglite';
    
    // Map dbMode zu dbType für database-engine
    const dbType = mode === 'pglite' ? 'local' : 
                   mode === 'remote' ? 'remote' : 
                   'local';

    const sortedOperations = sortOperations(operations);
    const statements = sortedOperations
        .map(op => getOperationSql(op))
        .filter(sql => sql !== null)
        .map(sql => {
            const trimmed = sql.trim();
            return trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed;
        });

    const transactionSql = `BEGIN;\n${statements.join(';\n')};\nCOMMIT;`;
    let result;

    // Nutze neue database-engine für beide DB-Typen
    result = await window.api.dbQuery(transactionSql, null, dbType);

    return { result };
}

/**
 * Mutation-Objekt für die UI.
 * Kann in deinen Komponenten wie ein Hook verwendet werden.
 */
export const operationQueueSaveMutation = {
    mutate: async (vars, { onSuccess, onError } = {}) => {
        try {
            const data = await saveOperationQueue(vars);
            if (onSuccess) onSuccess(data);
            return data;
        } catch (err) {
            console.error('Fehler beim Speichern der Queue:', err);
            setStatus(`Speichern fehlgeschlagen: ${err.message}`, 'error');
            if (onError) onError(err);
            throw err;
        }
    }
};