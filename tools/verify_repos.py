#!/usr/bin/env python3
"""Verify every README in a folder of clones: relative links and images must exist, external links must answer.

    python3 tools/verify_repos.py <folder-of-clones> [--no-net]
"""
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

root = Path(sys.argv[1])
net = "--no-net" not in sys.argv
LINK = re.compile(r'(?<!\\)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|(?:src|href)="([^"]+)"')


def check_url(u):
    try:
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-L", "--max-time", "15", "-A", "Mozilla/5.0 (link check)", u],
                           capture_output=True, text=True, timeout=25)
        return r.stdout.strip()
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}"


for repo in sorted(p for p in root.iterdir() if (p / ".git").exists()):
    readme = repo / "README.md"
    if not readme.exists():
        print(f"\n## {repo.name}\n  README: MISSING")
        continue
    text = readme.read_text(encoding="utf-8")
    text_nocode = re.sub(r"```.*?```", "", text, flags=re.S)
    rel, ext = set(), set()
    for m in LINK.finditer(text_nocode):
        u = m.group(1) or m.group(2)
        if u.startswith(("http://", "https://")):
            ext.add(u)
        elif not u.startswith(("#", "mailto:")):
            rel.add(u)
    missing = []
    for u in sorted(rel):
        path = urllib.parse.unquote(u.split("#")[0].split("?")[0])
        if path and not (repo / path).exists():
            missing.append(u)
    bad = []
    if net:
        for u in sorted(ext):
            if "localhost" in u or "127.0.0.1" in u or "<" in u or "..." in u:
                continue
            code = check_url(u)
            if not code.startswith(("2", "3")):
                bad.append(f"{code} {u}")
    imgs = len(re.findall(r"!\[|<img", text_nocode))
    print(f"\n## {repo.name}\n  README: {len(text.splitlines())} lines, {imgs} images, {len(rel)} relative links, {len(ext)} external links")
    print("  relative links: " + ("all resolve" if not missing else f"{len(missing)} BROKEN -> " + "; ".join(missing[:8])))
    if net:
        print("  external links: " + ("all answer" if not bad else f"{len(bad)} not OK -> " + "; ".join(bad[:8])))
