
import * as Handlebars from "handlebars";
import { jsToCode, isFunction, clone, removeCircularReferences, stringifyLambdas, stripNulls, isEmptyObject } from "./utils";
import { CodeDict, TestSpec, StringDict } from "./types";
import { ExpectTemplate } from "./expectTemplate";
import { isArray } from "util";
import { resolve as resolvePath } from "path";
import extend from "extend";
import {existsSync} from "fs";
import { GlobalContext } from "./globalContext";
import { TestContext } from "./testContext";

export {Handlebars};

// export interface TestContext {
//     helpers: CodeDict;
//     partials: StringDict;
//     decorators: CodeDict;

//     template?: string;
//     compileOptions?: {[key: string]: any}; // Handlebars.CompileOptions
//     options?: any;
//     data?: any;
//     description: string;
//     oldDescription?: string;
//     it: string;
//     key?: string;
//     extraEquals?: any[];
//     exception?: boolean;
// }

// export interface GlobalContext {
//     handlebarsEnv: typeof Handlebars;

//     globalHelpers?: CodeDict;
//     globalPartials?: StringDict;
//     globalDecorators?: CodeDict;

//     afterFns: Function[];
//     beforeFns: Function[];
//     descriptionStack: string[];

//     testContext: TestContext;

//     indices: StringDict;
//     oldIndices: StringDict;
//     suite: string;
//     unusedPatches: StringDict;
//     tests: TestSpec[];
// }

export let globalContext: GlobalContext = new GlobalContext();

export function resetContext() {
    //globalContext = clone(defaultGlobalContext);
    // globalContext.testContext = new TestContext();
    delete globalContext.testContext.template;
    delete globalContext.testContext.data;
    delete globalContext.testContext.options;
    delete globalContext.testContext.compileOptions;
    delete globalContext.testContext.helpers;
    delete globalContext./*testContext.*/globalHelpers;
    delete globalContext.testContext.partials;
    delete globalContext./*testContext.*/globalPartials;
    delete globalContext.testContext.decorators;
    delete globalContext./*testContext.*/globalDecorators;
    delete globalContext.testContext.exception;
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
    testContext.key = testContext.description + " - " + testContext.it;

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
    /*
    var spec = {
      description : context.description || context.it,
      oldDescription: context.oldDescription,
      it          : context.it,
      template    : context.template,
      data        : context.data,
      expected    : expected,
    };

    // Remove circular references in data
    removeCircularReferences(spec.data);

    // Get message
    if (message) {
      spec.message = message;
    }

    // Get options
    if( context.options ) {
      spec.options = context.options;
      if( spec.options.data ) {
        stringifyLambdas(spec.options.data);
      }
    }

    // Get compiler options
    if (context.compileOptions) {
      spec.compileOptions = context.compileOptions;
    }

    // Get helpers
    if (context.helpers) {
      spec.helpers = extractHelpers(context.helpers);
    }

    // Get global helpers
    if (context.globalHelpers) {
      spec.globalHelpers = extractHelpers(context.globalHelpers);
    }

    // Get decorators
    if (context.decorators) {
      spec.decorators = extractHelpers(context.decorators);
    }

    // Get global decorators
    if (context.globalDecorators) {
      spec.globalDecorators = extractHelpers(context.globalDecorators);
    }

    // If a template is found in the lexer, use it for the spec. This is true in
    // the case of the tokenizer.
    if (!spec.template && Handlebars.Parser.lexer.matched) {
      spec.template = Handlebars.Parser.lexer.matched;
    }

    // Convert lambdas to object/strings
    stringifyLambdas(spec.data);

    // Add test
    addTest(spec);

    // Reset the context
    resetContext();
    */
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
        console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
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

export function expectTemplate(template: string) {
    return new ExpectTemplate(template, (xt: ExpectTemplate) => {
        compileWithPartials(xt.template, xt.input, null, xt.expected);
    });
};

export function shouldBeToken() {
    // noop
};

export function shouldCompileTo(str: string, hashOrArray: any, expected: any) {
    shouldCompileToWithPartials(str, hashOrArray, null, expected);
};

export function shouldCompileToWithPartials(str: string, hashOrArray: any, partials: any, expected: any, message?: string) {
    globalContext.detectGlobals();
    compileWithPartials(str, hashOrArray, partials, expected, message);
};

export function compileWithPartials(template: string, hashOrArray: any, partials: any, expected: any, message?: string) {
    let {testContext} = globalContext;
    let helpers: CodeDict | undefined;
    let decorators: CodeDict | undefined;
    //let partials: StringDict = {};
    let data: any;
    let compat: undefined | true;
    let compileOptions: any = extend({}, globalContext.testContext.compileOptions);

    partials = testContext.mergePartials(partials);

    if (isArray(hashOrArray)) {
        data = hashOrArray[0];
        helpers = testContext.mergeHelpers(hashOrArray[1]);
        partials = hashOrArray[2];
        if (hashOrArray[3]) {
            if (typeof hashOrArray[3] === 'boolean') {
                compileOptions.compat = compat = true;
            } else if (typeof hashOrArray[3] === 'object') {
                extend(compileOptions, hashOrArray[3]);
            }
        }
        /* if (hashOrArray[4] != null) {
          options.data = !!hashOrArray[4];
          ary[1].data = hashOrArray[4];
        } */
    } else {
        data = hashOrArray;
        if (typeof data === 'object') {
            data = hashOrArray.hash || hashOrArray;
            helpers = testContext.mergeHelpers(hashOrArray.helpers);
            partials = testContext.mergePartials(hashOrArray.partials);
            decorators = testContext.mergeDecorators(hashOrArray.decorators);
            delete data.helpers;
            delete data.partials;
            delete data.decorators;
        }
    }

    let { description, oldDescription, it, extraEquals, exception, options } = globalContext.testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
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
        // oldDescription,
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
};

export function shouldThrow(callback: Function, error: string, message: string) {
    let {testContext} = globalContext;
    testContext.exception = true;

    try {
        callback();
    } catch (err) { }

    delete testContext.exception;

    let { description, oldDescription, it, template, extraEquals } = globalContext.testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
        delete testContext.extraEquals;
    }

    // If a template is found in the lexer, use it for the spec. This is true in
    // the case of the tokenizer.
    if (!template) {
        template = (Handlebars as any).Parser.lexer.matched + (Handlebars as any).Parser.lexer._input;
    }

    var spec: TestSpec = {
        description,
        // oldDescription,
        it,
        template: template as string,
        exception: true,
        message,
        data: undefined,
        expected: undefined,
    };

    // Add the test
    addTest(spec);

    // Reset the context
    resetContext();
};

export function addTest(spec: TestSpec) {
    let {suite, indices, oldIndices, unusedPatches, tests} = globalContext;
    let skip = false;

    if (!spec || !spec.template) {
        console.warn("empty template", spec);
        return;
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

    indices[name] = name;;
    oldIndices[oldName] = oldName;

    var patchFile = resolvePath('./patch/') + '/' + suite + '.json';
    if (existsSync(resolvePath(patchFile))) {
        var patchData = require(patchFile);
        var patch;

        if (patchData.hasOwnProperty(oldName)) {
            patch = patchData[oldName];
            console.warn("Old patch should be renamed: " + JSON.stringify(oldName) + " to " + JSON.stringify(name));
        }

        else if (patchData.hasOwnProperty(name)) {
            patch = patchData[name];
        }

        if (patch) {
            if (patch === null) {
                // Note: setting to null means to skip the test. These will most
                // likely be implementation-dependant. Note that it still has to be
                // added to the indices array
                skip = true;
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
