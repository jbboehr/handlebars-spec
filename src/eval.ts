
/*jshint strict: false, unused: false */

export function safeEval(templateSpec: string): any {
    try {
    /* jshint ignore:start */
        return eval('(' + templateSpec + ')');
    /* jshint ignore:end */
    } catch (err) {
        console.error('SPEC:' + templateSpec);
        throw err;
    }
}

export function wrappedEval(templateSpec: string): any {
    return safeEval(
        'function() {' +
            'try {' +
                'var fn = (' + templateSpec + ');' +
                'return fn.apply(this, arguments);' +
            '} catch(e) {' +
                'console.log(e, ' + JSON.stringify(templateSpec) + ');' +
                'throw e;' +
            '}' +
        '}'
    );
}
