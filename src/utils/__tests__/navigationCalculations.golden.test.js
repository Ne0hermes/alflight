// TESTS D'OR (caractérisation) — src/utils/navigationCalculations.js
// PHASE 2 : ces tests FIGENT le comportement ACTUEL du module avant son déplacement
// dans un paquet autonome. Ils décrivent ce que le code FAIT, pas ce qu'il DEVRAIT faire.
// Plusieurs valeurs figées ici sont discutables (voir les commentaires « DÉFAUT FIGÉ ») :
// elles sont volontairement conservées telles quelles. Toute correction devra casser
// ces tests DÉLIBÉRÉMENT, jamais par accident.
import { describe, it, expect } from 'vitest';
import {
  toRad,
  toDeg,
  calculateDistance,
  calculateBearing,
  calculateTotalDistance,
  calculateFlightTime,
  calculateFuelRequired,
  calculateDestination,
  calculateMidpoint,
  parseCoordinate,
  interpolatePosition,
  calculateDistanceToSegment,
  calculatePerpendicular,
  getSideOfPerpendicular,
  isPointInPolygon,
  NavigationCalculations,
} from '../navigationCalculations';
import navDefault from '../navigationCalculations';

// Points de référence réels (aérodromes français)
const LFPG = { lat: 49.0097, lon: 2.5479 }; // Paris CDG
const LFPO = { lat: 48.7233, lon: 2.3794 }; // Paris Orly
const LFBO = { lat: 43.6293, lon: 1.3638 }; // Toulouse Blagnac

const EARTH_RADIUS_NM = 3440.065;

