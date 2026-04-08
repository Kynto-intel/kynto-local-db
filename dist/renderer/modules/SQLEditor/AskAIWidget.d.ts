/**
 * Erzeugt das DOM-Element für den Inline-KI-Assistenten
 * @param {Function} onResolve - Wird aufgerufen, wenn "Generieren" geklickt wird
 * @param {Function} onCancel - Wird aufgerufen, wenn "Abbrechen" geklickt wird
 * @param {Function} onAccept - Wird aufgerufen, wenn im Diff-Modus "Übernehmen" geklickt wird
 * @param {Function} onDiscard - Wird aufgerufen, wenn im Diff-Modus "Verwerfen" geklickt wird
 */
export function createAskAIWidget(onResolve: Function, onCancel: Function, onAccept: Function, onDiscard: Function): {
    domNode: HTMLDivElement;
    focus: () => NodeJS.Timeout;
    /**
     * Aktualisiert den Zustand des Widgets (loading, diff, idle)
     */
    update: (state: any) => void;
};
