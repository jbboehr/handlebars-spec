import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

function runTest(testSpec) {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-test-'));
    const inputFile = path.join(directory, 'basic.json');
    temporaryDirectories.push(directory);
    writeFileSync(inputFile, JSON.stringify([{
        description: 'exception validation',
        it: 'validates the expected exception',
        ...testSpec,
    }]));

    return spawnSync(
        process.execPath,
        [cliPath, 'testRunner', path.relative(projectRoot, inputFile)],
        { cwd: projectRoot, encoding: 'utf8' },
    );
}

function runSuites(suites, inputFile) {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-suites-'));
    const specDirectory = path.join(directory, 'spec');
    temporaryDirectories.push(directory);
    mkdirSync(specDirectory);
    for (const [filename, fixtures] of Object.entries(suites)) {
        writeFileSync(path.join(specDirectory, filename), JSON.stringify(fixtures));
    }

    return spawnSync(
        process.execPath,
        [cliPath, 'testRunner', ...(inputFile ? ['spec/' + inputFile] : [])],
        { cwd: directory, encoding: 'utf8' },
    );
}

const validFixture = {
    description: 'suite dispatch',
    it: 'checks rendered output',
    template: 'plain text',
    data: {},
    expected: 'plain text',
};

for (const absolute of [true, false]) {
    test(`runs an ${absolute ? 'absolute' : 'explicit relative'} fixture path from another working directory`, () => {
        const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-path-'));
        temporaryDirectories.push(directory);
        const fixtureDirectory = path.join(directory, 'fixtures with spaces');
        const workingDirectory = path.join(directory, 'working directory');
        mkdirSync(fixtureDirectory);
        mkdirSync(workingDirectory);
        const inputFile = path.join(fixtureDirectory, 'basic.json');
        writeFileSync(inputFile, JSON.stringify([validFixture]));

        const result = spawnSync(
            process.execPath,
            [cliPath, 'testRunner', absolute ? inputFile : path.relative(workingDirectory, inputFile)],
            { cwd: workingDirectory, encoding: 'utf8' },
        );

        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /Success: 1\nFailed: 0\nSkipped: 0/);
    });
}

for (const selected of [true, false]) {
    for (const empty of [false, true]) {
        test(`rejects ${empty ? 'empty' : 'nonempty'} unsupported suites when ${selected ? 'selected' : 'discovered'}`, () => {
            const result = runSuites({
                'custom.json': empty ? [] : [{ ...validFixture, expected: 'wrong' }],
            }, selected ? 'custom.json' : undefined);

            assert.equal(result.error, undefined);
            assert.equal(result.status, 2, result.stdout + result.stderr);
            assert.match(result.stderr, /Unsupported.*suite.*custom/);
            assert.match(result.stderr, /basic\.json/);
            assert.doesNotMatch(result.stderr, /^\s+at /m);
        });
    }
}

test('rejects an unsupported empty suite even when another suite passes', () => {
    const result = runSuites({
        'basic.json': [validFixture],
        'custom.json': [],
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /Unsupported.*suite.*custom/);
    assert.doesNotMatch(result.stderr, /^\s+at /m);
});

for (const [description, suites, inputFile] of [
    ['a selected empty suite', { 'basic.json': [] }, 'basic.json'],
    ['an empty spec directory', {}],
    ['only empty discovered suites', { 'basic.json': [], 'bench.json': [] }],
]) {
    test(`fails when no fixtures run from ${description}`, () => {
        const result = runSuites(suites, inputFile);

        assert.equal(result.status, 2, result.stdout + result.stderr);
        assert.match(result.stderr, /No fixtures were run/);
        assert.match(result.stdout, /Success: 0\nFailed: 0\nSkipped: 0/);
    });
}

for (const filename of ['basic.json', 'bench.json']) {
    test(`runs a supported ${filename} suite`, () => {
        const result = runSuites({ [filename]: [validFixture] }, filename);

        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /Success: 1\nFailed: 0\nSkipped: 0/);
    });
}

test('runs a supported parser suite with parser assertions', () => {
    const result = runSuites({
        'parser.json': [{
            ...validFixture,
            template: '{{foo}}',
            expected: '{{ PATH:foo [] }}\n',
        }],
    }, 'parser.json');

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Success: 1\nFailed: 0\nSkipped: 0/);
});

test('allows an empty supported suite alongside fixtures that execute', () => {
    const result = runSuites({ 'basic.json': [], 'bench.json': [validFixture] });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Success: 1\nFailed: 0\nSkipped: 0/);
});

