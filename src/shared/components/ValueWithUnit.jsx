// src/shared/components/ValueWithUnit.jsx
import React from 'react';
import { useUnits } from '@hooks/useUnits';
import { sx } from '@shared/styles/styleSystem';

/**
 * Composant pour afficher une valeur avec son unité principale et alternative
 * Affiche automatiquement l'unité complémentaire (métrique/impérial) en dessous
 */
export const ValueWithUnit = ({ 
  value, 
  category, 
  label = null,
  decimals = 1,
  alternativeDecimals = 1,
  fromUnit = null,
  showAlternative = true,
  size = 'md',
  emphasis = false,
  style = {},
  compact = false
}) => {
  const { format, convert, getUnit } = useUnits();
  
  // Définir les unités alternatives pour chaque catégorie
  const getAlternativeUnit = (category, currentUnit) => {
    const alternatives = {
      distance: {
        'nm': 'km',   // Nautique → Métrique
        'km': 'nm',   // Métrique → Nautique
        'mi': 'km',   // Impérial → Métrique
      },
      altitude: {
        'ft': 'm',    // Impérial → Métrique
        'm': 'ft',    // Métrique → Impérial
        'FL': 'm',    // FL → Métrique
      },
      speed: {
        'kt': 'km/h', // Nautique → Métrique
        'km/h': 'kt', // Métrique → Nautique
        'mph': 'km/h', // Impérial → Métrique
        'm/s': 'kt',  // SI → Nautique
      },
      windSpeed: {
        'kt': 'km/h',
        'km/h': 'kt',
        'mph': 'km/h',
        'm/s': 'kt',
      },
      fuel: {
        'ltr': 'gal', // Métrique → Impérial
        'gal': 'ltr', // Impérial → Métrique
        'kg': 'ltr',  // Masse → Volume
        'lbs': 'ltr', // Masse imp → Volume
      },
      weight: {
        'kg': 'lbs',  // Métrique → Impérial
        'lbs': 'kg',  // Impérial → Métrique
      },
      pressure: {
        'hPa': 'inHg', // Métrique → Impérial
        'inHg': 'hPa', // Impérial → Métrique
        'mb': 'inHg',  // Millibar → Impérial
      },
      temperature: {
        'C': 'F',     // Celsius → Fahrenheit
        'F': 'C',     // Fahrenheit → Celsius
      },
      runway: {
        'm': 'ft',    // Métrique → Impérial
        'ft': 'm',    // Impérial → Métrique
      },
      visibility: {
        'km': 'sm',   // Métrique → Statute Miles
        'sm': 'km',   // Statute Miles → Métrique
        'm': 'ft',    // Mètres → Pieds
      },
      fuelConsumption: {
        'lph': 'gph', // Litres/h → Gallons/h
        'gph': 'lph', // Gallons/h → Litres/h
      }
    };
    
    return alternatives[category]?.[currentUnit] || null;
  };
  
  // Obtenir l'unité actuelle et l'alternative
  const currentUnit = getUnit(category);
  const alternativeUnit = getAlternativeUnit(category, currentUnit);
  
  // Convertir les valeurs
  const mainValue = convert(value, category, fromUnit);
  const alternativeValue = alternativeUnit 
    ? convert(value, category, fromUnit, { toUnit: alternativeUnit })
    : null;
  
  // Fonction pour formater avec le bon symbole
  const formatValue = (val, unit, dec) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    
    const symbols = {
      // Distance
      'nm': 'NM',
      'km': 'km',
      'mi': 'mi',
      'm': 'm',
      // Altitude
      'ft': 'ft',
      'FL': 'FL',
      // Vitesse
      'kt': 'kt',
      'km/h': 'km/h',
      'mph': 'mph',
      'm/s': 'm/s',
      // Carburant
      'ltr': 'L',
      'gal': 'gal',
      'kg': 'kg',
      'lbs': 'lbs',
      // Pression
      'hPa': 'hPa',
      'inHg': 'inHg',
      'mb': 'mb',
      // Température
      'C': '°C',
      'F': '°F',
      // Consommation
      'lph': 'L/h',
      'gph': 'gal/h',
      // Visibilité
      'sm': 'SM'
    };
    
    const symbol = symbols[unit] || unit;
    return `${val.toFixed(dec)} ${symbol}`;
  };
  
  // Styles selon la taille
  const sizeStyles = {
    xs: { 
      main: { fontSize: '12px', lineHeight: '16px' },
      alt: { fontSize: '10px', lineHeight: '14px' },
      label: { fontSize: '10px' }
    },
    sm: { 
      main: { fontSize: '14px', lineHeight: '20px' },
      alt: { fontSize: '11px', lineHeight: '16px' },
      label: { fontSize: '11px' }
    },
    md: { 
      main: { fontSize: '16px', lineHeight: '24px' },
      alt: { fontSize: '12px', lineHeight: '18px' },
      label: { fontSize: '12px' }
    },
    lg: { 
      main: { fontSize: '20px', lineHeight: '28px' },
      alt: { fontSize: '14px', lineHeight: '20px' },
      label: { fontSize: '13px' }
    },
    xl: { 
      main: { fontSize: '24px', lineHeight: '32px' },
      alt: { fontSize: '16px', lineHeight: '24px' },
      label: { fontSize: '14px' }
    },
    '2xl': { 
      main: { fontSize: '30px', lineHeight: '36px' },
      alt: { fontSize: '18px', lineHeight: '28px' },
      label: { fontSize: '15px' }
    }
  };
  
  const currentSize = sizeStyles[size] || sizeStyles.md;
  
  const containerStyle = {
    display: compact ? 'inline-block' : 'block',
    ...style
  };
  
  const labelStyle = {
    ...currentSize.label,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: '2px'
  };
  
  const mainStyle = {
    ...currentSize.main,
    fontWeight: emphasis ? 'bold' : '600',
    color: emphasis ? '#1e40af' : '#1f2937'
  };
  
  const altStyle = {
    ...currentSize.alt,
    color: '#9ca3af',
    marginTop: '2px'
  };
  
  // Conversion spéciale pour l'alternative
  const getAlternativeValue = () => {
    if (!alternativeUnit || !showAlternative) return null;
    
    // Pour les conversions qui nécessitent une logique spéciale
    if (category === 'fuel' || category === 'weight') {
      // Utiliser la fonction de conversion standard
      const storageUnits = {
        fuel: 'ltr',
        weight: 'kg'
      };
      
      // Convertir d'abord vers l'unité de stockage si nécessaire
      let storageValue = value;
      if (fromUnit && fromUnit !== storageUnits[category]) {
        storageValue = convert(value, category, fromUnit, { toUnit: storageUnits[category] });
      }
      
      // Puis convertir vers l'unité alternative
      return convert(storageValue, category, storageUnits[category], { toUnit: alternativeUnit });
    }
    
    // Pour les autres catégories, conversion directe
    return convert(value, category, fromUnit, { toUnit: alternativeUnit });
  };
  
  const altValue = getAlternativeValue();
  
  return (
    <div style={containerStyle}>
      {label && <div style={labelStyle}>{label}</div>}
      <div style={mainStyle}>
        {formatValue(mainValue, currentUnit, decimals)}
      </div>
      {showAlternative && alternativeUnit && altValue !== null && (
        <div style={altStyle}>
          ≈ {formatValue(altValue, alternativeUnit, alternativeDecimals)}
        </div>
      )}
    </div>
  );
};

/**
 * Composant pour afficher plusieurs valeurs en grille
 */
export const ValueGrid = ({ values, columns = 2, gap = '16px', style = {} }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap,
      ...style
    }}>
      {values.map((valueProps, index) => (
        <div key={index} style={sx.components.card.base}>
          <ValueWithUnit {...valueProps} />
        </div>
      ))}
    </div>
  );
};

export default ValueWithUnit;