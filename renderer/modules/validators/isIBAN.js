// validators/isIBAN.js
// Quelle: validator.js (MIT) — https://github.com/validatorjs/validator.js
// Angepasst: keine assertString-Abhängigkeit, browser-kompatibel, ES-Modul
//
// Konfiguration:
//   ibanFormats  → Länder-Regex erweitern/entfernen
//   whitelist    → nur bestimmte Länder erlauben, z.B. ['DE','AT','CH']
//   blacklist    → bestimmte Länder ablehnen
//
// FIXES:
//   - sanitizeIBAN() entfernt jetzt ALLE üblichen Separatoren: Leerzeichen,
//     Bindestriche, Punkte, Kommas, Schrägstriche → "DE 89 123.456,78" korrekt
//   - ibanStructureValid() und ibanMod97() verwenden dieselbe sanitize-Funktion
//   - Konsistente toUpperCase()-Behandlung in allen Exports
// ============================================================

import assertString from './util/assertString.js';
import includesArray from './util/includesArray.js';

// \u2500\u2500 Universelle Bereinigung
//   Leerzeichen, Bindestriche, Punkte, Kommas, Schrägstriche
export function sanitizeIBAN(str) {
    return str.replace(/[\s\-\.,\/]+/g, '').toUpperCase();
}

// ── Länderspezifische IBAN-Strukturen (vollständig nach Wikipedia/ISO 13616) ─
export const ibanFormats = {
    AD: /^AD\d{2}\d{8}[A-Z0-9]{12}$/,
    AE: /^AE\d{2}\d{3}\d{16}$/,
    AL: /^AL\d{2}\d{8}[A-Z0-9]{16}$/,
    AT: /^AT\d{2}\d{16}$/,
    AZ: /^AZ\d{2}[A-Z0-9]{4}\d{20}$/,
    BA: /^BA\d{2}\d{16}$/,
    BE: /^BE\d{2}\d{12}$/,
    BG: /^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/,
    BH: /^BH\d{2}[A-Z]{4}[A-Z0-9]{14}$/,
    BR: /^BR\d{2}\d{23}[A-Z]{1}[A-Z0-9]{1}$/,
    BY: /^BY\d{2}[A-Z0-9]{4}\d{20}$/,
    CH: /^CH\d{2}\d{5}[A-Z0-9]{12}$/,
    CR: /^CR\d{2}\d{18}$/,
    CY: /^CY\d{2}\d{8}[A-Z0-9]{16}$/,
    CZ: /^CZ\d{2}\d{20}$/,
    DE: /^DE\d{2}\d{18}$/,
    DK: /^DK\d{2}\d{14}$/,
    DO: /^DO\d{2}[A-Z]{4}\d{20}$/,
    DZ: /^DZ\d{24}$/,
    EE: /^EE\d{2}\d{16}$/,
    EG: /^EG\d{2}\d{25}$/,
    ES: /^ES\d{2}\d{20}$/,
    FI: /^FI\d{2}\d{14}$/,
    FO: /^FO\d{2}\d{14}$/,
    FR: /^FR\d{2}\d{10}[A-Z0-9]{11}\d{2}$/,
    GB: /^GB\d{2}[A-Z]{4}\d{14}$/,
    GE: /^GE\d{2}[A-Z0-9]{2}\d{16}$/,
    GI: /^GI\d{2}[A-Z]{4}[A-Z0-9]{15}$/,
    GL: /^GL\d{2}\d{14}$/,
    GR: /^GR\d{2}\d{7}[A-Z0-9]{16}$/,
    GT: /^GT\d{2}[A-Z0-9]{4}[A-Z0-9]{20}$/,
    HR: /^HR\d{2}\d{17}$/,
    HU: /^HU\d{2}\d{24}$/,
    IE: /^IE\d{2}[A-Z]{4}\d{14}$/,
    IL: /^IL\d{2}\d{19}$/,
    IQ: /^IQ\d{2}[A-Z]{4}\d{15}$/,
    IR: /^IR\d{2}\d{22}$/,
    IS: /^IS\d{2}\d{22}$/,
    IT: /^IT\d{2}[A-Z]{1}\d{10}[A-Z0-9]{12}$/,
    JO: /^JO\d{2}[A-Z]{4}\d{22}$/,
    KW: /^KW\d{2}[A-Z]{4}[A-Z0-9]{22}$/,
    KZ: /^KZ\d{2}\d{3}[A-Z0-9]{13}$/,
    LB: /^LB\d{2}\d{4}[A-Z0-9]{20}$/,
    LC: /^LC\d{2}[A-Z]{4}[A-Z0-9]{24}$/,
    LI: /^LI\d{2}\d{5}[A-Z0-9]{12}$/,
    LT: /^LT\d{2}\d{16}$/,
    LU: /^LU\d{2}\d{3}[A-Z0-9]{13}$/,
    LV: /^LV\d{2}[A-Z]{4}[A-Z0-9]{13}$/,
    MA: /^MA\d{26}$/,
    MC: /^MC\d{2}\d{10}[A-Z0-9]{11}\d{2}$/,
    MD: /^MD\d{2}[A-Z0-9]{20}$/,
    ME: /^ME\d{2}\d{18}$/,
    MK: /^MK\d{2}\d{3}[A-Z0-9]{10}\d{2}$/,
    MR: /^MR\d{2}\d{23}$/,
    MT: /^MT\d{2}[A-Z]{4}\d{5}[A-Z0-9]{18}$/,
    MU: /^MU\d{2}[A-Z]{4}\d{19}[A-Z]{3}$/,
    MZ: /^MZ\d{2}\d{21}$/,
    NL: /^NL\d{2}[A-Z]{4}\d{10}$/,
    NO: /^NO\d{2}\d{11}$/,
    PK: /^PK\d{2}[A-Z0-9]{4}\d{16}$/,
    PL: /^PL\d{2}\d{24}$/,
    PS: /^PS\d{2}[A-Z]{4}[A-Z0-9]{21}$/,
    PT: /^PT\d{2}\d{21}$/,
    QA: /^QA\d{2}[A-Z]{4}[A-Z0-9]{21}$/,
    RO: /^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/,
    RS: /^RS\d{2}\d{18}$/,
    SA: /^SA\d{2}\d{2}[A-Z0-9]{18}$/,
    SC: /^SC\d{2}[A-Z]{4}\d{20}[A-Z]{3}$/,
    SE: /^SE\d{2}\d{20}$/,
    SI: /^SI\d{2}\d{15}$/,
    SK: /^SK\d{2}\d{20}$/,
    SM: /^SM\d{2}[A-Z]{1}\d{10}[A-Z0-9]{12}$/,
    SV: /^SV\d{2}[A-Z0-9]{4}\d{20}$/,
    TL: /^TL\d{2}\d{19}$/,
    TN: /^TN\d{2}\d{20}$/,
    TR: /^TR\d{2}\d{5}[A-Z0-9]{17}$/,
    UA: /^UA\d{2}\d{6}[A-Z0-9]{19}$/,
    VA: /^VA\d{2}\d{18}$/,
    VG: /^VG\d{2}[A-Z]{4}\d{16}$/,
    XK: /^XK\d{2}\d{16}$/,
};

