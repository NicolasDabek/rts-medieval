// ?seed=N : Math.random déterministe (mulberry32) pour rejouer exactement une partie — banc d'essai tools/ai-partie.html
// Importé en premier par app.js, avant la génération de la carte. Sans ?seed, rien ne change.
const s = new URLSearchParams(location.search).get('seed');
if (s !== null && s !== '' && Number.isFinite(+s)) {
  let a = (+s >>> 0) || 1;
  Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
