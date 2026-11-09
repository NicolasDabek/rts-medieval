// Test d'équilibrage à coût égal (duels avec hasard, budgets dépensés à <1 % près).
// Les contres restent francs (choix de conception) ; on vérifie donc :
// - moyenne de chaque unité : 35–65 % à 300 ; 42–58 % à 600 et 1200, aux trois presets (sans amélioration, âge 3, max)
//   (moyennes comparées arrondies au point de % près, comme affichées) ; aucune unité ne bat toutes les autres
// - au plus 15 duels sur 30 à 0/100 % à 600 et 1200 sans amélioration (300 : 24)
// - paires serrées (20–80 %) : au moins 2 sur 15 à 600, au moins 1 à 1200 (300 : 2)
// - table des contres voulus : chacun ≥ 85 % à 600 et 1200, sans amélioration, à l'âge 3 et au maximum (UPS)
// - cohérence : écart ≤ 10 points entre 600 et 1200 pour chaque duel, aux trois presets
// - descriptions (data.js) : « Bat » = adversaires ≥ 70 %, « Craint » = adversaires ≤ 30 % sur la matrice 600 (graines+0)
// - scénario héros + escorte (tools/duel.mjs ESCORT) : 1 héros (400) + 200 de lanciers contre 600 de chaque autre unité,
//   moyenne du héros entre 40 et 60 % aux trois presets
// - 40 essais, 2 jeux de graines (décalage 0 et +1000) : chaque vérification doit passer sur les deux
// - chaque unité a au moins un duel gagné ≥ 80 % et un perdu ≤ 20 %
// Paires serrées : choix de Nicolas (passe GD 9, option A) d'accepter 2/15. 12 des 15 paires sont des contres
// voulus à ≥ 85 %, donc hors zone serrée ; seules épéiste–tirailleur, tirailleur–héros et archer–héros peuvent l'être.
// Épéiste–tirailleur oscille autour de 80 % : à 1200 (graines+0) elle sort de la zone, d'où le minimum à 1 à 1200.
// Passe GD 10 : Balistique et Chimie ne concernent plus que les tours et l'hôtel de ville ; l'archer retombe à 57 %
// aux presets âge 3 / max (avant : 59–60 %), d'où la cible 42–58 % resserrée pour tous les presets.
import { UNIT } from '../data.js';
import { matrix, dominant, ROSTER, spent, UPS, escortRow, ESCORT, fight } from '../tools/duel.mjs';
import { costOf } from '../rules.js';
export const COUNTERS = { lancier: ['cavalier', 'heros'], cavalier: ['archer', 'tirailleur'], archer: ['epeiste', 'lancier'], tirailleur: ['archer', 'lancier'], epeiste: ['lancier', 'cavalier'], heros: ['epeiste', 'cavalier'] };
const BUDGETS = [300, 600, 1200], TRIALS = 40, SEEDS = [0, 1000], pct = x => Math.round(x * 100);
const errors = [], all = {}, byUp = {};
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
    if (pct(avg[a]) < pct(lo) || pct(avg[a]) > pct(hi)) errors.push(`${tag}: moyenne ${a} ${pct(avg[a])} % (cible ${pct(lo)}–${pct(hi)})`);
    if (!v.some(x => x >= 0.8)) errors.push(`${tag}: ${a} n'a aucun duel gagné ≥ 80 %`);
    if (!v.some(x => x <= 0.2)) errors.push(`${tag}: ${a} n'a aucun duel perdu ≤ 20 %`);
  }
  let close = 0, extreme = 0;
  ROSTER.forEach((a, i) => ROSTER.forEach((b, j) => { if (i === j) return; const x = M[a][b]; if (x <= 0 || x >= 1) extreme++; if (i < j && x >= 0.2 && x <= 0.8) close++; }));
  const d = dominant(M); if (d.length) errors.push(`${tag}: DOMINANT ${d}`);
  const maxExt = budget === 300 ? 24 : 15, minClose = budget === 1200 ? 1 : 2;
  if (close < minClose) errors.push(`${tag}: ${close}/15 paires serrées (min ${minClose})`);
  if (extreme > maxExt) errors.push(`${tag}: ${extreme}/30 duels à 0/100 % (max ${maxExt})`);
  if (off === 0 && budget === 600) for (const a of ROSTER) {
    const others = ROSTER.filter(b => b !== a), bat = others.filter(b => M[a][b] >= 0.7).sort(), cr = others.filter(b => M[a][b] <= 0.3).sort();
    const dB = parseDesc(UNIT[a].desc, 'Bat'), dC = parseDesc(UNIT[a].desc, 'Craint');
    if (bat.join() !== dB.join()) errors.push(`desc ${a} : Bat attendu [${bat}] , texte [${dB}]`);
    if (cr.join() !== dC.join()) errors.push(`desc ${a} : Craint attendu [${cr}] , texte [${dC}]`);
  }
  if (budget >= 600) for (const up of Object.keys(UPS)) { const Mu = up === 'none' ? M : matrix(budget, TRIALS, ROSTER, up, off); byUp[`${off} ${up} ${budget}`] = Mu;
    if (up !== 'none') { const av = ROSTER.map(a => ROSTER.filter(b => b !== a).reduce((s, b) => s + Mu[a][b], 0) / 5);
      ROSTER.forEach((a, i) => { if (pct(av[i]) < 42 || pct(av[i]) > 58) errors.push(`${tag} (${up}): moyenne ${a} ${pct(av[i])} % (cible 42–58)`); });
      console.log(`${tag} (${up}) · moyennes ${ROSTER.map((a, i) => a + ' ' + pct(av[i]) + '%').join(', ')}`); }
    for (const [a, ts] of Object.entries(COUNTERS)) for (const b of ts) if (Mu[a][b] < 0.85) errors.push(`${tag} (${up}): contre ${a} > ${b} seulement ${pct(Mu[a][b])} %`); }
  console.log(`${tag} · moyennes ${ROSTER.map(a => a + ' ' + pct(avg[a]) + '%').join(', ')} · paires serrées ${close}/15 · 0/100 % : ${extreme}/30`);
}}
let worst = 0, worstP = '';
for (const off of SEEDS) for (const up of Object.keys(UPS)) for (const a of ROSTER) for (const b of ROSTER) {
  if (a === b) continue; const x6 = byUp[`${off} ${up} 600`][a][b], x12 = byUp[`${off} ${up} 1200`][a][b], spread = Math.abs(x6 - x12);
  if (spread > worst + 1e-9) { worst = spread; worstP = `graines+${off} ${up} ${a} > ${b} ${pct(x6)}/${pct(x12)}`; }
  if (pct(spread) > 10) errors.push(`cohérence 600/1200 (graines+${off}, ${up}) : ${a} > ${b} ${pct(x6)}/${pct(x12)}`);
}
console.log(`cohérence 600↔1200 : écart max ${pct(worst)} points (${worstP})`);
for (const off of SEEDS) for (const up of Object.keys(UPS)) {
  const r = escortRow(TRIALS, up, off), v = Object.values(r), m = v.reduce((s, x) => s + x, 0) / v.length;
  console.log(`héros + escorte (${ESCORT.map(([t, b]) => b + ' ' + t).join(', ')}) graines+${off} ${up} · ${Object.entries(r).map(([b, x]) => b + ' ' + pct(x) + '%').join(', ')} · moyenne ${pct(m)}%`);
  if (pct(m) < 40 || pct(m) > 60) errors.push(`héros + escorte graines+${off} ${up} : moyenne ${pct(m)} % (cible 40–60)`);
}
// héros seul (400) contre 600 de lanciers (passe GD 12) : la régénération (2 PV/s hors combat) ne doit pas lui permettre de gagner (≤ 15 %)
for (const off of SEEDS) for (const up of Object.keys(UPS)) { let w = 0;
  for (let s = 1; s <= TRIALS; s++) { const r = fight([['heros', costOf(UNIT.heros)]], [['lancier', 600]], 600, s * 7919 + 53 + off, 180, up); w += r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0; }
  console.log(`héros seul contre 600 de lanciers graines+${off} ${up} : ${pct(w / TRIALS)} %`);
  if (pct(w / TRIALS) > 15) errors.push(`héros seul contre 600 de lanciers graines+${off} ${up} : ${pct(w / TRIALS)} % (max 15)`); }
