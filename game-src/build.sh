#!/usr/bin/env bash
# Concatenate the engine parts into docs/vs.js (one IIFE, no dependencies).
set -euo pipefail
cd "$(dirname "$0")"
{
  echo "/* VAPOR STRIKE: a small arcade shooter for github.com/BuildingBrian."
  echo "   Plain canvas + WebAudio, no dependencies. Built from game-src/js by game-src/build.sh. */"
  echo "(() => {"
  echo "'use strict';"
  cat js/01_core.js js/02_world.js js/03_play.js js/04_main.js
  echo "})();"
} > ../docs/vs.js
node --check ../docs/vs.js && echo "vs.js OK: $(wc -l < ../docs/vs.js) lines, $(wc -c < ../docs/vs.js) bytes"
