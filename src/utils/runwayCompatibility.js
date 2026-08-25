// src/utils/runwayCompatibility.js
//
// Verdict de compatibilité piste ↔ avion — LOGIQUE PURE (sans UI, testable,
// candidate à l'extraction dans le futur @alflight/calc-engine).
//
// PRIORITÉ AUX DISTANCES CALCULÉES : si `perfDistances` est fourni (issues du
// moteur de performances — conditions du jour, facteur de sécurité inclus, en
// MÈTRES), la comparaison se fait en mètres contre TODA/LDA déclarées. Sinon,
// repli sur les distances POH STATIQUES de la fiche avion (ft, conditions
// standard) — comportement historique, signalé comme tel dans les motifs.

import { isSurfaceCompatible } from './runwaySurface';

export const SURFACE_TYPES = {
  'ASPH': { name: 'Asphalte', icon: '🛣️', quality: 1 },
  'CONC': { name: 'Béton', icon: '🏗️', quality: 1 },
  'GRASS': { name: 'Herbe', icon: '🌿', quality: 0.8 },
  'GRAVEL': { name: 'Gravier', icon: '🪨', quality: 0.7 },
  'SAND': { name: 'Sable', icon: '🏖️', quality: 0.6 },
  'DIRT': { name: 'Terre', icon: '🟫', quality: 0.6 },
  'WATER': { name: 'Eau', icon: '💧', quality: 0 },
  'SNOW': { name: 'Neige', icon: '❄️', quality: 0.5 },
  'ICE': { name: 'Glace', icon: '🧊', quality: 0.3 }
};

export const metersToFeet = (meters) => Math.round(meters * 3.28084);

/**
 * @param {object} runway  piste SIA/AIXM (distances À PLAT en m : tora/toda/asda/lda, surface chaîne)
 * @param {object} aircraft fiche avion (distances POH statiques en ft, compatibleRunwaySurfaces)
 * @param {object|null} perfDistances { takeoffM, landingM, factorLabel } — distances calculées (m)
 */
