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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalContext = void 0;
const testContext_1 = require("./testContext");
class GlobalContext {
    constructor() {
        this.afterFns = [];
        this.beforeFns = [];
        this.descriptionStack = [];
        this.testContext = new testContext_1.TestContext();
        this.indices = {};
        this.suite = '';
        this.unusedPatches = {};
        this.tests = [];
    }
}
exports.GlobalContext = GlobalContext;
//# sourceMappingURL=globalContext.js.map