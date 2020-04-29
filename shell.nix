{
  pkgs ? import <nixpkgs> {},
  nodejs ? pkgs.nodejs-12_x,
  nodeModulesBinPath ? (builtins.getEnv "PWD") + "/node_modules/.bin"
}:

with pkgs;

stdenv.mkDerivation {
  name = "handlebars-spec-shell";
  buildInputs = [ nodejs jq ];
  shellHook = ''
      export PATH="${nodeModulesBinPath}:$PATH"
      export TS_NODE_FILES=true
    '';
}

