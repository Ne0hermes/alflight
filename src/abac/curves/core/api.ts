import { AbacCurveManager } from './manager';
import {
  AxesConfig,
  XYPoint,
  FitOptions,
  FitResult,
  ChartRef,
  AbacCurvesJSON
} from './types';

class AbacCurvesAPI {
  private manager: AbacCurveManager;

  constructor() {
    this.manager = new AbacCurveManager();
  }

  /**
   * Initialize a new chart with axes configuration
   */
  initChart(cfg: AxesConfig): ChartRef {
    this.manager.setAxesConfig(cfg);
    return this.manager.createChartRef();
  }

  /**
   * Add a point to a specific curve
   */
  addPoint(curveId: string, p: XYPoint): void {
    this.manager.addPoint(curveId, p);
  }

  /**
   * Fit a single curve with optional parameters
   */
  fitCurve(curveId: string, opts?: FitOptions): FitResult {
    return this.manager.fitCurve(curveId, opts);
  }

  /**
   * Fit all curves with the same options
   */
  fitAll(opts?: FitOptions): Record<string, FitResult> {
    return this.manager.fitAll(opts);
  }

  /**
   * Render an empty chart with just axes and grid
   */
  renderEmptyChart(target: HTMLElement, cfg: AxesConfig): void {
    this.manager.setAxesConfig(cfg);

    const container = document.createElement('div');
    container.className = 'abac-chart-empty';
    container.innerHTML = `
      <svg width="800" height="600">
        <g transform="translate(60, 40)">
          ${this.generateGrid(cfg, 680, 500)}
          ${this.generateAxes(cfg, 680, 500)}
        </g>
      </svg>
    `;

    target.innerHTML = '';
    target.appendChild(container);
  }

  /**
   * Render curves with fitted results
   */
  renderCurves(target: HTMLElement, results: Record<string, FitResult>, cfg: AxesConfig): void {
    const container = document.createElement('div');
    container.className = 'abac-chart-curves';

    let curvesHtml = '';
    for (const [curveId, result] of Object.entries(results)) {
      const curve = this.manager.getCurve(curveId);
      if (!curve) continue;

      curvesHtml += this.generateCurvePath(result.fittedPoints, curve.color, cfg, 680, 500);
      curvesHtml += this.generatePoints(result.originalPoints, curve.color, cfg, 680, 500);
    }

    container.innerHTML = `
      <svg width="800" height="600">
        <g transform="translate(60, 40)">
          ${this.generateGrid(cfg, 680, 500)}
          ${this.generateAxes(cfg, 680, 500)}
          ${curvesHtml}
        </g>
      </svg>
    `;

    target.innerHTML = '';
    target.appendChild(container);
  }

  /**
   * Serialize the current model to JSON
   */
  serializeModel(): AbacCurvesJSON {
    return this.manager.serializeModel();
  }

  /**
   * Load a model from JSON
   */
  loadModel(json: AbacCurvesJSON): void {
    this.manager.loadModel(json);
  }

  /**
   * Get the current manager instance (for advanced usage)
   */
  getManager(): AbacCurveManager {
    return this.manager;
  }

  /**
   * Clear all data and reset
   */
  clear(): void {
    this.manager.clear();
  }

  // Helper methods for SVG generation
  private generateGrid(cfg: AxesConfig, width: number, height: number): string {
    const xStep = width / 10;
    const yStep = height / 10;

    let grid = '';
    for (let i = 0; i <= 10; i++) {
      grid += `<line x1="${i * xStep}" y1="0" x2="${i * xStep}" y2="${height}" stroke="#e0e0e0" stroke-dasharray="2,2"/>`;
      grid += `<line x1="0" y1="${i * yStep}" x2="${width}" y2="${i * yStep}" stroke="#e0e0e0" stroke-dasharray="2,2"/>`;
    }

    return grid;
  }

