// src/abac/curves/core/__tests__/plancheSetup.test.js
//
// Lot 1-C — DÉDUCTION du set depuis l'écran « Opération » de l'atelier.
// (.js : le pattern vitest de src/ n'inclut que {js,jsx} — même convention
//  que atelierDraftStore.test.js voisin.)
// Invariants verrouillés ici (vérité moteur, cascade positionnelle) :
//
//   1. LE PRIMAIRE EST LE PREMIER CADRE (convention F-GIEA/F-GUVV) : graphe 1
//      = role 'primary' + operationId + famille suggérée 'pressure_altitude',
//      suivants = 'intermediate'. Jamais de primaire en dernier.
//   2. Lecture DESCENDANTE : le DERNIER graphe (et lui seul) porte
//      readoutAxis 'x' + famille 'wind_component' + isWindRelated.
//   3. Les cadres pré-répartis couvrent le canevas dans l'ordre des graphes
//      (gauche→droite = chaîne de calcul).
//   4. « Appliquer » réécrit rôles/readoutAxis/operationId sur la chaîne SANS
//      toucher aux graphes hors chaîne, SANS écraser les familles déjà
//      choisies ni les noms personnalisés — et nettoie l'ancien readoutAxis
//      lors d'un passage descendante → standard.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PANEL_COUNT,
  defaultPanelName,
  isAutoPanelName,
  distributeFrames,
  buildSetupGraphs,
  applySetupRoles,
  appendPanels
} from '../plancheSetup';

let seq = 0;
const mkId = () => `id-${++seq}`;

describe('plancheSetup — création (buildSetupGraphs)', () => {
  it('standard 3 panneaux : primaire EN PREMIER avec operationId/outputKind/famille, suivants intermédiaires', () => {
    const { graphs, frames } = buildSetupGraphs(
      { operationId: 'takeoff_50ft_flaps_to', plancheType: 'standard', panelCount: 3 },
      mkId
    );
    expect(graphs).toHaveLength(3);
    expect(frames).toHaveLength(3);

    const [g1, g2, g3] = graphs;
    expect(g1.role).toBe('primary');
    expect(g1.operationId).toBe('takeoff_50ft_flaps_to');
    // takeoff_50ft_flaps_to n'accepte qu'UNE sortie → posée d'office
    expect(g1.outputKind).toBe('distance');
    expect(g1.outputUnit).toBe('m');
    expect(g1.familyAxisVariable).toBe('pressure_altitude');
    expect(g1.name).toBe('Panneau d\'entrée');
    expect(g1.readoutAxis).toBeUndefined();

    for (const g of [g2, g3]) {
      expect(g.role).toBe('intermediate');
      expect(g.operationId).toBeUndefined();
      expect(g.readoutAxis).toBeUndefined();
      expect(g.isWindRelated).toBe(false);
    }
    expect(g2.name).toBe('Correction 2');
    expect(g3.name).toBe('Correction 3');
  });

  it('descendante 2 panneaux : dernier graphe readoutAxis x + famille vent + isWindRelated, primaire toujours premier', () => {
    const { graphs } = buildSetupGraphs(
      { operationId: 'landing_50ft_flaps_landing', plancheType: 'descendante', panelCount: 2 },
      mkId
    );
    const [entry, out] = graphs;
    expect(entry.role).toBe('primary');
    expect(entry.operationId).toBe('landing_50ft_flaps_landing');
    expect(entry.familyAxisVariable).toBe('pressure_altitude');
    expect(entry.readoutAxis).toBeUndefined();

    expect(out.role).toBe('intermediate');
    expect(out.readoutAxis).toBe('x');
    expect(out.familyAxisVariable).toBe('wind_component');
    expect(out.isWindRelated).toBe(true);
    expect(out.name).toBe('Zone de sortie (lue en bas)');
  });

  it('opération multi-sorties (climb_takeoff) : outputKind/outputUnit laissés au choix ultérieur', () => {
    const { graphs } = buildSetupGraphs(
      { operationId: 'climb_takeoff', plancheType: 'standard', panelCount: 1 },
      mkId
    );
    expect(graphs[0].operationId).toBe('climb_takeoff');
    expect(graphs[0].outputKind).toBeUndefined();
    expect(graphs[0].outputUnit).toBeUndefined();
  });

  it('cadres pré-répartis : ordre gauche→droite = ordre des graphes, largeurs égales, bornes croissantes', () => {
    const { graphs, frames } = buildSetupGraphs(
      { operationId: 'takeoff_50ft_flaps_up', plancheType: 'standard', panelCount: 4 },
      mkId
    );
    expect(frames.map(f => f.graphId)).toEqual(graphs.map(g => g.id));
    const widths = frames.map(f => f.xRightPx - f.xLeftPx);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeGreaterThanOrEqual(60);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].xLeftPx).toBeGreaterThan(frames[i - 1].xRightPx);
    }
    // dans le canevas (inner 880 px)
    expect(frames[0].xLeftPx).toBeGreaterThanOrEqual(0);
    expect(frames[frames.length - 1].xRightPx).toBeLessThanOrEqual(880);
  });

  it('défauts du sélecteur : 3 en standard, 2 en descendante', () => {
    expect(DEFAULT_PANEL_COUNT.standard).toBe(3);
    expect(DEFAULT_PANEL_COUNT.descendante).toBe(2);
  });
});

