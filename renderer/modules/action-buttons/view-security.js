/* ── action-buttons/view-security.js ───────────────────────────────
   Button-Handler: View Security Warning
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { openAutofixSecurityModal } from '../TableGridEditor/index.js';

export function setupViewSecurityButton(btn) {
    // Security Definer vs Security Invoker Status
    const isInvoker = state.currentTableMetaData?.is_security_invoker ?? false;
    
    if (!isInvoker) {
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--border)';
        btn.innerHTML = `⚠️ Security Definer`;
        btn.title = 'Warnung: Diese View wird mit den Rechten des Erstellers ausgeführt. Dies kann ein Sicherheitsrisiko sein.';
    } else {
        btn.style.color = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
        btn.innerHTML = `🛡️ Security Invoker`;
        btn.title = 'Sicher: Diese View wird mit den Rechten des angemeldeten Benutzers ausgeführt.';
    }

    btn.addEventListener('click', () => {
        if (!isInvoker) {
            // Öffne das Autofix-Modal
            openAutofixSecurityModal({
                entity: state.currentTableMetaData 
                    ? { ...state.currentTableMetaData, name: state.currentTable, schema: state.currentSchema } 
                    : null,
                dbId: state.dbMode === 'pglite' ? state.pgId : state.activeDbId,
                onSuccess: () => {
                    // Re-init action bar nach erfolgreicher Änderung
                    const { initActionBar } = require('./index.js');
                    initActionBar?.();
                }
            });
        } else {
            setStatus('Security Invoker aktiv: Die View nutzt die Rechte des Aufrufers.', 'success');
        }
    });
}
