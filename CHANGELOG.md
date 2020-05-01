# Changelog

All Notable changes to `handlebars-spec` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

## [Unreleased]

### Changed
- Rewrote everything in TypeScript
- `description` now includes all `describe{$description, )` from the handlebars test suite
- `number` is now included in tests (besides the first implied `00`) that have multiple cases
- `globalPartials`, `globalDecorators`, and `globalHelpers` are now removed and merged into
  `partials`, `decorators`, and `helpers` instead
  `compat` is removed in favor of `compileOptions.compat`
- Using a new version format `104.7.6` which is: `(myMajor * 100 + handlebarsMajor) + '.' + (myMinor * 100 + handlebarsMinor) + '.' + (myPatch * 100 + handlebarsPatch)`
- Remove more empty objects

[Unreleased]: https://github.com/jbboehr/handlebars.c/compare/v4.0.5-p1...HEAD
