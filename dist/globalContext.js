"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testContext_1 = require("./testContext");
class GlobalContext {
    constructor() {
        this.afterFns = [];
        this.beforeFns = [];
        this.descriptionStack = [];
        this.testContext = new testContext_1.TestContext();
        this.indices = {};
        this.suite = "";
        this.unusedPatches = {};
        this.tests = [];
    }
}
exports.GlobalContext = GlobalContext;
//# sourceMappingURL=globalContext.js.map