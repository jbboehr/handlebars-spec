
import UglifyJS from "uglify-js";
import { CodeData, CodeDict } from "./types";
import { readFileSync, writeFileSync } from "fs";
import { resolve as resolvePath } from "path";
import { isArray } from "util";
import { safeEval } from "./eval";

const PATCH_FILE = resolvePath(__dirname + "/../patch/_functions.json");

var functionPatches: CodeDict;
try {
    functionPatches = require(PATCH_FILE);
} catch (e) {
    console.warn(e);
}

export function clone(v: any): any {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

export function isFunction(obj: any) {
    return Boolean(obj && obj.constructor && obj.call && obj.apply);
}

export function isEmptyObject(obj: object) {
    return !Object.keys(obj).length;
}

export function jsToCode(fn: Function | string): CodeData {
    var str = ('' + fn);
    var key = normalizeJavascript(str);
    var data: CodeData;
    if (key in functionPatches) {
        data = clone(functionPatches[key]);
    } else {
        data = {
            '!code': true,
            'javascript': str,
        };
        functionPatches[key] = data;
        // write it out to _functions
        let tmp = JSON.parse(readFileSync(PATCH_FILE).toString());
        tmp[key] = data;
        writeFileSync(PATCH_FILE, JSON.stringify(tmp, null, '\t'));
    }
    if (!('php' in data)) {
        console.log("Missing function patch for: " + JSON.stringify(key) + " <- " + JSON.stringify(str));
    }
    // Keep the old function for now, if it's already set...
    if (!data.javascript) {
        //data['javascript'] = str;
    }
    return data;
}

export function normalizeJavascript(js: Function | string): string {
    var str = 'var x = ' + js;
    var r = UglifyJS.minify(str, {
        compress: false,
        mangle: false,
        toplevel: true,
        keep_fnames: true,
    });
    if (r.error) {
        console.warn(js, str);
        throw new Error(r.error.message);
    } else if (r.warnings) {
        console.warn(r.warnings);
    }
    return r.code.replace("var x=", "");
}

export function removeCircularReferences(data: any, prev: any[] = []): any {
    if (typeof data !== 'object') {
        return data;
    }

    prev = prev || [];
    prev.push(data);

    function checkCircularRef(v: any) {
        for (var y in prev) {
            if (v === prev[y]) {
                return true;
            }
        }
        return false;
    }

    for (const x in data) {
        if (checkCircularRef(data[x])) {
            delete data[x];
        } else if (typeof data[x] === 'object') {
            removeCircularReferences(data[x]);
        }
    }

    return data;
}

export function stringifyLambdas(data: any): any {
    if (typeof data !== 'object') {
        return data;
    }

    for (var x in data) {
        if (data[x] instanceof Array) {
            stringifyLambdas(data[x]);
        } else if (typeof data[x] === 'function' || data[x] instanceof Function) {
            data[x] = jsToCode(data[x]);
        } else if (typeof data[x] === 'object') {
            stringifyLambdas(data[x]);
        }
    }

    return data;
}

export function stripNulls(data: any): any {
    if (typeof data === 'object') {
        for (var x in data) {
            if (data[x] === null) {
                if (data['!keepnull']) {
                    delete data['!keepnull'];
                } else {
                    delete data[x];
                }
            } else if (typeof data === 'object') {
                stripNulls(data[x]);
            }
        }
    }

    return data;
}

function serializeInner(data: any, ctx: any): any {
    switch (typeof data) {
        case "boolean":
        case "number":
        case "string":
            return data;

        default:
        case "bigint":
        case "symbol":
            throw new Error("unimplemented");

        case "function":
            return jsToCode(data);

        case "undefined":
            return null;
            /*
            if (ctx.key === "input" || ctx.key === "data") {
                return {
                    "!undefined": true,
                };
            }
            return undefined;
            */

        case "object":
            // fallthrough
            break;
    }

    // Handle null
    if (data === null) {
        return null;
    }

    // Handle arrays
    if (isArray(data)) {
        var arv: any[] = [];
        data.forEach((value, index) => {
            arv[index] = value;
        });
        return arv;
    }

    // Handle RegExp
    if (data instanceof RegExp) {
        return '' + data;
    }

    // Handle objects
    const ignoreEmptyObjectKeys: {[key: string]: true} = {
        'partials': true,
        'helpers': true,
        'decorators': true,
        'compileOptions': true,
        'runtimeOptions': true,
        'globalPartials': true,
        'globalHelpers': true,
        'globalDecorators': true,
        'compat': true,
        'message': true,
    };

    // Recurse
    var rv: any = {};
    Object.keys(data).forEach((key) => {
        // Ignore some empty objects
        if (ignoreEmptyObjectKeys[key] === true && (!data[key] || (typeof data[key] === "object" && isEmptyObject(data[key])))) {
            return;
        } else if (key === 'exception' && !data[key]) {
            return;
        }
        // serialize and append
        rv[key] = serializeInner(data[key], {
            key,
        });
    });
    return rv;
}

export function serialize(data: any): any {
    removeCircularReferences(data);
    return serializeInner(data, {});
}

export function deserialize(data: any): any {
    switch (typeof data) {
        case "boolean":
        case "number":
        case "string":
        case "undefined":
            return data;

        default:
            throw new Error("unimplemented: " + typeof data);

        case "object":
            // fallthrough
            break;
    }

    // Handle null
    if (data === null) {
        return null;
    }

    if ("!undefined" in data) {
        return undefined;
    } else if ("!code" in data) {
        return safeEval(data['javascript']);
    } else if ("!sparsearray" in data) {
        let newData = [];
        for (let x in data) {
            let i;
            if (data.hasOwnProperty(x)) {
                if (!isNaN(i = parseInt(x))) {
                    newData[i] = data[x];
                }
            }
        }
        return newData;
    }

    // Recurse
    var rv: any = {};
    Object.keys(data).forEach((key) => {
        // serialize and append
        rv[key] = deserialize(data[key]);
    });
    return rv;
}