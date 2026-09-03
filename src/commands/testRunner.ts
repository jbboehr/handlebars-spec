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

import { Command, command, param } from 'clime';
import * as Handlebars from 'handlebars';
import { safeEval } from '../eval';
import { inspect } from 'util';
import { resolve as resolvePath } from 'path';
import { readdirSync, readFileSync } from 'fs';
import * as assert from 'assert';



// Patch globals
const handlebarsEnv = Handlebars;
(global as any).Handlebars = Handlebars;
(global as any).handlebarsEnv = handlebarsEnv;

(global as any).CompilerContext = { // borrowed from spec/env/node.js
    compile(template: string, options?: any): Function {
        const templateSpec = (global as any).handlebarsEnv.precompile(template, options);
        return handlebarsEnv.template(safeEval(templateSpec));
    },
    compileWithPartial(template: string, options?: any): Function {
        return handlebarsEnv.compile(template, options);
    }
};
require('../../handlebars.js/spec/env/common');



@command({
    description: 'This runs the spec json files against handlebars to test them',
    })
export default class extends Command {
    execute(
        @param({
            name: 'Input file',
            required: false,
        })
            inputFile?: string,
    ): void {
        const successes = [];
        const failures = [];
        const skipped = [];
        let dir = '.';

        function runSpec(spec: string): void {
            const tmp = spec.replace(/\.json$/, '').split('/');
            const suite = tmp[tmp.length - 1];
            const data = JSON.parse(readFileSync(resolvePath(dir + '/' + spec)).toString());
            Object.keys(data).forEach(function (y) {
                data[y].suite = suite;
                const result = runTest(data[y]);
                if (result === null) {
                    skipped.push(data[y]);
                } else if (result === true) {
                    successes.push(data[y]);
                } else {
                    failures.push(data[y]);
                }
            });
        }

        if (inputFile) {
            runSpec(inputFile);
        } else {
            dir = resolvePath('./spec/');
            const specs = readdirSync(dir);

            Object.values(specs).forEach(runSpec);
        }

        console.log('Summary');
        console.log('Success: ' + successes.length);
        console.log('Failed: ' + failures.length);
        console.log('Skipped: ' + skipped.length);

        process.exit(failures.length ? 2 : 0);
    }

}

function astFor(template: string): string { // borrowed from spec/parser.js
    const ast = Handlebars.parse(template);
    return (Handlebars as any).print(ast);
}

function tokenize(template: string): HandlebarsToken[] { // borrowed from spec/tokenizer.js
    const parser = (Handlebars as any).Parser,
        lexer = parser.lexer;

    lexer.setInput(template);
    const out: HandlebarsToken[] = [];

    for (; ;) {
        const token = lexer.lex();
        if (!token) {
            break;
        }
        const result = parser.terminals_[token] || token;
        if (!result || result === 'EOF' || result === 'INVALID') {
            break;
        }
        out.push({ name: result, text: lexer.yytext } as HandlebarsToken);
    }

    return out;
}

function unstringifyHelpers(helpers: any): FunctionDict {
    if (!helpers || helpers === null || typeof helpers !== 'object') {
        return {};
    }
    const ret: { [key: string]: any } = {};
    Object.keys(helpers).forEach(function (x) {
        ret[x] = safeEval(helpers[x].javascript);
    });
    return ret;
}

function unstringifyLambdas(data: any): any {
    if (!data || data === null) {
        return data;
    }
    for (const x in data) {
        if (Array.isArray(data[x])) {
            unstringifyLambdas(data[x]);
        } else if (typeof data[x] === 'object' && data[x] !== null) {
            if ('!code' in data[x]) {
                data[x] = safeEval(data[x].javascript);
            } else {
                unstringifyLambdas(data[x]);
            }
        }
    }
    return data;
}

function hasOwn(data: object, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(data, key);
}

function isArrayIndex(key: string): boolean {
    const index = Number(key);
    return Number.isInteger(index)
        && index >= 0
        && index < 0xffffffff
        && String(index) === key;
}

function sparseArrayLength(data: any): number {
    if (!hasOwn(data, '!length')) {
        return 0;
    }

    const length = data['!length'];
    return typeof length === 'number'
        && Number.isInteger(length)
        && length >= 0
        && length <= 0xffffffff
        ? length
        : 0;
}

function fixSparseArray(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    if (hasOwn(data, '!sparsearray')) {
        const newData = new Array(sparseArrayLength(data));
        Object.keys(data).forEach((key) => {
            if (!isArrayIndex(key)) {
                return;
            }

            Object.defineProperty(newData, Number(key), {
                configurable: true,
                enumerable: true,
                value: fixSparseArray(data[key]),
                writable: true,
            });
        });
        data = newData;
    } else {
        Object.keys(data).forEach((key) => {
            data[key] = fixSparseArray(data[key]);
        });
    }

    return data;
}



// Test utils

function hasExceptionExpectation(expected: any): boolean {
    return expected === true || typeof expected === 'string';
}

function exceptionMessage(error: unknown): string | undefined {
    try {
        if (typeof error === 'string') {
            return error;
        }
        if (error !== null && (typeof error === 'object' || typeof error === 'function') && 'message' in error) {
            return String((error as { message: unknown }).message);
        }

        return String(error);
    } catch {
        return undefined;
    }
}

function exceptionMatches(expected: any, error: unknown): boolean {
    if (expected === true) {
        return true;
    }
    if (typeof expected !== 'string') {
        return false;
    }

    const message = exceptionMessage(error);
    if (message === undefined) {
        return false;
    }

    const serializedRegExp = expected.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
    if (!serializedRegExp) {
        return message.includes(expected);
    }

    try {
        return new RegExp(serializedRegExp[1], serializedRegExp[2]).test(message);
    } catch {
        return false;
    }
}

