// Test d'équilibrage à coût égal (duels avec hasard, budgets dépensés à <1 % près).
// Les contres restent francs (choix de conception) ; on vérifie donc :
// - moyenne de chaque unité : 35–65 % à 300 ; 42–58 % à 600 et 1200
//   et 40–60 % aux presets âge 3 et max (600, 1200) ; aucune unité ne bat toutes les autres
// - au plus 18 duels sur 30 à 0/100 % et au moins 2 paires (sur 15) serrées (20–80 %) à 600 et 1200 (300 : 24 / 2)
// - table des contres voulus : chacun ≥ 85 % à 600 et 1200, sans amélioration, à l'âge 3 et au maximum (UPS)
// - descriptions (data.js) : « Bat » = adversaires ≥ 70 %, « Craint » = adversaires ≤ 30 % sur la matrice 600 (graines+0)
// Limite structurelle (passes GD 7–8) : 12 des 15 paires sont des contres voulus à ≥ 85 %, donc hors de la zone
// « serrée » (20–80 %). Seules 3 paires libres (épéiste–tirailleur, tirailleur–héros, archer–héros) peuvent être
// serrées : 4 paires serrées est impossible sans contre < 80 %. Archer–héros reste vers 88 % (le rapprocher fait
// monter le héros au-delà de 58 % de moyenne), d'où le minimum à 2.
// - 40 essais, 2 jeux de graines (décalage 0 et +1000) : chaque vérification doit passer sur les deux
// - chaque unité a au moins un duel gagné ≥ 80 % et un perdu ≤ 20 %
// - cohérence : écart ≤ 35 points entre 600 et 1200 pour chaque paire (300 affiché seulement)
import { UNIT } from '../data.js';
import { matrix, dominant, ROSTER, spent, UPS } from '../tools/duel.mjs';
export const COUNTERS = { lancier: ['cavalier', 'heros'], cavalier: ['archer', 'tirailleur'], archer: ['epeiste', 'lancier'], tirailleur: ['archer', 'lancier'], epeiste: ['lancier', 'cavalier'], heros: ['epeiste', 'cavalier'] };
const BUDGETS = [300, 600, 1200], TRIALS = 40, SEEDS = [0, 1000], pct = x => Math.round(x * 100);
const errors = [], all = {};
const LABEL = { epeiste: 'épéiste', lancier: 'lancier', tirailleur: 'tirailleur', archer: 'archer', cavalier: 'cavalier', heros: 'héros' };
const toKey = w => { w = w.trim().toLowerCase(); if (w !== 'héros') w = w.replace(/s$/, ''); const k = Object.keys(LABEL).find(k => LABEL[k] === w); if (!k) errors.push(`desc : libellé inconnu « ${w} »`); return k; };
const parseDesc = (d, tag) => { const m = d.match(new RegExp(tag + ' : ([^.]*)')); return m ? m[1].split(',').map(toKey).filter(Boolean).sort() : []; };
for (const off of SEEDS) { all[off] = {};
for (const budget of BUDGETS) {
  for (const a of ROSTER) { const b = a === 'heros' ? 400 : budget, s = spent(a, b); if (Math.abs(s - b) / b > 0.01) errors.push(`${tag}: ${a} dépense ${s} au lieu de ${b}`); }
  const M = all[off][budget] = matrix(budget, TRIALS, ROSTER, null, off), avg = {}, tag = `graines+${off} ${budget}`;
  for (const a of ROSTER) {
    const v = ROSTER.filter(b => b !== a).map(b => M[a][b]); avg[a] = v.reduce((s, x) => s + x, 0) / v.length;
    const lo = budget === 300 ? 0.35 : 0.42, hi = budget === 300 ? 0.65 : 0.58;
    if (avg[a] < lo - 1e-9 || avg[a] > hi + 1e-9) errors.push(`${tag}: moyenne ${a} ${pct(avg[a])} % (cible ${pct(lo)}–${pct(hi)})`);
    if (!v.some(x => x >= 0.8)) errors.push(`${tag}: ${a} n'a aucun duel gagné ≥ 80 %`);
    if (!v.some(x => x <= 0.2)) errors.push(`${tag}: ${a} n'a aucun duel perdu ≤ 20 %`);
  }
  let close = 0, extreme = 0;
  ROSTER.forEach((a, i) => ROSTER.forEach((b, j) => { if (i === j) return; const x = M[a][b]; if (x <= 0 || x >= 1) extreme++; if (i < j && x >= 0.2 && x <= 0.8) close++; }));
  const d = dominant(M); if (d.length) errors.push(`${tag}: DOMINANT ${d}`);
  const maxExt = budget === 300 ? 24 : 18;
  if (close < 2) errors.push(`${tag}: ${close}/15 paires serrées (min 2)`);
  if (extreme > maxExt) errors.push(`${tag}: ${extreme}/30 duels à 0/100 % (max ${maxExt})`);
  if (off === 0 && budget === 600) for (const a of ROSTER) {
    const others = ROSTER.filter(b => b !== a), bat = others.filter(b => M[a][b] >= 0.7).sort(), cr = others.filter(b => M[a][b] <= 0.3).sort();
    const dB = parseDesc(UNIT[a].desc, 'Bat'), dC = parseDesc(UNIT[a].desc, 'Craint');
    if (bat.join() !== dB.join()) errors.push(`desc ${a} : Bat attendu [${bat}] , texte [${dB}]`);
    if (cr.join() !== dC.join()) errors.push(`desc ${a} : Craint attendu [${cr}] , texte [${dC}]`);
  }
  if (budget >= 600) for (const up of Object.keys(UPS)) { const Mu = up === 'none' ? M : matrix(budget, TRIALS, ROSTER, up, off);
    if (up !== 'none') { const av = ROSTER.map(a => ROSTER.filter(b => b !== a).reduce((s, b) => s + Mu[a][b], 0) / 5);
      ROSTER.forEach((a, i) => { if (av[i] < 0.4 - 1e-9 || av[i] > 0.6 + 1e-9) errors.push(`${tag} (${up}): moyenne ${a} ${pct(av[i])} % (cible 40–60)`); });
      console.log(`${tag} (${up}) · moyennes ${ROSTER.map((a, i) => a + ' ' + pct(av[i]) + '%').join(', ')}`); }
    for (const [a, ts] of Object.entries(COUNTERS)) for (const b of ts) if (Mu[a][b] < 0.85) errors.push(`${tag} (${up}): contre ${a} > ${b} seulement ${pct(Mu[a][b])} %`); }
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
