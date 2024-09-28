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
  lib,
  stdenv,
  writeText,
  fetchurl,
  src,
}:
stdenv.mkDerivation rec {
  name = "handlebars-spec-${version}";
  version = "v104.7.6";
  inherit src;

  builder = writeText "builder.sh" ''
    source $stdenv/setup

    buildPhase() {
        echo do nothing
    }

    installPhase() {
        mkdir -p $out/share/handlebars-spec
        cp -prvd spec export $out/share/handlebars-spec/
    }

    genericBuild
  '';

  meta = {
    description = "The Handlebars.js specification converted to JSON.";
    homepage = https://github.com/jbboehr/handlebars-spec;
    license = "MIT";
    maintainers = ["John Boehr <jbboehr@gmail.com>"];
  };
}
