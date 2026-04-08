/* ── modules/views/schema/SchemaManager.js ────────────────────────────────────
   Schema View Management für Tabellen-Struktur Anzeige
   ────────────────────────────────────────────────────────────────────────────── */

import { state } from '../../state.js';
import { esc, escH } from '../../utils.js';
import { getRelationsSummaryHtml, showRelationsDiagram } from '../../relations.js';
import { TableGridEditor } from '../../TableGridEditor/index.js';

export async function renderSchemaGrid(cols) {
    const sv = document.getElementById('result-schema-view');
    if (!sv) return;

    const schema      = state.currentSchema || 'public';
    const relationsHtml = getRelationsSummaryHtml(state.currentTable);

    sv.innerHTML = `
    <div class="schema-wrap" style="padding: 40px; max-width: 1100px; margin: 0 auto;">
        <div class="schema-head" style="margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="color: var(--text); margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">${escH(state.currentTable)}</h2>
                <div style="font-size: 13px; color: var(--muted); margin-top: 8px; display: flex; align-items:center; gap:8px;">
                    <span style="opacity:0.5">Schema:</span>
                    <code style="background:var(--surface2); padding: 3px 8px; border-radius:6px; color:var(--accent); font-weight:bold;">${escH(schema)}</code>
                </div>
            </div>
            <div style="background: var(--surface1); color: var(--text); padding: 10px 20px; border-radius: 12px; font-size: 12px; font-weight: 700; border: 1px solid var(--border);">${cols.length} Columns</div>
        </div>
        <div style="background: var(--surface1); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
            <table class="schema-table" style="width: 100%;">
            <thead>
                <tr>
                    <th style="text-align: left;">Column Name</th>
                    <th style="text-align: left;">Data Type</th>
                    <th style="text-align: center;">Nullable</th>
                    <th style="text-align: right;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${cols.map(c => `
                <tr>
                    <td style="font-weight: 700; color: ${c.pk ? 'var(--accent)' : 'var(--text)'}; font-size: 14px;">
                        ${c.pk ? '<span title="Primary Key" style="margin-right:8px;">🔑</span>' : ''}${escH(c.name)}
                    </td>
                    <td><span class="type-badge">${escH(c.type)}</span></td>
                    <td style="text-align: center; font-size: 12px; font-weight: 600;">
                        ${c.notnull 
                            ? '<span style="background: rgba(243, 139, 168, 0.2); color: #f38ba8; padding: 4px 12px; border-radius: 20px; display: inline-block; gap: 6px; align-items: center;">🚫 NOT NULL</span>'
                            : '<span style="background: rgba(166, 227, 161, 0.15); color: #a6e3a1; padding: 4px 12px; border-radius: 20px; display: inline-block;">✓ NULL</span>'
                        }
                    </td>
                    <td style="text-align: right;">
                        <button class="action-btn-circle delete-column-btn" data-column-name="${escH(c.name)}" title="Delete Column">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H5c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
                `).join('')}
            </tbody>
            </table>
        </div>
        <section style="margin-top: 60px;">
            <h4 style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 2px; margin-bottom: 24px;">
                Relations & Intelligence
            </h4>
            <div style="background: var(--surface1); padding: 32px; border-radius: 24px; border: 1px solid var(--border);">
                ${relationsHtml}
            </div>
        </section>
    </div>`;

    // Event Delegation für alle Buttons (CSP-konform)
    sv.addEventListener('click', (e) => {
        // Delete-Column Button
        const deleteBtn = e.target.closest('.delete-column-btn');
        if (deleteBtn) {
            const colName = deleteBtn.getAttribute('data-column-name');
            TableGridEditor.deleteColumn(colName);
            return;
        }
        
        // Visualisierung-öffnen Button (auch async geladen)
        if (e.target.id === 'btn-open-erd-modal') {
            console.log('[SchemaManager] ERD-Button geklickt für:', state.currentTable);
            showRelationsDiagram(state.currentTable);
            return;
        }
    });
}
