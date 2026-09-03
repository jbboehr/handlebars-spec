# Handlebars Spec

[![CI](https://github.com/jbboehr/handlebars-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/jbboehr/handlebars-spec/actions/workflows/ci.yml)

JSON test fixtures derived from the
[Handlebars.js](https://github.com/handlebars-lang/handlebars.js) test suite. Use
them to check whether another Handlebars implementation matches upstream
rendering, parsing, and compiler behavior without porting the JavaScript tests.

## Install

Install the fixtures as a development dependency from npm:

```sh
npm install --save-dev handlebars-spec
```

The JSON files will be available under
`node_modules/handlebars-spec/spec/` and
`node_modules/handlebars-spec/export/`.

For PHP projects, install the Composer package:

```sh
composer require --dev jbboehr/handlebars-spec
```

The same directories will be available under
`vendor/jbboehr/handlebars-spec/`.

## Data sets

The [`spec/`](spec/) directory contains rendering fixtures. Each file covers one
part of Handlebars, such as blocks, helpers, partials, strict mode, or whitespace
control.

The [`export/`](export/) directory contains compiler-facing fixtures. These add
the Handlebars abstract syntax tree and compiler opcodes to the corresponding
rendering cases.

Use `spec/` to test a renderer or runtime. Use `export/` when an implementation
also needs to reproduce the Handlebars parser or compiler output.

## Fixture format

A basic rendering fixture looks like this:

```json
{
  "description": "basic context",
  "it": "most basic",
  "template": "{{foo}}",
  "data": {
    "foo": "foo"
  },
  "expected": "foo"
}
```

Common fields include:

- `description`, `it`, and optional `number` identify the source test.
- `template` and `data` provide the template and its input context.
- `expected` contains the rendered output. Tests that should fail use
  `exception` instead.
- `compileOptions` and `runtimeOptions` select non-default Handlebars behavior.
- `helpers`, `partials`, and `decorators` define values required by the test.

Some fixtures need executable helper or decorator code. Those values use a
tagged object with source for each supported language:

```json
{
  "!code": true,
  "javascript": "function () { return 'value'; }",
  "php": "function () { return 'value'; }"
}
```

Consumers can select the implementation for their language or skip fixtures
that do not provide one.

## Versioning

Versions combine this project's version with the Handlebars.js version. Each
component is calculated as:

```text
project component × 100 + Handlebars.js component
```

For example, `104.7.106` represents project version `1.0.1` based on
Handlebars.js `4.7.6`.

## License

The project tooling is licensed under
[AGPL-3.0-or-later](https://www.gnu.org/licenses/agpl-3.0.html). The specification
data is derived from Handlebars.js and remains available under the
[MIT license](https://opensource.org/license/mit/).
