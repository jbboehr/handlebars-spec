
SPECS := basic blocks builtins data helpers parser partials regressions \
		string-params subexpressions strict tokenizer track-ids \
		whitespace-control

all: spec export

dist: node_modules src tsconfig.json
	tsc

node_modules: package.json
	npm install

spec: dist
	$(foreach var, $(SPECS), node dist/cli.js generate -o spec/$(var).json handlebars.js/spec/$(var).js;)

export: dist
	$(foreach var, $(SPECS), node dist/cli.js export -o export/$(var).json spec/$(var).json;)


test: test_changes test_eslint test_node test_php
check: test

test_changes:
	sh -c 'git status --porcelain | grep 'spec/' && exit 1 || exit 0'

test_node: dist
	@echo ---------- Testing spec against handlebars.js ----------
	node dist/cli.js testRunner

test_php:
	@echo ---------- Linting PHP code ----------
	php bin/lint.php $(foreach var,$(SPECS),spec/$(var).json)

test_eslint: node_modules
	eslint --ext .js,.ts .


.PHONY: all spec export test test_changes test_eslint test_node test_php
.DEFAULT_GOAL: all
