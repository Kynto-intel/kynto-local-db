/**
 * Formatiert einen SQL-String mit Platzhaltern.
 * %I - Identifikatoren (Tabellen/Spaltennamen)
 * %L - Literale (Werte, maskiert)
 * %s - Rohe Strings (unmaskiert!)
 */
export function format(sql: any, ...args: any[]): any;
/**
 * Maskiert SQL-Identifikatoren (Tabellen- oder Spaltennamen).
 */
export function quoteIdent(value: any): any;
/**
 * Setzt Werte in korrekte SQL-Anführungszeichen und maskiert Sonderzeichen.
 * Schützt vor SQL-Injection und formatiert JS-Objekte zu JSONB.
 */
export function quoteLiteral(value: any): any;
