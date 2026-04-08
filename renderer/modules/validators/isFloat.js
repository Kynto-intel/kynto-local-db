// validators/isFloat.js
// Validiert Dezimalzahlen (unterstützt DE und EN Format)

export function isFloat(str, options = { locale: 'de-DE' }) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, value: null };
    const s = str.trim();
    
    // Deutsche Formatierung: 1.234,56 oder 1234,56
    // Englische Formatierung: 1,234.56 oder 1234.56
    const dePattern = /^-?\d{1,3}(\.\d{3})*,\d+$/;
    const enPattern = /^-?\d{1,3}(,\d{3})*\.\d+$/;
    const simplePattern = /^-?\d+([.,]\d+)?$/;
    
    let normalized = s;
    
    if (options.locale === 'de-DE' && dePattern.test(s)) {
        normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (options.locale === 'en-US' && enPattern.test(s)) {
        normalized = s.replace(/,/g, '');
    } else if (simplePattern.test(s)) {
        normalized = s.replace(',', '.');
    } else {
        return { valid: false, value: null };
    }
    
    const value = parseFloat(normalized);
    if (isNaN(value)) return { valid: false, value: null };
    
    return { valid: true, value };
}

export function formatFloat(str, locale = 'de-DE') {
    if (!str && str !== 0) return '';
    const result = isFloat(str, { locale });
    if (!result.valid) return '';
    
    return result.value.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 10
    });
}

export default isFloat;
