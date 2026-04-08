/**
 * Führt alle Operationen in einer Transaktion aus.
 */
export function saveOperationQueue({ projectRef, operations }: {
    projectRef: any;
    operations: any;
}): Promise<{
    result: any;
}>;
export namespace QueuedOperationType {
    let EDIT_CELL_CONTENT: string;
    let ADD_ROW: string;
    let DELETE_ROW: string;
}
export namespace operationQueueSaveMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<{
        result: any;
    }>;
}
