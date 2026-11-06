// Test de l'IA (passe GD 11/12) : choix d'unités de l'IA (aipick.js, utilisé par ai.js) + combat à coût égal (tools/duel.mjs)
// - miroir Normal contre Normal : chaque IA forme son armée unité par unité en voyant celle de l'autre ; 20 graines ;
//   victoires du camp A entre 40 et 60 %
// - IA qui contre une armée mono-unité (épéistes, lanciers, tirailleurs, archers ou cavaliers, 4 graines chacun = 20 combats) :
//   l'IA gagne ≥ 65 %
import { UNIT } from '../data.js';
import { costOf } from '../rules.js';
import { fight } from '../tools/duel.mjs';
import { pickCounter } from '../aipick.js';
const OPTS = ['epeiste', 'lancier', 'tirailleur', 'archer', 'cavalier'], BUDGET = 1200, pct = x => Math.round(x * 100);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const count = army => { const c = {}; for (const [t, b] of army) c[t] = (c[t] || 0) + b / costOf(UNIT[t]); return c; };
// ajoute une formation (la dernière est réduite au budget restant, comme dans tools/duel.mjs)
const add = (army, t) => { const left = BUDGET - army.reduce((s, [, b]) => s + b, 0); if (left > 0.5) army.push([t, Math.min(costOf(UNIT[t]), left)]); return left > 0.5; };
const pick = (enemy, R) => pickCounter(count(enemy), OPTS, R) || OPTS[Math.floor(R() * OPTS.length)];
const group = army => { const g = {}; for (const [t, b] of army) g[t] = (g[t] || 0) + b; return Object.entries(g); };
const score = r => r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0;
const errors = [];
// miroir : formation alternée, chaque IA voit l'armée adverse en cours
let w = 0; const mirror = [];
for (let s = 1; s <= 20; s++) {
  const R = rng(s * 104729), A = [], B = []; let a = true, b = true;
  while (a || b) { if (a) a = add(A, pick(B, R)); if (b) b = add(B, pick(A, R)); }
  const r = score(fight(group(A), group(B), BUDGET, s * 7919 + 13)); w += r; mirror.push(r);
}
console.log(`IA miroir Normal/Normal (20 graines, ${BUDGET}) : camp A ${pct(w / 20)} %`);
if (pct(w / 20) < 40 || pct(w / 20) > 60) errors.push(`miroir : ${pct(w / 20)} % (cible 40–60)`);
// contre : l'IA voit une armée mono-unité complète et forme la sienne
let wc = 0; const per = {};
for (const e of OPTS) { per[e] = 0; for (let s = 1; s <= 4; s++) {
  const R = rng(s * 7331 + e.length), E = [[e, BUDGET]], A = []; while (add(A, pick(E, R)));
  const r = score(fight(group(A), E, BUDGET, s * 7919 + 29 + e.length)); wc += r; per[e] += r / 4;
} }
console.log(`IA qui contre une armée mono-unité (20 combats) : ${pct(wc / 20)} % · ${OPTS.map(e => e + ' ' + pct(per[e]) + '%').join(', ')}`);
if (pct(wc / 20) < 65) errors.push(`contre mono-unité : ${pct(wc / 20)} % (cible ≥ 65)`);
if (errors.length) { console.error('ÉCHEC :\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK : IA dans les cibles');
