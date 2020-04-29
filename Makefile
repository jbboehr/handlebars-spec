
SPECS := basic blocks builtins data helpers partials regressions \
		string-params subexpressions strict track-ids \
		whitespace-control

all: spec export

spec: dist
	$(foreach var, $(SPECS), node dist/cli.js generate -o spec/$(var).json handlebars.js/spec/$(var).js;)

export: dist
	$(foreach var, $(SPECS), node dist/cli.js export -o export/$(var).json spec/$(var).json;)

check_changes:
	@git status --porcelain | grep 'spec/' && return 1 || return 0

stubs:
	$(foreach var, $(SPECS), php bin/stubs.php spec/$(var).json patch/$(var).json;)

test: test_eslint test_node test_php
check: test

test_node: dist
	@echo ---------- Testing spec against handlebars.js ----------
	node dist/cli.js testRunner

test_php:
	@echo ---------- Linting PHP code ----------
	php bin/lint.php $(foreach var,$(SPECS),spec/$(var).json)

test_eslint: node_modules
	eslint --ext .js,.ts --fix .

dist: node_modules src
	tsc

node_modules: package.json
	npm install

.PHONY: all spec export check_changes eslint test test_node test_php
.DEFAULT_GOAL: all
