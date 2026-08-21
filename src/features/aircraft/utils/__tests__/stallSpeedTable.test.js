// src/features/aircraft/utils/__tests__/stallSpeedTable.test.js
//
// Tableau des vitesses de décrochage (21/08/2026) : colonne 0° = vs1 / vsTO /
// vso (mêmes champs que les arcs), colonnes 20/40/60° dans speeds.stallByBank.
// Règle du projet : absent reste absent — on n'écrit RIEN quand c'est vide,
// jamais un 0 fabriqué. Les incohérences sont des avertissements, pas des
// blocages (le manuel fait foi).

import { describe, it, expect } from 'vitest';
import {
  STALL_CONFIGS,
  STALL_BANKS,
  getStallSpeed,
  setStallByBank,
  stallSpeedWarnings,
} from '../stallSpeedTable';

describe('modèle du tableau', () => {
  it('trois configurations dans l\'ordre lisse / décollage / atterrissage, adossées à vs1 / vsTO / vso', () => {
    expect(STALL_CONFIGS.map((c) => c.key)).toEqual(['clean', 'takeoff', 'landing']);
    expect(STALL_CONFIGS.map((c) => c.field)).toEqual(['vs1', 'vsTO', 'vso']);
  });

  it('trois inclinaisons facultatives 20 / 40 / 60°', () => {
    expect(STALL_BANKS.map((b) => b.deg)).toEqual([20, 40, 60]);
    expect(STALL_BANKS.map((b) => b.key)).toEqual(['b20', 'b40', 'b60']);
  });

  it('la colonne 0° LIT le champ de base — une seule source de vérité', () => {
    const speeds = { vs1: 50, vsTO: '48', vso: 45 };
    expect(getStallSpeed(speeds, 'clean', 0)).toBe(50);
    expect(getStallSpeed(speeds, 'takeoff', 0)).toBe(48); // chaîne → nombre
    expect(getStallSpeed(speeds, 'landing', 0)).toBe(45);
  });

  it('une fiche sans stallByBank s\'ouvre telle quelle : colonnes vides', () => {
    const speeds = { vs1: 50, vsTO: 48, vso: 45 };
    expect(getStallSpeed(speeds, 'clean', 20)).toBeNull();
    expect(getStallSpeed(speeds, 'landing', 60)).toBeNull();
    expect(getStallSpeed(undefined, 'clean', 0)).toBeNull();
  });
});

