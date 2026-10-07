#!/usr/bin/env bash
# Publish the profile README as the special BuildingBrian/BuildingBrian repo.
# Run from the profile/ folder AFTER reviewing README.md. Safe to re-run: it
# only pushes if the repo already exists and is ours.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d .git ]; then
  git init -b main
fi
git add README.md assets tools .gitignore
git -c user.email="brianarevalo@berkeley.edu" -c user.name="Brian Arevalo Ramos" \
  commit -m "Profile README: 90s arcade / vaporwave edition

Pixel text rendered to SVG paths with Press Start 2P (SIL OFL), SMIL animations,
stage-select cards for each public repo, high-score table, power-up chips.
Regenerate assets with: python3 tools/build_assets.py

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" || true
if gh repo view BuildingBrian/BuildingBrian >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/BuildingBrian/BuildingBrian.git
  git push -u origin main
else
  gh repo create BuildingBrian/BuildingBrian --public --source=. --remote=origin --push \
    --description "It's-a me. Profile README, arcade edition."
fi
echo "Live at https://github.com/BuildingBrian"
