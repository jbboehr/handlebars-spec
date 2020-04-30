"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uglify_js_1 = __importDefault(require("uglify-js"));
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
const eval_1 = require("./eval");
const hjson_1 = require("hjson");
const PATCH_FILE = path_1.resolve(__dirname + '/../patch/_functions.hjson');
let functionPatches;
function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}
function isSparseArray(arr) {
    let i = 0;
    const l = arr.length;
    for (; i < l; i++) {
        if (!arr.hasOwnProperty(i)) {
            return true;
        }
    }
    return false;
}
function jsToCode(fn) {
    const str = ('' + fn);
    const key = normalizeJavascript(str);
    let data;
    // Load function patches
    if (!functionPatches) {
        functionPatches = hjson_1.parse(fs_1.readFileSync(PATCH_FILE).toString()) || {};
    }
    if (key in functionPatches) {
        data = {
            '!code': true,
            'javascript': functionPatches[key].javascript,
            'php': functionPatches[key].php,
        };
    }
    else {
        data = {
            '!code': true,
            'javascript': str,
        };
        functionPatches[key] = data;
        // write it out to _functions
        fs_1.writeFileSync(PATCH_FILE, hjson_1.stringify(functionPatches, {
            bracesSameLine: true,
            space: '\t'
        }));
    }
    if (!('php' in data)) {
        console.log('Missing function patch for: ' + JSON.stringify(key) + ' <- ' + JSON.stringify(str));
    }
    // Keep the old function for now, if it's already set...
    if (!data.javascript) {
        //data['javascript'] = str;
    }
    return data;
}
exports.jsToCode = jsToCode;
function normalizeJavascript(js) {
    const str = 'var x = ' + js;
    const r = uglify_js_1.default.minify(str, {
        compress: false,
        mangle: false,
        toplevel: true,
        'keep_fnames': true,
    });
    if (r.error) {
        console.warn(js, str);
        throw new Error(r.error.message);
    }
    else if (r.warnings) {
        console.warn(r.warnings);
    }
    return r.code.replace('var x=', '');
}
exports.normalizeJavascript = normalizeJavascript;
function removeCircularReferences(data, prev = []) {
    if (typeof data !== 'object') {
        return data;
    }
    prev = prev || [];
    prev.push(data);
    function checkCircularRef(v) {
        for (const y in prev) {
            if (v === prev[y]) {
                return true;
            }
        }
        return false;
    }
    for (const x in data) {
        if (checkCircularRef(data[x])) {
            delete data[x];
        }
        else if (typeof data[x] === 'object') {
            removeCircularReferences(data[x]);
        }
    }
    return data;
}
exports.removeCircularReferences = removeCircularReferences;
function stripNulls(data) {
    if (typeof data === 'object') {
        for (const x in data) {
            if (data[x] === null) {
                if (data['!keepnull']) {
                    delete data['!keepnull'];
                }
                else {
                    delete data[x];
                }
            }
            else if (typeof data === 'object') {
                stripNulls(data[x]);
            }
        }
    }
    return data;
}
exports.stripNulls = stripNulls;
function serializeInner(data) {
    switch (typeof data) {
        case 'boolean':
        case 'number':
        case 'string':
            return data;
        default:
        case 'bigint':
        case 'symbol':
            throw new Error('unimplemented');
        case 'function':
            return jsToCode(data);
        case 'undefined':
            return null;
        case 'object':
            // fallthrough
            break;
    }
    // Handle null
    if (data === null) {
        return null;
    }
    // Handle arrays
    if (util_1.isArray(data)) {
        if (isSparseArray(data)) {
            const orv = { '!sparsearray': true };
            Object.keys(data).forEach((key) => {
                orv[key] = data[key];
            });
            return orv;
        }
        else {
            const arv = [];
            data.forEach((value, index) => {
                arv[index] = value;
            });
            return arv;
        }
    }
    // Handle RegExp
    if (data instanceof RegExp) {
        return '' + data;
    }
    // Handle boxed Boolean
    if (data instanceof Boolean) {
        return data.valueOf();
    }
    // Handle objects
    const ignoreEmptyKeys = {
        // 'expected': true,
        'exception': true,
        'compat': true,
        'message': true,
    };
    const ignoreEmptyObjectKeys = {
        'partials': true,
        'helpers': true,
        'decorators': true,
        'compileOptions': true,
        'runtimeOptions': true,
        'globalPartials': true,
        'globalHelpers': true,
        'globalDecorators': true,
    };
    // Recurse
    const rv = {};
    Object.keys(data).forEach((key) => {
        // Ignore some empty objects
        if (ignoreEmptyKeys[key] === true) {
            if (!data[key]) {
                return;
            }
        }
        else if (ignoreEmptyObjectKeys[key] === true) {
            if (!data[key] || (typeof data[key] === 'object' && isEmptyObject(data[key]))) {
                return;
            }
        }
        // serialize and append
        rv[key] = serializeInner(data[key]);
    });
    return rv;
}
function serialize(data) {
    removeCircularReferences(data);
    return serializeInner(data);
}
exports.serialize = serialize;
function deserialize(data) {
    switch (typeof data) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined':
            return data;
        default:
            throw new Error('unimplemented: ' + typeof data);
        case 'object':
            // fallthrough
            break;
    }
    // Handle null
    if (data === null) {
        return null;
    }
    if ('!undefined' in data) {
        return undefined;
    }
    else if ('!code' in data) {
        return eval_1.safeEval(data['javascript']);
    }
    else if ('!sparsearray' in data) {
        const newData = [];
        for (const x in data) {
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
    const rv = {};
    Object.keys(data).forEach((key) => {
        // serialize and append
        rv[key] = deserialize(data[key]);
    });
    return rv;
}
exports.deserialize = deserialize;
//# sourceMappingURL=utils.js.map