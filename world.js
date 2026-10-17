import { BUILD, UNIT } from './data.js';
import * as THREE from 'three';
import { HALF, TEAM_COLOR, teams } from './config.js';
import { rebuildGrid } from './path.js';
import { Bx, Co, Cy, G, Sp, addPart, geo, mk, ringMat, scene } from './render.js';


// ================= Entités =================
export const resources = [], buildings = [], units = [], arrows = [];
export const rand = (a, b) => a + Math.random() * (b - a);
export const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const inMap = (x, z, r) => Math.abs(x) <= HALF - r - 1 && Math.abs(z) <= HALF - r - 1;
// emprise : rectangle (demi-largeurs selon la rotation) ou cercle
// distance d'un point au bord d'une entité (rectangle si emprise, sinon cercle)
export function edgeD(p, o) { if (!o.ext) return d2(p, o.pos) - (o.radius || 0.5); return Math.hypot(Math.max(0, Math.abs(p.x - o.pos.x) - o.ext[0]), Math.max(0, Math.abs(p.z - o.pos.z) - o.ext[1])); }
export function extOf(type, rot = 0) { const f = BUILD[type]?.fp; if (!f) return null; return Math.round(rot / (Math.PI / 2)) % 2 ? [f[1] / 2, f[0] / 2] : [f[0] / 2, f[1] / 2]; }
export function overlap(ax, az, ar, ae, bx, bz, br, be, m) {
  const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
  if (ae && be) return dx < ae[0] + be[0] + m && dz < ae[1] + be[1] + m;
  if (ae || be) { const e = ae || be, r = ae ? br : ar; const cx = Math.max(0, dx - e[0]), cz = Math.max(0, dz - e[1]); return Math.hypot(cx, cz) < r + m; }
  return Math.hypot(dx, dz) < ar + br + m;
}
export function free(x, z, r, ign, e = null) {
  if (!inMap(x, z, e ? Math.max(e[0], e[1]) : r)) return false;
  for (const o of resources) if (overlap(x, z, r, e, o.pos.x, o.pos.z, o.radius, null, 0)) return false;
  for (const o of buildings) if (!(ign && ign(o)) && overlap(x, z, r, e, o.pos.x, o.pos.z, o.radius, o.ext, o.def.wall ? 0.2 : 1)) return false;
  return true;
}
export function wallFree(x, z, ignoreGateWalls = false) {
  if (Math.abs(x) > HALF - 0.4 || Math.abs(z) > HALF - 0.4) return false;
  for (const o of resources) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + 0.7) return false;
  for (const o of buildings) { const d = Math.hypot(o.pos.x - x, o.pos.z - z); if (o.def.wall ? d < 0.5 : d < o.radius + 0.8) return false; }
  return true;
}
export function tag(e) { e.mesh.traverse(o => o.userData.ent = e); }

export const RES_DEF = {
  bois: { type: 'bois', amount: 100, radius: 0.9 }, or: { type: 'or', amount: 450, radius: 1.6 }, pierre: { type: 'pierre', amount: 400, radius: 1.6 },
  baies: { type: 'nourriture', amount: 150, radius: 1, rate: 0.55 }, cerf: { type: 'nourriture', amount: 140, radius: 0.8, rate: 0.4 },
};
export function addResource(sub, x, z, amount, force = false) {
  const R = RES_DEF[sub]; if (!force && !free(x, z, R.radius)) return;
  const g = new THREE.Group();
  if (sub === 'bois') { addPart(g, Cy(0.25, 0.3, 1.5, 6), 0x6b4423, 0, 0.75); addPart(g, Co(1.2, 3, 7), 0x2f6b2a, 0, 2.8); g.rotation.y = rand(0, 6); }
  else if (sub === 'baies') { addPart(g, Sp(0.9), 0x3f7f2a, 0, 0.6); for (let i = 0; i < 5; i++) addPart(g, Sp(0.15), 0xc0203a, Math.cos(i * 1.3) * 0.75, 0.6 + Math.sin(i * 2.1) * 0.4, Math.sin(i * 1.3) * 0.75); }
  else if (sub === 'cerf') {
    addPart(g, Bx(0.5, 0.55, 1.2), 0x8a5a2b, 0, 0.9); addPart(g, Bx(0.3, 0.5, 0.35), 0x8a5a2b, 0, 1.35, 0.6);
    for (const [lx, lz] of [[-0.18, -0.45], [0.18, -0.45], [-0.18, 0.45], [0.18, 0.45]]) addPart(g, Bx(0.1, 0.65, 0.1), 0x6a4020, lx, 0.33, lz);
    g.rotation.y = rand(0, 6);
  } else { const c = sub === 'or' ? 0xe0b630 : 0x8a8a8a; addPart(g, geo('rock', () => new THREE.DodecahedronGeometry(1.2)), c, 0, 0.6); addPart(g, geo('rock2', () => new THREE.DodecahedronGeometry(0.7)), c, 1, 0.4); }
  g.position.set(x, 0, z); scene.add(g);
  const r = { kind: 'resource', sub, type: R.type, amount: amount ?? R.amount, radius: R.radius, rate: R.rate || 0.5, mesh: g, pos: g.position };
  tag(r); resources.push(r); return r;
}

