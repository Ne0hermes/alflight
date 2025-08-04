// src/features/alternates/AlternatesModule.jsx
// VERSION 4 - Module Déroutements avec système dual et sélection manuelle

console.log('🛬 AlternatesModule v4 - Chargement...'); // LOG DE VÉRIFICATION

import React, { memo, useEffect, useState } from 'react';
import { Navigation2, AlertTriangle, Fuel, Wind, Plane, Info, RefreshCw, Settings } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
import { AlternateMap } from './components/AlternateMap';
import { AlternateSelectorDual } from './components/AlternateSelectorDual';
import { useNavigationResults } from './hooks/useNavigationResults';
import { WeatherRateLimitIndicator } from './components/WeatherRateLimitIndicator';
import { useAlternatesStore } from '@core/stores/alternatesStore';





const AlternatesModule = memo(() => {
  console.log('🛬 AlternatesModule - Rendu du composant'); // LOG DE RENDU
  
  const {
    searchZone,
    selectedAlternates,
    isReady,
    dynamicRadius,
    triangleArea,
    turnPointBuffers,
    refreshAlternates,
    formattedAlternates,
    statistics
  } = useAdvancedAlternateSelection();
  
  const { scoredAlternates, setSelectedAlternates } = useAlternatesStore();
  const [showSelector, setShowSelector] = useState(false);
  const [manualSelection, setManualSelection] = useState({ departure: null, arrival: null });
  
  // Log détaillé de l'état
  useEffect(() => {
    console.log('🛬 AlternatesModule - État complet:', { 
      isReady, 
      alternatesCount: selectedAlternates?.length,
      scoredAlternatesCount: scoredAlternates?.length,
      formattedCount: formattedAlternates?.length,
      statistics,
      searchZone: searchZone ? {
        type: searchZone.type,
        radius: searchZone.radius,
        hasPerpendicular: !!searchZone.perpendicular
      } : null,
      selectedAlternates: selectedAlternates?.map(alt => ({
        icao: alt.icao,
        name: alt.name,
        side: alt.side,
        selectionType: alt.selectionType,
        score: alt.score
      }))
    });
  }, [isReady, selectedAlternates, scoredAlternates, formattedAlternates, statistics, searchZone]);
  
  if (!isReady) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>
          Définissez un vol avec départ et arrivée pour activer la sélection automatique des déroutements
        </p>
      </div>
    );
  }
  
  // Gérer la sélection manuelle
  const handleManualSelection = (selection) => {
    setManualSelection(selection);
    
    // Mettre à jour le store avec la sélection manuelle
    const newSelection = [];
    if (selection.departure) {
      newSelection.push({ ...selection.departure, selectionType: 'departure' });
    }
    if (selection.arrival) {
      newSelection.push({ ...selection.arrival, selectionType: 'arrival' });
    }
    
    if (newSelection.length > 0) {
      setSelectedAlternates(newSelection);
    }
  };
  
  // Déterminer quels alternates afficher
  const displayedAlternates = showSelector && (manualSelection.departure || manualSelection.arrival)
    ? [manualSelection.departure, manualSelection.arrival].filter(Boolean)
    : formattedAlternates;
  
  return (
    <div>
      {/* Indicateur de rate limiting météo */}
      <WeatherRateLimitIndicator />
      
      {/* En-tête avec résumé et statistiques */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
            🛬 Sélection des aérodromes de déroutement
          </h3>
          <div style={sx.flex.start}>
            <button
              onClick={() => setShowSelector(!showSelector)}
              style={sx.combine(
                sx.components.button.base, 
                showSelector ? sx.components.button.primary : sx.components.button.secondary,
                sx.spacing.mr(2)
              )}
            >
              <Settings size={16} />
              {showSelector ? 'Sélection auto' : 'Sélection manuelle'}
            </button>
            <button
              onClick={refreshAlternates}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary, sx.spacing.mr(2))}
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
            {selectedAlternates?.length === 0 && (
              <button
                onClick={refreshAlternates}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                <Navigation2 size={16} />
                Lancer la recherche
              </button>
            )}
          </div>
        </div>
        
        {/* Statistiques de recherche */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Zone de recherche géométrique
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <StatCard
              icon={<Navigation2 size={20} />}
              label="Zone principale"
              value="Capsule (pilule)"
              detail={`Rayon: ${dynamicRadius || 25} NM`}
            />
            <StatCard
              icon={<Fuel size={20} />}
              label="Rayon dynamique"
              value={`${dynamicRadius || 25} NM`}
              detail="Basé sur carburant"
            />
            <StatCard
              icon={<Plane size={20} />}
              label="Points tournants"
              value={turnPointBuffers?.length || 0}
              detail={turnPointBuffers?.length > 0 ? "Avec tampons 5-10 NM" : "Aucun détecté"}
            />
            <StatCard
              icon={<Info size={20} />}
              label="Candidats trouvés"
              value={statistics?.scoredCandidates || 0}
              detail={`Sur ${statistics?.totalCandidates || 0} total`}
            />
          </div>
        </div>
        
        {/* Mode sélection manuelle */}
        {showSelector && scoredAlternates.length > 0 && (
          <AlternateSelectorDual
            candidates={scoredAlternates}
            searchZone={searchZone}
            onSelectionChange={handleManualSelection}
            currentSelection={manualSelection}
          />
        )}
        
        {/* Mode sélection automatique */}
        {!showSelector && (
          <>
            {/* DEBUG: Afficher plus d'infos si pas d'alternates */}
            {(!displayedAlternates || displayedAlternates.length === 0) && (
              <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
                <Info size={16} />
                <div>
                  <p style={sx.text.sm}>
                    <strong>Diagnostic détaillé :</strong>
                  </p>
                  <ul style={sx.combine(sx.text.sm, sx.spacing.ml(4))}>
                    <li>Aérodromes disponibles : {statistics?.totalCandidates || 0}</li>
                    <li>Aérodromes dans la zone : {statistics?.scoredCandidates || 0}</li>
                    <li>Zone de recherche : {searchZone ? `${searchZone.type} (${searchZone.radius?.toFixed(0)} NM)` : 'Non définie'}</li>
                    <li>Rayon dynamique : {dynamicRadius || 'Non calculé'} NM</li>
                    <li>Alternates sélectionnés automatiquement : {selectedAlternates?.length || 0}</li>
                    <li>Vérifiez la console (F12) pour plus de détails</li>
                  </ul>
                </div>
              </div>
            )}
            
            {/* Affichage de TOUS les candidats trouvés */}
            {scoredAlternates && scoredAlternates.length > 0 && (
              <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
                <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                  📊 Tous les aérodromes candidats ({scoredAlternates.length})
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Aérodrome</th>
                        <th style={styles.th}>Distance route</th>
                        <th style={styles.th}>Côté</th>
                        <th style={styles.th}>Piste</th>
                        <th style={styles.th}>Services</th>
                        <th style={styles.th}>Score</th>
                        <th style={styles.th}>Sélection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoredAlternates.map((alt) => {
                        const isSelected = selectedAlternates.some(s => s.icao === alt.icao);
                        return (
                          <tr key={alt.icao} style={styles.tr}>
                            <td style={styles.td}>
                              <strong>{alt.icao}</strong> - {alt.name}
                            </td>
                            <td style={styles.td}>{(alt.distance || 0).toFixed(1)} NM</td>
                            <td style={styles.td}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                backgroundColor: alt.side === 'departure' ? '#fee2e2' : '#dcfce7',
                                color: alt.side === 'departure' ? '#dc2626' : '#059669'
                              }}>
                                {alt.side === 'departure' ? 'Départ' : 'Arrivée'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {alt.runways?.[0]?.length || '?'}m
                            </td>
                            <td style={styles.td}>
                              {[
                                alt.services?.fuel && '⛽',
                                alt.services?.atc && '🗼',
                                alt.services?.lighting && '💡'
                              ].filter(Boolean).join(' ') || '-'}
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.scoreBadge,
                                backgroundColor: getScoreColor(alt.score)
                              }}>
                                {((alt.score || 0) * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td style={styles.td}>
                              {isSelected && '✅ Auto'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Alternates sélectionnés automatiquement */}
            <div style={sx.components.card.base}>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
                ✅ Aérodromes sélectionnés automatiquement (meilleurs de chaque côté)
              </h4>
              
              {!displayedAlternates || displayedAlternates.length === 0 ? (
                <div style={sx.spacing.p(4)}>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.mb(3))}>
                    Aucun aérodrome sélectionné automatiquement
                  </p>
                  <div style={sx.text.center}>
                    <button
                      onClick={refreshAlternates}
                      style={sx.combine(sx.components.button.base, sx.components.button.primary)}
                    >
                      <Navigation2 size={16} />
                      Lancer une recherche
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>Aérodrome</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Distance route</th>
                        <th style={styles.th}>Piste principale</th>
                        <th style={styles.th}>Services</th>
                        <th style={styles.th}>Météo</th>
                        <th style={styles.th}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAlternates.map((alt, index) => (
                        <tr key={alt.icao} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.badge,
                              backgroundColor: alt.selectionType === 'departure' ? '#dc2626' : '#059669'
                            }}>
                              {index + 1}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <strong>{alt.displayName || `${alt.icao} - ${alt.name}`}</strong>
                            {alt.vac?.available && (
                              <span style={styles.vacBadge}>
                                {alt.vac.downloaded ? '📄 VAC' : '⚠️ VAC'}
                              </span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              backgroundColor: alt.selectionType === 'departure' ? '#fee2e2' : '#dcfce7',
                              color: alt.selectionType === 'departure' ? '#dc2626' : '#059669'
                            }}>
                              {alt.selectionType === 'departure' ? '🔴 Départ' : '🟢 Arrivée'}
                            </span>
                          </td>
                          <td style={styles.td}>{alt.displayDistance || `${(alt.distance || 0).toFixed(1)} NM`}</td>
                          <td style={styles.td}>{alt.displayRunway || `${alt.runways?.[0]?.length || '?'}m`}</td>
                          <td style={styles.td}>{alt.displayServices || '-'}</td>
                          <td style={styles.td}>
                            <span style={sx.text.xs}>{alt.displayWeather || 'N/A'}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={sx.flex.center}>
                              <span style={{
                                ...styles.scoreBadge,
                                backgroundColor: getScoreColor(alt.score)
                              }}>
                                {alt.displayScore || `${((alt.score || 0) * 100).toFixed(0)}%`}
                              </span>
                              <span style={sx.combine(sx.text.xs, sx.text.muted, sx.spacing.ml(1))}>
                                {alt.displayRank || ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      
      {/* Carte avec visualisation */}
      {searchZone && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
            Visualisation de la zone de recherche
          </h4>
          <AlternateMap 
            searchZone={searchZone}
            alternates={showSelector && (manualSelection.departure || manualSelection.arrival) 
              ? [manualSelection.departure, manualSelection.arrival].filter(Boolean)
              : selectedAlternates
            }
          />
        </section>
      )}
      
      {/* Informations détaillées */}
      <section style={sx.components.section.base}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          ℹ️ Méthodologie de sélection
        </h4>
        <div style={sx.components.card.base}>
          <div style={sx.text.sm}>
            <p style={sx.spacing.mb(2)}>
              <strong>Système dual :</strong> La zone est divisée par la médiatrice du segment [départ, arrivée]. 
              Un aérodrome est sélectionné de chaque côté pour garantir une couverture complète.
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Zone de recherche :</strong> Capsule (pilule) autour de la route avec rayon h = (√3/2) × distance + tampons de 5-10 NM autour des points tournants critiques
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Garantie :</strong> Aucun chemin de déroutement n'est plus long que la navigation initiale
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Critères de scoring :</strong>
            </p>
            <ul style={{ marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Distance à la route (30%)</li>
              <li>Infrastructure piste (25%)</li>
              <li>Services disponibles (20%)</li>
              <li>Conditions météo (15%)</li>
              <li>Position stratégique (10%)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
});

// Composant pour afficher une carte de statistique
const StatCard = memo(({ icon, label, value, detail }) => (
  <div style={sx.combine(sx.spacing.p(3), sx.bg.gray, sx.rounded.lg)}>
    <div style={sx.combine(sx.flex.start, sx.spacing.gap(2), sx.spacing.mb(2))}>
      <div style={{ color: '#3b82f6' }}>{icon}</div>
      <span style={sx.combine(sx.text.sm, sx.text.muted)}>{label}</span>
    </div>
    <p style={sx.combine(sx.text.lg, sx.text.bold)}>{value}</p>
    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>{detail}</p>
  </div>
));

// Styles
const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    color: '#374151'
  },
  td: {
    padding: '12px 8px',
    borderBottom: '1px solid #f3f4f6'
  },
  tr: {
    '&:hover': {
      backgroundColor: '#f9fafb'
    }
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  vacBadge: {
    marginLeft: '8px',
    fontSize: '12px'
  },
  scoreBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  }
};

// Fonctions utilitaires
const getScoreColor = (score) => {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
};

AlternatesModule.displayName = 'AlternatesModule';
StatCard.displayName = 'StatCard';

console.log('🛬 AlternatesModule v4 - Chargement terminé');

// Export par défaut pour le lazy loading
export default AlternatesModule;