
import UglifyJS from "uglify-js";
import { CodeData, CodeDict } from "./types";

var functionPatches: CodeDict;
try {
    functionPatches = require("../patch/_functions.json");
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
    var data;
    if (key in functionPatches) {
        data = clone(functionPatches[key]);
    } else {
        data = {
            '!code': true
        };
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
