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
  currentSelection = { departure: null, arrival: null },
  filters = {}
}) => {

  const selectedDeparture = currentSelection.departure;
  const selectedArrival = currentSelection.arrival;

  // Fonction helper pour obtenir la longueur maximale de piste (déplacé ici pour être utilisé par passesFilters)
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

  // Fonction pour vérifier si un aérodrome passe les filtres
  const passesFilters = (airport) => {
    // Filtre piste minimale
    if (filters.minRunwayLength) {
      const maxLength = getMaxRunwayLength(airport.runways);
      if (maxLength && maxLength < filters.minRunwayLength) {
        return false;
      }
    }

    // Filtre revêtement
    if (filters.compatibleSurfaces && airport.runways) {
      const hasSompatibleSurface = airport.runways.some(runway => {
        const surface = (runway.surface || runway.surfaceType || '').toLowerCase();
        // Normaliser les noms de surface
        const normalizedSurface = surface
          .replace('asphalte', 'asphalt')
          .replace('béton', 'concrete')
          .replace('bitume', 'bituminous')
          .replace('gazon', 'grass')
          .replace('herbe', 'grass')
          .replace('terre', 'soil')
          .replace('gravier', 'gravel');

        return filters.compatibleSurfaces.some(cs =>
          normalizedSurface.includes(cs.toLowerCase()) ||
          cs.toLowerCase().includes(normalizedSurface)
        );
      });
      if (!hasSompatibleSurface && airport.runways.length > 0) {
        return false;
      }
    }

    // Filtre type d'aérodrome
    if (filters.aircraftType) {
      const airportType = (airport.type || '').toLowerCase();
      const aircraftType = filters.aircraftType;

      // Si l'avion est un avion normal, exclure les héliports et terrains ULM
      if (aircraftType === 'airplane') {
        if (airportType.includes('heliport') || airportType.includes('heli')) {
          return false;
        }
        // Exclure les terrains spécifiquement ULM sauf si c'est aussi un aérodrome
        if (airportType === 'ulm' || airportType === 'ultralight_field') {
          return false;
        }
      }

      // Si l'avion est un hélicoptère, il peut aller sur les héliports et aérodromes
      // Pas de restriction spécifique

      // Si l'avion est un ULM, il peut aller partout
      // Pas de restriction spécifique
    }

    return true;
  };

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
      const enrichedAirport = {
        ...airport,
        position: position,
        distanceToDeparture: distToDeparture,
        distanceToArrival: distToArrival,
        side: airport.side || (distToDeparture < distToArrival ? 'departure' : 'arrival'),
        isControlled: isControlled
      };

      // Vérifier si l'aérodrome passe les filtres
      enrichedAirport.passesFilters = passesFilters(enrichedAirport);

      enriched.push(enrichedAirport);
    });

    // Trier par score décroissant (meilleurs en premier)
    // Les aérodromes filtrés sont mis à la fin
    enriched.sort((a, b) => {
      // D'abord, les non-filtrés avant les filtrés
      if (a.passesFilters && !b.passesFilters) return -1;
      if (!a.passesFilters && b.passesFilters) return 1;
      // Ensuite, par score
      return (b.score || 0) - (a.score || 0);
    });

    return enriched;
  }, [candidates, searchZone, filters]);

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
            const isFiltered = !airport.passesFilters;

            // Déterminer le côté pour l'affichage (badge suggéré)
            const side = airport.side;
            const sideColor = side === 'departure' ? '#C04534' : 'var(--text-primary)';
            const sideEmoji = side === 'departure' ? '🔴' : '🟢';
            const sideLabel = side === 'departure' ? 'Départ' : 'Arrivée';

            // Déterminer la couleur selon la sélection RÉELLE (pas le côté suggéré)
            const selectionColor = isSelectedDeparture ? '#C04534' : (isSelectedArrival ? 'var(--text-primary)' : sideColor);
            const selectionBgColor = isSelectedDeparture ? 'var(--bg-overlay)' : (isSelectedArrival ? 'var(--bg-overlay)' : '#ffffff');

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
                  borderStyle: isFiltered ? 'dashed' : 'solid',
                  borderColor: isFiltered ? 'var(--text-tertiary)' : ((isSelectedDeparture || isSelectedArrival) ? selectionColor : (isHovered ? `${sideColor}60` : 'var(--border-subtle)')),
                  borderRadius: '8px',
                  backgroundColor: isFiltered ? 'var(--bg-overlay)' : ((isSelectedDeparture || isSelectedArrival) ? selectionBgColor : (isHovered ? 'var(--bg-overlay)' : '#ffffff')),
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  transform: isHovered && !isSelectedDeparture && !isSelectedArrival ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: isHovered && !isSelectedDeparture && !isSelectedArrival && !isFiltered ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  opacity: isFiltered ? 0.6 : 1
                }}
                onMouseEnter={() => setHoveredIcao(airport.icao)}
                onMouseLeave={() => setHoveredIcao(null)}
              >
                {/* Badge "Filtré" */}
                {isFiltered && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: 'var(--text-tertiary)',
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    borderBottomRightRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}>
                    FILTRÉ
                  </div>
                )}

                {/* Indicateur visuel de sélection */}
                {(isSelectedDeparture || isSelectedArrival) && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: selectionColor,
                    color: 'var(--text-primary)',
                    padding: '4px 12px',
                    borderBottomLeftRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    ✓ SÉLECTIONNÉ
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Contenu principal */}
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
                        borderRadius: '8px',
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
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '11px'
                      }}>
                        Score: {((airport.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Bouton de sélection en bas */}
                  <div style={{ position: 'relative', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIcao(openMenuIcao === airport.icao ? null : airport.icao);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: (isSelectedDeparture || isSelectedArrival) ? (isSelectedDeparture ? '#C04534' : 'var(--text-primary)') : 'var(--text-secondary)',
                        borderRadius: '8px',
                        backgroundColor: (isSelectedDeparture || isSelectedArrival) ? (isSelectedDeparture ? '#C04534' : 'var(--text-primary)') : '#ffffff',
                        color: (isSelectedDeparture || isSelectedArrival) ? '#ffffff' : 'var(--text-secondary)',
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
                        backgroundColor: 'var(--bg-overlay)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: 'var(--border-subtle)',
                        borderRadius: '8px',
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
                            backgroundColor: isSelectedDeparture ? 'var(--bg-overlay)' : '#ffffff',
                            color: '#C04534',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isSelectedDeparture ? 'bold' : 'normal',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-overlay)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = isSelectedDeparture ? 'var(--bg-overlay)' : '#ffffff'}
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
                            backgroundColor: isSelectedArrival ? 'var(--bg-overlay)' : '#ffffff',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isSelectedArrival ? 'bold' : 'normal',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-overlay)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = isSelectedArrival ? 'var(--bg-overlay)' : '#ffffff'}
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
  if (!score) return 'var(--text-secondary)';
  if (score >= 0.8) return 'var(--text-primary)';
  if (score >= 0.6) return 'var(--accent-primary)';
  return '#C04534';
};

AlternateSelectorUnified.displayName = 'AlternateSelectorUnified';
