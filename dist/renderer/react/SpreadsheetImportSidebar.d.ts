/**
 * SpreadsheetImportSidebar - CSV Import als rechte Seitenleiste (wie storage.manager.html)
 * Design mit CSS-Variablen, Accent-Farben, Gradient-Header, Smooth Animations
 */
import React from 'react';
declare global {
    interface Window {
        executeQuery?: (sql: string, params?: Array<any>, options?: any) => Promise<any>;
        getSelectedDatabase?: () => string;
    }
}
interface SpreadsheetImportSidebarProps {
    visible?: boolean;
    selectedTable?: string | null;
    onImport?: () => void;
    onClose?: () => void;
}
export declare const SpreadsheetImportSidebar: React.FC<SpreadsheetImportSidebarProps>;
export default SpreadsheetImportSidebar;
