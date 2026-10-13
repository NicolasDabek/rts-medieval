import * as THREE from 'three';

// ================= Configuration =================
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const SPEED = +params.get('speed') || 1;
const NOFOG = params.has('nofog');
const SIZE = 160, HALF = SIZE / 2;
const UNIT = {
  villageois: { hp: 40, atk: 3, range: 1.2, cd: 1.5, speed: 5.5, cost: { or: 40 }, time: 6, aggro: 0, label: 'Villageois' },
  epeiste: { hp: 100, atk: 10, range: 1.3, cd: 1, speed: 5, cost: { or: 40, bois: 20 }, time: 8, aggro: 11, label: 'Épéiste' },
  archer: { hp: 55, atk: 7, range: 10, cd: 1.5, speed: 5.5, cost: { bois: 45, or: 25 }, time: 8, aggro: 12, label: 'Archer' },
};
const BUILD = {
  hdv: { hp: 1500, radius: 4.2, pop: 5, atk: 6, range: 10, cd: 2, label: 'Hôtel de ville', bar: 8 },
  maison: { hp: 300, radius: 2.2, pop: 5, cost: { bois: 60 }, time: 12, label: 'Maison', bar: 4 },
  caserne: { hp: 700, radius: 3.3, cost: { bois: 120, pierre: 80 }, time: 25, label: 'Caserne', bar: 5.5 },
};
const RES_LABEL = { bois: 'Bois', pierre: 'Pierre', or: 'Or' };
const TEAM_COLOR = [0x3060c0, 0xc03030];
const teams = [{ res: { bois: 150, pierre: 60, or: 80 } }, { res: { bois: 150, pierre: 60, or: 80 } }];
const costTxt = c => Object.entries(c).map(([k, v]) => `${v} ${RES_LABEL[k].toLowerCase()}`).join(' + ');

// ================= Rendu =================
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !isTouch;
document.body.prepend(renderer.domElement);
const cv = renderer.domElement;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9cc9f0);
scene.fog = new THREE.Fog(0x9cc9f0, 140, 300);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 600);
const camTarget = new THREE.Vector3(); let camDist = isTouch ? 50 : 60;
function updateCam() {
  camTarget.x = Math.max(-HALF, Math.min(HALF, camTarget.x)); camTarget.z = Math.max(-HALF, Math.min(HALF, camTarget.z));
  camDist = Math.max(15, Math.min(130, camDist));
  camera.position.set(camTarget.x, camDist * 0.85, camTarget.z + camDist * 0.6); camera.lookAt(camTarget);
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(40, 80, 30); sun.castShadow = !isTouch;
Object.assign(sun.shadow.camera, { left: -HALF, right: HALF, top: HALF, bottom: -HALF }); sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshLambertMaterial({ color: 0x6aa04a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const matCache = {};
const mat = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
function mk(geo, color, y = 0, own = false) { const m = new THREE.Mesh(geo, own ? new THREE.MeshLambertMaterial({ color }) : mat(color)); m.position.y = y; m.castShadow = !isTouch; return m; }
const G = {
  trunk: new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6), leaves: new THREE.ConeGeometry(1.2, 3, 7),
  rock: new THREE.DodecahedronGeometry(1.2), rock2: new THREE.DodecahedronGeometry(0.7),
  body: new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8), head: new THREE.SphereGeometry(0.3, 8, 6),
  sword: new THREE.BoxGeometry(0.08, 0.9, 0.12), shield: new THREE.BoxGeometry(0.08, 0.6, 0.5), helm: new THREE.ConeGeometry(0.32, 0.4, 8),
  bow: new THREE.TorusGeometry(0.45, 0.04, 4, 12, Math.PI), carry: new THREE.BoxGeometry(0.4, 0.4, 0.4),
  ring: new THREE.RingGeometry(0.6, 0.75, 20).rotateX(-Math.PI / 2), arrow: new THREE.BoxGeometry(0.06, 0.06, 0.8),
  bar: new THREE.PlaneGeometry(1, 0.16),
};
const ringMat = new THREE.MeshBasicMaterial({ color: 0x40ff40 });

// ================= Entités =================
const resources = [], buildings = [], units = [], arrows = [];
const rand = (a, b) => a + Math.random() * (b - a);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function free(x, z, r) {
  if (Math.abs(x) > HALF - r - 1 || Math.abs(z) > HALF - r - 1) return false;
  for (const o of resources) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + r) return false;
  for (const o of buildings) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + r + 1) return false;
  return true;
}
function tag(e) { e.mesh.traverse(o => o.userData.ent = e); }

function addResource(type, x, z) {
  if (!free(x, z, type === 'bois' ? 1 : 1.6)) return;
  const g = new THREE.Group(); let amount, radius;
  if (type === 'bois') { g.add(mk(G.trunk, 0x6b4423, 0.75)); g.add(mk(G.leaves, 0x2f6b2a, 2.8)); amount = 100; radius = 0.9; g.rotation.y = rand(0, 6); }
  else { const c = type === 'or' ? 0xe0b630 : 0x8a8a8a; g.add(mk(G.rock, c, 0.6)); g.add(mk(G.rock2, c, 0.4).translateX(1)); amount = 400; radius = 1.6; }
  g.position.set(x, 0, z); scene.add(g);
  const r = { kind: 'resource', type, amount, radius, mesh: g, pos: g.position };
  tag(r); resources.push(r); return r;
}

function makeBar(e, w, h) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.7 }));
  const fg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x30e030, depthTest: false }));
  bg.scale.x = w; bg.renderOrder = 10; fg.renderOrder = 11; g.add(bg, fg); g.userData = { fg, w, h }; g.visible = false; scene.add(g); e.bar = g;
}

