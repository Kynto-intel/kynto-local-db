export function luhnCheck(str: any): boolean;
export function detectCCNetwork(digits: any): string;
export function isCreditCard(str: any): {
    valid: boolean;
    network: string;
    luhnOk: boolean;
};
export namespace ccNetworks {
    namespace amex {
        let regex: RegExp;
        let lengths: number[];
    }
    namespace dinersclub {
        let regex_1: RegExp;
        export { regex_1 as regex };
        let lengths_1: number[];
        export { lengths_1 as lengths };
    }
    namespace discover {
        let regex_2: RegExp;
        export { regex_2 as regex };
        let lengths_2: number[];
        export { lengths_2 as lengths };
    }
    namespace jcb {
        let regex_3: RegExp;
        export { regex_3 as regex };
        let lengths_3: number[];
        export { lengths_3 as lengths };
    }
    namespace mastercard {
        let regex_4: RegExp;
        export { regex_4 as regex };
        let lengths_4: number[];
        export { lengths_4 as lengths };
    }
    namespace unionpay {
        let regex_5: RegExp;
        export { regex_5 as regex };
        let lengths_5: number[];
        export { lengths_5 as lengths };
    }
    namespace visa {
        let regex_6: RegExp;
        export { regex_6 as regex };
        let lengths_6: number[];
        export { lengths_6 as lengths };
    }
}
export const requireLuhn: false;
