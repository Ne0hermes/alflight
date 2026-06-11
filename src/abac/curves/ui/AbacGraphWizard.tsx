// src/abac/curves/ui/AbacGraphWizard.tsx
//
// Mini-wizard de création d'un graphique d'abaque, 5 sous-étapes :
//   1. Image       — upload du filigrane
//   2. Position    — drag + 8 poignées pour caler l'image
//   3. Axes        — min/max/pas/titre/unité pour X et Y
//   4. Calibration — clic sur graduations de l'image (optionnel)
//   5. Courbes     — workflow guidé (Option A) : créer courbe → cliquer points → terminer → courbe suivante
//
// Navigation libre Précédent / Suivant. State machine pour les modes (un seul actif).

import React, { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chart, AxisTickCalibration, BackgroundImage } from './Chart';
import {
  BezierOverrides,
  applyBezierOverrides,
  fitBezierThroughPoints,
  sampleBezierSegments
} from '../core/bezier';
import { CurveManager } from './CurveManager';
import { PointsTable } from './PointsTable';
import { AxesConfig, Curve, GraphConfig, XYPoint, WindDirection } from '../core/types';
import { AXIS_VARIABLES, getAxisVariable, getAxisVariablesGrouped, getAxisVariablesGroupedFor, isWindAxisVariable } from '../core/axisVariables';
import { GRAPH_TYPES, getGraphType, getGraphTypeLabel, getGraphTypesGrouped } from '../core/graphTypes';
import {
  OPERATION_CATALOG,
  getOperation,
  getOperationLabel,
  getOperationsGroupedByPhase
} from '../core/operationCatalog';

export type WizardSubStep = 'image' | 'position' | 'axes' | 'calibration' | 'curves';
export type EditorMode = 'idle' | 'adjusting-image' | 'calibrating-x' | 'calibrating-y' | 'placing-points' | 'bezier-handles';

const SUB_STEPS: { id: WizardSubStep; label: string; icon: string }[] = [
  { id: 'image',       label: '1. Image',         icon: '📷' },
  { id: 'position',    label: '2. Position',      icon: '✥' },
  { id: 'axes',        label: '3. Axes',          icon: '📐' },
  { id: 'calibration', label: '4. Calibration',   icon: '🎯' },
  { id: 'curves',      label: '5. Courbes',       icon: '✏️' }
];

interface AbacGraphWizardProps {
  graph: GraphConfig;
  graphIndex: number;
  totalGraphs: number;

  backgroundImage: BackgroundImage | null;
  customAxisTicks: { x?: AxisTickCalibration[]; y?: AxisTickCalibration[] } | undefined;
  chartSize: { width: number; height: number };
  selectedCurveId: string | null;

  onUpdateGraph: (partial: Partial<GraphConfig>) => void;
  onSetBackgroundImage: (img: BackgroundImage | null) => void;
  onSetCustomAxisTicks: (axis: 'x' | 'y', ticks: AxisTickCalibration[] | null) => void;
  onSetChartSize: (size: { width: number; height: number } | null) => void;
  onSelectCurve: (id: string | null) => void;

  onAddCurve: (name: string, color: string, windDirection?: WindDirection) => string;
  onRemoveCurve: (curveId: string) => void;
  onUpdateCurve: (curveId: string, updates: Partial<Curve>) => void;
  onReorderCurves: (oldIndex: number, newIndex: number) => void;

  onPointClick: (x: number, y: number) => void;
  onPointDrag: (curveId: string, pointId: string, x: number, y: number) => void;
  onPointDelete: (curveId: string, pointId: string) => void;

  onPreviousGraph: () => void;
  onNextGraph: () => void;
  onAddGraph: () => void;
  onRemoveGraph?: () => void;
  onFinish: () => void;
  /** Atelier multi-graphes (P2) : la navigation entre graphes se fait par le
   *  bandeau d'aperçus du builder — masque les boutons ◀ ▶ par index. */
  hideGraphNav?: boolean;
  /** R2a — Atelier « image unique » actif : l'image et son positionnement
   *  vivent sur le CANEVAS du builder (une seule image pour le set) → les
   *  sous-étapes « Image » et « Position » du wizard sont masquées. */
  hideImageSubSteps?: boolean;
}

