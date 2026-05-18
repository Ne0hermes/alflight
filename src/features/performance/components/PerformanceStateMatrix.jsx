// src/features/performance/components/PerformanceStateMatrix.jsx
//
// Matrice exhaustive de couverture des opérations de performance.
//
// Itère sur l'INTÉGRALITÉ du catalogue (`OPERATION_CATALOG`) et affiche
// une ligne par opération canonique. Chaque ligne montre :
//   - L'opération (icône phase + libellé FR)
//   - Le statut (COMPUTED / NOT_IMPLEMENTED / MISSING_INPUT / AMBIGUOUS / ERROR)
//   - La valeur calculée (si COMPUTED) ou le motif (sinon)
//   - La source précise (modèle / graphe / courbe)
//
// Permet au pilote de voir d'un coup d'œil l'exhaustivité des données
// disponibles avant un vol.

import React, { useMemo, useState } from 'react';
import { generatePerformanceState, ResultStatus } from '../../../services/operationResolver';
import { OPERATION_CATALOG, getOperation } from '../../../abac/curves/core/operationCatalog';

const PHASE_ICONS = {
  takeoff:  '🛫',
  climb:    '📈',
  cruise:   '✈',
  descent:  '📉',
  landing:  '🛬'
};

const STATUS_VISUAL = {
  COMPUTED: {
    bg: '#dcfce7', border: '#16a34a', text: '#065f46',
    badge: '✓ Calculé', badgeBg: '#16a34a'
  },
  NOT_IMPLEMENTED: {
    bg: '#fef3c7', border: '#f59e0b', text: '#78350f',
    badge: '⚠ Non implémenté', badgeBg: '#f59e0b'
  },
  MISSING_INPUT: {
    bg: '#fef9c3', border: '#eab308', text: '#713f12',
    badge: '⚠ Input manquant', badgeBg: '#eab308'
  },
  AMBIGUOUS: {
    bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d',
    badge: '⚠ Ambigu', badgeBg: '#dc2626'
  },
  ERROR: {
    bg: '#fecaca', border: '#dc2626', text: '#7f1d1d',
    badge: '✕ Erreur', badgeBg: '#dc2626'
  }
};

/**
 * @param {object} props
 * @param {object} props.aircraft  L'avion sélectionné (avec performanceModels)
 * @param {object} props.inputs    { mass, oat, pressureAltitude, headwind, ... }
 * @param {string} [props.title]   Titre de la matrice (défaut "État de performance")
 * @param {string[]} [props.phases] Liste des phases à afficher (ex: ['takeoff'], ['landing'], ['climb','cruise']).
 *                                  Si non fourni → toutes les phases du catalogue.
 */
