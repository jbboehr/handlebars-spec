"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalContext = exports.sinon = exports.Handlebars = void 0;
exports.afterEach = afterEach;
exports.beforeEach = beforeEach;
exports.describe = describe;
exports.it = it;
exports.expectTemplate = expectTemplate;
exports.equals = equals;
exports.shouldThrow = shouldThrow;
exports.tokenize = tokenize;
exports.shouldMatchTokens = shouldMatchTokens;
exports.xit = xit;
exports.expect = expect;
exports.shouldBeToken = shouldBeToken;
exports.shouldCompileTo = shouldCompileTo;
exports.shouldCompileToWithPartials = shouldCompileToWithPartials;
exports.compileWithPartials = compileWithPartials;
const Handlebars = __importStar(require("handlebars"));
exports.Handlebars = Handlebars;
const utils_1 = require("./utils");
const expectTemplate_1 = require("./expectTemplate");
const path_1 = require("path");
const extend_1 = __importDefault(require("extend"));
const fs_1 = require("fs");
const globalContext_1 = require("./globalContext");
const sinon = __importStar(require("sinon"));
exports.sinon = sinon;
exports.globalContext = new globalContext_1.GlobalContext();
function log(message, ...optionalParams) {
    console.warn.apply(null, [
        exports.globalContext.testContext.key || '',
        '|',
        message,
        // ...optionalParams
    ]);
    if (optionalParams && optionalParams.length >= 1) {
        console.warn.apply(null, optionalParams);
    }
}
class SkipError extends Error {
}
function afterEach(fn) {
    exports.globalContext.afterFns.push(fn);
}
function beforeEach(fn) {
    exports.globalContext.beforeFns.push(fn);
}
function describe(description, next) {
    const { testContext, descriptionStack } = exports.globalContext;
    let { beforeFns, afterFns } = exports.globalContext;
    beforeFns = [...beforeFns];
    afterFns = [...afterFns];
    descriptionStack.push(description);
    testContext.description = exports.globalContext.descriptionStack.join(' - ');
    testContext.oldDescription = description;
    next();
    descriptionStack.pop();
    delete testContext.oldDescription;
    exports.globalContext.beforeFns = beforeFns;
    exports.globalContext.afterFns = afterFns;
}
function it(description, next) {
    const { testContext } = exports.globalContext;
    // Call before fns
    exports.globalContext.beforeFns.forEach((fn) => {
        fn();
    });
    // Push test spec unto context
    testContext.it = description;
    testContext.description = exports.globalContext.descriptionStack.join(' - ');
    testContext.key = testContext.description + ' - ' + testContext.it;
    // Test
    next();
    // Call after fns
    exports.globalContext.afterFns.forEach((fn) => {
        fn();
    });
}
function expectTemplate(template) {
    return new expectTemplate_1.ExpectTemplate(template, addExpectTemplate);
}
function addExpectTemplate(xt) {
    const { testContext, indices, tests, isParser } = exports.globalContext;
    const { description, it, extraEquals } = testContext;
    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete exports.globalContext.testContext.extraEquals;
    }
    // Generate key
    const key = (description + ' - ' + it).toLowerCase();
    function generateName() {
        for (let i = 0; i < 99; i++) {
            const j = ('0' + i).slice(-2);
            const n = key + ' - ' + j;
            if (!indices.hasOwnProperty(n)) {
                return [n, j];
            }
        }
        throw new Error('Failed to acquire test index');
    }
    const [name, number] = generateName();
    indices[name] = name;
    // Make test spec
    let spec = (0, utils_1.serialize)({
        description,
        it,
        number,
        template: xt.template,
        data: xt.input,
        expected: xt.expected,
        runtimeOptions: xt.runtimeOptions,
        compileOptions: xt.compileOptions,
        partials: (0, extend_1.default)({}, detectGlobalPartials(), xt.partials || {}),
        helpers: (0, extend_1.default)({}, detectGlobalHelpers(), xt.helpers || {}),
        decorators: (0, extend_1.default)({}, detectGlobalDecorators(), xt.decorators || {}),
        message: xt.message,
        exception: xt.exception,
    });
    if (spec.exception) {
        delete spec.expected;
    }
    if (number === '00') {
        delete spec.number;
    }
    if (isParser) {
        delete spec.data;
    }
    // Apply patches and push to tests
    try {
        spec = applyPatches(name, spec);
        tests.push(spec);
    }
    catch (e) {
        if (e instanceof SkipError) {
            // ok
        }
        else {
            throw e;
        }
    }
    // Reset the context
    exports.globalContext.testContext = exports.globalContext.testContext.reset();
}
function applyPatches(name, spec) {
    const { suite, unusedPatches } = exports.globalContext;
    const patchFile = (0, path_1.resolve)('./patch/' + '/' + suite + '.json');
    if (!(0, fs_1.existsSync)(patchFile)) {
        return spec;
    }
    // @todo only read once
    const patchData = JSON.parse((0, fs_1.readFileSync)(patchFile).toString());
    let patch;
    if (patchData.hasOwnProperty(name)) {
        patch = patchData[name];
    }
    else {
        return spec;
    }
    if (patch === null) {
        // Note: setting to null means to skip the test. These will most
        // likely be implementation-dependant. Note that it still has to be
        // added to the indices array
        log('skipped via patch');
        throw new SkipError();
    }
    else {
        spec = (0, extend_1.default)(true, spec, patch);
        // Using nulls in patches to unset things
        (0, utils_1.stripNulls)(spec);
        log('applied patch', spec);
    }
    // Track unused patches
    if (unusedPatches === null) {
        (0, extend_1.default)(unusedPatches, patchData);
    }
    delete unusedPatches[name];
    return spec;
}
function detectGlobalHelpers() {
    const { handlebarsEnv } = global;
    const builtins = [
        'helperMissing', 'blockHelperMissing', 'each', 'if',
        'unless', 'with', 'log', 'lookup'
    ];
    const globalHelpers = {};
    Object.keys(handlebarsEnv.helpers).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalHelpers[x] = /*jsToCode(*/ handlebarsEnv.helpers[x] /*)*/;
    });
    return globalHelpers;
}
function detectGlobalDecorators() {
    const { handlebarsEnv } = global;
    const builtins = ['inline'];
    const globalDecorators = {};
    Object.keys(handlebarsEnv.decorators).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalDecorators[x] = /*jsToCode(*/ handlebarsEnv.decorators[x] /*)*/;
    });
    return globalDecorators;
}
function detectGlobalPartials() {
    const { handlebarsEnv } = global;
    // This should never be null, but it is in one case
    if (!handlebarsEnv) {
        return {};
    }
    const globalPartials = {};
    Object.keys(handlebarsEnv.partials).forEach((x) => {
        globalPartials[x] = handlebarsEnv.partials[x];
    });
    return globalPartials;
}
// only used by parser and tokenizer
function equals(actual, expected) {
    const { testContext, isParser } = exports.globalContext;
    if (isParser) {
        // Read the template from the lexer
        const template = testContext.template || Handlebars.Parser.lexer.matched;
        expectTemplate(template)
            .withInput(undefined)
            .toCompileTo(expected);
    }
    else {
        log('equals called', actual, expected);
    }
}
function shouldThrow(cb, a, b) {
    const { testContext, isParser } = exports.globalContext;
    if (isParser) {
        testContext.exception = b || true;
        let ex = null;
        try {
            cb();
        }
        catch (e) {
            ex = e;
        }
        if (!ex) {
            throw new Error('test did not throw but should have');
        }
        // Read the template from the lexer
        const template = testContext.template || Handlebars.Parser.lexer.matched;
        expectTemplate(template)
            .withInput(undefined)
            .toThrow(a, b);
        delete testContext.exception;
    }
    else {
        log('shouldThrow called', a, b);
    }
}
function tokenize(template) {
    const { testContext, isParser } = exports.globalContext;
    if (isParser) {
        testContext.template = template;
    }
    else {
        log('tokenize called', template);
    }
    return global.originalTokenize(template);
}
function shouldMatchTokens(actual, expected) {
    const { testContext, isParser } = exports.globalContext;
    if (isParser) {
        expectTemplate(testContext.template || '')
            .toCompileTo(actual);
    }
    else {
        log('shouldMatchTokens called', actual, expected);
    }
}
// these functions don't need to do anything, just warn and ignore
function xit(...args) {
    log('xit called', ...args);
}
function expect() {
    return {
        to: {
            equal(...args) {
                log('expect.to.equal called', ...args);
            },
            be: {
                true(...args) {
                    log('expect.to.be.true called', ...args);
                }
            },
            throw(...args) {
                log('expect.to.throw called', ...args);
            },
            match(...args) {
                log('expect.to.match called', ...args);
            }
        }
    };
}
function shouldBeToken(...args) {
    log('shouldBeToken called', ...args);
}
function shouldCompileTo(...args) {
    log('shouldCompileTo called', ...args);
}
function shouldCompileToWithPartials(...args) {
    log('shouldCompileToWithPartials called', ...args);
}
function compileWithPartials(...args) {
    log('compileWithPartials called', ...args);
}
//# sourceMappingURL=mockGlobals.js.map