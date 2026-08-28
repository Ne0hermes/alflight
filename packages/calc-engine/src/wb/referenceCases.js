// packages/calc-engine/src/wb/referenceCases.js
//
// CAS DE RÉFÉRENCE MASSE & CENTRAGE — banc de test permanent (27/08/2026).
//
// Transposition au centrage des referenceCases des abaques de performance
// (perf/abac/referenceBench.ts) : des cas connus du manuel sont stockés DANS
// la fiche avion (aircraft.wbReferenceCases) et rejoués par le VRAI moteur
// (computeWeightBalance) — jamais par un calcul parallèle qui pourrait en
// diverger. Au minimum, le cas AUTO de la FICHE DE PESÉE : avion à vide,
// CG attendu = bras de la masse à vide. Il vérifie toute la chaîne
// (normalisation m/mm, lecture des masses, moment, division) — c'est le
// « chiffre de référence » que le pilote peut confronter à sa fiche de pesée.
//
// Demande pilote (26-27/08/2026) : chaque cas doit être VISIBLE SUR LE
// GRAPHIQUE — UN POINT PAR BRAS DE LEVIER utilisé (masse à vide à son bras,
// chaque siège chargé à son bras, bagages à leur bras, carburant à son
// bras…) PLUS le point résultant (CG total), reliés visuellement, pour
// vérifier d'un coup d'œil que chaque poste tombe où le manuel le place.
// D'où le champ `points` de chaque résultat (consommé par WeightBalanceChart).
//
// SCHÉMA D'UN CAS STOCKÉ (aircraft.wbReferenceCases[]) :
//   {
//     id: string,                     // identifiant stable (UI)
//     label: string,                  // « Exemple de chargement POH »
//     source: string,                 // « Manuel de vol §6.5 », « Pesée du 12/03/2024 »
//     postes: [{ poste, masse }],     // poste = clé de charge du moteur
//                                     //   (frontLeft, rearRight, baggage_<id>,
//                                     //    fuel (kg), fuel_<idRéservoir> (LITRES))
//                                     // masse = kg (litres pour fuel_<id>)
//     cgAttendu: number,              // CG attendu (m canonique ; mm toléré)
//     toleranceCgMm?: number          // tolérance d'écart (mm) — défaut ci-dessous
//   }
//
// Fail-closed (règle « rien, aucun fallback ») : poste inconnu, bras absent,
// densité carburant inconnue, CG attendu non renseigné, calcul refusé par le
// moteur ⇒ statut 'error' avec message explicite ET aucun point tracé —
// jamais un verdict fabriqué, jamais un tracé partiel d'apparence complète.

import { getFuelDensity } from '../units/fuelDensity.js';
import { normalizeAircraftArmsToMeters, normalizeAircraftCgEnvelopeToMeters, armToMeters } from './armUnits.js';
import { computeWeightBalance, resolveWbArms } from './computeWeightBalance.js';
import { singleFuelArm } from './fuelArm.js';

// Tolérance par défaut sur l'écart de CG (millimètres) — pendant du
// DEFAULT_TOLERANCE_PCT (±5 %) du banc de performance, exprimée dans l'unité
// dans laquelle le pilote lit un centrage.
export const DEFAULT_WB_TOLERANCE_CG_MM = 5;
// Masse totale attendue (facultative) : les manuels arrondissent au kilo, et
// une transcription de fiche de pesée se lit au dixième. 1 kg couvre les deux
// sans laisser passer une erreur d'unité sur un poste.
export const DEFAULT_WB_TOLERANCE_MASSE_KG = 1;

// Le cas AUTO dérivé de la fiche de pesée est reconstruit à la volée (jamais
// stocké) : id stable pour l'UI et les tests.
export const AUTO_WEIGHING_CASE_ID = 'auto-pesee';

// Un bras VALIDE est fini et non nul — 0 est un « absent » écrit par
// d'anciens normaliseurs (même règle que computeWeightBalance, Lot 1.0).
const armOk = (a) => {
  const n = parseFloat(a);
  return Number.isFinite(n) && n !== 0;
};

// Masse à vide : mêmes priorités de lecture que computeWeightBalance.
const emptyWeightOf = (aircraft) => parseFloat(
  aircraft.weights?.emptyWeight ||
  aircraft.emptyWeight ||
  aircraft.masses?.emptyMass
);

