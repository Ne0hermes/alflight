import React, { useState, useEffect } from 'react';
import { Plane, AlertTriangle, CheckCircle, Info, Ruler, Wind, ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@services/openAIPService';
import { useAircraft } from '@core/contexts';

// Types de surface de piste
const SURFACE_TYPES = {
  'ASPH': { name: 'Asphalte', icon: '🛣️', quality: 1 },
  'CONC': { name: 'Béton', icon: '🏗️', quality: 1 },
  'GRASS': { name: 'Herbe', icon: '🌿', quality: 0.8 },
  'GRAVEL': { name: 'Gravier', icon: '🪨', quality: 0.7 },
  'SAND': { name: 'Sable', icon: '🏖️', quality: 0.6 },
  'DIRT': { name: 'Terre', icon: '🟫', quality: 0.6 },
  'WATER': { name: 'Eau', icon: '💧', quality: 0 },
  'SNOW': { name: 'Neige', icon: '❄️', quality: 0.5 },
  'ICE': { name: 'Glace', icon: '🧊', quality: 0.3 }
};

// Fonction pour convertir les mètres en pieds
const metersToFeet = (meters) => Math.round(meters * 3.28084);

// Fonction pour analyser la compatibilité d'une piste
const analyzeRunwayCompatibility = (runway, aircraft) => {
  if (!aircraft || !aircraft.runwayRequirements) {
    return { compatible: 'unknown', reasons: ['Avion non sélectionné'] };
  }

  const reasons = [];
  let compatible = true;

  // Vérifier la longueur de piste au décollage (TODA)
  const todaFeet = metersToFeet(runway.dimensions?.toda || runway.dimensions?.length || 0);
  if (todaFeet < aircraft.runwayRequirements.takeoffDistance) {
    compatible = false;
    reasons.push(`TODA insuffisante: ${todaFeet} ft < ${aircraft.runwayRequirements.takeoffDistance} ft requis`);
  }

  // Vérifier la distance d'atterrissage disponible (LDA)
  const ldaFeet = metersToFeet(runway.dimensions?.lda || runway.dimensions?.length || 0);
  if (ldaFeet < aircraft.runwayRequirements.landingDistance) {
    compatible = false;
    reasons.push(`LDA insuffisante: ${ldaFeet} ft < ${aircraft.runwayRequirements.landingDistance} ft requis`);
  }

  // Vérifier le type de surface
  const surface = runway.surface?.type || 'UNKNOWN';
  const surfaceInfo = SURFACE_TYPES[surface] || { quality: 0.5 };
  
  if (aircraft.runwayRequirements.surfaceTypes && 
      !aircraft.runwayRequirements.surfaceTypes.includes(surface)) {
    compatible = false;
    reasons.push(`Surface ${surfaceInfo.name} non compatible`);
  }

  // Avertissement pour surfaces dégradées
  if (compatible && surfaceInfo.quality < 0.8) {
    reasons.push(`⚠️ Surface ${surfaceInfo.name} - performances réduites`);
  }

  return {
    compatible,
    reasons,
    todaFeet,
    ldaFeet,
    surface: surfaceInfo
  };
};

export const RunwayAnalyzer = ({ icao }) => {
  const { selectedAircraft } = useAircraft();
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRunway, setExpandedRunway] = useState(null);
  const [airport, setAirport] = useState(null);

  const goToVACModule = () => {
    // Utiliser l'objet global pour changer d'onglet
    if (window.setActiveTab) {
      window.setActiveTab('vac');
    }
  };

  useEffect(() => {
    const loadRunwayData = async () => {
      if (!icao) return;

      setLoading(true);
      setError(null);

      try {
        console.log(`🛬 Chargement des pistes pour ${icao}`);
        
        // Récupérer les infos de l'aérodrome
        const airportData = await openAIPService.getAirportDetails(icao);
        
        if (airportData) {
          setAirport(airportData);
          setRunways(airportData.runways || []);
          console.log(`✅ ${airportData.runways?.length || 0} pistes trouvées`);
        } else {
          setError('Aérodrome non trouvé');
        }
      } catch (err) {
        console.error('❌ Erreur chargement pistes:', err);
        setError('Impossible de charger les données de pistes');
        setRunways([]);
      } finally {
        setLoading(false);
      }
    };

    loadRunwayData();
  }, [icao]);

  const toggleRunway = (runwayId) => {
    setExpandedRunway(expandedRunway === runwayId ? null : runwayId);
  };

  if (!icao) {
    return null;
  }

  if (loading) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <div style={sx.combine(sx.flex.center, sx.spacing.p(4))}>
          <div className="animate-spin">⏳</div>
          <span style={sx.spacing.ml(2)}>Chargement des pistes...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        <Plane size={20} style={{ display: 'inline', marginRight: '8px' }} />
        Analyse des pistes - {icao}
      </h4>

      {error && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>{error}</p>
        </div>
      )}

      {!selectedAircraft && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <Info size={16} />
          <p style={sx.text.sm}>
            Sélectionnez un avion pour analyser la compatibilité des pistes
          </p>
        </div>
      )}

      {airport && (
        <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(3))}>
          <p><strong>{airport.name}</strong></p>
          <p>Élévation: {airport.elevation} ft AMSL</p>
          {airport.vacData && (
            <p style={sx.combine(sx.text.xs, sx.text.success)}>
              ✅ Données issues de la carte VAC téléchargée
              {airport.vacData.circuitAltitude && ` • Tour de piste: ${airport.vacData.circuitAltitude} ft`}
            </p>
          )}
        </div>
      )}

      {/* Notification pour télécharger la carte VAC */}
      {airport && airport.staticDataWarning && airport.vacAvailable && (
        <div style={sx.combine(
          sx.components.alert.base, 
          sx.components.alert.warning, 
          sx.spacing.mb(4),
          { borderColor: '#f59e0b', borderWidth: '2px' }
        )}>
          <Download size={20} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
              ⚠️ Données de pistes non disponibles
            </p>
            <p style={sx.combine(sx.text.sm, sx.spacing.mb(2))}>
              Pour obtenir les informations officielles et à jour des pistes de {icao}, 
              téléchargez la carte VAC depuis le module dédié.
            </p>
            <button
              onClick={goToVACModule}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.primary,
                { 
                  backgroundColor: '#f59e0b',
                  '&:hover': { backgroundColor: '#d97706' }
                }
              )}
            >
              <ExternalLink size={16} />
              Aller au module Cartes VAC
            </button>
          </div>
        </div>
      )}

      {runways.length === 0 && !error && airport && !airport.vacAvailable && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
          <Info size={16} />
          <p style={sx.text.sm}>
            Aucune donnée de piste disponible pour cet aérodrome. 
            Les cartes VAC ne sont pas disponibles pour tous les aérodromes.
          </p>
        </div>
      )}

      {runways.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {runways.map((runway, index) => {
            const isExpanded = expandedRunway === runway.id || expandedRunway === index;
            const analysis = selectedAircraft ? analyzeRunwayCompatibility(runway, selectedAircraft) : null;
            
            return (
              <div 
                key={runway.id || index}
                style={sx.combine(
                  sx.components.card.base,
                  sx.spacing.p(3),
                  {
                    borderLeft: analysis 
                      ? `4px solid ${analysis.compatible ? '#10b981' : '#ef4444'}`
                      : '4px solid #6b7280'
                  }
                )}
              >
                {/* En-tête */}
                <div 
                  style={sx.combine(sx.flex.between, sx.spacing.mb(2), { cursor: 'pointer' })}
                  onClick={() => toggleRunway(runway.id || index)}
                >
                  <div style={sx.flex.row}>
                    <div>
                      <h5 style={sx.combine(sx.text.base, sx.text.bold)}>
                        Piste {runway.designator || `${runway.le_ident}/${runway.he_ident}`}
                      </h5>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        {runway.surface?.type ? SURFACE_TYPES[runway.surface.type]?.name || runway.surface.type : 'Surface inconnue'}
                        {runway.dimensions?.width && ` • Largeur: ${runway.dimensions.width}m`}
                      </p>
                    </div>
                    {analysis && (
                      <div style={sx.spacing.ml(3)}>
                        {analysis.compatible ? (
                          <CheckCircle size={20} color="#10b981" />
                        ) : (
                          <AlertTriangle size={20} color="#ef4444" />
                        )}
                      </div>
                    )}
                  </div>
                  <div style={sx.flex.center}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Distances principales */}
                <div style={sx.combine(sx.text.sm, sx.spacing.mb(2))}>
                  <div style={sx.combine(sx.flex.row, sx.spacing.gap(4))}>
                    <div>
                      <strong>TODA:</strong> {runway.dimensions?.toda || runway.dimensions?.length || 'N/A'} m
                      {runway.dimensions?.toda && ` (${metersToFeet(runway.dimensions.toda)} ft)`}
                    </div>
                    <div>
                      <strong>LDA:</strong> {runway.dimensions?.lda || runway.dimensions?.length || 'N/A'} m
                      {runway.dimensions?.lda && ` (${metersToFeet(runway.dimensions.lda)} ft)`}
                    </div>
                  </div>
                </div>

                {/* Analyse de compatibilité */}
                {analysis && analysis.reasons.length > 0 && (
                  <div style={sx.combine(
                    sx.components.alert.base,
                    analysis.compatible ? sx.components.alert.success : sx.components.alert.danger,
                    sx.spacing.mb(2)
                  )}>
                    {analysis.reasons.map((reason, idx) => (
                      <p key={idx} style={sx.text.xs}>{reason}</p>
                    ))}
                  </div>
                )}

                {/* Détails étendus */}
                {isExpanded && (
                  <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
                    {/* Toutes les distances */}
                    <div style={sx.spacing.mb(3)}>
                      <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                        <Ruler size={14} /> Distances déclarées
                      </h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        <div style={sx.text.xs}>
                          <strong>TORA:</strong> {runway.dimensions?.tora || runway.dimensions?.length || 'N/A'} m
                          {runway.dimensions?.tora && ` (${metersToFeet(runway.dimensions.tora)} ft)`}
                        </div>
                        <div style={sx.text.xs}>
                          <strong>TODA:</strong> {runway.dimensions?.toda || runway.dimensions?.length || 'N/A'} m
                          {runway.dimensions?.toda && ` (${metersToFeet(runway.dimensions.toda)} ft)`}
                        </div>
                        <div style={sx.text.xs}>
                          <strong>ASDA:</strong> {runway.dimensions?.asda || runway.dimensions?.length || 'N/A'} m
                          {runway.dimensions?.asda && ` (${metersToFeet(runway.dimensions.asda)} ft)`}
                        </div>
                        <div style={sx.text.xs}>
                          <strong>LDA:</strong> {runway.dimensions?.lda || runway.dimensions?.length || 'N/A'} m
                          {runway.dimensions?.lda && ` (${metersToFeet(runway.dimensions.lda)} ft)`}
                        </div>
                      </div>
                    </div>

                    {/* Orientation et seuils */}
                    {(runway.le_ident || runway.he_ident) && (
                      <div style={sx.spacing.mb(3)}>
                        <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                          <Wind size={14} /> Orientations
                        </h6>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {runway.le_ident && (
                            <div style={sx.text.xs}>
                              <strong>{runway.le_ident}:</strong> {runway.le_heading || 'N/A'}°
                              {runway.le_displaced_threshold && ` • Seuil décalé: ${runway.le_displaced_threshold}m`}
                            </div>
                          )}
                          {runway.he_ident && (
                            <div style={sx.text.xs}>
                              <strong>{runway.he_ident}:</strong> {runway.he_heading || 'N/A'}°
                              {runway.he_displaced_threshold && ` • Seuil décalé: ${runway.he_displaced_threshold}m`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Caractéristiques */}
                    <div style={sx.spacing.mb(2)}>
                      <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                        Caractéristiques
                      </h6>
                      <div style={sx.text.xs}>
                        {runway.surface?.condition && (
                          <p>État: {runway.surface.condition}</p>
                        )}
                        {runway.lighting && (
                          <p>Éclairage: {runway.lighting}</p>
                        )}
                        {runway.closed && (
                          <p style={{ color: '#dc2626' }}>⚠️ PISTE FERMÉE</p>
                        )}
                      </div>
                    </div>

                    {/* Comparaison avec l'avion */}
                    {selectedAircraft && selectedAircraft.runwayRequirements && (
                      <div style={sx.combine(
                        sx.components.alert.base,
                        sx.components.alert.info,
                        sx.spacing.mt(3)
                      )}>
                        <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                          Configuration {selectedAircraft.registration}
                        </h6>
                        <div style={sx.text.xs}>
                          <p>Distance décollage requise: {selectedAircraft.runwayRequirements.takeoffDistance} ft</p>
                          <p>Distance atterrissage requise: {selectedAircraft.runwayRequirements.landingDistance} ft</p>
                          {selectedAircraft.runwayRequirements.surfaceTypes && (
                            <p>Surfaces compatibles: {selectedAircraft.runwayRequirements.surfaceTypes.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Résumé de compatibilité */}
      {selectedAircraft && runways.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(4))}>
          <Info size={16} />
          <div style={sx.text.sm}>
            <p>
              <strong>
                {runways.filter(r => analyzeRunwayCompatibility(r, selectedAircraft).compatible).length}
              </strong> piste(s) compatible(s) sur {runways.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunwayAnalyzer;