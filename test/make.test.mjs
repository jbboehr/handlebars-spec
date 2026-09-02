import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('make builds dist with the project-local TypeScript compiler', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-make-'));
    const binDirectory = path.join(directory, 'bin');
    const fakeTypeScript = path.join(binDirectory, 'tsc');

    try {
        mkdirSync(binDirectory);
        writeFileSync(fakeTypeScript, '#!/bin/sh\nexit 42\n');
        chmodSync(fakeTypeScript, 0o755);

        const result = spawnSync(
            'make',
            ['--no-print-directory', 'dist'],
            {
                cwd: projectRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PATH: binDirectory + path.delimiter + process.env.PATH,
                },
            },
        );

        assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally {
        rmSync(directory, { recursive: true });
    }
});
