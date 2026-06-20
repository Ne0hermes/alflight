// src/utils/fuelArm.js
//
// 🔧 CENTRAGE CARBURANT — règle STRICTE par réservoir (décision pilote 2026-06).
//
// PRINCIPE NON NÉGOCIABLE :
//   moment carburant = Σ ( carburant_réservoir_i × bras_i )
//   • JAMAIS de moyenne de bras (faux dès que les bras diffèrent) ;
//   • JAMAIS de multiplication d'une masse par un bras absent (× 0) ;
//   • JAMAIS de bras de repli inventé.
//   Si un réservoir CHARGÉ n'a pas de bras → ERREUR explicite, pas un chiffre.
//
// Chaque réservoir (principal, aile, optionnel, tip, aux…) DOIT porter son
// propre bras de levier. La saisie avion (Step3) impose ce bras ; ici on
// consomme ces bras sans jamais les fabriquer.
//
// Deux cas structurels :
//   • Mono-bras non ambigu : 1 seul réservoir, OU tous les réservoirs au MÊME
//     bras (2 ailes symétriques), OU avion legacy (arms.fuelMain) → un seul bras
//     EXACT (les bras sont identiques, ce n'est pas une moyenne).
//   • Multi-bras différents : il FAUT la répartition litres-par-réservoir pour
//     connaître le centrage. Sans elle → indisponible ('distribution'), jamais
//     une moyenne.

import { armToMeters } from './armUnits';

// Tolérance d'égalité des bras (1 mm) pour décider « même bras ».
const ARM_EQ_TOL = 1e-3;

/** Réservoirs ayant une capacité exploitable (>0), bras ramené en mètres.
 *  `_i` = index d'ORIGINE (clé de load `fuel_<id|index>`), conservé avant filtrage. */
