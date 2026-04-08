// validators/isCreditCard.js
// Quelle: validator.js (MIT) — https://github.com/validatorjs/validator.js
// Angepasst: keine assertString-Abhängigkeit, browser-kompatibel, ES-Modul
//
// Konfiguration:
//   ccNetworks   → Netzwerke hinzufügen/entfernen
//   requireLuhn  → Luhn-Pflicht an/aus (für Testdaten deaktivierbar)
// ============================================================

import assertString from './util/assertString.js';
import isLuhnValid from './isLuhnNumber.js';

// ── Kreditkarten-Netzwerke ──────────────────────────────────────────────────────
// regex: gegen die stripten Ziffern (ohne Spaces/Bindestriche)
// lengths: erlaubte Gesamtlängen der Ziffernfolge
export const ccNetworks = {
    amex:       { regex: /^3[47][0-9]{13}$/,                                                                  lengths: [15] },
    dinersclub: { regex: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,                                                  lengths: [14] },
    discover:   { regex: /^6(?:011|5[0-9][0-9])[0-9]{12,15}$/,                                                lengths: [16, 17, 18, 19] },
    jcb:        { regex: /^(?:2131|1800|35\d{3})\d{11}$/,                                                     lengths: [16] },
    mastercard: { regex: /^5[1-5][0-9]{2}|(222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$/, lengths: [16] },
    unionpay:   { regex: /^(6[27][0-9]{14}|81[0-9]{14,17})$/,                                                 lengths: [16, 17, 18, 19] },
    visa:       { regex: /^(?:4[0-9]{12})(?:[0-9]{3,6})?$/,                                                   lengths: [13, 16, 19] },
    // Eigene Netzwerke hier ergänzen:
    // meinNetz: { regex: /^9\d{15}$/, lengths: [16] },
};

// ── Konfiguration ─────────────────────────────────────────────────────────────
// false = auch Karten mit Luhn-Fehler als erkannt markieren (für Testdaten)
export const requireLuhn = false;

// ── Luhn-Validierung ───────────────────────────────────────────────────────────
// Wrapper um isLuhnValid aus isLuhnNumber.js
export function luhnCheck(str) {
    try {
        return isLuhnValid(str);
    } catch (e) {
        // isLuhnValid wirft Error wenn kein String
        return false;
    }
}

/**
 * Formatiert Kreditkartennummer → validiert + maskiert + zeigt Netzwerk
 * @param {string} str - Kartennummer (mit/ohne Separatoren)
 * @returns {string} "•••• •••• •••• 1234 (Visa)" oder ""
 */
export function formatCreditCard(str) {
    if (!str && str !== 0) return '';
    const s = String(str).replace(/\s+/g, '');
    const digits = s.replace(/[ -]/g, '');
    
    if (!/^\d{13,19}$/.test(digits)) return '';
    
    const network = detectCCNetwork(digits);
    const luhnOk = luhnCheck(digits);
    
    if (!luhnOk) return '';
    
    // Maskierung: letzte 4 Ziffern sichtbar, rest als •••• 
    const last4 = digits.slice(-4);
    const masked = '•••• •••• •••• ' + last4;
    const label = network ? ` (${network.charAt(0).toUpperCase() + network.slice(1)})` : '';
    
    return masked + label;
}

// ── Netzwerk-Erkennung ────────────────────────────────────────────────────────
// Gibt den Netzwerknamen zurück oder null
export function detectCCNetwork(digits) {
    for (const [name, { regex }] of Object.entries(ccNetworks)) {
        if (regex.test(digits)) return name;
    }
    return null;
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────
// str: Kreditkartennummer mit oder ohne Separatoren
// gibt { valid, network, luhnOk } zurück
export function isCreditCard(str) {
    const digits = str.replace(/[- ]+/g, '');
    if (!/^\d{13,19}$/.test(digits)) return { valid: false, network: null, luhnOk: false };

    const network = detectCCNetwork(digits);
    const luhnOk  = luhnCheck(digits);
    const valid   = (network !== null) && (requireLuhn ? luhnOk : true);

    return { valid, network, luhnOk };
}