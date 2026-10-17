import { RES, AGES, BUILD, UNIT, RES_LABEL, TECHS, RES_ICON } from './data.js';
import * as THREE from 'three';
import { st } from './state.js';
import { ai } from './ai.js';
import { $, HALF, NOFOG, SIZE, costTxt, isTouch, sfx, teams } from './config.js';
import { groundAt } from './input.js';
import { FN, explored, isExp, visible } from './map.js';
import { Bx, camTarget, scene, updateCam } from './render.js';
import { ageLock, ageUp, canAge, canPay, canTech, canTrain, cmdBuild, cmdGather, formation, hdvOf, kill, placeBuilding, placeWall, popCap, popCount, refund, resTypeOf, research, train } from './units.js';
import { buildingMesh, buildings, d2, extOf, free, resources, units, wallFree } from './world.js';

export let msgT;
 export function msg(t, ms = 2500) { $('msg').textContent = t; clearTimeout(msgT); msgT = setTimeout(() => $('msg').textContent = '', ms); }
st.rallyMode = false; st.selBuilding = null; export let placing = null; st.atkMode = false; export let boxMode = false; export let gameOver = false; st.gameTime = 0;
export const selUnits = () => units.filter(u => u.selected);
export function setSel(list, add = false) { if (!add) units.forEach(u => u.selected = false); list.forEach(u => u.selected = true); st.selBuilding = null; }
// annonces pour lecteurs d'écran (région aria-live)
const ann = { wave: 0, soon: null, idle: 0, idleT: -1e9 };
export function announce(t) { const l = $('live'); if (!l) return; l.textContent = ''; setTimeout(() => l.textContent = t, 50); }
// clignotement rouge des ressources manquantes
export function flashLack(cost) { const r = teams[0].res; for (const k of Object.keys(cost || {})) if (r[k] < cost[k]) { const p = $(k)?.parentElement; if (p) { p.classList.remove('lack'); void p.offsetWidth; p.classList.add('lack'); } } }
export function updateHUD() {
  const r = teams[0].res; for (const k of RES) { const v = Math.floor(r[k]), el = $(k); if (el.textContent === String(v)) continue;
    const pill = el.parentElement; if (+el.textContent < v && st.started) { pill.classList.remove('up'); void pill.offsetWidth; pill.classList.add('up'); }
    el.textContent = v; pill.setAttribute('aria-label', `${RES_LABEL[k]} : ${v}`); }
  $('pop').textContent = popCount(0) + '/' + popCap(0); $('age').textContent = AGES[teams[0].age].name;
  const s = Math.floor(st.gameTime); $('time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const w = $('wave'); if (st.started && st.D && !gameOver) { const left = Math.max(0, Math.ceil(ai.nextWave - ai.t)); w.style.display = left < 600 ? 'block' : 'none'; w.textContent = `⚔ Vague ennemie dans ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const wd = buildings.filter(b => b.def.wonder && b.done).sort((a, c) => a.wonderT - c.wonderT)[0];
    if (wd) { const s = Math.max(0, Math.ceil(wd.wonderT)), mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; w.style.display = 'block'; w.textContent = wd.team === 0 ? `🏛️ Votre merveille : victoire dans ${mm}` : `🏛️ Merveille ennemie : défaite dans ${mm} — détruisez-la !`; }
  } else w.style.display = 'none';
  const idle = units.filter(u => u.team === 0 && u.def.cls === 'villager' && !u.cmd).length; const ib = $('idleBtn'); if (ib) { ib.dataset.n = idle; ib.classList.toggle('warn', idle > 0); ib.setAttribute('aria-label', `Villageois inactifs : ${idle}`); }
  if (st.started && !gameOver) {
    if (ai.waveN > ann.wave) { ann.wave = ai.waveN; announce(`Alerte : la vague ennemie ${ai.waveN} attaque !`); }
    else if (ai.nextWave - ai.t <= 60 && ai.nextWave - ai.t > 0 && ann.soon !== ai.nextWave) { ann.soon = ai.nextWave; announce('Vague ennemie dans une minute'); }
    if (idle > ann.idle && performance.now() - ann.idleT > 8000) { ann.idleT = performance.now(); announce(`${idle} villageois inactif${idle > 1 ? 's' : ''}`); }
    ann.idle = idle;
  }
  renderPanel();
}
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
export function bt(act, icon, label, sub, reason, desc = '') {
  if (reason === 'x' || (isTouch && reason?.startsWith('🔒 Âge'))) return ''; // sur mobile on masque ce qui est verrouillé par l'âge
  const lack = reason === 'Ressources insuffisantes';
  return `<button class="b${lack ? ' dis' : ''}" data-act="${act}" ${reason && !lack ? 'disabled' : ''} ${lack ? 'aria-disabled="true"' : ''} aria-label="${esc(label + (reason ? ' (' + reason + ')' : ''))}" title="${esc(label + (desc ? ' — ' + desc : '') + (reason ? ' (' + reason + ')' : ''))}"><span class="i">${icon}</span><span class="t">${esc(label)}</span>${sub ? `<span class="c">${esc(reason && reason.startsWith('🔒') ? reason : sub)}</span>` : ''}</button>`;
}
export function canBuild(type) {
  const d = BUILD[type], T = teams[0];
  if (d.age > T.age) return ageLock(d.age);
  if (d.limit && buildings.some(b => b.team === 0 && b.type === type)) return '🔒 Une seule ' + d.label.toLowerCase();
  if (d.req && !buildings.some(b => b.team === 0 && b.type === d.req && b.done)) return '🔒 ' + BUILD[d.req].label;
  if (!canPay(0, d.cost)) return 'Ressources insuffisantes'; return null;
}
export let panelHTML = '', buildSheet = false, pending = null;
export const MOBILE = isTouch || innerWidth < 760;
export function costLine(type) { const d = BUILD[type]; return costTxt(d.cost).replace(/(\d+)(\S+)/g, '$2 $1') + (d.wall ? ' /m' : '') + (d.pop ? ` · +${d.pop} pop.` : ''); }
export function lockTxt(r) { return r.startsWith('🔒 Âge') ? 'Requiert l\'' + r.slice(2) : r.startsWith('🔒') ? 'Requiert ' + r.slice(2).toLowerCase() : r; }
export function mobilePanel(sel) {
  const act = (a, icon, label, primary = false, dis = false) => `<button class="act${primary ? ' primary' : ''}" data-act="${a}" aria-label="${esc(label)}" ${dis ? 'disabled' : ''}><span class="i">${icon}</span>${esc(label)}</button>`;
  if (placing) {
    const d = BUILD[placing], ready = d.wall ? !!(wallStart && pending) : !!pending;
    const hint = d.wall ? (!wallStart ? 'Touchez le point de départ du mur' : !pending ? 'Touchez le point d\'arrivée' : 'Vérifiez le tracé puis ✔') : (pending ? (validAt(placing, pending.x, pending.z) ? 'Emplacement valide : ✔ pour confirmer' : 'Emplacement invalide, touchez ailleurs') : 'Touchez la carte pour placer');
    return `<div class="row"><b>${d.icon} ${esc(d.label)}</b><span>${costLine(placing)}</span></div><div class="acts">${act('confirm', '✔', 'Placer', true, !ready)}${d.wall ? act('wallreset', '↺', 'Recommencer', false, !wallStart) : act('rotate', '↻', 'Pivoter')}${act('sheet', '🏠', 'Autre')}${act('desel', '✖', 'Annuler')}</div><div style="font-size:13px;margin-top:6px">${esc(hint)}</div>`;
  }
  if (buildSheet) {
    const cards = Object.keys(BUILD).filter(k => !(BUILD[k].age > teams[0].age + 1)).map(k => {
      const d = BUILD[k], r = canBuild(k), locked = r && r.startsWith('🔒');
      const lack = r === 'Ressources insuffisantes';
      return `<button class="card${lack ? ' dis' : ''}" data-act="place:${k}" aria-label="${esc(d.label + ' — ' + (r || costLine(k)))}" ${r && !lack ? 'disabled' : ''}><b>${locked ? '🔒' : d.icon} ${esc(d.label)}</b><span class="cost">${locked ? lockTxt(r) : costLine(k)}</span></button>`;
    }).join('');
    return `<div class="row"><b style="font-size:17px">Construire</b><button class="close" data-act="sheetclose" aria-label="Fermer">✕</button></div><div class="grid">${cards}</div><p style="font-size:13px;margin:10px 0 0">Touchez la carte pour placer, puis ✔ pour confirmer.</p>`;
  }
  if (!sel.length) return null;
  const vills = sel.filter(u => u.def.cls === 'villager'), c = {}; sel.forEach(u => c[u.type] = (c[u.type] || 0) + 1);
  const title = Object.entries(c).map(([t, n]) => `${n} ${UNIT[t].label.toLowerCase()}${n > 1 && !t.endsWith('s') ? 's' : ''}`).join(', ') + (sel.length > 1 ? ' sélectionnés' : ' sélectionné');
  const g = {}; vills.forEach(u => { const t = u.cmd?.type === 'gather' && u.cmd.res ? resTypeOf(u.cmd.res) : u.cmd?.type === 'build' ? 'construction' : null; if (t) g[t] = (g[t] || 0) + 1; });
  const job = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
  const right = job ? (job[0] === 'construction' ? 'Construction' : 'Récolte : ' + RES_LABEL[job[0]].toLowerCase()) : sel.length === 1 ? `PV ${Math.ceil(sel[0].hp)}/${sel[0].maxHp}` : '';
  const acts = vills.length ? act('gatherauto', '🪓', 'Récolter', true) + act('sheet', '🏠', 'Construire') + act('atk', '⚔', 'Attaquer') + act('desel', '✖', 'Annuler')
    : act('atk', '⚔', 'Attaquer', true) + act('stop', '⏹', 'Arrêter') + act('army', '🛡', 'Armée') + act('desel', '✖', 'Annuler');
  const hp = sel.reduce((a, u) => a + u.hp, 0), mhp = sel.reduce((a, u) => a + u.maxHp, 0), pct = Math.round(100 * hp / mhp);
  const por = Object.keys(c).slice(0, 3).map(t => `<span class="por big" aria-hidden="true">${UNIT[t].icon}</span>`).join('');
  return `<div class="row mrow"><span class="ports">${por}</span><span class="who"><b>${esc(title)}</b><span class="hpb" role="img" aria-label="PV ${Math.ceil(hp)} sur ${mhp}"><i style="width:${pct}%"></i></span><small>PV ${Math.ceil(hp)}/${mhp}${right && !right.startsWith('PV') ? ' · ' + right : ''}</small></span></div><div class="acts">${acts}</div>`;
}
export function renderPanel() {
  let h = ''; const sel = selUnits();
  const mp = MOBILE ? mobilePanel(sel) : null; $('panel').classList.toggle('sheet', MOBILE && buildSheet && !placing);
  if (mp !== null) h = mp;
  else if (placing) {
    const d = BUILD[placing];
    h = `<div class="hd">${d.icon} <b>${esc(d.label)}</b> — ${d.wall ? (wallStart ? 'choisissez le point final' : (isTouch ? 'touchez le point de départ puis le point final' : 'cliquez-glissez (ou 2 clics) pour tracer le mur')) : (isTouch ? 'touchez le sol pour placer' : 'clic gauche pour placer (Maj = plusieurs)')}</div>`
      + (d.wall ? '' : bt('rotate', '↻', 'Pivoter' + (isTouch ? '' : ' (R)'), '', null)) + bt('desel', '✖', 'Annuler', '', null);
  } else if (st.selBuilding) {
    const b = st.selBuilding, S = b.def;
    h = `<div class="hd"><span class="por big">${S.icon}</span> <b>${esc(S.label)}${b.team ? ' (ennemi)' : ''}</b> — PV ${Math.ceil(b.hp)}/${b.maxHp}${S.farm && b.done ? ` — 🍖 ${b.amount}` : ''}</div>`;
    if (b.team === 0) {
      if (!b.done) h += `<div>Construction : ${Math.floor(b.progress * 100)} % (envoyez des villageois)</div>` + bt('cancelb', '✖', 'Annuler', 'remboursé', null);
      else {
        for (const k of Object.keys(UNIT)) if (UNIT[k].b === b.type) h += bt('train:' + k, UNIT[k].icon, UNIT[k].label, costTxt(UNIT[k].cost), canTrain(b, k), UNIT[k].desc);
        if (b.type === 'hdv' && teams[0].age < 3) h += bt('age', '⏫', AGES[teams[0].age + 1].name, costTxt(AGES[teams[0].age + 1].cost), canAge(b));
        for (const id of Object.keys(TECHS)) if (TECHS[id].b === b.type) h += bt('tech:' + id, TECHS[id].icon, TECHS[id].label, costTxt(TECHS[id].cost), canTech(b, id), TECHS[id].desc);
        if (Object.values(UNIT).some(u => u.b === b.type)) h += bt('rally', '🚩', st.rallyMode ? 'Choisir…' : 'Ralliement', '', null, 'Point de ralliement (sol ou ressource)');
        if (b.queue.length) {
          const q0 = b.queue[0], tot = q0.time, pct = Math.floor((1 - b.trainT / tot) * 100);
          h += `<div class="q">File : ` + b.queue.map((q, i) => `<button class="por" data-act="cancelq:${i}" title="Annuler (remboursé)">${q.kind === 'unit' ? UNIT[q.id].icon : q.kind === 'tech' ? TECHS[q.id].icon : '⏫'}${i === 0 ? `<sub>${pct}%</sub>` : ''}</button>`).join('') + ' <small>(touchez pour annuler)</small></div>';
        }
      }
    }
  } else if (sel.length) {
    const c = {}; sel.forEach(u => c[u.type] = (c[u.type] || 0) + 1);
    h = '<div class="hd">' + Object.entries(c).map(([t, n]) => `<button class="por" data-act="only:${t}" title="${esc(UNIT[t].label)}">${UNIT[t].icon}<sub>${n}</sub></button>`).join('');
    if (sel.length === 1) { const u = sel[0]; h += ` <b>${esc(u.def.label)}</b> — PV ${Math.ceil(u.hp)}/${u.maxHp} · ⚔${u.def.atk + (u.def.cls !== 'villager' && u.def.cls !== 'siege' ? teams[0].up.atk : 0)} 🛡${u.def.am}/${u.def.ap}`; if (u.carry) h += ` · ${RES_ICON[u.carryType]} ${u.carry}`; }
    h += '</div>' + bt('stop', '⏹', 'Arrêter' + (isTouch ? '' : ' (X)'), '', null);
    if (c.villageois) for (const k of Object.keys(BUILD)) h += bt('place:' + k, BUILD[k].icon, BUILD[k].label, costTxt(BUILD[k].cost) + (BUILD[k].wall ? '/m' : ''), canBuild(k));
  } else h = `<i>${isTouch ? 'Touchez une unité ou un bâtiment (appui long = sélection)' : 'Aucune sélection — clic sur une unité ou un bâtiment'}</i>`;
  $('panel').classList.toggle('empty', MOBILE && !mp && !sel.length && !st.selBuilding);
  if (h !== panelHTML) { panelHTML = h; $('panel').innerHTML = h; }
}
export function doAct(a) {
  if (!a) return;
  const [k, v] = a.split(':');
  if (k === 'train' && st.selBuilding) { const r = canTrain(st.selBuilding, v); if (r) { msg(r); sfx('error'); if (r === 'Ressources insuffisantes') flashLack(UNIT[v].cost); } else { train(st.selBuilding, v); sfx('click'); } }
  else if (k === 'tech' && st.selBuilding) { const r = canTech(st.selBuilding, v); if (r) { msg(r); sfx('error'); if (r === 'Ressources insuffisantes') flashLack(TECHS[v].cost); } else { research(st.selBuilding, v); sfx('click'); } }
  else if (k === 'age' && st.selBuilding) { const r = canAge(st.selBuilding); if (r) { msg(r); sfx('error'); if (r === 'Ressources insuffisantes') flashLack(AGES[teams[0].age + 1].cost); } else { ageUp(st.selBuilding); sfx('click'); } }
  else if (k === 'place') { const r = canBuild(v); if (r) { msg(r); sfx('error'); if (r === 'Ressources insuffisantes') flashLack(BUILD[v].cost); } else { buildSheet = false; startPlacing(v); } }
  else if (k === 'rotate') rotateGhost();
  else if (k === 'only') setSel(selUnits().filter(u => u.type === v));
  else if (k === 'stop') selUnits().forEach(u => { u.cmd = null; u.target = null; u.path = []; })
  else if (k === 'cancelq' && st.selBuilding) { const b = st.selBuilding, i = +v, q = b.queue[i]; if (q) { b.queue.splice(i, 1); refund(0, q.cost); if (i === 0 && b.queue.length) b.trainT = b.queue[0].time; sfx('click'); } }
  else if (k === 'cancelb' && st.selBuilding && !st.selBuilding.done) { refund(0, st.selBuilding.def.cost); kill(st.selBuilding, false); msg('Construction annulée, ressources remboursées'); }
  else if (k === 'rally' && st.selBuilding) { st.rallyMode = !st.rallyMode; if (st.rallyMode) msg(isTouch ? 'Touchez le point de ralliement (sol ou ressource)' : 'Cliquez le point de ralliement (ou clic droit)'); }
  else if (k === 'box') { boxMode = !boxMode; msg(boxMode ? 'Mode cadre : glissez pour sélectionner' : 'Mode cadre désactivé'); }
  else if (k === 'atk') { if (selUnits().length) { st.atkMode = !st.atkMode; if (st.atkMode) msg(isTouch ? "Touchez la destination de l'attaque" : "Cliquez la destination de l'attaque"); } else msg('Sélectionnez des unités'); }
  else if (k === 'army') setSel(units.filter(u => u.team === 0 && u.def.cls !== 'villager'));
  else if (k === 'home') { const h = hdvOf(0); if (h) { camTarget.copy(h.pos); updateCam(); } }
  else if (k === 'idle') selectIdle();
  else if (k === 'sheet') { stopPlacing(); buildSheet = true; }
  else if (k === 'sheetclose') buildSheet = false;
  else if (k === 'confirm') confirmPlace();
  else if (k === 'wallreset') { wallStart = null; pending = null; if (ghost) { ghost.scale.x = 1; } }
  else if (k === 'gatherauto') gatherAuto();
  else if (k === 'desel') { setSel([]); stopPlacing(); st.atkMode = false; st.rallyMode = false; buildSheet = false; }
  else if (extraActs[k]) extraActs[k](v);
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', (b.dataset.act === 'box' && boxMode) || (b.dataset.act === 'atk' && st.atkMode)));
  updateHUD();
}
export const extraActs = {};
export let idleIdx = 0;
export function selectIdle() {
  const idle = units.filter(u => u.team === 0 && u.def.cls === 'villager' && !u.cmd);
  if (!idle.length) return msg('Aucun villageois inactif');
  const u = idle[idleIdx++ % idle.length]; setSel([u]); camTarget.copy(u.pos); camTarget.z -= st.camDist * 0.1; updateCam();
}
$('panel').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));
$('tools').addEventListener('click', e => doAct(e.target.closest('button')?.dataset.act));

