import { state } from '../../state.js';
import { setEditorVal } from '../../utils.js';
import { SQL_TEMPLATES } from './SQLEditor.queries.js';

export function renderSQLQuickstarts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Direkter Zugriff auf die Vorlagen-Datenbank
    const quickstarts = SQL_TEMPLATES.filter(t => t.type !== 'template');

    container.innerHTML = `
        <div style="padding: 40px; background: #1c1c1c; min-height: 100%; color: #ededed; font-family: sans-serif;">
            <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Quickstarts</h2>
                <p style="margin: 0; color: #999; font-size: 14px;">
                    Klicke auf ein Skript, um es in den Editor zu laden. Modifiziere es nach Bedarf und klicke auf <span style="background: #333; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #fff;">Run</span>.
                </p>
            </div>
            <div id="quickstart-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                ${quickstarts.map((item, index) => `
                    <div class="action-card" data-index="${index}" style="background: #141414; border: 1px solid #2e2e2e; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;">
                        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                            <div style="background: #2e2e2e; padding: 8px; border-radius: 6px; color: #3ecf8e;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: #fff;">${item.title}</h4>
                        </div>
                        <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.5;">${item.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Event Listener für Karten
    container.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#3ecf8e';
            card.style.background = '#1a1a1a';
        });

        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#2e2e2e';
            card.style.background = '#141414';
        });

        card.addEventListener('click', () => {
            const index = card.getAttribute('data-index');
            const template = quickstarts[index];
            
            // Das hier ist wichtig:
            setEditorVal(state, template.sql); // Schickt den Code zum Editor
            
            if (window.showView) window.showView('editor'); // Wechselt die Ansicht
        });
    });
}