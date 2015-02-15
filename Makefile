
BASIC_SPECS := basic blocks builtins data helpers partials regressions \
		 string-params subexpressions track-ids whitespace-control
SPECS := $(BASIC_SPECS) parser tokenizer

all: spec opcodes

spec: node_modules
	$(foreach var, $(SPECS), node bin handlebars.js/spec/$(var).js -o spec/$(var).json;)

opcodes: node_modules
	$(foreach var, $(BASIC_SPECS), node bin/opcodes spec/$(var).json -o opcodes/$(var).json;)

check_changes:
	@git status --porcelain | grep 'spec/' && return 1 || return 0

test: jshint test_node test_php

test_node:
	@echo ---------- Testing spec against handlebars.js ---------- 
	node bin/runner.js

test_php:
	@echo ---------- Linting PHP code ---------- 
	php bin/lint.php $(foreach var,$(SPECS),spec/$(var).json)

jshint: node_modules
	./node_modules/.bin/jshint  bin/*.js

node_modules:
	npm install

.PHONY: all spec opcodes check_changes test test_node test_php
