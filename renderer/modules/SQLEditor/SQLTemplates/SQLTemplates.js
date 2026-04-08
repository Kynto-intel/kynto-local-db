import { state } from '../../state.js';
import { setEditorVal } from '../../utils.js';
import { SQL_TEMPLATES } from './SQLEditor.queries.js';

export function renderSQLTemplates(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Filtert nur die 'template' Skripte
    const scripts = SQL_TEMPLATES.filter(t => t.type === 'template');

    container.innerHTML = `
        <div style="padding: 40px; background: #1c1c1c; min-height: 100%; color: #ededed; font-family: sans-serif;">
            <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Scripts</h2>
                <p style="margin: 0; color: #999; font-size: 14px;">
                    Nützliche SQL-Bausteine für deine Datenbank.
                </p>
                <p style="margin: 8px 0 0 0; color: #999; font-size: 14px;">
                    Klicke auf ein Skript, um es in den Editor zu laden, modifiziere es und klicke auf <span style="background: #333; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #fff;">Run</span>.
                </p>
            </div>
            <div id="templates-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                ${scripts.map((item, index) => `
                    <div class="template-card" data-index="${index}" style="background: #141414; border: 1px solid #2e2e2e; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;">
                        <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #fff;">${item.title}</h4>
                        <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.5;">${item.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Event Listener für die Karten
    container.querySelectorAll('.template-card').forEach(card => {
        // Hover-Effekte (identisch zu den Quickstarts für ein einheitliches Bild)
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
            const template = scripts[index];
            
            // Das hier ist wichtig:
            setEditorVal(state, template.sql); // Schickt den Code zum Editor
            
            if (window.showView) window.showView('editor'); // Wechselt die Ansicht
        });
    });
}