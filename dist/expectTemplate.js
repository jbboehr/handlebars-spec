"use strict";
/**
 * Copyright (C) 2020 John Boehr
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpectTemplate = void 0;
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
        const args = [errorLike, errMsgMatcher, msg];
        // Look for string
        for (let i = 0; i < args.length; i++) {
            if (args[i] instanceof RegExp) {
                this.exception = args[i];
                this.cb(this);
                delete this.exception; // MEH
                return true;
            }
            else if (typeof args[i] === 'string') {
                this.exception = args[i];
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