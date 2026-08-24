// Découpe fleet-live.json (sortie de dump-fleet.mjs) en fleet/<REG>.json — À LANCER APRÈS CHAQUE DUMP.
import fs from 'node:fs';
const live = JSON.parse(fs.readFileSync('fleet-live.json', 'utf8'));
fs.mkdirSync('fleet', { recursive: true });
for (const f of fs.readdirSync('fleet')) fs.unlinkSync('fleet/' + f);
for (const a of live) fs.writeFileSync(`fleet/${a.registration}.json`, JSON.stringify(a, null, 1));
console.log('découpé :', live.map(a => `${a.registration}(${(a.updated_at || '?').slice(0, 16)})`).join(' '));