function addBuilding(type, team, x, z, done = true) {
  const S = BUILD[type], g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const tc = TEAM_COLOR[team];
  if (type === 'hdv') {
    inner.add(mk(new THREE.BoxGeometry(6, 3, 6), 0xb08850, 1.5)); inner.add(mk(new THREE.ConeGeometry(4.8, 3, 4).rotateY(Math.PI / 4), 0x8b2e1e, 4.5));
    inner.add(mk(new THREE.BoxGeometry(0.2, 2, 0.2), 0x333333, 6.5)); inner.add(mk(new THREE.BoxGeometry(1.2, 0.7, 0.05), tc, 7).translateX(0.6));
  } else if (type === 'maison') {
    inner.add(mk(new THREE.BoxGeometry(3, 2, 3), 0xc8a878, 1)); inner.add(mk(new THREE.ConeGeometry(2.4, 1.6, 4).rotateY(Math.PI / 4), tc, 2.8));
  } else {
    inner.add(mk(new THREE.BoxGeometry(6, 2.6, 4.5), 0x8d8d8d, 1.3)); inner.add(mk(new THREE.BoxGeometry(6.4, 0.6, 4.9), tc, 2.9));
    for (const sx of [-2.6, 2.6]) inner.add(mk(new THREE.BoxGeometry(1.2, 4, 1.2), 0x777777, 2).translateX(sx));
  }
  g.position.set(x, 0, z); scene.add(g);
  const b = { kind: 'building', type, team, radius: S.radius, mesh: g, inner, pos: g.position, maxHp: S.hp, hp: done ? S.hp : S.hp * 0.1, done, progress: done ? 1 : 0, queue: [], trainT: 0, cdT: 0 };
  if (!done) inner.scale.y = 0.1;
  tag(b); makeBar(b, S.radius * 1.2, S.bar); buildings.push(b); rebuildGrid(); return b;
}

function addUnit(type, team, x, z) {
  const S = UNIT[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(mk(G.body, TEAM_COLOR[team], 0.55)); body.add(mk(G.head, 0xf0c8a0, 1.35));
  if (type === 'epeiste') { body.add(mk(G.sword, 0xdddddd, 0.9).translateX(0.45)); body.add(mk(G.shield, 0x7a5030, 0.7).translateX(-0.45)); body.add(mk(G.helm, 0x999999, 1.62)); }
  if (type === 'archer') { const bow = mk(G.bow, 0x6b4423, 0.9); bow.rotation.z = -Math.PI / 2; bow.position.x = 0.45; body.add(bow); }
  const carry = mk(G.carry, 0x6b4423, 0.7, true); carry.position.z = -0.45; carry.visible = false; body.add(carry);
  const ring = new THREE.Mesh(G.ring, ringMat); ring.position.y = 0.05; ring.visible = false; g.add(ring);
  g.position.set(x, 0, z); scene.add(g);
  const u = { kind: 'unit', type, team, mesh: g, body, pos: g.position, ring, carryMesh: carry, radius: 0.5, hp: S.hp, maxHp: S.hp, path: [], cmd: null, target: null, carry: 0, carryType: null, timer: 0, cdT: 0, scanT: 0, repathT: 0, selected: false };
  tag(u); makeBar(u, 1.2, 2.1); units.push(u); return u;
}

// ================= Pathfinding (A* sur grille, tas binaire) =================
const N = SIZE; let grid = new Uint8Array(N * N);
function rebuildGrid() {
  grid = new Uint8Array(N * N);
  for (const o of [...resources, ...buildings]) {
    const r = o.radius + 0.3;
    for (let x = Math.floor(o.pos.x - r); x <= o.pos.x + r; x++) for (let z = Math.floor(o.pos.z - r); z <= o.pos.z + r; z++)
      if (Math.hypot(x + 0.5 - o.pos.x, z + 0.5 - o.pos.z) < r) { const i = x + HALF, j = z + HALF; if (i >= 0 && j >= 0 && i < N && j < N) grid[i + j * N] = 1; }
  }
}
const toCell = v => [Math.max(0, Math.min(N - 1, Math.floor(v.x) + HALF)), Math.max(0, Math.min(N - 1, Math.floor(v.z) + HALF))];
const cellPos = c => new THREE.Vector3((c % N) - HALF + 0.5, 0, ((c / N) | 0) - HALF + 0.5);
const gS = new Float32Array(N * N), came = new Int32Array(N * N), seen = new Uint32Array(N * N), closed = new Uint32Array(N * N); let gen = 0;
const hF = [], hN = [];
function hPush(f, n) { let i = hF.length; hF.push(f); hN.push(n); while (i > 0) { const p = (i - 1) >> 1; if (hF[p] <= f) break; hF[i] = hF[p]; hN[i] = hN[p]; i = p; } hF[i] = f; hN[i] = n; }
function hPop() {
  const top = hN[0], lf = hF.pop(), ln = hN.pop(); const len = hF.length;
  if (len) { let i = 0; while (true) { let c = 2 * i + 1; if (c >= len) break; if (c + 1 < len && hF[c + 1] < hF[c]) c++; if (hF[c] >= lf) break; hF[i] = hF[c]; hN[i] = hN[c]; i = c; } hF[i] = lf; hN[i] = ln; }
  return top;
}
function findPath(from, to) {
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
  pts.reverse(); if (found && !grid[toCell(to)[0] + toCell(to)[1] * N]) pts.push(to.clone().setY(0));
  const out = []; let a = from.clone(), i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(a, pts[j])) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
  return out;
}
function los(a, b) { const s = Math.ceil(d2(a, b) * 2); for (let k = 1; k <= s; k++) { const t = k / s; const [x, z] = toCell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); if (grid[x + z * N]) return false; } return true; }
function moveTo(u, p) { u.path = findPath(u.pos, p); }

