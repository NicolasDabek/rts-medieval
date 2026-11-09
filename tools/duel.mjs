// Duels à coût égal, sans navigateur : utilise les vraies données (data.js) et règles (rules.js)
// node tools/duel.mjs [budget] [essais]
import { UNIT } from '../data.js';
import { computeDamage, rangeWith, shouldKite, costOf } from '../rules.js';
import { makeWave, pruneWave, waveSpeed, WAVE } from '../wave.js';

// presets d'améliorations (même valeur pour les deux camps), agrégés comme units.js
export const UPS = { none: null, age3: { atk: 2, arm: 2, projAtk: 0, range: 2 }, max: { atk: 4, arm: 4, projAtk: 1, range: 2 } };
export const ROSTER = ['epeiste', 'lancier', 'tirailleur', 'archer', 'cavalier', 'heros'];
const BODY = 0.6; // demi-largeur d'une unité : la portée se compte bord à bord

// PRNG déterministe (mulberry32) pour des résultats reproductibles
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Combat N contre N sur une ligne : déplacement vers l'ennemi le plus proche, tir quand à portée, recul (kiting) selon rules.js
export const spent = (type, budget) => { const c = costOf(UNIT[type]), n = Math.floor(budget / c), f = budget / c - n; return c * (n + (f > 0.01 ? f : 0)); };
// a / b : type d'unité (budget commun) ou composition [[type, budget], …] (ex. héros + escorte, voir ESCORT)
// wave : { leash, timeout, sides } (optionnel) — les camps listés (défaut : A) attaquent en vague groupée
// (wave.js, même règle que l'IA en jeu ; simulateur 1D : parité de politique, sans obstacles ni pathfinding)
export function fight(a, b, budget = 600, seed = 1, maxT = 180, up = null, wave = null) {
  if (typeof up === 'string') up = UPS[up];
  // le héros est unique en jeu : testé seul (1 héros) contre le même coût d'adversaires
  if (a === 'heros' || b === 'heros') budget = costOf(UNIT.heros);
  // n = floor(budget/coût) unités entières + une dernière unité dont les PV sont réduits au prorata du budget restant :
  // les deux camps dépensent exactement le même budget (écart < 1 %)
  const R = rng(seed), mkOne = (type, side, budget, out) => { const d = UNIT[type], c = costOf(d), n = Math.floor(budget / c), frac = budget / c - n;
    const add = f => { const hp = d.hp * f; out.push({ type, d, side, x: side ? 30 + R() * 3 + (R() * 2 - 1) : -R() * 3 + (R() * 2 - 1), hp, maxHp: hp, cdT: R() * d.cd, spd: d.speed * (0.95 + R() * 0.1) }); };
    for (let i = 0; i < n; i++) add(1); if (frac > 0.01) add(frac); return out; };
  const mk = (army, side) => { const out = []; for (const [t, bu] of (typeof army === 'string' ? [[army, budget]] : army)) mkOne(t, side, bu, out); return out; };
  const all = [...mk(a, 0), ...mk(b, 1)], dt = 0.05;
  // distance restante jusqu'au départ adverse (camp A ≈ 0 → 30, camp B ≈ 30 → 0)
  const W = wave ? (wave.sides || [0]).map(sd => makeWave(all.filter(u => u.side === sd), 0, null, wave)) : [], rem = u => u.side ? u.x : 30 - u.x;
  // au contact : un ennemi à portée (+ marge de recul) — calculé sur l'ennemi le plus proche, comme le ciblage
  const engaged = u => { for (const o of all) if (o.side !== u.side && o.hp > 0 && Math.abs(o.x - u.x) - 2 * BODY <= rangeWith(u.d, up) + (wave?.contactMargin ?? WAVE.contactMargin)) return true; return false; };
  let t = 0;
  for (; t < maxT; t += dt) {
    const alive = s => all.filter(u => u.side === s && u.hp > 0);
    if (!alive(0).length || !alive(1).length) break;
    for (const w of W) pruneWave(w, t);
    for (const u of all) {
      if (u.hp <= 0) continue; u.cdT -= dt;
      let tg = null, bd = 1e9; for (const o of all) if (o.side !== u.side && o.hp > 0) { const dd = Math.abs(o.x - u.x); if (dd < bd) { bd = dd; tg = o; } }
      if (!tg) continue;
      const dist = Math.max(0, bd - 2 * BODY), dir = Math.sign(tg.x - u.x) || 1;
      if (shouldKite(u.d, tg.d, dist, u.cdT)) { u.x -= dir * u.spd * dt; continue; }
      if (dist <= rangeWith(u.d, up)) { if (u.cdT <= 0) { u.cdT = u.d.cd; tg.hp -= computeDamage(u.d, up, { kind: 'unit', def: tg.d, up }) * (0.9 + R() * 0.2); tg.lastHit = t; } }
      else u.x += dir * u.spd * dt * (u.wave ? waveSpeed(u, rem, engaged) : 1);
      if (u.d.regen && t - (u.lastHit ?? -9) > 5) u.hp = Math.min(u.maxHp, u.hp + u.d.regen * dt);
    }
  }
  const sa = all.filter(u => u.side === 0 && u.hp > 0), sb = all.filter(u => u.side === 1 && u.hp > 0);
  return { win: sa.length && !sb.length ? 0 : sb.length && !sa.length ? 1 : -1, t, left: (sa.length || sb.length) };
}

