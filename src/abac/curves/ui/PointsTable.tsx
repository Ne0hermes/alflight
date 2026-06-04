import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Curve, XYPoint, AxesConfig } from '../core/types';

interface PointsTableProps {
  curves: Curve[];
  selectedCurveId: string | null;
  axesConfig: AxesConfig;
  onUpdatePoint: (curveId: string, pointId: string, x: number, y: number) => void;
  onDeletePoint: (curveId: string, pointId: string) => void;
  onAddPoint?: (x: number, y: number) => void;
  onSelectCurve?: (curveId: string | null) => void;
}

const styles = {
  container: {
    padding: '12px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    marginTop: '12px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px'
  },
  colorIndicator: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '2px solid var(--bg-overlay)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
  },
  title: {
    fontSize: 'var(--fs-body)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1
  },
  pointCount: {
    fontSize: 'var(--fs-body)',
    fontWeight: 'normal' as const,
    color: 'var(--text-secondary)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 'var(--fs-body)'
  },
  th: {
    padding: '4px 6px',
    textAlign: 'left' as const,
    borderBottom: '2px solid var(--border-subtle)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-overlay)',
    whiteSpace: 'nowrap' as const,
    fontSize: 'var(--fs-body)'
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid var(--border-subtle)'
  },
  input: {
    padding: '4px 6px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '3px',
    fontSize: 'var(--fs-body)',
    width: '80px'
  },
  actions: {
    display: 'flex',
    gap: '4px'
  },
  button: {
    padding: '4px 8px',
    fontSize: 'var(--fs-body)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  editButton: {
    backgroundColor: 'var(--accent-primary)',
    color: 'white'
  },
  saveButton: {
    backgroundColor: 'var(--accent-primary)',
    color: 'white'
  },
  cancelButton: {
    backgroundColor: 'var(--color-red-critical)',
    color: 'white'
  },
  deleteButton: {
    backgroundColor: 'var(--accent-primary)',
    color: 'white'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '24px',
    color: 'var(--text-tertiary)',
    fontSize: 'var(--fs-body)'
  }
};

