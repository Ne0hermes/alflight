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
  buildAutoWeighingCase,
  evaluateWbReferenceCase,
  evaluateAllWbReferenceCases,
  wbPostesForAircraft,
  AUTO_WEIGHING_CASE_ID,
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

// 27/08 — la référence du cas AUTO vient du RAPPORT DE PESÉE, pas de la fiche.
// Comparer le moteur au bras que la fiche déclare elle-même ne vérifiait rien :
// le verdict était PASS par construction. Les valeurs lues sur le document se
// saisissent sous weighingReport.cgFromReport / .emptyWeightFromReport.
const AVION_AVEC_RAPPORT = {
  ...AVION,
  weighingReport: { ...AVION.weighingReport, cgFromReport: 0.30, emptyWeightFromReport: 600 },
};

describe('buildAutoWeighingCase — cas AUTO dérivé de la fiche de pesée', () => {
  it('valeurs du rapport saisies → CG et masse attendus repris du document', () => {
    const auto = buildAutoWeighingCase(AVION_AVEC_RAPPORT);
    expect(auto).not.toBeNull();
    expect(auto.id).toBe(AUTO_WEIGHING_CASE_ID);
    expect(auto.postes).toEqual([]);
    expect(auto.cgAttendu).toBe(0.30);
    expect(auto.masseAttendue).toBe(600);
    expect(auto.manqueReference).toBe(false);
    expect(auto.source).toMatch(/2024-03-12/);
  });

  it('rapport non transcrit → cas construit mais SANS attendu (aucun faux succès)', () => {
    const auto = buildAutoWeighingCase(AVION);
    expect(auto).not.toBeNull();
    expect(auto.cgAttendu).toBeUndefined();
    expect(auto.manqueReference).toBe(true);
  });

  it('bras de pesée en MILLIMÈTRES (fiche legacy) → cas en mètres (garde-fou m/mm)', () => {
    const legacy = {
      ...AVION_AVEC_RAPPORT,
      weightBalance: { ...AVION.weightBalance, emptyWeightArm: 300 },
    };
    const auto = buildAutoWeighingCase(legacy);
    expect(auto.cgAttendu).toBe(0.30);
  });

  it('masse à vide absente → null (fail-closed, pas de cas fabriqué)', () => {
    const { weights, ...sansMasse } = AVION;
    expect(buildAutoWeighingCase(sansMasse)).toBeNull();
  });

  it('bras de la masse à vide absent → null', () => {
    const sansBras = { ...AVION, weightBalance: { ...AVION.weightBalance, emptyWeightArm: null } };
    expect(buildAutoWeighingCase(sansBras)).toBeNull();
  });
});

