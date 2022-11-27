{
  description = "handlebars-spec";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      rec {
        packages = flake-utils.lib.flattenTree rec {
          handlebars-spec = pkgs.callPackage ./default.nix {};
          default = handlebars-spec;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [ php nodejs stdenv ];
        };
      }
    );
}
