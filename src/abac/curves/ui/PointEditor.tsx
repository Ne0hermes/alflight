import React, { useState, useCallback } from 'react';
import { Curve, XYPoint, FitOptions, InterpolationMethod } from '../core/types';
import styles from './styles.module.css';

interface PointEditorProps {
  curves: Curve[];
  selectedCurveId: string | null;
  onFitCurve: (curveId: string, options: FitOptions) => void;
  onFitAll: (options: FitOptions) => void;
  onClearPoints: (curveId: string) => void;
  onImportPoints: (curveId: string, points: XYPoint[]) => void;
  warnings?: Record<string, string[]>;
}

export const PointEditor: React.FC<PointEditorProps> = ({
  curves,
  selectedCurveId,
  onFitCurve,
  onFitAll,
  onClearPoints,
  onImportPoints,
  warnings = {}
}) => {
  const [fitOptions, setFitOptions] = useState<FitOptions>({
    method: 'pchip',
    monotonic: false,
    smoothing: 0,
    numPoints: 100
  });

  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedCurve = curves.find(c => c.id === selectedCurveId);

  const handleFitSelectedCurve = useCallback(() => {
    if (selectedCurveId) {
      onFitCurve(selectedCurveId, fitOptions);
    }
  }, [selectedCurveId, fitOptions, onFitCurve]);

  const handleFitAll = useCallback(() => {
    onFitAll(fitOptions);
  }, [fitOptions, onFitAll]);

  const handleImportPoints = useCallback(() => {
    if (!selectedCurveId || !importText.trim()) return;

    try {
      const lines = importText.trim().split('\n');
      const points: XYPoint[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/[\s,;]+/);
        if (parts.length >= 2) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          if (!isNaN(x) && !isNaN(y)) {
            points.push({ x, y });
          }
        }
      }

      if (points.length === 0) {
        setImportError('No valid points found. Use format: x y (one per line)');
        return;
      }

      onImportPoints(selectedCurveId, points);
      setImportText('');
      setShowImport(false);
      setImportError(null);
    } catch (error) {
      setImportError('Failed to parse points. Check format.');
    }
  }, [selectedCurveId, importText, onImportPoints]);

  const canFit = selectedCurve && selectedCurve.points.length >= 2;
  const canFitAkima = selectedCurve && selectedCurve.points.length >= 5;

  return (
    <div className={styles.pointEditor}>
      <div className={styles.editorSection}>
        <h3>Fit Options</h3>

        <div className={styles.fitOptions}>
          <div className={styles.optionGroup}>
            <label>Interpolation Method</label>
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="pchip"
                  checked={fitOptions.method === 'pchip'}
                  onChange={(e) => setFitOptions({ ...fitOptions, method: e.target.value as InterpolationMethod })}
                />
                PCHIP (Min. 2 points)
              </label>
              <label>
                <input
                  type="radio"
                  value="akima"
                  checked={fitOptions.method === 'akima'}
                  onChange={(e) => setFitOptions({ ...fitOptions, method: e.target.value as InterpolationMethod })}
                  disabled={selectedCurve && selectedCurve.points.length < 5}
                />
                Akima (Min. 5 points)
              </label>
            </div>
          </div>

          <div className={styles.optionGroup}>
            <label>
              <input
                type="checkbox"
                checked={fitOptions.monotonic}
                onChange={(e) => setFitOptions({ ...fitOptions, monotonic: e.target.checked })}
              />
              Force Monotonicity
            </label>
          </div>

          <div className={styles.optionGroup}>
            <label>
              Smoothing Factor
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={fitOptions.smoothing}
                onChange={(e) => setFitOptions({ ...fitOptions, smoothing: parseFloat(e.target.value) })}
              />
              <span>{fitOptions.smoothing}</span>
            </label>
          </div>

          <div className={styles.optionGroup}>
            <label>
              Number of Points
              <input
                type="number"
                min="10"
                max="500"
                value={fitOptions.numPoints}
                onChange={(e) => setFitOptions({ ...fitOptions, numPoints: parseInt(e.target.value) || 100 })}
              />
            </label>
          </div>
        </div>

        <div className={styles.fitActions}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleFitSelectedCurve}
            disabled={!canFit}
          >
            Fit Selected Curve
          </button>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleFitAll}
            disabled={curves.length === 0}
          >
            Fit All Curves
          </button>
        </div>
      </div>

      {selectedCurve && (
        <div className={styles.editorSection}>
          <h3>Points Management</h3>

          <div className={styles.pointsInfo}>
            <p>Selected: <strong>{selectedCurve.name}</strong></p>
            <p>Points: <strong>{selectedCurve.points.length}</strong></p>
            {selectedCurve.fitted && (
              <p>RMSE: <strong>{selectedCurve.fitted.rmse.toFixed(3)}</strong></p>
            )}
          </div>

          <div className={styles.pointsActions}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowImport(!showImport)}
            >
              {showImport ? 'Cancel Import' : 'Import Points'}
            </button>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => selectedCurveId && onClearPoints(selectedCurveId)}
              disabled={selectedCurve.points.length === 0}
            >
              Clear Points
            </button>
          </div>

          {showImport && (
            <div className={styles.importSection}>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                }}
                placeholder="Enter points (x y format, one per line):&#10;0 10&#10;5 20&#10;10 15"
                rows={6}
              />
              {importError && <div className={styles.errorMessage}>{importError}</div>}
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleImportPoints}
              >
                Import
              </button>
            </div>
          )}

          {selectedCurve.points.length > 0 && (
            <div className={styles.pointsList}>
              <h4>Point List</h4>
              <div className={styles.pointsScroll}>
                {selectedCurve.points.map((point, index) => (
                  <div key={point.id || index} className={styles.pointItem}>
                    <span>#{index + 1}</span>
                    <span>x: {point.x.toFixed(2)}</span>
                    <span>y: {point.y.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {Object.keys(warnings).length > 0 && (
        <div className={styles.warningsSection}>
          <h3>Warnings</h3>
          {Object.entries(warnings).map(([curveId, curveWarnings]) => {
            const curve = curves.find(c => c.id === curveId);
            return (
              <div key={curveId} className={styles.warningGroup}>
                <strong>{curve?.name || 'Unknown Curve'}:</strong>
                <ul>
                  {curveWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};