export const AbacGraphWizard: React.FC<AbacGraphWizardProps> = (props) => {
  const {
    graph, graphIndex, totalGraphs,
    backgroundImage, customAxisTicks, chartSize, selectedCurveId,
    onUpdateGraph, onSetBackgroundImage, onSetCustomAxisTicks, onSetChartSize, onSelectCurve,
    onAddCurve, onRemoveCurve, onUpdateCurve, onReorderCurves,
    onPointClick, onPointDrag, onPointDelete,
    onPreviousGraph, onNextGraph, onAddGraph, onRemoveGraph, onFinish,
    hideGraphNav, hideImageSubSteps
  } = props;

  // R2a — sous-étapes réellement proposées : sans « Image »/« Position » quand
  // l'atelier image unique est actif (l'image vit sur le canevas du builder).
  const visibleSubSteps = hideImageSubSteps
    ? SUB_STEPS.filter(s => s.id !== 'image' && s.id !== 'position')
    : SUB_STEPS;

  const [subStep, setSubStep] = useState<WizardSubStep>(hideImageSubSteps ? 'axes' : 'image');
  const [editorMode, setEditorMode] = useState<EditorMode>('idle');

  // R2a — si l'atelier devient actif PENDANT qu'on est sur une sous-étape
  // image/position (ex. import de l'image du set sur le canevas), on bascule
  // sur la première sous-étape encore visible.
  React.useEffect(() => {
    if (hideImageSubSteps && (subStep === 'image' || subStep === 'position')) {
      setEditorMode('idle');
      setCalibrationSession(null);
      setSubStep('axes');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideImageSubSteps, subStep]);
  const [calibrationSession, setCalibrationSession] = useState<null | {
    axis: 'x' | 'y';
    values: number[];
    index: number;
    collected: AxisTickCalibration[];
  }>(null);

  // === Calculs dérivés ===

  const axesConfig: AxesConfig = graph.axes || {
    xAxis: { min: 0, max: 100, step: 10, title: 'X', unit: '' },
    yAxis: { min: 0, max: 100, step: 10, title: 'Y', unit: '' }
  };

  // === Reset éditeur mode quand on change de sous-étape ===
  const goToSubStep = useCallback((next: WizardSubStep) => {
    setEditorMode('idle');
    setCalibrationSession(null);
    setSubStep(next);
  }, []);

  // === Image upload ===
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      // Position initiale : centre dans la zone inner (margins du Chart : top:40, right:40, bottom:60, left:60)
      const innerW = Math.max(100, chartSize.width - 100);
      const innerH = Math.max(100, chartSize.height - 100);
      onSetBackgroundImage({ url, x: 0, y: 0, width: innerW, height: innerH });
      goToSubStep('position');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // === Calibration ===
  /**
   * Construit la liste des valeurs de graduations entre min et max selon le pas.
   * Si `reversed` est fourni, retourne les valeurs dans l'ordre **visuel** :
   *   X non-reversed : gauche → droite = [min, min+pas, …, max]
   *   X reversed     : gauche → droite = [max, max-pas, …, min]
   *   Y non-reversed : haut → bas      = [max, max-pas, …, min]  (convention math)
   *   Y reversed     : haut → bas      = [min, min+pas, …, max]
   */
  const buildAxisValues = (min: number, max: number, step: number, reversed?: boolean, axis: 'x' | 'y' = 'x') => {
    if (!isFinite(step) || step <= 0) return reversed ? [max, min] : [min, max];
    const values: number[] = [];
    const eps = step * 1e-6;
    for (let v = min; v <= max + eps; v += step) values.push(parseFloat(v.toFixed(10)));
    if (values[values.length - 1] < max - eps) values.push(max);
    // Ordre visuel : X par défaut croissant gauche→droite, Y par défaut décroissant haut→bas.
    const visualReversed = axis === 'x' ? !!reversed : !reversed;
    if (visualReversed) values.reverse();
    return values;
  };

  const startCalibration = (axis: 'x' | 'y') => {
    const cfg = axis === 'x' ? axesConfig.xAxis : axesConfig.yAxis;
    if (!cfg.step) {
      alert(`Définis d'abord le pas de l'axe ${axis.toUpperCase()} à l'étape 3.`);
      return;
    }
    // Ordre visuel : l'utilisateur clique dans le sens gauche→droite (X) ou haut→bas (Y).
    const values = buildAxisValues(cfg.min, cfg.max, cfg.step, cfg.reversed, axis);
    setCalibrationSession({ axis, values, index: 0, collected: [] });
    setEditorMode(axis === 'x' ? 'calibrating-x' : 'calibrating-y');
  };

  const handleCalibrationClick = useCallback((pixelInner: { x: number; y: number }) => {
    if (!calibrationSession) return;
    const { axis, values, index, collected } = calibrationSession;
    const value = values[index];
    const pixel = axis === 'x' ? pixelInner.x : pixelInner.y;
    const newCollected = [...collected, { value, pixel }];
    if (index + 1 >= values.length) {
      // Commit + sortie
      onSetCustomAxisTicks(axis, newCollected);
      setCalibrationSession(null);
      setEditorMode('idle');
      return;
    }
    setCalibrationSession({ ...calibrationSession, index: index + 1, collected: newCollected });
  }, [calibrationSession, onSetCustomAxisTicks]);

  // === Création de courbe guidée (Option A) ===
  const [newCurveName, setNewCurveName] = useState('');
  const [newCurveColor, setNewCurveColor] = useState('#F26921');

  const handleStartCurve = () => {
    if (!newCurveName.trim()) {
      alert('Donne un nom à la courbe (ex: "0 ft", "20°C")');
      return;
    }
    const id = onAddCurve(newCurveName.trim(), newCurveColor);
    onSelectCurve(id);
    setNewCurveName('');
    setEditorMode('placing-points');
  };

  const handleFinishCurve = () => {
    onSelectCurve(null);
    setEditorMode('idle');
  };

  const selectedCurve = selectedCurveId ? graph.curves.find(c => c.id === selectedCurveId) : null;

  // === P2b — Mode Bézier (recyclé du prototype v2) ===
  // Les segments de base passent EXACTEMENT par les points cliqués de la courbe ;
  // le pilote tire les poignées cp1/cp2 (overrides par index de segment) pour
  // affiner le tracé localement. « Appliquer » échantillonne en points ordinaires
  // → le pipeline (interpolation, cascade, sauvegarde) reste inchangé.
  const [bezierOverrides, setBezierOverrides] = useState<BezierOverrides>({});

  const bezierSegments = useMemo(() => {
    if (editorMode !== 'bezier-handles' || !selectedCurve || selectedCurve.points.length < 2) return null;
    return applyBezierOverrides(fitBezierThroughPoints(selectedCurve.points), bezierOverrides);
  }, [editorMode, selectedCurve, bezierOverrides]);

  const handleStartBezier = () => {
    setBezierOverrides({});
    setEditorMode('bezier-handles');
  };

  const handleCancelBezier = () => {
    setBezierOverrides({});
    setEditorMode('idle');
  };

  const handleApplyBezier = () => {
    if (!selectedCurve || !bezierSegments || bezierSegments.length === 0) return;
    // 6 échantillons par segment → fidèle au tracé, assez sobre pour le tableau
    // de points. fitted est invalidé : l'interpolation se refera sur ces points.
    const sampled = sampleBezierSegments(bezierSegments, 6).map(p => ({ ...p, id: uuidv4() }));
    if (sampled.length >= 2) {
      onUpdateCurve(selectedCurve.id, { points: sampled, fitted: undefined });
    }
    setBezierOverrides({});
    setEditorMode('idle');
  };

  // === Rendu de la barre de sous-étapes ===
  const renderSubStepBar = () => (
    <div style={{ marginBottom: 12 }}>
      {/* Ligne 1 : pagination des graphiques */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px', marginBottom: 8,
        backgroundColor: 'var(--bg-overlay)', borderRadius: 6, alignItems: 'center', flexWrap: 'wrap',
        borderLeft: '4px solid var(--accent-primary)'
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Graphique {graphIndex + 1} / {totalGraphs}
          {/* Affichage des axes (variables canoniques posées en sous-étape 3)
              à la place d'un nom libre. */}
          {(graph.axes?.xAxis?.title || graph.axes?.yAxis?.title) && (() => {
            const xVar = getAxisVariable(graph.axes?.xAxis?.title);
            const yVar = getAxisVariable(graph.axes?.yAxis?.title);
            const xLabel = xVar?.label || graph.axes?.xAxis?.title || '—';
            const yLabel = yVar?.label || graph.axes?.yAxis?.title || '—';
            return (
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', marginLeft: 6, fontSize: 12 }}>
                — X : {xLabel} / Y : {yLabel}
              </span>
            );
          })()}
          {graph.role === 'intermediate' && (
            <span style={{
              marginLeft: 8, padding: '2px 6px', fontSize: 10, fontWeight: 600,
              backgroundColor: 'rgba(242, 105, 33, 0.10)', color: 'var(--accent-primary)', borderRadius: 3
            }}>
              🔗 Tableau {graph.cascadeOrder ?? '?'} (intermédiaire)
            </span>
          )}
          {graph.operationId && (graph.role || 'primary') === 'primary' && (
            <span style={{
              marginLeft: 8, padding: '2px 6px', fontSize: 10, fontWeight: 600,
              backgroundColor: 'rgba(79, 174, 127, 0.12)', color: 'var(--status-success)', borderRadius: 3
            }}>
              ⭐ {graph.operationId}
            </span>
          )}
        </span>
        {/* Atelier P2 : navigation par le bandeau d'aperçus — les ◀ ▶ par index
            ne s'affichent que hors atelier (compat anciens montages). */}
        {!hideGraphNav && (
          <button
            onClick={onPreviousGraph}
            disabled={graphIndex === 0}
            title="Graphique précédent"
            style={{ ...btnStyle('var(--text-secondary)', true), padding: '4px 8px', opacity: graphIndex === 0 ? 0.4 : 1 }}
          >
            ◀
          </button>
        )}
        {!hideGraphNav && (
          <button
            onClick={onNextGraph}
            disabled={graphIndex >= totalGraphs - 1}
            title="Graphique suivant"
            style={{ ...btnStyle('var(--text-secondary)', true), padding: '4px 8px', opacity: graphIndex >= totalGraphs - 1 ? 0.4 : 1 }}
          >
            ▶
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onAddGraph}
          title="Créer un nouveau graphique vide et l'ouvrir"
          style={btnStyle('var(--accent-primary)')}
        >
          + Ajouter un graphique
        </button>
        {onRemoveGraph && totalGraphs > 1 && (
          <button
            onClick={() => {
              if (confirm(`Supprimer le graphique ${graphIndex + 1} ? Cette action est irréversible.`)) {
                onRemoveGraph();
              }
            }}
            title="Supprimer ce graphique"
            style={btnStyle('var(--color-red-critical)', true)}
          >
            🗑 Supprimer ce graphique
          </button>
        )}
      </div>

      {/* Ligne 2 : sous-étapes du graphique courant */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        backgroundColor: 'var(--bg-overlay)', borderRadius: 6, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, marginRight: 4, color: 'var(--text-secondary)' }}>
          Sous-étapes :
        </span>
        {visibleSubSteps.map((s, idx) => {
          const active = s.id === subStep;
          const done = visibleSubSteps.findIndex(x => x.id === subStep) > idx;
          return (
            <React.Fragment key={s.id}>
              {idx > 0 && <span style={{ color: 'var(--text-tertiary)' }}>→</span>}
              <button
                onClick={() => goToSubStep(s.id)}
                style={{
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                  backgroundColor: active ? 'var(--accent-primary)' : done ? 'rgba(79, 174, 127, 0.12)' : 'var(--bg-surface)',
                  color: active ? 'white' : done ? 'var(--status-success)' : 'var(--text-secondary)',
                  border: '1px solid', borderColor: active ? 'var(--accent-primary)' : done ? 'var(--status-success)' : 'var(--border-subtle)',
                  borderRadius: 4, fontWeight: active ? 600 : 400
                }}
              >
                {s.icon} {s.label} {done ? '✓' : ''}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // === Rendu Chart commun (réutilisé partout sauf substep image) ===
  const renderChart = (interactive = true, height?: number) => (
    <div style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-subtle)', borderRadius: 4, backgroundColor: 'var(--bg-surface)' }}>
      <Chart
        axesConfig={axesConfig}
        curves={graph.curves}
        selectedCurveId={interactive ? selectedCurveId : null}
        // Ajouter un point : verrouillé au mode "placement" pour éviter les clics fantômes hors-intention.
        onPointClick={interactive && editorMode === 'placing-points' ? onPointClick : undefined}
        // Déplacer / supprimer un point existant : autorisé dès qu'une courbe est sélectionnée,
        // dans n'importe quel mode (la courbe doit être active pour que la cible soit identifiée).
        onPointDrag={interactive && selectedCurveId ? onPointDrag : undefined}
        onPointDelete={interactive && selectedCurveId ? onPointDelete : undefined}
        responsive={false}
        width={chartSize.width}
        height={height ?? chartSize.height}
        backgroundImage={backgroundImage}
        imageAdjustMode={editorMode === 'adjusting-image'}
        onBackgroundImageChange={(img) => onSetBackgroundImage(img)}
        customXTicks={customAxisTicks?.x}
        customYTicks={customAxisTicks?.y}
        calibrationMode={editorMode === 'calibrating-x' ? 'x' : editorMode === 'calibrating-y' ? 'y' : null}
        onCalibrationClick={handleCalibrationClick}
        bezierOverlay={interactive ? bezierSegments : null}
        onBezierHandleDrag={interactive && editorMode === 'bezier-handles' ? (segIdx, which, x, y) => {
          setBezierOverrides(prev => ({ ...prev, [segIdx]: { ...(prev[segIdx] || {}), [which]: { x, y } } }));
        } : undefined}
      />
    </div>
  );

  // === Rendu sous-étapes ===
  const renderSubStep = () => {
    switch (subStep) {
      case 'image':
        return (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>📷 Étape 1 : Identifier &amp; importer le graphique</h3>

            {/* === Identité du graphique : type canonique + nom libre === */}
            <div style={{
              padding: 12, marginBottom: 16,
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

            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Charge l'image (PDF rasterisé ou PNG/JPG) du graphique d'abaque que tu veux digitaliser.
              Elle servira de référence visuelle pour positionner les points.
            </p>
            {backgroundImage ? (
              <div style={{ marginBottom: 16 }}>
                <img src={backgroundImage.url} alt="Aperçu" style={{ maxWidth: 300, maxHeight: 200, border: '1px solid var(--border-subtle)', borderRadius: 4 }} />
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer' }}>
                    Changer l'image
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <label style={{
                display: 'block', padding: 32, border: '2px dashed var(--border-regular)', borderRadius: 8,
                textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--bg-overlay)', maxWidth: 500
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Clique pour choisir une image</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>PNG, JPG ou page de PDF rasterisée</div>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            )}
          </div>
        );

      case 'position':
        return (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>✥ Étape 2 : Positionner l'image</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Active le mode ajustement pour glisser l'image et utiliser les 8 poignées (4 coins + 4 milieux de bord).
              Cale grossièrement — la précision se fera à l'étape 4 (Calibration).
            </p>
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setEditorMode(editorMode === 'adjusting-image' ? 'idle' : 'adjusting-image')}
                style={{
                  padding: '8px 14px',
                  backgroundColor: editorMode === 'adjusting-image' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: editorMode === 'adjusting-image' ? 'white' : 'var(--accent-primary)',
                  border: '1px solid var(--accent-primary)', borderRadius: 4, cursor: 'pointer', fontWeight: 500
                }}
              >
                {editorMode === 'adjusting-image' ? '✓ Terminer l\'ajustement' : '✥ Activer l\'ajustement de l\'image'}
              </button>
              {!backgroundImage && (
                <span style={{ marginLeft: 12, color: 'var(--color-red-critical)' }}>⚠ Charge d'abord une image à l'étape 1</span>
              )}
            </div>
            {backgroundImage && renderChart(false)}
          </div>
        );

      case 'axes':
        return (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>📐 Étape 3 : Définir les axes</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Renseigne <strong>Min</strong>, <strong>Max</strong> et <strong>Pas</strong> pour chaque axe.
              La première graduation = Min (pas forcément 0). Les graduations sont générées : Min, Min+Pas, Min+2×Pas, …, Max.
            </p>
            {graph.isWindRelated && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-regular)', borderRadius: 6,
                fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span>💨</span>
                <strong>Graphique vent activé</strong> — chaque courbe pourra être marquée
                « Vent de face ↑ » ou « Vent arrière ↓ » à la sous-étape 5.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
              {(['x', 'y'] as const).map(axis => {
                const cfg = axis === 'x' ? axesConfig.xAxis : axesConfig.yAxis;
                const setCfg = (partial: Partial<typeof cfg>) => {
                  onUpdateGraph({
                    axes: {
                      ...axesConfig,
                      [axis === 'x' ? 'xAxis' : 'yAxis']: { ...cfg, ...partial }
                    }
                  });
                };
                const selectedVar = getAxisVariable(cfg.title);

                // R2b — Atelier « image unique » : l'axe Y est COMMUN à tous les
                // cadres et se règle UNE fois sur le canevas (panneau Y COMMUN).
                // Ici, simple vitrine en lecture seule (le sync du builder
                // écraserait toute saisie locale — on ne tend pas ce piège).
                if (axis === 'y' && hideImageSubSteps) {
                  return (
                    <div key={axis} style={{ padding: 12, border: '1px solid var(--accent-primary)', borderRadius: 6, backgroundColor: 'rgba(242, 105, 33, 0.06)' }}>
                      <h4 style={{ marginTop: 0 }}>Axe Y — COMMUN au set</h4>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        L'axe Y est partagé par tous les cadres de l'abaque : il se règle
                        <strong> une fois</strong> dans le panneau « Y COMMUN » du canevas, pas ici.
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                        {cfg.title || '—'} {cfg.unit ? `(${cfg.unit})` : ''} · {cfg.min} → {cfg.max}
                        {cfg.step ? ` · pas ${cfg.step}` : ''}{cfg.reversed ? ' · inversé' : ''}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={axis} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 6, backgroundColor: 'var(--bg-overlay)' }}>
                    <h4 style={{ marginTop: 0 }}>Axe {axis.toUpperCase()}</h4>
                    <AxisVariableSelect
                      label="Variable (titre)"
                      axis={axis}
                      value={cfg.title}
                      onChange={(varId) => {
                        const v = getAxisVariable(varId);
                        // Auto-remplit l'unité si elle est vide ou si l'utilisateur change de variable.
                        const nextUnit = v?.defaultUnit ?? cfg.unit;
                        // Construit la config d'axes mise à jour
                        const nextAxes: AxesConfig = {
                          ...axesConfig,
                          [axis === 'x' ? 'xAxis' : 'yAxis']: { ...cfg, title: varId, unit: nextUnit }
                        };
                        // Auto-détection "graphique vent" : si X ou Y devient une variable
                        // de la famille vent, on active isWindRelated (jamais désactivé auto
                        // pour ne pas perdre les windDirection déjà saisies sur les courbes).
                        const otherAxisTitle = axis === 'x' ? axesConfig.yAxis.title : axesConfig.xAxis.title;
                        const shouldBeWind = isWindAxisVariable(varId) || isWindAxisVariable(otherAxisTitle);
                        const nextIsWindRelated = shouldBeWind ? true : graph.isWindRelated;
                        onUpdateGraph({
                          axes: nextAxes,
                          ...(nextIsWindRelated !== graph.isWindRelated ? { isWindRelated: nextIsWindRelated } : {})
                        });
                      }}
                    />
                    {selectedVar?.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 6 }}>
                        {selectedVar.description}
                      </div>
                    )}
                    <Field label="Unité" value={cfg.unit} onChange={v => setCfg({ unit: v })} />
                    <Field label="Min" value={String(cfg.min)} onChange={v => setCfg({ min: Number(v) || 0 })} type="number" />
                    <Field label="Max" value={String(cfg.max)} onChange={v => setCfg({ max: Number(v) || 0 })} type="number" />
                    <Field label="Pas" value={String(cfg.step ?? '')} onChange={v => setCfg({ step: Number(v) || undefined })} type="number" />
                    {/* Sens de l'axe — utile p.ex. pour une masse qui décroît de gauche à droite */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)', marginBottom: 6, cursor: 'pointer', padding: '4px 0' }}>
                      <input
                        type="checkbox"
                        checked={!!cfg.reversed}
                        onChange={e => setCfg({ reversed: e.target.checked })}
                      />
                      <span>
                        {axis === 'x'
                          ? `Ordre décroissant (Max à gauche → Min à droite)`
                          : `Ordre décroissant (Min en haut → Max en bas)`}
                      </span>
                    </label>
                    {cfg.step && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {(() => {
                          const vals = buildAxisValues(cfg.min, cfg.max, cfg.step, cfg.reversed, axis);
                          const arrow = axis === 'x'
                            ? (cfg.reversed ? '(gauche → droite)' : '(gauche → droite)')
                            : (cfg.reversed ? '(haut → bas)' : '(haut → bas)');
                          return (
                            <>Graduations {arrow} : {vals.slice(0, 8).join(', ')}{vals.length > 8 ? '…' : ''}</>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* === Mode d'interpolation === */}
            <div style={{
              marginTop: 20, padding: 12,
              backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '1px solid var(--accent-primary)', borderRadius: 6
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 6 }}>
                🧮 Mode d'interpolation de ce graphe
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginBottom: 8 }}>
                Choisis comment le moteur doit interpoler les courbes de ce graphe :
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'family',       label: '📐 Bracket par valeur familiale', desc: 'Chaque courbe a une valeur précise (ex. 0 ft, 2000 ft…). Le moteur trouve les 2 courbes encadrant la valeur cible et interpole.' },
                  { value: 'slope-follow', label: '🚀 Suivi de pente (lecture pilote)', desc: 'Courbes guides sans valeur. Entre Y_in (output précédent) au bord gauche, suis la pente des 2 courbes encadrantes, lis Y_out à X = cible. Pour graphes 2-3 de cascade avec guides.' },
                  { value: 'mono',         label: '〰 Mono-courbe (1D)',           desc: 'Une seule courbe → interpolation 1D directe sur X. Pour graphes simples ou de continuité.' },
                  { value: '',             label: '🤖 Auto-détection',              desc: 'Le moteur choisit automatiquement selon la structure du graphe.' }
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: 8,
                    backgroundColor: (graph.interpolationMode || '') === opt.value ? 'rgba(79, 174, 127, 0.12)' : 'var(--bg-surface)',
                    border: `1px solid ${(graph.interpolationMode || '') === opt.value ? 'var(--status-success)' : 'var(--border-subtle)'}`,
                    borderRadius: 4, cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name={`interp-mode-${graph.id}`}
                      value={opt.value}
                      checked={(graph.interpolationMode || '') === opt.value}
                      onChange={() => onUpdateGraph({ interpolationMode: opt.value ? (opt.value as 'family' | 'slope-follow' | 'mono') : undefined })}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* === Paramètre familial des courbes (requis seulement en mode 'family') === */}
            {(graph.interpolationMode === 'family' || graph.interpolationMode === undefined) && (
            <div style={{
              marginTop: 20, padding: 12,
              backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-regular)', borderRadius: 6
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                🔀 Paramètre familial des courbes (mode bracket)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 8 }}>
                Si tes courbes représentent une famille paramétrée par une variable (ex. plusieurs courbes pour différentes altitudes pression : 0 ft, 2000 ft, 4000 ft…), déclare cette variable ici.
                Ça permettra au résolveur de chercher la <strong>paire encadrante la plus proche</strong> et d'interpoler par lecture pilote (au lieu d'un IDW 4D approximatif).
              </div>
              {/* 💡 Suggestion automatique selon le rôle du graphe dans la cascade */}
              {(() => {
                const role = graph.role || 'primary';
                const order = graph.cascadeOrder;
                let suggestion = null;
                let reason = '';
                if (role === 'intermediate' && order === 1) {
                  suggestion = 'pressure_altitude';
                  reason = '1ʳᵉ étape de la cascade = correction altitude → famille typique : altitude pression (courbes 0/2000/4000…ft)';
                } else if (role === 'intermediate' && order === 2) {
                  suggestion = 'mass';
                  reason = '2ᵉ étape = correction masse → famille typique : masse (courbes 850/900/950/1000/1050/1100 kg)';
                } else if (role === 'intermediate' && order === 3) {
                  suggestion = 'headwind';
                  reason = '3ᵉ étape = correction vent → famille typique : vent de face (courbes 0/5/10/15/20/25 kt)';
                } else if (role === 'primary' && graph.curves && graph.curves.length > 1) {
                  // Primaire avec plusieurs courbes → souvent vent ou config
                  suggestion = 'headwind';
                  reason = 'Primaire avec plusieurs courbes → souvent paramétré par le vent';
                }
                if (suggestion && !graph.familyAxisVariable) {
                  return (
                    <div style={{
                      marginBottom: 8, padding: 8,
                      backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--accent-primary)',
                      borderRadius: 4, fontSize: 11, color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                    }}>
                      <span style={{ flex: 1 }}>
                        💡 <strong>Suggestion automatique :</strong> {reason}
                      </span>
                      <button
                        onClick={() => onUpdateGraph({ familyAxisVariable: suggestion })}
                        style={{
                          padding: '4px 10px', backgroundColor: 'var(--accent-primary)', color: 'white',
                          border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Appliquer ({getAxisVariable(suggestion)?.label || suggestion})
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  Variable familiale (différente des axes X et Y)
                </div>
                <select
                  value={graph.familyAxisVariable || ''}
                  onChange={(e) => onUpdateGraph({ familyAxisVariable: e.target.value || undefined })}
                  style={{
                    width: '100%', padding: '6px 8px',
                    border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13, backgroundColor: 'var(--bg-surface)'
                  }}
                >
                  <option value="">— Aucun (mono-courbe ou paramètre non identifié) —</option>
                  {getAxisVariablesGrouped().map(g => (
                    <optgroup key={g.category} label={g.label}>
                      {g.items
                        .filter(v => v.id !== axesConfig.xAxis.title && v.id !== axesConfig.yAxis.title)
                        .map(v => (
                          <option key={v.id} value={v.id}>
                            {v.label}{v.defaultUnit ? ` (${v.defaultUnit})` : ''}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {graph.familyAxisVariable && (
                <div style={{
                  marginTop: 8, padding: 8, backgroundColor: 'rgba(242, 105, 33, 0.10)',
                  border: '1px solid var(--accent-primary)', borderRadius: 4, fontSize: 11, color: 'var(--accent-primary)'
                }}>
                  ℹ Tu dois maintenant saisir la <strong>valeur de cette variable pour chaque courbe</strong> dans la sous-étape 5 (à côté du nom de la courbe). Sans cela, le bracket ne pourra pas fonctionner.
                </div>
              )}
            </div>
            )}

            {graph.interpolationMode === 'slope-follow' && (
              <div style={{
                marginTop: 12, padding: 12,
                backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '1px solid var(--accent-primary)', borderRadius: 6,
                fontSize: 11, color: 'var(--accent-primary)'
              }}>
                🚀 <strong>Mode suivi de pente activé.</strong> Aucune valeur à saisir sur les courbes — elles seront utilisées comme guides.
                Le moteur calcule automatiquement le ratio d'entrée à X = X_min et le préserve jusqu'à X = cible (input courant).
                Ce mode requiert que ce graphe soit en cascade (pas le premier).
              </div>
            )}

            {backgroundImage && (
              <div style={{ marginTop: 16 }}>
                <h4>Aperçu (image + grille générée)</h4>
                {renderChart(false)}
              </div>
            )}
          </div>
        );

      case 'calibration':
        return (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>🎯 Étape 4 : Calibration sur l'image</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Aligne chaque graduation du graphique sur la graduation correspondante de l'image filigrane.
              <strong>Recommandé</strong> pour corriger les déformations du scan.
            </p>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => startCalibration('x')}
                disabled={!!calibrationSession || !axesConfig.xAxis.step}
                style={btnStyle(customAxisTicks?.x ? 'var(--status-success)' : 'var(--accent-primary)')}
              >
                🎯 Calibrer X {customAxisTicks?.x ? `(${customAxisTicks.x.length} pts ✓)` : ''}
              </button>
              <button
                onClick={() => startCalibration('y')}
                disabled={!!calibrationSession || !axesConfig.yAxis.step}
                style={btnStyle(customAxisTicks?.y ? 'var(--status-success)' : 'var(--accent-primary)')}
              >
                🎯 Calibrer Y {customAxisTicks?.y ? `(${customAxisTicks.y.length} pts ✓)` : ''}
              </button>
              {(customAxisTicks?.x || customAxisTicks?.y) && (
                <>
                  <button onClick={() => onSetCustomAxisTicks('x', null)} style={btnStyle('var(--color-red-critical)', true)}>↺ Reset X</button>
                  <button onClick={() => onSetCustomAxisTicks('y', null)} style={btnStyle('var(--color-red-critical)', true)}>↺ Reset Y</button>
                </>
              )}
              {!axesConfig.xAxis.step && (
                <span style={{ color: 'var(--color-red-critical)', fontSize: 12 }}>⚠ Définis le pas X à l'étape 3</span>
              )}
            </div>
            {calibrationSession && (
              <div style={{
                padding: 10, marginBottom: 12, backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
              }}>
                <strong>📍 Calibration {calibrationSession.axis.toUpperCase()} :</strong>
                <span>Clique sur la graduation <strong>{calibrationSession.values[calibrationSession.index]}</strong> de l'image filigrane.</span>
                <span style={{ marginLeft: 'auto' }}>
                  {calibrationSession.index + 1} / {calibrationSession.values.length}
                </span>
                <button
                  onClick={() => { setCalibrationSession(null); setEditorMode('idle'); }}
                  style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', borderRadius: 3 }}
                >
                  ✕ Annuler
                </button>
              </div>
            )}
            {backgroundImage ? renderChart(false) : <p style={{ color: 'var(--color-red-critical)' }}>⚠ Pas d'image à l'étape 1</p>}
          </div>
        );

      case 'curves':
        return (
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>✏️ Étape 5 : Tracer les courbes</h3>

            {editorMode === 'placing-points' && selectedCurve ? (
              /* Mode placement de points en cours */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', borderRadius: 4 }}>
                <strong>📍 Tracé de "{selectedCurve.name}" en cours.</strong>{' '}
                Clique sur la courbe de l'image pour ajouter des points. Glisse un point pour le déplacer, clic droit pour le supprimer.
                <span style={{ marginLeft: 8, color: 'var(--text-primary)' }}>
                  {selectedCurve.points.length} point(s) placé(s)
                </span>
                <button
                  onClick={handleFinishCurve}
                  style={{ marginLeft: 12, padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--status-success)', color: 'white', border: 'none', borderRadius: 3, fontWeight: 500 }}
                >
                  ✓ Terminer cette courbe
                </button>
              </div>
            ) : editorMode === 'bezier-handles' && selectedCurve ? (
              /* P2b — Mode Bézier : façonnage par poignées de contrôle */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>〰 Façonnage Bézier de "{selectedCurve.name}"</strong>
                <span style={{ fontSize: 13 }}>
                  Tire les <strong>poignées rondes</strong> pour façonner la courbe entre les points
                  (les points restent déplaçables). La courbe doit rester une fonction de X.
                </span>
                <span style={{ marginLeft: 'auto' }} />
                <button
                  onClick={handleApplyBezier}
                  style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--status-success)', color: 'white', border: 'none', borderRadius: 3, fontWeight: 500 }}
                  title="Remplace les points de la courbe par un échantillonnage fidèle du tracé"
                >
                  ✓ Appliquer le tracé
                </button>
                <button
                  onClick={handleCancelBezier}
                  style={btnStyle('var(--text-secondary)', true)}
                >
                  ✕ Annuler
                </button>
              </div>
            ) : selectedCurve ? (
              /* Courbe sélectionnée mais hors mode placement : édition libre */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'var(--bg-overlay)', border: '2px solid var(--status-success)', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--status-success)' }}>✏ Édition de "{selectedCurve.name}"</strong>
                <span style={{ color: 'var(--status-success)', fontSize: 13 }}>
                  → <strong>glisse un point</strong> pour le repositionner, <strong>clic droit</strong> pour le supprimer,
                  ou édite les coordonnées dans le tableau ci-dessous.
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-primary)', fontSize: 12 }}>
                  {selectedCurve.points.length} point(s)
                </span>
                <button
                  onClick={() => setEditorMode('placing-points')}
                  style={btnStyle('var(--accent-primary)')}
                  title="Reprendre le placement de points par clic sur l'image"
                >
                  📍 Ajouter des points
                </button>
                <button
                  onClick={handleStartBezier}
                  disabled={selectedCurve.points.length < 2}
                  style={{ ...btnStyle('var(--accent-primary)', true), opacity: selectedCurve.points.length < 2 ? 0.4 : 1 }}
                  title={selectedCurve.points.length < 2
                    ? 'Place au moins 2 points avant de façonner en Bézier'
                    : 'Façonner la courbe en tirant des poignées de contrôle (Bézier)'}
                >
                  〰 Affiner en Bézier
                </button>
                <button
                  onClick={() => onSelectCurve(null)}
                  style={btnStyle('var(--text-secondary)', true)}
                  title="Désélectionner la courbe"
                >
                  ✕ Désélectionner
                </button>
              </div>
            ) : (
              /* Aucune courbe sélectionnée : création d'une nouvelle */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-regular)', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Nouvelle courbe :</strong>
                <input
                  type="text"
                  placeholder='Nom (ex: "0 ft", "20°C")'
                  value={newCurveName}
                  onChange={e => setNewCurveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStartCurve(); }}
                  style={{ padding: '4px 8px', border: '1px solid var(--border-regular)', borderRadius: 3, flex: 1, minWidth: 200 }}
                  autoFocus
                />
                <input
                  type="color"
                  value={newCurveColor}
                  onChange={e => setNewCurveColor(e.target.value)}
                  style={{ width: 40, height: 30, padding: 0, border: 'none', cursor: 'pointer' }}
                />
                <button
                  onClick={handleStartCurve}
                  disabled={!newCurveName.trim()}
                  style={btnStyle('var(--status-success)')}
                >
                  ➕ Créer & placer les points
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: '100%' }}>
                  💡 Pour modifier une courbe existante, clique son nom dans la liste à droite.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                {renderChart(true)}
              </div>
              <div style={{ flex: '1 1 280px', minWidth: 280 }}>
                <CurveManager
                  curves={graph.curves}
                  selectedCurveId={selectedCurveId}
                  onAddCurve={(name, color, wd) => { onAddCurve(name, color, wd); }}
                  onRemoveCurve={onRemoveCurve}
                  onSelectCurve={onSelectCurve}
                  onUpdateCurve={onUpdateCurve}
                  onReorderCurves={onReorderCurves}
                  isWindRelated={graph.isWindRelated || false}
                  familyAxisVariable={graph.familyAxisVariable}
                  familyAxisLabel={graph.familyAxisVariable ? (getAxisVariable(graph.familyAxisVariable)?.label || graph.familyAxisVariable) : undefined}
                  interpolationMode={graph.interpolationMode}
                  yAxisUnit={graph.axes?.yAxis?.unit}
                  yAxisTitle={graph.axes?.yAxis?.title}
                  xAxisReversed={graph.axes?.xAxis?.reversed === true}
                />
              </div>
            </div>

            {selectedCurve && (
              <div style={{ marginTop: 16 }}>
                <PointsTable
                  curves={graph.curves}
                  selectedCurveId={selectedCurveId}
                  axesConfig={axesConfig}
                  onUpdatePoint={onPointDrag}
                  onDeletePoint={onPointDelete}
                  onAddPoint={onPointClick}
                  onSelectCurve={onSelectCurve}
                />
              </div>
            )}
          </div>
        );
    }
  };

  // === Navigation bas de wizard ===
  // R2a : navigue sur les sous-étapes VISIBLES (sans image/position en atelier).
  const renderNav = () => {
    const curIdx = visibleSubSteps.findIndex(s => s.id === subStep);
    const isFirst = curIdx <= 0;
    const isLast = curIdx === visibleSubSteps.length - 1;
    return (
      <div style={{ display: 'flex', gap: 8, padding: 16, borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-overlay)', flexWrap: 'wrap' }}>
        <button
          onClick={() => isFirst ? onPreviousGraph() : goToSubStep(visibleSubSteps[curIdx - 1].id)}
          disabled={isFirst && graphIndex === 0}
          style={btnStyle('var(--text-secondary)')}
        >
          {isFirst ? (graphIndex > 0 ? `← Graphique ${graphIndex} (précédent)` : '← Précédent') : `← ${visibleSubSteps[curIdx - 1].label}`}
        </button>
        <div style={{ flex: 1 }} />
        {!isLast ? (
          <button onClick={() => goToSubStep(visibleSubSteps[curIdx + 1].id)} style={btnStyle('var(--accent-primary)')}>
            {visibleSubSteps[curIdx + 1].label} →
          </button>
        ) : (
          <>
            {graphIndex < totalGraphs - 1 && (
              <button onClick={onNextGraph} style={btnStyle('var(--accent-primary)', true)}>
                Graphique {graphIndex + 2}/{totalGraphs} →
              </button>
            )}
            <button onClick={onAddGraph} style={btnStyle('var(--accent-primary)')}>
              + Ajouter un graphique
            </button>
            <button onClick={onFinish} style={btnStyle('var(--status-success)')}>
              🪄 Interpoler {totalGraphs > 1 ? `les ${totalGraphs} graphiques` : 'le graphique'} & Valider →
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
      {renderSubStepBar()}
      {renderSubStep()}
      {renderNav()}
    </div>
  );
};

// === Sous-composants utilitaires ===

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <label style={{ display: 'block', marginBottom: 8 }}>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13 }}
    />
  </label>
);

/**
 * Liste déroulante de variables canoniques pour les titres d'axe.
 * La valeur stockée est l'`id` de la variable (clé utilisée ailleurs dans le code).
 * Les options sont regroupées par catégorie via <optgroup>.
 */
const AxisVariableSelect: React.FC<{
  label: string;
  /** 'x' → seules les variables INPUT sont proposées ; 'y' → seules les OUTPUT.
   *  'both' (defaut, rétro-compat) → toute la liste. */
  axis?: 'x' | 'y';
  value: string;
  onChange: (variableId: string) => void;
}> = ({ label, axis, value, onChange }) => {
  // Filtrage des options selon le rôle de l'axe (X = inputs uniquement, Y = outputs uniquement).
  const groups = axis ? getAxisVariablesGroupedFor(axis) : getAxisVariablesGrouped();
  // Si la valeur courante n'est pas un id connu, on l'expose comme option « Personnalisée »
  // pour ne pas effacer des données existantes (rétro-compat anciens abaques).
  const isKnown = AXIS_VARIABLES.some(v => v.id === value);
  return (
    <label style={{ display: 'block', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border-subtle)', borderRadius: 3, fontSize: 13, backgroundColor: 'var(--bg-surface)' }}
      >
        {!isKnown && value !== '' && (
          <option value={value}>⚠ {value} (legacy)</option>
        )}
        {value === '' && (
          <option value="">— Choisir une variable —</option>
        )}
        {groups.map(g => (
          <optgroup key={g.category} label={g.label}>
            {g.items.map(v => (
              <option key={v.id} value={v.id}>
                {v.label}{v.defaultUnit ? ` (${v.defaultUnit})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
};

const btnStyle = (bg: string, outline = false): React.CSSProperties => ({
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  backgroundColor: outline ? 'var(--bg-surface)' : bg,
  color: outline ? bg : 'white',
  border: outline ? `1px solid ${bg}` : 'none',
  borderRadius: 4
});

export default AbacGraphWizard;
