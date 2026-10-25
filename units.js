import { BLD_PIERCE, computeDamage, rangeWith, shouldKite } from './rules.js';
import { AGES, UNIT, TECHS, BUILD } from './data.js';
import * as THREE from 'three';
import { st } from './state.js';
import { aiDefend } from './ai.js';
import { HALF, sfx, teams } from './config.js';
import { isVis } from './map.js';
import { N, findPath, freeSlot, gridT, los, moveTo, rebuildGrid, toCell } from './path.js';
import { G, mat, scene } from './render.js';
import { announce, endGame, gameOver, msg } from './ui.js';
import { addBuilding, addUnit, arrows, buildings, d2, edgeD, extOf, free, rand, resources, units, wallFree } from './world.js';


// ================= Économie =================
export const canPay = (t, c) => Object.entries(c || {}).every(([k, v]) => teams[t].res[k] >= v);
export const pay = (t, c) => Object.entries(c || {}).forEach(([k, v]) => teams[t].res[k] -= v);
export const refund = (t, c) => Object.entries(c || {}).forEach(([k, v]) => teams[t].res[k] += v);
export const popCap = t => Math.min(100, buildings.reduce((s, b) => s + (b.team === t && b.done ? (b.def.pop || 0) : 0), 0));
export const queuedUnits = (t, type) => buildings.reduce((s, b) => s + (b.team === t ? b.queue.filter(q => q.kind === 'unit' && (!type || q.id === type)).length : 0), 0);
export const popCount = t => units.filter(u => u.team === t).length + queuedUnits(t);
export const hdvOf = t => buildings.find(b => b.team === t && b.type === 'hdv');
export const resTypeOf = r => r.kind === 'building' ? 'nourriture' : r.type;
export function dropFor(t, type, p) { let best = null, bd = 1e9; for (const b of buildings) if (b.team === t && b.done && b.def.drop?.includes(type)) { const d = edgeD(p, b); if (d < bd) { bd = d; best = b; } } return best; }
export function nearestRes(type, p, max = 1e9) { let b = null, bd = max; for (const r of resources) { const d = d2(r.pos, p); if ((!type || r.type === type) && d < bd) { bd = d; b = r; } } return b; }
export const inQueue = (t, kind, id) => buildings.some(b => b.team === t && b.queue.some(q => q.kind === kind && (id === undefined || q.id === id)));
export const ageLock = a => '🔒 ' + AGES[a].name;
export function canTrain(b, type) {
  const d = UNIT[type], T = teams[b.team];
  if (d.b !== b.type) return 'x'; if (d.age > T.age) return ageLock(d.age); if (!b.done) return 'En construction';
  if (d.limit && units.filter(u => u.team === b.team && u.type === type).length + queuedUnits(b.team, type) >= d.limit) return 'Limite atteinte';
  if (b.queue.length >= 5) return 'File pleine'; if (popCount(b.team) >= popCap(b.team)) return 'Population max : construisez des maisons';
  if (!canPay(b.team, d.cost)) return 'Ressources insuffisantes'; return null;
}
export function train(b, type) { if (canTrain(b, type)) return false; const d = UNIT[type]; pay(b.team, d.cost); enqueue(b, { kind: 'unit', id: type, time: d.time * (d.cls === 'villager' ? 1 : teams[b.team].up.train), cost: d.cost }); return true; }
export function canTech(b, id) {
  const t = TECHS[id], T = teams[b.team];
  if (t.b !== b.type || T.techs.has(id) || inQueue(b.team, 'tech', id) || (t.req && !T.techs.has(t.req))) return 'x';
  if (t.age > T.age) return ageLock(t.age); if (!b.done) return 'En construction'; if (b.queue.length >= 5) return 'File pleine';
  if (!canPay(b.team, t.cost)) return 'Ressources insuffisantes'; return null;
}
export function research(b, id) { if (canTech(b, id)) return false; const t = TECHS[id]; pay(b.team, t.cost); enqueue(b, { kind: 'tech', id, time: t.time, cost: t.cost }); return true; }
export function canAge(b) {
  const T = teams[b.team]; if (b.type !== 'hdv' || T.age >= 3 || inQueue(b.team, 'age')) return 'x';
  if (!b.done) return 'En construction';
  if (T.age === 0 && !buildings.some(o => o.team === b.team && o.done && !['hdv', 'maison', 'ferme'].includes(o.type) && !o.def.wall)) return '🔒 1 bâtiment (moulin, camp ou caserne)';
  if (!canPay(b.team, AGES[T.age + 1].cost)) return 'Ressources insuffisantes'; return null;
}
export function ageUp(b) { if (canAge(b)) return false; const T = teams[b.team], a = AGES[T.age + 1]; pay(b.team, a.cost); enqueue(b, { kind: 'age', id: T.age + 1, time: a.time, cost: a.cost }); return true; }
export function enqueue(b, item) { b.queue.push(item); if (b.queue.length === 1) b.trainT = item.time; }
export function applyTech(team, id) {
  const T = teams[team], U = T.up; T.techs.add(id);
  switch (id) {
    case 'brouette': U.vspeed = 1.15; U.cap += 5; break;
    case 'hache': U.gather.bois *= 1.2; break;
    case 'pioche': U.gather.or *= 1.2; U.gather.pierre *= 1.2; break;
    case 'collier': case 'charrue': U.gather.nourriture *= 1.15; U.farm += 100; break;
    case 'forge1': case 'forge2': U.atk += 1; break; case 'forge3': U.atk += 2; break;
    case 'armure1': case 'armure2': U.arm += 1; break; case 'armure3': U.arm += 2; break;
    case 'maconnerie': U.bhp *= 1.2; for (const b of buildings) if (b.team === team) { b.maxHp = Math.round(b.maxHp * 1.2); b.hp *= 1.2; } break;
    case 'balistique': U.range += 2; break;
    case 'chimie': U.projAtk += 1; break;
    case 'conscription': U.train = 0.75; break;
  }
}
export function placeBuilding(type, team, x, z, rot = 0) {
  const S = BUILD[type]; if (!canPay(team, S.cost)) return null;
  if (S.gate) { // une porte remplace les segments de mur qu'elle recouvre
    const own = o => o.def.wall && o.team === team;
    if (!free(x, z, S.radius, own, extOf(type, rot))) return null;
    buildings.filter(o => own(o) && d2(o.pos, { x, z }) < S.radius + 0.3).forEach(w => kill(w, true));
  } else if (!free(x, z, S.radius, null, extOf(type, rot))) return null;
  pay(team, S.cost); return addBuilding(type, team, x, z, false, rot);
}
export function placeWall(type, team, a, b) {
  const S = BUILD[type], len = d2(a, b), n = Math.max(1, Math.round(len)), rot = -Math.atan2(b.z - a.z, b.x - a.x), out = [];
  for (let i = 0; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
    if (!canPay(team, S.cost)) break; if (!wallFree(x, z)) continue;
    pay(team, S.cost); out.push(addBuilding(type, team, x, z, false, rot, true));
  }
  rebuildGrid(); return out;
}

