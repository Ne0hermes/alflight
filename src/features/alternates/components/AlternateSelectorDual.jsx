// src/features/alternates/components/AlternateSelectorDual.jsx
import React, { memo, useMemo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { calculateDistance } from '@utils/navigationCalculations';
import { DataSourceBadge } from '@shared/components';

import { useAircraft } from '@core/contexts';

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

  // Séparer les candidats par côté (liste unique sans séparation contrôlé/non contrôlé)
  const candidatesBySide = useMemo(() => {
    const departure = [];
    const arrival = [];

    candidates.forEach(airport => {
      // Filtrer les aéroports sans code ICAO ou avec code ICAO invalide
      if (!airport.icao || !/^[A-Z]{4}$/.test(airport.icao)) {
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

      // Déterminer si l'aérodrome est contrôlé
      const isControlled = airport.services?.atc === true ||
        (airport.frequencies && airport.frequencies.some(f => f.type === 'TWR')) ||
        airport.type === 'large_airport' ||
        airport.type === 'medium_airport';

      // Enrichir avec les distances et le statut de contrôle
      const enrichedAirport = {
        ...airport,
        position: position,
        distanceToDeparture: distToDeparture,
        distanceToArrival: distToArrival,
        side: airport.side || (distToDeparture < distToArrival ? 'departure' : 'arrival'),
        isControlled: isControlled
      };

      // Classer selon le côté (liste unique)
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
    const [hoveredIcao, setHoveredIcao] = React.useState(null);
    const [showDetails, setShowDetails] = React.useState(false);
    const { selectedAircraft } = useAircraft();

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
              const isHovered = hoveredIcao === airport.icao;
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
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: isSelected ? sideColor : (isHovered ? `${sideColor}60` : 'var(--border-subtle)'),
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? (side === 'departure' ? 'var(--bg-overlay)' : 'var(--bg-overlay)') : (isHovered ? 'var(--bg-overlay)' : '#ffffff'),
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'none',
                    pointerEvents: 'auto',
                    zIndex: 1,
                    transform: isHovered && !isSelected ? 'translateY(-1px)' : 'translateY(0)',
                    boxShadow: isHovered && !isSelected ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
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
                  onMouseEnter={() => setHoveredIcao(airport.icao)}
                  onMouseLeave={() => setHoveredIcao(null)}
                >
                  {/* Indicateur visuel de sélection */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      backgroundColor: sideColor,
                      color: 'var(--text-primary)',
                      padding: '4px 12px',
                      borderBottomLeftRadius: '8px',
                      fontSize: 'var(--fs-caption)',
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
                          fontSize: 'var(--fs-caption)',
                          fontWeight: 'bold',
                          marginRight: '6px',
                          borderWidth: isSelected ? '0' : '1px',
                          borderStyle: isSelected ? 'none' : 'solid',
                          borderColor: isSelected ? 'transparent' : sideColor,
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
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 'bold',
                          fontSize: 'var(--fs-caption)'
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
                          borderWidth: isSelected ? '0' : '2px',
                          borderStyle: isSelected ? 'none' : 'solid',
                          borderColor: isSelected ? 'transparent' : `${sideColor}30`,
                          borderRadius: '50%',
                          backgroundColor: isSelected ? sideColor : 'white',
                          color: isSelected ? 'white' : sideColor,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--fs-title)',
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
      {/* Sélecteurs par côté (liste unique) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Côté départ */}
        <SideSelector
          title="🔴 Départ"
          airports={candidatesBySide.departure}
          selectedAirport={selectedDeparture}
          onSelect={handleSelect}
          side="departure"
          referencePoint={searchZone.departure}
          sideColor="var(--color-red-critical)"
        />

        {/* Côté arrivée */}
        <SideSelector
          title="🟢 Arrivée"
          airports={candidatesBySide.arrival}
          selectedAirport={selectedArrival}
          onSelect={handleSelect}
          side="arrival"
          referencePoint={searchZone.arrival}
          sideColor="var(--text-primary)"
        />
      </div>
    </div>
  );
});

// Fonction pour obtenir la couleur selon le score
const getScoreColor = (score) => {
  if (!score) return 'var(--text-secondary)';
  if (score >= 0.8) return 'var(--text-primary)';
  if (score >= 0.6) return 'var(--accent-primary)';
  return 'var(--color-red-critical)';
};

AlternateSelectorDual.displayName = 'AlternateSelectorDual';