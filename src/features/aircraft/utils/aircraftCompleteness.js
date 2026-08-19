/**
 * aircraftCompleteness — calcul du % de complétion d'un avion et liste des champs manquants.
 *
 * Utilisé par :
 *  - AircraftModule (carte avion) : badge % + dropdown des champs manquants
 *  - AircraftCreationWizard       : confirmation modal avant bypass des validations
 *
 * Catégories de criticité :
 *  - CRITICAL : sans ces données, l'avion ne devrait pas être utilisé pour calculs réels
 *               (Performance, M&C). Affichées en rouge.
 *  - REQUIRED : champs habituellement obligatoires lors de la création (registration, MTOW...).
 *               Affichés en orange.
 *  - OPTIONAL : confort / complétude (photo, MANEX, équipement). Pondération faible.
 */

import { computeMissingPerformanceTables, computeCertifiedAbsentPerformanceTables } from './performanceCoverage';
// ⛽ Deux contenances par réservoir (17/08/2026) : les replis lisent les
// nouveaux champs via les accesseurs canoniques du moteur — Σ tankTotalLtr
// pour la capacité, Σ tankUsableLtr pour l'utilisable — avec l'ancien
// `capacity` en DERNIER recours (repli intégré aux accesseurs).
import { sumTotalLtr, sumUsableLtr } from '@alflight/calc-engine/fuel/tankCapacity';

// R22 — poids FIXE du groupe « Performances » (décision pilote : la liste des
// tables manquantes est informative et ne doit pas diluer le % avec 8 lignes).
// Le groupe est « rempli » quand toutes les tables attendues sont présentes OU
// marquées non applicables (bypass) ; sinon il ne compte pas dans le score.
const PERFORMANCE_GROUP_WEIGHT = 6;

// Helper : lit une valeur potentiellement imbriquée ("speeds.vne") sur l'avion.
// Supporte également des chemins MULTIPLES séparés par « | » (logique OR) :
//   "cgLimits.forward | weightBalance.cgLimits.forward | cgEnvelope.forwardPoints"
// → retourne la première valeur SIGNIFICATIVE (au sens hasValue) de la liste.
// ⚠️ Le test doit être hasValue, pas juste ≠ null/'' : une valeur présente mais
// vide-de-sens (0, [], placeholder) court-circuitait le scan des alternatives →
// faux « manquants » (vécu : performanceModels:[] masquait advancedPerformance.tables
// sur F-HSTR ; cgLimits.forward:0 masquait cgEnvelope.forwardPoints sur F-GOFP).
const getValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const candidates = path.split('|').map((p) => p.trim()).filter(Boolean);
  for (const p of candidates) {
    const v = p.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (hasValue(v)) return v;
  }
  return undefined;
};

// Considère présent : nombre ≠ 0, chaîne non-vide ET non-placeholder, tableau non-vide,
// objet avec hasData=true OU non-vide. Rejette les placeholders « Inconnu », « N/A », « —ʼ ».
const PLACEHOLDER_STRINGS = new Set(['inconnu', 'unknown', 'n/a', 'na', '-', '—', '–', 'none', 'null', 'undefined']);

const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.length === 0) return false;
    if (PLACEHOLDER_STRINGS.has(trimmed.toLowerCase())) return false;
    return true;
  }
  if (typeof v === 'boolean') return v === true;
  if (typeof v === 'number') return !isNaN(v) && v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    if ('hasData' in v) return Boolean(v.hasData);
    return Object.keys(v).length > 0;
  }
  return Boolean(v);
};

// ──────────────────────────────────────────────────────────────────────────
// Extractors complémentaires pour les données stockées dans
// `additionalFuelTanks[]` (refonte M&B 2025).
//
// Le wizard moderne stocke le réservoir principal comme un élément de
// `additionalFuelTanks` avec `type: 'main'` au lieu des anciens champs
// `arms.fuelMain` / `moments.fuelMain`. Pour rester compatible avec les
// avions historiques ET les avions créés via le nouveau wizard, on accepte
// les deux emplacements via un getter custom `get(aircraft)`.
// ──────────────────────────────────────────────────────────────────────────
const findTank = (aircraft, type) => {
  const tanks = aircraft?.additionalFuelTanks;
  if (!Array.isArray(tanks)) return null;
  return tanks.find((t) => t && t.type === type) || null;
};

