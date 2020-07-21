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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
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