// src/abac/curves/core/__tests__/modelReadiness.test.js
//
// Lot 1-D — tests du calculateur d'avancement du modèle (modelReadiness.ts).
// Fixtures synthétiques ANALYTIQUES (droites exactes), inspirées de
// packages/calc-engine/src/perf/abac/__tests__/cascadeReadoutX.test.ts.
//
// Modèle « décollage complet » :
//   G1 (primaire, OAT × altitude) : y = base(alt) + 0.2·OAT
//       base(0 ft) = 40, base(4000 ft) = 60
//   G2 (intermédiaire, panneau masse, ligne de référence à x = 900 kg) :
//       guide 1 : y = 40 + 0.05·(x − 900)   guide 2 : y = 60 + 0.10·(x − 900)
//   Cas de référence : OAT 0 / alt 2000 → Y = 50 (ratio 0.5 entre guides) ;
//   masse 1000 → 45 + 0.5·(70 − 45) = 57.5.

import { describe, it, expect } from 'vitest';
import {
  computeGraphReadiness,
  computeSetReadiness,
  READINESS_BENCH_ITEM_ID
} from '../modelReadiness';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const line = (fn, ts) => ts.map(fn);

const mkCurve = (over) => ({ id: over.name, color: '#000', ...over });

function mkPrimaryTakeoff(over = {}) {
  const oats = [-20, 0, 20, 40];
  return {
    id: 'g1',
    name: 'Panneau OAT / Altitude',
    role: 'primary',
    operationId: 'takeoff_50ft_flaps_to',
    familyAxisVariable: 'pressure_altitude',
    isWindRelated: false,
    axes: {
      xAxis: { min: -20, max: 40, step: 10, unit: '°C', title: 'oat' },
      yAxis: { min: 0, max: 100, step: 25, unit: '', title: 'custom' }
    },
    curves: [
      mkCurve({ name: '0 ft', familyValue: 0, points: line(x => ({ x, y: 40 + 0.2 * x }), oats) }),
      mkCurve({ name: '4000 ft', familyValue: 4000, points: line(x => ({ x, y: 60 + 0.2 * x }), oats) })
    ],
    linkedTo: ['g2'],
    ...over
  };
}

function mkMassPanel(over = {}) {
  const xs = [900, 1000, 1100];
  return {
    id: 'g2',
    name: 'Panneau masse',
    role: 'intermediate',
    cascadeOrder: 1,
    isWindRelated: false,
    axes: {
      xAxis: { min: 900, max: 1100, step: 50, unit: 'kg', title: 'mass' },
      yAxis: { min: 0, max: 100, step: 25, unit: '', title: 'custom' }
    },
    curves: [
      mkCurve({ name: '1', familyValue: 1, points: line(x => ({ x, y: 40 + 0.05 * (x - 900) }), xs) }),
      mkCurve({ name: '2', familyValue: 2, points: line(x => ({ x, y: 60 + 0.10 * (x - 900) }), xs) })
    ],
    linkedFrom: ['g1'],
    ...over
  };
}

// Zone de lecture DESCENDANTE (planches d'atterrissage Piper) — guides vent.
function mkWindZone(over = {}) {
  const ys = [0, 25, 50, 75, 100];
  return {
    id: 'gz',
    name: 'Zone course',
    role: 'intermediate',
    cascadeOrder: 2,
    readoutAxis: 'x',
    isWindRelated: true,
    familyAxisVariable: 'wind_component',
    axes: {
      xAxis: { min: 150, max: 450, step: 50, unit: 'm', title: 'landing_distance_ground' },
      yAxis: { min: 0, max: 100, step: 25, unit: '', title: 'custom' }
    },
    curves: [
      mkCurve({ name: 'Vent nul', windDirection: 'none', familyValue: 0, points: line(y => ({ x: 150 + 3 * y, y }), ys) }),
      mkCurve({ name: '15 kt face', windDirection: 'headwind', familyValue: 15, points: line(y => ({ x: 150 + 2 * y, y }), ys) })
    ],
    linkedFrom: ['g1'],
    ...over
  };
}

const mkFrame = (graphId, xLeftPx, over = {}) => ({
  graphId,
  xLeftPx,
  xRightPx: xLeftPx + 380,
  xTicks: [{ value: 0, pixel: xLeftPx + 10 }, { value: 100, pixel: xLeftPx + 370 }],
  ...over
});

