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
Object.defineProperty(exports, "__esModule", { value: true });
const clime_1 = require("clime");
const path_1 = require("path");
const fs_1 = require("fs");
class ExportOptions extends clime_1.Options {
}
__decorate([
    clime_1.option({
        flag: 'o',
        description: 'Output file',
        required: false,
    }),
    __metadata("design:type", String)
], ExportOptions.prototype, "outputFile", void 0);
__decorate([
    clime_1.option({
        description: 'Output format',
        required: false,
    }),
    __metadata("design:type", String)
], ExportOptions.prototype, "outputFormat", void 0);
let default_1 = class default_1 extends clime_1.Command {
    execute(inputFile, options) {
        inputFile = path_1.resolve(inputFile);
        if (!fs_1.existsSync(inputFile)) {
            throw new Error(inputFile + ' does not exist');
        }
        const inputData = JSON.parse(fs_1.readFileSync(inputFile).toString());
        const tests = [];
        for (const test of inputData) {
            try {
                tests.push(this.handleTest(test));
            }
            catch (e) {
                if (!test.exception) {
                    console.warn(test.description, '-', test.it, '|', 'caught exception, skipping test', e.stack);
                }
            }
        }
        const outputText = JSON.stringify(tests, null, '\t');
        if (options.outputFile) {
            fs_1.writeFileSync(options.outputFile, outputText);
        }
        else {
            process.stdout.write(outputText);
        }
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
    __param(0, clime_1.param({
        name: 'Input file',
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ExportOptions]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    clime_1.command({
        description: 'This exports stuff',
    })
], default_1);
exports.default = default_1;
//# sourceMappingURL=export.js.map