// src/features/weight-balance/components/LoadInput.jsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { parseDecimalInput, DECIMAL_INPUT_RE, numbersClose } from '@utils/numericInput';

export const LoadInput = memo(({ label, value, onChange, max, highlight = false }) => {
  const { convert, getSymbol, toStorage, getUnit } = useUnits();
  useUnitsWatcher(); // Force re-render on units change
  const currentUnit = getUnit('weight');

  // Valeur de STOCKAGE (kg) → nombre dans l'unité d'AFFICHAGE (préférence pilote).
  const toDisplayNum = (storageVal) => {
    const v = Number(storageVal) || 0;
    return currentUnit !== 'kg' ? convert(v, 'weight', 'kg', { toUnit: currentUnit }) : v;
  };
  // Texte affiché : VIDE quand 0 (placeholder « 0 »), sinon le nombre arrondi.
  const fmt = (storageVal) => {
    const d = toDisplayNum(storageVal);
    if (!Number.isFinite(d) || d === 0) return '';
    return String(Math.round(d * 1000) / 1000);
  };

  // État local = source de vérité PENDANT la saisie (tolère '', '4,', '4.').
  const [localValue, setLocalValue] = useState(() => fmt(value));
  const focusedRef = useRef(false);

  // Synchroniser depuis la prop UNIQUEMENT hors focus ET si l'écart est RÉEL
  // (numérique). On ne réécrit jamais la saisie en cours / un état transitoire —
  // c'était la cause du « ça repasse à 0 / on ne peut pas éditer ».
  useEffect(() => {
    if (focusedRef.current) return;
    const propNum = toDisplayNum(value);
    const localNum = parseDecimalInput(localValue) ?? 0;
    if (!numbersClose(propNum, localNum)) {
      setLocalValue(fmt(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currentUnit]);

  const currentValue = parseDecimalInput(localValue) ?? 0;
  const exceedsMax = max && currentValue > max;

  const inputStyle = sx.combine(
    sx.components.input.base,
    exceedsMax && {
      border: `2px solid ${sx.theme.colors.danger[500]}`,
      backgroundColor: sx.theme.colors.danger[50]
    },
    highlight && !exceedsMax && {
      border: `1px solid ${sx.theme.colors.primary[500]}`,
      backgroundColor: sx.theme.colors.primary[50]
    }
  );

  const handleChange = (e) => {
    const raw = e.target.value;
    // États transitoires tolérés ('', '4', '4,', '4.', '4,5') ; caractère
    // invalide → on IGNORE la frappe SANS rien réinitialiser.
    if (!DECIMAL_INPUT_RE.test(raw)) return;
    setLocalValue(raw);

    if (raw === '') {
      // Champ vidé = 0 dans le modèle, mais l'affichage RESTE vide (éditable).
      onChange(0);
      return;
    }
    const num = parseDecimalInput(raw); // '4,5' → 4.5 ; '4,' → null (transitoire)
    if (num !== null) {
      onChange(currentUnit !== 'kg' ? toStorage(num, 'weight') : num);
    }
    // num === null (ex. '4,' en cours) → on NE propage PAS, on garde la saisie.
  };

  const handleFocus = () => { focusedRef.current = true; };
  const handleBlur = () => {
    focusedRef.current = false;
    // Normalise l'affichage sur la valeur réellement stockée ('4,' → '4', etc.).
    setLocalValue(fmt(value));
  };

  return (
    <div>
      <label style={sx.combine(sx.components.label.base, sx.spacing.mb(1))}>
        {label} {currentUnit !== 'kg' && `(${getSymbol('weight')})`}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="0"
        style={inputStyle}
      />
      {exceedsMax && (
        <div style={{
          marginTop: '4px',
          padding: '6px 8px',
          backgroundColor: sx.theme.colors.danger[50],
          borderLeft: `3px solid ${sx.theme.colors.danger[500]}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--fs-body)',
          color: sx.theme.colors.danger[700],
          fontWeight: '600'
        }}>
          ⚠️ Dépassement : {currentValue} {getSymbol('weight')} &gt; {max} {getSymbol('weight')} (max autorisé)
        </div>
      )}
    </div>
  );
});

LoadInput.displayName = 'LoadInput';
