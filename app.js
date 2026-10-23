import { boot, game, setSfx, setUnlock, extraActs } from './main.js';
import * as audio from './audio.js';
import { serialize, loadInto, KEY } from './save.js';

setSfx(audio.play); setUnlock(audio.unlock);
const $ = id => document.getElementById(id);
const saved = () => localStorage.getItem(KEY);

// boutons du HUD : son, sauvegarde, chargement
$('extra').innerHTML = '<button data-act="mute" id="muteBtn" title="Son" aria-label="Son">🔊</button><button data-act="save" title="Sauvegarder" aria-label="Sauvegarder">💾</button><button data-act="load" title="Charger" aria-label="Charger">📂</button>';
const muteIcon = () => $('muteBtn').textContent = audio.isMuted() ? '🔇' : '🔊'; muteIcon();
$('extra').addEventListener('click', e => { const a = e.target.closest('button')?.dataset.act; if (a) game.doAct(a); });
extraActs.mute = () => { audio.unlock(); const m = audio.toggleMute(); muteIcon(); game.msg(m ? 'Son coupé' : 'Son activé'); };
extraActs.save = () => {
  if (game.over) return game.msg('Partie terminée'); try { localStorage.setItem(KEY, serialize(game)); game.msg('💾 Partie sauvegardée'); } catch (e) { game.msg('Échec de la sauvegarde'); }
};
extraActs.load = () => { if (!saved()) return game.msg('Aucune sauvegarde'); location.href = location.pathname + '?load=1'; };

// sauvegarde automatique toutes les 60 s de partie active
setInterval(() => { if (game.started && !game.over && !document.hidden) { try { localStorage.setItem(KEY, serialize(game)); } catch (e) { } } }, 60000);
let loaded = false;
if (new URLSearchParams(location.search).has('load') && saved()) {
  try { loadInto(game, JSON.parse(saved())); loaded = true; } catch (e) { console.warn('Sauvegarde illisible', e); }
}
if (loaded) { boot(true); game.msg('📂 Partie chargée', 3000); history.replaceState(null, '', location.pathname); }
else {
  if (new URLSearchParams(location.search).has('load')) history.replaceState(null, '', location.pathname);
  boot();
  if (saved()) { const b = $('loadBtn'); b.style.display = ''; b.onclick = () => extraActs.load(); }
}

// aide : bouton « ? » ouvrant un panneau (remplace la bande de raccourcis)
const extra = $('extra'); const hb = document.createElement('button'); hb.dataset.act = 'help'; hb.id = 'helpBtn'; hb.textContent = '?'; hb.title = 'Aide'; hb.setAttribute('aria-label', 'Aide'); extra.prepend(hb);
const helpBox = $('helpBox');
const openHelp = () => { helpBox.classList.add('on'); helpBox.querySelector('.xbtn').focus(); };
const closeHelp = () => helpBox.classList.remove('on');
extraActs.help = openHelp;
helpBox.addEventListener('click', e => { if (e.target === helpBox || e.target.closest('[data-close]')) closeHelp(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { closeHelp(); } if (e.key === '?' || (e.key === 'F1')) { e.preventDefault(); openHelp(); } });
['pointerdown', 'touchstart', 'wheel'].forEach(t => helpBox.addEventListener(t, e => e.stopPropagation()));

// tutoriel court après le choix de la difficulté (passable, mémorisé, relançable depuis l'aide)
const TUTO_KEY = 'rts-medieval-tuto-vu', tuto = $('tuto'), touch = matchMedia('(pointer: coarse)').matches;
const mine = () => game.units.filter(u => u.team === 0);
const STEPS = [
  { t: '1/4 · Sélectionner', d: touch ? 'Touchez un villageois bleu (ou utilisez ▭ Cadre pour en prendre plusieurs).' : 'Cliquez sur un villageois bleu, ou glissez un cadre autour de plusieurs.', ok: () => mine().some(u => u.selected) },
  { t: '2/4 · Récolter', d: touch ? 'Villageois sélectionné : touchez un arbre, des baies ou une mine (ou « 🪓 Récolter »).' : 'Clic droit sur un arbre, des baies ou une mine pour récolter.', ok: () => mine().some(u => u.cmd?.type === 'gather') },
  { t: '3/4 · Construire', d: touch ? 'Touchez « 🏠 Construire », choisissez une Maison, placez-la puis ✔.' : 'Choisissez un bâtiment dans le panneau (Maison : +5 population) puis cliquez sur la carte.', ok: () => game.buildings.some(b => b.team === 0 && b.type !== 'hdv') },
  { t: '4/4 · Produire', d: "Sélectionnez l'hôtel de ville et entraînez un villageois. Plus de villageois = plus de ressources !", ok: () => game.buildings.some(b => b.team === 0 && b.queue?.length) || mine().length > 3 },
];
let step = -1, tutoIv = null;
function showStep() {
  if (step >= STEPS.length) return endTuto(true); const s = STEPS[step];
  tuto.innerHTML = `<b>🎓 ${s.t}</b><div>${s.d}</div><div class="row2"><span class="st" style="margin-right:auto;align-self:center">Étape faite = suite automatique</span><button data-t="skip">Passer</button><button data-t="next">Suivant</button></div>`;
  tuto.classList.add('on');
}
function endTuto(done) { tuto.classList.remove('on'); clearInterval(tutoIv); tutoIv = null; step = -1; localStorage.setItem(TUTO_KEY, '1'); if (done) game.msg('🎓 Tutoriel terminé — bonne partie !', 3000); }
function startTuto() { closeHelp(); step = 0; showStep(); clearInterval(tutoIv); tutoIv = setInterval(() => { if (step >= 0 && STEPS[step]?.ok()) { step++; showStep(); } }, 400); }
tuto.addEventListener('click', e => { const t = e.target.closest('button')?.dataset.t; if (t === 'skip') endTuto(false); if (t === 'next') { step++; showStep(); } });
['pointerdown', 'touchstart'].forEach(t => tuto.addEventListener(t, e => e.stopPropagation()));
$('tutoAgain').addEventListener('click', startTuto);
game.startTuto = startTuto;
if (!localStorage.getItem(TUTO_KEY) && !loaded) { const iv = setInterval(() => { if (game.started) { clearInterval(iv); if (!new URLSearchParams(location.search).has('diff')) startTuto(); } }, 300); }
