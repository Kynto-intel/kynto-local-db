/**
 * Erzeugt das DOM-Element für den Inline-KI-Assistenten (SQL-Modus)
 * @param {Function} onResolve - Wird aufgerufen, wenn "Generieren" geklickt wird (mit dem Prompt)
 * @param {Function} onCancel - Wird aufgerufen, wenn "Abbrechen" geklickt wird
 */
export function createAskAIWidget(onResolve, onCancel) {
    const div = document.createElement('div');
    div.className = 'ai-inline-widget';
    div.innerHTML = `
        <div class="ai-widget-content">
            <div class="ai-widget-header">✨ SQL-Generator</div>
            <textarea placeholder="Beschreibe die SQL-Abfrage die du brauchst... (Enter zum Generieren)"></textarea>
            <div class="ai-widget-actions">
                <button class="ai-btn-cancel">Abbrechen <span class="ai-key-badge">Esc</span></button>
                <button class="ai-btn-confirm">Generieren <span class="ai-key-badge">Enter</span></button>
            </div>
        </div>
    `;

    const header = div.querySelector('.ai-widget-header');
    const textarea = div.querySelector('textarea');
    const btnConfirm = div.querySelector('.ai-btn-confirm');
    const btnCancel = div.querySelector('.ai-btn-cancel');

    const setBtn = (btn, text, kbd) => {
        btn.innerHTML = `${text} <span class="ai-key-badge">${kbd}</span>`;
    };

    // Handler-Referenzen speichern
    let currentConfirmHandler = () => onResolve(textarea.value);
    let currentCancelHandler = onCancel;

    // Standard-Event-Handler
    btnConfirm.addEventListener('click', () => currentConfirmHandler());
    btnCancel.addEventListener('click', () => currentCancelHandler());

    // Dynamische Höhenanpassung
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });

    // Key-Handler
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            currentCancelHandler();
        }
        if (e.key === 'Enter' && !e.shiftKey && !textarea.disabled && e.target === textarea) {
            e.preventDefault();
            currentConfirmHandler();
        }
    });

    return {
        domNode: div,
        focus: () => setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 100),
        update: (state) => {
            const { loading } = state;
            textarea.disabled = loading;
            btnConfirm.disabled = loading;

            if (loading) {
                setBtn(btnConfirm, 'Generiere SQL...', '⌛');
                header.textContent = '✨ KI denkt nach…';
            } else {
                header.textContent = '✨ SQL-Generator';
                setBtn(btnConfirm, 'Generieren', 'Enter');
            }
        }
    };
}