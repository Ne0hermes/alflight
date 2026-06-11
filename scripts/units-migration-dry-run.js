// ═══════════════════════════════════════════════════════════════════════════
// C5 (PLAN_CORRECTIFS_UNITES.md) — DRY-RUN de migration des unités M&C.
// STRICTEMENT LECTURE SEULE : aucun write, aucun update. Produit un rapport
// console + JSON (scripts/units-dry-run-report.json) classant chaque avion :
//   - ARMS_OK_M        : tous les bras déjà interprétables en mètres
//   - ARMS_MIGRABLE    : tous les bras dans UNE seule autre unité (mm/cm/in)
//   - ARMS_MIXED       : unités mixtes (le cas F-HFGI) → migration ciblée
//   - ARMS_AMBIGUOUS   : ≥1 valeur à interprétations multiples → QUARANTAINE
//   - WEIGHTS kg/lbs   : kg-plausible / lbs-plausible / ambigu (PAS de magnitude
//                        fiable — décision humaine ou référence modèle requise)
// Usage : node scripts/units-migration-dry-run.js
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Désambiguïsation d'un bras : quelles unités donnent une valeur GA plausible ?
// Plage plausible d'un bras/station GA : 0,15 m … 8 m (datum nez → queue).
// (0,15 et non 0,20 : cas réel F-HFGI forward[1].cg = 0,19 m, datum bord d'attaque.)
const ARM_MIN_M = 0.15, ARM_MAX_M = 8;
const ARM_FACTORS = { m: 1, mm: 1 / 1000, cm: 1 / 100, in: 1 / 39.3701 };

function armCandidates(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return null; // vide/0 : non discriminant
  const c = [];
  for (const [unit, f] of Object.entries(ARM_FACTORS)) {
    const m = Math.abs(n) * f;
    if (m >= ARM_MIN_M && m <= ARM_MAX_M) c.push(unit);
  }
  return c;
}

// ─── Collecte de tous les bras d'un avion (toutes formes du modèle) ─────────
function collectArms(a) {
  const out = []; // { path, value }
  const push = (path, v) => { if (v !== null && v !== undefined && v !== '') out.push({ path, value: v }); };
  const wb = a.weightBalance || {};
  for (const k of ['emptyWeightArm', 'fuelArm', 'frontLeftSeatArm', 'frontRightSeatArm', 'rearLeftSeatArm', 'rearRightSeatArm', 'baggageArm', 'auxiliaryArm']) push(`weightBalance.${k}`, wb[k]);
  const arms = a.arms || {};
  for (const k of Object.keys(arms)) push(`arms.${k}`, arms[k]);
  const al = a.armLengths || {};
  for (const k of Object.keys(al)) push(`armLengths.${k}`, al[k]);
  (a.additionalFuelTanks || []).forEach((t, i) => push(`tanks[${i}].arm`, t?.arm));
  (a.baggageCompartments || []).forEach((c, i) => push(`baggage[${i}].arm`, c?.arm));
  (a.additionalSeats || []).forEach((s, i) => push(`seats[${i}].arm`, s?.arm));
  return out;
}

function collectEnvelopeCg(a) {
  const env = a.cgEnvelope || {};
  const out = [];
  const push = (path, v) => { if (v !== null && v !== undefined && v !== '') out.push({ path, value: v }); };
  (env.forwardPoints || []).forEach((p, i) => push(`env.forward[${i}].cg`, p?.cg));
  for (const k of ['aftCG', 'aftMinCG', 'aftMaxCG', 'forwardCG']) push(`env.${k}`, env[k]);
  (env.intermediatePoints || []).forEach((p, i) => push(`env.inter[${i}].cg`, p?.cg));
  return out;
}

// ─── Masses : kg vs lbs (plages volontairement larges, GA → bimoteur léger) ──
const W_EMPTY_MIN = 150, W_EMPTY_MAX = 6000;   // kg
const W_MTOW_MIN = 250, W_MTOW_MAX = 9000;     // kg
function weightVerdict(a) {
  const empty = parseFloat(a.weights?.emptyWeight ?? a.emptyWeight);
  const mtow = parseFloat(a.weights?.mtow ?? a.maxTakeoffWeight);
  if (!Number.isFinite(empty) || !Number.isFinite(mtow)) return { verdict: 'INCOMPLET', empty, mtow };
  const kgOk = empty >= W_EMPTY_MIN && empty <= W_EMPTY_MAX && mtow >= W_MTOW_MIN && mtow <= W_MTOW_MAX && empty < mtow;
  const eL = empty * 0.453592, mL = mtow * 0.453592;
  const lbsOk = eL >= W_EMPTY_MIN && eL <= W_EMPTY_MAX && mL >= W_MTOW_MIN && mL <= W_MTOW_MAX && eL < mL;
  if (kgOk && lbsOk) return { verdict: 'AMBIGU_KG_OU_LBS', empty, mtow };
  if (kgOk) return { verdict: 'KG_PLAUSIBLE', empty, mtow };
  if (lbsOk) return { verdict: 'LBS_SUSPECT', empty, mtow };
  return { verdict: 'HORS_PLAGE', empty, mtow };
}

