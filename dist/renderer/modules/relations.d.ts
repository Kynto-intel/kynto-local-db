/**
 * Öffnet ein Overlay mit den gefundenen Relationen für eine Tabelle.
 * @param {string} targetTable
 */
export function showRelationsDiagram(targetTable: string): Promise<void>;
/**
 * Generiert ein HTML-Snippet für die kompakte Anzeige im Schema-Tab.
 */
export function getRelationsSummaryHtml(targetTable: any): string;
/**
 * Sucht nach ausgehenden und eingehenden Relationen.
 */
export function findRelations(targetTable: any): any[];
export function findPrimaryKey(tableName: any): any;
