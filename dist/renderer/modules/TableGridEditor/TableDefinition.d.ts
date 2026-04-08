export class TableDefinition {
    /**
     * @param {object} opts
     * @param {object} opts.entity      – Entity-Objekt mit { id, schema, name, entity_type }
     * @param {string} opts.dbId        – aktive Datenbank-ID
     * @param {string} opts.resolvedSchema – Das bereits aufgelöste Schema (z.B. 'public')
     * @param {string} opts.dbType      – 'local' (PGlite) oder 'remote' (PostgreSQL)
     * @param {HTMLElement} opts.container – Ziel-Element für das Rendern
     */
    constructor({ entity, dbId, container, resolvedSchema, dbType }: {
        entity: object;
        dbId: string;
        resolvedSchema: string;
        dbType: string;
        container: HTMLElement;
    });
    entity: any;
    dbId: string;
    container: HTMLElement;
    resolvedSchema: string;
    dbType: string;
    _monacoEditor: any;
    /** Rendert die Definition in den Container. */
    render(): Promise<void>;
    /** Räumt Monaco auf (falls aktiv). */
    destroy(): void;
    _loadDefinition(entity: any, dbId: any, resolvedSchema: any, dbType: any): Promise<any>;
    _buildTableDdlFromSchema(entity: any, dbType: any, schema: any): Promise<string>;
    _buildPrepend(entity: any): string;
    _tryRenderMonaco(container: any, sql: any): Promise<boolean>;
    _renderFallback(container: any, sql: any): void;
    _openInSqlEditor(sql: any): void;
}
