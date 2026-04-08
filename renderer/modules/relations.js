/* ── modules/relations.js ───────────────────────────────────────────────
   Heuristische Erkennung von Tabellen-Relationen (ERD-Light).
   Findet Verbindungen basierend auf Spaltennamen wie *_id, *_nr, etc.
   ──────────────────────────────────────────────────────────────────── */

import { state } from './state.js';
import { escH }  from './utils.js';

/**
 * Öffnet ein Overlay mit den gefundenen Relationen für eine Tabelle.
 * @param {string} targetTable 
 */
export async function showRelationsDiagram(targetTable) {
    // Versuche zuerst mit State-Relationen
    let relations = findRelations(targetTable);
    
    // Fallback: Lade aus Datenbank wenn State leer
    if (relations.length === 0) {
        console.log('[showRelationsDiagram] Keine State-Relationen, lade aus DB');
        relations = await findRelationsFromDatabase(targetTable);
    }
    
    renderDiagramModal(targetTable, relations);
}

/**
 * Generiert ein HTML-Snippet für die kompakte Anzeige im Schema-Tab.
 * Versucht Relationen zu finden - mit State oder Information Schema Fallback
 */
export function getRelationsSummaryHtml(targetTable) {
    let relations = findRelations(targetTable);
    
    // Wenn keine Relationen in State, zeige einen Placeholder mit Fallback-Loader
    if (relations.length === 0) {
        // Starte asynchron das Laden von DB-Relationen im Hintergrund
        loadRelationsAsync(targetTable);
        
        return `<div style="color:var(--muted); font-size:12px; font-style:italic; padding: 10px 0;" id="relations-placeholder">
            🔄 Lade Beziehungen...
        </div>`;
    }

    return renderRelationsHtml(relations);
}

/**
 * Rendert die Relations-HTML
 */
function renderRelationsHtml(relations) {
    console.log('[renderRelationsHtml] Render', relations.length, 'Relationen');
    return `
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;" id="relations-list">
            ${relations.map(rel => `
                <div style="font-size: 12px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border-left: 3px solid ${rel.type === 'outgoing' ? 'var(--accent)' : 'var(--success)'};">
                    ${escH(rel.from)} (<strong>${escH(rel.fromCol)}</strong>) → ${escH(rel.to)} (<strong>${escH(rel.toCol)}</strong>)
                </div>
            `).join('')}
            <button class="btn" id="btn-open-erd-modal" style="margin-top: 10px; font-size: 11px; align-self: flex-start; cursor: pointer;">
                🔍 Visualisierung öffnen
            </button>
        </div>`;
}

/**
 * Lädt Relationen asynchron aus der Datenbank im Hintergrund
 */
async function loadRelationsAsync(targetTable) {
    try {
        const relations = await findRelationsFromDatabase(targetTable);
        console.log('[loadRelationsAsync] Relationen geladen:', relations.length);
        
        if (relations && relations.length > 0) {
            // Update den Placeholder mit echten Relationen
            const placeholder = document.getElementById('relations-placeholder');
            if (placeholder && placeholder.parentElement) {
                console.log('[loadRelationsAsync] Update Placeholder mit', relations.length, 'Relationen');
                placeholder.parentElement.innerHTML = renderRelationsHtml(relations);
                // Event-Listener werden durch Event-Delegation in SchemaManager gehändelt
            } else {
                console.warn('[loadRelationsAsync] Placeholder nicht gefunden');
            }
        } else {
            console.log('[loadRelationsAsync] Keine Relationen gefunden');
        }
    } catch (e) {
        console.warn('[loadRelationsAsync] Fehler beim Laden:', e);
    }
}

/**
 * Sucht nach ausgehenden und eingehenden Relationen.
 */
