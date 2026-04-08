// validators/isEAN.js
// Quelle: validator.js (MIT) — https://github.com/validatorjs/validator.js
// Angepasst: keine assertString-Abhängigkeit, browser-kompatibel, ES-Modul
//
// Unterstützte Formate: EAN-8, EAN-13, EAN-14
// ============================================================

import assertString from './util/assertString.js';

const validEanRegex = /^(\d{8}|\d{13}|\d{14})$/;

function getPositionWeight(length, index) {
    if (length === 8 || length === 14) {
        return (index % 2 === 0) ? 3 : 1;
    }
    return (index % 2 === 0) ? 1 : 3;
}

function calculateCheckDigit(ean) {
    const checksum = ean
        .slice(0, -1)
        .split('')
        .map((char, index) => Number(char) * getPositionWeight(ean.length, index))
        .reduce((acc, val) => acc + val, 0);
    const remainder = 10 - (checksum % 10);
    return remainder < 10 ? remainder : 0;
}

// Gibt { valid, type, checkDigitOk } zurück
// type: 'EAN-8' | 'EAN-13' | 'EAN-14' | null
export function isEAN(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, type: null, checkDigitOk: false };
    const s = str.replace(/[\s-]+/g, '');
    if (!validEanRegex.test(s)) return { valid: false, type: null, checkDigitOk: false };

    const checkDigitOk = Number(s.slice(-1)) === calculateCheckDigit(s);
    const typeMap = { 8: 'EAN-8', 13: 'EAN-13', 14: 'EAN-14' };
    const type = typeMap[s.length] || null;

    return { valid: checkDigitOk, type, checkDigitOk };
}

// Kurzform: nur boolean
export function isEANValid(str) {
    return isEAN(str).valid;
}

/**
 * Formatiert EAN-Nummer → validiert + erkennt Typ
 * @param {string} str - EAN-Nummer
 * @returns {string} "5901234123457 (EAN-13)" oder ""
 */
export function formatEAN(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    const result = isEAN(s);
    if (!result.valid || !result.type) return '';
    
    const clean = result.type === 'EAN-8' ? 
        s.replace(/[\s-]+/g, '').slice(0, 8) :
        result.type === 'EAN-14' ? 
        str.replace(/[\s-]+/g, '').slice(0, 14) :
        str.replace(/[\s-]+/g, '').slice(0, 13);
    
    return `${clean} (${result.type})`;
}