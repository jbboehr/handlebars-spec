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
  stdenvNoCC,
  src,
  version,
}:
stdenvNoCC.mkDerivation {
  pname = "handlebars-spec";
  inherit src version;

  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/share/handlebars-spec"
    cp -r export spec "$out/share/handlebars-spec/"
    runHook postInstall
  '';

  meta = {
    description = "The Handlebars.js specification converted to JSON.";
    homepage = "https://github.com/jbboehr/handlebars-spec";
    license = lib.licenses.mit;
    maintainers = [
      {
        name = "John Boehr";
        email = "jbboehr@gmail.com";
      }
    ];
    platforms = lib.platforms.all;
  };
}
