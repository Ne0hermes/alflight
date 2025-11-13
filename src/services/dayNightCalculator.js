// src/services/dayNightCalculator.js
import SunCalc from 'suncalc';

/**
 * Service de calcul de la nuit aéronautique
 * Nuit aéronautique = Coucher du soleil + 30min → Lever du soleil - 30min
 */

/**
 * Calcule les heures de nuit aéronautique pour une position et date données
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} date - Date du vol
 * @returns {Object} Heures de lever/coucher + nuit aéronautique
 */
export const calculateAeronauticalNight = (lat, lon, date) => {
  const times = SunCalc.getTimes(date, lat, lon);

  // Nuit aéronautique : coucher + 30min, lever - 30min
  const nightStart = new Date(times.sunset.getTime() + 30 * 60 * 1000);
  const nightEnd = new Date(times.sunrise.getTime() - 30 * 60 * 1000);

  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    nightStart, // Début nuit aéronautique (sunset + 30min)
    nightEnd,   // Fin nuit aéronautique (sunrise - 30min)
    civilTwilight: {
      start: times.dusk,  // Début crépuscule civil
      end: times.dawn     // Fin crépuscule civil
    },
    nauticalTwilight: {
      start: times.nauticalDusk,
      end: times.nauticalDawn
    }
  };
};

/**
 * Détermine si une heure donnée est de jour, crépuscule ou nuit
 * @param {Date} time - Heure à vérifier
 * @param {Object} sunTimes - Résultat de calculateAeronauticalNight
 * @returns {string} 'day' | 'twilight' | 'night'
 */
export const getDayNightStatus = (time, sunTimes) => {
  if (!time || !sunTimes) return 'day';

  const timeMs = time.getTime();

  // Nuit aéronautique
  if (timeMs >= sunTimes.nightStart.getTime() || timeMs <= sunTimes.nightEnd.getTime()) {
    return 'night';
  }

  // Crépuscule (entre sunset et nightStart, ou entre nightEnd et sunrise)
  if (
    (timeMs >= sunTimes.sunset.getTime() && timeMs < sunTimes.nightStart.getTime()) ||
    (timeMs > sunTimes.nightEnd.getTime() && timeMs <= sunTimes.sunrise.getTime())
  ) {
    return 'twilight';
  }

  // Jour
  return 'day';
};

/**
 * Formate une heure en HH:MM
 * @param {Date} date - Date à formater
 * @returns {string} Heure au format HH:MM
 */
export const formatTime = (date) => {
  if (!date) return '--:--';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Parse une heure HH:MM en Date pour une journée donnée
 * @param {string} timeString - Heure au format HH:MM
 * @param {Date} date - Date de référence
 * @returns {Date} Date complète
 */
export const parseTimeString = (timeString, date) => {
  if (!timeString || !timeString.includes(':')) return null;

  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);

  return result;
};

/**
 * Vérifie si un segment de vol traverse la nuit aéronautique
 * @param {Date} departureTime - Heure de départ du segment
 * @param {Date} arrivalTime - Heure d'arrivée du segment
 * @param {Object} sunTimes - Résultat de calculateAeronauticalNight
 * @returns {Object} Informations sur le segment
 */
export const analyzeSegmentDayNight = (departureTime, arrivalTime, sunTimes) => {
  if (!departureTime || !arrivalTime || !sunTimes) {
    return { status: 'unknown', warning: false };
  }

  const depStatus = getDayNightStatus(departureTime, sunTimes);
  const arrStatus = getDayNightStatus(arrivalTime, sunTimes);

  return {
    departure: depStatus,
    arrival: arrStatus,
    status: arrStatus, // Status à l'arrivée (le plus critique)
    warning: depStatus === 'day' && arrStatus === 'night', // Passe du jour à la nuit
    twilightWarning: depStatus === 'day' && arrStatus === 'twilight'
  };
};

/**
 * Calcule les statistiques jour/nuit pour un vol complet
 * @param {Array} segments - Tableau de segments avec departureTime et arrivalTime
 * @param {Object} sunTimes - Résultat de calculateAeronauticalNight
 * @returns {Object} Statistiques du vol
 */
export const analyzeFlightDayNight = (segments, sunTimes) => {
  if (!segments || !segments.length || !sunTimes) {
    return { hasNightSegments: false, hasTwilightSegments: false, warnings: [] };
  }

  const analysis = segments.map(seg => analyzeSegmentDayNight(seg.departureTime, seg.arrivalTime, sunTimes));

  const hasNightSegments = analysis.some(a => a.status === 'night');
  const hasTwilightSegments = analysis.some(a => a.status === 'twilight');
  const warnings = analysis
    .map((a, idx) => ({ ...a, segmentIndex: idx }))
    .filter(a => a.warning || a.twilightWarning);

  return {
    hasNightSegments,
    hasTwilightSegments,
    warnings,
    analysis
  };
};
