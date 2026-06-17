// src/abac/curves/ui/OperationClassifier.tsx
//
// R23 — Classifieur d'opération canonique PARTAGÉ : les trois listes
// déroulantes Phase / Métrique / Volets qui résolvent un `operationId` du
// catalogue. Extrait de GraphIdentityPanel (R17) pour être réutilisé À
// L'IDENTIQUE par les DEUX méthodes de saisie des performances :
//   • abaques (GraphIdentityPanel) ;
//   • extraction par tableau MANEX (PerformanceWizard).
// → même tri, même taxonomie, classification UNIFIÉE (demande pilote).
//
// Le composant émet uniquement l'operationId via onChange ; les effets de bord
// (systemType, outputKind…) restent à la charge du parent.

import React from 'react';
import {
  getOperation,
  OPERATION_CATALOG,
  OperationDefinition,
  OperationPhase
} from '../core/operationCatalog';

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

export interface OperationClassifierProps {
  /** operationId courant (vide = non classé). */
  value: string;
  /** Émis quand la résolution Phase+Métrique+Volets aboutit à une opération. */
  onChange: (operationId: string) => void;
  /** Disposition : ligne (panneau abaque) ou colonne (overlay vignette). */
  direction?: 'row' | 'column';
  /** Styles réduits (vignette MANEX). */
  compact?: boolean;
  /** Affiche le libellé « Opération ». */
  showLabel?: boolean;
  /** Style additionnel sur le conteneur. */
  style?: React.CSSProperties;
}

export const OperationClassifier: React.FC<OperationClassifierProps> = ({
  value, onChange, direction = 'row', compact = false, showLabel = false, style
}) => {
  const currentOp = value ? getOperation(value) : undefined;
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

  const selectStyle: React.CSSProperties = {
    padding: compact ? '3px 5px' : '4px 8px',
    fontSize: compact ? 11 : 12,
    borderRadius: 3,
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    width: direction === 'column' ? '100%' : undefined
  };

  const apply = (op: OperationDefinition | undefined) => { if (op) onChange(op.id); };
  const onPhase = (p: string) => {
    if (!p) { onChange(''); return; }
    const first = OPERATION_CATALOG.find(op => op.phase === p);
    if (first) apply(resolveOperation(p, metricOf(first), flapsOf(first)) || first);
  };
  const onMetric = (m: string) => {
    const candidates = OPERATION_CATALOG.filter(op => op.phase === phaseSel && metricOf(op) === m);
    if (candidates.length) apply(candidates.find(op => flapsOf(op) === flapsSel) || candidates[0]);
  };
  const onFlaps = (f: string) => apply(resolveOperation(phaseSel, metricSel, f));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'column' ? 'column' : 'row',
        gap: compact ? 4 : 8,
        alignItems: direction === 'column' ? 'stretch' : 'center',
        flexWrap: direction === 'row' ? 'wrap' : 'nowrap',
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {showLabel && (
        <span
          style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
          title="Phase + métrique + état des volets = dénomination canonique unique (consommée par la préparation de vol)."
        >
          Opération
        </span>
      )}
      <select value={phaseSel} onChange={(e) => onPhase(e.target.value)} style={{ ...selectStyle, minWidth: direction === 'row' ? 120 : undefined }}>
        <option value="">— Phase —</option>
        {phases.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
      </select>
      <select value={metricSel} onChange={(e) => onMetric(e.target.value)} disabled={!phaseSel} style={{ ...selectStyle, minWidth: direction === 'row' ? 180 : undefined, opacity: phaseSel ? 1 : 0.5 }}>
        <option value="">— Métrique —</option>
        {metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      {(flapsOptions.length > 1 || (flapsSel && flapsSel !== '__none__')) && (
        <select
          value={flapsSel}
          onChange={(e) => onFlaps(e.target.value)}
          disabled={!metricSel}
          style={{ ...selectStyle, minWidth: direction === 'row' ? 150 : undefined, opacity: metricSel ? 1 : 0.5, borderColor: flapsSel === '__none__' ? 'var(--color-red-critical)' : 'var(--border-subtle)' }}
        >
          {flapsOptions.map(f => <option key={f} value={f}>{FLAPS_LABELS[f] || f}</option>)}
        </select>
      )}
      {flapsSel === '__none__' && flapsOptions.length > 1 && (
        <span style={{ fontSize: compact ? 9 : 11, fontWeight: 600, color: 'var(--color-red-critical)' }}>
          précise les volets
        </span>
      )}
    </div>
  );
};