// ⛽ Deux contenances (17/08/2026) : les sommes passent par les accesseurs
// calc-engine (totalCapacity / usableCapacity, repli legacy `capacity`).
// null → undefined pour rester cohérent avec le contrat hasValue de valueOf.
const sumTankTotal = (aircraft) => sumTotalLtr(aircraft?.additionalFuelTanks) ?? undefined;
const sumTankUsable = (aircraft) => sumUsableLtr(aircraft?.additionalFuelTanks) ?? undefined;

// Résolution unifiée d'un champ : essaye le `path` traditionnel (legacy
// + alternatives via « | »), puis si rien n'a été trouvé, tente le getter
// custom `get` si présent. Permet d'ajouter des chemins « non-statiques »
// (lookup dans un array, agrégation, etc.) sans casser l'API existante.
const valueOf = (aircraft, def) => {
  if (def.path) {
    const v = getValue(aircraft, def.path);
    if (hasValue(v)) return v;
  }
  if (typeof def.get === 'function') {
    try {
      return def.get(aircraft);
    } catch (_) {
      return undefined;
    }
  }
  return undefined;
};

/**
 * Définition complète des champs vérifiés.
 * weight = poids pour le calcul du %. severity = ordre d'affichage.
 */
/* Notes sur les chemins MULTIPLES :
   Les données d'un avion peuvent être stockées à plusieurs endroits selon le
   chemin d'import (manuel / MANEX / Supabase / IndexedDB). Pour chaque champ
   on liste toutes les sources possibles séparées par « | » (logique OR).
   La 1re source qui retourne une valeur valide gagne. */
