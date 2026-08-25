// src/features/navigation/utils/windSampling.js
// ============================================================================
// ⛔ Lot 1.0 (tranche 3, 25/08/2026) — PROVIDER DE VENT PARTAGÉ, à l'altitude
// réellement saisie.
// ----------------------------------------------------------------------------
// Le vent qui corrige les temps (donc le carburant) était lu à 3000 ft EN DUR
// et à l'instant du rendu — trois copies de la même constante (effectiveSpeed,
// navigationStore, useNavigationResults) — pendant que le tableau de
// navigation, lui, échantillonnait à l'altitude SAISIE par tronçon : deux
// vents contradictoires dans la même app (Lot 0.4 refermé à moitié).
// Ce provider applique la règle du tableau : altitude du tronçon
// (segmentAltitudes[id].startAlt), sinon l'altitude globale du vol
// (flightParams.altitude), sinon le défaut historique 3000 ft.
// ============================================================================
import { useWindsAloftStore } from '@core/stores/windsAloftStore';

export const DEFAULT_WIND_ALT_FT = 3000;

/** Identifiant de tronçon — MÊME règle que VFRNavigationTable (sinon les deux
 *  vents divergent à nouveau) : `${from.id||from.name}-${to.id||to.name}`. */
const segmentId = (from, to) => `${from?.id || from?.name}-${to?.id || to?.name}`;

/**
 * Provider (lat, lon, ctx) pour computeRouteWindTimes.
 * `ctx` ({from, to}) est fourni par le moteur pour résoudre l'altitude du
 * tronçon ; sans lui, repli sur l'altitude globale du vol.
 *
 * @param {object}  [o]
 * @param {object}  [o.segmentAltitudes] - navigationStore.segmentAltitudes
 * @param {number}  [o.defaultAltFt]     - flightParams.altitude (repli global)
 * @param {Date}    [o.when]             - instant d'échantillonnage (heure de
 *   départ prévue quand l'appelant la connaît). ⚠️ Divergence RÉSIDUELLE :
 *   sans `when`, on échantillonne à MAINTENANT alors que le tableau de nav
 *   échantillonne à l'heure de départ théorique — l'alignement complet attend
 *   la plomberie flightDate/departureTimeTheoretical vers ces appelants.
 */
export const makeRouteWindProvider = ({ segmentAltitudes, defaultAltFt, when } = {}) => {
  const baseAltFt = Number.isFinite(parseFloat(defaultAltFt)) && parseFloat(defaultAltFt) > 0
    ? parseFloat(defaultAltFt)
    : DEFAULT_WIND_ALT_FT;
  const sampleTime = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date();
  return (lat, lon, ctx) => {
    let altFt = baseAltFt;
    if (ctx?.from && ctx?.to) {
      const seg = segmentAltitudes?.[segmentId(ctx.from, ctx.to)];
      const alt = parseFloat(seg?.startAlt);
      if (Number.isFinite(alt) && alt > 0) altFt = alt;
    }
    return useWindsAloftStore.getState().getWindAt(lat, lon, altFt, sampleTime);
  };
};
