export function setSidebarCallbacks(qv: any, cr: any): void;
export function setPGliteCallback(): void;
export function setRemoteCallback(): void;
export function restoreRemoteState(): void;
export function refreshDBList(): Promise<void>;
export function switchDB(id: any): Promise<void>;
export function switchToPGlite(pgId: any): Promise<void>;
export function switchToRemote(remoteDbId: any): Promise<void>;
export function initDBButtons(): void;
export function refreshTableList(): Promise<void>;
/**
 * Öffnet Import-Dialog für eine spezifische Tabelle
 */
export function dropTable(name: any): Promise<void>;
export function openRenameModal(name: any): void;
export function initRenameModal(): void;
export function openRenameDBModal(id: any, currentName: any): void;
export function initRenameDBModal(): void;
