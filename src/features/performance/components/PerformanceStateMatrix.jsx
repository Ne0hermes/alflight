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
import { OPERATION_CATALOG } from '../../../abac/curves/core/operationCatalog';
import { applySafetyFactor, isDistanceOperation, DEFAULT_SAFETY_FACTOR } from '../../../utils/performanceSafetyFactor';

const PHASE_ICONS = {
  takeoff:  '🛫',
  climb:    '📈',
  cruise:   '✈',
  descent:  '📉',
  landing:  '🛬'
};

const STATUS_VISUAL = {
  COMPUTED: {
    bg: 'var(--bg-overlay)', border: 'var(--text-primary)', text: 'var(--text-primary)',
    badge: 'Calculé', badgeBg: 'var(--text-primary)'
  },
  NOT_IMPLEMENTED: {
    // Gris neutre (fini l'orange flashy) — texte blanc, comme l'analyse de pistes.
    bg: 'var(--bg-overlay)', border: 'var(--border-regular)', text: 'var(--text-primary)',
    badge: 'Non implémenté', badgeBg: 'var(--bg-raised)', badgeText: 'var(--text-primary)'
  },
  MISSING_INPUT: {
    bg: 'var(--bg-overlay)', border: 'var(--border-regular)', text: 'var(--text-primary)',
    badge: 'Input manquant', badgeBg: 'var(--bg-raised)', badgeText: 'var(--text-primary)'
  },
  AMBIGUOUS: {
    bg: 'var(--bg-overlay)', border: 'var(--color-red-critical)', text: 'var(--color-red-critical)',
    badge: 'Ambigu', badgeBg: 'var(--color-red-critical)'
  },
  ERROR: {
    bg: 'var(--border-subtle)', border: 'var(--color-red-critical)', text: 'var(--color-red-critical)',
    badge: 'Erreur', badgeBg: 'var(--color-red-critical)'
  }
};

/**
 * @param {object} props
 * @param {object} props.aircraft       L'avion sélectionné (avec performanceModels)
 * @param {object} props.inputs         { mass, oat, pressureAltitude, headwind, ... }
 * @param {string} [props.title]        Titre de la matrice (défaut "État de performance")
 * @param {string[]} [props.phases]     Liste des phases à afficher.
 * @param {object}  [props.safetyFactor] Preset de marge réglementaire optionnel
 *                                       { id, value, label, description }. Default = brut MANEX (×1.0).
 *                                       Le facteur n'affecte QUE l'affichage des distances,
 *                                       pas les calculs amont ni le stockage.
 */
