import { ExpectTemplate } from '../src/expectTemplate';

export const minimal: TestSpec = {
    description: 'render', it: 'omits unused fields', template: 'hello', expected: 'hello',
};

export const tokens: TestSpec = {
    description: 'tokenizer', it: 'token objects', template: '{{foo}}',
    expected: [{ name: 'OPEN', text: '{{' }, { name: 'ID', text: 'foo' }, { name: 'CLOSE', text: '}}' }],
};

export const phpOnly: CodeData = {
    '!code': true, php: 'function ($options) { return strlen($options->scope); }',
};

export const rendering: RenderingFixture = {
    description: 'render', it: 'encoded values', template: '{{> partial}}',
    data: {
        nested: [{ '!code': true, javascript: 'function () { return "value"; }' }, phpOnly],
        sparse: { '!sparsearray': true, '!length': 3, '1': null },
    },
    partials: { partial: { '!code': true, javascript: 'function () { return "value"; }' } },
    helpers: { length: phpOnly },
    compileOptions: { compat: false, stringParams: true, trackIds: true },
    runtimeOptions: { data: { root: null }, allowProtoPropertiesByDefault: false },
    exception: '',
};

export const parser: ParserFixture = {
    description: 'parser', it: 'printed tree', template: '{{foo}}', expected: '{{ PATH:foo [] }}\n',
};

export const tokenizer: TokenizerFixture = {
    description: 'tokenizer', it: 'empty tokens', template: '', expected: [],
};

export const exported: TestSpecWithAst = {
    description: 'export', it: 'compiler-populated options', template: '{{foo}}', expected: '',
    // Exported fixtures contain this compiler-populated array.
    compileOptions: { blockParams: [] },
};

export const unusedStringHelper: RenderingFixture = {
    description: 'basic', it: 'current context does not invoke helpers', template: '{{.}}',
    data: 'hello', helpers: { helper: 'awesome' }, expected: 'hello',
};

export const serializedAst: TestSpecWithAst = {
    description: 'export', it: 'JSON AST locations and legacy strip fields', template: '',
    ast: {
        type: 'Program', body: [], strip: {},
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    },
    partialAsts: { empty: { type: 'Program', body: [], strip: {} } },
};

export const compilerBlockParams: CompileOptions = {
    blockParams: [['item', 'index'], undefined],
};

export const invalidCallbackRegistry: CodeDict = {
    // @ts-expect-error Callback translation registries require tagged callbacks.
    helper: 'awesome',
};

export const invalidSerializedAst: TestSpecWithAst = {
    description: 'export', it: 'raw AST callback', template: '',
    ast: {
        type: 'Program', body: [],
        // @ts-expect-error Serialized AST fields cannot contain live functions.
        callback: () => 'value',
    },
};

export const invalidRendering: RenderingFixture = {
    description: 'render', it: 'wrong result', template: '',
    // @ts-expect-error Rendering results are strings, not token arrays.
    expected: [{ name: 'CONTENT', text: '' }],
};

export const invalidTokenizer: TokenizerFixture = {
    description: 'tokenizer', it: 'wrong result', template: '',
    // @ts-expect-error Tokenizer results are token objects, not rendered strings.
    expected: '',
};

export const invalidToken: HandlebarsToken = {
    name: 'ID',
    // @ts-expect-error Token text must be a string.
    text: 1,
};

export const invalidSerializedData: RenderingFixture = {
    description: 'render', it: 'raw callback', template: '',
    // @ts-expect-error Serialized data cannot contain a live function.
    data: { callback: () => 'value' },
};

export const invalidSerializedPartial: RenderingFixture = {
    description: 'render', it: 'raw partial callback', template: '',
    // @ts-expect-error Fixture partial callbacks use encoded CodeData.
    partials: { callback: () => 'value' },
};

export const invalidRuntimeOptions: RenderingFixture = {
    description: 'render', it: 'raw runtime callback', template: '',
    // @ts-expect-error Serialized runtime options cannot contain a live function.
    runtimeOptions: { callback: () => 'value' },
};

// @ts-expect-error Tokenizer dispatch cannot carry a rendering fixture.
export const invalidLoaded: LoadedFixture = {
    kind: 'tokenizer',
    fixture: rendering,
};

export function inspectLoaded(test: LoadedFixture): void {
    if (test.kind === 'tokenizer') {
        const expected: HandlebarsToken[] | undefined = test.fixture.expected;
        void expected;
        // @ts-expect-error A token expectation is not a string.
        test.fixture.expected?.toUpperCase();
    } else {
        const expected: string | undefined = test.fixture.expected;
        void expected;
        // @ts-expect-error A rendering/parser expectation is not a token array.
        test.fixture.expected?.map((token: HandlebarsToken) => token.name);
    }
}

export function capturePartials(builder: ExpectTemplate): void {
    builder.withPartial('callback', () => 'value');
    builder.withPartials({ text: '{{foo}}', callback: () => 'value' });
    // @ts-expect-error Partials must be template strings or callbacks.
    builder.withPartial('invalid', 42);
}
