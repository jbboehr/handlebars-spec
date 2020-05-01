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
  lib,
  stdenv,
  writeText,
  fetchurl,
  handlebarsSpecVersion ? null,
  handlebarsSpecSrc ? null,
  handlebarsSpecSha256 ? null
}:

let
  orDefault = x: y: (if (!isNull x) then x else y);
in

stdenv.mkDerivation rec {
  name = "handlebars-spec-${version}";
  version = orDefault handlebarsSpecVersion "v4.0.5-p1";
  src = orDefault handlebarsSpecSrc (fetchurl {
    url = "https://github.com/jbboehr/handlebars-spec/archive/${version}.tar.gz";
    sha256 = orDefault handlebarsSpecSha256 "477552869cf4a8d3cadb74f0d297988dfa9edddbc818ee8f56bae0a097dc657c";
  });

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
    maintainers = [ "John Boehr <jbboehr@gmail.com>" ];
  };
}