// Avion garanti en MÈTRES (bras + enveloppe) — même chaîne que le moteur.
const normalized = (aircraft) =>
  normalizeAircraftCgEnvelopeToMeters(normalizeAircraftArmsToMeters(aircraft));

// Sièges : clé de charge → [clé de bras dans weightBalance, libellé pilote].
const SEAT_POSTES = {
  frontLeft: ['frontLeftSeatArm', 'Siège avant gauche'],
  frontRight: ['frontRightSeatArm', 'Siège avant droit'],
  rearLeft: ['rearLeftSeatArm', 'Siège arrière gauche'],
  rearRight: ['rearRightSeatArm', 'Siège arrière droit'],
};

/**
 * Catalogue des postes de chargement SÉLECTIONNABLES pour un cas de référence
 * de CET avion (UI de saisie + validation). Les clés sont exactement celles
 * du paramètre `loads` de computeWeightBalance — aucune traduction.
 * @param {object} aircraft
 * @returns {Array<{key:string,label:string,unite:'kg'|'ltr'}>}
 */
export function wbPostesForAircraft(aircraft) {
  if (!aircraft) return [];
  const a = normalized(aircraft);
  const postes = Object.entries(SEAT_POSTES).map(([key, [, label]]) => ({ key, label, unite: 'kg' }));
  if (Array.isArray(a.baggageCompartments) && a.baggageCompartments.length > 0) {
    a.baggageCompartments.forEach((c, i) => {
      postes.push({ key: `baggage_${c.id || i}`, label: c.name || `Compartiment ${i + 1}`, unite: 'kg' });
    });
  } else {
    postes.push({ key: 'baggage', label: 'Bagages', unite: 'kg' });
    postes.push({ key: 'auxiliary', label: 'Rangement auxiliaire', unite: 'kg' });
  }
  const tanks = Array.isArray(a.additionalFuelTanks) ? a.additionalFuelTanks : [];
  tanks.forEach((t, i) => {
    postes.push({ key: `fuel_${t.id ?? i}`, label: `${t.name || `Réservoir ${i + 1}`} — carburant`, unite: 'ltr' });
  });
  // Bloc carburant unique (kg) : valable seulement si le bras est non ambigu
  // (mono-réservoir / bras identiques / legacy) — l'évaluation le vérifie.
  postes.push({ key: 'fuel', label: 'Carburant (bloc unique)', unite: 'kg' });
  return postes;
}

/**
 * Cas AUTO dérivé de la FICHE DE PESÉE : avion à vide, CG attendu = bras de
 * la masse à vide. null si la pesée est incomplète (masse ou bras absent) —
 * l'appelant affiche alors un cas « non évaluable » explicite, jamais rien.
 * @param {object} aircraft
 * @returns {object|null} cas de référence (jamais stocké, reconstruit)
 */
export function buildAutoWeighingCase(aircraft) {
  if (!aircraft) return null;
  const a = normalized(aircraft);
  const emptyWeight = emptyWeightOf(a);
  const wb = resolveWbArms(a);
  const arm = parseFloat(wb?.emptyWeightArm);
  if (!Number.isFinite(emptyWeight) || emptyWeight <= 0 || !armOk(arm)) return null;
  const certDate = aircraft.weighingReport?.certificationDate;

  // 27/08 — LA RÉFÉRENCE VIENT DU RAPPORT, PAS DE LA FICHE. La version
  // précédente posait cgAttendu = wb.emptyWeightArm, c'est-à-dire le bras que
  // la fiche elle-même déclare : le moteur était comparé à sa propre entrée et
  // le verdict ne pouvait qu'être PASS, quelle que soit l'exactitude de la
  // saisie. Un « ✓ 0,0 mm » rassurant sur une fiche fausse.
  // Le contrôle utile est la confrontation de la fiche au DOCUMENT : les deux
  // valeurs lues sur le rapport de pesée se saisissent dans l'onglet Masse &
  // centrage et sont stockées sous weighingReport.cgFromReport (bras à vide) et
  // weighingReport.emptyWeightFromReport (masse à vide). Sans elles, le cas
  // reste listé mais NON VÉRIFIABLE — jamais un faux succès.
  // Preuve que le contrôle sert : le 27/08, la masse à vide de F-GBTU était
  // passée à 700 kg alors que son rapport de pesée du 01/03/2018 dit 690.
  const cgLu = parseFloat(aircraft.weighingReport?.cgFromReport);
  const masseLue = parseFloat(aircraft.weighingReport?.emptyWeightFromReport);
  return {
    id: AUTO_WEIGHING_CASE_ID,
    auto: true,
    label: 'Fiche de pesée — avion à vide',
    source: certDate ? `Rapport de pesée du ${certDate}` : 'Rapport de pesée (fiche avion)',
    postes: [],
    cgAttendu: Number.isFinite(cgLu) ? cgLu : undefined,
    masseAttendue: Number.isFinite(masseLue) ? masseLue : undefined,
    // Transcription d'un document : seul l'arrondi du moteur est admis.
    toleranceCgMm: 1,
    toleranceMasseKg: 0.5,
    manqueReference: !Number.isFinite(cgLu),
  };
}

