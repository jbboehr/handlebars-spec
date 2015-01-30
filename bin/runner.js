#!/usr/bin/env node

"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var assert = require('assert');
var Handlebars = require('handlebars');



// Utils

function astFor(template) { // borrowed from spec/parser.js
  var ast = Handlebars.parse(template);
  return Handlebars.print(ast);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

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

function tokenize(template) { // borrowed from spec/tokenizer.js
  var parser = Handlebars.Parser,
    lexer = parser.lexer;
  
  lexer.setInput(template);
  var out = [];
  
  for (;;) {
    var token = lexer.lex();
    if( !token ) {
      break;
    }
    var result = parser.terminals_[token] || token;
    if (!result || result === 'EOF' || result === 'INVALID') {
      break;
    }
    out.push({name: result, text: lexer.yytext});
  }
  
  return out;
}

function unstringifyHelpers(helpers) {
  if( !helpers || helpers === null ) {
    return;
  }
  var ret = {};
  Object.keys(helpers).forEach(function(x) {
    ret[x] = safeEval(helpers[x].javascript);
  });
  return ret;
}

function unstringifyLambdas(data) {
  if( !data || data === null ) {
    return data;
  }
  for( var x in data ) {
    if( util.isArray(data[x]) ) {
      unstringifyLambdas(data[x]);
    } else if( typeof data[x] === 'object' && data[x] !== null ) {
      if( '!code' in data[x] ) {
        data[x] = safeEval(data[x].javascript);
      } else {
        unstringifyLambdas(data[x]);
      }
    }
  }
  return data;
}



// Test utils

function checkResult(test, e) {
  var shouldExcept = test.exception === true;
  var didExcept = e !== undefined;
  if( shouldExcept === didExcept ) {
    console.log(test.prefix + 'OK');
    return true;
  } else {
    var msg = e || 'Error: should have thrown, did not';
    console.log(test.prefix + msg);
    if( e ) {
      console.log(e.stack);
    }
    console.log('Test Data: ', test);
    return false;
  }
}

function makePrefix(test) {
  return '(' + test.suite + ' - ' + test.it + ' - ' + test.description + '): ';
}

function prepareTestGeneric(test) {
  var spec = {};
  // Output prefix
  spec.prefix = makePrefix(test);
  // Template
  spec.template = test.template;
  // Expected
  spec.expected = test.expected;
  // Exception
  spec.exception = test.exception ? true : false;
  // Data
  spec.data = clone(test.data);
  unstringifyLambdas(spec.data);
  // Helpers
  spec.helpers = unstringifyHelpers(test.helpers);
  spec.globalHelpers = test.globalHelpers || undefined;
  // Partials
  spec.partials = test.partials;
  unstringifyLambdas(spec.partials);
  spec.globalPartials = test.globalPartials || undefined;
  // Options
  spec.options = clone(test.options);
  spec.compileOptions = clone(test.compileOptions);
  // Compat
  spec.compat = Boolean(test.compat);
  return spec;
}

function prepareTestParser(test) {
  var spec = {};
  // Output prefix
  spec.prefix = makePrefix(test);
  // Template
  spec.template = test.template;
  // Expected
  spec.expected = clone(test.expected);
  // Exception
  spec.exception = test.exception ? true : false;
  // Message
  spec.message = test.message;
  return spec;
}

function prepareTestTokenizer(test) {
  var spec = {};
  // Output prefix
  spec.prefix = makePrefix(test);
  // Template
  spec.template = test.template;
  // Expected
  spec.expected = clone(test.expected);
  return spec;
}

function runTest(test) {
  var result = null;
  switch( test.suite ) {
    case 'basic':
    case 'blocks':
    case 'builtins':
    case 'data':
    case 'helpers':
    case 'partials':
    case 'regressions':
    case 'string-params':
    case 'subexpressions':
    case 'track-ids':
    case 'whitespace-control':
      result = runTestGeneric(prepareTestGeneric(test));
      break;
    case 'parser':
      result = runTestParser(prepareTestParser(test));
      break;
    case 'tokenizer':
      result = runTestTokenizer(prepareTestTokenizer(test));
      break;
  }
  return result;
}

function runTestGeneric(test) {
  try {
    // Register global partials
    Object.keys(test.globalPartials || {}).forEach(function(x) {
      global.handlebarsEnv.registerPartial(x, test.globalPartials[x]);
    });
    
    // Register global helpers
    Object.keys(test.globalHelpers || {}).forEach(function(x) {
      global.handlebarsEnv.registerHelper(x, safeEval(test.globalHelpers[x].javascript));
    });

    // Execute
    if( test.options || test.compileOptions ) {
      var template = global.CompilerContext.compile(test.template, clone(test.compileOptions));
      var opts = test.options === undefined ? {} : clone(test.options);
      opts.data = test.data; // le sigh
      if( test.helpers ) {
        opts.helpers = test.helpers;
      }
      if( test.partials ) {
        opts.partials = test.partials;
      }
      if( test.compat ) {
        opts.compat = true;
      }
      var actual = template(test.data, opts);
      global.equals(actual, test.expected);
    } else {
      // Prepare arguments
      var hashOrArray;
      if( test.data !== undefined || test.helpers || test.partials ) {
        hashOrArray = [test.data, test.helpers, test.partials, test.compat];
      }
      global.shouldCompileTo(test.template, hashOrArray, test.expected, 'generated by runner');
    }
    return checkResult(test);
  } catch(e) {
    return checkResult(test, e);
  }
}

function runTestParser(test) {
  try {
    var actual = astFor(test.template);
    assert.equal(actual, test.expected);
    return checkResult(test);
  } catch(e) {
    return checkResult(test, e);
  }
}

function runTestTokenizer(test) {
  try {
    var actual = tokenize(test.template);
    assert.deepEqual(actual, test.expected);
    return checkResult(test);
  } catch(e) {
    return checkResult(test, e);
  }
}



// Globals

global.Handlebars = Handlebars;
global.handlebarsEnv = Handlebars;

global.CompilerContext = { // borrowed from spec/env/node.js
  compile: function(template, options) {
    var templateSpec = global.handlebarsEnv.precompile(template, options);
    return global.handlebarsEnv.template(safeEval(templateSpec));
  },
  compileWithPartial: function(template, options) {
    return global.handlebarsEnv.compile(template, options);
  }
};
require('../handlebars.js/spec/env/common.js');

// Sigh - not sure why this isn't working right (for builtins #each)
Handlebars.registerHelper('detectDataInsideEach', function(options) {
  return options.data && options.data.exclaim;
});



// Main

var dir = path.resolve('./spec/');
var specs = fs.readdirSync(dir);
var successes = [];
var failures = [];
var skipped = [];

Object.keys(specs).forEach(function(x) {
  var suite = specs[x].replace(/\.json$/, '');
  var data = require(dir + '/' + specs[x]);
  Object.keys(data).forEach(function(y) {
    data[y].suite = suite;
    var result = runTest(data[y]);
    if( result === null ) {
      skipped.push(data[y]);
    } else if( result === true ) {
      successes.push(data[y]);
    } else {
      failures.push(data[y]);
    }
  });
});


// Results

console.log('Summary');
console.log('Success: ' + successes.length);
console.log('Failed: ' + failures.length);
console.log('Skipped: ' + skipped.length);

process.exit(failures.length ? 2 : 0);
