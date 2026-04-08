export namespace TableGridEditor {
    function open({ entity, dbId, lints }: {
        entity: any;
        dbId: any;
        lints?: any[];
    }): Promise<void>;
    function close(): void;
    function renderCurrentData(): void;
    function setViewState(view: any): void;
    function switchView(view: any): Promise<void>;
    function deleteColumn(columnName: any): Promise<void>;
    function deleteTable(onDeleted: any): Promise<void>;
    function deleteRows({ rows, allRowsSelected, numRows, filters }: {
        rows: any;
        allRowsSelected?: boolean;
        numRows?: number;
        filters?: any[];
    }): Promise<void>;
    function performCellUpdate(tableName: any, colName: any, newValue: any, rowIndex: any, tdElement: any): Promise<void>;
    /** Generiert Fake-Daten via data-faker.js */
    function handleFillWithFakeData(tableName: any, count?: number): Promise<void>;
    function insertRow(): Promise<boolean>;
    function getCellValueForModal(colName: any, ri: any): Promise<{
        value: any;
        isNull: boolean;
    }>;
    function getCurrentEntity(): any;
    function getCurrentView(): string;
}
