import React, { memo, useState, useEffect, useMemo } from 'react';
import { Trash2, Navigation2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import { useAircraft, useNavigation } from '@core/contexts';
import { SimpleAirportSelector as AirportSelector } from './SimpleAirportSelector';
import { VFRPointInserter } from './VFRPointInserter';
import { coordinateConversions } from '@utils/unitConversions';
import { usePerformanceCalculations } from '@shared/hooks/usePerformanceCalculations';

// Composant pour une carte de waypoint avec analyse des pistes intégrée
export const WaypointCardWithRunways = memo(({
  waypoint,
  linkedVfrPoints = [], // Points VFR associés à cet aérodrome
  index,
  totalWaypoints,
  onSelect,
  onRemove,
  onShowReportingPoints,
  onInsertWaypoint,
  allWaypoints,
  segmentAltitude, // Altitude du segment précédent pour le calcul TOD
  onRemoveVfrPoint, // Fonction pour supprimer un point VFR
  onMoveUp, // Fonction pour déplacer vers le haut (passée par le parent)
  onMoveDown // Fonction pour déplacer vers le bas (passée par le parent)
}) => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, updateWaypoint, segmentAltitudes } = useNavigation();
  const { calculateCorrectedDistances } = usePerformanceCalculations();
  const [airport, setAirport] = useState(null);
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [vacData, setVacData] = useState(null);

  const isFirst = index === 0;
  const isLast = index === totalWaypoints - 1;
  const canDelete = totalWaypoints > 2;

  const getLabel = () => {
    if (isFirst) return { text: 'Départ', color: 'var(--text-primary)' };
    if (isLast) return { text: 'Arrivée', color: 'var(--accent-primary)' };
    return { text: `Étape ${index}`, color: 'var(--text-secondary)' };
  };

  const label = getLabel();

  // Charger les données VAC de l'aérodrome quand le waypoint change
  useEffect(() => {
    const loadAirportData = async () => {
      if (!waypoint.name || !waypoint.name.match(/^[A-Z]{4}$/)) {
        setAirport(null);
        setRunways([]);
        setVacData(null);
        return;
      }

      setLoading(true);
      // Réinitialiser les états avant de charger de nouvelles données
      setVacData(null);
      setRunways([]);
      setAirport(null);

      try {
        let dataLoaded = false;

        // Priorité aux données VAC
        if (window.vacStore) {
          const vacChart = window.vacStore.getState().getChartByIcao(waypoint.name);
          if (vacChart && vacChart.extractedData) {
            setVacData(vacChart.extractedData);
            // Utiliser les pistes depuis VAC si disponibles
            if (vacChart.extractedData.runways) {
              setRunways(vacChart.extractedData.runways);
              dataLoaded = true;
            }
          }
        }

        // Fallback sur les données statiques si pas de VAC
        if (!dataLoaded) {
          const airports = await aeroDataProvider.getAirfields({ country: 'FR' });
          const airportData = airports.find(a => a.icao === waypoint.name || a.icaoCode === waypoint.name);

          if (airportData) {
            setAirport(airportData);
            setRunways(airportData.runways || []);
          }
        }
      } catch (error) {
        console.error('Erreur chargement aérodrome:', error);
        setAirport(null);
        setRunways([]);
      } finally {
        setLoading(false);
      }
    };

    loadAirportData();
  }, [waypoint.name]);

  const goToVACModule = () => {
    if (window.setActiveTab) {
      window.setActiveTab('vac');
    }
  };

  // Analyser la compatibilité des pistes
  const getRunwayCompatibility = () => {
    if (!selectedAircraft || !runways.length) return null;

    // TODO: Permettre à l'utilisateur de configurer :
    // - Température actuelle (pour l'instant on utilise ISA)
    // - Poids de l'avion (pour l'instant on utilise la config de base)

    // Calculer les distances requises en fonction de l'altitude de l'aérodrome
    const airportAltitude = waypoint.elevation || vacData?.elevation || 0;
    let requiredDistances = null;

    // Si l'avion a des performances définies, calculer dynamiquement
    if (selectedAircraft.performances?.takeoffDistance) {
      // Température ISA à l'altitude de l'aérodrome
      const isaTemp = 15 - (airportAltitude * 0.002);

      // Calculer les distances corrigées
      requiredDistances = calculateCorrectedDistances(airportAltitude, isaTemp, null);

      console.log('🎯 Distances calculées dynamiquement:', {
        airportAltitude,
        isaTemp,
        requiredDistances
      });
    }
    // Sinon, utiliser les valeurs statiques depuis distances (legacy)
    else if (selectedAircraft.distances) {
      requiredDistances = {
        takeoffDistance: selectedAircraft.distances.takeoffDistance50ft || selectedAircraft.distances.takeoffDistance15m,
        landingDistance: selectedAircraft.distances.landingDistance50ft || selectedAircraft.distances.landingDistance15m
      };

      console.log('⚠️ Utilisation distances statiques (legacy):', requiredDistances);
    }

    // Si aucune donnée de performance n'est disponible, aucune piste n'est compatible
    if (!requiredDistances) {
      console.log('❌ Aucune donnée de performance disponible');
      return { compatible: 0, total: runways.length };
    }

    const compatibleCount = runways.filter(runway => {
      // Vérifier la surface si l'avion a des restrictions définies
      const aircraftSurfaces = selectedAircraft.compatibleRunwaySurfaces || [];
      const surfaceType = runway.surface?.type || runway.surface || '';

      // Si l'avion a des restrictions de surface, vérifier la compatibilité
      if (aircraftSurfaces.length > 0) {
        const surfaceCompatible = aircraftSurfaces.includes(surfaceType);
        if (!surfaceCompatible) {
          console.log(`❌ Surface ${surfaceType} non compatible avec ${aircraftSurfaces.join(', ')}`);
          return false;
        }
      }

      const todaFeet = Math.round((runway.dimensions?.toda || runway.dimensions?.length || 0) * 3.28084);
      const ldaFeet = Math.round((runway.dimensions?.lda || runway.dimensions?.length || 0) * 3.28084);

      return todaFeet >= requiredDistances.takeoffDistance &&
        ldaFeet >= requiredDistances.landingDistance;
    }).length;

    return { compatible: compatibleCount, total: runways.length };
  };

  // Séparer les pistes en directions individuelles (numéro de piste + QFU)
  const separateRunwayDirections = () => {
    const directions = [];

    runways.forEach(runway => {
      // Extraire les deux directions de la désignation (ex: "05/23" -> ["05", "23"])
      let designator = runway.designator || runway.designation || '';

      // Debug: afficher les données de piste disponibles
      console.log('🛬 Runway data:', {
        designator,
        orientation: runway.orientation,
        trueBearing: runway.trueBearing,
        magneticBearing: runway.magneticBearing,
        tora: runway.tora,
        toda: runway.toda,
        asda: runway.asda,
        lda: runway.lda,
        distancesByDirection: runway.distancesByDirection
      });

      // Orientation géographique vraie (QFU) depuis AIXM
      const baseOrientation = runway.orientation || runway.bearing || runway.trueBearing || null;

      if (designator.includes('/')) {
        const [rwy1, rwy2] = designator.split('/');

        // Récupérer les distances pour chaque direction
        const dir1Distances = runway.distancesByDirection?.[rwy1.trim()] || {};
        const dir2Distances = runway.distancesByDirection?.[rwy2.trim()] || {};

        // Direction 1 (ex: Piste 05)
        directions.push({
          ...runway,
          runwayNumber: rwy1.trim(),
          designator: rwy1.trim(),
          qfu: baseOrientation, // QFU pour la première direction
          oppositeRunway: rwy2.trim(),
          // Distances spécifiques à cette direction
          tora: dir1Distances.tora,
          toda: dir1Distances.toda,
          asda: dir1Distances.asda,
          lda: dir1Distances.lda
        });

        // Direction 2 (ex: Piste 23) - QFU opposé (+180°)
        const oppositeQfu = baseOrientation !== null
          ? (baseOrientation + 180) % 360
          : null;

        directions.push({
          ...runway,
          runwayNumber: rwy2.trim(),
          designator: rwy2.trim(),
          qfu: oppositeQfu, // QFU opposé
          oppositeRunway: rwy1.trim(),
          // Distances spécifiques à cette direction
          tora: dir2Distances.tora,
          toda: dir2Distances.toda,
          asda: dir2Distances.asda,
          lda: dir2Distances.lda
        });
      } else {
        // Piste avec une seule direction
        directions.push({
          ...runway,
          runwayNumber: designator,
          qfu: baseOrientation,
          oppositeRunway: null
        });
      }
    });

    return directions;
  };

  const compatibility = getRunwayCompatibility();
  const runwayDirections = separateRunwayDirections();

  return (
    <div style={sx.combine(
      sx.components.card.base,
      { borderColor: label.color, borderWidth: '2px' }
    )}>

      {/* Label Aérodrome + info départ/arrivée sur la même ligne */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Aérodrome</span>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: label.color,
          backgroundColor: label.color + '20',
          padding: '4px 12px',
          borderRadius: '8px'
        }}>
          {label.text}
        </span>
      </div>

      {/* Sélecteur d'aérodrome - pleine largeur */}
      <div style={{ marginBottom: '12px' }}>
        <AirportSelector
          value={waypoint.name ? {
            icao: waypoint.name,
            name: waypoint.airportName || waypoint.name,
            coordinates: { lat: waypoint.lat, lon: waypoint.lon },
            city: waypoint.city,
            elevation: waypoint.elevation
          } : null}
          onChange={onSelect}
          placeholder="Code OACI ou nom..."
        />
      </div>

      {/* Informations compactes - pleine largeur */}
      {waypoint.lat && waypoint.lon && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={sx.combine(
              sx.components.input.base,
              sx.text.xs,
              {
                width: '100%',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: showDetails ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 12px'
              }
            )}
          >
            <div style={{ display: 'flex', gap: '12px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Compatibilité des pistes */}
              {runways.length > 0 && compatibility && selectedAircraft && (
                <div style={sx.combine(
                  { minWidth: '140px', fontWeight: '600' },
                  compatibility.compatible > 0 ? sx.text.success : sx.text.danger
                )}>
                  ✈️ {compatibility.compatible}/{compatibility.total} compatible{compatibility.compatible > 1 ? 's' : ''}
                </div>
              )}

              {/* Altitude - toujours affichée */}
              {(waypoint.elevation || vacData?.elevation) && (
                <div style={{ minWidth: '70px' }}>
                  ⛰️ {vacData?.elevation || waypoint.elevation} ft
                </div>
              )}

              {/* Coordonnées - toujours affichées */}
              <div style={{ minWidth: '110px' }}>
                📍 {waypoint.lat.toFixed(2)}°, {waypoint.lon.toFixed(2)}°
              </div>
            </div>
            {/* Chevron */}
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
        </div>
      )}

      {/* Section détails étendue */}
      {waypoint.lat && waypoint.lon && showDetails && (
        <div style={sx.combine(sx.spacing.mt(3), sx.spacing.p(3), sx.bg.gray, sx.rounded.md)}>
          {/* Indicateur VAC si données disponibles */}
          {vacData && (
            <div style={sx.combine(
              sx.text.xs,
              sx.spacing.mb(3),
              sx.spacing.p(2),
              sx.rounded.sm,
              {
                background: 'var(--bg-overlay)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)'
              }
            )}>
              ✅ Données issues de la carte VAC officielle
            </div>
          )}

          {/* Coordonnées détaillées */}
          <div style={sx.spacing.mb(3)}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              📍 Coordonnées complètes
            </h5>
            <div style={sx.text.sm}>
              {waypoint.lat.toFixed(4)}°, {waypoint.lon.toFixed(4)}°
            </div>
            <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              {coordinateConversions.coordinatesToDMS(waypoint.lat, waypoint.lon).formatted}
            </div>
          </div>

          {/* Altitude détaillée */}
          {(waypoint.elevation || vacData?.elevation) && (
            <div style={sx.spacing.mb(3)}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                ⛰️ Altitude terrain
              </h5>
              <div style={sx.text.sm}>
                {vacData?.elevation || waypoint.elevation} ft
              </div>
            </div>
          )}

          {/* Pistes détaillées */}
          {runways.length > 0 && (
            <div>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                ✈️ Détails des pistes (par direction)
              </h5>
              <div style={sx.spacing.mb(2)}>
                {runwayDirections.map((runway, idx) => {
                  // Calcul des distances disponibles
                  const todaFeet = Math.round((runway.dimensions?.toda || runway.dimensions?.length || 0) * 3.28084);
                  const ldaFeet = Math.round((runway.dimensions?.lda || runway.dimensions?.length || 0) * 3.28084);

                  // Surfaces compatibles de l'avion
                  const aircraftSurfaces = selectedAircraft?.compatibleRunwaySurfaces || [];
                  const surfaceType = runway.surface?.type || runway.surface || 'Non spécifiée';

                  // Si aircraftSurfaces est vide, toutes surfaces sont considérées compatibles (pas de restriction)
                  // Sinon, vérifier que la surface est dans la liste
                  const surfaceCompatible = aircraftSurfaces.length === 0 || aircraftSurfaces.includes(surfaceType);

                  // Calculer les distances requises (même logique que getRunwayCompatibility)
                  const airportAltitude = waypoint.elevation || vacData?.elevation || 0;
                  let requiredDistances = null;

                  if (selectedAircraft?.performances?.takeoffDistance) {
                    const isaTemp = 15 - (airportAltitude * 0.002);
                    requiredDistances = calculateCorrectedDistances(airportAltitude, isaTemp, null);
                  } else if (selectedAircraft?.distances) {
                    requiredDistances = {
                      takeoffDistance: selectedAircraft.distances.takeoffDistance50ft || selectedAircraft.distances.takeoffDistance15m,
                      landingDistance: selectedAircraft.distances.landingDistance50ft || selectedAircraft.distances.landingDistance15m
                    };
                  }

                  // Compatibilité des distances
                  const isCompatible = selectedAircraft && requiredDistances &&
                    todaFeet >= requiredDistances.takeoffDistance &&
                    ldaFeet >= requiredDistances.landingDistance;

                  // Numéro de piste et QFU (orientation vraie)
                  const runwayNumber = runway.runwayNumber || 'XX';
                  const qfu = runway.qfu !== null && runway.qfu !== undefined
                    ? Math.round(runway.qfu)
                    : null;

                  // Longueur de la piste
                  const lengthM = runway.dimensions?.length || 0;
                  const lengthFt = Math.round(lengthM * 3.28084);

                  // Largeur de la piste
                  const widthM = runway.dimensions?.width || runway.width || 0;

                  // Orientation géographique
                  const orientation = runway.orientation || runway.bearing || runway.trueBearing || '';

                  // LDA (Landing Distance Available)
                  const ldaM = runway.dimensions?.lda || runway.lda || 0;

                  // Piste principale
                  const isPrimary = runway.isPrimary || runway.primary || false;

                  return (
                    <div key={idx} style={sx.combine(
                      sx.text.xs,
                      sx.spacing.p(2),
                      sx.spacing.mb(1),
                      sx.rounded.sm,
                      {
                        background: 'var(--bg-overlay)',
                        borderLeft: `3px solid var(--text-secondary)`
                      }
                    )}>
                      {/* Ligne 1: Piste, QFU et Orientation */}
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Piste {runwayNumber}</strong>
                        {isPrimary && (
                          <span style={{
                            marginLeft: '6px',
                            padding: '2px 6px',
                            backgroundColor: 'var(--text-secondary)',
                            color: 'var(--text-primary)',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            PRINCIPALE
                          </span>
                        )}
                        {qfu !== null && (
                          <span style={sx.text.secondary}>
                            {' '}• QFU {Math.round(qfu)}°
                          </span>
                        )}
                        {orientation && (
                          <span style={sx.text.secondary}>
                            {' '}• Orientation: {orientation}°
                          </span>
                        )}
                      </div>

                      {/* Ligne 2: Longueur et Largeur */}
                      <div style={{ marginBottom: '4px' }}>
                        <span style={sx.text.secondary}>
                          Longueur: {lengthFt} ft ({lengthM} m)
                        </span>
                        {widthM > 0 && (
                          <span style={sx.text.secondary}>
                            {' '}• Largeur: {widthM} m
                          </span>
                        )}
                      </div>

                      {/* Ligne 3: Revêtement + Compatibilité */}
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={sx.text.secondary}>Revêtement: {surfaceType}</span>
                        {selectedAircraft && selectedAircraft.distances && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            ...(isCompatible && surfaceCompatible ? {
                              backgroundColor: 'var(--bg-overlay)',
                              color: 'var(--text-primary)'
                            } : {
                              backgroundColor: 'var(--bg-overlay)',
                              color: '#C04534'
                            })
                          }}>
                            {isCompatible && surfaceCompatible ? '✓ Compatible' : '✗ Incompatible'}
                          </span>
                        )}
                      </div>

                      {/* Distances déclarées */}
                      {(runway.tora || runway.toda || runway.asda || runway.lda) && (
                        <div style={{ marginBottom: '4px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                            Distances déclarées :
                          </div>
                          {runway.tora && (
                            <div style={sx.text.secondary}>
                              • TORA: {runway.tora} m ({Math.round(runway.tora * 3.28084)} ft)
                            </div>
                          )}
                          {runway.toda && (
                            <div style={sx.text.secondary}>
                              • TODA: {runway.toda} m ({Math.round(runway.toda * 3.28084)} ft)
                            </div>
                          )}
                          {runway.asda && (
                            <div style={sx.text.secondary}>
                              • ASDA: {runway.asda} m ({Math.round(runway.asda * 3.28084)} ft)
                            </div>
                          )}
                          {runway.lda && (
                            <div style={sx.text.secondary}>
                              • LDA: {runway.lda} m ({Math.round(runway.lda * 3.28084)} ft)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Compatibilité avion */}
                      {selectedAircraft && aircraftSurfaces.length > 0 && (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={sx.text.secondary}>
                            Avion compatible avec: {aircraftSurfaces.join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Conclusion compatibilité */}
                      {selectedAircraft && selectedAircraft.distances && (
                        <div style={sx.combine(
                          { fontWeight: 'bold' },
                          isCompatible && surfaceCompatible ? sx.text.success : sx.text.danger
                        )}>
                          {isCompatible && surfaceCompatible ? (
                            '✓ Piste compatible avec cet avion'
                          ) : !isCompatible ? (
                            `✗ Piste trop courte (requis: ${requiredDistances?.takeoffDistance || 'N/A'} ft décollage)`
                          ) : (
                            '✗ Surface incompatible avec cet avion'
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Points VFR liés à cet aérodrome - Cartouche unique regroupée */}
      {linkedVfrPoints.length > 0 && (
        <div style={sx.combine(
          sx.spacing.mt(3),
          sx.spacing.pt(3),
          { borderTop: '1px solid var(--border-subtle)' }
        )}>
          {/* Cartouche unique pour tous les points VFR */}
          <div
            style={sx.combine(
              sx.spacing.p(3),
              sx.rounded.md,
              {
                background: 'linear-gradient(135deg, var(--bg-overlay) 0%, var(--bg-overlay) 100%)',
                border: '2px solid var(--text-secondary)',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.1)'
              }
            )}
          >
            {/* En-tête de la cartouche */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <h5 style={{
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📍 Points VFR liés
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-overlay)',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--text-secondary)'
                }}>
                  {linkedVfrPoints.length}
                </span>
              </h5>
            </div>

            {/* Liste des points VFR dans la cartouche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {linkedVfrPoints.map((vfrPoint, vfrIdx) => (
                <div
                  key={vfrPoint.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: 'var(--bg-overlay)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'center' }}>
                    <div style={{
                      fontWeight: '700',
                      color: 'var(--text-secondary)',
                      minWidth: '60px',
                      fontSize: '13px'
                    }}>
                      {vfrPoint.name}
                    </div>
                    {vfrPoint.lat && vfrPoint.lon && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        📍 {vfrPoint.lat.toFixed(2)}°, {vfrPoint.lon.toFixed(2)}°
                      </div>
                    )}
                  </div>

                  {/* Bouton de suppression du point VFR */}
                  <button
                    onClick={() => {
                      console.log('🗑️ Clic sur suppression VFR - Point:', vfrPoint.name, 'ID:', vfrPoint.id);
                      if (onRemoveVfrPoint) {
                        console.log('🗑️ Appel de onRemoveVfrPoint avec ID:', vfrPoint.id);
                        onRemoveVfrPoint(vfrPoint.id);
                        console.log('🗑️ onRemoveVfrPoint appelé avec succès');
                      } else {
                        console.error('❌ Fonction onRemoveVfrPoint non disponible!');
                      }
                    }}
                    style={{
                      padding: '4px 6px',
                      border: 'none',
                      background: 'var(--bg-overlay)',
                      color: '#C04534',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      fontSize: '11px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-overlay)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-overlay)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Supprimer ce point VFR"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pied de carte avec boutons */}
      <div style={sx.combine(
        sx.spacing.mt(3),
        sx.spacing.pt(3),
        { borderTop: '1px solid var(--border-subtle)' }
      )}>
        {/* Bouton Ajouter un point VFR - pleine largeur */}
        {onInsertWaypoint ? (
          <div style={{ marginBottom: '10px' }}>
            <VFRPointInserter
              waypoints={allWaypoints || waypoints}
              currentAirportIcao={waypoint.name ? waypoint.name.split(' ')[0] : null}
              onInsertWaypoint={(newWaypoint, _) => {
                // Insérer après ce waypoint
                onInsertWaypoint(newWaypoint, index + 1);
              }}
              insertPosition={index + 1}
              fullWidth={true}
            />
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: '10px' }}>
            (Pas de fonction d'insertion disponible)
          </div>
        )}

        {/* Boutons flèche haut/bas et supprimer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          {/* Ligne 1: Boutons flèche haut/bas */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Déplacer vers le haut (désactivé si départ ou juste après départ) */}
            <button
              onClick={onMoveUp}
              disabled={index <= 1}
              style={sx.combine(
                sx.components.button.base,
                {
                  padding: '6px',
                  backgroundColor: index <= 1 ? 'var(--border-subtle)' : 'var(--bg-overlay)',
                  color: index <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: index <= 1 ? 'not-allowed' : 'pointer',
                  opacity: index <= 1 ? 0.5 : 1
                }
              )}
              title={index <= 1 ? "Impossible de remonter plus haut" : "Déplacer vers le haut"}
            >
              <ArrowUp size={14} />
            </button>

            {/* Déplacer vers le bas (désactivé si arrivée ou juste avant arrivée) */}
            <button
              onClick={onMoveDown}
              disabled={index >= totalWaypoints - 2}
              style={sx.combine(
                sx.components.button.base,
                {
                  padding: '6px',
                  backgroundColor: index >= totalWaypoints - 2 ? 'var(--border-subtle)' : 'var(--bg-overlay)',
                  color: index >= totalWaypoints - 2 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  cursor: index >= totalWaypoints - 2 ? 'not-allowed' : 'pointer',
                  opacity: index >= totalWaypoints - 2 ? 0.5 : 1
                }
              )}
              title={index >= totalWaypoints - 2 ? "Impossible de descendre plus bas" : "Déplacer vers le bas"}
            >
              <ArrowDown size={14} />
            </button>
          </div>

          {/* Ligne 2: Bouton supprimer centré */}
          {canDelete && (
            <button
              onClick={onRemove}
              style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '6px' })}
              title="Supprimer ce point"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

WaypointCardWithRunways.displayName = 'WaypointCardWithRunways';

export default WaypointCardWithRunways;