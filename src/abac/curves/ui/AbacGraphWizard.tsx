// src/abac/curves/ui/AbacGraphWizard.tsx
//
// Lot 0 (purge) — l'ancien mini-wizard 5 sous-étapes est mort depuis l'atelier
// « image unique » (unique point de montage : AbacBuilder, toujours en atelier).
// Ce composant n'est plus que l'OUTILLAGE COURBES du cadre actif :
//   - bannières d'état (placement / Bézier / édition libre) ;
//   - gestionnaire de courbes (CurveManager) ;
//   - table de points repliable (saisie précise) ;
//   - bouton « 🪄 Interpoler & Valider » (sortie vers l'écran de validation) ;
//   - la state machine `editorMode`, pilotée par le builder via
//     `editorModeCommand` (nonce) — à dissoudre dans le builder au Lot 1.

import React, { useState } from 'react';
import { CurveManager } from './CurveManager';
import { PointsTable } from './PointsTable';
import { AxesConfig, Curve, GraphConfig, WindDirection } from '../core/types';
import { getAxisVariable } from '../core/axisVariables';
// Lot 1-G — anatomie KitPanel pour le bloc « Courbes du cadre actif » et
// KitButton partout ; « Interpoler & Valider » est LA primaire de l'écran Tracé.
import { KitBadge, KitButton, KitPanel, SPACING } from './kit';

export type EditorMode = 'idle' | 'placing-points';

interface AbacGraphWizardProps {
  graph: GraphConfig;
  totalGraphs: number;

  selectedCurveId: string | null;
  onSelectCurve: (id: string | null) => void;

  /** Lot 0 — signature alignée sur handleAddCurve du builder : le 4ᵉ paramètre
   *  (familyValue) n'est plus perdu en traversant le wizard (audit-1 §4). */
  onRemoveCurve: (curveId: string) => void;
  onUpdateCurve: (curveId: string, updates: Partial<Curve>) => void;
  /** Lot 0 — type corrigé : toute la chaîne réelle (CurveManager → builder)
   *  passe le tableau réordonné, pas une paire d'index. */
  onReorderCurves: (curves: Curve[]) => void;

  onPointClick: (x: number, y: number) => void;
  onPointDrag: (curveId: string, pointId: string, x: number, y: number) => void;
  onPointDelete: (curveId: string, pointId: string) => void;

  onFinish: () => void;
  /** R3 — remonte le mode d'édition au builder : le CANEVAS accepte le
   *  clic-points quand le wizard est en mode « placement » (verrou
   *  anti-clics-fantômes). */
  onEditorModeChange?: (mode: EditorMode) => void;
  /** R7 — le façonnage Bézier vit SUR LE CANEVAS du builder (la session est
   *  détenue par le builder). Le wizard pilote la session via ces callbacks
   *  et reflète son état via bezierActive. */
  bezierActive?: boolean;
  onStartBezier?: () => void;
  onApplyBezier?: () => void;
  onCancelBezier?: () => void;
  /** Capsule « Nouvelle courbe » du CANEVAS (la création de courbe vit
   *  au-dessus de l'atelier — demande pilote) : commande externe du mode
   *  d'édition. Le wizard reste l'unique propriétaire de editorMode ; chaque
   *  nonce applique le mode demandé UNE seule fois. */
  editorModeCommand?: { mode: 'placing-points' | 'idle'; nonce: number } | null;
}

