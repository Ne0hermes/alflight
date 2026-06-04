#!/usr/bin/env node
/**
 * ============================================================================
 *  Publication des couches GeoJSON : src/data/derived/geojson → public/data/geojson
 * ============================================================================
 *  L'ETL (scripts/sia_etl.ts) écrit ses sorties dans src/data/derived/geojson/.
 *  Mais l'app lit les couches depuis public/data/geojson/ (GeoJSONDataService,
 *  basePath '/data/geojson/'). Ce script copie les .geojson générés vers
 *  l'emplacement servi à l'app — l'étape "publish" du pipeline.
 *
 *  Usage : node scripts/sync-geojson.mjs   (ou: npm run sia:sync)
 *  Pipeline complet : npm run sia:etl && npm run sia:sync
 * ============================================================================
 */
import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'data', 'derived', 'geojson');
const DEST = path.join(ROOT, 'public', 'data', 'geojson');

if (!existsSync(SRC)) {
  console.error(`✖ Source introuvable : ${SRC}\n  → Lance d'abord "npm run sia:etl".`);
  process.exit(1);
}
if (!existsSync(DEST)) mkdirSync(DEST, { recursive: true });

// Couches GeoJSON + side-cars JSON réellement consommés par l'app (détail VAC).
// (On ne publie PAS tous les .json dérivés — ats_routes, organizations… sont inutiles
//  côté app et alourdiraient le precache PWA.)
const JSON_SIDECARS = ['aerodrome_services.json'];
// Couches générées par l'ETL mais NON consommées par l'app → non publiées (precache lean,
// cf. #18). À retirer de cette liste le jour où une feature les consomme.
const UNUSED_LAYERS = ['atc_units.geojson', 'ats_services.geojson'];
const files = readdirSync(SRC).filter(
  (f) =>
    (f.endsWith('.geojson') || JSON_SIDECARS.includes(f)) &&
    !UNUSED_LAYERS.includes(f)
);
if (!files.length) {
  console.log('Aucun fichier à publier.');
  process.exit(0);
}

console.log(`📤 Publication : ${path.relative(ROOT, SRC)} → ${path.relative(ROOT, DEST)}`);
for (const f of files) {
  copyFileSync(path.join(SRC, f), path.join(DEST, f));
  const kb = Math.round(statSync(path.join(DEST, f)).size / 1024);
  console.log(`   ✓ ${f} (${kb} Ko)`);
}
console.log(`✅ ${files.length} couche(s) publiée(s) vers l'app.`);