function classifyArms(items) {
  let ambiguous = 0;
  const unitVotes = {};
  const details = [];
  for (const { path, value } of items) {
    const c = armCandidates(value);
    if (c === null) continue;
    if (c.length === 0) { details.push({ path, value, candidates: [] }); ambiguous++; continue; }
    if (c.length > 1) { details.push({ path, value, candidates: c }); ambiguous++; continue; }
    unitVotes[c[0]] = (unitVotes[c[0]] || 0) + 1;
    details.push({ path, value, candidates: c });
  }
  const units = Object.keys(unitVotes);
  let verdict;
  if (details.length === 0) verdict = 'SANS_BRAS';
  else if (ambiguous > 0) verdict = 'ARMS_AMBIGUOUS';
  else if (units.length === 1 && units[0] === 'm') verdict = 'ARMS_OK_M';
  else if (units.length === 1) verdict = `ARMS_MIGRABLE_${units[0].toUpperCase()}`;
  else verdict = 'ARMS_MIXED';
  return { verdict, unitVotes, ambiguous, count: details.length, details };
}

async function main() {
  console.log('🔎 DRY-RUN migration unités — LECTURE SEULE\n');
  const { data, error } = await supabase
    .from('community_presets')
    .select('id, registration, model, aircraft_data');
  if (error) {
    console.error('❌ Lecture Supabase impossible :', error.message);
    process.exit(1);
  }
  console.log(`${data.length} avions lus.\n`);

  const report = [];
  for (const row of data) {
    const a = row.aircraft_data || {};
    const arms = classifyArms(collectArms(a));
    const envCg = classifyArms(collectEnvelopeCg(a));
    const weights = weightVerdict(a);
    const meta = a._metadata || {};
    report.push({
      id: row.id,
      registration: row.registration || a.registration,
      model: row.model || a.model,
      metadataVersion: meta.version || null,
      unitsVerified: meta.unitsVerified === true,
      arms: { verdict: arms.verdict, votes: arms.unitVotes, ambiguous: arms.ambiguous, n: arms.count },
      envelopeCg: { verdict: envCg.verdict, votes: envCg.unitVotes, ambiguous: envCg.ambiguous, n: envCg.count },
      weights,
      // Verdict global : migrable automatiquement ssi bras ET enveloppe non
      // ambigus / non mixtes, et masses non suspectes-lbs.
      global:
        (arms.verdict.startsWith('ARMS_OK') || arms.verdict.startsWith('ARMS_MIGRABLE') || arms.verdict === 'SANS_BRAS') &&
        (envCg.verdict.startsWith('ARMS_OK') || envCg.verdict.startsWith('ARMS_MIGRABLE') || envCg.verdict === 'SANS_BRAS') &&
        weights.verdict !== 'LBS_SUSPECT' && weights.verdict !== 'HORS_PLAGE'
          ? 'MIGRABLE_AUTO'
          : 'QUARANTAINE',
      armDetails: arms.details,
      envDetails: envCg.details
    });
  }

  // ─── Synthèse console ─────────────────────────────────────────────────────
  const count = (fn) => report.filter(fn).length;
  console.log('── SYNTHÈSE ──────────────────────────────────────────────');
  console.log(`MIGRABLE_AUTO     : ${count((r) => r.global === 'MIGRABLE_AUTO')}`);
  console.log(`QUARANTAINE       : ${count((r) => r.global === 'QUARANTAINE')}`);
  console.log(`unitsVerified (v3): ${count((r) => r.unitsVerified)}`);
  console.log('── Bras ──');
  for (const v of [...new Set(report.map((r) => r.arms.verdict))]) {
    console.log(`  ${v.padEnd(20)} : ${count((r) => r.arms.verdict === v)}`);
  }
  console.log('── Enveloppe CG ──');
  for (const v of [...new Set(report.map((r) => r.envelopeCg.verdict))]) {
    console.log(`  ${v.padEnd(20)} : ${count((r) => r.envelopeCg.verdict === v)}`);
  }
  console.log('── Masses ──');
  for (const v of [...new Set(report.map((r) => r.weights.verdict))]) {
    console.log(`  ${v.padEnd(20)} : ${count((r) => r.weights.verdict === v)}`);
  }
  console.log('\n── DÉTAIL PAR AVION ──────────────────────────────────────');
  for (const r of report) {
    console.log(
      `${String(r.registration || '?').padEnd(10)} ${String(r.model || '').padEnd(18)} ` +
      `${r.global.padEnd(14)} bras=${r.arms.verdict}(${r.arms.n}) env=${r.envelopeCg.verdict}(${r.envelopeCg.n}) ` +
      `masses=${r.weights.verdict} meta=${r.metadataVersion || '∅'}${r.unitsVerified ? '✓' : ''}`
    );
    if (r.arms.verdict === 'ARMS_MIXED' || r.arms.verdict === 'ARMS_AMBIGUOUS') {
      for (const d of r.armDetails.filter((d) => (d.candidates || []).length !== 1)) {
        console.log(`    ⚠ ${d.path} = ${d.value} → candidats [${(d.candidates || []).join(', ') || 'aucun'}]`);
      }
    }
  }

  const outPath = new URL('./units-dry-run-report.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary: {
    migrableAuto: count((r) => r.global === 'MIGRABLE_AUTO'),
    quarantaine: count((r) => r.global === 'QUARANTAINE'),
    total: report.length
  }, report }, null, 2), 'utf8');
  console.log(`\n📄 Rapport JSON : ${outPath}`);
  console.log('ℹ️ Aucune écriture effectuée (dry-run).');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