// ================= Commandes =================
export function cmdGather(u, r) { u.cmd = { type: 'gather', res: r }; u.state = 'toRes'; u.target = null; moveTo(u, r.pos); }
export function cmdBuild(u, b) { u.cmd = { type: 'build', b }; u.target = null; moveTo(u, b.pos); }
export function cmdAttack(u, e) { u.cmd = { type: 'attack', target: e }; u.target = e; u.path = []; u.repathT = 0; }
export function cmdMove(u, p, type = 'move') { u.cmd = { type, dest: p.clone() }; u.target = null; moveTo(u, p); }
export function formation(sel, p, type) {
  const cols = Math.ceil(Math.sqrt(sel.length)), used = new Set();
  const c = sel.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).divideScalar(sel.length);
  const dir = new THREE.Vector3(p.x - c.x, 0, p.z - c.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  // mêlée devant, distance/siège derrière
  const rank = u => u.def.cls === 'siege' ? 2 : u.def.cls === 'arch' ? 1 : 0;
  const order = [...sel].sort((a, b) => rank(a) - rank(b) || side.dot(a.pos) - side.dot(b.pos));
  order.forEach((u, i) => {
    const col = i % cols - (cols - 1) / 2, row = Math.floor(i / cols);
    cmdMove(u, freeSlot(p.clone().addScaledVector(side, col * 1.8).addScaledVector(dir, -row * 1.8), used, u.team), type);
  });
}

