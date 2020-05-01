#!/usr/bin/env node
"use strict";
/**
 * Copyright (C) 2020 John Boehr
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Path = __importStar(require("path"));
const clime_1 = require("clime");
const ts_node_1 = require("ts-node");
require("./commands/generate");
require("./commands/extractFunctions");
require("./commands/testRunner");
if (ts_node_1.REGISTER_INSTANCE in process) {
    clime_1.CLI.commandModuleExtension = '.ts';
}
// The second parameter is the path to folder that contains command modules.
const cli = new clime_1.CLI('handlebars-spec', Path.join(__dirname, 'commands'));
// Clime in its core provides an object-based command-line infrastructure.
// To have it work as a common CLI, a shim needs to be applied:
const shim = new clime_1.Shim(cli);
shim.execute(process.argv);
//# sourceMappingURL=cli.js.map