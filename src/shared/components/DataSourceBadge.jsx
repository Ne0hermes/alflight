import React, { memo } from 'react';
import { FileText, Globe, Edit3, AlertTriangle, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

/**
 * Badge pour indiquer la source et la fiabilité des données
 * 
 * Types de sources:
 * - 'vac': Données extraites d'une carte VAC officielle
 * - 'api': Données provenant d'une API officielle (METAR/TAF, OpenAIP avec proxy)
 * - 'modified': Données modifiées manuellement par l'utilisateur
 * - 'static': Données statiques prédéfinies (non officielles)
 * - 'verified': Données vérifiées/validées
 */
export const DataSourceBadge = memo(({ 
  source, 
  size = 'sm',
  showLabel = true,
  inline = false,
  modificationDate = null 
}) => {
  const configs = {
    vac: {
      icon: FileText,
      label: 'VAC',
      fullLabel: 'Carte VAC officielle',
      color: '#065f46',
      backgroundColor: '#d1fae5',
      description: 'Données extraites de la documentation officielle'
    },
    api: {
      icon: Globe,
      label: 'API',
      fullLabel: 'API officielle',
      color: '#1e40af',
      backgroundColor: '#dbeafe',
      description: 'Données temps réel depuis une API officielle'
    },
    modified: {
      icon: Edit3,
      label: 'Modifié',
      fullLabel: 'Modifié manuellement',
      color: '#dc2626',
      backgroundColor: '#fee2e2',
      description: modificationDate 
        ? `Modifié le ${new Date(modificationDate).toLocaleDateString('fr-FR')}`
        : 'Données modifiées par l\'utilisateur'
    },
    static: {
      icon: AlertTriangle,
      label: 'Non officiel',
      fullLabel: 'Données non officielles',
      color: '#92400e',
      backgroundColor: '#fef3c7',
      description: 'Données prédéfinies pouvant être obsolètes'
    },
    verified: {
      icon: CheckCircle,
      label: 'Vérifié',
      fullLabel: 'Données vérifiées',
      color: '#059669',
      backgroundColor: '#d1fae5',
      description: 'Données vérifiées et validées'
    }
  };

  const config = configs[source] || configs.static;
  const Icon = config.icon;

  const sizes = {
    xs: { fontSize: '10px', padding: '1px 4px', iconSize: 10 },
    sm: { fontSize: '12px', padding: '2px 6px', iconSize: 12 },
    md: { fontSize: '14px', padding: '4px 8px', iconSize: 14 },
    lg: { fontSize: '16px', padding: '6px 12px', iconSize: 16 }
  };

  const sizeConfig = sizes[size] || sizes.sm;

  const badgeStyle = {
    display: inline ? 'inline-flex' : 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: sizeConfig.padding,
    backgroundColor: config.backgroundColor,
    color: config.color,
    borderRadius: '4px',
    fontSize: sizeConfig.fontSize,
    fontWeight: '500',
    border: `1px solid ${config.color}33`,
    whiteSpace: 'nowrap'
  };

  return (
    <div style={badgeStyle} title={config.description}>
      <Icon size={sizeConfig.iconSize} />
      {showLabel && (
        <span>{config.label}</span>
      )}
    </div>

});

DataSourceBadge.displayName = 'DataSourceBadge';

/**
 * Wrapper pour ajouter un badge de source à n'importe quel élément
 */
export const WithDataSource = memo(({ 
  children, 
  source, 
  badgePosition = 'top-right',
  ...badgeProps 
}) => {
  const positions = {
    'top-right': { top: '-8px', right: '-8px' },
    'top-left': { top: '-8px', left: '-8px' },
    'bottom-right': { bottom: '-8px', right: '-8px' },
    'bottom-left': { bottom: '-8px', left: '-8px' },
    'inline': { position: 'relative', marginLeft: '8px' }
  };

  const positionStyle = positions[badgePosition] || positions['top-right'];

  if (badgePosition === 'inline') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {children}
        <DataSourceBadge source={source} inline={true} {...badgeProps} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <div style={{ position: 'absolute', ...positionStyle }}>
        <DataSourceBadge source={source} {...badgeProps} />
      </div>
    </div>


  );
});

WithDataSource.displayName = 'WithDataSource';

/**
 * Hook pour déterminer la source des données
 */
export const useDataSource = (data) => {
  if (!data) return 'static';
  
  // Données modifiées manuellement
  if (data.manuallyModified || data.userModified) {
    return 'modified';
  }
  
  // Données VAC
  if (data.dataSource === 'vac' || data.fromVAC || data.vacData) {
    return 'vac';
  }
  
  // Données API
  if (data.dataSource === 'api' || data.fromAPI || data.apiData) {
    return 'api';
  }
  
  // Données vérifiées
  if (data.verified || data.validated) {
    return 'verified';
  }
  
  // Par défaut: données statiques
  return 'static';
};

export default DataSourceBadge;