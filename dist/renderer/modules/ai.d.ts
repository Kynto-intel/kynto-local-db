export function initAISidebar(): void;
/**
 * Zentrale Funktion, um eine KI-Antwort zu erhalten (wird von Sidebar & Inline-Widget genutzt)
 */
export function getAICompletion(prompt: any): Promise<any>;
