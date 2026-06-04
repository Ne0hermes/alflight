// src/features/alternates/components/AlternateSelector.jsx
import React, { memo, useState } from 'react';
import { Plus, X, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAlternatesStore } from '@core/stores/alternatesStore';

export const AlternateSelector = memo(({ candidates = [], selected = [] }) => {
  const { addAlternate, removeAlternate, setSelectedAlternates } = useAlternatesStore();
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  
  const topCandidates = candidates.slice(0, 5);
  const displayedCandidates = showAllCandidates ? candidates : topCandidates;
  
  const handleAutoSelect = () => {
    // Sélectionner automatiquement les 3 meilleurs
    const top3 = candidates.slice(0, 3);
    setSelectedAlternates(top3);
  };
  
  const isSelected = (icao) => selected.some(alt => alt.icao === icao);
  
  return (
    <div>
      {/* Alternates sélectionnés */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
            ✅ Déroutements sélectionnés ({selected.length}/3)
          </h4>
          {selected.length === 0 && candidates.length > 0 && (
            <button
              onClick={handleAutoSelect}
              style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            >
              <CheckCircle size={16} />
              Sélection auto
            </button>
          )}
        </div>
        
        {selected.length === 0 ? (
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
            Aucun déroutement sélectionné. Choisissez parmi les suggestions ci-dessous.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {selected.map((alternate, index) => (
              <SelectedAlternateItem
                key={alternate.icao}
                alternate={alternate}
                index={index}
                onRemove={() => removeAlternate(alternate.icao)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Candidats suggérés */}
      <div style={sx.components.card.base}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
            💡 Suggestions ({candidates.length} trouvés)
          </h4>
          {candidates.length > 5 && (
            <button
              onClick={() => setShowAllCandidates(!showAllCandidates)}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              {showAllCandidates ? 'Voir moins' : `Voir tout (${candidates.length})`}
            </button>
          )}
        </div>
        
        {candidates.length === 0 ? (
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.text.center, sx.spacing.p(4))}>
            Aucun aérodrome trouvé dans la zone de recherche avec les critères définis.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {displayedCandidates.map((candidate) => (
              <CandidateItem
                key={candidate.icao}
                candidate={candidate}
                isSelected={isSelected(candidate.icao)}
                onAdd={() => addAlternate(candidate)}
                disabled={selected.length >= 3}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// Composant pour un alternate sélectionné
const SelectedAlternateItem = memo(({ alternate, index, onRemove }) => (
  <div style={sx.combine(
    sx.spacing.p(3),
    sx.bg.gray,
    sx.rounded.md,
    sx.flex.between
  )}>
    <div style={sx.flex.start}>
      <span style={{
        backgroundColor: getAlternateColor(index),
        color: 'var(--text-primary)',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--fs-body)',
        fontWeight: 'bold',
        marginRight: '12px'
      }}>
        {index + 1}
      </span>
      <div>
        <p style={sx.combine(sx.text.sm, sx.text.bold)}>
          {alternate.icao} - {alternate.name}
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
          {alternate.distance.toFixed(1)} NM • Score: {(alternate.score * 100).toFixed(0)}%
        </p>
      </div>
    </div>
    <button
      onClick={onRemove}
      style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '6px' })}
    >
      <X size={16} />
    </button>
  </div>
));

// Composant pour un candidat
const CandidateItem = memo(({ candidate, isSelected, onAdd, disabled }) => (
  <div style={sx.combine(
    sx.spacing.p(3),
    sx.rounded.md,
    sx.flex.between,
    {
      backgroundColor: isSelected ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
      border: isSelected ? '1px solid var(--bg-overlay)' : '1px solid var(--border-subtle)'
    }
  )}>
    <div style={{ flex: 1 }}>
      <div style={sx.flex.between}>
        <p style={sx.combine(sx.text.sm, sx.text.bold)}>
          {candidate.icao} - {candidate.name}
        </p>
        <ScoreBadge score={candidate.score} />
      </div>
      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
        <span>📍 {candidate.distance.toFixed(1)} NM</span>
        <span style={sx.spacing.ml(2)}>🛬 {candidate.runways[0]?.length || '?'}m</span>
        {candidate.services.fuel && <span style={sx.spacing.ml(2)}>⛽ Fuel</span>}
        {candidate.services.atc && <span style={sx.spacing.ml(2)}>🗼 ATC</span>}
      </div>
    </div>
    
    <button
      onClick={onAdd}
      disabled={disabled || isSelected}
      style={sx.combine(
        sx.components.button.base,
        isSelected ? sx.components.button.success : sx.components.button.primary,
        sx.spacing.ml(3),
        { padding: '6px 12px' },
        (disabled || isSelected) && { opacity: 0.5, cursor: 'not-allowed' }
      )}
    >
      {isSelected ? (
        <>
          <CheckCircle size={16} />
          Sélectionné
        </>
      ) : (
        <>
          <Plus size={16} />
          Ajouter
        </>
      )}
    </button>
  </div>
));

// Composant pour afficher le score
const ScoreBadge = memo(({ score }) => {
  const color = score >= 0.8 ? 'var(--text-primary)' : score >= 0.6 ? 'var(--accent-primary)' : 'var(--color-red-critical)';
  
  return (
    <span style={{
      padding: '2px 8px',
      backgroundColor: color + '20',
      color: color,
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--fs-caption)',
      fontWeight: 'bold'
    }}>
      {(score * 100).toFixed(0)}%
    </span>


  );
});

const getAlternateColor = (index) => {
  const colors = ['var(--text-secondary)', 'var(--text-primary)', 'var(--accent-primary)'];
  return colors[index] || 'var(--text-secondary)';
};

AlternateSelector.displayName = 'AlternateSelector';
SelectedAlternateItem.displayName = 'SelectedAlternateItem';
CandidateItem.displayName = 'CandidateItem';
ScoreBadge.displayName = 'ScoreBadge';