// ================= Carte =================
const P0 = new THREE.Vector3(-48, 0, 48), P1 = new THREE.Vector3(48, 0, -48);
const hdv0 = addBuilding('hdv', 0, P0.x, P0.z), hdv1 = addBuilding('hdv', 1, P1.x, P1.z);
function baseResources(B, s) {
  const o = (dx, dz) => [B.x + dx * s, B.z + dz * s];
  for (const [cx, cz, n] of [[-12, -4, 16], [6, 13, 14], [16, -14, 10]]) for (let i = 0; i < n; i++) { const [x, z] = o(cx + rand(-5, 5), cz + rand(-5, 5)); addResource('bois', x, z); }
  addResource('pierre', ...o(11, 6)); addResource('pierre', ...o(13, 9.5));
  addResource('or', ...o(-9, 11)); addResource('or', ...o(-12.5, 8));
}
baseResources(P0, 1); baseResources(P1, -1);
for (let k = 0; k < 14; k++) {
  const cx = rand(-70, 70), cz = rand(-70, 70); if (d2({ x: cx, z: cz }, P0) < 28 || d2({ x: cx, z: cz }, P1) < 28) continue;
  for (let i = 0; i < 14; i++) addResource('bois', cx + rand(-7, 7), cz + rand(-7, 7));
}
for (const [t, x, z] of [['or', 0, 0], ['or', 3, 2], ['pierre', -25, -25], ['pierre', 25, 25], ['or', -50, -10], ['or', 50, 10], ['pierre', -10, -50], ['pierre', 10, 50]]) addResource(t, x, z);
rebuildGrid();
for (let i = 0; i < 3; i++) { addUnit('villageois', 0, P0.x + 4 + i * 1.5, P0.z - 6); addUnit('villageois', 1, P1.x - 4 - i * 1.5, P1.z + 6); }
camTarget.copy(P0); updateCam();

// ================= Brouillard de guerre =================
const FC = 2, FN = SIZE / FC;
const visible = new Uint8Array(FN * FN), explored = new Uint8Array(FN * FN);
const fogData = new Uint8Array(FN * FN * 4);
const fogTex = new THREE.DataTexture(fogData, FN, FN); fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
fogPlane.rotation.x = -Math.PI / 2; fogPlane.position.y = 0.12; fogPlane.renderOrder = 1; scene.add(fogPlane); fogPlane.visible = !NOFOG;
const fogIdx = p => { const i = Math.max(0, Math.min(FN - 1, Math.floor((p.x + HALF) / FC))), j = Math.max(0, Math.min(FN - 1, Math.floor((p.z + HALF) / FC))); return i + j * FN; };
const isVis = p => NOFOG || visible[fogIdx(p)];
const isExp = p => NOFOG || explored[fogIdx(p)];
function updateFog() {
  visible.fill(0);
  const reveal = (p, r) => {
    const ci = (p.x + HALF) / FC, cj = (p.z + HALF) / FC, rr = r / FC;
    for (let i = Math.max(0, Math.floor(ci - rr)); i <= Math.min(FN - 1, ci + rr); i++) for (let j = Math.max(0, Math.floor(cj - rr)); j <= Math.min(FN - 1, cj + rr); j++)
      if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 < rr * rr) { visible[i + j * FN] = 1; explored[i + j * FN] = 1; }
  };
  for (const u of units) if (u.team === 0) reveal(u.pos, u.type === 'archer' ? 14 : 11);
  for (const b of buildings) if (b.team === 0) reveal(b.pos, b.type === 'hdv' ? 18 : 12);
  for (let i = 0; i < FN; i++) for (let j = 0; j < FN; j++) {
    const k = i + j * FN, row = FN - 1 - j; // v=0 correspond à z=+HALF
    fogData[(i + row * FN) * 4 + 3] = visible[k] ? 0 : explored[k] ? 120 : 235;
  }
  fogTex.needsUpdate = true;
  for (const u of units) if (u.team === 1) u.mesh.visible = isVis(u.pos);
  for (const b of buildings) if (b.team === 1) { if (isVis(b.pos)) b.seen = true; b.mesh.visible = !!b.seen || NOFOG; }
  for (const r of resources) r.mesh.visible = isExp(r.pos);
}

// ================= Économie =================
const canPay = (t, c) => Object.entries(c).every(([k, v]) => teams[t].res[k] >= v);
const pay = (t, c) => Object.entries(c).forEach(([k, v]) => teams[t].res[k] -= v);
const popCap = t => Math.min(60, buildings.reduce((s, b) => s + (b.team === t && b.done ? (BUILD[b.type].pop || 0) : 0), 0));
const popCount = t => units.filter(u => u.team === t).length + buildings.reduce((s, b) => s + (b.team === t ? b.queue.length : 0), 0);
const hdvOf = t => buildings.find(b => b.team === t && b.type === 'hdv');
function train(b, type) {
  const S = UNIT[type];
  if (!b.done || !canPay(b.team, S.cost) || popCount(b.team) >= popCap(b.team) || b.queue.length >= 5) return false;
  pay(b.team, S.cost); if (!b.queue.length) b.trainT = S.time; b.queue.push(type); return true;
}
function placeBuilding(type, team, x, z) {
  const S = BUILD[type]; if (!canPay(team, S.cost) || !free(x, z, S.radius)) return null;
  pay(team, S.cost); return addBuilding(type, team, x, z, false);
}
function nearestRes(type, p, max = 1e9) { let b = null, bd = max; for (const r of resources) { const d = d2(r.pos, p); if ((!type || r.type === type) && d < bd) { bd = d; b = r; } } return b; }

// ================= Commandes =================
function cmdGather(u, r) { u.cmd = { type: 'gather', res: r }; u.state = 'toRes'; u.target = null; moveTo(u, r.pos); }
function cmdBuild(u, b) { u.cmd = { type: 'build', b }; u.target = null; moveTo(u, b.pos); }
function cmdAttack(u, e) { u.cmd = { type: 'attack', target: e }; u.target = e; u.path = []; u.repathT = 0; }
function cmdMove(u, p, type = 'move') { u.cmd = { type, dest: p.clone() }; u.target = null; moveTo(u, p); }
function formation(sel, p, type) {
  const cols = Math.ceil(Math.sqrt(sel.length));
  sel.forEach((u, i) => cmdMove(u, new THREE.Vector3(p.x + (i % cols - (cols - 1) / 2) * 1.4, 0, p.z + (Math.floor(i / cols) - (cols - 1) / 2) * 1.4), type));
}