export function makeBar(e, w, h) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.7 }));
  const fg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x30e030, depthTest: false }));
  bg.scale.x = w; bg.renderOrder = 10; fg.renderOrder = 11; g.add(bg, fg); g.userData = { fg, w, h }; g.visible = false; scene.add(g); e.bar = g;
}

export function buildingMesh(type, team) {
  const tc = TEAM_COLOR[team], g = new THREE.Group(), P = (geom, c, x, y, z) => addPart(g, geom, c, x, y, z);
  switch (type) {
    case 'hdv': P(Bx(6, 3, 6), 0xb08850, 0, 1.5); P(Co(4.8, 3), 0x8b2e1e, 0, 4.5); P(Bx(0.2, 2, 0.2), 0x333333, 0, 6.5); P(Bx(1.2, 0.7, 0.05), tc, 0.6, 7); break;
    case 'maison': P(Bx(3, 2, 3), 0xc8a878, 0, 1); P(Co(2.4, 1.6), tc, 0, 2.8); break;
    case 'moulin': {
      P(Cy(1.3, 1.7, 4, 8), 0xd8c8a0, 0, 2); P(Co(1.6, 1.6, 8), tc, 0, 4.8);
      const bl = new THREE.Group(); bl.position.set(0, 3.4, 1.8); bl.add(mk(Bx(0.3, 5, 0.08), 0xeeeeee)); bl.add(mk(Bx(5, 0.3, 0.08), 0xeeeeee)); g.add(bl); g.userData.blades = bl; break;
    }
    case 'ferme': P(Bx(4.6, 0.15, 4.6), 0x8b6b3a, 0, 0.08); for (let i = -2; i <= 2; i++) P(Bx(0.35, 0.35, 4.2), 0x9acd32, i * 0.9, 0.3, 0); P(Bx(0.3, 0.8, 0.3), tc, 2.2, 0.4, 2.2); break;
    case 'camp_bois': P(Bx(3.2, 0.2, 2.6), 0x7a5a3a, 0, 1.9); for (const x of [-1.4, 1.4]) for (const z of [-1.1, 1.1]) P(Bx(0.2, 1.9, 0.2), 0x5a3a1a, x, 0.95, z); for (let i = 0; i < 3; i++) P(Cy(0.25, 0.25, 2.4, 6), 0x6b4423, 0, 0.25 + i * 0.4, -0.5 + i * 0.2).rotation.z = Math.PI / 2; P(Bx(0.7, 0.4, 0.05), tc, 0, 2.3, 1.3); break;
    case 'camp_mine': P(Bx(3, 1.6, 2.6), 0x777777, 0, 0.8); P(Co(2.2, 1.2), tc, 0, 2.2); P(Sp(0.45), 0xe0b630, 1.7, 0.4, 1.2); P(Sp(0.45), 0x999999, -1.7, 0.4, 1.2); break;
    case 'caserne': P(Bx(6, 2.6, 4.5), 0x8d8d8d, 0, 1.3); P(Bx(6.4, 0.6, 4.9), tc, 0, 2.9); for (const sx of [-2.6, 2.6]) P(Bx(1.2, 4, 1.2), 0x777777, sx, 2); break;
    case 'archerie': { P(Bx(6, 2.4, 4.5), 0xa08060, 0, 1.2); P(Co(4, 1.6), tc, 0, 3.2); const t = P(Cy(0.8, 0.8, 0.15, 12), 0xffffff, 3.6, 1, 1); t.rotation.z = Math.PI / 2; P(Cy(0.4, 0.4, 0.17, 12), 0xd03030, 3.6, 1, 1).rotation.z = Math.PI / 2; break; }
    case 'ecurie': P(Bx(7, 2, 4), 0x8a6038, 0, 1); P(Bx(7.4, 0.5, 4.4), tc, 0, 2.25); P(Bx(7, 0.5, 0.1), 0x6b4423, 0, 0.6, 2.6); break;
    case 'forge': P(Bx(4.5, 2.4, 4), 0x6a5a4a, 0, 1.2); P(Co(3.4, 1.4), tc, 0, 3.1); P(Cy(0.4, 0.5, 3, 6), 0x333333, 1.4, 3, 1.2); P(Bx(0.8, 0.6, 0.5), 0x222222, -2.6, 0.6, 0); break;
    case 'tour': P(Cy(1.1, 1.4, 7, 8), 0x9a9a9a, 0, 3.5); P(Cy(1.5, 1.5, 0.6, 8), 0x888888, 0, 7.2); P(Co(1.6, 1.8, 8), tc, 0, 8.4); break;
    case 'universite': P(Bx(6, 3, 5), 0xe8e0d0, 0, 1.5); P(Sp(1.8), tc, 0, 3.2); for (const x of [-2.2, -0.7, 0.7, 2.2]) P(Cy(0.2, 0.2, 3, 6), 0xffffff, x, 1.5, 2.7); break;
    case 'atelier': P(Bx(6, 2.6, 4.5), 0x7a6a50, 0, 1.3); P(Bx(6.4, 0.5, 4.9), tc, 0, 2.85); P(Cy(0.8, 0.8, 0.25, 10), 0x4a3020, 3.2, 0.8, 0).rotation.z = Math.PI / 2; break;
    case 'palissade': P(Bx(1.15, 2.2, 0.45), 0x8a6038, 0, 1.1); P(Bx(0.15, 0.3, 0.5), tc, 0, 2.3); break;
    case 'muraille': P(Bx(1.15, 2.8, 0.9), 0x9a9a9a, 0, 1.4); P(Bx(0.45, 0.45, 0.9), 0x8a8a8a, 0.3, 3); break;
    case 'porte': P(Bx(1, 3.6, 1.2), 0x8a8a8a, -1.6, 1.8); P(Bx(1, 3.6, 1.2), 0x8a8a8a, 1.6, 1.8); P(Bx(2.2, 2.6, 0.3), 0x5a3a1a, 0, 1.3); P(Bx(4.2, 0.8, 1.2), tc, 0, 3.9); break;
  }
  return g;
}

