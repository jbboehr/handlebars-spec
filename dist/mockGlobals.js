"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
function resetContext() {
    exports.globalContext.testContext = exports.globalContext.testContext.reset();
}
exports.resetContext = resetContext;
function currentTestName() {
    return exports.globalContext.testContext.key;
}
function log(message, ...optionalParams) {
    console.warn.apply(null, [
        currentTestName(),
        "|",
        message,
    ]);
    if (optionalParams && optionalParams.length >= 1) {
        console.warn.apply(null, optionalParams);
    }
}
class SkipError extends Error {
}
// env
function afterEach(fn) {
    exports.globalContext.afterFns.push(fn);
}
exports.afterEach = afterEach;
function beforeEach(fn) {
    exports.globalContext.beforeFns.push(fn);
}
exports.beforeEach = beforeEach;
function CompilerContextCompile(template, options) {
    let { testContext } = exports.globalContext;
    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = utils_1.clone(options);
    const compiledTemplate = Handlebars.compile(template, options);
    return function (data, options) {
        // Note: merging data in the options causes tests to fail, possibly
        // a separate type of data?
        if (options && options.hasOwnProperty('data')) {
            //data = extend(true, data, options.data);
            testContext.options = testContext.options || {};
            testContext.options.data = options.data;
        }
        // Push template data unto context
        testContext.data = data;
        if (options && options.hasOwnProperty('helpers')) {
            // Push helpers unto context
            testContext.helpers = options.helpers;
        }
        if (options && options.hasOwnProperty('decorators')) {
            // Push decorators unto context
            testContext.decorators = options.decorators;
        }
        return compiledTemplate(data, options);
    };
}
exports.CompilerContextCompile = CompilerContextCompile;
function CompilerContextCompileWithPartial(template, options) {
    let { testContext } = exports.globalContext;
    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = utils_1.clone(options);
    return Handlebars.compile(template, options);
}
exports.CompilerContext = {
    compile: CompilerContextCompile,
    compileWithPartial: CompilerContextCompileWithPartial,
};
function describe(description, next) {
    let { testContext, descriptionStack, beforeFns, afterFns } = exports.globalContext;
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
exports.describe = describe;
;
function it(description, next) {
    let { testContext } = exports.globalContext;
    // Call before fns
    exports.globalContext.beforeFns.forEach((fn) => {
        fn();
    });
    // Push test spec unto context
    testContext.it = description;
    testContext.description = exports.globalContext.descriptionStack.join(" - ");
    testContext.key = testContext.description + " - " + testContext.it;
    // Test
    next();
    // Call after fns
    exports.globalContext.afterFns.forEach((fn) => {
        fn();
    });
}
exports.it = it;
;
function equals(actual, expected, message) {
    log("equals called", ...arguments);
}
exports.equals = equals;
;
function xit() {
    log("xit called", ...arguments);
}
exports.xit = xit;
function expect() {
    return {
        to: {
            equal: function () {
                log("expect.to.equal called", ...arguments);
            },
            be: {
                true: function () {
                    log("expect.to.be.true called", ...arguments);
                }
            },
            "throw": function () {
                log("expect.to.throw called", ...arguments);
            },
            match: function () {
                log("expect.to.match called", ...arguments);
            }
        }
    };
}
exports.expect = expect;
;
function shouldBeToken() {
    log("shouldBeToken called", ...arguments);
}
exports.shouldBeToken = shouldBeToken;
;
function shouldCompileTo(str, hashOrArray, expected, message) {
    log("shouldCompileTo called", ...arguments);
}
exports.shouldCompileTo = shouldCompileTo;
;
function shouldCompileToWithPartials(str, hashOrArray, partials, expected, message) {
    log("shouldCompileToWithPartials called", ...arguments);
}
exports.shouldCompileToWithPartials = shouldCompileToWithPartials;
;
function compileWithPartials(template, hashOrArray, partials, expected, message) {
    log('compileWithPartials called', ...arguments);
}
exports.compileWithPartials = compileWithPartials;
;
function shouldThrow(callback, error, message) {
    log('shouldThrow called', ...arguments);
}
exports.shouldThrow = shouldThrow;
;
function tokenize(template) {
    log('tokenize called', ...arguments);
}
exports.tokenize = tokenize;
;
function shouldMatchTokens(expected /*, tokens*/) {
    log('shouldMatchTokens called', ...arguments);
}
exports.shouldMatchTokens = shouldMatchTokens;
;
function expectTemplate(template) {
    return new expectTemplate_1.ExpectTemplate(template, addExpectTemplate);
}
exports.expectTemplate = expectTemplate;
;
function addExpectTemplate(xt) {
    let { testContext, suite, indices, tests } = exports.globalContext;
    let { description, it, extraEquals } = testContext;
    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete exports.globalContext.testContext.extraEquals;
    }
    // Generate key
    var key = (description + ' - ' + it).toLowerCase();
    let [name, number] = (() => {
        for (let i = 0; i < 99; i++) {
            let j = ('0' + i).slice(-2);
            let n = key + ' - ' + j;
            if (!indices.hasOwnProperty(n)) {
                return [n, j];
            }
        }
        throw new Error('Failed to acquire test index');
    })();
    indices[name] = name;
    // Make test spec
    var spec = utils_1.serialize({
        description,
        it,
        number,
        template: xt.template,
        data: xt.input,
        expected: xt.expected,
        runtimeOptions: xt.runtimeOptions,
        compileOptions: xt.compileOptions,
        partials: extend_1.default({}, detectGlobalPartials(), xt.partials || {}),
        helpers: extend_1.default({}, detectGlobalHelpers(), xt.helpers || {}),
        decorators: extend_1.default({}, detectGlobalDecorators(), xt.decorators || {}),
        message: xt.message,
        exception: xt.exception,
    });
    if (spec.exception) {
        delete spec.expected;
    }
    if (number === "00") {
        delete spec.number;
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
    resetContext();
}
function applyPatches(name, spec) {
    let { suite, unusedPatches } = exports.globalContext;
    let patchFile = path_1.resolve('./patch/' + '/' + suite + '.json');
    if (!fs_1.existsSync(patchFile)) {
        return spec;
    }
    let patchData = require(patchFile);
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
        log("skipped via patch");
        throw new SkipError();
    }
    else {
        spec = extend_1.default(true, spec, patch);
        // Using nulls in patches to unset things
        utils_1.stripNulls(spec);
        log("applied patch", spec);
    }
    // Track unused patches
    if (unusedPatches === null) {
        unusedPatches = extend_1.default({}, patchData);
    }
    delete unusedPatches[name];
    return spec;
}
function detectGlobalHelpers() {
    let { handlebarsEnv } = global;
    const builtins = [
        'helperMissing', 'blockHelperMissing', 'each', 'if',
        'unless', 'with', 'log', 'lookup'
    ];
    let globalHelpers = {};
    Object.keys(handlebarsEnv.helpers).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalHelpers[x] = /*jsToCode(*/ handlebarsEnv.helpers[x] /*)*/;
    });
    return globalHelpers;
}
function detectGlobalDecorators() {
    let { handlebarsEnv } = global;
    const builtins = ['inline'];
    let globalDecorators = {};
    Object.keys(handlebarsEnv.decorators).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalDecorators[x] = /*jsToCode(*/ handlebarsEnv.decorators[x] /*)*/;
    });
    return globalDecorators;
}
function detectGlobalPartials() {
    let { handlebarsEnv } = global;
    // This should never be null, but it is in one case
    if (!handlebarsEnv) {
        return {};
    }
    let globalPartials = {};
    Object.keys(handlebarsEnv.partials).forEach((x) => {
        globalPartials[x] = handlebarsEnv.partials[x];
    });
    return globalPartials;
}
//# sourceMappingURL=mockGlobals.js.map