
BASIC_SPECS := basic blocks builtins data helpers partials regressions \
		string-params subexpressions strict track-ids \
		whitespace-control
SPECS := $(BASIC_SPECS)# parser tokenizer

all: spec export

spec: dist
	$(foreach var, $(SPECS), node dist/cli.js generate -o spec/$(var).json handlebars.js/spec/$(var).js;)

export: dist
	$(foreach var, $(BASIC_SPECS), node bin/export spec/$(var).json -o export/$(var).json;)

check_changes:
	@git status --porcelain | grep 'spec/' && return 1 || return 0

stubs:
	$(foreach var, $(SPECS), php bin/stubs.php spec/$(var).json patch/$(var).json;)

test: jshint test_node test_php

test_node: dist
	@echo ---------- Testing spec against handlebars.js ----------
	node dist/cli.js testRunner

test_php:
	@echo ---------- Linting PHP code ----------
	php bin/lint.php $(foreach var,$(SPECS),spec/$(var).json)

jshint: node_modules
	./node_modules/.bin/jshint  bin/*.js

dist: node_modules src
	tsc

node_modules: package.json
	npm install

.PHONY: all spec export check_changes test test_node test_php
