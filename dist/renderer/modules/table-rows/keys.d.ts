export namespace tableRowKeys {
    function all(projectRef: any): any[];
    function tableRowsAndCount(projectRef: any, tableId: any): any[];
    function tableRows(projectRef: any, { table, roleImpersonationState, ...args }?: {}): any[];
    function tableRowsCount(projectRef: any, { table, ...args }?: {}): any[];
    function tableRow(projectRef: any, tableId: any, pkMatch: any): any[];
}
