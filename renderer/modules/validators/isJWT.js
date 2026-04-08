import assertString from './util/assertString.js';
function isBase64Url(str) {
    // Länge darf nicht 1 mod 4 ergeben (ungültiges Padding)
    if (str.length % 4 === 1) return false;
    return /^[A-Za-z0-9\-_]*={0,2}$/.test(str);
}

// Gibt { valid, headerDecoded } zurück
// headerDecoded: geparster JWT-Header (alg, typ) wenn lesbar, sonst null
export function isJWT(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, headerDecoded: null };

    const parts = str.split('.');
    if (parts.length !== 3) return { valid: false, headerDecoded: null };

    const allBase64Url = parts.every(p => isBase64Url(p));
    if (!allBase64Url) return { valid: false, headerDecoded: null };

    // Versuche Header zu dekodieren (optional, kein Fehler wenn nicht möglich)
    let headerDecoded = null;
    try {
        const padded = parts[0].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='));
        headerDecoded = JSON.parse(decoded);
    } catch {
        // atob nicht verfügbar oder kein gültiges JSON → kein Problem
    }

    return { valid: true, headerDecoded };
}

// Kurzform: nur boolean
export function isJWTValid(str) {
    return isJWT(str).valid;
}

/**
 * Formatiert JWT → validiert + dekodiert Header + zeigt visuelle Teile
 * @param {string} str - JWT Token
 * @returns {string} "header•••.payload•••.signature••• [alg/typ]" oder ""
 */
export function formatJWT(str) {
    if (!str && str !== 0) return '';
    const s = String(str).trim();
    const result = isJWT(s);
    if (!result.valid) return '';
    
    const parts = s.split('.');
    if (parts.length !== 3) return '';
    
    const masked = parts[0].slice(0, 4) + '•••' + '.' + parts[1].slice(0, 4) + '•••' + '.' + parts[2].slice(0, 4) + '•••';
    
    let headerInfo = '';
    if (result.headerDecoded) {
        headerInfo = ` [${result.headerDecoded.alg || '?'} / ${result.headerDecoded.typ || '?'}]`;
    }
    
    return masked + headerInfo;
}