// Résout le bras d'UN poste de charge → { point } ou { error } explicite.
// `masse` est en kg, sauf pour fuel_<id> où c'est des LITRES (convention des
// loads du moteur) — le point porte alors la masse CONVERTIE (kg) + litres.
function resolvePostePoint(a, wb, key, masse, density) {
  if (SEAT_POSTES[key]) {
    const [armKey, label] = SEAT_POSTES[key];
    const arm = parseFloat(wb?.[armKey]);
    if (!armOk(arm)) return { error: `bras manquant pour « ${label} »` };
    return { point: { key, label, masse, bras: arm } };
  }
  if (key === 'baggage' || key === 'auxiliary') {
    const label = key === 'baggage' ? 'Bagages' : 'Rangement auxiliaire';
    if (Array.isArray(a.baggageCompartments) && a.baggageCompartments.length > 0) {
      // En mode compartiments, les clés legacy ne participent PAS au bilan du
      // moteur : les accepter tracerait un point que le calcul ignore.
      return { error: `poste « ${label} » indisponible : cet avion déclare des compartiments bagages (utiliser baggage_<id>)` };
    }
    const arm = parseFloat(key === 'baggage' ? wb?.baggageArm : wb?.auxiliaryArm);
    if (!armOk(arm)) return { error: `bras manquant pour « ${label} »` };
    return { point: { key, label, masse, bras: arm } };
  }
  if (key.startsWith('baggage_')) {
    const compartments = Array.isArray(a.baggageCompartments) ? a.baggageCompartments : [];
    const suffix = key.slice('baggage_'.length);
    // Même clé que le moteur : `baggage_${compartment.id || index}`.
    const idx = compartments.findIndex((c, i) => String(c.id || i) === suffix);
    if (idx < 0) return { error: `compartiment bagages inconnu « ${key} »` };
    const c = compartments[idx];
    const label = c.name || `Compartiment ${idx + 1}`;
    const arm = parseFloat(c.arm);
    if (!armOk(arm)) return { error: `bras manquant pour « ${label} »` };
    return { point: { key, label, masse, bras: arm } };
  }
  if (key === 'fuel') {
    const fa = singleFuelArm(a, wb, null);
    if (fa.error === 'ambiguous') {
      return { error: 'bras carburant ambigu (réservoirs à bras différents) — saisir le carburant par réservoir (fuel_<id>)' };
    }
    if (fa.error) return { error: 'bras carburant manquant' };
    return { point: { key, label: 'Carburant', masse, bras: fa.arm } };
  }
  if (key.startsWith('fuel_')) {
    const tanks = Array.isArray(a.additionalFuelTanks) ? a.additionalFuelTanks : [];
    const suffix = key.slice('fuel_'.length);
    // Même clé que le moteur : `fuel_${tank.id ?? index}`.
    const idx = tanks.findIndex((t, i) => String(t.id ?? i) === suffix);
    if (idx < 0) return { error: `réservoir inconnu « ${key} »` };
    const t = tanks[idx];
    const label = t.name || `Réservoir ${idx + 1}`;
    const arm = parseFloat(t.arm);
    if (!armOk(arm)) return { error: `bras manquant pour le réservoir « ${label} »` };
    if (density == null) {
      return { error: `densité carburant inconnue (type non renseigné) — poste « ${label} » non évaluable` };
    }
    return { point: { key, label, masse: masse * density, litres: masse, bras: arm } };
  }
  return { error: `poste inconnu « ${key} »` };
}

