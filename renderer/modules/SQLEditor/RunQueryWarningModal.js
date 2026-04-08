export class RunQueryWarningModal {
    constructor({ onConfirm, onCancel }) {
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        this.modalElement = null;
    }

    show(issues) {
        if (this.modalElement) this.hide();

        // FIX: Wir nutzen die exakten Namen aus deiner SQLEditor.utils.js
        const isDestructive = issues.isDestructive === true;
        const reason = issues.reason || "";
        
        // Unterscheidung für die Anzeige
        const isNoWhere = reason.includes('WHERE');
        const isDrop = reason.includes('DROP') || reason.includes('TRUNCATE');

        const modal = document.createElement('div');
        modal.id = 'run-query-warning-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; align-items: center;
            justify-content: center; z-index: 10000; font-family: sans-serif;
            backdrop-filter: blur(2px);
        `;

        modal.innerHTML = `
            <div style="background: #1c1c1c; border: 1px solid #2e2e2e; border-radius: 12px; width: 480px; color: #ededed; box-shadow: 0 30px 60px rgba(0,0,0,0.5); overflow: hidden;">
                
                <div style="padding: 24px 24px 16px 24px; display: flex; align-items: center; gap: 12px;">
                    <div style="color: #f59e0b; font-size: 24px;">⚠️</div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Potenzielles Problem erkannt</h3>
                </div>

                <div style="padding: 0 24px 24px 24px;">
                    <p style="font-size: 14px; color: #999; margin-bottom: 20px;">
                        Deine Abfrage wurde gestoppt, da folgende Probleme erkannt wurden:
                    </p>

                    <div style="background: #141414; border: 1px solid #333; border-radius: 8px; overflow: hidden;">
                        <ul style="list-style: none; margin: 0; padding: 0;">
                            
                            ${isDrop ? `
                                <li style="padding: 16px; border-bottom: 1px solid #282828; display: flex; flex-direction: column; gap: 4px;">
                                    <span style="font-weight: 600; font-size: 14px; color: #ededed;">Kritische Operation erkannt</span>
                                    <span style="font-size: 13px; color: #999;">${reason}</span>
                                </li>
                            ` : ''}

                            ${isNoWhere ? `
                                <li style="padding: 16px; border-bottom: 1px solid #282828; display: flex; flex-direction: column; gap: 4px;">
                                    <span style="font-weight: 600; font-size: 14px; color: #ededed;">Fehlende WHERE-Klausel</span>
                                    <span style="font-size: 13px; color: #999;">Dies wird JEDE Zeile in der Tabelle unwiderruflich ändern oder löschen.</span>
                                </li>
                            ` : ''}

                            ${isDestructive && !isDrop && !isNoWhere ? `
                                <li style="padding: 16px; border-bottom: 1px solid #282828; display: flex; flex-direction: column; gap: 4px;">
                                    <span style="font-weight: 600; font-size: 14px; color: #ededed;">Gefährliche Abfrage</span>
                                    <span style="font-size: 13px; color: #999;">${reason}</span>
                                </li>
                            ` : ''}

                        </ul>
                    </div>
                </div>

                <div style="padding: 16px 24px; background: #232323; border-top: 1px solid #2e2e2e; display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="warning-cancel" style="background: transparent; border: 1px solid #3e3e3e; color: #ededed; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">Abbrechen</button>
                    <button id="warning-confirm" style="background: #f59e0b; border: none; color: #1c1c1c; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">Trotzdem ausführen</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modalElement = modal;

        modal.querySelector('#warning-cancel').addEventListener('click', () => { this.hide(); if (this.onCancel) this.onCancel(); });
        modal.querySelector('#warning-confirm').addEventListener('click', () => { this.hide(); if (this.onConfirm) this.onConfirm(); });
    }

    hide() {
        if (this.modalElement) {
            this.modalElement.remove();
            this.modalElement = null;
        }
    }
}