// src/features/weight-balance/components/LoadInput.jsx
import React, { memo, useState, useEffect } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const LoadInput = memo(({ label, value, onChange, max, highlight = false }) => {
  // État local pour gérer la valeur pendant la saisie
  const [localValue, setLocalValue] = useState(value?.toString() || '0');
  
  // Synchroniser avec la prop value quand elle change de l'extérieur
  useEffect(() => {
    console.log(`LoadInput ${label} - value prop changed to:`, value);
    setLocalValue(value?.toString() || '0');
  }, [value, label]);

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
    
    // Convertir et propager la valeur numérique immédiatement
    const num = val === '' ? 0 : parseFloat(val);
    if (!isNaN(num)) {
      console.log(`LoadInput ${label} - calling onChange with:`, num);
      onChange(num);
    }
  };

  const handleBlur = () => {
    // S'assurer que la valeur finale est bien propagée
    const finalValue = localValue === '' ? 0 : parseFloat(localValue);
    if (!isNaN(finalValue) && finalValue !== value) {
      console.log(`LoadInput ${label} - onBlur calling onChange with:`, finalValue);
      onChange(finalValue);
    }
  };

  return (
    <div>
      <label style={sx.combine(sx.components.label.base, sx.spacing.mb(1))}>
        {label}
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