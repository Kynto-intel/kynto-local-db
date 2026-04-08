export namespace tableKeys {
    function list(projectRef: string | undefined, schema?: string, includeColumns?: boolean): any[];
    function retrieve(projectRef: string | undefined, name: string, schema: string): any[];
    function rolesAccess(projectRef: string | undefined, schema: string): any[];
}
