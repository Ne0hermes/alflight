// @vitest-environment jsdom
//
// src/features/aircraft/components/wizard-steps/__tests__/Step2Speeds.stallMatrix.test.jsx
//
// Bug signalé par le pilote le 24/08/2026 : « quand je change les configurations
// des vitesses de décrochage, ça modifie le texte de l'avertissement de cohérence,
// mais ça ne remplit JAMAIS les champs de la matrice ».
//
// Ce test monte réellement l'étape dans un DOM, simule une frappe dans une
// cellule, ré-injecte la donnée comme le fait le wizard (updateData → setState →
// nouveau rendu) et vérifie que la cellule AFFICHE la valeur saisie.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils'; // React 18 : act vit encore ici
import Step2Speeds from '../Step2Speeds';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// Écrit dans data comme le fait updateData du wizard (chemin pointé).
const setByPath = (obj, path, value) => {
  const segs = path.split('.');
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) {
    cur[segs[i]] = { ...(cur[segs[i]] || {}) };
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = value;
  return out;
};

const fiche = { speeds: { vso: 45, vsTO: 48, vs1: 50, vne: 160, vno: 125, vfeLdg: 85 } };

// Monte l'étape avec un updateData qui se comporte comme celui du wizard :
// il met à jour l'état et provoque un nouveau rendu.
function mountStep(initial = fiche) {
  const state = { data: initial, calls: [] };
  const render = () => {
    act(() => {
      root.render(
        <Step2Speeds
          data={state.data}
          errors={{}}
          updateData={(path, value) => {
            state.calls.push([path, value]);
            state.data = setByPath(state.data, path, value);
            render();
          }}
        />
      );
    });
  };
  render();
  return state;
}

const cellule = (label) => container.querySelector(`input[aria-label="${label}"]`);

// Frappe native : React écoute l'événement input, pas un simple .value = ….
const taper = (input, texte) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('matrice des vitesses de décrochage — la saisie doit rester affichée', () => {
  it('une cellule inclinée (40° lisse) garde le chiffre saisi', () => {
    const state = mountStep();
    const input = cellule("Décrochage lisse à 40° d'inclinaison");
    expect(input, 'la cellule 40° lisse doit exister').toBeTruthy();
    expect(input.value).toBe('');

    taper(input, '57');

    // La donnée est bien écrite…
    expect(state.data.speeds.stallByBank).toEqual({ clean: { b40: 57 } });
    // …et surtout la cellule l'AFFICHE (c'est ce qui manquait).
    expect(cellule("Décrochage lisse à 40° d'inclinaison").value).toBe('57');
  });

  it('une cellule 0° (VS1) garde le chiffre saisi', () => {
    const state = mountStep();
    const input = cellule("VS1 — décrochage lisse à 0° d'inclinaison");
    expect(input).toBeTruthy();
    expect(input.value).toBe('50');

    taper(input, '52');

    expect(state.data.speeds.vs1).toBe(52);
    expect(cellule("VS1 — décrochage lisse à 0° d'inclinaison").value).toBe('52');
  });

  it('deux cellules de configurations différentes coexistent', () => {
    const state = mountStep();
    taper(cellule("Décrochage lisse à 30° d'inclinaison"), '54');
    taper(cellule("Décrochage atterrissage à 45° d'inclinaison"), '53');

    expect(state.data.speeds.stallByBank).toEqual({ clean: { b30: 54 }, landing: { b45: 53 } });
    expect(cellule("Décrochage lisse à 30° d'inclinaison").value).toBe('54');
    expect(cellule("Décrochage atterrissage à 45° d'inclinaison").value).toBe('53');
  });
});
