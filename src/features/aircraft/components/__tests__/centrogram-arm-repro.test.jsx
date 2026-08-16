// @vitest-environment jsdom
//
// REPRO TEST (diagnostic, ne pas committer) — chaîne complète :
//   CentrogramReader.validateStage → updateData (copie VERBATIM du wizard)
//   → Step3WeightBalance (resync local ← data) → affichage saisie manuelle.
//
// Chart.tsx est mocké (jsdom n'a pas de layout) : le stub expose les props
// (onPointClick, onCalibrationClick) pour piloter les clics en coordonnées DATA.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ─── Mocks ───────────────────────────────────────────────────────────────────
let chartProps = null;
vi.mock('../../../../abac/curves/ui/Chart', () => ({
  Chart: (props) => {
    chartProps = props;
    return React.createElement('div', { 'data-testid': 'chart-stub' });
  },
}));
vi.mock('../CgEnvelopeDualChart', () => ({ default: () => null }));
vi.mock('@services/blobStorage', () => ({ uploadWeighingReportPdf: vi.fn() }));

// URL.createObjectURL n'existe pas dans jsdom
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:fake';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
window.alert = (m) => { throw new Error('ALERT: ' + m); };

import Step3WeightBalance from '../wizard-steps/Step3WeightBalance';

// ─── Harness : réplique VERBATIM de parsePath + updateData du wizard ────────
let lastData = null;
let stepNavApi = null;

function Harness({ initial }) {
  const [aircraftData, setAircraftData] = useState(initial);
  lastData = aircraftData;

  const parsePath = (path) => {
    const segments = [];
    const parts = path.split('.');
    for (const part of parts) {
      const match = part.match(/^([^\[]+)((?:\[\d+\])*)$/);
      if (!match) { segments.push(part); continue; }
      const [, key, indicesPart] = match;
      if (key) segments.push(key);
      if (indicesPart) {
        const indices = [...indicesPart.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]));
        segments.push(...indices);
      }
    }
    return segments;
  };

  const updateData = (path, value) => {
    setAircraftData(prev => {
      const segments = parsePath(path);
      const newData = Array.isArray(prev) ? [...prev] : { ...prev };
      let current = newData;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const nextSeg = segments[i + 1];
        if (current[seg] === undefined || current[seg] === null) {
          current[seg] = typeof nextSeg === 'number' ? [] : {};
        } else {
          current[seg] = Array.isArray(current[seg]) ? [...current[seg]] : { ...current[seg] };
        }
        current = current[seg];
      }
      current[segments[segments.length - 1]] = value;
      return newData;
    });
  };

  const registerStepNav = useCallback((api) => { stepNavApi = api; }, []);

  return React.createElement(Step3WeightBalance, {
    data: aircraftData,
    updateData,
    errors: {},
    registerStepNav,
  });
}

// ─── Helpers DOM ─────────────────────────────────────────────────────────────
const click = (el) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};
const findByText = (root, text, sel = 'button, span, div, p') =>
  [...root.querySelectorAll(sel)].find(e => (e.textContent || '').trim().startsWith(text));