export const PointsTable: React.FC<PointsTableProps> = ({
  curves,
  selectedCurveId,
  axesConfig,
  onUpdatePoint,
  onDeletePoint,
  onAddPoint,
  onSelectCurve
}) => {
  const [editingPoint, setEditingPoint] = useState<string | null>(null);
  const [editX, setEditX] = useState('');
  const [editY, setEditY] = useState('');
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);

  const selectedCurve = curves.find(c => c.id === selectedCurveId);

  const handleStartEdit = useCallback((point: XYPoint) => {
    if (point.id) {
      setEditingPoint(point.id);
      setEditX(point.x.toString());
      setEditY(point.y.toString());
    }
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingPoint || !selectedCurveId) {
            return;
    }

    const x = parseFloat(editX);
    const y = parseFloat(editY);

    
    if (isNaN(x) || isNaN(y)) {
      alert('Les valeurs doivent être des nombres valides');
      console.error('❌ Valeurs invalides:', { x, y, editX, editY });
      return;
    }

    if (x < axesConfig.xAxis.min || x > axesConfig.xAxis.max) {
      alert(`La valeur X (${x}) doit être entre ${axesConfig.xAxis.min} et ${axesConfig.xAxis.max}`);
      console.error('❌ X hors limites');
      return;
    }

    if (y < axesConfig.yAxis.min || y > axesConfig.yAxis.max) {
      alert(`La valeur Y (${y}) doit être entre ${axesConfig.yAxis.min} et ${axesConfig.yAxis.max}`);
      console.error('❌ Y hors limites');
      return;
    }

    onUpdatePoint(selectedCurveId, editingPoint, x, y);
    setEditingPoint(null);
    setEditX('');
    setEditY('');
      }, [editingPoint, editX, editY, selectedCurveId, axesConfig, onUpdatePoint]);

  const handleCancelEdit = useCallback(() => {
    setEditingPoint(null);
    setEditX('');
    setEditY('');
  }, []);

  const handleDelete = useCallback((pointId: string) => {
    if (selectedCurveId && pointId) {
      onDeletePoint(selectedCurveId, pointId);
    }
  }, [selectedCurveId, onDeletePoint]);

  const handleAddNewPoint = useCallback(() => {
    const x = parseFloat(newX);
    const y = parseFloat(newY);

    
    if (isNaN(x) || isNaN(y)) {
      alert('Les valeurs doivent être des nombres valides');
      console.error('❌ Valeurs invalides:', { x, y, newX, newY });
      return;
    }

    if (x < axesConfig.xAxis.min || x > axesConfig.xAxis.max) {
      alert(`La valeur X (${x}) doit être entre ${axesConfig.xAxis.min} et ${axesConfig.xAxis.max}`);
      console.error('❌ X hors limites');
      return;
    }

    if (y < axesConfig.yAxis.min || y > axesConfig.yAxis.max) {
      alert(`La valeur Y (${y}) doit être entre ${axesConfig.yAxis.min} et ${axesConfig.yAxis.max}`);
      console.error('❌ Y hors limites');
      return;
    }

    if (onAddPoint) {
      onAddPoint(x, y);
      setNewX('');
      setNewY('');
      setShowAddRow(false);
          } else {
      console.error('❌ onAddPoint n\'est pas défini');
    }
  }, [newX, newY, axesConfig, onAddPoint]);

  // Si aucune courbe n'est sélectionnée
  if (!selectedCurve) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: 'var(--fs-title)', marginBottom: '8px' }}>📊</div>
          {curves.length === 0
            ? "Créez d'abord une courbe dans le gestionnaire"
            : "Sélectionnez une courbe pour voir et éditer ses points"}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div
          style={{
            ...styles.colorIndicator,
            backgroundColor: selectedCurve.color
          }}
          title={`Couleur de la courbe: ${selectedCurve.name}`}
        />
        <div style={styles.title}>
          <span>{selectedCurve.name}</span>
          <span style={styles.pointCount}>
            {selectedCurve.points.length} point{selectedCurve.points.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {selectedCurve.points.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 'var(--fs-body)', marginBottom: '8px' }}>💡</div>
          Aucun point dans cette courbe.
        </div>
      ) : null}

      {/* Bouton pour ajouter un nouveau point */}
      {!showAddRow && onAddPoint && (
        <div style={{ marginBottom: '12px' }}>
          <button
            style={{
              ...styles.button,
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              padding: '6px 12px'
            }}
            onClick={() => setShowAddRow(true)}
          >
            + Ajouter un point
          </button>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>
              {axesConfig.xAxis.title?.replace('Température', 'Temp').replace('Temperature', 'Temp')}
              {axesConfig.xAxis.unit && axesConfig.xAxis.unit}
            </th>
            <th style={styles.th}>
              {axesConfig.yAxis.title?.replace('Distance', 'Dist')}
              {axesConfig.yAxis.unit && ` (${axesConfig.yAxis.unit})`}
            </th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {/* Ligne pour ajouter un nouveau point */}
          {showAddRow && (
            <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
              <td style={styles.td}>+</td>
              <td style={styles.td}>
                <input
                  type="number"
                  value={newX}
                  onChange={(e) => setNewX(e.target.value)}
                  style={styles.input}
                  step="any"
                  placeholder="X"
                  autoFocus
                />
              </td>
              <td style={styles.td}>
                <input
                  type="number"
                  value={newY}
                  onChange={(e) => setNewY(e.target.value)}
                  style={styles.input}
                  step="any"
                  placeholder="Y"
                />
              </td>
              <td style={styles.td}>
                <div style={styles.actions}>
                  <button
                    style={{ ...styles.button, ...styles.saveButton }}
                    onClick={handleAddNewPoint}
                    title="Ajouter"
                  >
                    ✓
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.cancelButton }}
                    onClick={() => {
                      setShowAddRow(false);
                      setNewX('');
                      setNewY('');
                    }}
                    title="Annuler"
                  >
                    ✗
                  </button>
                </div>
              </td>
            </tr>
          )}
          {selectedCurve.points.map((point, index) => (
            <tr key={point.id}>
              <td style={styles.td}>{index + 1}</td>
              <td style={styles.td}>
                {editingPoint === point.id ? (
                  <input
                    type="number"
                    value={editX}
                    onChange={(e) => setEditX(e.target.value)}
                    style={styles.input}
                    step="any"
                  />
                ) : (
                  point.x.toFixed(2)
                )}
              </td>
              <td style={styles.td}>
                {editingPoint === point.id ? (
                  <input
                    type="number"
                    value={editY}
                    onChange={(e) => setEditY(e.target.value)}
                    style={styles.input}
                    step="any"
                  />
                ) : (
                  point.y.toFixed(2)
                )}
              </td>
              <td style={styles.td}>
                <div style={styles.actions}>
                  {editingPoint === point.id ? (
                    <>
                      <button
                        style={{ ...styles.button, ...styles.saveButton }}
                        onClick={handleSaveEdit}
                        title="Sauvegarder"
                      >
                        ✓
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.cancelButton }}
                        onClick={handleCancelEdit}
                        title="Annuler"
                      >
                        ✗
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={{ ...styles.button, ...styles.editButton }}
                        onClick={() => handleStartEdit(point)}
                        title="Éditer"
                      >
                        ✏️
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.deleteButton }}
                        onClick={() => handleDelete(point.id!)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};