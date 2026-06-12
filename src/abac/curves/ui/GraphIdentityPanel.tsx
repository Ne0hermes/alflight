// src/abac/curves/ui/GraphIdentityPanel.tsx
//
// R6 — Identité d'un graphique d'abaque : rôle dans le set (primaire /
// intermédiaire), opération canonique (operationId) et nature de sortie.
// Extrait de la sous-étape 1 du wizard car cette sous-étape est masquée quand
// l'atelier « image unique » est actif — l'identité doit rester accessible :
// sans operationId sur le primaire, le set n'est PAS consommé par la
// préparation de vol (verrou de handleExportJSON).
// R9 — version COMPACTE (demande pilote) : sans icônes, descriptions en
// infobulles, lignes denses. Monté par le builder dans une zone repliable
// AU-DESSUS de l'atelier (et par la sous-étape 1 du flux legacy).

import React from 'react';
import { GraphConfig } from '../core/types';
import { getOperation, OPERATION_CATALOG, OperationDefinition, OperationPhase } from '../core/operationCatalog';
import { getAxisVariable, getAxisVariablesGroupedFor } from '../core/axisVariables';

// ─── R17 : décomposition phase / métrique / volets du catalogue ───
// Deux abaques d'un même avion peuvent différer UNIQUEMENT par les volets
// (PA-28 : décollage 0° et 25°). Le sélecteur plat rendait ça invisible →
// trois listes déroulantes (demande pilote) qui RÉSOLVENT vers l'operationId.
const PHASE_LABELS: Record<OperationPhase, string> = {
  takeoff: 'Décollage', climb: 'Montée', cruise: 'Croisière', descent: 'Descente', landing: 'Atterrissage'
};
const METRIC_LABELS: Record<string, string> = {
  '50ft': 'Passage 15 m (50 ft)',
  'ground_roll': 'Roulage (sol)'
};
const FLAPS_LABELS: Record<string, string> = {
  UP: 'Flaps UP (0°)', TAKEOFF: 'Flaps TAKEOFF', APPROACH: 'Flaps APPROACH', LANDING: 'Flaps LANDING',
  __none__: 'Non précisé (hérité)'
};
const metricOf = (op: OperationDefinition): string =>
  op.id.includes('50ft') ? '50ft' : op.id.includes('ground_roll') ? 'ground_roll' : op.id;
const metricLabelOf = (op: OperationDefinition): string =>
  METRIC_LABELS[metricOf(op)] || op.labelFr;
const flapsOf = (op: OperationDefinition): string => op.configuration?.flaps ?? '__none__';
const resolveOperation = (phase: string, metric: string, flaps: string): OperationDefinition | undefined =>
  OPERATION_CATALOG.find(op => op.phase === phase && metricOf(op) === metric && flapsOf(op) === flaps);

interface GraphIdentityPanelProps {
  graph: GraphConfig;
  onUpdateGraph: (partial: Partial<GraphConfig>) => void;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12, borderRadius: 3,
  border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap'
};

