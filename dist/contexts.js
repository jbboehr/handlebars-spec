"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Handlebars = __importStar(require("handlebars"));
const utils_1 = require("./utils");
const util_1 = require("util");
class TestContext {
    mergeHelpers(data) {
        if (!data || typeof data !== 'object') {
            return this.helpers;
        }
        Object.keys(data).forEach((key) => {
            if (util_1.isFunction(data[key])) {
                if (!this.helpers) {
                    this.helpers = {};
                }
                this.helpers[key] = utils_1.jsToCode(data[key]);
            }
        });
        return this.helpers;
    }
    mergePartials(data) {
        if (!data || typeof data !== 'object') {
            return this.partials;
        }
        Object.keys(data).forEach((key) => {
            if (!this.partials) {
                this.partials = {};
            }
            this.partials[key] = data[key];
        });
        return this.partials;
    }
    mergeDecorators(data) {
        if (!data || typeof data !== 'object') {
            return this.decorators;
        }
        Object.keys(data).forEach((key) => {
            if (util_1.isFunction(data[key])) {
                if (!this.decorators) {
                    this.decorators = {};
                }
                this.decorators[key] = utils_1.jsToCode(data[key]);
            }
        });
        return this.decorators;
    }
    toTestSpec() {
        if (!this.description) {
            throw new Error("Must have description");
        }
        else if (!this.it) {
            throw new Error("Must have it");
        }
    }
}
exports.TestContext = TestContext;
class GlobalContext {
    constructor() {
        this.handlebarsEnv = Handlebars.create();
        this.afterFns = [];
        this.beforeFns = [];
        this.descriptionStack = [];
        this.testContext = new TestContext();
        this.indices = {};
        this.oldIndices = {};
        this.suite = "";
        this.unusedPatches = {};
        this.tests = [];
    }
    detectGlobals() {
        this.detectGlobalHelpers();
        this.detectGlobalPartials();
        this.detectGlobalDecorators();
    }
    detectGlobalHelpers() {
        let { handlebarsEnv } = this;
        const builtins = [
            'helperMissing', 'blockHelperMissing', 'each', 'if',
            'unless', 'with', 'log', 'lookup'
        ];
        let globalHelpers = {};
        Object.keys(handlebarsEnv.helpers).forEach((x) => {
            if (builtins.indexOf(x) !== -1) {
                return;
            }
            globalHelpers[x] = utils_1.jsToCode(handlebarsEnv.helpers[x]);
        });
        this.globalHelpers = utils_1.isEmptyObject(globalHelpers) ? undefined : globalHelpers;
    }
    detectGlobalDecorators() {
        let { handlebarsEnv } = this;
        const builtins = ['inline'];
        let globalDecorators = {};
        Object.keys(handlebarsEnv.decorators).forEach((x) => {
            if (builtins.indexOf(x) !== -1) {
                return;
            }
            globalDecorators[x] = utils_1.jsToCode(handlebarsEnv.decorators[x]);
        });
        this.globalDecorators = utils_1.isEmptyObject(globalDecorators) ? undefined : globalDecorators;
    }
    detectGlobalPartials() {
        let { handlebarsEnv } = this;
        // This should never be null, but it is in one case
        if (!handlebarsEnv) {
            return;
        }
        let globalPartials = {};
        Object.keys(handlebarsEnv.partials).forEach((x) => {
            globalPartials[x] = handlebarsEnv.partials[x];
        });
        this.globalPartials = utils_1.isEmptyObject(globalPartials) ? undefined : globalPartials;
    }
}
exports.GlobalContext = GlobalContext;
//# sourceMappingURL=contexts.js.map