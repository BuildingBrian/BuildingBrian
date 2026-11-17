// ───────────────────────── sprites (anchor points are in sprite pixels)
const SPR = {};
const SPEC = {
  apache: { hub: [70, 10], tail: [8, 12], gun: [100, 39], pod: [70, 34], rack: [66, 40], hit: [36, 17, 66, 16] },
  heli:   { hit: [10, 10, 70, 22] },
  tank:   { hit: [12, 8, 62, 28] },
  sam:    { hit: [4, 8, 66, 46] },
  bunker: { hit: [6, 4, 60, 40] },
  jet:    { hit: [4, 5, 48, 13] },
  mine:   { hit: [4, 4, 22, 22] },
  boss:   { hit: [26, 36, 220, 60], core: [128, 64, 17],
            rects: [[26, 36, 220, 60], [78, 14, 92, 24], [206, 0, 30, 40], [0, 48, 60, 22], [22, 92, 222, 26]] }
};
function loadSprites() {
  for (const name of Object.keys(SPEC)) {
    const img = document.getElementById('spr-' + name);
    const [wc, wg] = mk(img.naturalWidth || 1, img.naturalHeight || 1);
    wg.drawImage(img, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, wc.width, wc.height);
    SPR[name] = { img, white: wc, w: img.naturalWidth, h: img.naturalHeight };
  }
}

// ───────────────────────── backdrop: sky, striped sun, wireframe mountains, skyline, perspective grid
let skyCv, mtnCv, cityCv;
const STARS = [], MW = 640, CWD = 560, VPX = 240;
function buildBackdrop() {
  reseed(77);
  let g;
  [skyCv, g] = mk(W, H);
  const bands = [[0, '#0d0221'], [34, '#110328'], [62, '#170533'], [88, '#1f0742'], [110, '#2a0a50'], [130, '#3a0e5e'],
                 [146, '#4f1268'], [160, '#6a176e'], [171, '#8a1d70'], [178, '#b0246e'], [HORIZON, '']];
  for (let i = 0; i < bands.length - 1; i++) { g.fillStyle = bands[i][1]; g.fillRect(0, bands[i][0], W, bands[i + 1][0] - bands[i][0]); }
  for (let i = 0; i < 80; i++) {
    STARS.push({ x: Math.floor(rnd(0, W)), y: Math.floor(rnd(2, 124)), c: [C.white, C.white, C.cyan, C.pinkL][Math.floor(rnd(0, 4))], ph: rnd(0, TAU), sp: rnd(1, 4) });
  }
  // sun: scanline circle, yellow at the top to pink at the horizon, with cut-out stripes that thicken downward
  const cx = 338, cy = HORIZON, r = 64, gaps = [[3, 5], [12, 4], [20, 3], [27, 2], [33, 2], [39, 1], [44, 1]];
  for (let y = cy - r; y < cy; y++) {
    const up = cy - y;
    if (gaps.some(([a, n]) => up > a && up <= a + n)) continue;
    const dy = y + 0.5 - cy, hw = Math.floor(Math.sqrt(r * r - dy * dy)), t = (y - (cy - r)) / r;
    g.fillStyle = t < 0.28 ? '#fffb96' : t < 0.48 ? '#ffd56a' : t < 0.66 ? '#ff9f43' : t < 0.82 ? '#ff5f7e' : '#ff2d95';
    g.fillRect(cx - hw, y, hw * 2, 1);
  }
  // mountains: one seamless tile of jagged peaks, filled dark with a magenta ridge line and facet lines
  [mtnCv, g] = mk(MW, 60);
  const pts = [[0, 44]]; let x = 0, up = true;
  while (x < MW - 60) { x += rnd(26, 58); pts.push([Math.round(x), Math.round(up ? rnd(8, 30) : rnd(34, 50))]); up = !up; }
  pts.push([MW, 44]);
  g.fillStyle = '#1a0638'; g.beginPath(); g.moveTo(0, 60); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(MW, 60); g.closePath(); g.fill();
  g.lineWidth = 1; g.strokeStyle = '#5a1a7a'; g.beginPath();
  for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < 32) { g.moveTo(pts[i][0] + 0.5, pts[i][1]); g.lineTo(pts[i][0] + rnd(-10, 10), 60); }
  g.stroke();
  g.strokeStyle = '#c0399f'; g.beginPath(); g.moveTo(0, pts[0][1] + 0.5); for (const p of pts) g.lineTo(p[0], p[1] + 0.5); g.stroke();
  // skyline: dark towers with a few lit windows
  [cityCv, g] = mk(CWD, 56);
  x = 0;
  while (x < CWD) {
    const w = Math.round(rnd(12, 30)), h = Math.round(rnd(8, 46)), gap = rand() < 0.3 ? Math.round(rnd(6, 26)) : 0;
    g.fillStyle = '#0d0221'; g.fillRect(x, 56 - h, w, h);
    g.fillStyle = '#3b0f6b'; g.fillRect(x, 56 - h, w, 1); g.fillRect(x, 56 - h, 1, h);
    for (let wy = 56 - h + 3; wy < 54; wy += 4) for (let wx = x + 3; wx < x + w - 2; wx += 4) {
      if (rand() < 0.3) { g.fillStyle = [C.pink, C.cyan, C.yellow, C.pinkL][Math.floor(rnd(0, 4))]; g.fillRect(wx, wy, 1, 1); }
    }
    if (h > 34 && rand() < 0.5) { g.fillStyle = '#3b0f6b'; g.fillRect(x + (w >> 1), 56 - h - 7, 1, 7); g.fillStyle = C.red; g.fillRect(x + (w >> 1), 56 - h - 8, 1, 1); }
    x += w + gap;
  }
}
function drawBackdrop(scroll, t) {
  ctx.drawImage(skyCv, 0, 0);
  for (const s of STARS) if (Math.sin(t * s.sp + s.ph) > -0.55) { ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 1, 1); }
  for (let x = -((scroll * 0.1) % MW); x < W; x += MW) ctx.drawImage(mtnCv, Math.round(x), HORIZON - 60);
  for (let x = -((scroll * 0.28) % CWD); x < W; x += CWD) ctx.drawImage(cityCv, Math.round(x), HORIZON - 56);
  const gb = [[HORIZON, '#2a0a4a'], [HORIZON + 12, '#220842'], [HORIZON + 30, '#1a0638'], [HORIZON + 54, '#12042a'], [H, '']];
  for (let i = 0; i < gb.length - 1; i++) { ctx.fillStyle = gb[i][1]; ctx.fillRect(0, gb[i][0], W, gb[i + 1][0] - gb[i][0]); }
  ctx.fillStyle = C.pinkL; ctx.fillRect(0, HORIZON, W, 1);
  ctx.fillStyle = C.pink; ctx.fillRect(0, HORIZON + 1, W, 1);
  ctx.fillStyle = 'rgba(255,45,149,0.5)';
  for (let k = 1; k <= 7; k++) ctx.fillRect(0, HORIZON + Math.round((H - HORIZON) * Math.pow(k / 7.4, 1.9)), W, 1);
  // vertical grid lines fan out from the vanishing point; the 1.258 factor makes them track ground units at lane depth
  ctx.strokeStyle = 'rgba(1,205,254,0.42)'; ctx.lineWidth = 1; ctx.beginPath();
  const sp = 58, off = (scroll * 1.258) % sp;
  for (let i = -15; i <= 16; i++) { ctx.moveTo(VPX + 0.5, HORIZON + 2); ctx.lineTo(VPX + i * sp - off, H); }
  ctx.stroke();
}