export function PerformanceStateMatrix({ aircraft, inputs = {}, title = 'État de performance — couverture exhaustive', phases, safetyFactor = DEFAULT_SAFETY_FACTOR }) {
  const state = useMemo(() => generatePerformanceState(aircraft, inputs), [aircraft, inputs]);
  const [expandedOp, setExpandedOp] = useState(null);
  // Repli de la matrice. null = défaut intelligent (replié si tout est non-implémenté).
  const [collapsed, setCollapsed] = useState(null);

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
  const coverageColor = coverageRatio >= 0.8 ? 'var(--text-primary)' : coverageRatio >= 0.5 ? 'var(--accent-primary)' : 'var(--color-red-critical)';

  // Section entièrement non-implémentée → repliée par défaut + titre explicite.
  const allNotImplemented = coverage.total > 0 && coverage.notImplemented === coverage.total;
  const isCollapsed = collapsed === null ? allNotImplemented : collapsed;
  const displayTitle = allNotImplemented ? `${title} — à implémenter (non fonctionnelle)` : title;

  return (
    <div style={{
      border: '1px solid var(--border-regular)',
      borderRadius: 8,
      backgroundColor: 'var(--bg-overlay)',
      marginBottom: 16,
      overflow: 'hidden'
    }}>
      {/* En-tête avec barre de couverture (cliquable : replier/déplier) */}
      <div
        onClick={() => setCollapsed(!isCollapsed)}
        style={{
          padding: 12,
          backgroundColor: 'var(--bg-overlay)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{isCollapsed ? '▶' : '▼'}</span>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {displayTitle}
            </h3>
          </div>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            backgroundColor: 'var(--bg-overlay)', padding: '6px 10px', borderRadius: 6,
            border: `2px solid ${coverageColor}`
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: coverageColor }}>
              {coverage.computed}/{coverage.total}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              opérations<br/>calculées
            </span>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 6, backgroundColor: 'var(--border-subtle)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${coverageRatio * 100}%`,
            backgroundColor: coverageColor, transition: 'width 0.3s'
          }} />
        </div>

        {/* Compteurs détaillés : on n'affiche que les anomalies, pas la coche "✓ N calculés"
            (l'info "N/M opérations calculées" est déjà dans le compteur principal à droite). */}
        {(coverage.notImplemented > 0 || coverage.missingInput > 0 || coverage.ambiguous > 0 || coverage.error > 0) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
            {coverage.notImplemented > 0 && <span style={{ color: 'var(--accent-primary)' }}>{coverage.notImplemented} non implémenté{coverage.notImplemented > 1 ? 's' : ''}</span>}
            {coverage.missingInput > 0 && <span style={{ color: 'var(--accent-primary)' }}>{coverage.missingInput} input manquant</span>}
            {coverage.ambiguous > 0 && <span style={{ color: 'var(--color-red-critical)' }}>{coverage.ambiguous} ambigu{coverage.ambiguous > 1 ? 's' : ''}</span>}
            {coverage.error > 0 && <span style={{ color: 'var(--color-red-critical)' }}>{coverage.error} erreur{coverage.error > 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      {/* Lignes (masquées si replié) */}
      {!isCollapsed && (
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
                borderBottom: '1px solid var(--border-subtle)',
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{op.labelFr}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>{op.id}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  {status === ResultStatus.COMPUTED ? (
                    <>
                      {/* Application du facteur de sécurité UNIQUEMENT pour les opérations distance,
                          UNIQUEMENT à l'affichage. La valeur brute est toujours visible en petit
                          en-dessous quand un facteur > 1 est appliqué. */}
                      {(() => {
                        const isDist = isDistanceOperation(op.id);
                        const factorApplies = isDist && safetyFactor && safetyFactor.value > 1;
                        const displayedValue = factorApplies
                          ? applySafetyFactor(result.value, op.id, safetyFactor.value)
                          : result.value;
                        return (
                          <>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>
                              {formatValue(displayedValue)} <span style={{ fontSize: 12, fontWeight: 500 }}>{result.unit}</span>
                            </div>
                            {factorApplies && (
                              <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 1, fontStyle: 'italic' }}>
                                brut : {formatValue(result.value)} × {safetyFactor.value}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {result.warnings?.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2 }}>
                          {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
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
                  color: visual.badgeText || 'var(--app-bg)',
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
                      <strong>Source :</strong>{' '}
                      <span style={{
                        display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                        fontSize: 9, fontWeight: 700, marginRight: 6,
                        backgroundColor: result.source.kind === 'table' ? 'var(--text-secondary)' : 'var(--text-secondary)',
                        color: 'var(--text-primary)'
                      }}>
                        {result.source.kind === 'table' ? 'TABLEAU' : 'ABAQUE'}
                      </span>
                      {result.source.kind === 'table' ? (
                        <>
                          {result.source.tableCount > 0 && <>tableaux : <code>{result.source.tableCount}</code>, </>}
                          {result.source.masses && result.source.masses.length > 0 && <>masses : <code>[{result.source.masses.join(', ')}] kg</code>, </>}
                          {result.source.method && <>méthode : <code>{result.source.method}</code></>}
                        </>
                      ) : (
                        <>
                          abaque <code>{result.source.graphName}</code>
                          (set : <code>{result.source.modelName}</code>,
                          {result.source.curveCount > 0 && <> courbes : <code>{result.source.curveCount}</code>,</>}
                          {result.source.pointsUsed > 0 && <> points : <code>{result.source.pointsUsed}</code>,</>}
                          {result.source.method && <> méthode : <code>{result.source.method}</code></>})
                        </>
                      )}
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
                  {/* Chaîne de cascade : output de chaque graphe → input du suivant. */}
                  {result.cascadeSteps && result.cascadeSteps.length > 0 && (
                    <div style={{
                      marginBottom: 8, padding: 8,
                      backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--bg-overlay)', borderRadius: 4
                    }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>Chaîne de cascade ({result.cascadeSteps.length} étape{result.cascadeSteps.length > 1 ? 's' : ''}) :</strong>
                      <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
                        {result.cascadeSteps.map((step, sIdx) => {
                          const usedBadgeColor =
                            step.used === 'bracket'      ? 'var(--text-primary)' :
                            step.used === 'slope-follow' ? 'var(--accent-primary)' :
                            step.used === 'trilinear'    ? 'var(--text-secondary)' :
                            step.used === 'idw'          ? 'var(--accent-primary)' : 'var(--color-red-critical)';
                          const usedLabel =
                            step.used === 'bracket'      ? 'BRACKET' :
                            step.used === 'slope-follow' ? 'SLOPE-FOLLOW' :
                            step.used === 'trilinear'    ? 'TRILINÉAIRE' :
                            step.used === 'idw'          ? 'IDW (fallback)' : 'ÉCHEC';
                          return (
                          <div key={step.graphId || sIdx} style={{
                            padding: '4px 8px',
                            marginBottom: 4,
                            backgroundColor: step.role === 'primary' ? 'var(--bg-overlay)' : 'var(--bg-surface)',
                            borderLeft: `3px solid ${step.role === 'primary' ? 'var(--text-primary)' : 'var(--accent-primary)'}`,
                            borderRadius: 3
                          }}>
                            <div style={{ fontWeight: 700 }}>
                              {step.role === 'primary' ? 'Primaire' : `T${step.cascadeOrder ?? '?'}`}
                              {' — '}{step.graphName}
                              {' '}
                              <span style={{
                                display: 'inline-block', padding: '1px 5px', borderRadius: 3,
                                fontSize: 9, fontWeight: 700,
                                backgroundColor: usedBadgeColor, color: 'var(--text-primary)'
                              }}>
                                {usedLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              X = <code>{step.xDim}</code> = <strong>{step.queryX !== null && step.queryX !== undefined ? Number(step.queryX).toFixed(2) : '—'}</strong>
                              {step.entryY !== null && step.entryY !== undefined && (
                                <> · Y_in = <strong>{Number(step.entryY).toFixed(2)}</strong></>
                              )}
                              {' → '}
                              Y = <code>{step.yTitle}</code> = <strong style={{ color: 'var(--text-primary)' }}>{step.output !== null ? Number(step.output).toFixed(2) : '—'}</strong>
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
                            {/* FIX I : arithmétique finale EXPLICITE — chaque étape recalculable à la main */}
                            {step.used === 'bracket' && step.bracketResult && !step.bracketResult.error &&
                             step.bracketResult.lowerCurve && step.bracketResult.upperCurve && step.output !== null && step.output !== undefined && (
                              <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                                Y = {Number(step.bracketResult.lowerCurve.y).toFixed(1)} + {Number(step.bracketResult.familyT).toFixed(3)} × ({Number(step.bracketResult.upperCurve.y).toFixed(1)} − {Number(step.bracketResult.lowerCurve.y).toFixed(1)}) = <strong style={{ color: 'var(--text-primary)' }}>{Number(step.output).toFixed(2)}</strong>
                              </div>
                            )}
                            {step.used === 'slope-follow' && step.slopeResult && !step.slopeResult.error &&
                             step.slopeResult.lowerCurve && step.slopeResult.upperCurve && step.output !== null && step.output !== undefined && (
                              <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                                Y = {Number(step.slopeResult.lowerCurve.yAtTargetX).toFixed(1)} + {Number(step.slopeResult.t).toFixed(3)} × ({Number(step.slopeResult.upperCurve.yAtTargetX).toFixed(1)} − {Number(step.slopeResult.lowerCurve.yAtTargetX).toFixed(1)}) = <strong style={{ color: 'var(--text-primary)' }}>{Number(step.output).toFixed(2)}</strong>
                              </div>
                            )}
                            {/* En mode strict (déclaré) et échec : afficher l'erreur de l'étape */}
                            {step.modeDeclared && step.used === null && step.error && (
                              <div style={{ fontSize: 10, color: 'var(--color-red-critical)', backgroundColor: 'var(--bg-overlay)', padding: '4px 6px', marginTop: 4, borderRadius: 3, fontWeight: 600 }}>
Échec mode déclaré « {step.mode} » : {step.error}
                              </div>
                            )}
                            {/* En mode auto, on peut afficher les méthodes tentées mais échouées (legacy debug) */}
                            {!step.modeDeclared && step.slopeResult?.error && step.used !== 'slope-follow' && (
                              <div style={{ fontSize: 10, color: 'var(--color-red-critical)', marginTop: 2 }}>
Slope-follow tenté en auto : {step.slopeResult.error}
                              </div>
                            )}
                            {!step.modeDeclared && step.bracketResult?.error && step.used !== 'bracket' && (
                              <div style={{ fontSize: 10, color: 'var(--color-red-critical)', marginTop: 2 }}>
Bracket tenté en auto : {step.bracketResult.error}
                              </div>
                            )}
                          </div>
                        );})}
                      </div>
                    </div>
                  )}
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
                      {op.description}
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
      )}

      {/* Pied avec horodatage (masqué si replié) */}
      {!isCollapsed && (
      <div style={{
        padding: '6px 12px',
        backgroundColor: 'var(--bg-overlay)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-secondary)',
        textAlign: 'right'
      }}>
        Généré à {new Date(state.generatedAt).toLocaleTimeString()} —
        Avion : <code>{state.aircraftId || '(non identifié)'}</code>
      </div>
      )}
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
