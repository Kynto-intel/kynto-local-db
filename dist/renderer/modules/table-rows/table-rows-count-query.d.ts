export function getTableRowsCountSql({ table, filters, enforceExactCount }: {
    table: any;
    filters?: any[];
    enforceExactCount?: boolean;
}): string;
export function getTableRowsCount({ table, filters }: {
    table: any;
    filters?: any[];
}): Promise<any>;
export class TableRowsCountQuery {
    constructor({ queryClient, executeSql, onSuccess, onError }: {
        queryClient: any;
        executeSql: any;
        onSuccess: any;
        onError: any;
    });
    queryClient: any;
    executeSql: any;
    onSuccess: any;
    onError: any;
    getQueryOptions({ tableId, filters, enforceExactCount, enabled }?: {
        filters?: any[];
        enforceExactCount?: boolean;
        enabled?: boolean;
    }): {
        queryKey: any[];
        queryFn: () => Promise<any>;
        enabled: boolean;
    };
    invalidateQuery(tableId: any): void;
}
export default TableRowsCountQuery;
