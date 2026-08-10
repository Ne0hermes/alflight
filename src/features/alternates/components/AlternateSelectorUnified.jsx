// src/features/alternates/components/AlternateSelectorUnified.jsx
// 🔧 LOT 7 — Sélection SIMPLE des déroutements : plus de choix départ/arrivée
// (demande pilote). Un bouton unique Sélectionner/Désélectionner par aérodrome,
// plusieurs déroutements possibles. La liste est triée par pertinence (score),
// la distance affichée est la distance à la ROUTE (corridor).
import React, { memo, useMemo } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { calculateDistance } from '@utils/navigationCalculations';
import { DataSourceBadge } from '@shared/components';

export const AlternateSelectorUnified = memo(({
  candidates = [],
  searchZone,
  onSelectionChange,
  selection = [],
  filters = {}
}) => {

  const selectedIcaos = useMemo(
    () => new Set((selection || []).map(alt => alt?.icao).filter(Boolean)),
    [selection]
  );

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
        if (airportType === 'ulm' || airportType === 'ultralight_field') {
          return false;
        }
      }
    }

    return true;
  };

  // Enrichir tous les candidats (distances, contrôle, filtres)
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

      // Distances depuis départ et arrivée (information secondaire)
      const distToDeparture = searchZone?.departure ? calculateDistance(position, searchZone.departure) : null;
      const distToArrival = searchZone?.arrival ? calculateDistance(position, searchZone.arrival) : null;

      // Déterminer si l'aérodrome est contrôlé
      const isControlled = airport.services?.atc === true ||
                          (airport.frequencies && airport.frequencies.some(f => f.type === 'TWR')) ||
                          airport.type === 'large_airport' ||
                          airport.type === 'medium_airport';

      const enrichedAirport = {
        ...airport,
        position: position,
        distanceToDeparture: distToDeparture,
        distanceToArrival: distToArrival,
        isControlled: isControlled
      };

      enrichedAirport.passesFilters = passesFilters(enrichedAirport);

      enriched.push(enrichedAirport);
    });

    // Trier par score décroissant (meilleurs en premier), filtrés à la fin
    enriched.sort((a, b) => {
      if (a.passesFilters && !b.passesFilters) return -1;
      if (!a.passesFilters && b.passesFilters) return 1;
      return (b.score || 0) - (a.score || 0);
    });

    return enriched;
  }, [candidates, searchZone, filters]);

  // Sélection SIMPLE : ajoute/retire l'aérodrome de la liste
  const handleToggle = (airport) => {
    if (!onSelectionChange) return;
    const isSelected = selectedIcaos.has(airport.icao);
    const next = isSelected
      ? (selection || []).filter(alt => alt.icao !== airport.icao)
      : [...(selection || []), airport];
    onSelectionChange(next);
  };

  const [hoveredIcao, setHoveredIcao] = React.useState(null);

  return (
    <div style={sx.components.card.base}>
      {unifiedCandidates.length === 0 ? (
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
          Aucun aérodrome trouvé dans le corridor de recherche
        </p>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {unifiedCandidates.map((airport, index) => {
            const isSelected = selectedIcaos.has(airport.icao);
            const isHovered = hoveredIcao === airport.icao;
            const isFiltered = !airport.passesFilters;
            const accent = 'var(--accent-primary)';

            return (
              <div
                key={airport.icao}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderWidth: '2px',
                  borderStyle: isFiltered ? 'dashed' : 'solid',
                  borderColor: isFiltered ? 'var(--text-tertiary)' : (isSelected ? accent : (isHovered ? `${'#f26921'}60` : 'var(--border-subtle)')),
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isFiltered ? 'var(--bg-overlay)' : (isSelected ? 'var(--bg-overlay)' : (isHovered ? 'var(--bg-overlay)' : 'var(--bg-surface)')),
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  transform: isHovered && !isSelected ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: isHovered && !isSelected && !isFiltered ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
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
                    fontSize: 'var(--fs-caption)',
                    fontWeight: '600'
                  }}>
                    FILTRÉ
                  </div>
                )}

                {/* Indicateur visuel de sélection */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: accent,
                    color: '#ffffff',
                    padding: '4px 12px',
                    borderBottomLeftRadius: '8px',
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 'bold'
                  }}>
                    ✓ SÉLECTIONNÉ
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Contenu principal */}
                  <div style={{ flex: 1 }}>
                    {/* En-tête avec rang et ICAO */}
                    <div style={sx.combine(sx.flex.start, sx.spacing.mb(1))}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? accent : `${'#f26921'}20`,
                        color: isSelected ? '#ffffff' : accent,
                        fontSize: 'var(--fs-body)',
                        fontWeight: 'bold',
                        marginRight: '8px',
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>

                      <strong style={sx.text.base}>{airport.icao}</strong>

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

                    {/* Distances : à la ROUTE d'abord (corridor), puis dép./arr. */}
                    <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                      <span style={sx.spacing.mr(3)}>
                        <Navigation size={10} style={{ display: 'inline', marginRight: '2px' }} />
                        {(airport.distance ?? 0).toFixed(1)} NM de la route
                      </span>
                      {airport.distanceToDeparture != null && (
                        <span style={sx.spacing.mr(3)}>
                          <MapPin size={10} style={{ display: 'inline', marginRight: '2px' }} />
                          {airport.distanceToDeparture.toFixed(1)} NM du départ
                        </span>
                      )}
                      {airport.distanceToArrival != null && (
                        <span>
                          <MapPin size={10} style={{ display: 'inline', marginRight: '2px' }} />
                          {airport.distanceToArrival.toFixed(1)} NM de l'arrivée
                        </span>
                      )}
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
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 'bold',
                        fontSize: 'var(--fs-caption)'
                      }}>
                        Score: {((airport.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Bouton de sélection unique (plus de menu départ/arrivée) */}
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(airport);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderColor: isSelected ? accent : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? accent : 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 'var(--fs-body)',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '150px',
                        justifyContent: 'center'
                      }}
                    >
                      {isSelected ? '✓ Sélectionné' : '+ Sélectionner'}
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
});

// Fonction pour obtenir la couleur selon le score
const getScoreColor = (score) => {
  if (!score) return 'var(--text-secondary)';
  if (score >= 0.8) return 'var(--text-primary)';
  if (score >= 0.6) return 'var(--accent-primary)';
  return 'var(--color-red-critical)';
};

AlternateSelectorUnified.displayName = 'AlternateSelectorUnified';
