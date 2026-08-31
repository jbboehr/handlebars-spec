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
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    systems.url = "github:nix-systems/default-linux";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      systems,
      git-hooks,
    }:
    let
      forAllSystems = nixpkgs.lib.genAttrs (import systems);
      version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          src = pkgs.lib.fileset.toSource {
            root = ./.;
            fileset = pkgs.lib.fileset.unions [
              ./export
              ./spec
            ];
          };
          handlebars-spec = pkgs.callPackage ./nix/derivation.nix {
            inherit src version;
          };
        in
        {
          inherit handlebars-spec;
          default = handlebars-spec;
        }
      );

      checks = forAllSystems (system: {
        pre-commit-check = git-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            actionlint.enable = true;
            markdownlint.enable = true;
            markdownlint.excludes = [ "LICENSE\.md" ];
            markdownlint.settings.configuration = {
              MD013 = {
                line_length = 1488;
                # this doesn't seem to work
                table = false;
              };
              MD024 = false;
            };
            nixfmt.enable = true;
            shellcheck.enable = true;
          };
        };
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pre-commit-check = self.checks.${system}.pre-commit-check;
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.nodejs_24
              pkgs.php
              pkgs.php.packages.composer
            ]
            ++ pre-commit-check.enabledPackages;
            shellHook = pre-commit-check.shellHook + ''
              export PATH="./node_modules/.bin:$PATH"
            '';
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
