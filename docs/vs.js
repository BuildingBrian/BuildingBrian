/* VAPOR STRIKE: a small arcade shooter for github.com/BuildingBrian.
   Plain canvas + WebAudio, no dependencies. Built from game-src/js by game-src/build.sh. */
(() => {
'use strict';
// ───────────────────────── constants & helpers
const W = 480, H = 270, HORIZON = 182, LANE = 252;
const C = {
  bg: '#0d0221', bg2: '#1a0533', purple: '#3b0f6b', pink: '#ff2d95', pinkL: '#ff71ce', cyan: '#01cdfe',
  mint: '#05ffa1', yellow: '#fffb96', orange: '#ff9f43', lav: '#c9b8ff', dim: '#7d6aa8', white: '#ffffff', red: '#ff3b5c'
};
const qs = new URLSearchParams(location.search);
const SHOT = qs.has('shot') ? Math.max(0, parseFloat(qs.get('shot')) || 0) : null;   // ?shot=T renders one deterministic frame
const SCENE = qs.get('scene') || 'demo';
const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pad = (n, w = 6) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

// small seeded RNG so the attract demo (and screenshots) replay identically
let _seed = 1995;
function reseed(s) { _seed = s >>> 0; }
function rand() {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = (a, b) => a + rand() * (b - a);

function mk(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return [c, g];
}

// ───────────────────────── drawing primitives
const FONT = '"Press Start 2P", monospace';
function setFont(size, align) { ctx.font = size + 'px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = align || 'left'; }
function text(s, x, y, col, align, size = 8) {
  setFont(size, align); ctx.fillStyle = col; ctx.fillText(s, Math.round(x), Math.round(y));
}
function textO(s, x, y, col, align, size = 8, out = C.bg) {
  setFont(size, align); x = Math.round(x); y = Math.round(y);
  const o = size >= 16 ? 2 : 1;
  ctx.fillStyle = out;
  for (let dx = -o; dx <= o; dx++) for (let dy = -o; dy <= o; dy++) if (dx || dy) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
// chrome lettering: cyan extrude, dark outline, yellow outline, pink chrome fill (same recipe as the README header)
function logo(s, x, y, size) {
  setFont(size, 'center'); x = Math.round(x); y = Math.round(y);
  const ex = size >= 32 ? 3 : 2, od = size >= 32 ? 4 : 3, oy = size >= 32 ? 2 : 1;
  ctx.fillStyle = C.bg;
  for (let dx = -od; dx <= od + ex; dx++) for (let dy = -od; dy <= od + ex; dy++) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = C.cyan; ctx.fillText(s, x + ex, y + ex);
  ctx.fillStyle = C.bg;
  for (let dx = -od + 1; dx < od; dx++) for (let dy = -od + 1; dy < od; dy++) ctx.fillText(s, x + dx, y + dy);
  ctx.fillStyle = C.yellow;
  for (let dx = -oy; dx <= oy; dx++) for (let dy = -oy; dy <= oy; dy++) ctx.fillText(s, x + dx, y + dy);
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.32, '#ffd6f0'); g.addColorStop(0.5, C.pink);
  g.addColorStop(0.52, '#b8126a'); g.addColorStop(0.72, '#ff5fb8'); g.addColorStop(1, '#ffeaf7');
  ctx.fillStyle = g; ctx.fillText(s, x, y);
}
// hard-edged filled circle (keeps explosions looking like pixel art instead of antialiased blobs)
function disc(x, y, r, col) {
  x = Math.round(x); y = Math.round(y); r = Math.round(r);
  ctx.fillStyle = col;
  if (r <= 0) { ctx.fillRect(x, y, 1, 1); return; }
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x - hw, y + dy, hw * 2 + 1, 1);
  }
}

// ───────────────────────── audio: everything is synthesised with WebAudio, no sample files
const AU = { ctx: null, master: null, music: null, noise: null, muted: false, song: null, timer: 0 };
try { AU.muted = localStorage.getItem('vaporstrike.muted') === '1'; } catch (e) { /* private mode */ }

function audioInit() {
  if (SHOT !== null) return;
  if (AU.ctx) { if (AU.ctx.state === 'suspended' && !G.paused) AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = AU.ctx = new AC();
  const comp = c.createDynamicsCompressor();
  AU.master = c.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.55;
  AU.music = c.createGain(); AU.music.gain.value = 0.5;
  AU.music.connect(AU.master); AU.master.connect(comp); comp.connect(c.destination);
  const len = c.sampleRate; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf;
}
function setMuted(m) {
  AU.muted = m;
  try { localStorage.setItem('vaporstrike.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (AU.master) AU.master.gain.value = m ? 0 : 0.55;
  const b = document.getElementById('mute');
  if (b) { b.textContent = m ? 'SOUND OFF' : 'SOUND ON'; b.setAttribute('aria-pressed', m ? 'true' : 'false'); }
}
function tone(type, f0, f1, dur, vol, when = 0, dest) {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime + when; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AU.master); o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dur, vol, ftype, f0, f1, q = 1, when = 0, dest) {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime + when; const s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}
const sfx = {
  // a coin going into the machine: slot scrape, three metallic bounces, the thunk into the cash box, then the credit chime
  coin() {
    hiss(0.04, 0.22, 'bandpass', 6500, 5200, 3, 0);
    [0.05, 0.15, 0.22, 0.27].forEach((w, i) => {
      for (const f of [3140, 4370, 5520, 7480]) tone('sine', f * (1 + i * 0.012), f * 0.99, 0.11 - i * 0.015, 0.05 - i * 0.008, w);
    });
    tone('sine', 170, 55, 0.14, 0.5, 0.33); hiss(0.07, 0.3, 'lowpass', 600, 200, 1, 0.33);
    tone('square', 988, 988, 0.08, 0.1, 0.5); tone('square', 1319, 1319, 0.5, 0.1, 0.58);
  },
  start() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.09, 0.1, i * 0.07)); },
  gun() { hiss(0.05, 0.16, 'bandpass', 1500, 700, 0.8); tone('square', 160, 70, 0.05, 0.09); },
  tink() { tone('square', 1400, 900, 0.03, 0.04); },
  rocket() { hiss(0.38, 0.2, 'bandpass', 800, 2600, 1.2); },
  hellfire() { hiss(0.7, 0.24, 'bandpass', 420, 3200, 1.4); tone('sawtooth', 80, 260, 0.55, 0.07); },
  cannon() { tone('sine', 140, 40, 0.22, 0.45); hiss(0.16, 0.3, 'lowpass', 1200, 200); },
  explosion(s = 1) {
    hiss(0.25 + 0.28 * s, Math.min(0.5, 0.26 + 0.1 * s), 'lowpass', 1400, 90);
    tone('sine', 120, 28, 0.2 + 0.2 * s, Math.min(0.6, 0.3 + 0.12 * s));
  },
  hit() { tone('square', 240, 50, 0.22, 0.22); hiss(0.12, 0.25, 'highpass', 1800, 900); },
  pickup() { tone('square', 660, 660, 0.06, 0.1); tone('square', 990, 990, 0.12, 0.1, 0.06); },
  alarm() { for (let i = 0; i < 7; i++) { tone('sawtooth', 466, 466, 0.2, 0.1, i * 0.55); tone('sawtooth', 349, 349, 0.2, 0.1, i * 0.55 + 0.27); } },
  tick() { tone('square', 880, 880, 0.06, 0.08); },
  over() { [392, 330, 262, 196, 131].forEach((f, i) => tone('triangle', f, f * 0.97, 0.32, 0.2, i * 0.26)); },
  clear() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, i === 6 ? 0.5 : 0.11, 0.11, i * 0.12)); }
};
// wrap so nothing plays before the first user gesture or in screenshot mode
for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = (...a) => { if (AU.ctx && !G.demo) f(...a); }; }

