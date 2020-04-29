"use strict";
/*jshint strict: false, unused: false */
Object.defineProperty(exports, "__esModule", { value: true });
var _utils = require('handlebars').Utils;
function safeEval(templateSpec) {
    try {
        /* jshint ignore:start */
        return eval('(' + templateSpec + ')');
        /* jshint ignore:end */
    }
    catch (err) {
        console.error("SPEC:" + templateSpec);
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