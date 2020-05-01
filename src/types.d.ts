/**
 * Copyright (C) 2020 John Boehr
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

interface CodeData {
    '!code': true;
    'javascript': string;
    'php'?: string;
}

interface CodeDict {
    [key: string]: CodeData;
}

interface FunctionDict {
    [key: string]: Function | string;
}

interface StringDict {
    [key: string]: string;
}

interface ExpectTemplateInterface {
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

interface TestSpec {
    description: string;
    it: string;
    number: string;
    template: string;
    data: any;
    expected: string;
    runtimeOptions?: RuntimeOptions;
    compileOptions?: CompileOptions;
    partials: StringDict;
    helpers: CodeDict;
    decorators: CodeDict;
    message?: string;
    compat?: true;
    exception?: true | string;
}

interface TestSpecWithAst extends TestSpec {
    ast?: any;
    opcodes?: any;
    partialAsts?: any;
    partialOpcodes?: any;
}

// copied from handlebars since they don't fucking export it
interface CompileOptions {
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

    // is this a real option?
    useDepths?: boolean;
}

interface HandlebarsToken {
    name: string;
    text: string;
}
