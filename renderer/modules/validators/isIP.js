// validators/isIP.js
// Quelle: validator.js (MIT) — https://github.com/validatorjs/validator.js
// Angepasst: keine assertString-Abhängigkeit, browser-kompatibel, ES-Modul
//
// Unterstützt vollständige IPv6 inkl. Kurzschreibweise (::1, fe80::1%eth0)
// ============================================================

import assertString from './util/assertString.js';

const IPv4Seg    = '(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';
const IPv4Addr   = `(${IPv4Seg}[.]){3}${IPv4Seg}`;
const IPv4RegExp = new RegExp(`^${IPv4Addr}$`);

const IPv6Seg    = '(?:[0-9a-fA-F]{1,4})';
const IPv6RegExp = new RegExp('^(' +
    `(?:${IPv6Seg}:){7}(?:${IPv6Seg}|:)|` +
    `(?:${IPv6Seg}:){6}(?:${IPv4Addr}|:${IPv6Seg}|:)|` +
    `(?:${IPv6Seg}:){5}(?::${IPv4Addr}|(:${IPv6Seg}){1,2}|:)|` +
    `(?:${IPv6Seg}:){4}(?:(:${IPv6Seg}){0,1}:${IPv4Addr}|(:${IPv6Seg}){1,3}|:)|` +
    `(?:${IPv6Seg}:){3}(?:(:${IPv6Seg}){0,2}:${IPv4Addr}|(:${IPv6Seg}){1,4}|:)|` +
    `(?:${IPv6Seg}:){2}(?:(:${IPv6Seg}){0,3}:${IPv4Addr}|(:${IPv6Seg}){1,5}|:)|` +
    `(?:${IPv6Seg}:){1}(?:(:${IPv6Seg}){0,4}:${IPv4Addr}|(:${IPv6Seg}){1,6}|:)|` +
    `(?::((?::${IPv6Seg}){0,5}:${IPv4Addr}|(?::${IPv6Seg}){1,7}|:))` +
    ')(%[0-9a-zA-Z.]{1,})?$');

// Gibt { valid, version } zurück
// version: 4 | 6 | null
export function isIP(str, version = null) {    if (typeof str === 'number') str = String(str);    if (!str || typeof str !== 'string') return { valid: false, version: null };

    if (!version) {
        const v4 = IPv4RegExp.test(str);
        if (v4) return { valid: true, version: 4 };
        const v6 = IPv6RegExp.test(str);
        if (v6) return { valid: true, version: 6 };
        return { valid: false, version: null };
    }

    if (version === 4 || version === '4') {
        return { valid: IPv4RegExp.test(str), version: 4 };
    }
    if (version === 6 || version === '6') {
        return { valid: IPv6RegExp.test(str), version: 6 };
    }

    return { valid: false, version: null };
}

// Kurzform: nur boolean
export function isIPValid(str, version = null) {
    return isIP(str, version).valid;
}

export function isIPv4(str) { return IPv4RegExp.test(str); }
export function isIPv6(str) { return IPv6RegExp.test(str); }

/**
 * Formatiert IPv4-Adresse
 * @param {string} str - IPv4-Adresse
 * @returns {string} "192.168.1.1" oder ""
 */
export function formatIPv4(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    return isIPv4(s) ? s : '';
}

/**
 * Formatiert IPv6-Adresse
 * @param {string} str - IPv6-Adresse
 * @returns {string} "fe80::1" oder ""
 */
export function formatIPv6(str) {
    if (!str && str !== 0) return '';
    const s = String(str).toLowerCase().trim();
    return isIPv6(s) ? s.toLowerCase() : '';
}