#!/usr/bin/env python3
"""Build the vaporwave / 90s-arcade SVG assets for the BuildingBrian profile README.

Every piece of text is converted to SVG <path> outlines with fontTools, so the
pixel font (Press Start 2P, SIL OFL) renders identically everywhere GitHub shows
the image, with no web-font dependency. Animations are SMIL, which GitHub's
<img> rendering supports.

    python3 tools/build_assets.py      # writes into ../assets/
"""
from __future__ import annotations

import textwrap
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets"
FONT = TTFont(HERE / "fonts" / "PressStart2P-Regular.ttf")
GLYPHS = FONT.getGlyphSet()
CMAP = FONT.getBestCmap()
UPM = FONT["head"].unitsPerEm
HMTX = FONT["hmtx"]

# ---- palette (VaporTrap thumbnail: hot pink + yellow outline on a teal/purple VHS wash)
BG = "#0d0221"       # deep space purple
BG2 = "#1a0533"
PURPLE = "#3b0f6b"
PINK = "#ff2d95"
PINK_L = "#ff71ce"
CYAN = "#01cdfe"
MINT = "#05ffa1"
YELLOW = "#fffb96"
ORANGE = "#ff9f43"
LAV = "#c9b8ff"      # body text lavender
DIM = "#7d6aa8"

FULL_W = 846   # GitHub profile README content width at >=1280px viewports
CARD_W = 418   # two per row: 2*418 + inline gap < 846


def _glyph(ch: str) -> str:
    return CMAP.get(ord(ch)) or CMAP[ord("?")]


def text_width(text: str, size: float) -> float:
    s = size / UPM
    return sum(HMTX[_glyph(c)][0] * s for c in text)


def cap_height(size: float) -> float:
    bp = BoundsPen(GLYPHS)
    GLYPHS[_glyph("H")].draw(bp)
    return (bp.bounds[3] - bp.bounds[1]) * size / UPM


def text_d(text: str, size: float, x: float, y: float, anchor: str = "start") -> str:
    """SVG path data for `text`, baseline at (x, y)."""
    s = size / UPM
    w = text_width(text, size)
    if anchor == "middle":
        x -= w / 2
    elif anchor == "end":
        x -= w
    pen = SVGPathPen(GLYPHS)
    cursor = x
    for ch in text:
        g = _glyph(ch)
        GLYPHS[g].draw(TransformPen(pen, (s, 0, 0, -s, cursor, y)))
        cursor += HMTX[g][0] * s
    return pen.getCommands()


def T(text, size, x, y, fill, anchor="start", extra=""):
    """A plain text path element."""
    return f'<path d="{text_d(text, size, x, y, anchor)}" fill="{fill}" {extra}/>'


def T_sticker(text, size, x, y, fill, anchor="start", outline=BG, ow=3, extra=""):
    """Text with a dark outline behind it so it reads over anything."""
    d = text_d(text, size, x, y, anchor)
    return (
        f'<g {extra}><path d="{d}" fill="none" stroke="{outline}" stroke-width="{ow}" '
        f'stroke-linejoin="miter"/><path d="{d}" fill="{fill}"/></g>'
    )


def blink(dur="1.1s"):
    return (f'<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" '
            f'calcMode="discrete" dur="{dur}" repeatCount="indefinite"/>')


def scanlines_defs():
    return (
        '<pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse">'
        '<rect width="4" height="1" fill="#000" opacity=".28"/></pattern>'
    )


def write(name: str, svg: str):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / name
    p.write_text(svg.strip() + "\n", encoding="utf-8")
    print(f"wrote {p.relative_to(HERE.parent)}  ({p.stat().st_size // 1024} KB)")


