import { BUILD, UNIT, RES, TECHS, AGES } from './data.js';
import { st } from './state.js';
import { sfx, teams } from './config.js';
import { msg } from './ui.js';
import { ageUp, canPay, canTech, canTrain, cmdBuild, cmdGather, cmdMove, hdvOf, nearestRes, placeBuilding, popCap, popCount, queuedUnits, resTypeOf, research, train } from './units.js';
import { buildings, d2, extOf, free, rand, units } from './world.js';


// ================= IA =================
export const ai = { t: 0, think: 0, nextWave: 300, waveN: 0 };
export function aiSpotNear(p, r, minD, maxD, e = null) {
  for (let k = 0; k < 60; k++) { const a = rand(0, Math.PI * 2), d = rand(minD, maxD), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (free(x, z, r + 0.5, null, e && [e[0] + 0.5, e[1] + 0.5])) return [x, z]; }
  return null;
}
export function aiPlace(type, near, vills, n = 2) {
  const d = BUILD[type], h = hdvOf(1); if (!canPay(1, d.cost) || d.age > teams[1].age) return null;
  const rot = Math.floor(rand(0, 4)) * Math.PI / 2, nearH = !near || near === h.pos;
  const s = aiSpotNear(near || h.pos, d.radius, nearH ? 9 : d.radius + 2.5, nearH ? 24 : d.radius + 8, extOf(type, rot)); if (!s) return null;
  const b = placeBuilding(type, 1, s[0], s[1], rot);
  if (b) vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos)).slice(0, n).forEach(v => cmdBuild(v, b));
  return b;
}
export function aiDefend(src) {
  if (!st.D) return; const h = hdvOf(1); if (!h || d2(src.pos, h.pos) > 35) return;
  for (const s of units) if (s.team === 1 && s.def.cls !== 'villager' && !s.target && (!s.cmd || s.cmd.type !== 'attackMove')) cmdMove(s, src.pos, 'attackMove');
}
export const playerCls = c => units.filter(u => u.team === 0 && u.def.cls === c).length;
export function aiPickUnit(b) {
  const opts = Object.keys(UNIT).filter(k => UNIT[k].b === b.type && k !== 'villageois' && k !== 'heros' && !canTrain(b, k)); if (!opts.length) return null;
  const COUNTER = { cav: 'lancier', inf: 'archer', arch: 'cavalier', siege: 'cavalier' };
  const major = ['cav', 'inf', 'arch', 'siege'].map(c => [c, playerCls(c)]).sort((a, b) => b[1] - a[1])[0];
  if (major[1] >= 3 && opts.includes(COUNTER[major[0]]) && Math.random() < 0.7) return COUNTER[major[0]];
  if (b.type === 'atelier' && units.filter(u => u.team === 1 && u.def.cls === 'siege').length >= 2 + teams[1].age) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}
