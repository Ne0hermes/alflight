// src/features/alternates/AlternatesModule.jsx

import React, { memo } from 'react';
import { Navigation2, AlertTriangle, Fuel, Wind, Plane, Info, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
import { AlternateMap } from './components/AlternateMap';

const AlternatesModule = memo(() => {
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
  
  return (
    <div>
      {/* En-tête avec résumé et statistiques */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
            🛬 Sélection automatique des aérodromes de déroutement
          </h3>
          <button
            onClick={refreshAlternates}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
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
              detail={`Aire: ${Math.round(triangleArea)} NM²`}
            />
            <StatCard
              icon={<Fuel size={20} />}
              label="Rayon dynamique"
              value={`${dynamicRadius} NM`}
              detail="Basé sur carburant"
            />
            <StatCard
              icon={<Plane size={20} />}
              label="Points tournants"
              value={turnPointBuffers.length}
              detail={turnPointBuffers.length > 0 ? "Avec tampons 5-10 NM" : "Aucun détecté"}
            />
            <StatCard
              icon={<Info size={20} />}
              label="Candidats trouvés"
              value={statistics.scoredCandidates}
              detail={`Sur ${statistics.totalCandidates} total`}
            />
          </div>
        </div>
        
        {/* Alternates sélectionnés */}
        <div style={sx.components.card.base}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            ✅ Aérodromes de déroutement sélectionnés automatiquement
          </h4>
          
          {formattedAlternates.length === 0 ? (
            <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
              Aucun aérodrome trouvé dans la zone de recherche définie
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Aérodrome</th>
                    <th style={styles.th}>Distance route</th>
                    <th style={styles.th}>Piste principale</th>
                    <th style={styles.th}>Services</th>
                    <th style={styles.th}>Météo</th>
                    <th style={styles.th}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedAlternates.map((alt) => (
                    <tr key={alt.icao} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor: getColorForIndex(alt.displayIndex - 1)
                        }}>
                          {alt.displayIndex}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <strong>{alt.displayName}</strong>
                        {alt.vac.available && (
                          <span style={styles.vacBadge}>
                            {alt.vac.downloaded ? '📄 VAC' : '⚠️ VAC'}
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>{alt.displayDistance}</td>
                      <td style={styles.td}>{alt.displayRunway}</td>
                      <td style={styles.td}>{alt.displayServices}</td>
                      <td style={styles.td}>
                        <span style={sx.text.xs}>{alt.displayWeather}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={sx.flex.center}>
                          <span style={{
                            ...styles.scoreBadge,
                            backgroundColor: getScoreColor(alt.score)
                          }}>
                            {alt.displayScore}
                          </span>
                          <span style={sx.combine(sx.text.xs, sx.text.muted, sx.spacing.ml(1))}>
                            {alt.displayRank}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Détails du scoring */}
          {formattedAlternates.length > 0 && (
            <details style={sx.spacing.mt(3)}>
              <summary style={styles.summary}>
                Voir les détails du calcul de score
              </summary>
              <div style={sx.combine(sx.spacing.mt(2), sx.spacing.p(3), sx.bg.gray, sx.rounded.md)}>
                <ScoringExplanation alternates={selectedAlternates} />
              </div>
            </details>
          )}
        </div>
      </section>
      
      {/* Carte avec visualisation */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          Visualisation de la zone de recherche
        </h4>
        <AlternateMap 
          searchZone={searchZone}
          alternates={selectedAlternates}
        />
      </section>
      
      {/* Informations détaillées */}
      <section style={sx.components.section.base}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          ℹ️ Méthodologie de sélection
        </h4>
        <div style={sx.components.card.base}>
          <div style={sx.text.sm}>
            <p style={sx.spacing.mb(2)}>
              <strong>Zone de recherche :</strong> Capsule (pilule) autour de la route avec rayon h = (√3/2) × distance + tampons de 5-10 NM autour des points tournants critiques (virages {'>'} 30°)
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Géométrie pilule :</strong> L'ensemble des points situés à une distance ≤ h du segment [départ, arrivée], formant une capsule avec deux demi-cercles aux extrémités
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Rayon dynamique :</strong> Calculé sur base du carburant résiduel utilisable (FOB - réserves), limité entre 15 et 50 NM
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Critères de scoring :</strong>
            </p>
            <ul style={{ marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Distance à la route (30%) - Favorise la proximité</li>
              <li>Infrastructure piste (25%) - Longueur vs besoins avion</li>
              <li>Services disponibles (20%) - Fuel, ATC/AFIS, balisage</li>
              <li>Conditions météo (15%) - Visibilité, plafond, vent</li>
              <li>Position stratégique (10%) - Milieu de parcours, proximité virages</li>
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

// Composant pour expliquer le scoring
const ScoringExplanation = memo(({ alternates }) => (
  <div style={{ display: 'grid', gap: '16px' }}>
    {alternates.map((alt, index) => (
      <div key={alt.icao} style={sx.spacing.p(3)}>
        <h5 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
          {alt.icao} - {alt.name} (Score total: {(alt.score * 100).toFixed(0)}%)
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {alt.scoreBreakdown && Object.entries(alt.scoreBreakdown).map(([criterion, value]) => (
            <div key={criterion} style={sx.text.xs}>
              <div style={sx.text.muted}>{getCriterionLabel(criterion)}</div>
              <div style={sx.text.bold}>{(value * 100 / getWeight(criterion)).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>
    ))}
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
  },
  summary: {
    cursor: 'pointer',
    fontSize: '13px',
    color: '#6b7280',
    outline: 'none'
  }
};

// Fonctions utilitaires
const getColorForIndex = (index) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b'];
  return colors[index] || '#6b7280';
};

const getScoreColor = (score) => {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
};

const getCriterionLabel = (criterion) => {
  const labels = {
    distance: 'Distance',
    runway: 'Piste',
    services: 'Services',
    weather: 'Météo',
    strategic: 'Position'
  };
  return labels[criterion] || criterion;
};

const getWeight = (criterion) => {
  const weights = {
    distance: 0.3,
    runway: 0.25,
    services: 0.2,
    weather: 0.15,
    strategic: 0.1
  };
  return weights[criterion] || 1;
};

AlternatesModule.displayName = 'AlternatesModule';
StatCard.displayName = 'StatCard';
ScoringExplanation.displayName = 'ScoringExplanation';

// Export par défaut pour le lazy loading
export default AlternatesModule;