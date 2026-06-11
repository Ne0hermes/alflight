// ═══════════════════════════════════════════════════════════════════════════
// C5 (PLAN_CORRECTIFS_UNITES.md) — APPLICATION de la migration des unités M&C.
//
// Décisions pilote du 2026-06-10 (revue du dry-run units-migration-dry-run.js) :
//   1. Les valeurs de bras AMBIGUËS (F-HFGI sièges 403.7 / réservoir 337,
//      F-GOVE sièges 394, + enveloppe F-HFGI) sont des MILLIMÈTRES → ÷1000.
//   2. Les MASSES des 6 avions sont en KG → aucune modification numérique,
//      marquées vérifiées.
//   3. Application autorisée, avec SAUVEGARDE COMPLÈTE avant toute écriture.
//
// Effets :
//   - Tous les bras / CG d'enveloppe / corde MAC / LEMAC → MÈTRES.
//   - Tous les moments → kg·m (seuil magnitude 50 000, cf. armUnits.momentToKgM).
//   - _metadata → { version:'3.0.0', unitsVerified:true, units.armLength:'m',
//                   migration:'C5-2026-06-10' }.
//   - Sauvegarde : scripts/backup-community-presets-<timestamp>.json
//   - Journal des changements : scripts/units-migration-journal-<timestamp>.json
//
// Usage : node scripts/units-migration-apply.js
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

// ─── Classification (identique au dry-run) ──────────────────────────────────
// 0,15 et non 0,20 : cas réel F-HFGI forward[1].cg = 0,19 m (datum bord d'attaque).
const ARM_MIN_M = 0.15, ARM_MAX_M = 8;
const ARM_FACTORS = { m: 1, mm: 1 / 1000, cm: 1 / 100, in: 1 / 39.3701 };

function armCandidates(n) {
  const c = [];
  for (const [unit, f] of Object.entries(ARM_FACTORS)) {
    const m = Math.abs(n) * f;
    if (m >= ARM_MIN_M && m <= ARM_MAX_M) c.push(unit);
  }
  return c;
}

// Convertit un bras vers les MÈTRES selon la règle :
//   - 1 seul candidat → ce candidat ;
//   - plusieurs candidats → **mm** (décision pilote 2026-06-10) ;
//   - 0 candidat → null (NON RÉSOLU, valeur laissée telle quelle + flag).
function armToMetersRuled(value, journal, path) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return { value, changed: false };
  const c = armCandidates(n);
  let unit = null;
  if (c.length === 1) unit = c[0];
  else if (c.length > 1) unit = 'mm'; // règle pilote (ambigus = mm résiduels du bug)
  else {
    journal.unresolved.push({ path, value: n });
    return { value, changed: false };
  }
  const out = Math.round(n * ARM_FACTORS[unit] * 100000) / 100000; // m, 5 déc.
  if (unit === 'm' && out === n && typeof value === 'number') return { value, changed: false };
  journal.changes.push({ path, before: value, after: out, interpretedAs: unit });
  return { value: out, changed: true };
}

// Moment → kg·m : >50 000 = kg·mm (÷1000), sinon déjà kg·m.
function momentRuled(value, journal, path) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return { value, changed: false };
  if (Math.abs(n) <= 50000) {
    if (typeof value !== 'number') { journal.changes.push({ path, before: value, after: n, interpretedAs: 'kg·m (typage)' }); return { value: n, changed: true }; }
    return { value, changed: false };
  }
  const out = Math.round((n / 1000) * 10000) / 10000;
  journal.changes.push({ path, before: value, after: out, interpretedAs: 'kg·mm' });
  return { value: out, changed: true };
}

