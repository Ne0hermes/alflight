// src/features/performance/components/PerformanceTableCalculator.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, ChevronDown, ChevronUp, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import performanceInterpolation from '../../../services/performanceInterpolation';
import { getCombinedDataForGroup } from '../../../services/performanceTableGrouping';
import { calculatePerformanceDistance } from '../../../services/performanceTrilinearInterpolation';

/**
 * Calculateur de performance pour UN tableau extrait
 * Affiche tous les paramètres internes et le raisonnement de calcul
 */
const PerformanceTableCalculator = ({
  table: propTable,
  tableGroup,
  index,
  defaultAltitude,
  defaultTemperature,
  defaultWeight,
  departureAirport,
  arrivalAirport,
  isExpanded: initialExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [showCalculationDetails, setShowCalculationDetails] = useState(true);

  // 🔧 COMPATIBILITÉ: Accepter soit table soit tableGroup
  // Si tableGroup est fourni, utiliser le premier tableau pour compatibilité temporaire
  const table = useMemo(() => {
    if (propTable) return propTable;
    if (tableGroup && tableGroup.tables && tableGroup.tables.length > 0) {
      console.log('📊 [PerformanceTableCalculator] Utilisation du groupe:', tableGroup.baseName, 'avec', tableGroup.tables.length, 'tableaux');
      return tableGroup.tables[0]; // Utiliser le premier tableau du groupe
    }
    return null;
  }, [propTable, tableGroup]);

  // 🚨 SÉCURITÉ CRITIQUE: Conditions de calcul (peuvent être éditées par l'utilisateur)
  // NE PAS utiliser de fallback sur la température (danger performances incorrectes)
  const [conditions, setConditions] = useState({
    altitude: defaultAltitude || 0,
    temperature: defaultTemperature !== null && defaultTemperature !== undefined ? defaultTemperature : null,
    weight: defaultWeight || null
  });

  // 🚨 SÉCURITÉ CRITIQUE: Mettre à jour les conditions si les valeurs par défaut changent
  // Accepter null pour temperature (indique température non disponible)
  useEffect(() => {
    setConditions(prev => ({
      altitude: defaultAltitude ?? prev.altitude,
      temperature: defaultTemperature !== undefined ? defaultTemperature : prev.temperature,
      weight: defaultWeight ?? prev.weight
    }));
  }, [defaultAltitude, defaultTemperature, defaultWeight]);

  // 🔧 NOUVEAU: Utiliser le groupe si disponible
  const combinedGroupData = useMemo(() => {
    if (!tableGroup) return null;
    const combined = getCombinedDataForGroup(tableGroup);
    console.log('📊 [Calculator] Données combinées du groupe:', combined);
    return combined;
  }, [tableGroup]);

  // Préparer les données du tableau (ancien système, pour compatibilité)
  const preparedData = useMemo(() => {
    if (combinedGroupData) return null; // Si on a un groupe, ne pas utiliser l'ancien système
    if (!table || !table.data) return null;
    return performanceInterpolation.prepareTableData(table.data);
  }, [table, combinedGroupData]);

  // 🚨 SÉCURITÉ CRITIQUE: Calculer les performances
  const result = useMemo(() => {
    // 🔧 DEBUG: Afficher les conditions
    console.log('🔍 [Calculator] Conditions actuelles:', {
      hasGroup: !!combinedGroupData,
      weight: conditions.weight,
      altitude: conditions.altitude,
      temperature: conditions.temperature,
      willCalculate: !!(combinedGroupData && conditions.weight !== null && conditions.temperature !== null)
    });

    // 🚨 SÉCURITÉ: Ne PAS calculer si température est null (danger performances incorrectes)
    if (conditions.temperature === null) {
      console.warn('⚠️ [Calculator] Calcul bloqué: température non disponible');
      return null;
    }

    // 🔧 NOUVEAU: Utiliser l'interpolation trilinéaire si groupe disponible
    if (combinedGroupData && conditions.weight !== null) {
      console.log('🔄 [Calculator] Calcul trilinéaire avec:', {
        altitude: conditions.altitude,
        temperature: conditions.temperature,
        weight: conditions.weight
      });

      const groundRoll = calculatePerformanceDistance(
        combinedGroupData,
        'Distance_roulement',
        conditions.weight,
        conditions.altitude,
        conditions.temperature
      );

      const distance15m = calculatePerformanceDistance(
        combinedGroupData,
        'Distance_passage_15m',
        conditions.weight,
        conditions.altitude,
        conditions.temperature
      );

      if (groundRoll !== null || distance15m !== null) {
        return {
          groundRoll: groundRoll ? Math.round(groundRoll) : null,
          distance50ft: distance15m ? Math.round(distance15m) : null,
          interpolated: true,
          trilinear: true // Flag pour indiquer qu'on a utilisé l'interpolation 3D
        };
      }
      return null;
    }

    // Ancien système (2D)
    if (!preparedData) return null;

    return performanceInterpolation.calculatePerformance(
      table,
      conditions.altitude,
      conditions.temperature,
      conditions.weight
    );
  }, [table, conditions, preparedData, combinedGroupData]);

  // Identifier le type de tableau
  const tableType = useMemo(() => {
    if (!table) return { key: 'unknown', label: '❓ Type inconnu', color: '#6b7280' };

    const name = (table.table_name || '').toLowerCase();
    const type = (table.table_type || '').toLowerCase();

    if (type === 'takeoff' || name.includes('take') || name.includes('décollage')) {
      return { key: 'takeoff', label: '✈️ Décollage', color: '#3b82f6' };
    } else if (type === 'landing' || name.includes('land') || name.includes('atterrissage')) {
      return { key: 'landing', label: '🛬 Atterrissage', color: '#10b981' };
    }
    return { key: 'unknown', label: '❓ Type inconnu', color: '#6b7280' };
  }, [table]);

  // Extraire le poids du tableau si disponible
  const tableWeight = useMemo(() => {
    if (!table) return null;
    const weightMatch = table.table_name?.match(/(\d+)\s*kg/i) ||
                        table.conditions?.match(/(\d+)\s*kg/i);
    return weightMatch ? parseInt(weightMatch[1]) : null;
  }, [table]);

  // Vérification de sécurité
  if (!table) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.components.alert.base, sx.components.alert.warning, sx.spacing.p(4))}>
        <AlertCircle size={20} />
        <div>
          <p style={sx.text.sm}>
            <strong>Aucun tableau disponible</strong>
          </p>
          <p style={sx.text.xs}>Le tableau ou le groupe de tableaux est vide.</p>
        </div>
      </div>
    );
  }

  // 🔧 CORRECTION: Ne vérifier preparedData que si on n'a PAS de groupe
  if (!combinedGroupData && !preparedData) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.components.alert.base, sx.components.alert.danger, sx.spacing.p(4))}>
        <AlertCircle size={20} />
        <div>
          <p style={sx.text.sm}>
            <strong>Erreur de préparation du tableau {index + 1}</strong>
          </p>
          <p style={sx.text.xs}>Les données du tableau ne peuvent pas être exploitées pour l'interpolation.</p>
        </div>
      </div>
    );
  }

  // 🔧 NOUVEAU: Structure unifiée pour groupes et tableaux simples
  const displayData = useMemo(() => {
    if (combinedGroupData) {
      // Mode groupe : utiliser les données du groupe
      return {
        altitudes: combinedGroupData.altitudes,
        temperatures: combinedGroupData.temperatures,
        masses: combinedGroupData.masses,
        isGroup: true
      };
    } else if (preparedData) {
      // Mode tableau simple : utiliser preparedData classique
      return {
        altitudes: preparedData.altitudes,
        temperatures: preparedData.temperatures,
        groundRollMatrix: preparedData.groundRollMatrix,
        distance50ftMatrix: preparedData.distance50ftMatrix,
        isGroup: false
      };
    }
    return null;
  }, [combinedGroupData, preparedData]);

  const { altitudes, temperatures } = displayData || { altitudes: [], temperatures: [] };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
      {/* Header du tableau */}
      <div
        style={sx.combine(
          sx.spacing.p(4),
          sx.flex.between,
          {
            cursor: 'pointer',
            borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none'
          }
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={sx.flex.start}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: tableType.color,
              marginRight: '12px',
              marginTop: '6px',
              flexShrink: 0
            }}
          />
          <div>
            <h4 style={sx.combine(sx.text.md, sx.text.bold)}>
              {tableType.label} - {tableGroup?.baseName || table.table_name || `Tableau ${index + 1}`}
              {displayData?.isGroup && <span style={{ color: '#8b5cf6', marginLeft: '8px', fontSize: '12px' }}>⚡ Interpolation 3D</span>}
            </h4>
            <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              {displayData?.isGroup && displayData.masses && (
                <span>Masses: {displayData.masses.join(', ')} kg</span>
              )}
              {!displayData?.isGroup && table.conditions && <span>Conditions: {table.conditions}</span>}
              {!displayData?.isGroup && tableWeight && <span> • Masse: {tableWeight} kg</span>}
              {displayData?.isGroup && tableGroup?.tableCount && (
                <span> • {tableGroup.tableCount} tableaux regroupés</span>
              )}
              {!displayData?.isGroup && <span> • {table.data?.length || 0} points de données</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {result && (
            <div style={sx.combine(sx.text.sm, sx.text.bold, { color: tableType.color })}>
              {result.groundRoll && <span>{result.groundRoll}m</span>}
              {result.groundRoll && result.distance50ft && <span> / </span>}
              {result.distance50ft && <span>{result.distance50ft}m</span>}
            </div>
          )}
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Corps du calculateur (affiché si expanded) */}
      {isExpanded && (
        <div style={sx.spacing.p(4)}>
          {/* Section 1: Plages disponibles dans le tableau */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(4))}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              📊 Plages disponibles dans {displayData?.isGroup ? 'le groupe' : 'le tableau'}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: displayData?.isGroup ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div>
                <p style={sx.text.bold}>Altitudes (ft):</p>
                <p>{altitudes.join(', ')}</p>
              </div>
              <div>
                <p style={sx.text.bold}>Températures (°C):</p>
                <p>{temperatures.join(', ')}</p>
              </div>
              {displayData?.isGroup && displayData.masses && (
                <div>
                  <p style={sx.text.bold}>Masses (kg):</p>
                  <p>{displayData.masses.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Conditions de calcul (éditables) */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(4))}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
              ⚙️ Conditions de calcul
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {/* Altitude */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                  Altitude (ft)
                </label>
                <input
                  type="number"
                  value={conditions.altitude}
                  onChange={(e) => setConditions(prev => ({ ...prev, altitude: parseFloat(e.target.value) || 0 }))}
                  style={sx.components.input.base}
                />
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                  Source: {departureAirport?.name || arrivalAirport?.name || 'Manuel'}
                </p>
              </div>

              {/* Température */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs, conditions.temperature === null && { color: '#ef4444' })}>
                  Température (°C) {conditions.temperature === null && '⚠️'}
                </label>
                <input
                  type="number"
                  value={conditions.temperature !== null ? conditions.temperature : ''}
                  onChange={(e) => setConditions(prev => ({ ...prev, temperature: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder={conditions.temperature === null ? "NON DISPONIBLE - Saisir manuellement" : ""}
                  style={sx.combine(
                    sx.components.input.base,
                    conditions.temperature === null && { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                  )}
                />
                <p style={sx.combine(sx.text.xs, conditions.temperature === null ? { color: '#ef4444' } : sx.text.secondary, sx.spacing.mt(1))}>
                  {conditions.temperature === null ? (
                    '⚠️ Température METAR non trouvée - Consulter météo et saisir manuellement'
                  ) : (
                    `ISA à ${conditions.altitude}ft: ${performanceInterpolation.getISATemperature(conditions.altitude).toFixed(1)}°C`
                  )}
                </p>
              </div>

              {/* Masse */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                  Masse (kg)
                </label>
                <input
                  type="number"
                  value={conditions.weight || ''}
                  onChange={(e) => setConditions(prev => ({ ...prev, weight: parseFloat(e.target.value) || null }))}
                  placeholder={defaultWeight ? `Défaut: ${defaultWeight}` : 'Non défini'}
                  style={sx.components.input.base}
                />
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                  Source: Masse et centrage
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Détails du calcul d'interpolation */}
          {result && result.interpolationDetails && (
            <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(4))}>
              <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
                <h5 style={sx.combine(sx.text.sm, sx.text.bold)}>
                  🔬 Détails du calcul d'interpolation
                </h5>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCalculationDetails(!showCalculationDetails);
                  }}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.secondary,
                    { padding: '4px 8px', fontSize: '11px' }
                  )}
                >
                  {showCalculationDetails ? 'Masquer' : 'Afficher'}
                </button>
              </div>

              {showCalculationDetails && (
                <>
                  {/* Méthode d'interpolation */}
                  <div style={sx.spacing.mb(3)}>
                    <p style={sx.combine(sx.text.xs, sx.text.bold)}>
                      Méthode: {result.interpolationDetails.method}
                    </p>
                    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      {result.interpolationDetails.method === 'Bilinéaire 2D'
                        ? 'Interpolation sur 2 axes (altitude + température) utilisant 4 points du tableau'
                        : 'Interpolation linéaire sur 1 axe utilisant 2 points du tableau'}
                    </p>
                  </div>

                  {/* Valeurs cibles */}
                  <div style={sx.spacing.mb(3)}>
                    <p style={sx.combine(sx.text.xs, sx.text.bold)}>Valeurs cibles:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <p style={sx.text.xs}>• Altitude: <strong>{result.interpolationDetails.targetAltitude} ft</strong></p>
                      <p style={sx.text.xs}>• Température: <strong>{result.interpolationDetails.targetTemperature}°C</strong></p>
                    </div>
                  </div>

                  {/* Points du tableau utilisés */}
                  {result.interpolationDetails.dataPointsUsed && result.interpolationDetails.dataPointsUsed.length > 0 && (
                    <div>
                      <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2))}>
                        Points du tableau utilisés pour l'interpolation:
                      </p>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{
                          width: '100%',
                          fontSize: '11px',
                          borderCollapse: 'collapse',
                          backgroundColor: 'white',
                          borderRadius: '4px'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Altitude (ft)</th>
                              <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Température (°C)</th>
                              <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>Roulage (m)</th>
                              <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>Distance 50ft (m)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.interpolationDetails.dataPointsUsed.map((point, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px', fontWeight: '500' }}>{point.altitude}</td>
                                <td style={{ padding: '8px', fontWeight: '500' }}>{point.temperature}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                  {point.groundRoll !== null ? point.groundRoll : '—'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                  {point.distance50ft !== null ? point.distance50ft : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Formule d'interpolation */}
                      <div style={sx.combine(sx.spacing.mt(3), sx.spacing.p(2), { backgroundColor: '#fef3c7', borderRadius: '4px' })}>
                        <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>
                          📐 Formule appliquée:
                        </p>
                        {result.interpolationDetails.method === 'Bilinéaire 2D' ? (
                          <div style={sx.text.xs}>
                            <p>1. Interpolation linéaire sur la température pour altitude basse</p>
                            <p>2. Interpolation linéaire sur la température pour altitude haute</p>
                            <p>3. Interpolation linéaire sur l'altitude entre les deux résultats</p>
                            <p style={sx.spacing.mt(1)}>
                              <code style={{ fontFamily: 'monospace', fontSize: '10px' }}>
                                f(alt,temp) = lerp_alt(lerp_temp(v1,v2), lerp_temp(v3,v4))
                              </code>
                            </p>
                          </div>
                        ) : (
                          <div style={sx.text.xs}>
                            <p>Interpolation linéaire: y = y₁ + (y₂ - y₁) × (x - x₁) / (x₂ - x₁)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Section 4: Résultats */}
          {result && (
            <div style={sx.combine(sx.components.card.base, sx.spacing.p(4), { backgroundColor: '#f0fdf4' })}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
                <CheckCircle size={16} style={{ marginRight: '6px', color: '#10b981' }} />
                Résultats calculés
              </h5>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {/* Distance de roulage */}
                {result.groundRoll && (
                  <div>
                    <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                      Distance de roulage (ground roll)
                    </p>
                    <p style={sx.combine(sx.text.xl, sx.text.bold)}>
                      {result.groundRoll} m
                    </p>
                    {result.groundRollWithMargin && (
                      <p style={sx.combine(sx.text.sm, { color: '#f59e0b' })}>
                        Avec marge 15%: {result.groundRollWithMargin} m
                      </p>
                    )}
                  </div>
                )}

                {/* Distance 50ft */}
                {result.distance50ft && (
                  <div>
                    <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                      Distance passage 50ft / 15m
                    </p>
                    <p style={sx.combine(sx.text.xl, sx.text.bold)}>
                      {result.distance50ft} m
                    </p>
                    {result.distance50ftWithMargin && (
                      <p style={sx.combine(sx.text.sm, { color: '#f59e0b' })}>
                        Avec marge 15%: {result.distance50ftWithMargin} m
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confiance de l'extraction */}
              {result.confidence && (
                <div style={sx.combine(sx.spacing.mt(3), sx.text.xs)}>
                  <p>
                    <strong>Niveau de confiance de l'extraction IA:</strong> {Math.round(result.confidence * 100)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 🚨 SÉCURITÉ: Avertissement si pas de résultat */}
          {!result && (
            <div style={sx.combine(
              sx.components.alert.base,
              conditions.temperature === null ? sx.components.alert.danger : sx.components.alert.warning
            )}>
              <AlertCircle size={16} />
              <div>
                {conditions.temperature === null ? (
                  <>
                    <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                      ⚠️ TEMPÉRATURE NON DISPONIBLE
                    </p>
                    <p style={sx.text.sm}>
                      Calcul de performance bloqué pour des raisons de sécurité.
                      La température METAR n'a pas été trouvée. Consultez la météo et saisissez la température manuellement dans le champ ci-dessus.
                    </p>
                  </>
                ) : (
                  <p style={sx.text.sm}>
                    Impossible de calculer les performances avec les conditions actuelles.
                    Vérifiez que les valeurs sont dans les plages supportées par le tableau.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

PerformanceTableCalculator.displayName = 'PerformanceTableCalculator';

export default PerformanceTableCalculator;
