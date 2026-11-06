// Choix d'unité de l'IA (pur, sans three.js) : partagé par le jeu (ai.js) et le test (test/ai.test.mjs)
// réponse proportionnelle : la part de chaque type d'unité du joueur = la part des formations IA dédiées à son contre
// (contres tirés de la matrice de duels à coût égal, test/duel.test.mjs ; contre les lanciers : archers seuls, car un mélange
// épéistes + archers + tirailleurs perd 75 % du temps contre 1200 de lanciers — mesuré par test/ai.test.mjs)
export const COUNTER = { epeiste: ['archer'], lancier: ['archer'], archer: ['cavalier', 'tirailleur'], tirailleur: ['epeiste', 'cavalier'], cavalier: ['lancier', 'epeiste'], belier: ['cavalier', 'epeiste'], catapulte: ['cavalier'], heros: ['lancier', 'archer'] };
export const COUNTER_P = 0.85; // part des formations qui contrent (le reste : au hasard)
// enemy : { type: nombre } ; opts : unités formables ; rnd : générateur [0,1) ; renvoie un type ou null (au hasard)
export function pickCounter(enemy, opts, rnd = Math.random) {
  const pc = Object.keys(COUNTER).map(k => [k, enemy[k] || 0]), tot = pc.reduce((s, x) => s + x[1], 0);
  if (tot >= 3 && rnd() < COUNTER_P) {
    let r = rnd() * tot;
    for (const [k, n] of pc) { if ((r -= n) < 0) { const ok = COUNTER[k].filter(c => opts.includes(c)); if (ok.length) return ok[Math.floor(rnd() * ok.length)]; break; } }
  }
  return null;
}
