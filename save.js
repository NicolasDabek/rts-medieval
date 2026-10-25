// Sauvegarde / chargement dans localStorage
import { DIFFS } from './data.js';
export const KEY = 'rts-medieval-save';
const r1 = v => Math.round(v * 100) / 100;
// référence d'entité -> ['u'|'b'|'r', index] (les ordres pointent vers d'autres entités)
const refOf = (g, e) => { if (!e || e.dead) return null; const l = { unit: ['u', g.units], building: ['b', g.buildings], resource: ['r', g.resources] }[e.kind]; if (!l) return null; const i = l[1].indexOf(e); return i < 0 ? null : [l[0], i]; };
const deref = (g, r) => r ? ({ u: g.units, b: g.buildings, r: g.resources })[r[0]][r[1]] || null : null;
const cmdOf = (g, u) => { const c = u.cmd; if (!c) return null; return { ty: c.type, d: c.dest ? [r1(c.dest.x), r1(c.dest.z)] : null, e: refOf(g, c.res || c.b || c.target), st: u.state, tg: refOf(g, u.target) }; };
export function serialize(g) {
  let exp = ''; for (let i = 0; i < g.explored.length; i++) exp += g.explored[i] ? '1' : '0';
  return JSON.stringify({
    v: 2, date: Date.now(), time: g.gameTime, D: Object.keys(DIFFS).find(k => DIFFS[k] === g.D) || 'normal', ai: { ...g.ai },
    teams: g.teams.map(t => ({ res: t.res, age: t.age, techs: [...t.techs], st: t.stats })),
    res: g.resources.map(r => [r.sub, r1(r.pos.x), r1(r.pos.z), r.amount, r.hunted ? 1 : 0]),
    buildings: g.buildings.map(b => ({ t: b.type, tm: b.team, x: r1(b.pos.x), z: r1(b.pos.z), r: b.rot, hp: b.hp, mh: b.maxHp, d: b.done, p: b.progress, a: b.amount, q: b.queue, tt: b.trainT, s: b.seen, wt: b.wonderT, ra: b.rally ? [r1(b.rally.pos.x), r1(b.rally.pos.z), refOf(g, b.rally.res)] : null })),
    units: g.units.map(u => [u.type, u.team, r1(u.pos.x), r1(u.pos.z), u.hp, u.carry, u.carryType, cmdOf(g, u)]),
    exp,
  });
}
export function loadInto(g, s) {
  s.teams.forEach((t, i) => { t.techs.forEach(id => g.applyTech(i, id)); Object.assign(g.teams[i].res, t.res); g.teams[i].age = t.age; if (t.st) g.teams[i].stats = { ...t.st }; });
  for (const [sub, x, z, a] of s.res) g.addResource(sub, x, z, a, true);
  for (const o of s.buildings) {
    const b = g.addBuilding(o.t, o.tm, o.x, o.z, o.d, o.r, true);
    Object.assign(b, { hp: o.hp, maxHp: o.mh, progress: o.p, queue: o.q || [], trainT: o.tt || 0, seen: o.s }); if (o.wt !== undefined && o.wt !== null) b.wonderT = o.wt;
    if (o.a !== undefined && o.a !== null) b.amount = o.a; b.inner.scale.y = 0.1 + 0.9 * o.p;
  }
  for (const [t, tm, x, z, hp, c, ct] of s.units) { const u = g.addUnit(t, tm, x, z); u.hp = hp; u.carry = c || 0; u.carryType = ct || null; }
  for (const r of s.res) if (r[4]) { const o = g.resources[s.res.indexOf(r)]; o.hunted = true; o.mesh.rotation.z = Math.PI / 2; o.mesh.position.y = 0.35; }
  g.rebuildGrid(); // la grille doit exister avant de recalculer les chemins
  // ordres : récolte / construction / attaque / déplacement + ralliements
  s.buildings.forEach((o, i) => { if (o.ra) g.rallyAt(g.buildings[i], new g.THREE.Vector3(o.ra[0], 0, o.ra[1]), deref(g, o.ra[2])); });
  s.units.forEach((a, i) => {
    const c = a[7], u = g.units[i]; if (!c) return; const e = deref(g, c.e);
    if (c.ty === 'gather' && e) { g.cmdGather(u, e); if (c.st === 'toDrop' || c.st === 'gather') u.state = c.st; if (c.st === 'gather') u.path = []; }
    else if (c.ty === 'gather') u.cmd = { type: 'gather', res: null };
    else if (c.ty === 'build' && e) g.cmdBuild(u, e);
    else if (c.ty === 'attack' && e) g.cmdAttack(u, e);
    else if (c.d) { g.cmdMove(u, new g.THREE.Vector3(c.d[0], 0, c.d[1]), c.ty); const tg = deref(g, c.tg); if (tg) u.target = tg; }
  });
  Object.assign(g.ai, s.ai); g.gameTime = s.time; g.D = DIFFS[s.D]; g.started = true;
  for (let i = 0; i < s.exp.length; i++) g.explored[i] = s.exp.charCodeAt(i) === 49 ? 1 : 0;
  g.rebuildGrid();
}
