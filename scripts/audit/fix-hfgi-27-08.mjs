// Réparation F-HFGI (27/08, sur ordre du pilote) — --apply pour écrire.
//
// 1. RETRAIT DE LA PLANCHE DU PIPER (point F-HFGI-18). L'unique abaque de la
//    fiche — « Distance atterrissage — roulage, Flaps LANDING » — est tracée
//    sur une planche dont le cartouche annonce « MASSE MAXIMALE 2325 lb
//    (1055 kg), VOLETS : 40°, VITESSE INDIQUÉE D'APPROCHE : 63 kt », c'est-à-
//    dire le Piper PA 28-161, alors que F-HFGI est un Robin DR401 (MTOW 1050,
//    MLW 1045, vapp 81). Ordre du pilote le 27/08 : « retire les éléments du
//    Piper présents dans le Robin ».
//    L'image reste dans le stockage (abaque-images/F-HFGI/…png) : on ne touche
//    pas au bucket, seul le modèle est retiré de la fiche.
//    ⚠️ Aucune certification d'absence n'est posée : la couverture
//    « atterrissage — roulage » devient MANQUANTE, et c'est voulu — elle sera
//    comblée par la planche du manuel DR401.
//
// 2. VENT DE TRAVERS (point F-HFGI-15). Réponse du pilote : « vent de travers
//    15 kt ». On l'ajoute dans windLimits.limits, à la forme utilisée par le
//    reste de la flotte ({type, saved, value}). L'entrée maxHeadwind 15 est
//    LAISSÉE en place : elle n'a pas été mise en cause par le pilote et le
//    code ne la lit nulle part.
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

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-HFGI&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-HFGI : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));
const chg = [];

// — 1. Retrait de l'abaque du Piper —
const modeles = d.performanceModels || [];
const PLANCHE_PIPER = 'abaque-model_1787308947922';
const cible = modeles.filter((m) => (m.data?.metadata?.workshop?.image?.url || '').includes(PLANCHE_PIPER));
if (cible.length === 0) {
  console.log('  ⓘ Aucun modèle tracé sur la planche du Piper — rien à retirer.');
} else {
  if (cible.length !== modeles.length) {
    console.error(`Garde-fou : ${cible.length} modèle(s) sur ${modeles.length} visés — vérification manuelle requise, abandon`);
    process.exit(1);
  }
  for (const m of cible) {
    chg.push(`abaque retirée : « ${m.name} » (${m.data?.metadata?.systemType}) — planche ${PLANCHE_PIPER}`);
  }
  d.performanceModels = modeles.filter((m) => !cible.includes(m));
}

// — 2. Vent de travers maximal démontré —
const w = d.windLimits;
if (!w || !Array.isArray(w.limits)) {
  console.error('Garde-fou : windLimits.limits absent — abandon');
  process.exit(1);
}
if (w.limits.some((l) => l.type === 'maxCrosswind')) {
  console.log('  ⓘ maxCrosswind déjà présent — laissé tel quel.');
} else {
  w.limits.push({ type: 'maxCrosswind', saved: true, value: 15 });
  chg.push('windLimits.limits : maxCrosswind = 15 kt ajouté (réponse pilote du 27/08)');
}

console.log(`\nF-HFGI (v${row.version}) — ${chg.length} changement(s) :`);
for (const c of chg) console.log('  •', c);
if (chg.length === 0) process.exit(0);

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-hfgi-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-HFGI.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-hfgi-${stamp}/F-HFGI.json`);
} else {
  console.log('(lecture seule — relancer avec --apply pour écrire)');
}
