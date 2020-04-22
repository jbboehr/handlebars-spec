import { Command, command, params } from 'clime';
import { OutputFileOptions } from './generate';
import { readFileSync, writeFileSync } from 'fs';
import { CodeDict } from '../types';
import { normalizeJavascript } from '../utils';
import deepEqual from "deep-equal";

@command({
    description: 'This extracts functions from the existing spec files into a translation table',
})
export default class extends Command {
    execute(
        @params({
          type: String,
          description: 'input files',
          required: true,
        })
        args: string[],
        options: OutputFileOptions,
    ) {
        let fns: CodeDict = {};

        for (var i = 0; i < args.length; i++) {
            var filestr = readFileSync(args[i]);
            var data = JSON.parse(filestr.toString());
            fns = this.extract(data, fns);
        }

        const output = JSON.stringify(fns, null, '\t');

        if (options.outputFile) {
            writeFileSync(options.outputFile, output);
        } else {
            process.stdout.write(output);
        }
    }

    private extract(data: any, prev: CodeDict): CodeDict {
        if (typeof data !== "object" || !data) {
            return prev;
        }

        if (data.hasOwnProperty("!code")) {
            var js = data['javascript'];
            if (!js) {
                console.warn('js key not set');
                return prev;
            }
            var key = normalizeJavascript(js);
            if (key in prev) {
                if (!deepEqual(prev[key], data)) {
                    console.warn('key already set and mismatch', key, prev[key], data);
                }
            }
            prev[key] = data;
        }

        for (var x in data) {
            if (data.hasOwnProperty(x)) {
                this.extract(data[x], prev);
            }
        }

        return prev;
    }
}
