// src/features/alternates/components/AlternateSelectorDual.jsx
import React, { memo, useState, useMemo } from 'react';
import { MapPin, Plane, Navigation, Check, X, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { calculateDistance } from '../utils/geometryCalculations';

/**
 * Composant de sélection duale des aérodromes de déroutement
 * Permet de choisir un aérodrome côté départ et un côté arrivée
 */
export const AlternateSelectorDual = memo(({ 
  candidates = [], 
  searchZone,
  onSelectionChange,
  currentSelection = { departure: null, arrival: null }
}) => {
  const [selectedDeparture, setSelectedDeparture] = useState(currentSelection.departure);
  const [selectedArrival, setSelectedArrival] = useState(currentSelection.arrival);
  
  // Séparer les candidats par côté
  const candidatesBySide = useMemo(() => {
    const departure = [];
    const arrival = [];
    
    candidates.forEach(airport => {
      // Calculer les distances depuis départ et arrivée
      const distToDeparture = calculateDistance(airport.position, searchZone.departure);
      const distToArrival = calculateDistance(airport.position, searchZone.arrival);
      
      // Enrichir avec les distances
      const enrichedAirport = {
        ...airport,
        distanceToDeparture: distToDeparture,
        distanceToArrival: distToArrival,
        side: airport.side || (distToDeparture < distToArrival ? 'departure' : 'arrival')
      };
      
      // Classer selon le côté
      if (enrichedAirport.side === 'departure') {
        departure.push(enrichedAirport);
      } else {
        arrival.push(enrichedAirport);
      }
    });
    
    // Trier par score décroissant
    departure.sort((a, b) => (b.score || 0) - (a.score || 0));
    arrival.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    return { departure, arrival };
  }, [candidates, searchZone]);
  
  // Distance totale du vol
  const totalFlightDistance = useMemo(() => {
    if (!searchZone) return 0;
    return calculateDistance(searchZone.departure, searchZone.arrival);
  }, [searchZone]);
  
  // Gérer la sélection
  const handleSelect = (airport, side) => {
    if (side === 'departure') {
      const newSelection = airport?.icao === selectedDeparture?.icao ? null : airport;
      setSelectedDeparture(newSelection);
      onSelectionChange?.({ departure: newSelection, arrival: selectedArrival });
    } else {
      const newSelection = airport?.icao === selectedArrival?.icao ? null : airport;
      setSelectedArrival(newSelection);
      onSelectionChange?.({ departure: selectedDeparture, arrival: newSelection });
    }
  };
  
  // Composant pour afficher un côté
  const SideSelector = ({ title, airports, selectedAirport, onSelect, side, referencePoint }) => (
    <div style={sx.components.card.base}>
      <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        {title} ({airports.length} disponibles)
      </h5>
      
      {airports.length === 0 ? (
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
          Aucun aérodrome trouvé de ce côté
        </p>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {airports.map((airport, index) => {
            const isSelected = selectedAirport?.icao === airport.icao;
            const distanceFromRef = side === 'departure' 
              ? airport.distanceToDeparture 
              : airport.distanceToArrival;
            
            // Vérifier si le déroutement est plus court que le vol initial
            const isDiversionShorter = distanceFromRef < totalFlightDistance;
            
            return (
              <div
                key={airport.icao}
                style={sx.combine(
                  {
                    padding: '12px',
                    marginBottom: '8px',
                    border: '1px solid',
                    borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }
                )}
                onClick={() => onSelect(airport, side)}
              >
                <div style={sx.flex.between}>
                  <div style={{ flex: 1 }}>
                    <div style={sx.flex.start}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: side === 'departure' ? '#dc2626' : '#059669',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginRight: '8px'
                      }}>
                        {index + 1}
                      </span>
                      <strong style={sx.text.sm}>{airport.icao}</strong>
                      <span style={sx.combine(sx.text.sm, sx.spacing.ml(2))}>
                        {airport.name}
                      </span>
                    </div>
                    
                    <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                      <span style={sx.spacing.mr(3)}>
                        <MapPin size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        {distanceFromRef.toFixed(1)} NM depuis {side === 'departure' ? 'départ' : 'arrivée'}
                      </span>
                      <span style={sx.spacing.mr(3)}>
                        <Navigation size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        {airport.distance.toFixed(1)} NM de la route
                      </span>
                      {!isDiversionShorter && (
                        <span style={{ color: '#ef4444' }}>
                          ⚠️ Plus long que vol initial
                        </span>
                      )}
                    </div>
                    
                    <div style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
                      <span style={sx.spacing.mr(2)}>
                        🛬 {airport.runways?.[0]?.length || '?'}m
                      </span>
                      {airport.services?.fuel && <span style={sx.spacing.mr(2)}>⛽</span>}
                      {airport.services?.atc && <span style={sx.spacing.mr(2)}>🗼</span>}
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: getScoreColor(airport.score) + '20',
                        color: getScoreColor(airport.score),
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        {((airport.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div style={sx.combine(sx.flex.center, sx.spacing.ml(3))}>
                    {isSelected ? (
                      <Check size={20} color="#3b82f6" />
                    ) : (
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '50%'
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  
  return (
    <div>
      {/* Explication du système */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div style={sx.text.sm}>
          <p style={sx.text.bold}>Système dual de déroutement</p>
          <p>La zone est divisée par la médiatrice du segment [départ-arrivée]. 
             Sélectionnez un aérodrome de chaque côté pour garantir une couverture complète du vol.</p>
          <p style={sx.spacing.mt(1)}>
            Distance du vol : <strong>{totalFlightDistance.toFixed(1)} NM</strong>
          </p>
        </div>
      </div>
      
      {/* Résumé de la sélection */}
      {(selectedDeparture || selectedArrival) && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
            Sélection actuelle
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.muted)}>Déroutement départ :</p>
              {selectedDeparture ? (
                <p style={sx.text.sm}>
                  <strong>{selectedDeparture.icao}</strong> - {selectedDeparture.name}
                  <br />
                  <span style={sx.text.xs}>
                    {selectedDeparture.distanceToDeparture.toFixed(1)} NM depuis le départ
                  </span>
                </p>
              ) : (
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non sélectionné</p>
              )}
            </div>
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.muted)}>Déroutement arrivée :</p>
              {selectedArrival ? (
                <p style={sx.text.sm}>
                  <strong>{selectedArrival.icao}</strong> - {selectedArrival.name}
                  <br />
                  <span style={sx.text.xs}>
                    {selectedArrival.distanceToArrival.toFixed(1)} NM depuis l'arrivée
                  </span>
                </p>
              ) : (
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non sélectionné</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Sélecteurs par côté */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <SideSelector
          title="🔴 Côté départ"
          airports={candidatesBySide.departure}
          selectedAirport={selectedDeparture}
          onSelect={handleSelect}
          side="departure"
          referencePoint={searchZone.departure}
        />
        
        <SideSelector
          title="🟢 Côté arrivée"
          airports={candidatesBySide.arrival}
          selectedAirport={selectedArrival}
          onSelect={handleSelect}
          side="arrival"
          referencePoint={searchZone.arrival}
        />
      </div>
      
      {/* Statistiques */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          📊 Statistiques de répartition
        </h5>
        <div style={sx.text.xs}>
          <p>Total candidats : {candidates.length}</p>
          <p>Côté départ : {candidatesBySide.departure.length} ({(candidatesBySide.departure.length / candidates.length * 100).toFixed(0)}%)</p>
          <p>Côté arrivée : {candidatesBySide.arrival.length} ({(candidatesBySide.arrival.length / candidates.length * 100).toFixed(0)}%)</p>
        </div>
      </div>
    </div>
  );
});

// Fonction pour obtenir la couleur selon le score
const getScoreColor = (score) => {
  if (!score) return '#6b7280';
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
};

AlternateSelectorDual.displayName = 'AlternateSelectorDual';