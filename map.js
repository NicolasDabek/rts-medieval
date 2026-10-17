import * as THREE from 'three';
import { HALF, NOFOG, SIZE } from './config.js';
import { rebuildGrid } from './path.js';
import { scene } from './render.js';
import { addBuilding, addResource, addUnit, buildings, d2, rand, resources, units } from './world.js';


// ================= Carte =================
export const P0 = new THREE.Vector3(-48, 0, 48), P1 = new THREE.Vector3(48, 0, -48);
export function generateMap() {
  addBuilding('hdv', 0, P0.x, P0.z, true, 0, true); addBuilding('hdv', 1, P1.x, P1.z, true, 0, true);
  const base = (B, s) => {
    const o = (dx, dz) => [B.x + dx * s, B.z + dz * s];
    for (const [cx, cz, n] of [[-13, -4, 18], [6, 14, 16], [17, -15, 12]]) for (let i = 0; i < n; i++) addResource('bois', ...o(cx + rand(-5, 5), cz + rand(-5, 5)));
    addResource('pierre', ...o(12, 6)); addResource('pierre', ...o(14, 9.5));
    addResource('or', ...o(-9, 11)); addResource('or', ...o(-12.5, 8)); addResource('or', ...o(-6, 14));
    for (let i = 0; i < 6; i++) addResource('baies', ...o(9 + (i % 3) * 2.1, -7 - Math.floor(i / 3) * 2.1));
    for (let i = 0; i < 4; i++) addResource('cerf', ...o(-4 + rand(-3, 3), -16 + rand(-3, 3)));
  };
  base(P0, 1); base(P1, -1);
  for (let k = 0; k < 14; k++) {
    const cx = rand(-70, 70), cz = rand(-70, 70); if (d2({ x: cx, z: cz }, P0) < 30 || d2({ x: cx, z: cz }, P1) < 30) continue;
    for (let i = 0; i < 14; i++) addResource('bois', cx + rand(-7, 7), cz + rand(-7, 7));
  }
  for (const [t, x, z] of [['or', 0, 0], ['or', 3, 2], ['pierre', -25, -25], ['pierre', 25, 25], ['or', -50, -10], ['or', 50, 10], ['pierre', -10, -50], ['pierre', 10, 50]]) addResource(t, x, z);
  for (let k = 0; k < 6; k++) { const x = rand(-60, 60), z = rand(-60, 60); if (d2({ x, z }, P0) > 30 && d2({ x, z }, P1) > 30) for (let i = 0; i < 3; i++) addResource('cerf', x + rand(-3, 3), z + rand(-3, 3)); }
  rebuildGrid();
  for (let i = 0; i < 3; i++) { addUnit('villageois', 0, P0.x + 4 + i * 1.5, P0.z - 6); addUnit('villageois', 1, P1.x - 4 - i * 1.5, P1.z + 6); }
}

// ================= Brouillard de guerre =================
export const FC = 2, FN = SIZE / FC;
export const visible = new Uint8Array(FN * FN), explored = new Uint8Array(FN * FN);
export const fogData = new Uint8Array(FN * FN * 4);
export const fogTex = new THREE.DataTexture(fogData, FN, FN);
 fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
export const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
fogPlane.rotation.x = -Math.PI / 2;
 fogPlane.position.y = 0.2;
 fogPlane.renderOrder = 1;
 scene.add(fogPlane);
 fogPlane.visible = !NOFOG;
export const fogIdx = p => { const i = Math.max(0, Math.min(FN - 1, Math.floor((p.x + HALF) / FC))), j = Math.max(0, Math.min(FN - 1, Math.floor((p.z + HALF) / FC))); return i + j * FN; };
export const isVis = p => NOFOG || visible[fogIdx(p)];
export const isExp = p => NOFOG || explored[fogIdx(p)];
export const dimCache = new Map();
export function setDim(e, dim) {
  if (NOFOG) dim = false; if (!!e.dimmed === dim) return; e.dimmed = dim;
  e.mesh.traverse(o => {
    if (!o.isMesh || o === e.ring) return;
    if (dim) { o.userData.m0 = o.material; let m = dimCache.get(o.material); if (!m) { m = o.material.clone(); m.color.multiplyScalar(0.4); dimCache.set(o.material, m); } o.material = m; }
    else if (o.userData.m0) o.material = o.userData.m0;
  });
}
export function updateFog() {
  visible.fill(0);
  const reveal = (p, r) => {
    const ci = (p.x + HALF) / FC, cj = (p.z + HALF) / FC, rr = r / FC;
    for (let i = Math.max(0, Math.floor(ci - rr)); i <= Math.min(FN - 1, ci + rr); i++) for (let j = Math.max(0, Math.floor(cj - rr)); j <= Math.min(FN - 1, cj + rr); j++)
      if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 < rr * rr) { visible[i + j * FN] = 1; explored[i + j * FN] = 1; }
  };
  for (const u of units) if (u.team === 0) reveal(u.pos, u.def.cls === 'arch' || u.def.cls === 'cav' ? 14 : 11);
  for (const b of buildings) if (b.team === 0) reveal(b.pos, b.type === 'hdv' || b.type === 'tour' ? 18 : b.def.wall ? 5 : 11);
  for (let i = 0; i < FN; i++) for (let j = 0; j < FN; j++) { const k = i + j * FN; fogData[(i + (FN - 1 - j) * FN) * 4 + 3] = visible[k] ? 0 : explored[k] ? 120 : 235; }
  fogTex.needsUpdate = true;
  for (const u of units) if (u.team === 1) u.mesh.visible = isVis(u.pos);
  for (const b of buildings) if (b.team === 1) { const v = isVis(b.pos); if (v) b.seen = true; b.mesh.visible = !!b.seen || NOFOG; setDim(b, !v); }
  for (const r of resources) { r.mesh.visible = isExp(r.pos); setDim(r, !isVis(r.pos)); }
}
