// validators/isColorHex.js
// Validiert Hex-Farben und formatiert sie

export function isColorHex(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, hex: null };
    const s = str.trim();
    const hexPattern = /^#?([0-9A-Fa-f]{3}){1,2}$/;
    
    if (!hexPattern.test(s)) return { valid: false, hex: null };
    
    const hex = s.startsWith('#') ? s : '#' + s;
    return { valid: true, hex: hex.toUpperCase() };
}

export function formatColorHex(str) {
    if (!str || typeof str !== 'string') return '';
    const result = isColorHex(str);
    if (!result.valid) return '';
    
    return `🎨 ${result.hex}`;
}

export default isColorHex;
