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
            options.outputFormat = 'hjson';
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