describe("toRad / toDeg — conversions d'unités", () => {
  it('convertit degrés → radians avec les valeurs exactes', () => {
    expect(toRad(180)).toBe(Math.PI);
    expect(toRad(0)).toBe(0);
    expect(toRad(-90)).toBe(-Math.PI / 2);
    expect(toRad(90)).toBeCloseTo(Math.PI / 2, 15);
    expect(toRad(1)).toBeCloseTo(0.017453292519943295, 15);
  });

  it('convertit radians → degrés avec les valeurs exactes', () => {
    expect(toDeg(Math.PI)).toBe(180);
    expect(toDeg(0)).toBe(0);
    expect(toDeg(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(toDeg(1)).toBeCloseTo(57.29577951308232, 12);
  });

  it('aller-retour deg → rad → deg conservé', () => {
    expect(toDeg(toRad(48.8566))).toBeCloseTo(48.8566, 12);
  });

  it('AUCUNE garde sur les entrées : coercition JS brute', () => {
    // DÉFAUT FIGÉ : null est coercé en 0 (null * n === 0), undefined donne NaN.
    expect(toRad(null)).toBe(0);
    expect(toDeg(null)).toBe(0);
    expect(toRad(undefined)).toBeNaN();
    expect(toDeg(NaN)).toBeNaN();
    expect(toRad('abc')).toBeNaN();
    // Une chaîne numérique est coercée silencieusement
    expect(toRad('90')).toBeCloseTo(Math.PI / 2, 15);
  });
});

describe('calculateDistance — orthodromie Haversine (R = 3440.065 NM)', () => {
  it('CDG → Orly : 18.43846037045722 NM (signature 4 nombres)', () => {
    expect(calculateDistance(49.0097, 2.5479, 48.7233, 2.3794)).toBeCloseTo(18.43846037045722, 10);
  });

  it('CDG → Toulouse : 326.74011284655626 NM', () => {
    expect(calculateDistance(49.0097, 2.5479, 43.6293, 1.3638)).toBeCloseTo(326.74011284655626, 10);
  });

  it('signature « deux objets » : mêmes valeurs que la signature « 4 nombres »', () => {
    expect(calculateDistance(LFPG, LFPO)).toBeCloseTo(18.43846037045722, 10);
    expect(calculateDistance(LFPG, LFPO)).toBe(calculateDistance(49.0097, 2.5479, 48.7233, 2.3794));
  });

  it('accepte lng comme repli de lon dans les objets', () => {
    expect(calculateDistance({ lat: 49.0097, lng: 2.5479 }, { lat: 48.7233, lng: 2.3794 })).toBeCloseTo(
      18.43846037045722,
      10,
    );
  });

  it('1° de latitude = 60.04046073261873 NM (= R × π/180)', () => {
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo(60.04046073261873, 10);
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo((EARTH_RADIUS_NM * Math.PI) / 180, 10);
  });

  it("1° de longitude vaut 60.04 NM à l'équateur et 30.02 NM à 60°N (cos φ)", () => {
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(60.04046073261873, 10);
    expect(calculateDistance(60, 0, 60, 1)).toBeCloseTo(30.019944593539357, 10);
  });

  it('point identique → 0 exact', () => {
    expect(calculateDistance(48, 2, 48, 2)).toBe(0);
  });

  it('pôle à pôle = 10807.282931871372 NM (= R × π)', () => {
    expect(calculateDistance(-90, 0, 90, 0)).toBeCloseTo(10807.282931871372, 9);
    expect(calculateDistance(-90, 0, 90, 0)).toBeCloseTo(EARTH_RADIUS_NM * Math.PI, 9);
  });

  it("franchit l'antiméridien correctement (179°E → 179°W = 2°)", () => {
    expect(calculateDistance(0, 179, 0, -179)).toBeCloseTo(120.08092146523697, 10);
  });

  it('chaînes numériques coercées silencieusement', () => {
    expect(calculateDistance('0', '0', '1', '0')).toBeCloseTo(60.04046073261873, 10);
  });

  it('NaN / undefined → NaN (aucune validation)', () => {
    expect(calculateDistance(NaN, 0, 1, 1)).toBeNaN();
    expect(calculateDistance(undefined, undefined, 1, 1)).toBeNaN();
  });

  it('DÉFAUT FIGÉ : null en 1er et 2e argument LÈVE un TypeError (typeof null === "object")', () => {
    expect(() => calculateDistance(null, null, 0, 1)).toThrow(TypeError);
  });

  it('DÉFAUT FIGÉ : objet + nombre mélangés → NaN silencieux (pas de branche objet)', () => {
    expect(calculateDistance(LFPG, 2.5, 48, 2)).toBeNaN();
  });
});

describe('calculateDistance — cache de module (Map, 1000 entrées)', () => {
  it('un même appel répété rend STRICTEMENT la même valeur', () => {
    const a = calculateDistance(10.123456, 20.123456, 11.5, 21.5);
    const b = calculateDistance(10.123456, 20.123456, 11.5, 21.5);
    const c = calculateDistance(10.123456, 20.123456, 11.5, 21.5);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBeCloseTo(115.8480794210607, 10);
  });

  it("le cache ne fausse pas les résultats : chaque couple de points garde SA distance", () => {
    const cdgOrly = calculateDistance(LFPG, LFPO);
    const cdgToulouse = calculateDistance(LFPG, LFBO);
    expect(cdgOrly).toBeCloseTo(18.43846037045722, 10);
    expect(cdgToulouse).toBeCloseTo(326.74011284655626, 10);
    expect(cdgOrly).not.toBe(cdgToulouse);
    // ré-appels croisés : toujours les mêmes valeurs
    expect(calculateDistance(LFPG, LFBO)).toBe(cdgToulouse);
    expect(calculateDistance(LFPG, LFPO)).toBe(cdgOrly);
  });

  it('la voie « objets » et la voie « 4 nombres » partagent la même entrée de cache', () => {
    expect(calculateDistance(LFPG, LFPO)).toBe(calculateDistance(49.0097, 2.5479, 48.7233, 2.3794));
  });

  it("chaîne et nombre produisent la MÊME clé de cache (template littéral) — résultat identique ici", () => {
    expect(calculateDistance('0', '0', '1', '0')).toBe(calculateDistance(0, 0, 1, 0));
  });

  it("l'éviction FIFO au-delà de 1000 entrées ne change AUCUN résultat", () => {
    const avant = calculateDistance(49.0097, 2.5479, 48.7233, 2.3794);
    // On sature le cache avec 1200 clés inédites → éviction de la plus ancienne à chaque insertion
    for (let i = 0; i < 1200; i++) calculateDistance(70 + i * 0.001, 0, 1, 1);
    const apres = calculateDistance(49.0097, 2.5479, 48.7233, 2.3794);
    expect(apres).toBe(avant);
    expect(apres).toBeCloseTo(18.43846037045722, 10);
  });
});

describe('calculateBearing — cap vrai (0-360°)', () => {
  it('CDG → Orly : 201.2208231860932°', () => {
    expect(calculateBearing(49.0097, 2.5479, 48.7233, 2.3794)).toBeCloseTo(201.2208231860932, 10);
  });

  it('caps cardinaux exacts', () => {
    expect(calculateBearing(0, 0, 1, 0)).toBe(0); // Nord
    expect(calculateBearing(0, 0, 0, 1)).toBe(90); // Est
    expect(calculateBearing(1, 0, 0, 0)).toBe(180); // Sud
    expect(calculateBearing(0, 0, 0, -1)).toBe(270); // Ouest
  });

  it('normalisé dans [0, 360[ : jamais de valeur négative', () => {
    expect(calculateBearing(48, 2, 47, 1)).toBeCloseTo(214.41224417200058, 10);
    expect(calculateBearing(0, 0, 0, -1)).toBeGreaterThanOrEqual(0);
    expect(calculateBearing(0, 0, 0, -1)).toBeLessThan(360);
  });

  it("orthodromie : le cap NE de (0,0) vers (1,1) n'est PAS 45° pile", () => {
    expect(calculateBearing(0, 0, 1, 1)).toBeCloseTo(44.99563645534488, 10);
    expect(calculateBearing(48, 2, 49, 3)).toBeCloseTo(33.15576145838139, 10);
  });

  it('point identique → 0 (atan2(0,0) === 0)', () => {
    expect(calculateBearing(48, 2, 48, 2)).toBe(0);
  });

  it('signature « deux objets », lng accepté comme repli', () => {
    expect(calculateBearing(LFPG, LFPO)).toBeCloseTo(201.2208231860932, 10);
    expect(calculateBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBe(90);
  });

  it('NaN → NaN ; null en 1er/2e argument LÈVE un TypeError', () => {
    expect(calculateBearing(NaN, 0, 1, 1)).toBeNaN();
    expect(() => calculateBearing(null, null, 1, 1)).toThrow(TypeError);
  });

  it("calculateBearing n'utilise AUCUN cache : appel répété identique quand même", () => {
    expect(calculateBearing(LFPG, LFBO)).toBe(calculateBearing(LFPG, LFBO));
  });
});

describe('calculateTotalDistance — cumul le long de la route', () => {
  it('route à 3 waypoints : somme des tronçons = 327.17719078619723 NM', () => {
    expect(calculateTotalDistance([LFPG, LFPO, LFBO])).toBeCloseTo(327.17719078619723, 10);
    expect(calculateTotalDistance([LFPG, LFPO, LFBO])).toBeCloseTo(
      calculateDistance(LFPG, LFPO) + calculateDistance(LFPO, LFBO),
      10,
    );
  });

  it('route à 2 waypoints = distance simple', () => {
    expect(calculateTotalDistance([LFPG, LFPO])).toBeCloseTo(18.43846037045722, 10);
  });

  it('replis : moins de 2 waypoints, null ou undefined → 0', () => {
    expect(calculateTotalDistance([])).toBe(0);
    expect(calculateTotalDistance([LFPG])).toBe(0);
    expect(calculateTotalDistance(null)).toBe(0);
    expect(calculateTotalDistance(undefined)).toBe(0);
  });

  it("DÉFAUT FIGÉ : ne lit QUE .lon — des waypoints en .lng donnent NaN (pas de repli ?? .lng ici)", () => {
    expect(calculateTotalDistance([{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }])).toBeNaN();
  });

  it('DÉFAUT FIGÉ : une chaîne de longueur ≥ 2 passe la garde et donne NaN', () => {
    expect(calculateTotalDistance('ab')).toBeNaN();
  });
});

describe('calculateFlightTime — temps de vol en heures', () => {
  it('cas nominal : distance / vitesse sol', () => {
    expect(calculateFlightTime(100, 100)).toBe(1);
    expect(calculateFlightTime(150, 100)).toBe(1.5);
    expect(calculateFlightTime(326.74011284655626, 110)).toBeCloseTo(2.970364662241421, 10);
  });

  it('repli : vitesse sol nulle, négative, null, undefined ou NaN → 0', () => {
    expect(calculateFlightTime(100, 0)).toBe(0);
    expect(calculateFlightTime(100, -50)).toBe(0);
    expect(calculateFlightTime(100, null)).toBe(0);
    expect(calculateFlightTime(100, undefined)).toBe(0);
    expect(calculateFlightTime(100, NaN)).toBe(0);
  });

  it("la distance n'est PAS validée : NaN et distance négative traversent la fonction", () => {
    expect(calculateFlightTime(NaN, 100)).toBeNaN();
    expect(calculateFlightTime(undefined, 100)).toBeNaN();
    // DÉFAUT FIGÉ : une distance négative rend un temps de vol négatif
    expect(calculateFlightTime(-100, 100)).toBe(-1);
  });

  it('une vitesse sol en chaîne "100" est coercée (garde <= 0 passée)', () => {
    expect(calculateFlightTime(100, '100')).toBe(1);
  });
});

describe('calculateFuelRequired — carburant requis', () => {
  it('cas nominal : temps × consommation', () => {
    expect(calculateFuelRequired(2, 30)).toBe(60);
    expect(calculateFuelRequired(1.5, 24.5)).toBeCloseTo(36.75, 10);
  });

  it('repli : consommation nulle, négative, null ou NaN → 0', () => {
    expect(calculateFuelRequired(2, 0)).toBe(0);
    expect(calculateFuelRequired(2, -30)).toBe(0);
    expect(calculateFuelRequired(2, null)).toBe(0);
    expect(calculateFuelRequired(2, undefined)).toBe(0);
    expect(calculateFuelRequired(2, NaN)).toBe(0);
  });

  it("le temps n'est PAS validé : NaN passe, un temps négatif rend un carburant négatif", () => {
    expect(calculateFuelRequired(undefined, 30)).toBeNaN();
    expect(calculateFuelRequired(NaN, 30)).toBeNaN();
    // DÉFAUT FIGÉ
    expect(calculateFuelRequired(-2, 30)).toBe(-60);
  });
});

describe('calculateDestination — point à distance et cap donnés', () => {
  it('60 NM plein nord depuis (0,0) → lat 0.9993261088918203, lon 0', () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, 60, 0);
    expect(d.lat).toBeCloseTo(0.9993261088918203, 12);
    expect(d.lon).toBe(0);
  });

  it("60 NM plein est depuis (0,0) → lon 0.99932610889182, lat ≈ 0", () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, 60, 90);
    expect(d.lon).toBeCloseTo(0.99932610889182, 12);
    expect(d.lat).toBeCloseTo(0, 12); // 6.118797361618043e-17, pas 0 exact
  });

  it('60 NM plein sud depuis (0,0) → lat négative symétrique', () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, 60, 180);
    expect(d.lat).toBeCloseTo(-0.9993261088918203, 12);
    expect(d.lon).toBeCloseTo(0, 12);
  });

  it('CDG + 100 NM au 045° → {50.173066469860956, 4.386787066571077}', () => {
    const d = calculateDestination(LFPG, 100, 45);
    expect(d.lat).toBeCloseTo(50.173066469860956, 10);
    expect(d.lon).toBeCloseTo(4.386787066571077, 10);
  });

  it('aller-retour cohérent : distance et cap retrouvés', () => {
    const d = calculateDestination(LFPG, 100, 45);
    expect(calculateDistance(LFPG, d)).toBeCloseTo(100, 8);
    expect(calculateBearing(LFPG, d)).toBeCloseTo(45, 8);
  });

  it('distance nulle → le point de départ (à l\'epsilon flottant près)', () => {
    const d = calculateDestination(LFPG, 0, 123);
    expect(d.lat).toBeCloseTo(49.0097, 12);
    expect(d.lon).toBe(2.5479);
  });

  it('cap 360° équivalent au cap 0°', () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, 60, 360);
    expect(d.lat).toBeCloseTo(0.9993261088918203, 12);
    expect(d.lon).toBeCloseTo(0, 12);
  });

  it('accepte lng comme repli de lon', () => {
    const d = calculateDestination({ lat: 0, lng: 10 }, 60, 90);
    expect(d.lon).toBeCloseTo(10.99932610889182, 12);
  });

  it('DÉFAUT FIGÉ : distance négative acceptée → se déplace au cap opposé', () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, -60, 0);
    expect(d.lat).toBeCloseTo(-0.9993261088918203, 12);
    expect(d.lon).toBe(0);
  });

  it('NaN → {NaN, NaN} ; origine undefined LÈVE un TypeError', () => {
    const d = calculateDestination({ lat: 0, lon: 0 }, NaN, 0);
    expect(d.lat).toBeNaN();
    expect(d.lon).toBeNaN();
    expect(() => calculateDestination(undefined, 60, 0)).toThrow(TypeError);
  });
});