// ── Konfiguration ─────────────────────────────────────────────────────────────
// Nur diese Länder akzeptieren (leer = alle). Beispiel: ['DE', 'AT', 'CH']
export const ibanWhitelist = [];
// Diese Länder ablehnen (leer = keines). Beispiel: ['IR', 'KP']
export const ibanBlacklist = [];

// ── Struktur-Check (Länder-Regex) ─────────────────────────────────────────────
// Prüft ob der String zur Länderstruktur passt (Länge + Format).
// Gibt { valid, country, clean } zurück für bessere Fehlerdiagnose.
export function ibanStructureCheck(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, country: null, clean: '' };

    const clean   = sanitizeIBAN(str);
    const country = clean.slice(0, 2);

    // Nur Buchstaben im Ländercode erlaubt
    if (!/^[A-Z]{2}$/.test(country)) return { valid: false, country: null, clean };

    // Whitelist / Blacklist
    if (ibanWhitelist.length > 0 && !ibanWhitelist.includes(country))
        return { valid: false, country, clean };
    if (ibanBlacklist.length > 0 &&  ibanBlacklist.includes(country))
        return { valid: false, country, clean };

    const fmt = ibanFormats[country];
    if (!fmt) return { valid: false, country, clean };

    return { valid: fmt.test(clean), country, clean };
}

// Kurzform (Kompatibilität mit bestehendem Code)
export function ibanStructureValid(str) {
    return ibanStructureCheck(str).valid;
}

// ── MOD-97 Prüfziffer (ISO 7064) ─────────────────────────────────────────────
// Erwartet bereits bereinigten (sanitizeIBAN) String.
export function ibanMod97(str) {
    // Bereinigen falls nötig – nimmt sowohl rohe als auch saubere Strings
    const clean = sanitizeIBAN(str);
    if (clean.length < 15) return false;

    // Nur erlaubte Zeichen: A-Z und 0-9
    if (!/^[A-Z0-9]+$/.test(clean)) return false;

    // Umstellen: Ländercode + Prüfziffern an den Schluss
    const rearranged = clean.slice(4) + clean.slice(0, 4);

    // Buchstaben → Zahlen (A=10, B=11, ..., Z=35)
    const numeric = rearranged.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));

    // Chunk-Berechnung verhindert Integer-Overflow bei langen IBANs (bis 34 Stellen)
    const remainder = numeric.match(/\d{1,9}/g)
        .reduce((acc, chunk) => Number(acc + chunk) % 97, '');

    return remainder === 1;
}

/**
 * Formatiert IBAN → validiert + sanitiert + gruppiert in 4er Blöcke
 * @param {string} str - Raw IBAN (mit/ohne Separatoren)
 * @returns {string} Formatierte IBAN oder ""
 */
export function formatIBAN(str) {
    if (!str && str !== 0) return '';
    const s = String(str).toUpperCase().trim();
    const clean = sanitizeIBAN(s);
    if (!ibanMod97(clean)) return '';
    // Gruppiere in 4er Blöcke
    return clean.match(/.{1,4}/g).join(' ');
}

// ── Haupt-Export: Format + Prüfziffer ────────────────────────────────────────
// Gibt { valid, country, clean, structureOk, mod97Ok } zurück
export function isIBAN(str) {
    const { valid: structureOk, country, clean } = ibanStructureCheck(str);
    if (!structureOk) return { valid: false, country, clean, structureOk: false, mod97Ok: false };

    const mod97Ok = ibanMod97(clean); // clean ist bereits sanitized
    return { valid: mod97Ok, country, clean, structureOk: true, mod97Ok };
}

// Kurzform: nur boolean
export function isIBANValid(str) {
    return isIBAN(str).valid;
}

// Liste aller unterstützten Ländercodes
export const ibanLocales = Object.keys(ibanFormats);