export function findRelations(targetTable) {
    const relations = [];
    const targetCols = state.knownColumns[targetTable] || [];

    // 1. Ausgehend: Spalten in targetTable, die auf andere zeigen (z.B. user_id -> users)
    targetCols.forEach(col => {
        const lowerCol = col.toLowerCase();
        const suffixes = ['_id', 'id', '_nr', 'nr', '_key'];
        
        for (const suffix of suffixes) {
            if (lowerCol.endsWith(suffix)) {
                const prefix = lowerCol.slice(0, -suffix.length);
                // Suche nach einer passenden Tabelle (Singular/Plural Check)
                const match = state.knownTables.find(t => {
                    const tl = t.toLowerCase();
                    // FIX 1: Korrekte deutsche Singularformen
                    // Alt: nur  tl === prefix + 'en' | 'er'
                    // Neu: singularCandidates() deckt kunden→kunde, projekte→projekt, etc.
                    return singularCandidates(t).includes(prefix);
                });
                if (match && match !== targetTable) {
                    // FIX 2: echten PK-Spaltennamen ermitteln statt 'id' hardcoden
                    const toCol = findPrimaryKey(match);
                    relations.push({ from: targetTable, fromCol: col, to: match, toCol: toCol, type: 'outgoing' });
                    break;
                }
            }
        }
    });

    // 2. Eingehend: Andere Tabellen, die auf targetTable zeigen
    state.knownTables.forEach(otherTable => {
        if (otherTable === targetTable) return;
        const cols = state.knownColumns[otherTable] || [];
        
        const commonFKSuffixes = ['_id', 'id', '_nr', 'nr', '_key'];
        const potentialFKNames = new Set();

        // FIX 1: Korrekte deutsche Singularformen für alle Basiskandidaten
        singularCandidates(targetTable).forEach(baseName => {
            if (baseName.length > 0) {
                commonFKSuffixes.forEach(suffix => {
                    potentialFKNames.add(baseName + suffix);
                });
            }
        });

        cols.forEach(col => {
            const cl = col.toLowerCase();
            if (potentialFKNames.has(cl)) {
                // FIX 2: echten PK-Spaltennamen ermitteln statt 'id' hardcoden
                const toCol = findPrimaryKey(targetTable);
                relations.push({ from: otherTable, fromCol: col, to: targetTable, toCol: toCol, type: 'incoming' });
            }
        });
    });

    return relations;
}

// ─── FIX 1: Korrekte deutsche/englische Singularformen ───────────────────────
function singularCandidates(tableName) {
    const tl   = tableName.toLowerCase();
    const base = [tl];
    if (tl.endsWith('en') && tl.length > 3) {
        base.push(tl.slice(0, -2));          // kunden → kund
        base.push(tl.slice(0, -2) + 'e');   // kunden → kunde ✓
    }
    if (tl.endsWith('er') && tl.length > 3) {
        base.push(tl.slice(0, -2));          // kinder → kind
    }
    if (tl.endsWith('e') && tl.length > 2) {
        base.push(tl.slice(0, -1));          // projekte → projekt ✓
    }
    if (tl.endsWith('s') && tl.length > 2) {
        base.push(tl.slice(0, -1));          // users → user
    }
    if (tl.endsWith('ies') && tl.length > 4) {
        base.push(tl.slice(0, -3) + 'y');   // companies → company
    }
    return [...new Set(base)].filter(s => s.length > 0);
}

// ─── FIX 2: Echten PK-Spaltennamen finden statt 'id' hardcoden ───────────────
// Problem vorher: projekte hat "projekt_id" als PK, nicht "id"
//                 → der Fallback || 'id' zeigte immer "id" an
export function findPrimaryKey(tableName) {
    const cols = state.knownColumns[tableName] || [];
    if (cols.length === 0) return 'id';
    // 1. Exakt "id" oder "uid"
    const exact = cols.find(c => ['id', 'uid'].includes(c.toLowerCase()));
    if (exact) return exact;
    // 2. Zusammengesetzter PK wie "projekt_id", "kunden_nr"
    const composite = cols.find(c =>
        c.toLowerCase().endsWith('_id') || c.toLowerCase().endsWith('_nr')
    );
    if (composite) return composite;
    // 3. Erste Spalte als letzter Fallback
    return cols[0] || 'id';
}

/**
 * ✅ NEUE FUNKTION: Lade Relationen direkt aus Information Schema
 * Wird verwendet wenn state.knownTables nicht geladen ist (z.B. direktes Tabellen-Öffnen)
 * 
 * Versucht ZUERST echte Foreign Key Constraints zu laden, dann Fallback zu Namensmuster
 */
