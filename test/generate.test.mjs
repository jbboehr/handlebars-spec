import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectRoot, 'dist/cli.js');
const temporaryDirectories = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true });
    }
});

function generateAndRun(source) {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-generate-'));
    const inputFile = path.join(directory, 'basic.js');
    const outputFile = path.join(directory, 'basic.json');
    temporaryDirectories.push(directory);
    writeFileSync(inputFile, source);
    const generation = spawnSync(
        process.execPath,
        [cliPath, 'generate', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );
    assert.equal(generation.status, 0, generation.stdout + generation.stderr);
    return {
        generation,
        fixtures: JSON.parse(readFileSync(outputFile, 'utf8')),
        execution: spawnSync(
            process.execPath,
            [cliPath, 'testRunner', 'basic.json'],
            { cwd: directory, encoding: 'utf8' },
        ),
    };
}

function generateTokenizerSuite(source) {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-tokenizer-'));
    const inputFile = path.join(directory, 'tokenizer.js');
    const outputFile = path.join(directory, 'tokenizer.json');
    temporaryDirectories.push(directory);
    writeFileSync(inputFile, source);
    writeFileSync(outputFile, 'existing output');

    const generation = spawnSync(
        process.execPath,
        [cliPath, 'generate', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    return { directory, inputFile, outputFile, generation };
}

const tokenizerSource = readFileSync(path.join(projectRoot, 'handlebars.js/spec/tokenizer.js'), 'utf8');
const tokenNamesAssertion = "shouldMatchTokens(result, ['OPEN', 'ID', 'CLOSE']);";
const tokenAssertion = "shouldBeToken(result[1], 'ID', 'foo');";
const numericTokenAssertion = "shouldBeToken(result[2], 'NUMBER', '1');";

for (const [description, original, replacement, diagnostic, fixture] of [
    ['wrong token names', tokenNamesAssertion, "shouldMatchTokens(result, ['OPEN', 'WRONG', 'CLOSE']);", /Token names/, /Tokenizer - tokenizes a simple mustache/],
    ['missing token names', tokenNamesAssertion, "shouldMatchTokens(result, ['OPEN', 'ID']);", /Token names/, /Tokenizer - tokenizes a simple mustache/],
    ['a wrong individual token name', tokenAssertion, "shouldBeToken(result[1], 'WRONG', 'foo');", /Token name/, /Tokenizer - tokenizes a simple mustache/],
    ['wrong token text', tokenAssertion, "shouldBeToken(result[1], 'ID', 'WRONG');", /Token text/, /Tokenizer - tokenizes a simple mustache/],
    ['loosely equal token text', numericTokenAssertion, "shouldBeToken(result[2], 'NUMBER', 1);", /Token text/, /Tokenizer - tokenizes numbers/],
]) {
    test(`rejects ${description} during tokenizer generation and preserves existing output`, () => {
        assert.ok(tokenizerSource.includes(original));
        const source = tokenizerSource.replace(original, replacement);
        const { directory, inputFile, outputFile, generation } = generateTokenizerSuite(source);
        const output = generation.stdout + generation.stderr;

        assert.equal(generation.error, undefined);
        assert.notEqual(generation.status, null, output);
        assert.notEqual(generation.status, 0, output);
        assert.match(output, diagnostic);
        assert.match(output, fixture);
        assert.equal(readFileSync(outputFile, 'utf8'), 'existing output');
        assert.equal(readFileSync(inputFile, 'utf8'), source);
        assert.equal(existsSync(path.join(directory, 'tokenizer.tmp.js')), false);
    });
}

test('generates and runs upstream tokenizer fixtures with unused trailing expected names', () => {
    const { directory, inputFile, outputFile, generation } = generateTokenizerSuite(tokenizerSource);

    assert.equal(generation.status, 0, generation.stdout + generation.stderr);
    assert.equal(readFileSync(inputFile, 'utf8'), tokenizerSource);
    assert.equal(existsSync(path.join(directory, 'tokenizer.tmp.js')), false);
    assert.equal(
        readFileSync(outputFile, 'utf8'),
        readFileSync(path.join(projectRoot, 'spec/tokenizer.json'), 'utf8'),
    );

    const execution = spawnSync(
        process.execPath,
        [cliPath, 'testRunner', 'tokenizer.json'],
        { cwd: directory, encoding: 'utf8' },
    );
    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.match(execution.stdout, /Success: 78\nFailed: 0\nSkipped: 0/);
});

test('keeps token assertion helpers as logging stubs outside parser generation', () => {
    const { fixtures, generation, execution } = generateAndRun(`
        describe('ordinary suite', function () {
            it('uses logging stubs', function () {
                shouldMatchTokens([{ name: 'ACTUAL', text: 'actual' }], ['EXPECTED']);
                shouldBeToken({ name: 'ACTUAL', text: 'actual' }, 'EXPECTED', 'expected');
                expectTemplate('ok').toCompileTo('ok');
            });
        });
    `);

    assert.match(generation.stderr, /shouldMatchTokens called/);
    assert.match(generation.stderr, /shouldBeToken called/);
    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.deepEqual(fixtures.map((fixture) => fixture.expected), ['ok']);
});

test('preserves metadata-shaped context keys and empty named partials through generation', () => {
    const { fixtures, execution } = generateAndRun(`
        describe('metadata boundaries', function () {
            it('preserves context keys', function () {
                expectTemplate('{{#each object}}{{@key}};{{/each}}')
                    .withInput({ object: { message: '', exception: false, helpers: {} } })
                    .toCompileTo('message;exception;helpers;');
            });
            it('preserves an empty named partial', function () {
                expectTemplate('{{> message}}')
                    .withPartial('message', '')
                    .toCompileTo('');
            });
        });
    `);

    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.match(execution.stdout, /Success: 2\nFailed: 0\nSkipped: 0/);
    assert.deepEqual(fixtures[0].data.object, { message: '', exception: false, helpers: {} });
    assert.deepEqual(fixtures[1].partials, { message: '' });
});

test('preserves empty substring and other exception matchers through generation', () => {
    const { fixtures, execution } = generateAndRun(`
        describe('exception capture', function () {
            it('matches a non-empty error with an empty substring', function () {
                // String matchers use substrings: '' accepts any error message.
                expectTemplate('{{#if}}yes{{/if}}').toThrow(Error, '');
            });
            it('keeps a regular expression', function () {
                expectTemplate('{{#if}}yes{{/if}}').toThrow(Error, /requires exactly one/);
            });
            it('keeps an unrestricted exception', function () {
                expectTemplate('{{#if}}yes{{/if}}').toThrow(Error);
            });
        });
    `);

    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.match(execution.stdout, /Success: 3\nFailed: 0\nSkipped: 0/);
    assert.deepEqual(fixtures.map(fixture => fixture.exception), ['', '/requires exactly one/', true]);
    for (const fixture of fixtures) {
        assert.equal(Object.hasOwn(fixture, 'expected'), false);
    }
});

test('omits empty fixture metadata while preserving empty expected output and input', () => {
    const { fixtures, execution } = generateAndRun(`
        describe('metadata boundaries', function () {
            it('omits unused metadata', function () {
                expectTemplate('')
                    .withMessage('')
                    .withCompileOptions({})
                    .withRuntimeOptions({})
                    .toCompileTo('');
            });
        });
    `);

    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.deepEqual(fixtures, [{
        description: 'metadata boundaries',
        it: 'omits unused metadata',
        template: '',
        data: {},
        expected: '',
    }]);
});

test('rejects only unused patches and preserves an existing output file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-generate-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, 'fixture.js');
    const outputFile = path.join(directory, 'fixture.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(inputFile, `
        describe('suite', function () {
            it('entry', function () {
                expectTemplate('ok').toCompileTo('ok');
            });
            it('included', function () {
                expectTemplate('ok').toCompileTo('ok');
            });
        });
    `);
    writeFileSync(path.join(patchDirectory, 'fixture.json'), JSON.stringify({
        'suite - entry - 00': null,
        'suite - included - 00': { expected: 'patched' },
        'suite - missing - 00': null,
    }));
    writeFileSync(outputFile, 'existing output');

    const result = spawnSync(
        process.execPath,
        [cliPath, 'generate', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 65, result.stdout + result.stderr);
    const marker = 'Unused patches:\n';
    const diagnosticOffset = result.stderr.indexOf(marker);
    assert.notEqual(diagnosticOffset, -1, result.stdout + result.stderr);
    assert.equal(
        result.stderr.slice(diagnosticOffset),
        'Unused patches:\nsuite - missing - 00\n',
    );
    assert.equal(readFileSync(outputFile, 'utf8'), 'existing output');
});

test('uses one patch-file snapshot for the whole suite', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-generate-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, 'fixture.js');
    const outputFile = path.join(directory, 'fixture.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(path.join(patchDirectory, 'fixture.json'), JSON.stringify({
        'suite - first - 00': { expected: 'first patch' },
        'suite - second - 00': { expected: 'original second patch' },
    }));
    writeFileSync(inputFile, `
        const { writeFileSync } = require('node:fs');
        describe('suite', function () {
            it('first', function () {
                expectTemplate('first').toCompileTo('first');
            });
            writeFileSync('patch/fixture.json', JSON.stringify({
                'suite - second - 00': { expected: 'mutated second patch' },
            }));
            it('second', function () {
                expectTemplate('second').toCompileTo('second');
            });
        });
    `);

    const result = spawnSync(
        process.execPath,
        [cliPath, 'generate', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const generated = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.deepEqual(
        generated.map((entry) => entry.expected),
        ['first patch', 'original second patch'],
    );
});

for (const sparse of [false, true]) {
    test(`generates and runs callbacks beneath ${sparse ? 'sparse' : 'dense'} arrays`, () => {
        const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-generate-'));
        const inputFile = path.join(directory, 'basic.js');
        const outputFile = path.join(directory, 'basic.json');
        temporaryDirectories.push(directory);
        writeFileSync(inputFile, `
            describe('array callbacks', function () {
                it('retains callbacks through JSON', function () {
                    const people = ${sparse ? 'new Array(3)' : '[]'};
                    const children = new Array(3);
                    Object.defineProperty(children, '1', {
                        value: { name: function () { return 'Awesome'; } }
                    });
                    people[${sparse ? 1 : 0}] = {
                        name: function () { return 'Awesome'; },
                        children: children
                    };
                    expectTemplate('{{people.length}}:{{#each people}}{{name}}/{{children.length}}:{{#each children}}{{name}}{{/each}}{{/each}}')
                        .withInput({ people: people })
                        .toCompileTo('${sparse ? 3 : 1}:Awesome/3:Awesome');
                });
                it('retains a directly stored callback', function () {
                    const names = ${sparse ? 'new Array(3)' : '[]'};
                    Object.defineProperty(names, '${sparse ? 1 : 0}', {
                        value: function () { return 'Awesome'; }
                    });
                    expectTemplate('{{names.[${sparse ? 1 : 0}]}}')
                        .withInput({ names: names })
                        .toCompileTo('Awesome');
                });
            });
        `);

        const generation = spawnSync(
            process.execPath,
            [cliPath, 'generate', '-o', outputFile, inputFile],
            { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(generation.status, 0, generation.stdout + generation.stderr);

        const execution = spawnSync(
            process.execPath,
            [cliPath, 'testRunner', 'basic.json'],
            { cwd: directory, encoding: 'utf8' },
        );
        assert.equal(execution.status, 0, execution.stdout + execution.stderr);
        assert.match(execution.stdout, /Success: 2\nFailed: 0\nSkipped: 0/);
    });
}

test('preserves global partial names that collide with prototype setters', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-generate-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, 'fixture.js');
    const outputFile = path.join(directory, 'fixture.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(path.join(patchDirectory, 'fixture.json'), '{}');
    writeFileSync(inputFile, `
        Object.defineProperty(Handlebars.partials, '__proto__', {
            configurable: true,
            enumerable: true,
            value: 'prototype partial'
        });
        Object.defineProperty(Handlebars.partials, 'partialSetterCollision', {
            configurable: true,
            enumerable: true,
            value: 'setter partial'
        });
        Object.defineProperty(Object.prototype, 'partialSetterCollision', {
            configurable: true,
            set: function () {}
        });

        try {
            describe('suite', function () {
                it('entry', function () {
                    expectTemplate('ok').toCompileTo('ok');
                });
            });
        } finally {
            delete Object.prototype.partialSetterCollision;
            delete Handlebars.partials.__proto__;
            delete Handlebars.partials.partialSetterCollision;
        }
    `);

    const result = spawnSync(
        process.execPath,
        [cliPath, 'generate', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const [generated] = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.equal(Object.hasOwn(generated.partials, '__proto__'), true);
    assert.equal(generated.partials.__proto__, 'prototype partial');
    assert.equal(generated.partials.partialSetterCollision, 'setter partial');
});

test('make generation and export stop at the first failed suite', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-make-'));
    const binDirectory = path.join(directory, 'bin');
    const logFile = path.join(directory, 'node.log');
    const fakeNode = path.join(binDirectory, 'node');
    temporaryDirectories.push(directory);
    mkdirSync(binDirectory);
    writeFileSync(fakeNode, `#!/bin/sh
printf '%s\\n' "$*" >> "$HANDLEBARS_SPEC_NODE_LOG"
case "$*" in
    *"/two."*) exit 42 ;;
esac
exit 0
`);
    chmodSync(fakeNode, 0o755);

    for (const target of ['spec', 'export']) {
        writeFileSync(logFile, '');
        const result = spawnSync(
            'make',
            [
                '--no-print-directory',
                '--old-file=dist',
                // Exercise each recipe independently of its prerequisites.
                ...(target === 'export' ? ['--old-file=spec'] : []),
                target,
                'SPECS=one two three',
            ],
            {
                cwd: projectRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    HANDLEBARS_SPEC_NODE_LOG: logFile,
                    PATH: binDirectory + path.delimiter + process.env.PATH,
                },
            },
        );

        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        const calls = readFileSync(logFile, 'utf8').trim().split('\n');
        assert.equal(calls.length, 2, calls.join('\n'));
        assert.ok(calls.every(call => call.startsWith('dist/cli.js ' + (target === 'spec' ? 'generate' : 'export') + ' ')));
        assert.match(calls[0], /\/one\./);
        assert.match(calls[1], /\/two\./);
        assert.doesNotMatch(calls.join('\n'), /\/three\./);
    }
});
