#!/usr/bin/env node

"use strict";

import program from "commander";
import fs from "fs";
import pkg from "../package.json";
import {normalizeJavascript, CodeData} from "../src/utils";

program
  .version(pkg.version)
  .usage('[options] <file ...>')
  .parse(process.argv);

let fns: {[key: string]: CodeData} = {};

function extract(data: any): void {
  if (typeof data !== "object" || !data) {
    return;
  }

  if (data.hasOwnProperty("!code")) {
    var js = data['javascript'];
    if (!js) {
      console.warn('js key not set');
      return;
    }
    var key = normalizeJavascript(js);
    if (key in fns) {
      console.warn('key already set', key, fns[key], data);
    }
    fns[key] = data;
  }

  for (var x in data) {
    if(data.hasOwnProperty(x)) {
      extract(data[x]);
    }
  }
}

function main() {

  for (var i = 0; i < program.args.length; i++) {
    var filestr = fs.readFileSync(program.args[i]);
    var data = JSON.parse(filestr.toString());
    extract(data);
  }

  process.stdout.write(JSON.stringify(fns, null, '\t'));
}

main();
