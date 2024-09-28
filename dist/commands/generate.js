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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputFileOptions = void 0;
const clime_1 = require("clime");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const mockGlobals = __importStar(require("../mockGlobals"));
class OutputFileOptions extends clime_1.Options {
}
exports.OutputFileOptions = OutputFileOptions;
__decorate([
    (0, clime_1.option)({
        flag: 'o',
        description: 'Output file',
        required: false,
    }),
    __metadata("design:type", String)
], OutputFileOptions.prototype, "outputFile", void 0);
__decorate([
    (0, clime_1.option)({
        description: 'Output format',
        required: false,
    }),
    __metadata("design:type", String)
], OutputFileOptions.prototype, "outputFormat", void 0);
let default_1 = class extends clime_1.Command {
    execute(inputFile, options) {
        const suite = path.basename(inputFile).replace(/\.js$/, '');
        if (!(0, fs_1.existsSync)(inputFile)) {
            console.error('The input file does not exist');
            return process.exit(66);
        }
        // Patch globals
        const origGlobals = {};
        for (const x in mockGlobals) {
            origGlobals[x] = global[x];
        }
        for (const x in mockGlobals) {
            global[x] = mockGlobals[x];
        }
        mockGlobals.globalContext.suite = suite;
        if (inputFile.match(/parser\.js$/)) {
            mockGlobals.globalContext.isParser = true;
        }
        // Need to patch out some global functions for the tokenizer
        if (inputFile.match(/tokenizer\.js$/)) {
            mockGlobals.globalContext.isParser = true;
            const tokenizerData = ('' + (0, fs_1.readFileSync)(inputFile))
                .replace(/function shouldMatchTokens/, 'function REMshouldMatchTokens')
                .replace(/function shouldBeToken/, 'function REMshouldBeToken')
                .replace(/function tokenize/, 'global.originalTokenize = function');
            inputFile = inputFile.replace(/\.js$/, '.tmp.js');
            (0, fs_1.writeFileSync)(inputFile, tokenizerData);
            process.on('exit', function () {
                (0, fs_1.unlinkSync)(inputFile);
            });
        }
        require(path.resolve(inputFile));
        let output;
        try {
            output = JSON.stringify(mockGlobals.globalContext.tests, null, '\t');
        }
        catch (e) {
            console.log('Failed converting to JSON: ' + inputFile + ' (' + e + ')');
            return process.exit(70);
        }
        if (!options.outputFile) {
            return console.log(output);
        }
        const outputFile = path.resolve(options.outputFile);
        try {
            (0, fs_1.writeFileSync)(outputFile, output);
            console.log('JSON saved to ' + options.outputFile);
            /*
            if (unusedPatches !== null) {
                unusedPatches = Object.keys(unusedPatches);
                if (unusedPatches.length) {
                    console.log("Unused patches: " + unusedPatches);
                }
            }
            */
        }
        catch (e) {
            console.log(e);
            return process.exit(73);
        }
    }
};
__decorate([
    __param(0, (0, clime_1.param)({
        name: 'Input file',
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, OutputFileOptions]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    (0, clime_1.command)({
        description: 'This generates the spec json files from the handlebars test suite',
    })
], default_1);
exports.default = default_1;
//# sourceMappingURL=generate.js.map