// ================= Combat =================
export const clsOf = t => t.kind === 'building' ? 'building' : t.def.cls;
export function calcDmg(def, team, t) { return computeDamage(def, teams[team].up, { kind: t.kind, def: t.def, up: t.kind === 'unit' ? teams[t.team].up : null }); }
export const rangeOf = (def, team) => rangeWith(def, teams[team].up);
export function nearestEnemy(u, r, buildingsOnly = false) {
  let best = null, bd = r;
  if (!buildingsOnly) for (const o of units) if (o.team !== u.team) { const d = d2(o.pos, u.pos) - o.radius; if (d < bd) { bd = d; best = o; } }
  if (best) return best;
  for (const b of buildings) if (b.team !== u.team) { const d = edgeD(u.pos, b); if (d < bd) { bd = d; best = b; } }
  return best;
}
export const stoneGeo = new THREE.SphereGeometry(0.35, 6, 5);
export function shoot(from, to, kind = 'arrow') {
  const m = new THREE.Mesh(kind === 'stone' ? stoneGeo : G.arrow, mat(kind === 'stone' ? 0x666666 : 0x5a3a1a)); scene.add(m);
  arrows.push({ m, a: from.clone().setY(kind === 'stone' ? 1.8 : 1.4), b: to.clone().setY(1), t: 0, dur: Math.max(0.15, d2(from, to) / (kind === 'stone' ? 18 : 30)), arc: kind === 'stone' ? 5 : 1.5 });
  if (isVis(from) || isVis(to)) sfx(kind === 'stone' ? 'catapult' : 'arrow', from);
}
export function hit(src, srcDef, srcTeam, t) {
  damage(t, calcDmg(srcDef, srcTeam, t), src);
  if (srcDef.splash) for (const o of [...units, ...buildings]) if (o !== t && o.team !== srcTeam && !o.dead && d2(o.pos, t.pos) < srcDef.splash + o.radius) damage(o, calcDmg(srcDef, srcTeam, o) * 0.5, src);
}
export function damage(t, dmg, src) {
  if (t.dead) return; t.hp -= dmg; t.lastHit = st.gameTime;
  if (t.kind === 'unit' && src && src.kind === 'unit' && !src.dead && !t.target && t.def.aggro && (!t.cmd || t.cmd.type !== 'move') && !(t.def.siegeOnly)) t.target = src;
  if (t.team === 1 && src && src.kind === 'unit') aiDefend(src);
  if (t.hp <= 0) kill(t);
}
// statistiques de partie (écran de fin)
export const stats = t => teams[t].stats || (teams[t].stats = { trained: 0, lost: 0, killed: 0, gathered: 0 });
export function kill(e, silent = false) {
  if (e.dead) return; e.dead = true; if (e.kind === 'unit') { stats(e.team).lost++; stats(1 - e.team).killed++; } scene.remove(e.mesh); if (e.bar) scene.remove(e.bar); if (e.flag) scene.remove(e.flag);
  const arr = e.kind === 'unit' ? units : e.kind === 'building' ? buildings : resources; const i = arr.indexOf(e); if (i >= 0) arr.splice(i, 1);
  if (e.kind !== 'unit' && !silent) rebuildGrid();
  if (e === st.selBuilding) st.selBuilding = null;
  if (!silent && e.kind !== 'resource' && isVis(e.pos)) sfx(e.kind === 'building' ? 'collapse' : 'die', e.pos);
  if (e.kind === 'building' && e.type === 'hdv' && !hdvOf(e.team)) endGame(e.team === 1);
}

// ================= Unités =================
export const RES_COLORS = { bois: 0x6b4423, pierre: 0x8a8a8a, or: 0xe0b630, nourriture: 0xc0203a };
export function pushOut(u, o) {
  if (o.ext) { // rectangle : sortie par l'axe de moindre pénétration
    const m = u.radius * 0.8, dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, px = o.ext[0] + m - Math.abs(dx), pz = o.ext[1] + m - Math.abs(dz);
    if (px > 0 && pz > 0) { if (px < pz) u.pos.x += Math.sign(dx || 1) * px; else u.pos.z += Math.sign(dz || 1) * pz; }
    return;
  } const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.radius + u.radius * 0.8; if (d < m && d > 1e-4) { u.pos.x = o.pos.x + dx / d * m; u.pos.z = o.pos.z + dz / d * m; } }
