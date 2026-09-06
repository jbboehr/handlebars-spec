# Changelog

All Notable changes to `handlebars-spec` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

## [Unreleased]

### Added

- [Fixture format reference](docs/fixture-format.md), including callback encoding,
  exception matching, and PHP integration requirements. Included in the npm package.
- PHP translation for the decorator fixture that checks access to root variables.

### Changed

- Updated fixtures and compiler exports to Handlebars.js 4.7.9, including a new
  case for `#each` with block parameters and strict compilation.
- Sparse-array values now include `!length` to preserve their full length.
  Consumers should treat this field as encoding metadata, alongside `!sparsearray`.
- The npm package now ships fixture data and its format reference with no runtime
  dependencies. The previously bundled `handlebars-spec` executable and generator
  sources are no longer included.

### Fixed

- Corrected exported ASTs and opcodes for fixtures using `ignoreStandalone`, so
  their whitespace matches the expected rendering.
- Corrected the PHP callback for nested block parameters to produce the expected
  `13foo` result.
- PHP callbacks now reject incorrect helper and decorator metadata with
  `RuntimeException`, including when `zend.assertions` is disabled. Consumers must
  supply the metadata described in the [PHP callback adapter requirements](docs/fixture-format.md#php-callback-adapter).

## [104.7.106] - 2020-05-01

### Fixed

- npm packaging issues
- ungenerated export/

### Removed

- Bench spec

## [104.7.6] - 2020-04-30

### Changed

- Rewrote everything in TypeScript
- Switched the license to `AGPL-3.0-or-later`. The specification data is still licensed under the `MIT` license, as it is extracted from `handlebars.js`
- `description` now includes all `describe($description, ...)` from the handlebars test suite
- `exception` can now be either `true`, a string, or a regex.
- `message` used to be the exception message, but will now be any extra message noted in the handlebars.js test suite
- `options` was renamed to `runtimeOptions` to differentiate from `compileOptions`
- Using a new version format `104.7.6` which is: `(myMajor * 100 + handlebarsMajor) + '.' + (myMinor * 100 + handlebarsMinor) + '.' + (myPatch * 100 + handlebarsPatch)`

### Added

- `number` is now included in tests (besides the first implied `00`) that have multiple cases

### Removed

- `compat` is removed in favor of `compileOptions.compat`
- `globalPartials`, `globalDecorators`, and `globalHelpers` are now removed and merged into
  `partials`, `decorators`, and `helpers` instead

[Unreleased]: https://github.com/jbboehr/handlebars-spec/compare/v104.7.106...HEAD
[104.7.106]: https://github.com/jbboehr/handlebars-spec/compare/v104.7.6...v104.7.106
[104.7.6]: https://github.com/jbboehr/handlebars-spec/compare/v4.0.5-p1...v104.7.6