function checkResult(test: any, didExcept: boolean, e?: unknown): boolean {
    const shouldExcept = hasExceptionExpectation(test.exception);
    const passed = shouldExcept
        ? didExcept && exceptionMatches(test.exception, e)
        : !didExcept;
    if (passed) {
        console.log(test.prefix, '|', 'OK');
        return true;
    } else {
        let msg = didExcept
            ? e instanceof Error ? e : 'Error: unexpected thrown value'
            : 'Error: should have thrown, did not';
        if (shouldExcept && didExcept) {
            msg = 'Error: exception did not match ' + JSON.stringify(test.exception);
        }
        console.log(test.prefix, '|', 'FAIL');
        console.log(msg);
        if (e instanceof Error) {
            console.error(e.stack);
        } else if (didExcept) {
            console.error(inspect(e, false, null, true));
        }
        console.error(inspect(test, false, null, true));
        return false;
    }
}

function checkAssertion(test: any, assertion: () => void): boolean {
    if (hasExceptionExpectation(test.exception)) {
        return checkResult(test, false);
    }

    try {
        assertion();
        return checkResult(test, false);
    } catch (e) {
        return checkResult(test, true, e);
    }
}

function makePrefix(test: any): string {
    return (test.suite) + ' | ' + test.description + ' - ' + test.it + ' - ' + test.number;
}

function prepareTestGeneric(test: any): any {
    const spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    // Data
    spec.data = fixSparseArray(test.data);
    unstringifyLambdas(spec.data);
    // Helpers
    spec.helpers = unstringifyHelpers(test.helpers);
    spec.globalHelpers = test.globalHelpers || undefined;
    // Partials
    spec.partials = test.partials;
    unstringifyLambdas(spec.partials);
    spec.globalPartials = test.globalPartials || undefined;
    // Decorators
    spec.decorators = unstringifyHelpers(test.decorators);
    spec.globalDecorators = test.globalDecorators || undefined;
    // Options
    spec.runtimeOptions = unstringifyLambdas(test.runtimeOptions);
    spec.compileOptions = test.compileOptions;
    if (spec.options && typeof spec.options.data === 'object') {
        unstringifyLambdas(spec.options.data);
    }
    // Compat
    spec.compat = Boolean(test.compat);
    return spec;
}

function prepareTestParser(test: any): any {
    const spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    // Message
    spec.message = test.message;
    return spec;
}

function prepareTestTokenizer(test: any): any {
    const spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    return spec;
}

function runTest(test: any): boolean | null {
    let result = null;
    switch (test.suite) {
    case 'basic':
    case 'bench':
    case 'blocks':
    case 'builtins':
    case 'data':
    case 'helpers':
    case 'partials':
    case 'regressions':
    case 'strict':
    case 'string-params':
    case 'subexpressions':
    case 'track-ids':
    case 'whitespace-control':
        result = runTestGeneric(prepareTestGeneric(test));
        break;
    case 'parser':
        result = runTestParser(prepareTestParser(test));
        break;
    case 'tokenizer':
        result = runTestTokenizer(prepareTestTokenizer(test));
        break;
    }
    return result;
}

function runTestGeneric(test: any): boolean {
    const handlebarsEnv = (global as any).handlebarsEnv;
    const CompilerContext = (global as any).CompilerContext;
    const equals = (global as any).equals;
    (global as any).value = 1; // for helpers - block params - should take presednece over parent block params - 00
    (global as any).lastOptions = undefined; // for subexpressions - provides each nested helper invocation its own options hash - 00
    (global as any).run = false; // for blocks - decorators - should fail when accessing variables from root - 00

    let actual;
    try {
        // Register global partials
        handlebarsEnv.partials = {};
        // Object.keys(test.globalPartials || {}).forEach(function (x) {
        //     handlebarsEnv.registerPartial(x, test.globalPartials[x]);
        // });

        // // Register global helpers
        // Object.keys(test.globalHelpers || {}).forEach(function (x) {
        //     handlebarsEnv.registerHelper(x, safeEval(test.globalHelpers[x].javascript));
        // });

        // // Register global decorators
        // Object.keys(test.globalDecorators || {}).forEach(function (x) {
        //     handlebarsEnv.registerDecorator(x, safeEval(test.globalDecorators[x].javascript));
        // });

        // Execute
        const hasPartials = typeof test.partials === 'object' && Object.keys(test.partials).length > 0;
        const template = CompilerContext[hasPartials ? 'compileWithPartial' : 'compile'](test.template, test.compileOptions);
        const runtimeOptions = test.runtimeOptions || test.options || {};
        //opts.data = typeof test.data === 'string' ? [test.data] : test.data; // le sigh
        if (test.helpers) {
            runtimeOptions.helpers = test.helpers;
        }
        if (test.partials) {
            runtimeOptions.partials = test.partials;
        }
        if (test.decorators) {
            runtimeOptions.decorators = test.decorators;
        }
        test.runtimeOptions = runtimeOptions;

        actual = template(test.data, test.runtimeOptions);
    } catch (e) {
        return checkResult(test, true, e);
    }

    return checkAssertion(test, () => equals(actual, test.expected));
}

function runTestParser(test: any): boolean {
    let actual;
    try {
        actual = astFor(test.template);
    } catch (e) {
        return checkResult(test, true, e);
    }

    return checkAssertion(test, () => assert.equal(actual, test.expected));
}

function runTestTokenizer(test: any): boolean {
    let actual;
    try {
        actual = tokenize(test.template);
    } catch (e) {
        return checkResult(test, true, e);
    }

    return checkAssertion(test, () => assert.deepEqual(actual, test.expected));
}
