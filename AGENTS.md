# Contributor guidance

This repository adopts Ruinenwert and The Measure of Words from
[Doctrine of the Second Sun](https://github.com/jbboehr/doctrine-of-the-second-sun).
Adoption is limited to these two documents. Ruinenwert uses its default Fork
Continuity profile.

Run `composer install` from the repository root to install the development
dependency at the revision pinned in `composer.lock`. Read the installed guides:

- `vendor/jbboehr/doctrine-of-the-second-sun/RUINENWERT.md` before planning,
  implementing, or reviewing engineering changes.
- `vendor/jbboehr/doctrine-of-the-second-sun/MEASURE-OF-WORDS.md` before writing
  technical documentation, comments, commit messages, or review summaries.

## Repository scope

Apply Ruinenwert to maintained code, fixture contracts, packaging, and development
workflows. Apply The Measure of Words to technical prose. Preserve literal fixture
content and upstream source when editing prose.

Repository-specific instructions govern source boundaries and verification. Follow
[CONTRIBUTING.md](CONTRIBUTING.md) for changes to source and generated files, and
for the required checks. Preserve the consumer contract documented in
[docs/fixture-format.md](docs/fixture-format.md).

When updating the Doctrine dependency, review changes to both adopted guides and
update this policy if needed.
