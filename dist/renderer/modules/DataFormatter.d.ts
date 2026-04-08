export namespace DataFormatter {
    function detect(value: any): "text" | "uuid" | "email" | "url" | "phone" | "iban" | "bic" | "vat_id" | "social_handle" | "currency" | "currency_code" | "date_de" | "date_iso" | "datetime_iso" | "ipv4" | "ipv6" | "color_hex" | "coordinates" | "boolean" | "integer" | "float" | "float_en" | "mac_address" | "credit_card" | "zip_code_de" | "ean" | "jwt" | "empty" | "iban_invalid" | "uuid_invalid" | "ipv4_invalid" | "date_de_invalid" | "time" | "email_invalid";
    namespace typeCompatibility {
        let uuid: string[];
        let email: string[];
        let url: string[];
        let phone: string[];
        let iban: string[];
        let bic: string[];
        let vat_id: string[];
        let social_handle: string[];
        let currency: string[];
        let currency_code: string[];
        let date_de: string[];
        let date_iso: string[];
        let datetime_iso: string[];
        let ipv4: string[];
        let ipv6: string[];
        let color_hex: string[];
        let coordinates: string[];
        let boolean: string[];
        let integer: string[];
        let float: string[];
        let float_en: string[];
        let mac_address: string[];
        let credit_card: string[];
        let zip_code_de: string[];
        let ean: string[];
        let jwt: string[];
        let text: any;
    }
    function format(value: any): any;
    function formatWithContext(value: any, expectedType: any): any;
    function _renderCell(value: any, type: any): any;
    function _renderInvalid(raw: any, expectedType: any): string;
    function profileColumn(columnName: any, values: any): {
        columnName: any;
        dominantType: string;
        stats: {};
        totalRows?: undefined;
        emptyCount?: undefined;
        invalidCount?: undefined;
        fillRate?: undefined;
    } | {
        columnName: any;
        dominantType: string;
        totalRows: any;
        emptyCount: any;
        invalidCount: any;
        fillRate: string;
        stats: {
            type: string;
            count: any;
            percentage: number;
        }[];
    };
    function standardize(value: any, type: any): any;
    function getDuckDbType(type: any): any;
    function generateDuckDbSchema(tableName: any, profiledColumns: any): string;
}