function usableTanks(aircraft) {
  const list = Array.isArray(aircraft?.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
  return list
    .map((t, i) => ({
      raw: t,
      _i: i,
      id: t?.id ?? i,
      name: t?.name,
      cap: parseFloat(t?.capacity),
      arm: armToMeters(parseFloat(t?.arm)),
    }))
    .filter((t) => Number.isFinite(t.cap) && t.cap > 0);
}

/** Bras legacy mono-réservoir (aucun additionalFuelTanks). null si absent/0. */
function legacyArm(aircraft, wb) {
  const a = armToMeters(parseFloat(wb?.fuelArm ?? aircraft?.arms?.fuelMain ?? aircraft?.armLengths?.fuelArm));
  return Number.isFinite(a) && a !== 0 ? a : null;
}

function tanksShareOneArm(tanks) {
  const a0 = tanks[0].arm;
  return tanks.every((t) => Math.abs(t.arm - a0) <= ARM_EQ_TOL);
}

/**
 * Bras carburant UNIQUE quand il est non ambigu — pour le bloc carburant unique
 * (repli du moteur de centrage live, avions mono-bras).
 *
 * @returns {{arm:number} | {error:'fuelArm'|'ambiguous'}}
 *   - {arm}              : bras exact (mono-réservoir, ou tous bras égaux, ou legacy)
 *   - {error:'fuelArm'}  : un réservoir avec capacité n'a pas de bras
 *   - {error:'ambiguous'}: plusieurs bras DIFFÉRENTS → répartition par réservoir requise
 */
export function singleFuelArm(aircraft, wb = aircraft?.weightBalance) {
  const tanks = usableTanks(aircraft);
  if (tanks.length === 0) {
    const a = legacyArm(aircraft, wb);
    return a == null ? { error: 'fuelArm' } : { arm: a };
  }
  if (tanks.some((t) => !Number.isFinite(t.arm) || t.arm === 0)) return { error: 'fuelArm' };
  if (tanksShareOneArm(tanks)) return { arm: tanks[0].arm };
  return { error: 'ambiguous' };
}

/**
 * Contribution carburant (poids kg + moment kg·m) d'un scénario, PAR RÉSERVOIR.
 *
 * @param {object}  o.aircraft
 * @param {'full'|'fob'|'landing'} o.scenario
 * @param {number}  o.density        kg/L (non-null garanti par l'appelant)
 * @param {number} [o.fobLiters=0]   FOB total (L) — scénarios 'fob'/'landing'
 * @param {number} [o.burnedLiters=0] carburant brûlé jusqu'à l'atterrissage (L) — 'landing'
 * @param {object} [o.loads={}]      loads du store ; clés par réservoir `fuel_<id|index>`
 * @param {object} [o.wb]
 * @returns {{ ok:true, rows:Array<{label,value,arm,moment}>, weight:number, moment:number }
 *          | { ok:false, reason:'fuelArm'|'distribution' }}
 */
export function computeScenarioFuel({ aircraft, scenario, density, fobLiters = 0, burnedLiters = 0, loads = {}, wb = aircraft?.weightBalance }) {
  const tanks = usableTanks(aircraft);
  const empty = { ok: true, rows: [], weight: 0, moment: 0 };
  const totalForScenario = () =>
    scenario === 'full'
      ? (parseFloat(aircraft?.fuelCapacity) || 0)
      : scenario === 'fob'
        ? fobLiters
        : Math.max(0, fobLiters - burnedLiters);

  // ── Avion legacy mono-bras (aucun réservoir listé) ──
  if (tanks.length === 0) {
    const liters = totalForScenario();
    if (liters <= 0) return empty;
    const a = legacyArm(aircraft, wb);
    if (a == null) return { ok: false, reason: 'fuelArm' };
    const weight = liters * density;
    return { ok: true, rows: [row('Carburant', weight, a)], weight, moment: weight * a };
  }

  // ── Réservoirs listés : chaque réservoir DOIT avoir un bras ──
  if (tanks.some((t) => !Number.isFinite(t.arm) || t.arm === 0)) return { ok: false, reason: 'fuelArm' };

  // Réservoirs pleins : litres = capacité de chaque réservoir (exact, déterministe).
  if (scenario === 'full') {
    return rowsFromPerTank(tanks, tanks.map((t) => t.cap), density);
  }

  // 'fob' / 'landing' : répartition saisie par le pilote ?
  const distributed = tanks.map((t) => parseFloat(loads[`fuel_${t.id}`]));
  const hasDistribution = distributed.some((v) => Number.isFinite(v));

  if (!hasDistribution) {
    // Pas de répartition : autorisé UNIQUEMENT si tous les réservoirs ont le même
    // bras (le centrage longitudinal est alors indépendant de la répartition).
    if (tanksShareOneArm(tanks)) {
      const liters = totalForScenario();
      if (liters <= 0) return empty;
      const weight = liters * density;
      const arm = tanks[0].arm;
      return { ok: true, rows: [row('Carburant', weight, arm)], weight, moment: weight * arm };
    }
    // Bras différents sans répartition → indisponible (jamais de moyenne).
    return { ok: false, reason: 'distribution' };
  }

  // Répartition fournie : litres par réservoir = saisie (0 si vide).
  let perTank = distributed.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));

  // 'landing' : retirer le carburant brûlé dans l'ORDRE DE LA LISTE des
  // réservoirs (déterministe, pas de moyenne). Le pilote peut ordonner ses
  // réservoirs selon sa séquence réelle de consommation.
  if (scenario === 'landing') {
    let toBurn = burnedLiters;
    perTank = perTank.slice();
    for (let i = 0; i < perTank.length && toBurn > 0; i++) {
      const take = Math.min(perTank[i], toBurn);
      perTank[i] -= take;
      toBurn -= take;
    }
  }

  return rowsFromPerTank(tanks, perTank, density);
}

function row(label, weight, arm) {
  return { label, value: weight, arm, moment: weight * arm };
}

function rowsFromPerTank(tanks, perTankLiters, density) {
  const rows = tanks
    .map((t, i) => {
      const liters = Math.max(0, perTankLiters[i] || 0);
      const weight = liters * density;
      return row(t.name || `Réservoir ${i + 1}`, weight, t.arm);
    })
    .filter((r) => r.value > 0);
  const weight = rows.reduce((s, r) => s + r.value, 0);
  const moment = rows.reduce((s, r) => s + r.moment, 0);
  return { ok: true, rows, weight, moment };
}
