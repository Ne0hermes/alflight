// src/abac/curves/ui/GraphIdentityPanel.tsx
//
// Lot 1-G — CARTE D'IDENTITÉ DU CADRE FOCUS, TOUJOURS VISIBLE (fin du
// <details> replié « Identité du graphique N » — audit-4 §1 : les réglages
// qui conditionnent d'autres panneaux vivaient dans un panneau replié).
// KitPanel compact :
//   - nom du cadre (éditable) ;
//   - variable de famille des courbes (select existant) ;
//   - « Lecture du résultat » (cadres NON premiers seulement) ;
//   - rappel de l'opération (elle SE RÈGLE à l'écran « Opération » — lien
//     « Modifier » ; ici on ne fait que la lire) + « Sortie mesurée » quand
//     l'opération accepte plusieurs natures de sortie ;
//   - badge d'état « x/y ✓ » alimenté par computeGraphReadiness ;
//   - <details> « Réglages avancés » (radios de rôle) UNIQUEMENT pour les
//     modèles legacy dont les rôles dévient de la convention « premier cadre
//     = primaire » — à corriger à la main.
// R9 (conservé) : descriptions en infobulles, lignes denses.

import React from 'react';
import { GraphConfig } from '../core/types';
import { getOperation } from '../core/operationCatalog';
import { getAxisVariable, getFamilyVariablesGrouped, isWindAxisVariable } from '../core/axisVariables';
// 23/08 — guides numérotés : un panneau de correction ne demande plus de
// valeur de famille (le moteur suit la pente, il ne lit pas la valeur).
import { usesNumberedGuides } from '../core/guideMode';
import { ReadinessItem } from '../core/modelReadiness';
import { KitBadge, KitButton, KitPanel, FONT, SPACING } from './kit';

interface GraphIdentityPanelProps {
  graph: GraphConfig;
  onUpdateGraph: (partial: Partial<GraphConfig>) => void;
  /** Position 1-based du cadre dans la chaîne (ordre gauche → droite). */
  frameNumber: number;
  /** Premier cadre de la chaîne : porte l'opération, jamais de lecture X. */
  isFirst: boolean;
  /** Items de computeGraphReadiness pour CE cadre — badge « x/y ✓ ». */
  readiness: ReadinessItem[];
  /** Rôles hors convention (legacy sans écran Opération) : montre les radios. */
  showAdvancedRoles: boolean;
  /** Retour à l'écran « Opération » (graphes et cadres conservés). */
  onEditOperation: () => void;
  /** Supprime le graphe focalisé, ses courbes et son cadre. */
  onRemoveGraph: () => void;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12, borderRadius: 3,
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap'
};

const rowStyle: React.CSSProperties = {
  display: 'flex', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap'
};

