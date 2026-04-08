// In: renderer/modules/action-buttons/rls-toggle.js

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { enableRLS, disableRLS } from '../Policies/policies-ui.js';  // ← Neue API!

export function setupRlsToggleButton(btn, isProtected) {
    state.rlsActive = state.currentTableMetaData?.rls_enabled ?? false;

    const updateRlsUI = () => {
        const isActive = state.rlsActive;
        
        if (isActive) {
            btn.innerHTML = `🔒 RLS aktiv`;
            btn.style.color = 'var(--accent)';
            btn.style.borderColor = 'var(--accent)';
        } else {
            btn.innerHTML = `⚠️ RLS aus`;
            btn.style.color = '#ffffff';
            btn.style.borderColor = 'var(--border)';
        }
    };
    
    updateRlsUI();

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