<?php
/**
 * Copyright (C) 2026 John Boehr
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function expectSame($expected, $actual, $message) {
  if( $expected !== $actual ) {
    fwrite(STDERR, $message . "\nExpected: " . var_export($expected, true)
      . "\nActual: " . var_export($actual, true) . "\n");
    exit(1);
  }
}

// The PHP adapter exposes the declared count on options, rather than options.fn.
// https://github.com/devtheorem/php-handlebars/blob/124e0a59b114f87e38ef7417aceae3b32415b7b2/src/HelperOptions.php#L31
class BlockParameterOptions {
  public function __construct(public int $blockParams, private Closure $body) {}

  public function fn($context, $runtimeOptions) {
    return ($this->body)($context, $runtimeOptions);
  }
}

function invokeNestedHelpers($helper, $counts, &$calls) {
  $count = array_shift($counts);
  return $helper(new BlockParameterOptions($count, function($context, $runtimeOptions) use ($helper, $counts, &$calls) {
    $calls[] = [$context, $runtimeOptions];
    return $counts ? invokeNestedHelpers($helper, $counts, $calls) : 'nested block result';
  }));
}

foreach (['spec/helpers.json', 'export/helpers.json'] as $path) {
  $fixtures = json_decode(file_get_contents(__DIR__ . '/../' . $path), true, 512, JSON_THROW_ON_ERROR);
  $matches = array_values(array_filter($fixtures, function($fixture) {
    return $fixture['description'] === 'helpers - block params'
      && $fixture['it'] === 'should take presednece over parent block params';
  }));
  expectSame(1, count($matches), $path . ': expected one parent block-parameter fixture');

  // Each freshly loaded fixture must have its own counter, shared by its nested calls.
  for ($run = 1; $run <= 2; $run++) {
    $helper = eval('return ' . $matches[0]['helpers']['goodbyes']['php'] . ';');
    $calls = [];
    $result = invokeNestedHelpers($helper, [1, 0, 1], $calls);

    expectSame([
      [['value' => 'bar'], ['blockParams' => [1, 2]]],
      [['value' => 'bar'], ['blockParams' => null]],
      [['value' => 'bar'], ['blockParams' => [3, 4]]],
    ], $calls, $path . ': incorrect nested block-parameter sequence');
    expectSame('nested block result', $result, $path . ': helper discarded its block result');
  }

  echo $path . " nested block parameters and fresh fixture state ... Ok\n";
}