// ================= Combat =================
function nearestEnemy(u, r) {
  let best = null, bd = r;
  for (const o of units) if (o.team !== u.team) { const d = d2(o.pos, u.pos); if (d < bd) { bd = d; best = o; } }
  if (best) return best;
  for (const b of buildings) if (b.team !== u.team) { const d = d2(b.pos, u.pos) - b.radius; if (d < bd) { bd = d; best = b; } }
  return best;
}
function shootArrow(from, to) {
  const m = new THREE.Mesh(G.arrow, mat(0x5a3a1a)); scene.add(m);
  arrows.push({ m, a: from.clone().setY(1.4), b: to.clone().setY(1), t: 0, dur: Math.max(0.15, d2(from, to) / 30) });
}
function damage(t, dmg, src) {
  if (t.dead) return; t.hp -= dmg;
  if (t.kind === 'unit' && src && !src.dead && !t.target && UNIT[t.type].aggro && (!t.cmd || t.cmd.type !== 'move')) t.target = src;
  if (t.kind === 'unit' && t.type === 'villageois' && t.team === 1 && src) aiDefend(src);
  if (t.hp <= 0) kill(t);
}
function kill(e) {
  if (e.dead) return; e.dead = true; scene.remove(e.mesh); if (e.bar) scene.remove(e.bar);
  const arr = e.kind === 'unit' ? units : e.kind === 'building' ? buildings : resources; arr.splice(arr.indexOf(e), 1);
  if (e.kind !== 'unit') rebuildGrid();
  if (e === selBuilding) selBuilding = null;
  if (e.kind === 'building' && e.type === 'hdv') endGame(e.team === 1);
}

// ================= Mise à jour des unités =================
const CAP = 10, RES_COLORS = { bois: 0x6b4423, pierre: 0x8a8a8a, or: 0xe0b630 };
function updateUnit(u, dt) {
  const S = UNIT[u.type]; u.cdT -= dt;
  if (!u.target && S.aggro && (!u.cmd || u.cmd.type === 'attackMove')) { u.scanT -= dt; if (u.scanT <= 0) { u.scanT = 0.4; const t = nearestEnemy(u, S.aggro); if (t) { u.target = t; u.repathT = 0; } } }
  if (u.target) {
    const t = u.target;
    if (t.dead) { u.target = null; u.path = []; if (u.cmd?.type === 'attack') u.cmd = null; else if (u.cmd?.type === 'attackMove') moveTo(u, u.cmd.dest); }
    else {
      const d = d2(u.pos, t.pos) - (t.radius || 0.5);
      if (d <= S.range) {
        u.path = []; u.mesh.rotation.y = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z);
        if (u.cdT <= 0) { u.cdT = S.cd; if (S.range > 3) shootArrow(u.pos, t.pos); else u.body.rotation.x = 0.4; damage(t, S.atk, u); }
      } else if (u.cmd?.type !== 'attack' && d > S.aggro * 1.8) { u.target = null; if (u.cmd?.type === 'attackMove') moveTo(u, u.cmd.dest); else u.path = []; }
      else { u.repathT -= dt; if (u.repathT <= 0 || !u.path.length) { u.repathT = 0.8; u.path = los(u.pos, t.pos) ? [t.pos.clone()] : findPath(u.pos, t.pos); } }
    }
  }
  u.body.rotation.x *= 0.85;
  // déplacement
  let moving = false;
  if (u.path.length) {
    const p = u.path[0], dx = p.x - u.pos.x, dz = p.z - u.pos.z, len = Math.hypot(dx, dz);
    if (len < 0.3) u.path.shift(); else { const s = Math.min(len, S.speed * dt) / len; u.pos.x += dx * s; u.pos.z += dz * s; u.mesh.rotation.y = Math.atan2(dx, dz); moving = true; }
  }
  for (const o of units) if (o !== u) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = dx * dx + dz * dz; if (d < 0.81 && d > 1e-8) { const dd = Math.sqrt(d), p = (0.9 - dd) * 0.5; u.pos.x += dx / dd * p; u.pos.z += dz / dd * p; } }
  for (const o of buildings) pushOut(u, o); for (const o of resources) if (Math.abs(o.pos.x - u.pos.x) < 3 && Math.abs(o.pos.z - u.pos.z) < 3) pushOut(u, o);
  u.pos.x = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, u.pos.x)); u.pos.z = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, u.pos.z));
  u.body.position.y = moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.12 : 0;
  if ((u.cmd?.type === 'move' || u.cmd?.type === 'attackMove') && !u.path.length && !u.target) u.cmd = null;
  if (u.target || !u.cmd) return;
  // récolte
  if (u.cmd.type === 'gather') {
    let r = u.cmd.res; const home = hdvOf(u.team); if (!home) return;
    if (u.state === 'toRes') {
      if (!r || r.dead) { r = u.cmd.res = r && nearestRes(r.type, u.pos, 30); if (!r) { u.cmd = null; return; } moveTo(u, r.pos); }
      if (d2(u.pos, r.pos) < r.radius + 1.2) { u.state = 'gather'; u.path = []; u.timer = 0; }
      else if (!u.path.length) moveTo(u, r.pos);
    } else if (u.state === 'gather') {
      if (r.dead) { u.state = 'toRes'; return; }
      u.mesh.rotation.y = Math.atan2(r.pos.x - u.pos.x, r.pos.z - u.pos.z);
      u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 12) * 0.2;
      if (u.timer > 0.5) {
        u.timer = 0; if (u.carryType !== r.type) { u.carry = 0; u.carryType = r.type; } u.carry++; r.amount--;
        if (r.amount <= 0) kill(r);
        if (u.carry >= CAP || r.dead) { u.state = 'toDrop'; moveTo(u, home.pos); }
      }
    } else if (u.state === 'toDrop') {
      if (d2(u.pos, home.pos) < home.radius + 1.4) { if (u.carryType) teams[u.team].res[u.carryType] += u.carry; u.carry = 0; u.state = 'toRes'; if (r && !r.dead) moveTo(u, r.pos); }
      else if (!u.path.length) moveTo(u, home.pos);
    }
    u.carryMesh.visible = u.carry > 0; if (u.carryType) u.carryMesh.material.color.set(RES_COLORS[u.carryType]);
  } else if (u.cmd.type === 'build') {
    const b = u.cmd.b;
    if (b.dead || b.done) { u.cmd = null; const r = nearestRes(null, u.pos, 25); if (r && u.team === 0 && b.type !== 'hdv') cmdGather(u, nearestRes(r.type, u.pos)); return; }
    if (d2(u.pos, b.pos) < b.radius + 1.5) {
      u.path = []; u.mesh.rotation.y = Math.atan2(b.pos.x - u.pos.x, b.pos.z - u.pos.z); u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 10) * 0.3;
      const inc = dt / BUILD[b.type].time; b.progress = Math.min(1, b.progress + inc); b.hp = Math.min(b.maxHp, b.hp + inc * b.maxHp * 0.9);
      b.inner.scale.y = 0.1 + 0.9 * b.progress;
      if (b.progress >= 1) { b.done = true; if (b.team === 0) msg(`${BUILD[b.type].label} terminée !`); }
    } else if (!u.path.length) moveTo(u, b.pos);
  }
}
function pushOut(u, o) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.radius + 0.4; if (d < m && d > 1e-4) { u.pos.x = o.pos.x + dx / d * m; u.pos.z = o.pos.z + dz / d * m; } }

