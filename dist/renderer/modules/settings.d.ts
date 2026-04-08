/**
 * Initialisiert das Einstellungs-Modal.
 * Lädt das HTML-Template, fügt es dem DOM hinzu und registriert Event-Listener.
 */
export function initSettings(): Promise<void>;
/**
 * Wendet die Einstellungen sofort auf die UI und den Editor an.
 */
export function applySettings(s: any): void;
/**
 * Initialisiert die API Key Events
 */
export function initApiKeyEvents(): void;
export namespace settings {
    function getTemplates(): {
        id: string;
        type: string;
        title: string;
        description: string;
        sql: string;
    }[];
    function getQuickstarts(): {
        id: string;
        type: string;
        title: string;
        description: string;
        sql: string;
    }[];
}