export const analyzeRunwayCompatibility = (runway, aircraft, perfDistances = null) => {
  if (!aircraft) {
    return { compatible: 'unknown', reasons: ['Avion non sélectionné'] };
  }

  const reasons = [];
  let compatible = true;
  let unknownDistances = false;
  let usedCalculated = false;

  // ⛔ Lot 1.0 (tranche 3, 25/08) : TODA/LDA STRICTES — plus jamais la longueur
  // physique prise pour une distance déclarée, plus jamais un 0 qui éteint le
  // contrôle (une piste SANS AUCUNE donnée sortait « ✅ compatible »).
  // La LDA est ≤ longueur dès qu'un seuil est décalé (LFON 22 : LDA 650 m pour
  // 720 m de longueur) : substituer la longueur OFFRAIT de la piste inexistante.
  // La longueur physique ne sert plus qu'à DÉCLENCHER un NO-GO conservateur
  // (elle majore TODA-utilisable et LDA), jamais à valider un GO.
  const todaM = Number.isFinite(runway.toda) ? runway.toda : null;
  const ldaM = Number.isFinite(runway.lda) ? runway.lda : null;
  const lengthM = Number.isFinite(runway.length)
    ? runway.length
    : (Number.isFinite(runway.dimensions?.length) ? runway.dimensions.length : null);
  const fLabel = perfDistances?.factorLabel ? `, facteur ${perfDistances.factorLabel}` : '';

  // 🛫 Vérification distance de décollage (TODA)
  const todaFeet = todaM != null ? metersToFeet(todaM) : null;
  const requiredTakeoffM = (typeof perfDistances?.takeoffM === 'number' && Number.isFinite(perfDistances.takeoffM))
    ? perfDistances.takeoffM : null;
  if (requiredTakeoffM != null && todaM != null) {
    usedCalculated = true;
    if (todaM < requiredTakeoffM) {
      compatible = false;
      reasons.push(`❌ TODA insuffisante: ${Math.round(todaM)} m < ${Math.round(requiredTakeoffM)} m requis (calculé, conditions du jour${fLabel})`);
    } else {
      reasons.push(`✅ Décollage: TODA ${Math.round(todaM)} m ≥ ${Math.round(requiredTakeoffM)} m requis (calculé${fLabel}) — marge ${Math.round(todaM - requiredTakeoffM)} m`);
    }
  } else if (todaM != null) {
    const requiredTakeoffDistance = aircraft.distances?.takeoffDistance50ft || aircraft.distances?.takeoffDistance15m;
    if (requiredTakeoffDistance && todaFeet < requiredTakeoffDistance) {
      compatible = false;
      reasons.push(`❌ TODA insuffisante: ${todaFeet} ft < ${requiredTakeoffDistance} ft requis (POH statique)`);
    } else if (!requiredTakeoffDistance) {
      // ⛔ Revue 25/08 : le besoin AVION inconnu (ni calcul du jour, ni POH)
      // sortait « ✅ compatible » sans qu'AUCUNE distance n'ait été comparée.
      unknownDistances = true;
      reasons.push('⚠️ Distance de décollage requise inconnue (fiche avion sans POH, performances non calculées) — compatibilité décollage NON VÉRIFIABLE');
    }
  } else {
    unknownDistances = true;
    reasons.push('⚠️ TODA non publiée pour cette piste — compatibilité décollage NON VÉRIFIABLE, consultez la carte VAC');
    // NO-GO conservateur : la longueur physique majore la distance disponible.
    if (requiredTakeoffM != null && lengthM != null && lengthM < requiredTakeoffM) {
      compatible = false;
      reasons.push(`❌ Longueur physique ${Math.round(lengthM)} m < ${Math.round(requiredTakeoffM)} m requis au décollage (TODA non publiée — hypothèse conservatrice, à vérifier sur la carte VAC)`);
    }
  }

  // 🛬 Vérification distance d'atterrissage (LDA)
  const ldaFeet = ldaM != null ? metersToFeet(ldaM) : null;
  const requiredLandingM = (typeof perfDistances?.landingM === 'number' && Number.isFinite(perfDistances.landingM))
    ? perfDistances.landingM : null;
  if (requiredLandingM != null && ldaM != null) {
    usedCalculated = true;
    if (ldaM < requiredLandingM) {
      compatible = false;
      reasons.push(`❌ LDA insuffisante: ${Math.round(ldaM)} m < ${Math.round(requiredLandingM)} m requis (calculé, conditions du jour${fLabel})`);
    } else {
      reasons.push(`✅ Atterrissage: LDA ${Math.round(ldaM)} m ≥ ${Math.round(requiredLandingM)} m requis (calculé${fLabel}) — marge ${Math.round(ldaM - requiredLandingM)} m`);
    }
  } else if (ldaM != null) {
    const requiredLandingDistance = aircraft.distances?.landingDistance50ft || aircraft.distances?.landingDistance15m;
    if (requiredLandingDistance && ldaFeet < requiredLandingDistance) {
      compatible = false;
      reasons.push(`❌ LDA insuffisante: ${ldaFeet} ft < ${requiredLandingDistance} ft requis (POH statique)`);
    } else if (!requiredLandingDistance) {
      unknownDistances = true;
      reasons.push('⚠️ Distance d\'atterrissage requise inconnue (fiche avion sans POH, performances non calculées) — compatibilité atterrissage NON VÉRIFIABLE');
    }
  } else {
    unknownDistances = true;
    reasons.push('⚠️ LDA non publiée pour cette piste — compatibilité atterrissage NON VÉRIFIABLE, consultez la carte VAC');
    if (requiredLandingM != null && lengthM != null && lengthM < requiredLandingM) {
      compatible = false;
      reasons.push(`❌ Longueur physique ${Math.round(lengthM)} m < ${Math.round(requiredLandingM)} m requis à l'atterrissage (LDA non publiée — la LDA réelle est ≤ à la longueur)`);
    }
  }

  // 🏗️ Vérification surface de piste — surface est désormais une chaîne directe
  const surfaceRaw = typeof runway.surface === 'string' ? runway.surface : (runway.surface?.type || 'UNKNOWN');
  const surfaceInfo = SURFACE_TYPES[surfaceRaw] || { name: surfaceRaw, icon: '❓', quality: 0.5 };

  // Utiliser compatibleRunwaySurfaces depuis les données d'avion
  if (aircraft.compatibleRunwaySurfaces && aircraft.compatibleRunwaySurfaces.length > 0) {
    if (!isSurfaceCompatible(runway.surface, aircraft.compatibleRunwaySurfaces)) {
      compatible = false;
      reasons.push(`❌ Surface ${surfaceInfo.name || surfaceRaw} non autorisée pour cet avion`);
    } else {
      // Surface autorisée mais performances réduites si qualité < 0.8
      if (surfaceInfo.quality < 0.8) {
        reasons.push(`⚠️ Surface ${surfaceInfo.name} autorisée - performances réduites (${Math.round(surfaceInfo.quality * 100)}%)`);
      }
    }
  } else {
    // Pas de restriction définie - avertissement si surface de faible qualité
    if (surfaceInfo.quality < 0.8) {
      reasons.push(`⚠️ Surface ${surfaceInfo.name} - performances réduites (${Math.round(surfaceInfo.quality * 100)}%)`);
    }
  }

  // ⛔ Verdict à TROIS états : false (démontré incompatible) prime ; sinon une
  // distance non publiée = 'unknown' (jamais un GO sur une absence de donnée).
  const verdict = compatible === false ? false : (unknownDistances ? 'unknown' : true);

  // Message si compatible (verdict STRICTEMENT vrai — 'unknown' ne l'est pas)
  if (verdict === true && reasons.length === 0) {
    reasons.push(`✅ Piste compatible avec ${aircraft.registration || 'l\'avion'}`);
  }

  return {
    compatible: verdict,
    reasons,
    todaFeet,   // null si TODA non publiée (plus jamais un 0 fabriqué)
    ldaFeet,    // null si LDA non publiée
    usedCalculated,
    surface: surfaceInfo
  };
};
