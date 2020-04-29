
import * as Handlebars from 'handlebars';
import { clone, stripNulls, serialize } from './utils';
import { ExpectTemplate } from './expectTemplate';
import { resolve as resolvePath } from 'path';
import extend from 'extend';
import {existsSync, readFileSync} from 'fs';
import { GlobalContext } from './globalContext';
import * as sinon from 'sinon';

export {Handlebars, sinon};

export const globalContext: GlobalContext = new GlobalContext();

export function resetContext(): void {
    globalContext.testContext = globalContext.testContext.reset();
}

function currentTestName(): string {
    return globalContext.testContext.key || '';
}

function log(message?: any, ...optionalParams: any[]): void {
    console.warn.apply(null, [
        currentTestName(),
        '|',
        message,
        // ...optionalParams
    ]);
    if (optionalParams && optionalParams.length >= 1) {
        console.warn.apply(null, (optionalParams as any));
    }
}

class SkipError extends Error {}



// env

export function afterEach(fn: Function): void {
    globalContext.afterFns.push(fn);
}

export function beforeEach(fn: Function): void {
    globalContext.beforeFns.push(fn);
}

export function CompilerContextCompile(template: string, options: object): Function {
    const {testContext} = globalContext;

    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = clone(options);

    const compiledTemplate = Handlebars.compile(template, options);

    return function (data: any, options: any): string {
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

function CompilerContextCompileWithPartial(template: string, options: any): Function {
    const {testContext} = globalContext;

    // Push template unto context
    testContext.template = template;
    testContext.compileOptions = clone(options);
    return Handlebars.compile(template, options);
}

export const CompilerContext = {
    compile: CompilerContextCompile,
    compileWithPartial: CompilerContextCompileWithPartial,
};

export function describe(description: string, next: Function): void {
    const {testContext, descriptionStack} = globalContext;
    let {beforeFns, afterFns} = globalContext;
    beforeFns = [...beforeFns];
    afterFns = [...afterFns];

    descriptionStack.push(description);
    testContext.description = globalContext.descriptionStack.join(' - ');
    testContext.oldDescription = description;

    next();

    descriptionStack.pop();
    delete testContext.oldDescription;
    globalContext.beforeFns = beforeFns;
    globalContext.afterFns = afterFns;
}

export function it(description: string, next: Function): void {
    const {testContext} = globalContext;

    // Call before fns
    globalContext.beforeFns.forEach((fn) => {
        fn();
    });

    // Push test spec unto context
    testContext.it = description;
    testContext.description = globalContext.descriptionStack.join(' - ');
    testContext.key = testContext.description + ' - ' + testContext.it;

    // Test
    next();

    // Call after fns
    globalContext.afterFns.forEach((fn: Function) => {
        fn();
    });
}

export function equals(...args: any[]): void {
    log('equals called', ...args);
}

export function xit(...args: any[]): void {
    log('xit called', ...args);
}

export function expect(): any {
    return {
        to: {
            equal(...args: any[]): void {
                log('expect.to.equal called', ...args);
            },
            be: {
                true(...args: any[]): void {
                    log('expect.to.be.true called', ...args);
                }
            },
            throw(...args: any[]): void {
                log('expect.to.throw called', ...args);
            },
            match(...args: any[]): void {
                log('expect.to.match called', ...args);
            }
        }
    };
}

export function shouldBeToken(...args: any[]): void {
    log('shouldBeToken called', ...args);
}

export function shouldCompileTo(...args: any[]): void {
    log('shouldCompileTo called', ...args);
}

export function shouldCompileToWithPartials(...args: any[]): void {
    log('shouldCompileToWithPartials called', ...args);
}

export function compileWithPartials(...args: any[]): void {
    log('compileWithPartials called', ...args);
}

export function shouldThrow(...args: any[]): void {
    log('shouldThrow called', ...args);
}

export function tokenize(...args: any[]): void {
    log('tokenize called', ...args);
}

export function shouldMatchTokens(...args: any[]): void {
    log('shouldMatchTokens called', ...args);
}

export function expectTemplate(template: string): ExpectTemplate {
    return new ExpectTemplate(template, addExpectTemplate);
}

function addExpectTemplate(xt: ExpectTemplate): void {
    const { testContext, indices, tests} = globalContext;
    const { description, it, extraEquals } = testContext;

    if (extraEquals && Object.keys(extraEquals).length >= 0) {
        console.warn(testContext.key, '|', 'extra equals were called:', extraEquals);
        delete globalContext.testContext.extraEquals;
    }

    // Generate key
    const key = (description + ' - ' + it).toLowerCase();
    function generateName(): [string, string] {
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
    let spec: TestSpec = serialize({
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
    const { suite, unusedPatches } = globalContext;

    const patchFile = resolvePath('./patch/' + '/' + suite + '.json');
    if (!existsSync(patchFile)) {
        return spec;
    }

    // @todo only read once
    const patchData: any = JSON.parse(readFileSync(patchFile).toString());
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
        log('skipped via patch');
        throw new SkipError();
    } else {
        spec = extend(true, spec, patch);
        // Using nulls in patches to unset things
        stripNulls(spec);
        log('applied patch', spec);
    }

    // Track unused patches
    if (unusedPatches === null) {
        extend(unusedPatches, patchData);
    }
    delete unusedPatches[name];

    return spec;
}

function detectGlobalHelpers(): FunctionDict {
    const { handlebarsEnv } = (global as any);
    const builtins = [
        'helperMissing', 'blockHelperMissing', 'each', 'if',
        'unless', 'with', 'log', 'lookup'
    ];
    const globalHelpers: FunctionDict = {};

    Object.keys(handlebarsEnv.helpers).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalHelpers[x] = /*jsToCode(*/handlebarsEnv.helpers[x]/*)*/;
    });

    return globalHelpers;
}

function detectGlobalDecorators(): FunctionDict {
    const { handlebarsEnv } = (global as any);
    const builtins = ['inline'];
    const globalDecorators: FunctionDict = {};

    Object.keys(handlebarsEnv.decorators).forEach((x) => {
        if (builtins.indexOf(x) !== -1) {
            return;
        }
        globalDecorators[x] = /*jsToCode(*/handlebarsEnv.decorators[x]/*)*/;
    });

    return globalDecorators;
}

function detectGlobalPartials(): StringDict {
    const { handlebarsEnv } = (global as any);
    // This should never be null, but it is in one case
    if (!handlebarsEnv) {
        return {};
    }

    const globalPartials: StringDict = {};

    Object.keys(handlebarsEnv.partials).forEach((x) => {
        globalPartials[x] = handlebarsEnv.partials[x];
    });

    return globalPartials;
}
