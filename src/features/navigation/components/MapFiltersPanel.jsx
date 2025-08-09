import React from 'react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';

const MapFiltersPanel = ({ 
  showLayers, 
  showAdvancedControls, 
  setShowAdvancedControls,
  toggleAirspaceFilter,
  toggleAirportFilter,
  handleOpacityChange 
}) => {
  
  const airspaceTypes = [
    { key: 'CTR', label: 'CTR', color: '#dc2626', desc: 'Zone de contrôle d\'aérodrome' },
    { key: 'TMA', label: 'TMA', color: '#ea580c', desc: 'Zone de contrôle terminale' },
    { key: 'ATZ', label: 'ATZ', color: '#3b82f6', desc: 'Zone de circulation d\'aérodrome' },
    { key: 'D', label: 'D', color: '#f59e0b', desc: 'Zone dangereuse' },
    { key: 'P', label: 'P', color: '#7f1d1d', desc: 'Zone interdite (Prohibited)' },
    { key: 'R', label: 'R', color: '#b91c1c', desc: 'Zone réglementée (Restricted)' },
    { key: 'TSA', label: 'TSA', color: '#8b5cf6', desc: 'Zone temporairement ségrégée' },
    { key: 'TRA', label: 'TRA', color: '#6366f1', desc: 'Zone d\'entraînement' },
    { key: 'C', label: 'Classe C', color: '#60a5fa', desc: 'Espace contrôlé classe C' },
    { key: 'E', label: 'Classe E', color: '#10b981', desc: 'Espace contrôlé classe E' },
    { key: 'F', label: 'Classe F', color: '#84cc16', desc: 'Espace non contrôlé classe F' },
    { key: 'G', label: 'Classe G', color: '#a3e635', desc: 'Espace non contrôlé classe G' }
  ];

  const airportTypes = [
    { key: 'international', label: '🌐 International', desc: 'Aéroports internationaux (LFXX)' },
    { key: 'regional', label: '🗺️ Régional', desc: 'Aéroports régionaux' },
    { key: 'small', label: '🛩️ Petit terrain', desc: 'Petits aérodromes' },
    { key: 'heliport', label: '🚁 Héliport', desc: 'Héliports' },
    { key: 'glider', label: '🦅 Planeur', desc: 'Terrains de planeurs' },
    { key: 'ulm', label: '🛩️ ULM', desc: 'Terrains ULM' },
    { key: 'water', label: '🌊 Hydro', desc: 'Hydrobases' }
  ];

  return (
    <div style={{
      marginTop: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => setShowAdvancedControls(!showAdvancedControls)}
        style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: '#f9fafb',
          border: 'none',
          borderBottom: showAdvancedControls ? '1px solid #e5e7eb' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={16} />
          Filtres de la carte
        </div>
        {showAdvancedControls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      
      {showAdvancedControls && (
        <div style={{ padding: '12px' }}>
          {/* Filtres pour les espaces aériens */}
          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ 
              fontSize: '13px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🌐 Espaces aériens à afficher
            </h4>
            
            {/* Boutons de sélection rapide */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '8px',
              fontSize: '11px'
            }}>
              <button
                onClick={() => {
                  // Activer tous les espaces principaux
                  ['CTR', 'TMA', 'ATZ', 'D', 'P', 'R'].forEach(type => {
                    if (!showLayers.airspaceFilters[type]) {
                      toggleAirspaceFilter(type);
                    }
                  });
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Principaux
              </button>
              <button
                onClick={() => {
                  // Activer toutes les classes
                  ['C', 'E', 'F', 'G'].forEach(type => {
                    if (!showLayers.airspaceFilters[type]) {
                      toggleAirspaceFilter(type);
                    }
                  });
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Classes
              </button>
              <button
                onClick={() => {
                  // Désactiver tout
                  Object.keys(showLayers.airspaceFilters).forEach(type => {
                    if (showLayers.airspaceFilters[type]) {
                      toggleAirspaceFilter(type);
                    }
                  });
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Aucun
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {airspaceTypes.map(space => (
                <label
                  key={space.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px',
                    borderRadius: '4px',
                    border: `2px solid ${showLayers.airspaceFilters[space.key] ? space.color : '#e5e7eb'}`,
                    backgroundColor: showLayers.airspaceFilters[space.key] ? space.color + '15' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '11px'
                  }}
                  title={space.desc}
                >
                  <input
                    type="checkbox"
                    checked={showLayers.airspaceFilters[space.key] || false}
                    onChange={() => toggleAirspaceFilter(space.key)}
                    style={{ 
                      marginRight: '4px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ 
                    fontWeight: showLayers.airspaceFilters[space.key] ? 'bold' : 'normal',
                    color: showLayers.airspaceFilters[space.key] ? space.color : '#374151'
                  }}>
                    {space.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Filtres pour les aérodromes */}
          <div style={{ 
            marginBottom: '12px', 
            paddingTop: '12px', 
            borderTop: '1px solid #e5e7eb' 
          }}>
            <h4 style={{ 
              fontSize: '13px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ✈️ Aérodromes à afficher
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {airportTypes.map(airport => (
                <label
                  key={airport.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px',
                    borderRadius: '4px',
                    border: `2px solid ${showLayers.airportFilters[airport.key] ? '#3b82f6' : '#e5e7eb'}`,
                    backgroundColor: showLayers.airportFilters[airport.key] ? '#dbeafe' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '11px'
                  }}
                  title={airport.desc}
                >
                  <input
                    type="checkbox"
                    checked={showLayers.airportFilters[airport.key] || false}
                    onChange={() => toggleAirportFilter(airport.key)}
                    style={{ 
                      marginRight: '4px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>{airport.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Contrôle de l'opacité OpenAIP */}
          <div style={{ 
            paddingTop: '12px', 
            borderTop: '1px solid #e5e7eb' 
          }}>
            <h4 style={{ 
              fontSize: '13px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🎨 Paramètres d'affichage
            </h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <label style={{ fontSize: '12px' }}>Opacité overlay OpenAIP:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={showLayers.openAIPOpacity}
                  onChange={(e) => handleOpacityChange(e.target.value)}
                  style={{
                    width: '120px',
                    height: '20px',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ 
                  minWidth: '40px', 
                  fontSize: '12px', 
                  textAlign: 'right',
                  fontWeight: 'bold'
                }}>
                  {showLayers.openAIPOpacity}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapFiltersPanel;