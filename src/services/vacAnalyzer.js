// src/services/vacAnalyzer.js
export class VACAnalyzer {
  // Analyser la compatibilité avion/piste
  analyzeRunwayCompatibility(aircraft, runway, weather = null) {
    const results = {
      runway: runway.identifier,
      length: runway.length,
      compatible: true,
      warnings: [],
      margins: {}
    };

    // Vérifier les distances
    if (aircraft.performances) {
      const tod = aircraft.performances.takeoffDistance;
      const ld = aircraft.performances.landingDistance;
      
      results.margins.takeoff = ((runway.length - tod) / tod * 100).toFixed(0);
      results.margins.landing = ((runway.length - ld) / ld * 100).toFixed(0);
      
      if (runway.length < tod * 1.15) {
        results.compatible = false;
        results.warnings.push(`Marge décollage insuffisante (${results.margins.takeoff}%)`);
      }
      
      if (runway.length < ld * 1.43) {
        results.warnings.push(`Marge atterrissage limite (${results.margins.landing}%)`);
      }
    }

    // Analyser le vent si disponible
    if (weather && weather.wind) {
      const crosswind = this.calculateCrosswind(
        runway.qfu,
        weather.wind.direction,
        weather.wind.speed
      );
      
      if (crosswind > 15) {
        results.warnings.push(`Vent traversier élevé: ${crosswind}kt`);
      }
    }

    return results;
  }

  calculateCrosswind(runwayHeading, windDirection, windSpeed) {
    const angle = Math.abs(windDirection - runwayHeading);
    const crosswindAngle = angle > 180 ? 360 - angle : angle;
    return Math.abs(windSpeed * Math.sin(crosswindAngle * Math.PI / 180));
  }
}