/**
 * Rejoue UN cas de référence sur la fiche avion EN L'ÉTAT, via le VRAI moteur
 * computeWeightBalance. Fail-closed : tout manque rend le cas 'error' avec
 * message explicite (et sans points) — jamais un verdict ou un tracé fabriqué.
 *
 * @param {object} aircraft  fiche avion (brute — normalisée ici)
 * @param {object} refCase   cas (schéma en tête de fichier)
 * @returns {{
 *   id:string, label:string, source:string|null, auto:boolean,
 *   status:'pass'|'fail'|'error', message:string|null,
 *   cgComputed:number|null, cgExpected:number|null,
 *   deviationMm:number|null, toleranceMm:number,
 *   weightComputed:number|null, isWithinLimits:boolean|null,
 *   points:Array<{key,label,masse,bras,litres?}>,
 *   resultPoint:{w:number,cg:number}|null
 * }}
 */
// Reproduit les refus de computeWeightBalance pour en NOMMER la cause. Le
// moteur rend `null` sans dire pourquoi ; ce diagnostic parcourt les mêmes
// conditions, dans le même ordre, et rend une phrase que le pilote peut suivre.
// À garder aligné sur requiredProps (computeWeightBalance.js:134-148).
const LIBELLE_BRAS = {
  emptyWeightArm: 'bras de la masse à vide',
  frontLeftSeatArm: 'bras du siège avant gauche',
  frontRightSeatArm: 'bras du siège avant droit',
  rearLeftSeatArm: 'bras du siège arrière gauche',
  rearRightSeatArm: 'bras du siège arrière droit',
  fuelArm: 'bras du carburant',
};
function diagnostiquerRefus(a, wb) {
  const causes = [];
  const ew = emptyWeightOf(a);
  if (!Number.isFinite(ew) || ew <= 0) causes.push('masse à vide non renseignée');
  const mtow = parseFloat(a?.weights?.mtow ?? a?.maxTakeoffWeight);
  if (!Number.isFinite(mtow) || mtow <= 0) causes.push('masse maximale au décollage non renseignée');
  if (wb) {
    const manquants = Object.keys(LIBELLE_BRAS).filter((k) => wb[k] === undefined);
    if (manquants.length > 0) causes.push(manquants.map((k) => LIBELLE_BRAS[k]).join(', ') + ' absent(s) de la fiche');
    if (!wb.cgLimits || (wb.cgLimits.forward === undefined && wb.cgLimits.aft === undefined)) {
      causes.push('limites de centrage absentes (enveloppe non exploitable)');
    }
  } else {
    causes.push('bras de levier non résolus');
  }
  return causes.length > 0 ? causes.join(' ; ') : 'cause non identifiée';
}

