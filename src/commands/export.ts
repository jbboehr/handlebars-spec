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

import { Command, command, option, Options, param } from 'clime';
import { resolve as resolvePath } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';

class ExportOptions extends Options {
    @option({
        flag: 'o',
        description: 'Output file',
        required: false,
    })
    outputFile?: string;
    @option({
        description: 'Output format',
        required: false,
    })
    outputFormat?: string;
}

@command({
    description: 'This exports stuff',
})
export default class extends Command {
    execute(
        @param({
            name: 'Input file',
            required: true,
        })
            inputFile: string,
            options: ExportOptions,
    ): void {
        inputFile = resolvePath(inputFile);

        if (!existsSync(inputFile)) {
            throw new Error(inputFile + ' does not exist');
        }

        const inputData = JSON.parse(readFileSync(inputFile).toString());
        const tests: TestSpecWithAst[] = [];

        for (const test of inputData) {
            try {
                tests.push(this.handleTest(test));
            } catch (e) {
                if( !test.exception ) {
                    console.warn(test.description, '-', test.it, '|', 'caught exception, skipping test', e.stack);
                }
            }
        }

        const outputText = JSON.stringify(tests, null, '\t');

        if (options.outputFile) {
            writeFileSync(options.outputFile, outputText);
        } else {
            process.stdout.write(outputText);
        }
    }

    private handleTest(test: TestSpec): TestSpecWithAst {
        const spec: TestSpecWithAst = test;
        const res = this.compile(test.template, test.compileOptions || {});

        spec.ast = res.ast;
        spec.opcodes = res.opcodes;

        if( test.partials ) {
            const partialAsts: any = {};
            const partialOpcodes: any = {};
            Object.keys(test.partials).forEach((y) => {
                const res = this.compile(test.partials[y], test.compileOptions || {});
                partialAsts[y] = res.ast;
                partialOpcodes[y] = res.opcodes;
            });
            spec.partialAsts = partialAsts;
            spec.partialOpcodes = partialOpcodes;
        }

        return spec;
    }

    private compile(input: string, options: CompileOptions): any {
        options = options || {};
        if (!('data' in options)) {  // jshint ignore:line
            options.data = true;
        }
        if (options.compat) {
            options.useDepths = true;
        }

        const ast = Handlebars.parse(input);
        const astCopy = JSON.parse(JSON.stringify(ast));
        const opcodes = new (Handlebars as any).Compiler().compile(ast, options);
        return {
            ast: astCopy,
            opcodes: opcodes
        };
        //return new env.JavaScriptCompiler().compile(environment, options);
    }
}
