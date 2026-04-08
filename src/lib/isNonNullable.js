/**
 * Portierung von isNonNullable.ts (Identische Laufzeit-Logik)
 * 
 * Prüft, ob ein Wert definiert ist (nicht null und nicht undefined).
 * Im Gegensatz zu einem einfachen "if (val)"-Check werden hier "falsy" Werte 
 * wie 0, false oder leere Strings "" als VALID (true) betrachtet. 
 * Dies ist extrem wichtig für Datenbank-Operationen.
 * 
 * @param {any} val - Der zu prüfende Wert
 */
export const isNonNullable = (val) => typeof val !== 'undefined' && val !== null;