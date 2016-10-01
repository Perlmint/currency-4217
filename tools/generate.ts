/// <reference path="./typings/index.d.ts"/>
import { env, Config } from "jsdom";
import * as _jquery from "jquery";
import * as fetch from "node-fetch";
import * as _ from "lodash";
import * as fs from "fs";
import { dirname } from "path";

const iso4217Url = "http://www.currency-iso.org/dam/downloads/lists/list_one.xml";
const symbolUrl = "http://www.xe.com/symbols.php";

function jsdomEnv(config: Config): Promise<Window> {
    return new Promise<Window>((resolve, reject) => {
        env(Object.assign(config, {
            done: (err, win) => {
                if (err !== null) {
                    reject(err);
                } else {
                    resolve(win);
                }
            }
        }));
    });
}

function jquery(win: Window): JQueryStatic {
    return _jquery(win) as any as JQueryStatic;
}

function getIso4217List(etag?: string): Promise<{
    data: {
        code: string;
        codeNumber: number;
        minorUnit: number;
        symbol?: string;
    }[];
    etag: string;
}> {
    const headers: {[key: string]: string} = {};
    if (etag !== undefined) {
        headers["ETag"] = etag;
    }
    return fetch(iso4217Url, { headers })
        .then((resp) => Promise.all([resp.headers.get("etag"), resp.text()]))
        .then((data) => Promise.all([data[0], jsdomEnv({
            html: data[1],
            parsingMode: "xml"
        })]))
        .then((data) => {
            const win = data[1];
            const $ = jquery(win);
            return {
                data: _.sortedUniqBy(_.sortBy(_.filter(_.map($("CcyNtry").toArray(), (val) => {
                    const code = $("Ccy", val).text();
                    const codeNumber = parseInt($("CcyNbr", val).text(), 10);
                    const minorUnitStr = $("CcyMnrUnts", val).text();
                    const minorUnit = minorUnitStr === "N.A." ? 0 : parseInt(minorUnitStr, 10);
                    return { code, codeNumber, minorUnit };
                }), item => item.code !== ""), "code"), "code"),
                etag: data[0]
            };
        })
        .catch((err) => {
            console.error(err.stack);
        });
}

function getSymbols() {
    return jsdomEnv({
        url: symbolUrl
    }).then((win) => {
        const $ = jquery(win);
        const rows = $(".cSymbl_tbl tr:not(.cSymbl_tbl_subTitle)").toArray();
        return _.map(rows, (row) => {
            return {
                code: $("td:nth-child(2)", row).text().toUpperCase(),
                symbol: $("td.cSmbl_Fnt_AU", row).text()
            }
        });
    });
}

function main(target: string) {
    console.log(`Generate Specs to ${target}`);
    new Promise<string>((resolve, reject) => {
            fs.readFile(target,
                "utf-8",
                (err, value) => {
                    if (err !== null && err !== undefined) {
                        // file not found. ignore
                        if (err.code === "ENOENT") {
                            const dir = dirname(target);
                            console.log(`Create directory ${dir} for output`);
                            fs.mkdir(dir,
                                (dErr) => {
                                    if (dErr !== null && dErr !== undefined && dErr.code !== "EEXIST") {
                                        reject(dErr);
                                    } else {
                                        resolve(undefined);
                                    }
                                });
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log("Found previous output. read data.");
                        try {
                            const etagLine = _.find(value.split("\n"),
                                line =>
                                line.startsWith("const etag = "));
                            if (etagLine !== null && etagLine !== undefined) {
                                resolve(eval(etagLine.split(" = ", 2)[1]));
                            } else {
                                reject(new Error("Something is wrong..."));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
        }).then(etag => Promise.all([getIso4217List(etag), getSymbols()]))
        .then(data => {
            const [iso, symbols] = data;
            _.forEach(symbols,
                (symbol) => {
                    const item = _.find(iso.data, (i) => i.code === symbol.code);
                    if (item !== undefined && item !== null) {
                        item.symbol = symbol.symbol;
                    } else {
                        console.warn(`Symbol list has ${symbol.code}. but it is not found in ISO4217 list`);
                    }
                });
            const wStream = fs.createWriteStream(target,
            {
                encoding: "utf-8"
            });
            wStream.write("import { Spec } from \"../spec\"\n\n");
            wStream.write(`const etag = ${iso.etag};\n\n`);
            wStream.write("const specs = [\n");
            wStream.write(_.map(iso.data,
                    (item) => {
                        let ret = `  new Spec("${item.code}", ${item.codeNumber}, ${item.minorUnit}`;
                        if (item.hasOwnProperty("symbol")) {
                            ret += `, "${item.symbol}"`;
                        }
                        return ret + ")";
                    })
                .join(",\n"));
            wStream.write("];\n\n");

            wStream.write("type SpecCode = ");
            wStream.write(_.map(_.chunk(_.map(iso.data, item => `"${item.code}"`), 10), line => line.join("| "))
                .join("|\n  "));
            wStream.write(";\n\n");

            wStream.write(`export const Specs = {`);
            wStream.write(`
  byCode: function() {
    const ret = new Map<SpecCode, Spec>();
    specs.forEach(function(spec) {
        ret.set(spec.code as SpecCode, spec);
    });
    return ret;
  }(),
  byCodeNum: function() {
    const ret = new Map<number, Spec>();
    specs.forEach(function(spec) {
        ret.set(spec.codeNumber, spec);
    });
    return ret;
  }()
`);
        wStream.write("}");
    }).catch(e => console.error(e));
}

main(process.argv[2]);