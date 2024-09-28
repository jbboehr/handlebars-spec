# Copyright (c) anno Domini nostri Jesu Christi MMXX-MMXXIV John Boehr & contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
{
  description = "handlebars-spec";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.05";
    systems.url = "github:nix-systems/default-linux";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pre-commit-hooks = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.nixpkgs-stable.follows = "nixpkgs";
      inputs.gitignore.follows = "gitignore";
    };
  };

  outputs = {
    self,
    nixpkgs,
    systems,
    flake-utils,
    gitignore,
    pre-commit-hooks,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};

        uncleanedSrc = gitignore.lib.gitignoreSource ./.;
        src = pkgs.lib.cleanSourceWith {
          name = "handlebars-spec-source";
          src = uncleanedSrc;
          filter = gitignore.lib.gitignoreFilterWith {
            basePath = ./.;
            extraRules = ''
              .editorconfig
              .envrc
              .gitattributes
              .github
              .gitignore
              *.md
              *.nix
              flake.*
            '';
          };
        };

        pre-commit-check = pre-commit-hooks.lib.${system}.run {
          src = uncleanedSrc;
          hooks = {
            actionlint.enable = true;
            alejandra.enable = true;
            markdownlint.enable = true;
            markdownlint.excludes = ["LICENSE\.md"];
            markdownlint.settings.configuration = {
              MD013 = {
                line_length = 1488;
                # this doesn't seem to work
                table = false;
              };
              MD024 = false;
            };
            shellcheck.enable = true;
          };
        };
      in rec {
        packages = flake-utils.lib.flattenTree rec {
          handlebars-spec = pkgs.callPackage ./nix/derivation.nix {
            inherit src;
          };
          default = handlebars-spec;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            php
            php.packages.composer
            nodejs
            pre-commit
            stdenv
          ];
          shellHook = ''
            ${pre-commit-check.shellHook}
            export PATH="./node_modules/.bin:$PATH"
          '';
        };

        checks = {
          inherit pre-commit-check;
        };

        formatter = pkgs.alejandra;
      }
    );
}
