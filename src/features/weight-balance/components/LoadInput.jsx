// src/features/weight-balance/components/LoadInput.jsx
import React, { memo, useState, useEffect } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';

export const LoadInput = memo(({ label, value, onChange, max, highlight = false }) => {
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change
  
  // Mémoriser l'unité actuelle pour éviter les dépendances instables
  const currentUnit = getUnit('weight');
  
  // Convertir la valeur de stockage (kg) vers l'unité préférée pour l'affichage
  const displayValue = currentUnit !== 'kg' 
    ? convert(value || 0, 'weight', 'kg', { toUnit: currentUnit })
    : value || 0;
  
  // État local pour gérer la valeur pendant la saisie
  const [localValue, setLocalValue] = useState(displayValue?.toString() || '0');
  
  // Synchroniser avec la prop value quand elle change de l'extérieur ou les unités changent
  useEffect(() => {
    // Uniquement recalculer si nécessaire
    const newDisplayValue = currentUnit !== 'kg' 
      ? convert(value || 0, 'weight', 'kg', { toUnit: currentUnit })
      : value || 0;
    
    // Éviter de mettre à jour si la valeur n'a pas vraiment changé
    const newLocalValue = newDisplayValue?.toString() || '0';
    if (newLocalValue !== localValue) {
      console.log(`LoadInput ${label} - value/units changed, display:`, newDisplayValue);
      setLocalValue(newLocalValue);
    }
  }, [value, currentUnit, convert]); // Ne pas inclure localValue et label dans les dépendances

  const inputStyle = sx.combine(
    sx.components.input.base,
    highlight && {
      borderColor: sx.theme.colors.primary[500],
      backgroundColor: sx.theme.colors.primary[50]
    }
  );

  const handleChange = (e) => {
    const val = e.target.value;
    console.log(`LoadInput ${label} - input changed to:`, val);
    setLocalValue(val);
    
    // Convertir vers l'unité de stockage (kg) avant de propager
    const num = val === '' ? 0 : parseFloat(val);
    if (!isNaN(num)) {
      const storageValue = currentUnit !== 'kg'
        ? toStorage(num, 'weight')
        : num;
      console.log(`LoadInput ${label} - calling onChange with (in kg):`, storageValue);
      onChange(storageValue);
    }
  };

  const handleBlur = () => {
    // S'assurer que la valeur finale est bien propagée
    const finalValue = localValue === '' ? 0 : parseFloat(localValue);
    if (!isNaN(finalValue)) {
      const storageValue = currentUnit !== 'kg'
        ? toStorage(finalValue, 'weight')
        : finalValue;
      if (storageValue !== value) {
        console.log(`LoadInput ${label} - onBlur calling onChange with (in kg):`, storageValue);
        onChange(storageValue);
      }
    }
  };

  return (
    <div>
      <label style={sx.combine(sx.components.label.base, sx.spacing.mb(1))}>
        {label} {currentUnit !== 'kg' && `(${getSymbol('weight')})`}
      </label>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        max={max}
        style={inputStyle}
        step="1"
        min="0"
      />
    </div>
  );
});

LoadInput.displayName = 'LoadInput';