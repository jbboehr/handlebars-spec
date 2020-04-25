import { Command, command, option, Options, param } from 'clime';
import * as path from "path";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import * as mockGlobals from "../mockGlobals";
import { stringifyLambdas, clone, isEmptyObject, jsToCode } from '../utils';
import { isFunction } from 'util';

export class OutputFileOptions extends Options {
    @option({
        flag: 'o',
        description: 'Output file',
        required: false,
    })
    outputFile?: string;
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
    ) {
        let suite = path.basename(inputFile).replace(/\.js$/, '');

        if (!existsSync(inputFile)) {
            console.error('The input file does not exist');
            return process.exit(66);
        }

        // Patch globals
        let origGlobals: { [key: string]: any } = {};
        for (let x in mockGlobals) {
            origGlobals[x] = (global as any)[x];
        }
        for (let x in mockGlobals) {
            (global as any)[x] = (mockGlobals as any)[x];
        }
        mockGlobals.globalContext.suite = suite;

        // Need to patch out some global functions for the tokenizer
        if (inputFile.match(/tokenizer\.js$/)) {
            let tokenizerData = ('' + readFileSync(inputFile))
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

        let outputFile = path.resolve(options.outputFile);

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

function extractHelpers(data: any) {
    var helpers: any = {};

    if (!data || typeof data !== 'object') {
      return false;
    }

    Object.keys(data).forEach(function (el) {
      if (isFunction(data[el])) {
        helpers[el] = jsToCode(data[el]);
      }
    });

    return isEmptyObject(helpers) ? false : helpers;
  }
