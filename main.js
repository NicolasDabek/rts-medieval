import * as THREE from 'three';

const SIZE = 120;
const res = { bois: 100, pierre: 50, or: 50 };
const COST_VILLAGER = { or: 50 }, COST_HOUSE = { bois: 60 };
const POP_PER_HOUSE = 5; let popCap = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9cc9f0);
scene.fog = new THREE.Fog(0x9cc9f0, 120, 260);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 500);
const camTarget = new THREE.Vector3(0, 0, 0); let camDist = 60;
function updateCam() { camera.position.set(camTarget.x, camDist * 0.85, camTarget.z + camDist * 0.6); camera.lookAt(camTarget); }
updateCam();
scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(40, 80, 30); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80 }); sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 40, 40), new THREE.MeshLambertMaterial({ color: 0x6aa04a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const mat = c => new THREE.MeshLambertMaterial({ color: c });
function mesh(geo, color, y = 0) { const m = new THREE.Mesh(geo, mat(color)); m.position.y = y; m.castShadow = true; return m; }

// ---- Obstacles / entités
const resources = [], buildings = [], units = [];
function rand(a, b) { return a + Math.random() * (b - a); }
function free(x, z, r) {
  for (const o of [...resources, ...buildings]) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + r) return false;
  return true;
}
function addResource(type, x, z) {
  const g = new THREE.Group();
  let amount, radius;
  if (type === 'bois') { g.add(mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.5), 0x6b4423, 0.75)); g.add(mesh(new THREE.ConeGeometry(1.2, 3, 7), 0x2f6b2a, 2.8)); amount = 100; radius = 0.9; }
  else { const c = type === 'or' ? 0xe0b630 : 0x8a8a8a; g.add(mesh(new THREE.DodecahedronGeometry(1.2), c, 0.6)); g.add(mesh(new THREE.DodecahedronGeometry(0.7), c, 0.4).translateX(1)); amount = 300; radius = 1.6; }
  g.position.set(x, 0, z); scene.add(g);
  const r = { kind: 'resource', type, amount, radius, mesh: g, pos: g.position };
  g.traverse(o => o.userData.ent = r); resources.push(r); return r;
}
function addBuilding(type, x, z) {
  const g = new THREE.Group(); let radius;
  if (type === 'hdv') { g.add(mesh(new THREE.BoxGeometry(6, 3, 6), 0xb08850, 1.5)); g.add(mesh(new THREE.ConeGeometry(4.8, 3, 4).rotateY(Math.PI / 4), 0x8b2e1e, 4.5)); g.add(mesh(new THREE.BoxGeometry(0.2, 2, 0.2), 0x333333, 6.5)); g.add(mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), 0x2040c0, 7).translateX(0.6)); radius = 4.2; }
  else { g.add(mesh(new THREE.BoxGeometry(3, 2, 3), 0xc8a878, 1)); g.add(mesh(new THREE.ConeGeometry(2.4, 1.6, 4).rotateY(Math.PI / 4), 0x7a3a20, 2.8)); radius = 2.2; }
  g.position.set(x, 0, z); scene.add(g);
  const b = { kind: 'building', type, radius, mesh: g, pos: g.position };
  g.traverse(o => o.userData.ent = b); buildings.push(b);
  if (type === 'maison') popCap += POP_PER_HOUSE;
  return b;
}
const townCenter = addBuilding('hdv', 0, 0);
// forêts en grappes
for (let k = 0; k < 8; k++) {
  const cx = rand(-50, 50), cz = rand(-50, 50); if (Math.hypot(cx, cz) < 18) continue;
  for (let i = 0; i < 14; i++) { const x = cx + rand(-7, 7), z = cz + rand(-7, 7); if (Math.abs(x) < 58 && Math.abs(z) < 58 && free(x, z, 1)) addResource('bois', x, z); }
}
for (let i = 0; i < 12; i++) { const x = rand(-12, 12), z = rand(-12, 12); if (Math.hypot(x - 6, z + 4) > 8 && free(x - 6, z + 4, 1)) addResource('bois', x - 6, z + 4); }
[['pierre', 14, 10], ['pierre', 16, 13], ['or', -15, 12], ['or', -17, 9], ['pierre', 35, -30], ['or', -40, -35]].forEach(([t, x, z]) => free(x, z, 1.6) && addResource(t, x, z));

