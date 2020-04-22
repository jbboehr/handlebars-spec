
"use strict";

import { FunctionDict } from "./types";

export class ExpectTemplate {
    template: string;
    helpers: FunctionDict = {};
    cb: Function;
    input: any;
    expected: any;

    constructor(template: string, cb: Function) {
        this.template = template;
        this.cb = cb;
    }

    withHelper(name: string, helper: Function) {
        this.helpers[name] = helper;
        return this;
    }

    withInput(input: any) {
        this.input = input;
        return this;
    }

    toCompileTo(expected: any) {
        this.expected = expected;
        this.cb(this);
        return true;
    }
}
