import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { line, curveLinear } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { AxesConfig, Curve, XYPoint } from '../core/types';
import styles from './styles.module.css';

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
  responsive = false
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

  const width = responsive ? containerSize.width : propWidth;
  const height = responsive ? containerSize.height : propHeight;
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
  const xScale = useMemo(() => {
    const scale = scaleLinear()
      .domain([axesConfig.xAxis.min, axesConfig.xAxis.max]);

    // Si l'axe est inversé, inverser le range
    if (axesConfig.xAxis.reversed) {
      scale.range([innerWidth, 0]);
    } else {
      scale.range([0, innerWidth]);
    }

    return scale;
  }, [axesConfig.xAxis.min, axesConfig.xAxis.max, axesConfig.xAxis.reversed, innerWidth]);

  const yScale = useMemo(() => {
    const scale = scaleLinear()
      .domain([axesConfig.yAxis.min, axesConfig.yAxis.max]);

    // Si l'axe est inversé, inverser le range (noter que Y est déjà inversé par défaut en SVG)
    if (axesConfig.yAxis.reversed) {
      scale.range([0, innerHeight]);
    } else {
      scale.range([innerHeight, 0]);
    }

    return scale;
  }, [axesConfig.yAxis.min, axesConfig.yAxis.max, axesConfig.yAxis.reversed, innerHeight]);

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
    if (!onPointClick || !selectedCurveId) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;

    const dataX = xScale.invert(x);
    const dataY = yScale.invert(y);

    if (dataX >= axesConfig.xAxis.min && dataX <= axesConfig.xAxis.max &&
        dataY >= axesConfig.yAxis.min && dataY <= axesConfig.yAxis.max) {
      onPointClick(dataX, dataY);
    }
  }, [onPointClick, selectedCurveId, xScale, yScale, axesConfig, margin]);

  const handlePointMouseDown = useCallback((e: React.MouseEvent, curveId: string, pointId: string) => {
    e.stopPropagation();
    setDraggingPoint({ curveId, pointId });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - margin.left;
    const y = e.clientY - rect.top - margin.top;

    setMousePos({ x, y });

    if (draggingPoint && onPointDrag) {
      const dataX = xScale.invert(x);
      const dataY = yScale.invert(y);

      if (dataX >= axesConfig.xAxis.min && dataX <= axesConfig.xAxis.max &&
          dataY >= axesConfig.yAxis.min && dataY <= axesConfig.yAxis.max) {
        onPointDrag(draggingPoint.curveId, draggingPoint.pointId, dataX, dataY);
      }
    }
  }, [draggingPoint, onPointDrag, xScale, yScale, axesConfig, margin]);

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
    const xTicks = xScale.ticks(10);
    const yTicks = yScale.ticks(10);

    return (
      <g className="grid">
        {xTicks.map(tick => (
          <line
            key={`x-grid-${tick}`}
            x1={xScale(tick)}
            y1={0}
            x2={xScale(tick)}
            y2={innerHeight}
            stroke="#e0e0e0"
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
            stroke="#e0e0e0"
            strokeDasharray="2,2"
          />
        ))}
      </g>
    );
  };

  const generateAxes = () => {
    const xTicks = xScale.ticks(10);
    const yTicks = yScale.ticks(10);

    return (
      <>
        <g className="x-axis" transform={`translate(0, ${innerHeight})`}>
          <line x1={0} y1={0} x2={innerWidth} y2={0} stroke="#333" />
          {xTicks.map(tick => (
            <g key={`x-tick-${tick}`} transform={`translate(${xScale(tick)}, 0)`}>
              <line y1={0} y2={6} stroke="#333" />
              <text y={20} textAnchor="middle" fontSize="12" fill="#333">
                {tick}
              </text>
            </g>
          ))}
          <text
            x={innerWidth / 2}
            y={45}
            textAnchor="middle"
            fontSize="14"
            fontWeight="500"
            fill="#333"
          >
            {axesConfig.xAxis.title} {axesConfig.xAxis.unit && `(${axesConfig.xAxis.unit})`}
            {axesConfig.xAxis.reversed && ' [←]'}
          </text>
        </g>

        <g className="y-axis">
          <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#333" />
          {yTicks.map(tick => (
            <g key={`y-tick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x1={-6} x2={0} stroke="#333" />
              <text x={-10} y={5} textAnchor="end" fontSize="12" fill="#333">
                {tick}
              </text>
            </g>
          ))}
          <text
            transform={`rotate(-90) translate(${-innerHeight / 2}, -40)`}
            textAnchor="middle"
            fontSize="14"
            fontWeight="500"
            fill="#333"
          >
            {axesConfig.yAxis.title} {axesConfig.yAxis.unit && `(${axesConfig.yAxis.unit})`}
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
                r={isHovered || isDragging ? 8 : 6}
                fill={curve.color}
                stroke="white"
                strokeWidth={2}
                cursor={isSelected ? "move" : "pointer"}
                onMouseDown={(e) => isSelected && handlePointMouseDown(e, curve.id, point.id!)}
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDraggingPoint(null)}
        style={{
          cursor: selectedCurveId && !draggingPoint ? 'crosshair' : 'default',
          flex: responsive ? 1 : undefined
        }}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
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
                stroke="#666"
                strokeDasharray="2,2"
                opacity={0.5}
              />
              <line
                x1={0}
                y1={mousePos.y}
                x2={innerWidth}
                y2={mousePos.y}
                stroke="#666"
                strokeDasharray="2,2"
                opacity={0.5}
              />
              <text
                x={mousePos.x + 5}
                y={mousePos.y - 5}
                fontSize="11"
                fill="#666"
              >
                ({xScale.invert(mousePos.x).toFixed(1)}, {yScale.invert(mousePos.y).toFixed(1)})
              </text>
            </g>
          )}
        </g>
      </svg>
      {showLegend && curves.length > 0 && (
        <div style={{
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
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
              <div style={{ fontSize: '12px', color: '#333' }}>
                {curve.name}
                {curve.fitted && (
                  <span style={{ fontSize: '10px', color: '#666', marginLeft: '4px' }}>
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