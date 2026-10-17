// Duels à coût égal, sans navigateur : utilise les vraies données (data.js) et règles (rules.js)
// node tools/duel.mjs [budget] [essais]
import { UNIT } from '../data.js';
import { computeDamage, rangeWith, shouldKite, costOf } from '../rules.js';

export const ROSTER = ['epeiste', 'lancier', 'tirailleur', 'archer', 'cavalier', 'heros'];
const BODY = 0.6; // demi-largeur d'une unité : la portée se compte bord à bord

// PRNG déterministe (mulberry32) pour des résultats reproductibles
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Combat N contre N sur une ligne : déplacement vers l'ennemi le plus proche, tir quand à portée, recul (kiting) selon rules.js
export function fight(a, b, budget = 600, seed = 1, maxT = 180) {
  const R = rng(seed), mk = (type, side) => { const d = UNIT[type], n = Math.max(1, Math.round(budget / costOf(d))), out = [];
    for (let i = 0; i < n; i++) out.push({ type, d, side, x: side ? 30 + R() * 3 : -R() * 3, hp: d.hp, cdT: R() * d.cd, spd: d.speed * (0.95 + R() * 0.1) }); return out; };
  const all = [...mk(a, 0), ...mk(b, 1)], dt = 0.05;
  let t = 0;
  for (; t < maxT; t += dt) {
    const alive = s => all.filter(u => u.side === s && u.hp > 0);
    if (!alive(0).length || !alive(1).length) break;
    for (const u of all) {
      if (u.hp <= 0) continue; u.cdT -= dt;
      let tg = null, bd = 1e9; for (const o of all) if (o.side !== u.side && o.hp > 0) { const dd = Math.abs(o.x - u.x); if (dd < bd) { bd = dd; tg = o; } }
      if (!tg) continue;
      const dist = Math.max(0, bd - 2 * BODY), dir = Math.sign(tg.x - u.x) || 1;
      if (shouldKite(u.d, tg.d, dist, u.cdT)) { u.x -= dir * u.spd * dt; continue; }
      if (dist <= rangeWith(u.d, null)) { if (u.cdT <= 0) { u.cdT = u.d.cd; tg.hp -= computeDamage(u.d, null, { kind: 'unit', def: tg.d, up: null }); } }
      else u.x += dir * u.spd * dt;
      if (u.d.regen && t - (u.lastHit ?? -9) > 5) u.hp = Math.min(u.d.hp, u.hp + u.d.regen * dt);
    }
  }
  const sa = all.filter(u => u.side === 0 && u.hp > 0), sb = all.filter(u => u.side === 1 && u.hp > 0);
  return { win: sa.length && !sb.length ? 0 : sb.length && !sa.length ? 1 : -1, t, left: (sa.length || sb.length) };
}

// matrice : taux de victoire de la ligne contre la colonne
export function matrix(budget = 600, trials = 20, roster = ROSTER) {
  const M = {};
  for (const a of roster) { M[a] = {}; for (const b of roster) { if (a === b) { M[a][b] = null; continue; } let w = 0; for (let s = 1; s <= trials; s++) { const r = fight(a, b, budget, s * 7919 + a.length * 31 + b.length); w += r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0; } M[a][b] = w / trials; } }
  return M;
}
export const dominant = M => Object.keys(M).filter(a => Object.keys(M[a]).every(b => a === b || M[a][b] > 0.5));

if (import.meta.url === `file://${process.argv[1]}`) {
  const budget = +process.argv[2] || 600, trials = +process.argv[3] || 20, M = matrix(budget, trials);
  const pad = s => String(s).padEnd(11);
  console.log(`Taux de victoire ligne vs colonne, coût égal (${budget} ressources/camp, ${trials} essais)`);
  console.log(pad('') + ROSTER.map(pad).join(''));
  for (const a of ROSTER) console.log(pad(a) + ROSTER.map(b => pad(M[a][b] === null ? '—' : Math.round(M[a][b] * 100) + '%')).join(''));
  const d = dominant(M); console.log(d.length ? 'DOMINANT : ' + d.join(', ') : 'Aucune unité ne bat toutes les autres.');
}