export const FIELD_DEFINITIONS = [
  // === REQUIRED (création de base) ===
  { path: 'registration',                                          label: 'Immatriculation',           severity: 'REQUIRED', weight: 5 },
  { path: 'model',                                                 label: 'Modèle',                    severity: 'REQUIRED', weight: 3 },
  { path: 'fuelType',                                              label: 'Type de carburant',         severity: 'REQUIRED', weight: 2 },
  { path: 'fuelCapacity',                                          label: 'Capacité carburant',        severity: 'REQUIRED', weight: 3,
    // Fallback : si fuelCapacity est vide, accepter la somme des volumes
    // PHYSIQUES des réservoirs (Σ tankTotalLtr — totalCapacity, puis
    // l'ancien `capacity` en dernier recours).
    get: sumTankTotal },
  { path: 'cruiseSpeedKt | cruiseSpeed',                           label: 'Vitesse de croisière',      severity: 'REQUIRED', weight: 3 },
  { path: 'fuelConsumption',                                       label: 'Consommation carburant',    severity: 'REQUIRED', weight: 3 },
  { path: 'fuelUsableCapacity | fuelCapacity',                     label: 'Volume utilisable',         severity: 'REQUIRED', weight: 2,
    // Fallback : somme des volumes UTILISABLES des réservoirs
    // (Σ tankUsableLtr — usableCapacity, puis l'ancien `capacity` en
    // dernier recours, qui se lit comme l'utilisable).
    get: sumTankUsable },
  { path: 'horsepower',                                            label: 'Puissance moteur (CV)',     severity: 'REQUIRED', weight: 2 },

  // === CRITICAL — masse et centrage ===
  { path: 'weights.emptyWeight | emptyWeight | masses.emptyMass',  label: 'Masse à vide',              severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mtow | maxTakeoffWeight',                       label: 'Masse maximale (MTOW)',     severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mlw | limitations.maxLandingMass',              label: 'Masse max atterrissage',    severity: 'REQUIRED', weight: 2 },
  { path: 'arms.empty | weightBalance.emptyWeightArm | armLengths.emptyMassArm', label: 'Bras de levier à vide', severity: 'CRITICAL', weight: 5 },
  { path: 'arms.frontSeats | weightBalance.frontLeftSeatArm | armLengths.frontSeatArm', label: 'Bras sièges avant', severity: 'CRITICAL', weight: 4 },
  { path: 'arms.fuelMain | weightBalance.fuelArm | armLengths.fuelArm', label: 'Bras réservoir principal', severity: 'CRITICAL', weight: 4,
    // Fallback : si les paths legacy sont vides, lire le bras depuis le
    // réservoir de type 'main' dans additionalFuelTanks. C'est là que
    // le wizard moderne le stocke (Step3 → updateData('additionalFuelTanks', ...)).
    get: (a) => findTank(a, 'main')?.arm },
  { path: 'cgLimits.forward | weightBalance.cgLimits.forward | cgEnvelope.forwardPoints | cgEnvelope.forwardCG', label: 'Limite CG avant', severity: 'CRITICAL', weight: 5 },
  { path: 'cgLimits.aft | weightBalance.cgLimits.aft | cgEnvelope.aftCG | cgEnvelope.aftPoints', label: 'Limite CG arrière', severity: 'CRITICAL', weight: 5 },
  { path: 'weighingReport | hasWeighingReport | weighingReport.fileName | weighingReport.pdfData', label: 'Rapport de pesée (PDF)', severity: 'CRITICAL', weight: 4 },

  // === CRITICAL — vitesses ===
  { path: 'speeds.vso',           label: 'VSO',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vs1',           label: 'VS1',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vne',           label: 'VNE',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vno',           label: 'VNO',                       severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vfeTO',         label: 'VFE T/O',                   severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vfeLdg',        label: 'VFE LDG',                   severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vr',            label: 'VR (rotation)',             severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vx',            label: 'VX (config. takeoff)',      severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vy',            label: 'VY (config. takeoff)',      severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vapp',          label: 'V approche',                severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vglide',        label: 'V plané',                   severity: 'REQUIRED', weight: 1 },

  // === CRITICAL — performance ===
  // R22 — l'ancien contrôle binaire « Tables de performance : présent/absent »
  // est REMPLACÉ par un contrôle de COUVERTURE par table (groupe à poids fixe,
  // cf. la section performance de evaluateAircraft). Le minimum attendu et la
  // liste nominative des tables manquantes vivent dans performanceCoverage.js.

  // === OPTIONAL ===
  // MANEX : on accepte le flag hasManex (avion light loaded) OU l'objet manex.
  { path: 'hasManex | manex',     label: 'Manuel de vol (PDF)',       severity: 'OPTIONAL', weight: 2 },
  // Photo : flag hasPhoto suffit (la photo elle-même est dans IndexedDB hors aircraft).
  { path: 'hasPhoto | photo | profilePhoto', label: 'Photo',          severity: 'OPTIONAL', weight: 1 },
  { path: 'manufacturer',         label: 'Constructeur',              severity: 'OPTIONAL', weight: 1 },
  { path: 'engineType',           label: "Type d'engine",             severity: 'OPTIONAL', weight: 1 },
  { path: 'wakeTurbulenceCategory', label: 'Catégorie turbulence',    severity: 'OPTIONAL', weight: 1 },
  { path: 'compatibleRunwaySurfaces', label: 'Pistes compatibles',    severity: 'OPTIONAL', weight: 1 },
];

/**
 * Évalue un avion et retourne :
 *   - percentage      : 0 à 100 (entier)
 *   - filledWeight    : somme des poids des champs remplis
 *   - totalWeight     : somme totale des poids
 *   - missing         : [{ path, label, severity, weight }] — tous les champs vides
 *   - criticalMissing : sous-ensemble CRITICAL seulement
 *   - requiredMissing : sous-ensemble REQUIRED seulement
 *   - hasCriticalGaps : boolean — vrai s'il manque au moins un CRITICAL
 *   - bypassedFields  : reprise de aircraft.bypassedFields[] si présent
 */
