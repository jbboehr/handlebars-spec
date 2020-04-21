#!/usr/bin/env node

"use strict";

var program = require('commander');
var fs = require('fs');
var path = require('path');
var util = require('util');
var extend = require('extend');
var Handlebars = require('handlebars');
var pkg = require('../package.json');
var ExpectTemplate = require('./expectTemplate');

var normalizeJavascript = require('../src/utils').normalizeJavascript;
var clone = require('../src/utils').clone;
var jsToCode = require('../src/utils').jsToCode;

program
  .version(pkg.version)
  .usage('[options] <file ...>')
  .option('-o, --output [file]', 'write JSON output to a file')
  .parse(process.argv);

var input = path.resolve(program.args[0]);
var suite = path.basename(input).replace(/\.js$/, '');
var exists = fs.existsSync(input);

if( !exists ) {
  console.error('The input file does not exist');
  return process.exit(66);
}

var tests   = [];   // Array containg the actual specs
var indices = [];   // Temp array for auto-incrementing test indices
var oldIndices = [];
var context = {};   // Current test context
var afterFns = [];  // Functions to execute after a test
var beforeFns = []; // Functions to execute before a test
var unusedPatches = null;


// Utils

function addTest(spec) {
  if (!spec || !spec.template) {
    return;
  }

  var key = (spec.description + ' - ' + spec.it).toLowerCase();
  var oldPatchKey = (spec.oldDescription + '-' + spec.it).toLowerCase();
  var name = (function() {
    for (var i = 0; i < 99; i++) {
      var n = key + ' - ' + ('0' + i).slice(-2);
      if (indices.indexOf(n) === -1) {
        return n;
      }
    }
    throw new Error('Failed to acquire test index');
  })();
  var oldName = (function() {
    for (var i = 0; i < 99; i++) {
      var n = oldPatchKey + '-' + ('0' + i).slice(-2);
      if (oldIndices.indexOf(n) === -1) {
        return n;
      }
    }
    throw new Error('Failed to acquire test index');
  })();

  indices.push(name);
  oldIndices.push(oldName);

  var patchFile = path.resolve('./patch/') + '/' + suite + '.json';
  if (fs.existsSync(path.resolve(patchFile))) {
    var patchData = require(patchFile);
    var patch;

    if (patchData.hasOwnProperty(oldName)) {
      patch = patchData[oldName];
      console.warn("Old patch should be renamed: " + JSON.stringify(oldName) + " to " + JSON.stringify(name));
    }

    else if (patchData.hasOwnProperty(name)) {
      patch = patchData[name];
    }

    if (patch) {
      if( patch === null ) {
        // Note: setting to null means to skip the test. These will most
        // likely be implementation-dependant. Note that it still has to be
        // added to the indices array
        spec = null;
      } else {
        spec = extend(true, spec, patch);
        // Using nulls in patches to unset things
        stripNulls(spec);
      }

      // Track unused patches
      if( unusedPatches === null ) {
        unusedPatches = extend({}, patchData);
      }
      delete unusedPatches[name];
      delete unusedPatches[oldName];
    }
  }

  if( spec !== null ) {
    tests.push(spec);
  }
}


function detectGlobalHelpers() {
  var builtins = ['helperMissing', 'blockHelperMissing', 'each', 'if',
                  'unless', 'with', 'log', 'lookup'];
  var globalHelpers;
  Object.keys(global.handlebarsEnv.helpers).forEach(function(x) {
    if( builtins.indexOf(x) !== -1 ) {
      return;
    }
    if( !globalHelpers ) {
      globalHelpers = {};
    }
    globalHelpers[x] = global.handlebarsEnv.helpers[x];
  });
  if( globalHelpers ) {
    context.globalHelpers = globalHelpers;
  } else {
    delete context.globalHelpers;
  }
}

function detectGlobalDecorators() {
  var builtins = ['inline'];
  var globalDecorators;
  Object.keys(global.handlebarsEnv.decorators).forEach(function(x) {
    if( builtins.indexOf(x) !== -1 ) {
      return;
    }
    if( !globalDecorators ) {
      globalDecorators = {};
    }
    globalDecorators[x] = global.handlebarsEnv.decorators[x];
  });
  if( globalDecorators ) {
    context.globalDecorators = globalDecorators;
  } else {
    delete context.globalDecorators;
  }
}

function detectGlobalPartials() {
  // This should never be null, but it is in one case
  if( !global.handlebarsEnv ) {
    return;
  }
  var globalPartials;
  Object.keys(global.handlebarsEnv.partials).forEach(function(x) {
    if( !globalPartials ) {
      globalPartials = {};
    }
    globalPartials[x] = global.handlebarsEnv.partials[x];
  });
  if( globalPartials ) {
    context.globalPartials = globalPartials;
  } else {
    delete context.globalPartials;
  }
}

