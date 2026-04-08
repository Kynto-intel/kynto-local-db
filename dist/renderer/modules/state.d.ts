export const DUCK_TYPES: string[];
export namespace state {
    let dbMode: string;
    let activeDbId: any;
    let pgId: any;
    let progressServerConnection: any;
    let serverConnectionString: any;
    let duckDbPath: any;
    let importSourceDbId: any;
    let knownTables: any[];
    let knownColumns: {};
    let columnMetadata: any[];
    let currentTable: any;
    let currentCols: any[];
    let currentTableType: any;
    let currentSchema: any;
    namespace currentSort {
        let col: any;
        let dir: string;
    }
    let currentFilters: {};
    let lastData: any[];
    let currentLimit: number;
    let currentPage: number;
    let totalRows: number;
    let totalPages: number;
    let selectedRows: Set<any>;
    let tableColors: {};
    let tableOrder: {};
    let tableBottomOrder: {};
    let lastQueryDuration: number;
    let sqlTabs: any[];
    let activeTab: any;
    let history: any[];
    let favorites: any[];
    let isDark: boolean;
    let editor: any;
    let chartInst: any;
    let editorSettings: any;
    let aiSettings: any;
    let magicEyeActive: boolean;
    let magicMode: string;
    let realtimeActive: boolean;
}
