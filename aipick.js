// Choix d'unité de l'IA (pur, sans three.js) : partagé par le jeu (ai.js) et le test (test/ai.test.mjs)
// réponse proportionnelle : la part de chaque type d'unité du joueur = la part des formations IA dédiées à son contre
// (contres tirés de la matrice de duels à coût égal, test/duel.test.mjs ; contre les lanciers : archers seuls, car un mélange
// épéistes + archers + tirailleurs perd 75 % du temps contre 1200 de lanciers — mesuré par test/ai.test.mjs)
// Passe GD 13 : contre les tirailleurs, cavaliers seuls (le mélange épéistes + cavaliers arrivait désynchronisé : 0 %) ;
// épéiste en repli si la cavalerie ne se forme pas dans ce bâtiment (contre seul mesuré 72–86 %, test/ai.test.mjs).
// Les doubles contres (archer, cavalier, bélier) sont gardés : leurs mélanges 50/50 gagnent 100 % (test/ai.test.mjs).
export const COUNTER = { epeiste: ['archer'], lancier: ['archer'], archer: ['cavalier', 'tirailleur'], tirailleur: ['cavalier'], cavalier: ['lancier', 'epeiste'], belier: ['cavalier', 'epeiste'], catapulte: ['cavalier'], heros: ['lancier', 'archer'] };
export const FALLBACK = { tirailleur: ['epeiste'] };
// contres voulus de la matrice de duels (test/duel.test.mjs COUNTERS) : BEATS[x] = unités que x bat
export const BEATS = { lancier: ['cavalier', 'heros'], cavalier: ['archer', 'tirailleur'], archer: ['epeiste', 'lancier'], tirailleur: ['archer', 'lancier'], epeiste: ['lancier', 'cavalier'], heros: ['epeiste', 'cavalier'] };
export const COUNTER_P = 0.85; // part des formations qui contrent
export const HOLD = 'hold'; // ce bâtiment ne forme rien d'utile contre ce type : il attend (garde les ressources)
// enemy : { type: nombre } ; opts : unités formables dans ce bâtiment ; rnd : générateur [0,1)
// renvoie un type, HOLD, ou null (aucune armée adverse connue : au hasard, comme avant).
// - 85 % : contre voulu (COUNTER), sinon repli (FALLBACK), sinon une unité qui bat ce type (BEATS), sinon une unité
//   qu'il ne bat pas, sinon HOLD — par bâtiment : une caserne ne forme plus au hasard faute de cavalerie
// - 15 % : plus de hasard pur — une unité que le type adverse tiré ne bat pas (ex. ni lancier ni archer contre des
//   tirailleurs), sinon HOLD
export function pickCounter(enemy, opts, rnd = Math.random) {
  const pc = Object.keys(COUNTER).map(k => [k, enemy[k] || 0]), tot = pc.reduce((s, x) => s + x[1], 0);
  if (tot < 3) return null;
  const counter = rnd() < COUNTER_P; let r = rnd() * tot;
  for (const [k, n] of pc) {
    if ((r -= n) >= 0) continue;
    const own = l => l.filter(c => opts.includes(c)), any = l => l.length ? l[Math.floor(rnd() * l.length)] : null;
    const safe = own(opts.filter(c => !(BEATS[k] || []).includes(c)));
    if (counter) return any(own(COUNTER[k])) || any(own(FALLBACK[k] || [])) || any(own(Object.keys(BEATS).filter(x => BEATS[x].includes(k)))) || any(safe) || HOLD;
    return any(safe) || HOLD;
  }
  return null;
}