export function PerformanceStateMatrix({ aircraft, inputs = {}, title = 'État de performance — couverture exhaustive', phases }) {
  const state = useMemo(() => generatePerformanceState(aircraft, inputs), [aircraft, inputs]);
  const [expandedOp, setExpandedOp] = useState(null);
  // Step cascade actuellement étendu pour voir l'inspection détaillée.
  // Clé : `${opId}:${graphId}` pour ne pas confondre les steps d'opérations différentes.
  const [expandedStepKey, setExpandedStepKey] = useState(null);

  // Filtrage par phases si fourni — on ne montre que les opérations dont la phase est dans la liste.
  const filteredOps = useMemo(() => {
    if (!Array.isArray(phases) || phases.length === 0) return OPERATION_CATALOG;
    return OPERATION_CATALOG.filter(op => phases.includes(op.phase));
  }, [phases]);

  // Recalcul de la couverture sur le sous-ensemble filtré.
  const coverage = useMemo(() => {
    let computed = 0, notImplemented = 0, missingInput = 0, ambiguous = 0, error = 0;
    for (const op of filteredOps) {
      const r = state.results[op.id];
      switch (r?.status) {
        case ResultStatus.COMPUTED:        computed++; break;
        case ResultStatus.NOT_IMPLEMENTED: notImplemented++; break;
        case ResultStatus.MISSING_INPUT:   missingInput++; break;
        case ResultStatus.AMBIGUOUS:       ambiguous++; break;
        case ResultStatus.ERROR:           error++; break;
        default: break;
      }
    }
    return { total: filteredOps.length, computed, notImplemented, missingInput, ambiguous, error };
  }, [state, filteredOps]);
  const coverageRatio = coverage.total > 0 ? (coverage.computed / coverage.total) : 0;
  const coverageColor = coverageRatio >= 0.8 ? '#16a34a' : coverageRatio >= 0.5 ? '#f59e0b' : '#dc2626';

  return (
    <div style={{
      border: '2px solid #4338ca',
      borderRadius: 8,
      backgroundColor: 'white',
      marginBottom: 16,
      overflow: 'hidden'
    }}>
      {/* En-tête avec barre de couverture */}
      <div style={{
        padding: 12,
        backgroundColor: '#eef2ff',
        borderBottom: '1px solid #c7d2fe'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#312e81' }}>
              {title}
            </h3>
          </div>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            backgroundColor: 'white', padding: '6px 10px', borderRadius: 6,
            border: `2px solid ${coverageColor}`
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: coverageColor }}>
              {coverage.computed}/{coverage.total}
            </span>
            <span style={{ fontSize: 11, color: '#374151' }}>
              opérations<br/>calculées
            </span>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${coverageRatio * 100}%`,
            backgroundColor: coverageColor, transition: 'width 0.3s'
          }} />
        </div>

        {/* Compteurs détaillés : on n'affiche que les anomalies, pas la coche "✓ N calculés"
            (l'info "N/M opérations calculées" est déjà dans le compteur principal à droite). */}
        {(coverage.notImplemented > 0 || coverage.missingInput > 0 || coverage.ambiguous > 0 || coverage.error > 0) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
            {coverage.notImplemented > 0 && <span style={{ color: '#f59e0b' }}>⚠ {coverage.notImplemented} non implémenté{coverage.notImplemented > 1 ? 's' : ''}</span>}
            {coverage.missingInput > 0 && <span style={{ color: '#eab308' }}>⚠ {coverage.missingInput} input manquant</span>}
            {coverage.ambiguous > 0 && <span style={{ color: '#dc2626' }}>⚠ {coverage.ambiguous} ambigu{coverage.ambiguous > 1 ? 's' : ''}</span>}
            {coverage.error > 0 && <span style={{ color: '#dc2626' }}>✕ {coverage.error} erreur{coverage.error > 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      {/* Lignes */}
      <div>
        {filteredOps.map(op => {
          const result = state.results[op.id];
          const status = result?.status || ResultStatus.ERROR;
          const visual = STATUS_VISUAL[status] || STATUS_VISUAL.ERROR;
          const isExpanded = expandedOp === op.id;

          return (
            <div
              key={op.id}
              style={{
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: visual.bg,
                borderLeft: `4px solid ${visual.border}`
              }}
            >
              <button
                onClick={() => setExpandedOp(isExpanded ? null : op.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: visual.text,
                  fontSize: 13
                }}
                title="Cliquer pour voir le détail (source, inputs, warnings)"
              >
                <span style={{ fontSize: 18 }}>{PHASE_ICONS[op.phase] || '•'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{op.labelFr}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>{op.id}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  {status === ResultStatus.COMPUTED ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {formatValue(result.value)} <span style={{ fontSize: 12, fontWeight: 500 }}>{result.unit}</span>
                      </div>
                      {result.warnings?.length > 0 && (
                        <div style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>
                          ⚠ {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600 }}>—</div>
                  )}
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: visual.badgeBg,
                  color: 'white',
                  whiteSpace: 'nowrap'
                }}>
                  {visual.badge}
                </span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Panneau détail expandable */}
              {isExpanded && (
                <div style={{
                  padding: '8px 16px 12px 46px',
                  fontSize: 12,
                  color: visual.text,
                  borderTop: `1px dashed ${visual.border}`
                }}>
                  {status === ResultStatus.COMPUTED && result.source && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Source :</strong> abaque <code>{result.source.graphName}</code>
                      (set : <code>{result.source.modelName}</code>,
                      {result.source.curveCount > 0 && <> courbes : <code>{result.source.curveCount}</code>,</>}
                      {result.source.pointsUsed > 0 && <> points : <code>{result.source.pointsUsed}</code>,</>}
                      {result.source.method && <> méthode : <code>{result.source.method}</code></>})
                    </div>
                  )}
                  {status === ResultStatus.COMPUTED && result.inputs && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Inputs utilisés :</strong>{' '}
                      {result.inputs.temperature !== undefined && <>OAT=<code>{Number(result.inputs.temperature).toFixed(1)}°C</code>, </>}
                      {result.inputs.pressure_altitude !== undefined && <>PA=<code>{Number(result.inputs.pressure_altitude).toFixed(0)} ft</code>, </>}
                      {result.inputs.mass !== undefined && <>masse=<code>{Number(result.inputs.mass).toFixed(0)} kg</code>, </>}
                      {result.inputs.wind !== undefined && <>vent=<code>{Number(result.inputs.wind).toFixed(0)} kt</code></>}
                      {/* Rétro-compat ancien format Phase 2 */}
                      {result.inputs.xAxisVariable && (
                        <>{result.inputs.xAxisVariable} = <code>{result.inputs.x}</code></>
                      )}
                    </div>
                  )}
                  {result.confidence && status === ResultStatus.COMPUTED && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Confiance :</strong> <code>{result.confidence}</code>
                    </div>
                  )}
                  {/* Chaîne de cascade : output de chaque graphe → input du suivant.
                      Chaque étape est cliquable via le bouton ⋯ pour ouvrir l'inspection
                      détaillée du sous-graphique (axes, courbes, méthode, paramètres). */}
                  {result.cascadeSteps && result.cascadeSteps.length > 0 && (() => {
                    // Build a lookup map from perGraph inspection data, indexed by graphId,
                    // so chaque step de cascade peut afficher SON propre détail.
                    const perGraphById = {};
                    (result.debug?.perGraph || []).forEach(g => {
                      if (g.graphId) perGraphById[g.graphId] = g;
                    });
                    return (
                    <div style={{
                      marginBottom: 8, padding: 8,
                      backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 4
                    }}>
                      <strong style={{ color: '#9a3412' }}>🔗 Chaîne de cascade ({result.cascadeSteps.length} étape{result.cascadeSteps.length > 1 ? 's' : ''}) :</strong>
                      <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
                        {result.cascadeSteps.map((step, sIdx) => {
                          const usedBadgeColor =
                            step.used === 'bracket'      ? '#16a34a' :
                            step.used === 'slope-follow' ? '#7c3aed' :
                            step.used === 'idw'          ? '#f59e0b' : '#dc2626';
                          const usedLabel =
                            step.used === 'bracket'      ? 'BRACKET' :
                            step.used === 'slope-follow' ? 'SLOPE-FOLLOW' :
                            step.used === 'idw'          ? 'IDW (fallback)' : 'ÉCHEC';
                          const stepKey = `${op.id}:${step.graphId || sIdx}`;
                          const isStepExpanded = expandedStepKey === stepKey;
                          const perGraph = perGraphById[step.graphId];
                          return (
                          <div key={step.graphId || sIdx} style={{
                            padding: '4px 8px',
                            marginBottom: 4,
                            backgroundColor: step.role === 'primary' ? '#dcfce7' : 'white',
                            borderLeft: `3px solid ${step.role === 'primary' ? '#16a34a' : '#f59e0b'}`,
                            borderRadius: 3
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
                                {step.role === 'primary' ? '⭐ Primaire' : `🔗 T${step.cascadeOrder ?? '?'}`}
                                {' — '}{step.graphName}
                                {' '}
                                <span style={{
                                  display: 'inline-block', padding: '1px 5px', borderRadius: 3,
                                  fontSize: 9, fontWeight: 700,
                                  backgroundColor: usedBadgeColor, color: 'white'
                                }}>
                                  {usedLabel}
                                </span>
                              </div>
                              {/* Bouton burger menu (⋯) pour ouvrir l'inspection détaillée du graphe */}
                              <button
                                type="button"
                                onClick={() => setExpandedStepKey(isStepExpanded ? null : stepKey)}
                                title={isStepExpanded ? 'Masquer l\'inspection détaillée' : 'Voir l\'inspection détaillée (axes, courbes, méthode)'}
                                style={{
                                  border: '1px solid #d1d5db',
                                  backgroundColor: isStepExpanded ? '#312e81' : 'white',
                                  color: isStepExpanded ? 'white' : '#374151',
                                  borderRadius: 4,
                                  padding: '2px 8px',
                                  fontSize: 14,
                                  lineHeight: 1,
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  flexShrink: 0
                                }}
                                aria-expanded={isStepExpanded}
                                aria-label="Inspection détaillée"
                              >
                                {isStepExpanded ? '×' : '⋯'}
                              </button>
                            </div>
                            <div style={{ fontSize: 10, color: '#6b7280' }}>
                              X = <code>{step.xDim}</code> = <strong>{step.queryX !== null && step.queryX !== undefined ? Number(step.queryX).toFixed(2) : '—'}</strong>
                              {step.entryY !== null && step.entryY !== undefined && (
                                <> · Y_in = <strong>{Number(step.entryY).toFixed(2)}</strong></>
                              )}
                              {' → '}
                              Y = <code>{step.yTitle}</code> = <strong style={{ color: '#065f46' }}>{step.output !== null ? Number(step.output).toFixed(2) : '—'}</strong>
                              {step.bracketResult && !step.bracketResult.error && step.used === 'bracket' && (
                                <>
                                  {' '}(entre
                                  {' '}<strong>"{step.bracketResult.lowerCurve?.name}"</strong> ({step.bracketResult.familyDim}={step.bracketResult.lowerCurve?.familyValue}, Y={Number(step.bracketResult.lowerCurve?.y).toFixed(1)})
                                  {' '}et
                                  {' '}<strong>"{step.bracketResult.upperCurve?.name}"</strong> ({step.bracketResult.familyDim}={step.bracketResult.upperCurve?.familyValue}, Y={Number(step.bracketResult.upperCurve?.y).toFixed(1)})
                                  {', '}t={Number(step.bracketResult.familyT).toFixed(3)})
                                </>
                              )}
                              {step.slopeResult && !step.slopeResult.error && step.used === 'slope-follow' && (
                                <>
                                  {' '}(entre
                                  {' '}<strong>"{step.slopeResult.lowerCurve?.name}"</strong> (entry_y={Number(step.slopeResult.lowerCurve?.entryY).toFixed(2)}, y@target={Number(step.slopeResult.lowerCurve?.yAtTargetX).toFixed(1)})
                                  {' '}et
                                  {' '}<strong>"{step.slopeResult.upperCurve?.name}"</strong> (entry_y={Number(step.slopeResult.upperCurve?.entryY).toFixed(2)}, y@target={Number(step.slopeResult.upperCurve?.yAtTargetX).toFixed(1)})
                                  {', '}t={Number(step.slopeResult.t).toFixed(3)})
                                </>
                              )}
                            </div>
                            {/* En mode strict (déclaré) et échec : afficher l'erreur de l'étape */}
                            {step.modeDeclared && step.used === null && step.error && (
                              <div style={{ fontSize: 10, color: '#7f1d1d', backgroundColor: '#fee2e2', padding: '4px 6px', marginTop: 4, borderRadius: 3, fontWeight: 600 }}>
                                ❌ Échec mode déclaré « {step.mode} » : {step.error}
                              </div>
                            )}
                            {/* En mode auto, on peut afficher les méthodes tentées mais échouées (legacy debug) */}
                            {!step.modeDeclared && step.slopeResult?.error && step.used !== 'slope-follow' && (
                              <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                                ❌ Slope-follow tenté en auto : {step.slopeResult.error}
                              </div>
                            )}
                            {!step.modeDeclared && step.bracketResult?.error && step.used !== 'bracket' && (
                              <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                                ❌ Bracket tenté en auto : {step.bracketResult.error}
                              </div>
                            )}

                            {/* ─── PANNEAU D'INSPECTION DÉTAILLÉE (toggle ⋯) ───
                                Format tableau structuré : axes, mode, courbes, méthode + paramètres. */}
                            {isStepExpanded && perGraph && (
                              <div style={{
                                marginTop: 8,
                                padding: 10,
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                fontFamily: 'Inter, system-ui, sans-serif'
                              }}>
                                {/* Tableau récap caractéristiques du graphe */}
                                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                  <tbody>
                                    <tr>
                                      <td style={{ padding: '3px 6px', fontWeight: 600, color: '#475569', width: '35%' }}>Mode déclaré</td>
                                      <td style={{ padding: '3px 6px' }}>
                                        <code style={{
                                          padding: '1px 6px', borderRadius: 3, fontWeight: 700,
                                          backgroundColor: perGraph.interpolationMode === 'slope-follow' ? '#7c3aed'
                                                        : perGraph.interpolationMode === 'family' ? '#16a34a'
                                                        : perGraph.interpolationMode === 'mono' ? '#0891b2'
                                                        : '#9ca3af',
                                          color: 'white'
                                        }}>{perGraph.interpolationMode || 'auto'}</code>
                                        {perGraph.familyAxisVariable && (
                                          <span style={{ marginLeft: 8, color: '#64748b' }}>
                                            familyAxisVariable = <code>{perGraph.familyAxisVariable}</code>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                    <tr style={{ backgroundColor: 'white' }}>
                                      <td style={{ padding: '3px 6px', fontWeight: 600, color: '#475569' }}>Axes</td>
                                      <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>
                                        X = <code>{perGraph.axes?.xTitle}</code>{perGraph.axes?.xUnit && ` (${perGraph.axes.xUnit})`}
                                        {' · '}
                                        Y = <code>{perGraph.axes?.yTitle}</code>{perGraph.axes?.yUnit && ` (${perGraph.axes.yUnit})`}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style={{ padding: '3px 6px', fontWeight: 600, color: '#475569' }}>Courbes / points</td>
                                      <td style={{ padding: '3px 6px' }}>
                                        <strong>{perGraph.curveCount}</strong> courbe(s) · <strong>{perGraph.pointCount}</strong> point(s) extrait(s)
                                      </td>
                                    </tr>
                                    {step.slopeResult?.axisReversed && (
                                      <tr style={{ backgroundColor: 'white' }}>
                                        <td style={{ padding: '3px 6px', fontWeight: 600, color: '#475569' }}>Orientation axe X</td>
                                        <td style={{ padding: '3px 6px', color: '#9a3412' }}>
                                          ⬅ <strong>décroissant</strong> — entry_y prise au X max (bord gauche visuel)
                                        </td>
                                      </tr>
                                    )}
                                    {step.slopeResult?.entryYSource && (
                                      <tr>
                                        <td style={{ padding: '3px 6px', fontWeight: 600, color: '#475569' }}>Source entry_y</td>
                                        <td style={{ padding: '3px 6px' }}>
                                          <code style={{
                                            padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                                            backgroundColor: step.slopeResult.entryYSource === 'manual'      ? '#ede9fe'
                                                          : step.slopeResult.entryYSource === 'mixed'       ? '#fef3c7'
                                                          : step.slopeResult.entryYSource === 'first-point' ? '#dcfce7'
                                                          : '#f1f5f9',
                                            color: step.slopeResult.entryYSource === 'manual'      ? '#5b21b6'
                                                 : step.slopeResult.entryYSource === 'mixed'       ? '#92400e'
                                                 : step.slopeResult.entryYSource === 'first-point' ? '#065f46'
                                                 : '#475569'
                                          }}>
                                            {step.slopeResult.entryYSource === 'first-point' ? '1er point' : step.slopeResult.entryYSource}
                                          </code>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>

                                {/* Liste détaillée des courbes (toggle) */}
                                {perGraph.curveAnalysis && perGraph.curveAnalysis.length > 0 && (
                                  <details style={{ marginTop: 8, fontSize: 10 }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                                      📊 Détail des {perGraph.curveAnalysis.length} courbe(s)
                                    </summary>
                                    <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginTop: 4 }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                                          <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600 }}>Nom</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>Pts</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600 }}>Paramètre familial</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {perGraph.curveAnalysis.map((c, ci) => (
                                          <tr key={ci} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: ci % 2 === 0 ? 'white' : '#f8fafc' }}>
                                            <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{c.name}</td>
                                            <td style={{ padding: '3px 6px', textAlign: 'right' }}>{c.pointCount}</td>
                                            <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>
                                              {c.familyParsed
                                                ? <span style={{ color: '#16a34a' }}>{c.familyKind} = {c.familyValue}</span>
                                                : <span style={{ color: '#94a3b8' }}>—</span>}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </details>
                                )}

                                {/* Liste des entry_y triés (slope-follow) si applicable */}
                                {step.slopeResult?.availableEntryRows && step.slopeResult.availableEntryRows.length > 0 && (
                                  <details style={{ marginTop: 6, fontSize: 10 }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                                      🪜 Courbes triées par entry_y croissant
                                    </summary>
                                    <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', marginTop: 4 }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                                          <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600 }}></th>
                                          <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600 }}>Courbe</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>entry_y</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>X 1er pt</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {step.slopeResult.availableEntryRows.map((row, ri) => {
                                          const isLower = row.name === step.slopeResult.lowerCurve?.name;
                                          const isUpper = row.name === step.slopeResult.upperCurve?.name;
                                          const marker = isLower ? '▼' : isUpper ? '▲' : '';
                                          return (
                                            <tr key={ri} style={{
                                              borderBottom: '1px solid #e2e8f0',
                                              backgroundColor: (isLower || isUpper) ? '#f5f3ff' : (ri % 2 === 0 ? 'white' : '#f8fafc'),
                                              fontWeight: (isLower || isUpper) ? 700 : 400,
                                              color: (isLower || isUpper) ? '#5b21b6' : '#374151'
                                            }}>
                                              <td style={{ padding: '3px 6px', width: '20px' }}>{marker}</td>
                                              <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{row.name}</td>
                                              <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(row.entryY).toFixed(2)}</td>
                                              <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace' }}>
                                                {row.firstPointX !== null && row.firstPointX !== undefined ? Number(row.firstPointX).toFixed(1) : '—'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </details>
                                )}

                                {/* Filtre vent appliqué */}
                                {(step.slopeResult?.windFilter || step.bracketResult?.windFilter) && (() => {
                                  const wf = step.slopeResult?.windFilter || step.bracketResult?.windFilter;
                                  if (!wf) return null;
                                  return (
                                    <div style={{
                                      marginTop: 6, padding: 6, borderRadius: 3, fontSize: 10,
                                      backgroundColor: wf.applied ? '#dbeafe' : '#fef3c7',
                                      borderLeft: `3px solid ${wf.applied ? '#0284c7' : '#f59e0b'}`,
                                      color: wf.applied ? '#0c4a6e' : '#92400e'
                                    }}>
                                      <strong>🌬 Filtre direction vent :</strong>{' '}
                                      {wf.applied ? (
                                        <>
                                          <span style={{
                                            display: 'inline-block', padding: '0 5px', borderRadius: 2,
                                            fontSize: 9, fontWeight: 700,
                                            backgroundColor: wf.actualDirection === 'headwind' ? '#16a34a'
                                                          : wf.actualDirection === 'tailwind' ? '#dc2626' : '#64748b',
                                            color: 'white'
                                          }}>
                                            {wf.actualDirection === 'headwind' ? '↑ HEADWIND'
                                             : wf.actualDirection === 'tailwind' ? '↓ TAILWIND' : '— CALME'}
                                          </span>
                                          {' '}— {wf.keptCount} courbe(s) gardée(s), {wf.excludedCount || 0} exclue(s)
                                          {typeof wf.queryWindUsed === 'number' && (
                                            <> · query <strong>{Number(wf.queryWindUsed).toFixed(1)} kt</strong></>
                                          )}
                                        </>
                                      ) : (wf.reason || 'Filtre non applicable')}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );})}
                      </div>
                    </div>
                    );
                  })()}
                  {result.nearestPoints && result.nearestPoints.length > 0 && (
                    <details style={{ marginBottom: 6 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        {result.nearestPoints.length} point(s) voisin(s) utilisés (déplier)
                      </summary>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 11, fontFamily: 'monospace' }}>
                        {result.nearestPoints.map((p, i) => (
                          <li key={i}>
                            T={p.temperature?.toFixed(1)}°C, PA={p.pressure_altitude?.toFixed(0)}ft,
                            mass={p.mass?.toFixed(0)}kg, wind={p.wind?.toFixed(0)}kt → {p.distance?.toFixed(1)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {result.reason && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Détail :</strong> {result.reason}
                    </div>
                  )}
                  {result.missingInputs?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Inputs manquants :</strong> {result.missingInputs.join(', ')}
                    </div>
                  )}
                  {result.candidates && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Candidats en conflit :</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {result.candidates.map((c, i) => (
                          <li key={i}><code>{c.graphName}</code> dans <code>{c.modelName}</code></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.warnings?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Warnings :</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {op.description && (
                    <div style={{ fontStyle: 'italic', opacity: 0.8, marginTop: 4 }}>
                      ℹ {op.description}
                    </div>
                  )}
                  {op.acceptedOutputs?.length > 1 && (
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                      Sorties acceptées : {op.acceptedOutputs.map(o => `${o.labelFr} (${o.defaultUnit})`).join(' OU ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pied avec horodatage */}
      <div style={{
        padding: '6px 12px',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        fontSize: 10,
        color: '#6b7280',
        textAlign: 'right'
      }}>
        Généré à {new Date(state.generatedAt).toLocaleTimeString()} —
        Avion : <code>{state.aircraftId || '(non identifié)'}</code>
      </div>
    </div>
  );
}

function formatValue(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10)  return v.toFixed(1);
  return v.toFixed(2);
}

export default PerformanceStateMatrix;
