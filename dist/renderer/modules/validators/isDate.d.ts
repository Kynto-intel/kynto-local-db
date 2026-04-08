export function isLeapYear(year: any): boolean;
export function daysInMonth(month: any, year: any): number;
export function resolveYear(twoDigit: any, cutoff?: number): any;
export function isDateDE(str: any, options?: {}): {
    valid: boolean;
    reason: string;
    day?: undefined;
    month?: undefined;
    year?: undefined;
} | {
    valid: boolean;
    day: number;
    month: number;
    year: number;
    reason: any;
};
export function isDateISO(str: any, options?: {}): {
    valid: boolean;
    reason: string;
    day?: undefined;
    month?: undefined;
    year?: undefined;
} | {
    valid: boolean;
    day: number;
    month: number;
    year: number;
    reason: any;
};
export function toISO(day: any, month: any, year: any): string;
export function toDE(day: any, month: any, year: any): string;
export namespace dateOptions {
    let minYear: number;
    let maxYear: number;
    let twoDigitYearCutoff: number;
    let strictLeapYear: boolean;
}
