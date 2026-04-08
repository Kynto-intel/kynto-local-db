/**
 * Verwaltet das Einblenden des AI Widgets direkt zwischen den Zeilen
 */
export class InlineAIController {
    constructor(editor: any);
    editor: any;
    targetEditor: any;
    viewZoneId: any;
    overlayWidget: {
        getId: () => string;
        getDomNode: () => HTMLDivElement;
        getPosition: () => any;
    };
    resizeObserver: ResizeObserver;
    layoutListener: any;
    viewZoneRef: {
        top: number;
        height: number;
    };
    /**
     * Berechnet die Position und Breite des Widgets basierend auf dem aktuellen Editor-Layout.
     * Übernommen aus der robusten React-Implementierung für maximale Stabilität.
     */
    recalculateLayout(widget: any): void;
    show(onResolve: any): void;
    hide(): void;
}
