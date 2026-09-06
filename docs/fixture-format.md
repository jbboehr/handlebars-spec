# Fixture format

Reference for consumers of the Handlebars Spec JSON fixtures.
See the [package overview](../README.md) for installation.

## Fixture kinds

Each JSON file contains an array of fixtures. The filename identifies the suite.
The [`spec/`](../spec/) files contain three kinds of expectations:

| Files | Operation | Successful `expected` value |
| --- | --- | --- |
| `parser.json` | Parse `template` and print the tree using Handlebars.js's `Handlebars.print` representation | A string, including its whitespace and trailing newline |
| `tokenizer.json` | Tokenize `template` | An ordered array of objects with `name` and `text` strings |
| All other supplied `spec/*.json` files | Compile and render `template` | The exact rendered string |

Parser expectations are a textual tree representation. For example, parsing
`{{foo}}` produces `"{{ PATH:foo [] }}\n"`. Tokenizer expectations compare both
the token type and the lexer-provided text, without an EOF token. String tokens
omit their surrounding quotes. For `{{foo}}`, the expectation is:

```json
[
  { "name": "OPEN", "text": "{{" },
  { "name": "ID", "text": "foo" },
  { "name": "CLOSE", "text": "}}" }
]
```

The [`export/`](../export/) directory adds compiler data to the corresponding
fixtures. Each exported fixture has `ast` (the JSON representation of the
Handlebars.js syntax tree) and `opcodes` (its compiler environment, including
instructions and child programs). Fixtures with partials also have
`partialAsts` and `partialOpcodes`, indexed by partial name. Parsing and opcode
compilation use the fixture's `compileOptions`, including whitespace options.

