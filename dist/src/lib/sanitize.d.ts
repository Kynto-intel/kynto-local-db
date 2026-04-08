/**
 * Entfernt den Hash-Teil einer URL.
 * @param {string} url
 * @returns {string}
 */
export function sanitizeUrlHashParams(url: string): string;
/**
 * Ein robuster Sanitizer für Arrays von Objekten.
 * - Redigiert Geheimnisse basierend auf Key-Namen (password, token, apiKey, etc.)
 * - Redigiert Geheimnisse basierend auf Mustern (IPv4/IPv6, AWS Keys, Bearer/JWT, generische lange Tokens)
 * - Rekursiv bis zu einer maxDepth, danach wird ein Hinweis eingesetzt
 * - Erkennt und behandelt zirkuläre Referenzen
 *
 * @param {any[]} inputArr - Das zu bereinigende Array (Nicht-Objekte werden so wie sie sind kopiert).
 * @param {Object} [opts] - Optionen
 * @param {number} [opts.maxDepth=3] - Maximale Tiefe der Rekursion (0 == nur oberste Ebene).
 * @param {string} [opts.redaction="[REDACTED]"] - Ersatztext für sensible Werte.
 * @param {string} [opts.truncationNotice="[REDACTED: max depth reached]"] - Hinweis bei Erreichen des Tiefenlimits.
 * @param {string[]} [opts.sensitiveKeys] - Zusätzliche sensible Key-Namen (Case-Insensitive).
 * @returns {any[]} Ein tiefenbereinigter Klon des Input-Arrays.
 */
export function sanitizeArrayOfObjects(inputArr: any[], opts?: {
    maxDepth?: number;
    redaction?: string;
    truncationNotice?: string;
    sensitiveKeys?: string[];
}): any[];