  private generateAxes(cfg: AxesConfig, width: number, height: number): string {
    const xRange = cfg.xAxis.max - cfg.xAxis.min;
    const yRange = cfg.yAxis.max - cfg.yAxis.min;

    let axes = `
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#333"/>
      <line x1="0" y1="0" x2="0" y2="${height}" stroke="#333"/>
    `;

    // X axis labels
    for (let i = 0; i <= 10; i++) {
      const x = (i * width) / 10;
      const value = cfg.xAxis.min + (i * xRange) / 10;
      axes += `
        <line x1="${x}" y1="${height}" x2="${x}" y2="${height + 6}" stroke="#333"/>
        <text x="${x}" y="${height + 20}" text-anchor="middle" font-size="12">${value.toFixed(1)}</text>
      `;
    }

    // Y axis labels
    for (let i = 0; i <= 10; i++) {
      const y = height - (i * height) / 10;
      const value = cfg.yAxis.min + (i * yRange) / 10;
      axes += `
        <line x1="-6" y1="${y}" x2="0" y2="${y}" stroke="#333"/>
        <text x="-10" y="${y + 5}" text-anchor="end" font-size="12">${value.toFixed(1)}</text>
      `;
    }

    // Axis titles
    axes += `
      <text x="${width / 2}" y="${height + 45}" text-anchor="middle" font-size="14" font-weight="500">
        ${cfg.xAxis.title} ${cfg.xAxis.unit ? `(${cfg.xAxis.unit})` : ''}
      </text>
      <text transform="rotate(-90) translate(${-height / 2}, -40)" text-anchor="middle" font-size="14" font-weight="500">
        ${cfg.yAxis.title} ${cfg.yAxis.unit ? `(${cfg.yAxis.unit})` : ''}
      </text>
    `;

    return axes;
  }

  private generateCurvePath(points: XYPoint[], color: string, cfg: AxesConfig, width: number, height: number): string {
    if (points.length < 2) return '';

    const xScale = (x: number) => ((x - cfg.xAxis.min) / (cfg.xAxis.max - cfg.xAxis.min)) * width;
    const yScale = (y: number) => height - ((y - cfg.yAxis.min) / (cfg.yAxis.max - cfg.yAxis.min)) * height;

    let path = `M ${xScale(points[0].x)} ${yScale(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${xScale(points[i].x)} ${yScale(points[i].y)}`;
    }

    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }

  private generatePoints(points: XYPoint[], color: string, cfg: AxesConfig, width: number, height: number): string {
    const xScale = (x: number) => ((x - cfg.xAxis.min) / (cfg.xAxis.max - cfg.xAxis.min)) * width;
    const yScale = (y: number) => height - ((y - cfg.yAxis.min) / (cfg.yAxis.max - cfg.yAxis.min)) * height;

    return points.map(p =>
      `<circle cx="${xScale(p.x)}" cy="${yScale(p.y)}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`
    ).join('');
  }
);}

// Export singleton instance
export const abacCurvesAPI = new AbacCurvesAPI();

// Export convenience functions matching the original API
export const initChart = (cfg: AxesConfig): ChartRef => abacCurvesAPI.initChart(cfg);
export const addPoint = (curveId: string, p: XYPoint): void => abacCurvesAPI.addPoint(curveId, p);
export const fitCurve = (curveId: string, opts?: FitOptions): FitResult => abacCurvesAPI.fitCurve(curveId, opts);
export const fitAll = (opts?: FitOptions): Record<string, FitResult> => abacCurvesAPI.fitAll(opts);
export const renderEmptyChart = (target: HTMLElement, cfg: AxesConfig): void => abacCurvesAPI.renderEmptyChart(target, cfg);
export const renderCurves = (target: HTMLElement, results: Record<string, FitResult>, cfg: AxesConfig): void => abacCurvesAPI.renderCurves(target, results, cfg);
export const serializeModel = (): AbacCurvesJSON => abacCurvesAPI.serializeModel();
export const loadModel = (json: AbacCurvesJSON): void => abacCurvesAPI.loadModel(json);