import React, { memo, useState, useEffect } from 'react';
import { Navigation2, MapPin, Plus, Trash2, Info, CheckCircle, Download, FileText, AlertTriangle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@services/openAIPService';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { Conversions } from '@utils/conversions';

// Points VFR prédéfinis pour quelques aérodromes
const PRESET_VFR_POINTS = {
  'LFPN': [
    { id: 'LFPN-N', code: 'N', name: 'November', description: 'Château d\'eau de Jouy-en-Josas', coordinates: { lat: 48.7800, lon: 2.1061 }, mandatory: true },
    { id: 'LFPN-S', code: 'S', name: 'Sierra', description: 'Étang de Saclay', coordinates: { lat: 48.7200, lon: 2.1061 }, mandatory: true },
    { id: 'LFPN-E', code: 'E', name: 'Echo', description: 'Pont de Sèvres', coordinates: { lat: 48.7519, lon: 2.1500 }, mandatory: false },
    { id: 'LFPN-W', code: 'W', name: 'Whiskey', description: 'Viaduc de l\'A12', coordinates: { lat: 48.7519, lon: 2.0600 }, mandatory: false }
  ],
  'LFPT': [
    { id: 'LFPT-N', code: 'N', name: 'November', description: 'Forêt de l\'Isle-Adam', coordinates: { lat: 49.1300, lon: 2.0413 }, mandatory: true },
    { id: 'LFPT-S', code: 'S', name: 'Sierra', description: 'Centre de Cergy-Pontoise', coordinates: { lat: 49.0600, lon: 2.0413 }, mandatory: true },
    { id: 'LFPT-E', code: 'E', name: 'Echo', description: 'Parc du Vexin', coordinates: { lat: 49.0967, lon: 2.1000 }, mandatory: false },
    { id: 'LFPT-W', code: 'W', name: 'Whiskey', description: 'Boucle de l\'Oise', coordinates: { lat: 49.0967, lon: 1.9800 }, mandatory: false }
  ],
  'LFST': [
    { id: 'LFST-N', code: 'N', name: 'November', description: 'Obernai', coordinates: { lat: 48.5900, lon: 7.6283 }, mandatory: true },
    { id: 'LFST-S', code: 'S', name: 'Sierra', description: 'Sélestat', coordinates: { lat: 48.4000, lon: 7.6283 }, mandatory: true },
    { id: 'LFST-E', code: 'E', name: 'Echo', description: 'Pont de Kehl', coordinates: { lat: 48.5444, lon: 7.7500 }, mandatory: false },
    { id: 'LFST-W', code: 'W', name: 'Whiskey', description: 'Molsheim', coordinates: { lat: 48.5444, lon: 7.5000 }, mandatory: false }
  ],
  'LFPG': [
    { id: 'LFPG-NE', code: 'NE', name: 'Nord-Est', description: 'Point NE CDG', coordinates: { lat: 49.0500, lon: 2.6000 }, mandatory: true },
    { id: 'LFPG-SE', code: 'SE', name: 'Sud-Est', description: 'Point SE CDG', coordinates: { lat: 48.9700, lon: 2.6000 }, mandatory: true },
    { id: 'LFPG-SW', code: 'SW', name: 'Sud-Ouest', description: 'Point SW CDG', coordinates: { lat: 48.9700, lon: 2.5000 }, mandatory: true },
    { id: 'LFPG-NW', code: 'NW', name: 'Nord-Ouest', description: 'Point NW CDG', coordinates: { lat: 49.0500, lon: 2.5000 }, mandatory: true }
  ],
  'LFPO': [
    { id: 'LFPO-N', code: 'N', name: 'November', description: 'Antony', coordinates: { lat: 48.7700, lon: 2.3794 }, mandatory: true },
    { id: 'LFPO-S', code: 'S', name: 'Sierra', description: 'Marché de Rungis', coordinates: { lat: 48.6800, lon: 2.3794 }, mandatory: true },
    { id: 'LFPO-E', code: 'EA', name: 'Echo Alpha', description: 'Athis-Mons', coordinates: { lat: 48.7233, lon: 2.4200 }, mandatory: false },
    { id: 'LFPO-W', code: 'WA', name: 'Whiskey Alpha', description: 'Wissous', coordinates: { lat: 48.7233, lon: 2.3400 }, mandatory: false }
  ]
};

export const ReportingPointsSelector = memo(({ 
  airportIcao, 
  selectedPoints = [], 
  onPointsChange, 
  maxPoints = 5 
}) => {
  const [availablePoints, setAvailablePoints] = useState([]);
  const [customPoint, setCustomPoint] = useState({ name: '', lat: '', lon: '' });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [vacPointsAvailable, setVacPointsAvailable] = useState(false);
  
  // Hooks VAC
  const vacChart = vacSelectors.useChartByIcao(airportIcao);
  const { } = vacSelectors.useVACActions();
  const isDownloading = false; // État de téléchargement temporairement désactivé
  
  // Charger les points VFR pour l'aérodrome
  useEffect(() => {
    if (!airportIcao) {
      setAvailablePoints([]);
      setVacPointsAvailable(false);
      return;
    }
    
    // Vérifier d'abord si des points VAC sont disponibles
    if (vacChart && vacChart.isDownloaded && vacChart.extractedData && vacChart.extractedData.vfrPoints) {
      setAvailablePoints(vacChart.extractedData.vfrPoints);
      setVacPointsAvailable(true);
    } else if (PRESET_VFR_POINTS[airportIcao]) {
      // Sinon utiliser les points prédéfinis
      setAvailablePoints(PRESET_VFR_POINTS[airportIcao]);
      setVacPointsAvailable(false);
    } else {
      setAvailablePoints([]);
      setVacPointsAvailable(false);
    }
  }, [airportIcao, vacChart]);
  
  // Gérer la sélection/désélection d'un point
  const togglePoint = (point) => {
    const isSelected = selectedPoints.some(p => p.id === point.id);
    
    if (isSelected) {
      onPointsChange(selectedPoints.filter(p => p.id !== point.id));
    } else if (selectedPoints.length < maxPoints) {
      onPointsChange([...selectedPoints, point]);
    }
  };
  
  // Ajouter un point personnalisé
  const addCustomPoint = () => {
    if (customPoint.name && customPoint.lat && customPoint.lon) {
      const newPoint = {
        id: `custom-${Date.now()}`,
        code: customPoint.name.substring(0, 3).toUpperCase(),
        name: customPoint.name,
        description: 'Point personnalisé',
        coordinates: {
          lat: parseFloat(customPoint.lat),
          lon: parseFloat(customPoint.lon)
        },
        mandatory: false,
        custom: true
      };
      
      if (selectedPoints.length < maxPoints) {
        onPointsChange([...selectedPoints, newPoint]);
      }
      
      setCustomPoint({ name: '', lat: '', lon: '' });
      setShowCustomForm(false);
    }
  };
  
  const removeCustomPoint = (pointId) => {
    onPointsChange(selectedPoints.filter(p => p.id !== pointId));
  };
  
  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
          <Navigation2 size={20} />
          <span style={sx.spacing.ml(2)}>Points de report VFR - {airportIcao || 'Sélectionnez un aérodrome'}</span>
        </h4>
        <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
          {selectedPoints.length}/{maxPoints} sélectionnés
        </span>
      </div>
      
      {!airportIcao && (
        <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.py(4))}>
          <Info size={24} style={{ margin: '0 auto 8px' }} />
          <p>Sélectionnez un aérodrome pour voir les points de report VFR disponibles</p>
        </div>
      )}
      
      {/* Notification pour télécharger la carte VAC */}
      {airportIcao && vacChart && !vacChart.isDownloaded && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <Download size={16} />
          <div style={{ flex: 1 }}>
            <p style={sx.text.sm}>
              <strong>Points VFR officiels disponibles !</strong>
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Téléchargez la carte VAC de {airportIcao} pour obtenir automatiquement tous les points de report VFR officiels extraits de la documentation aéronautique.
            </p>
          </div>
          <button
            onClick={() => {
              // Naviguer vers le module VAC
              if (window.setActiveTab) {
                window.setActiveTab('vac');
              }
            }}
            disabled={isDownloading}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              { marginLeft: '12px', whiteSpace: 'nowrap' }
            )}
          >
            <FileText size={16} />
            Module VAC
          </button>
        </div>
      )}
      
      {/* Indicateur de source des points */}
      {airportIcao && availablePoints.length > 0 && vacPointsAvailable && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(4))}>
          <FileText size={16} />
          <p style={sx.text.sm}>
            <strong>Points VFR officiels</strong> - Extraits de la carte VAC de {airportIcao}
          </p>
        </div>
      )}
      
      {airportIcao && availablePoints.length === 0 && !vacChart && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <Info size={16} />
          <p style={sx.text.sm}>
            Aucun point VFR prédéfini pour cet aérodrome. 
            Vous pouvez ajouter des points personnalisés.
          </p>
        </div>
      )}
      
      {/* Points VFR prédéfinis */}
      {availablePoints.length > 0 && (
        <div style={sx.spacing.mb(4)}>
          <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), sx.flex.start)}>
            Points officiels
            {vacPointsAvailable ? (
              <span style={sx.combine(
                sx.text.xs,
                sx.spacing.ml(2),
                {
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 'normal'
                }
              )}>
                <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
                VAC
              </span>
            ) : (
              <span style={sx.combine(
                sx.text.xs,
                sx.spacing.ml(2),
                {
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 'normal'
                }
              )}>
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Prédéfinis
              </span>
            )}
          </h5>
          {!vacPointsAvailable && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(2), { padding: '6px 10px' })}>
              <Info size={14} />
              <p style={sx.text.xs}>
                Ces points sont prédéfinis et peuvent différer des points officiels. 
                {vacChart && ' Téléchargez la carte VAC pour obtenir les points officiels.'}
              </p>
            </div>
          )}
          <div style={{ display: 'grid', gap: '8px' }}>
            {availablePoints.map(point => {
              const isSelected = selectedPoints.some(p => p.id === point.id);
              const canSelect = !isSelected && selectedPoints.length < maxPoints;
              
              return (
                <div 
                  key={point.id}
                  onClick={() => canSelect || isSelected ? togglePoint(point) : null}
                  style={sx.combine(
                    sx.spacing.p(3),
                    sx.rounded.md,
                    sx.bg.gray,
                    {
                      cursor: canSelect || isSelected ? 'pointer' : 'not-allowed',
                      opacity: !canSelect && !isSelected ? 0.5 : 1,
                      border: `2px solid ${isSelected ? '#3b82f6' : 'transparent'}`,
                      backgroundColor: isSelected ? '#dbeafe' : '#f9fafb',
                      transition: 'all 0.2s'
                    }
                  )}
                >
                  <div style={sx.combine(sx.flex.between)}>
                    <div style={sx.flex.start}>
                      <div style={sx.combine(
                        sx.text.bold,
                        sx.spacing.px(2),
                        sx.spacing.py(1),
                        sx.rounded.sm,
                        {
                          backgroundColor: point.mandatory ? '#fef3c7' : '#e5e7eb',
                          color: point.mandatory ? '#92400e' : '#4b5563',
                          fontSize: '12px'
                        }
                      )}>
                        {point.code}
                      </div>
                      <div style={sx.spacing.ml(3)}>
                        <p style={sx.combine(sx.text.base, sx.text.bold)}>
                          {point.name}
                          {point.mandatory && (
                            <span style={sx.combine(sx.text.xs, sx.text.warning, sx.spacing.ml(2))}>
                              (Obligatoire)
                            </span>
                          )}
                        </p>
                        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                          {point.description}
                        </p>
                        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                          📍 {point.coordinates.lat.toFixed(4)}°, {point.coordinates.lon.toFixed(4)}°<br />
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                            {Conversions.coordinatesToDMS(point.coordinates.lat, point.coordinates.lon).formatted}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle size={20} color="#3b82f6" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Points sélectionnés personnalisés */}
      {selectedPoints.filter(p => p.custom).length > 0 && (
        <div style={sx.spacing.mb(4)}>
          <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
            Points personnalisés
          </h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            {selectedPoints.filter(p => p.custom).map(point => (
              <div 
                key={point.id}
                style={sx.combine(
                  sx.spacing.p(3),
                  sx.rounded.md,
                  sx.bg.gray,
                  sx.flex.between
                )}
              >
                <div>
                  <p style={sx.text.bold}>{point.name}</p>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    📍 {point.coordinates.lat.toFixed(4)}°, {point.coordinates.lon.toFixed(4)}°<br />
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                      {Conversions.coordinatesToDMS(point.coordinates.lat, point.coordinates.lon).formatted}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => removeCustomPoint(point.id)}
                  style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '4px 8px' })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Formulaire pour ajouter un point personnalisé */}
      {airportIcao && (
        <div style={sx.spacing.mt(4)}>
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              disabled={selectedPoints.length >= maxPoints}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.secondary,
                selectedPoints.length >= maxPoints && { opacity: 0.5, cursor: 'not-allowed' }
              )}
            >
              <Plus size={16} />
              Ajouter un point personnalisé
            </button>
          ) : (
            <div style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
              <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                Nouveau point de report
              </h5>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={sx.components.label.base}>Nom du point</label>
                  <input
                    type="text"
                    value={customPoint.name}
                    onChange={(e) => setCustomPoint({ ...customPoint, name: e.target.value })}
                    placeholder="Ex: Château d'eau"
                    style={sx.components.input.base}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={sx.components.label.base}>Latitude</label>
                    <input
                      type="number"
                      value={customPoint.lat}
                      onChange={(e) => setCustomPoint({ ...customPoint, lat: e.target.value })}
                      placeholder="48.7519"
                      step="0.0001"
                      style={sx.components.input.base}
                    />
                  </div>
                  <div>
                    <label style={sx.components.label.base}>Longitude</label>
                    <input
                      type="number"
                      value={customPoint.lon}
                      onChange={(e) => setCustomPoint({ ...customPoint, lon: e.target.value })}
                      placeholder="2.1061"
                      step="0.0001"
                      style={sx.components.input.base}
                    />
                  </div>
                </div>
                <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
                  <button
                    onClick={addCustomPoint}
                    style={sx.combine(sx.components.button.base, sx.components.button.primary)}
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomPoint({ name: '', lat: '', lon: '' });
                    }}
                    style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Résumé de la sélection */}
      {selectedPoints.length > 0 && (
        <div style={sx.combine(
          sx.components.alert.base,
          sx.components.alert.success,
          sx.spacing.mt(4)
        )}>
          <CheckCircle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              {selectedPoints.length} point{selectedPoints.length > 1 ? 's' : ''} sélectionné{selectedPoints.length > 1 ? 's' : ''}
            </p>
            <p style={sx.text.xs}>
              {selectedPoints.map(p => p.code || p.name).join(' → ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

ReportingPointsSelector.displayName = 'ReportingPointsSelector';

export default ReportingPointsSelector;