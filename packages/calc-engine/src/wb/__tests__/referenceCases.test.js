// Cas de référence MASSE & CENTRAGE — banc de test permanent (27/08/2026).
//
// Demande pilote : « mettre des calculs de référence comme pour les
// performances, mais pour les masses/centrage — au moins la fiche de pesée
// avec les chiffres de référence », avec tracé d'UN POINT PAR BRAS DE LEVIER
// sur le graphique. Ces tests posent le contrat du banc :
//   • cas AUTO de la pesée : avion à vide, CG calculé = bras de la masse à
//     vide (auto-cohérence de toute la chaîne, m/mm compris) ;
//   • cas manuel (exemple de chargement POH) : verdict PASS/FAIL ± tolérance,
//     évalué par le VRAI computeWeightBalance ;
//   • fail-closed : bras absent, poste inconnu, densité inconnue, CG attendu
//     manquant ⇒ 'error' explicite, AUCUN point tracé, jamais un verdict.

import { describe, it, expect } from 'vitest';
import {
  evaluateWbReferenceCase,
  evaluateAllWbReferenceCases,
  wbPostesForAircraft,
  DEFAULT_WB_TOLERANCE_CG_MM,
} from '../referenceCases.js';

// Fiche complète type DR400 (valeurs rondes pour des attendus exacts).
const AVION = {
  registration: 'F-TEST',
  fuelType: 'AVGAS 100LL', // densité 0.72 (constants.js)
  weights: { emptyWeight: 600, mtow: 1100 },
  weightBalance: {
    emptyWeightArm: 0.30,
    frontLeftSeatArm: 0.41,
    frontRightSeatArm: 0.41,
    rearLeftSeatArm: 1.19,
    rearRightSeatArm: 1.19,
    fuelArm: 1.12,
    baggageArm: 1.90,
  },
  cgEnvelope: {
    forwardPoints: [{ weight: 550, cg: 0.205 }, { weight: 1100, cg: 0.28 }],
    aftCG: 0.564,
  },
  weighingReport: { certificationDate: '2024-03-12' },
};


describe('evaluateWbReferenceCase — exemple de chargement confronté au document', () => {
  const AVION_EX = {
    ...AVION,
    baggageCompartments: [{ id: 'c1', name: 'Compartiment 1', arm: 1.90, maxWeight: 40 }],
  };
  const CAS = {
    label: 'Exemple de chargement',
    postes: [
      { poste: 'frontLeft', masse: 77, brasAttendu: 0.41 },
      { poste: 'baggage_c1', masse: 20, brasAttendu: 1.90 },
    ],
    // 600×0,30 + 77×0,41 + 20×1,90 = 249,57 m.kg ; 697 kg ; CG = 0,358 m
    cgAttendu: 0.358,
    masseAttendue: 697,
    toleranceCgMm: 5,
  };

  it('bras conformes → PASS, et chaque ligne porte son bras et ses deux moments', () => {
    const r = evaluateWbReferenceCase(AVION_EX, CAS);
    expect(r.status).toBe('pass');
    expect(r.weightComputed).toBe(697);
    expect(r.brasFautifs).toEqual([]);
    const bagages = r.points.find((p) => p.key === 'baggage_c1');
    expect(bagages.bras).toBe(1.90);
    expect(bagages.brasAttendu).toBe(1.90);
    expect(bagages.ecartBrasMm).toBe(0);
    expect(bagages.momentCalcule).toBe(38);
    expect(bagages.momentAttendu).toBe(38);
  });

  // Le cœur du contrôle : un bras de la fiche qui contredit le document fait
  // ÉCHOUER le cas, même si le centrage total tombait juste — deux erreurs de
  // bras peuvent se compenser.
  it('un bras qui contredit le document → FAIL, poste nommé', () => {
    const r = evaluateWbReferenceCase(AVION_EX, {
      ...CAS,
      postes: [{ poste: 'frontLeft', masse: 77, brasAttendu: 0.45 }, ...CAS.postes.slice(1)],
    });
    expect(r.status).toBe('fail');
    expect(r.brasFautifs).toContain('Siège avant gauche');
    const siege = r.points.find((p) => p.key === 'frontLeft');
    expect(siege.ecartBrasMm).toBe(40);
    expect(siege.brasConforme).toBe(false);
  });

  it('bras du document non saisi → ligne calculée, aucun verdict de bras', () => {
    const r = evaluateWbReferenceCase(AVION_EX, {
      ...CAS,
      postes: [{ poste: 'frontLeft', masse: 77 }, ...CAS.postes.slice(1)],
    });
    const siege = r.points.find((p) => p.key === 'frontLeft');
    expect(siege.momentCalcule).toBeCloseTo(31.57, 2);
    expect(siege.brasAttendu).toBeUndefined();
    expect(siege.brasConforme).toBeUndefined();
    expect(r.brasFautifs).toEqual([]);
  });
});

