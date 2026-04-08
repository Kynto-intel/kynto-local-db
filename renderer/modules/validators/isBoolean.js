// validators/isBoolean.js
// Validiert verschiedene Darstellungen von boolean Werten
// Akzeptiert: true/false, yes/no, ja/nein, 1/0, wahr/falsch, y/n, j/w

export function isBoolean(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, value: null };
    const s = str.trim().toLowerCase();
    
    const trueVals = ['true', 'yes', 'ja', 'wahr', '1', 'y', 'j', 'w'];
    const falseVals = ['false', 'no', 'nein', 'falsch', '0', 'n', 'f'];
    
    if (trueVals.includes(s)) return { valid: true, value: true };
    if (falseVals.includes(s)) return { valid: true, value: false };
    return { valid: false, value: null };
}

export function formatBoolean(str) {
    if (!str && str !== 0 && str !== false) return '';
    const result = isBoolean(str);
    if (!result.valid) return '';
    return result.value ? '✅ Ja' : '❌ Nein';
}

export default isBoolean;