export function evaluateAircraft(aircraft) {
  if (!aircraft) {
    return {
      percentage: 0,
      filledWeight: 0,
      totalWeight: 0,
      missing: FIELD_DEFINITIONS,
      criticalMissing: FIELD_DEFINITIONS.filter(f => f.severity === 'CRITICAL'),
      requiredMissing: FIELD_DEFINITIONS.filter(f => f.severity === 'REQUIRED'),
      missingPerformanceTables: computeMissingPerformanceTables(null),
      certifiedAbsentPerformanceTables: [],
      hasCriticalGaps: true,
      bypassedFields: []
    };
  }

  const bypassedFields = Array.isArray(aircraft.bypassedFields) ? aircraft.bypassedFields : [];
  const bypassedSet = new Set(bypassedFields);

  let filledWeight = 0;
  let totalWeight = 0;
  const missing = [];

  for (const def of FIELD_DEFINITIONS) {
    totalWeight += def.weight;
    // `valueOf` essaye d'abord le `path` traditionnel, puis le getter custom `def.get`
    // pour les champs qui peuvent vivre dans `additionalFuelTanks[]` (refonte M&B).
    if (hasValue(valueOf(aircraft, def))) {
      filledWeight += def.weight;
    } else {
      // 🔧 Phase 0 — Un champ CONTOURNÉ n'est PAS un champ rempli.
      // Il comptait auparavant dans le score : une fiche sans masse maxi ni
      // vitesse de décrochage pouvait afficher 88 % et disparaître de la liste
      // des manques. Le contournement dit « je sais et j'avance », pas « c'est
      // renseigné » — la donnée reste absente pour le moteur de calcul.
      missing.push(bypassedSet.has(def.path) ? { ...def, bypassed: true } : def);
    }
  }

  // === R22 — GROUPE « Performances » (couverture par table, poids fixe) ===
  // Remplace l'ancien booléen. Le groupe vaut PERFORMANCE_GROUP_WEIGHT, gagné
  // entièrement si toutes les tables attendues sont présentes ou ignorées.
  // Les tables manquantes sont poussées dans `missing` (poids 0 → n'affectent
  // pas le score, seulement l'affichage) avec le marqueur group:'PERFORMANCE'
  // pour un rendu dédié et un toggle « non applicable ».
  const missingPerformanceTables = computeMissingPerformanceTables(aircraft, bypassedSet);
  // 19/08/2026 — les tables CONTOURNÉES ne sont plus retirées en silence :
  // elles sont retournées À PART comme « certifiées absentes du manuel de
  // vol » pour que la carte avion et la synthèse puissent le dire. Le score
  // reste inchangé (contournée = couverte).
  const certifiedAbsentPerformanceTables = computeCertifiedAbsentPerformanceTables(aircraft, bypassedSet);
  totalWeight += PERFORMANCE_GROUP_WEIGHT;
  if (missingPerformanceTables.length === 0) {
    filledWeight += PERFORMANCE_GROUP_WEIGHT;
  } else {
    for (const t of missingPerformanceTables) {
      missing.push({
        path: t.bypassKey,
        label: t.label,
        severity: 'CRITICAL',
        weight: 0,
        group: 'PERFORMANCE',
        phase: t.phase,
        flaps: t.flaps,
        operationId: t.operationId
      });
    }
  }

  const criticalMissing = missing.filter(f => f.severity === 'CRITICAL');
  const requiredMissing = missing.filter(f => f.severity === 'REQUIRED');
  const percentage = totalWeight === 0 ? 0 : Math.round((filledWeight / totalWeight) * 100);

  return {
    percentage,
    filledWeight,
    totalWeight,
    missing,
    criticalMissing,
    requiredMissing,
    missingPerformanceTables,
    certifiedAbsentPerformanceTables,
    hasCriticalGaps: criticalMissing.length > 0,
    bypassedFields
  };
}

/**
 * Couleur d'affichage selon le %.
 * Charte ALFlight unifiée — vert sapin / orange officiel (plus de rouge brique
 * qui rendait « orange foncé sale » à l'écran).
 */
export function getCompletionColor(percentage) {
  if (percentage >= 90) return '#4FAE7F'; // vert sapin (status-ok ALFlight)
  return '#f26921';                        // orange ALFlight (toutes valeurs < 90%)
}

/**
 * Couleur pour un niveau de criticité — palette unifiée (plus de rouge critique).
 * Le rouge brique #C04534 paraissait « orange foncé sale » à l'écran et polluait
 * la charte éditoriale ALFlight. CRITICAL et REQUIRED partagent désormais
 * l'orange officiel ; seul OPTIONAL reste en gris doux. La hiérarchie reste
 * portée par l'ordre d'affichage et le libellé (« Critiques », « Obligatoires »).
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return '#f26921';   // orange officiel ALFlight
    case 'REQUIRED': return '#f26921';   // orange officiel ALFlight
    case 'OPTIONAL': return '#8A867E';   // gris ALFlight (text-dim)
    default:         return '#8A867E';
  }
}
