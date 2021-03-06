import { Spec } from "./spec";

export class Currency {
    /**
     * major part
     */
    private _major: number;

    get major(): number {
        return this._major;
    }

    set major(val: number) {
        if (typeof val !== "number") {
            throw new TypeError("major value can be only number");
        }
        this._major = Math.ceil(val);
    }

    /**
     * minor part
     */
    private _minor: number;

    get minor(): number {
        return this.minor;
    }

    set minor(val: number) {
        if (typeof val !== "number") {
            throw new TypeError("minor value can be only number");
        }
        this._minor = Math.ceil(val);
    }

    /**
     * Currency spec for formatting
     */
    public spec: Spec;

    private parseImpl(str: string) {
        
    }

    static parse(str: string): Currency {
        return new Currency(str);
    }

    /**
     * Constructor with currency string
     */
    constructor(str: string);
    /**
     * Constructor with currency spec & decimal value
     * @param spec currency spec
     * @param value decimal value
     */
    constructor(spec: Spec, value: number);
    /**
     * Constructor with currency spec & major / minor seperated value
     * @param spec currency spec
     * @param major major part
     * @param minor minor part
     */
    constructor(spec: Spec, major: number, minor?: number);
    constructor(arg1: string | Spec, arg2?: number, arg3?: number) {
        // input is string!
        // parse it!
        if (typeof arg1 === "string") {
            this.parseImpl(arg1);
        } else {
            this.spec = arg1;
            if (arg2 === undefined || arg2 === null) {
                this.major = 0;
                this.minor = 0;
            } else {
                this.major = arg2;
                if (this.spec.minorUnits > 0) {
                    if (arg3 === undefined) {
                        const strfiedValue = arg2.toLocaleString([""], { maximumFractionDigits: this.spec.minorUnits });
                        const fractionPart = strfiedValue.substr(strfiedValue.lastIndexOf(".") + 1);
                        this.minor = parseInt(fractionPart, 10);
                    } else {
                        this.minor = arg3;
                    }
                } else {
                    this.minor = 0;
                }
            }
        }
    }

    toString(withComma?: boolean): string;
    toString(locale?: string, withComma?: boolean): string;
    toString(arg1?: string | boolean, arg2?: boolean): string {
        let locale: string = undefined;
        let withComma: boolean = true;
        if (typeof arg1 === "string") {
            locale = arg1;
            withComma = arg2;
        } else {
            withComma = arg1;
        }
        return `${this.spec.code} ${this.minor.toLocaleString(locale)}`;
    }
}