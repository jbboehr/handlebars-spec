import { Command, command, param } from 'clime';
import * as Handlebars from "handlebars";
import { safeEval } from '../eval';
import { isArray } from 'util';
import { clone } from '../utils';
import { resolve as resolvePath } from "path";
import { readdirSync } from 'fs';
import * as assert from "assert";



// Patch globals
let handlebarsEnv = Handlebars;
(global as any).Handlebars = Handlebars;
(global as any).handlebarsEnv = handlebarsEnv;

(global as any).CompilerContext = { // borrowed from spec/env/node.js
    compile: function (template: string, options?: any) {
        var templateSpec = (global as any).handlebarsEnv.precompile(template, options);
        return handlebarsEnv.template(safeEval(templateSpec));
    },
    compileWithPartial: function (template: string, options?: any) {
        return handlebarsEnv.compile(template, options);
    }
};
require('../../handlebars.js/spec/env/common.js');

// Sigh - not sure why this isn't working right (for builtins #each)
Handlebars.registerHelper('detectDataInsideEach', function (options) {
    return options.data && options.data.exclaim;
});



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
    ) {
        var successes = [];
        var failures = [];
        var skipped = [];
        var dir = '.';

        function runSpec(spec: string) {
            var tmp = spec.replace(/\.json$/, '').split("/");
            var suite = tmp[tmp.length - 1];
            var data = require(resolvePath(dir + '/' + spec));
            Object.keys(data).forEach(function (y) {
                data[y].suite = suite;
                var result = runTest(data[y]);
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
            var specs = readdirSync(dir);

            Object.values(specs).forEach(runSpec);
        }

        console.log('Summary');
        console.log('Success: ' + successes.length);
        console.log('Failed: ' + failures.length);
        console.log('Skipped: ' + skipped.length);

        process.exit(failures.length ? 2 : 0);
    }

}

function astFor(template: string) { // borrowed from spec/parser.js
    var ast = Handlebars.parse(template);
    return (Handlebars as any).print(ast);
}

function tokenize(template: string) { // borrowed from spec/tokenizer.js
    var parser = (Handlebars as any).Parser,
        lexer = parser.lexer;

    lexer.setInput(template);
    var out = [];

    for (; ;) {
        var token = lexer.lex();
        if (!token) {
            break;
        }
        var result = parser.terminals_[token] || token;
        if (!result || result === 'EOF' || result === 'INVALID') {
            break;
        }
        out.push({ name: result, text: lexer.yytext });
    }

    return out;
}

function unstringifyHelpers(helpers: any) {
    if (!helpers || helpers === null) {
        return;
    }
    var ret: { [key: string]: any } = {};
    Object.keys(helpers).forEach(function (x) {
        ret[x] = safeEval(helpers[x].javascript);
    });
    return ret;
}

function unstringifyLambdas(data: any) {
    if (!data || data === null) {
        return data;
    }
    for (var x in data) {
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

function fixSparseArray(data: any) {
    if (!data || typeof data !== 'object') {
        return data;
    }

    var x, i;

    if ('!sparsearray' in data) {
        var newData = [];
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

function checkResult(test: any, e?: Error) {
    var shouldExcept = test.exception === true;
    var didExcept = e !== undefined;
    if (shouldExcept === didExcept) {
        console.log(test.prefix + 'OK');
        return true;
    } else {
        var msg = e || 'Error: should have thrown, did not';
        console.log(test.prefix + msg);
        if (e) {
            console.error(e.stack);
        }
        console.error('Test Data: ', test);
        return false;
    }
}

function makePrefix(test: any) {
    return '(' + test.suite + ' - ' + test.it + ' - ' + test.description + '): ';
}

function prepareTestGeneric(test: any) {
    var spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception ? true : false;
    // Data
    spec.data = fixSparseArray(clone(test.data));
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
    spec.options = clone(test.options);
    spec.compileOptions = clone(test.compileOptions);
    if (spec.options && typeof spec.options.data === 'object') {
        unstringifyLambdas(spec.options.data);
    }
    // Compat
    spec.compat = Boolean(test.compat);
    return spec;
}

function prepareTestParser(test: any) {
    var spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = clone(test.expected);
    // Exception
    spec.exception = test.exception ? true : false;
    // Message
    spec.message = test.message;
    return spec;
}

function prepareTestTokenizer(test: any) {
    var spec: any = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = clone(test.expected);
    return spec;
}

function runTest(test: any) {
    var result = null;
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

function runTestGeneric(test: any) {
    let handlebarsEnv = (global as any).handlebarsEnv;
    let CompilerContext = (global as any).CompilerContext;
    let equals = (global as any).equals;

    try {
        // Register global partials
        handlebarsEnv.partials = {};
        Object.keys(test.globalPartials || {}).forEach(function (x) {
            handlebarsEnv.registerPartial(x, test.globalPartials[x]);
        });

        // Register global helpers
        Object.keys(test.globalHelpers || {}).forEach(function (x) {
            handlebarsEnv.registerHelper(x, safeEval(test.globalHelpers[x].javascript));
        });

        // Register global decorators
        Object.keys(test.globalDecorators || {}).forEach(function (x) {
            handlebarsEnv.registerDecorator(x, safeEval(test.globalDecorators[x].javascript));
        });

        // Execute
        var hasPartials = typeof test.partials === 'object' && Object.keys(test.partials).length > 0;
        var template = CompilerContext[hasPartials ? 'compileWithPartial' : 'compile'](test.template, clone(test.compileOptions));
        var runtimeOptions = test.runtimeOptions || test.options || {};
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

        var actual = template(test.data, test.runtimeOptions);
        equals(actual, test.expected);

        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}

function runTestParser(test: any) {
    try {
        var actual = astFor(test.template);
        assert.equal(actual, test.expected);
        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}

function runTestTokenizer(test: any) {
    try {
        var actual = tokenize(test.template);
        assert.deepEqual(actual, test.expected);
        return checkResult(test);
    } catch (e) {
        return checkResult(test, e);
    }
}


