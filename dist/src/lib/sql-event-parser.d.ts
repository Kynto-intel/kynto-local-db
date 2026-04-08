export class SQLEventParser {
    static DETECTORS: {
        type: string;
        patterns: RegExp[];
    }[];
    cleanIdentifier(identifier: any): any;
    match(sql: any): {
        type: string;
        schema: any;
        tableName: any;
    };
    splitStatements(sql: any): string[];
    deduplicate(events: any): any;
    removeComments(sql: any): any;
    getTableEvents(sql: any): any;
}
export const sqlEventParser: SQLEventParser;