describe('calculateMidpoint — point médian orthodromique', () => {
  it("(0,0) → (0,10) : milieu à 5° de longitude sur l'équateur", () => {
    const m = calculateMidpoint({ lat: 0, lon: 0 }, { lat: 0, lon: 10 });
    expect(m.lat).toBe(0);
    expect(m.lon).toBeCloseTo(4.999999999999999, 12);
  });

  it('CDG / Orly → {48.86653068924207, 2.463408906553241}', () => {
    const m = calculateMidpoint(LFPG, LFPO);
    expect(m.lat).toBeCloseTo(48.86653068924207, 10);
    expect(m.lon).toBeCloseTo(2.463408906553241, 10);
  });

  it('CDG / Toulouse → {46.32102415025405, 1.926718328778621}', () => {
    const m = calculateMidpoint(LFPG, LFBO);
    expect(m.lat).toBeCloseTo(46.32102415025405, 10);
    expect(m.lon).toBeCloseTo(1.926718328778621, 10);
  });

  it('deux fois le même point → ce point', () => {
    const m = calculateMidpoint(LFPG, LFPG);
    expect(m.lat).toBeCloseTo(49.0097, 12);
    expect(m.lon).toBeCloseTo(2.5479, 12);
  });

  it('accepte lng comme repli de lon', () => {
    const m = calculateMidpoint({ lat: 0, lng: 0 }, { lat: 10, lng: 0 });
    expect(m.lat).toBeCloseTo(4.999999999999999, 12);
    expect(m.lon).toBe(0);
  });

  it('argument undefined → TypeError', () => {
    expect(() => calculateMidpoint(undefined, LFPG)).toThrow(TypeError);
  });
});