describe('evaluateWbReferenceCase — cas AUTO (avion à vide)', () => {
  it('fiche conforme au rapport → PASS, écart 0, un point (masse à vide) + point résultant', () => {
    const r = evaluateWbReferenceCase(AVION_AVEC_RAPPORT, buildAutoWeighingCase(AVION_AVEC_RAPPORT));
    expect(r.status).toBe('pass');
    expect(r.cgComputed).toBe(0.30);
    expect(r.deviationMm).toBe(0);
    expect(r.weightComputed).toBe(600);
    // UN POINT PAR BRAS UTILISÉ : ici un seul poste (masse à vide à son bras).
    expect(r.points).toEqual([{ key: 'empty', label: 'Masse à vide', masse: 600, bras: 0.30 }]);
    expect(r.resultPoint).toEqual({ w: 600, cg: 0.30 });
  });

  // 27/08 — le contrôle qui manquait, et qui aurait servi le jour même :
  // la masse à vide de F-GBTU avait été portée à 700 kg alors que son rapport
  // de pesée du 01/03/2018 dit 690. Une fiche qui s'écarte de son document
  // doit ÉCHOUER, pas afficher un « ✓ 0,0 mm » rassurant.
  it('fiche qui contredit le rapport (masse à vide fausse) → FAIL chiffré', () => {
    const ficheFausse = {
      ...AVION_AVEC_RAPPORT,
      weights: { ...AVION.weights, emptyWeight: 610 }, // le rapport dit 600
    };
    const r = evaluateWbReferenceCase(ficheFausse, buildAutoWeighingCase(ficheFausse));
    expect(r.status).toBe('fail');
    expect(r.weightComputed).toBe(610);
    expect(r.masseExpected).toBe(600);
    expect(r.ecartMasseKg).toBe(10);
  });

  it('rapport non transcrit → NON VÉRIFIABLE, message qui dit quoi saisir', () => {
    const r = evaluateWbReferenceCase(AVION, buildAutoWeighingCase(AVION));
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/rapport de pesée/i);
    // Les chiffres calculés restent disponibles pour le pilote.
    expect(r.cgComputed).toBe(0.30);
    expect(r.weightComputed).toBe(600);
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

  it('CG attendu non renseigné → error explicite (mais points calculés, tracé possible)', () => {
    const r = evaluateWbReferenceCase(AVION, {
      label: 'Cas', postes: [{ poste: 'frontLeft', masse: 77 }],
    });
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/CG attendu non renseigné/);
    expect(r.points.length).toBe(2);
    expect(r.resultPoint).not.toBeNull();
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
    const r = evaluateWbReferenceCase(BIRESERVOIR, {
      label: 'Pleins partiels',
      postes: [{ poste: 'fuel_g', masse: 40 }, { poste: 'fuel_d', masse: 40 }],
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

describe('evaluateAllWbReferenceCases — banc complet', () => {
  it('cas AUTO en tête + cas stockés (wbReferenceCases)', () => {
    const avion = {
      // Rapport de pesée transcrit : sans lui le cas AUTO est « non vérifiable »
      // et non « PASS » (il ne se compare plus à la fiche elle-même).
      ...AVION_AVEC_RAPPORT,
      wbReferenceCases: [{
        id: 'poh-1',
        label: 'Exemple POH',
        source: 'Manuel §6.5',
        postes: [{ poste: 'frontLeft', masse: 77 }],
        cgAttendu: 0.313,
        toleranceCgMm: 2,
      }],
    };
    const all = evaluateAllWbReferenceCases(avion);
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(AUTO_WEIGHING_CASE_ID);
    expect(all[0].status).toBe('pass');
    // 600×0.30 + 77×0.41 = 211.57 ; W = 677 ; CG = 0.31251… → 0.313
    expect(all[1].status).toBe('pass');
  });

  it('pesée incomplète → le cas AUTO reste listé, « non évaluable » explicite', () => {
    const { weights, ...sansMasse } = AVION;
    const all = evaluateAllWbReferenceCases(sansMasse);
    expect(all[0].id).toBe(AUTO_WEIGHING_CASE_ID);
    expect(all[0].status).toBe('error');
    expect(all[0].message).toMatch(/non évaluable/);
  });
});

describe('wbPostesForAircraft — catalogue des postes sélectionnables', () => {
  it('avion legacy : sièges + bagages/auxiliaire + carburant bloc unique', () => {
    const keys = wbPostesForAircraft(AVION).map((p) => p.key);
    expect(keys).toEqual([
      'frontLeft', 'frontRight', 'rearLeft', 'rearRight',
      'baggage', 'auxiliary', 'fuel',
    ]);
  });

  it('compartiments + réservoirs déclarés : clés du moteur, litres pour les réservoirs', () => {
    const avion = {
      ...AVION,
      baggageCompartments: [{ id: 'c1', name: 'Soute', arm: 1.85 }],
      additionalFuelTanks: [{ id: 'g', name: 'Aile gauche', arm: 1.10, capacity: 55 }],
    };
    const postes = wbPostesForAircraft(avion);
    expect(postes.map((p) => p.key)).toEqual([
      'frontLeft', 'frontRight', 'rearLeft', 'rearRight',
      'baggage_c1', 'fuel_g', 'fuel',
    ]);
    expect(postes.find((p) => p.key === 'fuel_g').unite).toBe('ltr');
  });
});
