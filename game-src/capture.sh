#!/usr/bin/env bash
# Render deterministic attract-mode frames with headless Chrome (one launch per frame).
#   ./capture.sh <scene> <t0> <count> <step> <outdir>
set -euo pipefail
cd "$(dirname "$0")/.."
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
scene="$1"; t0="$2"; n="$3"; step="$4"; out="$5"; mkdir -p "$out"
for i in $(seq 0 $((n - 1))); do
  t=$(python3 -c "print(round($t0 + $i * $step, 4))")
  f=$(printf "%s/f_%03d.png" "$out" "$i")
  "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=960,540 --virtual-time-budget=5000 \
    --screenshot="$PWD/$f" "file://$PWD/docs/index.html?bare=1&scene=$scene&shot=$t" >/dev/null 2>&1
done
echo "captured $n frames into $out"
