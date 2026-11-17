#!/usr/bin/env python3
"""Apply the arcade theme kit to a local clone of one repo.

    python3 tools/apply_repo_kit.py <repo-name> <path-to-clone>

Copies kit/<repo>/*.svg into <clone>/.github/arcade/ and puts the banner block at the top of the README
and the buttons + footer block at the bottom. Idempotent: an existing block is replaced, not duplicated.
For READMEs rendered by a generator script, the generator is patched to emit the same two blocks, then run.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent / "kit"
GENERATORS = {"custom-llm": "tools/build_readme.py", "personal-wiki": "scripts/build_readme.py"}
TOP_RE = re.compile(r'\A<div align="center">\n  <a href="[^"]+"><img src="\.github/arcade/banner\.svg".*?</div>\n\n', re.S)
BOT_RE = re.compile(r'\n<p align="center">\n  <a href="[^"]+"><img src="\.github/arcade/btn-stages\.svg".*?</div>\n\Z', re.S)


def strip_blocks(text):
    return BOT_RE.sub("", TOP_RE.sub("", text))


def main(repo, clone):
    clone = Path(clone)
    kit = KIT / repo
    top, bottom = (kit / "README-top.html").read_text(), (kit / "README-bottom.html").read_text()
    dest = clone / ".github" / "arcade"
    dest.mkdir(parents=True, exist_ok=True)
    for f in ("banner.svg", "footer.svg", "btn-stages.svg", "btn-play.svg"):
        shutil.copyfile(kit / f, dest / f)
    readme = clone / "README.md"
    old = strip_blocks(readme.read_text(encoding="utf-8")) if readme.exists() else ""
    if not old.endswith("\n"):
        old += "\n"
    want = top + "\n" + old + "\n" + bottom
    gen = GENERATORS.get(repo)
    if gen:
        g = clone / gen
        s = g.read_text(encoding="utf-8")
        s = re.sub(r'# Arcade theme blocks.*?\nARCADE_BOTTOM = """.*?"""\n\n', "", s, flags=re.S)
        s = s.replace("w(ARCADE_TOP)\n", "").replace("w(ARCADE_BOTTOM)\n", "")
        consts = ('# Arcade theme blocks (assets live in .github/arcade/; they wrap the README and carry no content)\n'
                  f'ARCADE_TOP = """{top}"""\nARCADE_BOTTOM = """{bottom}"""\n\n')
        assert s.count("L = []\nw = L.append\n") == 1 and s.count('(ROOT / "README.md").write_text(') == 1, "generator layout changed"
        s = s.replace("L = []\nw = L.append\n", consts + "L = []\nw = L.append\nw(ARCADE_TOP)\n")
        s = s.replace('(ROOT / "README.md").write_text(', 'w(ARCADE_BOTTOM)\n(ROOT / "README.md").write_text(')
        g.write_text(s, encoding="utf-8")
        subprocess.run([sys.executable, gen], cwd=clone, check=True, capture_output=True)
        got = readme.read_text(encoding="utf-8")
        assert got == want, f"{repo}: generator output differs from the expected themed README"
        print(f"{repo}: generator patched and re-run; README matches expected ({len(got)} chars)")
    else:
        readme.write_text(want, encoding="utf-8")
        print(f"{repo}: README themed ({len(want)} chars)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