describe('parseCoordinate — analyse de coordonnées', () => {
  it('un nombre est rendu tel quel, y compris 0 et NaN', () => {
    expect(parseCoordinate(48.5, 'lat')).toBe(48.5);
    expect(parseCoordinate(0, 'lat')).toBe(0);
    expect(parseCoordinate(-2.3, 'lon')).toBe(-2.3);
    expect(parseCoordinate(NaN, 'lat')).toBeNaN();
  });

  it('chaîne en degrés décimaux', () => {
    expect(parseCoordinate('48.5', 'lat')).toBe(48.5);
    expect(parseCoordinate('-2.3', 'lon')).toBe(-2.3);
    expect(parseCoordinate('  48.5  ', 'lat')).toBe(48.5);
    expect(parseCoordinate('1e2', 'lat')).toBe(100);
  });

  it("DÉFAUT FIGÉ MAJEUR : le format DMS classique n'atteint JAMAIS sa branche — parseFloat gagne", () => {
    // parseFloat("48°51'29.9\"N") === 48 → !isNaN(48) → retour anticipé.
    // On perd les minutes, les secondes ET le signe.
    expect(parseCoordinate("48°51'29.9\"N", 'lat')).toBe(48); // et non 48.85830555555556
    expect(parseCoordinate("48°51'29.9\"S", 'lat')).toBe(48); // le S est ignoré : PAS de -48.8583
    expect(parseCoordinate("2°17'40.3\"W", 'lon')).toBe(2); // le W est ignoré : PAS de -2.2945
    expect(parseCoordinate("2°17'40.3\"E", 'lon')).toBe(2);
    expect(parseCoordinate("48°51'29\"N", 'lat')).toBe(48);
    expect(parseCoordinate("0°30'00\"N", 'lat')).toBe(0);
  });

  it('la branche DMS ne s\'exécute que si la chaîne ne COMMENCE pas par un nombre', () => {
    expect(parseCoordinate('N 48°51\'29.9"N', 'lat')).toBeCloseTo(48.85830555555556, 12);
    expect(parseCoordinate('LAT 48°51\'29.9"S', 'lat')).toBeCloseTo(-48.85830555555556, 12);
    expect(parseCoordinate('LAT 2°17\'40.3"W', 'lon')).toBeCloseTo(-2.2945277777777777, 12);
    expect(parseCoordinate('x0°30\'00"N', 'lat')).toBeCloseTo(0.5, 12);
    expect(parseCoordinate('x48°51\'29"N', 'lat')).toBeCloseTo(48.85805555555556, 12);
  });

  it("le signe DMS ne s'applique qu'au bon type : S sur lon et W sur lat restent positifs", () => {
    expect(parseCoordinate('LAT 2°17\'40.3"W', 'lat')).toBeCloseTo(2.2945277777777777, 12);
    expect(parseCoordinate('LAT 48°51\'29.9"S', 'lon')).toBeCloseTo(48.85830555555556, 12);
    // type omis → aucun signe appliqué
    expect(parseCoordinate('LAT 48°51\'29.9"S', undefined)).toBeCloseTo(48.85830555555556, 12);
  });

  it('replis : null, undefined, chaîne vide, texte, objet, booléen → null', () => {
    expect(parseCoordinate(null, 'lat')).toBeNull();
    expect(parseCoordinate(undefined, 'lat')).toBeNull();
    expect(parseCoordinate('', 'lat')).toBeNull();
    expect(parseCoordinate('abc', 'lat')).toBeNull();
    expect(parseCoordinate('N48.5', 'lat')).toBeNull();
    expect(parseCoordinate({ lat: 1 }, 'lat')).toBeNull();
    expect(parseCoordinate(true, 'lat')).toBeNull();
    expect(parseCoordinate([48.5], 'lat')).toBeNull();
    expect(parseCoordinate('x48°51\'29.9"X', 'lat')).toBeNull(); // direction hors [NSEW]
    expect(parseCoordinate('x48 51 29.9 N', 'lat')).toBeNull(); // séparateurs non DMS
  });

  it('DÉFAUT FIGÉ : parseFloat tronque une chaîne mal formée au lieu de la rejeter', () => {
    expect(parseCoordinate('48.5abc', 'lat')).toBe(48.5);
    expect(parseCoordinate('Infinity', 'lat')).toBe(Infinity);
    expect(parseCoordinate('-Infinity', 'lat')).toBe(-Infinity);
  });
});