function extractHelpers(data) {
  var helpers = {};

  if (!data || typeof data !== 'object') {
    return false;
  }

  Object.keys(data).forEach(function (el) {
    if (isFunction(data[el])) {
      helpers[el] = jsToCode(data[el]);
    }
  });

  return isEmptyObject(helpers) ? false : helpers;
}

function isFunction(object) {
  return Boolean(object && object.constructor && object.call && object.apply);
}

function isEmptyObject(object) {
  return !Object.keys(object).length;
}


function removeCircularReferences(data, prev) {
  if( typeof data !== 'object' ) {
    return;
  }
  prev = prev || [];
  prev.push(data);
  function checkCircularRef(v) {
    for( var y in prev ) {
      if( v === prev[y] ) {
        return true;
      }
    }
    return false;
  }
  for( var x in data ) {
    if( checkCircularRef(data[x]) ) {
      delete data[x];
    } else if( typeof data[x] === 'object' ) {
      removeCircularReferences(data[x]);
    }
  }
}

function resetContext() {
  delete context.template;
  delete context.data;
  delete context.options;
  delete context.compileOptions;
  delete context.helpers;
  delete context.globalHelpers;
  delete context.partials;
  delete context.globalPartials;
  delete context.decorators;
  delete context.globalDecorators;
  delete context.exception;
}

function stringifyLambdas(data) {
  if( typeof data !== 'object' ) {
    return;
  }
  for( var x in data ) {
    if( data[x] instanceof Array ) {
      stringifyLambdas(data[x]);
    } else if( typeof data[x] === 'function' || data[x] instanceof Function ) {
      data[x] = jsToCode(data[x]);
    } else if( typeof data[x] === 'object' ) {
      stringifyLambdas(data[x]);
    }
  }
}

function stripNulls(data) {
  if( typeof data === 'object' ) {
    for( var x in data ) {
      if( data[x] === null ) {
        if( data['!keepnull'] ) {
          delete data['!keepnull'];
        } else {
          delete data[x];
        }
      } else if( typeof data === 'object' ) {
        stripNulls(data[x]);
      }
    }
  }
}



// Globals

global.Handlebars    = Handlebars;
global.handlebarsEnv = Handlebars.create();
global.sinon = require('sinon');

global.afterEach = function afterEach(fn) {
  afterFns.push(fn);
};

global.beforeEach = function beforeEach(fn) {
  beforeFns.push(fn);
};

global.CompilerContext = {
  compile: function CompilerContextCompile(template, options) {
    // Push template unto context
    context.template = template;
    context.compileOptions = clone(options);

    var compiledTemplate = Handlebars.compile(template, options);

    return function (data, options) {
      // Note: merging data in the options causes tests to fail, possibly
      // a separate type of data?
      if (options && options.hasOwnProperty('data')) {
        //data = extend(true, data, options.data);
        context.options = context.options || {};
	context.options.data = options.data;
      }

      // Push template data unto context
      context.data = data;

      if (options && options.hasOwnProperty('helpers')) {
        // Push helpers unto context
        context.helpers = options.helpers;
      }

      if (options && options.hasOwnProperty('decorators')) {
        // Push decorators unto context
        context.decorators = options.decorators;
      }

      return compiledTemplate(data, options);
    };
  },
  compileWithPartial: function CompilerContextCompileWithPartial(template, options) {
    // Push template unto context
    context.template = template;
    context.compileOptions = clone(options);
    return Handlebars.compile(template, options);
  }
};

var descriptionStack = [];

global.describe = function describe(description, next) {
  descriptionStack.push(description);
  context.description = descriptionStack.join(' - ');
  context.oldDescription = description;
  next();
  descriptionStack.pop();
  delete context.oldDescription;

  // Push suite description unto context
  // context.description = description;
  // next();
  // delete context.description;
};

global.it = function it(description, next) {
  // Call before fns
  beforeFns.forEach(function(fn) {
    fn();
  });
  // Push test spec unto context
  context.it = description;
  // Test
  next();
  // Remove test spec from context
  if (context.extraEquals) {
    console.warn("extra equals called in unhandled block: " + context.it + ": ", context.extraEquals);
    delete context.extraEquals;
  }
  delete context.it;
  // Call after fns
  afterFns.forEach(function(fn) {
    fn();
  });
};

