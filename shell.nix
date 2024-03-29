# Copyright (C) 2020 John Boehr
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
  pkgs ? import <nixpkgs> {},
  nodejs ? pkgs.nodejs,
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