# ====================================================================== HEADER
def build_header():
    W, H = FULL_W, 320
    HZ = 206          # horizon y
    VX = W / 2        # vanishing point x
    title = "BUILDING BRIAN"
    tsize = 50
    ty = 150
    td = text_d(title, tsize, VX, ty, "middle")

    # perspective grid: vertical lines fan out from the vanishing point
    verts = "".join(
        f'<line x1="{VX}" y1="{HZ}" x2="{VX + k * 120:.0f}" y2="{H}"/>'
        for k in range(-8, 9)
    )
    # horizontal lines rush toward the viewer (SMIL, staggered with negative begin)
    n, dur = 7, 2.6
    horiz = ""
    for i in range(n):
        b = -dur * i / n
        horiz += (
            f'<line x1="0" x2="{W}" y1="{HZ}" y2="{HZ}">'
            f'<animate attributeName="y1" from="{HZ}" to="{H + 2}" dur="{dur}s" begin="{b:.3f}s" '
            f'repeatCount="indefinite" calcMode="spline" keySplines=".45 0 1 1" keyTimes="0;1"/>'
            f'<animate attributeName="y2" from="{HZ}" to="{H + 2}" dur="{dur}s" begin="{b:.3f}s" '
            f'repeatCount="indefinite" calcMode="spline" keySplines=".45 0 1 1" keyTimes="0;1"/>'
            f'<animate attributeName="opacity" values="0;.9;.9" keyTimes="0;.12;1" dur="{dur}s" '
            f'begin="{b:.3f}s" repeatCount="indefinite"/>'
            f'</line>'
        )

    # sun stripes (cut-outs) thicken toward the horizon
    stripes = ""
    y, h = 150, 2
    while y < HZ:
        stripes += f'<rect x="300" y="{y}" width="300" height="{h}" fill="#000"/>'
        y += h + 9
        h += 2

    stars = ""
    import random
    rnd = random.Random(1995)
    for _ in range(46):
        sx, sy = rnd.randint(8, W - 8), rnd.randint(14, 120)
        r = rnd.choice([1, 1, 1, 1.5])
        d = rnd.uniform(1.5, 4)
        stars += (f'<rect x="{sx}" y="{sy}" width="{2*r}" height="{2*r}" fill="#fff">'
                  f'<animate attributeName="opacity" values="1;.2;1" dur="{d:.1f}s" '
                  f'begin="{rnd.uniform(0,3):.1f}s" repeatCount="indefinite"/></rect>')

    tagline = "MBA  x  AGENTIC AI  x  BERKELEY HAAS"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="BUILDING BRIAN - press start">
<title>BUILDING BRIAN</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{BG}"/><stop offset=".55" stop-color="#2a0a4a"/>
    <stop offset=".85" stop-color="#6a1b6e"/><stop offset="1" stop-color="{PINK}"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a0a4a"/><stop offset="1" stop-color="{BG}"/>
  </linearGradient>
  <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{YELLOW}"/><stop offset=".5" stop-color="{ORANGE}"/><stop offset="1" stop-color="{PINK}"/>
  </linearGradient>
  <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="#ffd6f0"/>
    <stop offset=".5" stop-color="{PINK}"/><stop offset=".52" stop-color="#b8126a"/>
    <stop offset=".72" stop-color="#ff5fb8"/><stop offset="1" stop-color="#ffeaf7"/>
  </linearGradient>
  <radialGradient id="vignette" cx=".5" cy=".5" r=".75">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/>
  </radialGradient>
  <mask id="sunmask"><circle cx="{VX}" cy="{HZ}" r="100" fill="#fff"/>{stripes}</mask>
  <clipPath id="screen"><rect x="4" y="4" width="{W-8}" height="{H-8}" rx="12"/></clipPath>
  <filter id="glow" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
  {scanlines_defs()}
</defs>