// tiny step sequencer: A minor, four bars (Am F C G), bass + arpeggio + drums
const N = (semi) => 55 * Math.pow(2, semi / 12);            // A1 = 55 Hz
const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];   // roots relative to A
function music(kind) {
  AU.song = kind ? { kind, step: 0, next: AU.ctx ? AU.ctx.currentTime + 0.08 : 0, bpm: kind === 'boss' ? 150 : 124, tr: kind === 'boss' ? 2 : 0 } : null;
  if (kind && AU.ctx && !AU.timer) AU.timer = setInterval(musicTick, 30);
}
function musicTick() {
  const c = AU.ctx, m = AU.song; if (!c || !m || c.state !== 'running') return;
  if (m.next < c.currentTime - 0.3) m.next = c.currentTime + 0.05;       // tab was hidden; resync
  while (m.next < c.currentTime + 0.14) {
    const st = m.step % 64, bar = Math.floor(st / 16), s = st % 16, ch = CHORDS[bar], w = m.next - c.currentTime, d = AU.music;
    const root = ch[0] + m.tr + 12;
    if (s % 2 === 0) tone('sawtooth', N(root + (s % 8 === 6 ? 12 : 0)), N(root + (s % 8 === 6 ? 12 : 0)), 0.16, 0.16, w, d);
    const an = ch[[0, 1, 2, 1][s % 4]] + m.tr + 36 + (s >= 8 ? 12 : 0);
    tone('square', N(an), N(an), 0.09, 0.035, w, d);
    if (s % 4 === 0) tone('sine', 150, 42, 0.13, 0.5, w, d);
    if (s === 4 || s === 12) hiss(0.11, 0.2, 'highpass', 1400, 1400, 0.7, w, d);
    if (s % 2 === 1) hiss(0.03, 0.06, 'highpass', 7000, 7000, 0.7, w, d);
    if (bar >= 2 && (s === 0 || s === 6 || s === 10)) { const ln = ch[2] + m.tr + 48 + (s === 6 ? 2 : 0); tone('triangle', N(ln), N(ln), 0.3, 0.07, w, d); }
    m.next += 60 / m.bpm / 4; m.step++;
  }
}
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
// ───────────────────────── game state
const G = {
  mode: 'boot', t: 0, mt: 0, frame: 0, credits: 0, score: 0, hi: 0, lives: 3, loop: 1, diff: 1,
  scroll: 0, gs: 36, gsT: 36, stageT: 0, si: 0, script: [], boss: null, shake: 0, flash: 0,
  demo: false, paused: false, lock: 0, extend: false, msg: null, warn: 0, cont: 9, entry: null, tally: null
};
let pl = null;
const EN = [], PB = [], EB = [], FX = [], PK = [], POP = [];
const ET = {
  jet:    { hp: 3,   score: 150,   boom: 0.7 },
  heli:   { hp: 9,   score: 400,   boom: 1.0 },
  mine:   { hp: 5,   score: 200,   boom: 1.2 },
  tank:   { hp: 16,  score: 300,   boom: 1.2, ground: true },
  sam:    { hp: 12,  score: 500,   boom: 1.4, ground: true },
  bunker: { hp: 26,  score: 600,   boom: 1.5, ground: true },
  boss:   { hp: 900, score: 10000, boom: 3.0, ground: true }
};
function setMode(m) { G.mode = m; G.mt = 0; }
function clearWorld() { EN.length = PB.length = EB.length = FX.length = PK.length = POP.length = 0; G.boss = null; G.msg = null; G.warn = 0; }

// ───────────────────────── player: AH-64 with the real loadout (1200 rounds, 38 rockets, 8 Hellfires)
function newPlayer() {
  return { x: -124, y: 104, vx: 0, vy: 0, tilt: 0, aim: 0.1, gunCd: 0, rktCd: 0, hfCd: 0, armor: 3, inv: 2.6, hit: 0,
           muzzle: 0, alive: true, enter: true, dt: 0, rounds: 1200, rkts: 38, hfs: 8, locked: false };
}
// sprite-local point -> screen point, following the airframe's tilt
function ppt(lx, ly) {
  const p = pl, dx = lx - 58, dy = ly - 24, c = Math.cos(p.tilt), s = Math.sin(p.tilt);
  return [p.x + 58 + dx * c - dy * s, p.y + 24 + dx * s + dy * c];
}
function hbOf(e) { const h = SPEC[e.type].hit; return { x: e.x + h[0], y: e.y + h[1], w: h[2], h: h[3] }; }
function aimPoint(e) { if (e.type === 'boss') return [e.x + 128, e.y + 64]; const h = hbOf(e); return [h.x + h.w / 2, h.y + h.h / 2]; }

function updPlayer(dt, inp) {
  const p = pl; if (!p.alive) return;
  const SP = 138;
  let tx = inp.x * SP, ty = inp.y * SP * 0.85;
  if (p.enter) { tx = 120; ty = 0; if (p.x >= 62) p.enter = false; }
  p.vx += (tx - p.vx) * Math.min(1, dt * 9); p.vy += (ty - p.vy) * Math.min(1, dt * 9);
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (!p.enter) p.x = clamp(p.x, 4, W - 122);
  p.y = clamp(p.y, 18, LANE - 60);
  p.tilt += (clamp(p.vx / SP, -1, 1) * 0.09 - p.tilt) * Math.min(1, dt * 6);
  for (const k of ['gunCd', 'rktCd', 'hfCd', 'inv', 'hit', 'muzzle']) if (p[k] > 0) p[k] -= dt;
  // the chain gun is slaved to the nearest target inside its arc, like the real turret
  const [gx, gy] = ppt(100, 39);
  let best = null, bs = 1e9;
  const consider = (cx, cy) => {
    const dx = cx - gx, dy = cy - gy; if (dx < 10) return;
    const d = Math.hypot(dx, dy); if (d > 340) return;
    const a = Math.atan2(dy, dx); if (a < -0.32 || a > 1.2) return;
    const s = d + Math.abs(a - 0.15) * 40; if (s < bs) { bs = s; best = a; }
  };
  for (const e of EN) { if (e.dead || e.dying || e.x > W + 6) continue; const [ax, ay] = aimPoint(e); consider(ax, ay); }
  for (const b of EB) if (b.k === 'm') consider(b.x, b.y);
  p.locked = best !== null;
  p.aim += clamp((best === null ? 0.1 : best) - p.aim, -7 * dt, 7 * dt);
  if (p.enter) return;
  if (inp.gun && p.gunCd <= 0 && p.rounds > 0) {
    const a = p.aim + rnd(-0.03, 0.03), tipx = gx + Math.cos(p.aim) * 14, tipy = gy + Math.sin(p.aim) * 14;
    PB.push({ k: 'b', x: tipx, y: tipy, vx: Math.cos(a) * 450, vy: Math.sin(a) * 450, life: 0.85, dmg: 1 });
    FX.push({ k: 'casing', x: gx - 4, y: gy + 2, vx: rnd(-50, -20) - G.gs, vy: rnd(-30, 10), g: 320, life: 0, max: 0.7 });
    p.rounds--; p.gunCd = 0.1; p.muzzle = 0.05; sfx.gun();
  }
  if (inp.rkt && p.rktCd <= 0 && p.rkts > 0) {
    for (let i = 0; i < 2 && p.rkts > 0; i++) {
      const [x, y] = ppt(70, 33 + i * 3), a = p.tilt + 0.07;
      PB.push({ k: 'r', x, y, a, sp: 150 + p.vx * 0.5, vy0: i ? 16 : -16, life: 1.5, dmg: 7, t: 0 });
      p.rkts--;
    }
    p.rktCd = 0.32; sfx.rocket();
  }
  if (inp.hf && p.hfCd <= 0 && p.hfs > 0) {
    const tg = hfTarget();                       // no lock, no launch: a held key can't waste the rack
    if (tg) {
      const [x, y] = ppt(66, 41);
      PB.push({ k: 'h', x, y, vx: p.vx * 0.6 + 50, vy: 55, sp: 70, life: 4, dmg: 36, t: 0, tg });
      p.hfs--; p.hfCd = 0.9; sfx.hellfire();
    } else p.hfCd = 0.15;
  }
}
// Hellfire picks the heaviest armor ahead: the boss first, then ground vehicles, then anything else
function hfTarget() {
  let best = null, bv = -1;
  for (const e of EN) {
    if (e.dead || e.dying || e.x < pl.x + 60 || e.x > W - 2) continue;
    const v = (e.type === 'boss' ? 1e5 : 0) + (e.ground ? 1000 : 0) + e.hp;
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}
function hurt() {
  const p = pl; if (!p.alive || p.inv > 0 || G.demo) return;
  p.armor--; p.inv = 1.5; p.hit = 0.18; G.shake = Math.max(G.shake, 5); sfx.hit();
  if (p.armor <= 0) { p.alive = false; p.dt = 0; G.lives--; boom(p.x + 58, p.y + 24, 2); G.flash = 0.5; }
}
function respawn() {
  const old = pl; pl = newPlayer();
  pl.rounds = Math.max(old.rounds, 600); pl.rkts = Math.max(old.rkts, 19); pl.hfs = Math.max(old.hfs, 4); pl.inv = 3.2;
}

// ───────────────────────── effects
function boom(x, y, s = 1) {
  const n = Math.round(5 + 5 * s);
  for (let i = 0; i < n; i++) FX.push({ k: 'fire', x: x + rnd(-9, 9) * s, y: y + rnd(-8, 8) * s, vx: rnd(-18, 18) * s, vy: rnd(-34, 6) * s, life: 0, max: rnd(0.32, 0.62), r: rnd(4, 9) * s, delay: i * 0.025 });
  for (let i = 0; i < Math.round(7 * s) + 3; i++) { const a = rnd(0, TAU), v = rnd(50, 170); FX.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 240, life: 0, max: rnd(0.25, 0.7), c: rand() < 0.5 ? C.yellow : C.orange, s: s > 1.2 ? 2 : 1 }); }
  for (let i = 0; i < Math.round(2 + 2 * s); i++) FX.push({ k: 'smoke', x: x + rnd(-8, 8) * s, y: y + rnd(-6, 6) * s, vx: rnd(-14, 6) - G.gs * 0.4, vy: rnd(-26, -8), life: 0, max: rnd(0.7, 1.2), r: rnd(3, 6) * s, delay: 0.12 });
  FX.push({ k: 'ring', x, y, r: 3, vr: 110 * s, life: 0, max: 0.24 });
  G.shake = Math.max(G.shake, 2.2 * s);
  sfx.explosion(s);
}
function addScore(n, x, y, label) {
  G.score += n;
  if (x !== undefined) POP.push({ s: label || String(n), x, y, t: 0, c: label ? C.mint : C.yellow });
  if (!G.extend && G.score >= 40000 && !G.demo) { G.extend = true; G.lives++; sfx.pickup(); POP.push({ s: '1UP', x: pl.x + 58, y: pl.y, t: 0, c: C.mint }); }
}
function updFX(dt) {
  for (const f of FX) {
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.life += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
    if (f.g) f.vy += f.g * dt;
    if (f.k === 'ring') f.r += f.vr * dt;
  }
  for (let i = FX.length - 1; i >= 0; i--) if (FX[i].life >= FX[i].max) FX.splice(i, 1);
  for (const p of POP) { p.t += dt; p.y -= 16 * dt; }
  for (let i = POP.length - 1; i >= 0; i--) if (POP[i].t > 0.9) POP.splice(i, 1);
}

