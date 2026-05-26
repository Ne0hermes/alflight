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
  /** ID de la variable familiale du graphe (cf. graph.familyAxisVariable).
   *  Si défini, on affiche un champ "Valeur familiale" pour chaque courbe. */
  familyAxisVariable?: string;
  /** Libellé court de la variable familiale (pour affichage UI). */
  familyAxisLabel?: string;
  /** Mode d'interpolation du graphe. Si 'slope-follow', on affiche un champ
   *  "Y au bord gauche" pour chaque courbe (utilisé pour bracketer Y_in). */
  interpolationMode?: 'family' | 'slope-follow' | 'mono';
  /** Unité de l'axe Y du graphe (affichée dans le label du champ entryY). */
  yAxisUnit?: string;
  /** Titre de l'axe Y du graphe (affiché dans le label du champ entryY). */
  yAxisTitle?: string;
  /** Sens de l'axe X : si true, l'axe est décroissant → le 1er point pilote
   *  est celui avec le X MAX (bord gauche visuel). */
  xAxisReversed?: boolean;
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
  isWindRelated = false,
  familyAxisVariable,
  familyAxisLabel,
  interpolationMode,
  yAxisUnit,
  yAxisTitle,
  xAxisReversed
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
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setNewCurveColor(getNextColor());
          }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
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
              <label style={{ fontSize: '14px', color: '#666' }}>Direction du vent (Wind direction) :</label>
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
                <option value="none">Sans vent / No wind</option>
                <option value="headwind">Vent de face / Headwind ↑</option>
                <option value="tailwind">Vent arrière / Tailwind ↓</option>
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
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      // Bordure visuelle quand la courbe est sélectionnée pour édition des points
                      backgroundColor: selectedCurveId === curve.id ? '#dcfce7' : 'transparent',
                      border: selectedCurveId === curve.id ? '1px solid #16a34a' : '1px solid transparent'
                    }}
                    title={selectedCurveId === curve.id
                      ? '✓ Courbe sélectionnée — tu peux maintenant glisser ses points sur le graphique'
                      : 'Clique pour sélectionner cette courbe et modifier ses points sur le graphique'}
                  >
                    <span className={styles.curveName} style={{ fontWeight: selectedCurveId === curve.id ? 600 : 500, color: selectedCurveId === curve.id ? '#065f46' : 'inherit' }}>
                      {selectedCurveId === curve.id && '✓ '}{curve.name}
                    </span>
                    {curve.windDirection && curve.windDirection !== 'none' && (
                      <span
                        className={styles.windBadge}
                        title={curve.windDirection === 'headwind' ? 'Vent de face / Headwind' : 'Vent arrière / Tailwind'}
                        style={{
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

              {/* Champ familyValue (visible uniquement si le graphe a déclaré un paramètre familial) */}
              {familyAxisVariable && editingCurveId !== curve.id && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px',
                  backgroundColor: typeof curve.familyValue === 'number' ? '#dcfce7' : 'rgba(242, 105, 33, 0.10)',
                  borderRadius: 3,
                  fontSize: 11
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    🔀 {familyAxisLabel || familyAxisVariable} :
                  </span>
                  <input
                    type="number"
                    value={curve.familyValue ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === '' ? undefined : parseFloat(v);
                      onUpdateCurve(curve.id, { familyValue: Number.isFinite(num) ? num : undefined });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="ex. 0, 2000, 4000…"
                    style={{
                      flex: 1,
                      padding: '2px 6px',
                      fontSize: 11,
                      border: '1px solid #d1d5db',
                      borderRadius: 3
                    }}
                  />
                  {typeof curve.familyValue !== 'number' && (
                    <span style={{ fontSize: 10, color: '#dc2626' }}>⚠ requis</span>
                  )}
                </div>
              )}

              {/* Champ entryY — OVERRIDE optionnel pour le mode slope-follow.
                  Si non saisi, l'algorithme prend automatiquement le Y du premier
                  point de la courbe au bord GAUCHE VISUEL du graphe :
                    - axe X croissant : X min
                    - axe X décroissant : X max */}
              {interpolationMode === 'slope-follow' && editingCurveId !== curve.id && (() => {
                // Calculer la valeur auto à partir du premier point selon le sens d'axe
                let autoValue = null;
                let autoX = null;
                if (Array.isArray(curve.points) && curve.points.length > 0) {
                  const sorted = [...curve.points]
                    .filter(p => typeof p.x === 'number' && typeof p.y === 'number')
                    .sort((a, b) => xAxisReversed ? b.x - a.x : a.x - b.x);
                  if (sorted.length > 0) {
                    autoValue = sorted[0].y;
                    autoX = sorted[0].x;
                  }
                }
                const hasOverride = typeof curve.entryY === 'number';
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px',
                    backgroundColor: hasOverride ? '#ede9fe' : '#f1f5f9',
                    borderRadius: 3,
                    fontSize: 11,
                    marginTop: 4
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title={hasOverride
                    ? "Override manuel : cette valeur est utilisée à la place du Y du premier point."
                    : autoValue !== null
                      ? `Auto : Y du premier point (à X=${autoX}). Effacer pour laisser auto, saisir pour forcer une autre valeur.`
                      : "Aucun point placé — placez au moins un point pour activer le calcul automatique."}
                  >
                    <span style={{ fontWeight: 600, color: '#374151' }}>
                      🚀 Y bord gauche{yAxisUnit ? ` (${yAxisUnit})` : ''} :
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={curve.entryY ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === '' ? undefined : parseFloat(v);
                        onUpdateCurve(curve.id, { entryY: Number.isFinite(num) ? num : undefined });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={autoValue !== null ? `auto = ${autoValue.toFixed(1)}` : 'placez un point d\'abord'}
                      style={{
                        flex: 1,
                        padding: '2px 6px',
                        fontSize: 11,
                        border: '1px solid #d1d5db',
                        borderRadius: 3,
                        fontStyle: hasOverride ? 'normal' : 'italic',
                        color: hasOverride ? '#111827' : '#6b7280'
                      }}
                    />
                    {hasOverride ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCurve(curve.id, { entryY: undefined });
                        }}
                        style={{
                          padding: '1px 6px',
                          fontSize: 10,
                          backgroundColor: '#7c3aed',
                          color: 'white',
                          border: 'none',
                          borderRadius: 3,
                          cursor: 'pointer'
                        }}
                        title="Revenir au calcul automatique"
                      >
                        override
                      </button>
                    ) : autoValue !== null ? (
                      <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>auto</span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#dc2626' }}>—</span>
                    )}
                  </div>
                );
              })()}

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
                          height: '22px',
                          minWidth: 140
                        }}
                        title="Direction du vent (Wind direction)"
                      >
                        <option value="none">— Sans vent / No wind —</option>
                        <option value="headwind">↑ Vent de face / Headwind</option>
                        <option value="tailwind">↓ Vent arrière / Tailwind</option>
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
                          // Sélectionne aussi la courbe pour permettre l'édition des points
                          // dès que le nom est validé (sortie de l'input).
                          if (selectedCurveId !== curve.id) {
                            onSelectCurve(curve.id);
                          }
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '2px'
                        }}
                        title="Renommer la courbe (pour modifier les points, clique simplement sur le nom)"
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