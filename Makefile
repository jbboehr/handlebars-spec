# Copyright (c) anno Domini nostri Jesu Christi MMXX-MMXXIV John Boehr & contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

SPECS := basic blocks builtins data helpers parser partials regressions \
		string-params subexpressions strict tokenizer track-ids \
		whitespace-control

all: spec export

dist: node_modules src tsconfig.json
	npm run build

node_modules: package.json
	npm install

spec: dist
	$(foreach var, $(SPECS), node dist/cli.js generate -o spec/$(var).json handlebars.js/spec/$(var).js &&) true

export: dist
	$(foreach var, $(SPECS), node dist/cli.js export -o export/$(var).json spec/$(var).json &&) true


test: test_changes test_eslint test_node test_php
check: test

test_changes: all
	@git status --short -- dist export spec
	@test -z "$$(git status --porcelain -- dist export spec)"

test_node: dist
	@echo ---------- Testing spec against handlebars.js ----------
	node --test test/*.test.mjs
	node dist/cli.js testRunner

test_php:
	@echo ---------- Linting PHP code ----------
	php test/php-lint.test.php
	php bin/lint.php --check-omission-suites $(foreach var,$(SPECS),spec/$(var).json)

test_eslint: node_modules
	npm run lint


.PHONY: all dist spec export test test_changes test_eslint test_node test_php
.DEFAULT_GOAL: all
