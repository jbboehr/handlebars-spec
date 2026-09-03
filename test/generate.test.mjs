import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
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
        assert.match(calls[0], /\/one\./);
        assert.match(calls[1], /\/two\./);
        assert.doesNotMatch(calls.join('\n'), /\/three\./);
    }
});
