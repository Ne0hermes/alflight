// src/abac/curves/ui/OperationSetupPanel.tsx
//
// Lot 1-C — Écran « OPÉRATION » : LA question structurante, posée UNE FOIS au
// départ d'un modèle vierge (décision n°1 du parcours idéal, audit-7) :
//   1. l'OPÉRATION canonique du set — classifieur partagé en mode EXPLICITE
//      (aucune résolution implicite : une Phase seule n'émet rien, les volets
//      doivent être tranchés quand plusieurs variantes existent) ;
//   2. le TYPE DE PLANCHE — standard (résultat lu sur Y) ou lecture
//      descendante (résultat lu sur l'échelle du bas) ;
//   3. le NOMBRE DE PANNEAUX (cadres) — défaut 3 en standard, 2 en descendante.
// « Créer les cadres → » (ou « Appliquer » en retour via « Modifier ») délègue
// au builder la création/mise à jour : rôles, readoutAxis, familles… tout ce
// que l'utilisateur devait deviner est DÉDUIT de ces trois réponses
// (core/plancheSetup.ts).
// Styles inline conformes à l'existant — l'habillage (kit) viendra après.

import React, { useState } from 'react';
import { OperationClassifier } from './OperationClassifier';
import { getOperation } from '../core/operationCatalog';
import { PlancheType, DEFAULT_PANEL_COUNT, defaultPanelName } from '../core/plancheSetup';

export interface OperationSetupPanelProps {
  /** operationId déjà connu (Modifier / session) — '' pour un set vierge. */
  initialOperationId: string;
  /** Type de planche déjà choisi/inféré — null : la carte Standard est
   *  pré-sélectionnée (cas le plus courant, modifiable d'un clic). */
  initialPlancheType: PlancheType | null;
  /** Nombre de panneaux actuel de la chaîne (mode Appliquer) — null en création. */
  initialPanelCount: number | null;
  /** true = retour via « Modifier » : cadres conservés, bouton « Appliquer ». */
  applyMode: boolean;
  onSubmit: (choice: { operationId: string; plancheType: PlancheType; panelCount: number }) => void;
  /** Annuler (Appliquer : retour au Tracé ; création : retour parent). */
  onCancel?: () => void;
}

const blockStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  backgroundColor: 'var(--bg-overlay)',
  padding: '10px 12px',
  marginBottom: 12
};

const blockTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--accent-primary)',
  marginBottom: 8
};

