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

test('warns when duplicate functions have differently typed metadata', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-extract-'));
    const firstInput = path.join(directory, 'first.json');
    const secondInput = path.join(directory, 'second.json');
    const javascript = 'function (value) { return value; }';
    temporaryDirectories.push(directory);
    writeFileSync(firstInput, JSON.stringify({
        first: { '!code': true, javascript, php: 1 },
    }));
    writeFileSync(secondInput, JSON.stringify({
        second: { '!code': true, javascript, php: '1' },
    }));

    const result = spawnSync(
        process.execPath,
        [cliPath, 'extractFunctions', firstInput, secondInput],
        { cwd: projectRoot, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /key already set and mismatch/);
});
