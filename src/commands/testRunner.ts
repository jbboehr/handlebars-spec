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

import { Command, ExpectedError, command, param } from 'clime';
import * as Handlebars from 'handlebars';
import { safeEval } from '../eval';
import { deserialize, hasExceptionExpectation } from '../utils';
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
        const successes: TestSpec[] = [];
        const failures: TestSpec[] = [];
        let dir = '.';

        function runSpec(spec: string): void {
            const tmp = spec.replace(/\.json$/, '').split('/');
            const suite = tmp[tmp.length - 1];
            const kind = getSuiteKind(suite);
            const data: TestSpec[] = JSON.parse(readFileSync(resolvePath(dir, spec)).toString());
            Object.values(data).forEach(function (fixture) {
                // The suite filename supplies the kind for the trusted fixture JSON.
                const test = { kind, fixture } as LoadedFixture;
                if (runTest(test, suite)) {
                    successes.push(fixture);
                } else {
                    failures.push(fixture);
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
        console.log('Skipped: 0');

        if (successes.length === 0 && failures.length === 0) {
            console.error('No fixtures were run. Check the selected fixture file or spec directory.');
            process.exit(2);
        }
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

function unstringifyHelpers(helpers: SerializedHelperMap | undefined): { [key: string]: Function | undefined } {
    if (!helpers || helpers === null || typeof helpers !== 'object') {
        return {};
    }
    const ret: { [key: string]: Function | undefined } = {};
    Object.keys(helpers).forEach(function (x) {
        const helper = helpers[x];
        ret[x] = safeEval(typeof helper === 'string' ? undefined : helper.javascript);
    });
    return ret;
}

// Test utils

interface PreparedTest<Expected = string | HandlebarsToken[]> {
    prefix: string;
    template: string;
    expected?: Expected;
    exception?: TestSpec['exception'] | false;
    message?: string;
}

// These legacy fields are still read by the runner but are not emitted by generation.
interface GlobalRegistrations {
    globalHelpers?: CodeDict;
    globalPartials?: TestSpec['partials'];
    globalDecorators?: CodeDict;
}

interface PreparedRenderingTest extends PreparedTest<string>, GlobalRegistrations {
    data?: unknown;
    helpers?: { [key: string]: Function | undefined };
    decorators?: { [key: string]: Function | undefined };
    partials?: { [key: string]: unknown };
    runtimeOptions?: { [key: string]: unknown };
    options?: { [key: string]: unknown };
    compileOptions?: CompileOptions;
    compat?: boolean;
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

function exceptionMatches(expected: unknown, error: unknown): boolean {
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

function checkResult(test: PreparedTest, didExcept: boolean, e?: unknown): boolean {
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

function checkAssertion(test: PreparedTest, assertion: () => void): boolean {
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

function makePrefix(test: TestSpec, suite: string): string {
    return suite + ' | ' + test.description + ' - ' + test.it + ' - ' + test.number;
}

function prepareTestGeneric(test: RenderingFixture & GlobalRegistrations, suite: string): PreparedRenderingTest {
    const spec: PreparedRenderingTest = {
        prefix: makePrefix(test, suite),
        template: test.template,
    };
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    // Data
    spec.data = deserialize(test.data);
    // Helpers
    spec.helpers = unstringifyHelpers(test.helpers);
    spec.globalHelpers = test.globalHelpers || undefined;
    // Partials
    if (test.partials) {
        spec.partials = Object.fromEntries(Object.entries(test.partials)
            .map(([name, partial]) => [name, deserialize(partial)]));
    }
    spec.globalPartials = test.globalPartials || undefined;
    // Decorators
    spec.decorators = unstringifyHelpers(test.decorators);
    spec.globalDecorators = test.globalDecorators || undefined;
    // Options
    spec.runtimeOptions = deserialize(test.runtimeOptions);
    spec.compileOptions = test.compileOptions;
    if (spec.options && typeof spec.options.data === 'object') {
        spec.options.data = deserialize(spec.options.data);
    }
    // Compat
    spec.compat = Boolean(test.compat);
    return spec;
}

function prepareTestParser(test: ParserFixture, suite: string): PreparedTest<string> {
    const spec: PreparedTest<string> = {
        prefix: makePrefix(test, suite),
        template: test.template,
    };
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    // Message
    spec.message = test.message;
    return spec;
}

function prepareTestTokenizer(test: TokenizerFixture, suite: string): PreparedTest<HandlebarsToken[]> {
    const spec: PreparedTest<HandlebarsToken[]> = {
        prefix: makePrefix(test, suite),
        template: test.template,
    };
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception === undefined ? false : test.exception;
    return spec;
}

function getSuiteKind(suite: string): LoadedFixture['kind'] {
    switch (suite) {
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
        return 'render';
    case 'parser':
        return 'parser';
    case 'tokenizer':
        return 'tokenizer';
    default:
        throw new ExpectedError('Unsupported fixture suite ' + JSON.stringify(suite)
            + '. Use a supported suite filename such as basic.json, parser.json, or tokenizer.json', 2);
    }
}

function runTest(test: LoadedFixture, suite: string): boolean {
    switch (test.kind) {
    case 'render':
        return runTestGeneric(prepareTestGeneric(test.fixture, suite));
    case 'parser':
        return runTestParser(prepareTestParser(test.fixture, suite));
    case 'tokenizer':
        return runTestTokenizer(prepareTestTokenizer(test.fixture, suite));
    }
}

function runTestGeneric(test: PreparedRenderingTest): boolean {
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

function runTestParser(test: PreparedTest<string>): boolean {
    let actual;
    try {
        actual = astFor(test.template);
    } catch (e) {
        return checkResult(test, true, e);
    }

    return checkAssertion(test, () => assert.equal(actual, test.expected));
}

function runTestTokenizer(test: PreparedTest<HandlebarsToken[]>): boolean {
    let actual;
    try {
        actual = tokenize(test.template);
    } catch (e) {
        return checkResult(test, true, e);
    }

    return checkAssertion(test, () => assert.deepEqual(actual, test.expected));
}
