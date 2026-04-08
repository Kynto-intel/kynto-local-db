/**
 * Zeigt den Bestätigungs-Dialog zum Löschen einer Spalte.
 * @param {{ columnName: string, tableName: string, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteColumn({ columnName, tableName, dbId, onSuccess }: {
    columnName: string;
    tableName: string;
    dbId: string;
    onSuccess?: Function;
}): void;
/**
 * Zeigt den Bestätigungs-Dialog zum Löschen einer Tabelle.
 * @param {{ tableName: string, schema: string, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteTable({ tableName, schema, dbId, onSuccess }: {
    tableName: string;
    schema: string;
    dbId: string;
    onSuccess?: Function;
}): void;
/**
 * Zeigt den Bestätigungs-Dialog zum Löschen von Zeilen.
 * @param {{ rows: Array, allRowsSelected: boolean, numRows: number, table: object, filters: Array, dbId: string, onSuccess?: function }} opts
 */
export function confirmDeleteRows({ rows, allRowsSelected, numRows, table, filters, dbId, onSuccess }: {
    rows: any[];
    allRowsSelected: boolean;
    numRows: number;
    table: object;
    filters: any[];
    dbId: string;
    onSuccess?: Function;
}): void;