// ───────────────────────── enemies
function spawn(type, o) {
  const s = SPR[type], d = ET[type];
  const e = { type, x: W + 8, y: 0, w: s.w, h: s.h, hp: Math.round(d.hp * (type === 'boss' ? 0.7 + 0.3 * G.diff : G.diff)), score: d.score,
              ground: !!d.ground, t: 0, cd: rnd(0.5, 1.3), flash: 0, dead: false, dying: 0, burst: 0, bcd: 0, ph: rnd(0, TAU) };
  e.max = e.hp;
  if (e.ground) e.y = LANE - s.h + (type === 'boss' ? 6 : 0);
  else { e.y0 = (o && o.y !== undefined) ? o.y : rnd(40, 150); e.y = e.y0; }
  if (type === 'heli') { e.tx = rnd(300, 372); e.stay = rnd(7, 9); }
  if (type === 'boss') { e.c1 = 2; e.c2 = 1; e.c3 = 4; e.mq = 0; e.mcd = 0; e.alt = false; e.bx = 0; }
  EN.push(e); return e;
}
function shootAt(e, ox, oy, sp, k, spread = 0.06) {
  if (!pl.alive) return;
  const x = e.x + ox, y = e.y + oy, a = Math.atan2(pl.y + 25 - y, pl.x + 66 - x) + rnd(-spread, spread);
  EB.push({ k, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 6, r: k === 's' ? 3 : 2 });
  if (k === 's') sfx.cannon();
}
function launchMissile(x, y) {
  EB.push({ k: 'm', x, y, vx: -45, vy: -125, sp: 106, turn: 1.6, life: 4.3, hp: 2, t: 0, r: 3 });
  sfx.rocket();
}
function updEnemies(dt) {
  const rate = 0.7 + 0.3 * G.diff, px = pl.x + 58;
  for (const e of EN) {
    if (e.dead) continue;
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    switch (e.type) {
      case 'jet':
        e.x -= 235 * dt; e.y = e.y0 + Math.sin(e.t * 5 + e.ph) * 9;
        if (!e.fired && e.x < W - 70 && e.x > px + 50) { e.fired = true; if (rand() < 0.55) shootAt(e, 2, 13, 150, 'b'); }
        if (e.x < -80) e.dead = true;
        break;
      case 'heli':
        if (e.t < e.stay) { e.x += (e.tx - e.x) * Math.min(1, dt * 1.6); e.y = e.y0 + Math.sin(e.t * 1.7 + e.ph) * 15; }
        else { e.x -= 150 * dt; e.y -= 22 * dt; if (e.x < -110) e.dead = true; }
        e.cd -= dt * rate;
        if (e.cd <= 0 && e.x < W - 30 && e.x > px + 20) { shootAt(e, 4, 30, 160, 'b'); e.burst = 1; e.bcd = 0.16; e.cd = 1.9; }
        if (e.burst > 0) { e.bcd -= dt; if (e.bcd <= 0) { shootAt(e, 4, 30, 160, 'b'); e.burst--; e.bcd = 0.16; } }
        break;
      case 'mine':
        e.x -= 34 * dt; e.y = e.y0 + Math.sin(e.t * 2 + e.ph) * 12; if (e.x < -40) e.dead = true;
        break;
      case 'tank':
        e.x -= (G.gs + 6) * dt; e.cd -= dt * rate;
        if (e.cd <= 0 && e.x < W - 16 && e.x > 30 && e.x > px - 30) { shootAt(e, 0, 12, 125, 's'); FX.push({ k: 'flash', x: e.x, y: e.y + 12, r: 5, life: 0, max: 0.08 }); e.cd = 2.5; }
        if (e.x < -90) e.dead = true;
        break;
      case 'sam':
        e.x -= G.gs * dt; e.cd -= dt * rate;
        if (e.cd <= 0 && e.x < W - 30 && e.x > 60) { launchMissile(e.x + 30, e.y + 8); e.cd = 3.8; }
        if (e.x < -90) e.dead = true;
        break;
      case 'bunker':
        e.x -= G.gs * dt; e.cd -= dt * rate;
        if (e.cd <= 0 && e.x < W - 16 && e.x > 30) { e.burst = 3; e.bcd = 0; e.cd = 2.7; }
        if (e.burst > 0) { e.bcd -= dt; if (e.bcd <= 0) { shootAt(e, 8, 3, 175, 'b', 0.04); e.burst--; e.bcd = 0.13; } }
        if (e.x < -90) e.dead = true;
        break;
      case 'boss': updBoss(e, dt, rate); break;
    }
  }
  for (let i = EN.length - 1; i >= 0; i--) if (EN[i].dead) EN.splice(i, 1);
}
function updBoss(e, dt, rate) {
  if (e.dying > 0) {
    e.dying -= dt; e.bx -= dt; e.x += 5 * dt;
    if (e.bx <= 0) { e.bx = 0.11; boom(e.x + rnd(16, 236), e.y + rnd(14, 112), rnd(0.8, 1.6)); }
    if (e.dying <= 0) {
      e.dead = true; G.boss = null;
      boom(e.x + 125, e.y + 60, 3.2); boom(e.x + 56, e.y + 72, 2.4); boom(e.x + 196, e.y + 46, 2.4);
      G.flash = 1; G.shake = 10; missionClear();
    }
    return;
  }
  const tx = W - 232;
  if (!e.inPos) { e.x = Math.max(tx, e.x - 44 * dt); if (e.x <= tx) { e.inPos = true; e.t = 0; } return; }
  e.x = tx + Math.sin(e.t * 0.6) * 7;
  const ph = e.hp / e.max, r = rate * (ph < 0.25 ? 1.7 : ph < 0.55 ? 1.3 : 1);
  e.c1 -= dt * r;
  if (e.c1 <= 0) {   // main cannon: three-shell spread
    const base = Math.atan2(pl.y + 25 - (e.y + 59), pl.x + 66 - (e.x + 3));
    for (const s of [-0.2, 0, 0.2]) EB.push({ k: 's', x: e.x + 3, y: e.y + 59, vx: Math.cos(base + s) * 135, vy: Math.sin(base + s) * 135, life: 6, r: 4 });
    FX.push({ k: 'flash', x: e.x + 2, y: e.y + 59, r: 9, life: 0, max: 0.1 }); G.shake = Math.max(G.shake, 2.5); sfx.cannon(); e.c1 = 3.1;
  }
  e.c2 -= dt * r;
  if (e.c2 <= 0) { const m = e.alt ? [81, 22] : [133, 26]; e.alt = !e.alt; shootAt(e, m[0], m[1], 172, 'b'); e.c2 = 1.0; }
  e.c3 -= dt * r;
  if (e.c3 <= 0) { e.mq = ph < 0.55 ? 4 : 3; e.mcd = 0; e.c3 = 6.5; }
  if (e.mq > 0) { e.mcd -= dt; if (e.mcd <= 0) { launchMissile(e.x + 218, e.y + 6); e.mq--; e.mcd = 0.32; } }
  if (ph < 0.55 && rand() < dt * (ph < 0.25 ? 14 : 6)) FX.push({ k: 'smoke', x: e.x + rnd(40, 220), y: e.y + rnd(30, 70), vx: rnd(-10, 10), vy: rnd(-34, -16), life: 0, max: rnd(0.8, 1.3), r: rnd(3, 6) });
}
function damage(e, d) {
  if (e.dead || e.dying > 0) return;
  e.hp -= d;
  if (G.t - (e.ft || -1) > 0.14) { e.ft = G.t; e.flash = 0.05; }     // brief white blink, rate-limited so sustained fire doesn't whiteout the sprite
  if (e.hp > 0) return;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  addScore(e.score, cx, cy - 6);
  if (e.type === 'boss') { e.dying = 3.2; e.bx = 0; EB.length = 0; music(null); return; }
  e.dead = true; boom(cx, cy, ET[e.type].boom);
  if (e.type === 'mine') {            // mines chain into whatever is next to them
    for (const o of EN) if (o !== e && !o.dead && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < 50) damage(o, 6);
  }
  const r = rand(); let k = null;
  if (e.type === 'sam') k = r < 0.6 ? 'H' : null;
  else if (e.type === 'bunker') k = 'R';
  else if (e.type === 'tank') k = r < 0.35 ? 'R' : r < 0.5 ? 'G' : null;
  else if (e.type === 'heli') k = r < 0.3 ? 'A' : r < 0.5 ? 'G' : null;
  if (k) PK.push({ k, x: cx, y: Math.min(cy, LANE - 40), t: 0, got: false });
}

