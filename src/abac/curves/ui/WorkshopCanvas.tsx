// curves/ui/WorkshopCanvas.tsx
//
// R2a (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) — Le CANEVAS de l'atelier « image
// unique » : reproduction du geste de l'abaque papier (réf. PA-28-181) —
//   1. UNE image MANEX importée, positionnée et recadrée UNE fois pour le set ;
//   2. des CADRES (un par graphe) TIRÉS sur l'image : bandes verticales à
//      poignées, déplaçables/redimensionnables, focus au clic ;
//   3. l'ordre gauche→droite des cadres définit la chaîne de lecture
//      G1→G2→G3 (synchronisée par AbacBuilder dans linkedTo/linkedFrom).
// R2b ajoutera les règles d'axes (Y commun à gauche, X par cadre) et la
// calibration ; R3 ramènera le tracé des courbes sur ce canevas.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GraphConfig, WorkshopConfig, WorkshopFrame, WorkshopImage } from '../core/types';

interface WorkshopCanvasProps {
  workshop: WorkshopConfig;
  graphs: GraphConfig[];
  selectedGraphId: string | null;
  onWorkshopChange: (next: WorkshopConfig) => void;
  onFocusGraph: (graphId: string) => void;
  /** Fournit un graphe à cadrer : le 1er graphe encore sans cadre, sinon un
   *  graphe fraîchement créé par le builder. Retourne son id. */
  onRequestGraphForFrame: () => string | null;
  width?: number;
  height?: number;
}

// Marges réservées aux règles d'axes (R2b) : Y commun à gauche, X sous les cadres.
const MARGIN = { top: 30, right: 16, bottom: 40, left: 60 };
const FRAME_MIN_W = 60;   // largeur minimale d'un cadre (px inner)
const HANDLE_W = 7;       // largeur des poignées de bord

// Teintes de cadres (bord/voile) — focus = orange charte, inactifs en retrait.
const FRAME_IDLE = 'var(--text-tertiary)';
const FRAME_FOCUS = 'var(--accent-primary)';

export const WorkshopCanvas: React.FC<WorkshopCanvasProps> = ({
  workshop,
  graphs,
  selectedGraphId,
  onWorkshopChange,
  onFocusGraph,
  onRequestGraphForFrame,
  width = 960,
  height = 540
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inner = { w: width - MARGIN.left - MARGIN.right, h: height - MARGIN.top - MARGIN.bottom };

  const [imageAdjust, setImageAdjust] = useState(false);

  // ─── Drag unifié (image OU cadre), pattern pointer-events fenêtre (cf. Chart) ───
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

      // Cadres : déplacement / redimensionnement borné à la zone inner.
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

  // ─── Ajouter un cadre (graphe existant non cadré, sinon nouveau graphe) ───
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

  // ─── Conversion COMPAT (D4) : cadres équirépartis pour les graphes existants ───
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

  const framesSorted = [...workshop.frames].sort((a, b) => a.xLeftPx - b.xLeftPx);
  const unframedCount = graphs.filter(g => !workshop.frames.some(f => f.graphId === g.id)).length;

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

      {/* ─── Bandeau de conversion COMPAT (modèles d'avant la refonte) ─── */}
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
                  if (!imageAdjust || !workshop.image) return;
                  e.stopPropagation();
                  setDrag({ kind: 'img-move', startX: e.clientX, startY: e.clientY, origin: workshop.image });
                }}
              />
              {imageAdjust && (
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

          {/* Règle Y commune — placeholder R2a (valeurs/pas en R2b) */}
          <line x1={-6} y1={0} x2={-6} y2={inner.h} stroke="var(--accent-primary)" strokeWidth={2.5} opacity={0.7} />
          <text x={-14} y={inner.h / 2} fontSize={10} fill="var(--accent-primary)" transform={`rotate(-90 -14 ${inner.h / 2})`} textAnchor="middle">
            Y COMMUN — {workshop.sharedY.title || 'à paramétrer (R2b)'}
          </text>

          {/* Cadres */}
          {framesSorted.map((f, i) => {
            const g = graphs.find(x => x.id === f.graphId);
            const isFocus = f.graphId === selectedGraphId;
            const color = isFocus ? FRAME_FOCUS : FRAME_IDLE;
            const w = f.xRightPx - f.xLeftPx;
            return (
              <g key={f.graphId}>
                {/* voile + bord */}
                <rect
                  x={f.xLeftPx} y={0} width={w} height={inner.h}
                  fill={isFocus ? 'rgba(242, 105, 33, 0.08)' : 'transparent'}
                  stroke={color} strokeWidth={isFocus ? 2.5 : 1.5}
                  strokeDasharray={isFocus ? 'none' : '7 4'}
                  rx={3}
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onFocusGraph(f.graphId);
                    setDrag({ kind: 'frame-move', graphId: f.graphId, startX: e.clientX, origin: f });
                  }}
                />
                {/* étiquette */}
                <text x={f.xLeftPx + 6} y={16} fontSize={11} fontWeight={600} fill={color} pointerEvents="none">
                  {i + 1} · {g?.name || 'Graphique'}{isFocus ? ' — ACTIF' : ''}
                </text>
                {/* bouton retirer le cadre */}
                <text
                  x={f.xRightPx - 12} y={16} fontSize={11} fill={color}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleRemoveFrame(f.graphId); }}
                >
                  ✕<title>Retirer le cadre (le graphe et ses courbes sont conservés)</title>
                </text>
                {/* poignées gauche / droite */}
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
                {/* repères visuels des poignées (médians) */}
                <rect x={f.xLeftPx - 2.5} y={inner.h / 2 - 14} width={5} height={28} rx={2} fill={color} opacity={0.9} pointerEvents="none" />
                <rect x={f.xRightPx - 2.5} y={inner.h / 2 - 14} width={5} height={28} rx={2} fill={color} opacity={0.9} pointerEvents="none" />
                {/* flèche de chaîne vers le cadre suivant */}
                {i < framesSorted.length - 1 && (
                  <g pointerEvents="none" opacity={0.85}>
                    <line
                      x1={f.xRightPx + 2} y1={inner.h + 18}
                      x2={framesSorted[i + 1].xLeftPx - 2} y2={inner.h + 18}
                      stroke="var(--accent-primary)" strokeWidth={1.6}
                    />
                    <path
                      d={`M ${framesSorted[i + 1].xLeftPx - 8} ${inner.h + 14} L ${framesSorted[i + 1].xLeftPx - 2} ${inner.h + 18} L ${framesSorted[i + 1].xLeftPx - 8} ${inner.h + 22}`}
                      fill="none" stroke="var(--accent-primary)" strokeWidth={1.6}
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