export function nextJob(u, b) { // après une construction : chantier voisin, ferme, ou ressource du camp
  const nb = buildings.filter(o => o.team === u.team && !o.done && d2(o.pos, u.pos) < 25).sort((a, c) => d2(a.pos, u.pos) - d2(c.pos, u.pos))[0];
  if (nb) return cmdBuild(u, nb);
  if (b.def.farm && !b.dead) return cmdGather(u, b);
  if (b.def.drop && b.type !== 'hdv') { const r = nearestRes(b.def.drop[0], b.pos, 18); if (r) return cmdGather(u, r); }
  u.cmd = null;
}
export function updateUnit(u, dt) {
  const S = u.def, T = teams[u.team]; u.cdT -= dt;
  if (S.regen && u.hp < u.maxHp && st.gameTime - (u.lastHit || -99) > 5) u.hp = Math.min(u.maxHp, u.hp + S.regen * dt);
  if (!u.target && S.aggro && (!u.cmd || u.cmd.type === 'attackMove')) { u.scanT -= dt; if (u.scanT <= 0) { u.scanT = 0.4; const t = nearestEnemy(u, S.aggro, S.siegeOnly); if (t) { u.target = t; u.repathT = 0; } } }
  if (u.target) {
    const t = u.target;
    if (t.dead) { u.target = null; u.path = []; if (u.cmd?.type === 'attack') u.cmd = null; else if (u.cmd?.type === 'attackMove') moveTo(u, u.cmd.dest); }
    else {
      const d = edgeD(u.pos, t), rng = rangeOf(S, u.team);
      const kite = t.kind === 'unit' && shouldKite(S, t.def, d, u.cdT);
      if (kite) { // recule entre deux tirs face à la mêlée
        const ax = u.pos.x - t.pos.x, az = u.pos.z - t.pos.z, al = Math.hypot(ax, az) || 1, st = S.speed * dt;
        const nx = u.pos.x + ax / al * st, nz = u.pos.z + az / al * st, [cx, cz] = toCell({ x: nx, z: nz });
        if (!gridT[u.team][cx + cz * N] && Math.abs(nx) < HALF - 1 && Math.abs(nz) < HALF - 1) { u.pos.x = nx; u.pos.z = nz; u.path = []; }
      } else if (d <= rng) {
        u.path = []; u.mesh.rotation.y = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z);
        if (u.cdT <= 0) {
          u.cdT = S.cd;
          if (S.proj) shoot(u.pos, t.pos, S.proj); else { u.body.rotation.x = 0.4; if (isVis(u.pos)) sfx(S.cls === 'siege' ? 'ram' : 'hit', u.pos); }
          hit(u, S, u.team, t);
        }
      } else if (u.cmd?.type !== 'attack' && d > S.aggro * 1.8) { u.target = null; if (u.cmd?.type === 'attackMove') moveTo(u, u.cmd.dest); else u.path = []; }
      else { u.repathT -= dt; if (u.repathT <= 0 || !u.path.length) { u.repathT = 0.8; u.path = los(u.pos, t.pos, u.team) ? [t.pos.clone()] : findPath(u.pos, t.pos, u.team); } }
    }
  }
  u.body.rotation.x *= 0.85;
  // déplacement avec évitement local
  let moving = false;
  if (u.path.length) {
    const p = u.path[0], dx = p.x - u.pos.x, dz = p.z - u.pos.z, len = Math.hypot(dx, dz);
    const last = u.path.length === 1;
    if (len < 0.3 || (last && len < 1.6 && units.some(o => o !== u && !o.path.length && d2(o.pos, p) < 0.8))) u.path.shift();
    else {
      let nx = dx / len, nz = dz / len, ax = 0, az = 0;
      for (const o of units) {
        if (o === u) continue; const ox = o.pos.x - u.pos.x, oz = o.pos.z - u.pos.z, dd = ox * ox + oz * oz; if (dd > 2.6 || dd < 1e-6) continue;
        const dl = Math.sqrt(dd), ahead = (ox * nx + oz * nz) / dl; if (ahead < 0.3) continue;
        const sg = (ox * -nz + oz * nx) > 0 ? -1 : 1, w = (1.6 - dl) / 1.6 * (o.path.length ? 0.5 : 1.2);
        ax += -nz * sg * w; az += nx * sg * w;
      }
      nx += ax; nz += az; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const sp = S.speed * (S.cls === 'villager' ? T.up.vspeed : 1);
      const st = Math.min(len, sp * dt); u.pos.x += nx * st; u.pos.z += nz * st; u.mesh.rotation.y = Math.atan2(nx, nz); moving = true;
    }
  }
  u.chkT = (u.chkT || 0) + dt; // détection de blocage
  if (u.chkT > 1) {
    if (u.path.length && u.lastChk && d2(u.pos, u.lastChk) < S.speed * 0.15) {
      u.stuck = (u.stuck || 0) + 1; u.unstuck = (u.unstuck || 0) + 1; const dest = u.path[u.path.length - 1];
      if (u.stuck >= 5) { u.path = []; u.stuck = 0; }
      else { u.path = findPath(u.pos, dest, u.team); if (u.stuck >= 2) { const a = rand(0, 6.28); u.path.unshift(freeSlot(new THREE.Vector3(u.pos.x + Math.cos(a) * 2, 0, u.pos.z + Math.sin(a) * 2), new Set(), u.team)); } }
    } else u.stuck = 0;
    u.lastChk = u.pos.clone(); u.chkT = 0;
  }
  const yl = u.path.length ? 0.25 : 0.6;
  for (const o of units) if (o !== u) {
    const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = dx * dx + dz * dz, m = (u.radius + o.radius) * 0.9;
    if (d < m * m && d > 1e-8) { const dd = Math.sqrt(d), p = (m - dd) * yl; u.pos.x += dx / dd * p; u.pos.z += dz / dd * p; }
  }
  for (const o of buildings) if (!o.def.farm && !(o.def.gate && o.team === u.team) && Math.abs(o.pos.x - u.pos.x) < o.radius + 2 && Math.abs(o.pos.z - u.pos.z) < o.radius + 2) { if (o.parts) o.parts.forEach(pt => pushOut(u, pt)); else pushOut(u, o); }
  for (const o of resources) if (Math.abs(o.pos.x - u.pos.x) < 3 && Math.abs(o.pos.z - u.pos.z) < 3) pushOut(u, o);
  u.pos.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, u.pos.x)); u.pos.z = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, u.pos.z));
  u.body.position.y = moving && S.cls !== 'siege' ? Math.abs(Math.sin(performance.now() / 90)) * 0.12 : 0;
  if ((u.cmd?.type === 'move' || u.cmd?.type === 'attackMove') && !u.path.length && !u.target) u.cmd = null;
  if (u.target || !u.cmd) return;
  if (u.cmd.type === 'gather') {
    let r = u.cmd.res;
    if (u.state === 'toRes') {
      if (!r || r.dead) {
        const rt = r ? resTypeOf(r) : null;
        r = u.cmd.res = rt && (r.kind === 'building' ? buildings.find(f => f.def.farm && f.done && f.team === u.team && !units.some(o => o.cmd?.res === f)) : null) || (rt && nearestRes(rt, u.pos, 30));
        if (!r) { u.cmd = null; return; } moveTo(u, r.pos);
      }
      if (r.sub === 'cerf' && !r.hunted) { u.repathT -= dt; if (u.repathT <= 0) { u.repathT = 0.6; moveTo(u, r.pos); } }
      const reach = r.kind === 'building' ? 1.6 : r.radius + 1.2;
      if (d2(u.pos, r.pos) < reach) { u.state = 'gather'; u.path = []; u.timer = 0; }
      else if (!u.path.length) moveTo(u, r.pos);
    } else if (u.state === 'gather') {
      if (r.dead) { u.state = 'toRes'; return; }
      if (r.sub === 'cerf' && !r.hunted) { r.hunted = true; r.mesh.rotation.z = Math.PI / 2; r.mesh.position.y = 0.35; } // chassé : le cerf est abattu
      const rt = resTypeOf(r);
      if (r.kind !== 'building') u.mesh.rotation.y = Math.atan2(r.pos.x - u.pos.x, r.pos.z - u.pos.z);
      u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 12) * 0.2;
      const iv = r.rate / T.up.gather[rt] / (u.team === 1 ? st.D.gather : 1);
      if (u.timer > iv) {
        u.timer = 0; if (u.carryType !== rt) { u.carry = 0; u.carryType = rt; } u.carry++; r.amount--;
        if (u.team === 0 && Math.random() < 0.15 && isVis(u.pos)) sfx(rt === 'bois' ? 'chop' : rt === 'nourriture' ? 'gather' : 'mine', u.pos);
        if (r.amount <= 0) kill(r);
        if (u.carry >= T.up.cap || r.dead) { u.state = 'toDrop'; const h = dropFor(u.team, rt, u.pos); if (h) moveTo(u, h.pos); }
      }
    } else if (u.state === 'toDrop') {
      const h = dropFor(u.team, u.carryType || 'bois', u.pos); if (!h) { u.cmd = null; return; }
      if (edgeD(u.pos, h) < 1.4) { if (u.carryType) { T.res[u.carryType] += u.carry; stats(u.team).gathered += u.carry; } u.carry = 0; u.state = 'toRes'; if (r && !r.dead) moveTo(u, r.pos); }
      else if (!u.path.length) moveTo(u, h.pos);
    }
    u.carryMesh.visible = u.carry > 0; if (u.carryType) u.carryMesh.material.color.set(RES_COLORS[u.carryType]);
  } else if (u.cmd.type === 'build') {
    const b = u.cmd.b;
    if (b.dead || b.done) { nextJob(u, b); return; }
    if (edgeD(u.pos, b) < 1.5) {
      u.path = []; u.mesh.rotation.y = Math.atan2(b.pos.x - u.pos.x, b.pos.z - u.pos.z); u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 10) * 0.3;
      if (u.team === 0 && Math.random() < dt * 1.5 && isVis(u.pos)) sfx('build', u.pos);
      const inc = dt / b.def.time; b.progress = Math.min(1, b.progress + inc); b.hp = Math.min(b.maxHp, b.hp + inc * b.maxHp * 0.9);
      b.inner.scale.y = 0.1 + 0.9 * b.progress;
      if (b.progress >= 1) { b.done = true; if (b.def.gate || b.def.farm) rebuildGrid(); if (b.team === 0 && !b.def.wall) { msg(`${b.def.label} : construction terminée !`); sfx('done'); } nextJob(u, b); }
    } else if (!u.path.length) moveTo(u, b.pos);
  }
}

