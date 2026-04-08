// validators/isPercent.js
// Prozentsatz-Validierung
// Inspiriert von validator.js (MIT)
//
// Erkennt:
//   - "19%" oder "19,5%" oder "19.5%"
//   - Mit Leerzeichen: "19 %" oder "19, 5 %"
// ============================================================

import assertString from './util/assertString.js';
import merge from './util/merge.js';

// ── Konfiguration ─────────────────────────────────────────────────────────────
export const percentOptions = {
    minValue: -9999,
    maxValue: 9999,
};

// ── Haupt-Export ──────────────────────────────────────────────────────────────
// Returns true/false (boolean) - consistent with validator.js pattern
export function isPercent(str, options = {}) {
    // Konvertiere Zahlen zu Strings BEVOR assertString() aufgerufen wird!
    if (typeof str === 'number') str = String(str);
    assertString(str);
    const opts = merge(options, percentOptions);

    if (!str || str.length === 0) {
        return false;
    }

    const s = str.trim();

    // Pattern: Zahl mit % suffix (MUSS % haben!)
    // "-19%", "19%", "19,5%", "19.5%", "100%"
    const pattern = /^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:[.,]\d{1,2})?\s*%$/;
    
    if (!pattern.test(s)) {
        return false;
    }

    // Parse den numerischen Wert
    const numStr = s
        .replace(/%/g, '')  // Entferne %
        .replace(/\s/g, '') // Entferne Whitespace
        .replace(/\./g, '') // Entferne Tausenderpunkte
        .replace(',', '.');  // Komma zu Punkt für parseFloat

    const value = parseFloat(numStr);

    if (isNaN(value)) {
        return false;
    }

    if (value < opts.minValue || value > opts.maxValue) {
        return false;
    }

    return true;
}

/**
 * Formatiert einen Wert als Prozentsatz-String - KOMPLETT mit Parsing
 * Die Funktion macht ALLES: Parse + Format + Return
 * @param {string} str - Der original String (z.B. "19%" oder "19,5%" oder nur "19")
 * @param {string} [locale='de-DE'] - Das Locale
 * @returns {string} Formatierter String (z.B. "19%") oder Fehler-HTML
 */
export function formatPercent(str, locale = 'de-DE') {
  // Validiere erst - konvertiere Zahlen zu Strings!
  if (!str && str !== 0) {
    return ''; // Leer zurückgeben wenn ungültig
  }
  const s = String(str).trim();

  // Akzeptiere: "19%" ODER "19" ODER "19,5%"
  // Flexible Regex: Zahl mit optionalem % suffix
  const isPercentValidFlexible = isPercent(s) || /^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:[.,]\d{1,2})?(?:\s*%)?$/.test(s);
  
  if (!isPercentValidFlexible) {
    return ''; // Validator hat reject - keine Formatierung
  }

  // Parse den numerischen Wert
  const numStr = s
    .replace(/%/g, '')      // Entferne %
    .replace(/\s/g, '')     // Entferne Whitespace
    .replace(/\./g, '')     // Entferne Tausenderpunkte
    .replace(',', '.');     // Komma zu Punkt für parseFloat

  const value = parseFloat(numStr);

  if (isNaN(value)) return '';

  return value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }) + '%';
}

// Default export
export default isPercent;
