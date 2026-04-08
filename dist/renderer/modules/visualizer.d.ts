export function setVisualizerRefresh(fn: any): void;
/**
 * Synchronisiert den Typ-Highlighting Button mit dem aktuellen State.
 * Wird nach dem Laden einer Tabelle aufgerufen um den Button sofort aktiv zu machen.
 */
export function syncVisualizerButton(): void;
/**
 * Initialisiert die Visualizer-Steuerelemente und macht die Buttons sichtbar.
 */
/**
 * Initialisiert die Visualizer-Steuerelemente und macht die Buttons sichtbar.
 */
export function initVisualizer(): void;
export namespace KyntoVisualizer {
    namespace modes {
        let TYPE: string;
        let HEATMAP: string;
        let VALIDATION: string;
    }
    function getCellProps(val: any, mode: any, min: any, max: any): {
        className: string;
        text: string;
        style?: undefined;
    } | {
        className: string;
        text?: undefined;
        style?: undefined;
    } | {
        style: string;
        className: string;
        text?: undefined;
    } | {
        className?: undefined;
        text?: undefined;
        style?: undefined;
    };
}
