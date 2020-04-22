
/*jshint strict: false, unused: false */

var _utils = require('handlebars').Utils;

export function safeEval(templateSpec: string): any {
  try {
    /* jshint ignore:start */
    return eval('(' + templateSpec + ')');
    /* jshint ignore:end */
  } catch (err) {
    console.error("SPEC:" + templateSpec);
    throw err;
  }
}
