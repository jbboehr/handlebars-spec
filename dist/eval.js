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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrappedEval = exports.safeEval = void 0;
/*jshint strict: false, unused: false */
function safeEval(templateSpec) {
    try {
        /* jshint ignore:start */
        return eval('(' + templateSpec + ')');
        /* jshint ignore:end */
    }
    catch (err) {
        console.error('SPEC:' + templateSpec);
        throw err;
    }
}
exports.safeEval = safeEval;
function wrappedEval(templateSpec) {
    return safeEval('function() {' +
        'try {' +
        'var fn = (' + templateSpec + ');' +
        'return fn.apply(this, arguments);' +
        '} catch(e) {' +
        'console.log(e, ' + JSON.stringify(templateSpec) + ');' +
        'throw e;' +
        '}' +
        '}');
}
exports.wrappedEval = wrappedEval;
//# sourceMappingURL=eval.js.map