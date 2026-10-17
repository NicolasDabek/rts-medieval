import { DIFFS, RES_ICON } from './data.js';
import { st } from './state.js';


// ================= Configuration =================
export const params = new URLSearchParams(location.search);
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const SPEED = +params.get('speed') || 1;
export const NOFOG = params.has('nofog');
export const SIZE = 160, HALF = SIZE / 2;
st.D = DIFFS[params.get('diff')] || null; st.started = !!st.D;
export const TEAM_COLOR = [0x3060c0, 0xc03030];
export function newTeam() { return { res: { nourriture: 200, bois: 200, or: 100, pierre: 100 }, age: 0, techs: new Set(), up: { atk: 0, arm: 0, projAtk: 0, range: 0, cap: 10, vspeed: 1, bhp: 1, train: 1, farm: 0, gather: { nourriture: 1, bois: 1, or: 1, pierre: 1 } } }; }
export const teams = [newTeam(), newTeam()];
export const costTxt = c => Object.entries(c || {}).map(([k, v]) => `${v}${RES_ICON[k]}`).join(' ');
export let sfx = () => { };
export function setSfx(f) { sfx = f; }

// ================= Interface =================
export const $ = id => document.getElementById(id);