<g clip-path="url(#screen)">
  <rect width="{W}" height="{HZ}" fill="url(#sky)"/>
  <g>{stars}</g>
  <circle cx="{VX}" cy="{HZ}" r="100" fill="url(#sun)" mask="url(#sunmask)"/>
  <rect y="{HZ}" width="{W}" height="{H-HZ}" fill="url(#floor)"/>
  <rect x="0" y="{HZ-3}" width="{W}" height="6" fill="{PINK}" opacity=".9" filter="url(#glow)"/>
  <g stroke="{CYAN}" stroke-width="1.4" opacity=".55">{verts}</g>
  <g stroke="{PINK}" stroke-width="1.6">{horiz}</g>
  <line x1="0" y1="{HZ}" x2="{W}" y2="{HZ}" stroke="{PINK_L}" stroke-width="2"/>

  <!-- arcade HUD -->
  {T("1UP", 9, 24, 28, PINK)}
  {T("HI-SCORE", 9, VX, 28, CYAN, "middle")}
  {T("000608", 9, VX, 42, "#fff", "middle")}
  {T("CREDIT 01", 9, W-24, 28, YELLOW, "end")}

  <!-- title: cyan extrude, dark outline, yellow outline, chrome fill -->
  <g>
    <animate attributeName="opacity" values="1;1;1;1;.72;1;1;.9;1;1;1;1" dur="5s" repeatCount="indefinite"/>
    <path d="{td}" transform="translate(6 6)" fill="{CYAN}" opacity=".95"/>
    <path d="{td}" fill="none" stroke="{BG}" stroke-width="11" stroke-linejoin="miter"/>
    <path d="{td}" fill="none" stroke="{YELLOW}" stroke-width="5" stroke-linejoin="miter"/>
    <path d="{td}" fill="url(#chrome)"/>
  </g>
  {T_sticker(tagline, 9, VX, 180, CYAN, "middle")}

  <g>{blink()}{T_sticker("PRESS START", 14, VX, 272, YELLOW, "middle", ow=4)}</g>
  {T_sticker("INSERT COIN", 8, VX, 300, PINK_L, "middle")}

  <!-- CRT: tracking band, scanlines, vignette -->
  <rect x="0" y="-30" width="{W}" height="22" fill="#fff" opacity=".07">
    <animate attributeName="y" from="-30" to="{H+10}" dur="7s" repeatCount="indefinite"/>
  </rect>
  <rect width="{W}" height="{H}" fill="url(#scan)"/>
  <rect width="{W}" height="{H}" fill="url(#vignette)"/>
</g>
<rect x="2" y="2" width="{W-4}" height="{H-4}" rx="13" fill="none" stroke="{PURPLE}" stroke-width="4"/>
</svg>'''
    write("header.svg", svg)


# ============================================================ SECTION BANNERS
def build_banner(name: str, label: str, sub: str = ""):
    W, H = FULL_W, 52
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{label}">
<defs>
  <linearGradient id="line" x1="0" x2="1"><stop offset="0" stop-color="{PINK}"/><stop offset="1" stop-color="{CYAN}"/></linearGradient>
  {scanlines_defs()}
</defs>
<rect width="{W}" height="{H}" rx="6" fill="{BG}"/>
<rect x="0" y="{H-3}" width="{W}" height="3" fill="url(#line)"/>
<g>{blink("0.9s")}<path d="M22 16 L38 26 L22 36 Z" fill="{CYAN}"/></g>
{T_sticker(label, 15, 52, 33, PINK_L)}
{T(sub, 8, W-22, 31, DIM, "end")}
<rect width="{W}" height="{H}" rx="6" fill="url(#scan)"/>
</svg>'''
    write(f"sec-{name}.svg", svg)


