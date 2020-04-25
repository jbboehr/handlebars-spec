
import * as Handlebars from "handlebars";
import { jsToCode, isFunction, clone, removeCircularReferences, stringifyLambdas, stripNulls, isEmptyObject } from "./utils";
import { CodeDict, TestSpec, StringDict, FunctionDict } from "./types";
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
    testContext.globalHelpers = globalContext.globalHelpers;
    testContext.globalPartials = globalContext.globalPartials;
    testContext.globalDecorators = globalContext.globalDecorators;

    // Test
    next();

    // Remove test spec from context
    if (testContext.extraEquals) {
        console.warn(testContext.key, "|", "extra equals called in unhandled block:", testContext.extraEquals);
        // delete testContext.extraEquals;
    }

    // delete testContext.it;

    // Call after fns
    globalContext.afterFns.forEach((fn: Function) => {
        fn();
    });
};

export function equals(actual: any, expected: any, message?: string) {
    let {testContext} = globalContext;

    if (!actual && !expected && !message) {
        return;
    }

    if (!testContext.extraEquals) {
        testContext.extraEquals = [];
    }

    testContext.extraEquals.push({
        // actual,
        expected,
        message,
    });
    //console.warn('equals called in "' + descriptionStack.join(' - ') + ' - ' + context.it + '"');
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
    // noop
}

export function expect() {
    return {
        to: {
            equal: function () {
                console.warn('expect.to.equal called');
            },
            be: {
                true: function () {
                    console.warn('expect.to.be.true called');
                }
            }
        }
    };
};

function addExpectTemplate(xt: ExpectTemplate) {
    let { testContext } = globalContext;
    let { description, oldDescription, it, extraEquals } = testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
    }

    var spec: TestSpec = {
        description,
        oldDescription,
        it,
        template: xt.template,
        data: stringifyLambdas(removeCircularReferences(xt.input)),
        expected: xt.expected,
        runtimeOptions: stringifyLambdas(xt.runtimeOptions),
        compileOptions: xt.compileOptions,
        partials: stringifyLambdas(xt.partials),
        helpers: stringifyLambdas(xt.helpers),
        decorators: stringifyLambdas(xt.decorators),
        message: xt.message,
        compat: (xt.compileOptions || {}).compat,
        exception: xt.exception,
    };

    if (globalContext.globalPartials) {
        spec.globalPartials = globalContext.globalPartials;
    }

    if (globalContext.globalHelpers) {
        spec.globalHelpers = globalContext.globalHelpers;
    }

    if (globalContext.globalDecorators) {
        spec.globalDecorators = globalContext.globalDecorators;
    }

    // Add the test
    addTest(spec);

    // Reset the context
    resetContext();
}

export function expectTemplate(template: string) {
    return new ExpectTemplate(template, (xt: ExpectTemplate) => {
        globalContext.detectGlobals();
        addExpectTemplate(xt);
    });
};

export function shouldBeToken() {
    // noop
};

export function shouldCompileTo(str: string, hashOrArray: any, expected: any, message?: string) {
    shouldCompileToWithPartials(str, hashOrArray, null, expected, message);
};

export function shouldCompileToWithPartials(str: string, hashOrArray: any, partials: any, expected: any, message?: string) {
    compileWithPartials(str, hashOrArray, partials, expected, message);
};