describe('interpolatePosition — position intermédiaire (slerp)', () => {
  it("fraction 0.5 sur l'équateur → milieu du segment", () => {
    const p = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, 0.5);
    expect(p.lat).toBe(0);
    expect(p.lon).toBeCloseTo(4.999999999999999, 12);
  });

  it('fraction 0 → point de départ ; fraction 1 → point d\'arrivée', () => {
    const a = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, 0);
    expect(a.lat).toBe(0);
    expect(a.lon).toBeCloseTo(0, 12);
    const b = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, 1);
    expect(b.lat).toBe(0);
    expect(b.lon).toBeCloseTo(10, 12);
  });

  it('CDG → Toulouse à 0.5 : identique au point médian', () => {
    const p = interpolatePosition(LFPG, LFBO, 0.5);
    expect(p.lat).toBeCloseTo(46.32102415025405, 10);
    expect(p.lon).toBeCloseTo(1.9267183287786211, 10);
    const m = calculateMidpoint(LFPG, LFBO);
    expect(p.lat).toBeCloseTo(m.lat, 10);
    expect(p.lon).toBeCloseTo(m.lon, 10);
  });

  it('CDG → Toulouse à 0.25 : {47.66578089359784, 2.229308555844832}', () => {
    const p = interpolatePosition(LFPG, LFBO, 0.25);
    expect(p.lat).toBeCloseTo(47.66578089359784, 10);
    expect(p.lon).toBeCloseTo(2.229308555844832, 10);
  });

  it('DÉFAUT FIGÉ : deux points identiques → {NaN, NaN} (division par sin(0))', () => {
    const p = interpolatePosition(LFPG, LFPG, 0.5);
    expect(p.lat).toBeNaN();
    expect(p.lon).toBeNaN();
  });

  it("DÉFAUT FIGÉ : la fraction n'est PAS bornée à [0,1] — extrapolation silencieuse", () => {
    const au = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, 2);
    expect(au.lon).toBeCloseTo(20, 10);
    const av = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, -1);
    expect(av.lon).toBeCloseTo(-9.999999999999998, 10);
  });

  it('fraction undefined → {NaN, NaN}', () => {
    const p = interpolatePosition({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, undefined);
    expect(p.lat).toBeNaN();
    expect(p.lon).toBeNaN();
  });

  it('accepte lng comme repli de lon', () => {
    const p = interpolatePosition({ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, 0.5);
    expect(p.lon).toBeCloseTo(4.999999999999999, 12);
  });
});

