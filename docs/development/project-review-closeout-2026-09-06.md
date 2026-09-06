# Project review closeout

The ten numbered findings from the September 4 review and improvements B–D
have been implemented. This final audit checked section A's semantic test
recommendations against the tests present at `e55d5ba`, then added coverage
for compiler exports and fixed one remaining tokenizer validation error.

Final review found no actionable regressions. No further implementation work
was identified for the original plan.

## Finding from the final audit

The saved-fixture runner accepted numeric token text where the tokenizer
produced a string. For the template `{{foo 1}}`, this incorrect expected token
passed validation:

```json
{ "name": "NUMBER", "text": 1 }
```

The actual token text is `"1"`. The runner used Node's loose `assert.deepEqual`,
which treated these values as equal. Source generation already rejected this
mismatch, but the saved-fixture tests only exercised a valid token array.

The new CLI regression failed before the fix: it expected exit status 2 but
received status 0 and `Success: 1`. Wrong-name and wrong-string controls were
already rejected. The runner now uses:

```typescript
assert.deepStrictEqual(actual, test.expected);
```

All three negative cases now report one failed fixture and exit status 2.
Existing valid tokenizer fixtures still pass. The change is in
[testRunner.ts](../../src/commands/testRunner.ts), with regression coverage in
[testRunner.test.mjs](../../test/testRunner.test.mjs) and regenerated JavaScript
and its source map in `dist/`.

## Section A coverage

| Recommendation | Evidence | Result |
| --- | --- | --- |
| Compare compiler exports with compilation using fixture options | New checks in [export.test.mjs](../../test/export.test.mjs) match all 592 exported fixture identities to source fixtures, accounting for declared omissions. They compare every saved AST and opcode tree, including 147 partial programs, with fresh Handlebars compilation using source options. | Covered |
| Execute saved rendering ASTs with the fixture's runtime setup | A new test runs all 462 rendering exports through the real fixture runner using their saved ASTs and partial ASTs. It retains data, helpers, decorators, runtime options, expected output, and exception expectations. | Covered |
| Execute representative PHP callbacks, including invalid inputs | [php-helpers.test.php](../../test/php-helpers.test.php) checks nested block parameters and fresh fixture state. [php-assertions.test.php](../../test/php-assertions.test.php) checks hash metadata, decorators, block parameter counts, string parameters, subexpressions, and tracking IDs in both data sets. | Covered at the callback/adapter level |
| Exercise source capture through JSON encoding, decoding, and execution | [generate.test.mjs](../../test/generate.test.mjs) runs dense/sparse nested callbacks, non-enumerable indices, metadata-shaped data keys, empty partials, and exception matchers through the full pipeline. [utils.test.mjs](../../test/utils.test.mjs) also checks holes, length, own properties, and preservation of input values. | Covered |
| Reject wrong tokenizer expectations and unsupported suites | Generator tests reject wrong names, text, missing tokens, and numeric text. Runner tests reject unsupported selected/discovered suites and empty runs. This slice adds the saved-tokenizer negative cases described above. | Covered |

The compiler checks use the pinned Handlebars dependency as the reference,
independently of the project exporter. Public `precompile` supplies compiler
option defaults so the test does not copy the exporter's defaulting rules.
ASTs and opcode trees are JSON-normalized for comparison with shipped data.

The AST execution test adapts temporary fixtures to Handlebars' supported AST
input form. The published fixture format still requires a template string.
Parser and tokenizer exports receive compiler comparisons, but are excluded
from rendering execution because their expectations have different meanings.

Existing exception, sparse-array, omission-manifest, and package-content tests
remain in the suite. The audit did not find a useful reason to add duplicate
array or exception permutations.

## Sensitivity checks

The new compiler tests passed against the unchanged corpus. Four isolated
copies were then corrupted to confirm that the tests detect plausible export
defects. The working tree's fixtures were not modified by these experiments.

| Deliberate defect | Observed failure |
| --- | --- |
| Change a saved main AST's content | Saved-AST execution failed the `basic context - escaping` expectation. |
| Change a saved partial AST's content | Saved-AST execution failed the `partials - basic partials` expectation. |
| Change an opcode's text argument | Reference comparison failed for the template opcodes. |
| Parse an `ignoreStandalone` fixture without its options | Reference comparison failed for the template AST. |

The tests passed again after restoring the copies.

## Status of the earlier work

