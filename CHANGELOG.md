# Changelog

All Notable changes to `handlebars-spec` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

## [Unreleased]

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

[Unreleased]: https://github.com/jbboehr/handlebars.c/compare/v4.0.5-p1...HEAD
