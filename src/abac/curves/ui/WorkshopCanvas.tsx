// curves/ui/WorkshopCanvas.tsx
//
// R2a+R2b (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) — Le CANEVAS de l'atelier
// « image unique » : reproduction du geste de l'abaque papier (réf. PA-28-181) —
//   1. UNE image MANEX importée, positionnée et recadrée UNE fois pour le set ;
//   2. des CADRES (un par graphe) TIRÉS sur l'image : bandes verticales à
//      poignées, déplaçables/redimensionnables, focus au clic ;
//   3. l'ordre gauche→droite des cadres définit la chaîne de lecture
//      G1→G2→G3 (synchronisée par AbacBuilder dans linkedTo/linkedFrom) ;
//   4. R2b — l'axe Y COMMUN (paramétré UNE fois, règle graduée à gauche), les
//      axes X PAR CADRE (règles sous chaque cadre), et la CALIBRATION par
//      clics directement sur le canevas (Y commun + X de chaque cadre).
// R3 ramènera le tracé des courbes sur ce canevas.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AxisSpec,
  GraphConfig,
  WorkshopConfig,
  WorkshopFrame,
  WorkshopImage,
  WorkshopTickCalibration
} from '../core/types';
import { BezierSegment } from '../core/bezier';
import { getAxisVariable, getAxisVariableLabel, getAxisVariablesGroupedForCore } from '../core/axisVariables';
// 23/08 — guides NUMÉROTÉS : sur un panneau de correction (masse, vent…), le
// moteur suit la pente entre deux guides et ne lit jamais leur valeur : la
// capsule ne réclame plus ni masse ni vent, elle numérote.
import { usesNumberedGuides, isFirstFramedGraph, nextGuideNumber, guideAutoName } from '../core/guideMode';
// Lot 1-E — kit visuel de l'atelier : bandeau de mode permanent (Échap
// universel embarqué) + bouton à raison de désactivation affichée.
// Lot 1-G — libellés STABLES + kit partout : KitButton sur la barre d'outils
// et le panneau Axes, l'état (« 3 pts ✓ », « importée ✓ ») porté par des
// KitBadge À CÔTÉ des boutons, anatomie KitPanel pour l'atelier et les axes.
import { KitBadge, KitButton, KitPanel, ModeBanner, SPACING } from './kit';

interface WorkshopCanvasProps {
  workshop: WorkshopConfig;
  graphs: GraphConfig[];
  selectedGraphId: string | null;
  onWorkshopChange: (next: WorkshopConfig) => void;
  onFocusGraph: (graphId: string) => void;
  /** Fournit un graphe à cadrer : le 1er graphe encore sans cadre, sinon un
   *  graphe fraîchement créé par le builder. Retourne son id. */
  onRequestGraphForFrame: () => string | null;
  /** R2b — écrit l'axe X d'un graphe (les X restent portés par les graphes,
   *  comme avant : le canevas n'introduit AUCUN nouveau lieu de vérité). */
  onUpdateGraphXAxis: (graphId: string, xAxis: AxisSpec) => void;
  /** R3 — tracé sur le canevas : handlers du builder (mêmes que le Chart du
   *  wizard — ils écrivent sur le graphe FOCUS + la courbe sélectionnée). */
  selectedCurveId?: string | null;
  /** true quand le wizard est en mode « placement » (clic = ajouter un point). */
  tracingMode?: boolean;
  onPointClick?: (x: number, y: number) => void;
  onPointDrag?: (curveId: string, pointId: string, x: number, y: number) => void;
  onPointDelete?: (curveId: string, pointId: string) => void;
  /** R7 — façonnage Bézier SUR le canevas (le Chart séparé a disparu de
   *  l'atelier) : segments en coords DATA de la courbe sélectionnée du graphe
   *  FOCUS pendant une session, sinon null. Les poignées cp1/cp2 se tirent
   *  par-dessus l'image pour suivre ses traits. */
  bezierSegments?: BezierSegment[] | null;
  onBezierHandleDrag?: (segIdx: number, which: 'cp1' | 'cp2', x: number, y: number) => void;
  /** Lot 1-E — clôture PROPRE de la session Bézier (Échap, entrée en cadrage) :
   *  le builder applique le façonnage réellement effectué (même geste que
   *  « ✓ Appliquer ») ou referme sans toucher aux points si rien n'a été tiré. */
  onFinishBezier?: () => void;
  /** Capsule « Nouvelle courbe » (sous le panneau Axes, au-dessus du canevas) :
   *  création extraite du bloc « Courbes du cadre actif » — qui RESTE sous
   *  l'atelier (liste, édition, Bézier, points). Connexion fonctionnelle
   *  inchangée : ces callbacks rejoignent les mêmes handlers du builder. */
  onCreateCurve?: (name: string, color: string, familyValue?: number, windDirection?: 'headwind' | 'tailwind' | 'none') => void;
  onFinishCurve?: () => void;
  width?: number;
  height?: number;
}

// Marges des règles d'axes : Y commun à gauche, X sous les cadres.
const MARGIN = { top: 30, right: 16, bottom: 46, left: 64 };
const FRAME_MIN_W = 60;   // largeur minimale d'un cadre (px inner)
// Lot 1-E — les poignées de bord ne sont plus des bandes invisibles de 7 px :
// la barre-poignée VISIBLE à mi-hauteur est la zone interactive, élargie.
const HANDLE_HIT_W = 12;  // largeur de la zone interactive des barres-poignées
const HANDLE_HIT_H = 48;  // hauteur de la zone interactive (barre visible : 28)
const MAX_ZOOM = 8;       // zoom dynamique : 100 % → 800 %

/** Borne le rectangle de vue (zoom) à l'intérieur du viewBox d'origine. */
const clampViewRect = (v: { x: number; y: number; w: number; h: number }, W: number, H: number) => ({
  ...v,
  x: Math.max(0, Math.min(W - v.w, v.x)),
  y: Math.max(0, Math.min(H - v.h, v.y))
});

const FRAME_IDLE = 'var(--text-tertiary)';
const FRAME_FOCUS = 'var(--accent-primary)';

// ─── Helpers axes ───────────────────────────────────────────────────────────

/** Liste des graduations [min..max] par pas (bornes incluses). */
const buildAxisValues = (axis: AxisSpec): number[] => {
  const { min, max, step } = axis;
  if (!step || !isFinite(step) || step <= 0) return [min, max];
  const out: number[] = [];
  const eps = step * 1e-6;
  for (let v = min; v <= max + eps; v += step) out.push(parseFloat(v.toFixed(10)));
  if (out[out.length - 1] < max - eps) out.push(max);
  return out;
};

/** Position pixel d'une valeur sur la règle Y (0 = haut). Calibration prioritaire. */
const yValueToPixel = (v: number, axis: AxisSpec, innerH: number, ticks?: WorkshopTickCalibration[]): number => {
  if (ticks && ticks.length >= 2) {
    const sorted = [...ticks].sort((a, b) => a.value - b.value);
    if (v <= sorted[0].value) return sorted[0].pixel;
    if (v >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].pixel;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (v >= a.value && v <= b.value) {
        const t = (v - a.value) / (b.value - a.value || 1);
        return a.pixel + t * (b.pixel - a.pixel);
      }
    }
  }
  const t = (v - axis.min) / (axis.max - axis.min || 1);
  return axis.reversed ? t * innerH : (1 - t) * innerH;
};

/** R3 — Inverse : pixel Y (inner) → valeur, calibration prioritaire. */
const yPixelToValue = (py: number, axis: AxisSpec, innerH: number, ticks?: WorkshopTickCalibration[]): number => {
  if (ticks && ticks.length >= 2) {
    const sorted = [...ticks].sort((a, b) => a.pixel - b.pixel);
    if (py <= sorted[0].pixel) return sorted[0].value;
    if (py >= sorted[sorted.length - 1].pixel) return sorted[sorted.length - 1].value;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (py >= a.pixel && py <= b.pixel) {
        const t = (py - a.pixel) / (b.pixel - a.pixel || 1);
        return a.value + t * (b.value - a.value);
      }
    }
  }
  const t = axis.reversed ? py / innerH : 1 - py / innerH;
  return axis.min + t * (axis.max - axis.min);
};

/** R3 — Inverse : pixel X (inner) → valeur dans le repère d'un CADRE. */
const xPixelToValue = (px: number, axis: AxisSpec, frame: WorkshopFrame): number => {
  if (frame.xTicks && frame.xTicks.length >= 2) {
    const sorted = [...frame.xTicks].sort((a, b) => a.pixel - b.pixel);
    if (px <= sorted[0].pixel) return sorted[0].value;
    if (px >= sorted[sorted.length - 1].pixel) return sorted[sorted.length - 1].value;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (px >= a.pixel && px <= b.pixel) {
        const t = (px - a.pixel) / (b.pixel - a.pixel || 1);
        return a.value + t * (b.value - a.value);
      }
    }
  }
  const w = frame.xRightPx - frame.xLeftPx || 1;
  const t = (px - frame.xLeftPx) / w;
  const tt = axis.reversed ? 1 - t : t;
  return axis.min + tt * (axis.max - axis.min);
};

