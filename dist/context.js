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
class TestContext {
}
exports.TestContext = TestContext;
class GlobalContext {
    constructor() {
        this.handlebarsEnv = Handlebars.create();
        this.afterFns = [];
        this.beforeFns = [];
        this.descriptionStack = [];
        // testContext: TestContext =;
        this.indices = {};
        this.oldIndices = {};
        this.suite = "";
        this.unusedPatches = {};
        this.tests = [];
    }
}
exports.GlobalContext = GlobalContext;
//# sourceMappingURL=context.js.map