describe('calculateDistanceToSegment — distance point/segment', () => {
  const start = { lat: 48, lon: 2 };
  const end = { lat: 48, lon: 4 }; // segment de 80.3475668224804 NM

  it('le segment de référence mesure 80.3475668224804 NM', () => {
    expect(calculateDistance(start, end)).toBeCloseTo(80.3475668224804, 10);
  });

  it('point au nord du milieu → 29.759678413380467 NM (cross-track)', () => {
    expect(calculateDistanceToSegment({ lat: 48.5, lon: 3 }, start, end)).toBeCloseTo(29.759678413380467, 10);
  });

  it('point au sud du milieu → 30.28078231923819 NM (dissymétrie orthodromique)', () => {
    expect(calculateDistanceToSegment({ lat: 47.5, lon: 3 }, start, end)).toBeCloseTo(30.28078231923819, 10);
  });

  it("point « sur » le segment en loxodromie : 0.2605519529290168 NM (l'orthodromie bombe vers le nord)", () => {
    expect(calculateDistanceToSegment({ lat: 48, lon: 3 }, start, end)).toBeCloseTo(0.2605519529290168, 10);
  });

  it('point exactement à une extrémité → 0', () => {
    expect(calculateDistanceToSegment(start, start, end)).toBe(0);
    expect(calculateDistanceToSegment(end, start, end)).toBe(0);
  });

  it('DÉFAUT FIGÉ : along-track n\'est JAMAIS négatif (Math.acos ∈ [0,π]) → la branche « avant le départ » est MORTE', () => {
    // Le point (48,1) est 40.17 NM AVANT le début du segment : la vraie distance
    // au segment vaut 40.17 NM. La fonction rend le cross-track (0.78 NM) car
    // alongTrackDistance vaut +40.17 (jamais < 0) et reste < 80.35.
    const p = { lat: 48, lon: 1 };
    expect(calculateDistance(p, start)).toBeCloseTo(40.17462828461786, 10);
    expect(calculateDistanceToSegment(p, start, end)).toBeCloseTo(0.7815764981144133, 10);
    expect(calculateDistanceToSegment(p, start, end)).toBeLessThan(calculateDistance(p, start));
  });

  it("DÉFAUT FIGÉ : très en amont du départ, le repli « > longueur » rend la distance à l'ARRIVÉE (le point le plus loin)", () => {
    // (48,-2) est à 160.68 NM du départ et 240.99 NM de l'arrivée : le résultat
    // attendu serait 160.68, la fonction rend 240.99.
    const p = { lat: 48, lon: -2 };
    expect(calculateDistance(p, start)).toBeCloseTo(160.68161333174345, 10);
    expect(calculateDistance(p, end)).toBeCloseTo(240.98860673745833, 10);
    expect(calculateDistanceToSegment(p, start, end)).toBeCloseTo(240.98860673745833, 10);
  });

  it('au-delà de la fin du segment → distance à l\'arrivée (branche correcte)', () => {
    const p = { lat: 48, lon: 5 };
    expect(calculateDistanceToSegment(p, start, end)).toBeCloseTo(40.17462828461786, 10);
    expect(calculateDistanceToSegment(p, start, end)).toBe(calculateDistance(p, end));
  });

  it('segment dégénéré (départ === arrivée) → distance au point, lng accepté', () => {
    expect(calculateDistanceToSegment({ lat: 49, lon: 2 }, start, { lat: 48, lon: 2 })).toBeCloseTo(
      60.04046073261873,
      10,
    );
    expect(
      calculateDistanceToSegment({ lat: 49, lon: 2 }, { lat: 48, lng: 2 }, { lat: 48, lng: 2 }),
    ).toBeCloseTo(60.04046073261873, 10);
  });

  it('segment de moins de 0.1 NM → min(distance départ, distance arrivée)', () => {
    const r = calculateDistanceToSegment({ lat: 49, lon: 2 }, { lat: 48, lon: 2 }, { lat: 48.001, lon: 2 });
    expect(r).toBeCloseTo(59.98042027188626, 10);
    expect(r).toBe(
      Math.min(
        calculateDistance({ lat: 49, lon: 2 }, { lat: 48, lon: 2 }),
        calculateDistance({ lat: 49, lon: 2 }, { lat: 48.001, lon: 2 }),
      ),
    );
  });

  it('résultat stable en appel répété (le cache de distance ne le fausse pas)', () => {
    const a = calculateDistanceToSegment({ lat: 48.5, lon: 3 }, start, end);
    const b = calculateDistanceToSegment({ lat: 48.5, lon: 3 }, start, end);
    expect(a).toBe(b);
  });
});

