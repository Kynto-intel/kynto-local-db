import assertString from './util/assertString.js';

const iso8601 = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-3])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
const iso8601Strict = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-3])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
/* eslint-enable max-len */

function isValidCalendarDate(str) {
    const ordinalMatch = str.match(/^(\d{4})-?(\d{3})([ T]|$)/);
    if (ordinalMatch) {
        const year = Number(ordinalMatch[1]);
        const day  = Number(ordinalMatch[2]);
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return day <= (isLeap ? 366 : 365);
    }
    const match = str.match(/(\d{4})-?(\d{0,2})-?(\d*)/).map(Number);
    const [, year, month, day] = match;
    if (!month || !day) return true;
    const ms = `0${month}`.slice(-2);
    const ds = `0${day}`.slice(-2);
    const d  = new Date(`${year}-${ms}-${ds}`);
    return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

// Gibt { valid, hasTime, hasTimezone } zurück
export function isISO8601(str, options = {}) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, hasTime: false, hasTimezone: false };

    const pattern = options.strictSeparator ? iso8601Strict : iso8601;
    const matches = pattern.test(str);
    if (!matches) return { valid: false, hasTime: false, hasTimezone: false };

    if (options.strict && !isValidCalendarDate(str))
        return { valid: false, hasTime: false, hasTimezone: false };

    const hasTime     = /[T\s]\d{2}/.test(str);
    const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(str);

    return { valid: true, hasTime, hasTimezone };
}

// Nur datetime (mit T + Zeit), nicht reines Datum
export function isDatetime(str) {
    const result = isISO8601(str, { strictSeparator: true, strict: true });
    return result.valid && result.hasTime;
}

// Kurzform: nur boolean
export function isISO8601Valid(str) {
    return isISO8601(str).valid;
}

/**
 * Formatiert ISO8601-Datetime → validiert + parst + formatiert als "DD.MM.YYYY HH:MM"
 * @param {string} str - ISO8601 String
 * @returns {string} "15.03.2024 14:30" oder ""
 */
export function formatDatetime(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    if (!isISO8601Valid(s)) return '';
    
    try {
        const date = new Date(s);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch {
        return '';
    }
}