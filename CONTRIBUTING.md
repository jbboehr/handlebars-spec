# Contributing

This repository turns the pinned Handlebars.js test suite into fixtures for
other implementations. The [fixture format](docs/fixture-format.md) describes
the data consumed by those implementations.

## Set up a checkout

Use Node.js and npm, Git, GNU Make, and a POSIX shell. The Node regression tests
exercise Make recipes, so Make and the shell are needed even for `npm test`.
PHP is needed for the PHP checks. Composer 2 installs contributor guidance and
validates package metadata.
The [CI workflow](.github/workflows/ci.yml) lists the tested runtime versions.

The optional `nix develop` shell supplies Node.js 24, PHP, Composer, and lint
tools, and installs the repository's pre-commit hooks.

Run these commands from the repository root:

```sh
git submodule update --init --recursive
npm ci
composer install
npm test
```

The submodule supplies upstream test sources. Install dependencies in this
repository's root. Composer installs Ruinenwert and The Measure of Words as
development guidance. Read [AGENTS.md](AGENTS.md) for their scope and installed
paths. The PHP checks themselves require no Composer dependencies.

`npm test` builds the TypeScript tooling into `dist/`, runs the Node regression
tests, and validates the checked-in `spec/` fixtures against Handlebars.js. It
stops at the first failing stage. It does not require PHP or perform the full
fixture regeneration, lint, and consistency checks described below.

## Change tooling or fixtures

- Edit TypeScript tooling in `src/`. The generated JavaScript lives in `dist/`.
- Upstream suites come from `handlebars.js/spec/` at the recorded submodule
  revision. Update that revision deliberately when importing upstream changes.
- Put fixture adaptations in `patch/<suite>.json` and shared callback
  translations in `patch/_functions.hjson`.
- Regenerate `spec/` and `export/` from those inputs instead of editing the
  generated JSON directly.

Build the tooling and regenerate all suites and compiler exports with:

```sh
make
git diff -- dist spec export patch
```

Include the resulting `dist/`, `spec/`, and `export/` changes with the source
change. Generation can also add new callback entries to
`patch/_functions.hjson`, so inspect that diff too. Running `make` again should
leave the generated files byte-for-byte unchanged.

For a single suite, after building the tooling:

```sh
npm run build
node dist/cli.js generate -o spec/basic.json handlebars.js/spec/basic.js
node dist/cli.js export -o export/basic.json spec/basic.json
node dist/cli.js testRunner spec/basic.json
```

Add focused regression tests in `test/`. Exercise the behavior that motivated
the change, including generation through execution when the fixture format is
involved. During development, run selected Node tests after building:

```sh
node --test test/generate.test.mjs test/testRunner.test.mjs
```

## Update PHP translations and omissions

The generator matches callbacks in `patch/_functions.hjson` by normalized
JavaScript source and copies the associated translations into fixtures. When
changing only a PHP translation, preserve its JavaScript source. PHP callbacks
must retain the source callback's assertions and behavior. See the
[PHP callback contract](docs/fixture-format.md#php-callback-adapter) for the required
options adapter and support functions.

Use `patch/<suite>.json` for a fixture-specific override. Keys are the lowercase
form of `description + ' - ' + it + ' - ' + number`, with `00` for an omitted
number. Preserve explicit numbers and numbering gaps. A `null` patch skips the
source fixture. Generation rejects unused patch entries.

To prepare missing PHP translations, write stubs to a scratch file:

```sh
mkdir -p tmp
php bin/stubs.php spec/string-params.json tmp/string-params-patch.json
```

This includes existing suite patches and adds `phpstub` fields containing
JavaScript. For callbacks you intend to support, replace the stub with a `php`
field containing the translated callback, then merge those changes into
`patch/string-params.json`. Regenerate with `make` and add callback tests
covering valid inputs and any required assertion failures. `make test_php`
includes assertion checks with assertions both enabled and disabled.

Record intentional compiler export omissions in `patch/_export.json` and
intentional missing PHP translations in `patch/_php.json`. These manifests
describe different omissions from a `null` source patch. Keep entries limited
to intended exceptions and remove them when support is added. Checks reject
unexpected failures and stale omission entries.

## Verify a change

Run the full local checks and validate Composer metadata:

```sh
make check
composer validate --strict
```

`make check` regenerates all artifacts, checks for generated changes, runs
ESLint and the Node tests and fixture runner, and checks PHP syntax, callbacks,
stubs, assertions, and declared omissions. `make test_php` also works on its
own, without Node dependencies or the upstream submodule. These PHP checks do
not run a complete PHP Handlebars renderer.

The generated-file guard requires `dist/`, `spec/`, and `export/` to match the
commit, including staged changes and untracked files. While reviewing an
intentional generated change, use `make -j8 -k check` to run the other checks
even when that guard fails. Inspect the generated diff and confirm that a
second generation produces identical files. Resolve every other failure, then
run `make check` again after committing.

For documentation and Nix changes, the Nix checks run Markdown, workflow,
shell, and Nix linters, while the build checks the fixture package:

```sh
nix flake check -L
nix build --no-link -L
```

Nix's Git source excludes untracked files. Lint a new Markdown file directly
with `markdownlint CONTRIBUTING.md` (substitute the file you changed) until it
is tracked. CI also exercises the runtime versions in its matrix.
