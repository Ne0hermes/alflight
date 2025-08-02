// src/features/alternates/AlternatesModule.jsx
import React, { memo } from 'react';
import { Navigation2, AlertTriangle, Fuel, Wind, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAlternateSelection } from './hooks/useAlternateSelection';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { AlternateSelector } from './components/AlternateSelector';
import { AlternateMap } from './components/AlternateMap';
import { AlternateDetails } from './components/AlternateDetails';

export const AlternatesModule = memo(() => {
  const { searchZone, dynamicParams, isReady } = useAlternateSelection();
  const { 
    selectedAlternates, 
    scoredAlternates,
    searchConfig,
    setSearchConfig 
  } = useAlternatesStore();
  
  if (!isReady) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>
          Définissez un vol avec départ et arrivée pour activer la sélection des déroutements
        </p>
      </div>
    );
  }
  
  return (
    <div>
      {/* En-tête avec résumé */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
          🛬 Aérodromes de déroutement intelligents
        </h3>
        
        {/* Paramètres de recherche */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Configuration de recherche
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={sx.components.label.base}>
                Méthode de recherche
              </label>
              <select
                value={searchConfig.method}
                onChange={(e) => setSearchConfig({ method: e.target.value })}
                style={sx.components.input.base}
              >
                <option value="triangle">Triangle équilatéral</option>
                <option value="buffer">Zone tampon latérale</option>
              </select>
            </div>
            
            {searchConfig.method === 'buffer' && (
              <div>
                <label style={sx.components.label.base}>
                  Distance tampon (NM)
                </label>
                <input
                  type="number"
                  value={searchConfig.bufferDistance}
                  onChange={(e) => setSearchConfig({ bufferDistance: parseInt(e.target.value) })}
                  min="10"
                  max="50"
                  style={sx.components.input.base}
                />
              </div>
            )}
          </div>
          
          {/* Contraintes calculées */}
          <div style={sx.combine(sx.spacing.mt(3), sx.text.sm, sx.text.secondary)}>
            <p>
              <Plane size={14} style={{ display: 'inline' }} /> 
              Piste minimale requise : <strong>{dynamicParams.requiredRunwayLength}m</strong>
            </p>
            <p>
              <Fuel size={14} style={{ display: 'inline' }} /> 
              Rayon max de déroutement : <strong>{dynamicParams.maxRadiusNM.toFixed(0)} NM</strong>
            </p>
          </div>
        </div>
        
        {/* Sélecteur d'alternates */}
        <AlternateSelector 
          candidates={scoredAlternates}
          selected={selectedAlternates}
        />
      </section>
      
      {/* Carte avec visualisation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          Visualisation géographique
        </h4>
        <AlternateMap 
          searchZone={searchZone}
          alternates={selectedAlternates}
        />
      </section>
      
      {/* Détails des alternates sélectionnés */}
      <section style={sx.components.section.base}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          Détails des déroutements sélectionnés
        </h4>
        <AlternateDetails alternates={selectedAlternates} />
      </section>
    </div>
  );
});

AlternatesModule.displayName = 'AlternatesModule';
export default AlternatesModule;