export const GraphIdentityPanel: React.FC<GraphIdentityPanelProps> = ({
  graph, onUpdateGraph, frameNumber, isFirst, readiness, showAdvancedRoles, onEditOperation, onRemoveGraph
}) => {
  const numberedGuides = usesNumberedGuides(graph, isFirst);
  const isPrimary = (graph.role || 'primary') === 'primary';
  const op = graph.operationId ? getOperation(graph.operationId) : undefined;

  const done = readiness.filter(it => it.state === 'done').length;
  const anyBlocked = readiness.some(it => it.state === 'blocked');
  const badgeTone = anyBlocked ? 'crit' : done === readiness.length && readiness.length > 0 ? 'ok' : 'neutral';

  return (
    <KitPanel
      title={`Cadre ${frameNumber}`}
      badge={<KitBadge tone={badgeTone}>{done}/{readiness.length} ✓</KitBadge>}
      tone={anyBlocked ? 'attention' : 'default'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, fontSize: 12 }}>
        {/* Nom du cadre — éditable en direct (le titre du KitPanel reste stable). */}
        <div style={rowStyle}>
          <span style={labelStyle}>Nom</span>
          <input
            type="text"
            value={graph.name}
            onChange={(e) => onUpdateGraph({ name: e.target.value })}
            style={{ ...selectStyle, flex: 1, minWidth: 180 }}
          />
        </div>

        {/* R16b — variable de FAMILLE des courbes : le paramètre qui distingue
            les courbes de CE graphe (altitude pression, masse, vent…). La
            déclarer débloque la saisie de la VALEUR par courbe dans le
            gestionnaire — le moteur lit alors cette valeur structurée au lieu
            d'interpréter les NOMS de courbes (source d'erreurs silencieuses). */}
        {/* 23/08 (retour pilote) : sur un panneau de CORRECTION, les courbes
            sont des guides de pente — le moteur ne lit pas leur valeur. On ne
            réclame donc ni masse ni vent : on le dit, et c'est tout. Un
            familyAxisVariable déjà en base est conservé (compat) mais n'est
            plus exigé ni proposé. */}
        {numberedGuides ? (
          <div style={rowStyle}>
            <span style={labelStyle}>Courbes du panneau</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
              Guides de pente <strong>numérotés automatiquement</strong> — aucune valeur à saisir
              {graph.isWindRelated ? ' ; chaque guide porte son SENS (face / arrière), choisi à la création.' : '.'}
            </span>
          </div>
        ) : (
        <div style={rowStyle}>
          <span
            style={labelStyle}
            title="Le paramètre qui distingue les courbes entre elles (ex. altitude pression pour le panneau températures). Une fois choisie, chaque courbe porte sa valeur — le nom n'est plus qu'un libellé."
          >
            Variable de famille des courbes
          </span>
          {(() => {
            // Lot 1-A — liste COURTE des variables de FAMILLE (une famille n'est
            // pas un axe : la liste d'axe X entretenait la confusion). Valeur
            // stockée hors liste courte : injectée en tête avec son label normal
            // si connue du catalogue, avec « ⚠ … (legacy) » si inconnue.
            const groups = getFamilyVariablesGrouped();
            const stored = graph.familyAxisVariable || '';
            const known = getAxisVariable(stored);
            const inShortList = groups.some(g => g.items.some(v => v.id === stored));
            return (
              <select
                value={stored}
                onChange={(e) => {
                  const varId = e.target.value || undefined;
                  // Famille vent → active isWindRelated (débloque les tags face /
                  // arrière des courbes) ; jamais désactivé automatiquement.
                  onUpdateGraph({
                    familyAxisVariable: varId,
                    ...(isWindAxisVariable(varId) && !graph.isWindRelated ? { isWindRelated: true } : {})
                  });
                }}
                style={{ ...selectStyle, flex: 1, minWidth: 220 }}
              >
                <option value="">— héritée des noms de courbes (fragile) —</option>
                {stored !== '' && !known && <option value={stored}>⚠ {stored} (legacy)</option>}
                {known && !inShortList && (
                  <option value={known.id}>{known.label}{known.defaultUnit ? ` (${known.defaultUnit})` : ''}</option>
                )}
                {groups.map(g => (
                  <optgroup key={g.category} label={g.label}>
                    {g.items.map(v => (
                      <option key={v.id} value={v.id}>{v.label}{v.defaultUnit ? ` (${v.defaultUnit})` : ''}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            );
          })()}
          {(() => {
            const fam = getAxisVariable(graph.familyAxisVariable);
            return fam?.defaultUnit
              ? <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>unité : {fam.defaultUnit}</span>
              : null;
          })()}
        </div>
        )}

        {/* Lecture descendante (planches d'atterrissage Piper) : le résultat du
            dernier cadre se lit sur l'axe X, en bas. Jamais le premier cadre
            (il reçoit son entrée sur X). */}
        {!isFirst && (
          <div style={rowStyle}>
            <span
              style={labelStyle}
              title="Standard : la sortie se lit sur l'axe Y (échelle verticale). Lecture descendante : on entre avec le Y transféré, on suit le guide de la famille (ex. vent), et le résultat se lit sur l'échelle du bas (axe X). Uniquement pour le DERNIER cadre de la chaîne."
            >
              Lecture du résultat
            </span>
            <select
              value={graph.readoutAxis === 'x' ? 'x' : ''}
              onChange={(e) => onUpdateGraph({ readoutAxis: e.target.value === 'x' ? 'x' : undefined })}
              style={selectStyle}
            >
              <option value="">Sur l'axe Y (standard)</option>
              <option value="x">Sur l'axe X, en bas (descendante)</option>
            </select>
          </div>
        )}

        {/* L'OPÉRATION ne se règle plus ici : elle vit à l'écran « Opération »
            (rappel + lien « Modifier », graphes et cadres conservés). */}
        {isPrimary && (
          <div style={rowStyle}>
            <span style={labelStyle}>Opération du set</span>
            {op ? (
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }} title={op.description || undefined}>
                <strong>{op.labelFr}</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 11 }}>
                  <code>{op.id}</code>
                  {op.configuration?.flaps && ` · Flaps : ${op.configuration.flaps}`}
                </span>
              </span>
            ) : graph.operationId ? (
              <span style={{ fontSize: 11, color: 'var(--color-red-critical)', fontWeight: 600 }}>
                operationId « {graph.operationId} » inconnu du catalogue
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-red-critical)', fontWeight: 600 }}>
                aucune opération sélectionnée
              </span>
            )}
            <KitButton level="tertiary" size="compact" onClick={onEditOperation}
              title="Revenir à l'écran Opération — graphes et cadres conservés (le bouton devient « Appliquer »)">
              Modifier
            </KitButton>
          </div>
        )}

        {/* Nature de sortie quand l'opération en accepte plusieurs
            (climb_takeoff/climb_cruise) — non déductible à l'écran Opération. */}
        {isPrimary && op && op.acceptedOutputs.length > 1 && (
          <div style={rowStyle}>
            <span style={labelStyle} title="Que mesure exactement CET abaque ?">Sortie mesurée</span>
            <select
              value={graph.outputKind || ''}
              onChange={(e) => {
                const newKind = e.target.value;
                const spec = op.acceptedOutputs.find(o => o.kind === newKind);
                onUpdateGraph({
                  outputKind: newKind,
                  outputUnit: spec?.defaultUnit ?? graph.outputUnit
                });
              }}
              style={{ ...selectStyle, flex: 1, minWidth: 200 }}
            >
              <option value="">— Choisir la nature de sortie —</option>
              {op.acceptedOutputs.map(o => (
                <option key={o.kind} value={o.kind}>
                  {o.labelFr} ({o.defaultUnit}{o.alternateUnits?.length ? `, ${o.alternateUnits.join(', ')}` : ''})
                </option>
              ))}
            </select>
            {graph.outputKind && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                produit <strong>{graph.outputKind}</strong> en <strong>{graph.outputUnit}</strong>
              </span>
            )}
          </div>
        )}

        {/* LEGACY sans écran Opération : rôles hors convention (« premier
            cadre = primaire ») à corriger à la main — les radios historiques
            survivent ici, repliées. Les sets issus de l'écran Opération n'ont
            jamais besoin de ce bloc (rôles déduits). */}
        {showAdvancedRoles && (
          <details style={{
            border: '1px solid var(--border-subtle)', borderRadius: 4,
            backgroundColor: 'var(--bg-overlay)'
          }}>
            <summary style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Réglages avancés — rôle du graphique (modèle antérieur à l'écran Opération)
            </summary>
            <div style={{ ...rowStyle, padding: '4px 10px 8px', gap: 14 }}>
              <span style={labelStyle}>Rôle</span>
              <label
                title="Produit la valeur finale du set. Reçoit l'output du dernier intermédiaire et donne le résultat final."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  color: isPrimary ? 'var(--status-success)' : 'var(--text-primary)', fontWeight: isPrimary ? 600 : 400
                }}
              >
                <input
                  type="radio"
                  name={`role-${graph.id}`}
                  checked={isPrimary}
                  onChange={() => onUpdateGraph({ role: 'primary', cascadeOrder: undefined })}
                />
                Primaire — valeur finale
              </label>
              <label
                title="Étape de correction (température, masse, vent…). Son output alimente le tableau suivant dans la cascade."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  color: !isPrimary ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: !isPrimary ? 600 : 400
                }}
              >
                <input
                  type="radio"
                  name={`role-${graph.id}`}
                  checked={!isPrimary}
                  onChange={() => onUpdateGraph({ role: 'intermediate', operationId: undefined, outputKind: undefined, outputUnit: undefined })}
                />
                Intermédiaire — correction
              </label>
            </div>
          </details>
        )}

        {/* Suppression du cadre focalisé — geste existant, inchangé. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onRemoveGraph}
            title="Supprime le graphique focalisé, ses courbes et son cadre sur l'image"
            style={{
              padding: '3px 10px', fontSize: FONT.note, cursor: 'pointer',
              backgroundColor: 'transparent', color: 'var(--color-red-critical)',
              border: '1px solid var(--color-red-critical)', borderRadius: 4
            }}
          >
            Supprimer ce graphique (et son cadre)
          </button>
        </div>
      </div>
    </KitPanel>
  );
};
