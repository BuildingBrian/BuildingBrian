#!/usr/bin/env python3
"""BUILDING BRIAN roundel logo: ring text in Press Start 2P, chrome 'BB' monogram in the centre.
Outputs logo.svg (transparent outside the disc) and logo-dark.svg (on a dark square)."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import build_assets as B   # font helpers + palette

S = 1024; C = S / 2
R_OUT = 492          # outer ring radius
R_TEXT = 398         # (legacy) baseline radius of the top text
R_RING = 402         # baseline radius of the full-wrap ring text
RING_SIZE = 40       # ring text font size
BB_SIZE = 300

def arc_text(text, size, radius, top=True, fill="#fff", outline=B.BG, ow=4):
    """Glyphs placed along a circle. top=True reads clockwise over the top; else upright along the bottom."""
    out = []
    total = B.text_width(text, size)
    cum = 0.0
    for ch in text:
        w = B.text_width(ch, size)
        s = (cum + w / 2) / radius              # arc position of glyph centre (radians from text centre)
        if top:
            theta = -math.pi / 2 - total / (2 * radius) + s
            rot = math.degrees(theta) + 90
        else:
            theta = math.pi / 2 + total / (2 * radius) - s
            rot = math.degrees(theta) - 90
        x, y = C + radius * math.cos(theta), C + radius * math.sin(theta)
        if ch != " ":
            d = B.text_d(ch, size, 0, 0, "middle")
            out.append(f'<g transform="translate({x:.2f} {y:.2f}) rotate({rot:.2f})">'
                       f'<path d="{d}" fill="none" stroke="{outline}" stroke-width="{ow}" stroke-linejoin="miter"/>'
                       f'<path d="{d}" fill="{fill}"/></g>')
        cum += w
    return "".join(out)

def ring_full(text, radius, fill, outline=B.BG, ow=5, start_deg=-90):
    """Text wrapped around the entire circumference, clockwise, font size chosen so it closes the loop exactly."""
    size = 2 * math.pi * radius / B.text_width(text, 1)
    out, cum = [], 0.0
    for ch in text:
        w = B.text_width(ch, size)
        theta = math.radians(start_deg) + (cum + w / 2) / radius
        x, y = C + radius * math.cos(theta), C + radius * math.sin(theta)
        if ch != " ":
            d = B.text_d(ch, size, 0, 0, "middle")
            out.append(f'<g transform="translate({x:.2f} {y:.2f}) rotate({math.degrees(theta) + 90:.2f})">'
                       f'<path d="{d}" fill="none" stroke="{outline}" stroke-width="{ow}" stroke-linejoin="miter"/>'
                       f'<path d="{d}" fill="{fill}"/></g>')
        cum += w
    return "".join(out), size

def build(dark_square=False, icon=False):
    size = BB_SIZE + 90 if icon else BB_SIZE - 10
    bb = B.text_d("BB", size, C, C + (160 if icon else 108), "middle")
    cap = B.cap_height(RING_SIZE)
    grid_v = "".join(f'<line x1="{C}" y1="{C+150}" x2="{C + k*130:.0f}" y2="{S}"/>' for k in range(-5, 6))
    grid_h = "".join(f'<line x1="0" x2="{S}" y1="{C+150 + 370*(t/5)**2:.0f}" y2="{C+150 + 370*(t/5)**2:.0f}"/>' for t in range(1, 6))
    bg = f'<rect width="{S}" height="{S}" fill="{B.BG}"/>' if dark_square else ""
    star_half = math.degrees(B.text_width("\u2605", 2 * math.pi * R_RING / B.text_width("\u2605 BUILDING BRIAN \u2605 BUILDING BRIAN ", 1)) / 2 / R_RING)
    ring_text, ring_size = ring_full("\u2605 BUILDING BRIAN \u2605 BUILDING BRIAN ", R_RING, B.YELLOW, start_deg=-90 - star_half)
    inscription = (B.T_sticker("1 TOKEN \u00b7 1 GAME", 30, C, C + 232, B.CYAN, "middle", ow=6)
                   + B.T_sticker("NO CASH VALUE", 17, C, C + 282, B.PINK_L, "middle", ow=5))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}" role="img" aria-label="Building Brian">
<defs>
  <linearGradient id="disc" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{B.BG}"/><stop offset=".55" stop-color="#2a0a4a"/>
    <stop offset=".64" stop-color="#6a1b6e"/><stop offset=".66" stop-color="#1a0533"/><stop offset="1" stop-color="{B.BG}"/>
  </linearGradient>
  <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="#ffd6f0"/>
    <stop offset=".5" stop-color="{B.PINK}"/><stop offset=".52" stop-color="#b8126a"/>
    <stop offset=".72" stop-color="#ff5fb8"/><stop offset="1" stop-color="#ffeaf7"/>
  </linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{B.PINK}"/><stop offset="1" stop-color="{B.CYAN}"/></linearGradient>
  <clipPath id="discclip"><circle cx="{C}" cy="{C}" r="{R_OUT-8}"/></clipPath>
  {B.scanlines_defs()}
</defs>
{bg}
<circle cx="{C}" cy="{C}" r="{R_OUT}" fill="url(#disc)"/>
<g clip-path="url(#discclip)">
  <line x1="0" x2="{S}" y1="{C+150}" y2="{C+150}" stroke="{B.PINK_L}" stroke-width="3"/>
  <g stroke="{B.CYAN}" stroke-width="2" opacity=".45">{grid_v}</g>
  <g stroke="{B.PINK}" stroke-width="2" opacity=".6">{grid_h}</g>
  <circle cx="{C}" cy="{C}" r="{R_OUT}" fill="url(#scan)"/>
</g>
<!-- rings -->
<circle cx="{C}" cy="{C}" r="{R_OUT}" fill="none" stroke="url(#ring)" stroke-width="12"/>
<circle cx="{C}" cy="{C}" r="{R_OUT-26}" fill="none" stroke="{B.PURPLE}" stroke-width="4"/>
{"" if icon else f'<circle cx="{C}" cy="{C}" r="{R_RING - 16}" fill="none" stroke="{B.PURPLE}" stroke-width="4"/>'}
{"" if icon else ring_text}
{"" if icon else inscription}
<!-- BB monogram: cyan extrude, dark outline, yellow outline, chrome fill -->
<path d="{bb}" transform="translate(24 24)" fill="{B.CYAN}"/>
<path d="{bb}" transform="translate(24 24)" fill="none" stroke="{B.BG}" stroke-width="10" stroke-linejoin="miter"/>
<path d="{bb}" fill="none" stroke="{B.BG}" stroke-width="30" stroke-linejoin="miter"/>
<path d="{bb}" fill="none" stroke="{B.YELLOW}" stroke-width="14" stroke-linejoin="miter"/>
<path d="{bb}" fill="url(#chrome)"/>
</svg>'''
    name = "logo-icon.svg" if icon else ("logo-dark.svg" if dark_square else "logo.svg")
    Path(name).write_text(svg); print("wrote", name)
    Path(name.replace(".svg", ".html")).write_text(f'<!doctype html><html><body style="margin:0;background:{"#000" if dark_square else "#888"}"><img src="{name}" width="{S}" height="{S}" style="display:block"></body></html>')

if __name__ == "__main__":
    build(False); build(True); build(False, icon=True)
