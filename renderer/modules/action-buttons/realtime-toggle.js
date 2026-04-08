/* ── action-buttons/realtime-toggle.js ──────────────────────────────
   Button-Handler: Realtime Toggle (Echtzeit Synchronisierung)
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

export function setupRealtimeToggleButton(btn) {
    const updateRealtimeUI = () => {
        const isActive = state.realtimeActive;
        
        if (isActive) {
            btn.style.color = 'var(--accent)';
            btn.style.borderColor = 'var(--accent)';
            btn.innerHTML = `📡 Echtzeit: AKTIV`;
            btn.title = 'Echtzeit-Synchronisierung ist aktiv. Klicken zum Deaktivieren.';
        } else {
            btn.style.color = '#ffffff';
            btn.style.borderColor = 'var(--border)';
            btn.innerHTML = `📡 Echtzeit inaktiv`;
            btn.title = 'Echtzeit-Synchronisierung aktivieren.';
        }
    };
    
    updateRealtimeUI();
    
    btn.addEventListener('click', async () => {
        console.log('[realtime-toggle] Button geklickt');
        console.log('[realtime-toggle] KyntoGrid verfügbar:', !!window.KyntoGrid);
        console.log('[realtime-toggle] KyntoGrid.toggle verfügbar:', typeof window.KyntoGrid?.toggle);
        
        try {
            // Nutze KyntoGrid.toggle() für die zentrale Realtime-Verwaltung
            if (typeof window.KyntoGrid !== 'undefined' && typeof window.KyntoGrid.toggle === 'function') {
                console.log('[realtime-toggle] Rufe KyntoGrid.toggle() auf...');
                await window.KyntoGrid.toggle();
                console.log('[realtime-toggle] KyntoGrid.toggle() erfolgreich');
            } else {
                console.warn('[realtime-toggle] KyntoGrid.toggle nicht verfügbar, verwende Fallback');
                // Fallback: Direkter State-Toggle wenn KyntoGrid nicht verfügbar
                state.realtimeActive = !state.realtimeActive;
                updateRealtimeUI();
                
                if (state.realtimeActive) {
                    setStatus('Echtzeit-Synchronisierung aktiviert (Fallback).', 'success');
                } else {
                    setStatus('Echtzeit-Synchronisierung deaktiviert (Fallback).', 'info');
                }
            }
        } catch (err) {
            console.error('[realtime-toggle] Fehler beim Toggle:', err);
            setStatus(`Realtime-Fehler: ${err.message}`, 'error');
        }

        // UI aktualisieren
        updateRealtimeUI();
    });
}

// Export für externe Kontrolle
export function getRealtimeStatus() {
    return state.realtimeActive;
}

export function setRealtimeStatus(active) {
    state.realtimeActive = active;
}


