// src/features/alternates/components/AlternateSelectorDual.jsx
import React, { memo, useState, useMemo } from 'react';
import { MapPin, Plane, Navigation, Check, X } from 'lucide-react';
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
  
  // Composant pour afficher un côté avec indicateur visuel de sélection
  const SideSelector = ({ title, airports, selectedAirport, onSelect, side, referencePoint, sideColor }) => (
    <div style={sx.components.card.base}>
      <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), { color: sideColor })}>
        {title} ({airports.length} disponibles)
      </h5>
      
      {airports.length === 0 ? (
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
          Aucun aérodrome trouvé de ce côté
        </p>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
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
                    border: '2px solid',
                    borderColor: isSelected ? sideColor : '#e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? (side === 'departure' ? '#fef2f2' : '#f0fdf4') : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: isSelected ? sideColor : `${sideColor}60`,
                      backgroundColor: isSelected ? (side === 'departure' ? '#fef2f2' : '#f0fdf4') : '#fafafa',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }
                  }
                )}
                onClick={() => onSelect(airport, side)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = `${sideColor}60`;
                    e.currentTarget.style.backgroundColor = '#fafafa';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {/* Indicateur visuel de sélection */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: sideColor,
                    color: 'white',
                    padding: '4px 12px',
                    borderBottomLeftRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    ✓ SÉLECTIONNÉ
                  </div>
                )}
                
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
                        backgroundColor: isSelected ? sideColor : `${sideColor}20`,
                        color: isSelected ? 'white' : sideColor,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginRight: '8px',
                        border: isSelected ? 'none' : `1px solid ${sideColor}`
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
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: sideColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}>
                        <Check size={18} />
                      </div>
                    ) : (
                      <div style={{
                        width: '28px',
                        height: '28px',
                        border: `2px solid ${sideColor}30`,
                        borderRadius: '50%',
                        backgroundColor: 'white'
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
          sideColor="#dc2626"
        />
        
        <SideSelector
          title="🟢 Côté arrivée"
          airports={candidatesBySide.arrival}
          selectedAirport={selectedArrival}
          onSelect={handleSelect}
          side="arrival"
          referencePoint={searchZone.arrival}
          sideColor="#059669"
        />
      </div>
      
      {/* Statistiques */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          📊 Statistiques de répartition
        </h5>
        <div style={sx.text.xs}>
          <p><strong>Distance du vol :</strong> {totalFlightDistance.toFixed(1)} NM</p>
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