import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
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
import Handlebars from 'handlebars';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectRoot, 'dist/cli.js');
const temporaryDirectories = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true });
    }
});

function runExport(tests, omissions = {}, suite = 'fixture') {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, `${suite}.json`);
    const outputFile = path.join(directory, 'output.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(inputFile, JSON.stringify(tests));
    writeFileSync(
        path.join(patchDirectory, '_export.json'),
        JSON.stringify({ [suite]: omissions }),
    );
    writeFileSync(outputFile, 'existing output');

    const result = spawnSync(
        process.execPath,
        [cliPath, 'export', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    return { outputFile, result };
}

function fixtureTest(it, template, extra = {}) {
    return {
        description: 'suite',
        it,
        template,
        ...extra,
    };
}

function assertExportedFixtureOutput(fixture, expected, input = {}) {
    const options = fixture.compileOptions || {};
    const partials = Object.fromEntries(
        Object.entries(fixture.partialAsts || {}).map(([name, ast]) => [
            name,
            Handlebars.compile(ast, options),
        ]),
    );
    assert.equal(
        Handlebars.compile(fixture.ast, options)(input, { partials }),
        expected,
        `${fixture.it} AST`,
    );

    const compileOpcodes = (opcodes) => Handlebars.template(
        new Handlebars.JavaScriptCompiler().compile(opcodes, options, undefined, true),
    );
    const partialTemplates = Object.fromEntries(
        Object.entries(fixture.partialOpcodes || {}).map(([name, opcodes]) => [
            name,
            compileOpcodes(opcodes),
        ]),
    );
    assert.equal(
        compileOpcodes(fixture.opcodes)(input, { partials: partialTemplates }),
        expected,
        `${fixture.it} opcodes`,
    );
}

for (const { name, compileOptions, expected } of [
    { name: 'default options', expected: 'before\nafter\n' },
    {
        name: 'ignoreStandalone disabled',
        compileOptions: { ignoreStandalone: false },
        expected: 'before\nafter\n',
    },
    {
        name: 'ignoreStandalone enabled',
        compileOptions: { ignoreStandalone: true },
        expected: 'before\n  \nafter\n',
    },
]) {
    test(`exports standalone whitespace with ${name}`, () => {
        const template = 'before\n  {{! standalone comment}}\nafter\n';
        const { outputFile, result } = runExport([
            fixtureTest('template', template, { compileOptions }),
            fixtureTest('partial', '{{> example}}', {
                compileOptions,
                partials: { example: template },
            }),
        ]);

        assert.equal(result.status, 0, result.stdout + result.stderr);
        const fixtures = JSON.parse(readFileSync(outputFile, 'utf8'));
        assert.equal(fixtures.length, 2);

        for (const fixture of fixtures) {
            assertExportedFixtureOutput(fixture, expected);
        }
    });
}

test('preserves other compile options alongside ignoreStandalone', () => {
    const compileOptions = { ignoreStandalone: true, noEscape: true };
    const template = 'before\n  {{! standalone comment}}\n{{value}}\nafter\n';
    const expected = 'before\n  \n<b>x</b>\nafter\n';
    const { outputFile, result } = runExport([
        fixtureTest('template', template, { compileOptions }),
        fixtureTest('partial', '{{> example}}', {
            compileOptions,
            partials: { example: template },
        }),
    ]);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const fixtures = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.equal(fixtures.length, 2);

    for (const fixture of fixtures) {
        assertExportedFixtureOutput(
            fixture,
            expected,
            { value: '<b>x</b>' },
        );
    }
});

test('rejects an unexpected export failure without overwriting output', () => {
    const { outputFile, result } = runExport([
        fixtureTest('included before failure', 'valid'),
        fixtureTest('unexpected', '{{#broken}}'),
    ]);

    assert.equal(result.status, 65, result.stdout + result.stderr);
    assert.match(result.stderr, /suite - unexpected - 00/);
    assert.equal(result.stdout, '');
    assert.equal(readFileSync(outputFile, 'utf8'), 'existing output');
});

test('does not emit partial stdout before a late unexpected failure', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, 'fixture.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(path.join(patchDirectory, '_export.json'), '{"fixture":{}}');
    writeFileSync(inputFile, JSON.stringify([
        fixtureTest('included before failure', 'valid'),
        fixtureTest('unexpected', '{{#broken}}'),
    ]));

    const result = spawnSync(
        process.execPath,
        [cliPath, 'export', inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 65, result.stdout + result.stderr);
    assert.equal(result.stdout, '');
});

test('exports valid tests while allowing a declared omission', () => {
    const { outputFile, result } = runExport([
        fixtureTest('omitted', '{{#broken}}', { exception: true }),
        fixtureTest('included', 'valid'),
    ], {
        'suite - omitted - 00': 'The fixture intentionally has an unclosed block.',
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const output = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.equal(output.length, 1);
    assert.equal(output[0].it, 'included');
});

test('rejects a stale export omission without overwriting output', () => {
    const { outputFile, result } = runExport([
        fixtureTest('included', 'valid'),
    ], {
        'suite - missing - 00': 'This test no longer exists.',
    });

    assert.equal(result.status, 65, result.stdout + result.stderr);
    assert.match(result.stderr, /suite - missing - 00/);
    assert.equal(result.stdout, '');
    assert.equal(readFileSync(outputFile, 'utf8'), 'existing output');
});

test('uses the packaged omission manifest when the cwd manifest is absent', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    const inputFile = path.join(directory, 'basic.json');
    const outputFile = path.join(directory, 'output.json');
    temporaryDirectories.push(directory);
    writeFileSync(inputFile, JSON.stringify([
        {
            description: 'Basic Context',
            it: 'This Keyword Nested Inside Path',
            template: '{{#hellos}}{{text/this/foo}}{{/hellos}}',
        },
        {
            description: 'Basic Context',
            it: 'This Keyword Nested Inside Helpers Param',
            template: '{{#hellos}}{{foo text/this/foo}}{{/hellos}}',
        },
        fixtureTest('included', 'valid'),
    ]));
    writeFileSync(outputFile, 'existing output');

    const result = spawnSync(
        process.execPath,
        [cliPath, 'export', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const output = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.equal(output.length, 1);
    assert.equal(output[0].it, 'included');
});

test('a cwd omission manifest replaces rather than merges the packaged manifest', () => {
    const { outputFile, result } = runExport([
        fixtureTest('local omission', '{{#broken}}'),
        fixtureTest('included', 'valid'),
    ], {
        'suite - local omission - 00': 'This omission exists only in the cwd manifest.',
    }, 'basic');

    assert.equal(result.status, 0, result.stdout + result.stderr);
    const output = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.equal(output.length, 1);
    assert.equal(output[0].it, 'included');
});

test('uses one omission-manifest snapshot for the whole invocation', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    const patchDirectory = path.join(directory, 'patch');
    const manifestFile = path.join(patchDirectory, '_export.json');
    const preloadFile = path.join(directory, 'count-manifest-reads.cjs');
    const readCountFile = path.join(directory, 'manifest-read-count');
    const inputFile = path.join(directory, 'fixture.json');
    const outputFile = path.join(directory, 'output.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(manifestFile, JSON.stringify({
        fixture: {
            'suite - first - 00': 'The first entry intentionally fails.',
            'suite - second - 00': 'The second entry intentionally fails.',
        },
    }));
    writeFileSync(inputFile, JSON.stringify([
        fixtureTest('first', '{{#first}}'),
        fixtureTest('second', '{{#second}}'),
        fixtureTest('included', 'valid'),
    ]));
    writeFileSync(preloadFile, `
        const fs = require('node:fs');
        const path = require('node:path');
        const target = ${JSON.stringify(manifestFile)};
        const countFile = ${JSON.stringify(readCountFile)};
        const originalReadFileSync = fs.readFileSync;
        const originalWriteFileSync = fs.writeFileSync;
        let reads = 0;
        fs.readFileSync = function (file, ...args) {
            const contents = originalReadFileSync.call(this, file, ...args);
            if (path.basename(file) === '_export.json') {
                reads += 1;
                originalWriteFileSync(countFile, String(reads));
                if (path.resolve(file) === target && reads === 1) {
                    originalWriteFileSync(target, JSON.stringify({
                        fixture: {
                            'suite - stale - 00': 'A later manifest snapshot.',
                        },
                    }));
                }
            }
            return contents;
        };
    `);

    const result = spawnSync(
        process.execPath,
        ['--require', preloadFile, cliPath, 'export', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(readCountFile, 'utf8'), '1');
    const output = JSON.parse(readFileSync(outputFile, 'utf8'));
    assert.deepEqual(output.map((entry) => entry.it), ['included']);
});

test('malformed cwd manifest cannot overwrite output or fall back silently', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    const patchDirectory = path.join(directory, 'patch');
    const inputFile = path.join(directory, 'fixture.json');
    const outputFile = path.join(directory, 'output.json');
    temporaryDirectories.push(directory);
    mkdirSync(patchDirectory);
    writeFileSync(path.join(patchDirectory, '_export.json'), '{');
    writeFileSync(inputFile, JSON.stringify([fixtureTest('included', 'valid')]));
    writeFileSync(outputFile, 'existing output');

    const result = spawnSync(
        process.execPath,
        [cliPath, 'export', '-o', outputFile, inputFile],
        { cwd: directory, encoding: 'utf8' },
    );

    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(readFileSync(outputFile, 'utf8'), 'existing output');
});

test('explicit omissions preserve all existing spec and export artifacts', () => {
    const suites = [
        'basic',
        'blocks',
        'builtins',
        'data',
        'helpers',
        'parser',
        'partials',
        'regressions',
        'string-params',
        'subexpressions',
        'strict',
        'tokenizer',
        'track-ids',
        'whitespace-control',
    ];
    const manifest = JSON.parse(readFileSync(
        path.join(projectRoot, 'patch', '_export.json'),
        'utf8',
    ));
    for (const suite of Object.keys(manifest)) {
        assert.ok(suites.includes(suite), `unknown omission suite: ${suite}`);
    }
    const omissions = Object.values(manifest).flatMap((suite) => Object.values(suite));
    for (const reason of omissions) {
        assert.equal(typeof reason, 'string');
        assert.notEqual(reason.trim(), '');
    }

    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-export-'));
    temporaryDirectories.push(directory);
    for (const suite of suites) {
        const inputFile = path.join(projectRoot, 'spec', `${suite}.json`);
        const outputFile = path.join(directory, `${suite}.json`);
        const originalSpec = readFileSync(inputFile, 'utf8');
        const expectedExport = readFileSync(
            path.join(projectRoot, 'export', `${suite}.json`),
            'utf8',
        );
        const result = spawnSync(
            process.execPath,
            [cliPath, 'export', '-o', outputFile, inputFile],
            { cwd: projectRoot, encoding: 'utf8' },
        );

        assert.equal(result.status, 0, `${suite}: ${result.stdout}${result.stderr}`);
        assert.equal(readFileSync(inputFile, 'utf8'), originalSpec, suite);
        assert.equal(readFileSync(outputFile, 'utf8'), expectedExport, suite);
    }
});
