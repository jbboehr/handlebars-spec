
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

        // Need to patch out some global functions for the tokenizer
        if (inputFile.match(/tokenizer\.js$/)) {
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
