
import * as Handlebars from "handlebars";
import { clone, stripNulls, serialize, jsToCode, isEmptyObject } from "./utils";
import { TestSpec, StringDict, FunctionDict, CodeDict } from "./types";
import { ExpectTemplate } from "./expectTemplate";
import { isArray } from "util";
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
    let {testContext, descriptionStack} = globalContext;

    descriptionStack.push(description);
    testContext.description = globalContext.descriptionStack.join(' - ');
    testContext.oldDescription = description;

    next();

    descriptionStack.pop();
    delete testContext.oldDescription;
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

export function tokenize(template: string) {
    let {testContext} = globalContext;
    testContext.template = template;
    // @TODO better typing?
    return (global as any).originalTokenize(template);
};

export function shouldMatchTokens(expected: any /*, tokens*/) {
    let { description, oldDescription, it, template, extraEquals } = globalContext.testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(globalContext.testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
    }

    var spec: TestSpec = {
        description,
        oldDescription,
        it,
        template: template as string,
        expected,
        data: undefined
    };

    // Add the test
    addTest(spec);

    // Reset the context
    resetContext();
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

function addExpectTemplate(xt: ExpectTemplate) {
    let { testContext } = globalContext;
    let { description, it, extraEquals } = testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
    }

    var spec: TestSpec = serialize({
        description,
        it,
        number: null,
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

    // Add the test
    addTest(spec);

    // Reset the context
    resetContext();
}

export function expectTemplate(template: string) {
    return new ExpectTemplate(template, (xt: ExpectTemplate) => {
        addExpectTemplate(xt);
    });
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

    // // let {testContext} = globalContext;
    // let helpers: FunctionDict = {};
    // let decorators: FunctionDict = {};
    // //let partials: StringDict = {};
    // let input: any = {};
    // // let compat: undefined | true;
    // let compileOptions: any = extend({}, globalContext.testContext.compileOptions);

    // // partials = testContext.mergePartials(partials);

    // if (isArray(hashOrArray)) {
    //     input = hashOrArray[0];
    //     helpers = hashOrArray[1];
    //     // helpers = testContext.mergeHelpers(hashOrArray[1]);
    //     partials = hashOrArray[2];
    //     if (hashOrArray[3]) {
    //         if (typeof hashOrArray[3] === 'boolean') {
    //             compileOptions.compat = true;
    //         } else if (typeof hashOrArray[3] === 'object') {
    //             extend(compileOptions, hashOrArray[3]);
    //         }
    //     }
    //     /* if (hashOrArray[4] != null) {
    //       options.data = !!hashOrArray[4];
    //       ary[1].data = hashOrArray[4];
    //     } */
    // } else {
    //     input = hashOrArray;
    //     if (typeof input === 'object') {
    //         input = hashOrArray.hash || hashOrArray;
    //         helpers = hashOrArray.helpers; //testContext.mergeHelpers(hashOrArray.helpers);
    //         partials = hashOrArray.partials; //testContext.mergePartials(hashOrArray.partials);
    //         decorators = hashOrArray.decorators; //testContext.mergeDecorators(hashOrArray.decorators);
    //         delete input.helpers;
    //         delete input.partials;
    //         delete input.decorators;
    //     }
    // }

    // let xt = expectTemplate(template)
    //     .withHelpers(helpers || {})
    //     .withPartials(partials || {})
    //     .withDecorators(decorators || {})
    //     .withCompileOptions(compileOptions)
    //     .withInput(input);
    // if (message) {
    //     xt.withMessage(message);
    // }

    // xt.toCompileTo(expected);
};

export function shouldThrow(callback: Function, error: string, message: string) {
    log('shouldThrow called', ...arguments);
};

export function addTest(spec: TestSpec) {
    let {suite, indices, oldIndices, unusedPatches, tests} = globalContext;
    let skip = false;

    if (!spec || !spec.template) {
        log("empty template");
        return;
    }

    var key = (spec.description + ' - ' + spec.it).toLowerCase();
    var oldPatchKey = (spec.oldDescription + '-' + spec.it).toLowerCase();
    var number;
    var name = (function () {
        for (var i = 0; i < 99; i++) {
            var j = ('0' + i).slice(-2);
            var n = key + ' - ' + j;
            if (!indices.hasOwnProperty(n)) {
                number = j;
                return n;
            }
        }
        throw new Error('Failed to acquire test index');
    })();

    var oldName = (function () {
        for (var i = 0; i < 99; i++) {
            var n = oldPatchKey + '-' + ('0' + i).slice(-2);
            if (!oldIndices.hasOwnProperty(n)) {
                return n;
            }
        }
        throw new Error('Failed to acquire test index');
    })();

    (spec as any).number = number;

    // @TODO remove me
    // spec.description = spec.oldDescription;
    // delete spec.oldDescription;
    // @TODO to here

    indices[name] = name;;
    oldIndices[oldName] = oldName;

    var patchFile = resolvePath('./patch/' + '/' + suite + '.json');
    if (existsSync(patchFile)) {
        var patchData = require(patchFile);
        var patch;

        if (patchData.hasOwnProperty(oldName)) {
            patch = patchData[oldName];
            console.warn(key, "|', Old patch should be renamed: " + JSON.stringify(oldName) + " to " + JSON.stringify(name));
        }

        else if (patchData.hasOwnProperty(name)) {
            patch = patchData[name];
        }

        if (typeof patch !== 'undefined') {
            if (patch === null) {
                // Note: setting to null means to skip the test. These will most
                // likely be implementation-dependant. Note that it still has to be
                // added to the indices array
                skip = true;
                console.warn(key, "|", "skipped via patch");
            } else {
                spec = extend(true, spec, patch);
                // Using nulls in patches to unset things
                stripNulls(spec);
                console.warn(key, "|", "applied patch", spec);
            }

            // Track unused patches
            if (unusedPatches === null) {
                unusedPatches = extend({}, patchData);
            }
            delete unusedPatches[name];
            delete unusedPatches[oldName];
        }
    }

    if (!skip) {
        tests.push(spec);
    }
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
