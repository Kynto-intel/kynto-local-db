import assertString from './util/assertString.js';

const uuidPatterns = {
    1:     /^[0-9A-F]{8}-[0-9A-F]{4}-1[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    2:     /^[0-9A-F]{8}-[0-9A-F]{4}-2[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    3:     /^[0-9A-F]{8}-[0-9A-F]{4}-3[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    4:     /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    5:     /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    6:     /^[0-9A-F]{8}-[0-9A-F]{4}-6[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    7:     /^[0-9A-F]{8}-[0-9A-F]{4}-7[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    8:     /^[0-9A-F]{8}-[0-9A-F]{4}-8[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
    nil:   /^00000000-0000-0000-0000-000000000000$/i,
    max:   /^ffffffff-ffff-ffff-ffff-ffffffffffff$/i,
    loose: /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
    all:   /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i,
};

// Gibt { valid, version } zurück
// version: 1–8, 'nil', 'max' oder null (bei loose-Match ohne Versionsinfo)
export function isUUID(str, version = 'all') {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, version: null };
    const clean = str.replace(/\s+/g, '');
    const pattern = uuidPatterns[version];
    if (!pattern) return { valid: false, version: null };
    return { valid: pattern.test(clean), version: version === 'all' ? detectUUIDVersion(clean) : version };
}

// Erkennt die UUID-Version (1–8, 'nil', 'max') oder null
// Format-Funktion: Autonome UUID-Verarbeitung
// Normalisiert + erkennt Version + formatiert
export function formatUUID(str) {
    if (!str && str !== 0) return '';
    const s = String(str).toLowerCase().trim();
    const clean = s.replace(/\s+/g, '');
    
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
        return '';
    }
    
    const version = detectUUIDVersion(clean);
    const label = version ? ` (v${version})` : '';
    
    return clean.toLowerCase() + label;
}

export function detectUUIDVersion(str) {
    const clean = str.replace(/\s+/g, '').toLowerCase();
    if (uuidPatterns.nil.test(clean)) return 'nil';
    if (uuidPatterns.max.test(clean)) return 'max';
    for (let v = 1; v <= 8; v++) {
        if (uuidPatterns[v].test(clean)) return v;
    }
    return null;
}

// Kurzform: nur boolean (loose = jede gültige UUID-Struktur)
export function isUUIDValid(str) {
    return uuidPatterns.loose.test((str || '').replace(/\s+/g, ''));
}