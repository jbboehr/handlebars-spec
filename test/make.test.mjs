import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const nodeValidationCalls = [
    'node --test test/*.test.mjs',
    'node dist/cli.js testRunner',
];
const phpValidationCalls = [
    'php test/php-lint.test.php',
    'php test/php-helpers.test.php',
    'php test/php-stubs.test.php',
    'php -d zend.assertions=-1 test/php-assertions.test.php',
    'php -d zend.assertions=1 test/php-assertions.test.php',
    'php bin/lint.php --check-omission-suites spec/one.json spec/two.json',
];

function runParallelMake(target, failCall = '') {
    const directory = mkdtempSync(path.join(tmpdir(), 'handlebars-spec-make-order-'));
    const binDirectory = path.join(directory, 'bin');
    const phpOnly = target === 'test_php';

    try {
        for (const name of ['bin', 'spec', 'export', 'src', 'node_modules']) {
            mkdirSync(path.join(directory, name));
        }
        copyFileSync(path.join(projectRoot, 'Makefile'), path.join(directory, 'Makefile'));
        for (const name of ['package.json', 'tsconfig.json', 'calls.log']) {
            writeFileSync(path.join(directory, name), '');
        }
        if (phpOnly) {
            writeFileSync(path.join(directory, 'spec/two.json'), 'checked-in fixture');
            writeFileSync(path.join(directory, 'export/two.json'), 'checked-in export');
        }

        const requireExports = `
test -f export/two.json || { echo 'Validation started before export finished' >&2; exit 42; }
`;
        const scripts = {
            node: phpOnly ? 'exit 43' : `
case "$1 $2" in
    'dist/cli.js generate')
        sleep 0.1
        printf 'generated\\n' > "$4"
        ;;
    'dist/cli.js export')
        test -f spec/two.json || { echo 'Export started before generation finished' >&2; exit 42; }
        sleep 0.1
        printf 'exported\\n' > "$4"
        ;;
    *) ${requireExports} ;;
esac
`,
            npm: phpOnly ? 'exit 43' : 'exit 0',
            php: requireExports,
            git: requireExports,
        };
        for (const [name, body] of Object.entries(scripts)) {
            const filename = path.join(binDirectory, name);
            writeFileSync(filename, `#!/bin/sh
printf '${name} %s\\n' "$*" >> calls.log
test "$MAKE_TEST_FAIL_CALL" != '${name} '"$*" || exit 44
${body}
`);
            chmodSync(filename, 0o755);
        }

        const environment = { ...process.env };
        for (const name of ['MAKEFLAGS', 'MFLAGS', 'MAKEOVERRIDES']) {
            delete environment[name];
        }
        environment.MAKE_TEST_FAIL_CALL = failCall;
        environment.PATH = binDirectory + path.delimiter + process.env.PATH;

        const result = spawnSync('make', ['--no-print-directory', '-j8', target, 'SPECS=one two'], {
            cwd: directory,
            encoding: 'utf8',
            timeout: 10000,
            env: environment,
        });
        assert.equal(result.error, undefined, result.stdout + result.stderr);
        return { ...result, calls: readFileSync(path.join(directory, 'calls.log'), 'utf8').trim().split('\n') };
    } finally {
        rmSync(directory, { recursive: true });
    }
}

for (const target of ['all', 'export', 'test_node', 'test', 'check']) {
    test(`parallel make ${target} finishes producing fixtures before consuming them`, () => {
        const result = runParallelMake(target);

        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.deepEqual(result.calls.filter(call => /node dist\/cli\.js (generate|export) /.test(call)), [
            'node dist/cli.js generate -o spec/one.json handlebars.js/spec/one.js',
            'node dist/cli.js generate -o spec/two.json handlebars.js/spec/two.js',
            'node dist/cli.js export -o export/one.json spec/one.json',
            'node dist/cli.js export -o export/two.json spec/two.json',
        ]);
        if (target === 'test_node' || target === 'test' || target === 'check') {
            assert.deepEqual(
                result.calls.filter(call => nodeValidationCalls.includes(call)),
                nodeValidationCalls,
            );
        }
        if (target === 'test' || target === 'check') {
            assert.deepEqual(
                result.calls.filter(call => phpValidationCalls.includes(call)),
                phpValidationCalls,
            );
            assert.ok(result.calls.includes('npm run lint'), result.calls.join('\n'));
            assert.ok(
                result.calls.includes('git status --short -- dist export spec'),
                result.calls.join('\n'),
            );
            assert.ok(
                result.calls.includes('git status --porcelain -- dist export spec'),
                result.calls.join('\n'),
            );
        }
    });
}

test('standalone PHP validation uses checked-in fixtures without Node or npm', () => {
    const result = runParallelMake('test_php');

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.calls, phpValidationCalls);
});

test('aggregate validation propagates a failure from the generated PHP target', () => {
    const failedCall = 'php test/php-helpers.test.php';
    const result = runParallelMake('test', failedCall);

    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.ok(result.calls.includes(failedCall), result.calls.join('\n'));
});

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
