// Test d'équilibrage à coût égal (duels avec hasard, budgets dépensés à <1 % près).
// Les contres restent francs (choix de conception) ; on vérifie donc :
// - moyenne de chaque unité entre 35 % et 65 % (300, 600, 1200) ; aucune unité ne bat toutes les autres
// - au plus 24 duels sur 30 à 0/100 % et au moins 3 paires (sur 15) serrées (20–80 %)
// - table des contres voulus : chacun ≥ 80 % à 600 et 1200, sans amélioration, à l'âge 3 et au maximum (UPS)
// - 40 essais, 2 jeux de graines (décalage 0 et +1000) : chaque vérification doit passer sur les deux
// - chaque unité a au moins un duel gagné ≥ 80 % et un perdu ≤ 20 %
// - cohérence : écart ≤ 35 points entre 600 et 1200 pour chaque paire (300 affiché seulement)
import { matrix, dominant, ROSTER, spent, UPS } from '../tools/duel.mjs';
export const COUNTERS = { lancier: ['cavalier', 'heros'], cavalier: ['archer', 'tirailleur'], archer: ['epeiste', 'lancier'], tirailleur: ['archer', 'lancier'], epeiste: ['lancier', 'cavalier'], heros: ['epeiste', 'cavalier'] };
const BUDGETS = [300, 600, 1200], TRIALS = 40, SEEDS = [0, 1000], pct = x => Math.round(x * 100);
const errors = [], all = {};
for (const off of SEEDS) { all[off] = {};
for (const budget of BUDGETS) {
  for (const a of ROSTER) { const b = a === 'heros' ? 400 : budget, s = spent(a, b); if (Math.abs(s - b) / b > 0.01) errors.push(`${tag}: ${a} dépense ${s} au lieu de ${b}`); }
  const M = all[off][budget] = matrix(budget, TRIALS, ROSTER, null, off), avg = {}, tag = `graines+${off} ${budget}`;
  for (const a of ROSTER) {
    const v = ROSTER.filter(b => b !== a).map(b => M[a][b]); avg[a] = v.reduce((s, x) => s + x, 0) / v.length;
    if (avg[a] < 0.35 || avg[a] > 0.65) errors.push(`${tag}: moyenne ${a} ${pct(avg[a])} %`);
    if (!v.some(x => x >= 0.8)) errors.push(`${tag}: ${a} n'a aucun duel gagné ≥ 80 %`);
    if (!v.some(x => x <= 0.2)) errors.push(`${tag}: ${a} n'a aucun duel perdu ≤ 20 %`);
  }
  let close = 0, extreme = 0;
  ROSTER.forEach((a, i) => ROSTER.forEach((b, j) => { if (i === j) return; const x = M[a][b]; if (x <= 0 || x >= 1) extreme++; if (i < j && x >= 0.2 && x <= 0.8) close++; }));
  const d = dominant(M); if (d.length) errors.push(`${tag}: DOMINANT ${d}`);
  if (close < 3) errors.push(`${tag}: ${close}/15 paires serrées (min 3)`);
  if (extreme > 24) errors.push(`${tag}: ${extreme}/30 duels à 0/100 % (max 24)`);
  if (budget >= 600) for (const up of Object.keys(UPS)) { const Mu = up === 'none' ? M : matrix(budget, TRIALS, ROSTER, up, off);
    for (const [a, ts] of Object.entries(COUNTERS)) for (const b of ts) if (Mu[a][b] < 0.8) errors.push(`${tag} (${up}): contre ${a} > ${b} seulement ${pct(Mu[a][b])} %`); }
  console.log(`${tag} · moyennes ${ROSTER.map(a => a + ' ' + pct(avg[a]) + '%').join(', ')} · paires serrées ${close}/15 · 0/100 % : ${extreme}/30`);
}}
let worst = 0, worstP = '';
for (const off of SEEDS) for (const a of ROSTER) for (const b of ROSTER) {
  if (a >= b) continue; const v = BUDGETS.map(B => all[off][B][a][b]), spread = Math.abs(v[1] - v[2]);
  if (spread > worst) { worst = spread; worstP = `graines+${off} ${a} vs ${b} ${v.map(pct).join('/')}`; }
  if (spread > 0.35) errors.push(`cohérence 600/1200 (graines+${off}) : ${a} vs ${b} ${v.map(pct).join('/')} (300/600/1200)`);
}
console.log(`cohérence 600↔1200 : écart max ${pct(worst)} points (${worstP})`);
if (errors.length) { console.error('ÉCHEC :\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK : équilibrage dans les cibles');
