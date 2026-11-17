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
