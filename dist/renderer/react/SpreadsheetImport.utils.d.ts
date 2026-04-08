/**
 * SpreadsheetImport Utils - Professional Type Inference for CSV Import
 * Based on Supabase logic but with REAL, INTELLIGENT type detection
 */
export type InferredColumnType = 'int8' | 'int4' | 'float8' | 'numeric' | 'bool' | 'jsonb' | 'text' | 'uuid' | 'timestamptz' | 'date';
export declare function isObject(value: unknown): value is Record<string, unknown>;
export declare function tryParseJson(value: unknown): boolean;
export declare const inferColumnType: (column: string, rows: unknown[]) => InferredColumnType;
export declare function parseSpreadsheetText({ text, emptyStringAsNullHeaders, }: {
    text: string;
    emptyStringAsNullHeaders?: Array<string>;
}): Promise<{
    headers: Array<string>;
    emptyStringAsNullHeaders: Array<string>;
    rows: Array<unknown>;
    previewRows: Array<unknown>;
    columnTypeMap: Record<string, InferredColumnType>;
    errors: Array<any>;
}>;
export declare const revertSpreadsheet: (headers: string[], rows: any[]) => any;
export declare const inferredTypeToPostgreSQLType: (type: InferredColumnType) => string;