# ================================================================ STAGE CARDS
def build_card(slug: str, stage: str, title: str, desc: str, lang: str, locked=False):
    W, H = CARD_W, 150
    lines = textwrap.wrap(desc, 46)[:3]
    body = "".join(T(ln, 8, 18, 82 + i * 15, LAV) for i, ln in enumerate(lines))
    chip_w = text_width(lang, 8) + 16
    border = DIM if locked else PINK
    title_fill = DIM if locked else PINK_L
    cta = "LOCKED" if locked else "PLAY >"
    cta_fill = DIM if locked else MINT
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{stage}: {title}">
<defs>{scanlines_defs()}
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG2}"/><stop offset="1" stop-color="{BG}"/></linearGradient>
</defs>
<rect x="1.5" y="1.5" width="{W-3}" height="{H-3}" rx="8" fill="url(#g)" stroke="{border}" stroke-width="3"/>
{T(stage, 8, 18, 28, CYAN)}
<rect x="{18 + text_width(stage, 8) + 10}" y="22" width="{W - 36 - text_width(stage, 8) - 10}" height="2" fill="{PURPLE}"/>
{T(title, 13, 18, 56, title_fill)}
{body}
<rect x="18" y="{H-30}" width="{chip_w:.0f}" height="18" rx="3" fill="{PURPLE}"/>
{T(lang, 8, 26, H-17, YELLOW)}
<g>{"" if locked else blink()}{T(cta, 9, W-18, H-16, cta_fill, "end")}</g>
<rect x="1.5" y="1.5" width="{W-3}" height="{H-3}" rx="8" fill="url(#scan)"/>
</svg>'''
    write(f"stage-{slug}.svg", svg)


# ============================================================== HIGH SCORES
def build_highscores(rows):
    W = CARD_W
    H = 56 + 22 * len(rows) + 18
    out = []
    out.append(T("HIGH SCORES", 12, W/2, 30, YELLOW, "middle"))
    cols = (22, 78, 150, 250)
    out.append("".join(T(h, 8, x, 52, CYAN) for h, x in zip(("RANK", "NAME", "SCORE", "STAGE"), cols)))
    for i, (rank, name, score, stage) in enumerate(rows):
        y = 76 + i * 22
        fill = PINK_L if i % 2 == 0 else "#fff"
        if rank == "YOU":
            fill = MINT
            out.append(f'<g>{blink("1.3s")}' + "".join(T(v, 8, x, y, fill) for v, x in zip((rank, name, score, stage), cols)) + "</g>")
        else:
            out.append("".join(T(v, 8, x, y, fill) for v, x in zip((rank, name, score, stage), cols)))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="High scores">
<defs>{scanlines_defs()}</defs>
<rect x="1.5" y="1.5" width="{W-3}" height="{H-3}" rx="8" fill="{BG}" stroke="{PINK}" stroke-width="3"/>
{"".join(out)}
<rect x="1.5" y="1.5" width="{W-3}" height="{H-3}" rx="8" fill="url(#scan)"/>
</svg>'''
    write("highscores.svg", svg)


# ============================================================ PAC-MAN DIVIDER
def build_divider():
    W, H = FULL_W, 40
    dur = 7
    dots = ""
    xs = list(range(60, W - 40, 36))
    for x in xs:
        t = (x - 10) / (W + 10)  # time fraction when pacman mouth reaches the dot
        dots += (f'<rect x="{x-3}" y="{H/2-3}" width="6" height="6" fill="{YELLOW}">'
                 f'<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;{t:.3f};{t+0.002:.3f};0.999;1" '
                 f'calcMode="discrete" dur="{dur}s" repeatCount="indefinite"/></rect>')
    # pacman: two mouth states, swapped quickly
    r = 14
    open_d = f"M0 0 L{r*0.8:.1f} {-r*0.6:.1f} A{r} {r} 0 1 0 {r*0.8:.1f} {r*0.6:.1f} Z"
    shut_d = f"M0 0 L{r} -2 A{r} {r} 0 1 0 {r} 2 Z"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="divider">
<rect width="{W}" height="{H}" rx="6" fill="{BG}"/>
{dots}
<g transform="translate(-20 {H/2})">
  <animateTransform attributeName="transform" type="translate" from="-20 {H/2}" to="{W+20} {H/2}" dur="{dur}s" repeatCount="indefinite"/>
  <path fill="{YELLOW}" d="{open_d}">
    <animate attributeName="d" values="{open_d};{shut_d};{open_d}" dur=".28s" repeatCount="indefinite"/>
  </path>
  <rect x="-3" y="-9" width="3" height="3" fill="{BG}"/>
