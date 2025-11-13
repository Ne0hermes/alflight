// src/features/performance/components/PerformanceTableCalculator.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, ChevronDown, ChevronUp, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import performanceInterpolation from '../../../services/performanceInterpolation';
import { getCombinedDataForGroup } from '../../../services/performanceTableGrouping';
import { calculatePerformanceDistance, calculatePerformanceWithExtrapolation } from '../../../services/performanceTrilinearInterpolation';

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

    // 🔍 DEBUG: Analyser les unités des altitudes
    if (combined && combined.altitudes) {
      const minAlt = Math.min(...combined.altitudes);
      const maxAlt = Math.max(...combined.altitudes);
      const probableUnit = maxAlt > 500 ? 'PIEDS (ft)' : 'MÈTRES (m)';

      console.log('📊 [Calculator] Données combinées du groupe:', combined);
      console.log('📐 [Calculator] ANALYSE UNITÉS ALTITUDE:', {
        altitudes: combined.altitudes,
        min: minAlt,
        max: maxAlt,
        probableUnit,
        warning: probableUnit === 'MÈTRES (m)' ? '⚠️ ATTENTION: Altitudes semblent être en MÈTRES mais conditions.altitude est en PIEDS!' : '✅ OK'
      });
    }

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

    // 🔧 NOUVEAU: Utiliser l'interpolation trilinéaire avec extrapolation si groupe disponible
    if (combinedGroupData && conditions.weight !== null) {
      console.log('🔄 [Calculator] Calcul trilinéaire avec:', {
        altitude: conditions.altitude,
        temperature: conditions.temperature,
        weight: conditions.weight
      });

      // Utiliser la fonction avec extrapolation
      const groundRollResult = calculatePerformanceWithExtrapolation(
        combinedGroupData,
        'Distance_roulement',
        conditions.weight,
        conditions.altitude,
        conditions.temperature
      );
      console.log('🎯 [Calculator] groundRollResult:', groundRollResult);

      const distance15mResult = calculatePerformanceWithExtrapolation(
        combinedGroupData,
        'Distance_passage_15m',
        conditions.weight,
        conditions.altitude,
        conditions.temperature
      );
      console.log('🎯 [Calculator] distance15mResult:', distance15mResult);

      // Si on a des résultats (interpolés ou extrapolés)
      console.log('🎯 [Calculator] Vérification résultats:', {
        hasGroundRoll: !!groundRollResult,
        hasDistance15m: !!distance15mResult,
        willProceed: !!(groundRollResult || distance15mResult)
      });

      if (groundRollResult || distance15mResult) {
        // Déterminer si on a une valeur simple (interpolation normale) ou multiple (extrapolation)
        const hasExtrapolation =
          (groundRollResult?.extrapolated || groundRollResult?.clamped) ||
          (distance15mResult?.extrapolated || distance15mResult?.clamped);

        if (hasExtrapolation) {
          // Masse hors limites - retourner les deux calculs
          return {
            groundRoll: {
              extrapolated: groundRollResult?.extrapolated ? {
                value: Math.round(groundRollResult.extrapolated.value),
                warning: groundRollResult.extrapolated.warning
              } : null,
              clamped: groundRollResult?.clamped ? {
                value: Math.round(groundRollResult.clamped.value),
                massUsed: groundRollResult.clamped.massUsed,
                warning: groundRollResult.clamped.warning
              } : null
            },
            distance50ft: {
              extrapolated: distance15mResult?.extrapolated ? {
                value: Math.round(distance15mResult.extrapolated.value),
                warning: distance15mResult.extrapolated.warning
              } : null,
              clamped: distance15mResult?.clamped ? {
                value: Math.round(distance15mResult.clamped.value),
                massUsed: distance15mResult.clamped.massUsed,
                warning: distance15mResult.clamped.warning
              } : null
            },
            outOfRange: true,
            trilinear: true
          };
        } else {
          // Interpolation normale
          return {
            groundRoll: groundRollResult?.value ? Math.round(groundRollResult.value) : null,
            distance50ft: distance15mResult?.value ? Math.round(distance15mResult.value) : null,
            interpolated: true,
            trilinear: true
          };
        }
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
      {/* Header du tableau avec résultats intégrés */}
      <div style={sx.spacing.p(4)}>
        {/* Titre et informations */}
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
          <div style={{ flex: 1 }}>
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

        {/* 🔧 RÉSULTATS INTÉGRÉS - Toujours visibles */}
        {result && !result.outOfRange && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
            {/* Distance de roulage - Interpolation normale */}
            {result.groundRoll && typeof result.groundRoll === 'number' && (
              <div style={sx.combine(sx.components.card.base, { backgroundColor: '#f0fdf4', padding: '12px' })}>
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                  Distance de roulage (ground roll)
                </p>
                <p style={sx.combine(sx.text.xl, sx.text.bold, { color: tableType.color })}>
                  {result.groundRoll} m
                </p>
              </div>
            )}

            {/* Distance 50ft - Interpolation normale */}
            {result.distance50ft && typeof result.distance50ft === 'number' && (
              <div style={sx.combine(sx.components.card.base, { backgroundColor: '#f0fdf4', padding: '12px' })}>
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
                  Distance passage 50ft / 15m
                </p>
                <p style={sx.combine(sx.text.xl, sx.text.bold, { color: tableType.color })}>
                  {result.distance50ft} m
                </p>
              </div>
            )}
          </div>
        )}

        {/* 🚨 RÉSULTATS HORS LIMITES - Affichage des 2 calculs */}
        {result && result.outOfRange && (
          <div style={{ marginTop: '16px' }}>
            {/* Avertissement masse hors limites */}
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(3))}>
              <AlertCircle size={16} />
              <div>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  ⚠️ MASSE HORS LIMITES DU TABLEAU
                </p>
                <p style={sx.text.xs}>
                  Masse: {conditions.weight} kg • Plage tableau: {displayData?.masses?.[0]} - {displayData?.masses?.[displayData.masses.length - 1]} kg
                </p>
                <p style={sx.text.xs}>
                  Deux calculs affichés : Extrapolation linéaire + Calcul avec masse limite
                </p>
              </div>
            </div>

            {/* Grille 2x2 : Roulage et 50ft, chacun avec 2 calculs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {/* Distance de roulage */}
              {result.groundRoll && (
                <div>
                  <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2), { color: tableType.color })}>
                    Distance de roulage
                  </p>

                  {/* Extrapolée */}
                  {result.groundRoll.extrapolated && (
                    <div style={sx.combine(sx.components.card.base, { backgroundColor: '#fef3c7', padding: '12px', marginBottom: '8px' })}>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        📊 Extrapolée ({conditions.weight} kg)
                      </p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#f59e0b' })}>
                        {result.groundRoll.extrapolated.value} m
                      </p>
                      <p style={sx.combine(sx.text.xs, { color: '#92400e', marginTop: '4px' })}>
                        {result.groundRoll.extrapolated.warning}
                      </p>
                    </div>
                  )}

                  {/* Masse limite */}
                  {result.groundRoll.clamped && (
                    <div style={sx.combine(sx.components.card.base, { backgroundColor: '#e0e7ff', padding: '12px' })}>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        📌 Masse limite ({result.groundRoll.clamped.massUsed} kg)
                      </p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#4f46e5' })}>
                        {result.groundRoll.clamped.value} m
                      </p>
                      <p style={sx.combine(sx.text.xs, { color: '#312e81', marginTop: '4px' })}>
                        {result.groundRoll.clamped.warning}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Distance 50ft */}
              {result.distance50ft && (
                <div>
                  <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2), { color: tableType.color })}>
                    Distance passage 50ft / 15m
                  </p>

                  {/* Extrapolée */}
                  {result.distance50ft.extrapolated && (
                    <div style={sx.combine(sx.components.card.base, { backgroundColor: '#fef3c7', padding: '12px', marginBottom: '8px' })}>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        📊 Extrapolée ({conditions.weight} kg)
                      </p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#f59e0b' })}>
                        {result.distance50ft.extrapolated.value} m
                      </p>
                      <p style={sx.combine(sx.text.xs, { color: '#92400e', marginTop: '4px' })}>
                        {result.distance50ft.extrapolated.warning}
                      </p>
                    </div>
                  )}

                  {/* Masse limite */}
                  {result.distance50ft.clamped && (
                    <div style={sx.combine(sx.components.card.base, { backgroundColor: '#e0e7ff', padding: '12px' })}>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        📌 Masse limite ({result.distance50ft.clamped.massUsed} kg)
                      </p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#4f46e5' })}>
                        {result.distance50ft.clamped.value} m
                      </p>
                      <p style={sx.combine(sx.text.xs, { color: '#312e81', marginTop: '4px' })}>
                        {result.distance50ft.clamped.warning}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔧 SECTIONS DÉTAILS SUPPRIMÉES - Interface simplifiée */}
      {/* Les résultats sont maintenant toujours visibles dans le header */}

      {/* 🚨 SÉCURITÉ: Avertissement si pas de résultat */}
      {!result && (
        <div style={sx.spacing.p(4)}>
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
        </div>
      )}
    </div>
  );
};

PerformanceTableCalculator.displayName = 'PerformanceTableCalculator';

export default PerformanceTableCalculator;
