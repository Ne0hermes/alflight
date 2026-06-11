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
  width?: number;
  height?: number;
}

// Marges des règles d'axes : Y commun à gauche, X sous les cadres.
const MARGIN = { top: 30, right: 16, bottom: 46, left: 64 };
const FRAME_MIN_W = 60;   // largeur minimale d'un cadre (px inner)
const HANDLE_W = 7;       // largeur des poignées de bord

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
          width, padding: '3px 6px', fontSize: 12, borderRadius: 3,
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
          width, padding: '3px 6px', fontSize: 12, borderRadius: 3,
          border: '1px solid var(--border-regular)', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)'
        }}
      />
    </label>
  );

export const WorkshopCanvas: React.FC<WorkshopCanvasProps> = ({
  workshop,
  graphs,
  selectedGraphId,
  onWorkshopChange,
  onFocusGraph,
  onRequestGraphForFrame,
  onUpdateGraphXAxis,
  width = 960,
  height = 560
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inner = { w: width - MARGIN.left - MARGIN.right, h: height - MARGIN.top - MARGIN.bottom };

  const [imageAdjust, setImageAdjust] = useState(false);

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

  // ─── Drag unifié (image OU cadre), pattern pointer-events fenêtre ───
  type DragState =
    | { kind: 'img-move' | 'img-tl' | 'img-tr' | 'img-bl' | 'img-br'; startX: number; startY: number; origin: WorkshopImage }
    | { kind: 'frame-move' | 'frame-left' | 'frame-right'; graphId: string; startX: number; origin: WorkshopFrame };
  const [drag, setDrag] = useState<DragState | null>(null);

  const clientDeltaToInner = useCallback((dxClient: number, dyClient: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { dx: 0, dy: 0 };
    return { dx: (dxClient / rect.width) * width, dy: (dyClient / rect.height) * height };
  }, [width, height]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
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
  }, [drag, workshop, onWorkshopChange, clientDeltaToInner, inner.w]);

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
      setImageAdjust(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Ajouter un cadre ───
  const handleAddFrame = () => {
    const graphId = onRequestGraphForFrame();
    if (!graphId) return;
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
    // Ordre VISUEL haut→bas : max→min (non inversé), min→max (inversé)
    const vals = buildAxisValues(workshop.sharedY);
    const visual = workshop.sharedY.reversed ? vals : [...vals].reverse();
    setCalib({ kind: 'y', values: visual, index: 0, collected: [] });
  };

  const startCalibX = (graphId: string) => {
    const g = graphs.find(x => x.id === graphId);
    const xAxis = g?.axes?.xAxis;
    if (!xAxis?.step) { alert('Définis d\'abord le pas de l\'axe X de ce cadre (panneau Axes).'); return; }
    const vals = buildAxisValues(xAxis);
    const visual = xAxis.reversed ? [...vals].reverse() : vals;
    setCalib({ kind: 'x', graphId, values: visual, index: 0, collected: [] });
  };

  const handleCalibClick = (e: React.PointerEvent<SVGRectElement>) => {
    if (!calib) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vbX = ((e.clientX - rect.left) / rect.width) * width - MARGIN.left;
    const vbY = ((e.clientY - rect.top) / rect.height) * height - MARGIN.top;
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

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, backgroundColor: 'var(--bg-surface)', padding: 10, marginBottom: 14 }}>
      {/* ─── Barre d'outils du canevas ─── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: 'var(--accent-primary)' }}>🗺 Atelier — image unique</strong>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', borderRadius: 3, fontSize: 12 }}
        >
          📷 {workshop.image ? 'Changer l\'image' : 'Importer l\'image du MANEX'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleImageUpload} />
        {workshop.image && (
          <button
            onClick={() => setImageAdjust(v => !v)}
            style={{
              padding: '4px 10px', cursor: 'pointer', borderRadius: 3, fontSize: 12,
              backgroundColor: imageAdjust ? 'var(--accent-primary)' : 'var(--bg-overlay)',
              color: imageAdjust ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--accent-primary)'
            }}
          >
            {imageAdjust ? '✓ Terminer l\'ajustement' : '✥ Ajuster l\'image'}
          </button>
        )}
        <button
          onClick={handleAddFrame}
          style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-overlay)', color: 'var(--text-primary)', border: '1px dashed var(--border-regular)', borderRadius: 3, fontSize: 12 }}
          title={unframedCount > 0 ? `Cadrer le prochain graphe non cadré (${unframedCount} restant)` : 'Créer un nouveau graphe et son cadre'}
        >
          ＋ Ajouter un cadre {unframedCount > 0 ? `(${unframedCount} graphe(s) à cadrer)` : ''}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
          L'ordre gauche→droite des cadres = chaîne de lecture G1→G2→G3
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
          <button
            onClick={handleConvertExisting}
            style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 3, fontWeight: 500 }}
          >
            Créer un cadre par graphe
          </button>
          <span style={{ color: 'var(--text-tertiary)' }}>puis recalez-les sur l'image et ré-importez le filigrane si besoin.</span>
        </div>
      )}

      {/* ─── R2b : bannière de calibration en cours ─── */}
      {calib && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          padding: '8px 10px', marginBottom: 8, borderRadius: 4,
          backgroundColor: 'rgba(242, 105, 33, 0.10)', border: '2px solid var(--accent-primary)', fontSize: 12
        }}>
          <strong>🎯 Calibration {calib.kind === 'y' ? 'Y commun' : `X · ${graphs.find(g => g.id === calib.graphId)?.name || 'cadre'}`} :</strong>
          <span>clique sur la graduation <strong style={{ fontSize: 14 }}>{calib.values[calib.index]}</strong> de l'image.</span>
          <span style={{ marginLeft: 'auto' }}>{calib.index + 1} / {calib.values.length}</span>
          <button
            onClick={() => setCalib(null)}
            style={{ padding: '3px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-primary)', borderRadius: 3, color: 'var(--text-primary)' }}
          >
            ✕ Annuler
          </button>
        </div>
      )}

      {/* ─── Le canevas ─── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', display: 'block', backgroundColor: 'var(--bg-overlay)', borderRadius: 4, touchAction: 'none' }}
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
              📷 Importez l'image de l'abaque (page du MANEX) — elle servira de filigrane aux {Math.max(graphs.length, 1)} cadre(s)
            </text>
          )}

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
            Y COMMUN {workshop.sharedY.title ? `· ${workshop.sharedY.title}` : ''} {workshop.sharedY.unit ? `(${workshop.sharedY.unit})` : ''}
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
                  style={{ cursor: calib ? 'crosshair' : 'move' }}
                  onPointerDown={(e) => {
                    if (calib) return; // la calibration capture les clics via l'overlay
                    e.stopPropagation();
                    onFocusGraph(f.graphId);
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
                {!calib && (
                  <>
                    <rect
                      x={f.xLeftPx - HANDLE_W / 2} y={0} width={HANDLE_W} height={inner.h}
                      fill="transparent" style={{ cursor: 'ew-resize' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onFocusGraph(f.graphId);
                        setDrag({ kind: 'frame-left', graphId: f.graphId, startX: e.clientX, origin: f });
                      }}
                    />
                    <rect
                      x={f.xRightPx - HANDLE_W / 2} y={0} width={HANDLE_W} height={inner.h}
                      fill="transparent" style={{ cursor: 'ew-resize' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onFocusGraph(f.graphId);
                        setDrag({ kind: 'frame-right', graphId: f.graphId, startX: e.clientX, origin: f });
                      }}
                    />
                  </>
                )}
                <rect x={f.xLeftPx - 2.5} y={inner.h / 2 - 14} width={5} height={28} rx={2} fill={color} opacity={0.9} pointerEvents="none" />
                <rect x={f.xRightPx - 2.5} y={inner.h / 2 - 14} width={5} height={28} rx={2} fill={color} opacity={0.9} pointerEvents="none" />

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
                  {xAxis?.title || 'X'} {xAxis?.unit ? `(${xAxis.unit})` : ''}{xAxis?.reversed ? ' ⇐' : ''}{f.xTicks?.length ? ' — calibré ✓' : ''}
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

      {/* ─── R2b : panneau AXES — Y commun (une fois) + X du cadre actif ─── */}
      <div style={{
        display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap',
        marginTop: 8, padding: '8px 10px', borderRadius: 4,
        backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)'
      }}>
        {/* Y commun */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 11, color: 'var(--accent-primary)', alignSelf: 'center' }}>Y COMMUN</strong>
          <TextFieldMini label="Titre" value={workshop.sharedY.title} onChange={(s) => patchSharedY({ title: s })} />
          <TextFieldMini label="Unité" value={workshop.sharedY.unit} onChange={(s) => patchSharedY({ unit: s })} width={56} />
          <NumField label="Min" value={workshop.sharedY.min} onChange={(n) => patchSharedY({ min: n ?? 0 })} />
          <NumField label="Max" value={workshop.sharedY.max} onChange={(n) => patchSharedY({ max: n ?? 0 })} />
          <NumField label="Pas" value={workshop.sharedY.step} onChange={(n) => patchSharedY({ step: n })} width={56} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={!!workshop.sharedY.reversed} onChange={(e) => patchSharedY({ reversed: e.target.checked })} />
            inversé
          </label>
          <button
            onClick={startCalibY}
            disabled={!!calib}
            style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, backgroundColor: workshop.yTicks?.length ? 'rgba(79, 174, 127, 0.12)' : 'var(--bg-surface)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)' }}
          >
            🎯 Calibrer Y {workshop.yTicks?.length ? `(${workshop.yTicks.length} pts ✓)` : ''}
          </button>
          {workshop.yTicks?.length ? (
            <button
              onClick={() => onWorkshopChange({ ...workshop, yTicks: undefined })}
              disabled={!!calib}
              style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-red-critical)', color: 'var(--color-red-critical)' }}
            >
              ↺ Reset Y
            </button>
          ) : null}
        </div>

        <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border-subtle)' }} />

        {/* X du cadre actif */}
        {focusedFrame && focusedGraph ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 11, color: 'var(--accent-primary)', alignSelf: 'center' }}>
              X · {focusedGraph.name || 'cadre actif'}
            </strong>
            <TextFieldMini label="Titre" value={focusedX.title} onChange={(s) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, title: s })} />
            <TextFieldMini label="Unité" value={focusedX.unit} onChange={(s) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, unit: s })} width={56} />
            <NumField label="Min" value={focusedX.min} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, min: n ?? 0 })} />
            <NumField label="Max" value={focusedX.max} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, max: n ?? 0 })} />
            <NumField label="Pas" value={focusedX.step} onChange={(n) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, step: n })} width={56} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!focusedX.reversed} onChange={(e) => onUpdateGraphXAxis(focusedGraph.id, { ...focusedX, reversed: e.target.checked })} />
              inversé (ex. masse décroissante)
            </label>
            <button
              onClick={() => startCalibX(focusedGraph.id)}
              disabled={!!calib}
              style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, backgroundColor: focusedFrame.xTicks?.length ? 'rgba(79, 174, 127, 0.12)' : 'var(--bg-surface)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)' }}
            >
              🎯 Calibrer X {focusedFrame.xTicks?.length ? `(${focusedFrame.xTicks.length} pts ✓)` : ''}
            </button>
            {focusedFrame.xTicks?.length ? (
              <button
                onClick={() => onWorkshopChange({
                  ...workshop,
                  frames: workshop.frames.map(f => f.graphId === focusedGraph.id ? { ...f, xTicks: undefined } : f)
                })}
                disabled={!!calib}
                style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, borderRadius: 3, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--color-red-critical)', color: 'var(--color-red-critical)' }}
              >
                ↺ Reset X
              </button>
            ) : null}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
            Cliquez un cadre pour régler son axe X (le Y est commun à tous).
          </span>
        )}
      </div>
    </div>
  );
};
