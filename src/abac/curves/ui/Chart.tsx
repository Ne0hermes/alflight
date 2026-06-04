import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { line, curveLinear } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { AxesConfig, Curve, XYPoint } from '../core/types';
import { getAxisVariableLabel } from '../core/axisVariables';
import styles from './styles.module.css';

export interface BackgroundImage {
  url: string;
  /** Coordonnées PIXEL dans l'espace inner du SVG (post-margin).
   *  L'image reste fixe en pixels CSS quand on resize le Chart : seul l'utilisateur
   *  la déplace/redimensionne via ses propres poignées. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Calibration multi-points : map valeur data ↔ position pixel (inner coords).
 *  Si fournie (>=2 entrées), le scale devient linéaire par morceaux entre ces points,
 *  ce qui permet de corriger les déformations non-uniformes du scan de l'image filigrane
 *  et de gérer des graduations non équidistantes. */
export interface AxisTickCalibration {
  value: number;
  pixel: number; // en coords inner (post-margin)
}

interface ChartProps {
  axesConfig: AxesConfig;
  curves: Curve[];
  selectedCurveId: string | null;
  onPointClick?: (x: number, y: number) => void;
  onPointDrag?: (curveId: string, pointId: string, x: number, y: number) => void;
  onPointDelete?: (curveId: string, pointId: string) => void;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  responsive?: boolean;
  /** Image en filigrane sous le graphique (PDF rasterisé) */
  backgroundImage?: BackgroundImage | null;
  /** Quand true, l'image est draggable + a un handle de resize */
  imageAdjustMode?: boolean;
  /** Callback appelé pendant le drag/resize de l'image */
  onBackgroundImageChange?: (next: BackgroundImage) => void;
  /** Opacité de l'image (default 0.35 ; mode ajustement = 0.6) */
  backgroundImageOpacity?: number;
  /** Calibration multi-points : si fournie, remplace le scale linéaire min→max */
  customXTicks?: AxisTickCalibration[];
  customYTicks?: AxisTickCalibration[];
  /** Mode calibration interactif : chaque clic dans la zone de tracé est intercepté
   *  et reporté en coords INNER PIXEL au lieu de coords data. */
  calibrationMode?: 'x' | 'y' | null;
  /** Callback de calibration : appelé avec le pixel inner cliqué (post-margin) */
  onCalibrationClick?: (pixelInner: { x: number; y: number }) => void;
}

export const Chart: React.FC<ChartProps> = ({
  axesConfig,
  curves,
  selectedCurveId,
  onPointClick,
  onPointDrag,
  onPointDelete,
  width: propWidth = 800,
  height: propHeight = 600,
  showGrid = true,
  showLegend = true,
  responsive = false,
  backgroundImage = null,
  imageAdjustMode = false,
  onBackgroundImageChange,
  backgroundImageOpacity,
  customXTicks,
  customYTicks,
  calibrationMode = null,
  onCalibrationClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: propWidth, height: propHeight });

