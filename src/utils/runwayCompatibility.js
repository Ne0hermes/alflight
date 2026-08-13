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
  let usedCalculated = false;

  // Forme de données SIA/AIXM actuelle : distances déclarées À PLAT (m) sur la
  // piste (tora/toda/asda/lda), longueur en runway.length. Repli sur la
  // longueur brute si la distance déclarée est absente.
  const todaM = runway.toda ?? runway.length ?? runway.dimensions?.length ?? 0;
  const ldaM = runway.lda ?? runway.length ?? runway.dimensions?.length ?? 0;
  const fLabel = perfDistances?.factorLabel ? `, facteur ${perfDistances.factorLabel}` : '';

  // 🛫 Vérification distance de décollage (TODA)
  const todaFeet = metersToFeet(todaM);
  if (typeof perfDistances?.takeoffM === 'number' && Number.isFinite(perfDistances.takeoffM) && todaM > 0) {
    usedCalculated = true;
    if (todaM < perfDistances.takeoffM) {
      compatible = false;
      reasons.push(`❌ TODA insuffisante: ${Math.round(todaM)} m < ${Math.round(perfDistances.takeoffM)} m requis (calculé, conditions du jour${fLabel})`);
    } else {
      reasons.push(`✅ Décollage: TODA ${Math.round(todaM)} m ≥ ${Math.round(perfDistances.takeoffM)} m requis (calculé${fLabel}) — marge ${Math.round(todaM - perfDistances.takeoffM)} m`);
    }
  } else {
    const requiredTakeoffDistance = aircraft.distances?.takeoffDistance50ft || aircraft.distances?.takeoffDistance15m;
    if (requiredTakeoffDistance && todaFeet > 0) {
      if (todaFeet < requiredTakeoffDistance) {
        compatible = false;
        reasons.push(`❌ TODA insuffisante: ${todaFeet} ft < ${requiredTakeoffDistance} ft requis (POH statique)`);
      }
    }
  }

  // 🛬 Vérification distance d'atterrissage (LDA)
  const ldaFeet = metersToFeet(ldaM);
  if (typeof perfDistances?.landingM === 'number' && Number.isFinite(perfDistances.landingM) && ldaM > 0) {
    usedCalculated = true;
    if (ldaM < perfDistances.landingM) {
      compatible = false;
      reasons.push(`❌ LDA insuffisante: ${Math.round(ldaM)} m < ${Math.round(perfDistances.landingM)} m requis (calculé, conditions du jour${fLabel})`);
    } else {
      reasons.push(`✅ Atterrissage: LDA ${Math.round(ldaM)} m ≥ ${Math.round(perfDistances.landingM)} m requis (calculé${fLabel}) — marge ${Math.round(ldaM - perfDistances.landingM)} m`);
    }
  } else {
    const requiredLandingDistance = aircraft.distances?.landingDistance50ft || aircraft.distances?.landingDistance15m;
    if (requiredLandingDistance && ldaFeet > 0) {
      if (ldaFeet < requiredLandingDistance) {
        compatible = false;
        reasons.push(`❌ LDA insuffisante: ${ldaFeet} ft < ${requiredLandingDistance} ft requis (POH statique)`);
      }
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

  // Message si compatible
  if (compatible && reasons.length === 0) {
    reasons.push(`✅ Piste compatible avec ${aircraft.registration || 'l\'avion'}`);
  }

  return {
    compatible,
    reasons,
    todaFeet,
    ldaFeet,
    usedCalculated,
    surface: surfaceInfo
  };
};
