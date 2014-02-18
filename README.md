# [Handlebars](http://handlebarsjs.com) Spec

The Handlebars.js specification converted to JSON, ready for cross-platform consumption.

## Development

The JSON spec files are generated by a simple CLI tool found in [`bin/index.js`](bin/index.js), which can be invoked like this:

```sh
$ node bin [input.js] -o [output.json]
```
### Patch files

Patches can be applied to the JSON output by putting a file of the same name as the JSON output in the [`patch`](patch) directory. Specs are identified using the following format: `[description]-[it]-[nn]` (all lowercased).

---

Copyright 2014 © [Kasper Kronborg Isager](https://kasperisager.github.io). Licensed under the terms of the [MIT License](LICENSE.md)
