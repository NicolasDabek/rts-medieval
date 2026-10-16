import { boot, game, setSfx, setUnlock, extraActs } from './main.js';
import * as audio from './audio.js';
import { serialize, loadInto, KEY } from './save.js';

setSfx(audio.play); setUnlock(audio.unlock);
const $ = id => document.getElementById(id);
const saved = () => localStorage.getItem(KEY);

// boutons du HUD : son, sauvegarde, chargement
$('extra').innerHTML = '<button data-act="mute" id="muteBtn" title="Son">🔊</button><button data-act="save" title="Sauvegarder">💾</button><button data-act="load" title="Charger">📂</button>';
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