</g>
<g transform="translate(-110 {H/2})" fill="{PINK}">
  <animateTransform attributeName="transform" type="translate" from="-110 {H/2}" to="{W-70} {H/2}" dur="{dur}s" repeatCount="indefinite"/>
  <path d="M-13 12 V-2 A13 13 0 0 1 13 -2 V12 L8 7 L4 12 L0 7 L-4 12 L-8 7 Z"/>
  <rect x="-8" y="-5" width="5" height="5" fill="#fff"/><rect x="3" y="-5" width="5" height="5" fill="#fff"/>
  <rect x="-6" y="-3" width="2" height="2" fill="{BG}"/><rect x="5" y="-3" width="2" height="2" fill="{BG}"/>
</g>
</svg>'''
    write("divider.svg", svg)


# ==================================================================== FOOTER
def build_footer():
    W, H = FULL_W, 64
    msg = "(C) 2026 BUILDINGBRIAN ENT.  *  THANK YOU FOR PLAYING  *  INSERT COIN TO CONTINUE  *  "
    w = text_width(msg, 9)
    marquee = "".join(T(msg, 9, i * w, H - 14, DIM) for i in range(3))
    nums = ""
    for k in range(10):
        n = 9 - k
        nums += (f'<g opacity="0">{T(str(n), 20, W/2 + 112, 36, YELLOW, "middle")}'
                 f'<animate attributeName="opacity" values="0;1;0" keyTimes="0;{k/10:.2f};{(k+1)/10:.2f}" '
                 f'calcMode="discrete" dur="10s" repeatCount="indefinite"/></g>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Continue?">
<defs>{scanlines_defs()}<clipPath id="c"><rect width="{W}" height="{H}" rx="6"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="{W}" height="{H}" fill="{BG}"/>
{T_sticker("CONTINUE?", 18, W/2 - 60, 36, PINK_L, "middle", ow=4)}
{nums}
<g><animateTransform attributeName="transform" type="translate" from="0 0" to="{-w:.1f} 0" dur="{w/55:.1f}s" repeatCount="indefinite"/>{marquee}</g>
<rect width="{W}" height="{H}" fill="url(#scan)"/>
</g>
<rect x="1.5" y="1.5" width="{W-3}" height="{H-3}" rx="6" fill="none" stroke="{PURPLE}" stroke-width="3"/>
</svg>'''
    write("footer.svg", svg)


# ================================================================= POWER-UPS
def build_inventory(items):
    """One SVG of pixel 'item pickup' chips laid out in rows."""
    W, pad, gap, ch = FULL_W, 16, 10, 30
    size = 9
    x, y, rows = pad, pad, [[]]
    for label, color in items:
        w = text_width(label, size) + 26
        if x + w > W - pad:
            x, y = pad, y + ch + gap
            rows.append([])
        rows[-1].append((x, y, w, label, color))
        x += w + gap
    H = y + ch + pad
    chips = ""
    for i, (cx, cy, w, label, color) in enumerate(r for row in rows for r in row):
        chips += (
            f'<g><rect x="{cx}" y="{cy}" width="{w:.0f}" height="{ch}" rx="4" fill="{BG2}" stroke="{color}" stroke-width="2"/>'
            f'<rect x="{cx+6}" y="{cy+11}" width="8" height="8" fill="{color}">'
            f'<animate attributeName="opacity" values="1;.25;1" dur="1.6s" begin="{i*0.13:.2f}s" repeatCount="indefinite"/></rect>'
            f'{T(label, size, cx + 20, cy + 20, "#fff")}</g>'
        )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Tech stack">
