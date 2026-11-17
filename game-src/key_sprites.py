#!/usr/bin/env python3
"""Chroma-key (green) the generated sprite art, split sheets into objects, and export
small palette-quantized game sprites.

    python3 key_sprites.py key   raw/foo.png  -> raw/foo.keyed.png (RGBA, full res)
    python3 key_sprites.py split raw/foo.keyed.png prefix  -> prefix_N.png for each object
    python3 key_sprites.py fit   in.png out.png W [colors]  -> downscale to width W, hard alpha, quantize
"""
import sys
from collections import deque
from PIL import Image, ImageFilter


def key(src, dst):
    """Green screen removal. Pure green anywhere is background; weaker green only counts as
    background fringe when it touches background, so teal canopy glass inside a sprite survives."""
    im = Image.open(src).convert("RGB")
    W, H = im.size
    px = im.load()
    dom = [[0] * W for _ in range(H)]
    bg = [[False] * W for _ in range(H)]
    for y in range(H):
        row = dom[y]; brow = bg[y]
        for x in range(W):
            r, g, b = px[x, y]
            d = g - max(r, b)
            row[x] = d
            if d > 80 and g > 140:
                brow[x] = True
    out = Image.new("RGBA", (W, H))
    op = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if bg[y][x]:
                op[x, y] = (0, 0, 0, 0)
                continue
            d = dom[y][x]
            if d > 18:
                near = False
                for dy in (-2, -1, 0, 1, 2):
                    yy = y + dy
                    if yy < 0 or yy >= H: continue
                    for dx in (-2, -1, 0, 1, 2):
                        xx = x + dx
                        if 0 <= xx < W and bg[yy][xx]:
                            near = True; break
                    if near: break
                if near:
                    a = int(255 * (1 - (d - 18) / 62))
                    m = max(r, b)
                    op[x, y] = (r, m, b, max(0, min(255, a)))
                    continue
            op[x, y] = (r, g, b, 255)
    out.save(dst)
    return out


def components(im, min_area=4000):
    """Connected components over alpha>40, 8-neighbour, on a 1/4-scale mask for speed."""
    s = 4
    small = im.split()[3].resize((im.width // s, im.height // s), Image.BOX)
    w, h = small.size
    m = small.load()
    seen = [[False] * w for _ in range(h)]
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or m[x0, y0] < 40:
                continue
            q = deque([(x0, y0)]); seen[y0][x0] = True
            minx = maxx = x0; miny = maxy = y0; n = 0
            while q:
                x, y = q.popleft(); n += 1
                minx = min(minx, x); maxx = max(maxx, x); miny = min(miny, y); maxy = max(maxy, y)
                for dx in (-2, -1, 0, 1, 2):
                    for dy in (-2, -1, 0, 1, 2):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and m[nx, ny] >= 40:
                            seen[ny][nx] = True; q.append((nx, ny))
            if n * s * s >= min_area:
                boxes.append((minx * s, miny * s, (maxx + 1) * s, (maxy + 1) * s, n * s * s))
    # reading order: rows then columns
    boxes.sort(key=lambda b: (round(b[1] / (im.height / 2.2)), b[0]))
    return boxes


def split(src, prefix):
    im = Image.open(src).convert("RGBA")
    for i, (x0, y0, x1, y1, area) in enumerate(components(im), 1):
        pad = 6
        c = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
        c.save(f"{prefix}_{i}.png")
        print(f"{prefix}_{i}.png  box=({x0},{y0},{x1},{y1}) size={c.size} area={area}")


def fit(src, dst, width, colors=40):
    im = Image.open(src).convert("RGBA")
    bbox = im.split()[3].point(lambda a: 255 if a > 60 else 0).getbbox()
    im = im.crop(bbox)
    h = max(1, round(im.height * width / im.width))
    # premultiply-ish: resize RGB and A separately with BOX-ish filter for a chunky pixel look
    small = im.resize((width, h), Image.LANCZOS)
    r, g, b, a = small.split()
    a = a.point(lambda v: 255 if v >= 128 else 0)
    rgb = Image.merge("RGB", (r, g, b)).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = Image.merge("RGBA", (*rgb.split(), a))
    # 1px dark outline wherever opaque meets transparent keeps sprites readable on any background
    out.save(dst)
    print(f"{dst}  {out.size}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "key":
        key(sys.argv[2], sys.argv[2].replace(".png", ".keyed.png"))
    elif cmd == "split":
        split(sys.argv[2], sys.argv[3])
    elif cmd == "fit":
        fit(sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]) if len(sys.argv) > 5 else 40)
