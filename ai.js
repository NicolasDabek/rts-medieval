import { BUILD, UNIT, RES, TECHS, AGES } from './data.js';
import { st } from './state.js';
import { pickCounter, HOLD, COUNTER, COUNTER_P } from './aipick.js';
import { makeWave, pruneWave } from './wave.js';
import { sfx, teams } from './config.js';
import { msg } from './ui.js';
import { ageUp, canPay, canTech, canTrain, cmdBuild, cmdGather, cmdMove, hdvOf, nearestRes, placeBuilding, popCap, popCount, queuedUnits, resTypeOf, research, train } from './units.js';
import { buildings, d2, extOf, free, rand, units } from './world.js';


// ================= IA =================
export const ai = { t: 0, think: 0, nextWave: 300, waveN: 0, farmFail: 0 };
// vagues en cours (hors de `ai` : non sauvegardées, elles référencent des unités) — wave.js
export const waves = [];
export function aiSpotNear(p, r, minD, maxD, e = null) {
  for (let k = 0; k < 60; k++) { const a = rand(0, Math.PI * 2), d = rand(minD, maxD), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (free(x, z, r + 0.5, null, e && [e[0] + 0.5, e[1] + 0.5])) return [x, z]; }
  return null;
}
// range (optionnel) : [distance min, distance max] autour de `near` (repli des fermes, passe GD 14)
export function aiPlace(type, near, vills, n = 2, range = null) {
  const d = BUILD[type], h = hdvOf(1); if (!canPay(1, d.cost) || d.age > teams[1].age) return null;
  const rot = Math.floor(rand(0, 4)) * Math.PI / 2, nearH = !near || near === h.pos;
  const [r0, r1] = range || (nearH ? [9, 24] : [d.radius + 2.5, d.radius + 8]);
  const s = aiSpotNear(near || h.pos, d.radius, r0, r1, extOf(type, rot)); if (!s) return null;
  const b = placeBuilding(type, 1, s[0], s[1], rot);
  if (b) vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos)).slice(0, n).forEach(v => cmdBuild(v, b));
  return b;
}
// fermes (passe GD 14) : autour du moulin, sinon plus loin du moulin, sinon autour de l'hôtel de ville (dépôt de nourriture lui aussi) ;
// chaque échec complet est compté (ai.farmFail, affiché par le banc tools/ai-partie.html)
export function aiPlaceFarm(mill, vills) {
  const h = hdvOf(1), f = (mill && aiPlace('ferme', mill.pos, vills, 1)) || (mill && aiPlace('ferme', mill.pos, vills, 1, [6, 16])) || aiPlace('ferme', h.pos, vills, 1, [7, 18]);
  if (!f && canPay(1, BUILD.ferme.cost)) ai.farmFail++;
  return f;
}
// armée du joueur (hors villageois) : type dominant (≥ 3 unités) et bâtiments de son contre (COUNTER) — passe GD 14
export function playerArmy() { const e = {}; for (const u of units) if (u.team === 0 && u.def.cls !== 'villager') e[u.type] = (e[u.type] || 0) + 1; return e; }
export function dominantType(e = playerArmy()) { let k = null, n = 2; for (const [t, c] of Object.entries(e)) if (COUNTER[t] && c > n) { k = t; n = c; } return k; }
export const counterBuildings = k => k ? [...new Set(COUNTER[k].map(c => UNIT[c].b))].filter(b => b !== 'hdv') : [];
// bâtiments prioritaires : ceux du contre au type dominant, puis la forge (armure et attaque)
export const priorityBuildings = k => k ? [...counterBuildings(k), 'forge'] : [];
export function aiDefend(src) {
  if (!st.D) return; const h = hdvOf(1); if (!h || d2(src.pos, h.pos) > 35) return;
  for (const s of units) if (s.team === 1 && s.def.cls !== 'villager' && !s.target && (!s.cmd || s.cmd.type !== 'attackMove')) cmdMove(s, src.pos, 'attackMove');
}
export const playerCls = c => units.filter(u => u.team === 0 && u.def.cls === c).length;
// HOLD (aipick.js) : ce bâtiment ne forme rien d'utile contre l'armée du joueur, il attend — sauf si la base est menacée
export function aiPickUnit(b, threatened = false) {
  const opts = Object.keys(UNIT).filter(k => UNIT[k].b === b.type && k !== 'villageois' && k !== 'heros' && !canTrain(b, k)); if (!opts.length) return null;
  const enemy = {}; for (const u of units) if (u.team === 0) enemy[u.type] = (enemy[u.type] || 0) + 1;
  // passe GD 14 : un bâtiment de contre prévu (prioritaire, âge atteint ou en cours) ou en construction compte comme disponible :
  // la caserne attend au lieu de remplir la population d'épéistes de repli avant que l'écurie existe
  const T = teams[1], ageing = hdvOf(1)?.queue.some(q => q.kind === 'age'), planned = priorityBuildings(dominantType());
  const soon = k => { const bt = UNIT[k].b; return (buildings.some(o => o.team === 1 && o.type === bt && !o.done) || planned.includes(bt)) && UNIT[k].age <= T.age + (ageing ? 1 : 0) && BUILD[bt].age <= T.age + (ageing ? 1 : 0); };
  const avail = Object.keys(UNIT).filter(k => k !== 'villageois' && k !== 'heros' && (buildings.some(o => o.team === 1 && o.type === UNIT[k].b && !canTrain(o, k)) || soon(k)));
  const p = st.D.counterP ?? COUNTER_P;
  let c = pickCounter(enemy, opts, Math.random, p, st.D.safeRest ?? true, avail); if (c === HOLD) { if (!threatened) return null; c = null; }
  // passe GD 14 : en jeu, un bâtiment en attente (HOLD) retente chaque seconde, donc sa part « hors contre » (15 % des tirages)
  // finissait par remplir l'armée (épéistes contre des tirailleurs). Si le contre se forme ailleurs, une unité hors contre
  // n'est acceptée que tant que l'armée en compte moins de (1 − p) — Normal : 15 %, Facile : 50 %
  const dom = dominantType(), ctr = dom ? COUNTER[dom] : [];
  if (!threatened && dom && !ctr.includes(c) && avail.some(k => ctr.includes(k))) {
    const mine = units.filter(u => u.team === 1 && u.def.cls !== 'villager'), n = mine.length + queuedUnits(1) - queuedUnits(1, 'villageois');
    const off = n - mine.filter(u => ctr.includes(u.type)).length - ctr.reduce((s, k) => s + queuedUnits(1, k), 0);
    if ((off + 1) / (n + 1) > 1 - p) return null;
  }
  if (b.type === 'atelier' && units.filter(u => u.team === 1 && u.def.cls === 'siege').length >= 2 + teams[1].age) return null;
  return c || opts[Math.floor(Math.random() * opts.length)];
}
export function aiUpdate(dt) {
  ai.t += dt; ai.think -= dt; if (ai.think > 0) return; ai.think = 1;
  for (let i = waves.length - 1; i >= 0; i--) if (!pruneWave(waves[i], ai.t, u => u.cmd)) waves.splice(i, 1); // libération : mort, ordre changé, timeout
  const T = teams[1]; RES.forEach((k, i) => T.res[k] += st.D.bonus[i]);
  const h = hdvOf(1); if (!h) return;
  const my = units.filter(u => u.team === 1), vills = my.filter(u => u.def.cls === 'villager'), army = my.filter(u => u.def.cls !== 'villager');
  const mine = buildings.filter(b => b.team === 1), has = t => mine.some(b => b.type === t), cnt = t => mine.filter(b => b.type === t).length;
  for (const b of mine.filter(b => !b.done)) if (vills.filter(v => v.cmd?.type === 'build' && v.cmd.b === b).length < 1) { const v = vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos))[0]; if (v) cmdBuild(v, b); }
  // répartition des villageois
  const want = T.age === 0 ? { nourriture: 0.5, bois: 0.35, or: 0.1, pierre: 0.05 } : { nourriture: 0.4, bois: 0.3, or: 0.2, pierre: 0.1 };
  // passe GD 14 : l'or (et la pierre) s'entassaient (700–1400 d'or à 600 s) pendant que le bois manquait (écurie, forge, fermes) :
  // au-delà d'un stock, leur part va au bois et à la nourriture, et un récolteur par seconde est réaffecté
  const glut = { or: 500, pierre: 300, nourriture: 700 };
  for (const [k, lim] of Object.entries(glut)) if (T.res[k] > lim) { const to = k === 'nourriture' ? { bois: 0.7, or: 0.3 } : { bois: 0.6, nourriture: 0.4 }; for (const [r, f] of Object.entries(to)) want[r] += want[k] * f; want[k] = 0.001; }
  const count = { nourriture: 0, bois: 0, or: 0, pierre: 0 }; vills.forEach(o => o.cmd?.type === 'gather' && o.cmd.res && count[resTypeOf(o.cmd.res)]++);
  for (const [k, lim] of Object.entries(glut)) if (T.res[k] > lim) { const v = vills.find(o => o.cmd?.type === 'gather' && o.cmd.res && resTypeOf(o.cmd.res) === k && o.cmd.res.kind !== 'building'); if (v) { v.cmd = null; count[k]--; break; } }
  for (const v of vills) if (!v.cmd) {
    let type = Object.keys(want).sort((a, b) => count[a] / want[a] - count[b] / want[b])[0], src = null;
    if (type === 'nourriture') {
      src = nearestRes('nourriture', h.pos, 35) || mine.find(b => b.def.farm && b.done && !units.some(o => o.cmd?.res === b));
      if (!src && has('moulin') && mine.filter(b => b.def.farm && !b.done).length < 2) { const m = mine.find(b => b.type === 'moulin'); const f = aiPlaceFarm(m, [v]); if (f) { count.nourriture++; continue; } }
      if (!src) type = 'bois';
    }
    src = src || nearestRes(type, h.pos, 50) || nearestRes(type, h.pos) || nearestRes(null, h.pos);
    if (src) { cmdGather(v, src); count[resTypeOf(src)]++; }
  }
  const cap = popCap(1), pop = popCount(1), vmax = Math.round(st.D.vills * (0.55 + 0.15 * T.age));
  if (vills.length + queuedUnits(1, 'villageois') < vmax && !h.queue.length && pop < cap) train(h, 'villageois');
  if (pop >= cap - 3 && cap < 100 && !mine.some(b => b.type === 'maison' && !b.done)) aiPlace('maison', null, vills, 1);
  // ordre de construction — passe GD 14 : réactif. Les bâtiments du contre au type dominant du joueur (puis la forge) passent devant,
  // avec une réserve de ressources (comme l'épargne pour l'âge, y compris pendant la recherche de l'âge qui les débloque) ;
  // un bâtiment non prioritaire trop cher ne bloque plus la suite de l'ordre.
  const ageing = h.queue.some(q => q.kind === 'age'), reachable = t => BUILD[t].age <= T.age + (ageing ? 1 : 0);
  const prio = priorityBuildings(dominantType()).filter(t => !has(t) && reachable(t));
  const reserve = prio.length ? { ...BUILD[prio[0]].cost } : {};
  const afford = c => Object.entries(c).every(([r, v]) => T.res[r] - v >= (reserve[r] || 0));
  if (prio.length && BUILD[prio[0]].age <= T.age) aiPlace(prio[0], null, vills);
  const order = [['moulin', 3, () => nearestRes('nourriture', h.pos, 40)?.pos], ['camp_bois', 4, () => nearestRes('bois', h.pos, 45)?.pos], ['caserne', 6], ['camp_mine', 7, () => nearestRes('or', h.pos, 50)?.pos],
    ['archerie', 9], ['forge', 10], ['ecurie', 11], ['tour', 12], ['atelier', 14], ['universite', 16]];
  for (const [t, nv, near] of order) if (!has(t) && vills.length >= nv && BUILD[t].age <= T.age && !prio.includes(t)) { if (afford(BUILD[t].cost) && aiPlace(t, near?.(), vills)) break; }
  if (T.age >= 1 && cnt('caserne') < st.D.barracks + (T.age >= 2 ? 1 : 0) && vills.length >= 12 && afford(BUILD.caserne.cost)) aiPlace('caserne', null, vills);
  if (T.age >= 2 && cnt('tour') < 3 && Math.random() < 0.05 && afford(BUILD.tour.cost)) aiPlace('tour', null, vills, 1);
  // fermes : 40 % des villageois + 1 d'avance (une ferme s'épuise), jusqu'à 3 chantiers, hors réserve si la nourriture < 300,
  // plus de seuil de 120 de bois ; repli de placement (aiPlaceFarm)
  const farms = mine.filter(b => b.def.farm).length, mo = mine.find(b => b.type === 'moulin' && b.done);
  if (mo && farms < Math.ceil(vills.length * 0.4) + 1 && mine.filter(b => b.def.farm && !b.done).length < 3 && (T.res.nourriture < 300 || afford(BUILD.ferme.cost))) aiPlaceFarm(mo, vills);
  // tant qu'il manque des fermes, le bois d'une ferme est réservé (avant les unités et les technologies)
  if (mo && mine.filter(b => b.def.farm).length < Math.ceil(vills.length * 0.4)) reserve.bois = (reserve.bois || 0) + BUILD.ferme.cost.bois;
  // âges
  const need = Math.min([0, 9, 14, 18][T.age + 1] * st.D.ageK, vmax);
  if (T.age < 3 && vills.length >= need && ai.t >= st.D.ageT[T.age + 1] && !h.queue.length) ageUp(h);
  // technologies (si riche)
  if (Math.random() < 0.5) for (const b of mine) for (const id of Object.keys(TECHS)) if (!canTech(b, id) && Object.entries(TECHS[id].cost).every(([k, v]) => T.res[k] - (reserve[k] || 0) >= v * 1.3)) research(b, id);
  // armée
  const threatened = units.some(u => u.team === 0 && u.def.cls !== 'villager' && d2(u.pos, h.pos) < 30);
  const ageCost = T.age < 3 ? AGES[T.age + 1].cost : null, saving = ageCost && vills.length >= need * 0.8 && ai.t > st.D.ageT[T.age + 1] - 60;
  const armyCap = T.age === 0 ? st.D.base + 2 : 8 + T.age * 8 + ai.waveN * 2;
  // passe GD 14 : armée pleine avec moins de 30 % d'unités de contre → seules les unités de contre dépassent le plafond (+4 au plus)
  const dom = dominantType(), ctr = dom ? COUNTER[dom] : [], ctrN = army.filter(u => ctr.includes(u.type)).length + ctr.reduce((s, k) => s + queuedUnits(1, k), 0);
  const armyN = army.length + Object.keys(UNIT).filter(k => k !== 'villageois').reduce((s, k) => s + queuedUnits(1, k), 0);
  const overCap = k => dom && ctr.includes(k) && ctrN < 0.3 * Math.max(armyN, 1) && armyN < armyCap + 4;
  for (const b of mine) if (b.done && b.queue.length < 2 && !['hdv', 'maison'].includes(b.type)) {
    const k = aiPickUnit(b, threatened); if (!k) continue; const c = UNIT[k].cost;
    const surplus = (!saving || Object.entries(ageCost).every(([r, v]) => T.res[r] - (c[r] || 0) >= v)) && afford(c);
    if (threatened || (surplus && (army.length < armyCap || overCap(k)))) train(b, k);
  }
  if (T.age >= 2 && !canTrain(h, 'heros') && T.res.or > 400) train(h, 'heros');
  const threat = units.find(u => u.team === 0 && d2(u.pos, h.pos) < 25); if (threat) aiDefend(threat);
  // merveille : l'IA attaque celle du joueur en priorité (tout de suite si elle est finie) et en lance une en Difficile
  const pW = buildings.find(b => b.team === 0 && b.def.wonder);
  if (pW && pW.done && !ai.wonderRush) { ai.wonderRush = true; ai.nextWave = Math.min(ai.nextWave, ai.t); }
  if (pW && pW.done) army.filter(s => !s.target && (!s.cmd || s.cmd.type !== 'attackMove')).forEach(s => cmdMove(s, pW.pos, 'attackMove'));
  if (st.D.label === 'Difficile' && ai.t > 1500 && T.age >= 3 && !has('merveille') && RES.reduce((s, k) => s + T.res[k], 0) >= 3000) aiPlace('merveille', null, vills, 6);
  if (ai.t > ai.nextWave) {
    // vague : unités libres seulement — un attackMove déjà lancé (vague précédente, défense, merveille) n'est pas réaffecté
    const idle = army.filter(s => !s.target && !s.wave && s.cmd?.type !== 'attackMove' && (s.type !== 'heros' || ai.waveN >= 2)), n = Math.min(idle.length, st.D.base + ai.waveN * st.D.grow);
    const eco = buildings.filter(b => b.team === 0 && b.done && ['moulin', 'camp_bois', 'camp_mine'].includes(b.type));
    const wonder = buildings.find(b => b.team === 0 && b.def.wonder);
    const tgt = wonder || (ai.waveN > 0 && eco.length && Math.random() < 0.35 ? eco[Math.floor(Math.random() * eco.length)] : null) || hdvOf(0) || buildings.find(b => b.team === 0);
    if (n >= Math.min(3, st.D.base) && tgt) {
      const members = idle.slice(0, n); members.forEach(s => cmdMove(s, tgt.pos, 'attackMove'));
      if (st.D.grouped !== false) { const w = makeWave(members, ai.t, u => u.cmd); w.dest = tgt.pos.clone(); waves.push(w); } // attaque groupée (wave.js) ; Facile : non groupée
      ai.waveN++; ai.nextWave = ai.t + Math.max(st.D.interval * 0.6, st.D.interval - ai.waveN * 10); msg(`⚔ Vague ennemie n°${ai.waveN} en approche (${n} unités) !`, 5000); sfx('horn');
    } else ai.nextWave = ai.t + 20;
  }
}
