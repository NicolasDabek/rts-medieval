// Mesure appariée épéiste contre tirailleur (ou toute paire) avec IC95 — hors npm test (lent avec beaucoup de graines)
// node tools/ic95.mjs [a=epeiste] [b=tirailleur] [graines=80] [budgets=600,1200] [décalages=0,1000] [preset=none]
// Chaque graine est jouée des deux côtés (a en camp A puis en camp B) : score de la paire = moyenne des deux orientations.
// IC95 par bootstrap percentile (20 000 rééchantillonnages des paires : les deux orientations d'une graine ne sont pas indépendantes).
// Même formule de graine que test/duel.test.mjs (s × 7919 + 7 × 31 + 10 + décalage) : à 80 graines, mêmes chiffres que le test.
import { fight } from './duel.mjs';
const [a = 'epeiste', b = 'tirailleur', n = '80', budgets = '600,1200', offs = '0,1000', up = 'none'] = process.argv.slice(2);
const N = +n, sc = (r, side) => r.win === side ? 1 : r.win === -1 ? 0.5 : 0;
const R = (seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(917);
for (const budget of budgets.split(',').map(Number)) for (const off of offs.split(',').map(Number)) {
  const pairs = []; for (let s = 1; s <= N; s++) { const seed = s * 7919 + 7 * 31 + 10 + off; pairs.push((sc(fight(a, b, budget, seed, 180, up), 0) + sc(fight(b, a, budget, seed, 180, up), 1)) / 2); }
  const m = pairs.reduce((x, y) => x + y, 0) / N, bs = [];
  for (let j = 0; j < 20000; j++) { let x = 0; for (let i = 0; i < N; i++) x += pairs[Math.floor(R() * N)]; bs.push(x / N); }
  bs.sort((x, y) => x - y);
  console.log(`${a} > ${b} ${budget} graines+${off} ${up} (${N} graines × 2 côtés) : ${(m * 100).toFixed(1)} % [IC95 ${(bs[500] * 100).toFixed(1)}–${(bs[19499] * 100).toFixed(1)}]`);
}
