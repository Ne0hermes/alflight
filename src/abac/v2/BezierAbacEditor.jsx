// src/abac/v2/BezierAbacEditor.jsx
//
// Éditeur d'abaque v2 : graphique avec axes dessinés en SVG, image PDF EN FILIGRANE
// dans la zone de tracé (déplaçable/redimensionnable), puis clics directs pour
// ajouter les points → courbe Bézier cubique → poignées drag pour ajustement fin.
//
// Différences avec la v1 du MVP :
//   - Plus de "calibration 2 clics" : le graphique a une géométrie fixe (marges +
//     bornes data) ; la calibration en découle automatiquement.
//   - L'image est en filigrane (opacity 0.4) DANS la zone de tracé, et l'utilisateur
//     la déplace/zoome pour qu'elle se cale sur les axes.
//   - Les axes (lignes, ticks, labels, titres) sont rendus en SVG par-dessus l'image.
//
// Modes (state interne `mode`) :
//   - 'idle'         : rien
//   - 'adjustImage'  : drag pour déplacer l'image, molette pour zoomer
//   - 'addPoints'    : chaque clic ajoute un point sur la courbe
//   - 'editHandles'  : drag des control points cp1/cp2
//
// Le composant est autonome ; l'export final passe par onSave(abacJsonV2).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Hand, Save, X, Trash2, Upload, Move } from 'lucide-react';
import {
  buildCalibration,
  dataToPixel,
  pixelToData,
  fitBezierThroughPoints,
  bezierSegmentsToSVGPath
} from './calibration';
import { ABAC_V2_VERSION } from './types';

// ============================================================================
// Constantes de layout (viewBox SVG fixe — la calibration en découle)
// ============================================================================
const VIEWBOX_W = 1000;
const VIEWBOX_H = 700;
const MARGIN = { top: 30, right: 40, bottom: 70, left: 90 };
const PLOT = {
  left: MARGIN.left,
  top: MARGIN.top,
  right: VIEWBOX_W - MARGIN.right,
  bottom: VIEWBOX_H - MARGIN.bottom,
  width: VIEWBOX_W - MARGIN.left - MARGIN.right,
  height: VIEWBOX_H - MARGIN.top - MARGIN.bottom
};

const DEFAULT_DATA_BOUNDS = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

// Génère ~N ticks "ronds" entre min et max
function generateTicks(min, max, target = 6) {
  if (max <= min) return [min, max];
  const span = max - min;
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step;
  if (norm < 1.5) step = mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const out = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step) out.push(parseFloat(v.toPrecision(12)));
  if (out[0] > min + 1e-9) out.unshift(min);
  if (out[out.length - 1] < max - 1e-9) out.push(max);
  return out;
}

