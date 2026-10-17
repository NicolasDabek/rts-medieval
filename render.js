import * as THREE from 'three';
import { st } from './state.js';
import { HALF, SIZE, isTouch } from './config.js';


// ================= Rendu =================
export const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !isTouch;
document.body.prepend(renderer.domElement);
export const cv = renderer.domElement;
export const scene = new THREE.Scene();
 scene.background = new THREE.Color(0x1e2a16);
scene.fog = new THREE.Fog(0x1e2a16, 150, 320);
export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 600);
export const camTarget = new THREE.Vector3();
 st.camDist = isTouch ? 50 : 60;
export function updateCam() {
  camTarget.x = Math.max(-HALF, Math.min(HALF, camTarget.x)); camTarget.z = Math.max(-HALF, Math.min(HALF, camTarget.z));
  st.camDist = Math.max(15, Math.min(130, st.camDist));
  camera.position.set(camTarget.x, st.camDist * 0.85, camTarget.z + st.camDist * 0.6); camera.lookAt(camTarget);
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 0.9));
export const sun = new THREE.DirectionalLight(0xffffff, 1.6);
 sun.position.set(40, 80, 30);
 sun.castShadow = !isTouch;
Object.assign(sun.shadow.camera, { left: -HALF, right: HALF, top: HALF, bottom: -HALF });
 sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
export const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshLambertMaterial({ color: 0x6aa04a }));
ground.rotation.x = -Math.PI / 2;
 ground.receiveShadow = true;
 scene.add(ground);
export const outer = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0x24341b }));
 outer.rotation.x = -Math.PI / 2;
 outer.position.y = -0.05;
 scene.add(outer);

export const matCache = {};
export const mat = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
export function mk(geom, color, y = 0, own = false) { const m = new THREE.Mesh(geom, own ? new THREE.MeshLambertMaterial({ color }) : mat(color)); m.position.y = y; m.castShadow = !isTouch; return m; }
export const geoC = {};
 export const geo = (k, f) => geoC[k] || (geoC[k] = f());
export const Bx = (w, h, d) => geo('b' + [w, h, d], () => new THREE.BoxGeometry(w, h, d));
export const Cy = (rt, rb, h, s = 8) => geo('c' + [rt, rb, h, s], () => new THREE.CylinderGeometry(rt, rb, h, s));
export const Co = (r, h, s = 4) => geo('o' + [r, h, s], () => { const g = new THREE.ConeGeometry(r, h, s); return s === 4 ? g.rotateY(Math.PI / 4) : g; });
export const Sp = r => geo('s' + r, () => new THREE.SphereGeometry(r, 8, 6));
export const G = {
  ring: new THREE.RingGeometry(0.6, 0.75, 20).rotateX(-Math.PI / 2), arrow: new THREE.BoxGeometry(0.06, 0.06, 0.8),
  bar: new THREE.PlaneGeometry(1, 0.16), bow: new THREE.TorusGeometry(0.45, 0.04, 4, 12, Math.PI),
};
export const ringMat = new THREE.MeshBasicMaterial({ color: 0x40ff40 });
export function addPart(g, geom, c, x = 0, y = 0, z = 0) { const m = mk(geom, c, y); m.position.x = x; m.position.z = z; g.add(m); return m; }
