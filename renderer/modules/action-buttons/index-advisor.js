/* ── action-buttons/index-advisor.js ───────────────────────────────
   Button-Handler: Index Advisor / Indexberater
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus } from '../utils.js';
import { 
    analyzeTablePerformance
} from '../Query/index-advisor.utils.js';
import { findRelations } from '../relations.js';

export function setupIndexAdvisorButton(btn) {
    btn.style.color = '#ffffff';
    btn.style.borderColor = 'var(--border)';
    btn.innerHTML = `🔍 Indexberater`;
    btn.title = 'Index-Empfehlungen für diese Tabelle';

    btn.addEventListener('click', async () => {
        console.log('🔍 Indexberater Button geklickt');
        
        if (!state.currentTable) {
            setStatus('Wähle zuerst eine Tabelle aus', 'error');
            console.log('🚫 Indexberater: Keine Tabelle ausgewählt');
            return;
        }
        
        console.log(`📊 Indexberater für Tabelle: ${state.currentTable}, Schema: ${state.currentSchema}, Mode: ${state.dbMode}`);
        
        try {
            // Öffne ein Modal Panel mit Index-Empfehlungen
            showIndexAdvisorPanel(state.currentTable, state.currentSchema, state.dbMode);
        } catch (e) {
            console.error('❌ Indexberater Fehler:', e);
            setStatus(`❌ Indexberater Fehler: ${e.message}`, 'error');
        }
    });
}

/**
 * Zeigt ein Modal-Panel mit echter Performance-Analyse und Optimierungsempfehlungen
 */
