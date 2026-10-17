import * as THREE from 'three';
import { RES_LABEL, BUILD } from './data.js';
import { st } from './state.js';
import { $, TEAM_COLOR, isTouch, sfx } from './config.js';
import { moveTo } from './path.js';
import { Bx, Cy, camTarget, camera, cv, geo, mk, renderer, scene, updateCam } from './render.js';
import { boxMode, doAct, finishWall, msg, placing, selUnits, setSel, stopPlacing, tryPlace, updateGhost, updateHUD, wallStart } from './ui.js';
import { cmdAttack, cmdBuild, cmdGather, cmdMove, formation } from './units.js';
import { WALL_POOL, buildings, resources, units } from './world.js';


// ================= Entrées =================
export const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function setRay(x, y) { ndc.set(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); }
export function groundAt(x, y) { setRay(x, y); return ray.ray.intersectPlane(gPlane, new THREE.Vector3()); }
export function screenOf(p) { const v = p.clone().setY(0.8).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
export function pickEntity(x, y) {
  setRay(x, y);
  const objs = [...units, ...buildings, ...resources].filter(e => e.mesh.visible).map(e => e.mesh);
  for (const p of WALL_POOL.values()) objs.push(...p.meshes);
  let ent = null; for (const h of ray.intersectObjects(objs, true)) { const pl = h.object.userData.pool; const e = pl ? pl.ents[h.instanceId] : h.object.userData.ent; if (e) { ent = e; break; } }
  if (!ent || ent.kind !== 'unit') {
    let bd = isTouch ? 30 : 16; for (const u of units) if (u.mesh.visible) { const [sx, sy] = screenOf(u.pos), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; ent = u; } }
  }
  return { ent, point: groundAt(x, y) || new THREE.Vector3() };
}
export function marker(p, color) { const m = new THREE.Mesh(geo('mk', () => new THREE.RingGeometry(0.3, 0.7, 16).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color })); m.position.set(p.x, 0.25, p.z); scene.add(m); setTimeout(() => scene.remove(m), 400); }
export function command(x, y, attackMove = false) {
  const sel = selUnits(); if (!sel.length) return false;
  const { ent: e, point } = pickEntity(x, y);
  if (attackMove) { formation(sel, point, 'attackMove'); marker(point, 0xff4040); sfx('attack'); return true; }
  if (e && e.team === 1 && e.kind !== 'resource') { sel.forEach(u => cmdAttack(u, e)); marker(e.pos, 0xff0000); sfx('attack'); }
  else if (e?.kind === 'resource') { sel.forEach(u => u.def.cls === 'villager' ? cmdGather(u, e) : cmdMove(u, e.pos)); msg('Récolte : ' + RES_LABEL[e.type]); sfx('ok'); }
  else if (e?.kind === 'building' && e.team === 0) {
    sel.forEach(u => {
      if (u.def.cls !== 'villager') return cmdMove(u, e.pos);
      if (!e.done) cmdBuild(u, e);
      else if (e.def.farm) cmdGather(u, e);
      else if (u.carry && e.def.drop?.includes(u.carryType)) { u.cmd = { type: 'gather', res: u.cmd?.res || null }; u.state = 'toDrop'; moveTo(u, e.pos); }
      else cmdMove(u, e.pos);
    }); sfx('ok');
  } else { formation(sel, point, 'move'); marker(point, 0xffff00); sfx('ok'); }
  return true;
}
export let lastTap = { ent: null, t: 0 };
export const onScreen = p => { const [x, y] = screenOf(p); return x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight; };
export function clickSelect(x, y, add) {
  const { ent } = pickEntity(x, y);
  if (ent?.kind === 'unit' && ent.team === 0) {
    const now = performance.now();
    if (lastTap.ent === ent && now - lastTap.t < 350) setSel(units.filter(u => u.team === 0 && u.type === ent.type && onScreen(u.pos)), add);
    else if (add && ent.selected) ent.selected = false; else setSel([ent], add);
    lastTap = { ent, t: now }; sfx('select');
  } else if (ent?.kind === 'building') { setSel([]); st.selBuilding = ent; sfx('select'); }
  else if (!add) setSel([]);
}
export function rallyAt(b, pos, res = null) {
  b.rally = { pos, res };
  if (b.team !== 0) return;
  if (!b.flag) { b.flag = new THREE.Group(); b.flag.add(mk(Cy(0.05, 0.05, 2), 0x333333, 1)); b.flag.add(mk(Bx(0.8, 0.5, 0.05), TEAM_COLOR[0], 1.7).translateX(0.4)); scene.add(b.flag); }
  b.flag.position.set(pos.x, 0, pos.z);
}
export function setRally(x, y) {
  const b = st.selBuilding; st.rallyMode = false; if (!b || b.team !== 0) return;
  const { ent, point } = pickEntity(x, y), res = ent?.kind === 'resource' || (ent?.def?.farm && ent.team === 0) ? ent : null, pos = res ? res.pos.clone() : point;
  rallyAt(b, pos, res); marker(pos, 0x4080ff); msg('Point de ralliement défini' + (res ? ' (récolte)' : '')); sfx('ok');
}
export function tap(x, y) {
  if (placing) return tryPlace(x, y);
  if (st.rallyMode) { setRally(x, y); return doAct('noop'); }
  if (st.atkMode) { command(x, y, true); st.atkMode = false; doAct('noop'); return; }
  const { ent } = pickEntity(x, y), sel = selUnits();
  if (ent?.kind === 'unit' && ent.team === 0) return clickSelect(x, y, false);
  if (ent?.kind === 'building' && ent.team === 0) {
    const v = sel.filter(u => u.def.cls === 'villager');
    if (v.length && (!ent.done || (ent.def.farm) || (ent.def.drop && v.some(u => u.carry > 0)))) return command(x, y);
    setSel([]); st.selBuilding = ent; sfx('select'); return;
  }
  if (sel.length) return command(x, y);
  clickSelect(x, y, false);
}
export function boxSelect(x1, y1, x2, y2, add) {
  const [a, b] = [Math.min(x1, x2), Math.max(x1, x2)], [c, d] = [Math.min(y1, y2), Math.max(y1, y2)];
  let list = units.filter(u => { if (u.team !== 0) return false; const [sx, sy] = screenOf(u.pos); return sx >= a && sx <= b && sy >= c && sy <= d; });
  if (list.some(u => u.def.cls !== 'villager')) list = list.filter(u => u.def.cls !== 'villager'); // priorité à l'armée
  setSel(list, add); if (list.length) sfx('select');
}
export const box = $('box');
export function drawBox(g, x, y) { Object.assign(box.style, { display: 'block', left: Math.min(g.sx, x) + 'px', top: Math.min(g.sy, y) + 'px', width: Math.abs(x - g.sx) + 'px', height: Math.abs(y - g.sy) + 'px' }); }