const mkWorkshop = (over = {}) => ({
  image: { url: 'blob:manex', x: 0, y: 0, width: 800, height: 400 },
  sharedY: { min: 0, max: 100, step: 25, unit: '', title: 'custom' },
  yTicks: [{ value: 0, pixel: 350 }, { value: 100, pixel: 20 }],
  frames: [mkFrame('g1', 0), mkFrame('g2', 400)],
  ...over
});

const mkRefCase = (over = {}) => ({
  id: 'rc1',
  label: 'Exemple POH p.5-9',
  inputValue: 0,
  parameters: { g1: 2000, g2: 1000 },
  expected: 57.5,
  tolerancePct: 5,
  ...over
});

// Graphe tel que créé par AbacBuilder.addGraphToWorkshop (vierge).
const mkVirginGraph = () => ({
  id: 'gv',
  name: 'Graphique 1',
  isWindRelated: false,
  axes: {
    xAxis: { min: 0, max: 100, unit: '', title: '' },
    yAxis: { min: 0, max: 100, unit: '', title: '' }
  },
  curves: []
});

const virginWorkshop = () => ({
  image: null,
  sharedY: { min: 0, max: 100, unit: '', title: '' },
  frames: []
});

const ctxOf = (over = {}) => ({
  isFirst: false,
  isLast: false,
  frame: undefined,
  sharedYCalibrated: true,
  ...over
});

const byId = (items, suffix) => items.find(it => it.id.endsWith(suffix));

// ─── Modèle vierge : tout todo ─────────────────────────────────────────────