async function showIndexAdvisorPanel(tableName, schema, dbMode) {
    setStatus(`📊 Performance-Analyse für "${tableName}"...`, 'info');

    // Erstelle Modal-Container
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        background: var(--surface0, #181825); border: 1px solid var(--border, #333);
        border-radius: 8px; padding: 24px; width: 95%; max-width: 1000px;
        max-height: 90vh; overflow-y: auto; color: var(--fg, #cdd6f4);
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const title = document.createElement('h2');
    title.textContent = `⚙️ Index Advisor - Performance-Analyse`;
    title.style.cssText = 'margin: 0 0 16px 0; color: var(--accent, #89b4fa); font-size: 18px;';
    panel.appendChild(title);

    // Loading-Indikator
    const loading = document.createElement('div');
    loading.style.cssText = `
        background: var(--surface1, #1e1e2e); padding: 16px; border-radius: 4px;
        text-align: center; color: #888;
    `;
    loading.innerHTML = `
        <div style="font-size: 14px;">
            🔄 Analysiere Tabellen-Performance...
            <br><span style="font-size: 12px; margin-top: 8px; display: block;">Dies kann einige Sekunden dauern</span>
        </div>
    `;
    panel.appendChild(loading);

    modal.appendChild(panel);
    document.body.appendChild(modal);

    // ✅ ECHTE PERFORMANCE-ANALYSE IM HINTERGRUND
    try {
        // Lade die Relationen/Foreign Keys für diese Tabelle
        const relations = findRelations(tableName);
        console.log(`[showIndexAdvisorPanel] Relationen gefunden:`, relations);

        const analysis = await analyzeTablePerformance(
            tableName,
            schema || 'public',
            dbMode === 'pglite' ? 'local' : 'remote',
            state.columnMetadata || [],
            state.lastData || [],
            relations  // ← Pass die Relationen!
        );

        // Entferne Loading-Indikator
        loading.remove();

        // ===== 1. PERFORMANCE REPORT SUMMARY =====
        const summarySection = document.createElement('div');
        summarySection.style.cssText = `
            background: var(--surface1, #1e1e2e); padding: 16px; border-radius: 4px;
            margin-bottom: 20px; font-size: 12px; line-height: 1.6;
            font-family: monospace; white-space: pre-wrap; word-break: break-word;
            border-left: 4px solid ${analysis.estimatedImprovement > 0 ? '#a6e3a1' : '#89b4fa'};
        `;
        summarySection.textContent = analysis.reportSummary;
        panel.appendChild(summarySection);

        // ===== 1.5 RELATIONEN & FOREIGN KEYS =====
        if (analysis.relations && analysis.relations.length > 0) {
            const relSection = document.createElement('div');
            relSection.style.cssText = 'margin-bottom: 20px;';
            
            const relTitle = document.createElement('h3');
            relTitle.textContent = `🔗 Tabellen-Beziehungen (${analysis.relations.length})`;
            relTitle.style.cssText = 'margin: 0 0 12px 0; color: #cba6f7; font-size: 14px;';
            relSection.appendChild(relTitle);
            
            const relList = document.createElement('div');
            relList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
            
            analysis.relations.forEach(rel => {
                const item = document.createElement('div');
                const isOutgoing = rel.type === 'outgoing';
                item.style.cssText = `
                    background: var(--surface2, #313244); padding: 10px; border-radius: 4px;
                    font-size: 11px; border-left: 3px solid ${isOutgoing ? '#f38ba8' : '#89dceb'};
                `;
                item.innerHTML = `
                    <div style="font-weight: 500; color: ${isOutgoing ? '#f38ba8' : '#89dceb'};">
                        ${isOutgoing ? '→ Ausgehend' : '← Eingehend'} von "${rel.from}"
                    </div>
                    <div style="color: #888; margin-top: 4px;">
                        <strong>"${rel.fromCol}"</strong> referenziert <strong>"${rel.to}".${rel.toCol}</strong>
                    </div>
                `;
                relList.appendChild(item);
            });
            
            relSection.appendChild(relList);
            panel.appendChild(relSection);
        }

        // ===== 2. GEMESSENE QUERIES =====
        if (analysis.queries && analysis.queries.length > 0) {
            const querySection = document.createElement('div');
            querySection.style.cssText = 'margin-bottom: 20px;';
            
            const queryTitle = document.createElement('h3');
            queryTitle.textContent = `🔬 Getestete Queries (${analysis.queries.length})`;
            queryTitle.style.cssText = 'margin: 0 0 12px 0; color: #89dceb; font-size: 14px;';
            querySection.appendChild(queryTitle);
            
            const queryList = document.createElement('div');
            queryList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
            
            analysis.queries.forEach(q => {
                const item = document.createElement('div');
                item.style.cssText = `
                    background: var(--surface2, #313244); padding: 10px; border-radius: 4px;
                    font-size: 11px; border-left: 2px solid #f9e2af;
                `;
                item.innerHTML = `
                    <div style="font-weight: 500; color: #f9e2af;">📝 ${q.name}</div>
                    <div style="color: #888; margin-top: 4px;">
                        ⏱️ Execution Time: <strong>${q.executionTime?.toFixed(2) || '?'}ms</strong>
                        ${q.hasSeqScan ? ' | ⚠️ <strong>Seq Scan gefunden</strong>' : ' | ✅ Index genutzt'}
                    </div>
                    <code style="display: block; background: var(--surface1, #1e1e2e); padding: 6px; margin-top: 6px; border-radius: 3px; overflow-x: auto; font-size: 10px;">${q.sql}</code>
                `;
                queryList.appendChild(item);
            });
            
            querySection.appendChild(queryList);
            panel.appendChild(querySection);
        }

        // ===== 3. BOTTLENECKS =====
        if (analysis.bottlenecks && analysis.bottlenecks.length > 0) {
            const btSection = document.createElement('div');
            btSection.style.cssText = 'margin-bottom: 20px;';
            
            const btTitle = document.createElement('h3');
            btTitle.textContent = `⚠️ Identifizierte Bottlenecks (${analysis.bottlenecks.length})`;
            btTitle.style.cssText = 'margin: 0 0 12px 0; color: #f38ba8; font-size: 14px;';
            btSection.appendChild(btTitle);
            
            const btList = document.createElement('div');
            btList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
            
            analysis.bottlenecks.forEach(bt => {
                const item = document.createElement('div');
                item.style.cssText = `
                    background: var(--surface2, #313244); padding: 10px; border-radius: 4px;
                    font-size: 11px; border-left: 3px solid #f38ba8;
                `;
                item.innerHTML = `
                    <div style="color: #f38ba8; font-weight: 500;">[${bt.severity}] ${bt.issue}</div>
                    <div style="color: #888; margin-top: 4px;">💡 ${bt.suggestion}</div>
                `;
                btList.appendChild(item);
            });
            
            btSection.appendChild(btList);
            panel.appendChild(btSection);
        }

        // ===== 4. RECOMMENDATIONS =====
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            const recSection = document.createElement('div');
            recSection.style.cssText = 'margin-bottom: 20px;';
            
            const recTitle = document.createElement('h3');
            recTitle.textContent = `✅ OPTIMIERUNGSEMPFEHLUNGEN (${analysis.recommendations.length})`;
            recTitle.style.cssText = 'margin: 0 0 12px 0; color: #a6e3a1; font-size: 14px; font-weight: bold;';
            recSection.appendChild(recTitle);
            
            const recList = document.createElement('div');
            recList.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
            
            analysis.recommendations.forEach((rec, idx) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    background: var(--surface1, #1e1e2e); padding: 12px; border-radius: 4px;
                    border-left: 4px solid ${rec.priority === 'HIGH' ? '#f38ba8' : '#f9e2af'};
                    font-size: 11px;
                `;
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 500; color: #89dceb;">🔧 ${idx + 1}. ${rec.description}</span>
                        <span style="background: ${rec.priority === 'HIGH' ? '#f38ba8' : '#f9e2af'}; color: #000; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold;">${rec.priority}</span>
                    </div>
                    <div style="color: #888; margin-bottom: 8px;">⏱️ Geschätzte Verbesserung: <strong style="color: #a6e3a1;">${rec.estimatedSpeedup}</strong></div>
                    <code style="display: block; background: var(--surface2, #313244); padding: 8px; border-radius: 3px; overflow-x: auto; font-size: 10px; margin-bottom: 8px;">${rec.sqlStatement}</code>
                    <button data-sql="${rec.sqlStatement}" style="
                        padding: 4px 8px; background: #a6e3a1; color: #000; border: none; border-radius: 3px;
                        cursor: pointer; font-size: 10px; font-weight: 500;
                    ">📋 Index-Query kopieren</button>
                `;
                recList.appendChild(item);
            });
            
            recSection.appendChild(recList);
            panel.appendChild(recSection);

            // Event-Listener für Copy-Buttons
            panel.querySelectorAll('button[data-sql]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sql = btn.getAttribute('data-sql');
                    navigator.clipboard.writeText(sql).then(() => {
                        setStatus('✅ SQL kopiert!', 'success');
                        const oldText = btn.textContent;
                        btn.textContent = '✅ Kopiert!';
                        setTimeout(() => { btn.textContent = oldText; }, 2000);
                    });
                });
            });
        }

    } catch (e) {
        console.error('[IndexAdvisor] Fehler bei Performance-Analyse:', e);
        loading.innerHTML = `
            <div style="color: #f38ba8;">
                ❌ Fehler bei der Performance-Analyse:<br>
                <span style="font-size: 11px; margin-top: 8px; display: block;">${e.message}</span>
            </div>
        `;
    }

    // ===== BUTTONS =====
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border, #333);';

    const reportBtn = document.createElement('button');
    reportBtn.textContent = '📄 Report speichern';
    reportBtn.style.cssText = `
        padding: 8px 12px; border: 1px solid var(--border, #333); border-radius: 4px;
        background: var(--surface2, #313244); color: var(--fg, #cdd6f4); cursor: pointer;
        font-size: 12px; transition: background 0.15s;
    `;
    reportBtn.onmouseenter = () => reportBtn.style.background = 'rgba(255,255,255,0.1)';
    reportBtn.onmouseleave = () => reportBtn.style.background = 'var(--surface2, #313244)';
    buttonContainer.appendChild(reportBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌ Schließen';
    closeBtn.style.cssText = `
        padding: 8px 12px; border: 1px solid var(--accent, #89b4fa); border-radius: 4px;
        background: var(--accent, #89b4fa); color: #000; cursor: pointer;
        font-size: 12px; font-weight: 500; transition: opacity 0.15s;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.opacity = '0.8';
    closeBtn.onmouseleave = () => closeBtn.style.opacity = '1';
    closeBtn.onclick = () => modal.remove();
    buttonContainer.appendChild(closeBtn);

    panel.appendChild(buttonContainer);

    // ESC zum Schließen
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    
    document.addEventListener('keydown', escHandler);
    
    setStatus('✅ Performance-Analyse abgeschlossen', 'success');
}
