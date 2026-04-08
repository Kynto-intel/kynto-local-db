/* ── action-buttons/refresh.js ──────────────────────────────────────
   Button-Handler: Refresh (Daten aktualisieren)
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';

/**
 * Injiziert die Refresh-Animation CSS (einmalig)
 */
function injectRefreshAnimation() {
    if (!document.getElementById('refresh-spin-style')) {
        const s = document.createElement('style');
        s.id = 'refresh-spin-style';
        s.textContent = `
            @keyframes spin { 
                from { transform: rotate(0deg); } 
                to { transform: rotate(360deg); } 
            }
            .spinning { 
                animation: spin 0.8s linear infinite; 
            }
        `;
        document.head.appendChild(s);
    }
}

export function setupRefreshButton(btn) {
    btn.style.color = '#ffffff';
    btn.style.borderColor = 'var(--border)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.transition = 'all 0.2s ease';
    btn.style.padding = '4px 8px';
    btn.style.background = 'transparent';

    // Animation injizieren
    injectRefreshAnimation();

    // Hochwertiges SVG Icon (Lucide Style)
    btn.innerHTML = `
        <svg class="refresh-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
        </svg>`;

    btn.title = 'Abfrage aktualisieren';

    btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'rgba(255,255,255,0.3)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'var(--border)';
    });

    btn.addEventListener('click', async () => {
        const icon = btn.querySelector('.refresh-icon');
        if (icon) icon.classList.add('spinning');
        
        setStatus('Tabelle wird aktualisiert...', 'info');
        console.log(`🔄 Refresh: Aktualisiere Tabelle "${state.currentTable}"`);
        
        try {
            if (!state.currentTable) {
                throw new Error('Keine Tabelle ausgewählt');
            }
            
            if (!window.TableGridEditor) {
                throw new Error('TableGridEditor nicht verfügbar');
            }
            
            if (typeof window.TableGridEditor.switchView !== 'function') {
                throw new Error(`switchView ist keine Funktion (Typ: ${typeof window.TableGridEditor.switchView})`);
            }
            
            // Wir nutzen switchView, um die Daten tatsächlich neu aus der DB zu laden.
            // renderCurrentData würde nur die bereits im State vorhandenen (alten) Daten neu zeichnen.
            const currentView = window.TableGridEditor.getCurrentView?.() || 'data';
            console.log(`✅ Rufe switchView("${currentView}") auf...`);
            await window.TableGridEditor.switchView(currentView);
            console.log('✅ Refresh erfolgreich abgeschlossen');
            setStatus(`✅ "${state.currentTable}" aktualisiert`, 'success');
        } catch (e) {
            console.error('❌ Refresh Fehler:', e);
            setStatus(`❌ Refresh fehlgeschlagen: ${e.message}`, 'error');
        } finally {
            if (icon) icon.classList.remove('spinning');
        }
    });
}
