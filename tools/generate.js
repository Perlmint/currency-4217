"use strict";
/// <reference path="./typings/index.d.ts"/>
const jsdom_1 = require("jsdom");
const _jquery = require("jquery");
const fetch = require("node-fetch");
const _ = require("lodash");
const fs = require("fs");
const path_1 = require("path");
const iso4217Url = "http://www.currency-iso.org/dam/downloads/lists/list_one.xml";
const symbolUrl = "http://www.xe.com/symbols.php";
function jsdomEnv(config) {
    return new Promise((resolve, reject) => {
        jsdom_1.env(Object.assign(config, {
            done: (err, win) => {
                if (err !== null) {
                    reject(err);
                }
                else {
                    resolve(win);
                }
            }
        }));
    });
}
function jquery(win) {
    return _jquery(win);
}
function getIso4217List(etag) {
    const headers = {};
    if (etag !== undefined) {
        headers["ETag"] = etag;
    }
    return fetch(iso4217Url, { headers })
        .then((resp) => Promise.all([resp.headers["ETag"], resp.text()]))
        .then((data) => Promise.all([data[0], jsdomEnv({
            html: data[1],
            parsingMode: "xml"
        })]))
        .then((data) => {
        const win = data[1];
        const $ = jquery(win);
        return {
            data: _.map($("CcyNtry").toArray(), (val) => {
                const code = $("Ccy", val).text();
                const codeNumber = parseInt($("CcyNbr", val).text(), 10);
                const minorUnit = parseInt($("CcyMnrUnts", val).text(), 10);
                return { code, codeNumber, minorUnit };
            }),
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
            };
        });
    });
}
function main(target) {
    console.log(`Generate Specs to ${target}`);
    new Promise((resolve, reject) => {
        fs.readFile(target, "utf-8", (err, value) => {
            if (err !== null && err !== undefined) {
                // file not found. ignore
                if (err.code === "ENOENT") {
                    const dir = path_1.dirname(target);
                    console.log(`Create directory ${dir} for output`);
                    fs.mkdir(dir, (dErr) => {
                        if (dErr !== null) {
                            reject(dErr);
                        }
                        else {
                            resolve(undefined);
                        }
                    });
                }
                else {
                    reject(err);
                }
            }
            else {
                console.log("Found previous output. read data.");
                try {
                    const etagLine = _.find(value.split("\n"), line => line.startsWith("const etag = "));
                    if (etagLine !== null && etagLine !== undefined) {
                        resolve(eval(etagLine.split(" = ", 2)[1]));
                    }
                    else {
                        reject(new Error("Something is wrong..."));
                    }
                }
                catch (e) {
                    reject(e);
                }
            }
        });
    }).then(etag => Promise.all([getIso4217List(etag), getSymbols()])).then(data => {
        const [iso, symbols] = data;
        _.forEach(symbols, (symbol) => {
            const item = _.find(iso.data, (i) => i.code === symbol.code);
            if (item !== undefined && item !== null) {
                item.symbol = symbol.symbol;
            }
            else {
                console.warn(`Symbol list has ${symbol.code}. but it is not found in ISO4217 list`);
            }
        });
        const wStream = fs.createWriteStream(target, {
            encoding: "utf-8",
            autoClose: true
        });
        wStream.write("import { Spec } from \"../spec\"\n\n");
        wStream.write(`const etag = "${iso.etag}";\n\n`);
        wStream.write("const specs = [\n");
        wStream.write(_.map(iso.data, (item) => {
            let ret = `  new Spec("${item.code}", ${item.codeNumber}, ${item.minorUnit}`;
            if (item.hasOwnProperty("symbol")) {
                ret += `, "${item.symbol}"`;
            }
            return ret + ")";
        }).join(",\n"));
        wStream.write("];\n\n");
        wStream.write("type SpecCode = ");
        wStream.write(_.map(_.chunk(_.map(iso.data, item => `"${item.code}"`), 10), line => line.join(", ")).join(",\n  "));
        wStream.write(";\n\n");
        wStream.write(`export Specs: {
  byCode: {[key:SpecCode]: Spec};
  byCodeNum: {[key:number]: Spec};
} = {
`);
        wStream.write("byCode: specs.filter(function(spec) {spec.})");
        wStream.write("}");
        wStream.close();
    }).catch(e => console.error(e));
}
main(process.argv[1]);
