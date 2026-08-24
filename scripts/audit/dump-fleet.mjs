// Extraction de la base d'avions pour audit — LECTURE SEULE.
// Les clés restent dans .env : rien n'est affiché, ni journalisé.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const VIA = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon';
if (!URL_ || !KEY) { console.error('Config Supabase absente'); process.exit(1); }

const OUT = process.argv[2] || 'fleet-live.json';

async function get(qs) {
  const r = await fetch(`${URL_}/rest/v1/${qs}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

console.log(`accès via : ${VIA}`);
const rows = await get('community_presets?select=*&order=registration.asc');
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2), 'utf8');
console.log(`avions=${rows.length}  fichier=${Math.round(fs.statSync(OUT).size / 1024)} ko`);
for (const p of rows) {
  const d = p.aircraft_data || {};
  console.log([
    (p.registration || '?').padEnd(9),
    String(p.model || d.model || '?').padEnd(16),
    String(p.status || '?').padEnd(8),
    'v' + (p.version ?? '?'),
    p.has_manex ? 'manex' : '—',
    (p.updated_at || p.created_at || '').slice(0, 10),
    `${Math.round(JSON.stringify(d).length / 1024)} ko`,
  ].join(' | '));
}
