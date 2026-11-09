// Tiny synthesized sound effects (no files to download).
let ctx = null, muted = false, hushed = false;
try { muted = localStorage.getItem('pm-muted') === '1'; } catch {}

export const isMuted = () => muted;
// Silence everything for a moment, e.g. while a phone catches up on an online game.
export const hush = (v) => { hushed = v; };
export function setMuted(m) { muted = m; try { localStorage.setItem('pm-muted', m ? '1' : '0'); } catch {} }
export function unlock() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, delay = 0, slide = 0) {
  if (muted || hushed || !ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur = 0.05, vol = 0.12, delay = 0, hp = 1800) {
  if (muted || hushed || !ctx) return;
  const t = ctx.currentTime + delay, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(ctx.destination); s.start(t);
}

export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.08),
  dice: () => { for (let i = 0; i < 7; i++) noise(0.035, 0.16, i * 0.07 + Math.random() * 0.03, 2500); },
  land: () => { noise(0.06, 0.12, 0, 900); tone(180, 0.12, 'sine', 0.12); },
  hop: (k) => tone(420 + (k % 4) * 60, 0.07, 'triangle', 0.07),
  coin: () => { tone(988, 0.09, 'square', 0.06); tone(1319, 0.22, 'square', 0.06, 0.08); },
  pay: () => { tone(520, 0.1, 'triangle', 0.1); tone(392, 0.16, 'triangle', 0.1, 0.09); },
  buy: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.11, i * 0.07)); },
  build: () => { tone(300, 0.08, 'square', 0.06); tone(450, 0.1, 'square', 0.06, 0.06); },
  horn: () => { tone(392, 0.22, 'square', 0.07); tone(494, 0.22, 'square', 0.05); tone(392, 0.25, 'square', 0.07, 0.28); tone(494, 0.25, 'square', 0.05, 0.28); },
  card: () => { noise(0.12, 0.08, 0, 3000); tone(880, 0.12, 'sine', 0.08, 0.06, 1.5); },
  good: () => { [659, 784, 988].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.08)); },
  bad: () => { tone(330, 0.18, 'sawtooth', 0.06, 0, 0.7); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.11)); },
  gavel: () => { noise(0.05, 0.2, 0, 600); tone(150, 0.1, 'sine', 0.2); },
};