function updateBuilding(b, dt) {
  if (!b.done) return;
  if (b.queue.length) {
    b.trainT -= dt;
    if (b.trainT <= 0) {
      const type = b.queue.shift(); const dir = new THREE.Vector3(-b.pos.x, 0, -b.pos.z).normalize();
      const u = addUnit(type, b.team, b.pos.x + dir.x * (b.radius + 1.5) + rand(-1, 1), b.pos.z + dir.z * (b.radius + 1.5) + rand(-1, 1));
      if (b.rally) cmdMove(u, b.rally, UNIT[type].aggro ? 'attackMove' : 'move');
      if (b.queue.length) b.trainT = UNIT[b.queue[0]].time;
    }
  }
  if (b.type === 'hdv') {
    b.cdT -= dt; if (b.cdT <= 0) { const t = nearestEnemy(b, BUILD.hdv.range + b.radius); if (t && t.kind === 'unit') { b.cdT = BUILD.hdv.cd; shootArrow(b.pos.clone().setY(5), t.pos); damage(t, BUILD.hdv.atk, null); } }
  }
}

// ================= IA =================
const ai = { t: 0, think: 0, nextWave: 240, waveN: 0 };
function aiSpot(r) {
  const h = hdvOf(1); for (let k = 0; k < 40; k++) { const a = rand(0, Math.PI * 2), d = rand(9, 22), x = h.pos.x + Math.cos(a) * d, z = h.pos.z + Math.sin(a) * d; if (free(x, z, r + 1.5)) return [x, z]; }
  return null;
}
function aiBuild(type, vills) {
  if (!canPay(1, BUILD[type].cost)) return; const s = aiSpot(BUILD[type].radius); if (!s) return;
  const b = placeBuilding(type, 1, s[0], s[1]); if (b) vills.filter(v => v.cmd?.type !== 'build').slice(0, 2).forEach(v => cmdBuild(v, b));
}
function aiDefend(src) {
  for (const s of units) if (s.team === 1 && s.type !== 'villageois' && !s.target && (!s.cmd || s.cmd.type !== 'attackMove')) cmdMove(s, src.pos, 'attackMove');
}
function aiUpdate(dt) {
  ai.t += dt; ai.think -= dt; if (ai.think > 0) return; ai.think = 1;
  const R = teams[1].res; R.or += 0.5; R.bois += 0.5; R.pierre += 0.2; // petit bonus d'IA
  const h = hdvOf(1); if (!h) return;
  const my = units.filter(u => u.team === 1), vills = my.filter(u => u.type === 'villageois'), sold = my.filter(u => u.type !== 'villageois');
  const mine = buildings.filter(b => b.team === 1);
  for (const b of mine.filter(b => !b.done)) if (vills.filter(v => v.cmd?.type === 'build' && v.cmd.b === b).length < 2) { const v = vills.find(v => v.cmd?.type !== 'build'); if (v) cmdBuild(v, b); }
  const want = { bois: 0.45, or: 0.35, pierre: 0.2 };
  for (const v of vills) if (!v.cmd) {
    const cnt = { bois: 0, or: 0, pierre: 0 }; vills.forEach(o => o.cmd?.type === 'gather' && o.cmd.res && cnt[o.cmd.res.type]++);
    const type = Object.keys(want).sort((a, b) => cnt[a] / want[a] - cnt[b] / want[b])[0];
    const r = nearestRes(type, h.pos, 45) || nearestRes(null, h.pos); if (r) cmdGather(v, r);
  }
  const cap = popCap(1), pop = popCount(1);
  if (vills.length < 12 && !h.queue.length && pop < cap) train(h, 'villageois');
  if (pop >= cap - 2 && cap < 60 && !mine.some(b => b.type === 'maison' && !b.done)) aiBuild('maison', vills);
  const cas = mine.filter(b => b.type === 'caserne');
  if (vills.length >= 5 && cas.length < (ai.t > 600 ? 2 : 1)) aiBuild('caserne', vills);
  for (const c of cas) if (c.done && c.queue.length < 2) train(c, Math.random() < 0.55 ? 'epeiste' : 'archer');
  const threat = units.find(u => u.team === 0 && d2(u.pos, h.pos) < 25); if (threat) aiDefend(threat);
  if (ai.t > ai.nextWave) {
    const idle = sold.filter(s => !s.target), n = Math.min(idle.length, 3 + ai.waveN * 2);
    const tgt = hdvOf(0) || buildings.find(b => b.team === 0);
    if (n >= 3 && tgt) {
      idle.slice(0, n).forEach(s => cmdMove(s, tgt.pos, 'attackMove'));
      ai.waveN++; ai.nextWave = ai.t + Math.max(70, 150 - ai.waveN * 15); msg(`⚔ Vague ennemie n°${ai.waveN} en approche (${n} soldats) !`, 5000);
    } else ai.nextWave = ai.t + 20;
  }
}