// 28/08 — LE CARBURANT SE SAISIT EN KILOS. Tous les exemples de chargement des
// fiches de pesée donnent l'essence et sa répartition en kg (« Essence 55,000 kg
// · 2,413 m · 132,715 »). Le moteur attend des litres pour fuel_<id> : la
// conversion se fait à l'évaluation, pas dans la tête du pilote.
describe('evaluateWbReferenceCase — carburant par réservoir saisi en kilos', () => {
  const BIRESERVOIR_KG = {
    ...AVION,
    additionalFuelTanks: [{ id: 'g', name: 'Aile gauche', arm: 1.10, totalCapacity: 60, usableCapacity: 60 }],
  };

  it('kg par défaut : 28,8 kg à 1,10 m → 40 L pour le moteur, moment 31,68', () => {
    const r = evaluateWbReferenceCase(BIRESERVOIR_KG, {
      label: 'Cas', postes: [{ poste: 'fuel_g', masse: 28.8 }],
    });
    expect(r.status).toBe('info');
    const carburant = r.points.find((p) => p.key === 'fuel_g');
    expect(carburant.masse).toBeCloseTo(28.8, 5);   // les kg saisis, inchangés
    expect(carburant.litres).toBeCloseTo(40, 5);    // convertis pour le moteur
    expect(carburant.momentCalcule).toBeCloseTo(31.68, 2);
    expect(r.weightComputed).toBeCloseTo(628.8, 1); // 600 à vide + 28,8
  });

  it('litres explicites : même résultat qu\'en kilos', () => {
    const enKg = evaluateWbReferenceCase(BIRESERVOIR_KG, {
      label: 'Cas', postes: [{ poste: 'fuel_g', masse: 28.8 }],
    });
    const enLitres = evaluateWbReferenceCase(BIRESERVOIR_KG, {
      label: 'Cas', postes: [{ poste: 'fuel_g', masse: 40, unite: 'ltr' }],
    });
    expect(enLitres.weightComputed).toBeCloseTo(enKg.weightComputed, 5);
    expect(enLitres.cgComputed).toBeCloseTo(enKg.cgComputed, 5);
  });

  it('type carburant inconnu → kg non convertibles, refus explicite', () => {
    const sansType = { ...BIRESERVOIR_KG, fuelType: undefined };
    const r = evaluateWbReferenceCase(sansType, {
      label: 'Cas', postes: [{ poste: 'fuel_g', masse: 28.8 }],
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/densité carburant inconnue/);
  });
});

// 27/08 — carburant saisi en bloc unique ET par réservoir : le moteur bascule
// en mode « par réservoir » et n'additionne jamais le bloc, ce qui pouvait
// rendre PASS avec des dizaines de kilos manquants. Le cas est refusé.
describe('evaluateWbReferenceCase — carburant saisi deux fois', () => {
  it('bloc unique + réservoir → cas refusé, message explicite, aucun point', () => {
    const avionMultiReservoirs = {
      ...AVION,
      additionalFuelTanks: [{ id: 'g', name: 'Aile gauche', arm: 1.12, totalCapacity: 100, usableCapacity: 100 }],
    };
    const r = evaluateWbReferenceCase(avionMultiReservoirs, {
      label: 'Mixte',
      postes: [{ poste: 'fuel', masse: 50 }, { poste: 'fuel_g', masse: 60 }],
      cgAttendu: 0.35,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/bloc unique et par réservoir/);
    expect(r.points).toEqual([]);
  });
});

describe('evaluateWbReferenceCase — cas manuel (exemple de chargement POH)', () => {
  // 600×0.30 + 77×0.41 + 77×0.41 + 50×1.19 + 20×1.90 + 72×1.12
  // = 180 + 31.57 + 31.57 + 59.5 + 38 + 80.64 = 421.28 kg·m ; W = 896 kg
  // CG = 421.28 / 896 = 0.470178… → 0.470 (arrondi moteur, 3 décimales)
  const CAS_POH = {
    id: 'poh-1',
    label: 'Exemple de chargement POH',
    source: 'Manuel de vol §6.5',
    postes: [
      { poste: 'frontLeft', masse: 77 },
      { poste: 'frontRight', masse: 77 },
      { poste: 'rearLeft', masse: 50 },
      { poste: 'baggage', masse: 20 },
      { poste: 'fuel', masse: 72 },
    ],
    cgAttendu: 0.470,
    toleranceCgMm: 5,
  };

  it('CG attendu du manuel retrouvé → PASS avec écart chiffré', () => {
    const r = evaluateWbReferenceCase(AVION, CAS_POH);
    expect(r.status).toBe('pass');
    expect(r.cgComputed).toBe(0.470);
    expect(r.cgExpected).toBe(0.470);
    expect(r.deviationMm).toBeLessThanOrEqual(0.5);
    expect(r.weightComputed).toBe(896);
    expect(r.isWithinLimits).toBe(true);
  });

  it('trace UN POINT PAR BRAS DE LEVIER utilisé + le point résultant', () => {
    const r = evaluateWbReferenceCase(AVION, CAS_POH);
    // 6 bras utilisés : masse à vide, 2 sièges avant, siège arrière G, bagages, carburant.
    expect(r.points).toHaveLength(6);
    expect(r.points.map((p) => p.key)).toEqual(['empty', 'frontLeft', 'frontRight', 'rearLeft', 'baggage', 'fuel']);
    const bagages = r.points.find((p) => p.key === 'baggage');
    expect(bagages).toMatchObject({ masse: 20, bras: 1.90 });
    expect(r.resultPoint).toEqual({ w: 896, cg: 0.470 });
  });

  it('CG attendu en MILLIMÈTRES (470) → même verdict (garde-fou m/mm)', () => {
    const r = evaluateWbReferenceCase(AVION, { ...CAS_POH, cgAttendu: 470 });
    expect(r.status).toBe('pass');
  });

  it('CG attendu incompatible (0.400) → FAIL avec écart ~70 mm', () => {
    const r = evaluateWbReferenceCase(AVION, { ...CAS_POH, cgAttendu: 0.400 });
    expect(r.status).toBe('fail');
    expect(r.deviationMm).toBeCloseTo(70, 0);
  });

  it('tolérance absente → défaut du banc (DEFAULT_WB_TOLERANCE_CG_MM)', () => {
    const { toleranceCgMm, ...sansTol } = CAS_POH;
    const r = evaluateWbReferenceCase(AVION, sansTol);
    expect(r.toleranceMm).toBe(DEFAULT_WB_TOLERANCE_CG_MM);
    expect(r.status).toBe('pass');
  });
});

describe('evaluateWbReferenceCase — fail-closed (rien, aucun fallback)', () => {
  it('poste chargé sans bras → error nominative, AUCUN point tracé', () => {
    const sansBrasArriere = { ...AVION, weightBalance: { ...AVION.weightBalance, rearLeftSeatArm: null } };
    const r = evaluateWbReferenceCase(sansBrasArriere, {
      label: 'Cas', postes: [{ poste: 'rearLeft', masse: 50 }], cgAttendu: 0.4,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/Siège arrière gauche/);
    expect(r.points).toEqual([]);
    expect(r.resultPoint).toBeNull();
  });

  it('poste inconnu → error explicite', () => {
    const r = evaluateWbReferenceCase(AVION, {
      label: 'Cas', postes: [{ poste: 'pilote', masse: 77 }], cgAttendu: 0.4,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/poste inconnu « pilote »/);
  });

  // 28/08 — comparer à un centrage annoncé est FACULTATIF : le pilote saisit
  // d'abord ses masses pour voir où se posent les points. Statut « info », pas
  // « error » : les chiffres et les points sortent, sans avertissement.
  it('CG attendu non renseigné → info, chiffres et points disponibles', () => {
    const r = evaluateWbReferenceCase(AVION, {
      label: 'Cas', postes: [{ poste: 'frontLeft', masse: 77 }],
    });
    expect(r.status).toBe('info');
    expect(r.message).toMatch(/Chargement calculé/);
    expect(r.points.length).toBe(2);
    expect(r.resultPoint).not.toBeNull();
  });

  // 28/08 — le cas arrive pré-rempli avec TOUS les postes de l'avion, masses
  // vides. Une ligne pas encore remplie ne doit pas casser le cas, sinon le
  // tableau disparaît de l'écran pendant toute la saisie.
  it('lignes pré-remplies non saisies → ignorées, le cas reste calculable', () => {
    const r = evaluateWbReferenceCase(AVION, {
      label: 'Cas',
      postes: [
        { poste: 'frontLeft', masse: 77 },
        { poste: 'frontRight', masse: '' },
        { poste: 'rearLeft', masse: null },
        { poste: 'baggage' },
      ],
    });
    expect(r.status).toBe('info');
    expect(r.points.map((p) => p.key)).toEqual(['empty', 'frontLeft']);
    expect(r.weightComputed).toBe(677);
  });

  it('carburant par réservoir avec type carburant inconnu → error densité', () => {
    const avion = {
      ...AVION,
      fuelType: null,
      additionalFuelTanks: [{ id: 'g', name: 'Aile gauche', arm: 1.10, capacity: 55 }],
    };
    const r = evaluateWbReferenceCase(avion, {
      label: 'Cas', postes: [{ poste: 'fuel_g', masse: 40 }], cgAttendu: 0.4,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/densité carburant inconnue/i);
  });

  it('MTOW absente → calcul refusé par le moteur, error explicite', () => {
    const sansMtow = { ...AVION, weights: { emptyWeight: 600 } };
    const r = evaluateWbReferenceCase(sansMtow, {
      label: 'Cas', postes: [], cgAttendu: 0.30,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/refusé|MTOW/i);
  });

  it('avion à compartiments : clé legacy « baggage » refusée (le moteur l\'ignorerait)', () => {
    const avion = {
      ...AVION,
      baggageCompartments: [{ id: 'c1', name: 'Soute', arm: 1.85, maxWeight: 40 }],
    };
    const r = evaluateWbReferenceCase(avion, {
      label: 'Cas', postes: [{ poste: 'baggage', masse: 20 }], cgAttendu: 0.4,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/compartiments bagages/);
  });
});

describe('evaluateWbReferenceCase — carburant par réservoir (litres × densité)', () => {
  const BIRESERVOIR = {
    ...AVION,
    additionalFuelTanks: [
      { id: 'g', name: 'Aile gauche', arm: 1.10, capacity: 55 },
      { id: 'd', name: 'Aile droite', arm: 1.14, capacity: 55 },
    ],
  };

  it('40 L par aile (AVGAS 0.72) → un point PAR réservoir, à SON bras', () => {
    // 600×0.30 + 28.8×1.10 + 28.8×1.14 = 180 + 31.68 + 32.832 = 244.512 ; W = 657.6
    // CG = 244.512 / 657.6 = 0.371824… → 0.372 (arrondi moteur)
    // 28/08 — la saisie carburant est en KILOS par défaut ; ce cas historique
    // raisonne en litres, il le déclare donc explicitement.
    const r = evaluateWbReferenceCase(BIRESERVOIR, {
      label: 'Pleins partiels',
      postes: [
        { poste: 'fuel_g', masse: 40, unite: 'ltr' },
        { poste: 'fuel_d', masse: 40, unite: 'ltr' },
      ],
      cgAttendu: 0.372,
      toleranceCgMm: 2,
    });
    expect(r.status).toBe('pass');
    expect(r.points).toHaveLength(3);
    const gauche = r.points.find((p) => p.key === 'fuel_g');
    expect(gauche.bras).toBe(1.10);
    expect(gauche.litres).toBe(40);
    expect(gauche.masse).toBeCloseTo(28.8, 5);
  });

  it('bloc « fuel » (kg) ambigu quand les bras diffèrent → error orientant vers fuel_<id>', () => {
    const r = evaluateWbReferenceCase(BIRESERVOIR, {
      label: 'Cas', postes: [{ poste: 'fuel', masse: 50 }], cgAttendu: 0.4,
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/ambigu/);
  });
});

// 28/08 — le catalogue sert désormais à PRÉ-REMPLIR le tableau de saisie : il
// ne liste que les postes qui existent sur CET avion, et porte leur bras pour
// que l'écran l'affiche sans que le pilote ait rien à recopier.
describe('wbPostesForAircraft — postes de l\'avion, avec leur bras', () => {
  it('avion legacy : sièges, bagages/auxiliaire, carburant — chacun avec son bras', () => {
    const postes = wbPostesForAircraft(AVION);
    expect(postes.map((p) => p.key)).toEqual([
      'frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'baggage', 'fuel',
    ]);
    expect(postes.find((p) => p.key === 'frontLeft').bras).toBe(0.41);
    expect(postes.find((p) => p.key === 'baggage').bras).toBe(1.90);
    expect(postes.find((p) => p.key === 'fuel').bras).toBe(1.12);
    // « Rangement auxiliaire » n'est pas proposé : aucun bras auxiliaire.
    expect(postes.find((p) => p.key === 'auxiliary')).toBeUndefined();
  });

  it('compartiments + réservoirs déclarés : un poste par réservoir, en kilos, et PAS de bloc unique', () => {
    const avion = {
      ...AVION,
      baggageCompartments: [{ id: 'c1', name: 'Soute', arm: 1.85 }],
      additionalFuelTanks: [{ id: 'g', name: 'Aile gauche', arm: 1.10, capacity: 55 }],
    };
    const postes = wbPostesForAircraft(avion);
    expect(postes.map((p) => p.key)).toEqual([
      'frontLeft', 'frontRight', 'rearLeft', 'rearRight', 'baggage_c1', 'fuel_g',
    ]);
    // Unité de SAISIE proposée : kg, comme sur les fiches de pesée. Le drapeau
    // `carburant` dit à l'écran d'offrir la bascule kg / litres sur cette ligne.
    expect(postes.find((p) => p.key === 'fuel_g').unite).toBe('kg');
    expect(postes.find((p) => p.key === 'fuel_g').carburant).toBe(true);
    expect(postes.find((p) => p.key === 'fuel_g').bras).toBe(1.10);
    // Deux façons de saisir le même carburant feraient perdre le bloc unique.
    expect(postes.find((p) => p.key === 'fuel')).toBeUndefined();
  });

  // Le motif qui rendait tout un cas non évaluable sur les trois biplaces.
  it('biplace : aucun siège arrière proposé', () => {
    const biplace = {
      ...AVION,
      weightBalance: { ...AVION.weightBalance, rearLeftSeatArm: undefined, rearRightSeatArm: undefined },
    };
    const keys = wbPostesForAircraft(biplace).map((p) => p.key);
    expect(keys).not.toContain('rearLeft');
    expect(keys).not.toContain('rearRight');
    expect(keys).toContain('frontLeft');
  });
});
