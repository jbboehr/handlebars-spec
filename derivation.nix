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

