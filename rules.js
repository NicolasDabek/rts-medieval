// Règles de combat pures (sans three.js) : partagées par le jeu (units.js) et l'outil de duel (tools/duel.mjs)
export const BLD_PIERCE = 0.85; // armure perçante des bâtiments : -85 % contre les flèches
export const BLD_ARMOR = 2;     // armure fixe des bâtiments contre le reste
export const NO_UP = { atk: 0, arm: 0, projAtk: 0, range: 0 };
const soldier = def => def.cls && def.cls !== 'villager' && def.cls !== 'siege';
// def : attaquant ; up : améliorations de son camp ; tgt : { kind:'unit'|'building', def, up }
export function computeDamage(def, up, tgt) {
  up = up || NO_UP;
  const cls = tgt.kind === 'building' ? 'building' : tgt.def.cls;
  const atk = def.atk + (soldier(def) ? up.atk : 0) + (def.proj === 'arrow' && !def.cls ? up.projAtk : 0) + (def.bonus?.[cls] || 0);
  if (tgt.kind !== 'unit') { if (def.proj === 'arrow') return Math.max(0.5, Math.round(atk * (1 - BLD_PIERCE) * 10) / 10); return Math.max(1, atk - BLD_ARMOR); }
  // améliorations d'armure : +arm en mêlée ; contre les projectiles seulement pour les unités sans bouclier (ap < 3),
  // sinon le tirailleur (ap 4) devient intouchable aux flèches une fois l'armure au maximum
  const td = tgt.def, upArm = soldier(td) ? (tgt.up || NO_UP).arm : 0, arm = def.proj ? td.ap + (td.ap >= 3 ? 0 : upArm) : td.am + upArm;
  return Math.max(1, atk - arm);
}
// Balistique et Chimie : bâtiments défensifs seulement (tours, hôtel de ville) — sinon l'archer domine aux âges avancés (59–60 % de moyenne)
export const rangeWith = (def, up) => def.range + (def.proj === 'arrow' && !def.cls ? (up || NO_UP).range : 0);
// recul automatique (kiting) : seulement face à la mêlée proche, pendant le rechargement
export const KITE_DIST = 3.2, KITE_MIN_CD = 0.25;
export const shouldKite = (def, tDef, dist, cdT) => !!def.kite && !!tDef && tDef.range < 3 && tDef.cls !== 'siege' && dist < KITE_DIST && cdT > KITE_MIN_CD;
export const costOf = def => Object.values(def.cost || {}).reduce((a, b) => a + b, 0);
