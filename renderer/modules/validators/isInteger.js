// validators/isInteger.js
// Validiert Ganzzahlen und formatiert mit Tausender-Separator

export function isInteger(str) {
    if (!str || typeof str !== 'string') return { valid: false, value: null };
    const s = str.trim();
    
    // Akzeptiere: 123, 1.234 (DE), 1,234 (EN), -123
    const dePattern = /^-?\d{1,3}(\.\d{3})*$/;
    const enPattern = /^-?\d{1,3}(,\d{3})*$/;
    const simplePattern = /^-?\d+$/;
    
    let normalized = s;
    
    if (dePattern.test(s)) {
        normalized = s.replace(/\./g, '');
    } else if (enPattern.test(s)) {
        normalized = s.replace(/,/g, '');
    } else if (!simplePattern.test(s)) {
        return { valid: false, value: null };
    }
    
    const value = parseInt(normalized, 10);
    if (isNaN(value)) return { valid: false, value: null };
    
    return { valid: true, value };
}

export function formatInteger(str, locale = 'de-DE') {
    if (!str && str !== 0) return '';
    const result = isInteger(str);
    if (!result.valid) return '';
    
    return result.value.toLocaleString(locale, {
        minimumIntegerDigits: 1
    });
}

export default isInteger;
