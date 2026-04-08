// validators/isCurrency.js
// Währungs-Validierung - adapiert von validator.js (MIT) für EUR/Deutsche Formate
//
// Erkennt verschiedene Formate:
//   - "13,96 €" oder "€ 13,96" (Deutsche Formate)
//   - "13.90€" oder "€13.90" (Mit Symbol)
//   - "13,96" oder "80" (Ohne Symbol - wird als EUR interpretet)
// ============================================================

import merge from './util/merge.js';
import assertString from './util/assertString.js';

function currencyRegex(options) {
  let decimal_digits = `\\d{${options.digits_after_decimal[0]}}`;
  options.digits_after_decimal.forEach((digit, index) => { if (index !== 0) decimal_digits = `${decimal_digits}|\\d{${digit}}`; });

  const symbol =
    `(${options.symbol.replace(/\W/, m => `\\${m}`)})${(options.require_symbol ? '' : '?')}`,
    negative = '-?',
    whole_dollar_amount_without_sep = '[1-9]\\d*',
    whole_dollar_amount_with_sep = `[1-9]\\d{0,2}(\\${options.thousands_separator}\\d{3})*`,
    valid_whole_dollar_amounts = [
      '0', whole_dollar_amount_without_sep, whole_dollar_amount_with_sep],
    whole_dollar_amount = `(${valid_whole_dollar_amounts.join('|')})?`,
    decimal_amount = `(\\${options.decimal_separator}(${decimal_digits}))${options.require_decimal ? '' : '?'}`;
  let pattern = whole_dollar_amount + (options.allow_decimal || options.require_decimal ? decimal_amount : '');

  if (options.allow_negatives && !options.parens_for_negatives) {
    if (options.negative_sign_after_digits) {
      pattern += negative;
    } else if (options.negative_sign_before_digits) {
      pattern = negative + pattern;
    }
  }

  if (options.allow_negative_sign_placeholder) {
    pattern = `( (?!\\-))?${pattern}`;
  } else if (options.allow_space_after_symbol) {
    pattern = ` ?${pattern}`;
  } else if (options.allow_space_after_digits) {
    pattern += '( (?!$))?';
  }

  if (options.symbol_after_digits) {
    pattern += symbol;
  } else {
    pattern = symbol + pattern;
  }

  if (options.allow_negatives) {
    if (options.parens_for_negatives) {
      pattern = `(\\(${pattern}\\)|${pattern})`;
    } else if (!(options.negative_sign_before_digits || options.negative_sign_after_digits)) {
      pattern = negative + pattern;
    }
  }

  return new RegExp(`^(?!-? )(?=.*\\d)${pattern}$`);
}

// ── Deutsche EUR-Konfiguration ────────────────────────────────────────────────
export const currencyOptions = {
  symbol: '€',
  require_symbol: false,
  allow_space_after_symbol: true,
  symbol_after_digits: false,  // Primary: € before digits (€80)
  allow_negatives: true,
  parens_for_negatives: false,
  negative_sign_before_digits: false,
  negative_sign_after_digits: false,
  allow_negative_sign_placeholder: false,
  thousands_separator: '.',    // Deutsche Tausender-Trennzeichen
  decimal_separator: ',',       // Deutsche Dezimal-Trennzeichen
  allow_decimal: true,
  require_decimal: false,
  digits_after_decimal: [2],
  allow_space_after_digits: false,
};

// ── Haupt-Validator ──────────────────────────────────────────────────────────
export function isCurrency(str, options = {}) {
  // Konvertiere Zahlen zu Strings BEVOR assertString() aufgerufen wird!
  if (typeof str === 'number') str = String(str);
  assertString(str);
  options = merge(options, currencyOptions);
  return currencyRegex(options).test(str);
}

/**
 * Formatiert einen Betrag als EUR-String - KOMPLETT mit Parsing
 * Die Funktion macht ALLES: Parse + Format + Return
 * @param {string} str - Der original String (z.B. "13,96" oder "€80" oder "80")
 * @param {string} [locale='de-DE'] - Das Locale
 * @returns {string} Formatierter String (z.B. "13,96 €") oder Fehler-HTML
 */
export function formatCurrency(str, locale = 'de-DE') {
  // Validiere erst - konvertiere Zahlen zu Strings!
  if (!str && str !== 0) {
    return ''; // Leer zurückgeben wenn ungültig
  }
  const s = String(str).trim();
  
  // Validator check - aber auch flexible Regex für Suffix-Varianten zulassen
  // "13,96" OR "€80" OR "80€" OR "13,96 €"
  const isCurrencyValid = isCurrency(s) || /^\d+(?:[.,]\d{1,2})?\s*€$/.test(s) || /^€\s*\d+(?:[.,]\d{1,2})?$/.test(s);
  if (!isCurrencyValid) {
    return ''; // Validator hat reject - keine Formatierung
  }

  // Parse den Betrag: Entferne alle nicht-Zahlen außer kritischen Zeichen
  // Entferne € Symbol, Spaces, aber behalt Komma/Punkt für Dezimaltrennzeichen
  let numStr = s
    .replace(/[€$£¥]/g, '')          // Entferne Currency-Symbole
    .replace(/\s+/g, '')              // Entferne Spaces
    .trim();

  // Deutsches Format: Punkt = Tausender, Komma = Dezimal
  // "1.234,56" → "1234.56" für parseFloat
  numStr = numStr.replace(/\./g, '').replace(',', '.');
  
  const amount = parseFloat(numStr);
  
  if (isNaN(amount)) return '';
  
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

// Default export
export default isCurrency;
