/* ── action-buttons/index.js ────────────────────────────────────────
   Koordinator-Modul für alle Action-Bar Button-Handler
   Importiert und orchestriert alle Button-Setup-Funktionen
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { ENTITY_TYPE } from '../TableGridEditor/index.js';
import { INTERNAL_SCHEMAS } from '../Query/index-advisor.utils.js';

// Button-Handler importieren
import { setupRlsToggleButton } from './rls-toggle.js';
import { setupViewSecurityButton } from './view-security.js';
import { setupIndexAdvisorButton } from './index-advisor.js';
import { setupRealtimeToggleButton } from './realtime-toggle.js';
import { setupRefreshButton } from './refresh.js';
import { setupDataCheckButton } from './data-check.js';

/**
 * Initialisiert alle Action-Bar Buttons mit ihren entsprechenden Handler-Funktionen
 */
export function initActionBar() {
    const container = document.getElementById('action-bar-container');
    if (!container) return;

    // Container leeren
    container.innerHTML = '';

    // 2. Entitätstyp-Prüfung
    const type = state.currentTableType;
    const isTable = !!state.currentTable && (
        !type || 
        type === ENTITY_TYPE.TABLE || 
        type === 'BASE TABLE'
    );
    const isView = !!state.currentTable && (
        type === ENTITY_TYPE.VIEW || type === ENTITY_TYPE.MATERIALIZED_VIEW || 
        type === 'VIEW' || type === 'MATERIALIZED VIEW'
    );
    const isProtected = INTERNAL_SCHEMAS.includes((state.currentSchema || 'main').toLowerCase());

    // 3. Button-Definitionen
    const buttons = [
        { id: 'btn-rls-toggle', text: 'RLS', visible: isTable, disabled: isProtected, handler: setupRlsToggleButton },
        { id: 'btn-view-security', text: 'View Schutz', visible: isView, handler: setupViewSecurityButton },
        { id: 'btn-idx-guide', text: 'Indexberater', visible: isTable || isView, disabled: isProtected, handler: setupIndexAdvisorButton },
        { id: 'btn-realtime', text: 'Echtzeit', visible: true, handler: setupRealtimeToggleButton },
        { id: 'btn-refresh', text: '', visible: true, handler: setupRefreshButton },
        { id: 'btn-data-check', text: '', visible: isTable || isView, handler: setupDataCheckButton }
    ];

    // 4. Buttons erstellen und Handler aufrufen
    buttons.filter(b => b.visible).forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.id = b.id;
        btn.textContent = b.text;
        btn.style.fontSize = '11px';

        // Globale Deaktivierungs-Logik für geschützte Schemas
        if (b.disabled) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = `Das Schema "${state.currentSchema}" ist ein geschütztes System-Schema.`;
        }

        // Button-spezifischen Handler aufrufen
        if (b.handler && typeof b.handler === 'function') {
            try {
                b.handler(btn, isProtected);
            } catch (e) {
                console.error(`Fehler beim Setup von Button ${b.id}:`, e);
            }
        }

        container.appendChild(btn);
    });

    // RLS Policy Management Buttons - werden später implementiert wenn nötig
    // if (isTable && !isProtected) {
    //     renderPolicyActionButtons(container);
    // }
}

// Globaler Zugriff für TableGridEditor und executor.js
window.initActionBar = initActionBar;

export default {
    initActionBar
};
