import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertTypeChecks(files, virtualSources = new Map()) {
    const config = ts.readConfigFile(path.join(projectRoot, 'tsconfig.json'), ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
    assert.deepEqual(parsed.errors, []);
    const options = { ...parsed.options, noEmit: true, rootDir: projectRoot };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
        virtualSources.has(file)
            ? ts.createSourceFile(file, virtualSources.get(file), languageVersion)
            : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([
        path.join(projectRoot, 'src/types.d.ts'), ...files,
    ], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics.slice(0, 20), {
        getCanonicalFileName: file => file,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => '\n',
    }));
}

test('fixture types accept encoded values and distinguish suite expectations', () => {
    assertTypeChecks([path.join(projectRoot, 'test/fixtures.types.ts')]);
});

for (const directory of ['spec', 'export']) {
    test(`fixture types accept every checked-in ${directory} fixture literal`, () => {
        const virtualSources = new Map();
        const fixtures = readdirSync(path.join(projectRoot, directory))
            .filter(file => file.endsWith('.json'));
        assert.ok(fixtures.length > 0);
        for (const file of fixtures) {
            const type = directory === 'export' ? 'TestSpecWithAst'
                : file === 'parser.json' ? 'ParserFixture'
                    : file === 'tokenizer.json' ? 'TokenizerFixture' : 'RenderingFixture';
            const source = readFileSync(path.join(projectRoot, directory, file), 'utf8');
            virtualSources.set(path.join(projectRoot, 'test', `${directory}-${file}.ts`),
                `import 'handlebars';\n(${source}) satisfies ${type}[];`);
        }
        assertTypeChecks([...virtualSources.keys()], virtualSources);
    });
}