export function aiUpdate(dt) {
  ai.t += dt; ai.think -= dt; if (ai.think > 0) return; ai.think = 1;
  const T = teams[1]; RES.forEach((k, i) => T.res[k] += st.D.bonus[i]);
  const h = hdvOf(1); if (!h) return;
  const my = units.filter(u => u.team === 1), vills = my.filter(u => u.def.cls === 'villager'), army = my.filter(u => u.def.cls !== 'villager');
  const mine = buildings.filter(b => b.team === 1), has = t => mine.some(b => b.type === t), cnt = t => mine.filter(b => b.type === t).length;
  for (const b of mine.filter(b => !b.done)) if (vills.filter(v => v.cmd?.type === 'build' && v.cmd.b === b).length < 1) { const v = vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos))[0]; if (v) cmdBuild(v, b); }
  // répartition des villageois
  const want = T.age === 0 ? { nourriture: 0.5, bois: 0.35, or: 0.1, pierre: 0.05 } : { nourriture: 0.4, bois: 0.3, or: 0.2, pierre: 0.1 };
  const count = { nourriture: 0, bois: 0, or: 0, pierre: 0 }; vills.forEach(o => o.cmd?.type === 'gather' && o.cmd.res && count[resTypeOf(o.cmd.res)]++);
  for (const v of vills) if (!v.cmd) {
    let type = Object.keys(want).sort((a, b) => count[a] / want[a] - count[b] / want[b])[0], src = null;
    if (type === 'nourriture') {
      src = nearestRes('nourriture', h.pos, 35) || mine.find(b => b.def.farm && b.done && !units.some(o => o.cmd?.res === b));
      if (!src && has('moulin') && mine.filter(b => b.def.farm && !b.done).length < 2) { const m = mine.find(b => b.type === 'moulin'); const f = aiPlace('ferme', m.pos, [v], 1); if (f) { count.nourriture++; continue; } }
      if (!src) type = 'bois';
    }
    src = src || nearestRes(type, h.pos, 50) || nearestRes(type, h.pos) || nearestRes(null, h.pos);
    if (src) { cmdGather(v, src); count[resTypeOf(src)]++; }
  }
  const cap = popCap(1), pop = popCount(1), vmax = Math.round(st.D.vills * (0.55 + 0.15 * T.age));
  if (vills.length + queuedUnits(1, 'villageois') < vmax && !h.queue.length && pop < cap) train(h, 'villageois');
  if (pop >= cap - 3 && cap < 100 && !mine.some(b => b.type === 'maison' && !b.done)) aiPlace('maison', null, vills, 1);
  // ordre de construction
  const order = [['moulin', 3, () => nearestRes('nourriture', h.pos, 40)?.pos], ['camp_bois', 4, () => nearestRes('bois', h.pos, 45)?.pos], ['caserne', 6], ['camp_mine', 7, () => nearestRes('or', h.pos, 50)?.pos],
    ['archerie', 9], ['forge', 10], ['ecurie', 11], ['tour', 12], ['atelier', 14], ['universite', 16]];
  for (const [t, nv, near] of order) if (!has(t) && vills.length >= nv && BUILD[t].age <= T.age) { aiPlace(t, near?.(), vills); break; }
  if (T.age >= 1 && cnt('caserne') < st.D.barracks + (T.age >= 2 ? 1 : 0) && vills.length >= 12) aiPlace('caserne', null, vills);
  if (T.age >= 2 && cnt('tour') < 3 && Math.random() < 0.05) aiPlace('tour', null, vills, 1);
  const farms = mine.filter(b => b.def.farm).length, mo = mine.find(b => b.type === 'moulin' && b.done);
  if (mo && T.res.bois > 120 && farms < Math.ceil(vills.length * 0.4) && mine.filter(b => b.def.farm && !b.done).length < 2) aiPlace('ferme', mo.pos, vills, 1);
  // âges
  const need = Math.min([0, 9, 14, 18][T.age + 1] * st.D.ageK, vmax);
  if (T.age < 3 && vills.length >= need && ai.t >= st.D.ageT[T.age + 1] && !h.queue.length) ageUp(h);
  // technologies (si riche)
  if (Math.random() < 0.5) for (const b of mine) for (const id of Object.keys(TECHS)) if (!canTech(b, id) && Object.entries(TECHS[id].cost).every(([k, v]) => T.res[k] >= v * 1.3)) research(b, id);
  // armée
  const threatened = units.some(u => u.team === 0 && u.def.cls !== 'villager' && d2(u.pos, h.pos) < 30);
  const ageCost = T.age < 3 ? AGES[T.age + 1].cost : null, saving = ageCost && vills.length >= need * 0.8 && ai.t > st.D.ageT[T.age + 1] - 60;
  const armyCap = T.age === 0 ? st.D.base + 2 : 8 + T.age * 8 + ai.waveN * 2;
  for (const b of mine) if (b.done && b.queue.length < 2 && !['hdv', 'maison'].includes(b.type)) {
    const k = aiPickUnit(b); if (!k) continue; const c = UNIT[k].cost;
    const surplus = !saving || Object.entries(ageCost).every(([r, v]) => T.res[r] - (c[r] || 0) >= v);
    if (threatened || (surplus && army.length < armyCap)) train(b, k);
  }
  if (T.age >= 2 && !canTrain(h, 'heros') && T.res.or > 400) train(h, 'heros');
  const threat = units.find(u => u.team === 0 && d2(u.pos, h.pos) < 25); if (threat) aiDefend(threat);
  if (ai.t > ai.nextWave) {
    const idle = army.filter(s => !s.target && s.type !== 'heros' || (s.type === 'heros' && ai.waveN >= 2)), n = Math.min(idle.length, st.D.base + ai.waveN * st.D.grow);
    const eco = buildings.filter(b => b.team === 0 && b.done && ['moulin', 'camp_bois', 'camp_mine'].includes(b.type));
    const tgt = (ai.waveN > 0 && eco.length && Math.random() < 0.35 ? eco[Math.floor(Math.random() * eco.length)] : null) || hdvOf(0) || buildings.find(b => b.team === 0);
    if (n >= Math.min(3, st.D.base) && tgt) {
      idle.slice(0, n).forEach(s => cmdMove(s, tgt.pos, 'attackMove'));
      ai.waveN++; ai.nextWave = ai.t + Math.max(st.D.interval * 0.6, st.D.interval - ai.waveN * 10); msg(`⚔ Vague ennemie n°${ai.waveN} en approche (${n} unités) !`, 5000); sfx('horn');
    } else ai.nextWave = ai.t + 20;
  }
}
