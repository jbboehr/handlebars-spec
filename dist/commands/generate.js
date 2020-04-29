"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const clime_1 = require("clime");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const mockGlobals = __importStar(require("../mockGlobals"));
class OutputFileOptions extends clime_1.Options {
}
__decorate([
    clime_1.option({
        flag: 'o',
        description: 'Output file',
        required: false,
    }),
    __metadata("design:type", String)
], OutputFileOptions.prototype, "outputFile", void 0);
__decorate([
    clime_1.option({
        description: 'Output format',
        required: false,
    }),
    __metadata("design:type", String)
], OutputFileOptions.prototype, "outputFormat", void 0);
exports.OutputFileOptions = OutputFileOptions;
let default_1 = class default_1 extends clime_1.Command {
    execute(inputFile, options) {
        let suite = path.basename(inputFile).replace(/\.js$/, '');
        if (!fs_1.existsSync(inputFile)) {
            console.error('The input file does not exist');
            return process.exit(66);
        }
        // Patch globals
        let origGlobals = {};
        for (let x in mockGlobals) {
            origGlobals[x] = global[x];
        }
        for (let x in mockGlobals) {
            global[x] = mockGlobals[x];
        }
        mockGlobals.globalContext.suite = suite;
        // Need to patch out some global functions for the tokenizer
        if (inputFile.match(/tokenizer\.js$/)) {
            let tokenizerData = ('' + fs_1.readFileSync(inputFile))
                .replace(/function shouldMatchTokens/, 'function REMshouldMatchTokens')
                .replace(/function shouldBeToken/, 'function REMshouldBeToken')
                .replace(/function tokenize/, 'global.originalTokenize = function');
            inputFile = inputFile.replace(/\.js$/, '.tmp.js');
            fs_1.writeFileSync(inputFile, tokenizerData);
            process.on('exit', function () {
                fs_1.unlinkSync(inputFile);
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
        let outputFile = path.resolve(options.outputFile);
        try {
            fs_1.writeFileSync(outputFile, output);
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
    __param(0, clime_1.param({
        name: 'Input file',
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, OutputFileOptions]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    clime_1.command({
        description: 'This generates the spec json files from the handlebars test suite',
    })
], default_1);
exports.default = default_1;
//# sourceMappingURL=generate.js.map