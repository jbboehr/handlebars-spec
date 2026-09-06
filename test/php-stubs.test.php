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
    throw new RuntimeException($message . "\nExpected: " . var_export($expected, true)
      . "\nActual: " . var_export($actual, true));
  }
}

function fixture($overrides = array()) {
  return array_replace(array(
    'description' => 'Stub Suite',
    'it' => 'An Entry',
    'helpers' => array('example' => array(
      '!code' => true,
      'javascript' => 'function() { return "example"; }',
    )),
  ), $overrides);
}

function runStubs($fixtures, $patches = null, $useOutputFile = false) {
  $directory = sys_get_temp_dir() . '/handlebars-spec-php-stubs-' . bin2hex(random_bytes(8));
  mkdir($directory);
  mkdir($directory . '/patch');
  $inputFile = $directory . '/fixture.json';
  $patchFile = $directory . '/patch/fixture.json';
  $outputFile = $directory . '/output.json';
  $input = json_encode($fixtures, JSON_THROW_ON_ERROR);
  $patchInput = json_encode($patches, JSON_THROW_ON_ERROR);
  $cwd = getcwd();

  try {
    file_put_contents($inputFile, $input);
    if( $patches !== null ) {
      file_put_contents($patchFile, $patchInput);
    }
    chdir($directory);
    $command = escapeshellarg(PHP_BINARY)
      . ' ' . escapeshellarg(__DIR__ . '/../bin/stubs.php')
      . ' ' . escapeshellarg($inputFile)
      . ($useOutputFile ? ' ' . escapeshellarg($outputFile) : '')
      . ' 2>&1';
    $output = array();
    $status = -1;
    exec($command, $output, $status);
    expectSame(0, $status, 'Stub generation failed: ' . join("\n", $output));
    expectSame($input, file_get_contents($inputFile), 'Input fixtures were modified');
    if( $patches !== null ) {
      expectSame($patchInput, file_get_contents($patchFile), 'Existing patch file was modified');
    }
    if( $useOutputFile ) {
      expectSame(array(), $output, 'Output-file mode wrote to stdout or stderr');
    }
    return json_decode($useOutputFile ? file_get_contents($outputFile) : join("\n", $output), true, 512, JSON_THROW_ON_ERROR);
  } finally {
    chdir($cwd);
    foreach( array($inputFile, $patchFile, $outputFile) as $file ) {
      if( file_exists($file) ) {
        unlink($file);
      }
    }
    rmdir($directory . '/patch');
    rmdir($directory);
  }
}

$cases = array(
  'Uses the canonical key and defaults an absent or null number to 00' => function() {
    $expected = array(
      'stub suite - an entry - 00' => array('helpers' => array('example' => array(
        'phpstub' => 'function() { return "example"; }',
      ))),
    );
    foreach( array(
      'absent number' => fixture(),
      'null number' => fixture(array('number' => null)),
    ) as $label => $input ) {
      expectSame($expected, runStubs(array($input)), 'Incorrect default fixture key for ' . $label);
    }
  },
  'Preserves an explicit number when writing an output file' => function() {
    expectSame(array(
      'stub suite - an entry - 02' => array('helpers' => array('example' => array(
        'phpstub' => 'function() { return "example"; }',
      ))),
    ), runStubs(array(fixture(array('number' => '02'))), null, true), 'Explicit number was changed');
  },
  'Preserves numbering gaps and identity regardless of input order' => function() {
    $fixtures = array();
    foreach( array('07', '00', '02') as $number ) {
      $fixtures[] = fixture(array(
        'number' => $number,
        'helpers' => array('example' => array('!code' => true, 'javascript' => 'function() { return "' . $number . '"; }')),
      ));
    }
    expectSame(array(
      'stub suite - an entry - 00' => array('helpers' => array('example' => array('phpstub' => 'function() { return "00"; }'))),
      'stub suite - an entry - 02' => array('helpers' => array('example' => array('phpstub' => 'function() { return "02"; }'))),
      'stub suite - an entry - 07' => array('helpers' => array('example' => array('phpstub' => 'function() { return "07"; }'))),
    ), runStubs($fixtures), 'Fixtures were reindexed or their callbacks were mixed up');
  },
  'Preserves existing PHP implementations and unrelated patch data' => function() {
    $patches = array(
      'stub suite - an entry - 02' => array(
        'helpers' => array('example' => array('php' => 'function() { return "translated"; }')),
        'compileOptions' => array('strict' => true),
      ),
      'unrelated - entry - 00' => array('expected' => 'keep me'),
    );
    $input = fixture(array('number' => '02'));
    $input['helpers']['missing'] = array('!code' => true, 'javascript' => 'function() { return "missing"; }');
    $input['helpers']['translated'] = array(
      '!code' => true,
      'javascript' => 'function() { return "javascript"; }',
      'php' => 'function() { return "translated input"; }',
    );
    $expected = $patches;
    $expected['stub suite - an entry - 02']['helpers']['missing'] = array('phpstub' => 'function() { return "missing"; }');
    expectSame($expected, runStubs(array($input), $patches), 'Existing patch data was replaced or a duplicate key was added');
  },
  'Preserves an existing null patch that skips a fixture' => function() {
    $patches = array('stub suite - an entry - 02' => null);
    expectSame($patches, runStubs(array(fixture(array('number' => '02'))), $patches), 'A skipped fixture was given a stub');
  },
);

$failures = 0;
foreach( $cases as $name => $run ) {
  try {
    $run();
    echo $name . " ... Ok\n";
  } catch( Throwable $error ) {
    $failures++;
    fwrite(STDERR, $name . " ... Failed\n" . $error->getMessage() . "\n");
  }
}
echo 'PHP stub checks: ' . count($cases) . ', failures: ' . $failures . "\n";
exit($failures ? 1 : 0);
