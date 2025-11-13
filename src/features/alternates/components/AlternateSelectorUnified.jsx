// src/features/alternates/components/AlternateSelectorUnified.jsx
import React, { memo, useMemo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { calculateDistance } from '@utils/navigationCalculations';
import { DataSourceBadge } from '@shared/components';

/**
 * Composant de sélection unifiée des aérodromes de déroutement
 * Liste unique fusionnée avec badges côté départ/arrivée
 */
export const AlternateSelectorUnified = memo(({
  candidates = [],
  searchZone,
  onSelectionChange,
  currentSelection = { departure: null, arrival: null }
}) => {

  const selectedDeparture = currentSelection.departure;
  const selectedArrival = currentSelection.arrival;

  // Fusionner et enrichir tous les candidats
  const unifiedCandidates = useMemo(() => {
    const enriched = [];

    candidates.forEach(airport => {
      // Filtrer les aéroports sans code ICAO ou avec code ICAO invalide (ex: LF01)
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
      enriched.push({
        ...airport,
        position: position,
        distanceToDeparture: distToDeparture,
        distanceToArrival: distToArrival,
        side: airport.side || (distToDeparture < distToArrival ? 'departure' : 'arrival'),
        isControlled: isControlled
      });
    });

    // Trier par score décroissant (meilleurs en premier)
    enriched.sort((a, b) => (b.score || 0) - (a.score || 0));

    return enriched;
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

  const [hoveredIcao, setHoveredIcao] = React.useState(null);
  const [openMenuIcao, setOpenMenuIcao] = React.useState(null);

  // Fonction helper pour obtenir la longueur maximale de piste
  const getMaxRunwayLength = (runways) => {
    if (!runways || runways.length === 0) return null;

    let maxLength = 0;

    runways.forEach(runway => {
      // Essayer runway.length d'abord
      if (runway.length && runway.length > 0) {
        maxLength = Math.max(maxLength, runway.length);
      }

      // Si length = 0, chercher dans TORA (distances déclarées)
      if (runway.tora && runway.tora > 0) {
        maxLength = Math.max(maxLength, runway.tora);
      }

      // Chercher aussi dans distancesByDirection
      if (runway.distancesByDirection) {
        Object.values(runway.distancesByDirection).forEach(dir => {
          if (dir.tora && dir.tora > 0) {
            maxLength = Math.max(maxLength, dir.tora);
          }
        });
      }
    });

    return maxLength > 0 ? maxLength : null;
  };

  // Fermer le menu si on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuIcao) {
        setOpenMenuIcao(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuIcao]);

  return (
    <div style={sx.components.card.base}>
      <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
        Aérodromes disponibles ({unifiedCandidates.length})
      </h5>

      {unifiedCandidates.length === 0 ? (
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
          Aucun aérodrome trouvé dans la zone de recherche
        </p>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {unifiedCandidates.map((airport, index) => {
            const isSelectedDeparture = selectedDeparture?.icao === airport.icao;
            const isSelectedArrival = selectedArrival?.icao === airport.icao;
            const isHovered = hoveredIcao === airport.icao;

            // Déterminer le côté pour l'affichage (badge suggéré)
            const side = airport.side;
            const sideColor = side === 'departure' ? '#dc2626' : '#059669';
            const sideEmoji = side === 'departure' ? '🔴' : '🟢';
            const sideLabel = side === 'departure' ? 'Départ' : 'Arrivée';

            // Déterminer la couleur selon la sélection RÉELLE (pas le côté suggéré)
            const selectionColor = isSelectedDeparture ? '#dc2626' : (isSelectedArrival ? '#059669' : sideColor);
            const selectionBgColor = isSelectedDeparture ? '#fef2f2' : (isSelectedArrival ? '#f0fdf4' : '#ffffff');

            const distanceFromRef = side === 'departure'
              ? airport.distanceToDeparture
              : airport.distanceToArrival;

            return (
              <div
                key={airport.icao}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: (isSelectedDeparture || isSelectedArrival) ? selectionColor : (isHovered ? `${sideColor}60` : '#e5e7eb'),
                  borderRadius: '8px',
                  backgroundColor: (isSelectedDeparture || isSelectedArrival) ? selectionBgColor : (isHovered ? '#fafafa' : '#ffffff'),
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  transform: isHovered && !isSelectedDeparture && !isSelectedArrival ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: isHovered && !isSelectedDeparture && !isSelectedArrival ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
                onMouseEnter={() => setHoveredIcao(airport.icao)}
                onMouseLeave={() => setHoveredIcao(null)}
              >
                {/* Indicateur visuel de sélection */}
                {(isSelectedDeparture || isSelectedArrival) && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: selectionColor,
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
                    {/* En-tête avec ICAO et badge côté */}
                    <div style={sx.combine(sx.flex.start, sx.spacing.mb(1))}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: (isSelectedDeparture || isSelectedArrival) ? sideColor : `${sideColor}20`,
                        color: (isSelectedDeparture || isSelectedArrival) ? 'white' : sideColor,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginRight: '8px',
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>

                      <strong style={sx.text.base}>{airport.icao}</strong>

                      {/* Badge côté */}
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        backgroundColor: `${sideColor}15`,
                        color: sideColor,
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {sideEmoji} {sideLabel}
                      </span>

                      {airport.dataSource && airport.dataSource !== 'static' && (
                        <DataSourceBadge
                          source={airport.dataSource}
                          size="xs"
                          showLabel={false}
                          inline={true}
                          style={{ marginLeft: '8px' }}
                        />
                      )}
                    </div>

                    {/* Nom */}
                    <div style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
                      {airport.name}
                    </div>

                    {/* Distances */}
                    <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                      <span style={sx.spacing.mr(3)}>
                        <MapPin size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        {distanceFromRef.toFixed(1)} NM depuis {side === 'departure' ? 'départ' : 'arrivée'}
                      </span>
                      <span>
                        <Navigation size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        {airport.distance.toFixed(1)} NM route
                      </span>
                    </div>

                    {/* Infos piste et services */}
                    <div style={sx.combine(sx.text.xs, sx.flex.start)}>
                      <span style={sx.spacing.mr(2)}>
                        🛬 {(() => {
                          const maxLength = getMaxRunwayLength(airport.runways);
                          return maxLength ? `${maxLength}m` : 'Piste N/A';
                        })()}
                      </span>
                      {airport.services?.fuel && <span style={sx.spacing.mr(2)}>⛽</span>}
                      {airport.services?.atc && <span style={sx.spacing.mr(2)}>🗼</span>}
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: getScoreColor(airport.score) + '20',
                        color: getScoreColor(airport.score),
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '11px'
                      }}>
                        Score: {((airport.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Bouton de sélection avec menu */}
                  <div style={{ position: 'relative', marginLeft: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIcao(openMenuIcao === airport.icao ? null : airport.icao);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: (isSelectedDeparture || isSelectedArrival) ? (isSelectedDeparture ? '#dc2626' : '#059669') : '#3b82f6',
                        borderRadius: '6px',
                        backgroundColor: (isSelectedDeparture || isSelectedArrival) ? (isSelectedDeparture ? '#dc2626' : '#059669') : '#ffffff',
                        color: (isSelectedDeparture || isSelectedArrival) ? '#ffffff' : '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '120px',
                        justifyContent: 'center'
                      }}
                    >
                      {isSelectedDeparture ? (
                        <>✓ 🔴 Départ</>
                      ) : isSelectedArrival ? (
                        <>✓ 🟢 Arrivée</>
                      ) : (
                        <>+ Sélectionner</>
                      )}
                    </button>

                    {/* Menu dropdown */}
                    {openMenuIcao === airport.icao && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: '#ffffff',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: '#e5e7eb',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '180px',
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(airport, 'departure');
                            setOpenMenuIcao(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            backgroundColor: isSelectedDeparture ? '#fef2f2' : '#ffffff',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isSelectedDeparture ? 'bold' : 'normal',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#fef2f2'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = isSelectedDeparture ? '#fef2f2' : '#ffffff'}
                        >
                          {isSelectedDeparture ? '✓' : ''} 🔴 Déroutement départ
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(airport, 'arrival');
                            setOpenMenuIcao(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            backgroundColor: isSelectedArrival ? '#f0fdf4' : '#ffffff',
                            color: '#059669',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isSelectedArrival ? 'bold' : 'normal',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f0fdf4'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = isSelectedArrival ? '#f0fdf4' : '#ffffff'}
                        >
                          {isSelectedArrival ? '✓' : ''} 🟢 Déroutement arrivée
                        </button>
                      </div>
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
});

// Fonction pour obtenir la couleur selon le score
const getScoreColor = (score) => {
  if (!score) return '#6b7280';
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
};

AlternateSelectorUnified.displayName = 'AlternateSelectorUnified';
