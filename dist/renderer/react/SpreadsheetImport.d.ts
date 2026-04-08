/**
 * SpreadsheetImport - CSV Import Sidebar (wie storage.manager.html Design)
 */
import React from 'react';
declare global {
    interface Window {
        executeQuery?: (sql: string, params?: Array<any>, options?: any) => Promise<any>;
        getSelectedDatabase?: () => string;
    }
}
interface SpreadsheetImportProps {
    visible?: boolean;
    selectedTable?: string | null;
    onImport?: () => void;
    onClose?: () => void;
}
export declare const SpreadsheetImport: React.FC<SpreadsheetImportProps>;
export default SpreadsheetImport;
