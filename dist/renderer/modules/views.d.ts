export function handleRealtimeUpdate(newRows: any): void;
export function showView(view: any): void;
/**
 * Dashboard anzeigen (mit Datenbank-Statistiken)
 */
export function showDashboard(showAll?: boolean): void;
export function initViewTabs(): void;
export function clearResults(): void;
export function openTableInEditor(tableName: any, schema?: any, entityType?: string, source?: string): Promise<void>;
export function initCellModal(): void;