describe('calculatePerpendicular — médiatrice du segment', () => {
  it('(0,0) → (0,10) : médiatrice N/S de part et d\'autre du milieu', () => {
    const p = calculatePerpendicular({ lat: 0, lon: 0 }, { lat: 0, lon: 10 });
    expect(p.midpoint.lat).toBe(0);
    expect(p.midpoint.lon).toBeCloseTo(4.999999999999999, 12);
    expect(p.bearing).toBe(180); // (90 + 90) % 360
    expect(p.point1.lat).toBeCloseTo(-19.999999999999996, 10);
    expect(p.point1.lon).toBeCloseTo(5.000000000000002, 10);
    expect(p.point2.lat).toBeCloseTo(19.999999999999996, 10);
    expect(p.point2.lon).toBeCloseTo(4.999999999999999, 10);
  });

  it('CDG → Orly : cap perpendiculaire 291.2208231860932° (route + 90°)', () => {
    const p = calculatePerpendicular(LFPG, LFPO);
    expect(p.bearing).toBeCloseTo(291.2208231860932, 10);
    expect(p.bearing).toBeCloseTo((calculateBearing(LFPG, LFPO) + 90) % 360, 10);
    expect(p.midpoint.lat).toBeCloseTo(48.86653068924207, 10);
    expect(p.midpoint.lon).toBeCloseTo(2.463408906553241, 10);
    expect(p.point1.lat).toBeCloseTo(49.08555533344684, 10);
    expect(p.point1.lon).toBeCloseTo(1.5891724634128754, 10);
    expect(p.point2.lat).toBeCloseTo(48.640955172715465, 10);
    expect(p.point2.lon).toBeCloseTo(3.329912656419787, 10);
  });

  it('les points de la médiatrice sont projetés à 2 × la distance de la route', () => {
    const p = calculatePerpendicular(LFPG, LFBO);
    const perpDistance = calculateDistance(LFPG, LFBO) * 2;
    expect(calculateDistance(p.midpoint, p.point1)).toBeCloseTo(perpDistance, 6);
    expect(p.point1.lat).toBeCloseTo(46.95164915103159, 10);
    expect(p.point1.lon).toBeCloseTo(-13.92521353477265, 10);
    expect(p.point2.lat).toBeCloseTo(43.60193335807963, 10);
    expect(p.point2.lon).toBeCloseTo(16.847643891522694, 10);
    expect(p.bearing).toBeCloseTo(279.07448646297655, 10);
  });

  it('la forme du retour est {midpoint, point1, point2, bearing}', () => {
    expect(Object.keys(calculatePerpendicular(LFPG, LFPO))).toEqual(['midpoint', 'point1', 'point2', 'bearing']);
  });
});

describe('getSideOfPerpendicular — côté départ / arrivée', () => {
  it('point proche du départ → "departure"', () => {
    expect(getSideOfPerpendicular({ lat: 49.0, lon: 2.5 }, LFPG, LFBO)).toBe('departure');
  });

  it('point proche de l\'arrivée → "arrival"', () => {
    expect(getSideOfPerpendicular({ lat: 43.7, lon: 1.4 }, LFPG, LFBO)).toBe('arrival');
  });

  it('DÉFAUT FIGÉ : à égale distance → "arrival" (comparaison stricte <)', () => {
    expect(getSideOfPerpendicular({ lat: 0, lon: 5 }, { lat: 0, lon: 0 }, { lat: 0, lon: 10 })).toBe('arrival');
  });

  it('DÉFAUT FIGÉ : coordonnées NaN → "arrival" au lieu d\'une erreur (NaN < NaN === false)', () => {
    expect(getSideOfPerpendicular({ lat: NaN, lon: 5 }, { lat: 0, lon: 0 }, { lat: 0, lon: 10 })).toBe('arrival');
  });
});

