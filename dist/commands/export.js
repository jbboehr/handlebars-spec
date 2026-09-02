"use strict";
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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const clime_1 = require("clime");
const path_1 = require("path");
const fs_1 = require("fs");
class ExportOptions extends clime_1.Options {
}
__decorate([
    (0, clime_1.option)({
        flag: 'o',
        description: 'Output file',
        required: false,
    }),
    __metadata("design:type", String)
], ExportOptions.prototype, "outputFile", void 0);
__decorate([
    (0, clime_1.option)({
        description: 'Output format',
        required: false,
    }),
    __metadata("design:type", String)
], ExportOptions.prototype, "outputFormat", void 0);
let default_1 = class extends clime_1.Command {
    execute(inputFile, options) {
        inputFile = (0, path_1.resolve)(inputFile);
        if (!(0, fs_1.existsSync)(inputFile)) {
            throw new Error(inputFile + ' does not exist');
        }
        const suite = (0, path_1.basename)(inputFile, '.json');
        const localOmissionFile = (0, path_1.resolve)('patch', '_export.json');
        const packagedOmissionFile = (0, path_1.resolve)(__dirname, '..', '..', 'patch', '_export.json');
        const omissionFile = (0, fs_1.existsSync)(localOmissionFile)
            ? localOmissionFile
            : packagedOmissionFile;
        const omissionSuites = (0, fs_1.existsSync)(omissionFile)
            ? JSON.parse((0, fs_1.readFileSync)(omissionFile).toString())
            : {};
        const omissions = omissionSuites[suite] || {};
        const unusedOmissions = new Set(Object.keys(omissions));
        const inputData = JSON.parse((0, fs_1.readFileSync)(inputFile).toString());
        const tests = [];
        for (const test of inputData) {
            const name = this.testName(test);
            try {
                tests.push(this.handleTest(test));
            }
            catch (e) {
                if (!unusedOmissions.delete(name)) {
                    console.error(name, '| unexpected export failure', e);
                    return process.exit(65);
                }
                console.warn(name, '| skipped via export omission:', omissions[name]);
            }
        }
        const unused = Array.from(unusedOmissions);
        if (unused.length) {
            console.error('Unused export omissions:\n' + unused.join('\n'));
            return process.exit(65);
        }
        const outputText = JSON.stringify(tests, null, '\t');
        if (options.outputFile) {
            (0, fs_1.writeFileSync)(options.outputFile, outputText);
        }
        else {
            process.stdout.write(outputText);
        }
    }
    testName(test) {
        return (test.description + ' - ' + test.it + ' - ' + (test.number || '00')).toLowerCase();
    }
    handleTest(test) {
        const spec = test;
        const res = this.compile(test.template, test.compileOptions || {});
        spec.ast = res.ast;
        spec.opcodes = res.opcodes;
        if (test.partials) {
            const partialAsts = {};
            const partialOpcodes = {};
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
    compile(input, options) {
        options = options || {};
        if (!('data' in options)) { // jshint ignore:line
            options.data = true;
        }
        if (options.compat) {
            options.useDepths = true;
        }
        const ast = Handlebars.parse(input);
        const astCopy = JSON.parse(JSON.stringify(ast));
        const opcodes = new Handlebars.Compiler().compile(ast, options);
        return {
            ast: astCopy,
            opcodes: opcodes
        };
        //return new env.JavaScriptCompiler().compile(environment, options);
    }
};
__decorate([
    __param(0, (0, clime_1.param)({
        name: 'Input file',
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ExportOptions]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    (0, clime_1.command)({
        description: 'This exports stuff',
    })
], default_1);
exports.default = default_1;
//# sourceMappingURL=export.js.map