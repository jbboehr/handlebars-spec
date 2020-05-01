builtins.mapAttrs (k: _v:
  let
    path = builtins.fetchTarball {
       url = https://github.com/NixOS/nixpkgs/archive/release-19.09.tar.gz;
       name = "nixpkgs-19.09";
    };
    pkgs = import (path) { system = k; };
  in
  pkgs.recurseIntoAttrs {
    n1909 = pkgs.callPackage ./default.nix {};

    n2003 = let
        path = builtins.fetchTarball {
           url = https://github.com/NixOS/nixpkgs/archive/release-20.03.tar.gz;
           name = "nixpkgs-20.03";
        };
        pkgs = import (path) { system = k; };
    in pkgs.callPackage ./default.nix {};
  }
) {
  x86_64-linux = {};
  # Uncomment to test build on macOS too
  # x86_64-darwin = {};
}
