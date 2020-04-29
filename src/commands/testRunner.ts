
import { Command, command, param } from 'clime';
import * as Handlebars from 'handlebars';
import { safeEval } from '../eval';
import { isArray } from 'util';
import { serialize } from '../utils';
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
require('../../handlebars.js/spec/env/common.js');



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
    if (!helpers || helpers === null || typeof helpers !== "object") {
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
        if (isArray(data[x])) {
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

function fixSparseArray(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    let x, i;

    if ('!sparsearray' in data) {
        const newData = [];
        for (x in data) {
            if (data.hasOwnProperty(x)) {
                if (!isNaN(i = parseInt(x))) {
                    newData[i] = data[x];
                }
            }
        }
        data = newData;
    } else {
        for (x in data) {
            if (data.hasOwnProperty(x)) {
                data[x] = fixSparseArray(data[x]);
            }
        }
    }

    return data;
}



// Test utils

function checkResult(test: any, e?: Error): boolean {
    const shouldExcept = test.exception === true;
    const didExcept = e !== undefined;
    if (shouldExcept === didExcept) {
        console.log(test.prefix, '|', 'OK');
        return true;
    } else {
        const msg = e || 'Error: should have thrown, did not';
        console.log(test.prefix, '|', 'FAIL');
        console.log(msg);
        if (e) {
            console.error(e.stack);
        }
        console.error(require('util').inspect(serialize(test), false, null, true));
        return false;
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
    spec.exception = test.exception ? true : false;
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
    spec.exception = test.exception ? true : false;
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

        const actual = template(test.data, test.runtimeOptions);
        equals(actual, test.expected);

        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}

function runTestParser(test: any): boolean {
    try {
        const actual = astFor(test.template);
        assert.equal(actual, test.expected);
        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}

function runTestTokenizer(test: any): boolean {
    try {
        const actual = tokenize(test.template);
        assert.deepEqual(actual, test.expected);
        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}