async function findRelationsFromDatabase(targetTable) {
    try {
        console.log('[findRelationsFromDatabase] Lade Relationen für:', targetTable);
        
        const relations = [];
        const schema = state.currentSchema || 'public';
        const dbType = (state.dbMode === 'remote' || state.remoteConnectionString) ? 'remote' : 'local';
        
        // 1️⃣ VERSUCHE ECHTE FOREIGN KEY CONSTRAINTS ZU LADEN
        console.log('[findRelationsFromDatabase] Versuche echte FK-Constraints zu laden...');
        try {
            const fkQuery = `
                SELECT 
                    tc.constraint_name, 
                    tc.table_name, 
                    kcu.column_name, 
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu 
                  ON tc.constraint_name = kcu.constraint_name 
                  AND tc.table_schema = kcu.table_schema 
                JOIN information_schema.constraint_column_usage AS ccu 
                  ON ccu.constraint_name = tc.constraint_name 
                  AND ccu.table_schema = tc.table_schema 
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = '${schema}'
            `;
            
            const fkResult = await window.api.dbQuery(fkQuery, null, dbType);
            console.log('[findRelationsFromDatabase] FK-Constraint Query Result:', fkResult);
            
            if (Array.isArray(fkResult) && fkResult.length > 0) {
                // AUSGEHEND: Diese Tabelle hat FKs zu anderen
                const outgoing = fkResult.filter(row => 
                    (row.table_name || row['table_name']) === targetTable
                );
                outgoing.forEach(row => {
                    relations.push({
                        from: row.table_name || row['table_name'],
                        fromCol: row.column_name || row['column_name'],
                        to: row.foreign_table_name || row['foreign_table_name'],
                        toCol: row.foreign_column_name || row['foreign_column_name'],
                        type: 'outgoing'
                    });
                });
                
                // EINGEHEND: Andere Tabellen haben FKs zu dieser
                const incoming = fkResult.filter(row => 
                    (row.foreign_table_name || row['foreign_table_name']) === targetTable
                );
                incoming.forEach(row => {
                    relations.push({
                        from: row.table_name || row['table_name'],
                        fromCol: row.column_name || row['column_name'],
                        to: row.foreign_table_name || row['foreign_table_name'],
                        toCol: row.foreign_column_name || row['foreign_column_name'],
                        type: 'incoming'
                    });
                });
                
                if (relations.length > 0) {
                    console.log('[findRelationsFromDatabase] ✅ FK-Constraints gefunden:', relations.length);
                    return relations;
                }
            }
        } catch (e) {
            console.warn('[findRelationsFromDatabase] FK-Constraint Query fehlgeschlagen:', e.message);
        }
        
        // 2️⃣ FALLBACK: Lade alle Tabellen und nutze Namensmuster
        console.log('[findRelationsFromDatabase] Fallback zu Namensmuster-Erkennung...');
        let allTables = [];
        try {
            const tablesQuery = `
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = '${schema}' 
                AND table_type = 'BASE TABLE'
            `;
            const tablesResult = await window.api.dbQuery(tablesQuery, null, dbType);
            allTables = (Array.isArray(tablesResult) ? tablesResult : [])
                .map(row => row.table_name || row['table_name'])
                .filter(Boolean);
            console.log('[findRelationsFromDatabase] Gefundene Tabellen:', allTables.length);
        } catch (e) {
            console.warn('[findRelationsFromDatabase] Fehler beim Laden Tabellen:', e);
            return [];
        }
        
        // 3️⃣ Lade Spalten der Ziel-Tabelle
        let targetCols = [];
        try {
            const colsQuery = `
                SELECT column_name FROM information_schema.columns
                WHERE table_name = '${targetTable}' AND table_schema = '${schema}'
            `;
            const colsResult = await window.api.dbQuery(colsQuery, null, dbType);
            targetCols = (Array.isArray(colsResult) ? colsResult : [])
                .map(row => row.column_name || row['column_name'])
                .filter(Boolean);
            console.log('[findRelationsFromDatabase] Spalten von', targetTable, ':', targetCols.length);
        } catch (e) {
            console.warn('[findRelationsFromDatabase] Fehler beim Laden Spalten:', e);
        }
        
        // 4️⃣ AUSGEHEND: Prüfe ob targetTable FK zu anderen Tabellen hat (Namensmuster)
        targetCols.forEach(col => {
            const lowerCol = col.toLowerCase();
            const suffixes = ['_id', '_nr', '_key'];
            
            for (const suffix of suffixes) {
                if (lowerCol.endsWith(suffix)) {
                    const prefix = lowerCol.slice(0, -suffix.length);
                    // Suche entsprechende Tabelle
                    const match = allTables.find(t => 
                        singularCandidates(t).includes(prefix)
                    );
                    
                    if (match && match !== targetTable) {
                        relations.push({
                            from: targetTable,
                            fromCol: col,
                            to: match,
                            toCol: 'id',
                            type: 'outgoing'
                        });
                        break;
                    }
                }
            }
        });
        
        console.log('[findRelationsFromDatabase] ✅ Relationen gefunden (gesamt):', relations.length);
        return relations;
    } catch (e) {
        console.error('[findRelationsFromDatabase] Kritischer Fehler:', e);
        return [];
    }
}

