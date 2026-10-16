// Sauvegarde / chargement dans localStorage
import { DIFFS } from './data.js';
export const KEY = 'rts-medieval-save';
const r1 = v => Math.round(v * 100) / 100;
export function serialize(g) {
  let exp = ''; for (let i = 0; i < g.explored.length; i++) exp += g.explored[i] ? '1' : '0';
  return JSON.stringify({
    v: 1, date: Date.now(), time: g.gameTime, D: Object.keys(DIFFS).find(k => DIFFS[k] === g.D) || 'normal', ai: { ...g.ai },
    teams: g.teams.map(t => ({ res: t.res, age: t.age, techs: [...t.techs] })),
    res: g.resources.map(r => [r.sub, r1(r.pos.x), r1(r.pos.z), r.amount]),
    buildings: g.buildings.map(b => ({ t: b.type, tm: b.team, x: r1(b.pos.x), z: r1(b.pos.z), r: b.rot, hp: b.hp, mh: b.maxHp, d: b.done, p: b.progress, a: b.amount, q: b.queue, tt: b.trainT, s: b.seen })),
    units: g.units.map(u => [u.type, u.team, r1(u.pos.x), r1(u.pos.z), u.hp, u.carry, u.carryType]),
    exp,
  });
}
export function loadInto(g, s) {
  s.teams.forEach((t, i) => { t.techs.forEach(id => g.applyTech(i, id)); Object.assign(g.teams[i].res, t.res); g.teams[i].age = t.age; });
  for (const [sub, x, z, a] of s.res) g.addResource(sub, x, z, a);
  for (const o of s.buildings) {
    const b = g.addBuilding(o.t, o.tm, o.x, o.z, o.d, o.r, true);
    Object.assign(b, { hp: o.hp, maxHp: o.mh, progress: o.p, queue: o.q || [], trainT: o.tt || 0, seen: o.s });
    if (o.a !== undefined && o.a !== null) b.amount = o.a; b.inner.scale.y = 0.1 + 0.9 * o.p;
  }
  for (const [t, tm, x, z, hp, c, ct] of s.units) { const u = g.addUnit(t, tm, x, z); u.hp = hp; u.carry = c || 0; u.carryType = ct || null; }
  Object.assign(g.ai, s.ai); g.gameTime = s.time; g.D = DIFFS[s.D]; g.started = true;
  for (let i = 0; i < s.exp.length; i++) g.explored[i] = s.exp.charCodeAt(i) === 49 ? 1 : 0;
  g.rebuildGrid();
}