// ================= Interface =================
const $ = id => document.getElementById(id);
let msgT; function msg(t, ms = 2500) { $('msg').textContent = t; clearTimeout(msgT); msgT = setTimeout(() => $('msg').textContent = '', ms); }
let selBuilding = null, placing = null, atkMode = false, boxMode = false, gameOver = false, gameTime = 0;
const selUnits = () => units.filter(u => u.selected);
function setSel(list, add = false) { if (!add) units.forEach(u => u.selected = false); list.forEach(u => u.selected = true); selBuilding = null; }
function updateHUD() {
  const r = teams[0].res; $('bois').textContent = Math.floor(r.bois); $('pierre').textContent = Math.floor(r.pierre); $('or').textContent = Math.floor(r.or);
  $('pop').textContent = popCount(0) + ' / ' + popCap(0);
  const s = Math.floor(gameTime); $('time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  renderPanel();
}
let panelHTML = '';
function renderPanel() {
  let h; const sel = selUnits(), btn = (act, label, ok) => `<button data-act="${act}" ${ok ? '' : 'disabled'}>${label}</button>`;
  if (selBuilding && selBuilding.team === 0) {
    const b = selBuilding, S = BUILD[b.type];
    h = `<b>${S.label}</b> — PV ${Math.ceil(b.hp)}/${b.maxHp}<br>`;
    if (!b.done) h += `En construction : ${Math.floor(b.progress * 100)} % (clic droit / touchez avec des villageois pour aider)`;
    else {
      const full = popCount(0) >= popCap(0);
      if (b.type === 'hdv') h += btn('train:villageois', `Villageois (${costTxt(UNIT.villageois.cost)})`, canPay(0, UNIT.villageois.cost) && !full);
      if (b.type === 'caserne') h += btn('train:epeiste', `Épéiste (${costTxt(UNIT.epeiste.cost)})`, canPay(0, UNIT.epeiste.cost) && !full) + btn('train:archer', `Archer (${costTxt(UNIT.archer.cost)})`, canPay(0, UNIT.archer.cost) && !full);
      if (b.type === 'maison') h += '+5 population';
      if (b.queue.length) h += `<br>File : ${b.queue.map(t => UNIT[t].label).join(', ')} (${Math.ceil(b.trainT)} s)`;
      if (full && b.type !== 'maison') h += '<br><i>Population max : construisez des maisons</i>';
    }
  } else if (selBuilding) h = `<b>${BUILD[selBuilding.type].label} ennemi(e)</b> — PV ${Math.ceil(selBuilding.hp)}/${selBuilding.maxHp}`;
  else if (sel.length) {
    const c = {}; sel.forEach(u => c[u.type] = (c[u.type] || 0) + 1);
    h = '<b>' + Object.entries(c).map(([t, n]) => `${n} ${UNIT[t].label.toLowerCase()}${n > 1 && !t.endsWith('s') ? 's' : ''}`).join(', ') + '</b>';
    if (sel.length === 1) h += ` — PV ${Math.ceil(sel[0].hp)}/${sel[0].maxHp}`;
    if (c.villageois) h += '<br>' + btn('place:maison', `Maison (${costTxt(BUILD.maison.cost)})`, canPay(0, BUILD.maison.cost)) + btn('place:caserne', `Caserne (${costTxt(BUILD.caserne.cost)})`, canPay(0, BUILD.caserne.cost));
  } else h = isTouch ? '<i>Touchez une unité pour la sélectionner</i>' : '<i>Aucune sélection</i>';
  if (h !== panelHTML) { panelHTML = h; $('panel').innerHTML = h; }
}
function doAct(a) {
  if (!a) return;
  const [k, v] = a.split(':');
  if (k === 'train' && selBuilding) { if (!train(selBuilding, v)) msg('Ressources ou population insuffisantes'); }
  else if (k === 'place') { if (canPay(0, BUILD[v].cost)) startPlacing(v); else msg('Ressources insuffisantes'); }
  else if (k === 'box') { boxMode = !boxMode; msg(boxMode ? 'Mode cadre : glissez pour sélectionner' : 'Mode cadre désactivé'); }
  else if (k === 'atk') { if (selUnits().length) { atkMode = !atkMode; if (atkMode) msg(isTouch ? 'Touchez la destination de l\'attaque' : 'Cliquez la destination de l\'attaque'); } else msg('Sélectionnez des unités'); }
  else if (k === 'army') setSel(units.filter(u => u.team === 0 && u.type !== 'villageois'));
  else if (k === 'home') { const h = hdvOf(0); if (h) { camTarget.copy(h.pos); updateCam(); } }
  else if (k === 'desel') { setSel([]); stopPlacing(); atkMode = false; }
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', (b.dataset.act === 'box' && boxMode) || (b.dataset.act === 'atk' && atkMode)));
  updateHUD();
}
$('panel').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));
$('tools').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));

let ghost;
function startPlacing(type) {
  stopPlacing(); placing = type; const r = BUILD[type].radius;
  ghost = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 2, r * 1.5), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.45 }));
  ghost.position.set(camTarget.x, 1, camTarget.z); scene.add(ghost);
  msg(isTouch ? 'Touchez le sol pour placer le bâtiment' : 'Clic gauche pour placer, Échap pour annuler', 4000);
}
function stopPlacing() { placing = null; if (ghost) scene.remove(ghost); ghost = null; }
function tryPlace(x, y) {
  const p = groundAt(x, y); if (!p) return;
  const b = placeBuilding(placing, 0, p.x, p.z);
  if (!b) { msg('Emplacement invalide ou ressources insuffisantes'); return; }
  selUnits().filter(u => u.type === 'villageois').forEach(u => cmdBuild(u, b)); stopPlacing(); doAct('noop');
}

// ================= Entrées =================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), gPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function setRay(x, y) { ndc.set(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); }
function groundAt(x, y) { setRay(x, y); return ray.ray.intersectPlane(gPlane, new THREE.Vector3()); }
function screenOf(p) { const v = p.clone().setY(0.8).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
function pickEntity(x, y) {
  setRay(x, y);
  const objs = [...units, ...buildings, ...resources].filter(e => e.mesh.visible).map(e => e.mesh);
  let ent = null; for (const h of ray.intersectObjects(objs, true)) if (h.object.userData.ent) { ent = h.object.userData.ent; break; }
  if (!ent || ent.kind !== 'unit') { // tolérance écran pour les petites unités
    let bd = isTouch ? 30 : 16; for (const u of units) if (u.mesh.visible) { const [sx, sy] = screenOf(u.pos), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; ent = u; } }
  }
  return { ent, point: groundAt(x, y) || new THREE.Vector3() };
}
function marker(p, color) { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.7, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color })); m.position.set(p.x, 0.2, p.z); scene.add(m); setTimeout(() => scene.remove(m), 400); }
function command(x, y, attackMove = false) {
  const sel = selUnits(); if (!sel.length) return false;
  const { ent: e, point } = pickEntity(x, y);
  if (attackMove) { formation(sel, point, 'attackMove'); marker(point, 0xff4040); return true; }
  if (e && e.team === 1 && e.kind !== 'resource') { sel.forEach(u => cmdAttack(u, e)); marker(e.pos, 0xff0000); }
  else if (e?.kind === 'resource') { sel.forEach(u => u.type === 'villageois' ? cmdGather(u, e) : cmdMove(u, e.pos)); msg('Récolte : ' + RES_LABEL[e.type]); }
  else if (e?.kind === 'building' && e.team === 0) {
    sel.forEach(u => {
      if (u.type === 'villageois' && !e.done) cmdBuild(u, e);
      else if (u.type === 'villageois' && e.type === 'hdv' && u.carry) { u.cmd = { type: 'gather', res: null }; u.state = 'toDrop'; moveTo(u, e.pos); }
      else cmdMove(u, e.pos);
    });
    if (e.type !== 'hdv' && !e.done) msg('Construction');
  } else { formation(sel, point, 'move'); marker(point, 0xffff00); }
  return true;
}
function clickSelect(x, y, add) {
  const { ent } = pickEntity(x, y);
  if (ent?.kind === 'unit' && ent.team === 0) {
    const now = performance.now();
    if (lastTap.ent === ent && now - lastTap.t < 350) setSel(units.filter(u => u.team === 0 && u.type === ent.type && onScreen(u.pos)), add);
    else if (add && ent.selected) ent.selected = false; else setSel([ent], add);
    lastTap = { ent, t: now };
  } else if (ent?.kind === 'building') { setSel([]); selBuilding = ent; }
  else if (!add) setSel([]);
}
let lastTap = { ent: null, t: 0 };
const onScreen = p => { const [x, y] = screenOf(p); return x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight; };
function tap(x, y) {
  if (placing) return tryPlace(x, y);
  if (atkMode) { command(x, y, true); doAct('noop'); atkMode = false; doAct('noop'); return; }
  const { ent } = pickEntity(x, y), sel = selUnits();
  if (ent?.kind === 'unit' && ent.team === 0) return clickSelect(x, y, false);
  if (sel.length) return command(x, y);
  clickSelect(x, y, false);
}
function boxSelect(x1, y1, x2, y2, add) {
  const [a, b] = [Math.min(x1, x2), Math.max(x1, x2)], [c, d] = [Math.min(y1, y2), Math.max(y1, y2)];
  setSel(units.filter(u => { if (u.team !== 0) return false; const [sx, sy] = screenOf(u.pos); return sx >= a && sx <= b && sy >= c && sy <= d; }), add);
}
const box = $('box');
function drawBox(g, x, y) { Object.assign(box.style, { display: 'block', left: Math.min(g.sx, x) + 'px', top: Math.min(g.sy, y) + 'px', width: Math.abs(x - g.sx) + 'px', height: Math.abs(y - g.sy) + 'px' }); }

const keys = {}; const mouse = { x: innerWidth / 2, y: innerHeight / 2, in: false };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === 'escape') doAct('desel'); if (k === 'f') doAct('atk'); if (k === 'h') doAct('home');
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); updateCam(); });
cv.addEventListener('wheel', e => { e.preventDefault(); camDist += e.deltaY * 0.05; updateCam(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mouseleave', () => mouse.in = false);

const ptrs = new Map(); let gest = null;
function pinchInfo() { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
function panBy(dx, dy) { const k = camDist / innerHeight * 1.5; camTarget.x -= dx * k; camTarget.z -= dy * k; updateCam(); }
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch { }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.pointerType === 'mouse') {
    mouse.in = true;
    if (e.button === 2) { if (placing) stopPlacing(); else if (atkMode) { atkMode = false; doAct('noop'); } else command(e.clientX, e.clientY); return; }
    if (e.button !== 0) return;
    if (placing) return tryPlace(e.clientX, e.clientY);
    if (atkMode) { command(e.clientX, e.clientY, true); atkMode = false; doAct('noop'); return; }
    gest = { type: 'mpending', sx: e.clientX, sy: e.clientY, shift: e.shiftKey }; return;
  }
  if (ptrs.size === 1) gest = { type: boxMode ? 'box' : 'tpending', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, shift: false };
  else if (ptrs.size === 2) { gest = { type: 'pinch', ...pinchInfo() }; box.style.display = 'none'; }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; }
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (placing && ghost) { const p = groundAt(e.clientX, e.clientY); if (p) { ghost.position.set(p.x, 1, p.z); ghost.material.color.set(free(p.x, p.z, BUILD[placing].radius) ? 0x00ff00 : 0xff0000); } }
  if (!gest || !ptrs.has(e.pointerId)) return;
  const moved = Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy);
  if (gest.type === 'mpending' && moved > 5) gest.type = 'box';
  if (gest.type === 'tpending' && moved > 12) gest.type = 'pan';
  if (gest.type === 'pan') { panBy(e.clientX - gest.lx, e.clientY - gest.ly); gest.lx = e.clientX; gest.ly = e.clientY; }
  else if (gest.type === 'box') drawBox(gest, e.clientX, e.clientY);
  else if (gest.type === 'pinch' && ptrs.size >= 2) { const p = pinchInfo(); camDist *= gest.d / p.d; panBy(p.mx - gest.mx, p.my - gest.my); Object.assign(gest, p); }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (!gest) return;
  const x = e.clientX, y = e.clientY;
  if (gest.type === 'mpending') clickSelect(x, y, gest.shift);
  else if (gest.type === 'tpending') tap(x, y);
  else if (gest.type === 'box') { box.style.display = 'none'; boxSelect(gest.sx, gest.sy, x, y, gest.shift); }
  if (gest.type === 'pinch' && ptrs.size === 1) { const p = [...ptrs.values()][0]; gest = { type: 'pan', sx: -1e4, sy: -1e4, lx: p.x, ly: p.y }; return; }
  if (!ptrs.size) gest = null; updateHUD();
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { if (gest?.type === 'tpending') gest = null; endPtr(e); });