// ---- Unités
const selRingGeo = new THREE.RingGeometry(0.6, 0.75, 20).rotateX(-Math.PI / 2);
function addVillager(x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8), 0x3060c0, 0.55));
  g.add(mesh(new THREE.SphereGeometry(0.3, 8, 8), 0xf0c8a0, 1.35));
  const carry = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), 0x6b4423, 0.7); carry.position.z = -0.45; carry.visible = false; g.add(carry);
  const ring = new THREE.Mesh(selRingGeo, new THREE.MeshBasicMaterial({ color: 0x40ff40 })); ring.position.y = 0.05; ring.visible = false; g.add(ring);
  g.position.set(x, 0, z); scene.add(g);
  const u = { kind: 'unit', mesh: g, pos: g.position, ring, carryMesh: carry, radius: 0.5, speed: 6, target: null, path: [], task: null, carry: 0, carryType: null, timer: 0, selected: false };
  g.traverse(o => o.userData.ent = u); units.push(u); updateHUD(); return u;
}

// ---- Pathfinding A* sur grille
const CELL = 1, N = SIZE / CELL;
function blockedGrid(ignore) {
  const g = new Uint8Array(N * N);
  for (const o of [...resources, ...buildings]) {
    if (o === ignore) continue;
    const r = o.radius + 0.3;
    for (let x = Math.floor(o.pos.x - r); x <= o.pos.x + r; x++) for (let z = Math.floor(o.pos.z - r); z <= o.pos.z + r; z++) {
      if (Math.hypot(x + 0.5 - o.pos.x, z + 0.5 - o.pos.z) < r) { const i = x + N / 2, j = z + N / 2; if (i >= 0 && j >= 0 && i < N && j < N) g[i + j * N] = 1; }
    }
  }
  return g;
}
let grid = blockedGrid();
const toCell = v => [Math.max(0, Math.min(N - 1, Math.floor(v.x) + N / 2)), Math.max(0, Math.min(N - 1, Math.floor(v.z) + N / 2))];
function findPath(from, to) {
  let [sx, sz] = toCell(from), [tx, tz] = toCell(to);
  if (grid[tx + tz * N]) { // cible bloquée : chercher la case libre la plus proche
    let best = null, bd = 1e9;
    for (let r = 1; r < 8 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = tx + dx, z = tz + dz; if (x < 0 || z < 0 || x >= N || z >= N || grid[x + z * N]) continue;
      const d = Math.hypot(x - sx, z - sz) * 0.01 + Math.hypot(dx, dz); if (d < bd) { bd = d; best = [x, z]; }
    }
    if (!best) return [to.clone()]; [tx, tz] = best;
  }
  const start = sx + sz * N, goal = tx + tz * N;
  const gS = new Float32Array(N * N).fill(Infinity), came = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
  const open = [[0, start]]; gS[start] = 0; let iter = 0;
  while (open.length && iter++ < 20000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0]; if (cur === goal) break; if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % N, cz = (cur / N) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue;
      const ni = x + z * N; if (grid[ni] || (dx && dz && (grid[cx + dx + cz * N] || grid[cx + (cz + dz) * N]))) continue;
      const ng = gS[cur] + (dx && dz ? 1.414 : 1);
      if (ng < gS[ni]) { gS[ni] = ng; came[ni] = cur; open.push([ng + Math.hypot(x - tx, z - tz), ni]); }
    }
  }
  if (came[goal] === -1 && goal !== start) return [to.clone()];
  const pts = []; for (let c = goal; c !== start && c !== -1; c = came[c]) pts.push(new THREE.Vector3((c % N) - N / 2 + 0.5, 0, ((c / N) | 0) - N / 2 + 0.5));
  pts.reverse();
  // lissage simple : saute les points en ligne de vue
  const out = []; let a = from.clone(), i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(a, pts[j])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
  return out;
}
function los(a, b) { const d = a.distanceTo(b), s = Math.ceil(d * 2); for (let k = 1; k <= s; k++) { const p = a.clone().lerp(b, k / s); const [x, z] = toCell(p); if (grid[x + z * N]) return false; } return true; }
function moveTo(u, p) { u.path = findPath(u.pos, p); }

// ---- HUD
const $ = id => document.getElementById(id);
function updateHUD() { $('wood').textContent = res.bois; $('stone').textContent = res.pierre; $('gold').textContent = res.or; $('pop').textContent = units.length + ' / ' + popCap; renderPanel(); }
let msgT; function msg(t) { $('msg').textContent = t; clearTimeout(msgT); msgT = setTimeout(() => $('msg').textContent = '', 2500); }
const canPay = c => Object.entries(c).every(([k, v]) => res[k] >= v);
const pay = c => Object.entries(c).forEach(([k, v]) => res[k] -= v);
let selectedBuilding = null, trainQueue = 0, trainTimer = 0, placing = null;
function renderPanel() {
  const p = $('panel'); const sel = units.filter(u => u.selected);
  if (selectedBuilding === townCenter) {
    p.innerHTML = `<b>Hôtel de ville</b><br><button id="bTrain">Former un villageois (50 or)</button> ${trainQueue ? `En formation : ${trainQueue} (${Math.ceil(trainTimer)} s)` : ''}`;
    $('bTrain').disabled = !canPay(COST_VILLAGER) || units.length + trainQueue >= popCap;
    $('bTrain').onclick = () => { if (canPay(COST_VILLAGER) && units.length + trainQueue < popCap) { pay(COST_VILLAGER); if (!trainQueue) trainTimer = 5; trainQueue++; updateHUD(); } else msg('Ressources ou population insuffisantes'); };
  } else if (selectedBuilding) p.innerHTML = '<b>Maison</b><br>+5 population';
  else if (sel.length) {
    p.innerHTML = `<b>${sel.length} villageois</b><br><button id="bHouse">Construire une maison (60 bois)</button>`;
    $('bHouse').disabled = !canPay(COST_HOUSE);
    $('bHouse').onclick = () => { if (canPay(COST_HOUSE)) { startPlacing(); } };
  } else p.innerHTML = '<i>Aucune sélection</i>';
}
let lastPanel = 0;

