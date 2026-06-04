import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * DataReadout
 * -----------
 * Affichage d'une valeur technique en monospace (JetBrains Mono).
 * Adapté aux : coords, codes ICAO, immat, valeurs numériques.
 *
 * Exemples :
 *   <DataReadout value={35.4} unit="L/H" precision={1} />
 *     -> "35.4 L/H"
 *   <DataReadout value="F-GBYU" />
 *     -> "F-GBYU"
 *   <DataReadout value={12500} unit="ft" />
 *     -> "12 500 ft"
 *   <DataReadout value={3} unit="° M" precision={3} align="right" />
 *     -> "+ 003° M" (alignement droit, padding 0)
 */

/**
 * Formate un nombre avec :
 *  • séparateur d'espace pour les milliers (style aviation/EASA)
 *  • la précision demandée
 */
const formatNumber = (value, precision) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;

  const fixed = precision != null ? value.toFixed(precision) : `${value}`;
  // Séparateur fin (espace insécable) pour les milliers
  const [intPart, decPart] = fixed.split('.');
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart != null ? `${withSpaces}.${decPart}` : withSpaces;
};

export const DataReadout = ({
  value,
  unit,
  precision,
  align = 'left',
  size = 'md', // 'sm' | 'md' | 'lg'
  emphasis = false, // si true → couleur accent orange
  style,
  className,
  ...rest
}) => {
  const sizeStyle = (() => {
    if (size === 'lg') return tokens.typography.dataLg;
    if (size === 'sm') {
      return {
        ...tokens.typography.data,
        fontSize: 'var(--fs-body)',
      };
    }
    return tokens.typography.data;
  })();

  const formattedValue = formatNumber(value, precision);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: tokens.spacing[1],
        textAlign: align,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        color: emphasis ? 'var(--accent-primary)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        ...sizeStyle,
        ...(style || {}),
      }}
      {...rest}
    >
      <span>{formattedValue}</span>
      {unit && (
        <span
          style={{
            fontSize: '0.65em',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginLeft: '2px',
          }}
        >
          {unit}
        </span>
      )}
    </span>
  );
};

export default DataReadout;
