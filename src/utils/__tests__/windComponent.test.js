// Phase 5 (A5) — le vent indéterminé n'est jamais supposé favorable.
import { describe, it, expect } from 'vitest';
import { resolveWindComponent } from '@utils/windComponent';

describe('resolveWindComponent — vent jamais supposé favorable (A5)', () => {
  it('composante signée connue → utilisée telle quelle (vent arrière conservé)', () => {
    expect(resolveWindComponent(12)).toEqual({ component: 12, unknown: false });
    expect(resolveWindComponent(-8)).toEqual({ component: -8, unknown: false });
    expect(resolveWindComponent(0)).toEqual({ component: 0, unknown: false });
  });
  it('direction indéterminée → 0 conservateur (jamais un vent de face inventé)', () => {
    expect(resolveWindComponent(undefined)).toEqual({ component: 0, unknown: true });
    expect(resolveWindComponent(null)).toEqual({ component: 0, unknown: true });
    expect(resolveWindComponent(NaN)).toEqual({ component: 0, unknown: true });
    expect(resolveWindComponent('Variable')).toEqual({ component: 0, unknown: true });
  });
});