describe('repro : bras validé au CentrogramReader → champ manuel', () => {
  let container, root;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    chartProps = null;
    stepNavApi = null;
  });

  it('écrit arms.frontSeats et baggageCompartments[0].arm, visibles en manuel', async () => {
    const initial = {
      registration: 'F-TEST', model: 'DR400', fuelType: 'AVGAS',
      weights: { emptyWeight: 600, mtow: 1000 },
      arms: { empty: '', frontSeats: '', rearSeats: '' },
      moments: {},
      additionalFuelTanks: [
        { id: 'tk1', name: 'Réservoir principal', type: 'main', arm: '', capacity: 110, optional: false },
      ],
      baggageCompartments: [
        { id: 'bg1', name: 'Compartiment 1', arm: '', maxWeight: 40 },
      ],
      additionalSeats: [],
      cgEnvelope: {},
    };

    root = createRoot(container);
    await act(async () => { root.render(React.createElement(Harness, { initial })); });

    // 1. Choisir le mode graphique
    const startBtn = findByText(container, 'Démarrer la lecture', 'button');
    expect(startBtn, 'bouton Démarrer la lecture').toBeTruthy();
    await act(async () => { click(startBtn); });

    // 2. Étape 0 : upload d'une image
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput, 'input file').toBeTruthy();
    const file = new File(['x'], 'centrogram.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 3. Naviguer les sous-étapes via le contrat de nav (comme le footer wizard)
    expect(stepNavApi, 'stepNav enregistré').toBeTruthy();
    expect(stepNavApi.canGoNext()).toBe(true);
    await act(async () => { stepNavApi.goNext(); }); // → étape 1 Calibrer X

    // 4. Calibration X : bouton puis clics guidés (axes par défaut 0..200 pas 50 → 5 ticks)
    let calBtn = findByText(container, "Démarrer la calibration de l'axe X", 'button');
    expect(calBtn, 'bouton calibration X').toBeTruthy();
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 5; i++) {
      await act(async () => { chartProps.onCalibrationClick({ x: 40 + i * 100, y: 0 }); });
    }
    await act(async () => { stepNavApi.goNext(); }); // → étape 2 Calibrer Y

    calBtn = findByText(container, "Démarrer la calibration de l'axe Y", 'button');
    expect(calBtn, 'bouton calibration Y').toBeTruthy();
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 6; i++) {
      await act(async () => { chartProps.onCalibrationClick({ x: 0, y: 500 - i * 80 }); });
    }
    await act(async () => { stepNavApi.goNext(); }); // → étape 3 Lecture du bras

    // 5. Sélectionner le stage 'Sièges avant' (chip MUI)
    const chip = findByText(container, 'Sièges avant', '.MuiChip-root, .MuiChip-label, span');
    expect(chip, 'chip Sièges avant').toBeTruthy();
    await act(async () => { click(chip); });

    // 6. Cliquer 3 points en coordonnées DATA : droite moment = 0.94 * masse (bras 0.94 m)
    expect(chartProps.onPointClick, 'onPointClick actif').toBeTruthy();
    await act(async () => { chartProps.onPointClick(0, 0); });
    await act(async () => { chartProps.onPointClick(100, 94); });
    await act(async () => { chartProps.onPointClick(200, 188); });

    // 7. Valider ce bras
    const validateBtn = findByText(container, 'Valider ce bras', 'button');
    expect(validateBtn, 'bouton Valider').toBeTruthy();
    expect(validateBtn.disabled).toBe(false);
    await act(async () => { click(validateBtn); });

    // ── ASSERT ÉCRITURE : arms.frontSeats en mètres canoniques
    console.log('arms after validate:', JSON.stringify(lastData.arms));
    expect(lastData.arms.frontSeats).toBeCloseTo(0.94, 3);

    // 8. Mesurer AUSSI le compartiment bagages (chemin indexé)
    const bagChip = findByText(container, '🧳 Bagages', '.MuiChip-root, .MuiChip-label, span');
    expect(bagChip, 'chip bagages').toBeTruthy();
    await act(async () => { click(bagChip); });
    await act(async () => { chartProps.onPointClick(0, 0); });
    await act(async () => { chartProps.onPointClick(100, 210); });
    const validateBtn2 = findByText(container, 'Valider ce bras', 'button');
    await act(async () => { click(validateBtn2); });
    console.log('baggage after validate:', JSON.stringify(lastData.baggageCompartments));
    expect(parseFloat(lastData.baggageCompartments[0].arm)).toBeCloseTo(2.1, 3);

    // 9. Et le réservoir principal (chemin indexé additionalFuelTanks[0].arm)
    const tankChip = findByText(container, '⛽', '.MuiChip-root, .MuiChip-label, span');
    expect(tankChip, 'chip réservoir').toBeTruthy();
    await act(async () => { click(tankChip); });
    await act(async () => { chartProps.onPointClick(0, 0); });
    await act(async () => { chartProps.onPointClick(100, 110); });
    const validateBtn3 = findByText(container, 'Valider ce bras', 'button');
    await act(async () => { click(validateBtn3); });
    console.log('tanks after validate:', JSON.stringify(lastData.additionalFuelTanks));
    expect(parseFloat(lastData.additionalFuelTanks[0].arm)).toBeCloseTo(1.1, 3);

    // 10. Basculer en saisie manuelle via le footer (dernière sous-étape)
    expect(stepNavApi.canGoNext()).toBe(true); // isLastStep
    await act(async () => { stepNavApi.goNext(); }); // → setInputMethod('manual')

    // ── ASSERT AFFICHAGE : le champ Bras de levier du réservoir affiche la valeur
    const inputs = [...container.querySelectorAll('input')];
    const armInputs = inputs.filter(i => {
      const label = i.closest('.MuiFormControl-root')?.querySelector('label');
      return label && label.textContent.startsWith('Bras de levier');
    });
    console.log('arm input values:', armInputs.map(i => i.value));
    expect(armInputs.length).toBeGreaterThan(0);
    // Le réservoir principal : 1.1 m = 1100 mm (unité user par défaut mm)
    expect(armInputs.some(i => Math.abs(parseFloat(i.value) - 1100) < 1)).toBe(true);
  }, 30000);

  it('V1 : élément bagages CRÉÉ DANS le lecteur (flux César) — bras écrit ?', async () => {
    const initial = {
      registration: 'F-TEST', model: 'DR400', fuelType: 'AVGAS',
      weights: { emptyWeight: 600, mtow: 1000 },
      arms: {}, moments: {},
      additionalFuelTanks: [], baggageCompartments: [], additionalSeats: [],
      cgEnvelope: {},
    };
    root = createRoot(container);
    await act(async () => { root.render(React.createElement(Harness, { initial })); });

    await act(async () => { click(findByText(container, 'Démarrer la lecture', 'button')); });
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'c.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { stepNavApi.goNext(); });
    let calBtn = findByText(container, "Démarrer la calibration de l'axe X", 'button');
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 5; i++) await act(async () => { chartProps.onCalibrationClick({ x: 40 + i * 100, y: 0 }); });
    await act(async () => { stepNavApi.goNext(); });
    calBtn = findByText(container, "Démarrer la calibration de l'axe Y", 'button');
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 6; i++) await act(async () => { chartProps.onCalibrationClick({ x: 0, y: 500 - i * 80 }); });
    await act(async () => { stepNavApi.goNext(); });

    // Créer un compartiment bagages SUR PLACE avec masse max (type par défaut 'baggage')
    const maxWInput = [...container.querySelectorAll('input')].find(i => {
      const label = i.closest('.MuiFormControl-root')?.querySelector('label');
      return label && label.textContent.startsWith('Masse max (kg)');
    });
    expect(maxWInput, 'champ Masse max (kg)').toBeTruthy();
    // Saisie React contrôlée : setter natif + event input
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(maxWInput, '40');
      maxWInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const addBtn = findByText(container, '+ Ajouter', 'button');
    expect(addBtn, 'bouton + Ajouter').toBeTruthy();
    await act(async () => { click(addBtn); });
    console.log('V1 compartiments après création:', JSON.stringify(lastData.baggageCompartments));
    expect(lastData.baggageCompartments.length).toBe(1);

    // L'élément créé est auto-sélectionné (selectStage) → cliquer des points
    expect(chartProps.onPointClick, 'onPointClick actif').toBeTruthy();
    await act(async () => { chartProps.onPointClick(0, 0); });
    await act(async () => { chartProps.onPointClick(100, 210); });
    const vBtn = findByText(container, 'Valider ce bras', 'button');
    expect(vBtn, 'bouton Valider').toBeTruthy();
    await act(async () => { click(vBtn); });
    console.log('V1 compartiments après validation:', JSON.stringify(lastData.baggageCompartments));
    expect(parseFloat(lastData.baggageCompartments[0].arm)).toBeCloseTo(2.1, 3);
  }, 30000);

  it("V2 : massAxis='y' (axes inversés) — bras écrit ?", async () => {
    const initial = {
      registration: 'F-TEST', model: 'DR400', fuelType: 'AVGAS',
      weights: { emptyWeight: 600, mtow: 1000 },
      arms: { frontSeats: '' }, moments: {},
      additionalFuelTanks: [], baggageCompartments: [], additionalSeats: [],
      cgEnvelope: {},
    };
    root = createRoot(container);
    await act(async () => { root.render(React.createElement(Harness, { initial })); });

    await act(async () => { click(findByText(container, 'Démarrer la lecture', 'button')); });

    // Inverser masse/moment AVANT calibration (switch étape 0)
    const swapSwitch = [...container.querySelectorAll('input[type="checkbox"]')].find(i =>
      i.closest('label')?.textContent?.includes("Inverser l'abscisse et l'ordonnée"));
    expect(swapSwitch, 'switch inversion').toBeTruthy();
    await act(async () => { click(swapSwitch); });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['x'], 'c.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { stepNavApi.goNext(); });
    // Après swap : X = moment (0..500 pas 100 → 6 ticks), Y = masse (0..200 pas 50 → 5 ticks)
    let calBtn = findByText(container, "Démarrer la calibration de l'axe X", 'button');
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 6; i++) await act(async () => { chartProps.onCalibrationClick({ x: 40 + i * 80, y: 0 }); });
    await act(async () => { stepNavApi.goNext(); });
    calBtn = findByText(container, "Démarrer la calibration de l'axe Y", 'button');
    await act(async () => { click(calBtn); });
    for (let i = 0; i < 5; i++) await act(async () => { chartProps.onCalibrationClick({ x: 0, y: 500 - i * 100 }); });
    await act(async () => { stepNavApi.goNext(); });

    const chip = findByText(container, 'Sièges avant', '.MuiChip-root, .MuiChip-label, span');
    await act(async () => { click(chip); });
    // massAxis='y' : x = moment, y = masse. Droite : masse = moment / 0.94
    await act(async () => { chartProps.onPointClick(0, 0); });
    await act(async () => { chartProps.onPointClick(94, 100); });
    await act(async () => { chartProps.onPointClick(188, 200); });
    const vBtn = findByText(container, 'Valider ce bras', 'button');
    expect(vBtn, 'bouton Valider').toBeTruthy();
    expect(vBtn.disabled).toBe(false);
    await act(async () => { click(vBtn); });
    console.log('V2 arms:', JSON.stringify(lastData.arms));
    expect(parseFloat(lastData.arms.frontSeats)).toBeCloseTo(0.94, 3);
  }, 30000);
});
