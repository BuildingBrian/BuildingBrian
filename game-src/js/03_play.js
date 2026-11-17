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
