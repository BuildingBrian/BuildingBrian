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