An exported fixture retains its original kind and expectation. In particular,
`export/parser.json` still expects printed trees and `export/tokenizer.json`
still expects tokens. The additional `ast` field is distinct from `expected`.
Exported files can contain fewer cases than their `spec/` counterparts because
some inputs cannot be compiled. Match them by [fixture identity](#fixture-identity),
not array position. See [omissions](#omissions) for the different reasons a case
or translation can be absent.

## Fields and execution

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

`description`, `it`, and `template` are strings. Other fields depend on the case:

| Field | Meaning |
| --- | --- |
| `number` | Optional string identifying an expectation within the source test. Omission means `"00"`. |
| `data` | The input context. It can be an object, array, scalar, or `null`, and can be absent. |
| `expected` | The successful result for the fixture kind described above. An empty string is a valid result. |
| `exception` | An expected failure, using the matching rules below. |
| `compileOptions` | Options passed when parsing and compiling a rendering fixture, such as `strict`, `compat`, or `ignoreStandalone`. |
| `runtimeOptions` | Options passed when executing a compiled template, such as the `data` frame used for `@` variables. |
| `helpers`, `decorators` | Maps from names to tagged callback values. Helper maps may also contain unused string values. |
| `partials` | A map from names to template strings or tagged callback values. |
| `message`, `note` | Optional explanatory text for diagnostics. These do not change the expected result. |

Absent helper, partial, decorator, and option maps mean that the fixture supplies
no entries for them. Use the runtime's normal defaults, including built-in
helpers. Preserve explicit option values such as `false`. Top-level `data` is
the rendering context, while `runtimeOptions.data` is the separate data frame.
Names such as `helpers`, `message`, and `compileOptions` inside the context are
ordinary input properties.

For rendering cases, load the supplied helpers, partials, and decorators into
the fixture's runtime environment, compile with `compileOptions`, and execute
with `data` and `runtimeOptions`. Compare successful output exactly, without
trimming or normalizing whitespace. Start each fixture with fresh runtime state
and freshly loaded callbacks, while reusing those callbacks within that fixture.
Some callbacks deliberately retain state across nested invocations.

## Fixture identity

Within a suite, the canonical identity is:

```javascript
const identity = (
  fixture.description + ' - ' + fixture.it + ' - ' + (fixture.number ?? '00')
).toLowerCase();
```

For example, `description: "Suite"`, `it: "Entry"`, and `number: "02"` identify
`suite - entry - 02`. The spaces around each hyphen are significant. Descriptions
can already contain ` - ` from nested source suites.

Use the recorded number, including its leading zero. Omissions can leave gaps
or remove the `"00"` case, so a fixture's array index cannot recover its number.
Keep the suite filename alongside the identity when combining files. These
identities connect fixtures and patches within a release, but upstream test
renames or edits can change them between releases.

## Expected exceptions

Fixtures expecting failure use `exception` in place of `expected`. For rendering
cases, either compilation or template execution can raise the expected failure.
Parser and tokenizer cases apply the expectation to their respective operation.
An output-comparison failure does not satisfy an exception expectation.

| `exception` value | Matching rule |
| --- | --- |
| `true` | Any thrown value satisfies the expectation. |
| `"missing property"` | The error message must contain this substring, with matching case. |
| `""` | An error must still be thrown. Any message that can be converted to a string matches the empty substring. |
| `"/missing.*property/i"` | Match the message using the serialized JavaScript regular expression and its flags. |

The runner uses an error's `message` when available. A thrown string is its own
message, and other thrown values are converted to strings when possible.
Strings of the form `/pattern/flags` are treated as regular expressions when
the flags consist of `d`, `g`, `i`, `m`, `s`, `u`, `v`, or `y`. A pattern or flag
combination that the JavaScript runtime rejects fails the expectation. Other
strings use substring matching. A consumer using another regex engine needs
equivalent matching behavior.

Test for `true` or a string when recognizing an exception expectation. A
truthiness check would miss the empty-string matcher. Missing, `null`, or `false`
exception values do not request a failure.

## Callback values

Executable values use a tagged object with source for each available language:

```json
{
  "!code": true,
  "javascript": "function () { return 'value'; }",
  "php": "function () { return 'value'; }"
}
```

Language fields are optional. For example, `basic.json` includes a PHP-only
`length` helper to implement string-length access that JavaScript provides
natively.

The language values are source expressions that produce callbacks. Decode
`!code` values wherever they occur, including inside `data`, nested arrays,
`runtimeOptions`, helpers, partials, and decorators. Preserve the surrounding
data structure. A partial can also be a plain template string.

JavaScript callbacks use the upstream calling conventions, including the current
context as `this`. Some refer to `Handlebars`, assertion functions such as
`equal` or `equals`, or shared fixture state. A consumer must supply the needed
harness behavior or provide an equivalent native callback.

Select the implementation for the consumer's language. A missing `php` field
means that no PHP translation is supplied for that callback. A `phpstub` field
contains untranslated JavaScript for porting and is not executable PHP. If a
fixture requires a callback that your runtime cannot supply, report the fixture
as skipped or unsupported, separately from passes.

## Sparse arrays

A sparse array is encoded as an object with `!sparsearray: true`, its total
`!length`, and the indices that are present. For example:

```json
{
  "!sparsearray": true,
  "!length": 4,
  "1": "foo",
  "3": "bar"
}
```

This represents an array of length four with holes at indices zero and two.
Holes differ from present entries whose value is `null`. Preserve both index
presence and length, including any trailing holes. The marker and length are
encoding metadata, not entries to pass to the template.

Indices are canonical integer strings from `"0"` through `"4294967294"`, such
as `"3"`. The runner ignores other keys on the tagged object. Older encodings can
omit `!length`, in which case the runner derives the length from the highest
present index plus one (or zero for no indices). Sparse arrays and callback
values can be nested, so decode their contents recursively.

## PHP callback adapter

The package supplies PHP source expressions, but no PHP renderer, options class,
or autoloader. The consuming implementation supplies those parts. PHP helpers
receive their positional arguments followed by an options object. Translations
that need the current context read `$options->scope` instead of JavaScript's
`this`. For example:

```php
function ($options) {
    return $options->scope['name'];
}
```

Context callbacks use the translated signature, which can include this options
object even when the JavaScript callback has no declared arguments. Callable
partials receive their context and runtime options. Decorator translations use
`function ($fn, $props, $container, $options)`, with decorator arguments in
`$options->args`.

The supplied PHP callbacks expect the following adapter behavior as needed by
each fixture:

| Access | Meaning |
| --- | --- |
| `$options->scope` | The current context, with array access for object properties used by the translations. |
| `$options['hash']`, `$options->hash` | Named arguments as a PHP array. Preserve keys whose value is `null`. |
| `$options['data']` | The data frame, including fields such as `index`, `root`, or `contextPath`. |
| `$options['name']` | The helper name. |
| `$options->fn(...)`, `$options->inverse(...)` | Execute the main or inverse block, with an optional context and runtime-options array. A call without a context uses the current scope. |
| `$options->blockParams` | The integer count of declared block parameters. Values passed into a block go in the separate runtime-options `blockParams` array. |
| `$options->types`, `$options['contexts']` | Argument type and context metadata for string-parameter fixtures. |
| `$options->ids`, `$options->hashIds` | Tracking metadata when enabled. Translations also read these through array access. |
| `$options->lookupProperty($context, $name)` | Property lookup using the runtime's lookup rules. |

The adapter must support both property access and `ArrayAccess` for metadata
used through both forms. Some decorator fixtures also read or write properties
on the program callable, such as `$options->fn->run` and `$fn->run`, and on
`$props`. Their program wrappers need to preserve these properties as well as
being callable.

The evaluation scope must resolve `SafeString` (some translations explicitly use
`\Handlebars\SafeString`) to a value the renderer recognizes as already escaped.
It must also provide `Utils::createFrame()` for copying a data frame while
retaining its parent relationship. Supply compatible classes or aliases from
the consuming runtime. PHP fixture assertions throw `RuntimeException` directly
and do not require `zend.assertions` to be enabled.

## Omissions

Missing source cases, missing compiler exports, and missing translations have
different meanings:

- A source-suite omission removes a case before `spec/` is written. For example,
  a `null` fixture entry in the source repository's `patch/<suite>.json` skips
  that case. It is absent from both data sets, but still reserves its number.
- An export omission leaves the case in `spec/` and omits it from `export/`.
  The source repository's `patch/_export.json` records cases that cannot produce
  compiler data, including expected parse failures, lexer-only inputs, and
  function-valued partials.
- A missing PHP translation leaves the fixture and its JavaScript callback in
  the data sets. Intentional PHP omissions are listed in `patch/_php.json` by
  suite, canonical identity, and callback path, such as `[helpers.tomdale]`.
  They are not whole-fixture export omissions.

The omission manifests belong to the source repository and are not included in
the npm fixture package. Use the source revision matching your installed
version when investigating an omission. A missing callback implementation does
not imply that the fixture itself should be absent or counted as passing.
