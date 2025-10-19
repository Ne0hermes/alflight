import React from 'react';

/**
 * Composant de filtres pour les espaces aériens
 */
const AirspaceFilters = ({ filters, onFilterChange, airspaceStats = {} }) => {
  // Types d'espaces aériens avec leurs labels et couleurs
  const airspaceTypes = [
    { id: 'CTR', label: 'CTR', color: '#FF6B6B', description: 'Zone de contrôle' },
    { id: 'TMA', label: 'TMA', color: '#4ECDC4', description: 'Région de contrôle terminale' },
    { id: 'CTA', label: 'CTA', color: '#45B7D1', description: 'Région de contrôle' },
    { id: 'AWY', label: 'AWY', color: '#96CEB4', description: 'Voie aérienne' },
    { id: 'R', label: 'R', color: '#FFA500', description: 'Zone réglementée' },
    { id: 'P', label: 'P', color: '#FF0000', description: 'Zone interdite' },
    { id: 'D', label: 'D', color: '#FF1493', description: 'Zone dangereuse' },
    { id: 'TMZ', label: 'TMZ', color: '#9370DB', description: 'Zone à transpondeur obligatoire' },
    { id: 'RMZ', label: 'RMZ', color: '#8A2BE2', description: 'Zone radio obligatoire' },
    { id: 'TSA', label: 'TSA', color: '#FF69B4', description: 'Zone temporaire' },
    { id: 'TRA', label: 'TRA', color: '#FF6347', description: 'Zone réservée temporaire' },
    { id: 'FIR', label: 'FIR', color: '#708090', description: 'Région d\'information de vol' },
    { id: 'UIR', label: 'UIR', color: '#696969', description: 'Région supérieure' },
    { id: 'ATZ', label: 'ATZ', color: '#FFD700', description: 'Zone de trafic d\'aérodrome' },
  ];

  // Classes d'espaces aériens (simplifiées sans préfixe)
  const airspaceClasses = [
    { id: 'A', label: 'Classe A', color: '#FF0000' },
    { id: 'B', label: 'Classe B', color: '#FF4500' },
    { id: 'C', label: 'Classe C', color: '#FFA500' },
    { id: 'D', label: 'Classe D', color: '#FFD700' },
    { id: 'E', label: 'Classe E', color: '#90EE90' },
    { id: 'F', label: 'Classe F', color: '#87CEEB' },
    { id: 'G', label: 'Classe G', color: '#E6E6FA' },
  ];

  const handleTypeToggle = (typeId) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId];
    onFilterChange({ ...filters, types: newTypes });
  };

  const handleClassToggle = (classId) => {
    const newClasses = filters.classes.includes(classId)
      ? filters.classes.filter(c => c !== classId)
      : [...filters.classes, classId];
    onFilterChange({ ...filters, classes: newClasses });
  };


  const toggleAllTypes = () => {
    const allTypeIds = [...airspaceTypes, ...airspaceClasses].map(t => t.id);
    const allSelected = allTypeIds.every(id => 
      filters.types.includes(id) || filters.classes.includes(id)
    
    if (allSelected) {
      onFilterChange({ ...filters, types: [], classes: [] });
    } else {
      onFilterChange({
        ...filters,
        types: airspaceTypes.map(t => t.id),
        classes: airspaceClasses.map(c => c.id)
      });
    }
  };

  return (
    <div className="airspace-filters">
      <div className="filters-content">
        <div className="filters-header">
          <h3>Filtres des espaces aériens</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="toggle-all-btn"
              onClick={toggleAllTypes}
            >
              Tout sélectionner/désélectionner
            </button>
            <button 
              className="reset-btn"
              onClick={async () => {
                if (window.confirm('Réinitialiser toutes les modifications des espaces aériens ?')) {
                  try {
                    const { aixmAirspacesParser } = await import('../../../services/aixmAirspacesParser.js');
                    aixmAirspacesParser.resetModifications();
                    
                    // Vider aussi le cache du service hybride
                    const { hybridAirspacesService } = await import('../../../services/hybridAirspacesService.js');
                    hybridAirspacesService.cache.clear();
                    hybridAirspacesService.cacheExpiry.clear();
                    
                    window.location.reload(); // Recharger pour appliquer
                  } catch (error) {
                    console.error('Erreur réinitialisation:', error);
                  }
                }
              }}
              title="Réinitialiser les modifications"
            >
              🔄 Réinitialiser
            </button>
          </div>
        </div>

        {/* Types d'espaces */}
        <div className="filter-section">
          <h4>Types d'espaces</h4>
          <div className="filter-grid">
            {airspaceTypes.map(type => (
              <label key={type.id} className="filter-item">
                <input
                  type="checkbox"
                  checked={filters.types.includes(type.id)}
                  onChange={() => handleTypeToggle(type.id)}
                />
                <span 
                  className="filter-label"
                  style={{ borderLeftColor: type.color }}
                  title={type.description}
                >
                  {type.label}
                  {airspaceStats[type.id] && (
                    <span className="count">({airspaceStats[type.id]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Classes d'espaces */}
        <div className="filter-section">
          <h4>Classes d'espaces</h4>
          <div className="filter-grid">
            {airspaceClasses.map(cls => (
              <label key={cls.id} className="filter-item">
                <input
                  type="checkbox"
                  checked={filters.classes.includes(cls.id)}
                  onChange={() => handleClassToggle(cls.id)}
                />
                <span 
                  className="filter-label"
                  style={{ borderLeftColor: cls.color }}
                >
                  {cls.label}
                  {airspaceStats[cls.id] && (
                    <span className="count">({airspaceStats[cls.id]})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Options supplémentaires */}
        <div className="filter-section">
          <h4>Options</h4>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={filters.showAllAltitudes || false}
              onChange={(e) => onFilterChange({ ...filters, showAllAltitudes: e.target.checked })}
            />
            <span>Afficher tous les espaces (ignorer l'altitude)</span>
          </label>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={filters.showLabels}
              onChange={(e) => onFilterChange({ ...filters, showLabels: e.target.checked })}
            />
            <span>Afficher les étiquettes</span>
          </label>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={(e) => onFilterChange({ ...filters, showInactive: e.target.checked })}
            />
            <span>Afficher les espaces inactifs</span>
          </label>
        </div>
      </div>

      <style>{`
        .airspace-filters {
          margin-top: 16px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid #e0e0e0;
        }

        .filters-content {
          padding: 16px;
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e0e0e0;
        }

        .filters-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .toggle-all-btn {
          padding: 4px 8px;
          font-size: 12px;
          background: #f0f0f0;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          cursor: pointer;
        }

        .toggle-all-btn:hover {
          background: #e0e0e0;
        }

        .reset-btn {
          padding: 4px 8px;
          font-size: 12px;
          background: #fee2e2;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          cursor: pointer;
          color: #991b1b;
        }

        .reset-btn:hover {
          background: #fecaca;
        }

        .filter-section {
          margin-bottom: 20px;
        }

        .filter-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .filter-item {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .filter-item:hover {
          background: #f5f5f5;
        }

        .filter-item input[type="checkbox"] {
          margin-right: 8px;
        }

        .filter-label {
          flex: 1;
          padding-left: 8px;
          border-left: 3px solid;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .count {
          font-size: 11px;
          color: #666;
          margin-left: 4px;
        }

        .altitude-filters {
          display: flex;
          gap: 16px;
        }

        .altitude-input {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .altitude-input label {
          font-size: 13px;
          color: #666;
        }

        .altitude-input input {
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 13px;
        }

        .filter-option {
          display: flex;
          align-items: center;
          padding: 8px 0;
          cursor: pointer;
        }

        .filter-option input[type="checkbox"] {
          margin-right: 8px;
        }

        .filter-option span {
          font-size: 13px;
        }
      `}</style>
    </div>

};

export default AirspaceFilters;