// ================= Minimap =================
const mini = $('mini'), mctx = mini.getContext('2d'), MS = mini.width / SIZE;
const fogCanvas = document.createElement('canvas'); fogCanvas.width = fogCanvas.height = FN; const fctx = fogCanvas.getContext('2d'), fimg = fctx.createImageData(FN, FN);
function drawMini() {
  mctx.fillStyle = '#4f7d38'; mctx.fillRect(0, 0, mini.width, mini.height);
  const C = { bois: '#1f4a1c', pierre: '#9a9a9a', or: '#f0c030' };
  for (const r of resources) if (r.mesh.visible) { mctx.fillStyle = C[r.type]; mctx.fillRect((r.pos.x + HALF) * MS - 1, (r.pos.z + HALF) * MS - 1, 2, 2); }
  for (const b of buildings) if (b.team === 0 || b.mesh.visible) { mctx.fillStyle = b.team ? '#ff4040' : '#4080ff'; const s = b.radius * MS * 1.6; mctx.fillRect((b.pos.x + HALF) * MS - s / 2, (b.pos.z + HALF) * MS - s / 2, s, s); }
  for (const u of units) if (u.team === 0 || u.mesh.visible) { mctx.fillStyle = u.team ? '#ff8080' : (u.selected ? '#ffffff' : '#90c0ff'); mctx.fillRect((u.pos.x + HALF) * MS - 1.5, (u.pos.z + HALF) * MS - 1.5, 3, 3); }
  if (!NOFOG) { for (let k = 0; k < FN * FN; k++) { fimg.data[k * 4 + 3] = visible[k] ? 0 : explored[k] ? 110 : 255; } fctx.putImageData(fimg, 0, 0); mctx.drawImage(fogCanvas, 0, 0, mini.width, mini.height); }
  const pts = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight], [0, innerHeight]].map(([x, y]) => groundAt(x, y) || camTarget);
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.beginPath(); pts.forEach((p, i) => mctx[i ? 'lineTo' : 'moveTo']((p.x + HALF) * MS, (p.z + HALF) * MS)); mctx.closePath(); mctx.stroke();
}
function miniMove(e) { const r = mini.getBoundingClientRect(); camTarget.x = (e.clientX - r.left) / r.width * SIZE - HALF; camTarget.z = (e.clientY - r.top) / r.height * SIZE - HALF - camDist * 0.3; updateCam(); }
let miniDrag = false;
mini.addEventListener('pointerdown', e => { e.preventDefault(); miniDrag = true; try { mini.setPointerCapture(e.pointerId); } catch { } if (e.button === 2 && selUnits().length) { const r = mini.getBoundingClientRect(); formation(selUnits(), new THREE.Vector3((e.clientX - r.left) / r.width * SIZE - HALF, 0, (e.clientY - r.top) / r.height * SIZE - HALF), 'move'); miniDrag = false; } else miniMove(e); });
mini.addEventListener('pointermove', e => miniDrag && miniMove(e));
mini.addEventListener('pointerup', () => miniDrag = false);
mini.addEventListener('contextmenu', e => e.preventDefault());

// ================= Fin de partie =================
function endGame(win) {
  if (gameOver) return; gameOver = true;
  $('endTitle').textContent = win ? '🏆 Victoire !' : '💀 Défaite…';
  $('endSub').textContent = win ? "L'hôtel de ville ennemi est détruit." : 'Votre hôtel de ville a été détruit.';
  $('end').style.display = 'flex';
}

// ================= Boucle =================
const clock = new THREE.Clock(); let fogT = 0, hudT = 0, miniT = 0;
function step(dt) {
  gameTime += dt;
  for (const u of [...units]) if (!u.dead) updateUnit(u, dt);
  for (const b of [...buildings]) if (!b.dead) updateBuilding(b, dt);
  aiUpdate(dt);
}
function loop() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  const sp = camDist * 0.9 * rdt, e = 12; let mv = false;
  const k = keys, m = mouse.in && !isTouch;
  if (k.w || k.z || k.arrowup || (m && mouse.y < e)) { camTarget.z -= sp; mv = true; }
  if (k.s || k.arrowdown || (m && mouse.y > innerHeight - e)) { camTarget.z += sp; mv = true; }
  if (k.a || k.q || k.arrowleft || (m && mouse.x < e)) { camTarget.x -= sp; mv = true; }
  if (k.d || k.arrowright || (m && mouse.x > innerWidth - e)) { camTarget.x += sp; mv = true; }
  if (mv) updateCam();
  if (!gameOver) for (let i = 0; i < SPEED; i++) step(rdt);
  for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += rdt * SPEED / a.dur; if (a.t >= 1) { scene.remove(a.m); arrows.splice(i, 1); continue; } a.m.position.lerpVectors(a.a, a.b, a.t); a.m.position.y += Math.sin(a.t * Math.PI) * 1.5; a.m.lookAt(a.b); }
  fogT -= rdt; if (fogT <= 0) { fogT = 0.2; updateFog(); }
  miniT -= rdt; if (miniT <= 0) { miniT = 0.25; drawMini(); }
  hudT -= rdt; if (hudT <= 0) { hudT = 0.3; updateHUD(); }
  for (const e of [...units, ...buildings]) {
    e.ring && (e.ring.visible = e.selected);
    const show = e.mesh.visible && (e.hp < e.maxHp || e.selected || e === selBuilding);
    e.bar.visible = show; if (!show) continue;
    const { fg, w, h } = e.bar.userData, r = Math.max(0, e.hp / e.maxHp);
    e.bar.position.set(e.pos.x, h, e.pos.z); e.bar.quaternion.copy(camera.quaternion);
    fg.scale.x = w * r; fg.position.x = -w * (1 - r) / 2; fg.material.color.setHex(r > 0.6 ? 0x30e030 : r > 0.3 ? 0xe0c030 : 0xe03030);
  }
  renderer.render(scene, camera); requestAnimationFrame(loop);
}
updateFog(); updateHUD(); loop();
window.__game = { units, buildings, resources, teams, ai, THREE, cmdMove, cmdGather, cmdAttack, screenOf, camTarget, get camDist() { return camDist; }, get over() { return gameOver; }, endGame };
