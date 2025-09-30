import React, { memo } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { DataSourceBadge, useDataSource } from './DataSourceBadge';

/**
 * Composant pour afficher un champ de données avec indicateur de source
 */
export const DataField = memo(({ 
  label,
  value,
  unit = '',
  dataSource = 'static',
  dataObject = null, // Objet de données pour déterminer automatiquement la source
  onCopy,
  copyValue = null,
  size = 'base',
  showSource = true,
  inline = false,
  emphasis = false
}) => {
  const [copied, setCopied] = React.useState(false);
  
  // Déterminer automatiquement la source si un objet de données est fourni
  const source = dataObject ? useDataSource(dataObject) : dataSource;
  
  const handleCopy = async () => {
    if (!onCopy && !copyValue) return;
    
    try {
      const textToCopy = copyValue || value;
      await navigator.clipboard.writeText(String(textToCopy));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  const sizes = {
    xs: { fontSize: '11px', padding: '4px 8px' },
    sm: { fontSize: '12px', padding: '6px 10px' },
    base: { fontSize: '14px', padding: '8px 12px' },
    lg: { fontSize: '16px', padding: '10px 16px' }
  };

  const sizeConfig = sizes[size] || sizes.base;

  // Style différent selon la source
  const getFieldStyle = () => {
    const base = {
      ...sizeConfig,
      borderRadius: '6px',
      display: inline ? 'inline-flex' : 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      transition: 'all 0.2s'
    };

    // Mise en valeur uniquement pour les données officielles ou modifiées
    if (source === 'vac' || source === 'api') {
      return {
        ...base,
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac'
      };
    } else if (source === 'modified') {
      return {
        ...base,
        backgroundColor: '#fef2f2',
        border: '1px solid #fca5a5'
      };
    } else if (source === 'verified') {
      return {
        ...base,
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac'
      };
    }
    
    // Style neutre pour les données statiques
    return {
      ...base,
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb'
    };
  };

  const fieldStyle = getFieldStyle();

  return (
    <div style={fieldStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        {label && (
          <span style={{ 
            color: '#6b7280', 
            fontSize: sizeConfig.fontSize,
            minWidth: 'fit-content'
          }}>
            {label}:
          </span>
        )}
        <span style={{ 
          fontWeight: emphasis ? '600' : '500',
          color: '#111827',
          fontSize: sizeConfig.fontSize
        }}>
          {value}{unit && ` ${unit}`}
        </span>
        {showSource && source !== 'static' && (
          <DataSourceBadge 
            source={source} 
            size="xs" 
            showLabel={false}
            inline={true}
          />
        )}
      </div>
      
      {(onCopy || copyValue) && (
        <button
          onClick={handleCopy}
          style={{
            padding: '4px',
            backgroundColor: copied ? '#10b981' : 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Copier"
        >
          {copied ? (
            <CheckCircle size={14} color="white" />
          ) : (
            <Copy size={14} color="#6b7280" />
          )}
        </button>
      )}
    </div>
  );
});

DataField.displayName = 'DataField';

/**
 * Groupe de champs de données avec titre et source commune
 */
export const DataFieldGroup = memo(({ 
  title, 
  dataSource,
  children,
  showGroupSource = true 
}) => {
  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
          {title}
        </h4>
        {showGroupSource && dataSource !== 'static' && (
          <DataSourceBadge source={dataSource} size="sm" />
        )}
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {children}
      </div>
    </div>
  );
});

DataFieldGroup.displayName = 'DataFieldGroup';

export default DataField;