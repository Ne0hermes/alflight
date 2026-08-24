// @vitest-environment jsdom
//
// REPRO du bug pilote 24/08/2026 avec le VRAI wizard (pas un updateData simulé).
// On monte AircraftCreationWizard, on va à l'étape « Vitesses » (case 3), on
// tape dans une cellule de la matrice et on regarde si la cellule affiche.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks des dépendances lourdes (réseau / auth) ─────────────────────────
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) },
  },
}));

vi.mock('../../../../core/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'cesar.neocast@gmail.com' }, session: null, loading: false }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../../../../core/auth/roles', () => ({
  isAdminUser: () => true,
}));

vi.mock('../../../../core/contexts', () => ({
  useAircraft: () => ({
    addAircraft: vi.fn(),
    updateAircraft: vi.fn(),
    setSelectedAircraft: vi.fn(),
    aircraftList: [],
  }),
}));

let container;
let root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

const taper = (input, texte) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const cellule = (label) => container.querySelector(`input[aria-label="${label}"]`);

const flush = async () => {
  for (let i = 0; i < 12; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
};

describe('REPRO — wizard complet, matrice de décrochage', () => {
  it('BROUILLON localStorage : ouvre direct à l\'étape Vitesses et tape', async () => {
    await import('../wizard-steps/Step2Speeds'); // pré-charge le chunk lazy
    const { default: AircraftCreationWizard } = await import('../AircraftCreationWizard');

    localStorage.setItem('aircraft_wizard_draft', JSON.stringify({
      aircraftData: {
        registration: 'F-TEST',
        model: 'PA-28',
        manufacturer: 'Piper',
        fuelCapacity: 180,
        speeds: { vso: 45, vsTO: 48, vs1: 50, vno: 125, vne: 160, vfeLdg: 85 },
      },
      currentStep: 3,
      timestamp: new Date().toISOString(),
      isEdit: false,
    }));

    await act(async () => {
      root.render(
        <React.Suspense fallback={<div>loading</div>}>
          <AircraftCreationWizard onClose={() => {}} />
        </React.Suspense>
      );
    });
    await flush();
    await flush();

    console.log('ETAPE (draft) >>>', (container.textContent || '').slice(0, 300));

    const input = cellule("Décrochage lisse à 40° d'inclinaison");
    console.log('CELLULE (draft) TROUVEE ?', !!input);
    console.log('ARIA >>>', [...container.querySelectorAll('input')].map(i=>i.getAttribute('aria-label')||i.name||i.type).join(' ~ '));
    console.log('FULLTEXT >>>', (container.textContent||'').slice(0,1500));
    expect(input).toBeTruthy();

    taper(input, '57');
    await flush();

    const apres = cellule("Décrochage lisse à 40° d'inclinaison");
    console.log('VALEUR APRES FRAPPE (draft) >>>', JSON.stringify(apres.value));
    console.log('TEXTE AVERT >>>', (container.textContent || '').match(/inclinaison[^.]*\./gi)?.join(' | ')?.slice(0, 600));
    expect(apres.value).toBe('57');
  });

  it('monte le wizard sur un avion existant et tape dans une cellule inclinée', async () => {
    const { default: AircraftCreationWizard } = await import('../AircraftCreationWizard');

    const existing = {
      id: 'a1',
      registration: 'F-TEST',
      model: 'PA-28',
      manufacturer: 'Piper',
      speeds: { vso: 45, vsTO: 48, vs1: 50, vno: 125, vne: 160, vfeLdg: 85 },
    };

    await act(async () => {
      root.render(
        <React.Suspense fallback={<div>loading</div>}>
          <AircraftCreationWizard existingAircraft={existing} onClose={() => {}} />
        </React.Suspense>
      );
    });
    await flush();
    await flush();

    // Où sommes-nous ? On imprime les steps visibles pour naviguer.
    const texte = container.textContent || '';
    console.log('ETAPE INITIALE >>>', texte.slice(0, 400));

    // Naviguer jusqu'à l'étape Vitesses : cliquer « Suivant » jusqu'à trouver la matrice.
    for (let i = 0; i < 8 && !cellule("Décrochage lisse à 40° d'inclinaison"); i++) {
      const boutons = [...container.querySelectorAll('button')];
      const suivant = boutons.find((b) => /suivant/i.test(b.textContent));
      if (!suivant) { console.log('pas de bouton Suivant à l\'itération', i); break; }
      await act(async () => { suivant.click(); });
      await flush();
      await flush();
      console.log(`--- après clic ${i} >>>`, (container.textContent || '').slice(0, 300));
    }

    const input = cellule("Décrochage lisse à 40° d'inclinaison");
    console.log('CELLULE TROUVEE ?', !!input);
    expect(input, 'la matrice doit être atteignable').toBeTruthy();

    taper(input, '57');
    await flush();

    const apres = cellule("Décrochage lisse à 40° d'inclinaison");
    console.log('VALEUR APRES FRAPPE >>>', JSON.stringify(apres.value));
    console.log('AVERTISSEMENTS >>>', (container.textContent.match(/décrochage[^.]*\./gi) || []).join(' | ').slice(0, 800));

    expect(apres.value).toBe('57');
  });
});
