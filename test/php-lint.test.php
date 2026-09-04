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

function fail($message) {
  fwrite(STDERR, $message . "\n");
  exit(1);
}

function runLint($data, $checkOmissionSuites = false) {
  $temporaryDirectory = sys_get_temp_dir() . '/handlebars-spec-php-lint-' . bin2hex(random_bytes(8));
  $fixture = $temporaryDirectory . '/string-params.json';

  if( !mkdir($temporaryDirectory) ) {
    fail('Failed to create temporary directory');
  }

  try {
    file_put_contents($fixture, json_encode($data, JSON_THROW_ON_ERROR));

    $command = escapeshellarg(PHP_BINARY)
      . ' ' . escapeshellarg(__DIR__ . '/../bin/lint.php')
      . ($checkOmissionSuites ? ' --check-omission-suites' : '')
      . ' ' . escapeshellarg($fixture)
      . ' 2>&1';
    $output = array();
    $status = -1;
    exec($command, $output, $status);
    return array($status, join("\n", $output));
  } finally {
    if( file_exists($fixture) ) {
      unlink($fixture);
    }
    rmdir($temporaryDirectory);
  }
}

list($status, $outputText) = runLint(array(array(
  'description' => 'string params mode',
  'it' => 'new callback',
  'helpers' => array(
    'unported' => array(
      '!code' => true,
      'javascript' => 'function() {}',
    ),
  ),
)));

if( $status !== 2 ) {
  fail("Expected status 2 for an unexpected missing PHP translation:\n" . $outputText);
}
if( !str_contains($outputText, '[helpers.unported] ... Failed') ) {
  fail("Expected the missing translation to be reported as failed:\n" . $outputText);
}

echo "Unexpected missing PHP translations fail ... Ok\n";

list($status, $outputText) = runLint(array(array(
  'description' => 'string params mode',
  'it' => 'translated callback',
  'helpers' => array(
    'translated' => array(
      '!code' => true,
      'javascript' => 'function() {}',
      'php' => 'function() {}',
    ),
  ),
)));

if( $status !== 2 ) {
  fail("Expected status 2 for stale PHP omissions:\n" . $outputText);
}
if( !str_contains($outputText, 'Unused PHP omissions for string-params:') ) {
  fail("Expected stale PHP omissions to be reported:\n" . $outputText);
}

echo "Stale PHP omissions fail ... Ok\n";

list($status, $outputText) = runLint(array(array(
  'description' => 'string params mode',
  'it' => 'translated callback',
  'helpers' => array(
    'translated' => array(
      '!code' => true,
      'javascript' => 'function() {}',
      'php' => 'function() {}',
    ),
  ),
)), true);

if( $status !== 2 ) {
  fail("Expected status 2 for an omitted manifest suite:\n" . $outputText);
}
if( !str_contains($outputText, "Unused PHP omission suites:\nsubexpressions") ) {
  fail("Expected the omitted manifest suite to be reported:\n" . $outputText);
}

echo "Omission suites absent from the input set fail ... Ok\n";