describe('isPointInPolygon — lancer de rayon (ray casting)', () => {
  const square = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 10 },
    { lat: 10, lon: 10 },
    { lat: 10, lon: 0 },
  ];

  it('point intérieur → true, points extérieurs → false', () => {
    expect(isPointInPolygon({ lat: 5, lon: 5 }, square)).toBe(true);
    expect(isPointInPolygon({ lat: 15, lon: 5 }, square)).toBe(false);
    expect(isPointInPolygon({ lat: 5, lon: -5 }, square)).toBe(false);
    expect(isPointInPolygon({ lat: 5, lon: 15 }, square)).toBe(false);
  });

  it('frontières : sud/ouest comptés DEDANS, nord/est comptés DEHORS (asymétrie assumée du ray casting)', () => {
    expect(isPointInPolygon({ lat: 0, lon: 5 }, square)).toBe(true); // bord sud
    expect(isPointInPolygon({ lat: 5, lon: 0 }, square)).toBe(true); // bord ouest
    expect(isPointInPolygon({ lat: 10, lon: 5 }, square)).toBe(false); // bord nord
    expect(isPointInPolygon({ lat: 5, lon: 10 }, square)).toBe(false); // bord est
    expect(isPointInPolygon({ lat: 0, lon: 0 }, square)).toBe(true); // sommet SO
  });

  it('triangle : intérieur vs extérieur', () => {
    const tri = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 10, lon: 0 },
    ];
    expect(isPointInPolygon({ lat: 2, lon: 2 }, tri)).toBe(true);
    expect(isPointInPolygon({ lat: 8, lon: 8 }, tri)).toBe(false);
  });

  it('polygone concave : l\'encoche est correctement exclue', () => {
    const concave = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 10, lon: 10 },
      { lat: 5, lon: 5 },
      { lat: 10, lon: 0 },
    ];
    expect(isPointInPolygon({ lat: 8, lon: 5 }, concave)).toBe(false); // dans l'encoche
    expect(isPointInPolygon({ lat: 2, lon: 5 }, concave)).toBe(true);
  });

  it('polygone vide → false ; polygone null → TypeError', () => {
    expect(isPointInPolygon({ lat: 5, lon: 5 }, [])).toBe(false);
    expect(() => isPointInPolygon({ lat: 5, lon: 5 }, null)).toThrow(TypeError);
  });

  it('les SOMMETS acceptent lng, mais DÉFAUT FIGÉ : le POINT testé ne lit que .lon', () => {
    const squareLng = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 10, lng: 10 },
      { lat: 10, lng: 0 },
    ];
    expect(isPointInPolygon({ lat: 5, lon: 5 }, squareLng)).toBe(true);
    // Un point en .lng est vu comme lon === undefined → toujours false
    expect(isPointInPolygon({ lat: 5, lng: 5 }, squareLng)).toBe(false);
    expect(isPointInPolygon({ lat: 5 }, square)).toBe(false);
  });

  it('coordonnées NaN → false (aucune erreur levée)', () => {
    expect(isPointInPolygon({ lat: NaN, lon: NaN }, square)).toBe(false);
  });
});

describe('Surface publique du module (contrat à préserver au déplacement)', () => {
  it('expose exactement 15 fonctions nommées + NavigationCalculations + default', () => {
    expect(Object.keys(NavigationCalculations)).toEqual([
      'calculateDistance',
      'calculateBearing',
      'calculateTotalDistance',
      'calculateFlightTime',
      'calculateFuelRequired',
      'calculateDestination',
      'calculateMidpoint',
      'parseCoordinate',
      'interpolatePosition',
      'calculateDistanceToSegment',
      'calculatePerpendicular',
      'getSideOfPerpendicular',
      'isPointInPolygon',
      'toRad',
      'toDeg',
    ]);
  });

  it('l\'export par défaut EST l\'objet NavigationCalculations (même référence)', () => {
    expect(navDefault).toBe(NavigationCalculations);
  });

  it('les membres de l\'objet sont les MÊMES références que les exports nommés', () => {
    expect(NavigationCalculations.calculateDistance).toBe(calculateDistance);
    expect(NavigationCalculations.isPointInPolygon).toBe(isPointInPolygon);
    expect(NavigationCalculations.toRad).toBe(toRad);
  });

  it('calculateWindEffect a été SUPPRIMÉ (lot 0.4) : il ne doit PAS revenir', () => {
    expect(NavigationCalculations.calculateWindEffect).toBeUndefined();
  });
});
