import assertString from './util/assertString.js';
import checkHost from './util/checkHost.js';

import isByteLength from './isByteLength.js';
import isFQDN from './isFQDN.js';
import { isIP } from './isIP.js';
import merge from './util/merge.js';

// ── Konfiguration ─────────────────────────────────────────────────────────────
export const emailOptions = {
    requireTLD:         false,   // false → admin@localhost wird akzeptiert
    allowIPDomain:      true,    // true  → user@[192.168.1.1] wird akzeptiert
    allowUTF8LocalPart: true,    // true  → müller@example.de wird akzeptiert
    maxLength:          254,     // RFC 5321 Limit
    allowedDomains:     [],      // Whitelist: ['gmail.com', 'company.de']
    blockedDomains:     [],      // Blacklist: ['tempmail.com', 'trash-mail.com']
};

// ── Regex-Muster ──────────────────────────────────────────────────────────────
const emailUserPart     = /^[a-z\d!#$%&'*+\-/=?^_`{|}~]+$/i;
const emailUserUtf8Part = /^[a-z\d!#$%&'*+\-/=?^_`{|}~\u00A1-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/i;
const quotedEmailUser   = /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f]))*$/i;

// ── Domain-Validierung ────────────────────────────────────────────────────────
function isValidDomain(domain, requireTLD) {
    if (!domain || domain.length > 253) return false;
    if (domain.includes('..'))          return false;

    // Lokale Domains ohne TLD (z.B. "localhost", "mailserver")
    if (!requireTLD && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(domain)) return true;

    // Standard FQDN: Labels durch Punkte getrennt, TLD mind. 2 Zeichen
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(domain);
}

// ── IPv4-Domain-Prüfung ───────────────────────────────────────────────────────
function isIPv4Domain(str) {
    // Nackte IPv4: user@192.168.1.1
    return /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/.test(str);
}

// ── IPv6/IPv4-Domain in eckigen Klammern: user@[::1] oder user@[192.168.1.1] ─
function isBracketedIPDomain(str) {
    if (!str.startsWith('[') || !str.endsWith(']')) return false;
    const inner = str.slice(1, -1);
    // IPv4 in Klammern
    if (isIPv4Domain(inner)) return true;
    // IPv6 in Klammern (inkl. IPv6v4-Mapped)
    return /^[0-9a-fA-F:]+(%[a-zA-Z0-9]+)?$/.test(inner) && inner.includes(':');
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────
// Gibt { valid, reason } zurück
// reason-Codes:
//   'too_long'            → E-Mail-Adresse überschreitet maxLength
//   'no_at'               → Kein @-Zeichen oder @ an ungültiger Position
//   'user_too_long'       → Local-Part > 64 Zeichen (RFC 5321)
//   'domain_too_long'     → Domain > 253 Zeichen
//   'blocked_domain'      → Domain steht auf der Blacklist
//   'domain_not_allowed'  → Domain steht nicht auf der Whitelist
//   'invalid_domain'      → Domain ist syntaktisch ungültig
//   'invalid_quoted_user' → Quoted-Local-Part enthält ungültige Zeichen
//   'invalid_user_dots'   → Local-Part beginnt/endet mit Punkt oder hat ".."
//   'invalid_user_char'   → Local-Part enthält ungültiges Zeichen
export function isEmail(str, options = {}) {
    const opts = merge(options, emailOptions);

    if (typeof str === 'number') str = String(str);
    // Grundlegende Längenprüfung
    if (!str || typeof str !== 'string') return { valid: false, reason: 'no_at' };
    if (str.length > opts.maxLength)     return { valid: false, reason: 'too_long' };

    // Leerzeichen sind in E-Mails nie erlaubt (außer im Quoted-Part, aber das
    // würde dann als ein Block kommen – kein nacktes Leerzeichen)
    if (/\s/.test(str)) return { valid: false, reason: 'invalid_user_char' };

    // @ finden: letztes @ ist das trennende (Local-Part darf kein @ enthalten,
    // außer im Quoted-String – das behandeln wir weiter unten)
    const atIndex = str.lastIndexOf('@');
    if (atIndex < 1) return { valid: false, reason: 'no_at' };

    const user   = str.slice(0, atIndex);
    const domain = str.slice(atIndex + 1);

    // RFC-Längen
    if (!user || user.length > 64)       return { valid: false, reason: 'user_too_long' };
    if (!domain || domain.length > 253)  return { valid: false, reason: 'domain_too_long' };

    // ── Domain-Blacklist / Whitelist ─────────────────────────────────────────
    const lowerDomain = domain.toLowerCase();
    if (opts.blockedDomains.length > 0 && opts.blockedDomains.includes(lowerDomain))
        return { valid: false, reason: 'blocked_domain' };
    if (opts.allowedDomains.length > 0 && !opts.allowedDomains.includes(lowerDomain))
        return { valid: false, reason: 'domain_not_allowed' };

    // ── Domain-Validierung ───────────────────────────────────────────────────
    const domainValid =
        isValidDomain(domain, opts.requireTLD) ||
        (opts.allowIPDomain && (isIPv4Domain(domain) || isBracketedIPDomain(domain)));

    if (!domainValid) return { valid: false, reason: 'invalid_domain' };

    // ── Quoted Local-Part: "user name"@example.com ───────────────────────────
    if (user.startsWith('"') && user.endsWith('"')) {
        const inner  = user.slice(1, -1);
        const qValid = quotedEmailUser.test(inner);
        return { valid: qValid, reason: qValid ? null : 'invalid_quoted_user' };
    }

    // ── Normaler Local-Part ──────────────────────────────────────────────────
    // Kein führender/abschließender Punkt, keine aufeinanderfolgenden Punkte
    if (user.startsWith('.') || user.endsWith('.') || user.includes('..'))
        return { valid: false, reason: 'invalid_user_dots' };

    const pattern   = opts.allowUTF8LocalPart ? emailUserUtf8Part : emailUserPart;
    const userParts = user.split('.');
    for (const part of userParts) {
        if (!part) return { valid: false, reason: 'invalid_user_dots' }; // leerer Teil = ".."
        if (!pattern.test(part)) return { valid: false, reason: 'invalid_user_char' };
    }

    return { valid: true, reason: null };
}

// Kurzform: nur boolean
export function isEmailValid(str, options = {}) {
    return isEmail(str, options).valid;
}

// Format-Funktion: Autonome E-Mail-Verarbeitung
// Gibt entweder formatierter String (mailto: link) oder leer
export function formatEmail(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim().toLowerCase();
    if (!isEmailValid(s)) return '';
    // Rückgabe ist bloß die validierte E-Mail - HTML wird in DataFormatter gemacht
    return s;
}