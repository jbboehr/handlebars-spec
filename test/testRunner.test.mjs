import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
