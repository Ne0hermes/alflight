// src/shared/components/ValueDisplay.jsx
import React from 'react';
import { useUnits } from '@hooks/useUnits';
import { sx } from '@shared/styles/styleSystem';

/**
 * Composant pour afficher une valeur avec conversion automatique d'unités
 * @param {number} value - La valeur à afficher (en unité de stockage standard)
 * @param {string} category - La catégorie d'unité (distance, altitude, speed, etc.)
 * @param {string} label - Le label à afficher
 * @param {number} decimals - Nombre de décimales (défaut: 1)
 * @param {string} fromUnit - Unité source si différente du standard (optionnel)
 * @param {Object} style - Styles personnalisés
 * @param {boolean} showUnit - Afficher l'unité (défaut: true)
 * @param {boolean} editable - Permettre l'édition (défaut: false)
 * @param {Function} onChange - Callback lors de la modification (reçoit la valeur en unité de stockage)
 */
export const ValueDisplay = ({ 
  value, 
  category, 
  label, 
  decimals = 1, 
  fromUnit = null,
  style = {}, 
  showUnit = true,
  editable = false,
  onChange = null,
  size = 'md',
  emphasis = false
}) => {
  const { convert, getSymbol, toStorage, getUnit } = useUnits();
  
  // Convertir la valeur pour l'affichage
  const displayValue = convert(value, category, fromUnit);
  const unit = getSymbol(category);
  
  // Gérer l'édition
  const handleChange = (e) => {
    if (!onChange) return;
    
    const inputValue = parseFloat(e.target.value);
    if (isNaN(inputValue)) {
      onChange(null);
      return;
    }
    
    // Convertir vers l'unité de stockage avant d'appeler onChange
    const storageValue = toStorage(inputValue, category);
    onChange(storageValue);
  };
  
  // Styles selon la taille
  const sizeStyles = {
    xs: { fontSize: '11px', padding: '2px 4px' },
    sm: { fontSize: '13px', padding: '4px 6px' },
    md: { fontSize: '14px', padding: '6px 8px' },
    lg: { fontSize: '16px', padding: '8px 12px' },
    xl: { fontSize: '20px', padding: '10px 14px' }
  };
  
  const containerStyle = {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '4px',
    ...style
  };
  
  const valueContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: emphasis ? '#eff6ff' : '#f9fafb',
    borderRadius: '6px',
    border: emphasis ? '1px solid #3b82f6' : '1px solid #e5e7eb',
    ...sizeStyles[size]
  };
  
  const labelStyle = {
    fontSize: size === 'xs' ? '10px' : '12px',
    color: '#6b7280',
    fontWeight: '500'
  };
  
  const valueStyle = {
    fontWeight: emphasis ? 'bold' : '600',
    color: emphasis ? '#1e40af' : '#1f2937',
    minWidth: '40px',
    textAlign: 'right'
  };
  
  const unitStyle = {
    color: '#6b7280',
    fontSize: size === 'xs' ? '10px' : size === 'sm' ? '11px' : '12px'
  };
  
  if (editable) {
    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={valueContainerStyle}>
          <input
            type="number"
            value={displayValue !== null && !isNaN(displayValue) ? displayValue.toFixed(decimals) : ''}
            onChange={handleChange}
            style={{
              ...valueStyle,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '60px'
            }}
            step={decimals > 0 ? Math.pow(10, -decimals) : 1}
          />
          {showUnit && <span style={unitStyle}>{unit}</span>}
        </div>
      </div>
    );
  }
  
  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={valueContainerStyle}>
        <span style={valueStyle}>
          {displayValue !== null && !isNaN(displayValue) ? displayValue.toFixed(decimals) : '-'}
        </span>
        {showUnit && <span style={unitStyle}>{unit}</span>}
      </div>
    </div>
  );
};

/**
 * Composant pour afficher plusieurs valeurs en ligne
 */
export const ValueGroup = ({ values, style = {} }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      ...style
    }}>
      {values.map((valueProps, index) => (
        <ValueDisplay key={index} {...valueProps} />
      ))}
    </div>
  );
};

export default ValueDisplay;