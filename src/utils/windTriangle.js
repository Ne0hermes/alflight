// src/utils/windTriangle.js
// Triangle des vents — source UNIQUE (Lot 6-B). Remplace les duplications
// approchées de VFRNavigationTable et WindAnalysis.
// Conventions : caps/directions en degrés vrais, windDirection = direction
// D'OÙ vient le vent (convention météo), vitesses en kt.
// Formule EXACTE : GS = TAS·cos(WCA) − composante de face (l'approximation
// GS = TAS − headwind surestime la GS par vent traversier fort).
// Fail-closed : null si le segment n'est pas tenable (vent traversier > TAS)
// ou entrées invalides — jamais de valeur inventée.

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/**
 * @param {number} trueCourse - route vraie à suivre (°)
 * @param {number} tas - vitesse propre (kt)
 * @param {number} windDirection - direction d'où vient le vent (° vrai)
 * @param {number} windSpeed - vitesse du vent (kt)
 * @returns {{ windCorrectionAngle:number, headingTrue:number, groundSpeed:number,
 *            headwind:number, crosswind:number } | null}
 */
export function solveWindTriangle(trueCourse, tas, windDirection, windSpeed) {
  const tc = parseFloat(trueCourse);
  const v = parseFloat(tas);
  const wd = parseFloat(windDirection);
  const ws = parseFloat(windSpeed);
  if (!Number.isFinite(tc) || !Number.isFinite(v) || v <= 0) return null;

  if (!Number.isFinite(ws) || ws <= 0) {
    // Pas de vent : triangle dégénéré mais résoluble
    return {
      windCorrectionAngle: 0,
      headingTrue: ((tc % 360) + 360) % 360,
      groundSpeed: v,
      headwind: 0,
      crosswind: 0
    };
  }
  // ⚠️ Vitesse de vent VALIDE mais direction invalide : donnée mal formée —
  // null (fail-closed), pas un « vent calme » silencieux qui surestimerait la GS
  if (!Number.isFinite(wd)) return null;

  const windAngle = toRad(wd - tc);
  const headwind = ws * Math.cos(windAngle);   // >0 = vent de face
  const crosswind = ws * Math.sin(windAngle);  // >0 = vent de la droite

  const sinWca = crosswind / v;
  if (Math.abs(sinWca) > 1) return null;       // vent traversier > TAS : intenable

  const wcaRad = Math.asin(sinWca);
  const groundSpeed = v * Math.cos(wcaRad) - headwind;
  if (groundSpeed <= 0) return null;           // vent de face ≥ TAS : intenable

  return {
    windCorrectionAngle: toDeg(wcaRad),
    headingTrue: (((tc + toDeg(wcaRad)) % 360) + 360) % 360,
    groundSpeed,
    headwind,
    crosswind
  };
}
