// Test de l'IA (passes GD 11/12/13) : choix d'unités de l'IA (aipick.js, utilisé par ai.js) + combat à coût égal (tools/duel.mjs)
// Passe GD 13 : l'IA attaque en vague groupée (wave.js, utilisé par ai.js/units.js et par fight) ; les combats de l'IA ci-dessous
// sont donc joués en vague. Simulateur 1D : parité de politique (pas d'obstacles, de séparation ni de pathfinding).
// - miroir Normal contre Normal : chaque IA forme son armée unité par unité en voyant celle de l'autre ; 80 graines à 600 et
//   1200 ; victoires du camp A entre 40 et 60 %
// - IA qui contre une armée mono-unité (épéistes, lanciers, tirailleurs, archers ou cavaliers, 80 graines chacun, 600 et 1200) :
//   global ≥ 90 %, chaque adversaire ≥ 50 %, tirailleurs ≥ 75 %
// - doubles contres (archer, cavalier, bélier) : mélange 50/50 ≥ 65 % à 600 et 1200, 80 graines, deux jeux de graines
// - mélange épéistes + cavaliers 50/50 contre tirailleurs en vague ≥ 50 % (0 % sans vague)
// - choix par bâtiment : une caserne contre des tirailleurs forme des épéistes (repli), jamais de lancier ni d'archer ;
//   un camp de tir attend (HOLD)
// - passe 1.0 : modèle honnête par bâtiment (caserne [épéiste, lancier, tirailleur], camp de tir [archer], écurie [cavalier],
//   chacun choisit à tour de rôle avec ses seules options, HOLD = attend, null = au hasard parmi ses options, comme ai.js) :
//   Normal mêmes cibles (global ≥ 90 %, chaque adversaire ≥ 50 %, tirailleurs ≥ 75 %) ; Facile (contre 50 %, reste au hasard,
//   vagues non groupées) nettement plus faible : global ≤ 70 % et au moins 25 points sous Normal
import { UNIT, DIFFS } from '../data.js';
import { costOf } from '../rules.js';
import { fight } from '../tools/duel.mjs';
import { pickCounter, COUNTER, HOLD, COUNTER_P } from '../aipick.js';
const OPTS = ['epeiste', 'lancier', 'tirailleur', 'archer', 'cavalier'], N = 80, pct = x => Math.round(x * 100), WAVE = {};
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const count = army => { const c = {}; for (const [t, b] of army) c[t] = (c[t] || 0) + b / costOf(UNIT[t]); return c; };
const pick = (enemy, R) => { const k = pickCounter(count(enemy), OPTS, R); return k && k !== HOLD ? k : OPTS[Math.floor(R() * OPTS.length)]; };
const group = army => { const g = {}; for (const [t, b] of army) g[t] = (g[t] || 0) + b; return Object.entries(g); };
const score = r => r.win === 0 ? 1 : r.win === -1 ? 0.5 : 0;
const errors = [];
for (const BUDGET of [600, 1200]) {
  // ajoute une formation (la dernière est réduite au budget restant, comme dans tools/duel.mjs)
  const add = (army, t) => { const left = BUDGET - army.reduce((s, [, b]) => s + b, 0); if (left > 0.5) army.push([t, Math.min(costOf(UNIT[t]), left)]); return left > 0.5; };
  // miroir : formation alternée, chaque IA voit l'armée adverse en cours ; les deux camps en vague
  let w = 0;
  for (let s = 1; s <= N; s++) {
    const R = rng(s * 104729), A = [], B = []; let a = true, b = true;
    while (a || b) { if (a) a = add(A, pick(B, R)); if (b) b = add(B, pick(A, R)); }
    w += score(fight(group(A), group(B), BUDGET, s * 7919 + 13, 180, null, { ...WAVE, sides: [0, 1] }));
  }
  console.log(`IA miroir Normal/Normal (${N} graines, ${BUDGET}) : camp A ${pct(w / N)} %`);
  if (pct(w / N) < 40 || pct(w / N) > 60) errors.push(`miroir ${BUDGET} : ${pct(w / N)} % (cible 40–60)`);
  // contre : l'IA voit une armée mono-unité complète et forme la sienne
  let wc = 0; const per = {};
  for (const e of OPTS) { per[e] = 0; for (let s = 1; s <= N; s++) {
    const R = rng(s * 7331 + e.length), E = [[e, BUDGET]], A = []; while (add(A, pick(E, R)));
    const r = score(fight(group(A), E, BUDGET, s * 7919 + 29 + e.length, 180, null, WAVE)); wc += r; per[e] += r / N;
  } }
  const tot = wc / N / OPTS.length;
  console.log(`IA qui contre une armée mono-unité (${BUDGET}, ${N * OPTS.length} combats) : ${pct(tot)} % · ${OPTS.map(e => e + ' ' + pct(per[e]) + '%').join(', ')}`);
  if (pct(tot) < 90) errors.push(`contre mono-unité ${BUDGET} : ${pct(tot)} % (cible ≥ 90)`);
  for (const e of OPTS) if (pct(per[e]) < 50) errors.push(`contre ${e} ${BUDGET} : ${pct(per[e])} % (plancher 50)`);
  if (pct(per.tirailleur) < 75) errors.push(`contre tirailleur ${BUDGET} : ${pct(per.tirailleur)} % (cible ≥ 75)`);
  // doubles contres : mélange 50/50 contre la cible (bélier : le simulateur le laisse viser les unités, contrairement au jeu)
  for (const e of Object.keys(COUNTER).filter(k => COUNTER[k].length === 2 && ['archer', 'cavalier', 'belier'].includes(k))) for (const off of [0, 1000]) {
    let x = 0; for (let s = 1; s <= N; s++) x += score(fight(COUNTER[e].map(t => [t, BUDGET / 2]), [[e, BUDGET]], BUDGET, s * 7919 + 41 + off, 180, null, WAVE));
    console.log(`double contre ${COUNTER[e].join('+')} contre ${e} ${BUDGET} graines+${off} : ${pct(x / N)} %`);
    if (pct(x / N) < 65) errors.push(`double contre ${e} ${BUDGET} graines+${off} : ${pct(x / N)} % (cible ≥ 65)`);
  }
  // fixture « groupé » : épéistes + cavaliers 50/50 contre tirailleurs, avec et sans vague
  for (const off of [0, 1000]) {
    let g = 0, f = 0; for (let s = 1; s <= N; s++) { const A = [['epeiste', BUDGET / 2], ['cavalier', BUDGET / 2]], E = [['tirailleur', BUDGET]], seed = s * 7919 + 41 + off;
      g += score(fight(A, E, BUDGET, seed, 180, null, WAVE)); f += score(fight(A, E, BUDGET, seed)); }
    console.log(`épéistes + cavaliers 50/50 contre tirailleurs ${BUDGET} graines+${off} : vague ${pct(g / N)} % · sans vague ${pct(f / N)} %`);
    if (pct(g / N) < 50) errors.push(`épéistes + cavaliers en vague contre tirailleurs ${BUDGET} graines+${off} : ${pct(g / N)} % (cible ≥ 50)`);
  }
}
// modèle par bâtiment (passe 1.0) : Normal et Facile, mêmes graines
const BLD = { caserne: ['epeiste', 'lancier', 'tirailleur'], archerie: ['archer'], ecurie: ['cavalier'] };
for (const BUDGET of [600, 1200]) { const tot = {};
  const add = (army, t) => { const left = BUDGET - army.reduce((s, [, b]) => s + b, 0); if (left > 0.5) army.push([t, Math.min(costOf(UNIT[t]), left)]); return left > 0.5; };
  for (const dk of ['normal', 'facile']) { const D = DIFFS[dk], p = D.counterP ?? COUNTER_P, safe = D.safeRest ?? true, wave = D.grouped === false ? null : WAVE; let wc = 0; const per = {};
    for (const e of OPTS) { per[e] = 0; for (let s = 1; s <= N; s++) {
      const R = rng(s * 7331 + e.length), E = [[e, BUDGET]], A = []; let go = true, it = 0;
      while (go && it++ < 500) for (const o of Object.values(BLD)) { let k = pickCounter(count(E), o, R, p, safe, OPTS); if (k === HOLD) continue; if (!k) k = o[Math.floor(R() * o.length)]; if (!add(A, k)) { go = false; break; } }
      const r = score(fight(group(A), E, BUDGET, s * 7919 + 29 + e.length, 180, null, wave)); wc += r; per[e] += r / N; } }
    tot[dk] = pct(wc / N / OPTS.length);
    console.log(`IA ${D.label} par bâtiment contre mono-unité (${BUDGET}, ${N * OPTS.length} combats) : ${tot[dk]} % · ${OPTS.map(e => e + ' ' + pct(per[e]) + '%').join(', ')}`);
    if (dk === 'normal') { if (tot[dk] < 90) errors.push(`Normal par bâtiment ${BUDGET} : ${tot[dk]} % (cible ≥ 90)`);
      for (const e of OPTS) if (pct(per[e]) < 50) errors.push(`Normal par bâtiment contre ${e} ${BUDGET} : ${pct(per[e])} % (plancher 50)`);
      if (pct(per.tirailleur) < 75) errors.push(`Normal par bâtiment contre tirailleur ${BUDGET} : ${pct(per.tirailleur)} % (cible ≥ 75)`); }
  }
  if (tot.facile > 70 || tot.normal - tot.facile < 25) errors.push(`Facile ${BUDGET} : ${tot.facile} % (cible ≤ 70 et ≥ 25 points sous Normal ${tot.normal} %)`);
}
// choix par bâtiment (pas de hasard pur faute du contre voulu)
{ const R = rng(7), enemy = { tirailleur: 20 }, seen = { caserne: new Set(), archerie: new Set(), ecurie: new Set() };
  const B = { caserne: ['epeiste', 'lancier', 'tirailleur'], archerie: ['archer'], ecurie: ['cavalier'] };
  for (let i = 0; i < 2000; i++) for (const [b, o] of Object.entries(B)) seen[b].add(pickCounter(enemy, o, R));
  console.log(`contre tirailleurs, par bâtiment : ${Object.entries(seen).map(([b, s]) => b + ' [' + [...s].join(', ') + ']').join(' · ')}`);
  if (seen.caserne.has('lancier') || seen.caserne.has(null) || !seen.caserne.has('epeiste')) errors.push(`caserne contre tirailleurs : ${[...seen.caserne]}`);
  if (seen.archerie.size !== 1 || !seen.archerie.has(HOLD)) errors.push(`camp de tir contre tirailleurs : ${[...seen.archerie]} (attendu ${HOLD})`);
  if (seen.ecurie.size !== 1 || !seen.ecurie.has('cavalier')) errors.push(`écurie contre tirailleurs : ${[...seen.ecurie]}`); }
{ const R = rng(11), seen = new Set(); for (let i = 0; i < 2000; i++) seen.add(pickCounter({ tirailleur: 20 }, ['epeiste', 'lancier', 'tirailleur'], R, COUNTER_P, true, OPTS));
  console.log(`contre tirailleurs, caserne quand l'écurie existe : [${[...seen].join(', ')}]`);
  if (!seen.has(HOLD) || seen.has('lancier') || seen.has('tirailleur') || seen.has(null)) errors.push(`caserne contre tirailleurs avec écurie : ${[...seen]}`); }
if (errors.length) { console.error('ÉCHEC :\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('OK : IA dans les cibles');
