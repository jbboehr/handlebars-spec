
export interface CodeData {
    "!code": true;
    "javascript": string;
    "php"?: string;
}

export interface CodeDict {
    [key: string]: CodeData;
}

export interface FunctionDict {
    [key: string]: Function | string;
}

export interface StringDict {
    [key: string]: string;
}

export interface IExpectTemplate {
    template: string;
    helpers: FunctionDict;
    partials: StringDict;
    decorators: FunctionDict;
    input?: any;
    expected?: string;
    message?: string;
    compileOptions?: CompileOptions;
    runtimeOptions?: RuntimeOptions;
    exception?: true | string | RegExp;
}

export interface TestSpec {
    description: string;
    it: string
    number: string
    template: string;
    data: any;
    expected: string;
    runtimeOptions?: RuntimeOptions;
    compileOptions?: CompileOptions;
    partials: CodeDict;
    helpers: StringDict;
    decorators: CodeDict;
    message?: string;
    compat?: true,
    exception?: true | string;
}

// copied from handlebars since they don't fucking export it
export interface CompileOptions {
    data?: boolean;
    compat?: boolean;
    knownHelpers?: {[key: string]: boolean};
    knownHelpersOnly?: boolean;
    noEscape?: boolean;
    strict?: boolean;
    assumeObjects?: boolean;
    preventIndent?: boolean;
    ignoreStandalone?: boolean;
    explicitPartialContext?: boolean;
}