// ─── Transformation d'un avion (copie profonde) ────────────────────────────
function migrateAircraft(aircraftData, journal) {
  const a = JSON.parse(JSON.stringify(aircraftData || {}));

  const fixField = (obj, key, fn, path) => {
    if (!obj || obj[key] === undefined || obj[key] === null || obj[key] === '') return;
    const r = fn(obj[key], journal, path);
    obj[key] = r.value;
  };

  // Bras — toutes les formes du modèle
  for (const k of ['emptyWeightArm', 'fuelArm', 'frontLeftSeatArm', 'frontRightSeatArm', 'rearLeftSeatArm', 'rearRightSeatArm', 'baggageArm', 'auxiliaryArm']) {
    fixField(a.weightBalance, k, armToMetersRuled, `weightBalance.${k}`);
  }
  for (const k of Object.keys(a.arms || {})) fixField(a.arms, k, armToMetersRuled, `arms.${k}`);
  for (const k of Object.keys(a.armLengths || {})) fixField(a.armLengths, k, armToMetersRuled, `armLengths.${k}`);
  (a.additionalFuelTanks || []).forEach((t, i) => {
    fixField(t, 'arm', armToMetersRuled, `tanks[${i}].arm`);
    fixField(t, 'momentAtFull', momentRuled, `tanks[${i}].momentAtFull`);
  });
  (a.baggageCompartments || []).forEach((c, i) => {
    fixField(c, 'arm', armToMetersRuled, `baggage[${i}].arm`);
    fixField(c, 'momentMax', momentRuled, `baggage[${i}].momentMax`);
  });
  (a.additionalSeats || []).forEach((s, i) => fixField(s, 'arm', armToMetersRuled, `seats[${i}].arm`));

  // Moments « plats »
  for (const k of Object.keys(a.moments || {})) fixField(a.moments, k, momentRuled, `moments.${k}`);

  // Limites / enveloppe CG
  for (const k of Object.keys(a.cgLimits || {})) {
    if (k === 'forwardVariable') continue;
    fixField(a.cgLimits, k, armToMetersRuled, `cgLimits.${k}`);
  }
  if (a.cgEnvelope) {
    const env = a.cgEnvelope;
    for (const k of ['aftCG', 'aftMinCG', 'aftMaxCG', 'forwardCG', 'macLength', 'lemac']) {
      fixField(env, k, armToMetersRuled, `cgEnvelope.${k}`);
    }
    for (const k of ['aftMinMoment', 'aftMaxMoment']) fixField(env, k, momentRuled, `cgEnvelope.${k}`);
    (env.forwardPoints || []).forEach((p, i) => {
      fixField(p, 'cg', armToMetersRuled, `cgEnvelope.forward[${i}].cg`);
      fixField(p, 'moment', momentRuled, `cgEnvelope.forward[${i}].moment`);
    });
    (env.intermediatePoints || []).forEach((p, i) => {
      fixField(p, 'cg', armToMetersRuled, `cgEnvelope.inter[${i}].cg`);
      fixField(p, 'moment', momentRuled, `cgEnvelope.inter[${i}].moment`);
    });
  }

  // MASSES : décision pilote = kg, AUCUNE modification numérique.

  // Métadonnée VRAIE (C3.2) + traçabilité migration
  a._metadata = {
    ...(a._metadata || {}),
    version: '3.0.0',
    unitsVerified: true,
    units: {
      fuel: 'ltr', fuelConsumption: 'lph', weight: 'kg',
      armLength: 'm', speed: 'kt', altitude: 'ft', distance: 'nm'
    },
    migration: 'C5-2026-06-10',
    migratedAt: new Date().toISOString()
  };

  return a;
}

async function main() {
  console.log('🛠️  MIGRATION UNITÉS — APPLICATION (décisions pilote 2026-06-10)\n');

  const { data, error } = await supabase
    .from('community_presets')
    .select('id, registration, model, aircraft_data');
  if (error) { console.error('❌ Lecture impossible :', error.message); process.exit(1); }
  console.log(`${data.length} avions lus.`);

  // 1) SAUVEGARDE COMPLÈTE avant toute écriture
  const backupPath = `scripts/backup-community-presets-${STAMP}.json`;
  writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 Sauvegarde écrite : ${backupPath}\n`);

  // 2) Transformation + écriture avion par avion
  const journalAll = [];
  let ok = 0, failed = 0, untouchedButStamped = 0;

  for (const row of data) {
    const journal = { registration: row.registration, id: row.id, changes: [], unresolved: [] };
    const migrated = migrateAircraft(row.aircraft_data, journal);
    journalAll.push(journal);

    const { error: upErr } = await supabase
      .from('community_presets')
      .update({ aircraft_data: migrated })
      .eq('id', row.id);

    if (upErr) {
      failed++;
      journal.writeStatus = `ÉCHEC: ${upErr.message}`;
      console.log(`❌ ${row.registration} — écriture refusée : ${upErr.message}`);
    } else {
      ok++;
      journal.writeStatus = 'OK';
      if (journal.changes.length === 0) untouchedButStamped++;
      console.log(`✅ ${String(row.registration).padEnd(8)} ${journal.changes.length} conversion(s), ${journal.unresolved.length} non-résolu(s)`);
      for (const c of journal.changes) {
        console.log(`     ${c.path} : ${c.before} → ${c.after}  [${c.interpretedAs}]`);
      }
      for (const u of journal.unresolved) {
        console.log(`     ⚠ NON RÉSOLU (laissé tel quel) : ${u.path} = ${u.value}`);
      }
    }
  }

  // 3) Journal
  const journalPath = `scripts/units-migration-journal-${STAMP}.json`;
  writeFileSync(journalPath, JSON.stringify({
    appliedAt: new Date().toISOString(),
    decisions: 'Pilote 2026-06-10 : ambigus = mm ; masses = kg ; application autorisée',
    backup: backupPath,
    results: { ok, failed, untouchedButStamped },
    journal: journalAll
  }, null, 2), 'utf8');

  console.log('\n── RÉSULTAT ──');
  console.log(`Écritures OK     : ${ok}/${data.length} (dont ${untouchedButStamped} sans conversion, estampillage seul)`);
  console.log(`Écritures ÉCHEC  : ${failed}`);
  console.log(`📄 Journal : ${journalPath}`);
  console.log(`💾 Restauration possible depuis : ${backupPath}`);
  if (failed > 0) process.exit(2);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
