// Purge de la catégorie utilitaire sur toute la flotte (27/08) — --apply.
//
// DÉCISION PILOTE, rappelée le 27/08 : « on a retiré la fonction qui me permet
// de configurer une catégorie utilitaire car nous avons décidé de ne pas les
// utiliser ». L'écran de configuration n'existe plus : le bloc utilityCategory
// ne peut donc PLUS être corrigé à la main, seulement par script.
//
// Précédent : le 19/08, quatre fiches avaient déjà été désactivées par script
// pour la même raison (commentaire de Step6WeightBalance.jsx l.653-658 —
// « le sélecteur promettait un domaine restreint inexistant »). F-BXQT est
// repassé à enabled = true depuis : le bloc survit d'une sauvegarde à l'autre
// dès qu'une copie locale antérieure est réenregistrée. D'où la purge complète,
// à doubler du filet côté code pour qu'elle tienne.
//
// Effet à l'écran une fois le bloc retiré (Step6WeightBalance.jsx l.659-668) :
// le sélecteur N/U disparaît et la page affiche « Mode utilitaire non
// disponible pour cet avion — le devis s'établit en catégorie Normale ».
// C'est le comportement voulu : l'absence se lit comme un fait.
//
// ⚠️ Ce script retire le bloc MÊME quand enabled vaut true — c'est le cas de
// F-BXQT, où la catégorie était active sans forwardCG ni aftMaxCG : choisir
// « U » substituait une masse maximale identique à la normale puis sautait les
// limites de centrage, donc ne restreignait rien tout en s'annonçant appliquée.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Config Supabase absente (.env)'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?select=id,registration,version,aircraft_data&order=registration.asc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows)) { console.error('Lecture impossible — abandon'); process.exit(1); }

let total = 0;
for (const row of rows) {
  const u = row.aircraft_data?.utilityCategory;
  if (!u) continue;
  // Garde-fou : on refuse de purger une catégorie RÉELLEMENT renseignée, avec
  // ses limites de centrage — celle-là restreint vraiment quelque chose et
  // mérite une décision explicite, pas une purge de masse.
  if (u.forwardCG !== undefined && u.aftMaxCG !== undefined) {
    console.log(`  ⚠ ${row.registration} : catégorie utilitaire COMPLÈTE (forwardCG ${u.forwardCG}, aftMaxCG ${u.aftMaxCG}) — NON purgée, décision manuelle requise`);
    continue;
  }
  total++;
  console.log(`${row.registration} (v${row.version}) — utilityCategory ${JSON.stringify(u)} retiré${u.enabled === true ? '  ⚠ elle était ACTIVE' : ''}`);
  if (!APPLY) continue;
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  delete d.utilityCategory;
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `purge-utilitycategory-flotte-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, `${row.registration}.json`), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`   ❌ PATCH ${r.status} — ${(await r.text()).slice(0, 160)}`); continue; }
  console.log(`   ✅ écrit (v${row.version + 1})`);
}

console.log(total === 0
  ? 'Aucune catégorie utilitaire en base — rien à purger.'
  : (APPLY ? `\n${total} fiche(s) purgée(s) — sauvegardes : backups/purge-utilitycategory-flotte-${stamp}/` : '\n(lecture seule — relancer avec --apply pour écrire)'));
