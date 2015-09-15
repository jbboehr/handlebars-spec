
/*jshint strict: false */

var _utils = require('handlebars').Utils;

function safeEval(templateSpec) {
  try {
    /* jshint ignore:start */
    return eval('(' + templateSpec + ')');
    /* jshint ignore:end */
  } catch (err) {
    console.error("SPEC:" + templateSpec);
    throw err;
  }
}

module.exports = safeEval;