// ───────────────────────── projectiles
function hitTest(e, x, y) {
  const rects = SPEC[e.type].rects;
  if (!rects) { const h = SPEC[e.type].hit; return x >= e.x + h[0] && x <= e.x + h[0] + h[2] && y >= e.y + h[1] && y <= e.y + h[1] + h[3]; }
  for (const r of rects) if (x >= e.x + r[0] && x <= e.x + r[0] + r[2] && y >= e.y + r[1] && y <= e.y + r[1] + r[3]) return true;
  return false;
}
function explodeShot(b, direct) {
  b.life = 0;
  const big = b.k === 'h'; boom(b.x, b.y, big ? 1.6 : 0.8);
  const R = big ? 36 : 18, sd = big ? 12 : 3;
  for (const e of EN) {
    if (e.dead || e.dying > 0 || e === direct) continue;
    const h = hbOf(e), cx = clamp(b.x, h.x, h.x + h.w), cy = clamp(b.y, h.y, h.y + h.h);
    if (Math.hypot(b.x - cx, b.y - cy) < R) damage(e, sd);
  }
}
function updPB(dt) {
  for (const b of PB) {
    b.life -= dt; b.t = (b.t || 0) + dt;
    if (b.k === 'r') {
      b.sp = Math.min(540, b.sp + 620 * dt); b.vy0 *= Math.max(0, 1 - 4 * dt);
      b.vx = Math.cos(b.a) * b.sp; b.vy = Math.sin(b.a) * b.sp + b.vy0;
      if ((G.frame & 1) === 0) FX.push({ k: 'smoke', x: b.x - 6, y: b.y, vx: -30, vy: rnd(-5, 5), life: 0, max: 0.3, r: 1.6 });
    } else if (b.k === 'h') {
      if (b.t < 0.2) b.vy += 120 * dt;             // drops off the rail, then the motor lights
      else {
        b.sp = Math.min(370, b.sp + 520 * dt);
        let want = Math.atan2(b.vy, b.vx);
        if (b.tg && !b.tg.dead && !(b.tg.dying > 0)) {
          const [tx, ty] = aimPoint(b.tg), dx = tx - b.x;
          want = Math.atan2(ty - (dx > 110 ? 70 : 0) - b.y, dx);   // loft, then dive on the target
        } else if (b.t < 0.5) want = -0.1;
        let a = Math.atan2(b.vy, b.vx), d = want - a;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        a += clamp(d, -5.5 * dt, 5.5 * dt);
        b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp;
        if ((G.frame & 1) === 0) FX.push({ k: 'smoke', x: b.x - Math.cos(a) * 8, y: b.y - Math.sin(a) * 8, vx: -20, vy: rnd(-4, 4), life: 0, max: 0.5, r: 2.2 });
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life > 0 && b.y >= LANE + 3) {
      if (b.k === 'b') { b.life = 0; FX.push({ k: 'spark', x: b.x, y: LANE + 2, vx: rnd(-30, 10), vy: rnd(-50, -20), g: 200, life: 0, max: 0.25, c: C.lav, s: 1 }); }
      else explodeShot(b, null);
    }
    if (b.x > W + 24 || b.x < -24 || b.y < -40) b.life = 0;
    if (b.life <= 0) continue;
    for (const e of EN) {
      if (e.dead || e.dying > 0 || !hitTest(e, b.x, b.y)) continue;
      let d = b.dmg, core = false;
      if (e.type === 'boss') { const c = SPEC.boss.core; if (Math.hypot(b.x - (e.x + c[0]), b.y - (e.y + c[1])) < c[2]) { d *= 2; core = true; } }
      if (b.k === 'b') {
        b.life = 0;
        FX.push({ k: 'spark', x: b.x, y: b.y, vx: rnd(-60, 20), vy: rnd(-60, 30), g: 150, life: 0, max: 0.18, c: core ? C.pinkL : C.yellow, s: core ? 2 : 1 });
        if (G.t - (e.hs || 0) > 0.09) { e.hs = G.t; sfx.tink(); }
        damage(e, d);
      } else { explodeShot(b, e); damage(e, d); }
      break;
    }
    if (b.life > 0 && b.k === 'b') {
      for (const m of EB) if (m.k === 'm' && m.life > 0 && Math.abs(m.x - b.x) < 7 && Math.abs(m.y - b.y) < 7) {
        b.life = 0; m.hp--;
        if (m.hp <= 0) { m.life = 0; boom(m.x, m.y, 0.5); addScore(50, m.x, m.y - 4); }
        break;
      }
    }
  }
  for (let i = PB.length - 1; i >= 0; i--) if (PB[i].life <= 0) PB.splice(i, 1);
}
function updEB(dt) {
  for (const b of EB) {
    if (b.life <= 0) continue;
    b.life -= dt;
    if (b.k === 'm') {
      b.t += dt;
      if (b.t > 0.35 && pl.alive) {
        let a = Math.atan2(b.vy, b.vx), d = Math.atan2(pl.y + 25 - b.y, pl.x + 62 - b.x) - a;
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        a += clamp(d, -b.turn * dt, b.turn * dt);
        b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp;
      }
      if (G.frame % 3 === 0) FX.push({ k: 'smoke', x: b.x, y: b.y, vx: 0, vy: -6, life: 0, max: 0.45, r: 1.8 });
      if (b.life <= 0) boom(b.x, b.y, 0.4);
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -24 || b.x > W + 40 || b.y < -60 || b.y > H + 10 || (b.k !== 'm' && b.y > LANE + 8)) b.life = 0;
  }
  for (let i = EB.length - 1; i >= 0; i--) if (EB[i].life <= 0) EB.splice(i, 1);
}
function updPK(dt) {
  for (const k of PK) { k.t += dt; k.x -= 30 * dt; k.y += Math.cos(k.t * 3) * 12 * dt - (k.y > 150 ? 26 * dt : 0); }
  for (let i = PK.length - 1; i >= 0; i--) if (PK[i].got || PK[i].x < -20) PK.splice(i, 1);
}
function collide() {
  const p = pl; if (!p.alive) return;
  const h = SPEC.apache.hit, hx = p.x + h[0], hy = p.y + h[1], hw = h[2], hh = h[3];
  for (const b of EB) {
    if (b.life <= 0) continue;
    if (b.x + b.r > hx && b.x - b.r < hx + hw && b.y + b.r > hy && b.y - b.r < hy + hh) {
      b.life = 0; if (b.k === 'm') boom(b.x, b.y, 0.5);
      hurt();
    }
  }
  for (const e of EN) {
    if (e.dead || e.dying > 0) continue;
    const rects = SPEC[e.type].rects || [SPEC[e.type].hit];
    for (const r of rects) {
      if (hx < e.x + r[0] + r[2] && hx + hw > e.x + r[0] && hy < e.y + r[1] + r[3] && hy + hh > e.y + r[1]) {
        if (p.inv <= 0 && !G.demo) { hurt(); if (e.type !== 'boss') damage(e, 8); }
        break;
      }
    }
  }
  for (const k of PK) {
    if (k.got || k.x + 8 < p.x + 16 || k.x - 8 > p.x + 112 || k.y + 8 < p.y + 4 || k.y - 8 > p.y + 46) continue;
    k.got = true; let label;
    if (k.k === 'R') { p.rkts = Math.min(38, p.rkts + 12); label = 'ROCKETS'; }
    else if (k.k === 'H') { p.hfs = Math.min(8, p.hfs + 2); label = 'HELLFIRE'; }
    else if (k.k === 'A') { p.armor = Math.min(3, p.armor + 1); label = 'ARMOR'; }
    else { p.rounds = Math.min(1200, p.rounds + 400); label = '30MM'; }
    sfx.pickup(); addScore(100, k.x, k.y - 10, label);
  }
}
// ───────────────────────── stage script (seconds into the mission)
function buildStage() {
  const S = [], at = (t, k, o) => S.push({ t, k, o: o || {} });
  at(0, 'msg', { a: 'MISSION ' + G.loop, b: 'NEON VALLEY', d: 2.6 });
  for (let i = 0; i < 3; i++) at(3 + i * 0.45, 'jet', { y: 60 + i * 20 });
  at(6.5, 'tank'); at(9, 'heli', { y: 70 });
  for (let i = 0; i < 4; i++) at(12.5 + i * 0.4, 'jet', { y: 130 - i * 18 });
  at(15, 'sam'); at(17.5, 'tank');
  at(20, 'mine', { y: 60 }); at(21, 'mine', { y: 105 }); at(22, 'mine', { y: 150 });
  at(24.5, 'bunker'); at(26.5, 'heli', { y: 55 }); at(28, 'heli', { y: 125 });
  at(31.5, 'tank'); at(33, 'tank');
  for (let i = 0; i < 5; i++) at(35 + i * 0.38, 'jet', { y: 46 + i * 24 });
  at(38.5, 'sam'); at(41, 'bunker'); at(42.5, 'heli', { y: 90 });
  at(45, 'mine', { y: 80 }); at(45.8, 'mine', { y: 130 });
  for (let i = 0; i < 4; i++) at(48 + i * 0.4, 'jet', { y: 150 - i * 26 });
  at(50.5, 'tank'); at(52, 'sam'); at(53.5, 'tank');
  at(56, 'heli', { y: 60 }); at(57, 'heli', { y: 110 }); at(58, 'heli', { y: 150 });
  at(62, 'bunker'); at(64, 'bunker');
  for (let i = 0; i < 6; i++) at(66 + i * 0.35, 'jet', { y: 50 + (i % 3) * 40 });
  at(70, 'sam'); at(71.5, 'tank');
  at(75, 'warn'); at(79.5, 'boss');
  return S.sort((a, b) => a.t - b.t);
}
function runEvent(ev) {
  if (ev.k === 'msg') G.msg = { a: ev.o.a, b: ev.o.b, t: ev.o.d };
  else if (ev.k === 'warn') { G.warn = 4.2; music(null); sfx.alarm(); }
  else if (ev.k === 'boss') { G.boss = spawn('boss'); G.gsT = 12; if (!G.demo) music('boss'); }
  else spawn(ev.k, ev.o);
}
function startGame(demo) {
  G.demo = !!demo; reseed(demo ? 1995 : ((Date.now() & 0xffffff) | 1));
  G.score = 0; G.lives = 3; G.loop = 1; G.diff = 1; G.extend = false;
  beginStage();
}
function beginStage() {
  clearWorld();
  G.stageT = 0; G.si = 0; G.script = buildStage(); G.gsT = 36; G.gs = 36;
  pl = newPlayer(); setMode('play');
  if (!G.demo) music('stage');
}
function missionClear() {
  if (!pl.alive) { if (G.lives <= 0) G.lives = 1; respawn(); pl.x = 70; pl.enter = false; }   // boss and player went down together
  const p = pl;
  G.tally = [['ROCKETS LEFT', p.rkts, 100], ['HELLFIRES LEFT', p.hfs, 500], ['ARMOR', Math.max(0, p.armor), 1000], ['LIVES', G.lives, 2000]];
  G.tally.done = false; G.gsT = 70; setMode('clear'); sfx.clear();
}

// the attract-mode pilot: lines up on the nearest threat, dodges, and uses every weapon
function autopilot() {
  const p = pl, o = { x: 0, y: 0, gun: true, rkt: false, hf: false };
  if (!p.alive || p.enter) return o;
  let ty = 92, near = null, nd = 1e9;
  for (const e of EN) { if (e.dead || e.dying > 0 || e.x < p.x + 80 || e.x > W) continue; if (e.x < nd) { nd = e.x; near = e; } }
  if (near) {
    const dx = near.x - p.x;
    if (near.ground) { ty = LANE - 96; o.rkt = dx > 110 && dx < 280 && G.frame % 34 < 3; o.hf = G.frame % 100 === 10 && dx < 330; }
    else ty = near.y + near.h / 2 - 38;
  }
  if (G.boss) { ty = 74 + Math.sin(G.t * 1.2) * 42; o.hf = G.frame % 75 === 0; o.rkt = G.frame % 44 < 3; }
  for (const b of EB) { const dx = b.x - (p.x + 62), dy = b.y - (p.y + 25); if (dx > -30 && dx < 120 && Math.abs(dy) < 32) ty += dy > 0 ? -50 : 50; }
  ty = clamp(ty, 24, LANE - 64);
  o.x = clamp((78 - p.x) / 24, -1, 1); o.y = clamp((ty - p.y) / 16, -1, 1);
  return o;
}

// ───────────────────────── input
const keys = Object.create(null);
const KEYMAP = {
  ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
  KeyZ: 'gun', KeyJ: 'gun', Space: 'gun', KeyX: 'rkt', KeyK: 'rkt', KeyC: 'hf', KeyL: 'hf',
  Enter: 'start', Digit1: 'start', Digit5: 'coin'
};
const TOUCH = { on: false, x: 0, y: 0, stick: false, rkt: false, hf: false, id: null };
function readInput() {
  let x = (keys.R ? 1 : 0) - (keys.L ? 1 : 0), y = (keys.D ? 1 : 0) - (keys.U ? 1 : 0);
  let gun = !!keys.gun, rkt = !!keys.rkt, hf = !!keys.hf;
  if (TOUCH.on) { x += TOUCH.x; y += TOUCH.y; gun = gun || TOUCH.stick; rkt = rkt || TOUCH.rkt; hf = hf || TOUCH.hf; }
  try {
    const gp = navigator.getGamepads && navigator.getGamepads()[0];
    if (gp) {
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      if (Math.abs(gp.axes[0]) > 0.25) x += gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.25) y += gp.axes[1];
      x += (b(15) ? 1 : 0) - (b(14) ? 1 : 0); y += (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
      gun = gun || b(0) || b(7); rkt = rkt || b(2) || b(1); hf = hf || b(3) || b(5);
    }
  } catch (e) { /* gamepad API unavailable */ }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  return { x, y, gun, rkt, hf };
}
function insertCoin() {
  audioInit();
  if (G.mode === 'continue') { doContinue(); return; }
  if (G.mode === 'play' && G.demo) exitDemo();
  if (G.mode === 'scores') setMode('title');
  G.credits = Math.min(99, G.credits + 1); G.lock = 0.9; G.mt = 0; sfx.coin();
}
function exitDemo() { G.demo = false; music(null); clearWorld(); pl = newPlayer(); setMode('title'); }
function doContinue() {
  G.credits = Math.max(0, G.credits - 1); G.lives = 3; respawn(); setMode('play'); sfx.coin();
  music(G.boss ? 'boss' : 'stage');
}
function onPress(a, code, key) {
  if (code === 'KeyM') { setMuted(!AU.muted); return; }
  switch (G.mode) {
    case 'title': case 'scores':
      if (G.lock > 0) return;
      if (G.credits === 0 || a === 'coin') insertCoin();
      else { G.credits--; sfx.start(); startGame(false); }
      break;
    case 'play':
      if (G.demo) { exitDemo(); insertCoin(); }
      else if (code === 'KeyP' || code === 'Escape') togglePause();
      break;
    case 'continue': if (G.mt > 0.6) doContinue(); break;
    case 'entry': entryKey(a, code, key); break;
  }
}
function togglePause() {
  G.paused = !G.paused;
  if (AU.ctx) { if (G.paused) AU.ctx.suspend(); else AU.ctx.resume(); }
}
function entryKey(a, code, key) {
  const en = G.entry; if (!en) return;
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
  const step = (d) => { const i = ABC.indexOf(en.name[en.i]); en.name[en.i] = ABC[(i + d + ABC.length) % ABC.length]; sfx.tick(); };
  const next = () => { sfx.pickup(); if (++en.i >= 3) finishEntry(); };
  if (key && key.length === 1 && ABC.includes(key.toUpperCase())) { en.name[en.i] = key.toUpperCase(); next(); }
  else if (code === 'ArrowUp') step(1);
  else if (code === 'ArrowDown') step(-1);
  else if (code === 'ArrowLeft' || code === 'Backspace') en.i = Math.max(0, en.i - 1);
  else if (code === 'ArrowRight' || code === 'Enter' || code === 'Space' || a === 'tap') next();
}
function finishEntry() {
  SCORES.push([G.entry.name.join(''), G.score]); SCORES.sort((x, y) => y[1] - x[1]); SCORES.length = Math.min(5, SCORES.length);
  try { localStorage.setItem('vaporstrike.scores.v1', JSON.stringify(SCORES)); } catch (e) { /* ignore */ }
  G.hi = SCORES[0][1]; G.entry = null; clearWorld(); pl = newPlayer(); setMode('scores');
}
const DEF_SCORES = [['BRN', 60800], ['DQN', 49200], ['GPT', 30000], ['RAG', 20000], ['RLS', 10000]];
let SCORES = DEF_SCORES.map((a) => a.slice());
try {
  const s = JSON.parse(localStorage.getItem('vaporstrike.scores.v1'));
  if (Array.isArray(s) && s.length && s.every((r) => Array.isArray(r) && typeof r[1] === 'number')) SCORES = s.slice(0, 5);
} catch (e) { /* keep defaults */ }

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (a || ['KeyP', 'KeyM', 'Backspace'].includes(e.code)) e.preventDefault();
    audioInit();
    if (e.repeat) return;
    if (a) keys[a] = true;
    onPress(a, e.code, e.key);
  });
  window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) keys[a] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.focus(); audioInit(); onPress(G.mode === 'entry' ? 'tap' : undefined, '', ''); });
  document.getElementById('coin').addEventListener('click', () => { insertCoin(); cv.focus(); });
  document.getElementById('mute').addEventListener('click', () => { audioInit(); setMuted(!AU.muted); });
  document.getElementById('full').addEventListener('click', () => {
    const b = document.getElementById('bezel');
    if (document.fullscreenElement) document.exitFullscreen(); else if (b.requestFullscreen) b.requestFullscreen();
  });
  setMuted(AU.muted);
  // touch: left stick flies (and holds the trigger), two buttons for rockets and Hellfire
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    TOUCH.on = true; document.getElementById('touch').hidden = false;
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    const move = (e) => {
      const r = stick.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const m = Math.max(1, Math.hypot(dx, dy)); const py = TOUCH.y; TOUCH.x = dx / m; TOUCH.y = dy / m;
      knob.style.transform = `translate(calc(-50% + ${TOUCH.x * 34}%), calc(-50% + ${TOUCH.y * 34}%))`;
      if (G.mode === 'entry') { if (py > -0.6 && TOUCH.y <= -0.6) entryKey('', 'ArrowUp'); if (py < 0.6 && TOUCH.y >= 0.6) entryKey('', 'ArrowDown'); }
    };
    const end = () => { TOUCH.x = TOUCH.y = 0; TOUCH.stick = false; knob.style.transform = 'translate(-50%, -50%)'; };
    stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stick.setPointerCapture(e.pointerId); TOUCH.stick = true; audioInit(); move(e); });
    stick.addEventListener('pointermove', (e) => { if (TOUCH.stick) move(e); });
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    for (const [id, k] of [['tb-rk', 'rkt'], ['tb-hf', 'hf']]) {
      const b = document.getElementById(id);
      const set = (v) => (e) => { e.preventDefault(); TOUCH[k] = v; b.classList.toggle('on', v); if (v) { audioInit(); if (G.mode !== 'play' || G.demo) onPress(G.mode === 'entry' ? 'tap' : undefined, '', ''); } };
      b.addEventListener('pointerdown', set(true)); b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false)); b.addEventListener('pointerleave', set(false));
    }
  }
}

