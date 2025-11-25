import React, { useState, useCallback } from 'react';
import { Curve, WindDirection } from '../core/types';
import styles from './styles.module.css';

interface CurveManagerProps {
  curves: Curve[];
  selectedCurveId: string | null;
  onAddCurve: (name: string, color: string, windDirection?: WindDirection) => void;
  onRemoveCurve: (curveId: string) => void;
  onSelectCurve: (curveId: string | null) => void;
  onUpdateCurve: (curveId: string, updates: Partial<Curve>) => void;
  onReorderCurves?: (curves: Curve[]) => void;
  isWindRelated?: boolean;
}

const DEFAULT_COLORS = [
  { value: '#4CAF50', label: 'Vert' },
  { value: '#2196F3', label: 'Bleu' },
  { value: '#FF9800', label: 'Orange' },
  { value: '#9C27B0', label: 'Violet' },
  { value: '#F44336', label: 'Rouge' },
  { value: '#00BCD4', label: 'Cyan' },
  { value: '#8BC34A', label: 'Vert clair' },
  { value: '#FFC107', label: 'Jaune' },
  { value: '#E91E63', label: 'Rose' },
  { value: '#3F51B5', label: 'Indigo' },
  { value: '#009688', label: 'Sarcelle' },
  { value: '#FF5722', label: 'Orange foncé' }
];

