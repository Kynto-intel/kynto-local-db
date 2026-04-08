import assertString from './util/assertString.js';
import checkHost from './util/checkHost.js';
import includesString from './util/includesString.js';

import isFQDN from './isFQDN.js';
import { isIP } from './isIP.js';
import merge from './util/merge.js';

// ── Konfiguration ─────────────────────────────────────────────────────────────
export const urlOptions = {
    allowedProtocols:  ['http', 'https', 'ftp'],   // Erlaubte Protokolle
    requireProtocol:   false,                        // true → ohne https:// ungültig
    requireTLD:        true,                         // false → localhost erlaubt
    allowPrivateIPs:   true,                         // true → 192.168.x.x erlaubt
    allowedDomains:    [],                           // Whitelist: ['example.com']
    blockedDomains:    [],                           // Blacklist: ['malware.com']
    maxLength:         2048,
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function isValidProtocol(protocol, allowed) {
    return allowed.map(p => p.toLowerCase()).includes(protocol.toLowerCase());
}

function isIPv4(str) {
    return /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/.test(str);
}

function isValidHostname(str, requireTLD) {
    if (!str || str.length > 253) return false;
    if (str.includes('..')) return false;
    if (!requireTLD && /^[a-zA-Z0-9-]+$/.test(str)) return true;
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(str);
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────
// Gibt { valid, reason } zurück
export function isURL(str, options = {}) {
    const opts = merge(options, urlOptions);

    if (!str || str.length > opts.maxLength) return { valid: false, reason: 'too_long' };
    if (/[\s<>]/.test(str)) return { valid: false, reason: 'invalid_chars' };
    if (str.startsWith('mailto:')) return { valid: false, reason: 'mailto_not_url' };

    let url = str;

    // Protokoll extrahieren
    const protocolMatch = url.match(/^([a-z][a-z0-9+\-.]*):\/\//i);
    if (protocolMatch) {
        const proto = protocolMatch[1].toLowerCase();
        if (!isValidProtocol(proto, opts.allowedProtocols))
            return { valid: false, reason: 'invalid_protocol' };
        url = url.slice(protocolMatch[0].length);
    } else if (opts.requireProtocol) {
        return { valid: false, reason: 'missing_protocol' };
    } else if (url.startsWith('//')) {
        url = url.slice(2);
    }

    if (!url) return { valid: false, reason: 'empty_host' };

    // Fragment + Query entfernen
    url = url.split('#')[0].split('?')[0];

    // Host + Pfad trennen
    const hostPart = url.split('/')[0];

    // Port abtrennen
    const portMatch = hostPart.match(/:(\d+)$/);
    const host = portMatch ? hostPart.slice(0, -portMatch[0].length) : hostPart;
    if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        if (port <= 0 || port > 65535) return { valid: false, reason: 'invalid_port' };
    }

    if (!host) return { valid: false, reason: 'empty_host' };

    // Domain-Blacklist / Whitelist
    const lowerHost = host.toLowerCase();
    if (opts.blockedDomains.length > 0 && opts.blockedDomains.some(d => lowerHost === d || lowerHost.endsWith('.' + d)))
        return { valid: false, reason: 'blocked_domain' };
    if (opts.allowedDomains.length > 0 && !opts.allowedDomains.some(d => lowerHost === d || lowerHost.endsWith('.' + d)))
        return { valid: false, reason: 'domain_not_allowed' };

    // IPv4
    if (isIPv4(host)) return { valid: true, reason: null };

    // Hostname
    if (isValidHostname(host, opts.requireTLD)) return { valid: true, reason: null };

    return { valid: false, reason: 'invalid_host' };
}

// Kurzform: nur boolean
export function isURLValid(str, options = {}) {
    return isURL(str, options).valid;
}

// Format-Funktion: Autonome URL-Verarbeitung  
// Validiert URL und normalisiert Protokoll
export function formatURL(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    if (!isURLValid(s)) return '';
    // Füge Protokoll hinzu wenn nicht vorhanden
    return s.startsWith('http') ? s : 'https://' + s;
}