export function isUUID(str: any, version?: string): {
    valid: any;
    version: string | number;
};
export function detectUUIDVersion(str: any): number | "nil" | "max";
export function isUUIDValid(str: any): boolean;
