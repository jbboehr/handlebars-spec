
import UglifyJS from "uglify-js";

var functionPatches: CodeDict;
try {
  functionPatches = require("../patch/_functions.json");
} catch (e) {
  console.warn(e);
}

export function clone(v: any): any {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

export interface CodeData {
  "!code": string;
  "javascript": string;
  "php": string | null;
}

export interface CodeDict {
  [key: string]: CodeData;
};

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
  data['javascript'] = str;
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
