#!/usr/bin/env node
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

import * as Path from 'path';
import {CLI, Shim} from 'clime';
import {REGISTER_INSTANCE} from 'ts-node';

import './commands/generate';
import './commands/extractFunctions';
import './commands/testRunner';

if (REGISTER_INSTANCE in process) {
    CLI.commandModuleExtension = '.ts';
}

const cli = new CLI('handlebars-spec', Path.join(__dirname, 'commands'));

const shim = new Shim(cli);
shim.execute(process.argv);
