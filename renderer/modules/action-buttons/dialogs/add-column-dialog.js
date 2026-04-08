/* ── dialogs/add-column-dialog.js ─────────────────────────────────────
   Modal-Dialog für Spalten-Hinzufügen (Elektron-kompatibel, kein prompt())
   ──────────────────────────────────────────────────────────────────────── */

import { setStatus } from '../../utils.js';

/**
 * Zeigt einen Modal Dialog zur Eingabe von Spalten-Name und Typ
 * (prompt() funktioniert nicht in Electron)
 * 
 * @param {string} tableName - Name der Tabelle
 * @param {string} schema - Schema der Tabelle
 * @param {Function} onSubmit - Callback(colName, colType) bei OK
 */
export function showAddColumnDialog(tableName, schema, onSubmit) {
    // Modal CSS injizieren (einmalig)
    if (!document.getElementById('add-column-dialog-style')) {
        const style = document.createElement('style');
        style.id = 'add-column-dialog-style';
        style.textContent = `
            .add-col-overlay { 
                display: none; position: fixed; inset: 0; z-index: 5000;
                background: rgba(0,0,0,0.5); align-items: center; justify-content: center;
            }
            .add-col-overlay.open { display: flex; }
            .add-col-modal {
                background: var(--surface); border: 1px solid var(--border);
                border-radius: 8px; padding: 20px; width: 90%; max-width: 400px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .add-col-modal h3 { margin: 0 0 15px 0; font-size: 14px; color: var(--text); }
            .add-col-modal input {
                width: 100%; padding: 8px; margin-bottom: 12px;
                background: var(--surface1); border: 1px solid var(--border);
                border-radius: 4px; color: var(--text); outline: none; font-size: 12px;
                box-sizing: border-box;
            }
            .add-col-modal input:focus { border-color: var(--accent); }
            .add-col-modal .buttons {
                display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;
            }
            .add-col-modal button {
                padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;
                border: 1px solid var(--border); background: var(--surface1); color: var(--text);
            }
            .add-col-modal button.primary {
                background: var(--accent); color: #000; border-color: var(--accent);
            }
            .add-col-modal button:hover { opacity: 0.8; }
        `;
        document.head.appendChild(style);
    }

    // Modal existiert schon → nur neu öffnen
    let modal = document.getElementById('add-col-overlay');
    if (!modal) {
        const overlay = document.createElement('div');
        overlay.id = 'add-col-overlay';
        overlay.className = 'add-col-overlay';
        overlay.innerHTML = `
            <div class="add-col-modal">
                <h3>Neue Spalte hinzufügen</h3>
                <input type="text" id="col-name" placeholder="Spaltenname" />
                <input type="text" id="col-type" placeholder="Datentyp (TEXT, INTEGER, BOOLEAN, etc.)" value="TEXT" />
                <div class="buttons">
                    <button id="col-cancel">Abbrechen</button>
                    <button id="col-ok" class="primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        modal = overlay;

        // Event-Handler (CSP-konform)
        modal.querySelector('#col-cancel').addEventListener('click', () => modal.classList.remove('open'));
        modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.remove('open'); });
    }

    // Modal öffnen
    modal.classList.add('open');
    const nameInput = modal.querySelector('#col-name');
    const typeInput = modal.querySelector('#col-type');
    const okBtn = modal.querySelector('#col-ok');

    // Inputs leeren
    nameInput.value = '';
    typeInput.value = 'TEXT';

    // Focus auf Input
    setTimeout(() => nameInput.focus(), 100);

    // OK Button Logik
    okBtn.addEventListener('click', async () => {
        const colName = nameInput.value?.trim();
        const colType = typeInput.value?.trim() || 'TEXT';

        if (!colName) {
            setStatus('Spaltenname erforderlich', 'error');
            return;
        }

        modal.classList.remove('open');
        setStatus(`✏️ Spalte "${colName}" vom Typ "${colType}" hinzufügen...`, 'info');
        
        // Callback aufrufen
        if (typeof onSubmit === 'function') {
            onSubmit(colName, colType);
        }
    });

    // Enter-Taste auch OK
    nameInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') okBtn.click(); });
    typeInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') okBtn.click(); });
}
