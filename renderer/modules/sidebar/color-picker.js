/* ── sidebar/color-picker.js ──────────────────────────────────────
   Farbwähler für Tabellen
   ──────────────────────────────────────────────────────────────── */

import { PRESET_COLORS } from './utils.js';
import { saveTableColor } from './persistence.js';

/**
 * Öffnet einen kleinen Farbwähler direkt am Maus-Cursor/Icon
 */
export function openColorPicker(event, tableName, onColorChanged) {
    const existing = document.querySelector('.color-picker-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'color-picker-popup';
    popup.style.top = `${event.clientY}px`;
    popup.style.left = `${event.clientX - 100}px`;

    PRESET_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = color;
        swatch.setAttribute('data-action', 'save-color');
        swatch.setAttribute('data-color', color);
        swatch.setAttribute('data-table', tableName);
        popup.appendChild(swatch);
    });

    // Event-Delegation für Farbwähler (CSP-konform)
    popup.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-action')) {
            const action = e.target.getAttribute('data-action');
            const color = e.target.getAttribute('data-color');
            const table = e.target.getAttribute('data-table');

            if (action === 'save-color') {
                saveTableColor(table, color);
                // Callback um die Tabellenliste zu aktualisieren
                if (onColorChanged) onColorChanged();
                popup.remove();
            }
        }
    });

    const clear = document.createElement('div');
    clear.className = 'color-swatch clear';
    clear.textContent = 'Farbe entfernen';
    clear.addEventListener('click', () => {
        saveTableColor(tableName, null);
        // Callback um die Tabellenliste zu aktualisieren
        if (onColorChanged) onColorChanged();
        popup.remove();
    });
    popup.appendChild(clear);

    document.body.appendChild(popup);

    const close = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener('mousedown', close);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 10);
}