export function updateBuilding(b, dt) {
  if (b.def.wonder && b.done && !gameOver) { // victoire par merveille : compte à rebours visible des deux camps
    if (b.wonderT === undefined) { b.wonderT = b.def.wonder; msg(b.team === 0 ? '🏛️ Merveille terminée ! Tenez 5 minutes pour gagner.' : '🏛️ L\'ennemi a terminé une merveille ! Détruisez-la en moins de 5 minutes.', 6000); announce(b.team === 0 ? 'Merveille terminée : victoire dans 5 minutes' : 'Merveille ennemie terminée : détruisez-la en moins de 5 minutes'); sfx('horn'); }
    b.wonderT -= dt; if (b.wonderT <= 0) endGame(b.team === 0, 'merveille');
  }
  if (b.inner.userData.blades && b.done) b.inner.userData.blades.rotation.z += dt * 1.5;
  if (!b.done) return;
  if (b.queue.length) {
    b.trainT -= dt;
    if (b.trainT <= 0) {
      const q = b.queue.shift(), T = teams[b.team];
      if (q.kind === 'unit') {
        const dir = new THREE.Vector3(-b.pos.x, 0, -b.pos.z).normalize();
        stats(b.team).trained++;
        const u = addUnit(q.id, b.team, b.pos.x + dir.x * (b.radius + 1.5) + rand(-1, 1), b.pos.z + dir.z * (b.radius + 1.5) + rand(-1, 1));
        if (b.rally) {
          const rr = b.rally.res && (b.rally.res.dead ? nearestRes(resTypeOf(b.rally.res), b.rally.pos, 20) : b.rally.res);
          if (q.id === 'villageois' && rr) cmdGather(u, rr); else cmdMove(u, b.rally.pos, u.def.aggro ? 'attackMove' : 'move');
        }
        if (b.team === 0) sfx('trained');
      } else if (q.kind === 'tech') { applyTech(b.team, q.id); if (b.team === 0) { msg(`Technologie : ${TECHS[q.id].label}`); sfx('done'); } }
      else if (q.kind === 'age') { T.age = q.id; if (b.team === 0) { msg(`🎺 Vous entrez dans l'${AGES[q.id].name} !`, 4000); sfx('age'); } else msg(`L'ennemi est passé à l'${AGES[q.id].name}.`, 3500); }
      if (b.queue.length) b.trainT = b.queue[0].time;
    }
  }
  if (b.def.atk) {
    b.cdT -= dt;
    if (b.cdT <= 0) { const t = nearestEnemy(b, rangeOf(b.def, b.team) + b.radius); if (t && t.kind === 'unit') { b.cdT = b.def.cd; shoot(b.pos.clone().setY(5), t.pos); hit(b, b.def, b.team, t); } }
  }
}
