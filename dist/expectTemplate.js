"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExpectTemplate {
    constructor(template, cb) {
        this.helpers = {};
        this.partials = {};
        this.decorators = {};
        this.template = template;
        this.input = {};
        this.cb = cb;
    }
    withHelper(name, helper) {
        this.helpers[name] = helper;
        return this;
    }
    withHelpers(helpers) {
        Object.keys(helpers).forEach((name) => {
            this.withHelper(name, helpers[name]);
        });
        return this;
    }
    withPartial(name, partial) {
        this.partials[name] = partial;
        return this;
    }
    withPartials(partials) {
        Object.keys(partials).forEach((name) => {
            this.withPartial(name, partials[name]);
        });
        return this;
    }
    withDecorator(name, decorator) {
        this.decorators[name] = decorator;
        return this;
    }
    withDecorators(decorators) {
        Object.keys(decorators).forEach((name) => {
            this.withDecorator(name, decorators[name]);
        });
        return this;
    }
    withMessage(message) {
        this.message = message;
        return this;
    }
    withInput(input) {
        this.input = input;
        return this;
    }
    withCompileOptions(compileOptions) {
        this.compileOptions = compileOptions;
        return this;
    }
    withRuntimeOptions(runtimeOptions) {
        this.runtimeOptions = runtimeOptions;
        return this;
    }
    toCompileTo(expected) {
        this.expected = expected;
        this.cb(this);
        delete this.expected; // MEH
        return true;
    }
    toThrow(errorLike, errMsgMatcher, msg) {
        // Look for string
        for (let i = 0; i < arguments.length; i++) {
            if (arguments[i] instanceof RegExp) {
                this.exception = arguments[i];
                this.cb(this);
                delete this.exception; // MEH
                return true;
            }
            else if (typeof arguments[i] === "string") {
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
    toJSON() {
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
        };
    }
}
exports.ExpectTemplate = ExpectTemplate;
//# sourceMappingURL=expectTemplate.js.map