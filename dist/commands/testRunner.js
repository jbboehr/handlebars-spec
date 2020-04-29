"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const clime_1 = require("clime");
const Handlebars = __importStar(require("handlebars"));
const eval_1 = require("../eval");
const util_1 = require("util");
const utils_1 = require("../utils");
const path_1 = require("path");
const fs_1 = require("fs");
const assert = __importStar(require("assert"));
// Patch globals
let handlebarsEnv = Handlebars;
global.Handlebars = Handlebars;
global.handlebarsEnv = handlebarsEnv;
global.CompilerContext = {
    compile: function (template, options) {
        var templateSpec = global.handlebarsEnv.precompile(template, options);
        return handlebarsEnv.template(eval_1.safeEval(templateSpec));
    },
    compileWithPartial: function (template, options) {
        return handlebarsEnv.compile(template, options);
    }
};
require('../../handlebars.js/spec/env/common.js');
let default_1 = class default_1 extends clime_1.Command {
    execute(inputFile) {
        var successes = [];
        var failures = [];
        var skipped = [];
        var dir = '.';
        function runSpec(spec) {
            var tmp = spec.replace(/\.json$/, '').split("/");
            var suite = tmp[tmp.length - 1];
            var data = require(path_1.resolve(dir + '/' + spec));
            Object.keys(data).forEach(function (y) {
                data[y].suite = suite;
                var result = runTest(data[y]);
                if (result === null) {
                    skipped.push(data[y]);
                }
                else if (result === true) {
                    successes.push(data[y]);
                }
                else {
                    failures.push(data[y]);
                }
            });
        }
        if (inputFile) {
            runSpec(inputFile);
        }
        else {
            dir = path_1.resolve('./spec/');
            var specs = fs_1.readdirSync(dir);
            Object.values(specs).forEach(runSpec);
        }
        console.log('Summary');
        console.log('Success: ' + successes.length);
        console.log('Failed: ' + failures.length);
        console.log('Skipped: ' + skipped.length);
        process.exit(failures.length ? 2 : 0);
    }
};
__decorate([
    __param(0, clime_1.param({
        name: 'Input file',
        required: false,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    clime_1.command({
        description: 'This runs the spec json files against handlebars to test them',
    })
], default_1);
exports.default = default_1;
function astFor(template) {
    var ast = Handlebars.parse(template);
    return Handlebars.print(ast);
}
function tokenize(template) {
    var parser = Handlebars.Parser, lexer = parser.lexer;
    lexer.setInput(template);
    var out = [];
    for (;;) {
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
function unstringifyHelpers(helpers) {
    if (!helpers || helpers === null) {
        return;
    }
    var ret = {};
    Object.keys(helpers).forEach(function (x) {
        ret[x] = eval_1.safeEval(helpers[x].javascript);
    });
    return ret;
}
function unstringifyLambdas(data) {
    if (!data || data === null) {
        return data;
    }
    for (var x in data) {
        if (util_1.isArray(data[x])) {
            unstringifyLambdas(data[x]);
        }
        else if (typeof data[x] === 'object' && data[x] !== null) {
            if ('!code' in data[x]) {
                data[x] = eval_1.safeEval(data[x].javascript);
            }
            else {
                unstringifyLambdas(data[x]);
            }
        }
    }
    return data;
}
function fixSparseArray(data) {
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
    }
    else {
        for (x in data) {
            if (data.hasOwnProperty(x)) {
                data[x] = fixSparseArray(data[x]);
            }
        }
    }
    return data;
}
// Test utils
function checkResult(test, e) {
    var shouldExcept = test.exception === true;
    var didExcept = e !== undefined;
    if (shouldExcept === didExcept) {
        console.log(test.prefix, "|", 'OK');
        return true;
    }
    else {
        var msg = e || 'Error: should have thrown, did not';
        console.log(test.prefix, "|", 'FAIL');
        console.log(msg);
        if (e) {
            console.error(e.stack);
        }
        console.error(require('util').inspect(utils_1.serialize(test), false, null, true));
        return false;
    }
}
function makePrefix(test) {
    return (test.suite) + ' | ' + test.description + ' - ' + test.it + ' - ' + test.number;
}
function prepareTestGeneric(test) {
    var spec = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    // Exception
    spec.exception = test.exception ? true : false;
    // Data
    spec.data = fixSparseArray(utils_1.clone(test.data));
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
    spec.runtimeOptions = unstringifyLambdas(utils_1.clone(test.runtimeOptions));
    spec.compileOptions = utils_1.clone(test.compileOptions);
    if (spec.options && typeof spec.options.data === 'object') {
        unstringifyLambdas(spec.options.data);
    }
    // Compat
    spec.compat = Boolean(test.compat);
    return spec;
}
function prepareTestParser(test) {
    var spec = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = utils_1.clone(test.expected);
    // Exception
    spec.exception = test.exception ? true : false;
    // Message
    spec.message = test.message;
    return spec;
}
function prepareTestTokenizer(test) {
    var spec = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = utils_1.clone(test.expected);
    return spec;
}
function runTest(test) {
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
function runTestGeneric(test) {
    let handlebarsEnv = global.handlebarsEnv;
    let CompilerContext = global.CompilerContext;
    let equals = global.equals;
    global.value = 1; // for helpers - block params - should take presednece over parent block params - 00
    global.lastOptions = undefined; // for subexpressions - provides each nested helper invocation its own options hash - 00
    global.run = false; // for blocks - decorators - should fail when accessing variables from root - 00
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
        var hasPartials = typeof test.partials === 'object' && Object.keys(test.partials).length > 0;
        var template = CompilerContext[hasPartials ? 'compileWithPartial' : 'compile'](test.template, utils_1.clone(test.compileOptions));
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
    }
    catch (e) {
        return checkResult(test, e);
    }
}
function runTestParser(test) {
    try {
        var actual = astFor(test.template);
        assert.equal(actual, test.expected);
        return checkResult(test);
    }
    catch (e) {
        return checkResult(test, e);
    }
}
function runTestTokenizer(test) {
    try {
        var actual = tokenize(test.template);
        assert.deepEqual(actual, test.expected);
        return checkResult(test);
    }
    catch (e) {
        return checkResult(test, e);
    }
}
//# sourceMappingURL=testRunner.js.map