// ============================================================================
// Composant
// ============================================================================
const BezierAbacEditor = memo(({
  imageDataUrl,
  dataBounds = DEFAULT_DATA_BOUNDS,
  axes,
  onSave,
  onCancel
}) => {
  const svgRef = useRef(null);

  // ---- Image en filigrane ----
  const [bgUrl, setBgUrl] = useState(imageDataUrl || null);
  // Position/dimension de l'image dans le viewBox SVG. Par défaut, image cale
  // dans la zone de tracé (PLOT) pour offrir un point de départ raisonnable.
  const [imgTransform, setImgTransform] = useState({
    x: PLOT.left,
    y: PLOT.top,
    width: PLOT.width,
    height: PLOT.height
  });
  const [imgNaturalRatio, setImgNaturalRatio] = useState(1);

  // ---- Points et overrides Bézier ----
  const [points, setPoints] = useState([]);
  const [bezierOverrides, setBezierOverrides] = useState({});
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [draggingImage, setDraggingImage] = useState(null); // {startX, startY, originX, originY}
  const [draggingResize, setDraggingResize] = useState(null); // {corner, startX, startY, origin}

  // ---- Mode courant ----
  const [mode, setMode] = useState('idle');

  // ---- Calibration FIXE : déduite du layout viewBox ----
  // pixelOrigin = (xMin, yMin) → coin bas-gauche du PLOT
  // pixelMax    = (xMax, yMax) → coin haut-droit du PLOT
  const calibration = useMemo(() => {
    return buildCalibration({
      pixelOrigin: { px: PLOT.left, py: PLOT.bottom },
      pixelMax: { px: PLOT.right, py: PLOT.top },
      dataBounds
    });
  }, [dataBounds]);

  // ---- Ticks pour les axes ----
  const xTicks = useMemo(() => generateTicks(dataBounds.xMin, dataBounds.xMax), [dataBounds.xMin, dataBounds.xMax]);
  const yTicks = useMemo(() => generateTicks(dataBounds.yMin, dataBounds.yMax), [dataBounds.yMin, dataBounds.yMax]);

  // ---- Segments Bézier ----
  const segments = useMemo(() => {
    const base = fitBezierThroughPoints(points);
    return base.map((seg, idx) => {
      const ov = bezierOverrides[idx];
      return ov ? { ...seg, cp1: ov.cp1 || seg.cp1, cp2: ov.cp2 || seg.cp2 } : seg;
    });
  }, [points, bezierOverrides]);

  const pixelPoints = useMemo(() => {
    return points.map(p => ({ ...p, ...dataToPixel(calibration, p.x, p.y) }));
  }, [points, calibration]);

  const pixelSegments = useMemo(() => {
    return segments.map(s => ({
      p0: dataToPixel(calibration, s.p0.x, s.p0.y),
      cp1: dataToPixel(calibration, s.cp1.x, s.cp1.y),
      cp2: dataToPixel(calibration, s.cp2.x, s.cp2.y),
      p1: dataToPixel(calibration, s.p1.x, s.p1.y)
    }));
  }, [segments, calibration]);

  const svgPath = useMemo(() => bezierSegmentsToSVGPath(pixelSegments), [pixelSegments]);

  // ---- Conversion clientXY → coords viewBox ----
  const clientToViewBox = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      px: ((clientX - rect.left) / rect.width) * VIEWBOX_W,
      py: ((clientY - rect.top) / rect.height) * VIEWBOX_H
    };
  }, []);

  // ---- Clic SVG ----
  const handleSvgClick = (e) => {
    if (draggingHandle || draggingImage || draggingResize) return;
    const { px, py } = clientToViewBox(e.clientX, e.clientY);

    if (mode === 'addPoints') {
      // Ne pas sortir de la zone PLOT (sinon ça crée des points hors graphique)
      if (px < PLOT.left || px > PLOT.right || py < PLOT.top || py > PLOT.bottom) return;
      const data = pixelToData(calibration, px, py);
      setPoints(prev => [...prev, { ...data, id: `p-${Date.now()}-${prev.length}` }]);
      setBezierOverrides({});
    }
  };

  // ---- Drag image (mode adjustImage) ----
  const handleImageMouseDown = (e) => {
    if (mode !== 'adjustImage') return;
    e.stopPropagation();
    const { px, py } = clientToViewBox(e.clientX, e.clientY);
    setDraggingImage({
      startPx: px, startPy: py,
      originX: imgTransform.x, originY: imgTransform.y
    });
  };

  // ---- Drag resize image (coin bas-droit) ----
  const handleResizeMouseDown = (corner) => (e) => {
    if (mode !== 'adjustImage') return;
    e.stopPropagation();
    const { px, py } = clientToViewBox(e.clientX, e.clientY);
    setDraggingResize({
      corner,
      startPx: px, startPy: py,
      originW: imgTransform.width, originH: imgTransform.height,
      originX: imgTransform.x, originY: imgTransform.y
    });
  };

  // ---- Drag handle Bézier ----
  const handleHandleMouseDown = (segIdx, which) => (e) => {
    e.stopPropagation();
    setDraggingHandle({ segIdx, which });
  };

  // ---- Mousemove / mouseup global ----
  useEffect(() => {
    const onMove = (e) => {
      if (draggingHandle) {
        const { px, py } = clientToViewBox(e.clientX, e.clientY);
        const data = pixelToData(calibration, px, py);
        setBezierOverrides(prev => ({
          ...prev,
          [draggingHandle.segIdx]: {
            ...(prev[draggingHandle.segIdx] || {}),
            [draggingHandle.which]: data
          }
        }));
      } else if (draggingImage) {
        const { px, py } = clientToViewBox(e.clientX, e.clientY);
        setImgTransform(it => ({
          ...it,
          x: draggingImage.originX + (px - draggingImage.startPx),
          y: draggingImage.originY + (py - draggingImage.startPy)
        }));
      } else if (draggingResize) {
        const { px, py } = clientToViewBox(e.clientX, e.clientY);
        const dx = px - draggingResize.startPx;
        const dy = py - draggingResize.startPy;
        // Resize uniforme depuis le coin bas-droit (corner: 'br')
        // Conserver le ratio si shift n'est pas pressé pour l'instant : libre
        setImgTransform(it => ({
          ...it,
          width: Math.max(20, draggingResize.originW + dx),
          height: Math.max(20, draggingResize.originH + dy)
        }));
      }
    };
    const onUp = () => {
      setDraggingHandle(null);
      setDraggingImage(null);
      setDraggingResize(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingHandle, draggingImage, draggingResize, calibration, clientToViewBox]);

  // ---- Upload image ----
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setImgNaturalRatio(ratio);
        // Adapter la hauteur au ratio natif, en se calant dans PLOT
        const newW = PLOT.width;
        const newH = Math.min(PLOT.height, newW / ratio);
        setImgTransform({
          x: PLOT.left,
          y: PLOT.top + (PLOT.height - newH) / 2,
          width: newW,
          height: newH
        });
        setBgUrl(url);
        setMode('adjustImage'); // bascule auto en mode ajustement
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  // ---- Export ----
  const handleSave = () => {
    if (points.length < 2) return;
    const payload = {
      version: ABAC_V2_VERSION,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      graphs: [{
        id: `g-${Date.now()}`,
        name: 'Abaque',
        axes: axes || {
          xAxis: { title: 'X', unit: '', min: dataBounds.xMin, max: dataBounds.xMax },
          yAxis: { title: 'Y', unit: '', min: dataBounds.yMin, max: dataBounds.yMax }
        },
        pdfReference: bgUrl ? {
          imageDataUrl: bgUrl,
          imageTransform: imgTransform,
          calibration
        } : undefined,
        curves: [{
          id: `c-${Date.now()}`,
          name: 'Courbe 1',
          color: '#8b5cf6',
          points,
          fitted: { method: 'bezier', bezierSegments: segments }
        }]
      }]
    };
    onSave?.(payload);
  };

  const reset = () => {
    setPoints([]);
    setBezierOverrides({});
    setMode('idle');
  };

  // ============================================================================
  // UI
  // ============================================================================
  const xTitle = axes?.xAxis?.title || 'X';
  const xUnit = axes?.xAxis?.unit ? ` (${axes.xAxis.unit})` : '';
  const yTitle = axes?.yAxis?.title || 'Y';
  const yUnit = axes?.yAxis?.unit ? ` (${axes.yAxis.unit})` : '';

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <label style={styles.btnSecondary}>
          <Upload size={16} />
          {bgUrl ? 'Changer image' : 'Image en filigrane'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        </label>

        <button
          onClick={() => setMode(mode === 'adjustImage' ? 'idle' : 'adjustImage')}
          disabled={!bgUrl}
          style={{ ...styles.btn, ...(mode === 'adjustImage' ? styles.btnActive : {}) }}
        >
          <Move size={16} />
          Ajuster image
        </button>

        <button
          onClick={() => setMode(mode === 'addPoints' ? 'idle' : 'addPoints')}
          style={{ ...styles.btn, ...(mode === 'addPoints' ? styles.btnActive : {}) }}
        >
          <Plus size={16} />
          Ajouter points ({points.length})
        </button>

        <button
          onClick={() => setMode(mode === 'editHandles' ? 'idle' : 'editHandles')}
          disabled={points.length < 2}
          style={{ ...styles.btn, ...(mode === 'editHandles' ? styles.btnActive : {}) }}
        >
          <Hand size={16} />
          Ajuster poignées
        </button>

        <button onClick={reset} style={styles.btnGhost}>
          <Trash2 size={16} />
          Réinitialiser
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={onCancel} style={styles.btnGhost}>
          <X size={16} />
          Annuler
        </button>

        <button
          onClick={handleSave}
          disabled={points.length < 2}
          style={{ ...styles.btnPrimary, opacity: points.length < 2 ? 0.5 : 1 }}
        >
          <Save size={16} />
          Enregistrer
        </button>
      </div>

      {/* Banner contextuel */}
      {mode === 'adjustImage' && (
        <div style={styles.banner}>
          <Move size={16} />
          Glisse l'image pour la repositionner. Tire le coin bas-droit (carré bleu) pour la redimensionner.
        </div>
      )}
      {mode === 'addPoints' && (
        <div style={styles.banner}>
          <Plus size={16} />
          Clique sur chaque point de la courbe sous-jacente. La courbe Bézier se redessine en temps réel.
        </div>
      )}
      {mode === 'editHandles' && (
        <div style={styles.banner}>
          <Hand size={16} />
          Glisse les ronds verts (control points) pour ajuster la courbure entre 2 points.
        </div>
      )}

      {/* Canvas */}
      <div style={styles.canvasWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          onClick={handleSvgClick}
          style={{
            width: '100%', height: '100%',
            cursor: mode === 'addPoints' ? 'crosshair' : 'default',
            userSelect: 'none', backgroundColor: 'white'
          }}
        >
          {/* Image en filigrane (sous les axes) */}
          {bgUrl && (
            <image
              href={bgUrl}
              x={imgTransform.x} y={imgTransform.y}
              width={imgTransform.width} height={imgTransform.height}
              opacity={mode === 'adjustImage' ? 0.6 : 0.35}
              onMouseDown={handleImageMouseDown}
              style={{ cursor: mode === 'adjustImage' ? 'move' : 'default' }}
              preserveAspectRatio="none"
            />
          )}

          {/* Cadre + axes du graphique (par-dessus l'image) */}
          {/* Grilles */}
          {xTicks.map((t, i) => {
            const px = dataToPixel(calibration, t, 0).px;
            return <line key={`gx-${i}`} x1={px} y1={PLOT.top} x2={px} y2={PLOT.bottom}
              stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,3" pointerEvents="none" />;
          })}
          {yTicks.map((t, i) => {
            const py = dataToPixel(calibration, 0, t).py;
            return <line key={`gy-${i}`} x1={PLOT.left} y1={py} x2={PLOT.right} y2={py}
              stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,3" pointerEvents="none" />;
          })}

          {/* Axes principaux */}
          <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right} y2={PLOT.bottom} stroke="#374151" strokeWidth="1.5" pointerEvents="none" />
          <line x1={PLOT.left} y1={PLOT.top} x2={PLOT.left} y2={PLOT.bottom} stroke="#374151" strokeWidth="1.5" pointerEvents="none" />

          {/* Ticks X + labels */}
          {xTicks.map((t, i) => {
            const px = dataToPixel(calibration, t, 0).px;
            return (
              <g key={`tx-${i}`} pointerEvents="none">
                <line x1={px} y1={PLOT.bottom} x2={px} y2={PLOT.bottom + 5} stroke="#374151" strokeWidth="1" />
                <text x={px} y={PLOT.bottom + 18} fontSize="11" fill="#374151" textAnchor="middle">{t}</text>
              </g>
            );
          })}

          {/* Ticks Y + labels */}
          {yTicks.map((t, i) => {
            const py = dataToPixel(calibration, 0, t).py;
            return (
              <g key={`ty-${i}`} pointerEvents="none">
                <line x1={PLOT.left - 5} y1={py} x2={PLOT.left} y2={py} stroke="#374151" strokeWidth="1" />
                <text x={PLOT.left - 8} y={py + 4} fontSize="11" fill="#374151" textAnchor="end">{t}</text>
              </g>
            );
          })}

          {/* Titres axes */}
          <text x={PLOT.left + PLOT.width / 2} y={VIEWBOX_H - 20} fontSize="13" fill="#111827" fontWeight="500" textAnchor="middle" pointerEvents="none">
            {xTitle}{xUnit}
          </text>
          <text
            x={20} y={PLOT.top + PLOT.height / 2}
            fontSize="13" fill="#111827" fontWeight="500" textAnchor="middle"
            transform={`rotate(-90, 20, ${PLOT.top + PLOT.height / 2})`}
            pointerEvents="none"
          >
            {yTitle}{yUnit}
          </text>

          {/* Poignée de resize image (coin bas-droit) */}
          {bgUrl && mode === 'adjustImage' && (
            <rect
              x={imgTransform.x + imgTransform.width - 8}
              y={imgTransform.y + imgTransform.height - 8}
              width="16" height="16"
              fill="#3b82f6" stroke="white" strokeWidth="2"
              style={{ cursor: 'nwse-resize' }}
              onMouseDown={handleResizeMouseDown('br')}
            />
          )}

          {/* Courbe Bézier */}
          {svgPath && (
            <path d={svgPath} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
          )}

          {/* Points cliqués */}
          {pixelPoints.map((p, i) => (
            <g key={p.id} pointerEvents="none">
              <circle cx={p.px} cy={p.py} r="5" fill="#8b5cf6" stroke="white" strokeWidth="2" />
              <text x={p.px + 8} y={p.py - 8} fontSize="10" fill="#4b5563">
                {i + 1}
              </text>
            </g>
          ))}

          {/* Control points (mode editHandles) */}
          {mode === 'editHandles' && pixelSegments.map((s, idx) => (
            <g key={`handle-${idx}`}>
              <line x1={s.p0.px} y1={s.p0.py} x2={s.cp1.px} y2={s.cp1.py} stroke="#22c55e" strokeWidth="1" strokeDasharray="3,2" pointerEvents="none" />
              <line x1={s.p1.px} y1={s.p1.py} x2={s.cp2.px} y2={s.cp2.py} stroke="#22c55e" strokeWidth="1" strokeDasharray="3,2" pointerEvents="none" />
              <circle
                cx={s.cp1.px} cy={s.cp1.py} r="6"
                fill="#22c55e" stroke="white" strokeWidth="2"
                style={{ cursor: 'grab' }}
                onMouseDown={handleHandleMouseDown(idx, 'cp1')}
              />
              <circle
                cx={s.cp2.px} cy={s.cp2.py} r="6"
                fill="#22c55e" stroke="white" strokeWidth="2"
                style={{ cursor: 'grab' }}
                onMouseDown={handleHandleMouseDown(idx, 'cp2')}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        {points.length} point{points.length > 1 ? 's' : ''} · {segments.length} segment{segments.length > 1 ? 's' : ''} Bézier
        · X[{dataBounds.xMin}–{dataBounds.xMax}] Y[{dataBounds.yMin}–{dataBounds.yMax}]
        {bgUrl && ` · image ${Math.round(imgTransform.width)}×${Math.round(imgTransform.height)}`}
      </div>
    </div>
  );
});
BezierAbacEditor.displayName = 'BezierAbacEditor';

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#fff' },
  toolbar: { display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' },
  banner: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: 'rgba(242, 105, 33, 0.10)', color: '#92400e', fontSize: 13, borderBottom: '1px solid #fde68a' },
  canvasWrap: { flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb', display: 'flex' },
  statsBar: { padding: '8px 16px', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', backgroundColor: '#f9fafb' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  btnActive: { backgroundColor: '#ede9fe', color: '#5b21b6', borderColor: '#a78bfa' },
  btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
};

export default BezierAbacEditor;
