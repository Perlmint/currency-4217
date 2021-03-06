export class Spec {
    symbol: string | void;
    code: string;
    codeNumber: number;
    minorUnits: number;

    constructor(code: string, codeNumber: number, minorUnits: number, symbol?: string) {
        this.code = code;
        this.codeNumber = codeNumber;
        this.minorUnits = minorUnits;
        this.symbol = symbol;
    }
}