// matrice : taux de victoire de la ligne contre la colonne
export function matrix(budget = 600, trials = 20, roster = ROSTER, up = null, seedOff = 0) {
  const M = {};
  for (const a of roster) { M[a] = {}; for (const b of roster) { if (a === b) { M[a][b] = null; continue; } let w = 0; for (let s = 1; s <= trials; s++) { const r = fight(a, b, budget, s * 7919 + a.length * 31 + b.length + seedOff, 180, up); w += r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0; } M[a][b] = w / trials; } }
  return M;
}
// scénario héros + escorte : 1 héros (400) + 200 de lanciers (escorte anti-cavalerie, la plus stable aux 3 presets),
// contre 600 de l'unité adverse ; composition modifiable via le paramètre esc
export const ESCORT = [['lancier', 200]];
export const heroArmy = (esc = ESCORT) => [['heros', costOf(UNIT.heros)], ...esc];
export function escortRow(trials = 40, up = null, seedOff = 0, esc = ESCORT) {
  const row = {}, total = costOf(UNIT.heros) + esc.reduce((t, [, b]) => t + b, 0);
  for (const b of ROSTER) { if (b === 'heros') continue; let w = 0; for (let s = 1; s <= trials; s++) { const r = fight(heroArmy(esc), [[b, total]], total, s * 7919 + 97 + b.length + seedOff, 180, up); w += r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0; } row[b] = w / trials; }
  return row;
}
export const dominant = M => Object.keys(M).filter(a => Object.keys(M[a]).every(b => a === b || M[a][b] > 0.5));

if (import.meta.url === `file://${process.argv[1]}`) {
  const budget = +process.argv[2] || 600, trials = +process.argv[3] || 20, upN = process.argv[4] || 'none', M = matrix(budget, trials, ROSTER, upN);
  const pad = s => String(s).padEnd(11);
  console.log(`Taux de victoire ligne vs colonne, coût égal (${budget} ressources/camp, ${trials} essais, améliorations ${upN})`);
  console.log(pad('') + ROSTER.map(pad).join(''));
  for (const a of ROSTER) console.log(pad(a) + ROSTER.map(b => pad(M[a][b] === null ? '—' : Math.round(M[a][b] * 100) + '%')).join(''));
  const d = dominant(M); console.log(d.length ? 'DOMINANT : ' + d.join(', ') : 'Aucune unité ne bat toutes les autres.');
}
