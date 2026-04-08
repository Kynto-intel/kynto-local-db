export function getTableRowDeleteAllSql({ table, filters }: {
    table: any;
    filters?: any[];
}): string;
export function deleteAllTableRow({ table, filters }: {
    table: any;
    filters?: any[];
}): Promise<any>;
export class TableRowDeleteAllMutation {
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
    validateFilters(filters: any): {
        isValid: boolean;
        errorMessage: string;
    } | {
        isValid: boolean;
        errorMessage?: undefined;
    };
    mutate(variables: any): Promise<any>;
}
export default TableRowDeleteAllMutation;
