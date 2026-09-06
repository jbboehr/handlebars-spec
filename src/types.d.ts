/**
 * Copyright (c) anno Domini nostri Jesu Christi MMXX-MMXXIV John Boehr & contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

type CodeData = {
    '!code': true;
    'javascript'?: string;
    'php'?: string;
    'phpstub'?: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface CodeDict {
    [key: string]: CodeData;
}

interface SerializedHelperMap {
    [key: string]: string | CodeData;
}

interface FunctionDict {
    [key: string]: Function | string;
}

interface StringDict {
    [key: string]: string;
}

interface PatchDict {
    [key: string]: any;
}

interface ExpectTemplateInterface {
    template: string;
    helpers: FunctionDict;
    partials: FunctionDict;
    decorators: FunctionDict;
    input?: any;
    expected?: string | HandlebarsToken[];
    message?: string;
    compileOptions?: CompileOptions;
    runtimeOptions?: RuntimeOptions;
    exception?: true | string | RegExp;
}

interface TestSpec<Expected extends string | HandlebarsToken[] = string | HandlebarsToken[]> {
    description: string;
    it: string;
    number?: string;
    template: string;
    data?: JsonValue;
    expected?: Expected;
    runtimeOptions?: { [key: string]: JsonValue };
    compileOptions?: CompileOptions;
    partials?: { [key: string]: string | CodeData };
    helpers?: SerializedHelperMap;
    decorators?: CodeDict;
    message?: string;
    note?: string;
    compat?: boolean;
    exception?: true | string;
}

type RenderingFixture = TestSpec<string>;
type ParserFixture = TestSpec<string>;
type TokenizerFixture = TestSpec<HandlebarsToken[]>;

type LoadedFixture =
    | { kind: 'render'; fixture: RenderingFixture }
    | { kind: 'parser'; fixture: ParserFixture }
    | { kind: 'tokenizer'; fixture: TokenizerFixture };

interface SerializedAstProgram {
    type: 'Program';
    body: JsonValue[];
    [key: string]: JsonValue;
}

interface TestSpecWithAst extends TestSpec {
    ast?: SerializedAstProgram;
    opcodes?: unknown;
    partialAsts?: { [key: string]: SerializedAstProgram };
    partialOpcodes?: { [key: string]: unknown };
}

// copied from handlebars since they don't fucking export it
interface CompileOptions {
    // The compiler adds this stack to track block parameters in nested programs.
    blockParams?: (string[] | undefined)[];
    data?: boolean;
    compat?: boolean;
    knownHelpers?: {[key: string]: boolean};
    knownHelpersOnly?: boolean;
    noEscape?: boolean;
    strict?: boolean;
    stringParams?: boolean;
    trackIds?: boolean;
    assumeObjects?: boolean;
    preventIndent?: boolean;
    ignoreStandalone?: boolean;
    explicitPartialContext?: boolean;

    // Handlebars sets this flag when compat mode is enabled.
    useDepths?: boolean;
}

interface HandlebarsToken {
    name: string;
    text: string;
}