// ---- placement (rotation, murs tracés)
export let ghost, ghostRot = 0, wallStart = null;
export const ghostMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.45, depthWrite: false });
export function startPlacing(type) {
  stopPlacing(); placing = type; wallStart = null;
  if (BUILD[type].wall) ghost = new THREE.Mesh(Bx(1, 2.2, 0.6), ghostMat);
  else { ghost = buildingMesh(type, 0); ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } }); ghost.rotation.y = ghostRot; }
  ghost.position.set(camTarget.x, 0, camTarget.z); scene.add(ghost); sfx('click');
}
export function stopPlacing() { placing = null; wallStart = null; pending = null; if (ghost) scene.remove(ghost); ghost = null; }
export function rotateGhost() { ghostRot = (ghostRot + Math.PI / 2) % (Math.PI * 2); if (ghost && !BUILD[placing]?.wall) ghost.rotation.y = ghostRot; }
export function validAt(type, x, z) { const d = BUILD[type]; return d.wall ? wallFree(x, z) : free(x, z, d.radius, d.gate ? (o => o.def.wall && o.team === 0) : null, extOf(type, ghostRot)); }
export function updateGhost(x, y) { const p = groundAt(x, y); if (p) updateGhostAt(p); }
export function updateGhostAt(p) {
  if (!ghost) return;
  if (BUILD[placing].wall && wallStart) {
    const len = Math.max(1, d2(wallStart, p)); ghost.scale.x = len; ghost.position.set((wallStart.x + p.x) / 2, 0, (wallStart.z + p.z) / 2); ghost.position.y = 1.1;
    ghost.rotation.y = -Math.atan2(p.z - wallStart.z, p.x - wallStart.x); ghostMat.color.set(canPay(0, BUILD[placing].cost) ? 0x00ff00 : 0xff0000);
  } else { ghost.position.set(p.x, BUILD[placing].wall ? 1.1 : 0, p.z); ghostMat.color.set(validAt(placing, p.x, p.z) ? 0x00ff00 : 0xff0000); }
}
export function assignBuilders(list) {
  const v = selUnits().filter(u => u.def.cls === 'villager'); if (!list.length) return;
  v.forEach(u => cmdBuild(u, list.slice().sort((a, b) => d2(a.pos, u.pos) - d2(b.pos, u.pos))[0]));
}
export function confirmPlace() {
  if (!placing || !pending) return; const d = BUILD[placing];
  if (d.wall) { if (wallStart) finishWall(pending); return; }
  const b = placeBuilding(placing, 0, pending.x, pending.z, ghostRot);
  if (!b) { msg('Emplacement invalide ou ressources insuffisantes'); sfx('error'); flashLack(BUILD[placing]?.cost); return; }
  assignBuilders([b]); sfx('place'); stopPlacing();
}
export function gatherAuto() {
  const v = selUnits().filter(u => u.def.cls === 'villager'); if (!v.length) return;
  const c = v.reduce((a, u) => a.add(u.pos), new THREE.Vector3()).divideScalar(v.length);
  const low = RES.slice().sort((a, b) => teams[0].res[a] - teams[0].res[b]);
  let r = null; for (const t of low) { r = resources.filter(o => o.type === t && isExp(o.pos) && d2(o.pos, c) < 30).sort((a, b) => d2(a.pos, c) - d2(b.pos, c))[0]; if (r) break; }
  r = r || resources.filter(o => isExp(o.pos)).sort((a, b) => d2(a.pos, c) - d2(b.pos, c))[0];
  if (!r) return msg('Aucune ressource connue à proximité');
  v.forEach(u => cmdGather(u, r)); msg('Récolte : ' + RES_LABEL[r.type]); sfx('ok');
}
export function tryPlace(x, y, keep = false) {
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
  if (!b) { msg('Emplacement invalide ou ressources insuffisantes'); sfx('error'); flashLack(BUILD[placing]?.cost); return; }
  assignBuilders([b]); sfx('place');
  if (!(keep && !canBuild(placing))) stopPlacing();
  doAct('noop');
}
export function finishWall(p) {
  if (d2(wallStart, p) < 0.8) return;
  const segs = placeWall(placing, 0, wallStart, p);
  if (!segs.length) { msg('Impossible de placer le mur ici'); sfx('error'); }
  else { assignBuilders(segs); msg(`${segs.length} segment(s) de ${BUILD[placing].label.toLowerCase()} placés`); sfx('place'); }
  stopPlacing(); doAct('noop');
}

