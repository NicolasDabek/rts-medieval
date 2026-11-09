// Vagues d'attaque de l'IA (pur, sans three.js) : partagé par le jeu (ai.js, units.js) et l'outil de duel (tools/duel.mjs)
// Passe GD 13 : une armée mixte (ex. épéistes + cavaliers) arrivait désynchronisée — les cavaliers, plus rapides, se battaient
// seuls puis les épéistes — et perdait 0 % du temps contre des tirailleurs. Une vague garde donc ses membres groupés :
// un membre trop en avance sur le plus en retard de la vague l'attend (marche ET poursuite : même règle partout).
// Appartenance explicite (u.wave), jamais réaffectée ; un membre est libéré à sa mort, si son ordre change (annulation)
// ou à l'expiration de la vague (timeout).
// leash 2 : mesuré dans tools/duel.mjs (1 → 96–100 %, 2 → 93–99 %, 3 → 68–94 %, 5 → 11–53 % pour épéistes + cavaliers
// contre tirailleurs) ; untilContact : la cohésion s'arrête au premier contact (un ennemi à portée + contactMargin),
// sinon les cavaliers retenus par les tirailleurs perdent contre les archers (100 → 58–70 %)
export const WAVE = { leash: 2, timeout: 90, untilContact: true, contactMargin: 3 };
let nextId = 1;
// members : unités ; cmd : ordre attackMove de la vague (référence, pour détecter une annulation) ; now : temps de jeu (s)
export function makeWave(members, now, cmdOf = null, opts = {}) {
  const w = { id: nextId++, members: new Set(members), t0: now, leash: opts.leash ?? WAVE.leash, timeout: opts.timeout ?? WAVE.timeout, untilContact: opts.untilContact ?? WAVE.untilContact, contact: false, cmds: new Map() };
  for (const u of members) { u.wave = w; if (cmdOf) w.cmds.set(u, cmdOf(u)); }
  return w;
}
export function release(u) { const w = u.wave; if (!w) return; w.members.delete(u); w.cmds.delete(u); u.wave = null; }
export function dissolve(w) { for (const u of [...w.members]) release(u); }
// libère les morts, les membres dont l'ordre a changé, et tout le monde à l'expiration ; renvoie true si la vague est vivante
export function pruneWave(w, now, cmdOf = null) {
  if (now - w.t0 > w.timeout) { dissolve(w); return false; }
  for (const u of [...w.members]) if (u.dead || u.hp <= 0 || (cmdOf && w.cmds.has(u) && cmdOf(u) !== w.cmds.get(u))) release(u);
  return w.members.size > 0;
}
// facteur de vitesse (0 ou 1) d'un membre ; remaining(u) = distance qui lui reste jusqu'à la cible de la vague
// (plus petit = plus en avance). Un membre plus de `leash` devant le plus en retard l'attend.
// mode « contact » (opts.untilContact) : la cohésion s'arrête dès qu'un membre est au contact (engaged(u) vrai)
export function waveSpeed(u, remaining, engaged = null) {
  const w = u.wave; if (!w || w.members.size < 2 || w.contact) return 1;
  if (w.untilContact && engaged) for (const o of w.members) if (!(o.dead || o.hp <= 0) && engaged(o)) { w.contact = true; return 1; }
  let rear = -Infinity; for (const o of w.members) if (!(o.dead || o.hp <= 0)) rear = Math.max(rear, remaining(o));
  return rear - remaining(u) > w.leash ? 0 : 1;
}
