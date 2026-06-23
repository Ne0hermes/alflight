// Saisie numérique tolérante — corrige « virgule / suppression remet à 0 ».
import { describe, it, expect } from 'vitest';
import { parseDecimalInput, DECIMAL_INPUT_RE, numbersClose } from '../numericInput';

describe('parseDecimalInput', () => {
  it('accepte la VIRGULE (séparateur FR) comme le point', () => {
    expect(parseDecimalInput('4,5')).toBe(4.5);
    expect(parseDecimalInput('4.5')).toBe(4.5);
    expect(parseDecimalInput('0,25')).toBe(0.25);
  });
  it('valeurs entières et nombres natifs', () => {
    expect(parseDecimalInput('97')).toBe(97);
    expect(parseDecimalInput(4.5)).toBe(4.5);
    expect(parseDecimalInput('  12 ')).toBe(12);
  });
  it('séparateur FINAL → partie entière (l\'affichage garde la virgule pour la décimale)', () => {
    // '4,' devient Number('4.') = 4 ; le composant conserve « 4, » à l'écran
    // pour pouvoir taper la décimale → pas de reset.
    expect(parseDecimalInput('4,')).toBe(4);
    expect(parseDecimalInput('4.')).toBe(4);
  });
  it('vides / incomplets → null (JAMAIS 0 : pas de reset parasite)', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('.')).toBeNull();
    expect(parseDecimalInput('-')).toBeNull();
    expect(parseDecimalInput(null)).toBeNull();
    expect(parseDecimalInput(undefined)).toBeNull();
  });
  it('invalide → null', () => {
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('4a')).toBeNull();
    expect(parseDecimalInput(NaN)).toBeNull();
  });
});

describe('DECIMAL_INPUT_RE — frappes tolérées pendant la saisie', () => {
  it('tolère les états transitoires (≥ 0)', () => {
    ['', '4', '40', '4,', '4.', '4,5', '40.5', '.5', ',5'].forEach(s =>
      expect(DECIMAL_INPUT_RE.test(s)).toBe(true));
  });
  it('refuse l\'invalide (frappe ignorée, sans reset)', () => {
    ['abc', '4a', '4,5,6', '4..5', '-4', '4 5'].forEach(s =>
      expect(DECIMAL_INPUT_RE.test(s)).toBe(false));
  });
});

describe('numbersClose', () => {
  it('égalité numérique à epsilon', () => {
    expect(numbersClose(4.5, 4.5)).toBe(true);
    expect(numbersClose(0, 0)).toBe(true);
    expect(numbersClose(4.5, 4.6)).toBe(false);
    expect(numbersClose(1, 1 + 1e-12)).toBe(true);
  });
});