describe('setStallByBank — n\'écrit rien quand vide', () => {
  it('vider une cellule d\'un objet absent ne crée RIEN (undefined, pas {} ni 0)', () => {
    expect(setStallByBank(undefined, 'clean', 'b20', '')).toBeUndefined();
    expect(setStallByBank(undefined, 'takeoff', 'b60', null)).toBeUndefined();
    expect(setStallByBank({}, 'landing', 'b40', undefined)).toBeUndefined();
  });

  it('vider la dernière cellule fait disparaître la configuration puis l\'objet', () => {
    expect(setStallByBank({ clean: { b20: 55, b40: 60 } }, 'clean', 'b40', '')).toEqual({ clean: { b20: 55 } });
    expect(setStallByBank({ clean: { b20: 55 } }, 'clean', 'b20', '')).toBeUndefined();
    expect(setStallByBank({ clean: { b20: 55 }, landing: { b20: 50 } }, 'landing', 'b20', ''))
      .toEqual({ clean: { b20: 55 } });
  });

  it('une saisie parsable est écrite en NOMBRE (pas la chaîne du champ)', () => {
    expect(setStallByBank(undefined, 'clean', 'b20', '55')).toEqual({ clean: { b20: 55 } });
    expect(setStallByBank(undefined, 'landing', 'b60', '72,5')).toEqual({ landing: { b60: 72.5 } });
  });

  it('une saisie transitoire non parsable est conservée telle quelle (champ contrôlé)', () => {
    // « 4, » parse en 4 (virgule → point) ; seul un vrai non-nombre reste une chaîne.
    expect(setStallByBank(undefined, 'clean', 'b20', '-')).toEqual({ clean: { b20: '-' } });
    expect(setStallByBank(undefined, 'clean', 'b20', '4,')).toEqual({ clean: { b20: 4 } });
  });

  it('ne touche pas aux autres cellules ni aux autres configurations', () => {
    const before = { clean: { b20: 55 }, takeoff: { b40: 58 } };
    const after = setStallByBank(before, 'landing', 'b20', '50');
    expect(after).toEqual({ clean: { b20: 55 }, takeoff: { b40: 58 }, landing: { b20: 50 } });
  });

  it('est pure : l\'objet reçu n\'est pas muté', () => {
    const before = { clean: { b20: 55 } };
    const snapshot = JSON.stringify(before);
    setStallByBank(before, 'clean', 'b40', '60');
    setStallByBank(before, 'clean', 'b20', '');
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('stallSpeedWarnings — avertissements, jamais bloquants', () => {
  it('aucun avertissement quand rien n\'est saisi ou quand la table est cohérente', () => {
    expect(stallSpeedWarnings(undefined)).toEqual([]);
    expect(stallSpeedWarnings({})).toEqual([]);
    expect(stallSpeedWarnings({
      vs1: 50, vsTO: 48, vso: 45,
      stallByBank: {
        clean:   { b20: 52, b40: 57, b60: 71 },
        takeoff: { b20: 50, b40: 55, b60: 68 },
        landing: { b20: 46, b40: 51, b60: 64 },
      },
    })).toEqual([]);
  });

  it('signale une vitesse qui ne croît pas avec l\'inclinaison (même configuration)', () => {
    const w = stallSpeedWarnings({ vs1: 50, stallByBank: { clean: { b20: 52, b40: 51 } } });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/lisse/);
    expect(w[0]).toMatch(/40° \(51 kt\)/);
    expect(w[0]).toMatch(/20° \(52 kt\)/);
  });

  it('compare les valeurs renseignées consécutives (une colonne vide ne casse pas la chaîne)', () => {
    // 20° absent : 40° est comparé à 0°.
    expect(stallSpeedWarnings({ vs1: 50, stallByBank: { clean: { b40: 49 } } })).toHaveLength(1);
    expect(stallSpeedWarnings({ vs1: 50, stallByBank: { clean: { b40: 57 } } })).toEqual([]);
  });

  it('à inclinaison égale, signale décollage > lisse ou atterrissage > décollage', () => {
    const w = stallSpeedWarnings({
      vs1: 50, vsTO: 48, vso: 45,
      stallByBank: { clean: { b20: 52 }, takeoff: { b20: 54 }, landing: { b20: 55 } },
    });
    expect(w).toHaveLength(2);
    expect(w[0]).toMatch(/20°.*décollage \(54 kt\) supérieur à lisse \(52 kt\)/);
    expect(w[1]).toMatch(/20°.*atterrissage \(55 kt\) supérieur à décollage \(54 kt\)/);
  });

  it('l\'égalité entre configurations n\'est PAS signalée (lisse ≥ décollage ≥ atterrissage)', () => {
    // Avion sans position volets décollage : VS T/O recopiée de VS1.
    expect(stallSpeedWarnings({ vs1: 50, vsTO: 50, vso: 45 })).toEqual([]);
  });

  it('à 0°, la paire VS1 / VSO n\'est pas doublonnée (déjà couverte par les arcs)', () => {
    // VSO > VS1 sans VS T/O : aucune paire adjacente renseignée → rien ici.
    expect(stallSpeedWarnings({ vs1: 45, vso: 50 })).toEqual([]);
  });

  it('à 0°, VS T/O > VS1 ou VSO > VS T/O sont signalées', () => {
    expect(stallSpeedWarnings({ vs1: 50, vsTO: 52 })).toHaveLength(1);
    expect(stallSpeedWarnings({ vsTO: 48, vso: 49 })).toHaveLength(1);
  });
});
