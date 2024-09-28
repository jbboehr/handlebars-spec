/**
 * Copyright (c) anno Domini nostri Jesu Christi MMXX-MMXXIV John Boehr & contributors
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

import { RuntimeOptions } from 'handlebars';

export class ExpectTemplate implements ExpectTemplateInterface {
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

    withHelper(name: string, helper: Function | string): ExpectTemplate {
        this.helpers[name] = helper;
        return this;
    }

    withHelpers(helpers: FunctionDict): ExpectTemplate {
        Object.keys(helpers).forEach((name) => {
            this.withHelper(name, helpers[name]);
        });
        return this;
    }

    withPartial(name: string, partial: string): ExpectTemplate {
        this.partials[name] = partial;
        return this;
    }

    withPartials(partials: StringDict): ExpectTemplate {
        Object.keys(partials).forEach((name) => {
            this.withPartial(name, partials[name]);
        });
        return this;
    }

    withDecorator(name: string, decorator: Function | string): ExpectTemplate {
        this.decorators[name] = decorator;
        return this;
    }

    withDecorators(decorators: FunctionDict): ExpectTemplate {
        Object.keys(decorators).forEach((name) => {
            this.withDecorator(name, decorators[name]);
        });
        return this;
    }

    withMessage(message: string): ExpectTemplate {
        this.message = message;
        return this;
    }

    withInput(input: any): ExpectTemplate {
        this.input = input;
        return this;
    }

    withCompileOptions(compileOptions: CompileOptions): ExpectTemplate {
        this.compileOptions = compileOptions;
        return this;
    }

    withRuntimeOptions(runtimeOptions: RuntimeOptions): ExpectTemplate {
        this.runtimeOptions = runtimeOptions;
        return this;
    }

    toCompileTo(expected: any): boolean {
        this.expected = expected;
        this.cb(this);
        delete this.expected; // MEH
        return true;
    }

    toThrow(errorLike: any, errMsgMatcher: any, msg?: any): boolean {
        const args = [errorLike, errMsgMatcher, msg];

        // Look for string
        for( let i = 0; i < args.length; i++ ) {
            if (args[i] instanceof RegExp) {
                this.exception = args[i];
                this.cb(this);
                delete this.exception; // MEH
                return true;
            } else if (typeof args[i] === 'string') {
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

    toJSON(): ExpectTemplateInterface {
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
