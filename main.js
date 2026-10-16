import * as THREE from 'three';
import { RES, RES_LABEL, RES_ICON, AGES, UNIT, BUILD, TECHS, DIFFS } from './data.js';

// ================= Configuration =================
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const SPEED = +params.get('speed') || 1;
const NOFOG = params.has('nofog');
const SIZE = 160, HALF = SIZE / 2;
let D = DIFFS[params.get('diff')] || null, started = !!D;
const TEAM_COLOR = [0x3060c0, 0xc03030];
function newTeam() { return { res: { nourriture: 200, bois: 200, or: 100, pierre: 100 }, age: 0, techs: new Set(), up: { atk: 0, arm: 0, projAtk: 0, range: 0, cap: 10, vspeed: 1, bhp: 1, train: 1, farm: 0, gather: { nourriture: 1, bois: 1, or: 1, pierre: 1 } } }; }
const teams = [newTeam(), newTeam()];
const costTxt = c => Object.entries(c || {}).map(([k, v]) => `${v}${RES_ICON[k]}`).join(' ');
export let sfx = () => { };
export function setSfx(f) { sfx = f; }

// ================= Rendu =================
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !isTouch;
document.body.prepend(renderer.domElement);
const cv = renderer.domElement;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1e2a16); // plus de ciel bleu visible au bord de la carte
scene.fog = new THREE.Fog(0x1e2a16, 150, 320);
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
const outer = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0x24341b })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);

const matCache = {};
const mat = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
function mk(geom, color, y = 0, own = false) { const m = new THREE.Mesh(geom, own ? new THREE.MeshLambertMaterial({ color }) : mat(color)); m.position.y = y; m.castShadow = !isTouch; return m; }
const geoC = {}; const geo = (k, f) => geoC[k] || (geoC[k] = f());
const Bx = (w, h, d) => geo('b' + [w, h, d], () => new THREE.BoxGeometry(w, h, d));
const Cy = (rt, rb, h, s = 8) => geo('c' + [rt, rb, h, s], () => new THREE.CylinderGeometry(rt, rb, h, s));
const Co = (r, h, s = 4) => geo('o' + [r, h, s], () => { const g = new THREE.ConeGeometry(r, h, s); return s === 4 ? g.rotateY(Math.PI / 4) : g; });
const Sp = r => geo('s' + r, () => new THREE.SphereGeometry(r, 8, 6));
const G = {
  ring: new THREE.RingGeometry(0.6, 0.75, 20).rotateX(-Math.PI / 2), arrow: new THREE.BoxGeometry(0.06, 0.06, 0.8),
  bar: new THREE.PlaneGeometry(1, 0.16), bow: new THREE.TorusGeometry(0.45, 0.04, 4, 12, Math.PI),
};
const ringMat = new THREE.MeshBasicMaterial({ color: 0x40ff40 });
function addPart(g, geom, c, x = 0, y = 0, z = 0) { const m = mk(geom, c, y); m.position.x = x; m.position.z = z; g.add(m); return m; }

// ================= Entités =================
const resources = [], buildings = [], units = [], arrows = [];
const rand = (a, b) => a + Math.random() * (b - a);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inMap = (x, z, r) => Math.abs(x) <= HALF - r - 1 && Math.abs(z) <= HALF - r - 1;
function free(x, z, r, ign) {
  if (!inMap(x, z, r)) return false;
  for (const o of resources) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + r) return false;
  for (const o of buildings) if (!(ign && ign(o)) && Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + r + (o.def.wall ? 0.2 : 1)) return false;
  return true;
}
function wallFree(x, z, ignoreGateWalls = false) {
  if (Math.abs(x) > HALF - 0.4 || Math.abs(z) > HALF - 0.4) return false;
  for (const o of resources) if (Math.hypot(o.pos.x - x, o.pos.z - z) < o.radius + 0.7) return false;
  for (const o of buildings) { const d = Math.hypot(o.pos.x - x, o.pos.z - z); if (o.def.wall ? d < 0.5 : d < o.radius + 0.8) return false; }
  return true;
}
function tag(e) { e.mesh.traverse(o => o.userData.ent = e); }

const RES_DEF = {
  bois: { type: 'bois', amount: 100, radius: 0.9 }, or: { type: 'or', amount: 450, radius: 1.6 }, pierre: { type: 'pierre', amount: 400, radius: 1.6 },
  baies: { type: 'nourriture', amount: 150, radius: 1, rate: 0.55 }, cerf: { type: 'nourriture', amount: 140, radius: 0.8, rate: 0.4 },
};
function addResource(sub, x, z, amount) {
  const R = RES_DEF[sub]; if (!free(x, z, R.radius)) return;
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

function makeBar(e, w, h) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.7 }));
  const fg = new THREE.Mesh(G.bar, new THREE.MeshBasicMaterial({ color: 0x30e030, depthTest: false }));
  bg.scale.x = w; bg.renderOrder = 10; fg.renderOrder = 11; g.add(bg, fg); g.userData = { fg, w, h }; g.visible = false; scene.add(g); e.bar = g;
}

