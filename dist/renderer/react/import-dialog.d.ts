/**
 * Import Dialog - Vereinfachte Version basierend auf echten SpreadsheetImport Komponenten
 *
 * Funktionalität:
 * - CSV/Excel Upload
 * - Text Input (Paste-Daten)
 * - Header Selection
 * - Preview der Daten
 * - Behandlung leerer Felder als NULL
 */
export function ImportDialog({ visible, selectedTable, onSave, onClose }: {
    visible?: boolean;
    selectedTable?: any;
    onSave?: any;
    onClose?: any;
}): any;
export default ImportDialog;
