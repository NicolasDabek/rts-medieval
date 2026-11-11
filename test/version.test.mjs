// Version : package.json, libellé du menu (index.html) et CHANGELOG.md doivent annoncer la même version
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url), read = f => readFileSync(new URL(f, root), 'utf8');
const v = JSON.parse(read('package.json')).version, errors = [];
if (!/^\d+\.\d+\.\d+$/.test(v)) errors.push(`package.json : version « ${v} » invalide`);
if (!read('index.html').includes(`<p id="ver" class="ver">v${v}</p>`)) errors.push(`index.html : libellé v${v} absent du menu`);
if (!new RegExp(`^## \\[?${v.replace(/\./g, '\\.')}\\]?`, 'm').test(read('CHANGELOG.md'))) errors.push(`CHANGELOG.md : section ${v} absente`);
// aucun chargement externe dans la page (pas de CDN)
for (const m of read('index.html').matchAll(/(?:src|href)=["'](https?:)?\/\/[^"']+/g)) errors.push(`index.html : ressource externe ${m[0]}`);
if (errors.length) { console.error('ÉCHEC :\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`OK : version ${v} (package.json, menu, CHANGELOG), aucune ressource externe`);