export function evaluateWbReferenceCase(aircraft, refCase) {
  const tolRaw = parseFloat(refCase?.toleranceCgMm);
  const base = {
    id: refCase?.id ?? refCase?.label ?? 'cas-sans-id',
    label: refCase?.label || 'Cas de référence',
    source: refCase?.source || null,
    auto: refCase?.auto === true,
    status: 'error',
    message: null,
    cgComputed: null,
    cgExpected: null,
    deviationMm: null,
    toleranceMm: Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : DEFAULT_WB_TOLERANCE_CG_MM,
    weightComputed: null,
    isWithinLimits: null,
    points: [],
    resultPoint: null,
  };
  if (!aircraft) return { ...base, message: 'Fiche avion absente' };

  const a = normalized(aircraft);
  const wb = resolveWbArms(a);
  const density = getFuelDensity(a.fuelType);

  const loads = {};
  const points = [];
  const problemes = [];

  // Masse à vide — présente dans TOUT cas (le moteur l'ajoute toujours) :
  // c'est le premier « bras utilisé », donc le premier point tracé.
  const emptyWeight = emptyWeightOf(a);
  if (!Number.isFinite(emptyWeight) || emptyWeight <= 0) {
    problemes.push('masse à vide non renseignée');
  } else if (!armOk(wb?.emptyWeightArm)) {
    problemes.push('bras de la masse à vide manquant');
  } else {
    const brasVide = parseFloat(wb.emptyWeightArm);
    const ptVide = {
      key: 'empty',
      label: 'Masse à vide',
      masse: emptyWeight,
      bras: brasVide,
      momentCalcule: Math.round(emptyWeight * brasVide * 1000) / 1000,
    };
    // La ligne « Avion vide » de l'exemple de chargement : son bras est celui
    // du rapport de pesée, saisi une fois pour toutes dans l'onglet M&C.
    const brasVideLu = parseFloat(aircraft?.weighingReport?.cgFromReport);
    if (Number.isFinite(brasVideLu)) {
      const lu = armToMeters(brasVideLu);
      ptVide.brasAttendu = lu;
      ptVide.ecartBrasMm = Math.round(Math.abs(brasVide - lu) * 1000 * 10) / 10;
      ptVide.momentAttendu = Math.round(emptyWeight * lu * 1000) / 1000;
      ptVide.brasConforme = ptVide.ecartBrasMm <= base.toleranceMm;
    }
    points.push(ptVide);
  }

  for (const p of (Array.isArray(refCase?.postes) ? refCase.postes : [])) {
    const key = p?.poste;
    const masse = parseFloat(p?.masse);
    if (!key) { problemes.push('poste sans clé'); continue; }
    if (!Number.isFinite(masse) || masse < 0) { problemes.push(`masse invalide pour « ${key} »`); continue; }
    if (masse === 0) continue; // poste vide : aucun moment, aucun point
    if (loads[key] !== undefined) { problemes.push(`poste « ${key} » saisi deux fois`); continue; }
    const res = resolvePostePoint(a, wb, key, masse, density);
    if (res.error) { problemes.push(res.error); continue; }
    loads[key] = masse;

    // 28/08 — CONFRONTATION POSTE PAR POSTE. L'exemple de chargement imprimé
    // sur une fiche de pesée donne, pour chaque ligne, la masse ET LE BRAS ET
    // LE MOMENT (« Pilote(s) 154,000 kg · 2,045 m · 314,930 m.kg »). C'est là
    // que se vérifie vraiment une fiche : le bras que l'application applique à
    // chaque poste doit être celui du document. Comparer le seul centrage
    // total laissait passer deux erreurs de bras qui se compensent.
    // `brasAttendu` est facultatif — sans lui, la ligne est simplement calculée.
    const pt = res.point;
    pt.momentCalcule = Math.round(pt.masse * pt.bras * 1000) / 1000;
    const brasRaw = parseFloat(p?.brasAttendu);
    if (Number.isFinite(brasRaw)) {
      const brasLu = armToMeters(brasRaw);
      pt.brasAttendu = brasLu;
      pt.ecartBrasMm = Math.round(Math.abs(pt.bras - brasLu) * 1000 * 10) / 10;
      pt.momentAttendu = Math.round(pt.masse * brasLu * 1000) / 1000;
      pt.brasConforme = pt.ecartBrasMm <= base.toleranceMm;
    }
    points.push(pt);
  }

  // 27/08 — CARBURANT SAISI DEUX FOIS. Le moteur bascule en mode « par
  // réservoir » dès qu'un load fuel_<id> est fini et n'additionne alors JAMAIS
  // loads.fuel : un cas mêlant les deux perdait la masse du bloc unique en
  // silence, et pouvait rendre PASS avec des dizaines de kilos manquants.
  // On refuse le cas au lieu de le calculer faux.
  if (loads.fuel !== undefined && Object.keys(loads).some((k) => k.startsWith('fuel_'))) {
    problemes.push('carburant saisi à la fois en bloc unique et par réservoir — n\'en garder qu\'un seul (le moteur ignore le bloc unique dès qu\'un réservoir est renseigné)');
  }

  if (problemes.length > 0) {
    return { ...base, message: `Cas non évaluable : ${problemes.join(' ; ')}` };
  }

  // ─── Verdict par le VRAI moteur (jamais un calcul parallèle) ───
  const r = computeWeightBalance({ aircraft: a, loads });
  if (!r) {
    // 27/08 — DIRE LA VRAIE CAUSE. Ce message attribuait tout refus à « masse à
    // vide ou MTOW non renseignée », alors que le moteur refuse pour plusieurs
    // raisons distinctes. Sur la flotte réelle, 4 fiches sur 13 tombaient ici en
    // accusant à tort la masse à vide : les trois biplaces (Cessna 150/152)
    // parce que le moteur exige des bras de sièges ARRIÈRE qu'un biplace n'a
    // pas, et le DR401 parce que son carburant est réparti en réservoirs et
    // qu'aucun bras unique n'est renseigné. Les quatre manquent en plus de
    // limites de centrage exploitables. On nomme ce qui manque.
    return { ...base, message: `Calcul refusé par le moteur M&C : ${diagnostiquerRefus(a, wb)}` };
  }
  if (!Number.isFinite(r.cg) || !Number.isFinite(r.totalWeight)) {
    const detail = (r.warnings || []).join(' ; ');
    return { ...base, message: `CG non calculable : ${detail || 'bilan non fiable'}` };
  }

  const enriched = {
    ...base,
    cgComputed: r.cg,
    weightComputed: r.totalWeight,
    isWithinLimits: r.isWithinLimits,
    points,
    resultPoint: { w: r.totalWeight, cg: r.cg },
  };

  // CG attendu : mm toléré en entrée (même garde-fou m/mm que les bras).
  const expRaw = parseFloat(refCase?.cgAttendu);
  const expected = Number.isFinite(expRaw) ? armToMeters(expRaw) : NaN;
  if (!Number.isFinite(expected)) {
    return {
      ...enriched,
      status: 'error',
      message: refCase?.manqueReference
        ? 'Bras à vide du rapport de pesée non renseigné — saisissez-le dans « Fiche de pesée » pour confronter la fiche au document'
        : 'CG attendu non renseigné — écart non vérifiable',
    };
  }

  const deviationMm = Math.round(Math.abs(r.cg - expected) * 1000 * 10) / 10;
  const cgTenu = deviationMm <= enriched.toleranceMm;

  // 27/08 — MASSE ATTENDUE, facultative. Tout exemple de chargement d'un manuel
  // donne DEUX chiffres, la masse totale ET le centrage : c'est le couple qui
  // vérifie. Le CG seul laisse passer une erreur d'unité sur un poste, qui peut
  // décaler la masse de plusieurs dizaines de kilos tout en gardant l'écart de
  // centrage sous la tolérance. Quand la masse attendue est renseignée, les
  // DEUX écarts doivent tenir pour que le cas passe.
  const masseRaw = parseFloat(refCase?.masseAttendue);
  const tolMasseRaw = parseFloat(refCase?.toleranceMasseKg);
  const toleranceMasseKg = Number.isFinite(tolMasseRaw) && tolMasseRaw > 0 ? tolMasseRaw : DEFAULT_WB_TOLERANCE_MASSE_KG;
  let masseTenue = true;
  let ecartMasseKg = null;
  if (Number.isFinite(masseRaw)) {
    ecartMasseKg = Math.round(Math.abs(r.totalWeight - masseRaw) * 10) / 10;
    masseTenue = ecartMasseKg <= toleranceMasseKg;
  }

  // 28/08 — un BRAS qui contredit le document fait échouer le cas, même si le
  // centrage total tombe juste : deux erreurs de bras peuvent se compenser et
  // rendre un total conforme sur une fiche fausse. Les postes dont le bras
  // attendu n'a pas été saisi ne participent pas à ce verdict.
  const brasFautifs = points.filter((p) => p.brasConforme === false).map((p) => p.label);

  return {
    ...enriched,
    cgExpected: expected,
    deviationMm,
    masseExpected: Number.isFinite(masseRaw) ? masseRaw : null,
    ecartMasseKg,
    toleranceMasseKg,
    brasFautifs,
    status: cgTenu && masseTenue && brasFautifs.length === 0 ? 'pass' : 'fail',
  };
}