// ================= Minimap =================
export const mini = $('mini'), mctx = mini.getContext('2d'), MS = mini.width / SIZE;
export const fogCanvas = document.createElement('canvas');
 fogCanvas.width = fogCanvas.height = FN;
 export const fctx = fogCanvas.getContext('2d'), fimg = fctx.createImageData(FN, FN);
export function drawMini() {
  mctx.fillStyle = '#4f7d38'; mctx.fillRect(0, 0, mini.width, mini.height);
  const C = { bois: '#1f4a1c', pierre: '#9a9a9a', or: '#f0c030', nourriture: '#d04060' };
  for (const r of resources) if (r.mesh.visible) { mctx.fillStyle = C[r.type]; mctx.fillRect((r.pos.x + HALF) * MS - 1, (r.pos.z + HALF) * MS - 1, 2, 2); }
  for (const b of buildings) if (b.team === 0 || b.mesh.visible) { mctx.fillStyle = b.team ? '#ff4040' : '#4080ff'; const s = Math.max(2, b.radius * MS * 1.6); mctx.fillRect((b.pos.x + HALF) * MS - s / 2, (b.pos.z + HALF) * MS - s / 2, s, s); }
  for (const u of units) if (u.team === 0 || u.mesh.visible) { mctx.fillStyle = u.team ? '#ff8080' : (u.selected ? '#ffffff' : '#90c0ff'); mctx.fillRect((u.pos.x + HALF) * MS - 1.5, (u.pos.z + HALF) * MS - 1.5, 3, 3); }
  if (!NOFOG) { for (let k = 0; k < FN * FN; k++) fimg.data[k * 4 + 3] = visible[k] ? 0 : explored[k] ? 110 : 255; fctx.putImageData(fimg, 0, 0); mctx.drawImage(fogCanvas, 0, 0, mini.width, mini.height); }
  const pts = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight], [0, innerHeight]].map(([x, y]) => groundAt(x, y) || camTarget);
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.beginPath(); pts.forEach((p, i) => mctx[i ? 'lineTo' : 'moveTo']((p.x + HALF) * MS, (p.z + HALF) * MS)); mctx.closePath(); mctx.stroke();
}
export function miniMove(e) { const r = mini.getBoundingClientRect(); camTarget.x = (e.clientX - r.left) / r.width * SIZE - HALF; camTarget.z = (e.clientY - r.top) / r.height * SIZE - HALF - st.camDist * 0.3; updateCam(); }
export let miniDrag = false;
mini.addEventListener('pointerdown', e => { e.preventDefault(); miniDrag = true; try { mini.setPointerCapture(e.pointerId); } catch { } if (e.button === 2 && selUnits().length) { const r = mini.getBoundingClientRect(); formation(selUnits(), new THREE.Vector3((e.clientX - r.left) / r.width * SIZE - HALF, 0, (e.clientY - r.top) / r.height * SIZE - HALF), 'move'); miniDrag = false; } else miniMove(e); });
mini.addEventListener('pointermove', e => miniDrag && miniMove(e));
mini.addEventListener('pointerup', () => miniDrag = false);
mini.addEventListener('contextmenu', e => e.preventDefault());

// ================= Fin de partie =================
export function endGame(win, why = 'hdv') {
  if (gameOver) return; gameOver = true; sfx(win ? 'age' : 'horn');
  $('endTitle').textContent = win ? '🏆 Victoire !' : '💀 Défaite…';
  $('endSub').textContent = why === 'merveille' ? (win ? 'Votre merveille a tenu 5 minutes.' : 'La merveille ennemie a tenu 5 minutes.') : win ? "L'hôtel de ville ennemi est détruit." : 'Votre hôtel de ville a été détruit.';
  $('end').style.display = 'flex';
}
