// validators/isMACAddress.js
// Validiert MAC-Adressen und normalisiert Format

export function isMACAddress(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, mac: null };
    const s = str.trim();
    
    // Akzeptiere: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, AABBCCDDEEFF
    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})|^([0-9A-Fa-f]{12})$/;
    
    if (!macPattern.test(s)) return { valid: false, mac: null };
    
    const normalized = s.replace(/[-:]/g, '').toUpperCase();
    const mac = normalized.replace(/(.{2})/g, '$1:').slice(0, -1);
    
    return { valid: true, mac };
}

export function formatMACAddress(str) {
    if (!str && str !== 0) return '';
    const result = isMACAddress(str);
    return result.valid ? result.mac : '';
}

export default isMACAddress;
