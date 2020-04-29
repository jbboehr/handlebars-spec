#!/usr/bin/env node

"use strict";

var program = require('commander');
var fs = require('fs');
var path = require('path');
var Handlebars = require('handlebars');
var pkg = require('../package.json');

program
  .version(pkg.version)
  .usage('[options] <spec file ...>')
  .option('-o, --output [file]', 'write JSON output to a file')
  .option('-v, --verbose', 'verbose')
  .parse(process.argv);

var input = path.resolve(program.args[0]);
//var suite = path.basename(input).replace(/\.js$/, '');
var exists = fs.existsSync(input);

if( !exists ) {
  console.error('The input file does not exist');
  return process.exit(66);
}

function compile(input, options) {
    var env = Handlebars;
    
    options = options || {};
    if (!('data' in options)) {  // jshint ignore:line
        options.data = true;
    }
    if (options.compat) {
        options.useDepths = true;
    }
    
    var ast = env.parse(input);
    var astCopy = JSON.parse(JSON.stringify(ast));
    var opcodes = new env.Compiler().compile(ast, options);
    return {
        ast: astCopy,
        opcodes: opcodes
    };
    //return new env.JavaScriptCompiler().compile(environment, options);
}

var inputTests = require(input);
var tests = [];

Object.keys(inputTests).forEach(function(x) {
    var test = inputTests[x];
    try {
        var res = compile(test.template, test.compileOptions);
        test.ast = res.ast;
        test.opcodes = res.opcodes;
        if( test.partials ) {
            var partialAsts = {};
            var partialOpcodes = {};
            Object.keys(test.partials).forEach(function(y) {
                var res = compile(test.partials[y], test.compileOptions);
                partialAsts[y] = res.ast;
                partialOpcodes[y] = res.opcodes;
            });
            test.partialAsts = partialAsts;
            test.partialOpcodes = partialOpcodes;
        }
        if( test.globalPartials ) {
            var globalPartialAsts = {};
            var globalPartialOpcodes = {};
            Object.keys(test.globalPartials).forEach(function(y) {
                var res = compile(test.globalPartials[y], test.compileOptions);
                globalPartialAsts[y] = res.ast;
                globalPartialOpcodes[y] = res.opcodes;
            });
            test.globalPartialAsts = globalPartialAsts;
            test.globalPartialOpcodes = globalPartialOpcodes;
        }
        tests.push(test);
    } catch(e) {
        if( !test.exception ) {
            console.log('Caught exception, skipping test ', 
                test.description, '-', test.it, program.verbose ? e.stack : e);
        }
    }
});

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
} catch(e) {
    console.log(e);
    return process.exit(73);
}
