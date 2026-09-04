import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = JSON.parse(
    readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);

test('npm package is a data-only fixture distribution', () => {
    const [packResult] = JSON.parse(execFileSync(
        'npm',
        ['pack', '--dry-run', '--json', '--ignore-scripts'],
        { cwd: projectRoot, encoding: 'utf8' },
    ));
    const topLevelEntries = [
        ...new Set(packResult.files.map((file) => file.path.split('/')[0])),
    ].sort();

    assert.deepEqual(topLevelEntries, [
        'LICENSE.md',
        'README.md',
        'export',
        'package.json',
        'spec',
    ]);
    assert.equal(packageManifest.dependencies, undefined);
    assert.equal(packageManifest.bin, undefined);
    assert.equal(packageManifest.engines, undefined);
});
