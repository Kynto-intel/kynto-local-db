export type PolicyFormField = {
    id?: number;
    name: string;
    schema: string;
    table: string;
    table_id?: number;
    command: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL" | null;
    check: string | null;
    definition: string | null;
    roles: string[];
};
export type PolicyForReview = {
    description?: string;
    statement?: string;
};
export type PostgresPolicyCreatePayload = {
    name: string;
    table: string;
    schema?: string;
    definition?: string;
    check?: string;
    action?: "PERMISSIVE" | "RESTRICTIVE";
    command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
    roles?: string[];
};
export type PostgresPolicyUpdatePayload = {
    id: number;
    name?: string;
    definition?: string;
    check?: string;
    roles?: string[];
};
export type GeneratedPolicy = {
    name: string;
    table: string;
    schema: string;
    action: "PERMISSIVE" | "RESTRICTIVE";
    roles: string[];
    command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
    definition?: string;
    check?: string;
    sql: string;
};
export type PolicyTemplate = {
    id: string;
    preview: boolean;
    templateName: string;
    description: string;
    name: string;
    statement: string;
    definition: string;
    check: string;
    command: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
    roles: string[];
};
