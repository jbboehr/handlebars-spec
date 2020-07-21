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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
const handlebarsEnv = Handlebars;
global.Handlebars = Handlebars;
global.handlebarsEnv = handlebarsEnv;
global.CompilerContext = {
    compile(template, options) {
        const templateSpec = global.handlebarsEnv.precompile(template, options);
        return handlebarsEnv.template(eval_1.safeEval(templateSpec));
    },
    compileWithPartial(template, options) {
        return handlebarsEnv.compile(template, options);
    }
};
require('../../handlebars.js/spec/env/common.js');
let default_1 = class default_1 extends clime_1.Command {
    execute(inputFile) {
        const successes = [];
        const failures = [];
        const skipped = [];
        let dir = '.';
        function runSpec(spec) {
            const tmp = spec.replace(/\.json$/, '').split('/');
            const suite = tmp[tmp.length - 1];
            const data = JSON.parse(fs_1.readFileSync(path_1.resolve(dir + '/' + spec)).toString());
            Object.keys(data).forEach(function (y) {
                data[y].suite = suite;
                const result = runTest(data[y]);
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
            const specs = fs_1.readdirSync(dir);
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
    const ast = Handlebars.parse(template);
    return Handlebars.print(ast);
}
function tokenize(template) {
    const parser = Handlebars.Parser, lexer = parser.lexer;
    lexer.setInput(template);
    const out = [];
    for (;;) {
        const token = lexer.lex();
        if (!token) {
            break;
        }
        const result = parser.terminals_[token] || token;
        if (!result || result === 'EOF' || result === 'INVALID') {
            break;
        }
        out.push({ name: result, text: lexer.yytext });
    }
    return out;
}
function unstringifyHelpers(helpers) {
    if (!helpers || helpers === null || typeof helpers !== 'object') {
        return {};
    }
    const ret = {};
    Object.keys(helpers).forEach(function (x) {
        ret[x] = eval_1.safeEval(helpers[x].javascript);
    });
    return ret;
}
function unstringifyLambdas(data) {
    if (!data || data === null) {
        return data;
    }
    for (const x in data) {
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
    const shouldExcept = test.exception === true;
    const didExcept = e !== undefined;
    if (shouldExcept === didExcept) {
        console.log(test.prefix, '|', 'OK');
        return true;
    }
    else {
        const msg = e || 'Error: should have thrown, did not';
        console.log(test.prefix, '|', 'FAIL');
        console.log(msg);
        if (e) {
            console.error(e.stack);
        }
        console.error(util_1.inspect(utils_1.serialize(test), false, null, true));
        return false;
    }
}
function makePrefix(test) {
    return (test.suite) + ' | ' + test.description + ' - ' + test.it + ' - ' + test.number;
}
function prepareTestGeneric(test) {
    const spec = {};
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
function prepareTestParser(test) {
    const spec = {};
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
function prepareTestTokenizer(test) {
    const spec = {};
    // Output prefix
    spec.prefix = makePrefix(test);
    // Template
    spec.template = test.template;
    // Expected
    spec.expected = test.expected;
    return spec;
}
function runTest(test) {
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
function runTestGeneric(test) {
    const handlebarsEnv = global.handlebarsEnv;
    const CompilerContext = global.CompilerContext;
    const equals = global.equals;
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
    }
    catch (e) {
        return checkResult(test, e);
    }
}
function runTestParser(test) {
    try {
        const actual = astFor(test.template);
        assert.equal(actual, test.expected);
        return checkResult(test);
    }
    catch (e) {
        return checkResult(test, e);
    }
}
function runTestTokenizer(test) {
    try {
        const actual = tokenize(test.template);
        assert.deepEqual(actual, test.expected);
        return checkResult(test);
    }
    catch (e) {
        return checkResult(test, e);
    }
}
//# sourceMappingURL=testRunner.js.map