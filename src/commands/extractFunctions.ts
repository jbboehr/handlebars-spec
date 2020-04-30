
import { Command, command, params } from 'clime';
import { OutputFileOptions } from './generate';
import { readFileSync, writeFileSync } from 'fs';
import { normalizeJavascript } from '../utils';
import deepEqual from 'deep-equal';
import {stringify as hjsonStringify, parse as hjsonParse} from 'hjson';

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
    ): void {
        let fns: CodeDict = {};

        for (let i = 0; i < args.length; i++) {
            const filestr = readFileSync(args[i]).toString();
            let data;
            if (args[i].endsWith('.hjson')) {
                data = hjsonParse(filestr);
            } else {
                data = JSON.parse(filestr);
            }
            fns = this.extract(data, fns);
        }

        if (options.outputFile && options.outputFile.endsWith('.hjson')) {
            options.outputFormat = "hjson";
        }

        let output;
        if (options.outputFormat === 'hjson') {
            output = hjsonStringify(fns, {
                bracesSameLine: true,
                space: '\t'
            });
        } else {
            output = JSON.stringify(fns, null, '\t');
        }

        if (options.outputFile) {
            writeFileSync(options.outputFile, output);
        } else {
            process.stdout.write(output);
        }
    }

    private extract(data: any, prev: CodeDict): CodeDict {
        if (typeof data !== 'object' || !data) {
            return prev;
        }

        if (data.hasOwnProperty('!code')) {
            const js = data['javascript'];
            if (!js) {
                console.warn('js key not set');
                return prev;
            }
            const key = normalizeJavascript(js);
            if (key in prev) {
                if (!deepEqual(prev[key], data)) {
                    console.warn('key already set and mismatch', key, prev[key], data);
                }
            }
            prev[key] = data;
        }

        for (const x in data) {
            if (data.hasOwnProperty(x)) {
                this.extract(data[x], prev);
            }
        }

        return prev;
    }
}
