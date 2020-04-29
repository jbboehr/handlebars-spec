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
function log(message, ...optionalParams) {
    console.warn.apply(null, [
        exports.globalContext.testContext.key || '',
        '|',
        message,
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
exports.afterEach = afterEach;
function beforeEach(fn) {
    exports.globalContext.beforeFns.push(fn);
}
exports.beforeEach = beforeEach;
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
exports.describe = describe;
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
exports.it = it;
function expectTemplate(template) {
    return new expectTemplate_1.ExpectTemplate(template, addExpectTemplate);
}
exports.expectTemplate = expectTemplate;
function addExpectTemplate(xt) {
    const { testContext, indices, tests } = exports.globalContext;
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
    let spec = utils_1.serialize({
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
    if (number === '00') {
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
    exports.globalContext.testContext = exports.globalContext.testContext.reset();
}
function applyPatches(name, spec) {
    const { suite, unusedPatches } = exports.globalContext;
    const patchFile = path_1.resolve('./patch/' + '/' + suite + '.json');
    if (!fs_1.existsSync(patchFile)) {
        return spec;
    }
    // @todo only read once
    const patchData = JSON.parse(fs_1.readFileSync(patchFile).toString());
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
        spec = extend_1.default(true, spec, patch);
        // Using nulls in patches to unset things
        utils_1.stripNulls(spec);
        log('applied patch', spec);
    }
    // Track unused patches
    if (unusedPatches === null) {
        extend_1.default(unusedPatches, patchData);
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
// these functions don't need to do anything, just warn and ignore
function equals(...args) {
    log('equals called', ...args);
}
exports.equals = equals;
function xit(...args) {
    log('xit called', ...args);
}
exports.xit = xit;
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
exports.expect = expect;
function shouldBeToken(...args) {
    log('shouldBeToken called', ...args);
}
exports.shouldBeToken = shouldBeToken;
function shouldCompileTo(...args) {
    log('shouldCompileTo called', ...args);
}
exports.shouldCompileTo = shouldCompileTo;
function shouldCompileToWithPartials(...args) {
    log('shouldCompileToWithPartials called', ...args);
}
exports.shouldCompileToWithPartials = shouldCompileToWithPartials;
function compileWithPartials(...args) {
    log('compileWithPartials called', ...args);
}
exports.compileWithPartials = compileWithPartials;
function shouldThrow(...args) {
    log('shouldThrow called', ...args);
}
exports.shouldThrow = shouldThrow;
function tokenize(...args) {
    log('tokenize called', ...args);
}
exports.tokenize = tokenize;
function shouldMatchTokens(...args) {
    log('shouldMatchTokens called', ...args);
}
exports.shouldMatchTokens = shouldMatchTokens;
//# sourceMappingURL=mockGlobals.js.map