// ---- Placement de maison
let ghost;
function startPlacing() {
  placing = true; ghost = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 })); ghost.position.y = 1; scene.add(ghost);
  msg('Clic gauche pour placer la maison, Échap pour annuler');
}
function stopPlacing() { placing = false; if (ghost) scene.remove(ghost); ghost = null; }

// ---- Entrées
const keys = {}; let mouse = { x: innerWidth / 2, y: innerHeight / 2, in: false };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') stopPlacing(); });
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
addEventListener('wheel', e => { camDist = Math.max(15, Math.min(120, camDist + e.deltaY * 0.05)); updateCam(); });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mouseenter', () => mouse.in = true); cv.addEventListener('mouseleave', () => mouse.in = false);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([ground, ...units.map(u => u.mesh), ...resources.map(r => r.mesh), ...buildings.map(b => b.mesh)], true);
  for (const h of hits) if (h.object.userData.ent) return { ent: h.object.userData.ent, point: h.point };
  return hits[0] ? { ent: null, point: hits[0].point } : null;
}
let drag = null; const box = $('box');
cv.addEventListener('mousedown', e => {
  if (e.button === 0) {
    if (placing) {
      const h = pick(e.clientX, e.clientY);
      if (h && free(h.point.x, h.point.z, 2.2) && canPay(COST_HOUSE)) { pay(COST_HOUSE); addBuilding('maison', h.point.x, h.point.z); grid = blockedGrid(); stopPlacing(); updateHUD(); }
      else msg('Emplacement invalide');
      return;
    }
    drag = { x: e.clientX, y: e.clientY };
  } else if (e.button === 2) rightClick(e.clientX, e.clientY);
});
addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (placing && ghost) { const h = pick(e.clientX, e.clientY); if (h) { ghost.position.set(h.point.x, 1, h.point.z); ghost.material.color.set(free(h.point.x, h.point.z, 2.2) ? 0x00ff00 : 0xff0000); } }
  if (drag) { const x = Math.min(drag.x, e.clientX), y = Math.min(drag.y, e.clientY); Object.assign(box.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - drag.x) + 'px', height: Math.abs(e.clientY - drag.y) + 'px' }); }
});
addEventListener('mouseup', e => {
  if (e.button !== 0 || !drag) return;
  const add = e.shiftKey; if (!add) units.forEach(u => u.selected = false); selectedBuilding = null;
  if (Math.abs(e.clientX - drag.x) < 5 && Math.abs(e.clientY - drag.y) < 5) {
    const h = pick(e.clientX, e.clientY);
    if (h?.ent?.kind === 'unit') h.ent.selected = true;
    else if (h?.ent?.kind === 'building') selectedBuilding = h.ent;
  } else {
    const x1 = Math.min(drag.x, e.clientX), x2 = Math.max(drag.x, e.clientX), y1 = Math.min(drag.y, e.clientY), y2 = Math.max(drag.y, e.clientY);
    for (const u of units) { const p = u.pos.clone().project(camera); const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) u.selected = true; }
  }
  units.forEach(u => u.ring.visible = u.selected);
  drag = null; box.style.display = 'none'; renderPanel();
});
function rightClick(x, y) {
  const sel = units.filter(u => u.selected); if (!sel.length) return;
  const h = pick(x, y); if (!h) return;
  if (h.ent?.kind === 'resource') { sel.forEach(u => { u.task = { res: h.ent }; u.state = 'toRes'; moveTo(u, h.ent.pos); }); msg('Récolte : ' + h.ent.type); }
  else if (h.ent === townCenter) sel.forEach(u => { u.task = null; if (u.carry) { u.state = 'toDrop'; moveTo(u, townCenter.pos); } else moveTo(u, townCenter.pos); });
  else { // formation en grille autour du point
    const cols = Math.ceil(Math.sqrt(sel.length));
    sel.forEach((u, i) => { u.task = null; u.state = null; moveTo(u, new THREE.Vector3(h.point.x + (i % cols - (cols - 1) / 2) * 1.3, 0, h.point.z + (Math.floor(i / cols) - (cols - 1) / 2) * 1.3)); });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffff00 })); m.position.set(h.point.x, 0.1, h.point.z); scene.add(m); setTimeout(() => scene.remove(m), 400);
  }
}

