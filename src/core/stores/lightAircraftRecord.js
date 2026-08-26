// src/core/stores/lightAircraftRecord.js
// ============================================================================
// 🛡️ VERSION « LÉGÈRE » d'un record avion IndexedDB — LE code anti-OOM.
// ----------------------------------------------------------------------------
// Extrait de AircraftProvider (26/08/2026) pour être partagé avec la mise à
// jour EN PLACE d'une copie communautaire (AircraftUpdatesBanner) : la liste
// du store ne doit JAMAIS porter les gros blobs (photo ~3 Mo, MANEX ~12 Mo,
// courbes fitted, images d'abaque ~2,7 Mo, PDF de pesée ~4,6 Mo) — mesuré à
// 31 Mo de state et « Render process gone, out of memory » avant ce stripping.
// Les champs lourds sont EXTRAITS par destructuring (jamais clonés puis
// supprimés) ; l'ÉDITION recharge le record COMPLET depuis IndexedDB.
// ============================================================================

export function toLightAircraftRecord(aircraft) {
  const {
    photo,
    profilePhoto,
    manex,
    ...rest
  } = aircraft;

  const light = rest;

  // Flags légers basés sur la présence (pas la valeur) — pas de
  // référence aux strings base64 retenue dans `light`.
  light.hasPhoto = !!(photo || profilePhoto);
  light.hasManex = !!manex;

  // Pour les performance tables : on remplace `sourceImage` (gros
  // base64) par `null` plutôt que de cloner et delete. On crée
  // de nouveaux objets pour ne pas muter `aircraft`.
  if (light.advancedPerformance?.tables) {
    light.advancedPerformance = {
      ...light.advancedPerformance,
      tables: light.advancedPerformance.tables.map(({ sourceImage, ...t }) => t)
    };
  }

  // 🛡️ FIX OOM (2026-06) — courbes `fitted` (200 pts/courbe × ~160 courbes),
  // images d'abaque base64 (`workshop.image.url`), PDF de pesée : retirés de
  // la liste d'AFFICHAGE ; le moteur de cascade RÉGÉNÈRE `fitted` à la volée
  // (ensureFittedGraphs, R20) et l'édition recharge le record complet.
  if (light.performanceModels) {
    light.performanceModels = light.performanceModels.map((model) => {
      if (!model.data?.graphs) return model;
      const meta = model.data.metadata;
      const strippedMeta = meta?.workshop?.image?.url
        ? { ...meta, workshop: { ...meta.workshop, image: null } }
        : meta;
      return {
        ...model,
        data: {
          ...model.data,
          metadata: strippedMeta,
          graphs: model.data.graphs.map(({ sourceImage, ...g }) => ({
            ...g,
            curves: (g.curves || []).map((c) =>
              c.fitted?.points?.length ? { ...c, fitted: { ...c.fitted, points: [] } } : c
            )
          }))
        }
      };
    });
  }

  // PDF de pesée base64 (~4,6 Mo) : on garde les métadonnées (le badge
  // « fiche présente », la date), pas le blob. La visionneuse recharge
  // depuis l'URL Storage (R20/B) ou IndexedDB à la demande.
  if (light.weighingReport?.pdfData) {
    const { pdfData, ...wrRest } = light.weighingReport;
    light.weighingReport = { ...wrRest, hasData: true };
  }

  // 🔧 FIX CRITIQUE: Mapper weights.emptyWeight → emptyWeight pour les anciens avions
  // Les avions créés avant la correction ont weights.emptyWeight mais pas emptyWeight (propriété racine)
  // Le code WeightBalanceStore et WeightBalanceTable s'attendent à aircraft.emptyWeight
  if (!light.emptyWeight && light.weights?.emptyWeight) {
    light.emptyWeight = parseFloat(light.weights.emptyWeight);
  }
  if (!light.maxTakeoffWeight && light.weights?.mtow) {
    light.maxTakeoffWeight = parseFloat(light.weights.mtow);
  }
  // 🔧 FIX: Mapper minTakeoffWeight depuis weights ou utiliser emptyWeight comme fallback
  if (!light.minTakeoffWeight) {
    if (light.weights?.minTakeoffWeight) {
      light.minTakeoffWeight = parseFloat(light.weights.minTakeoffWeight);
    } else if (light.emptyWeight) {
      // La masse à vide est le minimum PHYSIQUE (dérivation d'une donnée
      // réelle, pas une invention).
      light.minTakeoffWeight = light.emptyWeight;
    }
    // 🔧 24/08/2026 — le « 600 » de dernier recours est SUPPRIMÉ (règle
    // pilote : rien, aucun fallback). Ni masse mini ni masse à vide connues :
    // le champ reste ABSENT et le devis refuse.
  }

  // 🔧 FIX CRITIQUE: Créer weightBalance depuis arms si manquant
  // Les anciens avions ont arms mais pas weightBalance
  if (light.arms && (!light.weightBalance || !light.weightBalance.emptyWeightArm)) {
    const parseOrNull = (value) => {
      if (!value || value === '' || value === '0') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    light.weightBalance = {
      frontLeftSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
      frontRightSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
      rearLeftSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
      rearRightSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
      fuelArm: parseOrNull(light.arms.fuelMain) || parseOrNull(light.arms.fuel),
      emptyWeightArm: parseOrNull(light.arms.empty),
      // 🔧 24/08/2026 — BONNES clés (baggageFwd/baggageAft) et AUCUN défaut :
      // les 3,50/3,70 fabriqués ici ont contaminé F-GUVV en base.
      baggageArm: parseOrNull(light.arms.baggageFwd) ?? parseOrNull(light.arms.baggage),
      auxiliaryArm: parseOrNull(light.arms.baggageAft) ?? parseOrNull(light.arms.auxiliaryBaggage),
      cgLimits: (() => {
        const hasValidCgLimits = light.cgLimits &&
          light.cgLimits.forward !== '' &&
          light.cgLimits.aft !== '';

        if (hasValidCgLimits) {
          return light.cgLimits;
        }
        if (light.cgEnvelope) {
          return {
            forward: parseOrNull(light.cgEnvelope.forwardPoints?.[0]?.cg),
            aft: parseOrNull(light.cgEnvelope.aftCG),
            forwardVariable: light.cgEnvelope.forwardPoints || []
          };
        }
        return {
          forward: null,
          aft: null,
          forwardVariable: []
        };
      })()
    };
  }

  return light;
}
