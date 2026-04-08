export function isEmail(str: any, options?: {}): {
    valid: boolean;
    reason: string;
};
export function isEmailValid(str: any, options?: {}): boolean;
export namespace emailOptions {
    let requireTLD: boolean;
    let allowIPDomain: boolean;
    let allowUTF8LocalPart: boolean;
    let maxLength: number;
    let allowedDomains: any[];
    let blockedDomains: any[];
}