<defs>{scanlines_defs()}</defs>
<rect width="{W}" height="{H}" rx="6" fill="{BG}"/>
{chips}
<rect width="{W}" height="{H}" rx="6" fill="url(#scan)"/>
</svg>'''
    write("inventory.svg", svg)


# ==================================================================== BUTTONS
def build_button(name, label, color):
    size = 10
    W, H = text_width(label, size) + 56, 40
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H}" viewBox="0 0 {W:.0f} {H}" role="img" aria-label="{label}">
<rect x="1.5" y="1.5" width="{W-3:.0f}" height="{H-3}" rx="6" fill="{BG}" stroke="{color}" stroke-width="3"/>
<g>{blink("0.9s")}<path d="M16 12 L28 20 L16 28 Z" fill="{color}"/></g>
{T(label, size, 38, 25, "#fff")}
</svg>'''
    write(f"btn-{name}.svg", svg)


if __name__ == "__main__":
    build_header()
    build_banner("player1", "PLAYER 1", "WHO IS THIS")
    build_banner("stages", "SELECT STAGE", "PROJECTS")
    build_banner("scores", "HIGH SCORES", "STATS")
    build_banner("powerups", "POWER-UPS", "STACK")
    build_banner("continue", "CONTINUE?", "LINKS")
    build_card("pacman", "STAGE 01", "PACMAN-DQN",
               "Deep Q-Network trained to play Ms. Pac-Man. 500 games on a laptop CPU, mean score 492 to 608.",
               "PYTHON / PYTORCH")
    build_card("llm", "STAGE 02", "CUSTOM-LLM",
               "nanoGPT trained twice on my own corpus. 48-case language evals went from 37% to 91% accuracy.",
               "PYTHON / NANOGPT")
    build_card("wiki", "STAGE 03", "PERSONAL-WIKI",
               "Ledger: a CLI that answers from my own notes with a local Gemma model and RAG. Wi-Fi off, citations on.",
               "PYTHON / OLLAMA")
    build_card("tracker", "STAGE 04", "NETWORKING-TRACKER",
               "Next.js + Neon Postgres with Row Level Security + Better Auth on Vercel. Every contact locked to its owner.",
               "TYPESCRIPT / NEXT.JS")
    build_card("cohort", "STAGE 05", "BLUE-COHORT-DAILY",
               "A daily class-prep podcast for the Berkeley Haas Blue Cohort, published as a static site.",
               "HTML / AUDIO")
    build_card("locked", "STAGE 06", "? ? ? ? ? ? ? ?",
               "Two more stages are in private beta. Insert coin to unlock. (mission-to-fleet, internship-radar)",
               "SOON", locked=True)
    build_highscores([
        ("1ST", "BRN", "000608", "MS. PAC-MAN DQN"),
        ("2ND", "BRN", "000091", "NANOGPT EVALS %"),
        ("3RD", "BRN", "000004", "LEDGER OFFLINE Q&A"),
        ("4TH", "BRN", "000001", "RLS, ZERO LEAKS"),
        ("YOU", "???", "------", "INSERT COIN"),
    ])
    build_divider()
    build_footer()
    build_inventory([
        ("PYTHON", CYAN), ("PYTORCH", PINK), ("JUPYTER", ORANGE), ("NANOGPT", MINT),
        ("GYMNASIUM / ALE", YELLOW), ("OLLAMA", CYAN), ("TYPESCRIPT", PINK), ("NEXT.JS", "#fff"),
        ("POSTGRES + RLS", CYAN), ("BETTER AUTH", MINT), ("VERCEL", "#fff"), ("PLAYWRIGHT", ORANGE),
        ("CLAUDE CODE", PINK_L), ("GIT", YELLOW),
    ])
    build_button("linkedin", "LINKEDIN", CYAN)
    build_button("github", "GITHUB", PINK)
    build_button("haas", "BERKELEY HAAS", YELLOW)
    build_button("email", "SAY HI", MINT)