export const OperationSetupPanel: React.FC<OperationSetupPanelProps> = ({
  initialOperationId, initialPlancheType, initialPanelCount, applyMode, onSubmit, onCancel
}) => {
  const [operationId, setOperationId] = useState<string>(initialOperationId);
  const [plancheType, setPlancheType] = useState<PlancheType>(initialPlancheType ?? 'standard');
  // null = suivre le défaut du type (3 standard / 2 descendante) ; un choix
  // explicite de l'utilisateur (ou le nombre actuel en mode Appliquer) prime.
  const [countOverride, setCountOverride] = useState<number | null>(initialPanelCount);
  const panelCount = countOverride ?? DEFAULT_PANEL_COUNT[plancheType];

  const op = getOperation(operationId);
  // Garde du bouton : le classifieur en mode explicite n'émet l'operationId
  // que lorsque Phase + Métrique + Volets sont résolus par des choix
  // explicites — un `op` résolu suffit donc comme condition de complétude.
  const blockedReason = !op
    ? 'Choisis l\'opération complète : Phase, Métrique et — si plusieurs variantes existent — les Volets. Rien n\'est déduit implicitement.'
    : null;

  const selectPlancheType = (t: PlancheType) => {
    setPlancheType(t);
    // La descendante exige ≥ 2 panneaux (entrée + zone de sortie) : un choix
    // « 1 » redevient le défaut du type.
    if (t === 'descendante' && (countOverride ?? DEFAULT_PANEL_COUNT[t]) < 2) setCountOverride(null);
  };

  const typeCard = (t: PlancheType, title: string, desc: string) => {
    const active = plancheType === t;
    return (
      <label
        key={t}
        style={{
          flex: '1 1 260px',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          padding: '10px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          border: `2px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          backgroundColor: active ? 'rgba(242, 105, 33, 0.08)' : 'var(--bg-surface)'
        }}
      >
        <input
          type="radio"
          name="planche-type"
          checked={active}
          onChange={() => selectPlancheType(t)}
          style={{ marginTop: 2 }}
        />
        <span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
            {desc}
          </span>
        </span>
      </label>
    );
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Une seule question structurante, posée maintenant : tout le reste (rôles des panneaux,
        sens de lecture, familles de courbes, chaîne de calcul) est déduit automatiquement.
      </p>

      {/* ─── 1. Opération du set ─── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Quelle opération cette planche calcule-t-elle ?</div>
        <OperationClassifier
          requireExplicit
          showLabel
          value={operationId}
          onChange={setOperationId}
        />
        {op && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--status-success, var(--accent-primary))' }}>✓ {op.labelFr}</strong>
            {' '}· ID : <code>{op.id}</code>
            {op.configuration?.flaps && <> · Flaps : {op.configuration.flaps}</>}
          </div>
        )}
      </div>

      {/* ─── 2. Type de planche ─── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Quel type de planche ?</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {typeCard(
            'standard',
            '↕ Standard — le résultat se lit sur l\'axe vertical',
            'Vos planches de décollage : l\'échelle de distance est verticale, chaque panneau corrige la valeur.'
          )}
          {typeCard(
            'descendante',
            '↓ Lecture descendante — le résultat se lit en bas',
            'Planches d\'atterrissage type Piper : panneau d\'entrée à gauche, zone à guides de vent, la distance se lit sur l\'échelle du bas.'
          )}
        </div>
      </div>

      {/* ─── 3. Nombre de panneaux ─── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Combien de panneaux (cadres) sur la planche ?</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map(n => {
            const disabled = plancheType === 'descendante' && n < 2;
            const active = panelCount === n;
            return (
              <button
                key={n}
                aria-pressed={active}
                onClick={() => setCountOverride(n)}
                disabled={disabled}
                title={disabled
                  ? 'Une planche en lecture descendante a au moins 2 panneaux (entrée + zone de sortie).'
                  : `${n} panneau${n > 1 ? 'x' : ''}`}
                style={{
                  width: 38,
                  padding: '7px 0',
                  fontSize: 14,
                  fontWeight: active ? 700 : 400,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderRadius: 4,
                  border: `2px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: active ? 'white' : 'var(--text-primary)',
                  opacity: disabled ? 0.4 : 1
                }}
              >
                {n}
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
            Le 1er panneau (à gauche) est l'entrée ; les suivants corrigent la valeur
            {plancheType === 'descendante' ? ' ; le dernier porte les guides de vent et se lit en bas.' : '.'}
          </span>
        </div>
        {/* Écho EXPLICITE du choix (retour pilote 20/08 : « on ne comprend pas
            qu'il va générer deux cadres ») : ce qui sera créé, en toutes
            lettres, mis à jour à chaque clic. */}
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>
          → {panelCount} cadre{panelCount > 1 ? 's' : ''} : {Array.from({ length: panelCount }, (_, i) => defaultPanelName(i, panelCount, plancheType)).join(' · ')}
        </div>
      </div>

      {applyMode && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
          Les cadres existants sont conservés : « Appliquer » met à jour l'opération, les rôles et
          le sens de lecture. Un changement du nombre de panneaux demandera confirmation avant
          d'ajouter ou de retirer des cadres.
        </p>
      )}

      {/* ─── Validation ─── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', cursor: 'pointer', fontSize: 13,
              backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)', borderRadius: 6
            }}
          >
            ← {applyMode ? 'Retour au tracé' : 'Annuler'}
          </button>
        )}
        <button
          onClick={() => { if (op) onSubmit({ operationId, plancheType, panelCount }); }}
          disabled={!!blockedReason}
          title={blockedReason || (applyMode
            ? 'Met à jour opération, rôles et sens de lecture sur les cadres existants'
            : 'Crée les panneaux pré-répartis sur le canevas, tout déduit')}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            cursor: blockedReason ? 'not-allowed' : 'pointer',
            backgroundColor: blockedReason ? 'var(--bg-overlay)' : 'var(--accent-primary)',
            color: blockedReason ? 'var(--text-tertiary)' : 'white',
            border: 'none', borderRadius: 6,
            marginLeft: 'auto'
          }}
        >
          {applyMode ? 'Appliquer' : `Créer les ${panelCount} cadre${panelCount > 1 ? 's' : ''} →`}
        </button>
      </div>
      {blockedReason && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: 'var(--color-red-critical)', textAlign: 'right' }}>
          {blockedReason}
        </div>
      )}
    </div>
  );
};
