
"use strict";

import { FunctionDict, StringDict, IExpectTemplate } from "./types";
import { RuntimeOptions } from "handlebars";

export class ExpectTemplate implements IExpectTemplate {
    template: string;
    helpers: FunctionDict = {};
    partials: StringDict = {};
    decorators: FunctionDict = {};
    cb: Function;
    input: any;
    expected: any;
    message?: string;
    compileOptions?: CompileOptions;
    runtimeOptions?: RuntimeOptions;
    exception?: true | string | RegExp;

    constructor(template: string, cb: Function) {
        this.template = template;
        this.input = {};
        this.cb = cb;
    }

    withHelper(name: string, helper: Function | string) {
        this.helpers[name] = helper;
        return this;
    }

    withHelpers(helpers: FunctionDict) {
        Object.keys(helpers).forEach((name) => {
            this.withHelper(name, helpers[name]);
        });
        return this;
    }

    withPartial(name: string, partial: string) {
        this.partials[name] = partial;
        return this;
    }

    withPartials(partials: StringDict) {
        Object.keys(partials).forEach((name) => {
            this.withPartial(name, partials[name]);
        });
        return this;
    }

    withDecorator(name: string, decorator: Function | string) {
        this.decorators[name] = decorator;
        return this;
    }

    withDecorators(decorators: FunctionDict) {
        Object.keys(decorators).forEach((name) => {
            this.withDecorator(name, decorators[name]);
        });
        return this;
    }

    withMessage(message: string) {
        this.message = message;
        return this;
    }

    withInput(input: any) {
        this.input = input;
        return this;
    }

    withCompileOptions(compileOptions: CompileOptions) {
        this.compileOptions = compileOptions;
        return this;
    }

    withRuntimeOptions(runtimeOptions: RuntimeOptions) {
        this.runtimeOptions = runtimeOptions;
        return this;
    }

    toCompileTo(expected: any) {
        this.expected = expected;
        this.cb(this);
        delete this.expected; // MEH
        return true;
    }

    toThrow(errorLike: any, errMsgMatcher: any, msg: any) {
        // Look for string
        for( let i = 0; i < arguments.length; i++ ) {
            if (arguments[i] instanceof RegExp) {
                this.exception = arguments[i];
                this.cb(this);
                delete this.exception; // MEH
                return true;
            } else if (typeof arguments[i] === "string") {
                this.exception = arguments[i];
                this.cb(this);
                delete this.exception; // MEH
                return true;
            }
        }

        this.exception = true;
        this.cb(this);
        delete this.exception; // MEH
        return true;
    }

    toJSON(): IExpectTemplate {
        return {
            template: this.template,
            helpers: this.helpers,
            partials: this.partials,
            decorators: this.decorators,
            input: this.input,
            expected: this.expected,
            message: this.message,
            compileOptions: this.compileOptions,
            runtimeOptions: this.runtimeOptions,
            exception: this.exception,
        }
    }
}