// ---- Logique
const CAP = 10, RES_COLORS = { bois: 0x6b4423, pierre: 0x8a8a8a, or: 0xe0b630 };
function nearestRes(type, p) { let b = null, bd = 1e9; for (const r of resources) { const d = r.pos.distanceTo(p); if (r.type === type && d < bd) { bd = d; b = r; } } return b; }
function updateUnit(u, dt) {
  // déplacement
  let moving = false;
  if (u.path.length) {
    const t = u.path[0], d = new THREE.Vector3(t.x - u.pos.x, 0, t.z - u.pos.z), len = d.length();
    if (len < 0.3) u.path.shift(); else { d.multiplyScalar(Math.min(len, u.speed * dt) / len); u.pos.add(d); u.mesh.rotation.y = Math.atan2(d.x, d.z); moving = true; }
  }
  // évitement entre unités
  for (const o of units) if (o !== u) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 0.9 && d > 1e-4) { const p = (0.9 - d) * 0.5; u.pos.x += dx / d * p; u.pos.z += dz / d * p; } }
  // ne pas traverser les obstacles
  for (const o of [...resources, ...buildings]) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.radius + 0.4; if (d < m && d > 1e-4) { u.pos.x = o.pos.x + dx / d * m; u.pos.z = o.pos.z + dz / d * m; } }
  u.mesh.children[0].position.y = 0.55 + (moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.12 : 0);
  // tâche de récolte
  if (!u.task) return;
  let r = u.task.res;
  if (u.state === 'toRes') {
    if (!resources.includes(r)) { r = u.task.res = nearestRes(r.type, u.pos); if (!r) { u.task = null; return; } moveTo(u, r.pos); }
    if (u.pos.distanceTo(r.pos) < r.radius + 1.2) { u.state = 'gather'; u.path = []; u.timer = 0; }
    else if (!u.path.length) moveTo(u, r.pos);
  } else if (u.state === 'gather') {
    if (!resources.includes(r)) { u.state = 'toRes'; return; }
    u.mesh.lookAt(r.pos.x, 0, r.pos.z);
    u.timer += dt; if (u.timer > 0.5) { u.timer = 0; if (u.carryType !== r.type) { u.carry = 0; u.carryType = r.type; } u.carry++; r.amount--;
      if (r.amount <= 0) { scene.remove(r.mesh); resources.splice(resources.indexOf(r), 1); grid = blockedGrid(); }
      if (u.carry >= CAP || r.amount <= 0) { u.state = 'toDrop'; moveTo(u, townCenter.pos); } }
  } else if (u.state === 'toDrop') {
    if (u.pos.distanceTo(townCenter.pos) < townCenter.radius + 1.3) { res[u.carryType] += u.carry; u.carry = 0; u.state = 'toRes'; updateHUD(); if (resources.includes(r)) moveTo(u, r.pos); }
    else if (!u.path.length) moveTo(u, townCenter.pos);
  }
  u.carryMesh.visible = u.carry > 0; if (u.carryType) u.carryMesh.material.color.set(RES_COLORS[u.carryType]);
}

for (let i = 0; i < 3; i++) addVillager(-2 + i * 2, 6);

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const sp = camDist * 0.9 * dt, e = 15; let mv = false;
  if (keys.w || keys.z || keys.arrowup || (mouse.in && mouse.y < e)) { camTarget.z -= sp; mv = true; }
  if (keys.s || keys.arrowdown || (mouse.in && mouse.y > innerHeight - e)) { camTarget.z += sp; mv = true; }
  if (keys.a || keys.q || keys.arrowleft || (mouse.in && mouse.x < e)) { camTarget.x -= sp; mv = true; }
  if (keys.d || keys.arrowright || (mouse.in && mouse.x > innerWidth - e)) { camTarget.x += sp; mv = true; }
  if (mv) { camTarget.x = Math.max(-60, Math.min(60, camTarget.x)); camTarget.z = Math.max(-60, Math.min(60, camTarget.z)); updateCam(); }
  units.forEach(u => updateUnit(u, dt));
  if (trainQueue) { trainTimer -= dt; if (trainTimer <= 0) { trainQueue--; trainTimer = 5; const v = addVillager(townCenter.pos.x + rand(-2, 2), townCenter.pos.z + 5.5); } }
  if (performance.now() - lastPanel > 500) { lastPanel = performance.now(); if (selectedBuilding || trainQueue) renderPanel(); }
  renderer.render(scene, camera); requestAnimationFrame(loop);
}
updateHUD(); loop();
window.__game = { units, resources, buildings, res };
