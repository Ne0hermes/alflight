#!/usr/bin/env node
/**
 * ============================================================================
 *  Validation / réconciliation du GeoJSON aérodromes généré par l'ETL
 * ============================================================================
 *  Garde-fou ANTI-ALTÉRATION : compare le GeoJSON dérivé (sortie ETL) à des
 *  invariants + à la source XML, et FAIT ÉCHOUER le build si ça dérive.
 *  Aurait attrapé automatiquement les régressions corrigées :
 *    - noms tous = "FRANCE" (extraction OrgUid)        → check "noms génériques"
 *    - fréquences toutes vides (parseFrequencies stub)  → check "fréquences"
 *
 *  Usage :  node scripts/validate-geojson.mjs   (ou: npm run sia:validate)
 *  Pipeline : npm run sia:etl && npm run sia:validate && npm run sia:sync
 *  Exit code ≠ 0 si au moins un contrôle échoue (casse le build/CI).
 * ============================================================================
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEOJSON = path.join(ROOT, 'src', 'data', 'derived', 'geojson', 'aerodromes.geojson');
const INPUT_DIR = path.join(ROOT, 'public', 'data');

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok, detail });

if (!existsSync(GEOJSON)) {
  console.error(`✖ GeoJSON introuvable : ${GEOJSON}\n  → Lance d'abord "npm run sia:etl".`);
  process.exit(1);
}

const fc = JSON.parse(readFileSync(GEOJSON, 'utf8'));
const features = fc.features || [];
const props = features.map((f) => f.properties || {});

// ── 1. Nombre d'aérodromes (plancher + réconciliation avec la source XML) ──
check('Nombre d’aérodromes ≥ 800', features.length >= 800, `${features.length} aérodromes`);
try {
  const aixm = readdirSync(INPUT_DIR).find((f) => f.startsWith('AIXM4.5_') && f.endsWith('.xml'));
  if (aixm) {
    const xml = readFileSync(path.join(INPUT_DIR, aixm), 'utf8');
    const ahpCount = (xml.match(/<Ahp>/g) || []).length;
    const ratio = ahpCount ? features.length / ahpCount : 0;
    check('Réconciliation source XML (≥ 90% des <Ahp>)', ratio >= 0.9, `GeoJSON ${features.length} / XML <Ahp> ${ahpCount} (${Math.round(ratio * 100)}%)`);
  }
} catch { /* réconciliation best-effort */ }

// ── 2. Aucun nom générique / vide (garde le bug "FRANCE") ──
const GENERIC = /^(FRANCE|POLYNESIE FRANCAISE|NOUVELLE CALEDONIE)$/i;
const badNames = props.filter((p) => !p.name || GENERIC.test(p.name) || p.name === (p.id || '').replace(/^AD_/, ''));
check('0 nom générique/vide (FRANCE…)', badNames.length === 0, `${badNames.length} suspects` + (badNames[0] ? ` (ex. ${badNames[0].id}="${badNames[0].name}")` : ''));

// ── 3. Fréquences présentes (garde le bug parseFrequencies vide) ──
const withFreq = props.filter((p) => Array.isArray(p.frequencies) && p.frequencies.length > 0).length;
check('≥ 300 aérodromes avec fréquences', withFreq >= 300, `${withFreq} aérodromes`);
const zeroFreq = props.flatMap((p) => p.frequencies || []).filter((f) => !(parseFloat(f.frequency) > 0)).length;
check('0 fréquence invalide (≤ 0)', zeroFreq === 0, `${zeroFreq} fréquences à 0`);

// ── 4. Cycle AIRAC valide ──
const airac = props.find((p) => p.airac)?.airac;
check('Cycle AIRAC valide (YYYY-MM-DD)', !!airac && /^\d{4}-\d{2}-\d{2}$/.test(airac), `airac=${airac}`);

// ── 5. Coordonnées valides (ni manquantes ni 0,0) ──
const badCoords = features.filter((f) => {
  const c = f.geometry?.coordinates;
  const [lon, lat] = Array.isArray(c) ? c : [f.properties?.longitude, f.properties?.latitude];
  return !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180;
});
check('0 coordonnée invalide', badCoords.length === 0, `${badCoords.length} suspects`);

// ── 6. Spot-checks d'invariants connus ──
const byIcao = Object.fromEntries(props.map((p) => [(p.id || '').replace(/^AD_/, ''), (p.name || '').toUpperCase()]));
const spots = [['LFPG', 'GAULLE'], ['LFML', 'MARSEILLE'], ['LFBO', 'TOULOUSE'], ['LFLL', 'LYON']];
const spotFails = spots.filter(([icao, token]) => !byIcao[icao] || !byIcao[icao].includes(token));
check('Spot-checks (LFPG/LFML/LFBO/LFLL)', spotFails.length === 0, spotFails.map(([i]) => i).join(', ') || 'OK');

// ── Rapport ──
console.log('\n🔎 Validation GeoJSON aérodromes :\n');
for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n✖ ${failed.length} contrôle(s) en échec — le GeoJSON dérive de la source. NE PAS publier.\n`);
  process.exit(1);
}
console.log(`\n✅ ${results.length} contrôles OK — GeoJSON conforme à la source.\n`);