export const GraphIdentityPanel: React.FC<GraphIdentityPanelProps> = ({ graph, onUpdateGraph }) => {
  const isPrimary = (graph.role || 'primary') === 'primary';
  const op = graph.operationId ? getOperation(graph.operationId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      {/* Rôle — ligne unique, descriptions en infobulle */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
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

        {/* Si INTERMÉDIAIRE : position dans la cascade, sur la même ligne */}
        {!isPrimary && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle} title="L'output de ce tableau sert d'entrée au tableau suivant (ou au primaire si c'est le dernier intermédiaire).">
              Position dans la cascade
            </span>
            <select
              value={graph.cascadeOrder ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onUpdateGraph({ cascadeOrder: v === '' ? undefined : Number(v) });
              }}
              style={selectStyle}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>Tableau {n}{n === 1 ? ' (premier)' : ''}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* R16b — variable de FAMILLE des courbes : le paramètre qui distingue
          les courbes de CE graphe (altitude pression, masse, vent…). La
          déclarer débloque la saisie de la VALEUR par courbe dans le
          gestionnaire — le moteur lit alors cette valeur structurée au lieu
          d'interpréter les NOMS de courbes (source d'erreurs silencieuses). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={labelStyle}
          title="Le paramètre qui distingue les courbes entre elles (ex. altitude pression pour le panneau températures). Une fois choisie, chaque courbe porte sa valeur — le nom n'est plus qu'un libellé."
        >
          Variable de famille des courbes
        </span>
        <select
          value={graph.familyAxisVariable || ''}
          onChange={(e) => onUpdateGraph({ familyAxisVariable: e.target.value || undefined })}
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        >
          <option value="">— héritée des noms de courbes (fragile) —</option>
          {getAxisVariablesGroupedFor('x').map(g => (
            <optgroup key={g.category} label={g.label}>
              {g.items.map(v => (
                <option key={v.id} value={v.id}>{v.label}{v.defaultUnit ? ` (${v.defaultUnit})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {(() => {
          const fam = getAxisVariable(graph.familyAxisVariable);
          return fam?.defaultUnit
            ? <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>unité : {fam.defaultUnit}</span>
            : null;
        })()}
      </div>

      {/* Si PRIMAIRE : opération canonique — R17 : TROIS listes déroulantes
          (phase / métrique / volets) qui résolvent l'operationId. L'état des
          volets fait partie de la dénomination : deux abaques d'un même avion
          ne peuvent plus porter le même nom. */}
      {isPrimary && (() => {
        const currentOp = graph.operationId ? getOperation(graph.operationId) : undefined;
        const phaseSel = currentOp?.phase || '';
        const metricSel = currentOp ? metricOf(currentOp) : '';
        const flapsSel = currentOp ? flapsOf(currentOp) : '';

        const phases = [...new Set(OPERATION_CATALOG.map(op => op.phase))];
        const metrics = phaseSel
          ? [...new Map(OPERATION_CATALOG.filter(op => op.phase === phaseSel).map(op => [metricOf(op), metricLabelOf(op)])).entries()]
          : [];
        const flapsOptions = phaseSel && metricSel
          ? [...new Set(OPERATION_CATALOG.filter(op => op.phase === phaseSel && metricOf(op) === metricSel).map(flapsOf))]
          : [];

        const apply = (op: OperationDefinition | undefined) => {
          if (!op) return;
          const onlyOutput = op.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
          onUpdateGraph({
            operationId: op.id,
            ...(onlyOutput ? { outputKind: onlyOutput.kind, outputUnit: onlyOutput.defaultUnit } : {})
          });
        };
        // Choisir une phase/métrique re-résout avec le premier volet dispo ;
        // choisir un volet re-résout à iso phase/métrique.
        const onPhase = (p: string) => {
          const first = OPERATION_CATALOG.find(op => op.phase === p);
          if (first) apply(resolveOperation(p, metricOf(first), flapsOf(first)) || first);
        };
        const onMetric = (m: string) => {
          const candidates = OPERATION_CATALOG.filter(op => op.phase === phaseSel && metricOf(op) === m);
          if (candidates.length) apply(candidates.find(op => flapsOf(op) === flapsSel) || candidates[0]);
        };
        const onFlaps = (f: string) => apply(resolveOperation(phaseSel, metricSel, f));

        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={labelStyle}
              title="Détermine comment cet abaque sera consommé par la préparation de vol. Phase + métrique + état des volets = dénomination unique."
            >
              Opération
            </span>
            <select value={phaseSel} onChange={(e) => onPhase(e.target.value)} style={{ ...selectStyle, minWidth: 120 }}>
              <option value="">— Phase —</option>
              {phases.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
            </select>
            <select value={metricSel} onChange={(e) => onMetric(e.target.value)} disabled={!phaseSel} style={{ ...selectStyle, minWidth: 180, opacity: phaseSel ? 1 : 0.5 }}>
              <option value="">— Métrique —</option>
              {metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {flapsOptions.length > 1 || (flapsSel && flapsSel !== '__none__') ? (
              <select value={flapsSel} onChange={(e) => onFlaps(e.target.value)} disabled={!metricSel} style={{ ...selectStyle, minWidth: 150, opacity: metricSel ? 1 : 0.5, borderColor: flapsSel === '__none__' ? 'var(--color-red-critical)' : 'var(--border-subtle)' }}>
                {flapsOptions.map(f => <option key={f} value={f}>{FLAPS_LABELS[f] || f}</option>)}
              </select>
            ) : null}
            {flapsSel === '__none__' && flapsOptions.length > 1 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-red-critical)' }}>
                précise les volets
              </span>
            )}
          </div>
        );
      })()}

      {isPrimary && graph.operationId && !op && (
        <div style={{ fontSize: 11, color: 'var(--color-red-critical)', fontWeight: 600 }}>
          operationId inconnu — vérifier le catalogue
        </div>
      )}
      {isPrimary && op && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }} title={op.description || undefined}>
          ID : <code>{op.id}</code> · Phase : {op.phase}
          {op.configuration?.flaps && ` · Flaps : ${op.configuration.flaps}`}
        </div>
      )}

      {/* Si PRIMAIRE : nature de sortie quand plusieurs acceptées (climb_takeoff/climb_cruise) */}
      {isPrimary && op && op.acceptedOutputs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
    </div>
  );
};