function buildingMesh(type, team) {
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

function addBuilding(type, team, x, z, done = true, rot = 0, noGrid = false) {
  const S = BUILD[type], g = new THREE.Group(), inner = buildingMesh(type, team); g.add(inner);
  g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  const maxHp = Math.round(S.hp * teams[team].up.bhp);
  const b = { kind: 'building', type, def: S, team, radius: S.radius, mesh: g, inner, pos: g.position, rot, maxHp, hp: done ? maxHp : maxHp * 0.1, done, progress: done ? 1 : 0, queue: [], trainT: 0, cdT: 0 };
  if (S.gate) b.parts = [-1.6, -0.8, 0, 0.8, 1.6].map(o => ({ pos: { x: x + Math.cos(rot) * o, z: z - Math.sin(rot) * o }, radius: 0.75 }));
  if (S.farm) { b.amount = S.farm + teams[team].up.farm; b.resType = 'nourriture'; b.rate = 0.6; }
  if (!done) inner.scale.y = 0.1;
  tag(b); makeBar(b, Math.max(1.2, S.radius * 1.2), S.bar); buildings.push(b); if (!noGrid) rebuildGrid(); return b;
}

function unitMesh(type, team) {
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
function addUnit(type, team, x, z) {
  const S = UNIT[type], { g, body } = unitMesh(type, team);
  const carry = mk(Bx(0.4, 0.4, 0.4), 0x6b4423, 0.7, true); carry.position.z = -0.45; carry.visible = false; body.add(carry);
  const ring = new THREE.Mesh(G.ring, ringMat); ring.position.y = 0.05; ring.visible = false; const rs = (S.radius || 0.5) / 0.5; ring.scale.set(rs, 1, rs); g.add(ring);
  g.position.set(x, 0, z); scene.add(g);
  const u = { kind: 'unit', type, def: S, team, mesh: g, body, pos: g.position, ring, carryMesh: carry, radius: S.radius || 0.5, hp: S.hp, maxHp: S.hp, path: [], cmd: null, target: null, carry: 0, carryType: null, timer: 0, cdT: 0, scanT: 0, repathT: 0, selected: false };
  tag(u); makeBar(u, S.radius ? 1.6 : 1.2, S.cls === 'cav' ? 2.9 : S.cls === 'siege' ? 2.5 : S.cls === 'hero' ? 2.6 : 2.1); units.push(u); return u;
}

// ================= Pathfinding (A*, grille par équipe : les portes laissent passer leur camp) =================
const N = SIZE; let gridT = [new Uint8Array(N * N), new Uint8Array(N * N)];
function stamp(g, o) {
  const r = o.radius + 0.3;
  for (let x = Math.floor(o.pos.x - r); x <= o.pos.x + r; x++) for (let z = Math.floor(o.pos.z - r); z <= o.pos.z + r; z++)
    if (Math.hypot(x + 0.5 - o.pos.x, z + 0.5 - o.pos.z) < r) { const i = x + HALF, j = z + HALF; if (i >= 0 && j >= 0 && i < N && j < N) g[i + j * N] = 1; }
}
function rebuildGrid() {
  const g = new Uint8Array(N * N);
  for (const o of resources) stamp(g, o);
  for (const b of buildings) if (!b.def.farm && !b.def.gate) stamp(g, b);
  const g0 = g.slice(), g1 = g;
  for (const b of buildings) if (b.def.gate) b.parts.forEach(pt => stamp(b.team === 0 ? g1 : g0, pt));
  gridT = [g0, g1];
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
function findPath(from, to, team = 0) {
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
function los(a, b, team = 0) { const grid = gridT[team], s = Math.ceil(d2(a, b) * 2); for (let k = 1; k <= s; k++) { const t = k / s; const [x, z] = toCell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); if (grid[x + z * N]) return false; } return true; }
function moveTo(u, p) { u.path = findPath(u.pos, p, u.team); }
function freeSlot(p, used, team = 0) {
  const grid = gridT[team], [cx, cz] = toCell(p);
  for (let r = 0; r < 10; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x = cx + dx, z = cz + dz;
    if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue; const i = x + z * N;
    if (grid[i] || used.has(i) || used.has(i + 1) || used.has(i - 1) || used.has(i + N) || used.has(i - N)) continue; used.add(i); return cellPos(i);
  }
  return p.clone();
}

// ================= Carte =================
const P0 = new THREE.Vector3(-48, 0, 48), P1 = new THREE.Vector3(48, 0, -48);
function generateMap() {
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
const FC = 2, FN = SIZE / FC;
const visible = new Uint8Array(FN * FN), explored = new Uint8Array(FN * FN);
const fogData = new Uint8Array(FN * FN * 4);
const fogTex = new THREE.DataTexture(fogData, FN, FN); fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter;
const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
fogPlane.rotation.x = -Math.PI / 2; fogPlane.position.y = 0.2; fogPlane.renderOrder = 1; scene.add(fogPlane); fogPlane.visible = !NOFOG;
const fogIdx = p => { const i = Math.max(0, Math.min(FN - 1, Math.floor((p.x + HALF) / FC))), j = Math.max(0, Math.min(FN - 1, Math.floor((p.z + HALF) / FC))); return i + j * FN; };
const isVis = p => NOFOG || visible[fogIdx(p)];
const isExp = p => NOFOG || explored[fogIdx(p)];
const dimCache = new Map();
function setDim(e, dim) {
  if (NOFOG) dim = false; if (!!e.dimmed === dim) return; e.dimmed = dim;
  e.mesh.traverse(o => {
    if (!o.isMesh || o === e.ring) return;
    if (dim) { o.userData.m0 = o.material; let m = dimCache.get(o.material); if (!m) { m = o.material.clone(); m.color.multiplyScalar(0.4); dimCache.set(o.material, m); } o.material = m; }
    else if (o.userData.m0) o.material = o.userData.m0;
  });
}
function updateFog() {
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

// ================= Économie =================
const canPay = (t, c) => Object.entries(c || {}).every(([k, v]) => teams[t].res[k] >= v);
const pay = (t, c) => Object.entries(c || {}).forEach(([k, v]) => teams[t].res[k] -= v);
const refund = (t, c) => Object.entries(c || {}).forEach(([k, v]) => teams[t].res[k] += v);
const popCap = t => Math.min(100, buildings.reduce((s, b) => s + (b.team === t && b.done ? (b.def.pop || 0) : 0), 0));
const queuedUnits = (t, type) => buildings.reduce((s, b) => s + (b.team === t ? b.queue.filter(q => q.kind === 'unit' && (!type || q.id === type)).length : 0), 0);
const popCount = t => units.filter(u => u.team === t).length + queuedUnits(t);
const hdvOf = t => buildings.find(b => b.team === t && b.type === 'hdv');
const resTypeOf = r => r.kind === 'building' ? 'nourriture' : r.type;
function dropFor(t, type, p) { let best = null, bd = 1e9; for (const b of buildings) if (b.team === t && b.done && b.def.drop?.includes(type)) { const d = d2(b.pos, p) - b.radius; if (d < bd) { bd = d; best = b; } } return best; }
function nearestRes(type, p, max = 1e9) { let b = null, bd = max; for (const r of resources) { const d = d2(r.pos, p); if ((!type || r.type === type) && d < bd) { bd = d; b = r; } } return b; }
const inQueue = (t, kind, id) => buildings.some(b => b.team === t && b.queue.some(q => q.kind === kind && (id === undefined || q.id === id)));
const ageLock = a => '🔒 ' + AGES[a].name;
function canTrain(b, type) {
  const d = UNIT[type], T = teams[b.team];
  if (d.b !== b.type) return 'x'; if (d.age > T.age) return ageLock(d.age); if (!b.done) return 'En construction';
  if (d.limit && units.filter(u => u.team === b.team && u.type === type).length + queuedUnits(b.team, type) >= d.limit) return 'Limite atteinte';
  if (b.queue.length >= 5) return 'File pleine'; if (popCount(b.team) >= popCap(b.team)) return 'Population max : construisez des maisons';
  if (!canPay(b.team, d.cost)) return 'Ressources insuffisantes'; return null;
}
function train(b, type) { if (canTrain(b, type)) return false; const d = UNIT[type]; pay(b.team, d.cost); enqueue(b, { kind: 'unit', id: type, time: d.time * (d.cls === 'villager' ? 1 : teams[b.team].up.train), cost: d.cost }); return true; }
function canTech(b, id) {
  const t = TECHS[id], T = teams[b.team];
  if (t.b !== b.type || T.techs.has(id) || inQueue(b.team, 'tech', id) || (t.req && !T.techs.has(t.req))) return 'x';
  if (t.age > T.age) return ageLock(t.age); if (!b.done) return 'En construction'; if (b.queue.length >= 5) return 'File pleine';
  if (!canPay(b.team, t.cost)) return 'Ressources insuffisantes'; return null;
}
function research(b, id) { if (canTech(b, id)) return false; const t = TECHS[id]; pay(b.team, t.cost); enqueue(b, { kind: 'tech', id, time: t.time, cost: t.cost }); return true; }
function canAge(b) {
  const T = teams[b.team]; if (b.type !== 'hdv' || T.age >= 3 || inQueue(b.team, 'age')) return 'x';
  if (!b.done) return 'En construction';
  if (T.age === 0 && !buildings.some(o => o.team === b.team && o.done && !['hdv', 'maison', 'ferme'].includes(o.type) && !o.def.wall)) return '🔒 1 bâtiment (moulin, camp ou caserne)';
  if (!canPay(b.team, AGES[T.age + 1].cost)) return 'Ressources insuffisantes'; return null;
}
function ageUp(b) { if (canAge(b)) return false; const T = teams[b.team], a = AGES[T.age + 1]; pay(b.team, a.cost); enqueue(b, { kind: 'age', id: T.age + 1, time: a.time, cost: a.cost }); return true; }
function enqueue(b, item) { b.queue.push(item); if (b.queue.length === 1) b.trainT = item.time; }
function applyTech(team, id) {
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
function placeBuilding(type, team, x, z, rot = 0) {
  const S = BUILD[type]; if (!canPay(team, S.cost)) return null;
  if (S.gate) { // une porte remplace les segments de mur qu'elle recouvre
    const own = o => o.def.wall && o.team === team;
    if (!free(x, z, S.radius, own)) return null;
    buildings.filter(o => own(o) && d2(o.pos, { x, z }) < S.radius + 0.3).forEach(w => kill(w, true));
  } else if (!free(x, z, S.radius)) return null;
  pay(team, S.cost); return addBuilding(type, team, x, z, false, rot);
}
function placeWall(type, team, a, b) {
  const S = BUILD[type], len = d2(a, b), n = Math.max(1, Math.round(len)), rot = -Math.atan2(b.z - a.z, b.x - a.x), out = [];
  for (let i = 0; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
    if (!canPay(team, S.cost)) break; if (!wallFree(x, z)) continue;
    pay(team, S.cost); out.push(addBuilding(type, team, x, z, false, rot, true));
  }
  rebuildGrid(); return out;
}

// ================= Commandes =================
function cmdGather(u, r) { u.cmd = { type: 'gather', res: r }; u.state = 'toRes'; u.target = null; moveTo(u, r.pos); }
function cmdBuild(u, b) { u.cmd = { type: 'build', b }; u.target = null; moveTo(u, b.pos); }
function cmdAttack(u, e) { u.cmd = { type: 'attack', target: e }; u.target = e; u.path = []; u.repathT = 0; }
function cmdMove(u, p, type = 'move') { u.cmd = { type, dest: p.clone() }; u.target = null; moveTo(u, p); }
function formation(sel, p, type) {
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
const clsOf = t => t.kind === 'building' ? 'building' : t.def.cls;
function calcDmg(def, team, t) {
  const up = teams[team].up, soldier = def.cls && def.cls !== 'villager' && def.cls !== 'siege';
  const atk = def.atk + (soldier ? up.atk : 0) + (def.proj === 'arrow' ? up.projAtk : 0) + (def.bonus?.[clsOf(t)] || 0);
  let arm;
  if (t.kind === 'unit') { const td = t.def; arm = (def.proj ? td.ap : td.am) + (td.cls !== 'villager' && td.cls !== 'siege' ? teams[t.team].up.arm : 0); }
  else arm = def.proj === 'arrow' ? 6 : 2;
  return Math.max(1, atk - arm);
}
const rangeOf = (def, team) => def.range + (def.proj === 'arrow' ? teams[team].up.range : 0);
function nearestEnemy(u, r, buildingsOnly = false) {
  let best = null, bd = r;
  if (!buildingsOnly) for (const o of units) if (o.team !== u.team) { const d = d2(o.pos, u.pos) - o.radius; if (d < bd) { bd = d; best = o; } }
  if (best) return best;
  for (const b of buildings) if (b.team !== u.team) { const d = d2(b.pos, u.pos) - b.radius; if (d < bd) { bd = d; best = b; } }
  return best;
}
const stoneGeo = new THREE.SphereGeometry(0.35, 6, 5);
function shoot(from, to, kind = 'arrow') {
  const m = new THREE.Mesh(kind === 'stone' ? stoneGeo : G.arrow, mat(kind === 'stone' ? 0x666666 : 0x5a3a1a)); scene.add(m);
  arrows.push({ m, a: from.clone().setY(kind === 'stone' ? 1.8 : 1.4), b: to.clone().setY(1), t: 0, dur: Math.max(0.15, d2(from, to) / (kind === 'stone' ? 18 : 30)), arc: kind === 'stone' ? 5 : 1.5 });
  if (isVis(from) || isVis(to)) sfx(kind === 'stone' ? 'catapult' : 'arrow', from);
}
function hit(src, srcDef, srcTeam, t) {
  damage(t, calcDmg(srcDef, srcTeam, t), src);
  if (srcDef.splash) for (const o of [...units, ...buildings]) if (o !== t && o.team !== srcTeam && !o.dead && d2(o.pos, t.pos) < srcDef.splash + o.radius) damage(o, calcDmg(srcDef, srcTeam, o) * 0.5, src);
}
function damage(t, dmg, src) {
  if (t.dead) return; t.hp -= dmg; t.lastHit = gameTime;
  if (t.kind === 'unit' && src && src.kind === 'unit' && !src.dead && !t.target && t.def.aggro && (!t.cmd || t.cmd.type !== 'move') && !(t.def.siegeOnly)) t.target = src;
  if (t.team === 1 && src && src.kind === 'unit') aiDefend(src);
  if (t.hp <= 0) kill(t);
}
function kill(e, silent = false) {
  if (e.dead) return; e.dead = true; scene.remove(e.mesh); if (e.bar) scene.remove(e.bar); if (e.flag) scene.remove(e.flag);
  const arr = e.kind === 'unit' ? units : e.kind === 'building' ? buildings : resources; const i = arr.indexOf(e); if (i >= 0) arr.splice(i, 1);
  if (e.kind !== 'unit' && !silent) rebuildGrid();
  if (e === selBuilding) selBuilding = null;
  if (!silent && e.kind !== 'resource' && isVis(e.pos)) sfx(e.kind === 'building' ? 'collapse' : 'die', e.pos);
  if (e.kind === 'building' && e.type === 'hdv' && !hdvOf(e.team)) endGame(e.team === 1);
}

// ================= Unités =================
const RES_COLORS = { bois: 0x6b4423, pierre: 0x8a8a8a, or: 0xe0b630, nourriture: 0xc0203a };
function pushOut(u, o) { const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = o.radius + u.radius * 0.8; if (d < m && d > 1e-4) { u.pos.x = o.pos.x + dx / d * m; u.pos.z = o.pos.z + dz / d * m; } }
function nextJob(u, b) { // après une construction : chantier voisin, ferme, ou ressource du camp
  const nb = buildings.filter(o => o.team === u.team && !o.done && d2(o.pos, u.pos) < 25).sort((a, c) => d2(a.pos, u.pos) - d2(c.pos, u.pos))[0];
  if (nb) return cmdBuild(u, nb);
  if (b.def.farm && !b.dead) return cmdGather(u, b);
  if (b.def.drop && b.type !== 'hdv') { const r = nearestRes(b.def.drop[0], b.pos, 18); if (r) return cmdGather(u, r); }
  u.cmd = null;
}
function updateUnit(u, dt) {
  const S = u.def, T = teams[u.team]; u.cdT -= dt;
  if (S.regen && u.hp < u.maxHp && gameTime - (u.lastHit || -99) > 5) u.hp = Math.min(u.maxHp, u.hp + S.regen * dt);
  if (!u.target && S.aggro && (!u.cmd || u.cmd.type === 'attackMove')) { u.scanT -= dt; if (u.scanT <= 0) { u.scanT = 0.4; const t = nearestEnemy(u, S.aggro, S.siegeOnly); if (t) { u.target = t; u.repathT = 0; } } }
  if (u.target) {
    const t = u.target;
    if (t.dead) { u.target = null; u.path = []; if (u.cmd?.type === 'attack') u.cmd = null; else if (u.cmd?.type === 'attackMove') moveTo(u, u.cmd.dest); }
    else {
      const d = d2(u.pos, t.pos) - (t.radius || 0.5), rng = rangeOf(S, u.team);
      if (d <= rng) {
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
      const reach = r.kind === 'building' ? 1.6 : r.radius + 1.2;
      if (d2(u.pos, r.pos) < reach) { u.state = 'gather'; u.path = []; u.timer = 0; }
      else if (!u.path.length) moveTo(u, r.pos);
    } else if (u.state === 'gather') {
      if (r.dead) { u.state = 'toRes'; return; }
      const rt = resTypeOf(r);
      if (r.kind !== 'building') u.mesh.rotation.y = Math.atan2(r.pos.x - u.pos.x, r.pos.z - u.pos.z);
      u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 12) * 0.2;
      const iv = r.rate / T.up.gather[rt] / (u.team === 1 ? D.gather : 1);
      if (u.timer > iv) {
        u.timer = 0; if (u.carryType !== rt) { u.carry = 0; u.carryType = rt; } u.carry++; r.amount--;
        if (u.team === 0 && Math.random() < 0.15 && isVis(u.pos)) sfx(rt === 'bois' ? 'chop' : rt === 'nourriture' ? 'gather' : 'mine', u.pos);
        if (r.amount <= 0) kill(r);
        if (u.carry >= T.up.cap || r.dead) { u.state = 'toDrop'; const h = dropFor(u.team, rt, u.pos); if (h) moveTo(u, h.pos); }
      }
    } else if (u.state === 'toDrop') {
      const h = dropFor(u.team, u.carryType || 'bois', u.pos); if (!h) { u.cmd = null; return; }
      if (d2(u.pos, h.pos) < h.radius + 1.4) { if (u.carryType) T.res[u.carryType] += u.carry; u.carry = 0; u.state = 'toRes'; if (r && !r.dead) moveTo(u, r.pos); }
      else if (!u.path.length) moveTo(u, h.pos);
    }
    u.carryMesh.visible = u.carry > 0; if (u.carryType) u.carryMesh.material.color.set(RES_COLORS[u.carryType]);
  } else if (u.cmd.type === 'build') {
    const b = u.cmd.b;
    if (b.dead || b.done) { nextJob(u, b); return; }
    if (d2(u.pos, b.pos) < b.radius + 1.5) {
      u.path = []; u.mesh.rotation.y = Math.atan2(b.pos.x - u.pos.x, b.pos.z - u.pos.z); u.timer += dt; u.body.rotation.x = Math.sin(u.timer * 10) * 0.3;
      if (u.team === 0 && Math.random() < dt * 1.5 && isVis(u.pos)) sfx('build', u.pos);
      const inc = dt / b.def.time; b.progress = Math.min(1, b.progress + inc); b.hp = Math.min(b.maxHp, b.hp + inc * b.maxHp * 0.9);
      b.inner.scale.y = 0.1 + 0.9 * b.progress;
      if (b.progress >= 1) { b.done = true; if (b.def.gate || b.def.farm) rebuildGrid(); if (b.team === 0 && !b.def.wall) { msg(`${b.def.label} : construction terminée !`); sfx('done'); } nextJob(u, b); }
    } else if (!u.path.length) moveTo(u, b.pos);
  }
}

function updateBuilding(b, dt) {
  if (b.inner.userData.blades && b.done) b.inner.userData.blades.rotation.z += dt * 1.5;
  if (!b.done) return;
  if (b.queue.length) {
    b.trainT -= dt;
    if (b.trainT <= 0) {
      const q = b.queue.shift(), T = teams[b.team];
      if (q.kind === 'unit') {
        const dir = new THREE.Vector3(-b.pos.x, 0, -b.pos.z).normalize();
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

// ================= IA =================
const ai = { t: 0, think: 0, nextWave: 300, waveN: 0 };
function aiSpotNear(p, r, minD, maxD) {
  for (let k = 0; k < 60; k++) { const a = rand(0, Math.PI * 2), d = rand(minD, maxD), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (free(x, z, r + 0.5)) return [x, z]; }
  return null;
}
function aiPlace(type, near, vills, n = 2) {
  const d = BUILD[type], h = hdvOf(1); if (!canPay(1, d.cost) || d.age > teams[1].age) return null;
  const nearH = !near || near === h.pos; const s = aiSpotNear(near || h.pos, d.radius, nearH ? 9 : d.radius + 2.5, nearH ? 24 : d.radius + 8); if (!s) return null;
  const b = placeBuilding(type, 1, s[0], s[1], Math.floor(rand(0, 4)) * Math.PI / 2);
  if (b) vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos)).slice(0, n).forEach(v => cmdBuild(v, b));
  return b;
}
function aiDefend(src) {
  if (!D) return; const h = hdvOf(1); if (!h || d2(src.pos, h.pos) > 35) return;
  for (const s of units) if (s.team === 1 && s.def.cls !== 'villager' && !s.target && (!s.cmd || s.cmd.type !== 'attackMove')) cmdMove(s, src.pos, 'attackMove');
}
const playerCls = c => units.filter(u => u.team === 0 && u.def.cls === c).length;
function aiPickUnit(b) {
  const opts = Object.keys(UNIT).filter(k => UNIT[k].b === b.type && k !== 'villageois' && k !== 'heros' && !canTrain(b, k)); if (!opts.length) return null;
  const COUNTER = { cav: 'lancier', inf: 'archer', arch: 'cavalier', siege: 'cavalier' };
  const major = ['cav', 'inf', 'arch', 'siege'].map(c => [c, playerCls(c)]).sort((a, b) => b[1] - a[1])[0];
  if (major[1] >= 3 && opts.includes(COUNTER[major[0]]) && Math.random() < 0.7) return COUNTER[major[0]];
  if (b.type === 'atelier' && units.filter(u => u.team === 1 && u.def.cls === 'siege').length >= 2 + teams[1].age) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}
function aiUpdate(dt) {
  ai.t += dt; ai.think -= dt; if (ai.think > 0) return; ai.think = 1;
  const T = teams[1]; RES.forEach((k, i) => T.res[k] += D.bonus[i]);
  const h = hdvOf(1); if (!h) return;
  const my = units.filter(u => u.team === 1), vills = my.filter(u => u.def.cls === 'villager'), army = my.filter(u => u.def.cls !== 'villager');
  const mine = buildings.filter(b => b.team === 1), has = t => mine.some(b => b.type === t), cnt = t => mine.filter(b => b.type === t).length;
  for (const b of mine.filter(b => !b.done)) if (vills.filter(v => v.cmd?.type === 'build' && v.cmd.b === b).length < 1) { const v = vills.filter(v => v.cmd?.type !== 'build').sort((a, c) => d2(a.pos, b.pos) - d2(c.pos, b.pos))[0]; if (v) cmdBuild(v, b); }
  // répartition des villageois
  const want = T.age === 0 ? { nourriture: 0.5, bois: 0.35, or: 0.1, pierre: 0.05 } : { nourriture: 0.4, bois: 0.3, or: 0.2, pierre: 0.1 };
  const count = { nourriture: 0, bois: 0, or: 0, pierre: 0 }; vills.forEach(o => o.cmd?.type === 'gather' && o.cmd.res && count[resTypeOf(o.cmd.res)]++);
  for (const v of vills) if (!v.cmd) {
    let type = Object.keys(want).sort((a, b) => count[a] / want[a] - count[b] / want[b])[0], src = null;
    if (type === 'nourriture') {
      src = nearestRes('nourriture', h.pos, 35) || mine.find(b => b.def.farm && b.done && !units.some(o => o.cmd?.res === b));
      if (!src && has('moulin') && mine.filter(b => b.def.farm && !b.done).length < 2) { const m = mine.find(b => b.type === 'moulin'); const f = aiPlace('ferme', m.pos, [v], 1); if (f) { count.nourriture++; continue; } }
      if (!src) type = 'bois';
    }
    src = src || nearestRes(type, h.pos, 50) || nearestRes(type, h.pos) || nearestRes(null, h.pos);
    if (src) { cmdGather(v, src); count[resTypeOf(src)]++; }
  }
  const cap = popCap(1), pop = popCount(1), vmax = Math.round(D.vills * (0.55 + 0.15 * T.age));
  if (vills.length + queuedUnits(1, 'villageois') < vmax && !h.queue.length && pop < cap) train(h, 'villageois');
  if (pop >= cap - 3 && cap < 100 && !mine.some(b => b.type === 'maison' && !b.done)) aiPlace('maison', null, vills, 1);
  // ordre de construction
  const order = [['moulin', 3, () => nearestRes('nourriture', h.pos, 40)?.pos], ['camp_bois', 4, () => nearestRes('bois', h.pos, 45)?.pos], ['caserne', 6], ['camp_mine', 7, () => nearestRes('or', h.pos, 50)?.pos],
    ['archerie', 9], ['forge', 10], ['ecurie', 11], ['tour', 12], ['atelier', 14], ['universite', 16]];
  for (const [t, nv, near] of order) if (!has(t) && vills.length >= nv && BUILD[t].age <= T.age) { aiPlace(t, near?.(), vills); break; }
  if (T.age >= 1 && cnt('caserne') < D.barracks + (T.age >= 2 ? 1 : 0) && vills.length >= 12) aiPlace('caserne', null, vills);
  if (T.age >= 2 && cnt('tour') < 3 && Math.random() < 0.05) aiPlace('tour', null, vills, 1);
  const farms = mine.filter(b => b.def.farm).length, mo = mine.find(b => b.type === 'moulin' && b.done);
  if (mo && T.res.bois > 120 && farms < Math.ceil(vills.length * 0.4) && mine.filter(b => b.def.farm && !b.done).length < 2) aiPlace('ferme', mo.pos, vills, 1);
  // âges
  const need = Math.min([0, 9, 14, 18][T.age + 1] * D.ageK, vmax);
  if (T.age < 3 && vills.length >= need && ai.t >= D.ageT[T.age + 1] && !h.queue.length) ageUp(h);
  // technologies (si riche)
  if (Math.random() < 0.5) for (const b of mine) for (const id of Object.keys(TECHS)) if (!canTech(b, id) && Object.entries(TECHS[id].cost).every(([k, v]) => T.res[k] >= v * 1.3)) research(b, id);
  // armée
  const threatened = units.some(u => u.team === 0 && u.def.cls !== 'villager' && d2(u.pos, h.pos) < 30);
  const ageCost = T.age < 3 ? AGES[T.age + 1].cost : null, saving = ageCost && vills.length >= need * 0.8 && ai.t > D.ageT[T.age + 1] - 60;
  const armyCap = T.age === 0 ? D.base + 2 : 8 + T.age * 8 + ai.waveN * 2;
  for (const b of mine) if (b.done && b.queue.length < 2 && !['hdv', 'maison'].includes(b.type)) {
    const k = aiPickUnit(b); if (!k) continue; const c = UNIT[k].cost;
    const surplus = !saving || Object.entries(ageCost).every(([r, v]) => T.res[r] - (c[r] || 0) >= v);
    if (threatened || (surplus && army.length < armyCap)) train(b, k);
  }
  if (T.age >= 2 && !canTrain(h, 'heros') && T.res.or > 400) train(h, 'heros');
  const threat = units.find(u => u.team === 0 && d2(u.pos, h.pos) < 25); if (threat) aiDefend(threat);
  if (ai.t > ai.nextWave) {
    const idle = army.filter(s => !s.target && s.type !== 'heros' || (s.type === 'heros' && ai.waveN >= 2)), n = Math.min(idle.length, D.base + ai.waveN * D.grow);
    const eco = buildings.filter(b => b.team === 0 && b.done && ['moulin', 'camp_bois', 'camp_mine'].includes(b.type));
    const tgt = (ai.waveN > 0 && eco.length && Math.random() < 0.35 ? eco[Math.floor(Math.random() * eco.length)] : null) || hdvOf(0) || buildings.find(b => b.team === 0);
    if (n >= Math.min(3, D.base) && tgt) {
      idle.slice(0, n).forEach(s => cmdMove(s, tgt.pos, 'attackMove'));
      ai.waveN++; ai.nextWave = ai.t + Math.max(D.interval * 0.6, D.interval - ai.waveN * 10); msg(`⚔ Vague ennemie n°${ai.waveN} en approche (${n} unités) !`, 5000); sfx('horn');
    } else ai.nextWave = ai.t + 20;
  }
}

// ================= Interface =================
const $ = id => document.getElementById(id);
let msgT; function msg(t, ms = 2500) { $('msg').textContent = t; clearTimeout(msgT); msgT = setTimeout(() => $('msg').textContent = '', ms); }
let rallyMode = false, selBuilding = null, placing = null, atkMode = false, boxMode = false, gameOver = false, gameTime = 0;
const selUnits = () => units.filter(u => u.selected);
function setSel(list, add = false) { if (!add) units.forEach(u => u.selected = false); list.forEach(u => u.selected = true); selBuilding = null; }
function updateHUD() {
  const r = teams[0].res; for (const k of RES) $(k).textContent = Math.floor(r[k]);
  $('pop').textContent = popCount(0) + '/' + popCap(0); $('age').textContent = AGES[teams[0].age].name;
  const s = Math.floor(gameTime); $('time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const w = $('wave'); if (started && D && !gameOver) { const left = Math.max(0, Math.ceil(ai.nextWave - ai.t)); w.style.display = left < 600 ? 'block' : 'none'; w.textContent = `⚔ Vague ennemie dans ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; } else w.style.display = 'none';
  const idle = units.filter(u => u.team === 0 && u.def.cls === 'villager' && !u.cmd).length; const ib = $('idleBtn'); if (ib) { ib.dataset.n = idle; ib.classList.toggle('warn', idle > 0); }
  renderPanel();
}
const esc = s => String(s).replace(/"/g, '&quot;');
function bt(act, icon, label, sub, reason, desc = '') {
  if (reason === 'x' || (isTouch && reason?.startsWith('🔒 Âge'))) return ''; // sur mobile on masque ce qui est verrouillé par l'âge
  return `<button class="b" data-act="${act}" ${reason ? 'disabled' : ''} title="${esc(label + (desc ? ' — ' + desc : '') + (reason ? ' (' + reason + ')' : ''))}"><span class="i">${icon}</span><span class="t">${label}</span>${sub ? `<span class="c">${reason && reason.startsWith('🔒') ? reason : sub}</span>` : ''}</button>`;
}
function canBuild(type) {
  const d = BUILD[type], T = teams[0];
  if (d.age > T.age) return ageLock(d.age);
  if (d.req && !buildings.some(b => b.team === 0 && b.type === d.req && b.done)) return '🔒 ' + BUILD[d.req].label;
  if (!canPay(0, d.cost)) return 'Ressources insuffisantes'; return null;
}
let panelHTML = '', buildSheet = false, pending = null;
const MOBILE = isTouch || innerWidth < 760;
function costLine(type) { const d = BUILD[type]; return costTxt(d.cost).replace(/(\d+)(\S+)/g, '$2 $1') + (d.wall ? ' /m' : '') + (d.pop ? ` · +${d.pop} pop.` : ''); }
function lockTxt(r) { return r.startsWith('🔒 Âge') ? 'Requiert l\'' + r.slice(2) : r.startsWith('🔒') ? 'Requiert ' + r.slice(2).toLowerCase() : r; }
function mobilePanel(sel) {
  const act = (a, icon, label, primary = false, dis = false) => `<button class="act${primary ? ' primary' : ''}" data-act="${a}" ${dis ? 'disabled' : ''}><span class="i">${icon}</span>${label}</button>`;
  if (placing) {
    const d = BUILD[placing], ready = d.wall ? !!(wallStart && pending) : !!pending;
    const hint = d.wall ? (!wallStart ? 'Touchez le point de départ du mur' : !pending ? 'Touchez le point d\'arrivée' : 'Vérifiez le tracé puis ✔') : (pending ? (validAt(placing, pending.x, pending.z) ? 'Emplacement valide : ✔ pour confirmer' : 'Emplacement invalide, touchez ailleurs') : 'Touchez la carte pour placer');
    return `<div class="row"><b>${d.icon} ${d.label}</b><span>${costLine(placing)}</span></div><div class="acts">${act('confirm', '✔', 'Placer', true, !ready)}${d.wall ? act('wallreset', '↺', 'Recommencer', false, !wallStart) : act('rotate', '↻', 'Pivoter')}${act('sheet', '🏠', 'Autre')}${act('desel', '✖', 'Annuler')}</div><div style="font-size:13px;margin-top:6px">${hint}</div>`;
  }
  if (buildSheet) {
    const cards = Object.keys(BUILD).filter(k => !(BUILD[k].age > teams[0].age + 1)).map(k => {
      const d = BUILD[k], r = canBuild(k), locked = r && r.startsWith('🔒');
      return `<button class="card" data-act="place:${k}" ${r ? 'disabled' : ''}><b>${locked ? '🔒' : d.icon} ${d.label}</b><span class="cost">${locked ? lockTxt(r) : costLine(k)}</span></button>`;
    }).join('');
    return `<div class="row"><b style="font-size:17px">Construire</b><button class="close" data-act="sheetclose">✕</button></div><div class="grid">${cards}</div><p style="font-size:13px;margin:10px 0 0">Touchez la carte pour placer, puis ✔ pour confirmer.</p>`;
  }
  if (!sel.length) return null;
  const vills = sel.filter(u => u.def.cls === 'villager'), c = {}; sel.forEach(u => c[u.type] = (c[u.type] || 0) + 1);
  const title = Object.entries(c).map(([t, n]) => `${n} ${UNIT[t].label.toLowerCase()}${n > 1 && !t.endsWith('s') ? 's' : ''}`).join(', ') + (sel.length > 1 ? ' sélectionnés' : ' sélectionné');
  const g = {}; vills.forEach(u => { const t = u.cmd?.type === 'gather' && u.cmd.res ? resTypeOf(u.cmd.res) : u.cmd?.type === 'build' ? 'construction' : null; if (t) g[t] = (g[t] || 0) + 1; });
  const job = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
  const right = job ? (job[0] === 'construction' ? 'Construction' : 'Récolte : ' + RES_LABEL[job[0]].toLowerCase()) : sel.length === 1 ? `PV ${Math.ceil(sel[0].hp)}/${sel[0].maxHp}` : '';
  const acts = vills.length ? act('gatherauto', '🪓', 'Récolter', true) + act('sheet', '🏠', 'Construire') + act('atk', '⚔', 'Attaquer') + act('desel', '✖', 'Annuler')
    : act('atk', '⚔', 'Attaquer', true) + act('stop', '⏹', 'Arrêter') + act('army', '🛡', 'Armée') + act('desel', '✖', 'Annuler');
  return `<div class="row"><b>${title}</b><span>${right}</span></div><div class="acts">${acts}</div>`;
}
function renderPanel() {
  let h = ''; const sel = selUnits();
  const mp = MOBILE ? mobilePanel(sel) : null; $('panel').classList.toggle('sheet', MOBILE && buildSheet && !placing);
  if (mp !== null) h = mp;
  else if (placing) {
    const d = BUILD[placing];
    h = `<div class="hd">${d.icon} <b>${d.label}</b> — ${d.wall ? (wallStart ? 'choisissez le point final' : (isTouch ? 'touchez le point de départ puis le point final' : 'cliquez-glissez (ou 2 clics) pour tracer le mur')) : (isTouch ? 'touchez le sol pour placer' : 'clic gauche pour placer (Maj = plusieurs)')}</div>`
      + (d.wall ? '' : bt('rotate', '↻', 'Pivoter' + (isTouch ? '' : ' (R)'), '', null)) + bt('desel', '✖', 'Annuler', '', null);
  } else if (selBuilding) {
    const b = selBuilding, S = b.def;
    h = `<div class="hd"><span class="por big">${S.icon}</span> <b>${S.label}${b.team ? ' (ennemi)' : ''}</b> — PV ${Math.ceil(b.hp)}/${b.maxHp}${S.farm && b.done ? ` — 🍖 ${b.amount}` : ''}</div>`;
    if (b.team === 0) {
      if (!b.done) h += `<div>Construction : ${Math.floor(b.progress * 100)} % (envoyez des villageois)</div>` + bt('cancelb', '✖', 'Annuler', 'remboursé', null);
      else {
        for (const k of Object.keys(UNIT)) if (UNIT[k].b === b.type) h += bt('train:' + k, UNIT[k].icon, UNIT[k].label, costTxt(UNIT[k].cost), canTrain(b, k), UNIT[k].desc);
        if (b.type === 'hdv' && teams[0].age < 3) h += bt('age', '⏫', AGES[teams[0].age + 1].name, costTxt(AGES[teams[0].age + 1].cost), canAge(b));
        for (const id of Object.keys(TECHS)) if (TECHS[id].b === b.type) h += bt('tech:' + id, TECHS[id].icon, TECHS[id].label, costTxt(TECHS[id].cost), canTech(b, id), TECHS[id].desc);
        if (Object.values(UNIT).some(u => u.b === b.type)) h += bt('rally', '🚩', rallyMode ? 'Choisir…' : 'Ralliement', '', null, 'Point de ralliement (sol ou ressource)');
        if (b.queue.length) {
          const q0 = b.queue[0], tot = q0.time, pct = Math.floor((1 - b.trainT / tot) * 100);
          h += `<div class="q">File : ` + b.queue.map((q, i) => `<button class="por" data-act="cancelq:${i}" title="Annuler (remboursé)">${q.kind === 'unit' ? UNIT[q.id].icon : q.kind === 'tech' ? TECHS[q.id].icon : '⏫'}${i === 0 ? `<sub>${pct}%</sub>` : ''}</button>`).join('') + ' <small>(touchez pour annuler)</small></div>';
        }
      }
    }
  } else if (sel.length) {
    const c = {}; sel.forEach(u => c[u.type] = (c[u.type] || 0) + 1);
    h = '<div class="hd">' + Object.entries(c).map(([t, n]) => `<button class="por" data-act="only:${t}" title="${UNIT[t].label}">${UNIT[t].icon}<sub>${n}</sub></button>`).join('');
    if (sel.length === 1) { const u = sel[0]; h += ` <b>${u.def.label}</b> — PV ${Math.ceil(u.hp)}/${u.maxHp} · ⚔${u.def.atk + (u.def.cls !== 'villager' && u.def.cls !== 'siege' ? teams[0].up.atk : 0)} 🛡${u.def.am}/${u.def.ap}`; if (u.carry) h += ` · ${RES_ICON[u.carryType]} ${u.carry}`; }
    h += '</div>' + bt('stop', '⏹', 'Arrêter' + (isTouch ? '' : ' (X)'), '', null);
    if (c.villageois) for (const k of Object.keys(BUILD)) h += bt('place:' + k, BUILD[k].icon, BUILD[k].label, costTxt(BUILD[k].cost) + (BUILD[k].wall ? '/m' : ''), canBuild(k));
  } else h = `<i>${isTouch ? 'Touchez une unité ou un bâtiment (appui long = sélection)' : 'Aucune sélection — clic sur une unité ou un bâtiment'}</i>`;
  if (h !== panelHTML) { panelHTML = h; $('panel').innerHTML = h; }
}
function doAct(a) {
  if (!a) return;
  const [k, v] = a.split(':');
  if (k === 'train' && selBuilding) { const r = canTrain(selBuilding, v); if (r) { msg(r); sfx('error'); } else { train(selBuilding, v); sfx('click'); } }
  else if (k === 'tech' && selBuilding) { const r = canTech(selBuilding, v); if (r) { msg(r); sfx('error'); } else { research(selBuilding, v); sfx('click'); } }
  else if (k === 'age' && selBuilding) { const r = canAge(selBuilding); if (r) { msg(r); sfx('error'); } else { ageUp(selBuilding); sfx('click'); } }
  else if (k === 'place') { const r = canBuild(v); if (r) { msg(r); sfx('error'); } else { buildSheet = false; startPlacing(v); } }
  else if (k === 'rotate') rotateGhost();
  else if (k === 'only') setSel(selUnits().filter(u => u.type === v));
  else if (k === 'stop') selUnits().forEach(u => { u.cmd = null; u.target = null; u.path = []; })
  else if (k === 'cancelq' && selBuilding) { const b = selBuilding, i = +v, q = b.queue[i]; if (q) { b.queue.splice(i, 1); refund(0, q.cost); if (i === 0 && b.queue.length) b.trainT = b.queue[0].time; sfx('click'); } }
  else if (k === 'cancelb' && selBuilding && !selBuilding.done) { refund(0, selBuilding.def.cost); kill(selBuilding, false); msg('Construction annulée, ressources remboursées'); }
  else if (k === 'rally' && selBuilding) { rallyMode = !rallyMode; if (rallyMode) msg(isTouch ? 'Touchez le point de ralliement (sol ou ressource)' : 'Cliquez le point de ralliement (ou clic droit)'); }
  else if (k === 'box') { boxMode = !boxMode; msg(boxMode ? 'Mode cadre : glissez pour sélectionner' : 'Mode cadre désactivé'); }
  else if (k === 'atk') { if (selUnits().length) { atkMode = !atkMode; if (atkMode) msg(isTouch ? "Touchez la destination de l'attaque" : "Cliquez la destination de l'attaque"); } else msg('Sélectionnez des unités'); }
  else if (k === 'army') setSel(units.filter(u => u.team === 0 && u.def.cls !== 'villager'));
  else if (k === 'home') { const h = hdvOf(0); if (h) { camTarget.copy(h.pos); updateCam(); } }
  else if (k === 'idle') selectIdle();
  else if (k === 'sheet') { stopPlacing(); buildSheet = true; }
  else if (k === 'sheetclose') buildSheet = false;
  else if (k === 'confirm') confirmPlace();
  else if (k === 'wallreset') { wallStart = null; pending = null; if (ghost) { ghost.scale.x = 1; } }
  else if (k === 'gatherauto') gatherAuto();
  else if (k === 'desel') { setSel([]); stopPlacing(); atkMode = false; rallyMode = false; buildSheet = false; }
  else if (extraActs[k]) extraActs[k](v);
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', (b.dataset.act === 'box' && boxMode) || (b.dataset.act === 'atk' && atkMode)));
  updateHUD();
}
export const extraActs = {};
let idleIdx = 0;
function selectIdle() {
  const idle = units.filter(u => u.team === 0 && u.def.cls === 'villager' && !u.cmd);
  if (!idle.length) return msg('Aucun villageois inactif');
  const u = idle[idleIdx++ % idle.length]; setSel([u]); camTarget.copy(u.pos); camTarget.z -= camDist * 0.1; updateCam();
}
$('panel').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));
$('tools').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));

// ---- placement (rotation, murs tracés)
let ghost, ghostRot = 0, wallStart = null;
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.45, depthWrite: false });
function startPlacing(type) {
  stopPlacing(); placing = type; wallStart = null;
  if (BUILD[type].wall) ghost = new THREE.Mesh(Bx(1, 2.2, 0.6), ghostMat);
  else { ghost = buildingMesh(type, 0); ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } }); ghost.rotation.y = ghostRot; }
  ghost.position.set(camTarget.x, 0, camTarget.z); scene.add(ghost); sfx('click');
}
function stopPlacing() { placing = null; wallStart = null; pending = null; if (ghost) scene.remove(ghost); ghost = null; }
function rotateGhost() { ghostRot = (ghostRot + Math.PI / 2) % (Math.PI * 2); if (ghost && !BUILD[placing]?.wall) ghost.rotation.y = ghostRot; }
function validAt(type, x, z) { const d = BUILD[type]; return d.wall ? wallFree(x, z) : free(x, z, d.radius, d.gate ? (o => o.def.wall && o.team === 0) : null); }
function updateGhost(x, y) { const p = groundAt(x, y); if (p) updateGhostAt(p); }
function updateGhostAt(p) {
  if (!ghost) return;
  if (BUILD[placing].wall && wallStart) {
    const len = Math.max(1, d2(wallStart, p)); ghost.scale.x = len; ghost.position.set((wallStart.x + p.x) / 2, 0, (wallStart.z + p.z) / 2); ghost.position.y = 1.1;
    ghost.rotation.y = -Math.atan2(p.z - wallStart.z, p.x - wallStart.x); ghostMat.color.set(canPay(0, BUILD[placing].cost) ? 0x00ff00 : 0xff0000);
  } else { ghost.position.set(p.x, BUILD[placing].wall ? 1.1 : 0, p.z); ghostMat.color.set(validAt(placing, p.x, p.z) ? 0x00ff00 : 0xff0000); }
}
function assignBuilders(list) {
  const v = selUnits().filter(u => u.def.cls === 'villager'); if (!list.length) return;
  v.forEach(u => cmdBuild(u, list.slice().sort((a, b) => d2(a.pos, u.pos) - d2(b.pos, u.pos))[0]));
}
function confirmPlace() {
  if (!placing || !pending) return; const d = BUILD[placing];
  if (d.wall) { if (wallStart) finishWall(pending); return; }
  const b = placeBuilding(placing, 0, pending.x, pending.z, ghostRot);
  if (!b) { msg('Emplacement invalide ou ressources insuffisantes'); sfx('error'); return; }
  assignBuilders([b]); sfx('place'); stopPlacing();
}
function gatherAuto() {
  const v = selUnits().filter(u => u.def.cls === 'villager'); if (!v.length) return;
  const c = v.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).divideScalar(v.length);
  const low = RES.slice().sort((a, b) => teams[0].res[a] - teams[0].res[b]);
  let r = null; for (const t of low) { r = resources.filter(o => o.type === t && isExp(o.pos) && d2(o.pos, c) < 30).sort((a, b) => d2(a.pos, c) - d2(b.pos, c))[0]; if (r) break; }
  r = r || resources.filter(o => isExp(o.pos)).sort((a, b) => d2(a.pos, c) - d2(b.pos, c))[0];
  if (!r) return msg('Aucune ressource connue à proximité');
  v.forEach(u => cmdGather(u, r)); msg('Récolte : ' + RES_LABEL[r.type]); sfx('ok');
}
function tryPlace(x, y, keep = false) {
  const p = groundAt(x, y); if (!p) return; const d = BUILD[placing];
  if (MOBILE && isTouch) { // mobile : on choisit puis on confirme
    if (d.wall && !wallStart) { wallStart = p.clone(); pending = null; ghost.position.set(p.x, 1.1, p.z); }
    else { pending = p.clone(); updateGhostAt(p); }
    sfx('click'); return doAct('noop');
  }
  if (d.wall) {
    if (!wallStart) { wallStart = p.clone(); msg('Choisissez le point final du mur'); updateGhost(x, y); return; }
    return finishWall(p);
  }
  const b = placeBuilding(placing, 0, p.x, p.z, ghostRot);
  if (!b) { msg('Emplacement invalide ou ressources insuffisantes'); sfx('error'); return; }
  assignBuilders([b]); sfx('place');
  if (!(keep && !canBuild(placing))) stopPlacing();
  doAct('noop');
}
function finishWall(p) {
  if (d2(wallStart, p) < 0.8) return;
  const segs = placeWall(placing, 0, wallStart, p);
  if (!segs.length) { msg('Impossible de placer le mur ici'); sfx('error'); }
  else { assignBuilders(segs); msg(`${segs.length} segment(s) de ${BUILD[placing].label.toLowerCase()} placés`); sfx('place'); }
  stopPlacing(); doAct('noop');
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
  if (!ent || ent.kind !== 'unit') {
    let bd = isTouch ? 30 : 16; for (const u of units) if (u.mesh.visible) { const [sx, sy] = screenOf(u.pos), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; ent = u; } }
  }
  return { ent, point: groundAt(x, y) || new THREE.Vector3() };
}
function marker(p, color) { const m = new THREE.Mesh(geo('mk', () => new THREE.RingGeometry(0.3, 0.7, 16).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color })); m.position.set(p.x, 0.25, p.z); scene.add(m); setTimeout(() => scene.remove(m), 400); }
function command(x, y, attackMove = false) {
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
let lastTap = { ent: null, t: 0 };
const onScreen = p => { const [x, y] = screenOf(p); return x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight; };
function clickSelect(x, y, add) {
  const { ent } = pickEntity(x, y);
  if (ent?.kind === 'unit' && ent.team === 0) {
    const now = performance.now();
    if (lastTap.ent === ent && now - lastTap.t < 350) setSel(units.filter(u => u.team === 0 && u.type === ent.type && onScreen(u.pos)), add);
    else if (add && ent.selected) ent.selected = false; else setSel([ent], add);
    lastTap = { ent, t: now }; sfx('select');
  } else if (ent?.kind === 'building') { setSel([]); selBuilding = ent; sfx('select'); }
  else if (!add) setSel([]);
}
function setRally(x, y) {
  const b = selBuilding; rallyMode = false; if (!b || b.team !== 0) return;
  const { ent, point } = pickEntity(x, y), res = ent?.kind === 'resource' || (ent?.def?.farm && ent.team === 0) ? ent : null, pos = res ? res.pos.clone() : point;
  b.rally = { pos, res };
  if (!b.flag) { b.flag = new THREE.Group(); b.flag.add(mk(Cy(0.05, 0.05, 2), 0x333333, 1)); b.flag.add(mk(Bx(0.8, 0.5, 0.05), TEAM_COLOR[0], 1.7).translateX(0.4)); scene.add(b.flag); }
  b.flag.position.set(pos.x, 0, pos.z); marker(pos, 0x4080ff); msg('Point de ralliement défini' + (res ? ' (récolte)' : '')); sfx('ok');
}
function tap(x, y) {
  if (placing) return tryPlace(x, y);
  if (rallyMode) { setRally(x, y); return doAct('noop'); }
  if (atkMode) { command(x, y, true); atkMode = false; doAct('noop'); return; }
  const { ent } = pickEntity(x, y), sel = selUnits();
  if (ent?.kind === 'unit' && ent.team === 0) return clickSelect(x, y, false);
  if (ent?.kind === 'building' && ent.team === 0) {
    const v = sel.filter(u => u.def.cls === 'villager');
    if (v.length && (!ent.done || (ent.def.farm) || (ent.def.drop && v.some(u => u.carry > 0)))) return command(x, y);
    setSel([]); selBuilding = ent; sfx('select'); return;
  }
  if (sel.length) return command(x, y);
  clickSelect(x, y, false);
}
function boxSelect(x1, y1, x2, y2, add) {
  const [a, b] = [Math.min(x1, x2), Math.max(x1, x2)], [c, d] = [Math.min(y1, y2), Math.max(y1, y2)];
  let list = units.filter(u => { if (u.team !== 0) return false; const [sx, sy] = screenOf(u.pos); return sx >= a && sx <= b && sy >= c && sy <= d; });
  if (list.some(u => u.def.cls !== 'villager')) list = list.filter(u => u.def.cls !== 'villager'); // priorité à l'armée
  setSel(list, add); if (list.length) sfx('select');
}
const box = $('box');
function drawBox(g, x, y) { Object.assign(box.style, { display: 'block', left: Math.min(g.sx, x) + 'px', top: Math.min(g.sy, y) + 'px', width: Math.abs(x - g.sx) + 'px', height: Math.abs(y - g.sy) + 'px' }); }

const keys = {}; const mouse = { x: innerWidth / 2, y: innerHeight / 2, in: false };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === 'escape') doAct('desel'); if (k === 'f') doAct('atk'); if (k === 'h') doAct('home'); if (k === 'x') doAct('stop');
  if (k === 'r' && placing) doAct('rotate'); if (k === '.' || k === 'i') doAct('idle');
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
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); unlockAudio();
  if (e.pointerType === 'mouse') {
    mouse.in = true;
    if (e.button === 2) {
      if (placing) { stopPlacing(); doAct('noop'); return; }
      if (rallyMode || (selBuilding?.team === 0 && !selUnits().length && selBuilding.done)) { setRally(e.clientX, e.clientY); doAct('noop'); return; }
      if (atkMode) { atkMode = false; doAct('noop'); } else command(e.clientX, e.clientY); return;
    }
    if (e.button !== 0) return;
    if (placing) { const wasStart = !wallStart; tryPlace(e.clientX, e.clientY, e.shiftKey); if (placing && BUILD[placing].wall && wasStart && wallStart) gest = { type: 'wall', sx: e.clientX, sy: e.clientY }; return; }
    if (rallyMode) { setRally(e.clientX, e.clientY); doAct('noop'); return; }
    if (atkMode) { command(e.clientX, e.clientY, true); atkMode = false; doAct('noop'); return; }
    gest = { type: 'mpending', sx: e.clientX, sy: e.clientY, shift: e.shiftKey }; return;
  }
  if (ptrs.size === 1) {
    const g = gest = { type: boxMode ? 'box' : 'tpending', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, shift: false };
    g.lp = setTimeout(() => { // appui long = sélection
      if (gest !== g || g.type !== 'tpending' || placing) return; const { ent } = pickEntity(g.sx, g.sy);
      if (ent?.kind === 'unit' && ent.team === 0) { ent.selected = true; selBuilding = null; }
      else if (ent?.kind === 'building') { setSel([]); selBuilding = ent; }
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
  else if (gest.type === 'pinch' && ptrs.size >= 2) { const p = pinchInfo(); camDist *= gest.d / p.d; panBy(p.mx - gest.mx, p.my - gest.my); Object.assign(gest, p); }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (!gest) return;
  const x = e.clientX, y = e.clientY; clearTimeout(gest.lp);
  if (gest.type === 'mpending') clickSelect(x, y, gest.shift);
  else if (gest.type === 'tpending') tap(x, y);
  else if (gest.type === 'box') { box.style.display = 'none'; boxSelect(gest.sx, gest.sy, x, y, gest.shift); }
  else if (gest.type === 'wall' && placing && wallStart && Math.hypot(x - gest.sx, y - gest.sy) > 15) { const p = groundAt(x, y); if (p) finishWall(p); }
  if (gest.type === 'pinch' && ptrs.size === 1) { const p = [...ptrs.values()][0]; gest = { type: 'pan', sx: -1e4, sy: -1e4, lx: p.x, ly: p.y }; return; }
  if (!ptrs.size) gest = null; updateHUD();
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { if (gest?.type === 'tpending') gest = null; endPtr(e); });
let unlockAudio = () => { }; export function setUnlock(f) { unlockAudio = f; }

// ================= Minimap =================
const mini = $('mini'), mctx = mini.getContext('2d'), MS = mini.width / SIZE;
const fogCanvas = document.createElement('canvas'); fogCanvas.width = fogCanvas.height = FN; const fctx = fogCanvas.getContext('2d'), fimg = fctx.createImageData(FN, FN);
function drawMini() {
  mctx.fillStyle = '#4f7d38'; mctx.fillRect(0, 0, mini.width, mini.height);
  const C = { bois: '#1f4a1c', pierre: '#9a9a9a', or: '#f0c030', nourriture: '#d04060' };
  for (const r of resources) if (r.mesh.visible) { mctx.fillStyle = C[r.type]; mctx.fillRect((r.pos.x + HALF) * MS - 1, (r.pos.z + HALF) * MS - 1, 2, 2); }
  for (const b of buildings) if (b.team === 0 || b.mesh.visible) { mctx.fillStyle = b.team ? '#ff4040' : '#4080ff'; const s = Math.max(2, b.radius * MS * 1.6); mctx.fillRect((b.pos.x + HALF) * MS - s / 2, (b.pos.z + HALF) * MS - s / 2, s, s); }
  for (const u of units) if (u.team === 0 || u.mesh.visible) { mctx.fillStyle = u.team ? '#ff8080' : (u.selected ? '#ffffff' : '#90c0ff'); mctx.fillRect((u.pos.x + HALF) * MS - 1.5, (u.pos.z + HALF) * MS - 1.5, 3, 3); }
  if (!NOFOG) { for (let k = 0; k < FN * FN; k++) fimg.data[k * 4 + 3] = visible[k] ? 0 : explored[k] ? 110 : 255; fctx.putImageData(fimg, 0, 0); mctx.drawImage(fogCanvas, 0, 0, mini.width, mini.height); }
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
  if (gameOver) return; gameOver = true; sfx(win ? 'age' : 'horn');
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
  if (!gameOver && started) for (let i = 0; i < SPEED; i++) step(rdt);
  for (let i = arrows.length - 1; i >= 0; i--) { const a = arrows[i]; a.t += rdt * SPEED / a.dur; if (a.t >= 1) { scene.remove(a.m); arrows.splice(i, 1); continue; } a.m.position.lerpVectors(a.a, a.b, a.t); a.m.position.y += Math.sin(a.t * Math.PI) * a.arc; a.m.lookAt(a.b); }
  fogT -= rdt; if (fogT <= 0) { fogT = 0.2; updateFog(); }
  miniT -= rdt; if (miniT <= 0) { miniT = isTouch ? 0.4 : 0.25; drawMini(); }
  hudT -= rdt; if (hudT <= 0) { hudT = 0.3; updateHUD(); }
  for (const e of [...units, ...buildings]) {
    if (e.ring) e.ring.visible = e.selected;
    const show = e.mesh.visible && (e.hp < e.maxHp || e.selected || e === selBuilding);
    e.bar.visible = show; if (!show) continue;
    const { fg, w, h } = e.bar.userData, r = Math.max(0, e.hp / e.maxHp);
    e.bar.position.set(e.pos.x, h, e.pos.z); e.bar.quaternion.copy(camera.quaternion);
    fg.scale.x = w * r; fg.position.x = -w * (1 - r) / 2; fg.material.color.setHex(e.done === false ? 0x60a0ff : r > 0.6 ? 0x30e030 : r > 0.3 ? 0xe0c030 : 0xe03030);
  }
  renderer.render(scene, camera); requestAnimationFrame(loop);
}
export const game = {
  step, addUnit, addBuilding, addResource, units, buildings, resources, teams, ai, THREE, cmdMove, cmdGather, cmdAttack, cmdBuild, screenOf, camTarget, doAct, setRally, pickEntity, placeWall, placeBuilding, applyTech, train, research, ageUp, kill,
  explored, rebuildGrid, P0, free, wallFree, setSel, updateFog, updateHUD, msg,
  get D() { return D; }, set D(v) { D = v; }, get started() { return started; }, set started(v) { started = v; }, get gameTime() { return gameTime; }, set gameTime(v) { gameTime = v; },
  get selBuilding() { return selBuilding; }, set selBuilding(b) { selBuilding = b; }, get camDist() { return camDist; }, get over() { return gameOver; }, endGame,
};
window.__game = game;
export function boot(skipMap = false) {
  if (isTouch) { const hp = $('help'); hp.textContent = hp.dataset.touch; }
  if (!skipMap) generateMap();
  camTarget.copy(hdvOf(0)?.pos || P0); updateCam(); updateFog(); updateHUD(); loop();
  if (!started) $('start').style.display = 'flex';
  $('start').addEventListener('click', e => { const k = e.target.closest('button')?.dataset.diff; if (!k) return; D = DIFFS[k]; ai.nextWave = D.first; started = true; $('start').style.display = 'none'; msg('Difficulté : ' + D.label); unlockAudio(); });
  if (D && !skipMap) ai.nextWave = D.first;
}