// ───────────────────────── update
function update(dt) {
  G.t += dt; G.mt += dt; G.frame++;
  if (G.lock > 0) G.lock -= dt;
  G.shake = Math.max(0, G.shake - dt * 18); G.flash = Math.max(0, G.flash - dt * 3);
  switch (G.mode) {
    case 'title':
      G.scroll += 22 * dt; updFX(dt);
      pl.x += (64 - pl.x) * Math.min(1, dt * 2); pl.y = 148 + Math.sin(G.t * 1.4) * 6; pl.tilt = 0.03; pl.aim = 0.1; pl.inv = 0; pl.enter = false;
      if (G.mt > 10 && G.credits === 0) startGame(true);
      break;
    case 'scores':
      G.scroll += 22 * dt; if (G.mt > 7) { pl = newPlayer(); setMode('title'); }
      break;
    case 'play': {
      const inp = (G.demo || G.bot) ? autopilot() : readInput();     // VS.G.bot = true lets the attract pilot fly a real run
      G.gs += (G.gsT - G.gs) * Math.min(1, dt * 1.5); G.scroll += G.gs * dt; G.stageT += dt;
      while (G.si < G.script.length && G.script[G.si].t <= G.stageT) runEvent(G.script[G.si++]);
      if (G.msg && (G.msg.t -= dt) <= 0) G.msg = null;
      if (G.warn > 0) G.warn -= dt;
      updPlayer(dt, inp); updEnemies(dt); updPB(dt); updEB(dt); updPK(dt); updFX(dt); collide();
      if (G.mode !== 'play') break;                      // boss died this tick
      if (!pl.alive) {
        pl.dt += dt;
        if (pl.dt > 1.6) {
          if (G.lives > 0) respawn();
          else { music(null); G.cont = 9; setMode('continue'); sfx.over(); }
        }
      }
      if (G.demo && G.mt > 26 && SHOT === null) { G.demo = false; clearWorld(); pl = newPlayer(); setMode('scores'); }
      break;
    }
    case 'clear': {
      G.gs += (G.gsT - G.gs) * Math.min(1, dt * 1.5); G.scroll += G.gs * dt;
      updFX(dt); updPB(dt);
      if (pl.alive) { pl.vx += (G.mt > 4.5 ? 260 : 0 - pl.vx) * Math.min(1, dt * 2); pl.x += pl.vx * dt; pl.tilt += ((G.mt > 4.5 ? 0.1 : 0) - pl.tilt) * Math.min(1, dt * 4); if (pl.inv > 0) pl.inv -= dt; }
      if (G.mt > 4.2 && !G.tally.done) { G.tally.done = true; for (const r of G.tally) G.score += r[1] * r[2]; sfx.pickup(); }
      if (G.mt > 8) {
        if (G.demo) { G.demo = false; clearWorld(); pl = newPlayer(); setMode('scores'); }
        else { G.loop++; G.diff = 1 + (G.loop - 1) * 0.4; const keep = pl; beginStage(); pl.rounds = Math.max(keep.rounds, 800); pl.rkts = Math.max(keep.rkts, 26); pl.hfs = Math.max(keep.hfs, 6); pl.armor = 3; }
      }
      break;
    }
    case 'continue': {
      updFX(dt);
      const left = 9 - Math.floor(G.mt);
      if (left !== G.cont && left >= 0) { G.cont = left; sfx.tick(); }
      if (G.mt >= 10) setMode('gameover');
      break;
    }
    case 'gameover':
      updFX(dt);
      if (G.mt > 3) {
        if (G.score > SCORES[SCORES.length - 1][1] || SCORES.length < 5) { G.entry = { name: ['A', 'A', 'A'], i: 0 }; setMode('entry'); }
        else { clearWorld(); pl = newPlayer(); setMode('scores'); }
      }
      break;
    case 'entry': if (G.mt > 45) finishEntry(); break;
  }
}