// passe GD 13 (affichage, sans échec ni seuil modifié) : paires serrées à 1200 sur les deux jeux de graines
for (const off of SEEDS) { const M = all[off][1200], l = [];
  ROSTER.forEach((a, i) => ROSTER.forEach((b, j) => { if (i < j && M[a][b] >= 0.2 && M[a][b] <= 0.8) l.push(`${a}–${b} ${pct(M[a][b])} %`); }));
  console.log(`paires serrées 1200 graines+${off} : ${l.length}/15${l.length ? ' (' + l.join(', ') + ')' : ''}`); }
// passe GD 13 (affichage) : épéiste–tirailleur sur 80 graines jouées des deux côtés (160 combats par case), IC95 par bootstrap
// percentile (20 000 rééchantillonnages des 80 paires de côtés : les deux orientations d'une graine ne sont pas indépendantes)
{ const N = 80, R = (seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(917);
  const sc = (r, side) => r.win === side ? 1 : r.win === -1 ? 0.5 : 0;
  for (const budget of [600, 1200]) for (const off of SEEDS) {
    const pairs = []; for (let s = 1; s <= N; s++) { const seed = s * 7919 + 7 * 31 + 10 + off; pairs.push((sc(fight('epeiste', 'tirailleur', budget, seed), 0) + sc(fight('tirailleur', 'epeiste', budget, seed), 1)) / 2); }
    const m = pairs.reduce((a, b) => a + b, 0) / N, bs = [];
    for (let j = 0; j < 20000; j++) { let x = 0; for (let i = 0; i < N; i++) x += pairs[Math.floor(R() * N)]; bs.push(x / N); }
    bs.sort((a, b) => a - b);
    console.log(`épéiste > tirailleur ${budget} graines+${off} (80 graines × 2 côtés) : ${(m * 100).toFixed(1)} % [IC95 ${(bs[500] * 100).toFixed(1)}–${(bs[19499] * 100).toFixed(1)}]`);
  } }
if (errors.length) { console.error('ÉCHEC :\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK : équilibrage dans les cibles');
