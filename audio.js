// Effets sonores synthétisés avec WebAudio (aucun fichier externe)
let ctx = null, master = null, noiseBuf = null;
let muted = localStorage.getItem('rts-mute') === '1';
const last = {};
export function unlock() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination); } catch { return; } }
  if (ctx.state === 'suspended') ctx.resume();
}
function tone(f, d, type = 'square', v = 0.08, f2 = null, delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
}
function noise(d, v = 0.1, freq = 1000, q = 1, delay = 0, type = 'bandpass') {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
}
const S = {
  click: () => tone(660, 0.05, 'square', 0.03),
  select: () => tone(520, 0.08, 'triangle', 0.06, 780),
  ok: () => tone(440, 0.09, 'triangle', 0.06, 660),
  attack: () => { tone(220, 0.14, 'sawtooth', 0.05, 150); noise(0.1, 0.05, 1500, 2); },
  error: () => tone(160, 0.16, 'square', 0.05, 110),
  hit: () => { noise(0.07, 0.12, 2600, 3); tone(900 + Math.random() * 400, 0.05, 'square', 0.02); },
  arrow: () => noise(0.14, 0.05, 3500, 1, 0, 'highpass'),
  catapult: () => { tone(90, 0.3, 'sine', 0.12, 50); noise(0.35, 0.12, 300, 1); },
  ram: () => { tone(70, 0.25, 'sine', 0.2, 40); noise(0.2, 0.12, 220, 1); },
  die: () => tone(320, 0.3, 'sawtooth', 0.035, 90),
  collapse: () => { noise(0.9, 0.2, 160, 0.7); tone(60, 0.8, 'sine', 0.12, 30); },
  chop: () => { noise(0.05, 0.08, 1100, 4); tone(240, 0.04, 'triangle', 0.03); },
  mine: () => tone(1700, 0.07, 'square', 0.025, 1300),
  gather: () => noise(0.06, 0.04, 900, 1),
  build: () => { noise(0.04, 0.09, 700, 5); tone(180, 0.05, 'triangle', 0.03); },
  place: () => { tone(330, 0.1, 'triangle', 0.07); tone(440, 0.12, 'triangle', 0.07, null, 0.08); },
  done: () => [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.06, null, i * 0.09)),
  trained: () => { tone(392, 0.1, 'triangle', 0.06); tone(523, 0.14, 'triangle', 0.06, null, 0.1); },
  age: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.045, null, i * 0.14)),
  horn: () => { tone(147, 1.0, 'sawtooth', 0.07, 140); tone(220, 1.0, 'sawtooth', 0.04, 208); },
};
const GAP = { hit: 70, arrow: 70, chop: 150, mine: 150, gather: 150, build: 150, die: 100 };
export function play(name) {
  if (muted || !ctx || ctx.state !== 'running' || !S[name]) return;
  const now = performance.now(); if (now - (last[name] || 0) < (GAP[name] || 40)) return; last[name] = now;
  try { S[name](); } catch { }
}
export function toggleMute() { muted = !muted; localStorage.setItem('rts-mute', muted ? '1' : '0'); return muted; }
export const isMuted = () => muted;
