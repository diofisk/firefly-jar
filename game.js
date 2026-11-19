// Firefly Jar: catch the fireflies before dawn.
// A firefly drifts, blinks on and off, and is worth 1 point (dim) or 3 (bright, faster).
// One night lasts 60 seconds. The best score is kept in localStorage.
// Ambient fireflies (not catchable) drift in the far meadow for depth, even between nights.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const ui = {
  caught: document.getElementById('caught'),
  time: document.getElementById('time'),
  best: document.getElementById('best'),
  overlay: document.getElementById('overlay'),
  title: document.getElementById('overlay-title'),
  text: document.getElementById('overlay-text'),
  start: document.getElementById('start'),
};

const NIGHT_SECONDS = 60;
const MAX_FIREFLIES = 14;
const AMBIENT_FIREFLIES = 28;
const CATCH_RADIUS = 22;

const background = new Image();
let backgroundReady = false;
background.onload = () => { backgroundReady = true; };
background.src = 'assets/meadow-night.png';

let fireflies = [];
let ambient = [];
let sparks = [];
let popups = [];
let caught = 0;
let timeLeft = NIGHT_SECONDS;
let playing = false;
let last = performance.now();

function readBest() {
  try { return Number(localStorage.getItem('firefly-best') || 0); } catch { return 0; }
}
function writeBest(v) {
  try { localStorage.setItem('firefly-best', String(v)); } catch { /* storage blocked */ }
}
let best = readBest();
ui.best.textContent = best;

const rand = (a, b) => a + Math.random() * (b - a);

// --- Fireflies -------------------------------------------------------------

function spawn(fromEdge = true) {
  const bright = Math.random() < 0.25;
  const speed = bright ? 90 : 45;
  let x = Math.random() * W;
  let y = rand(40, H - 90);
  // New fireflies drift in from the grass or the sides instead of popping into view.
  if (fromEdge) {
    const side = Math.floor(Math.random() * 3);
    if (side === 0) { x = -10; }
    else if (side === 1) { x = W + 10; }
    else { y = H - 30; }
  }
  return {
    x, y,
    vx: (Math.random() - 0.5) * speed + (x < 0 ? 25 : x > W ? -25 : 0),
    vy: (Math.random() - 0.5) * speed - (y > H - 60 ? 25 : 0),
    phase: Math.random() * Math.PI * 2,
    blinkRate: bright ? rand(1.4, 1.9) : rand(0.7, 1.1),
    wing: Math.random() * Math.PI * 2,
    angle: 0,
    bright,
    fade: fromEdge ? 0 : 1,
  };
}

function spawnAmbient() {
  return {
    x: Math.random() * W,
    y: rand(H * 0.6, H - 20),
    vx: rand(-8, 8),
    vy: rand(-5, 5),
    phase: Math.random() * Math.PI * 2,
    rate: rand(0.4, 0.9),
    size: rand(0.6, 1.6),
  };
}

// Real fireflies flash, then go dark for a while. This shapes a sine into a pulse.
function blink(phase) {
  const s = (Math.sin(phase) + 1) / 2;
  return Math.pow(s, 3);
}

function updateFirefly(f, dt) {
  f.phase += dt * f.blinkRate * Math.PI;
  f.wing += dt * 38;
  f.fade = Math.min(1, f.fade + dt * 1.5);
  f.vx += (Math.random() - 0.5) * 40 * dt;
  f.vy += (Math.random() - 0.5) * 40 * dt;
  const max = f.bright ? 110 : 60;
  const sp = Math.hypot(f.vx, f.vy);
  if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.x < 0 && f.vx < 0) f.vx *= -1;
  if (f.x > W && f.vx > 0) f.vx *= -1;
  if (f.y < 20 && f.vy < 0) f.vy *= -1;
  if (f.y > H - 30 && f.vy > 0) f.vy *= -1;
  // Turn smoothly toward the direction of travel.
  const target = Math.atan2(f.vy, f.vx);
  let d = target - f.angle;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  f.angle += d * Math.min(1, dt * 6);
}