export const CurveManager: React.FC<CurveManagerProps> = ({
  curves,
  selectedCurveId,
  onAddCurve,
  onRemoveCurve,
  onSelectCurve,
  onUpdateCurve,
  onReorderCurves,
  isWindRelated = false
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCurveName, setNewCurveName] = useState('');
  const [newCurveColor, setNewCurveColor] = useState(DEFAULT_COLORS[0].value);
  const [newCurveWindDirection, setNewCurveWindDirection] = useState<WindDirection>('none');
  const [editingCurveId, setEditingCurveId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const getNextColor = useCallback(() => {
    const usedColors = curves.map(c => c.color);
    const availableColor = DEFAULT_COLORS.find(c => !usedColors.includes(c.value));
    return availableColor ? availableColor.value : DEFAULT_COLORS[curves.length % DEFAULT_COLORS.length].value;
  }, [curves]);

  const handleAddCurve = useCallback(() => {
    const name = newCurveName.trim() || `Curve ${curves.length + 1}`;
    onAddCurve(name, newCurveColor, isWindRelated ? newCurveWindDirection : undefined);
    setNewCurveName('');
    setNewCurveColor(getNextColor());
    setNewCurveWindDirection('none');
    setShowAddForm(false);
  }, [newCurveName, newCurveColor, newCurveWindDirection, curves.length, onAddCurve, getNextColor, isWindRelated]);

  const handleStartEdit = useCallback((curveId: string, currentName: string) => {
    setEditingCurveId(curveId);
    setEditingName(currentName);
  }, []);

  const handleSaveEdit = useCallback((curveId: string) => {
    if (editingName.trim()) {
      onUpdateCurve(curveId, { name: editingName.trim() });
    }
    setEditingCurveId(null);
    setEditingName('');
  }, [editingName, onUpdateCurve]);

  const handleCancelEdit = useCallback(() => {
    setEditingCurveId(null);
    setEditingName('');
  }, []);

  const handleMoveCurve = useCallback((curveId: string, direction: 'up' | 'down') => {
    if (!onReorderCurves) return;

    const currentIndex = curves.findIndex(c => c.id === curveId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= curves.length) return;

    const newCurves = [...curves];
    const [movedCurve] = newCurves.splice(currentIndex, 1);
    newCurves.splice(newIndex, 0, movedCurve);

    onReorderCurves(newCurves);
  }, [curves, onReorderCurves]);

  return (
    <div className={styles.curveManager}>
      <div className={styles.curveManagerHeader}>
        <h3>Courbes</h3>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setNewCurveColor(getNextColor());
          }}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          {showAddForm ? 'Annuler' : 'Ajouter une courbe'}
        </button>
      </div>

      {showAddForm && (
        <div className={styles.addCurveForm}>
          <input
            type="text"
            placeholder="Nom de la courbe (optionnel)"
            value={newCurveName}
            onChange={(e) => setNewCurveName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCurve()}
            style={{ marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <label style={{ fontSize: '14px', color: '#666' }}>Couleur:</label>
            <select
              value={newCurveColor}
              onChange={(e) => setNewCurveColor(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              {DEFAULT_COLORS.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
            <div
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: newCurveColor,
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
              title="Aperçu de la couleur"
            />
          </div>
          {isWindRelated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', color: '#666' }}>Direction du vent:</label>
              <select
                value={newCurveWindDirection}
                onChange={(e) => setNewCurveWindDirection(e.target.value as WindDirection)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="none">Sans vent</option>
                <option value="headwind">Vent de face</option>
                <option value="tailwind">Vent arrière</option>
              </select>
            </div>
          )}
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddCurve}>
            Créer la courbe
          </button>
        </div>
      )}

      <div className={styles.curvesList}>
        {curves.length === 0 ? (
          <div className={styles.emptyState}>
            Aucune courbe. Ajoutez une courbe pour commencer à tracer des points.
          </div>
        ) : (
          curves.map((curve, index) => (
            <div
              key={curve.id}
              className={`${styles.curveItem} ${selectedCurveId === curve.id ? styles.curveItemSelected : ''}`}
              onClick={() => onSelectCurve(curve.id === selectedCurveId ? null : curve.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '8px',
                gap: '6px'
              }}
            >
              {/* Première ligne : couleur, nom, points et statut */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className={styles.curveColor} style={{
                  backgroundColor: curve.color,
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  flexShrink: 0
                }} />

                {editingCurveId === curve.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(curve.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onBlur={() => handleSaveEdit(curve.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span className={styles.curveName} style={{ fontWeight: 500 }}>{curve.name}</span>
                    {curve.windDirection && curve.windDirection !== 'none' && (
                      <span className={styles.windBadge} style={{
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontSize: '10px',
                        backgroundColor: curve.windDirection === 'headwind' ? '#e3f2fd' : '#fff3e0',
                        color: curve.windDirection === 'headwind' ? '#1976d2' : '#f57c00'
                      }}>
                        {curve.windDirection === 'headwind' ? '↑' : '↓'}
                      </span>
                    )}
                    <span className={styles.curvePoints} style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
                      {curve.points.length} pt{curve.points.length !== 1 ? 's' : ''}
                    </span>
                    {curve.fitted && (
                      <span className={styles.curveFitted} style={{ fontSize: '10px', color: '#4CAF50' }} title={`RMSE: ${curve.fitted.rmse.toFixed(3)}`}>
                        ✓
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Deuxième ligne : tous les boutons d'action */}
              {editingCurveId !== curve.id && (
                <div className={styles.curveActions} style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {isWindRelated && (
                      <select
                        value={curve.windDirection || 'none'}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateCurve(curve.id, { windDirection: e.target.value as WindDirection });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '2px 4px',
                          borderRadius: '3px',
                          border: '1px solid #ddd',
                          fontSize: '10px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          height: '22px'
                        }}
                        title="Direction du vent"
                      >
                        <option value="none">-</option>
                        <option value="headwind">↑</option>
                        <option value="tailwind">↓</option>
                      </select>
                    )}
                    {onReorderCurves && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1px',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '3px',
                        padding: '1px'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCurve(curve.id, 'up');
                          }}
                          disabled={index === 0}
                          style={{
                            opacity: index === 0 ? 0.3 : 1,
                            padding: '0 4px',
                            height: '14px',
                            fontSize: '10px',
                            lineHeight: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: index === 0 ? 'default' : 'pointer'
                          }}
                          title="Monter"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCurve(curve.id, 'down');
                          }}
                          disabled={index === curves.length - 1}
                          style={{
                            opacity: index === curves.length - 1 ? 0.3 : 1,
                            padding: '0 4px',
                            height: '14px',
                            fontSize: '10px',
                            lineHeight: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: index === curves.length - 1 ? 'default' : 'pointer'
                          }}
                          title="Descendre"
                        >
                          ▼
                        </button>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      gap: '2px',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '3px',
                      padding: '2px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(curve.id, curve.name);
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '2px'
                        }}
                        title="Éditer le nom"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCurve(curve.id);
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '2px',
                          color: '#d32f2f'
                        }}
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};