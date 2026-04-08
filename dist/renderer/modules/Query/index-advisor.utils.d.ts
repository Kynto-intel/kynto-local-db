/**
 * Ermittelt die erforderlichen Extensions für den Indexberater
 * @param {Array} extensions - Array der Datenbank-Extensions
 * @returns {Object} Objekt mit hypopg und index_advisor Extensions, falls vorhanden
 */
export function getIndexAdvisorExtensions(extensions?: any[]): any;
/**
 * Berechnet die prozentuale Verbesserung zwischen den Kosten vorher und nachher
 */
export function calculateImprovement(costBefore: any, costAfter: any): number;
/**
 * Erstellt Datenbank-Indizes mit den bereitgestellten SQL-Statements
 * @param {Object} params - Parameter (dbId, indexStatements, etc.)
 */
export function createIndexes({ activeDbId, indexStatements, onSuccess, onError, }: any): Promise<void>;
/**
 * Prüft, ob das Ergebnis des Indexberaters Empfehlungen enthält
 */
export function hasIndexRecommendations(result: any, isSuccess: any): boolean;
/**
 * Filtert Index-Statements heraus, die sich auf geschützte Schemas beziehen
 */
export function filterProtectedSchemaIndexStatements(indexStatements: any): any[];
/**
 * Filtert ein Indexberater-Ergebnis, um Empfehlungen für geschützte Schemas zu entfernen
 */
export function filterProtectedSchemaIndexAdvisorResult(result: any): any;
/**
 * Prüft, ob eine Query geschützte Schemas involviert
 */
export function queryInvolvesProtectedSchemas(query: any): boolean;
export const INTERNAL_SCHEMAS: string[];