  // Responsive sizing
  useEffect(() => {
    if (!responsive) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(200, rect.width),
          height: Math.max(150, rect.height)
        });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [responsive]);

  // 🔧 Les dimensions internes du graphique (viewBox, scales, position de l'image)
  // restent FIXES sur propWidth/propHeight. Le mode responsive sert UNIQUEMENT à
  // étirer visuellement le SVG via width="100%" — preserveAspectRatio s'occupe du
  // ratio. Sans ça, ajouter une courbe / scroller la page faisait varier
  // containerSize.height → tous les axes et l'image se redessinaient.
  const width = propWidth;
  const height = propHeight;
  // Log pour débogage (désactivé pour éviter le spam)
  // React.useEffect(() => {
  //   )
  //   });
  // }, [axesConfig, curves, width, height]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ curveId: string; pointId: string } | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ curveId: string; pointId: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const innerWidth = Math.max(100, width - margin.left - margin.right);
  const innerHeight = Math.max(100, height - margin.top - margin.bottom);

  // Log des dimensions calculées (désactivé)
  // 
  // Scale X : piecewise si customXTicks fourni (>=2 points), sinon linéaire min→max.
  // Le piecewise permet de gérer scan déformé / graduations non équidistantes.
  const xScale = useMemo(() => {
    if (customXTicks && customXTicks.length >= 2) {
      // Trier par valeur croissante (D3 exige un domain monotone)
      const sorted = [...customXTicks].sort((a, b) => a.value - b.value);
      const scale = scaleLinear()
        .domain(sorted.map(t => t.value))
        .range(sorted.map(t => t.pixel));
      // Pas de clamp : on autorise l'extrapolation au-delà des bornes calibrées
      return scale;
    }
    const scale = scaleLinear()
      .domain([axesConfig.xAxis.min, axesConfig.xAxis.max]);
    if (axesConfig.xAxis.reversed) scale.range([innerWidth, 0]);
    else scale.range([0, innerWidth]);
    return scale;
  }, [customXTicks, axesConfig.xAxis.min, axesConfig.xAxis.max, axesConfig.xAxis.reversed, innerWidth]);

  const yScale = useMemo(() => {
    if (customYTicks && customYTicks.length >= 2) {
      // Pour Y, le pixel inner croît vers le bas mais la valeur data croît vers le haut.
      // L'utilisateur calibre en cliquant : pixel(yMax) < pixel(yMin) typiquement.
      // scaleLinear accepte n'importe quel ordre de range tant que domain est trié.
      const sorted = [...customYTicks].sort((a, b) => a.value - b.value);
      const scale = scaleLinear()
        .domain(sorted.map(t => t.value))
        .range(sorted.map(t => t.pixel));
      return scale;
    }
    const scale = scaleLinear()
      .domain([axesConfig.yAxis.min, axesConfig.yAxis.max]);
    if (axesConfig.yAxis.reversed) scale.range([0, innerHeight]);
    else scale.range([innerHeight, 0]);
    return scale;
  }, [customYTicks, axesConfig.yAxis.min, axesConfig.yAxis.max, axesConfig.yAxis.reversed, innerHeight]);

  const lineGenerator = useMemo(() => {
    const generator = line<XYPoint>()
      .x(d => {
        const scaled = xScale(d.x);
        if (isNaN(scaled)) {
                  }
        return scaled;
      })
      .y(d => {
        const scaled = yScale(d.y);
        if (isNaN(scaled)) {
                  }
        return scaled;
      })
      .curve(curveLinear);

    return generator;
  }, [xScale, yScale]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Si on vient juste de finir un drag (de point ou d'image), on consomme ce click
    // et on remet le flag à false. Le navigateur synthétise un `click` au mouseup
    // même après un drag, ce qui créait un point fantôme à chaque déplacement.
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (imageAdjustMode) return;

    // Mode calibration interactif : intercepter le clic et reporter les coords PIXEL INNER
    // (post-margin) au parent. Ne pas créer de point sur la courbe.
    if (calibrationMode && onCalibrationClick) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vbX = ((e.clientX - rect.left) / rect.width) * width;
      const vbY = ((e.clientY - rect.top) / rect.height) * height;
      const x = vbX - margin.left;
      const y = vbY - margin.top;
      // On reporte uniquement la coord pertinente selon l'axe en cours de calibration ;
      // l'autre est laissée à 0 (le parent ne l'utilisera pas).
      onCalibrationClick({ x, y });
      return;
    }

    if (!onPointClick || !selectedCurveId) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convertir clientX/Y en coordonnées viewBox (le viewBox est fixe : 0..width / 0..height)
    const vbX = ((e.clientX - rect.left) / rect.width) * width;
    const vbY = ((e.clientY - rect.top) / rect.height) * height;
    const x = vbX - margin.left;
    const y = vbY - margin.top;

    const dataX = xScale.invert(x);
    const dataY = yScale.invert(y);

    if (dataX >= axesConfig.xAxis.min && dataX <= axesConfig.xAxis.max &&
        dataY >= axesConfig.yAxis.min && dataY <= axesConfig.yAxis.max) {
      onPointClick(dataX, dataY);
    }
  }, [imageAdjustMode, onPointClick, selectedCurveId, xScale, yScale, axesConfig, margin, width, height, calibrationMode, onCalibrationClick]);

  // ----- Drag / resize de l'image en filigrane -----
  // L'image est stockée en coords DATA pour rester calée sur les axes.
  // On convertit pixel → data via xScale.invert / yScale.invert.
  // resize-X où X = combinaison de t/b (top/bottom) et l/r (left/right)
  type ResizeKind = 'resize-t' | 'resize-b' | 'resize-l' | 'resize-r'
                  | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br';
  const [imgDrag, setImgDrag] = useState<null | {
    kind: 'move' | ResizeKind;
    startClientX: number;
    startClientY: number;
    origin: BackgroundImage;
  }>(null);

  // Convertit un delta de pixels client (écran) en delta de pixels viewBox (SVG inner).
  // Comme l'image est stockée en pixels viewBox, c'est ce qu'on applique directement.
  const clientDeltaToVbDelta = useCallback((dx: number, dy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { vbDx: 0, vbDy: 0 };
    return {
      vbDx: (dx / rect.width) * width,
      vbDy: (dy / rect.height) * height
    };
  }, [width, height]);

  const handleImageMouseDown = useCallback((e: React.PointerEvent) => {
    if (!imageAdjustMode || !backgroundImage) return;
    e.stopPropagation();
    setImgDrag({
      kind: 'move',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origin: backgroundImage
    });
  }, [imageAdjustMode, backgroundImage]);

  const handleResizeStart = useCallback((kind: ResizeKind) => (e: React.PointerEvent) => {
    if (!imageAdjustMode || !backgroundImage) return;
    e.stopPropagation();
    setImgDrag({
      kind,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origin: backgroundImage
    });
  }, [imageAdjustMode, backgroundImage]);

  useEffect(() => {
    if (!imgDrag || !onBackgroundImageChange) return;
    const onMove = (e: PointerEvent) => {
      if (e.clientX !== imgDrag.startClientX || e.clientY !== imgDrag.startClientY) {
        wasDraggingRef.current = true;
      }
      const { vbDx, vbDy } = clientDeltaToVbDelta(
        e.clientX - imgDrag.startClientX,
        e.clientY - imgDrag.startClientY
      );
      const o = imgDrag.origin;

      if (imgDrag.kind === 'move') {
        onBackgroundImageChange({ ...o, x: o.x + vbDx, y: o.y + vbDy });
        return;
      }

      // Resize : on déduit du suffixe de kind (t/b/l/r combinaisons) quels bords bouger.
      // Le bord opposé reste fixe. Les pixels d'origine permettent d'éviter les
      // accumulations d'erreur pendant le drag.
      const dirs = imgDrag.kind.replace('resize-', '');
      let { x, y, width: w, height: h } = o;
      const MIN = 10; // taille minimale en pixels
      if (dirs.includes('l')) {
        const newW = Math.max(MIN, o.width - vbDx);
        x = (o.x + o.width) - newW;
        w = newW;
      }
      if (dirs.includes('r')) {
        w = Math.max(MIN, o.width + vbDx);
        x = o.x;
      }
      if (dirs.includes('t')) {
        const newH = Math.max(MIN, o.height - vbDy);
        y = (o.y + o.height) - newH;
        h = newH;
      }
      if (dirs.includes('b')) {
        h = Math.max(MIN, o.height + vbDy);
        y = o.y;
      }
      onBackgroundImageChange({ ...o, x, y, width: w, height: h });
    };
    const onUp = () => setImgDrag(null);
    // Pointer Events : souris + tactile + stylet (drag fonctionnel sur écran
    // tactile et émulation mobile, où mousemove/mouseup ne sont pas émis).
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [imgDrag, clientDeltaToVbDelta, onBackgroundImageChange]);

  // Anti rebond : empêche le `click` synthétique de créer un point juste après un drag
  const wasDraggingRef = useRef<boolean>(false);

  const handlePointMouseDown = useCallback((e: React.PointerEvent, curveId: string, pointId: string) => {
    e.stopPropagation();
    setDraggingPoint({ curveId, pointId });
  }, []);

  const handleMouseMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Conversion via viewBox pour rester correct quand le SVG est responsive
    const vbX = ((e.clientX - rect.left) / rect.width) * width;
    const vbY = ((e.clientY - rect.top) / rect.height) * height;
    const x = vbX - margin.left;
    const y = vbY - margin.top;

    setMousePos({ x, y });

    if (draggingPoint && onPointDrag) {
      // Dès qu'on bouge en mode drag, on marque pour bloquer le click final
      wasDraggingRef.current = true;
      const dataX = xScale.invert(x);
      const dataY = yScale.invert(y);

      if (dataX >= axesConfig.xAxis.min && dataX <= axesConfig.xAxis.max &&
          dataY >= axesConfig.yAxis.min && dataY <= axesConfig.yAxis.max) {
        onPointDrag(draggingPoint.curveId, draggingPoint.pointId, dataX, dataY);
      }
    }
  }, [draggingPoint, onPointDrag, xScale, yScale, axesConfig, margin, width, height]);

  const handleMouseUp = useCallback(() => {
    setDraggingPoint(null);
  }, []);

  const handlePointContextMenu = useCallback((e: React.MouseEvent, curveId: string, pointId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPointDelete) {
      onPointDelete(curveId, pointId);
    }
  }, [onPointDelete]);

  const generateGridLines = () => {
    // Si calibration custom : utilise les valeurs calibrées. Sinon, ticks D3 auto.
    // Génération des ticks : 1) custom calibration si dispo, 2) step si fourni, 3) auto D3
    const generateTicksFromStep = (min: number, max: number, step?: number, fallback?: number[]) => {
      if (!step || !isFinite(step) || step <= 0) return fallback || [];
      const out: number[] = [];
      const eps = step * 1e-6;
      for (let v = min; v <= max + eps; v += step) out.push(parseFloat(v.toFixed(10)));
      if (out[out.length - 1] < max - eps) out.push(max);
      return out;
    };
    const xTicks = (customXTicks && customXTicks.length >= 2)
      ? customXTicks.map(t => t.value)
      : generateTicksFromStep(axesConfig.xAxis.min, axesConfig.xAxis.max, axesConfig.xAxis.step, xScale.ticks(10));
    const yTicks = (customYTicks && customYTicks.length >= 2)
      ? customYTicks.map(t => t.value)
      : generateTicksFromStep(axesConfig.yAxis.min, axesConfig.yAxis.max, axesConfig.yAxis.step, yScale.ticks(10));

    return (
      <g className="grid">
        {xTicks.map(tick => (
          <line
            key={`x-grid-${tick}`}
            x1={xScale(tick)}
            y1={0}
            x2={xScale(tick)}
            y2={innerHeight}
            stroke="var(--border-subtle)"
            strokeDasharray="2,2"
          />
        ))}
        {yTicks.map(tick => (
          <line
            key={`y-grid-${tick}`}
            x1={0}
            y1={yScale(tick)}
            x2={innerWidth}
            y2={yScale(tick)}
            stroke="var(--border-subtle)"
            strokeDasharray="2,2"
          />
        ))}
      </g>
    );
  };

  const generateAxes = () => {
    // Génération des ticks : 1) custom calibration si dispo, 2) step si fourni, 3) auto D3
    const generateTicksFromStep = (min: number, max: number, step?: number, fallback?: number[]) => {
      if (!step || !isFinite(step) || step <= 0) return fallback || [];
      const out: number[] = [];
      const eps = step * 1e-6;
      for (let v = min; v <= max + eps; v += step) out.push(parseFloat(v.toFixed(10)));
      if (out[out.length - 1] < max - eps) out.push(max);
      return out;
    };
    const xTicks = (customXTicks && customXTicks.length >= 2)
      ? customXTicks.map(t => t.value)
      : generateTicksFromStep(axesConfig.xAxis.min, axesConfig.xAxis.max, axesConfig.xAxis.step, xScale.ticks(10));
    const yTicks = (customYTicks && customYTicks.length >= 2)
      ? customYTicks.map(t => t.value)
      : generateTicksFromStep(axesConfig.yAxis.min, axesConfig.yAxis.max, axesConfig.yAxis.step, yScale.ticks(10));

    return (
      <>
        <g className="x-axis" transform={`translate(0, ${innerHeight})`}>
          <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="var(--text-secondary)" />
          {xTicks.map(tick => (
            <g key={`x-tick-${tick}`} transform={`translate(${xScale(tick)}, 0)`}>
              <line y1={0} y2={4} stroke="var(--text-secondary)" />
              <text y={14} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
                {tick}
              </text>
            </g>
          ))}
          <text
            x={innerWidth / 2}
            y={35}
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="var(--text-secondary)"
          >
            {getAxisVariableLabel(axesConfig.xAxis.title)} {axesConfig.xAxis.unit && `(${axesConfig.xAxis.unit})`}
            {axesConfig.xAxis.reversed && ' [←]'}
          </text>
        </g>

        <g className="y-axis">
          <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--text-secondary)" />
          {yTicks.map(tick => (
            <g key={`y-tick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x1={-4} x2={0} stroke="var(--text-secondary)" />
              <text x={-7} y={3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
                {tick}
              </text>
            </g>
          ))}
          <text
            transform={`rotate(-90) translate(${-innerHeight / 2}, -40)`}
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="var(--text-secondary)"
          >
            {getAxisVariableLabel(axesConfig.yAxis.title)} {axesConfig.yAxis.unit && `(${axesConfig.yAxis.unit})`}
            {axesConfig.yAxis.reversed && ' [↓]'}
          </text>
        </g>
      </>
    );
  };

  const renderCurve = (curve: Curve) => {
    const isSelected = curve.id === selectedCurveId;
    const opacity = selectedCurveId && !isSelected ? 0.3 : 1;

    // 
    return (
      <g key={curve.id} className="curve-group" opacity={opacity}>
        {curve.fitted && curve.fitted.points.length > 0 && (() => {
          // Filtrer les points invalides avant de générer le path
          const validPoints = curve.fitted.points.filter(p =>
            typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
            typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
          );

          if (validPoints.length < 2) {
                        return null;
          }

          const pathData = lineGenerator(validPoints);
          // ,
          //   hasPath: !!pathData
          // });
          return (
            <path
              d={pathData || ''}
              fill="none"
              stroke={curve.color}
              strokeWidth={isSelected ? 3 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })()}

        {!curve.fitted && curve.points.length > 1 && (() => {
          // Filtrer les points invalides
          const validPoints = curve.points.filter(p =>
            typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
            typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y)
          );

          if (validPoints.length < 2) return null;

          return (
            <path
              d={lineGenerator(validPoints) || ''}
              fill="none"
              stroke={curve.color}
              strokeWidth={isSelected ? 2 : 1}
              strokeDasharray="5,5"
              opacity={0.5}
            />
          );
        })()}

        {curve.points.map((point) => {
          const isHovered = hoveredPoint?.curveId === curve.id && hoveredPoint?.pointId === point.id;
          const isDragging = draggingPoint?.curveId === curve.id && draggingPoint?.pointId === point.id;

          return (
            <g key={point.id || `${point.x}-${point.y}`}>
              <circle
                cx={xScale(point.x)}
                cy={yScale(point.y)}
                r={isHovered || isDragging ? 5 : 3}
                fill={curve.color}
                stroke="white"
                strokeWidth={1.5}
                cursor={isSelected ? "move" : "pointer"}
                onPointerDown={(e) => isSelected && handlePointMouseDown(e, curve.id, point.id!)}
                onMouseEnter={() => setHoveredPoint({ curveId: curve.id, pointId: point.id! })}
                onMouseLeave={() => setHoveredPoint(null)}
                onContextMenu={(e) => isSelected && handlePointContextMenu(e, curve.id, point.id!)}
              />
              {isHovered && (
                <g transform={`translate(${xScale(point.x)}, ${yScale(point.y)})`}>
                  <rect
                    x={10}
                    y={-20}
                    width={80}
                    height={30}
                    fill="rgba(0,0,0,0.8)"
                    rx={4}
                  />
                  <text x={15} y={-5} fill="white" fontSize="11">
                    x: {point.x.toFixed(2)}
                  </text>
                  <text x={15} y={7} fill="white" fontSize="11">
                    y: {point.y.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // La légende est maintenant rendue en dehors du SVG

  return (
    <div
      ref={containerRef}
      className={styles.chartContainer}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        ...(responsive && { width: '100%', height: '100%', minHeight: '150px' })
      }}
    >
      <svg
        ref={svgRef}
        width={responsive ? '100%' : width}
        height={responsive ? Math.max(150, height - 60) : height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleSvgClick}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerLeave={() => setDraggingPoint(null)}
        style={{
          cursor: selectedCurveId && !draggingPoint ? 'crosshair' : 'default',
          flex: responsive ? 1 : undefined,
          touchAction: 'none'
        }}
      >
        {/* clipPath pour empêcher l'image de déborder de la zone de tracé.
            Sans ça, une image trop grande ferait gonfler le scrollHeight et
            le Chart responsive se redimensionnerait, ce qui décalait les axes. */}
        <defs>
          <clipPath id={`chart-plot-clip-${propWidth}-${propHeight}`}>
            <rect x={0} y={0} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Image en filigrane, positionnée en coords DATA via les scales.
              Reste calée sur les axes si le Chart se resize, et clippée à la zone de tracé. */}
          {backgroundImage && (() => {
            // L'image est stockée directement en pixels SVG inner — pas de conversion.
            const imgX = backgroundImage.x;
            const imgY = backgroundImage.y;
            const imgW = backgroundImage.width;
            const imgH = backgroundImage.height;

            // Constantes pour les poignées (utilisées par le rendu plus bas).
            const HANDLE = 16;
            const PAD = 4;

            return (
              <>
                {/* L'image reste clippée à la zone de tracé pour ne pas casser le layout */}
                <g clipPath={`url(#chart-plot-clip-${propWidth}-${propHeight})`}>
                  <image
                    href={backgroundImage.url}
                    x={imgX}
                    y={imgY}
                    width={imgW}
                    height={imgH}
                    opacity={backgroundImageOpacity ?? (imageAdjustMode ? 0.6 : 0.35)}
                    preserveAspectRatio="none"
                    onPointerDown={handleImageMouseDown}
                    style={{ cursor: imageAdjustMode ? 'move' : 'default', touchAction: 'none' }}
                  />
                  {/* Cadre indicateur (clippé : montre la partie visible de l'image) */}
                  {imageAdjustMode && (
                    <rect
                      x={imgX} y={imgY} width={imgW} height={imgH}
                      fill="none" stroke="var(--accent-primary)" strokeWidth="1" strokeDasharray="4,3"
                      pointerEvents="none"
                    />
                  )}
                </g>

                {/* 8 poignées HORS du clip : 4 milieux de bord + 4 coins.
                    Chacune modifie uniquement le ou les bord(s) correspondant(s).
                    Toujours visibles : si l'image déborde, elles se collent au bord intérieur. */}
                {imageAdjustMode && (() => {
                  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
                  const cx = imgX + imgW / 2 - HANDLE / 2;
                  const cy = imgY + imgH / 2 - HANDLE / 2;
                  const handles: Array<{
                    kind: ResizeKind;
                    x: number; y: number;
                    cursor: string;
                    tooltip: string;
                  }> = [
                    // milieux de bord
                    { kind: 'resize-t', x: cx,                              y: imgY - HANDLE / 2,            cursor: 'ns-resize', tooltip: 'Étirer le bord haut' },
                    { kind: 'resize-b', x: cx,                              y: imgY + imgH - HANDLE / 2,     cursor: 'ns-resize', tooltip: 'Étirer le bord bas' },
                    { kind: 'resize-l', x: imgX - HANDLE / 2,               y: cy,                           cursor: 'ew-resize', tooltip: 'Étirer le bord gauche' },
                    { kind: 'resize-r', x: imgX + imgW - HANDLE / 2,        y: cy,                           cursor: 'ew-resize', tooltip: 'Étirer le bord droit' },
                    // coins
                    { kind: 'resize-tl', x: imgX - HANDLE / 2,              y: imgY - HANDLE / 2,            cursor: 'nwse-resize', tooltip: 'Coin haut-gauche' },
                    { kind: 'resize-tr', x: imgX + imgW - HANDLE / 2,       y: imgY - HANDLE / 2,            cursor: 'nesw-resize', tooltip: 'Coin haut-droit' },
                    { kind: 'resize-bl', x: imgX - HANDLE / 2,              y: imgY + imgH - HANDLE / 2,     cursor: 'nesw-resize', tooltip: 'Coin bas-gauche' },
                    { kind: 'resize-br', x: imgX + imgW - HANDLE / 2,       y: imgY + imgH - HANDLE / 2,     cursor: 'nwse-resize', tooltip: 'Coin bas-droit' }
                  ];
                  return handles.map(h => {
                    const cxClamped = clamp(h.x, PAD, innerWidth - HANDLE - PAD);
                    const cyClamped = clamp(h.y, PAD, innerHeight - HANDLE - PAD);
                    const clamped = (cxClamped !== h.x) || (cyClamped !== h.y);
                    const isCorner = h.kind.length > 'resize-X'.length; // resize-tl etc.
                    return (
                      <rect
                        key={h.kind}
                        x={cxClamped} y={cyClamped} width={HANDLE} height={HANDLE}
                        fill={clamped ? '#f26921' : (isCorner ? 'var(--accent-primary)' : 'var(--accent-primary)')}
                        stroke="white" strokeWidth="2" rx="2"
                        style={{ cursor: h.cursor, touchAction: 'none' }}
                        onPointerDown={handleResizeStart(h.kind)}
                      >
                        <title>{clamped ? `${h.tooltip} (image hors zone — poignée collée au bord)` : h.tooltip}</title>
                      </rect>
                    );
                  });
                })()}
              </>
            );
          })()}
          {showGrid && generateGridLines()}
          {generateAxes()}
          {curves.map(renderCurve)}

          {mousePos && selectedCurveId && !draggingPoint && (
            <g className="crosshair" pointerEvents="none">
              <line
                x1={mousePos.x}
                y1={0}
                x2={mousePos.x}
                y2={innerHeight}
                stroke="var(--text-secondary)"
                strokeDasharray="2,2"
                opacity={0.5}
              />
              <line
                x1={0}
                y1={mousePos.y}
                x2={innerWidth}
                y2={mousePos.y}
                stroke="var(--text-secondary)"
                strokeDasharray="2,2"
                opacity={0.5}
              />
              <text
                x={mousePos.x + 5}
                y={mousePos.y - 5}
                fontSize="11"
                fill="var(--text-secondary)"
              >
                ({xScale.invert(mousePos.x).toFixed(1)}, {yScale.invert(mousePos.y).toFixed(1)})
              </text>
            </g>
          )}
        </g>
      </svg>
      {showLegend && curves.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          padding: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          justifyContent: 'center'
        }}>
          {curves.map((curve, index) => (
            <div key={curve.id} style={{
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: curve.color,
                borderRadius: '2px',
                marginRight: '6px'
              }} />
              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                {curve.name}
                {curve.fitted && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                    (RMSE: {curve.fitted.rmse.toFixed(3)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};