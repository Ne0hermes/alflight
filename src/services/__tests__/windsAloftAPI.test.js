import { describe, it, expect } from 'vitest';
import { sampleWind } from '../windsAloftAPI';

// Profil de test : 2 heures, 3 niveaux (1000/925/850 hPa ≈ 360/2500/4780 ft)
const PROFILE = {
  latitude: 45.0,
  longitude: 5.0,
  source: 'open-meteo',
  fetchedAt: 0,
  hours: [
    {
      timeISO: '2026-08-07T10:00',
      levels: [
        { hpa: 1000, heightFt: 360, directionDeg: 270, speedKt: 10, temperatureC: 20 },
        { hpa: 925, heightFt: 2500, directionDeg: 270, speedKt: 20, temperatureC: 14 },
        { hpa: 850, heightFt: 4780, directionDeg: 270, speedKt: 30, temperatureC: 8 }
      ]
    },
    {
      timeISO: '2026-08-07T11:00',
      levels: [
        { hpa: 1000, heightFt: 360, directionDeg: 90, speedKt: 40, temperatureC: 21 },
        { hpa: 925, heightFt: 2500, directionDeg: 90, speedKt: 40, temperatureC: 15 },
        { hpa: 850, heightFt: 4780, directionDeg: 90, speedKt: 40, temperatureC: 9 }
      ]
    }
  ]
};

describe('sampleWind', () => {
  it('interpole vitesse et température entre deux niveaux', () => {
    // 3640 ft ≈ milieu de 2500-4780 → vitesse ~25 kt, temp ~11 °C
    const w = sampleWind(PROFILE, 3640, new Date('2026-08-07T10:05:00Z'));
    expect(w.directionDeg).toBe(270);
    expect(w.speedKt).toBeGreaterThanOrEqual(24);
    expect(w.speedKt).toBeLessThanOrEqual(26);
    expect(w.temperatureC).toBeGreaterThan(10);
    expect(w.temperatureC).toBeLessThan(12);
    expect(w.source).toBe('open-meteo');
  });

  it('choisit l\'heure la plus proche', () => {
    const w = sampleWind(PROFILE, 2500, new Date('2026-08-07T10:50:00Z'));
    expect(w.directionDeg).toBe(90); // heure 11:00
    expect(w.speedKt).toBe(40);
  });

  it('clampe aux niveaux extrêmes hors enveloppe (pas d\'extrapolation)', () => {
    const low = sampleWind(PROFILE, 100, new Date('2026-08-07T10:00:00Z'));
    expect(low.speedKt).toBe(10);
    const high = sampleWind(PROFILE, 9000, new Date('2026-08-07T10:00:00Z'));
    expect(high.speedKt).toBe(30);
  });

  it('interpolation vectorielle des directions (pas de moyenne naïve 350/010)', () => {
    const profile = {
      ...PROFILE,
      hours: [{
        timeISO: '2026-08-07T10:00',
        levels: [
          { hpa: 1000, heightFt: 0, directionDeg: 350, speedKt: 20, temperatureC: null },
          { hpa: 925, heightFt: 2000, directionDeg: 10, speedKt: 20, temperatureC: null }
        ]
      }]
    };
    const w = sampleWind(profile, 1000, new Date('2026-08-07T10:00:00Z'));
    // Moyenne vectorielle de 350° et 010° = 360°, PAS 180°
    expect(w.directionDeg === 0 || w.directionDeg === 360).toBe(true);
    expect(w.speedKt).toBeGreaterThan(18);
  });

  it('fail-closed : profil vide ou altitude invalide → null', () => {
    expect(sampleWind(null, 3000)).toBeNull();
    expect(sampleWind({ hours: [] }, 3000)).toBeNull();
    expect(sampleWind(PROFILE, 'x')).toBeNull();
  });

  it('hors horizon de prévision (> 3 h de la meilleure heure) → null, pas de vent périmé', () => {
    expect(sampleWind(PROFILE, 2500, new Date('2026-08-12T10:00:00Z'))).toBeNull();
  });
});
