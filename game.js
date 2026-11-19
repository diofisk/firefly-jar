// Firefly Jar: catch the fireflies before dawn.
// A firefly drifts, glows on and off, and is worth 1 point (dim) or 3 (bright, faster).
// One night lasts 60 seconds. The best score is kept in localStorage.

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
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
const CATCH_RADIUS = 18;

let fireflies = [];
let caught = 0;
let timeLeft = NIGHT_SECONDS;
let playing = false;
let last = 0;
let best = Number(localStorage.getItem('firefly-best') || 0);
ui.best.textContent = best;

function spawn() {
  const bright = Math.random() < 0.25;
  return {
    x: Math.random() * canvas.width,
    y: 40 + Math.random() * (canvas.height - 80),
    vx: (Math.random() - 0.5) * (bright ? 90 : 45),
    vy: (Math.random() - 0.5) * (bright ? 90 : 45),
    phase: Math.random() * Math.PI * 2,
    bright,
  };
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) return endNight();
  while (fireflies.length < MAX_FIREFLIES) fireflies.push(spawn());
  for (const f of fireflies) {
    f.phase += dt * (f.bright ? 5 : 3);
    f.vx += (Math.random() - 0.5) * 40 * dt;
    f.vy += (Math.random() - 0.5) * 40 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < 0 || f.x > canvas.width) f.vx *= -1;
    if (f.y < 20 || f.y > canvas.height - 20) f.vy *= -1;
  }
  ui.time.textContent = Math.ceil(timeLeft);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // The sky gets lighter as dawn comes.
  const dawn = 1 - timeLeft / NIGHT_SECONDS;
  ctx.fillStyle = `rgba(255, 190, 120, ${dawn * 0.18})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const f of fireflies) {
    const glow = (Math.sin(f.phase) + 1) / 2;
    const r = f.bright ? 7 : 5;
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 4);
    g.addColorStop(0, `rgba(255, 230, 120, ${0.25 + glow * 0.75})`);
    g.addColorStop(1, 'rgba(255, 230, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
}

canvas.addEventListener('click', (e) => {
  if (!playing) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = fireflies.findIndex((f) => Math.hypot(f.x - x, f.y - y) < CATCH_RADIUS);
  if (i === -1) return;
  caught += fireflies[i].bright ? 3 : 1;
  fireflies.splice(i, 1);
  ui.caught.textContent = caught;
});

function startNight() {
  fireflies = [];
  caught = 0;
  timeLeft = NIGHT_SECONDS;
  ui.caught.textContent = 0;
  ui.overlay.classList.add('hidden');
  playing = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

function endNight() {
  playing = false;
  if (caught > best) {
    best = caught;
    localStorage.setItem('firefly-best', String(best));
    ui.best.textContent = best;
  }
  ui.title.textContent = 'Dawn';
  ui.text.textContent = `You caught ${caught} fireflies.`;
  ui.start.textContent = 'Play again';
  ui.overlay.classList.remove('hidden');
}

ui.start.addEventListener('click', startNight);
