import * as THREE from 'three';
import { HALF, SIZE } from './config.js';
import { buildings, d2, resources } from './world.js';


// ================= Pathfinding (A*, grille par équipe : les portes laissent passer leur camp) =================
export const N = SIZE;
 export let gridT = [new Uint8Array(N * N), new Uint8Array(N * N)];
export function stamp(g, o) {
  if (o.ext) {
    const hw = o.ext[0] + 0.3, hd = o.ext[1] + 0.3;
    for (let x = Math.floor(o.pos.x - hw); x <= o.pos.x + hw; x++) for (let z = Math.floor(o.pos.z - hd); z <= o.pos.z + hd; z++)
      if (Math.abs(x + 0.5 - o.pos.x) < hw && Math.abs(z + 0.5 - o.pos.z) < hd) { const i = x + HALF, j = z + HALF; if (i >= 0 && j >= 0 && i < N && j < N) g[i + j * N] = 1; }
    return;
  }
  const r = o.radius + 0.3;
  for (let x = Math.floor(o.pos.x - r); x <= o.pos.x + r; x++) for (let z = Math.floor(o.pos.z - r); z <= o.pos.z + r; z++)
    if (Math.hypot(x + 0.5 - o.pos.x, z + 0.5 - o.pos.z) < r) { const i = x + HALF, j = z + HALF; if (i >= 0 && j >= 0 && i < N && j < N) g[i + j * N] = 1; }
}
export function rebuildGrid() {
  const g = new Uint8Array(N * N);
  for (const o of resources) if (o.sub !== 'cerf') stamp(g, o); // les cerfs bougent : hors grille
  for (const b of buildings) if (!b.def.farm && !b.def.gate) stamp(g, b);
  const g0 = g.slice(), g1 = g;
  for (const b of buildings) if (b.def.gate) b.parts.forEach(pt => stamp(b.team === 0 ? g1 : g0, pt));
  gridT = [g0, g1];
}
export const toCell = v => [Math.max(0, Math.min(N - 1, Math.floor(v.x) + HALF)), Math.max(0, Math.min(N - 1, Math.floor(v.z) + HALF))];
export const cellPos = c => new THREE.Vector3((c % N) - HALF + 0.5, 0, ((c / N) | 0) - HALF + 0.5);
export const gS = new Float32Array(N * N), came = new Int32Array(N * N), seen = new Uint32Array(N * N), closed = new Uint32Array(N * N);
 export let gen = 0;
export const hF = [], hN = [];
export function hPush(f, n) { let i = hF.length; hF.push(f); hN.push(n); while (i > 0) { const p = (i - 1) >> 1; if (hF[p] <= f) break; hF[i] = hF[p]; hN[i] = hN[p]; i = p; } hF[i] = f; hN[i] = n; }
export function hPop() {
  const top = hN[0], lf = hF.pop(), ln = hN.pop(); const len = hF.length;
  if (len) { let i = 0; while (true) { let c = 2 * i + 1; if (c >= len) break; if (c + 1 < len && hF[c + 1] < hF[c]) c++; if (hF[c] >= lf) break; hF[i] = hF[c]; hN[i] = hN[c]; i = c; } hF[i] = lf; hN[i] = ln; }
  return top;
}
export function findPath(from, to, team = 0) {
  const grid = gridT[team];
  let [sx, sz] = toCell(from), [tx, tz] = toCell(to);
  if (grid[tx + tz * N]) {
    let best = null, bd = 1e9;
    for (let r = 1; r < 10 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = tx + dx, z = tz + dz; if (x < 0 || z < 0 || x >= N || z >= N || grid[x + z * N]) continue;
      const d = Math.hypot(dx, dz) + Math.hypot(x - sx, z - sz) * 0.01; if (d < bd) { bd = d; best = [x, z]; }
    }
    if (!best) return [to.clone()]; [tx, tz] = best;
  }
  const start = sx + sz * N, goal = tx + tz * N; gen++;
  hF.length = 0; hN.length = 0; seen[start] = gen; gS[start] = 0; came[start] = -1; hPush(0, start);
  let bestNode = start, bestH = 1e9, iter = 0, found = false;
  while (hF.length && iter++ < 15000) {
    const cur = hPop(); if (closed[cur] === gen) continue; closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    const cx = cur % N, cz = (cur / N) | 0, h = Math.hypot(cx - tx, cz - tz); if (h < bestH) { bestH = h; bestNode = cur; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue;
      const ni = x + z * N; if (grid[ni] || closed[ni] === gen || (dx && dz && (grid[cx + dx + cz * N] || grid[cx + (cz + dz) * N]))) continue;
      const ng = gS[cur] + (dx && dz ? 1.414 : 1);
      if (seen[ni] !== gen || ng < gS[ni]) { seen[ni] = gen; gS[ni] = ng; came[ni] = cur; hPush(ng + Math.hypot(x - tx, z - tz), ni); }
    }
  }
  const end = found ? goal : bestNode;
  const pts = []; for (let c = end; c !== start && c !== -1; c = came[c]) pts.push(cellPos(c));
  pts.reverse(); const [ex, ez] = toCell(to); if (found && !grid[ex + ez * N]) pts.push(to.clone().setY(0));
  const out = []; let a = from.clone(), i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(a, pts[j], team)) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
  return out;
}
export function los(a, b, team = 0) { const grid = gridT[team], s = Math.ceil(d2(a, b) * 2); for (let k = 1; k <= s; k++) { const t = k / s; const [x, z] = toCell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); if (grid[x + z * N]) return false; } return true; }
export function moveTo(u, p) { u.path = findPath(u.pos, p, u.team); }
export function freeSlot(p, used, team = 0) {
  const grid = gridT[team], [cx, cz] = toCell(p);
  for (let r = 0; r < 10; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x = cx + dx, z = cz + dz;
    if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue; const i = x + z * N;
    if (grid[i] || used.has(i) || used.has(i + 1) || used.has(i - 1) || used.has(i + N) || used.has(i - N)) continue; used.add(i); return cellPos(i);
  }
  return p.clone();
}
