export function isURL(str: any, options?: {}): {
    valid: boolean;
    reason: string;
};
export function isURLValid(str: any, options?: {}): boolean;
export namespace urlOptions {
    let allowedProtocols: string[];
    let requireProtocol: boolean;
    let requireTLD: boolean;
    let allowPrivateIPs: boolean;
    let allowedDomains: any[];
    let blockedDomains: any[];
    let maxLength: number;
}
