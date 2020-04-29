
import * as Handlebars from "handlebars";
import { clone, stripNulls, serialize } from "./utils";
import { TestSpec, StringDict, CodeDict } from "./types";
import { ExpectTemplate } from "./expectTemplate";
import { resolve as resolvePath } from "path";
import extend from "extend";
import {existsSync} from "fs";
import { GlobalContext } from "./globalContext";
import * as sinon from "sinon";

export {Handlebars, sinon};

export let globalContext: GlobalContext = new GlobalContext();

export function resetContext() {
    globalContext.testContext = globalContext.testContext.reset();
}

function currentTestName() {
    return globalContext.testContext.key;
}

function log(message?: any, ...optionalParams: any[]) {
    console.warn.apply(null, [
        currentTestName(),
        "|",
        message,
        // ...optionalParams
    ]);
    if (optionalParams && optionalParams.length >= 1) {
        console.warn.apply(null, (optionalParams as any));
    }
}

class SkipError extends Error {}



// env

export function afterEach(fn: Function) {
    globalContext.afterFns.push(fn);
}

export function beforeEach(fn: Function) {
    globalContext.beforeFns.push(fn);
}

export function CompilerContextCompile(template: string, options: object) {
    let {testContext} = globalContext;

    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = clone(options);

    const compiledTemplate = Handlebars.compile(template, options);

    return function (data: any, options: any) {
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

function CompilerContextCompileWithPartial(template: string, options: any) {
    let {testContext} = globalContext;

    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = clone(options);
    return Handlebars.compile(template, options);
}

export const CompilerContext = {
    compile: CompilerContextCompile,
    compileWithPartial: CompilerContextCompileWithPartial,
}

export function describe(description: string, next: Function) {
    let {testContext, descriptionStack, beforeFns, afterFns} = globalContext;
    beforeFns = [...beforeFns]
    afterFns = [...afterFns];

    descriptionStack.push(description);
    testContext.description = globalContext.descriptionStack.join(' - ');
    testContext.oldDescription = description;

    next();

    descriptionStack.pop();
    delete testContext.oldDescription;
    globalContext.beforeFns = beforeFns;
    globalContext.afterFns = afterFns;
};

export function it(description: string, next: Function) {
    let {testContext} = globalContext;

    // Call before fns
    globalContext.beforeFns.forEach((fn) => {
        fn();
    });

    // Push test spec unto context
    testContext.it = description;
    testContext.description = globalContext.descriptionStack.join(" - ");
    testContext.key = testContext.description + " - " + testContext.it;

    // Test
    next();

    // Call after fns
    globalContext.afterFns.forEach((fn: Function) => {
        fn();
    });
};

export function equals(actual: any, expected: any, message?: string) {
    log("equals called", ...arguments);
};

export function xit() {
    log("xit called", ...arguments);
}

export function expect() {
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
};

export function shouldBeToken() {
    log("shouldBeToken called", ...arguments);
};

export function shouldCompileTo(str: string, hashOrArray: any, expected: any, message?: string) {
    log("shouldCompileTo called", ...arguments);
};

export function shouldCompileToWithPartials(str: string, hashOrArray: any, partials: any, expected: any, message?: string) {
    log("shouldCompileToWithPartials called", ...arguments);
};

export function compileWithPartials(template: string, hashOrArray: any, partials?: StringDict, expected?: any, message?: string) {
    log('compileWithPartials called', ...arguments);
};

export function shouldThrow(callback: Function, error: string, message: string) {
    log('shouldThrow called', ...arguments);
};

export function tokenize(template: string) {
    log('tokenize called', ...arguments);
};

export function shouldMatchTokens(expected: any /*, tokens*/) {
    log('shouldMatchTokens called', ...arguments);
};

export function expectTemplate(template: string) {
    return new ExpectTemplate(template, addExpectTemplate);
};

function addExpectTemplate(xt: ExpectTemplate) {
    let { testContext, suite, indices, tests} = globalContext;
    let { description, it, extraEquals } = testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
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
    var spec: TestSpec = serialize({
        description,
        it,
        number,
        template: xt.template,
        data: xt.input,
        expected: xt.expected,
        runtimeOptions: xt.runtimeOptions,
        compileOptions: xt.compileOptions,
        partials: extend({}, detectGlobalPartials(), xt.partials || {}),
        helpers: extend({}, detectGlobalHelpers(), xt.helpers || {}),
        decorators: extend({}, detectGlobalDecorators(), xt.decorators || {}),
        message: xt.message,
        compat: (xt.compileOptions || {}).compat,
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
    } catch (e) {
        if (e instanceof SkipError) {
            // ok
        } else {
            throw e;
        }
    }

    // Reset the context
    resetContext();
}

function applyPatches(name: string, spec: TestSpec): TestSpec {
    let { suite, unusedPatches } = globalContext;

    let patchFile = resolvePath('./patch/' + '/' + suite + '.json');
    if (!existsSync(patchFile)) {
        return spec;
    }

    let patchData: any = require(patchFile);
    let patch: any;

    if (patchData.hasOwnProperty(name)) {
        patch = patchData[name];
    } else {
        return spec;
    }

    if (patch === null) {
        // Note: setting to null means to skip the test. These will most
        // likely be implementation-dependant. Note that it still has to be
        // added to the indices array
        log("skipped via patch");
        throw new SkipError();
    } else {
        spec = extend(true, spec, patch);
        // Using nulls in patches to unset things
        stripNulls(spec);
        log("applied patch", spec);
    }

    // Track unused patches
    if (unusedPatches === null) {
        unusedPatches = extend({}, patchData);
    }
    delete unusedPatches[name];

    return spec;
}

function detectGlobalHelpers() {
    let { handlebarsEnv } = (global as any);
    const builtins = [
        'helperMissing', 'blockHelperMissing', 'each', 'if',
        'unless', 'with', 'log', 'lookup'
    ];
    let globalHelpers: CodeDict = {};

    Object.keys(handlebarsEnv.helpers).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalHelpers[x] = /*jsToCode(*/handlebarsEnv.helpers[x]/*)*/;
    });

    return globalHelpers;
}

function detectGlobalDecorators() {
    let { handlebarsEnv } = (global as any);
    const builtins = ['inline'];
    let globalDecorators: CodeDict = {};

    Object.keys(handlebarsEnv.decorators).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalDecorators[x] = /*jsToCode(*/handlebarsEnv.decorators[x]/*)*/;
    });

    return globalDecorators;
}

function detectGlobalPartials() {
    let { handlebarsEnv } = (global as any);
    // This should never be null, but it is in one case
    if (!handlebarsEnv) {
        return {};
    }

    let globalPartials: StringDict = {};

    Object.keys(handlebarsEnv.partials).forEach((x) => {
        globalPartials[x] = handlebarsEnv.partials[x];
    });

    return globalPartials;
}
