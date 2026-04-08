// validators/isCoordinates.js
// Validiert geografische Koordinaten (Lat/Lon)

export function isCoordinates(str) {
    if (typeof str === 'number') str = String(str);
    if (!str || typeof str !== 'string') return { valid: false, lat: null, lon: null };
    const s = str.trim();
    
    // Akzeptiere: "48.8566, 2.3522" oder "48.8566 2.3522"
    const parts = s.replace(/[,;]/g, ' ').split(/\s+/).filter(p => p);
    if (parts.length !== 2) return { valid: false, lat: null, lon: null };
    
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    
    if (isNaN(lat) || isNaN(lon)) return { valid: false, lat: null, lon: null };
    if (lat < -90 || lat > 90) return { valid: false, lat: null, lon: null };
    if (lon < -180 || lon > 180) return { valid: false, lat: null, lon: null };
    
    return { valid: true, lat, lon };
}

export function formatCoordinates(str) {
    if (!str && str !== 0) return '';
    const result = isCoordinates(str);
    if (!result.valid) return '';
    
    const lat = result.lat.toFixed(4);
    const lon = result.lon.toFixed(4);
    return `📍 ${lat}, ${lon}`;
}

export default isCoordinates;
