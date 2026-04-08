export function newTab(sql?: string, title?: any): {
    id: string;
    title: any;
    sql: string;
    tableName: any;
    source: any;
};
export function renderTabs(): void;
export function activateTab(id: any): void;
export function closeTab(id: any): void;
export function setTabActivateCallback(fn: any): void;
export function initTabsDragAndDrop(onTableDrop: any): void;
export function updateTabTitle(id: any, title: any): void;
export function getActiveTab(): any;
export function getTabs(): any[];
import { tabManager } from './manager.js';
import { tabRenderer } from './renderer.js';
export { tabManager, tabRenderer };