export const AbacGraphWizard: React.FC<AbacGraphWizardProps> = (props) => {
  const {
    graph, totalGraphs, selectedCurveId,
    onSelectCurve, onRemoveCurve, onUpdateCurve, onReorderCurves,
    onPointClick, onPointDrag, onPointDelete,
    onFinish, onEditorModeChange,
    bezierActive, onStartBezier, onApplyBezier, onCancelBezier,
    editorModeCommand
  } = props;

  const [editorMode, setEditorMode] = useState<EditorMode>('idle');

  // R3 — remonte le mode au builder (le canevas n'accepte le clic-points
  // que lorsque le wizard est en mode « placement »).
  React.useEffect(() => {
    onEditorModeChange?.(editorMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);

  // Capsule « Nouvelle courbe » du canevas : applique chaque COMMANDE une
  // seule fois (nonce). Le ref initialisé au nonce courant neutralise toute
  // commande résiduelle si le wizard est démonté/remonté (cadres retirés
  // puis recréés) — pas de mode placement fantôme au remontage.
  const lastModeCmdNonce = React.useRef(editorModeCommand?.nonce ?? 0);
  React.useEffect(() => {
    if (!editorModeCommand || editorModeCommand.nonce === lastModeCmdNonce.current) return;
    lastModeCmdNonce.current = editorModeCommand.nonce;
    setEditorMode(editorModeCommand.mode);
  }, [editorModeCommand]);

  // === Calculs dérivés ===

  const axesConfig: AxesConfig = graph.axes || {
    xAxis: { min: 0, max: 100, step: 10, title: 'X', unit: '' },
    yAxis: { min: 0, max: 100, step: 10, title: 'Y', unit: '' }
  };

  const handleFinishCurve = () => {
    onSelectCurve(null);
    setEditorMode('idle');
  };

  const selectedCurve = selectedCurveId ? graph.curves.find(c => c.id === selectedCurveId) : null;

  return (
    <KitPanel
      title="Courbes du cadre actif"
      badge={<KitBadge tone="neutral">{graph.curves.length} courbe{graph.curves.length > 1 ? 's' : ''}</KitBadge>}
    >
      {/* === Outillage courbes du cadre actif (ex-sous-étape 5, seule vivante) === */}
          <div>
            {editorMode === 'placing-points' && selectedCurve ? (
              /* Mode placement de points en cours */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', borderRadius: 4, display: 'flex', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>📍 Tracé de "{selectedCurve.name}" en cours.</strong>{' '}
                <span>Clique sur la courbe de l'image pour ajouter des points. Glisse un point pour le déplacer, clic droit pour le supprimer.</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {selectedCurve.points.length} point(s) placé(s)
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <KitButton level="secondary" size="compact" icon="✓" onClick={handleFinishCurve}>
                    Terminer cette courbe
                  </KitButton>
                </span>
              </div>
            ) : bezierActive && selectedCurve ? (
              /* P2b/R7 — Mode Bézier : la session vit dans le BUILDER et les
                 poignées se tirent sur le CANEVAS (par-dessus l'image) : cette
                 bannière ne fait que piloter Appliquer / Annuler. */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', borderRadius: 4, display: 'flex', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>〰 Façonnage Bézier de "{selectedCurve.name}"</strong>
                <span style={{ fontSize: 13 }}>
                  Tire les <strong>poignées rondes</strong> directement sur l'image, dans le cadre actif, pour faire suivre le trait à la courbe (les points restent déplaçables). La courbe doit rester une fonction de X.
                </span>
                <span style={{ marginLeft: 'auto' }} />
                <KitButton
                  level="secondary"
                  size="compact"
                  icon="✓"
                  onClick={onApplyBezier}
                  title="Remplace les points de la courbe par un échantillonnage fidèle du tracé"
                >
                  Appliquer le tracé
                </KitButton>
                <KitButton level="tertiary" size="compact" icon="✕" onClick={onCancelBezier}>
                  Annuler
                </KitButton>
              </div>
            ) : selectedCurve ? (
              /* Courbe sélectionnée mais hors mode placement : édition libre */
              <div style={{ padding: 12, marginBottom: 12, backgroundColor: 'var(--bg-overlay)', border: '2px solid var(--status-success)', borderRadius: 4, display: 'flex', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--status-success)' }}>✏ Édition de "{selectedCurve.name}"</strong>
                <span style={{ color: 'var(--status-success)', fontSize: 13 }}>
                  → <strong>glisse un point</strong> pour le repositionner, <strong>clic droit</strong> pour le supprimer,
                  ou édite les coordonnées dans le tableau ci-dessous.
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-primary)', fontSize: 12 }}>
                  {selectedCurve.points.length} point(s)
                </span>
                <KitButton
                  level="secondary"
                  size="compact"
                  icon="📍"
                  onClick={() => setEditorMode('placing-points')}
                  title="Reprendre le placement de points par clic sur l'image"
                >
                  Ajouter des points
                </KitButton>
                <KitButton
                  level="secondary"
                  size="compact"
                  icon="〰"
                  disabled={selectedCurve.points.length < 2}
                  disabledReason="Place au moins 2 points avant de façonner en Bézier."
                  onClick={onStartBezier}
                  title="Façonner la courbe en tirant des poignées directement sur l'image (Bézier)"
                >
                  Affiner en Bézier
                </KitButton>
                <KitButton
                  level="tertiary"
                  size="compact"
                  icon="✕"
                  onClick={() => onSelectCurve(null)}
                  title="Désélectionner la courbe"
                >
                  Désélectionner
                </KitButton>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* R7 — PAS de Chart séparé : le tracé, l'édition des points ET
                  le façonnage Bézier vivent sur le CANEVAS du builder (il faut
                  pouvoir suivre les traits de l'image — retour pilote). */}
              <div style={{ flex: '1 1 280px', minWidth: 280 }}>
                {/* Lot 1 (décision pilote 20/08) — la création de courbe vit
                    UNIQUEMENT dans la capsule de l'atelier : ce panneau est
                    la liste (sélection, renommage, valeurs, suppression). */}
                <CurveManager
                  curves={graph.curves}
                  selectedCurveId={selectedCurveId}
                  onRemoveCurve={onRemoveCurve}
                  onSelectCurve={onSelectCurve}
                  onUpdateCurve={onUpdateCurve}
                  onReorderCurves={onReorderCurves}
                  isWindRelated={graph.isWindRelated || false}
                  familyAxisVariable={graph.familyAxisVariable}
                  familyAxisLabel={graph.familyAxisVariable ? (getAxisVariable(graph.familyAxisVariable)?.label || graph.familyAxisVariable) : undefined}
                />
              </div>
            </div>

            {selectedCurve && (
              /* R6/D2 — SEUL tableau survivant de la refonte : la saisie précise
                 des points, en panneau REPLIABLE (fermé par défaut, le tracé se
                 fait au clic sur le canevas). */
              <details style={{
                marginTop: 16,
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                backgroundColor: 'var(--bg-overlay)'
              }}>
                <summary style={{
                  padding: '8px 12px', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)'
                }}>
                  📋 Points (saisie précise) — {selectedCurve.name} · {selectedCurve.points.length} point(s)
                </summary>
                <div style={{ padding: 8 }}>
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
              </details>
            )}
          </div>

      {/* Navigation : seul reste le geste de sortie « Interpoler & Valider »
          — l'unique chemin vers l'écran de validation (test de cascade +
          enregistrement). Lot 1-G : c'est LA primaire de l'écran Tracé
          (libellé STABLE — le nombre de graphes vit dans le badge du panneau). */}
      <div style={{ display: 'flex', gap: SPACING.sm, marginTop: SPACING.md, paddingTop: SPACING.md, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        <KitButton
          level="primary"
          icon="🪄"
          onClick={onFinish}
          title={`Interpole ${totalGraphs > 1 ? `les ${totalGraphs} graphiques` : 'le graphique'} du set puis ouvre l'écran de validation (test de cascade + enregistrement)`}
        >
          Interpoler & Valider
        </KitButton>
      </div>
    </KitPanel>
  );
};

export default AbacGraphWizard;