export function compileWithPartials(template: string, hashOrArray: any, partials?: StringDict, expected?: any, message?: string) {
    // let {testContext} = globalContext;
    let helpers: FunctionDict = {};
    let decorators: FunctionDict = {};
    //let partials: StringDict = {};
    let input: any;
    // let compat: undefined | true;
    let compileOptions: any = extend({}, globalContext.testContext.compileOptions);

    // partials = testContext.mergePartials(partials);

    if (isArray(hashOrArray)) {
        input = hashOrArray[0];
        helpers = hashOrArray[1];
        // helpers = testContext.mergeHelpers(hashOrArray[1]);
        partials = hashOrArray[2];
        if (hashOrArray[3]) {
            if (typeof hashOrArray[3] === 'boolean') {
                compileOptions.compat = true;
            } else if (typeof hashOrArray[3] === 'object') {
                extend(compileOptions, hashOrArray[3]);
            }
        }
        /* if (hashOrArray[4] != null) {
          options.data = !!hashOrArray[4];
          ary[1].data = hashOrArray[4];
        } */
    } else {
        input = hashOrArray;
        if (typeof input === 'object') {
            input = hashOrArray.hash || hashOrArray;
            helpers = hashOrArray.helpers; //testContext.mergeHelpers(hashOrArray.helpers);
            partials = hashOrArray.partials; //testContext.mergePartials(hashOrArray.partials);
            decorators = hashOrArray.decorators; //testContext.mergeDecorators(hashOrArray.decorators);
            delete input.helpers;
            delete input.partials;
            delete input.decorators;
        }
    }

    let xt = expectTemplate(template)
        .withHelpers(helpers || {})
        .withPartials(partials || {})
        .withDecorators(decorators || {})
        .withCompileOptions(compileOptions)
        .withInput(input);
    if (message) {
        xt.withMessage(message);
    }

    xt.toCompileTo(expected);

    /*
    let { description, oldDescription, it, extraEquals, exception, options } = globalContext.testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
    }

    if (options && options.data) {
        options.data = stringifyLambdas(options.data);
    }

    if (compileOptions && isEmptyObject(compileOptions)) {
        compileOptions = undefined;
    }

    removeCircularReferences(data);
    stringifyLambdas(data);
    stringifyLambdas(partials);

    var spec: TestSpec = {
        description,
        oldDescription,
        it,
        template,
        data,
        expected,
        partials,
        helpers,
        decorators,
        message,
        compat,
        exception,
        options,
        compileOptions,
    };

    if (globalContext.globalPartials) {
        spec.globalPartials = globalContext.globalPartials;
    }

    if (globalContext.globalHelpers) {
        spec.globalHelpers = globalContext.globalHelpers;
    }

    if (globalContext.globalDecorators) {
        spec.globalDecorators = globalContext.globalDecorators;
    }

    // Add the test
    addTest(spec);

    // Reset the context
    resetContext();
    */
};

export function shouldThrow(callback: Function, error: string, message: string) {
    console.warn
};

export function addTest(spec: TestSpec) {
    let {suite, indices, oldIndices, unusedPatches, tests} = globalContext;
    let skip = false;

    if (!spec || !spec.template) {
        console.warn("empty template", spec);
        return;
    }

    // Cleanup a few keys
    for (var x of ['partials', 'helpers', 'decorators', 'compileOptions', 'runtimeOptions', 'globalPartials', 'globalHelpers', 'globalDecorators']) {
        if (!(spec as any)[x] || isEmptyObject((spec as any)[x])) {
            delete (spec as any)[x];
        }
    }

    var key = (spec.description + ' - ' + spec.it).toLowerCase();
    var oldPatchKey = (spec.oldDescription + '-' + spec.it).toLowerCase();
    var name = (function () {
        for (var i = 0; i < 99; i++) {
            var n = key + ' - ' + ('0' + i).slice(-2);
            if (!indices.hasOwnProperty(n)) {
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

    // @TODO remove me
    spec.description = spec.oldDescription;
    delete spec.oldDescription;
    // @TODO to here

    indices[name] = name;;
    oldIndices[oldName] = oldName;

    var patchFile = resolvePath('./patch/' + '/' + suite + '.json');
    if (existsSync(patchFile)) {
        var patchData = require(patchFile);
        var patch;

        if (patchData.hasOwnProperty(oldName)) {
            patch = patchData[oldName];
            console.warn("Old patch should be renamed: " + JSON.stringify(oldName) + " to " + JSON.stringify(name));
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
                console.log(key, "|", "skipped via patch");
            } else {
                spec = extend(true, spec, patch);
                // Using nulls in patches to unset things
                stripNulls(spec);
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
