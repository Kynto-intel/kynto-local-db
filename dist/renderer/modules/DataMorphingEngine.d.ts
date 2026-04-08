export namespace DataMorphingEngine {
    /**
     * Analysiert Spalten + Zeilen und gibt eine Layout-Entscheidung zurück.
     *
     * @param {string[]} columns        — Alle Spaltennamen der Tabelle
     * @param {Record<string, unknown>[]} rows — Zeilen aus PostgreSQL
     * @returns {LayoutDecision}
     *
     * @typedef {Object} LayoutDecision
     * @property {'GALLERY' | 'RICH_LIST' | 'STANDARD_GRID' | 'NUMERIC_GRID'} mode
     * @property {boolean} useVisualRenderer  — Soll der VisualCellRenderer aktiv sein?
     * @property {boolean} lazyLoadImages     — Lazy-Loading aktivieren?
     * @property {string}  reason             — Menschenlesbare Begründung
     * @property {string[]} mediaColumns      — Erkannte Medien-Spalten
     * @property {object}  meta               — Diagnostik-Daten (für Debugging)
     */
    function determineLayout(columns: string[], rows: Record<string, unknown>[]): {
        mode: "GALLERY" | "RICH_LIST" | "STANDARD_GRID" | "NUMERIC_GRID";
        /**
         * — Soll der VisualCellRenderer aktiv sein?
         */
        useVisualRenderer: boolean;
        /**
         * — Lazy-Loading aktivieren?
         */
        lazyLoadImages: boolean;
        /**
         * — Menschenlesbare Begründung
         */
        reason: string;
        /**
         * — Erkannte Medien-Spalten
         */
        mediaColumns: string[];
        /**
         * — Diagnostik-Daten (für Debugging)
         */
        meta: object;
    };
    /**
     * @private
     * Erstellt ein einheitliches LayoutDecision-Objekt.
     */
    function _decision(mode: any, useVisualRenderer: any, lazyLoadImages: any, reason: any, mediaColumns: any, meta: any): {
        mode: any;
        useVisualRenderer: any;
        lazyLoadImages: any;
        reason: any;
        mediaColumns: any;
        meta: any;
    };
    /**
     * Schnell-Check: Gibt zurück, ob eine Tabelle potenziell Medien hat.
     * Nützlich, bevor die eigentlichen Rows geladen werden.
     *
     * @param {string[]} columns
     * @returns {{ hasMedia: boolean; columns: string[] }}
     */
    function preflightCheck(columns: string[]): {
        hasMedia: boolean;
        columns: string[];
    };
}