describe('modèle vierge — tout est « à faire », rien n\'est « bloquant »', () => {
  it('set vide : tous les items todo, canSave true (rien de contradictoire)', () => {
    const { items, canSave } = computeSetReadiness([], virginWorkshop(), [], '');
    expect(items).toHaveLength(6);
    expect(items.map(it => it.state)).toEqual(['todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(canSave).toBe(true);
  });

  it('graphe vierge : 5 items, tous todo (identité du premier cadre incluse)', () => {
    const items = computeGraphReadiness(
      mkVirginGraph(),
      ctxOf({ isFirst: true, isLast: true, sharedYCalibrated: false })
    );
    expect(items).toHaveLength(5);
    expect(items.every(it => it.state === 'todo')).toBe(true);
    // Les axes 0..100 par défaut (sans pas) ne comptent PAS comme saisis.
    expect(byId(items, ':x-bounds').state).toBe('todo');
    // Primaire par défaut sans opération : à faire (le bloquant est au niveau du set).
    expect(byId(items, ':identity').detail).toMatch(/opération/i);
  });

  it('banc vide : le message invite à ajouter l\'exemple du manuel', () => {
    const { items } = computeSetReadiness([], virginWorkshop(), [], '');
    const bench = items.find(it => it.id === READINESS_BENCH_ITEM_ID);
    expect(bench.state).toBe('todo');
    expect(bench.detail).toBe("aucun cas de référence — ajoute l'exemple du manuel");
  });
});

// ─── Modèle décollage complet : tout done, canSave true ────────────────────

describe('modèle décollage complet — tout done, canSave true', () => {
  const graphs = [mkPrimaryTakeoff(), mkMassPanel()];
  const workshop = mkWorkshop();

  it('set : les 6 items done, canSave true (banc 1/1 PASS)', () => {
    const { items, canSave } = computeSetReadiness(graphs, workshop, [mkRefCase()], 'PA-28 décollage');
    expect(items.map(it => `${it.id}=${it.state}`)).toEqual([
      'set:primary=done',
      'set:frames=done',
      'set:shared-y=done',
      'set:chain=done',
      'set:model-name=done',
      'set:reference-bench=done'
    ]);
    const bench = items.find(it => it.id === READINESS_BENCH_ITEM_ID);
    expect(bench.detail).toBe('1/1 PASS');
    expect(canSave).toBe(true);
  });

  it('G1 (premier cadre, primaire) : 6 items, tous done', () => {
    const items = computeGraphReadiness(
      graphs[0],
      ctxOf({ isFirst: true, frame: workshop.frames[0] })
    );
    expect(items).toHaveLength(6);
    expect(items.every(it => it.state === 'done')).toBe(true);
    expect(byId(items, ':identity').detail).toMatch(/décollage/i);
  });

  // 23/08 (retour pilote) : un panneau de correction n'a plus d'item « valeur
  // de famille » mais un item « Numérotation des guides » — le moteur ne lit
  // pas la valeur des guides, seulement leur numéro d'ordre. D'où 5 items.
  it('G2 (intermédiaire standard) : items done, pas d identité, numérotation vérifiée', () => {
    const items = computeGraphReadiness(
      graphs[1],
      ctxOf({ isLast: true, frame: workshop.frames[1] })
    );
    expect(items).toHaveLength(5);
    expect(items.every(it => it.state === 'done')).toBe(true);
    expect(byId(items, ':identity')).toBeUndefined();
    expect(byId(items, ':family-values').label).toBe('Numérotation des guides');
  });
});

// ─── Parcours par cadre : ①②③ ──────────────────────────────────────────────

describe('checklist par cadre — variable X, bornes/pas, calibration', () => {
  it('① variable X inconnue du catalogue : todo avec détail', () => {
    const g = mkPrimaryTakeoff({ axes: { xAxis: { min: -20, max: 40, step: 10, unit: '', title: 'zzz' }, yAxis: { min: 0, max: 100, unit: '', title: '' } } });
    const it1 = byId(computeGraphReadiness(g, ctxOf({ isFirst: true })), ':x-variable');
    expect(it1.state).toBe('todo');
    expect(it1.detail).toMatch(/canonique/);
  });

  it('① axe de transfert (« custom ») sur X : todo — il faut la variable réelle', () => {
    const g = mkPrimaryTakeoff({ axes: { xAxis: { min: -20, max: 40, step: 10, unit: '', title: 'custom' }, yAxis: { min: 0, max: 100, unit: '', title: '' } } });
    const it1 = byId(computeGraphReadiness(g, ctxOf({ isFirst: true })), ':x-variable');
    expect(it1.state).toBe('todo');
  });

  it('② bornes saisies mais pas manquant : todo nommant le pas', () => {
    const g = mkPrimaryTakeoff({ axes: { xAxis: { min: -20, max: 40, unit: '°C', title: 'oat' }, yAxis: { min: 0, max: 100, unit: '', title: '' } } });
    const it2 = byId(computeGraphReadiness(g, ctxOf({ isFirst: true })), ':x-bounds');
    expect(it2.state).toBe('todo');
    expect(it2.detail).toMatch(/pas/);
  });

  it('③ cadre absent : todo « cadre non posé »', () => {
    const it3 = byId(computeGraphReadiness(mkPrimaryTakeoff(), ctxOf({ isFirst: true, frame: undefined })), ':x-calibration');
    expect(it3.state).toBe('todo');
    expect(it3.detail).toMatch(/cadre non posé/);
  });

  it('③ une seule graduation cliquée : todo (1/2) ; deux : done', () => {
    const oneTick = mkFrame('g1', 0, { xTicks: [{ value: 0, pixel: 10 }] });
    const g = mkPrimaryTakeoff();
    const it3 = byId(computeGraphReadiness(g, ctxOf({ isFirst: true, frame: oneTick })), ':x-calibration');
    expect(it3.state).toBe('todo');
    expect(it3.detail).toMatch(/1\/2/);
    const it3b = byId(computeGraphReadiness(g, ctxOf({ isFirst: true, frame: mkFrame('g1', 0) })), ':x-calibration');
    expect(it3b.state).toBe('done');
  });

  it('③ X calibré mais Y commun non calibré : done avec rappel vers le set', () => {
    const it3 = byId(
      computeGraphReadiness(mkPrimaryTakeoff(), ctxOf({ isFirst: true, frame: mkFrame('g1', 0), sharedYCalibrated: false })),
      ':x-calibration'
    );
    expect(it3.state).toBe('done');
    expect(it3.detail).toMatch(/Y commun/);
  });
});

// ─── Lecture descendante (readoutAxis: 'x') ────────────────────────────────

describe('lecture descendante — règles du dernier cadre et de la famille', () => {
  it('zone en dernier avec famille : identité done', () => {
    const items = computeGraphReadiness(mkWindZone(), ctxOf({ isLast: true, frame: mkFrame('gz', 800) }));
    const identity = byId(items, ':identity');
    expect(identity.state).toBe('done');
    expect(identity.detail).toMatch(/vent/i);
  });

  it('zone en MILIEU de chaîne : identité blocked (« dernier cadre »)', () => {
    const identity = byId(computeGraphReadiness(mkWindZone(), ctxOf()), ':identity');
    expect(identity.state).toBe('blocked');
    expect(identity.detail).toMatch(/DERNIER/);
  });

  it('zone en PREMIER : identité blocked (entrée sur X impossible)', () => {
    const identity = byId(computeGraphReadiness(mkWindZone(), ctxOf({ isFirst: true, isLast: true })), ':identity');
    expect(identity.state).toBe('blocked');
    expect(identity.detail).toMatch(/premier/i);
  });

  it('famille manquante sur zone descendante : identité blocked avec détail', () => {
    const identity = byId(
      computeGraphReadiness(mkWindZone({ familyAxisVariable: undefined }), ctxOf({ isLast: true })),
      ':identity'
    );
    expect(identity.state).toBe('blocked');
    expect(identity.detail).toMatch(/famille/);
  });

  it('au niveau du set : readoutAxis en milieu de chaîne rend la CHAÎNE blocked, canSave false', () => {
    // Ordre des cadres : g1 → gz (lecture X) → g2 : la zone n'est pas dernière.
    const graphs = [mkPrimaryTakeoff(), mkWindZone(), mkMassPanel()];
    const workshop = mkWorkshop({ frames: [mkFrame('g1', 0), mkFrame('gz', 400), mkFrame('g2', 800)] });
    const { items, canSave } = computeSetReadiness(graphs, workshop, [], 'PA-28 atterrissage');
    const chain = items.find(it => it.id === 'set:chain');
    expect(chain.state).toBe('blocked');
    expect(chain.detail).toMatch(/dernier graphe/);
    expect(canSave).toBe(false);
  });

  it('au niveau du set : famille manquante sur la zone finale rend la chaîne blocked', () => {
    const graphs = [mkPrimaryTakeoff({ linkedTo: ['gz'] }), mkWindZone({ familyAxisVariable: undefined })];
    const workshop = mkWorkshop({ frames: [mkFrame('g1', 0), mkFrame('gz', 400)] });
    const { items, canSave } = computeSetReadiness(graphs, workshop, [], 'PA-28 atterrissage');
    const chain = items.find(it => it.id === 'set:chain');
    expect(chain.state).toBe('blocked');
    expect(chain.detail).toMatch(/variable de famille/);
    expect(canSave).toBe(false);
  });
});

// ─── Courbes : familyValue et direction de vent ────────────────────────────

describe('courbes — valeurs de famille et direction du vent', () => {
  it('⑥ courbes sans familyValue : todo avec compte (1 sur 3)', () => {
    const g = mkPrimaryTakeoff();
    g.curves = [
      ...g.curves,
      mkCurve({ name: '8000 ft', points: line(x => ({ x, y: 90 + 0.2 * x }), [-20, 0, 20, 40]) }) // familyValue absent
    ];
    const fam = byId(computeGraphReadiness(g, ctxOf({ isFirst: true })), ':family-values');
    expect(fam.state).toBe('todo');
    expect(fam.detail).toMatch(/1 courbe sur 3/);
  });

  // 23/08 : sur un panneau de correction, l'item existe toujours mais porte
  // sur la NUMÉROTATION des guides (aucune valeur de famille n'est attendue).
  it('⑥ panneau de correction sans famille : item de numérotation des guides', () => {
    const g = mkMassPanel({ familyAxisVariable: undefined });
    const it6 = byId(computeGraphReadiness(g, ctxOf()), ':family-values');
    expect(it6).toBeDefined();
    expect(it6.label).toBe('Numérotation des guides');
    expect(it6.state).toBe('done');
  });

  it('⑥ guide sans numéro : todo avec invitation à déduire des noms', () => {
    const g = mkMassPanel({ familyAxisVariable: undefined });
    g.curves = g.curves.map((c, i) => (i === 0 ? { ...c, familyValue: undefined, name: 'guide' } : c));
    const it6 = byId(computeGraphReadiness(g, ctxOf()), ':family-values');
    expect(it6.state).toBe('todo');
    expect(it6.detail).toMatch(/sans numéro/);
  });

  it('⑥ premier cadre : la VALEUR de famille reste exigée (bracket par valeur)', () => {
    const g = mkMassPanel({ familyAxisVariable: 'pressure_altitude' });
    g.curves = g.curves.map(c => ({ ...c, familyValue: undefined }));
    const it6 = byId(computeGraphReadiness(g, ctxOf({ isFirst: true })), ':family-values');
    expect(it6.label).toBe('Valeurs de famille des courbes');
    expect(it6.state).toBe('todo');
  });

  it('⑦ graphe vent : courbe sans windDirection → todo avec compte', () => {
    const z = mkWindZone();
    z.curves = [...z.curves, mkCurve({ name: '5 kt arrière', familyValue: 5, points: line(y => ({ x: 150 + 3.5 * y, y }), [0, 50, 100]) })];
    const wind = byId(computeGraphReadiness(z, ctxOf({ isLast: true })), ':wind-direction');
    expect(wind.state).toBe('todo');
    expect(wind.detail).toMatch(/1 courbe/);
  });

  it('⑦ toutes les courbes taguées (y compris « vent nul ») : done', () => {
    const wind = byId(computeGraphReadiness(mkWindZone(), ctxOf({ isLast: true })), ':wind-direction');
    expect(wind.state).toBe('done');
  });

  it('⑤ aucune courbe : todo ; courbe à 1 point : todo aussi', () => {
    const g = mkMassPanel({ curves: [] });
    expect(byId(computeGraphReadiness(g, ctxOf()), ':curves').state).toBe('todo');
    const g2 = mkMassPanel({ curves: [mkCurve({ name: '1', familyValue: 1, points: [{ x: 900, y: 40 }] })] });
    expect(byId(computeGraphReadiness(g2, ctxOf()), ':curves').state).toBe('todo');
  });
});

// ─── Set : primaire, cadres, Y commun, nom ─────────────────────────────────

describe('checklist du set — primaire, cadres, Y commun, nom', () => {
  it('primaire sans opération : set:primary blocked, canSave false', () => {
    const graphs = [mkPrimaryTakeoff({ operationId: undefined }), mkMassPanel()];
    const { items, canSave } = computeSetReadiness(graphs, mkWorkshop(), [], 'PA-28 décollage');
    const primary = items.find(it => it.id === 'set:primary');
    expect(primary.state).toBe('blocked');
    expect(primary.detail).toMatch(/opération/);
    expect(canSave).toBe(false);
  });

  it('operationId inconnu du catalogue : blocked, canSave false', () => {
    const graphs = [mkPrimaryTakeoff({ operationId: 'takeof_groundroll' }), mkMassPanel()];
    const { items, canSave } = computeSetReadiness(graphs, mkWorkshop(), [], 'x');
    expect(items.find(it => it.id === 'set:primary').state).toBe('blocked');
    expect(canSave).toBe(false);
  });

  it('deux primaires : blocked avec les deux noms, canSave false', () => {
    const graphs = [mkPrimaryTakeoff(), mkMassPanel({ role: 'primary', operationId: 'takeoff_ground_roll_flaps_to' })];
    const { items, canSave } = computeSetReadiness(graphs, mkWorkshop(), [], 'x');
    const primary = items.find(it => it.id === 'set:primary');
    expect(primary.state).toBe('blocked');
    expect(primary.detail).toMatch(/2 graphiques primaires/);
    expect(primary.detail).toMatch(/Panneau masse/);
    expect(canSave).toBe(false);
  });

  it('aucun primaire (tous intermédiaires) : blocked', () => {
    const graphs = [mkPrimaryTakeoff({ role: 'intermediate', operationId: undefined }), mkMassPanel()];
    const { items } = computeSetReadiness(graphs, mkWorkshop(), [], 'x');
    expect(items.find(it => it.id === 'set:primary').state).toBe('blocked');
  });

  it('graphe sans cadre : set:frames todo en nommant le graphe', () => {
    const graphs = [mkPrimaryTakeoff(), mkMassPanel()];
    const workshop = mkWorkshop({ frames: [mkFrame('g1', 0)] });
    const frames = computeSetReadiness(graphs, workshop, [], 'x').items.find(it => it.id === 'set:frames');
    expect(frames.state).toBe('todo');
    expect(frames.detail).toMatch(/Panneau masse/);
  });

  it('Y commun : 2 graduations suffisent même sans pas saisi', () => {
    const workshop = mkWorkshop({ sharedY: { min: 0, max: 100, unit: '', title: 'custom' } });
    const y = computeSetReadiness([mkPrimaryTakeoff(), mkMassPanel()], workshop, [], 'x').items.find(it => it.id === 'set:shared-y');
    expect(y.state).toBe('done');
    expect(y.detail).toMatch(/graduations/);
  });

  it('Y commun : bornes + pas saisis suffisent sans graduations', () => {
    const workshop = mkWorkshop({ yTicks: [] });
    const y = computeSetReadiness([mkPrimaryTakeoff(), mkMassPanel()], workshop, [], 'x').items.find(it => it.id === 'set:shared-y');
    expect(y.state).toBe('done');
  });

  it('Y commun : ni graduations ni pas → todo', () => {
    const workshop = mkWorkshop({ yTicks: [], sharedY: { min: 0, max: 100, unit: '', title: '' } });
    const y = computeSetReadiness([mkPrimaryTakeoff(), mkMassPanel()], workshop, [], 'x').items.find(it => it.id === 'set:shared-y');
    expect(y.state).toBe('todo');
  });

  it('nom de modèle : vide ou espaces → todo ; renseigné → done', () => {
    const graphs = [mkPrimaryTakeoff(), mkMassPanel()];
    expect(computeSetReadiness(graphs, mkWorkshop(), [], '   ').items.find(it => it.id === 'set:model-name').state).toBe('todo');
    expect(computeSetReadiness(graphs, mkWorkshop(), [], 'PA-28').items.find(it => it.id === 'set:model-name').state).toBe('done');
  });
});

// ─── Banc de test : PASS / FAIL non bloquant ───────────────────────────────

describe('banc de test — avertissement, jamais bloquant pour canSave', () => {
  const graphs = [mkPrimaryTakeoff(), mkMassPanel()];

  it('cas FAIL : item blocked avec détail du cas, mais canSave reste true', () => {
    const badCase = mkRefCase({ expected: 100 }); // calculé 57.5 → écart 42.5 %
    const { items, canSave } = computeSetReadiness(graphs, mkWorkshop(), [badCase], 'PA-28 décollage');
    const bench = items.find(it => it.id === READINESS_BENCH_ITEM_ID);
    expect(bench.state).toBe('blocked');
    expect(bench.detail).toMatch(/0\/1 PASS/);
    expect(bench.detail).toMatch(/Exemple POH/);
    expect(bench.detail).toMatch(/100/);
    expect(canSave).toBe(true); // le pilote juge — décision R13
  });

  it('mélange PASS + erreur : compte x/y et message d\'erreur repris', () => {
    const errCase = mkRefCase({ id: 'rc2', label: 'Cas incomplet', parameters: { g1: 2000 } }); // paramètre g2 manquant
    const { items } = computeSetReadiness(graphs, mkWorkshop(), [mkRefCase(), errCase], 'x');
    const bench = items.find(it => it.id === READINESS_BENCH_ITEM_ID);
    expect(bench.state).toBe('blocked');
    expect(bench.detail).toMatch(/1\/2 PASS/);
    expect(bench.detail).toMatch(/Cas incomplet/);
  });

  it('tous les cas PASS : done « n/n PASS »', () => {
    const { items } = computeSetReadiness(graphs, mkWorkshop(), [mkRefCase(), mkRefCase({ id: 'rc3', label: 'Bis' })], 'x');
    const bench = items.find(it => it.id === READINESS_BENCH_ITEM_ID);
    expect(bench.state).toBe('done');
    expect(bench.detail).toBe('2/2 PASS');
  });
});

// ─── Pureté : les entrées ne sont jamais mutées ────────────────────────────

describe('pureté', () => {
  it('computeSetReadiness ne mute ni les graphes ni le workshop', () => {
    const graphs = [mkPrimaryTakeoff(), mkMassPanel()];
    const workshop = mkWorkshop();
    const snapGraphs = JSON.stringify(graphs);
    const snapWorkshop = JSON.stringify(workshop);
    computeSetReadiness(graphs, workshop, [mkRefCase()], 'PA-28');
    expect(JSON.stringify(graphs)).toBe(snapGraphs);
    expect(JSON.stringify(workshop)).toBe(snapWorkshop);
  });

  it('la chaîne suit l\'ordre des cadres (xLeftPx), pas l\'ordre du tableau graphs', () => {
    // g2 déclaré AVANT g1 mais cadré À DROITE : la chaîne reste g1 → g2.
    const graphs = [mkMassPanel(), mkPrimaryTakeoff()];
    const { items } = computeSetReadiness(graphs, mkWorkshop(), [mkRefCase()], 'PA-28');
    expect(items.find(it => it.id === 'set:chain').state).toBe('done');
    expect(items.find(it => it.id === 'set:chain').detail).toBe('Panneau OAT / Altitude → Panneau masse');
    // Le banc rejoue la même chaîne ordonnée : le cas passe encore.
    expect(items.find(it => it.id === READINESS_BENCH_ITEM_ID).state).toBe('done');
  });
});
