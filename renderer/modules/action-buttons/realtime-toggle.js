/* ── action-buttons/realtime-toggle.js ──────────────────────────────
   Button-Handler: Realtime Toggle (Echtzeit Synchronisierung)
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

export function setupRealtimeToggleButton(btn) {

    const _applyFlat = (btn, color) => {
        btn.style.cssText    = '';
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
        btn.style.color        = color;
    };
    const SVG_RT_ON  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.59 16.11a6 6 0 0 1 6.82 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`;
    const SVG_RT_OFF = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.59 16.11a6 6 0 0 1 6.82 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`;

    const updateRealtimeUI = () => {
        const isActive = state.realtimeActive;
        if (isActive) {
            _applyFlat(btn, 'var(--accent)');
            btn.innerHTML = `${SVG_RT_ON} <span>Echtzeit aktiv</span>`;
            btn.title = 'Echtzeit-Synchronisierung ist aktiv. Klicken zum Deaktivieren.';
        } else {
            _applyFlat(btn, 'var(--muted, #a1a1aa)');
            btn.innerHTML = `${SVG_RT_OFF} <span>Echtzeit inaktiv</span>`;
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