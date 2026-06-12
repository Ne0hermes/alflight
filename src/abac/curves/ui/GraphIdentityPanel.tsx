// src/abac/curves/ui/GraphIdentityPanel.tsx
//
// R6 — Identité d'un graphique d'abaque : rôle dans le set (primaire /
// intermédiaire), opération canonique (operationId) et nature de sortie.
// Extrait de la sous-étape 1 du wizard (AbacGraphWizard) car cette sous-étape
// est masquée quand l'atelier « image unique » est actif — l'identité doit
// rester accessible : sans operationId sur le primaire, le set n'est PAS
// consommé par la préparation de vol (verrou de handleExportJSON).
// Monté : (1) par le builder sous le canevas pour le cadre actif,
//         (2) par le wizard en sous-étape 1 (flux historique hors atelier).

import React from 'react';
import { GraphConfig } from '../core/types';
import { getOperation, getOperationsGroupedByPhase } from '../core/operationCatalog';

interface GraphIdentityPanelProps {
  graph: GraphConfig;
  onUpdateGraph: (partial: Partial<GraphConfig>) => void;
}

export const GraphIdentityPanel: React.FC<GraphIdentityPanelProps> = ({ graph, onUpdateGraph }) => (
  <div style={{
    padding: 12,
    backgroundColor: 'rgba(242, 105, 33, 0.06)', border: '1px solid var(--border-regular)', borderRadius: 6
  }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 8 }}>
      🏷 Identité du graphique
    </div>

    {/* === Sélecteur de rôle : primaire (= produit valeur finale) ou intermédiaire (= étape de correction) === */}
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Rôle de ce graphique dans le set
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{
          flex: 1, minWidth: 220, padding: '8px 10px',
          border: `2px solid ${(graph.role || 'primary') === 'primary' ? 'var(--status-success)' : 'var(--border-subtle)'}`,
          borderRadius: 4, cursor: 'pointer',
          backgroundColor: (graph.role || 'primary') === 'primary' ? 'rgba(79, 174, 127, 0.12)' : 'var(--bg-surface)',
          display: 'flex', alignItems: 'flex-start', gap: 8
        }}>
          <input
            type="radio"
            name={`role-${graph.id}`}
            checked={(graph.role || 'primary') === 'primary'}
            onChange={() => onUpdateGraph({ role: 'primary', cascadeOrder: undefined })}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>⭐ Primaire</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Produit la valeur finale du set. Reçoit l'output du dernier intermédiaire et donne le résultat final.
            </div>
          </div>
        </label>
        <label style={{
          flex: 1, minWidth: 220, padding: '8px 10px',
          border: `2px solid ${graph.role === 'intermediate' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          borderRadius: 4, cursor: 'pointer',
          backgroundColor: graph.role === 'intermediate' ? 'rgba(242, 105, 33, 0.10)' : 'var(--bg-surface)',
          display: 'flex', alignItems: 'flex-start', gap: 8
        }}>
          <input
            type="radio"
            name={`role-${graph.id}`}
            checked={graph.role === 'intermediate'}
            onChange={() => onUpdateGraph({ role: 'intermediate', operationId: undefined, outputKind: undefined, outputUnit: undefined })}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>🔗 Intermédiaire</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Étape de correction (température, masse, vent…). Son output alimente le tableau suivant dans la cascade.
            </div>
          </div>
        </label>
      </div>
    </div>

    {/* === Si INTERMÉDIAIRE : position dans la cascade === */}
    {graph.role === 'intermediate' && (
      <label style={{ display: 'block', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
          🔗 Position de ce tableau dans la cascade de calcul
        </div>
        <select
          value={graph.cascadeOrder ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onUpdateGraph({ cascadeOrder: v === '' ? undefined : Number(v) });
          }}
          style={{
            width: '100%', padding: '6px 8px',
            border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13, backgroundColor: 'var(--bg-surface)'
          }}
        >
          <option value="">— Choisir la position —</option>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>
              Tableau intermédiaire {n}{n === 1 ? ' (premier de la cascade)' : ''}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 4, fontStyle: 'italic' }}>
          L'output de ce tableau servira d'entrée au tableau de position {(graph.cascadeOrder || 0) + 1} (ou au primaire si c'est le dernier intermédiaire).
        </div>
      </label>
    )}

    {/* === Si PRIMAIRE : dropdown opération canonique === */}
    {(graph.role || 'primary') === 'primary' && (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
        🔒 Opération canonique (Operation ID) — détermine comment cet abaque sera consommé par la préparation de vol
      </div>
      <select
        value={graph.operationId || ''}
        onChange={(e) => {
          const newOpId = e.target.value;
          const op = getOperation(newOpId);
          const onlyOutput = op?.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
          // Plus de mise à jour de graph.name : l'identification visuelle
          // se fait via le titre de l'axe X (cf. barre du haut).
          onUpdateGraph({
            operationId: newOpId,
            ...(onlyOutput ? { outputKind: onlyOutput.kind, outputUnit: onlyOutput.defaultUnit } : {})
          });
        }}
        style={{
          width: '100%', padding: '6px 8px',
          border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13, backgroundColor: 'var(--bg-surface)'
        }}
      >
        <option value="">— Choisir l'opération —</option>
        {getOperationsGroupedByPhase().map(g => (
          <optgroup key={g.phase} label={g.labelFr}>
            {g.items.map(op => (
              <option key={op.id} value={op.id}>
                {op.labelFr}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {graph.operationId && (() => {
        const op = getOperation(graph.operationId);
        if (!op) {
          return (
            <div style={{ fontSize: 11, color: 'var(--color-red-critical)', marginTop: 4, fontWeight: 600 }}>
              ⚠ operationId inconnu — vérifier le catalogue
            </div>
          );
        }
        return (
          <>
            {op.description && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                {op.description}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 4 }}>
              ID : <code>{op.id}</code> · Phase : {op.phase}
              {op.configuration?.flaps && ` · Flaps : ${op.configuration.flaps}`}
            </div>
          </>
        );
      })()}
    </label>
    )}

    {/* === Si PRIMAIRE : nature de sortie quand plusieurs acceptées (climb_takeoff/climb_cruise) === */}
    {(graph.role || 'primary') === 'primary' && graph.operationId && (() => {
      const op = getOperation(graph.operationId);
      if (!op || op.acceptedOutputs.length <= 1) return null;
      return (
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
            Nature de la sortie de CET abaque (que mesure-t-il exactement ?)
          </div>
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
            style={{
              width: '100%', padding: '6px 8px',
              border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13, backgroundColor: 'var(--bg-surface)'
            }}
          >
            <option value="">— Choisir la nature de sortie —</option>
            {op.acceptedOutputs.map(o => (
              <option key={o.kind} value={o.kind}>
                {o.labelFr} ({o.defaultUnit}{o.alternateUnits?.length ? `, ${o.alternateUnits.join(', ')}` : ''})
              </option>
            ))}
          </select>
          {graph.outputKind && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
              Cet abaque produit : <strong>{graph.outputKind}</strong> en <strong>{graph.outputUnit}</strong>
            </div>
          )}
        </label>
      );
    })()}
  </div>
);