function drawGlow(x, y, radius, alpha, color) {
  if (alpha <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${color}, ${alpha})`);
  g.addColorStop(0.35, `rgba(${color}, ${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawFirefly(f, scale = 1, alphaMul = 1) {
  const light = blink(f.phase);
  const s = (f.bright ? 1.6 : 1.3) * scale;
  const color = f.bright ? '255, 214, 90' : '200, 255, 120';
  const a = f.fade * alphaMul;

  // The halo is drawn unrotated, centred on the lantern at the tail.
  const tailX = f.x - Math.cos(f.angle) * 4 * s;
  const tailY = f.y - Math.sin(f.angle) * 4 * s;
  drawGlow(tailX, tailY, (f.bright ? 34 : 24) * s, (0.12 + light * 0.75) * a, color);

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle);
  ctx.scale(s, s);
  ctx.globalAlpha = a;

  // Wings: two translucent flapping ellipses above the body.
  const flap = 0.35 + Math.abs(Math.sin(f.wing)) * 0.65;
  ctx.fillStyle = 'rgba(200, 220, 255, 0.28)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-1, side * 3.2 * flap, 4.2, 2 * flap + 0.4, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body: head, thorax and the glowing abdomen at the back.
  ctx.fillStyle = '#1a1712';
  ctx.beginPath();
  ctx.ellipse(1.5, 0, 3.4, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4553a';
  ctx.beginPath();
  ctx.arc(4.6, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${color}, ${0.35 + light * 0.65})`;
  ctx.beginPath();
  ctx.ellipse(-3.6, 0, 2.8, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 230, ${light * 0.9})`;
  ctx.beginPath();
  ctx.ellipse(-4, 0, 1.3, 1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAmbient(a) {
  const light = blink(a.phase);
  drawGlow(a.x, a.y, 9 * a.size, 0.08 + light * 0.45, '210, 255, 140');
  ctx.fillStyle = `rgba(240, 255, 200, ${0.15 + light * 0.7})`;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 0.9 * a.size, 0, Math.PI * 2);
  ctx.fill();
}

function updateAmbient(dt) {
  while (ambient.length < AMBIENT_FIREFLIES) ambient.push(spawnAmbient());
  for (const a of ambient) {
    a.phase += dt * a.rate * Math.PI;
    a.vx += (Math.random() - 0.5) * 10 * dt;
    a.vy += (Math.random() - 0.5) * 10 * dt;
    a.vx = Math.max(-12, Math.min(12, a.vx));
    a.vy = Math.max(-8, Math.min(8, a.vy));
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.x < -10) a.x = W + 10;
    if (a.x > W + 10) a.x = -10;
    if ((a.y < H * 0.55 && a.vy < 0) || (a.y > H - 15 && a.vy > 0)) a.vy *= -1;
  }
}

// --- Catch effects ---------------------------------------------------------

function catchFirefly(f) {
  const points = f.bright ? 3 : 1;
  caught += points;
  ui.caught.textContent = caught;
  const color = f.bright ? '255, 214, 90' : '200, 255, 120';
  for (let i = 0; i < (f.bright ? 14 : 8); i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = rand(30, 110);
    sparks.push({ x: f.x, y: f.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: rand(0.4, 0.8), max: 0.8, color });
  }
  popups.push({ x: f.x, y: f.y - 12, text: `+${points}`, life: 0.9, color });
}

function updateEffects(dt) {
  for (const s of sparks) {
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 1 - dt * 3;
    s.vy *= 1 - dt * 3;
  }
  sparks = sparks.filter((s) => s.life > 0);
  for (const p of popups) { p.life -= dt; p.y -= 26 * dt; }
  popups = popups.filter((p) => p.life > 0);
}

function drawEffects() {
  for (const s of sparks) {
    ctx.fillStyle = `rgba(${s.color}, ${s.life / s.max})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.fillStyle = `rgba(${p.color}, ${Math.min(1, p.life * 1.5)})`;
    ctx.fillText(p.text, p.x, p.y);
  }
}

// --- Scene -----------------------------------------------------------------

function drawBackground() {
  if (backgroundReady) {
    // Cover-fit the image to the canvas.
    const scale = Math.max(W / background.width, H / background.height);
    const bw = background.width * scale;
    const bh = background.height * scale;
    ctx.drawImage(background, (W - bw) / 2, (H - bh) / 2, bw, bh);
  } else {
    const g = ctx.createRadialGradient(W / 2, H * 1.2, 0, W / 2, H * 1.2, H * 1.3);
    g.addColorStop(0, '#1c2a3a');
    g.addColorStop(1, '#0b1020');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // The sky gets lighter as dawn comes.
  const dawn = playing ? 1 - timeLeft / NIGHT_SECONDS : 0;
  if (dawn > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(120, 140, 200, ${dawn * 0.18})`);
    g.addColorStop(1, `rgba(255, 170, 110, ${dawn * 0.3})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) return endNight();
  while (fireflies.length < MAX_FIREFLIES) fireflies.push(spawn());
  for (const f of fireflies) updateFirefly(f, dt);
  ui.time.textContent = Math.ceil(timeLeft);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  for (const a of ambient) drawAmbient(a);
  for (const f of fireflies) drawFirefly(f);
  drawEffects();
}

// The loop always runs so the meadow stays alive behind the start and dawn screens.
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateAmbient(dt);
  updateEffects(dt);
  if (playing) update(dt);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', (e) => {
  if (!playing) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const y = ((e.clientY - rect.top) / rect.height) * H;
  let bestI = -1;
  let bestD = CATCH_RADIUS;
  fireflies.forEach((f, i) => {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bestD) { bestD = d; bestI = i; }
  });
  if (bestI === -1) return;
  catchFirefly(fireflies[bestI]);
  fireflies.splice(bestI, 1);
});

function startNight() {
  fireflies = Array.from({ length: MAX_FIREFLIES }, () => spawn(false));
  sparks = [];
  popups = [];
  caught = 0;
  timeLeft = NIGHT_SECONDS;
  ui.caught.textContent = 0;
  ui.time.textContent = NIGHT_SECONDS;
  ui.overlay.classList.add('hidden');
  playing = true;
}

function endNight() {
  playing = false;
  timeLeft = 0;
  if (caught > best) {
    best = caught;
    writeBest(best);
    ui.best.textContent = best;
  }
  ui.title.textContent = 'Dawn';
  ui.text.textContent = `You caught ${caught} fireflies.`;
  ui.start.textContent = 'Play again';
  ui.overlay.classList.remove('hidden');
}

ui.start.addEventListener('click', startNight);
requestAnimationFrame(loop);
