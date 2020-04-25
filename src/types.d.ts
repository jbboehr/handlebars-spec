
export interface CodeData {
    "!code": string;
    "javascript": string;
    "php": string | null;
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
    description?: string;
    oldDescription?: string;
    it?: string;
    template: string;
    data: any;
    expected?: any;

    exception?: true | string | RegExp;
    helpers?: CodeDict;
    partials?: StringDict;
    decorators?: CodeDict;
    message?: string;
    compat?: boolean;
    runtimeOptions?: any;
    compileOptions?: any;
    globalPartials?: any;
    globalHelpers?: any;
    globalDecorators?: any;
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
