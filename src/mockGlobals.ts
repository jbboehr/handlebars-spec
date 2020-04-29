
import * as Handlebars from 'handlebars';
import { stripNulls, serialize } from './utils';
import { ExpectTemplate } from './expectTemplate';
import { resolve as resolvePath } from 'path';
import extend from 'extend';
import { existsSync, readFileSync } from 'fs';
import { GlobalContext } from './globalContext';
import * as sinon from 'sinon';

export {Handlebars, sinon};

export const globalContext: GlobalContext = new GlobalContext();

function log(message?: any, ...optionalParams: any[]): void {
    console.warn.apply(null, [
        globalContext.testContext.key || '',
        '|',
        message,
        // ...optionalParams
    ]);
    if (optionalParams && optionalParams.length >= 1) {
        console.warn.apply(null, (optionalParams as any));
    }
}

class SkipError extends Error {}

export function afterEach(fn: Function): void {
    globalContext.afterFns.push(fn);
}

export function beforeEach(fn: Function): void {
    globalContext.beforeFns.push(fn);
}

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

export function expectTemplate(template: string): ExpectTemplate {
    return new ExpectTemplate(template, addExpectTemplate);
}

function addExpectTemplate(xt: ExpectTemplate): void {
    const { testContext, indices, tests, isParser } = globalContext;
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
    if (isParser) {
        delete spec.data;
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
    globalContext.testContext = globalContext.testContext.reset();
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



// only used by parser and tokenizer

export function equals(actual: any, expected: any): void {
    const { testContext, isParser } = globalContext;

    if (isParser) {
        // Read the template from the lexer
        const template = testContext.template || (Handlebars as any).Parser.lexer.matched;
        expectTemplate(template)
            .withInput(undefined)
            .toCompileTo(expected);
    } else {
        log('equals called', actual, expected);
    }
}

export function shouldThrow(cb: Function, a: any, b: any): void {
    const { testContext, isParser } = globalContext;

    if (isParser) {
        testContext.exception = b || true;

        let ex = null;
        try {
            cb();
        } catch (e) {
            ex = e;
        }
        if (!ex) {
            throw new Error('test did not throw but should have');
        }

        // Read the template from the lexer
        const template = testContext.template || (Handlebars as any).Parser.lexer.matched;
        expectTemplate(template)
            .withInput(undefined)
            .toThrow(a, b);

        delete testContext.exception;
    } else {
        log('shouldThrow called', a, b);
    }
}

export function tokenize(template: string): string[] {
    const { testContext, isParser } = globalContext;

    if (isParser) {
        testContext.template = template;
    } else {
        log('tokenize called', template);
    }

    return (global as any).originalTokenize(template);
}

export function shouldMatchTokens(actual: string[], expected: string[]): void {
    const { testContext, isParser } = globalContext;

    if (isParser) {
        expectTemplate(testContext.template || '')
            .toCompileTo(actual);
    } else {
        log('shouldMatchTokens called', actual, expected);
    }
}



// these functions don't need to do anything, just warn and ignore

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
