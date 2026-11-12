// Banc d'essai IA en partie réelle : lance tools/ai-partie.html dans Chromium pour 3 scénarios × N graines et résume.
// node tools/ai-partie.mjs [graines=10] [until=600] [diff=normal] [première graine=1] [--save]
// Playwright n'est PAS une dépendance du projet : utilisez celui déjà installé sur la machine
// (PLAYWRIGHT=/chemin/vers/node_modules/playwright, ou `npx -p playwright node tools/ai-partie.mjs`).
// --save écrit le résumé dans tools/ai-partie.json (affiché par npm test, qui ne lance pas de navigateur).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), SAVE = process.argv.includes('--save');
const [nSeeds = '10', until = '600', diff = 'normal', first = '1'] = args, SEEDS = Array.from({ length: +nSeeds }, (_, i) => i + +first);
const SCN = ['tirailleur', 'archer', 'controle'];
let pw; try { pw = process.env.PLAYWRIGHT ? createRequire(import.meta.url)(process.env.PLAYWRIGHT) : await import('playwright'); }
catch { console.error('Playwright introuvable : PLAYWRIGHT=/chemin/node_modules/playwright node tools/ai-partie.mjs'); process.exit(2); }
const chromium = pw.chromium || pw.default.chromium;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = createServer(async (req, res) => { try { const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, ''); if (p.startsWith('..')) throw 0;
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(await readFile(join(ROOT, p || 'index.html'))); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const jobs = SCN.flatMap(scn => SEEDS.map(seed => ({ scn, seed }))), results = [], errors = [];
async function worker() { for (let j; (j = jobs.shift());) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${j.scn}/${j.seed}: ${e}`));
  page.on('request', r => { if (!r.url().startsWith(base) && !/^(data|blob):/.test(r.url())) errors.push(`${j.scn}/${j.seed}: requête externe ${r.url()}`); });
  await page.goto(`${base}/tools/ai-partie.html?scn=${j.scn}&seed=${j.seed}&until=${until}&diff=${diff}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 0, polling: 500 });
  results.push(await page.evaluate(() => window.__result)); await ctx.close(); process.stderr.write('.');
} }
await Promise.all(Array.from({ length: 4 }, worker)); await browser.close(); srv.close(); process.stderr.write('\n');
// résumé
const at = (r, t) => r.snaps.find(s => s.t === t), med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const COUNTER = { tirailleur: ['cavalier'], archer: ['cavalier', 'tirailleur'], controle: [] };
const summary = {};
for (const scn of SCN) { const R = results.filter(r => r.scn === scn).sort((a, b) => a.seed - b.seed);
  const rows = R.map(r => { const s6 = at(r, 600) || r.snaps.at(-1), s8 = at(r, 480), army = Object.values(s6.army).reduce((a, b) => a + b, 0), ctr = COUNTER[scn].reduce((a, k) => a + (s6.army[k] || 0), 0);
    return { seed: r.seed, ecurie: r.firstDone.ecurie ?? null, forge: r.firstDone.forge ?? null, caserne: r.firstDone.caserne ?? null, archerie: r.firstDone.archerie ?? null, age1: r.ageT[1] ?? null,
      army600: s6.army, armyN: army, cav600: s6.army.cavalier || 0, counterShare: army ? +(ctr / army).toFixed(2) : 0, trained: s6.trained,
      farms480: s8?.farms ?? null, vills480: s8?.vills ?? null, farms600: s6.farms, vills600: s6.vills, foodLowMax: r.foodLowMax, res600: s6.res, farmFail: s6.farmFail, over: r.over }; });
  const n = rows.length, cnt = f => rows.filter(f).length;
  summary[scn] = { n, rows,
    ecurieBy360: cnt(r => r.ecurie != null && r.ecurie <= 360), ecurieForgeBy600: cnt(r => r.ecurie != null && r.ecurie <= 600 && r.forge != null && r.forge <= 600),
    cav6and30: cnt(r => r.cav600 >= 6 && r.counterShare >= 0.3),
    farmsOk: cnt(r => r.farms480 >= Math.ceil(0.4 * r.vills480) && r.farms600 >= Math.ceil(0.4 * r.vills600)), foodOk: cnt(r => r.foodLowMax <= 90),
    med: { ecurie: med(rows.map(r => r.ecurie)), forge: med(rows.map(r => r.forge)), cav600: med(rows.map(r => r.cav600)), counterShare: med(rows.map(r => r.counterShare)), armyN: med(rows.map(r => r.armyN)), foodLowMax: med(rows.map(r => r.foodLowMax)),
      nourriture: med(rows.map(r => r.res600.nourriture)), bois: med(rows.map(r => r.res600.bois)), or: med(rows.map(r => r.res600.or)) } };
}
const meta = { date: new Date().toISOString(), commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(), seeds: SEEDS.length, until: +until, diff, errors };
for (const [scn, s] of Object.entries(summary)) {
  console.log(`\n== ${scn} (${s.n} graines, ${diff}, ${until} s)`);
  console.log('graine | écurie | forge | cav@600 | part contre | armée | fermes/vill 480 | 600 | nourr<50 max | nourr/bois/or @600 | échecs ferme');
  for (const r of s.rows) console.log([r.seed, r.ecurie ?? '—', r.forge ?? '—', r.cav600, Math.round(r.counterShare * 100) + '%', r.armyN, `${r.farms480}/${r.vills480}`, `${r.farms600}/${r.vills600}`, r.foodLowMax + ' s', `${r.res600.nourriture}/${r.res600.bois}/${r.res600.or}`, r.farmFail].join(' | '));
  console.log(`écurie ≤ 360 s : ${s.ecurieBy360}/${s.n} · écurie et forge ≤ 600 s : ${s.ecurieForgeBy600}/${s.n} · cav ≥ 6 et ≥ 30 % : ${s.cav6and30}/${s.n} · fermes ≥ 40 % vill. (480 et 600) : ${s.farmsOk}/${s.n} · nourriture < 50 ≤ 90 s : ${s.foodOk}/${s.n}`);
}
if (errors.length) console.log('\nERREURS :\n  ' + errors.join('\n  '));
if (SAVE) { await writeFile(join(ROOT, 'tools/ai-partie.json'), JSON.stringify({ meta, summary }, null, 1) + '\n'); console.log('\nrésumé écrit dans tools/ai-partie.json'); }
