// Régression de la PERTE DE DONNÉES du 23/08/2026 : les limitations de vent
// au format actuel (`limits[]`) disparaissaient à l'enregistrement parce que
// les formulaires reconstruisaient windLimits à partir des seuls champs
// historiques. Un formulaire qui n'édite pas un champ ne doit jamais le
// supprimer.
import { describe, it, expect } from 'vitest';
import { initialWindLimits, mergeWindLimitsForSave } from '../windLimits';

const avionAvecListe = {
  windLimits: {
    limits: [{ type: 'maxCrosswind', value: 17, saved: true }],
    maxCrosswind: '', maxTailwind: '', maxCrosswindWet: ''
  }
};

describe('initialWindLimits — état initial du formulaire', () => {
  it('conserve limits[] (le cas qui a fait perdre F-BXNG, F-GNAM, F-HDIM)', () => {
    const w = initialWindLimits(avionAvecListe);
    expect(w.limits).toHaveLength(1);
    expect(w.limits[0].value).toBe(17);
  });

  it('conserve les clés inconnues du formulaire', () => {
    const w = initialWindLimits({ windLimits: { limits: [], nouveauChamp: 'x' } });
    expect(w.nouveauChamp).toBe('x');
  });

  it('reprend les valeurs historiques, avec repli sur le manex', () => {
    const w = initialWindLimits({
      windLimits: { maxCrosswind: 20 },
      manex: { limitations: { maxTailwind: 10 } }
    });
    expect(w.maxCrosswind).toBe(20);
    expect(w.maxTailwind).toBe(10);
    expect(w.limits).toEqual([]);
  });

  it('avion sans limitations : structure vide, jamais null', () => {
    const w = initialWindLimits({});
    expect(w).toEqual({ maxCrosswind: '', maxTailwind: '', maxCrosswindWet: '', limits: [] });
  });
});

describe('mergeWindLimitsForSave — enregistrement', () => {
  const conv = (v, d) => (v === '' || v === null || v === undefined ? d : Number(v));

  it('formulaire legacy vide : la liste survit (LE bug corrigé)', () => {
    const out = mergeWindLimitsForSave(
      avionAvecListe.windLimits,
      { maxCrosswind: '', maxTailwind: '', maxCrosswindWet: '' },
      conv
    );
    expect(out.limits).toHaveLength(1);
    expect(out.limits[0].value).toBe(17);
  });

  it('champs historiques saisis : mis à jour ET liste conservée', () => {
    const out = mergeWindLimitsForSave(
      avionAvecListe.windLimits,
      { maxCrosswind: '25', maxTailwind: '10', maxCrosswindWet: '' },
      conv
    );
    expect(out.maxCrosswind).toBe(25);
    expect(out.maxTailwind).toBe(10);
    expect(out.maxCrosswindWet).toBe(0);
    expect(out.limits).toHaveLength(1);
  });

  it('avion sans aucune limitation : undefined (rien à écrire)', () => {
    expect(mergeWindLimitsForSave(null, { maxCrosswind: '', maxTailwind: '', maxCrosswindWet: '' }, conv))
      .toBeUndefined();
    expect(mergeWindLimitsForSave({ limits: [] }, {}, conv)).toBeUndefined();
  });

  it('avion à valeurs historiques seules (F-GUVV, F-HSTR) : conservées telles quelles', () => {
    const out = mergeWindLimitsForSave(
      { maxCrosswind: 20, maxTailwind: 10, maxCrosswindWet: 12 },
      { maxCrosswind: '', maxTailwind: '', maxCrosswindWet: '' },
      conv
    );
    expect(out).toEqual({ maxCrosswind: 20, maxTailwind: 10, maxCrosswindWet: 12 });
  });

  it('les clés inconnues du formulaire traversent l\'enregistrement', () => {
    const out = mergeWindLimitsForSave(
      { limits: [{ type: 'maxTailwind', value: 5 }], noteInterne: 'POH p.32' },
      { maxCrosswind: '15' },
      conv
    );
    expect(out.noteInterne).toBe('POH p.32');
    expect(out.limits).toHaveLength(1);
  });
});
