/**
 * Kynto OS - VisualCellRenderer.js
 * Erstellt die visuelle Darstellung für Tabellenzellen.
 * SICHERHEIT: Keine <img> Tags in Tabellenzellen - nur Links als Text!
 */

export const VisualCellRenderer = (value) => {
    // Falls kein Wert vorhanden ist, leeren String zurückgeben
    if (!value) return "";

    const s = String(value).trim();
    
    // Nur echte http(s) Links als klickbar machen
    if (typeof value === 'string' && (s.startsWith('http://') || s.startsWith('https://'))) {
        return `<a href="${s}" target="_blank" style="color: #3b82f6; font-size: 13px; word-break: break-all;">${s}</a>`;
    }

    // Alles andere: nur als Text anzeigen (KEINE <img> Tags!)
    return `<span style="font-size: 14px;">${s}</span>`;
};