/** Position pixel d'une valeur sur la règle X d'un CADRE. Calibration prioritaire. */
const xValueToPixel = (v: number, axis: AxisSpec, frame: WorkshopFrame): number => {
  if (frame.xTicks && frame.xTicks.length >= 2) {
    const sorted = [...frame.xTicks].sort((a, b) => a.value - b.value);
    if (v <= sorted[0].value) return sorted[0].pixel;
    if (v >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].pixel;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (v >= a.value && v <= b.value) {
        const t = (v - a.value) / (b.value - a.value || 1);
        return a.pixel + t * (b.pixel - a.pixel);
      }
    }
  }
  const t = (v - axis.min) / (axis.max - axis.min || 1);
  const w = frame.xRightPx - frame.xLeftPx;
  return axis.reversed ? frame.xRightPx - t * w : frame.xLeftPx + t * w;
};

// Champ numérique compact du panneau d'axes
const NumField: React.FC<{ label: string; value: number | undefined; onChange: (n: number | undefined) => void; width?: number }> =
  ({ label, value, onChange, width = 64 }) => (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text-secondary)' }}>
      {label}
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
        style={{
          width, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 3,
          border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)'
        }}
      />
    </label>
  );

const TextFieldMini: React.FC<{ label: string; value: string; onChange: (s: string) => void; width?: number }> =
  ({ label, value, onChange, width = 110 }) => (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text-secondary)' }}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 3,
          border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)'
        }}
      />
    </label>
  );

// R8 — Sélecteur de VARIABLE CANONIQUE (catalogue axisVariables) : le titre
// d'axe est la CLÉ qui branche la cascade sur les données vivantes de la
// préparation de vol (température METAR, masse du devis M&C, vent météo).
// Texte libre INTERDIT — une saisie hors catalogue ne serait jamais matchée.
// Les valeurs legacy non canoniques restent affichées avec ⚠ (rétro-compat).
// Lot 1-A — liste COURTE (perfCore) : seules les variables routables par la
// prépa vol sont proposées. Une valeur stockée connue du catalogue mais hors
// liste courte (vieux modèles, ex. « Vent de face ») est INJECTÉE en tête
// avec son label normal — le préfixe « ⚠ legacy » reste réservé aux ids
// inconnus du catalogue.
const VarSelectMini: React.FC<{
  label: string;
  axis: 'x' | 'y';
  value: string;
  onChange: (variableId: string) => void;
  width?: number;
}> = ({ label, axis, value, onChange, width = 200 }) => {
  const groups = getAxisVariablesGroupedForCore(axis);
  const known = getAxisVariable(value);
  const isKnown = !!known;
  const inShortList = groups.some(g => g.items.some(v => v.id === value));
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 10, color: !isKnown && value ? 'var(--color-red-critical)' : 'var(--text-secondary)' }}>
      {label}{!isKnown && value ? ' — ⚠ non canonique' : ''}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 3,
          border: `1px solid ${!isKnown && value ? 'var(--color-red-critical)' : 'var(--border-regular)'}`,
          backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)'
        }}
      >
        {!isKnown && value !== '' && <option value={value}>⚠ {value} (legacy)</option>}
        {known && !inShortList && (
          <option value={known.id}>{known.label}{known.defaultUnit ? ` (${known.defaultUnit})` : ''}</option>
        )}
        {value === '' && <option value="">— Choisir la variable —</option>}
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

// R8 — Unité VERROUILLÉE sur le catalogue : liste fermée `units[]` de la
// variable (réutilisable partout dans l'app), badge fixe s'il n'y a qu'une
// unité. Champ libre UNIQUEMENT pour 'custom' et les valeurs legacy.
const UnitFieldMini: React.FC<{
  variableId: string;
  value: string;
  onChange: (unit: string) => void;
}> = ({ variableId, value, onChange }) => {
  const v = getAxisVariable(variableId);
  if (v && v.id !== 'custom') {
    const allowed = v.units && v.units.length > 0 ? v.units : [v.defaultUnit];
    if (allowed.length > 1) {
      return (
        <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text-secondary)' }}>
          Unité
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 64, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 3, border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)' }}
          >
            {value && !allowed.includes(value) && <option value={value}>⚠ {value}</option>}
            {allowed.map(u => <option key={u} value={u}>{u || '—'}</option>)}
          </select>
        </label>
      );
    }
    return (
      <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text-secondary)' }}>
        Unité
        <span
          title="Unité fixée par la variable canonique"
          style={{ minWidth: 36, height: 24, boxSizing: 'border-box', padding: '3px 6px', fontSize: 12, borderRadius: 3, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {v.defaultUnit || '—'}
        </span>
      </label>
    );
  }
  return <TextFieldMini label={v?.id === 'custom' ? 'Unité (libre)' : 'Unité ⚠'} value={value} onChange={onChange} width={56} />;
};