describe('plancheSetup — Appliquer (applySetupRoles)', () => {
  const mkGraph = (partial) => ({
    id: mkId(),
    name: 'Graphique X',
    isWindRelated: false,
    axes: {
      xAxis: { min: 0, max: 100, unit: '', title: '' },
      yAxis: { min: 0, max: 100, unit: '', title: '' }
    },
    curves: [],
    ...partial
  });

  it('réassigne primaire au PREMIER de la chaîne et retire l\'identité des autres', () => {
    // Modèle legacy « à l'envers » : primaire posé en dernier.
    const g1 = mkGraph({ name: 'Panneau d\'entrée', role: 'intermediate' });
    const g2 = mkGraph({ name: 'Correction 2', role: 'primary', operationId: 'landing_50ft_flaps_landing', outputKind: 'distance', outputUnit: 'm' });
    const next = applySetupRoles([g1, g2], [g1.id, g2.id], {
      operationId: 'landing_50ft_flaps_landing', plancheType: 'descendante', panelCount: 2
    });
    expect(next[0].role).toBe('primary');
    expect(next[0].operationId).toBe('landing_50ft_flaps_landing');
    expect(next[1].role).toBe('intermediate');
    expect(next[1].operationId).toBeUndefined();
    expect(next[1].outputKind).toBeUndefined();
    expect(next[1].readoutAxis).toBe('x');
    expect(next[1].isWindRelated).toBe(true);
    expect(next[1].name).toBe('Zone de sortie (lue en bas)'); // nom auto re-généré
  });

  it('descendante → standard : nettoie readoutAxis du dernier graphe', () => {
    const g1 = mkGraph({ role: 'primary', operationId: 'takeoff_50ft_flaps_to', familyAxisVariable: 'pressure_altitude' });
    const g2 = mkGraph({ role: 'intermediate', readoutAxis: 'x', familyAxisVariable: 'wind_component', isWindRelated: true });
    const next = applySetupRoles([g1, g2], [g1.id, g2.id], {
      operationId: 'takeoff_50ft_flaps_to', plancheType: 'standard', panelCount: 2
    });
    expect(next[1].readoutAxis).toBeUndefined();
    // la famille déjà choisie par l'utilisateur n'est PAS écrasée
    expect(next[1].familyAxisVariable).toBe('wind_component');
  });

  it('conserve noms personnalisés et familles choisies ; ne touche pas aux graphes hors chaîne', () => {
    const g1 = mkGraph({ name: 'Mon panneau OAT', familyAxisVariable: 'mass' });
    const g2 = mkGraph({ name: 'Correction 2' });
    const hors = mkGraph({ name: 'Hors chaîne', role: 'primary', operationId: 'cruise_speed' });
    const next = applySetupRoles([g1, g2, hors], [g1.id, g2.id], {
      operationId: 'takeoff_ground_roll_flaps_up', plancheType: 'standard', panelCount: 2
    });
    expect(next[0].name).toBe('Mon panneau OAT');       // nom perso conservé
    expect(next[0].familyAxisVariable).toBe('mass');    // famille utilisateur conservée
    expect(next[1].name).toBe('Correction 2');          // nom auto re-généré (identique ici)
    expect(next[2]).toBe(hors);                         // hors chaîne : référence intacte
  });

  it('outputKind conservé s\'il reste valide pour la nouvelle opération multi-sorties', () => {
    const g1 = mkGraph({ role: 'primary', operationId: 'climb_takeoff', outputKind: 'climb_gradient', outputUnit: '%' });
    const next = applySetupRoles([g1], [g1.id], {
      operationId: 'go_around_climb', plancheType: 'standard', panelCount: 1
    });
    expect(next[0].operationId).toBe('go_around_climb');
    expect(next[0].outputKind).toBe('climb_gradient'); // accepté par go_around_climb
    expect(next[0].outputUnit).toBe('%');
  });
});

describe('plancheSetup — appendPanels / helpers', () => {
  it('avec cadres existants : nouveaux cadres appendus à droite ; sans cadre (legacy) : aucun cadre', () => {
    const withFrames = appendPanels(
      [{ graphId: 'a', xLeftPx: 12, xRightPx: 300 }],
      2, 1, mkId
    );
    expect(withFrames.graphs).toHaveLength(2);
    expect(withFrames.frames).toHaveLength(2);
    expect(withFrames.frames[0].xLeftPx).toBeGreaterThan(300);
    for (const f of withFrames.frames) {
      expect(f.xRightPx).toBeGreaterThan(f.xLeftPx);
      expect(f.xRightPx).toBeLessThanOrEqual(880);
    }

    const noFrames = appendPanels([], 2, 0, mkId);
    expect(noFrames.graphs).toHaveLength(2);
    expect(noFrames.frames).toHaveLength(0);
  });

  it('defaultPanelName / isAutoPanelName cohérents (les noms générés sont renommables)', () => {
    expect(defaultPanelName(0, 3, 'standard')).toBe('Panneau d\'entrée');
    expect(defaultPanelName(2, 3, 'descendante')).toBe('Zone de sortie (lue en bas)');
    expect(defaultPanelName(1, 3, 'descendante')).toBe('Correction 2');
    for (const n of ['Panneau d\'entrée', 'Correction 4', 'Zone de sortie (lue en bas)', 'Graphique 2', 'Graphique principal']) {
      expect(isAutoPanelName(n)).toBe(true);
    }
    expect(isAutoPanelName('Mon panneau OAT')).toBe(false);
  });

  it('distributeFrames : liste vide → aucun cadre', () => {
    expect(distributeFrames([])).toEqual([]);
  });
});
