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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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
const generate_1 = require("./generate");
const fs_1 = require("fs");
const utils_1 = require("../utils");
const deep_equal_1 = __importDefault(require("deep-equal"));
const hjson = __importStar(require("hjson"));
let default_1 = class default_1 extends clime_1.Command {
    execute(args, options) {
        let fns = {};
        for (let i = 0; i < args.length; i++) {
            const filestr = fs_1.readFileSync(args[i]).toString();
            let data;
            if (args[i].endsWith('.hjson')) {
                data = hjson.parse(filestr);
            }
            else {
                data = JSON.parse(filestr);
            }
            fns = this.extract(data, fns);
        }
        let output;
        if (options.outputFormat === 'hjson') {
            output = hjson.stringify(fns, {
                bracesSameLine: true,
                space: '\t'
            });
        }
        else {
            output = JSON.stringify(fns, null, '\t');
        }
        if (options.outputFile) {
            fs_1.writeFileSync(options.outputFile, output);
        }
        else {
            process.stdout.write(output);
        }
    }
    extract(data, prev) {
        if (typeof data !== 'object' || !data) {
            return prev;
        }
        if (data.hasOwnProperty('!code')) {
            const js = data['javascript'];
            if (!js) {
                console.warn('js key not set');
                return prev;
            }
            const key = utils_1.normalizeJavascript(js);
            if (key in prev) {
                if (!deep_equal_1.default(prev[key], data)) {
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
};
__decorate([
    __param(0, clime_1.params({
        type: String,
        description: 'input files',
        required: true,
    })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, generate_1.OutputFileOptions]),
    __metadata("design:returntype", void 0)
], default_1.prototype, "execute", null);
default_1 = __decorate([
    clime_1.command({
        description: 'This extracts functions from the existing spec files into a translation table',
    })
], default_1);
exports.default = default_1;
//# sourceMappingURL=extractFunctions.js.map