global.equal = global.equals = function equals(actual, expected, message) {
  if (!actual && !expected && !message) {
    return;
  }

  if (!context.extraEquals) {
    context.extraEquals = [];
  }
  context.extraEquals.push({
    // actual,
    expected,
    message,
  });
  //console.warn('equals called in "' + descriptionStack.join(' - ') + ' - ' + context.it + '"');
  /*
  var spec = {
    description : context.description || context.it,
    oldDescription: context.oldDescription,
    it          : context.it,
    template    : context.template,
    data        : context.data,
    expected    : expected,
  };

  // Remove circular references in data
  removeCircularReferences(spec.data);

  // Get message
  if (message) {
    spec.message = message;
  }

  // Get options
  if( context.options ) {
    spec.options = context.options;
    if( spec.options.data ) {
      stringifyLambdas(spec.options.data);
    }
  }

  // Get compiler options
  if (context.compileOptions) {
    spec.compileOptions = context.compileOptions;
  }

  // Get helpers
  if (context.helpers) {
    spec.helpers = extractHelpers(context.helpers);
  }

  // Get global helpers
  if (context.globalHelpers) {
    spec.globalHelpers = extractHelpers(context.globalHelpers);
  }

  // Get decorators
  if (context.decorators) {
    spec.decorators = extractHelpers(context.decorators);
  }

  // Get global decorators
  if (context.globalDecorators) {
    spec.globalDecorators = extractHelpers(context.globalDecorators);
  }

  // If a template is found in the lexer, use it for the spec. This is true in
  // the case of the tokenizer.
  if (!spec.template && Handlebars.Parser.lexer.matched) {
    spec.template = Handlebars.Parser.lexer.matched;
  }

  // Convert lambdas to object/strings
  stringifyLambdas(spec.data);

  // Add test
  addTest(spec);

  // Reset the context
  resetContext();
  */
};

global.tokenize = function tokenize(template) {
  context.template = template;
  return global.originalTokenize(template);
};

global.shouldMatchTokens = function shouldMatchTokens(expected /*, tokens*/) {
  let { description, oldDescription, it, template, extraEquals } = context;

  if (extraEquals && Object.keys(extraEquals).length >= 0) {
    console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
    delete context.extraEquals;
  }

  var spec = {
    description,
    oldDescription,
    it,
    template,
    expected,
  };

  // Add the test
  addTest(spec);

  // Reset the context
  resetContext();
};

global.xit = function () {}; // noop

global.expect = function () {
  return {
    to: {
      equal: function() {
        console.warn('expect.to.equal called');
      },
      be: {
        true: function () {
          console.warn('expect.to.be.true called');
        }
      }
    }
  };
};

global.expectTemplate = function (template) {
  return new ExpectTemplate(template, function (xt) {
    global.compileWithPartials(xt.template, xt.input, null, xt.expected);
  });
};

global.shouldBeToken = function shouldBeToken() {

};

global.shouldCompileTo = function shouldCompileTo(string, hashOrArray, expected) {
  global.shouldCompileToWithPartials(string, hashOrArray, false, expected);
};

global.shouldCompileToWithPartials = function shouldCompileToWithPartials(string, hashOrArray, partials, expected, message) {
  detectGlobalHelpers();
  detectGlobalPartials();
  detectGlobalDecorators();
  global.compileWithPartials(string, hashOrArray, partials, expected, message);
};

global.compileWithPartials = function compileWithPartials(string, hashOrArray, partials, expected, message) {
  var helpers;
  var decorators;
  var data;
  var compat;
  var compileOptions = extend({}, context.compileOptions);

  if (util.isArray(hashOrArray)) {
    data     = hashOrArray[0];
    helpers  = extractHelpers(hashOrArray[1]);
    partials = hashOrArray[2];
    if( hashOrArray[3] ) {
      if( typeof hashOrArray[3] === 'boolean' ) {
        compileOptions.compat = compat = true;
      } else if( typeof hashOrArray[3] === 'object' ) {
        extend(compileOptions, hashOrArray[3]);
      }
    }
    /* if (hashOrArray[4] != null) {
      options.data = !!hashOrArray[4];
      ary[1].data = hashOrArray[4];
    } */
  } else {
    data = hashOrArray;
    if( typeof data === 'object' ) {
      data = hashOrArray.hash || hashOrArray;
      helpers = extractHelpers(hashOrArray.helpers || context.helpers);
      partials = hashOrArray.partials || context.partials;
      decorators = extractHelpers(hashOrArray.decorators || context.decorators);
      delete data.helpers;
      delete data.partials;
      delete data.decorators;
    }
  }

  let { description, oldDescription, it, extraEquals } = context;

  if (extraEquals && Object.keys(extraEquals).length >= 0) {
    console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
    delete context.extraEquals;
  }

  var spec = {
    description,
    oldDescription,
    it,
    template    : string,
    data,
    expected,
  };

  // Remove circular references in data
  removeCircularReferences(data);

  // Check for exception
  if( context.exception ) {
    spec.exception = true;
  }

  if (partials) {
    spec.partials = partials;
  }
  if (helpers) {
    spec.helpers  = helpers;
  }
  if (decorators) {
    spec.decorators  = decorators;
  }
  if (message) {
    spec.message  = '' + message;
  }
  if (compat) {
    spec.compat = true;
  }

  // Get options
  if( context.options ) {
    spec.options = context.options;
    if( spec.options.data ) {
      stringifyLambdas(spec.options.data);
    }
  }

  // Get compiler options
  if( compileOptions ) {
    spec.compileOptions = compileOptions;
  }

  // Get global partials
  if( context.globalPartials ) {
    spec.globalPartials = context.globalPartials;
  }

  // Get global helpers
  if( context.globalHelpers ) {
    spec.globalHelpers = extractHelpers(context.globalHelpers);
  }

  // Get global decorators
  if( context.globalDecorators ) {
    spec.globalDecorators = extractHelpers(context.globalDecorators);
  }

  // Convert lambdas to object/strings
  stringifyLambdas(spec.data);
  stringifyLambdas(spec.partials);

  // Add the test
  addTest(spec);

  // Reset the context
  resetContext();
};

