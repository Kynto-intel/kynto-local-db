export namespace tabManager {
    let tabs: any[];
    let activeTabId: any;
    function onActivate(): void;
    function createTab(sql?: string, title?: any, source?: any): {
        id: string;
        title: any;
        sql: string;
        tableName: any;
        source: any;
    };
    function activateTab(id: any): void;
    function closeTab(id: any): boolean;
    function getTab(id: any): any;
    function getTabs(): any[];
    function getActiveTab(): any;
    function reorderTabs(fromIndex: any, toIndex: any): void;
    function setOnActivateCallback(fn: any): void;
}
