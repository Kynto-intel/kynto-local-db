// validators/isDate.js
// Datumsvalidierung für deutsche (DD.MM.YYYY) und ISO-8601 (YYYY-MM-DD) Formate
// Inspiriert von isISO8601.js aus validator.js (MIT)
//
// Konfiguration:
//   minYear / maxYear → Jahresbereich einschränken
//   twoDigitYearCutoff → Ab welchem Wert 2-stellige Jahre als 19xx gelten (default: 70)
//   strictLeapYear → 29.02. nur in echten Schaltjahren erlauben
// ============================================================

import merge from './util/merge.js';

// ── Konfiguration ─────────────────────────────────────────────────────────────
export const dateOptions = {
    minYear:             1900,
    maxYear:             2100,
    twoDigitYearCutoff: 70,    // < 70 → 20xx, >= 70 → 19xx
    strictLeapYear:      true,
};

// ── Schaltjahr-Prüfung ────────────────────────────────────────────────────────
export function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Tage pro Monat
export function daysInMonth(month, year) {
    const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month - 1];
}

// ── 2-stelliges Jahr auflösen ─────────────────────────────────────────────────
export function resolveYear(twoDigit, cutoff = dateOptions.twoDigitYearCutoff) {
    return twoDigit < cutoff ? 2000 + twoDigit : 1900 + twoDigit;
}

// ── Deutsches Datum (DD.MM.YYYY oder DD.MM.YY) ───────────────────────────────
// Gibt { valid, day, month, year, reason } zurück
export function isDateDE(str, options = {}) {
    const opts = merge(options, dateOptions);
    // Bereinige den String: Ersetze mehrere Punkte/Ellipsen/Spaces durch einen Punkt 
    // und entferne führende/folgende Punkte.
    const clean = str.trim().replace(/[.\s\u2026\xA0]+/g, '.').replace(/^\.|\.$/g, '');
    const parts = clean.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'wrong_format' };

    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let   year  = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year))
        return { valid: false, reason: 'not_a_number' };

    // 2-stelliges Jahr auflösen
    if (parts[2].length === 2) year = resolveYear(year, opts.twoDigitYearCutoff);

    if (month < 1 || month > 12) return { valid: false, reason: 'invalid_month' };
    if (day < 1)                  return { valid: false, reason: 'invalid_day' };
    if (year < opts.minYear || year > opts.maxYear)
        return { valid: false, reason: 'year_out_of_range' };

    const maxDay = daysInMonth(month, year);
    if (day > maxDay) return { valid: false, reason: opts.strictLeapYear && month === 2 ? 'no_leap_year' : 'day_out_of_range' };

    return { valid: true, day, month, year, reason: null };
}

// ── ISO-Datum (YYYY-MM-DD) ───────────────────────────────────────────────────
// Gibt { valid, day, month, year, reason } zurück
export function isDateISO(str, options = {}) {
    const opts = merge(options, dateOptions);
    const parts = str.split('-');
    if (parts.length !== 3) return { valid: false, reason: 'wrong_format' };

    const year  = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day   = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day))
        return { valid: false, reason: 'not_a_number' };

    if (month < 1 || month > 12) return { valid: false, reason: 'invalid_month' };
    if (day < 1)                  return { valid: false, reason: 'invalid_day' };
    if (year < opts.minYear || year > opts.maxYear)
        return { valid: false, reason: 'year_out_of_range' };

    const maxDay = daysInMonth(month, year);
    if (day > maxDay) return { valid: false, reason: 'day_out_of_range' };

    return { valid: true, day, month, year, reason: null };
}

// ── Datum zu ISO-String (YYYY-MM-DD) ─────────────────────────────────────────
export function toISO(day, month, year) {
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// ── Datum zu DE-String (DD.MM.YYYY) ──────────────────────────────────────────
export function toDE(day, month, year) {
    return `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.${year}`;
}

// ── Format Funktionen (AUTONOM) ────────────────────────────────────────────────
// These take raw string input and do complete validation + formatting
export function formatDateDE(str, options = {}) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    const result = isDateDE(s, options);
    if (!result.valid) return '';
    return toDE(result.day, result.month, result.year);
}

export function formatDateISO(str, options = {}) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    const result = isDateISO(s, options);
    if (!result.valid) return '';
    return toDE(result.day, result.month, result.year);
}