global.shouldThrow = function shouldThrow(callback, error, message) {
  context.exception = true;

  try {
    callback();
  } catch (err) {}

  delete context.exception;

  let { description, oldDescription, it, template, extraEquals } = context;

  if (extraEquals && Object.keys(extraEquals).length >= 0) {
    console.warn('Extra equals were called in ' + description + ' - ' + it + ': ', extraEquals);
    delete context.extraEquals;
  }

  var spec = {
    description,
    oldDescription,
    it,
    template,
    exception: true,
  };

  // Add the message
  if (message) {
    spec.message = '' + message;
  }

  // If a template is found in the lexer, use it for the spec. This is true in
  // the case of the tokenizer.
  if (!spec.template) {
    spec.template = Handlebars.Parser.lexer.matched +
        Handlebars.Parser.lexer._input;
  }

  // Add the test
  addTest(spec);

  // Reset the context
  resetContext();
};



// Main

// Need to patch out some global functions for the tokenizer
if( input.match(/tokenizer\.js$/) ) {
  var tokenizerData = ('' + fs.readFileSync(input))
      .replace(/function shouldMatchTokens/, 'function REMshouldMatchTokens')
      .replace(/function shouldBeToken/, 'function REMshouldBeToken')
      .replace(/function tokenize/, 'global.originalTokenize = function');
  input = input.replace(/\.js$/, '.tmp.js');
  fs.writeFileSync(input, tokenizerData);
  process.on('exit', function() {
    fs.unlinkSync(input);
  });
}

if( input.match(/bench\/templates/) ) {
  suite = 'bench';
  var benches = require(input);
  Object.keys(benches).forEach(function(x) {
    var data = benches[x];
    var expected = Handlebars.compile(data.handlebars)(data.context, {
      helpers: data.helpers,
      partials: data.partials && data.partials.handlebars,
      decorators: data.decorators
    });
    stringifyLambdas(data.context);
    var test = {
      description: 'Benchmarks',
      it: x,
      template: data.handlebars,
      data: data.context,
      expected: expected,
      compileOptions: {
        data: false
      }
    };
    if( data.helpers ) {
      test.helpers = extractHelpers(data.helpers);
    }
    if( data.partials && data.partials.handlebars ) {
      test.partials = data.partials.handlebars;
    }
    if( data.decorators ) {
      test.decorators = extractHelpers(data.decorators);
    }
    addTest(test);

    if( test.mustache ) {
      test = clone(test);
      test.it = x + ' compat';
      test.template = data.mustache;
      test.compileOptions.compat = true;
      addTest(test);
    }
  });
} else {
  require(input);
}

try {
  var output = JSON.stringify(tests, null, '\t');
} catch(e) {
  console.log('Failed converting to JSON: ' + input + ' (' + e + ')');
  return process.exit(70);
}

if (!program.output) {
  return console.log(output);
}

var outputFile = path.resolve(program.output);

try {
  fs.writeFileSync(outputFile, output);
  console.log('JSON saved to ' + program.output);
  if( unusedPatches !== null ) {
    unusedPatches = Object.keys(unusedPatches);
    if( unusedPatches.length ) {
      console.log("Unused patches: " + unusedPatches);
    }
  }
} catch(e) {
  console.log(e);
  return process.exit(73);
}