export const keys = {};
 export const mouse = { x: innerWidth / 2, y: innerHeight / 2, in: false };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === 'escape') doAct('desel'); if (k === 'f') doAct('atk'); if (k === 'h') doAct('home'); if (k === 'x') doAct('stop');
  if (k === 'r' && placing) doAct('rotate'); if (k === '.' || k === 'i') doAct('idle');
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
export const groups = {};
 export let lastGrp = { n: null, t: 0 };
addEventListener('keydown', e => {
  if (!/^Digit[0-9]$/.test(e.code)) return; const n = e.code.slice(5);
  if (e.ctrlKey || e.metaKey || e.shiftKey) { // Ctrl+n (ou Maj+n si le navigateur garde Ctrl+n) : créer le groupe
    e.preventDefault(); const sel = selUnits(); if (!sel.length) return; groups[n] = sel.slice(); msg(`Groupe ${n} : ${sel.length} unité(s)`); sfx('ok'); return;
  }
  const g = (groups[n] || []).filter(u => !u.dead); groups[n] = g; if (!g.length) return;
  setSel(g); sfx('select'); updateHUD();
  const now = performance.now();
  if (lastGrp.n === n && now - lastGrp.t < 400) { const c = g.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).divideScalar(g.length); camTarget.set(c.x, 0, c.z - st.camDist * 0.1); updateCam(); }
  lastGrp = { n, t: now };
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); updateCam(); });
cv.addEventListener('wheel', e => { e.preventDefault(); st.camDist += e.deltaY * 0.05; updateCam(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mouseleave', () => mouse.in = false);

export const ptrs = new Map();
 export let gest = null;
export function pinchInfo() { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
export function panBy(dx, dy) { const k = st.camDist / innerHeight * 1.5; camTarget.x -= dx * k; camTarget.z -= dy * k; updateCam(); }
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch { }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); unlockAudio();
  if (e.pointerType === 'mouse') {
    mouse.in = true;
    if (e.button === 2) {
      if (placing) { stopPlacing(); doAct('noop'); return; }
      if (st.rallyMode || (st.selBuilding?.team === 0 && !selUnits().length && st.selBuilding.done)) { setRally(e.clientX, e.clientY); doAct('noop'); return; }
      if (st.atkMode) { st.atkMode = false; doAct('noop'); } else command(e.clientX, e.clientY); return;
    }
    if (e.button !== 0) return;
    if (placing) { const wasStart = !wallStart; tryPlace(e.clientX, e.clientY, e.shiftKey); if (placing && BUILD[placing].wall && wasStart && wallStart) gest = { type: 'wall', sx: e.clientX, sy: e.clientY }; return; }
    if (st.rallyMode) { setRally(e.clientX, e.clientY); doAct('noop'); return; }
    if (st.atkMode) { command(e.clientX, e.clientY, true); st.atkMode = false; doAct('noop'); return; }
    gest = { type: 'mpending', sx: e.clientX, sy: e.clientY, shift: e.shiftKey }; return;
  }
  if (ptrs.size === 1) {
    const g = gest = { type: boxMode ? 'box' : 'tpending', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, shift: false };
    g.lp = setTimeout(() => { // appui long = sélection
      if (gest !== g || g.type !== 'tpending' || placing) return; const { ent } = pickEntity(g.sx, g.sy);
      if (ent?.kind === 'unit' && ent.team === 0) { ent.selected = true; st.selBuilding = null; }
      else if (ent?.kind === 'building') { setSel([]); st.selBuilding = ent; }
      else return;
      g.type = 'done'; navigator.vibrate?.(30); sfx('select'); updateHUD();
    }, 500);
  } else if (ptrs.size === 2) { clearTimeout(gest?.lp); gest = { type: 'pinch', ...pinchInfo() }; box.style.display = 'none'; }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; }
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (placing && e.pointerType === 'mouse') updateGhost(e.clientX, e.clientY);
  if (!gest || !ptrs.has(e.pointerId)) return;
  const moved = Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy);
  if (gest.type === 'mpending' && moved > 5) gest.type = 'box';
  if (gest.type === 'tpending' && moved > 12) { gest.type = 'pan'; clearTimeout(gest.lp); }
  if (gest.type === 'pan') { panBy(e.clientX - gest.lx, e.clientY - gest.ly); gest.lx = e.clientX; gest.ly = e.clientY; }
  else if (gest.type === 'box') drawBox(gest, e.clientX, e.clientY);
  else if (gest.type === 'pinch' && ptrs.size >= 2) { const p = pinchInfo(); st.camDist *= gest.d / p.d; panBy(p.mx - gest.mx, p.my - gest.my); Object.assign(gest, p); }
});
export function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (!gest) return;
  const x = e.clientX, y = e.clientY; clearTimeout(gest.lp);
  if (gest.type === 'mpending') clickSelect(x, y, gest.shift);
  else if (gest.type === 'tpending') tap(x, y);
  else if (gest.type === 'box') { box.style.display = 'none'; boxSelect(gest.sx, gest.sy, x, y, gest.shift); }
  else if (gest.type === 'wall' && placing && wallStart && Math.hypot(x - gest.sx, y - gest.sy) > 15) { const p = groundAt(x, y); if (p) finishWall(p); }
  if (gest.type === 'pinch' && ptrs.size === 1) { const p = [...ptrs.values()][0]; gest = { type: 'pan', sx: -1e4, sy: -1e4, lx: p.x, ly: p.y }; return; }
  if (!ptrs.size) gest = null; updateHUD();
}
cv.addEventListener('pointerup', endPtr);
 cv.addEventListener('pointercancel', e => { if (gest?.type === 'tpending') gest = null; endPtr(e); });
export let unlockAudio = () => { };
 export function setUnlock(f) { unlockAudio = f; }