function renderDiagramModal(targetTable, relations) {
    let modal = document.getElementById('erd-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'erd-modal';
        // Wir setzen die Styles direkt, um den schwarzen Hintergrund der Klasse 'modal-fullscreen' zu vermeiden
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '2000', display: 'none', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none' // Erlaubt Klicks durch den leeren Bereich, falls gewünscht
        });
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    // Hintergrund-Blur und Layout-Optimierung
    modal.innerHTML = `
        <div class="modal-content" style="width:90%; max-width:850px; max-height:80vh; background:rgba(var(--surface1-rgb, 30, 30, 35), 0.98); border:1px solid rgba(255,255,255,0.15); border-radius:24px; box-shadow:0 40px 120px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden; animation: modalFloatIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: auto;">
            
            <style>
                @keyframes modalFloatIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes flowLine { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
                .rel-card { background: var(--surface2); border: 1px solid var(--border-light); border-radius: 16px; padding: 18px 24px; min-width: 200px; box-shadow: 0 8px 25px rgba(0,0,0,0.2); transition: all 0.3s ease; position: relative; }
                .rel-card:hover { transform: translateY(-4px); border-color: var(--accent); box-shadow: 0 12px 35px rgba(0,0,0,0.4); }
                .rel-card.active-table { border-color: var(--accent); background: linear-gradient(145deg, var(--surface2), rgba(var(--accent-rgb), 0.05)); }
            </style>

            <div style="padding:25px 30px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                <div>
                    <h2 style="margin:0; color:var(--accent); font-size:1.4rem; letter-spacing:-0.5px;">🔗 Struktur-Visualisierung</h2>
                    <p style="margin:5px 0 0; font-size:12px; color:var(--muted);">Gefundene Verbindungen für Tabelle: <strong>${escH(targetTable)}</strong></p>
                </div>
                <button id="erd-close" style="background:var(--surface2); border:1px solid var(--border); color:var(--text); width:36px; height:36px; border-radius:10px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; transition:0.2s;">✕</button>
            </div>
            
            <div style="padding:40px; overflow-y:auto; background:radial-gradient(circle at center, rgba(var(--accent-rgb), 0.03) 0%, transparent 70%);">
                ${relations.length === 0 ? `
                    <div style="text-align:center; padding:40px; color:var(--muted);">
                        <div style="font-size:40px; margin-bottom:15px;">🔍</div>
                        <p>Keine direkten Verbindungen zu anderen Tabellen erkannt.</p>
                    </div>` : ''}
                
                <div style="display:flex; flex-direction:column; gap:30px;">
                ${relations.map(rel => `
                    <div style="display:flex; align-items:center; justify-content:center;">
                        <!-- Quelle -->
                        <div class="rel-card ${rel.from === targetTable ? 'active-table' : ''}">
                            <div style="font-size:11px; color:var(--muted); margin-bottom:4px; text-transform:uppercase;">Tabelle</div>
                            <div style="font-weight:bold; color:${rel.from === targetTable ? 'var(--accent)' : 'var(--text)'};">${escH(rel.from)}</div>
                            <div style="font-size:10px; margin-top:5px; color:var(--accent); opacity:0.8;">🔑 ${escH(rel.fromCol)}</div>
                        </div>

                        <!-- FIX 3: SVG-Pfeil mit viewBox statt ungültigem "L 100% 10" -->
                        <div style="display:flex; flex-direction:column; align-items:center; flex: 1; max-width: 200px;">
                            <div style="font-size:9px; font-weight:bold; color:var(--muted); margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">
                                ${rel.type === 'outgoing' ? 'verweist auf' : 'referenziert'}
                            </div>
                            <svg viewBox="0 0 200 20" xmlns="http://www.w3.org/2000/svg"
                                 style="width:100%; height:20px; overflow:visible; display:block;">
                                <line x1="5" y1="10" x2="185" y2="10"
                                      stroke="${rel.type === 'outgoing' ? 'var(--accent)' : 'var(--success)'}"
                                      stroke-width="2" stroke-dasharray="6 4"
                                      style="animation: flowLine 0.8s linear infinite;" />
                                <polygon
                                      points="${rel.type === 'outgoing' ? '178,6 190,10 178,14' : '22,6 10,10 22,14'}"
                                      fill="${rel.type === 'outgoing' ? 'var(--accent)' : 'var(--success)'}" />
                            </svg>
                        </div>

                        <!-- Ziel -->
                        <div class="rel-card ${rel.to === targetTable ? 'active-table' : ''}">
                            <div style="font-size:11px; color:var(--muted); margin-bottom:4px; text-transform:uppercase;">Tabelle</div>
                            <div style="font-weight:bold; color:${rel.to === targetTable ? 'var(--accent)' : 'var(--text)'};">${escH(rel.to)}</div>
                            <!-- FIX 3: gleiche Farbe wie fromCol -->
                            <div style="font-size:10px; margin-top:5px; color:var(--accent); opacity:0.8;">🔑 ${escH(rel.toCol)}</div>
                        </div>
                    </div>
                `).join('')}
                </div>
            </div>
        </div>`;
    
    modal.classList.add('open');
    
    const close = () => { modal.style.display = 'none'; };
    const erdClose = document.getElementById('erd-close');
    if (erdClose) erdClose.addEventListener('click', close);
}