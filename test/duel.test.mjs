// Échoue si une unité bat toutes les autres à coût égal (plusieurs budgets)
import { matrix, dominant } from '../tools/duel.mjs';
let fail = false;
for (const budget of [300, 600, 1200]) { const d = dominant(matrix(budget, 12)); console.log(`budget ${budget} : ${d.length ? 'DOMINANT ' + d.join(', ') : 'ok'}`); if (d.length) fail = true; }
if (fail) { console.error('ÉCHEC : une unité domine toutes les autres à coût égal'); process.exit(1); }
console.log('OK : aucune unité dominante');