/**
 * Rejoue TOUS les cas de référence M&C d'un avion : le cas AUTO de la fiche
 * de pesée d'abord (toujours présent — « non évaluable » explicite si la
 * pesée est incomplète), puis les cas stockés (aircraft.wbReferenceCases).
 * @param {object} aircraft
 * @returns {Array} résultats (cf. evaluateWbReferenceCase)
 */
export function evaluateAllWbReferenceCases(aircraft) {
  if (!aircraft) return [];
  const results = [];
  const auto = buildAutoWeighingCase(aircraft);
  if (auto) {
    results.push(evaluateWbReferenceCase(aircraft, auto));
  } else {
    results.push({
      id: AUTO_WEIGHING_CASE_ID,
      label: 'Fiche de pesée — avion à vide',
      source: null,
      auto: true,
      status: 'error',
      message: 'Masse à vide ou bras de la pesée non renseigné — cas non évaluable',
      cgComputed: null,
      cgExpected: null,
      deviationMm: null,
      toleranceMm: 1,
      weightComputed: null,
      isWithinLimits: null,
      points: [],
      resultPoint: null,
    });
  }
  const stored = Array.isArray(aircraft.wbReferenceCases) ? aircraft.wbReferenceCases : [];
  for (const rc of stored) results.push(evaluateWbReferenceCase(aircraft, rc));
  return results;
}
