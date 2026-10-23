import * as THREE from 'three';
import { DIFFS } from './data.js';
import { st } from './state.js';
import { ai, aiUpdate } from './ai.js';
import { $, HALF, SPEED, isTouch, teams } from './config.js';
import { keys, mouse, pickEntity, rallyAt, screenOf, setRally, unlockAudio } from './input.js';
import { P0, explored, generateMap, updateFog } from './map.js';
import { N, gridT, rebuildGrid, toCell } from './path.js';
import { camTarget, camera, renderer, scene, updateCam } from './render.js';
import { doAct, drawMini, endGame, gameOver, msg, setSel, updateHUD } from './ui.js';
import { ageUp, applyTech, cmdAttack, cmdBuild, cmdGather, cmdMove, hdvOf, kill, placeBuilding, placeWall, research, train, updateBuilding, updateUnit } from './units.js';
import { addBuilding, addResource, addUnit, arrows, buildings, d2, free, rand, resources, syncWalls, units, wallFree } from './world.js';


// ================= Boucle =================
export const clock = new THREE.Clock();
 export let fogT = 0, hudT = 0, miniT = 0;
export function updateDeer(dt) {
  for (const r of resources) {
    if (r.sub !== 'cerf' || r.hunted) continue;
    let mv = 0, dx = 0, dz = 0;
    let near = null, nd = 6; for (const u of units) { const d = d2(u.pos, r.pos); if (d < nd) { nd = d; near = u; } }
    if (near) { r.fleeT = 1.5; r.fdir = Math.atan2(r.pos.z - near.pos.z, r.pos.x - near.pos.x) + rand(-0.4, 0.4); }
    if (r.fleeT > 0) { r.fleeT -= dt; mv = 4.5; dx = Math.cos(r.fdir); dz = Math.sin(r.fdir); }
    else { r.wT = (r.wT ?? rand(0, 5)) - dt; if (r.wT <= 0) { r.wT = rand(4, 8); r.wdir = rand(0, 6.28); r.wmove = rand(0.5, 1.5); } if (r.wmove > 0) { r.wmove -= dt; mv = 1.2; dx = Math.cos(r.wdir); dz = Math.sin(r.wdir); } }
    if (!mv) continue;
    const nx = r.pos.x + dx * mv * dt, nz = r.pos.z + dz * mv * dt, [cx, cz] = toCell({ x: nx, z: nz });
    if (Math.abs(nx) < HALF - 2 && Math.abs(nz) < HALF - 2 && !gridT[0][cx + cz * N]) { r.pos.x = nx; r.pos.z = nz; r.mesh.rotation.y = Math.atan2(dx, dz); }
    else { r.fdir = (r.fdir || 0) + Math.PI / 2; r.wdir = (r.wdir || 0) + Math.PI / 2; }
  }
}
export function step(dt) {
  st.gameTime += dt; updateDeer(dt);
  for (const u of [...units]) if (!u.dead) updateUnit(u, dt);
  for (const b of [...buildings]) if (!b.dead) updateBuilding(b, dt);
  aiUpdate(dt);
}
export function loop() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  const sp = st.camDist * 0.9 * rdt, e = 12; let mv = false;
  const k = keys, m = mouse.in && !isTouch;
  if (k.w || k.z || k.arrowup || (m && mouse.y < e)) { camTarget.z -= sp; mv = true; }
  if (k.s || k.arrowdown || (m && mouse.y > innerHeight - e)) { camTarget.z += sp; mv = true; }
  if (k.a || k.q || k.arrowleft || (m && mouse.x < e)) { camTarget.x -= sp; mv = true; }
  if (k.d || k.arrowright || (m && mouse.x > innerWidth - e)) { camTarget.x += sp; mv = true; }
  if (mv) updateCam();
  if (!gameOver && st.started) for (let i = 0; i < SPEED; i++) step(rdt);
  for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += rdt * SPEED / a.dur; if (a.t >= 1) { scene.remove(a.m); arrows.splice(i, 1); continue; } a.m.position.lerpVectors(a.a, a.b, a.t); a.m.position.y += Math.sin(a.t * Math.PI) * a.arc; a.m.lookAt(a.b); }
  fogT -= rdt; if (fogT <= 0) { fogT = 0.2; updateFog(); }
  miniT -= rdt; if (miniT <= 0) { miniT = isTouch ? 0.4 : 0.25; drawMini(); }
  hudT -= rdt; if (hudT <= 0) { hudT = 0.3; updateHUD(); }
  for (const e of [...units, ...buildings]) {
    if (e.ring) e.ring.visible = e.selected;
    const show = e.mesh.visible && (e.hp < e.maxHp || e.selected || e === st.selBuilding);
    e.bar.visible = show; if (!show) continue;
    const { fg, w, h } = e.bar.userData, r = Math.max(0, e.hp / e.maxHp);
    e.bar.position.set(e.pos.x, h, e.pos.z); e.bar.quaternion.copy(camera.quaternion);
    fg.scale.x = w * r; fg.position.x = -w * (1 - r) / 2; fg.material.color.setHex(e.done === false ? 0x60a0ff : r > 0.6 ? 0x30e030 : r > 0.3 ? 0xe0c030 : 0xe03030);
  }
  syncWalls(); renderer.render(scene, camera); requestAnimationFrame(loop);
}
export const game = {
  step, addUnit, addBuilding, addResource, units, buildings, resources, teams, ai, THREE, cmdMove, cmdGather, cmdAttack, cmdBuild, screenOf, camTarget, doAct, setRally, rallyAt, pickEntity, placeWall, placeBuilding, applyTech, train, research, ageUp, kill,
  renderer, explored, rebuildGrid, P0, free, wallFree, setSel, updateFog, updateHUD, msg,
  get D() { return st.D; }, set D(v) { st.D = v; }, get started() { return st.started; }, set started(v) { st.started = v; }, get gameTime() { return st.gameTime; }, set gameTime(v) { st.gameTime = v; },
  get selBuilding() { return st.selBuilding; }, set selBuilding(b) { st.selBuilding = b; }, get camDist() { return st.camDist; }, get over() { return gameOver; }, endGame,
};
window.__game = game;
export function boot(skipMap = false) {

  if (!skipMap) generateMap();
  camTarget.copy(hdvOf(0)?.pos || P0); updateCam(); updateFog(); updateHUD(); loop();
  if (!st.started) $('start').style.display = 'flex';
  $('start').addEventListener('click', e => { const k = e.target.closest('button')?.dataset.diff; if (!k) return; st.D = DIFFS[k]; ai.nextWave = st.D.first; st.started = true; $('start').style.display = 'none'; msg('Difficulté : ' + st.D.label); unlockAudio(); });
  if (st.D && !skipMap) ai.nextWave = st.D.first;
}
export { setSfx } from './config.js';
export { setUnlock } from './input.js';
export { extraActs } from './ui.js';
