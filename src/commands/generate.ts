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
import * as path from 'path';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import * as mockGlobals from '../mockGlobals';

export class OutputFileOptions extends Options {
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
    description: 'This generates the spec json files from the handlebars test suite',
})
export default class extends Command {
    execute(
        @param({
            name: 'Input file',
            required: true,
        })
            inputFile: string,
            options: OutputFileOptions,
    ): void {
        const suite = path.basename(inputFile).replace(/\.js$/, '');

        if (!existsSync(inputFile)) {
            console.error('The input file does not exist');
            return process.exit(66);
        }

        // Patch globals
        const origGlobals: { [key: string]: any } = {};
        for (const x in mockGlobals) {
            origGlobals[x] = (global as any)[x];
        }
        for (const x in mockGlobals) {
            (global as any)[x] = (mockGlobals as any)[x];
        }
        mockGlobals.globalContext.suite = suite;

        if (inputFile.match(/parser\.js$/)) {
            mockGlobals.globalContext.isParser = true;
        }

        // Need to patch out some global functions for the tokenizer
        if (inputFile.match(/tokenizer\.js$/)) {
            mockGlobals.globalContext.isParser = true;
            const tokenizerData = ('' + readFileSync(inputFile))
                .replace(/function shouldMatchTokens/, 'function REMshouldMatchTokens')
                .replace(/function shouldBeToken/, 'function REMshouldBeToken')
                .replace(/function tokenize/, 'global.originalTokenize = function');
            inputFile = inputFile.replace(/\.js$/, '.tmp.js');
            writeFileSync(inputFile, tokenizerData);
            process.on('exit', function () {
                unlinkSync(inputFile);
            });
        }

        require(path.resolve(inputFile));


        let output;
        try {
            output = JSON.stringify(mockGlobals.globalContext.tests, null, '\t');
        } catch (e) {
            console.log('Failed converting to JSON: ' + inputFile + ' (' + e + ')');
            return process.exit(70);
        }

        if (!options.outputFile) {
            return console.log(output);
        }

        const outputFile = path.resolve(options.outputFile);

        try {
            writeFileSync(outputFile, output);
            console.log('JSON saved to ' + options.outputFile);
            /*
            if (unusedPatches !== null) {
                unusedPatches = Object.keys(unusedPatches);
                if (unusedPatches.length) {
                    console.log("Unused patches: " + unusedPatches);
                }
            }
            */
        } catch (e) {
            console.log(e);
            return process.exit(73);
        }


    }
}
