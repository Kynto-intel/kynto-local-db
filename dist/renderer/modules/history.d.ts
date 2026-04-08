export function loadHistory(): Promise<void>;
export function saveHistory(): Promise<void>;
export function addToHistory(sql: any): void;
export function renderHistory(): void;
export function initHistoryControls(): void;
export function loadFavorites(): Promise<void>;
export function saveFavorites(): Promise<void>;
export function renderFavorites(): void;
export function initFavoriteControls(): void;
