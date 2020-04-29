"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TestContext {
    reset() {
        let self = new TestContext();
        self.description = this.description;
        self.it = this.it;
        self.key = this.key;
        self.oldDescription = this.oldDescription;
        return self;
    }
}
exports.TestContext = TestContext;
//# sourceMappingURL=testContext.js.map