// ───────────────────────── draw
function rotor(hx, hy, len, col) {
  const ph = Math.floor(G.t * 30) % 3; ctx.fillStyle = col;
  if (ph === 0) ctx.fillRect(hx - len, hy, len * 2, 1);
  else if (ph === 1) ctx.fillRect(hx - Math.round(len * 0.62), hy, Math.round(len * 1.24), 1);
  else { ctx.fillRect(hx - len, hy, Math.round(len * 0.42), 1); ctx.fillRect(hx + Math.round(len * 0.58), hy, Math.round(len * 0.42), 1); }
}
function drawEnemies() {
  for (const ground of [true, false]) for (const e of EN) {
    if (e.dead || e.ground !== ground) continue;
    const s = SPR[e.type], x = Math.round(e.x), y = Math.round(e.y);
    ctx.drawImage(s.img, x, y);
    if (e.flash > 0) { ctx.globalAlpha = 0.6; ctx.drawImage(s.white, x, y); ctx.globalAlpha = 1; }
    if (e.type === 'heli') { rotor(x + 41, y + 4, 40, 'rgba(255,190,150,0.75)'); ctx.fillStyle = 'rgba(255,190,150,0.7)'; if (Math.floor(G.t * 30) % 2) ctx.fillRect(x + 88, y + 3, 1, 12); else ctx.fillRect(x + 83, y + 9, 11, 1); }
    else if (e.type === 'jet') disc(x + 59 + (G.frame % 2), y + 12, 1 + (G.frame % 2), G.frame % 2 ? C.yellow : C.pink);
    else if (e.type === 'boss' && !(e.dying > 0)) { ctx.globalAlpha = 0.3 + 0.25 * Math.sin(G.t * 9); disc(x + 128, y + 64, 7, '#fff'); ctx.globalAlpha = 1; }
  }
}
function drawPlayer() {
  const p = pl; if (!p || !p.alive) return;
  if (p.inv > 0 && !p.enter && Math.floor(G.t * 18) % 2 === 0) return;
  const s = SPR.apache;
  ctx.save(); ctx.translate(Math.round(p.x + 58), Math.round(p.y + 24)); ctx.rotate(p.tilt);
  ctx.drawImage(p.hit > 0 ? s.white : s.img, -58, -24);
  ctx.save(); ctx.translate(42, 15); ctx.rotate(p.aim - p.tilt);            // the slewing M230 barrel
  ctx.fillStyle = '#211c36'; ctx.fillRect(-1, -1, 14, 3);
  ctx.fillStyle = '#8f88b4'; ctx.fillRect(0, -1, 12, 1);
  ctx.fillStyle = '#141024'; ctx.fillRect(10, -2, 4, 5);
  if (p.muzzle > 0) { disc(17, 0, 3, '#fff'); ctx.fillStyle = C.yellow; ctx.fillRect(19, -1, 6, 2); ctx.fillRect(16, -5, 2, 10); }
  ctx.restore();
  rotor(12, -14, 62, 'rgba(201,184,255,0.8)');
  ctx.fillStyle = 'rgba(201,184,255,0.75)';
  if (Math.floor(G.t * 30) % 2) ctx.fillRect(-50, -19, 1, 15); else ctx.fillRect(-56, -12, 13, 1);
  ctx.restore();
}
function drawShots() {
  for (const b of PB) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.k === 'b') {
      const a = Math.atan2(b.vy, b.vx); ctx.strokeStyle = C.yellow; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(b.x, b.y + 0.5); ctx.lineTo(b.x - Math.cos(a) * 8, b.y + 0.5 - Math.sin(a) * 8); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 1);
    } else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(b.vy, b.vx));
      if (b.k === 'r') { ctx.fillStyle = '#d8d0f0'; ctx.fillRect(-8, -1, 9, 2); ctx.fillStyle = '#fff'; ctx.fillRect(0, -1, 2, 2); ctx.fillStyle = G.frame % 2 ? C.yellow : C.orange; ctx.fillRect(-12, -1, 4, 2); }
      else { ctx.fillStyle = '#2c2644'; ctx.fillRect(-10, -1, 12, 3); ctx.fillStyle = C.lav; ctx.fillRect(1, -1, 2, 3); ctx.fillRect(-9, -3, 2, 7); ctx.fillStyle = G.frame % 2 ? '#fff' : C.yellow; if (b.t >= 0.2) ctx.fillRect(-15, -1, 5, 3); }
      ctx.restore();
    }
  }
  for (const b of EB) {
    if (b.k === 'm') {
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#a0281e'; ctx.fillRect(-6, -1, 10, 3); ctx.fillStyle = '#ffd0c0'; ctx.fillRect(3, -1, 2, 3); ctx.fillStyle = G.frame % 2 ? C.pink : C.yellow; ctx.fillRect(-10, -1, 4, 3);
      ctx.restore();
    } else if (b.k === 's') { disc(b.x, b.y, b.r + 1, C.orange); disc(b.x, b.y, b.r - 1, C.yellow); }
    else { disc(b.x, b.y, b.r + 1, C.pink); disc(b.x, b.y, b.r - 1, '#fff'); }
  }
}
function drawFX() {
  for (const f of FX) {
    if (f.delay > 0) continue;
    const u = f.life / f.max;
    if (f.k === 'fire') disc(f.x, f.y, f.r * (1 - u * 0.55), u < 0.15 ? '#fff' : u < 0.35 ? C.yellow : u < 0.55 ? C.orange : u < 0.78 ? C.pink : '#6a1b6e');
    else if (f.k === 'smoke') { ctx.globalAlpha = 0.6 * (1 - u); disc(f.x, f.y, f.r * (0.6 + u), u < 0.35 ? '#8679ad' : '#463c6b'); ctx.globalAlpha = 1; }
    else if (f.k === 'spark') { ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s); }
    else if (f.k === 'casing') { ctx.fillStyle = '#e0c868'; ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 1); }
    else if (f.k === 'flash') disc(f.x, f.y, f.r * (1 - u * 0.5), u < 0.5 ? '#fff' : C.yellow);
    else if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,251,150,${(1 - u).toFixed(2)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(f.x), Math.round(f.y), f.r, 0, TAU); ctx.stroke(); }
  }
  for (const p of POP) textO(p.s, p.x, p.y, p.c, 'center');
}
function drawPickups() {
  const COL = { R: C.orange, H: C.pinkL, A: C.mint, G: C.cyan };
  for (const k of PK) {
    const x = Math.round(k.x), y = Math.round(k.y), c = COL[k.k];
    ctx.fillStyle = C.bg; ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = Math.floor(G.t * 6) % 2 ? c : '#fff'; ctx.fillRect(x - 8, y - 8, 16, 1); ctx.fillRect(x - 8, y + 7, 16, 1); ctx.fillRect(x - 8, y - 8, 1, 16); ctx.fillRect(x + 7, y - 8, 1, 16);
    text(k.k === 'G' ? '3' : k.k, x - 3, y - 4, c);
  }
}
function drawLock() {
  const p = pl; if (!p || !p.alive || p.hfs <= 0 || p.enter) return;
  const e = hfTarget(); if (!e) return;
  const [x, y] = aimPoint(e), r = 9 + Math.round(Math.sin(G.t * 10)), col = C.mint;
  ctx.fillStyle = col;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(Math.round(x + sx * r) - (sx > 0 ? 3 : 0), Math.round(y + sy * r), 4, 1); ctx.fillRect(Math.round(x + sx * r), Math.round(y + sy * r) - (sy > 0 ? 3 : 0), 1, 4); }
}
function drawHUD() {
  text('1UP', 8, 6, C.pink); text(pad(G.score), 38, 6, C.white);
  text('HI', 184, 6, C.cyan); text(pad(Math.max(G.hi, G.score)), 206, 6, C.white);
  text('CREDIT ' + pad(G.credits, 2), W - 8, 6, C.yellow, 'right');
  const world = G.mode === 'play' || G.mode === 'clear' || G.mode === 'continue' || G.mode === 'gameover';
  if (!world || !pl) return;
  ctx.fillStyle = 'rgba(13,2,33,0.72)'; ctx.fillRect(0, H - 16, W, 16);
  ctx.fillStyle = C.purple; ctx.fillRect(0, H - 16, W, 1);
  const y = H - 11;
  text('30MM', 8, y, C.cyan); text(pad(pl.rounds, 4), 44, y, pl.rounds ? C.white : C.red);
  text('RKT', 88, y, C.orange); text(pad(pl.rkts, 2), 116, y, pl.rkts ? C.white : C.red);
  text('HF', 144, y, C.pinkL); text(String(pl.hfs), 164, y, pl.hfs ? C.white : C.red);
  text('ARMOR', 288, y, C.lav);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < pl.armor ? C.mint : '#3b2a5c'; ctx.fillRect(332 + i * 9, y, 7, 7); }
  text('LIVES ' + Math.max(0, G.lives), W - 8, y, C.yellow, 'right');
  const b = G.boss;
  if (b && !b.dead) {
    textO('IRON TIDE', W / 2, 20, C.red, 'center');
    ctx.fillStyle = C.bg; ctx.fillRect(139, 31, 202, 7); ctx.fillStyle = C.dim; ctx.fillRect(140, 32, 200, 5);
    ctx.fillStyle = b.hp / b.max < 0.25 ? C.red : C.pink; ctx.fillRect(140, 32, Math.round(200 * clamp(b.hp / b.max, 0, 1)), 5);
  }
}
function drawOverlay() {
  const blink = Math.floor(G.t * 2.2) % 2 === 0, cx = W / 2;
  switch (G.mode) {
    case 'title':
      logo('VAPOR STRIKE', cx, 44, 32);
      textO('A BUILDINGBRIAN ARCADE GAME', cx, 90, C.cyan, 'center');
      if (blink) textO(G.credits ? 'PRESS START' : 'INSERT COIN', cx, 122, C.yellow, 'center', 16);
      textO('ARROWS FLY   Z 30MM   X ROCKETS   C HELLFIRE', cx, 214, C.lav, 'center');
      textO('(C) 2026 BUILDINGBRIAN ENT.', cx, 232, C.dim, 'center');
      break;
    case 'scores':
      logo('BEST PILOTS', cx, 30, 16);
      SCORES.forEach((r, i) => {
        const y = 70 + i * 24, c = i === 0 ? C.yellow : i % 2 ? C.white : C.pinkL;
        textO(['1ST', '2ND', '3RD', '4TH', '5TH'][i], 128, y, c); textO(r[0], 208, y, c); textO(pad(r[1]), 352, y, c, 'right');
      });
      if (blink) textO(G.credits ? 'PRESS START' : 'INSERT COIN', cx, 212, C.yellow, 'center', 16);
      break;
    case 'play':
      if (G.demo) { textO('DEMO PLAY', cx, G.boss ? 44 : 24, C.pinkL, 'center'); if (blink) textO('INSERT COIN', cx, 206, C.yellow, 'center', 16); }
      if (G.msg) { logo(G.msg.a, cx, 96, 16); textO(G.msg.b, cx, 124, C.cyan, 'center'); }
      if (G.warn > 0 && Math.floor(G.t * 5) % 2 === 0) { textO('WARNING', cx, 96, C.red, 'center', 16); textO('IRON TIDE APPROACHING', cx, 122, C.yellow, 'center'); }
      if (G.paused) { ctx.fillStyle = 'rgba(13,2,33,0.6)'; ctx.fillRect(0, 0, W, H); logo('PAUSED', cx, 110, 32); textO('P TO RESUME', cx, 156, C.lav, 'center'); }
      break;
    case 'clear':
      ctx.fillStyle = 'rgba(13,2,33,0.78)'; ctx.fillRect(100, 72, 280, 142); ctx.fillStyle = C.purple; ctx.fillRect(100, 72, 280, 1); ctx.fillRect(100, 213, 280, 1);
      logo('MISSION COMPLETE', cx, 40, 16);
      G.tally.forEach((r, i) => {
        if (G.mt < 1.2 + i * 0.6) return;
        const y = 82 + i * 20; textO(r[0], 120, y, C.lav); textO(r[1] + ' X ' + r[2], 360, y, C.yellow, 'right');
      });
      if (G.mt > 4.2) textO('BONUS ' + pad(G.tally.reduce((s, r) => s + r[1] * r[2], 0)), cx, 172, C.mint, 'center');
      if (G.mt > 5.5) textO('NEXT: MISSION ' + (G.loop + 1), cx, 196, C.cyan, 'center');
      break;
    case 'continue':
      ctx.fillStyle = 'rgba(13,2,33,0.55)'; ctx.fillRect(0, 0, W, H);
      logo('CONTINUE?', cx, 70, 32); textO(String(G.cont), cx, 122, C.yellow, 'center', 16);
      if (blink) textO('INSERT COIN', cx, 160, C.pinkL, 'center', 16);
      break;
    case 'gameover':
      ctx.fillStyle = 'rgba(13,2,33,0.6)'; ctx.fillRect(0, 0, W, H);
      logo('GAME OVER', cx, 96, 32); textO('THANK YOU FOR PLAYING', cx, 148, C.lav, 'center');
      break;
    case 'entry': {
      ctx.fillStyle = 'rgba(13,2,33,0.72)'; ctx.fillRect(0, 0, W, H);
      logo('NEW HIGH SCORE', cx, 40, 16); textO(pad(G.score), cx, 72, C.yellow, 'center', 16);
      textO('ENTER YOUR INITIALS', cx, 104, C.cyan, 'center');
      G.entry.name.forEach((ch, i) => {
        const x = cx - 48 + i * 48; logo(ch, x, 128, 32);
        if (i === G.entry.i && blink) { ctx.fillStyle = C.yellow; ctx.fillRect(x - 16, 168, 32, 3); }
      });
      textO('TYPE, OR USE ARROWS AND ENTER', cx, 196, C.lav, 'center');
      break;
    }
  }
}
function render() {
  const world = G.mode !== 'scores' && G.mode !== 'entry';
  ctx.save();
  if (G.shake > 0.3) ctx.translate(Math.round(Math.sin(G.frame * 12.9898) * G.shake), Math.round(Math.cos(G.frame * 78.233) * G.shake));
  drawBackdrop(G.scroll, G.t);
  if (world) { drawEnemies(); drawPickups(); drawPlayer(); drawShots(); drawFX(); if (G.mode === 'play') drawLock(); }
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, G.flash).toFixed(2)})`; ctx.fillRect(0, 0, W, H); }
  drawHUD(); drawOverlay();
}

// ───────────────────────── boot
let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000, d = Math.min(0.1, now - last); last = now;
  if (!G.paused && !document.hidden) {
    acc += d; let n = 0;
    while (acc >= 1 / 60 && n < 5) { update(1 / 60); acc -= 1 / 60; n++; }
    if (n === 5) acc = 0;
  }
  render();
}
function boot() {
  loadSprites(); buildBackdrop(); reseed(1995);
  G.hi = SCORES[0][1]; pl = newPlayer(); setMode('title');
  if (qs.has('bare')) document.body.classList.add('bare');
  if (SHOT !== null) {           // deterministic single frame for screenshots: ?shot=12.5&scene=demo|boss|title|scores
    const run = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) update(1 / 60); };
    if (SCENE === 'scores') setMode('scores');
    else if (SCENE !== 'title') {
      startGame(true);
      if (SCENE === 'boss') { G.stageT = 74; while (G.si < G.script.length && G.script[G.si].t < 74) G.si++; }
      if (['clear', 'continue', 'gameover', 'entry'].includes(SCENE)) {
        run(16); G.score = 20950;
        if (SCENE === 'clear') missionClear();
        else if (SCENE === 'continue') { pl.alive = false; G.lives = 0; setMode('continue'); }
        else if (SCENE === 'gameover') { pl.alive = false; G.lives = 0; setMode('gameover'); }
        else { G.entry = { name: ['B', 'R', 'N'], i: 2 }; setMode('entry'); }
      }
    }
    run(SHOT); render(); document.title = 'VS-READY';
    return;
  }
  bindInput();
  document.addEventListener('visibilitychange', () => { if (document.hidden) for (const k in keys) keys[k] = false; });
  requestAnimationFrame((t) => { last = t / 1000; frame(t); });
}
window.VS = { G, get player() { return pl; }, EN, EB, PB, PK, startGame, insertCoin, onPress, hurt, damage, update, render };     // handy in the console
const fontReady = document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"').catch(() => {}) : Promise.resolve();
const pageReady = new Promise((res) => { if (document.readyState === 'complete') res(); else window.addEventListener('load', res); });
Promise.all([fontReady, pageReady]).then(boot);
})();
