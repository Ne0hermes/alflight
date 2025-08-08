// src/features/alternates/components/AlternateSelectorDual.jsx
import React, { memo, useMemo } from 'react';
import { MapPin, Plane, Navigation, Check, X } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { calculateDistance } from '@utils/navigationCalculations';
import { DataSourceBadge } from '@shared/components';

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
  
  // Utiliser directement currentSelection au lieu de useState
  const selectedDeparture = currentSelection.departure;
  const selectedArrival = currentSelection.arrival;
  
  // Séparer les candidats par côté
  const candidatesBySide = useMemo(() => {
    const departure = [];
    const arrival = [];
    
    candidates.forEach(airport => {
      // Filtrer les aéroports sans code ICAO
      if (!airport.icao) {
        return;
      }
      
      // S'assurer que l'aéroport a une position valide
      const position = airport.position || airport.coordinates || { lat: airport.lat, lon: airport.lon || airport.lng };
      
      if (!position || !position.lat || !position.lon) {
        return;
      }
      
      // Calculer les distances depuis départ et arrivée
      const distToDeparture = calculateDistance(position, searchZone.departure);
      const distToArrival = calculateDistance(position, searchZone.arrival);
      
      // Enrichir avec les distances
      const enrichedAirport = {
        ...airport,
        position: position,
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
      const newDeparture = airport?.icao === selectedDeparture?.icao ? null : airport;
      onSelectionChange?.({ departure: newDeparture, arrival: selectedArrival });
    } else {
      const newArrival = airport?.icao === selectedArrival?.icao ? null : airport;
      onSelectionChange?.({ departure: selectedDeparture, arrival: newArrival });
    }
  };
  
  // Composant pour afficher un côté avec indicateur visuel de sélection
  const SideSelector = ({ title, airports, selectedAirport, onSelect, side, referencePoint, sideColor }) => {
    
    return (
    <div style={sx.components.card.base}>
      <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), { color: sideColor })}>
        {title} ({airports.length})
      </h5>
      
      {airports.length === 0 ? (
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
          Aucun aérodrome trouvé de ce côté
        </p>
      ) : (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                role="button"
                tabIndex={0}
                style={{
                  padding: '10px',
                  marginBottom: '6px',
                  border: '2px solid',
                  borderColor: isSelected ? sideColor : '#e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? (side === 'departure' ? '#fef2f2' : '#f0fdf4') : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                  userSelect: 'none',
                  pointerEvents: 'auto',
                  zIndex: 1
                }}
                onClick={() => {
                  if (onSelect) {
                    onSelect(airport, side);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (onSelect) {
                      onSelect(airport, side);
                    }
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = `${sideColor}60`;
                    e.currentTarget.style.backgroundColor = '#fafafa';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
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
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? sideColor : `${sideColor}20`,
                        color: isSelected ? 'white' : sideColor,
                        fontSize: '11px',
                        fontWeight: 'bold',
                        marginRight: '6px',
                        border: isSelected ? 'none' : `1px solid ${sideColor}`,
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>
                      <strong style={sx.text.sm}>{airport.icao}</strong>
                      <span style={sx.combine(sx.text.sm, sx.spacing.ml(1))}>
                        {airport.name}
                      </span>
                      {airport.dataSource && airport.dataSource !== 'static' && (
                        <DataSourceBadge 
                          source={airport.dataSource} 
                          size="xs" 
                          showLabel={false}
                          inline={true}
                          style={{ marginLeft: '6px' }}
                        />
                      )}
                    </div>
                    
                    <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      <span style={sx.spacing.mr(2)}>
                        <MapPin size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        {distanceFromRef.toFixed(1)} NM depuis {side === 'departure' ? 'départ' : 'arrivée'}
                      </span>
                      <span style={sx.spacing.mr(2)}>
                        <Navigation size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        {airport.distance.toFixed(1)} NM route
                      </span>
                    </div>
                    
                    <div style={sx.combine(sx.text.xs)}>
                      <span style={sx.spacing.mr(1)}>
                        🛬 {airport.runways?.[0]?.length || '?'}m
                      </span>
                      {airport.services?.fuel && <span style={sx.spacing.mr(1)}>⛽</span>}
                      {airport.services?.atc && <span style={sx.spacing.mr(1)}>🗼</span>}
                      <span style={{
                        padding: '1px 4px',
                        backgroundColor: getScoreColor(airport.score) + '20',
                        color: getScoreColor(airport.score),
                        borderRadius: '3px',
                        fontWeight: 'bold',
                        fontSize: '10px'
                      }}>
                        {((airport.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div style={sx.combine(sx.flex.center, sx.spacing.ml(3))}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(airport, side);
                      }}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: isSelected ? 'none' : `2px solid ${sideColor}30`,
                        borderRadius: '50%',
                        backgroundColor: isSelected ? sideColor : 'white',
                        color: isSelected ? 'white' : sideColor,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      {isSelected ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  };
  
  return (
    <div>
      {/* Sélecteurs par côté */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <SideSelector
          title="🔴 Départ"
          airports={candidatesBySide.departure}
          selectedAirport={selectedDeparture}
          onSelect={handleSelect}
          side="departure"
          referencePoint={searchZone.departure}
          sideColor="#dc2626"
        />
        
        <SideSelector
          title="🟢 Arrivée"
          airports={candidatesBySide.arrival}
          selectedAirport={selectedArrival}
          onSelect={handleSelect}
          side="arrival"
          referencePoint={searchZone.arrival}
          sideColor="#059669"
        />
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