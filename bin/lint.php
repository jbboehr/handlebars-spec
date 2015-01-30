<?php

// Cleanup temp files

$cleanup = array();
register_shutdown_function(function() use (&$cleanup) {
  foreach( $cleanup as $file ) {
    if( file_exists($file) ) {
      unlink($file);
    }
  }
});


// Utils

class LintException extends Exception {}

class LintPhpMissingException extends Exception {}

function lint($file) {
  $command = 'php -l ' . escapeshellarg($file) . ' 2>&1';
  $output = null;
  $return_var = -1;
  exec($command, $output, $return_var);
  if( $return_var != 0 ) {
    throw new LintException('Lint failure: ' . join("\n", $output));
  }
}

function lintc($code, $prefix = null) {
  global $cleanup;
  static $counter = 0;
  $prefix = ($prefix ?: 'unk');
  $counter++;
  $cleanup[] = $file = './tmp/' . $prefix . '-' . sprintf('%03d', $counter) . '-' . md5($code) . '.php';
  file_put_contents($file, '<?php return ' . $code . ';');
  return lint($file);
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
      if( !empty($v['php']) ) {
        $codes[$key] = $v['php'];
      } else {
        $codes[$key] = new LintPhpMissingException('No php block found, please implement');
      }
    } else {
      searchForCode($v, $codes, $tmp);
    }
  }
}


// Main
$inputFiles = (array) array_slice($argv, 1);
$successes = array();
$failures = array();
$skipped = array();
$indices = array();

if( !is_dir('./tmp') ) {
  mkdir('./tmp');
}

foreach( $inputFiles as $inputFile ) {
  $indices[$inputFile] = array();
  
  if( !file_exists($inputFile) ) {
    echo "Input file does not exist\n";
    exit(66);
  }
  
  $tests = json_decode(file_get_contents($inputFile), true);
  if( !$tests ) {
    echo "Failed to decode JSON\n";
    exit(65);
  }
  
  foreach( $tests as $test ) {
    $prefix = $inputFile . ' - ' . $test['description'] . ' - ' . $test['it'];
    $codes = null;
    $index = 0;
    searchForCode($test, $codes);
    
    if( empty($codes) ) {
      continue;
    }
    
    foreach( $codes as $key => $code ) {
      echo $prefix, ' ', '#', ++$index, " [", $key, "] ... ";
      try {
        if( $code instanceof Exception ) {
          throw $code;
        }
        usleep(10000);
        lintc($code);
        echo "Ok\n";
        $successes[] = $prefix;
      } catch( LintException $e ) {
        echo "Failed\n";
        echo "Code: ", $code, "\n";
        echo $e->getMessage(), "\n";
        $failures[] = $prefix;
      } catch( LintPhpMissingException $e ) {
        echo "Skipped (", $e->getMessage(), ")\n";
        $skipped[] = $prefix;
      }
    }
    
    unset($codes);
  }
}

echo "Success: ", count($successes), "\n";
echo "Failed: ", count($failures), "\n";
echo "Skipped: ", count($skipped), "\n";

exit(empty($failures) ? 0 : 2);
