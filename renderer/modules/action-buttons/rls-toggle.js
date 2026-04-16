// In: renderer/modules/action-buttons/rls-toggle.js

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { enableRLS, disableRLS } from '../Policies/policies-ui.js';  // ← Neue API!

const ICON_LOCK_CLOSED = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const ICON_LOCK_OPEN   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

const applyFlatStyle = (btn, accentColor) => {
    btn.style.cssText = '';
    btn.style.background   = 'transparent';
    btn.style.border       = 'none';
    btn.style.boxShadow    = 'none';
    btn.style.padding      = '4px 8px';
    btn.style.borderRadius = '6px';
    btn.style.fontSize     = '11px';
    btn.style.fontWeight   = '600';
    btn.style.display      = 'inline-flex';
    btn.style.alignItems   = 'center';
    btn.style.gap          = '6px';
    btn.style.cursor       = 'pointer';
    btn.style.transition   = 'all 0.2s ease';
    btn.style.color        = accentColor;
};

export function setupRlsToggleButton(btn, isProtected) {
    state.rlsActive = state.currentTableMetaData?.rls_enabled ?? false;

    const updateRlsUI = () => {
        const isActive = state.rlsActive;
        if (isActive) {
            applyFlatStyle(btn, 'var(--accent)');
            btn.innerHTML = `${ICON_LOCK_CLOSED} <span>RLS aktiv</span>`;
            btn.title = 'Row Level Security ist aktiv.';
        } else {
            applyFlatStyle(btn, 'var(--muted, #a1a1aa)');
            btn.innerHTML = `${ICON_LOCK_OPEN} <span>RLS aus</span>`;
            btn.title = 'Row Level Security ist deaktiviert. Alle Zeilen sind sichtbar.';
        }
    };
    
    updateRlsUI();

    // Hover-Effekte
    btn.addEventListener('mouseenter', () => {
        btn.style.color = 'var(--text, #ffffff)';
        btn.style.background = 'rgba(255,255,255,0.05)';
    });
    btn.addEventListener('mouseleave', () => {
        const isActive = state.rlsActive;
        btn.style.color = isActive ? 'var(--accent)' : 'var(--muted, #a1a1aa)';
        btn.style.background = 'transparent';
    });

    btn.addEventListener('click', async () => {
        if (!state.currentTable || isProtected) return;
        
        try {
            const schema = state.currentSchema || 'public';
            const table = state.currentTable;
            
            if (state.rlsActive) {
                // RLS deaktivieren
                await disableRLS(schema, table);
                state.rlsActive = false;
            } else {
                // RLS aktivieren
                await enableRLS(schema, table);
                state.rlsActive = true;
            }
            
            updateRlsUI();
            setStatus(`RLS für "${table}" ${state.rlsActive ? 'aktiviert' : 'deaktiviert'}`, 'info');
        } catch (err) {
            console.error('RLS Toggle Error:', err);
            setStatus(`Fehler: ${err.message}`, 'error');
        }
    });
}