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

Each JSON file contains an array of fixtures. Most files in [`spec/`](spec/)
test rendering. Two suites have different expectations:

- `parser.json` compares the parser's printed tree representation.
- `tokenizer.json` compares ordered token objects with `name` and `text` fields.

The [`export/`](export/) files add syntax trees and compiler opcodes to the
corresponding fixtures. Some cases cannot be compiled and appear only in `spec/`.

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

Fixtures can also supply helpers, partials, decorators, and compile or runtime
options. Cases expecting failure use `exception` instead of `expected`.

The [fixture-format reference](docs/fixture-format.md) covers fixture identity,
matching rules, callback translations, sparse arrays, PHP integration, and
omissions. It is included in the installed npm package.

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