test('fails when an expected exception is not thrown', () => {
    const result = runTest({
        template: 'plain text',
        exception: true,
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('fails when an empty-message exception is not thrown', () => {
    const result = runTest({
        template: 'plain text',
        expected: 'plain text',
        exception: '',
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('accepts an exception with an empty message', () => {
    const result = runTest({
        template: '{{fail}}',
        helpers: {
            fail: {
                '!code': true,
                javascript: 'function () { throw new Error(\'\'); }',
            },
        },
        exception: '',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('accepts undefined as a thrown value when any exception is expected', () => {
    const result = runTest({
        template: '{{fail}}',
        helpers: {
            fail: {
                '!code': true,
                javascript: 'function () { throw undefined; }',
            },
        },
        exception: true,
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('does not mistake a failure-reporting error for a render exception', () => {
    const result = runTest({
        template: '{{poison}}',
        data: {},
        helpers: {
            poison: {
                '!code': true,
                javascript: 'function () { this.bad = 1n; return \'ok\'; }',
            },
        },
        exception: true,
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('fails when the thrown exception has the wrong message', () => {
    const result = runTest({
        template: '{{#if}}yes{{/if}}',
        exception: 'a different error',
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('accepts an exception message containing the expected string', () => {
    const result = runTest({
        template: '{{#if}}yes{{/if}}',
        exception: 'requires exactly one',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('matches a string against the message of an error-like thrown value', () => {
    const result = runTest({
        template: '{{fail}}',
        helpers: {
            fail: {
                '!code': true,
                javascript: 'function () { throw { message: \'prefix fragment suffix\' }; }',
            },
        },
        exception: 'fragment',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('matches a regular expression against the message of an error-like thrown value', () => {
    const result = runTest({
        template: '{{fail}}',
        helpers: {
            fail: {
                '!code': true,
                javascript: 'function () { throw { message: \'prefix fragment suffix\' }; }',
            },
        },
        exception: '/fragment/',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('reports an unmatchable thrown value as a failed test', () => {
    const result = runTest({
        template: '{{fail}}',
        helpers: {
            fail: {
                '!code': true,
                javascript: 'function () { throw Object.create(null); }',
            },
        },
        exception: 'fragment',
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /Failed: 1/);
});

test('accepts a serialized regular-expression exception', () => {
    const result = runTest({
        template: '{{#if}}yes{{/if}}',
        exception: '/requires exactly one argument/',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('fails when the thrown exception does not match a serialized regular expression', () => {
    const result = runTest({
        template: '{{#if}}yes{{/if}}',
        exception: '/a different error/',
    });

    assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('preserves trailing holes when restoring a sparse input array', () => {
    const result = runTest({
        template: '{{array.length}}',
        data: {
            array: {
                '!sparsearray': true,
                '!length': 3,
                0: 'present',
            },
        },
        expected: '3',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('restores a sparse input array with an own hasOwnProperty field', () => {
    const result = runTest({
        template: '{{array.[0]}}',
        data: {
            array: {
                '!sparsearray': true,
                0: 'present',
                hasOwnProperty: 'collision',
            },
        },
        expected: 'present',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('ignores non-canonical indices when restoring a sparse input array', () => {
    const result = runTest({
        template: '{{array.[1]}}|{{array.[2]}}',
        data: {
            array: {
                '!sparsearray': true,
                '1junk': 'wrong',
                2: 'right',
            },
        },
        expected: '|right',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('derives sparse input length when length metadata is absent or malformed', () => {
    const result = runTest({
        template: '{{legacy.length}}|{{negative.length}}|{{fractional.length}}|{{string.length}}|{{tooLarge.length}}',
        data: {
            legacy: {
                '!sparsearray': true,
                2: 'present',
            },
            negative: {
                '!sparsearray': true,
                '!length': -1,
                2: 'present',
            },
            fractional: {
                '!sparsearray': true,
                '!length': 1.5,
                2: 'present',
            },
            string: {
                '!sparsearray': true,
                '!length': '3',
                2: 'present',
            },
            tooLarge: {
                '!sparsearray': true,
                '!length': 0x100000000,
                2: 'present',
            },
        },
        expected: '3|3|3|3|3',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('recursively restores a sparse input array nested in a sparse array', () => {
    const result = runTest({
        template: '{{array.length}}|{{array.[0].length}}|{{array.[0].[1]}}',
        data: {
            array: {
                '!sparsearray': true,
                '!length': 2,
                0: {
                    '!sparsearray': true,
                    '!length': 3,
                    1: 'inner value',
                },
            },
        },
        expected: '2|3|inner value',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
});
