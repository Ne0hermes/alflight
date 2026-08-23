import React, { useState, useCallback } from 'react';
import { guideNumber } from '../core/guideMode';
import { Curve, WindDirection } from '../core/types';
import styles from './styles.module.css';

interface CurveManagerProps {
  curves: Curve[];
  selectedCurveId: string | null;
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
  /** 23/08 — panneau de CORRECTION : les courbes sont des guides de pente
   *  numérotés (le moteur ne lit pas leur valeur). Le numéro s'affiche en
   *  badge non éditable et n'est jamais réclamé. */
  numberedGuides?: boolean;
}

// Palette de COURBES (data-viz) — EXCEPTION charte documentée : un éditeur de
// courbes a besoin de séries DISTINGUABLES (impossible avec une seule teinte
// orange). Palette re-tonée « cockpit » : orange de marque en tête + ivoire +
// tons sourds/désaturés harmonisés au canvas sombre, au lieu de l'arc-en-ciel
export const CurveManager: React.FC<CurveManagerProps> = ({
  curves,
  selectedCurveId,
  onRemoveCurve,
  onSelectCurve,
  onUpdateCurve,
  onReorderCurves,
  isWindRelated = false,
  familyAxisVariable,
  familyAxisLabel,
  numberedGuides = false
}) => {
  // Lot 1 (décision pilote 20/08) : la CRÉATION de courbe vit UNIQUEMENT dans
  // la capsule « ➕ Nouvelle courbe » de l'atelier (nom par valeur + sens du
  // vent obligatoire). Ce panneau est la LISTE : sélection, renommage,
  // familyValue, sens du vent, suppression — le formulaire d'ajout en doublon
  // a été retiré.
  const [editingCurveId, setEditingCurveId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  // R16b — MIGRATION DOUCE : pré-remplit familyValue depuis les noms existants
  // (« 0ft » → 0, « Headwind 2 » → 2…) avec la MÊME regex que le repli moteur,
  // pour les courbes qui n'ont pas encore de valeur. Le pilote vérifie d'un
  // coup d'œil les badges puis corrige au besoin.
  const deduceFamilyFromNames = useCallback(() => {
    for (const c of curves) {
      if (typeof c.familyValue === 'number') continue;
      const clean = c.name.trim();
      let m = clean.match(/(?:headwind|tailwind)\s*(-?\d+(?:\.\d+)?)/i);
      if (!m) m = clean.replace(/\s*(kt|kg|°C|m|ft)\s*$/i, '').match(/-?\d+(?:\.\d+)?/);
      const v = m ? parseFloat(m[m.length === 2 ? 1 : 0]) : NaN;
      if (Number.isFinite(v)) onUpdateCurve(c.id, { familyValue: v });
    }
  }, [curves, onUpdateCurve]);

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
      {/* R16b — visible quand le graphe a une variable de famille et qu'il
          reste des courbes sans valeur : un clic remplit depuis les noms. */}
      {!numberedGuides && familyAxisVariable && curves.some(c => typeof c.familyValue !== 'number') && (
        <div className={styles.curveManagerHeader}>
          <button
            onClick={deduceFamilyFromNames}
            title="Pré-remplit la valeur de famille des courbes qui n'en ont pas, en lisant leur nom (« 0ft » → 0, « Headwind 2 » → 2…). Vérifie ensuite les badges."
            style={{
              height: 24, boxSizing: 'border-box', padding: '0 12px', fontSize: 12,
              backgroundColor: 'var(--bg-overlay)', color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)', borderRadius: 6, cursor: 'pointer'
            }}
          >
            Déduire des noms
          </button>
        </div>
      )}

      <div className={styles.curvesList}>
        {curves.length === 0 ? (
          <div className={styles.emptyState}>
            Aucune courbe. Créez-en une avec « ➕ Nouvelle courbe », la capsule au-dessus de l'atelier.
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
                      backgroundColor: selectedCurveId === curve.id ? 'var(--accent-soft)' : 'transparent',
                      border: selectedCurveId === curve.id ? '1px solid var(--accent-primary)' : '1px solid transparent'
                    }}
                    title={selectedCurveId === curve.id
                      ? '✓ Courbe sélectionnée — tu peux maintenant glisser ses points sur le graphique'
                      : 'Clique pour sélectionner cette courbe et modifier ses points sur le graphique'}
                  >
                    <span className={styles.curveName} style={{ fontWeight: selectedCurveId === curve.id ? 600 : 500, color: selectedCurveId === curve.id ? 'var(--accent-primary)' : 'inherit' }}>
                      {selectedCurveId === curve.id && '✓ '}{curve.name}
                    </span>
                    {curve.windDirection && curve.windDirection !== 'none' && (
                      <span
                        className={styles.windBadge}
                        title={curve.windDirection === 'headwind' ? 'Vent de face / Headwind' : 'Vent arrière / Tailwind'}
                        style={{
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontSize: 'var(--fs-caption)',
                          backgroundColor: curve.windDirection === 'headwind' ? 'var(--bg-overlay)' : 'var(--accent-soft)',
                          color: curve.windDirection === 'headwind' ? 'var(--accent-primary)' : 'var(--accent-primary)'
                        }}>
                        {curve.windDirection === 'headwind' ? '↑' : '↓'}
                      </span>
                    )}
                    <span className={styles.curvePoints} style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                      {curve.points.length} pt{curve.points.length !== 1 ? 's' : ''}
                    </span>
                    {curve.fitted && (
                      <span className={styles.curveFitted} style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)' }} title={`RMSE: ${curve.fitted.rmse.toFixed(3)}`}>
                        ✓
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 23/08 — guides numérotés : le numéro d'ordre s'affiche en badge,
                  jamais en champ à remplir (aucune valeur physique attendue). */}
              {numberedGuides && editingCurveId !== curve.id && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '2px 8px', alignSelf: 'flex-start',
                  backgroundColor: 'var(--bg-overlay)', borderRadius: 3, fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
                title="Guide de pente : le numéro sert seulement à distinguer les guides entre eux."
                onClick={(e) => e.stopPropagation()}
                >
                  <span>n° {guideNumber(curve) ?? '—'}</span>
                </div>
              )}

              {/* Champ familyValue (visible uniquement si le graphe a déclaré un paramètre familial) */}
              {!numberedGuides && familyAxisVariable && editingCurveId !== curve.id && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px',
                  backgroundColor: typeof curve.familyValue === 'number' ? 'var(--accent-soft)' : 'rgba(242, 105, 33, 0.10)',
                  borderRadius: 3,
                  fontSize: 11
                }}
                onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 3
                    }}
                  />
                  {typeof curve.familyValue !== 'number' && (
                    <span style={{ fontSize: 10, color: 'var(--color-red-critical)' }}>⚠ requis</span>
                  )}
                </div>
              )}

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
                          border: '1px solid var(--border-subtle)',
                          fontSize: 'var(--fs-caption)',
                          backgroundColor: 'var(--bg-overlay)',
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
                        backgroundColor: 'var(--bg-overlay)',
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
                            fontSize: 'var(--fs-caption)',
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
                            fontSize: 'var(--fs-caption)',
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
                      backgroundColor: 'var(--bg-overlay)',
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
                          fontSize: 'var(--fs-body)',
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
                          fontSize: 'var(--fs-body)',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '2px',
                          color: 'var(--color-red-critical)'
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