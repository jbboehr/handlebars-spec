{ pkgs ? import <nixpkgs> {} }:

let
 stdenv = pkgs.stdenv;
 fetchurl = pkgs.fetchurl;
in
  stdenv.mkDerivation rec {
    name = "handlebars-spec-4.0.5-p1";

    builder = pkgs.writeText "builder.sh" ''
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

    src = fetchurl {
      url = https://github.com/jbboehr/handlebars-spec/archive/v4.0.5-p1.tar.gz;
      sha256 = "223985eba1ce477c92bcc9c8fab212c059775a54c123dd041b813a6d3844190f";
    };

    meta = {
      description = "The Handlebars.js specification converted to JSON.";
      homepage = https://github.com/jbboehr/handlebars-spec;
      license = "MIT";
      maintainers = [ "John Boehr <jbboehr@gmail.com>" ];
    };
  }