// ===== Murs instanciés : un InstancedMesh par pièce/type/équipe au lieu de 2 meshes par segment =====
export const WALL_POOL = new Map(), WALL_MAX = 3000, _wm = new THREE.Matrix4(), _ws = new THREE.Matrix4(), _wc = new THREE.Color();
export function wallPool(type, team) {
  const k = type + team; let p = WALL_POOL.get(k); if (p) return p;
  const src = buildingMesh(type, team); src.updateMatrixWorld(true); p = { meshes: [], ents: [] };
  for (const c of src.children) if (c.isMesh) {
    const im = new THREE.InstancedMesh(c.geometry, c.material, WALL_MAX); im.count = 0; im.castShadow = c.castShadow; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.local = c.matrix.clone(); im.userData.pool = p; scene.add(im); p.meshes.push(im);
  }
  WALL_POOL.set(k, p); return p;
}
export function syncWalls() {
  for (const p of WALL_POOL.values()) p.ents.length = 0;
  for (const b of buildings) if (b.def.wall && b.mesh.visible) wallPool(b.type, b.team).ents.push(b);
  for (const p of WALL_POOL.values()) {
    const n = Math.min(p.ents.length, WALL_MAX);
    for (const im of p.meshes) {
      for (let i = 0; i < n; i++) {
        const b = p.ents[i]; b.mesh.updateMatrix(); _ws.makeScale(1, b.inner.scale.y, 1);
        im.setMatrixAt(i, _wm.multiplyMatrices(b.mesh.matrix, _ws).multiply(im.userData.local)); im.setColorAt(i, _wc.setScalar(b.dimmed ? 0.4 : 1));
      }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.boundingSphere = null;
    }
  }
}
export function addBuilding(type, team, x, z, done = true, rot = 0, noGrid = false) {
  const S = BUILD[type], g = new THREE.Group(), inner = S.wall ? new THREE.Object3D() : buildingMesh(type, team); g.add(inner);
  g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  const maxHp = Math.round(S.hp * teams[team].up.bhp);
  const b = { kind: 'building', type, def: S, team, radius: S.radius, ext: extOf(type, rot), mesh: g, inner, pos: g.position, rot, maxHp, hp: done ? maxHp : maxHp * 0.1, done, progress: done ? 1 : 0, queue: [], trainT: 0, cdT: 0 };
  if (S.gate) b.parts = [-1.6, -0.8, 0, 0.8, 1.6].map(o => ({ pos: { x: x + Math.cos(rot) * o, z: z - Math.sin(rot) * o }, radius: 0.75 }));
  if (S.farm) { b.amount = S.farm + teams[team].up.farm; b.resType = 'nourriture'; b.rate = 0.6; }
  if (!done) inner.scale.y = 0.1;
  tag(b); makeBar(b, Math.max(1.2, S.radius * 1.2), S.bar); buildings.push(b); if (!noGrid) rebuildGrid(); return b;
}

