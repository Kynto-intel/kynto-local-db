/* ── action-buttons/data-check.js ──────────────────────────────────
   Button-Handler: Data Check (Markiert Zeilen mit Datentyp-Fehlern)
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { DataFormatter } from '../DataFormatter.js';

export function setupDataCheckButton(btn) {
    btn.style.color = '#ffffff';
    btn.style.borderColor = 'var(--border)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.transition = 'all 0.2s ease';
    btn.style.padding = '4px 8px';
    btn.style.background = 'transparent';

    // SVG Icon
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
        </svg>`;

    btn.title = 'Markiert Zeilen mit Datentyp-Fehlern (⚠️) basierend auf der Spalten-Dominanz.';

    // State: Sind die Fehler-Zeilen gerade markiert?
    let isActive = false;
    let lastErrorIndices = [];

    btn.addEventListener('mouseenter', () => {
        btn.style.background = isActive ? 'rgba(243, 139, 168, 0.2)' : 'rgba(255,255,255,0.05)';
        btn.style.borderColor = isActive ? 'rgba(243, 139, 168, 0.5)' : 'rgba(255,255,255,0.3)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.background = isActive ? 'rgba(243, 139, 168, 0.1)' : 'transparent';
        btn.style.borderColor = isActive ? 'rgba(243, 139, 168, 0.3)' : 'var(--border)';
    });

    btn.addEventListener('click', () => {
        console.log('🔍 Data Check Button geklickt, isActive:', isActive);
        
        // Wenn bereits aktiv, deaktivieren
        if (isActive) {
            console.log('❌ Data Check: Deaktiviere Markierungen');
            state.selectedRows?.clear();
            isActive = false;
            
            // UI zurücksetzen
            btn.style.background = 'transparent';
            btn.style.borderColor = 'var(--border)';
            btn.title = 'Markiert Zeilen mit Datentyp-Fehlern (⚠️)';
            
            // Grid neu rendern
            if (window.TableGridEditor && typeof window.TableGridEditor.renderCurrentData === 'function') {
                window.TableGridEditor.renderCurrentData();
            }
            
            setStatus('✅ Markierungen entfernt', 'info');
            return;
        }
        
        const data = state.lastData;
        if (!data || data.length === 0) {
            setStatus('Keine Daten verfügbar', 'warning');
            console.log('🚫 Data Check: Keine Daten in state.lastData');
            return;
        }
        console.log(`📋 Data Check: ${data.length} Zeilen gefunden`);

        const cols = state.currentCols;
        if (!cols || cols.length === 0) {
            setStatus('Keine Spalten-Informationen verfügbar', 'warning');
            console.log('🚫 Data Check: Keine Spalten in state.currentCols');
            return;
        }
        console.log(`📊 Data Check: ${cols.length} Spalten zum Prüfen`);

        try {
            const errorIndices = [];

            // 1. Dominante Typen pro Spalte ermitteln (Profiling)
            const colProfiles = {};
            cols.forEach(col => {
                try {
                    const profile = DataFormatter.profileColumn(col, data.map(r => r[col]));
                    colProfiles[col] = profile.dominantType;
                    console.log(`  ✓ ${col}: dominantType=${profile.dominantType}`);
                } catch (e) {
                    console.warn(`  ⚠️ Profile Fehler für ${col}:`, e);
                    colProfiles[col] = 'unknown';
                }
            });

            // 2. Jede Zeile auf Kompatibilität prüfen
            data.forEach((row, ri) => {
                let hasError = false;
                for (const col of cols) {
                    const val = row[col];
                    if (val === null || val === undefined || val === '' || (typeof val === 'string' && val.trim() === '')) continue;

                    try {
                        const formatted = DataFormatter.formatWithContext(val, colProfiles[col]);
                        if (formatted.includes('⚠️')) {
                            hasError = true;
                            console.log(`  ⚠️ Zeile ${ri}, Spalte ${col}: Format enthält ⚠️`);
                            break;
                        }
                    } catch (e) {
                        console.warn(`  ⚠️ Format Fehler bei Zeile ${ri}, Spalte ${col}:`, e);
                    }
                }
                if (hasError) errorIndices.push(ri);
            });

            if (errorIndices.length > 0) {
                console.log(`✅ Data Check: ${errorIndices.length} Problem-Zeilen gefunden:`, errorIndices);
                
                // Bestehende Auswahl aufheben und nur die Problem-Zeilen markieren
                if (state.selectedRows) {
                    state.selectedRows.clear();
                    errorIndices.forEach(idx => state.selectedRows.add(idx));
                }
                
                lastErrorIndices = errorIndices;
                isActive = true;
                
                // UI aktivieren
                btn.style.background = 'rgba(243, 139, 168, 0.1)';
                btn.style.borderColor = 'rgba(243, 139, 168, 0.3)';
                btn.title = `❌ Klicke zum Deaktivieren (${errorIndices.length} Zeilen mit Fehlern)`;
                
                // ✅ Grid neu rendern, um die neuen selectedRows anzuzeigen
                if (window.TableGridEditor && typeof window.TableGridEditor.renderCurrentData === 'function') {
                    console.log('🔄 Rendering grid mit markierten Zeilen...');
                    window.TableGridEditor.renderCurrentData();
                }
                
                setStatus(`⚠️ ${errorIndices.length} Zeile(n) mit Typ-Fehlern markiert (klick erneut zum Demarkieren)`, 'warning');
            } else {
                console.log('✅ Data Check: Keine Fehler gefunden');
                setStatus('✅ Keine Datenfehler gefunden', 'success');
            }
        } catch (e) {
            console.error('❌ Data Check Fehler:', e);
            setStatus(`❌ Datencheck fehlgeschlagen: ${e.message}`, 'error');
        }
    });
}
