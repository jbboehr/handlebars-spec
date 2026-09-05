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

$failures = [];
$checks = 0;

set_error_handler(function($severity, $message, $file, $line) {
  throw new ErrorException($message, 0, $severity, $file, $line);
});

function expectSame($expected, $actual, $label) {
  global $failures, $checks;
  $checks++;
  if( $expected !== $actual ) {
    $failures[] = $label . ': unexpected callback result';
  }
}

function expectRejection($callback, $label) {
  global $failures, $checks;
  $checks++;
  try {
    $callback();
  } catch (RuntimeException $exception) {
    return;
  } catch (Throwable $exception) {
    $failures[] = $label . ': unexpected ' . get_class($exception) . ': ' . $exception->getMessage();
    return;
  }
  $failures[] = $label . ': accepted invalid input';
}

function loadCallback($directory, $suite, $it, $name, $kind = 'helpers') {
  $path = __DIR__ . '/../' . $directory . '/' . $suite . '.json';
  $fixtures = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
  $matches = array_values(array_filter($fixtures, fn($fixture) => $fixture['it'] === $it));
  if( count($matches) !== 1 ) {
    throw new RuntimeException('Expected one fixture: ' . $suite . ' - ' . $it);
  }
  return eval('return ' . $matches[0][$kind][$name]['php'] . ';');
}

