#!/usr/bin/env python3
"""Snapshot public GitHub numbers for the profile's stat cards into tools/stats.json (needs the gh CLI).

    python3 tools/fetch_stats.py
"""
import datetime
import json
import re
import subprocess
from pathlib import Path

USER = "BuildingBrian"


def gh(*args):
    return subprocess.run(["gh", "api", *args], capture_output=True, text=True, check=True).stdout


repos = [r for r in json.loads(gh(f"users/{USER}/repos?per_page=100&type=owner")) if not r["private"] and not r["fork"]]
langs, commits = {}, 0
for r in repos:
    for k, v in json.loads(gh(f"repos/{USER}/{r['name']}/languages")).items():
        langs[k] = langs.get(k, 0) + v
    head = subprocess.run(["gh", "api", "-i", f"repos/{USER}/{r['name']}/commits?per_page=1"], capture_output=True, text=True).stdout
    m = re.search(r'page=(\d+)>; rel="last"', head)
    commits += int(m.group(1)) if m else 1
user = json.loads(gh(f"users/{USER}"))
feed = subprocess.run(["curl", "-sL", "--max-time", "20", "https://buildingbrian.github.io/blue-cohort-daily/feed.xml"], capture_output=True, text=True).stdout
out = {
    "as_of": datetime.date.today().isoformat(),
    "public_repos": len(repos),
    "commits": commits,
    "joined": user["created_at"][:7],
    "podcast_episodes": feed.count("<item>"),
    "languages": dict(sorted(langs.items(), key=lambda kv: -kv[1])),
}
Path(__file__).with_name("stats.json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out, indent=2))