| Review item | Current implementation and regression evidence |
| --- | --- |
| 1. Parser options in exports | [export.ts](../../src/commands/export.ts) passes options into parsing. Focused whitespace/partial tests execute ASTs and opcodes, supplemented by the corpus checks above. |
| 2. PHP block-parameter counter | [php-helpers.test.php](../../test/php-helpers.test.php) verifies the `[1, 2]`, omitted, `[3, 4]` nested sequence and fresh state for a newly loaded callback. |
| 3. PHP assertions | [php-assertions.test.php](../../test/php-assertions.test.php) verifies valid behavior and rejection of invalid metadata with Zend assertions enabled and disabled. |
| 4. Callbacks beneath arrays | [utils.test.mjs](../../test/utils.test.mjs) and [generate.test.mjs](../../test/generate.test.mjs) cover dense/sparse arrays and nested callback execution. |
| 5. Metadata cleanup | The same tests preserve metadata-shaped data, empty partials, and empty exception matchers. |
| 6. Tokenizer source assertions | [generate.test.mjs](../../test/generate.test.mjs) deliberately changes upstream expectations and checks unsuccessful generation without overwriting output. |
| 7. Unsupported or empty fixture runs | [testRunner.test.mjs](../../test/testRunner.test.mjs) checks unsuccessful selected/discovered unsupported suites, mixed selections, and zero-execution runs. |
| 8. Parallel Make ordering | [make.test.mjs](../../test/make.test.mjs) checks generation before consumption, standalone PHP validation, and failure propagation using real Make recipes. |
| 9. Absolute input paths | Runner tests exercise absolute and relative fixture paths from another working directory, including spaces. |
| 10. PHP stub identities | [php-stubs.test.php](../../test/php-stubs.test.php) covers implied and explicit numbers, numbering gaps, existing translations, and null skips. |
| B. Consumer contract | [fixture-format.md](../fixture-format.md) documents fixture kinds, encoding, identity, exceptions, PHP support requirements, and omissions. Package tests verify its inclusion. |
| C. Fixture types | [types.test.mjs](../../test/types.test.mjs) type-checks every source/export fixture literal and a focused contract covering valid and invalid shapes. |
| D. Shared logic and contributor workflows | The runner uses the shared decoder, obsolete harness fields/code were removed, and [CONTRIBUTING.md](../../CONTRIBUTING.md) documents the workflow and `npm test` scope. |

## Verification

Review follow-up found two `no-undef` errors in the new compiler tests, so the
earlier claim that ESLint passed was incorrect. Both cloning calls now use
`globalThis.structuredClone`. The results below reflect verification after
that correction.

Local checks used Node.js 24.19.0 and PHP 8.4.24 on x86_64 Linux.

| Check | Result |
| --- | --- |
| Focused tokenizer generation/runner checks | 10 passed after observing the numeric-text regression fail before the fix. |
| `npm test` | Build passed, 141 Node tests passed, 632 fixtures passed. |
| `npm run lint` | Passed after observing both `structuredClone` references fail the `no-undef` rule before the correction. |
| `make -j8 -k check` | Build, generation, exports, ESLint, Node, and PHP checks passed. The aggregate exited 2 solely because the generated-file guard detects this slice's uncommitted `dist/` changes. |
| PHP callback assertions | 300 checks passed in each of `zend.assertions=-1` and `zend.assertions=1`. |
| PHP fixture linting | 384 snippets passed, with 3 declared omissions. |
| Regeneration comparison | All 51 tracked generated/translation file hashes matched the pre-regeneration snapshot. |
| `composer validate --strict` | Passed. |
| `nix flake check -L` and `nix build --no-link -L` | Passed locally. |

The report was also linted directly with the repository's Markdown settings.

## Verification limits

- The reference compiler is the pinned Handlebars dependency. These tests do
  not independently establish the correctness of Handlebars itself.
- Every saved opcode tree receives structural comparison with reference
  compilation. Direct opcode execution remains limited to the focused
  whitespace and partial cases in `export.test.mjs`.
- PHP callbacks run with representative adapter objects. A complete PHP
  Handlebars renderer and the native C callback mapping were not exercised.
- Other CI runtime versions and architectures were not tested locally. Native
  runtime memory safety and a broad dependency security audit are outside this
  coverage audit.

A post-commit `make check` verifies the generated-file guard against the
committed tree.