foreach (['spec', 'export'] as $directory) {
  // Hash metadata is a PHP array; an undefined value is a present null entry.
  // https://github.com/devtheorem/php-handlebars/blob/124e0a59b114f87e38ef7417aceae3b32415b7b2/src/HelperOptions.php#L28-L29
  $helper = loadCallback($directory, 'strict', 'should allow undefined hash when passed to helpers', 'helper');
  expectSame('success', $helper((object) ['hash' => ['value' => null]]), "$directory: present undefined hash value");
  foreach ([[], ['value' => false], ['value' => 0], ['value' => ''], ['value' => 'defined']] as $hash) {
    expectRejection(fn() => $helper((object) ['hash' => $hash]), "$directory: missing or defined hash value");
  }

  $program = fn() => 'original program';
  foreach ([
    ['should work with root program', 'success', ['wrong', null, false, 0, true]],
    ['should fail when accessing variables from root', null, ['fail', false, 0, '']],
  ] as [$it, $argument, $invalidArguments]) {
    $decorator = loadCallback($directory, 'blocks', $it, 'decorator', 'decorators');
    expectSame($program, $decorator($program, new stdClass(), new stdClass(), (object) ['args' => [$argument]]), "$directory: $it");
    foreach ($invalidArguments as $invalidArgument) {
      expectRejection(
        fn() => $decorator($program, new stdClass(), new stdClass(), (object) ['args' => [$invalidArgument]]),
        "$directory: $it argument validation"
      );
    }
  }

  foreach ([
    'should take presedence over context values' => ['value' => 'bar'],
    'should take presedence over helper values' => [],
    'should not take presedence over pathed values' => ['value' => 'scope'],
    'should allow block params on chained helpers' => ['value' => 'bar'],
  ] as $it => $expectedContext) {
    $helper = loadCallback($directory, 'helpers', $it, 'goodbyes');
    $options = new class {
      public $blockParams = 1;
      public array $scope = ['value' => 'scope'];
      public array $calls = [];
      public function fn($context, $runtimeOptions) {
        $this->calls[] = [$context, $runtimeOptions];
        return 'block result';
      }
    };
    expectSame('block result', $helper($options), "$directory: $it result");
    expectSame([[$expectedContext, ['blockParams' => [1, 2]]]], $options->calls, "$directory: $it block arguments");
    foreach ([0, 2, 1.0, '1', true] as $count) {
      $countLabel = get_debug_type($count) . ' ' . var_export($count, true);
      $options->blockParams = $count;
      $options->calls = [];
      expectRejection(fn() => $helper($options), "$directory: $it count $countLabel");
      expectSame([], $options->calls, "$directory: $it count $countLabel must reject before executing the block");
    }
  }

  $helper = loadCallback($directory, 'string-params', 'should handle DATA', 'foo');
  expectSame('Foo!', $helper('@bar', (object) ['types' => ['PathExpression']]), "$directory: DATA string parameter");
  expectRejection(fn() => $helper('bar', (object) ['types' => ['PathExpression']]), "$directory: DATA parameter spelling");
  expectRejection(fn() => $helper(true, (object) ['types' => ['PathExpression']]), "$directory: DATA parameter scalar type");
  expectRejection(fn() => $helper('@bar', (object) ['types' => ['StringLiteral']]), "$directory: DATA parameter type");
  expectRejection(fn() => $helper('@bar', (object) ['types' => [true]]), "$directory: DATA metadata scalar type");

  $outer = loadCallback($directory, 'subexpressions', 'in string params mode,', 'snog');
  expectSame('fooyeah', $outer('foo', 'yeah', (object) ['types' => ['SubExpression', 'PathExpression']]), "$directory: outer string parameters");
  expectRejection(fn() => $outer('wrong', 'yeah', (object) ['types' => ['SubExpression', 'PathExpression']]), "$directory: outer argument");
  expectRejection(fn() => $outer('foo', 'yeah', new stdClass()), "$directory: missing outer argument types");
  foreach ([null, false, 'SubExpression', [], ['SubExpression'], ['SubExpression', 'PathExpression', 'StringLiteral'], ['PathExpression', 'PathExpression'], ['SubExpression', 'StringLiteral'], [true, true]] as $types) {
    expectRejection(fn() => $outer('foo', 'yeah', (object) ['types' => $types]), "$directory: outer argument types");
  }
  $inner = loadCallback($directory, 'subexpressions', 'in string params mode,', 'blorg');
  expectSame('foo', $inner('foo', (object) ['types' => ['PathExpression']]), "$directory: inner string parameter");
  expectRejection(fn() => $inner('foo', new stdClass()), "$directory: missing inner argument types");
  foreach ([null, false, 'PathExpression', [], ['PathExpression', 'PathExpression'], ['StringLiteral'], [true]] as $types) {
    expectRejection(fn() => $inner('foo', (object) ['types' => $types]), "$directory: inner argument types");
  }

  $helper = loadCallback($directory, 'track-ids', 'should not include anything without the flag', 'wycats');
  foreach ([[], ['ids' => null, 'hashIds' => null]] as $options) {
    expectSame('success', $helper(null, null, (object) $options), "$directory: tracking disabled");
  }
  foreach (['ids', 'hashIds'] as $field) {
    foreach ([[], false, 0, ''] as $value) {
      expectRejection(fn() => $helper(null, null, (object) [$field => $value]), "$directory: unexpected $field");
    }
  }

  foreach ([
    ['should include argument ids', ['foo', 'bar'],
      ['ids' => ['is.a', 'slave.driver']],
      'HELP ME MY BOSS is.a:foo slave.driver:bar'],
    ['should include hash ids', [],
      ['hashIds' => ['bat' => 'is.a', 'baz' => 'slave.driver'], 'hash' => ['bat' => 'foo', 'baz' => 'bar']],
      'HELP ME MY BOSS is.a:foo slave.driver:bar'],
    ['should note ../ and ./ references', ['foo', null, 'foo', []],
      ['ids' => ['is.a', '../slave.driver', 'is.a', '']],
      'HELP ME MY BOSS is.a:foo ../slave.driver:undefined'],
    ['should note @data references', ['foo', 'bar'],
      ['ids' => ['@is.a', '@slave.driver']],
      'HELP ME MY BOSS @is.a:foo @slave.driver:bar'],
    ['should return null for constants', [1, 'foo'],
      ['ids' => [null, null], 'hashIds' => ['key' => null], 'hash' => ['key' => false]],
      'HELP ME MY BOSS 1 foo false'],
    ['should return true for subexpressions', [1],
      ['ids' => [true]],
      'HELP ME MY BOSS 1'],
    ['should use block param paths', ['foo', 'bar', []],
      ['ids' => ['zomg.a', 'slave.driver', 'zomg']],
      'HELP ME MY BOSS zomg.a:foo slave.driver:bar'],
  ] as [$it, $arguments, $validOptions, $expected]) {
    $helper = loadCallback($directory, 'track-ids', $it, 'wycats');
    // PHP options support both property and ArrayAccess reads of the same metadata.
    $options = new ArrayObject($validOptions, ArrayObject::ARRAY_AS_PROPS);
    expectSame($expected, $helper(...[...$arguments, $options]), "$directory: $it");
    foreach (['ids', 'hashIds'] as $field) {
      foreach ($validOptions[$field] ?? [] as $key => $value) {
        $invalidValues = ['wrong'];
        if( is_string($value) && $value !== '' ) {
          $invalidValues[] = true;
        } elseif( $value === true ) {
          $invalidValues[] = 1;
        } elseif( $value === null ) {
          array_push($invalidValues, false, 0, '');
        }
        foreach ($invalidValues as $invalidValue) {
          $invalid = $validOptions;
          $invalid[$field][$key] = $invalidValue;
          $options = new ArrayObject($invalid, ArrayObject::ARRAY_AS_PROPS);
          expectRejection(fn() => $helper(...[...$arguments, $options]), "$directory: $it $field.$key " . get_debug_type($invalidValue));
        }
        if ($value === null) {
          unset($invalid[$field][$key]);
          $options = new ArrayObject($invalid, ArrayObject::ARRAY_AS_PROPS);
          expectRejection(fn() => $helper(...[...$arguments, $options]), "$directory: $it missing $field.$key");
        }
      }
    }
  }
}

foreach ($failures as $failure) {
  fwrite(STDERR, $failure . "\n");
}
echo 'PHP callback assertion checks: ' . $checks . ', failures: ' . count($failures) . "\n";
exit($failures ? 1 : 0);
