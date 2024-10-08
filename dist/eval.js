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
exports.safeEval = safeEval;
exports.wrappedEval = wrappedEval;
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
//# sourceMappingURL=eval.js.map