{
  pkgs ? import <nixpkgs> {},
  handlebarsSpecVersion ? null,
  handlebarsSpecSrc ? ./.,
  handlebarsSpecSha256 ? null
}:

pkgs.callPackage ./derivation.nix {
  inherit handlebarsSpecVersion handlebarsSpecSrc handlebarsSpecSha256;
}

