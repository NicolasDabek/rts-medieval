// Test d'équilibrage à coût égal (plusieurs budgets, duels avec hasard) :
// - aucune unité ne bat toutes les autres
// - taux de victoire moyen de chaque unité entre 30 % et 70 %
// - au moins 6 duels sur 30 serrés (entre 20 % et 80 %) — sinon les contres sont absolus
import { matrix, dominant, ROSTER } from '../tools/duel.mjs';
let fail = false;
for (const budget of [300, 600, 1200]) {
  const M = matrix(budget, 16), d = dominant(M), bad = [], avg = {};
  for (const a of ROSTER) { const v = ROSTER.filter(b => b !== a).map(b => M[a][b]); avg[a] = v.reduce((s, x) => s + x, 0) / v.length; if (avg[a] < 0.3 || avg[a] > 0.7) bad.push(a); }
  let close = 0; for (const a of ROSTER) for (const b of ROSTER) if (a !== b && M[a][b] >= 0.2 && M[a][b] <= 0.8) close++;
  const ok = !d.length && !bad.length && close >= 6;
  console.log(`budget ${budget} : ${ok ? 'ok' : 'ÉCHEC'} · moyennes ${ROSTER.map(a => a + ' ' + Math.round(avg[a] * 100) + '%').join(', ')} · serrés ${close}/30${d.length ? ' · DOMINANT ' + d : ''}`);
  if (!ok) fail = true;
}
if (fail) { console.error('ÉCHEC : équilibrage hors cibles'); process.exit(1); }
console.log('OK : équilibrage dans les cibles');