export function unitMesh(type, team) {
  const tc = TEAM_COLOR[team], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const P = (geom, c, x, y, z) => addPart(body, geom, c, x, y, z);
  const human = (y = 0) => { P(Cy(0.35, 0.45, 1.1, 8), tc, 0, 0.55 + y); P(Sp(0.3), 0xf0c8a0, 0, 1.35 + y); };
  switch (type) {
    case 'cavalier':
      P(Bx(0.7, 0.8, 1.8), 0x6b4a2a, 0, 1); for (const [lx, lz] of [[-0.25, -0.7], [0.25, -0.7], [-0.25, 0.7], [0.25, 0.7]]) P(Bx(0.15, 0.7, 0.15), 0x5a3a1a, lx, 0.35, lz);
      P(Bx(0.35, 0.7, 0.5), 0x6b4a2a, 0, 1.6, 0.95); P(Cy(0.3, 0.38, 0.9, 8), tc, 0, 1.85); P(Sp(0.27), 0xf0c8a0, 0, 2.5); P(Bx(0.06, 0.06, 2.2), 0x8b6b3a, 0.4, 2, 0.6); break;
    case 'belier':
      P(Bx(1.6, 1.2, 2.6), 0x6b4a2a, 0, 0.9); P(Co(1.4, 0.8), tc, 0, 1.9); P(Cy(0.25, 0.25, 3, 6), 0x4a2a10, 0, 0.8, 0.6).rotation.x = Math.PI / 2;
      for (const [wx, wz] of [[-0.85, -0.8], [0.85, -0.8], [-0.85, 0.8], [0.85, 0.8]]) P(Cy(0.35, 0.35, 0.15, 10), 0x3a2a1a, wx, 0.35, wz).rotation.z = Math.PI / 2; break;
    case 'catapulte': {
      P(Bx(1.4, 0.5, 2), 0x6b4a2a, 0, 0.6); const arm = P(Bx(0.15, 0.15, 2.4), 0x5a3a1a, 0, 1.2); arm.rotation.x = -0.6; P(Sp(0.25), 0x777777, 0, 1.9, -0.9);
      for (const [wx, wz] of [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]]) P(Cy(0.35, 0.35, 0.15, 10), 0x3a2a1a, wx, 0.35, wz).rotation.z = Math.PI / 2;
      P(Bx(0.4, 0.3, 0.05), tc, 0.6, 1.1, 0.9); break;
    }
    case 'heros': human(); P(Cy(0.25, 0.3, 0.25, 6), 0xffd700, 0, 1.75); P(Bx(0.7, 0.9, 0.08), 0xa01010, 0, 0.9, -0.42); P(Bx(0.08, 1.1, 0.14), 0xeeeeee, 0.45, 1); body.scale.setScalar(1.25); break;
    default: human();
      if (type === 'epeiste') { P(Bx(0.08, 0.9, 0.12), 0xdddddd, 0.45, 0.9); P(Bx(0.08, 0.6, 0.5), 0x7a5030, -0.45, 0.7); P(Co(0.32, 0.4, 8), 0x999999, 0, 1.62); }
      if (type === 'lancier') { P(Bx(0.06, 2.4, 0.06), 0x8b6b3a, 0.45, 1.2); P(Co(0.08, 0.35, 4), 0xcccccc, 0.45, 2.55); P(Co(0.32, 0.3, 8), 0x888888, 0, 1.6); }
      if (type === 'archer') { const bow = mk(G.bow, 0x6b4423, 0.9); bow.rotation.z = -Math.PI / 2; bow.position.x = 0.45; body.add(bow); }
  }
  return { g, body };
}
export function addUnit(type, team, x, z) {
  const S = UNIT[type], { g, body } = unitMesh(type, team);
  const carry = mk(Bx(0.4, 0.4, 0.4), 0x6b4423, 0.7, true); carry.position.z = -0.45; carry.visible = false; body.add(carry);
  const ring = new THREE.Mesh(G.ring, ringMat); ring.position.y = 0.05; ring.visible = false; const rs = (S.radius || 0.5) / 0.5; ring.scale.set(rs, 1, rs); g.add(ring);
  g.position.set(x, 0, z); scene.add(g);
  const u = { kind: 'unit', type, def: S, team, mesh: g, body, pos: g.position, ring, carryMesh: carry, radius: S.radius || 0.5, hp: S.hp, maxHp: S.hp, path: [], cmd: null, target: null, carry: 0, carryType: null, timer: 0, cdT: 0, scanT: 0, repathT: 0, selected: false };
  tag(u); makeBar(u, S.radius ? 1.6 : 1.2, S.cls === 'cav' ? 2.9 : S.cls === 'siege' ? 2.5 : S.cls === 'hero' ? 2.6 : 2.1); units.push(u); return u;
}
