#!/usr/bin/env python3
"""Arcade theme kit for the other BuildingBrian repos.

For each repo this writes kit/<repo>/{banner,footer,btn-stages,btn-play}.svg. Those four files are
copied into the repo as .github/arcade/ and referenced from the top and bottom of its README.
Same palette, font-to-path rendering and SMIL animation as the profile README (see build_assets.py).

    python3 tools/build_repo_kit.py
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_assets as B  # noqa: E402

KIT = Path(__file__).resolve().parent.parent / "kit"
PROFILE = "https://github.com/BuildingBrian"
GAME = "https://buildingbrian.github.io/BuildingBrian/"

# repo -> (stage label, banner title, tagline, stat label, stat value, alt-text sentence)
REPOS = {
    "pacman-dqn":              ("STAGE 01", "PACMAN-DQN", "DEEP Q-NETWORK VS MS. PAC-MAN", "MEAN SCORE", "000608",
                                "Deep Q-Network versus Ms. Pac-Man"),
    "custom-llm":              ("STAGE 02", "CUSTOM-LLM", "NANOGPT TRAINED TWICE ON A LAPTOP CPU", "EVAL ACC %", "000091",
                                "nanoGPT trained twice on a laptop CPU"),
    "personal-wiki":           ("STAGE 03", "PERSONAL-WIKI", "LEDGER: LOCAL GEMMA + RAG, WI-FI OFF", "OFFLINE Q&A", "4 OF 4",
                                "Ledger, a personal wiki on local Gemma and RAG with Wi-Fi off"),
    "networking-tracker":      ("STAGE 04", "NETWORKING-TRACKER", "NEXT.JS + POSTGRES ROW LEVEL SECURITY", "RLS", "ON",
                                "Next.js and Postgres with Row Level Security"),
    "blue-cohort-daily":       ("STAGE 05", "BLUE COHORT DAILY", "CLASS PREP PODCAST FOR THE WALK TO CLASS", "ON AIR", "DAILY",
                                "a class prep podcast for the walk to class"),
    "spotify-review-pipeline": ("STAGE 06", "SPOTIFY-REVIEW-PIPELINE", "150K REVIEWS IN, ONE RECOMMENDATION OUT", "CLASSIFIED", "149972",
                                "150k Spotify reviews in, one product recommendation out"),
    "mba-internship-radar":    ("FREE PLAY", "INTERNSHIP RADAR", "165 JOB BOARDS, ONE MORNING ALERT", "JOB BOARDS", "000165",
                                "about 165 job boards, one morning alert"),
    "internship-radar":        ("SECRET STAGE", "INTERNSHIP RADAR", "SUMMER 2027 MBA INTERNSHIP SCANNER", "SCAN", "HOURLY",
                                "Summer 2027 MBA internship scanner"),
}


def banner(repo, stage, title, tagline, stat_label, stat_value, alt=""):
    W, H, HZ, VX = 900, 220, 162, 450
    tsize = min(46, int(800 / len(title)))
    ty = 112
    td = B.text_d(title, tsize, VX, ty, "middle")
    verts = "".join(f'<line x1="{VX}" y1="{HZ}" x2="{VX + k * 110:.0f}" y2="{H}"/>' for k in range(-9, 10))
    n, dur = 5, 2.4
    horiz = ""
    for i in range(n):
        b = -dur * i / n
        horiz += (
            f'<line x1="0" x2="{W}" y1="{HZ}" y2="{HZ}">'
            f'<animate attributeName="y1" from="{HZ}" to="{H + 2}" dur="{dur}s" begin="{b:.3f}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 1 1" keyTimes="0;1"/>'
            f'<animate attributeName="y2" from="{HZ}" to="{H + 2}" dur="{dur}s" begin="{b:.3f}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 1 1" keyTimes="0;1"/>'
            f'<animate attributeName="opacity" values="0;.9;.9" keyTimes="0;.12;1" dur="{dur}s" begin="{b:.3f}s" repeatCount="indefinite"/></line>'
        )
    stripes, y, h = "", 118, 2
    while y < HZ:
        stripes += f'<rect x="350" y="{y}" width="200" height="{h}" fill="#000"/>'
        y += h + 7
        h += 2
    rnd = random.Random(sum(map(ord, repo)))
    stars = ""
    for _ in range(34):
        sx, sy = rnd.randint(8, W - 8), rnd.randint(12, 96)
        d = rnd.uniform(1.5, 4)
        stars += (f'<rect x="{sx}" y="{sy}" width="2" height="2" fill="#fff"><animate attributeName="opacity" values="1;.2;1" '
                  f'dur="{d:.1f}s" begin="{rnd.uniform(0, 3):.1f}s" repeatCount="indefinite"/></rect>')
    uid = "".join(c for c in repo if c.isalnum())
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{stage}: {title}. {tagline}">
<title>{title}</title>
<defs>
  <linearGradient id="sky{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{B.BG}"/><stop offset=".55" stop-color="#2a0a4a"/><stop offset=".85" stop-color="#6a1b6e"/><stop offset="1" stop-color="{B.PINK}"/></linearGradient>
  <linearGradient id="floor{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a4a"/><stop offset="1" stop-color="{B.BG}"/></linearGradient>
  <linearGradient id="sun{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{B.YELLOW}"/><stop offset=".5" stop-color="{B.ORANGE}"/><stop offset="1" stop-color="{B.PINK}"/></linearGradient>
  <linearGradient id="chrome{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="#ffd6f0"/><stop offset=".5" stop-color="{B.PINK}"/><stop offset=".52" stop-color="#b8126a"/><stop offset=".72" stop-color="#ff5fb8"/><stop offset="1" stop-color="#ffeaf7"/></linearGradient>
  <radialGradient id="vig{uid}" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <mask id="sm{uid}"><circle cx="{VX}" cy="{HZ}" r="72" fill="#fff"/>{stripes}</mask>
  <clipPath id="scr{uid}"><rect x="4" y="4" width="{W - 8}" height="{H - 8}" rx="12"/></clipPath>
  <filter id="glow{uid}" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
  {B.scanlines_defs()}
</defs>
<g clip-path="url(#scr{uid})">
  <rect width="{W}" height="{HZ}" fill="url(#sky{uid})"/>
  <g>{stars}</g>
  <circle cx="{VX}" cy="{HZ}" r="72" fill="url(#sun{uid})" mask="url(#sm{uid})"/>
  <rect y="{HZ}" width="{W}" height="{H - HZ}" fill="url(#floor{uid})"/>
  <rect x="0" y="{HZ - 3}" width="{W}" height="6" fill="{B.PINK}" opacity=".9" filter="url(#glow{uid})"/>
  <g stroke="{B.CYAN}" stroke-width="1.4" opacity=".55">{verts}</g>
  <g stroke="{B.PINK}" stroke-width="1.6">{horiz}</g>
  <line x1="0" y1="{HZ}" x2="{W}" y2="{HZ}" stroke="{B.PINK_L}" stroke-width="2"/>
  {B.T(stage, 9, 24, 28, B.PINK)}
  {B.T(stat_label, 9, VX, 28, B.CYAN, "middle")}
  {B.T(stat_value, 9, VX, 42, "#fff", "middle")}
  {B.T("BUILDINGBRIAN", 9, W - 24, 28, B.YELLOW, "end")}
  <g>
    <animate attributeName="opacity" values="1;1;1;1;.72;1;1;.9;1;1;1;1" dur="5s" repeatCount="indefinite"/>
    <path d="{td}" transform="translate(5 5)" fill="{B.CYAN}" opacity=".95"/>
    <path d="{td}" fill="none" stroke="{B.BG}" stroke-width="10" stroke-linejoin="miter"/>
    <path d="{td}" fill="none" stroke="{B.YELLOW}" stroke-width="4.5" stroke-linejoin="miter"/>
    <path d="{td}" fill="url(#chrome{uid})"/>
  </g>
  {B.T_sticker(tagline, 10, VX, 142, B.CYAN, "middle", ow=4)}
  <g>{B.blink()}{B.T_sticker("NOW PLAYING", 11, VX, 200, B.YELLOW, "middle", ow=4)}</g>
  <rect x="0" y="-30" width="{W}" height="20" fill="#fff" opacity=".07"><animate attributeName="y" from="-30" to="{H + 10}" dur="7s" repeatCount="indefinite"/></rect>
  <rect width="{W}" height="{H}" fill="url(#scan)"/>
  <rect width="{W}" height="{H}" fill="url(#vig{uid})"/>
</g>
<rect x="2" y="2" width="{W - 4}" height="{H - 4}" rx="13" fill="none" stroke="{B.PURPLE}" stroke-width="4"/>
</svg>'''
    return svg


def footer():
    W, H = 900, 40
    msg = "(C) 2026 BUILDINGBRIAN ENT.  *  THANK YOU FOR PLAYING  *  INSERT COIN TO CONTINUE  *  "
    w = B.text_width(msg, 9)
    marquee = "".join(B.T(msg, 9, i * w, 25, B.DIM) for i in range(3))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Thank you for playing. A BuildingBrian project.">
<defs>{B.scanlines_defs()}<clipPath id="fc"><rect width="{W}" height="{H}" rx="6"/></clipPath></defs>
<g clip-path="url(#fc)">
<rect width="{W}" height="{H}" fill="{B.BG}"/>
<g><animateTransform attributeName="transform" type="translate" from="0 0" to="{-w:.1f} 0" dur="{w / 55:.1f}s" repeatCount="indefinite"/>{marquee}</g>
<rect width="{W}" height="{H}" fill="url(#scan)"/>
</g>
<rect x="1.5" y="1.5" width="{W - 3}" height="{H - 3}" rx="6" fill="none" stroke="{B.PURPLE}" stroke-width="3"/>
</svg>'''


def button(label, color, arrow_left=False):
    size = 10
    W, H = B.text_width(label, size) + 56, 40
    tri = "M28 12 L16 20 L28 28 Z" if arrow_left else "M16 12 L28 20 L16 28 Z"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H}" viewBox="0 0 {W:.0f} {H}" role="img" aria-label="{label}">
<rect x="1.5" y="1.5" width="{W - 3:.0f}" height="{H - 3}" rx="6" fill="{B.BG}" stroke="{color}" stroke-width="3"/>
<g>{B.blink("0.9s")}<path d="{tri}" fill="{color}"/></g>
{B.T(label, size, 38, 25, "#fff")}
</svg>'''


def readme_blocks(repo):
    stage, title, *_, alt = REPOS[repo]
    top = (f'<div align="center">\n  <a href="{PROFILE}"><img src=".github/arcade/banner.svg" width="100%" '
           f'alt="{title.title() if title.isupper() and "-" not in title else title.lower()}: {alt}. A BuildingBrian project."></a>\n</div>\n')
    bottom = (f'<p align="center">\n  <a href="{PROFILE}"><img src=".github/arcade/btn-stages.svg" alt="Back to stage select: github.com/BuildingBrian"></a>\n'
              f'  <a href="{GAME}"><img src=".github/arcade/btn-play.svg" alt="Play Vapor Strike, the arcade game behind the profile"></a>\n</p>\n\n'
              f'<div align="center">\n  <a href="{PROFILE}"><img src=".github/arcade/footer.svg" width="100%" alt="Thank you for playing. A BuildingBrian project."></a>\n</div>\n')
    return top, bottom


if __name__ == "__main__":
    for repo, spec in REPOS.items():
        d = KIT / repo
        d.mkdir(parents=True, exist_ok=True)
        (d / "banner.svg").write_text(banner(repo, *spec).strip() + "\n", encoding="utf-8")
        (d / "footer.svg").write_text(footer().strip() + "\n", encoding="utf-8")
        (d / "btn-stages.svg").write_text(button("STAGE SELECT", B.CYAN, arrow_left=True).strip() + "\n", encoding="utf-8")
        (d / "btn-play.svg").write_text(button("PLAY VAPOR STRIKE", B.PINK).strip() + "\n", encoding="utf-8")
        top, bottom = readme_blocks(repo)
        (d / "README-top.html").write_text(top, encoding="utf-8")
        (d / "README-bottom.html").write_text(bottom, encoding="utf-8")
        print(f"kit/{repo}: banner {((d / 'banner.svg').stat().st_size) // 1024} KB")
