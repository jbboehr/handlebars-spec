{
  pkgs ? import <nixpkgs> {},
  nodejs ? pkgs.nodejs-12_x,
  php ? pkgs.php,
  nodeModulesBinPath ? (builtins.getEnv "PWD") + "/node_modules/.bin"
}:

with pkgs;

stdenv.mkDerivation {
  name = "handlebars-spec-shell";
  buildInputs = [ nodejs jq php ];
  shellHook = ''
      export PATH="${nodeModulesBinPath}:$PATH"
      export TS_NODE_FILES=true
    '';
}