export const WorkshopCanvas: React.FC<WorkshopCanvasProps> = ({
  workshop,
  graphs,
  selectedGraphId,
  onWorkshopChange,
  onFocusGraph,
  onRequestGraphForFrame,
  onUpdateGraphXAxis,
  selectedCurveId = null,
  tracingMode = false,
  onPointClick,
  onPointDrag,
  onPointDelete,
  bezierSegments = null,
  onBezierHandleDrag,
  onFinishBezier,
  onCreateCurve,
  onFinishCurve,
  width = 960,
  height = 560
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inner = { w: width - MARGIN.left - MARGIN.right, h: height - MARGIN.top - MARGIN.bottom };

  const [imageAdjust, setImageAdjust] = useState(false);

  // ─── ZOOM DYNAMIQUE — précision du placement des points (demande pilote) ───
  // La vue est un SOUS-RECTANGLE du viewBox d'origine : toute la géométrie
  // existante (cadres, points, courbes, calibration) reste exprimée dans le
  // même repère — seules les conversions client→viewBox tiennent compte de
  // `view`. Molette = zoom centré curseur ; glisser le fond = déplacer la vue.
  const [view, setView] = useState({ x: 0, y: 0, w: width, h: height });
  const viewRef = useRef(view);
  viewRef.current = view;
  const zoomFactor = width / view.w;

  useEffect(() => { setView({ x: 0, y: 0, w: width, h: height }); }, [width, height]);

  /** Zoome d'un multiplicateur RELATIF à la vue courante, ancré sur le point
   *  client (curseur). Le facteur se calcule DANS le updater (prev) : des
   *  événements rapprochés (molette continue, double-clic bouton) se composent
   *  correctement au lieu de relire un état de render périmé. */
  const zoomBy = useCallback((mult: number, clientX?: number, clientY?: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    setView(prev => {
      const f = Math.max(1, Math.min(MAX_ZOOM, (width / prev.w) * mult));
      const w = width / f;
      const h = height / f;
      const rx = rect && clientX !== undefined ? (clientX - rect.left) / rect.width : 0.5;
      const ry = rect && clientY !== undefined ? (clientY - rect.top) / rect.height : 0.5;
      const ax = prev.x + rx * prev.w; // point viewBox sous l'ancre
      const ay = prev.y + ry * prev.h;
      return clampViewRect({ x: ax - rx * w, y: ay - ry * h, w, h }, width, height);
    });
  }, [width, height]);

  // Molette = zoom continu. Listener natif NON passif : React enregistre les
  // wheel en passif → preventDefault (anti-scroll page) y serait ignoré.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // ─── Capsule « Nouvelle courbe » : saisie locale (nom + couleur) ───
  const [newCurveName, setNewCurveName] = useState('');
  const [newCurveColor, setNewCurveColor] = useState('#F26921');
  // R17 — création par VALEUR (demande pilote) : quand le graphe a une variable
  // de famille, on choisit la valeur (liste 0→10 000 ft / 500 pour l'altitude,
  // saisie numérique sinon) et le NOM naît de la valeur — fini le nom libre.
  const [newCurveValue, setNewCurveValue] = useState('');
  // Lot 1-E (piège « sens du vent par défaut ») : AUCUN sens présélectionné —
  // le sélecteur démarre vide et se REVIDE après chaque création. Un guide
  // arrière ne peut plus naître tagué « face » par oubli.
  const [newCurveWindDir, setNewCurveWindDir] = useState<'' | 'headwind' | 'tailwind' | 'none'>('');
  const ALTITUDE_FAMILIES = ['pressure_altitude', 'density_altitude', 'altitude'];
  const ALTITUDE_STEPS = Array.from({ length: 21 }, (_, i) => i * 500); // 0 → 10 000 ft / 500

  // ─── R2b : session de calibration par clics sur le canevas ───
  // Y commun (une fois) ou X d'un cadre. Les valeurs à cliquer viennent du
  // min/max/pas de l'axe, dans l'ordre VISUEL (Y : haut→bas ; X : gauche→droite).
  const [calib, setCalib] = useState<null | {
    kind: 'y' | 'x';
    graphId?: string;
    values: number[];
    index: number;
    collected: WorkshopTickCalibration[];
  }>(null);

  // ─── Drag unifié (image, cadre OU point de courbe), pattern pointer fenêtre ───
  type DragState =
    | { kind: 'img-move' | 'img-tl' | 'img-tr' | 'img-bl' | 'img-br'; startX: number; startY: number; origin: WorkshopImage }
    | { kind: 'frame-move' | 'frame-left' | 'frame-right'; graphId: string; startX: number; origin: WorkshopFrame }
    | { kind: 'point'; graphId: string; curveId: string; pointId: string }
    | { kind: 'bezier'; graphId: string; segIdx: number; which: 'cp1' | 'cp2' }
    | { kind: 'pan'; startX: number; startY: number; origin: { x: number; y: number; w: number; h: number } };
  const [drag, setDrag] = useState<DragState | null>(null);

  // Lot 1-E — barre-poignée de cadre survolée (mise en évidence accent).
  const [hoverHandle, setHoverHandle] = useState<{ graphId: string; side: 'left' | 'right' } | null>(null);

  // Les conversions client→viewBox passent par la VUE zoomée (sous-rectangle) :
  // au zoom 1 elles sont identiques à l'ancien calcul plein cadre.
  const clientDeltaToInner = useCallback((dxClient: number, dyClient: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { dx: 0, dy: 0 };
    return { dx: (dxClient / rect.width) * view.w, dy: (dyClient / rect.height) * view.h };
  }, [view.w, view.h]);

  // R3 — coordonnées INNER (post-marges) d'un événement pointeur.
  const eventToInner = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: view.x + ((e.clientX - rect.left) / rect.width) * view.w - MARGIN.left,
      y: view.y + ((e.clientY - rect.top) / rect.height) * view.h - MARGIN.top
    };
  }, [view.x, view.y, view.w, view.h]);

  // R3 — position du curseur (inner) pour le réticule de tracé.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      // ZOOM — déplacement de la VUE (glisser le fond quand on est zoomé) :
      // delta client → delta viewBox via la vue d'ORIGINE du drag (w/h
      // constants pendant un pan, pas de boucle de rétroaction).
      if (drag.kind === 'pan') {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = ((e.clientX - drag.startX) / rect.width) * drag.origin.w;
        const dy = ((e.clientY - drag.startY) / rect.height) * drag.origin.h;
        setView(clampViewRect({ ...drag.origin, x: drag.origin.x - dx, y: drag.origin.y - dy }, width, height));
        return;
      }

      // R3 — déplacement d'un POINT de courbe : position ABSOLUE → valeurs data
      // via les mappings inverses du cadre (calibration comprise).
      if (drag.kind === 'point') {
        if (!onPointDrag) return;
        const pos = eventToInner(e);
        const frame = workshop.frames.find(f => f.graphId === drag.graphId);
        const g = graphs.find(x => x.id === drag.graphId);
        if (!pos || !frame || !g?.axes) return;
        const dataX = xPixelToValue(pos.x, g.axes.xAxis, frame);
        const dataY = yPixelToValue(pos.y, workshop.sharedY, inner.h, workshop.yTicks);
        onPointDrag(drag.curveId, drag.pointId, dataX, dataY);
        return;
      }

      // R7 — poignée Bézier : position ABSOLUE → valeurs data, mêmes mappings
      // inverses que les points (calibration comprise).
      if (drag.kind === 'bezier') {
        if (!onBezierHandleDrag) return;
        const pos = eventToInner(e);
        const frame = workshop.frames.find(f => f.graphId === drag.graphId);
        const g = graphs.find(x => x.id === drag.graphId);
        if (!pos || !frame || !g?.axes) return;
        const dataX = xPixelToValue(pos.x, g.axes.xAxis, frame);
        const dataY = yPixelToValue(pos.y, workshop.sharedY, inner.h, workshop.yTicks);
        onBezierHandleDrag(drag.segIdx, drag.which, dataX, dataY);
        return;
      }

      const { dx, dy } = clientDeltaToInner(e.clientX - drag.startX, 'startY' in drag ? e.clientY - drag.startY : 0);

      if (drag.kind.startsWith('img')) {
        const o = (drag as Extract<DragState, { origin: WorkshopImage }>).origin;
        let { x, y, width: w, height: h } = o;
        const MIN = 40;
        if (drag.kind === 'img-move') { x = o.x + dx; y = o.y + dy; }
        if (drag.kind === 'img-tl') { const nw = Math.max(MIN, o.width - dx); const nh = Math.max(MIN, o.height - dy); x = o.x + o.width - nw; y = o.y + o.height - nh; w = nw; h = nh; }
        if (drag.kind === 'img-tr') { const nw = Math.max(MIN, o.width + dx); const nh = Math.max(MIN, o.height - dy); y = o.y + o.height - nh; w = nw; h = nh; }
        if (drag.kind === 'img-bl') { const nw = Math.max(MIN, o.width - dx); const nh = Math.max(MIN, o.height + dy); x = o.x + o.width - nw; w = nw; h = nh; }
        if (drag.kind === 'img-br') { w = Math.max(MIN, o.width + dx); h = Math.max(MIN, o.height + dy); }
        onWorkshopChange({ ...workshop, image: { ...o, x, y, width: w, height: h } });
        return;
      }

      const fd = drag as Extract<DragState, { origin: WorkshopFrame }>;
      const o = fd.origin;
      let left = o.xLeftPx;
      let right = o.xRightPx;
      if (drag.kind === 'frame-move') {
        const w = o.xRightPx - o.xLeftPx;
        left = Math.max(0, Math.min(inner.w - w, o.xLeftPx + dx));
        right = left + w;
      } else if (drag.kind === 'frame-left') {
        left = Math.max(0, Math.min(o.xRightPx - FRAME_MIN_W, o.xLeftPx + dx));
      } else if (drag.kind === 'frame-right') {
        right = Math.min(inner.w, Math.max(o.xLeftPx + FRAME_MIN_W, o.xRightPx + dx));
      }
      onWorkshopChange({
        ...workshop,
        frames: workshop.frames.map(f => f.graphId === fd.graphId ? { ...f, xLeftPx: left, xRightPx: right } : f)
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, workshop, onWorkshopChange, clientDeltaToInner, eventToInner, graphs, onPointDrag, onBezierHandleDrag, inner.w, inner.h, width, height]);

  // ─── Import de l'image du set ───
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      onWorkshopChange({
        ...workshop,
        image: { url, x: 0, y: 0, width: inner.w, height: inner.h }
      });
      // Lot 1-E — l'auto-ajustement post-import passe par l'entrée COMMUNE
      // (referme tracé/Bézier proprement) et respecte le verrou calibrations :
      // si des calibrations existent, l'image ne doit pas bouger sous elles.
      if (tracingActive) onFinishCurve?.();
      if (bezierActive) onFinishBezier?.();
      if (!hasCalibrations) setImageAdjust(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Ajouter un cadre ───
  const handleAddFrame = () => {
    const graphId = onRequestGraphForFrame();
    if (!graphId) return;
    // Lot 1-E (piège « mode image qui traîne ») : poser un cadre est le
    // premier geste HORS de l'image → l'ajustement auto-activé se referme.
    setImageAdjust(false);
    const sorted = [...workshop.frames].sort((a, b) => a.xRightPx - b.xRightPx);
    const last = sorted[sorted.length - 1];
    const left = last ? Math.min(last.xRightPx + 14, Math.max(0, inner.w - FRAME_MIN_W - 4)) : 6;
    const right = Math.min(inner.w - 2, left + Math.max(FRAME_MIN_W, Math.round(inner.w / 4)));
    onWorkshopChange({
      ...workshop,
      frames: [...workshop.frames, { graphId, xLeftPx: left, xRightPx: right }]
    });
    onFocusGraph(graphId);
  };

  // ─── Conversion COMPAT (D4) ───
  const handleConvertExisting = () => {
    if (graphs.length === 0) return;
    const gap = 12;
    const w = Math.max(FRAME_MIN_W, Math.floor((inner.w - gap * (graphs.length + 1)) / graphs.length));
    const frames: WorkshopFrame[] = graphs.map((g, i) => ({
      graphId: g.id,
      xLeftPx: gap + i * (w + gap),
      xRightPx: gap + i * (w + gap) + w
    }));
    onWorkshopChange({ ...workshop, frames });
  };

  const handleRemoveFrame = (graphId: string) => {
    onWorkshopChange({ ...workshop, frames: workshop.frames.filter(f => f.graphId !== graphId) });
  };

  // ─── R2b : calibration ───
  const startCalibY = () => {
    if (!workshop.sharedY.step) { alert('Définis d\'abord le pas de l\'axe Y commun (panneau Axes).'); return; }
    // Lot 1-E — garde croisée : entrer en calibration SORT du mode cadrage.
    setImageAdjust(false);
    // Ordre VISUEL haut→bas : max→min (non inversé), min→max (inversé)
    const vals = buildAxisValues(workshop.sharedY);
    const visual = workshop.sharedY.reversed ? vals : [...vals].reverse();
    setCalib({ kind: 'y', values: visual, index: 0, collected: [] });
  };

  const startCalibX = (graphId: string) => {
    const g = graphs.find(x => x.id === graphId);
    const xAxis = g?.axes?.xAxis;
    if (!xAxis?.step) { alert('Définis d\'abord le pas de l\'axe X de ce cadre (panneau Axes).'); return; }
    // Lot 1-E — garde croisée : entrer en calibration SORT du mode cadrage.
    setImageAdjust(false);
    const vals = buildAxisValues(xAxis);
    const visual = xAxis.reversed ? [...vals].reverse() : vals;
    setCalib({ kind: 'x', graphId, values: visual, index: 0, collected: [] });
  };

  const handleCalibClick = (e: React.PointerEvent<SVGRectElement>) => {
    if (!calib) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Conversion via la vue ZOOMÉE : calibrer en zoom rapproché est précisément
    // l'usage visé (les graduations fines se cliquent au pixel près).
    const vbX = view.x + ((e.clientX - rect.left) / rect.width) * view.w - MARGIN.left;
    const vbY = view.y + ((e.clientY - rect.top) / rect.height) * view.h - MARGIN.top;
    const value = calib.values[calib.index];
    const pixel = calib.kind === 'y' ? vbY : vbX;
    const collected = [...calib.collected, { value, pixel }];
    if (calib.index + 1 >= calib.values.length) {
      if (calib.kind === 'y') {
        onWorkshopChange({ ...workshop, yTicks: collected });
      } else if (calib.graphId) {
        onWorkshopChange({
          ...workshop,
          frames: workshop.frames.map(f => f.graphId === calib.graphId ? { ...f, xTicks: collected } : f)
        });
      }
      setCalib(null);
      return;
    }
    setCalib({ ...calib, index: calib.index + 1, collected });
  };

  // ─── Mutateurs d'axes ───
  const patchSharedY = (patch: Partial<AxisSpec>) => {
    onWorkshopChange({ ...workshop, sharedY: { ...workshop.sharedY, ...patch } });
  };

  const framesSorted = [...workshop.frames].sort((a, b) => a.xLeftPx - b.xLeftPx);
  const unframedCount = graphs.filter(g => !workshop.frames.some(f => f.graphId === g.id)).length;

  const focusedFrame = workshop.frames.find(f => f.graphId === selectedGraphId) || null;
  const focusedGraph = focusedFrame ? graphs.find(g => g.id === focusedFrame.graphId) || null : null;
  const focusedX: AxisSpec = focusedGraph?.axes?.xAxis || { min: 0, max: 100, unit: '', title: '' };

  const yTickValues = buildAxisValues(workshop.sharedY);

  // ─── Lot 1-E : UN SEUL MODE À LA FOIS — état dérivé des 4 modes du canevas.
  // calib et imageAdjust sont locaux ; tracé et Bézier appartiennent au parent
  // (le canevas ne peut que les REFERMER via onFinishCurve / onFinishBezier).
  const focusedCurve = focusedGraph?.curves.find(c => c.id === selectedCurveId) || null;
  const tracingActive = tracingMode && !!focusedCurve;
  const bezierActive = !!(bezierSegments && bezierSegments.length > 0);
  // Piège « mode image qui traîne » : dès qu'UNE calibration (Y ou X) existe,
  // l'image est verrouillée — les calibrations sont en pixels, la déplacer
  // les fausserait toutes.
  const hasCalibrations = !!(workshop.yTicks && workshop.yTicks.length > 0)
    || workshop.frames.some(f => !!f.xTicks && f.xTicks.length > 0);

  /** Entrée en mode cadrage : referme PROPREMENT le tracé (même chemin que
   *  « Terminer la courbe ») et la session Bézier avant d'armer l'ajustement. */
  const enterImageAdjust = () => {
    if (tracingActive) onFinishCurve?.();
    if (bezierActive) onFinishBezier?.();
    setImageAdjust(true);
  };

  // Garde croisée : ENTRER en tracé (capsule « Créer & tracer » ou wizard
  // « Ajouter des points ») sort du mode cadrage — les modes ne se
  // télescopent plus.
  useEffect(() => {
    if (tracingMode) setImageAdjust(false);
  }, [tracingMode]);

  return (
    <KitPanel title="Atelier — image unique">
      {/* ─── Barre d'outils du canevas — libellés STABLES (Lot 1-G) : l'état
          (« importée ✓ », « n à cadrer ») vit dans des KitBadge à côté des
          boutons, jamais dans leur texte. ─── */}
      <div style={{ display: 'flex', gap: SPACING.sm, alignItems: 'center', flexWrap: 'wrap', marginBottom: SPACING.sm }}>
        <KitButton
          level="secondary"
          size="compact"
          icon="📷"
          onClick={() => fileInputRef.current?.click()}
          title={workshop.image ? 'Remplace l\'image actuelle du set' : 'Importe la page du manuel de vol (filigrane du set)'}
        >
          Importer l'image
        </KitButton>
        {workshop.image && <KitBadge tone="ok">importée ✓</KitBadge>}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleImageUpload} />
        {workshop.image && (
          // Lot 1-E — KitButton à raison affichée : l'ajustement est
          // INACCESSIBLE pendant un tracé ou une calibration, et VERROUILLÉ
          // dès qu'une calibration existe (elle est en pixels : déplacer
          // l'image la fausserait).
          // Lot 1-G — libellé STABLE : l'état actif est porté par le
          // ModeBanner (« Cadrage de l'image », Échap/Annuler pour sortir) ;
          // re-cliquer le bouton sort aussi du mode.
          <KitButton
            level="secondary"
            size="compact"
            icon="✥"
            disabled={!imageAdjust && (hasCalibrations || tracingActive || !!calib)}
            disabledReason={
              hasCalibrations
                ? 'Image verrouillée : des calibrations existent (elles sont en pixels — déplacer l\'image les fausserait). Réinitialisez les calibrations pour ajuster.'
                : tracingActive
                  ? 'Tracé en cours — terminez la courbe (Échap) avant d\'ajuster l\'image.'
                  : 'Calibration en cours — terminez-la avant d\'ajuster l\'image.'
            }
            onClick={() => (imageAdjust ? setImageAdjust(false) : enterImageAdjust())}
            title={imageAdjust ? 'Termine l\'ajustement de l\'image (Échap marche aussi)' : 'Positionner et recadrer l\'image sous les cadres'}
          >
            Ajuster l'image
          </KitButton>
        )}
        <KitButton
          level="secondary"
          size="compact"
          icon="＋"
          onClick={handleAddFrame}
          title={unframedCount > 0 ? 'Cadrer le prochain graphe non cadré' : 'Créer un nouveau graphe et son cadre'}
        >
          Ajouter un cadre
        </KitButton>
        {unframedCount > 0 && <KitBadge tone="warn">{unframedCount} graphe{unframedCount > 1 ? 's' : ''} à cadrer</KitBadge>}

        {/* ─── ZOOM — 19/08 (demande pilote) : les boutons loupe et « Vue 100 % »
            sont retirés, la molette suffit (zoomBy reste branché sur l'événement
            wheel, ligne ~346). Seul l'indicateur de niveau demeure : savoir
            qu'on est zoomé évite les points posés hors du cadre visible. */}
        {zoomFactor > 1 && (
          <span style={{ fontSize: 11, minWidth: 44, textAlign: 'center', fontWeight: 600, marginLeft: 4, color: 'var(--accent-primary)' }}>
            {Math.round(zoomFactor * 100)} %
          </span>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
          Ordre gauche→droite des cadres = chaîne G1→G2→G3 · molette = zoom, glisser le fond = déplacer la vue
        </span>
      </div>

      {/* ─── Bandeau de conversion COMPAT ─── */}
      {workshop.frames.length === 0 && graphs.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          padding: '8px 10px', marginBottom: 8, borderRadius: 4,
          backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '1px solid var(--accent-primary)', fontSize: 12
        }}>
          <span>
            Ce modèle a <strong>{graphs.length} graphe(s)</strong> sans cadre (construit avant l'atelier image unique).
          </span>
          <KitButton level="secondary" size="compact" onClick={handleConvertExisting}>
            Créer un cadre par graphe
          </KitButton>
          <span style={{ color: 'var(--text-tertiary)' }}>puis recalez-les sur l'image et ré-importez le filigrane si besoin.</span>
        </div>
      )}

      {/* ─── Lot 1-E : BANDEAU DE MODE PERMANENT (ModeBanner du kit) ───
          UN bandeau, UN mode à la fois — priorité : calibration (verrouillage
          total existant) > tracé > Bézier > cadrage. L'écouteur Échap vit dans
          ModeBanner (Échap → onCancel) : chaque mode y branche SA sortie —
          calibration → annuler (✕ historique), tracé → terminer la courbe,
          Bézier → clore la session (builder), cadrage → terminer. */}
      {(calib || tracingActive || bezierActive || imageAdjust) && (
        <div style={{ marginBottom: 8 }}>
          {calib ? (
            <ModeBanner
              mode={`Calibration ${calib.kind === 'y' ? 'Y commun' : `X · ${graphs.find(g => g.id === calib.graphId)?.name || 'cadre'}`}`}
              instruction={`Clique sur la graduation ${calib.values[calib.index]} de l'image.`}
              progress={`${calib.index + 1} / ${calib.values.length}`}
              onCancel={() => setCalib(null)}
            />
          ) : tracingActive && focusedCurve ? (
            <ModeBanner
              mode={`Tracé de « ${focusedCurve.name} »`}
              instruction="Cliquez dans le cadre actif — Échap pour terminer"
              progress={`${focusedCurve.points.length} pt`}
              onCancel={() => onFinishCurve?.()}
            />
          ) : bezierActive ? (
            <ModeBanner
              mode="Façonnage Bézier"
              instruction="Tirez les poignées — Échap pour terminer"
              onCancel={() => onFinishBezier?.()}
            />
          ) : (
            <ModeBanner
              mode="Cadrage de l'image"
              instruction="Glissez l'image, poignées pour redimensionner — Échap ou premier cadre posé pour terminer"
              onCancel={() => setImageAdjust(false)}
            />
          )}
        </div>
      )}

      {/* ─── Le canevas ─── */}
      {/* ─── R2b+R8 : panneau AXES — AU-DESSUS de l'atelier (demande pilote),
          variables canoniques + unités verrouillées.
          Lot 1-G : anatomie KitPanel + libellés STABLES (« Calibrer Y » /
          « Calibrer X » — l'état « n pts ✓ » vit dans un KitBadge à côté). ─── */}
      <div style={{ marginBottom: SPACING.sm }}>
      <KitPanel title="Axes">
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* Y commun */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Aligné sur le CENTRE des champs (rangée en flex-end : les champs
              font 24 px en bas de colonne — le titre prend la même boîte). */}
          <strong style={{ fontSize: 11, color: 'var(--accent-primary)', alignSelf: 'flex-end', height: 24, display: 'inline-flex', alignItems: 'center' }}>Y COMMUN</strong>
          {/* R8 — variable canonique OBLIGATOIRE : title = id du catalogue
              (clé de branchement de la cascade), unité verrouillée. */}
          <VarSelectMini
            label="Variable"
            axis="y"
            value={workshop.sharedY.title}
            onChange={(id) => {
              const v = getAxisVariable(id);
              patchSharedY({ title: id, ...(v && v.id !== 'custom' ? { unit: v.defaultUnit } : {}) });
            }}
          />
          <UnitFieldMini variableId={workshop.sharedY.title} value={workshop.sharedY.unit} onChange={(u) => patchSharedY({ unit: u })} />
          <NumField label="Min" value={workshop.sharedY.min} onChange={(n) => patchSharedY({ min: n ?? 0 })} />
          <NumField label="Max" value={workshop.sharedY.max} onChange={(n) => patchSharedY({ max: n ?? 0 })} />
          <NumField label="Pas" value={workshop.sharedY.step} onChange={(n) => patchSharedY({ step: n })} width={56} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={!!workshop.sharedY.reversed} onChange={(e) => patchSharedY({ reversed: e.target.checked })} />
            inversé
          </label>
          <KitButton
            level="secondary"
            size="compact"
            icon="🎯"
            disabled={!!calib}
            disabledReason="Calibration en cours — termine-la (ou Échap) avant d'en lancer une autre."
            onClick={startCalibY}
            title="Clique les graduations Y de l'image pour caler l'échelle commune"
          >
            Calibrer Y
          </KitButton>
          {workshop.yTicks?.length ? <KitBadge tone="ok">{workshop.yTicks.length} pts ✓</KitBadge> : null}
          {workshop.yTicks?.length ? (
            <KitButton
              level="tertiary"
              size="compact"
              icon="↺"
              disabled={!!calib}
              disabledReason="Calibration en cours — termine-la avant de réinitialiser."
              onClick={() => onWorkshopChange({ ...workshop, yTicks: undefined })}
              title="Efface la calibration Y (les clics de graduations)"
            >
              Réinitialiser Y
            </KitButton>
          ) : null}
        </div>

        <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border-subtle)' }} />

        {/* X du cadre actif */}
        {focusedFrame && focusedGraph ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 11, color: 'var(--accent-primary)', alignSelf: 'flex-end', height: 24, display: 'inline-flex', alignItems: 'center' }}>
              X · {focusedGraph.name || 'cadre actif'}
              {focusedGraph.readoutAxis === 'x' ? ' — SORTIE (lue en bas)' : ''}
            </strong>
            {/* R8 — l'axe X = l'ENTRÉE consommée en prépa vol (OAT METAR,
                masse M&C, vent météo…) : variable canonique obligatoire.
                Lecture descendante (readoutAxis 'x') : l'axe X porte la
                SORTIE (distance) → variables de sortie (filtre du dropdown Y). */}
            <VarSelectMini
              label="Variable"
              axis={focusedGraph.readoutAxis === 'x' ? 'y' : 'x'}
              value={focusedX.title}
              onChange={(id) => {
                const v = getAxisVariable(id);
                onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, title: id, ...(v && v.id !== 'custom' ? { unit: v.defaultUnit } : {}) });
              }}
            />
            <UnitFieldMini variableId={focusedX.title} value={focusedX.unit} onChange={(u) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, unit: u })} />
            <NumField label="Min" value={focusedX.min} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, min: n ?? 0 })} />
            <NumField label="Max" value={focusedX.max} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, max: n ?? 0 })} />
            <NumField label="Pas" value={focusedX.step} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, step: n })} width={56} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!focusedX.reversed} onChange={(e) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, reversed: e.target.checked })} />
              inversé (ex. masse décroissante)
            </label>
            <KitButton
              level="secondary"
              size="compact"
              icon="🎯"
              disabled={!!calib}
              disabledReason="Calibration en cours — termine-la (ou Échap) avant d'en lancer une autre."
              onClick={() => startCalibX(focusedGraph.id)}
              title="Clique les graduations X du cadre actif pour caler son échelle"
            >
              Calibrer X
            </KitButton>
            {focusedFrame.xTicks?.length ? <KitBadge tone="ok">{focusedFrame.xTicks.length} pts ✓</KitBadge> : null}
            {focusedFrame.xTicks?.length ? (
              <KitButton
                level="tertiary"
                size="compact"
                icon="↺"
                disabled={!!calib}
                disabledReason="Calibration en cours — termine-la avant de réinitialiser."
                onClick={() => onWorkshopChange({
                  ...workshop,
                  frames: workshop.frames.map(f => f.graphId === focusedGraph.id ? { ...f, xTicks: undefined } : f)
                })}
                title="Efface la calibration X du cadre actif"
              >
                Réinitialiser X
              </KitButton>
            ) : null}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
            Cliquez un cadre pour régler son axe X (le Y est commun à tous).
          </span>
        )}
        </div>
      </KitPanel>
      </div>

      {/* ─── CAPSULE « NOUVELLE COURBE » — entre le panneau Axes (valeurs X/Y)
          et l'atelier (demande pilote) : la création vit au plus près du tracé.
          Le bloc « Courbes du cadre actif » RESTE sous l'atelier (liste,
          édition, Bézier, table de points) — connectés par les mêmes handlers
          du builder, mais plus liés visuellement. ─── */}
      {onCreateCurve && !calib && workshop.frames.length > 0 && (() => {
        // (focusedCurve est calculée plus haut — état dérivé des modes Lot 1-E.)
        // Arrondi du kit (6) — la capsule « pilule » à 999 tranchait avec les
        // panneaux (retour pilote 20/08 : arrondi beaucoup plus intense que
        // les sections Atelier / Identité).
        const pill: React.CSSProperties = {
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          margin: '0 0 8px', padding: '6px 12px', borderRadius: 6,
          backgroundColor: 'var(--bg-overlay)'
        };
        // Tracé en cours sur le cadre actif : la capsule pilote la FIN du geste
        // (créer → cliquer les points → terminer, sans quitter l'atelier).
        if (tracingMode && focusedCurve) {
          return (
            <div style={{ ...pill, border: '2px solid var(--accent-primary)' }}>
              <strong style={{ fontSize: 12, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                📍 Tracé de « {focusedCurve.name} »
              </strong>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                clique dans le cadre actif pour poser les points · {focusedCurve.points.length} point(s)
              </span>
              {onFinishCurve && (
                <button
                  onClick={onFinishCurve}
                  style={{ marginLeft: 'auto', height: 24, boxSizing: 'border-box', padding: '0 14px', cursor: 'pointer', backgroundColor: 'var(--status-success)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  ✓ Terminer la courbe
                </button>
              )}
            </div>
          );
        }
        // R17 — création par VALEUR quand le graphe a une variable de famille :
        // altitude → liste 0..10 000 / 500 ; autres familles → saisie numérique ;
        // graphe vent → direction en plus. Le NOM naît de la valeur choisie
        // (« 2000 ft », « Face 5 kt ») : nom et valeur d'appel ne divergent plus.
        const famId = focusedGraph?.familyAxisVariable;
        const fam = famId ? getAxisVariable(famId) : undefined;
        const famUnit = fam?.defaultUnit || '';
        const isAltitudeFam = !!famId && ALTITUDE_FAMILIES.includes(famId);
        const isWindGraph = !!focusedGraph?.isWindRelated;
        // 23/08 — panneau de correction : guides de pente NUMÉROTÉS (le moteur
        // ne lit pas leur valeur). Le premier cadre et les zones en lecture
        // descendante gardent la création PAR VALEUR.
        const numberedGuides = usesNumberedGuides(
          focusedGraph,
          isFirstFramedGraph(workshop, focusedGraph?.id)
        );
        const valueNum = parseFloat(newCurveValue);
        const valueOk = Number.isFinite(valueNum);
        // Lot 1-E (piège « sens du vent par défaut ») : tant que le sens n'est
        // pas choisi, pas de nom, pas de création — la raison est affichée.
        const windMissing = (!!fam || numberedGuides) && isWindGraph && newCurveWindDir === '';
        // Guide numéroté : le numéro est attribué automatiquement (max + 1) —
        // il n'a aucune signification physique, il ne sert qu'à distinguer.
        const guideN = numberedGuides ? nextGuideNumber(focusedGraph?.curves) : 0;
        const guideName = guideAutoName(guideN, isWindGraph ? newCurveWindDir : undefined);
        const createGuide = () => {
          if (!focusedFrame || windMissing) return;
          onCreateCurve(
            guideName,
            newCurveColor,
            guideN,
            isWindGraph ? (newCurveWindDir as 'headwind' | 'tailwind' | 'none') : undefined
          );
          if (isWindGraph) setNewCurveWindDir('');
        };
        const autoName = valueOk
          ? `${isWindGraph && newCurveWindDir !== '' ? (newCurveWindDir === 'headwind' ? 'Face ' : newCurveWindDir === 'tailwind' ? 'Arrière ' : 'Vent nul ') : ''}${valueNum}${famUnit ? ` ${famUnit}` : ''}`
          : '';
        const createDisabled = (numberedGuides
          ? windMissing
          : (fam ? !valueOk || windMissing : !newCurveName.trim())) || !focusedFrame;
        const createByValue = () => {
          if (!valueOk || !focusedFrame || windMissing) return;
          onCreateCurve(autoName, newCurveColor, valueNum, isWindGraph ? (newCurveWindDir as 'headwind' | 'tailwind' | 'none') : undefined);
          setNewCurveValue('');
          // Le sens se re-choisit à CHAQUE guide (jamais de sens hérité par oubli).
          if (isWindGraph) setNewCurveWindDir('');
        };
        return (
          <div style={{ ...pill, border: '1px solid var(--border-regular)' }}>
            <strong style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {numberedGuides ? '➕ Nouveau guide' : '➕ Nouvelle courbe'}
            </strong>
            {(numberedGuides || fam) ? (
              <>
                {numberedGuides ? (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Guides de pente : <strong>numérotés automatiquement</strong>, sans valeur propre
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {fam!.label}{famUnit ? ` (${famUnit})` : ''} :
                  </span>
                )}
                {numberedGuides ? null : isAltitudeFam ? (
                  <select
                    value={newCurveValue}
                    disabled={!focusedFrame}
                    onChange={(e) => setNewCurveValue(e.target.value)}
                    style={{ minWidth: 110, height: 24, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— valeur —</option>
                    {ALTITUDE_STEPS.map(v => <option key={v} value={v}>{v}{famUnit ? ` ${famUnit}` : ''}</option>)}
                  </select>
                ) : (
                  <input
                    type="number"
                    placeholder={`valeur en ${famUnit || '…'}`}
                    value={newCurveValue}
                    disabled={!focusedFrame}
                    onChange={(e) => setNewCurveValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') createByValue(); }}
                    style={{ width: 110, height: 24, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                )}
                {isWindGraph && (
                  <select
                    value={newCurveWindDir}
                    onChange={(e) => setNewCurveWindDir(e.target.value as '' | 'headwind' | 'tailwind' | 'none')}
                    style={{
                      height: 24, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, borderRadius: 6,
                      border: `1px solid ${windMissing ? 'var(--accent-primary)' : 'var(--border-regular)'}`,
                      backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
                    }}
                  >
                    {/* Lot 1-E — option vide de départ : le sens se CHOISIT, il
                        n'est jamais hérité d'un défaut. */}
                    <option value="" disabled>— sens du vent ? —</option>
                    <option value="headwind">Vent de face</option>
                    <option value="none">Vent nul</option>
                    <option value="tailwind">Vent arrière</option>
                  </select>
                )}
                {windMissing && (
                  <span style={{ fontSize: 11, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                    Choisissez le sens du vent du guide
                  </span>
                )}
                {((numberedGuides && !windMissing) || (!numberedGuides && valueOk && !windMissing)) && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    → « {numberedGuides ? guideName : autoName} »
                  </span>
                )}
              </>
            ) : (
              <input
                type="text"
                placeholder={focusedGraph
                  ? `Nom (ex: "0 ft", "20°C") — déclare une variable de famille pour créer par valeur`
                  : 'Clique d\'abord un cadre sur l\'image'}
                value={newCurveName}
                disabled={!focusedFrame}
                onChange={(e) => setNewCurveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCurveName.trim() && focusedFrame) {
                    onCreateCurve(newCurveName.trim(), newCurveColor);
                    setNewCurveName('');
                  }
                }}
                style={{ flex: 1, minWidth: 170, height: 24, boxSizing: 'border-box', padding: '0 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            )}
            <input
              type="color"
              value={newCurveColor}
              onChange={(e) => setNewCurveColor(e.target.value)}
              title="Couleur de la courbe"
              style={{ width: 30, height: 24, padding: 0, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
            />
            <button
              onClick={() => {
                if (numberedGuides) { createGuide(); return; }
                if (fam) { createByValue(); return; }
                if (!newCurveName.trim() || !focusedFrame) return;
                onCreateCurve(newCurveName.trim(), newCurveColor);
                setNewCurveName('');
              }}
              disabled={createDisabled}
              title={windMissing ? 'Choisissez le sens du vent du guide' : undefined}
              style={{ height: 24, boxSizing: 'border-box', padding: '0 14px', cursor: createDisabled ? 'not-allowed' : 'pointer', backgroundColor: 'var(--status-success)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', opacity: createDisabled ? 0.45 : 1 }}
            >
              Créer & tracer
            </button>
          </div>
        );
      })()}

      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={{
          width: '100%', display: 'block', backgroundColor: 'var(--bg-overlay)', borderRadius: 4, touchAction: 'none',
          cursor: drag?.kind === 'pan' ? 'grabbing' : (zoomFactor > 1 && !calib ? 'grab' : undefined)
        }}
        onPointerDown={(e) => {
          // ZOOM — pan au glisser sur le FOND : les éléments interactifs
          // (cadres, poignées, points, Bézier) font tous stopPropagation,
          // donc arriver ici = clic hors de toute zone d'édition.
          if (calib || zoomFactor <= 1) return;
          setDrag({ kind: 'pan', startX: e.clientX, startY: e.clientY, origin: viewRef.current });
        }}
        onPointerMove={(e) => {
          if (!tracingMode) return;
          setCursorPos(eventToInner(e));
        }}
        onPointerLeave={() => setCursorPos(null)}
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Zone inner */}
          <rect x={0} y={0} width={inner.w} height={inner.h} fill="none" stroke="var(--border-subtle)" />

          {/* Image du set */}
          {workshop.image ? (
            <>
              <image
                href={workshop.image.url}
                x={workshop.image.x}
                y={workshop.image.y}
                width={workshop.image.width}
                height={workshop.image.height}
                opacity={imageAdjust ? 0.8 : 0.5}
                preserveAspectRatio="none"
                style={{ cursor: imageAdjust ? 'move' : 'default' }}
                onPointerDown={(e) => {
                  if (!imageAdjust || !workshop.image || calib) return;
                  e.stopPropagation();
                  setDrag({ kind: 'img-move', startX: e.clientX, startY: e.clientY, origin: workshop.image });
                }}
              />
              {imageAdjust && !calib && (
                <>
                  {([
                    { k: 'img-tl' as const, cx: workshop.image.x, cy: workshop.image.y, cursor: 'nwse-resize' },
                    { k: 'img-tr' as const, cx: workshop.image.x + workshop.image.width, cy: workshop.image.y, cursor: 'nesw-resize' },
                    { k: 'img-bl' as const, cx: workshop.image.x, cy: workshop.image.y + workshop.image.height, cursor: 'nesw-resize' },
                    { k: 'img-br' as const, cx: workshop.image.x + workshop.image.width, cy: workshop.image.y + workshop.image.height, cursor: 'nwse-resize' }
                  ]).map(h => (
                    <rect
                      key={h.k}
                      x={h.cx - 6} y={h.cy - 6} width={12} height={12}
                      fill="var(--bg-surface)" stroke="var(--accent-primary)" strokeWidth={2} rx={2}
                      style={{ cursor: h.cursor }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDrag({ kind: h.k, startX: e.clientX, startY: e.clientY, origin: workshop.image! });
                      }}
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            <text x={inner.w / 2} y={inner.h / 2} textAnchor="middle" fontSize={13} fill="var(--text-tertiary)">
              📷 Importez l'image de l'abaque (page du manuel de vol) — elle servira de filigrane aux {Math.max(graphs.length, 1)} cadre(s)
            </text>
          )}

          {/* ─── R3 : COURBES de tous les cadres (la vraie vue d'ensemble) ───
              Chaque courbe est reprojetée dans SON cadre via les mappings
              value↔pixel (calibration comprise). Cadre actif net, inactifs
              estompés. Traits non interactifs (les points le sont, plus bas). */}
          {framesSorted.map(f => {
            const g = graphs.find(x => x.id === f.graphId);
            if (!g?.axes) return null;
            const isFocus = f.graphId === selectedGraphId;
            return (
              <g key={`curves-${f.graphId}`} pointerEvents="none" opacity={isFocus ? 1 : 0.45}>
                {g.curves.map(curve => {
                  const pts = (curve.fitted?.points?.length ? curve.fitted.points : curve.points);
                  if (!pts || pts.length < 2) return null;
                  const d = pts
                    .map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${xValueToPixel(p.x, g.axes!.xAxis, f).toFixed(1)} ${yValueToPixel(p.y, workshop.sharedY, inner.h, workshop.yTicks).toFixed(1)}`)
                    .join(' ');
                  // R7 — pendant une session Bézier, l'ANCIEN tracé de la courbe
                  // façonnée s'estompe en pointillés : la preview Bézier (plus
                  // bas) montre le nouveau, pas de double trait ambigu.
                  const inBezier = isFocus && curve.id === selectedCurveId && !!bezierSegments?.length;
                  return (
                    <path
                      key={curve.id}
                      d={d}
                      fill="none"
                      stroke={curve.color}
                      // R16 — traits FINS (demande pilote) : le tracé ne doit pas
                      // masquer le trait du MANEX qu'on suit ; non-scaling-stroke
                      // garde cette finesse à l'écran même zoomé à 800 %.
                      strokeWidth={isFocus ? 1.1 : 0.8}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={inBezier ? '5 4' : undefined}
                      opacity={inBezier ? 0.25 : curve.id === selectedCurveId ? 1 : 0.85}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* ─── R2b : règle Y COMMUNE graduée (gauche) ─── */}
          <line x1={-6} y1={0} x2={-6} y2={inner.h} stroke="var(--accent-primary)" strokeWidth={2.5} opacity={0.85} />
          {(workshop.yTicks && workshop.yTicks.length >= 2
            ? workshop.yTicks.map(t => ({ v: t.value, py: t.pixel, calibrated: true }))
            : yTickValues.map(v => ({ v, py: yValueToPixel(v, workshop.sharedY, inner.h, undefined), calibrated: false }))
          ).map(({ v, py, calibrated }) => (
            <g key={`yt-${v}`} pointerEvents="none">
              <line x1={-11} y1={py} x2={-2} y2={py} stroke="var(--accent-primary)" strokeWidth={calibrated ? 2 : 1} />
              <text x={-14} y={py + 3} fontSize={9} fill="var(--accent-primary)" textAnchor="end">{v}</text>
              {calibrated && (
                <line x1={0} y1={py} x2={inner.w} y2={py} stroke="var(--accent-primary)" strokeWidth={0.5} opacity={0.18} />
              )}
            </g>
          ))}
          <text x={-44} y={inner.h / 2} fontSize={10} fill="var(--accent-primary)" transform={`rotate(-90 -44 ${inner.h / 2})`} textAnchor="middle" fontWeight={600}>
            Y COMMUN {workshop.sharedY.title ? `· ${getAxisVariableLabel(workshop.sharedY.title)}` : ''} {workshop.sharedY.unit ? `(${workshop.sharedY.unit})` : ''}
            {workshop.yTicks?.length ? ' — calibré ✓' : ''}
          </text>

          {/* Cadres */}
          {framesSorted.map((f, i) => {
            const g = graphs.find(x => x.id === f.graphId);
            const isFocus = f.graphId === selectedGraphId;
            const color = isFocus ? FRAME_FOCUS : FRAME_IDLE;
            const w = f.xRightPx - f.xLeftPx;
            const xAxis = g?.axes?.xAxis;
            return (
              <g key={f.graphId}>
                <rect
                  x={f.xLeftPx} y={0} width={w} height={inner.h}
                  fill={isFocus ? 'rgba(242, 105, 33, 0.08)' : 'transparent'}
                  stroke={color} strokeWidth={isFocus ? 2.5 : 1.5}
                  strokeDasharray={isFocus ? 'none' : '7 4'}
                  rx={3}
                  style={{ cursor: calib ? 'crosshair' : (isFocus && tracingMode && selectedCurveId ? 'crosshair' : 'move') }}
                  onPointerDown={(e) => {
                    if (calib) return; // la calibration capture les clics via l'overlay
                    e.stopPropagation();
                    // Lot 1-E (piège « mode image qui traîne ») : tout geste sur
                    // un cadre referme l'ajustement d'image auto-activé.
                    setImageAdjust(false);
                    // Lot 1-E (piège « contamination croisée ») : cliquer un
                    // AUTRE cadre pendant un tracé TERMINE la courbe proprement
                    // (même chemin que « Terminer la courbe ») et change le
                    // focus SANS démarrer de drag sur ce clic. L'auto-sélection
                    // d'une courbe du nouveau graphe est neutralisée côté
                    // AbacBuilder (effet de focus, garde mode tracé).
                    if (tracingActive && !isFocus) {
                      onFinishCurve?.();
                      onFocusGraph(f.graphId);
                      return;
                    }
                    onFocusGraph(f.graphId);
                    // R3 — mode TRACÉ sur le cadre actif : le clic AJOUTE un point
                    // (le déplacement du cadre est gelé tant qu'on trace).
                    if (isFocus && tracingMode && selectedCurveId && onPointClick && g?.axes) {
                      const pos = eventToInner(e);
                      if (pos) {
                        const dataX = xPixelToValue(pos.x, g.axes.xAxis, f);
                        const dataY = yPixelToValue(pos.y, workshop.sharedY, inner.h, workshop.yTicks);
                        onPointClick(dataX, dataY);
                      }
                      return;
                    }
                    setDrag({ kind: 'frame-move', graphId: f.graphId, startX: e.clientX, origin: f });
                  }}
                />
                <text x={f.xLeftPx + 6} y={16} fontSize={11} fontWeight={600} fill={color} pointerEvents="none">
                  {i + 1} · {g?.name || 'Graphique'}{isFocus ? ' — ACTIF' : ''}
                </text>
                <text
                  x={f.xRightPx - 12} y={16} fontSize={11} fill={color}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleRemoveFrame(f.graphId); }}
                >
                  ✕<title>Retirer le cadre (le graphe et ses courbes sont conservés)</title>
                </text>
                {/* ─── Lot 1-E (affordance) : les barres-poignées visibles à
                    mi-hauteur SONT la zone interactive du redimensionnement —
                    élargie (12 px) et allumée en accent au survol. Les bandes
                    transparentes pleine hauteur de 7 px ont disparu : le geste
                    n'est plus invisible. ─── */}
                {(['left', 'right'] as const).map(side => {
                  const hx = side === 'left' ? f.xLeftPx : f.xRightPx;
                  const dragKind = side === 'left' ? 'frame-left' as const : 'frame-right' as const;
                  const lit = !calib && (
                    (hoverHandle?.graphId === f.graphId && hoverHandle.side === side) ||
                    (!!drag && drag.kind === dragKind && drag.graphId === f.graphId)
                  );
                  return (
                    <g key={`handle-${side}`}>
                      {/* barre visible (l'affordance) */}
                      <rect
                        x={hx - (lit ? 3.5 : 2.5)} y={inner.h / 2 - (lit ? 18 : 14)}
                        width={lit ? 7 : 5} height={lit ? 36 : 28} rx={2}
                        fill={lit ? 'var(--accent-primary)' : color} opacity={lit ? 1 : 0.9}
                        pointerEvents="none"
                      />
                      {/* zone interactive élargie autour de la barre */}
                      {!calib && (
                        <rect
                          x={hx - HANDLE_HIT_W / 2} y={inner.h / 2 - HANDLE_HIT_H / 2}
                          width={HANDLE_HIT_W} height={HANDLE_HIT_H}
                          fill="transparent" style={{ cursor: 'ew-resize' }}
                          onPointerEnter={() => setHoverHandle({ graphId: f.graphId, side })}
                          onPointerLeave={() => setHoverHandle(null)}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            // Mêmes gardes croisées que le corps du cadre :
                            // geste de cadre → sortie du mode cadrage ; autre
                            // cadre pendant un tracé → terminer + focus, pas
                            // de drag sur ce clic.
                            setImageAdjust(false);
                            if (tracingActive && !isFocus) {
                              onFinishCurve?.();
                              onFocusGraph(f.graphId);
                              return;
                            }
                            onFocusGraph(f.graphId);
                            setDrag({ kind: dragKind, graphId: f.graphId, startX: e.clientX, origin: f });
                          }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* ─── R2b : règle X du cadre (sous le cadre) ─── */}
                <line x1={f.xLeftPx} y1={inner.h + 6} x2={f.xRightPx} y2={inner.h + 6} stroke={color} strokeWidth={2} opacity={0.9} pointerEvents="none" />
                {xAxis && (f.xTicks && f.xTicks.length >= 2
                  ? f.xTicks.map(t => ({ v: t.value, px: t.pixel, calibrated: true }))
                  : buildAxisValues(xAxis).map(v => ({ v, px: xValueToPixel(v, xAxis, { ...f, xTicks: undefined }), calibrated: false }))
                ).map(({ v, px, calibrated }, ti) => (
                  <g key={`xt-${f.graphId}-${ti}`} pointerEvents="none">
                    <line x1={px} y1={inner.h + 2} x2={px} y2={inner.h + 10} stroke={color} strokeWidth={calibrated ? 2 : 1} />
                    <text x={px} y={inner.h + 20} fontSize={8} fill={color} textAnchor="middle">{v}</text>
                  </g>
                ))}
                <text x={(f.xLeftPx + f.xRightPx) / 2} y={inner.h + 32} fontSize={9} fill={color} textAnchor="middle" pointerEvents="none">
                  {xAxis?.title ? getAxisVariableLabel(xAxis.title) : 'X'} {xAxis?.unit ? `(${xAxis.unit})` : ''}{xAxis?.reversed ? ' ⇐' : ''}{f.xTicks?.length ? ' — calibré ✓' : ''}
                </text>

                {/* flèche de chaîne vers le cadre suivant */}
                {i < framesSorted.length - 1 && (
                  <g pointerEvents="none" opacity={0.85}>
                    <line
                      x1={f.xRightPx + 2} y1={inner.h + 40}
                      x2={framesSorted[i + 1].xLeftPx - 2} y2={inner.h + 40}
                      stroke="var(--accent-primary)" strokeWidth={1.6}
                    />
                    <path
                      d={`M ${framesSorted[i + 1].xLeftPx - 8} ${inner.h + 36} L ${framesSorted[i + 1].xLeftPx - 2} ${inner.h + 40} L ${framesSorted[i + 1].xLeftPx - 8} ${inner.h + 44}`}
                      fill="none" stroke="var(--accent-primary)" strokeWidth={1.6}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* ─── R3 : POINTS du cadre ACTIF — la courbe sélectionnée s'édite ici :
              glisser un point pour le déplacer, clic droit pour le supprimer. ─── */}
          {focusedFrame && focusedGraph?.axes && !calib && focusedGraph.curves.map(curve => {
            const isSel = curve.id === selectedCurveId;
            return curve.points.map(p => {
              if (p.id === undefined) return null;
              const px = xValueToPixel(p.x, focusedGraph.axes!.xAxis, focusedFrame);
              const py = yValueToPixel(p.y, workshop.sharedY, inner.h, workshop.yTicks);
              // Retour pilote 23/08 : marqueurs DEUX FOIS plus petits (2,5 px au
              // lieu de 5 sur la courbe sélectionnée, 1,5 au lieu de 3 ailleurs)
              // pour ne plus masquer le trait du manuel — la zone de saisie du
              // glisser reste large (cercle transparent de 7 px) pour le confort.
              return (
                <g key={`pt-${curve.id}-${p.id}`}>
                  <circle
                    cx={px} cy={py} r={isSel ? 2.5 : 1.5}
                    fill={curve.color}
                    stroke="var(--bg-surface)"
                    strokeWidth={isSel ? 1 : 0.5}
                    pointerEvents="none"
                  />
                  {isSel && (
                    <circle
                      cx={px} cy={py} r={7}
                      fill="transparent"
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDrag({ kind: 'point', graphId: focusedGraph.id, curveId: curve.id, pointId: p.id! });
                      }}
                      onContextMenu={onPointDelete ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onPointDelete(curve.id, p.id!);
                      } : undefined}
                    >
                      <title>{`${curve.name} · (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) — glisser / clic droit pour supprimer`}</title>
                    </circle>
                  )}
                </g>
              );
            });
          })}

          {/* ─── R7 : FAÇONNAGE BÉZIER sur le canevas — preview de la courbe
              façonnée + poignées cp1/cp2 tirables PAR-DESSUS l'image (suivre
              les traits). Coords data → pixels via les mappings du cadre actif
              (calibration comprise) ; le drag passe par le pattern unifié. ─── */}
          {bezierSegments && bezierSegments.length > 0 && focusedFrame && focusedGraph?.axes && !calib && (() => {
            const toPx = (p: { x: number; y: number }) => ({
              x: xValueToPixel(p.x, focusedGraph.axes!.xAxis, focusedFrame),
              y: yValueToPixel(p.y, workshop.sharedY, inner.h, workshop.yTicks)
            });
            const color = focusedGraph.curves.find(c => c.id === selectedCurveId)?.color || 'var(--accent-primary)';
            const d = bezierSegments.map((s, i) => {
              const p0 = toPx(s.p0), c1 = toPx(s.cp1), c2 = toPx(s.cp2), p1 = toPx(s.p1);
              return `${i === 0 ? `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ` : ''}C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
            }).join(' ');
            return (
              <g data-bezier-layer="1">
                {/* R16 — preview fine elle aussi (non-scaling : reste fine au zoom) */}
                <path d={d} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                {bezierSegments.map((s, i) => {
                  const p0 = toPx(s.p0), c1 = toPx(s.cp1), c2 = toPx(s.cp2), p1 = toPx(s.p1);
                  return (
                    <g key={`bz-${i}`}>
                      <line x1={p0.x} y1={p0.y} x2={c1.x} y2={c1.y} stroke="var(--text-secondary)" strokeDasharray="3 3" strokeWidth={1} pointerEvents="none" />
                      <line x1={p1.x} y1={p1.y} x2={c2.x} y2={c2.y} stroke="var(--text-secondary)" strokeDasharray="3 3" strokeWidth={1} pointerEvents="none" />
                      {(['cp1', 'cp2'] as const).map(which => {
                        const c = which === 'cp1' ? c1 : c2;
                        return (
                          <circle
                            key={which}
                            cx={c.x} cy={c.y} r={6}
                            fill="var(--bg-surface)"
                            stroke={color}
                            strokeWidth={2}
                            style={{ cursor: 'grab' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDrag({ kind: 'bezier', graphId: focusedFrame.graphId, segIdx: i, which });
                            }}
                          >
                            <title>Poignée Bézier — tire pour faire suivre le trait de l'image à la courbe</title>
                          </circle>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* ─── R3 : réticule de tracé (cadre actif, mode placement) ─── */}
          {tracingMode && selectedCurveId && focusedFrame && focusedGraph?.axes && cursorPos &&
            cursorPos.x >= focusedFrame.xLeftPx && cursorPos.x <= focusedFrame.xRightPx &&
            cursorPos.y >= 0 && cursorPos.y <= inner.h && !drag && !calib && (
            <g pointerEvents="none">
              <line x1={focusedFrame.xLeftPx} y1={cursorPos.y} x2={focusedFrame.xRightPx} y2={cursorPos.y}
                stroke="var(--accent-primary)" strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />
              <line x1={cursorPos.x} y1={0} x2={cursorPos.x} y2={inner.h}
                stroke="var(--accent-primary)" strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />
              <text x={cursorPos.x + 7} y={cursorPos.y - 7} fontSize={10} fill="var(--accent-primary)">
                ({xPixelToValue(cursorPos.x, focusedGraph.axes.xAxis, focusedFrame).toFixed(1)}, {yPixelToValue(cursorPos.y, workshop.sharedY, inner.h, workshop.yTicks).toFixed(1)})
              </text>
            </g>
          )}

          {/* ─── R2b : overlay de capture des clics de calibration (au-dessus de tout) ─── */}
          {calib && (
            <rect
              x={-MARGIN.left} y={-MARGIN.top} width={width} height={height}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onPointerDown={handleCalibClick}
            />
          )}
        </g>
      </svg>

    </KitPanel>
  );
};
