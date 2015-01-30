<?php

if( $argc <= 1 ) {
  echo "Generates stubs for php code from javascript functions\n";
  echo "Usage: php bin/stubs.php SPEC_INPUT_FILE [PATCH_OUTPUT_FILE]\n";
  exit();
}



// Utils

function createPatchStub($name, $test, $key, $inputFile) {
  global $patches;
  
  $patchData = &$patches;
  
  if( !isset($patchData[$name]) ) {
    $patchData[$name] = array();
  }
  
  // Get ref via key
  $ref = &$patchData[$name];
  $ref2 = &$test;
  $path = explode('.', $key);
  $final = array_pop($path);
  foreach( $path as $k ) {
    if( !isset($ref[$k]) ) {
      $ref[$k] = array();
    }
    $ref = &$ref[$k];
    $ref2 = &$ref2[$k];
  }
  
  if( isset($ref[$final]['php']) ) {
    // Sanity check
    return;
  }
  
  $ref[$final]['phpstub'] = $ref2[$final]['javascript'];
}

function searchForCode($data, &$codes, $path = array()) {
  if( !is_array($data) ) {
    return;
  }
  foreach( $data as $k => $v ) {
    if( !is_array($v) ) {
      continue;
    }
    
    $tmp = $path;
    $tmp[] = is_int($k) ? sprintf('%d', $k) : $k;
    if( !empty($v['!code']) ) {
      $key = join('.', $tmp);
      if( empty($v['php']) ) {
        $codes[$key] = $v['javascript'];
      }
    } else {
      searchForCode($v, $codes, $tmp);
    }
  }
}



// Main

$inputFile = $argv[1];
$outputFile = $argc >= 3 ? $argv[2] : null;
$patchFile = 'patch/' . basename($inputFile);
$patches = array();
$indices = array();

if( file_exists($patchFile) ) {
  $patches = json_decode(file_get_contents($patchFile), true);
}

if( !file_exists($inputFile) ) {
  echo "Input file does not exist\n";
  exit(1);
}

$tests = json_decode(file_get_contents($inputFile), true);

foreach( $tests as $test ) {
  // Need to get the name of the test in the patch format
  $key = strtolower($test['description'] . '-' . $test['it']);
  for( $i = 0; $i < 99; $i++ ) {
    $name = $key . '-' . sprintf("%02d", $i);
    if( !in_array($name, $indices) ) {
      break;
    }
    $name = null;
  }
  if( !$name ) {
    throw new \Exception('Failed to generate index for test: ' . $key);
  }
  $indices[] = $name;
  
  $codes = null;
  $index = 0;
  searchForCode($test, $codes);
  
  if( empty($codes) ) {
    continue;
  }
  
  foreach( $codes as $key => $code ) {
    createPatchStub($name, $test, $key, $inputFile);
  }
}

// Output
ksort($patches);

$jsonstr = json_encode($patches, defined('JSON_PRETTY_PRINT') ? JSON_PRETTY_PRINT : 0);;
if( $outputFile ) {
  file_put_contents($outputFile, $jsonstr);
} else {
  echo $jsonstr;
}
