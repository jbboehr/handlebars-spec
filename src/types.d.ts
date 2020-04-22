
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

export interface TestSpec {
    description?: string;
    oldDescription?: string;
    it?: string;
    template: string;
    data: any;
    expected: any;

    exception?: boolean;
    helpers?: CodeDict;
    partials?: StringDict;
    decorators?: CodeDict;
    message?: string;
    compat?: boolean;
    options?: any;
    compileOptions?: any;
    globalPartials?: any;
    globalHelpers?: any;
    globalDecorators?: any;
}
