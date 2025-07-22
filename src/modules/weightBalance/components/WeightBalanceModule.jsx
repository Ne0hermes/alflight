import React from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';
import { FUEL_DENSITIES } from '../../../utils/constants';

export const WeightBalanceModule = () => {
  const { 
    selectedAircraft,
    loads, 
    setLoads, 
    navigationResults,
    currentCalculation
  } = useFlightSystem();

  // Fonction pour calculer le moment d'un élément
  const calculateMoment = (mass, arm) => {
    return (mass * arm).toFixed(1);
  };

  // Composant pour afficher une ligne de charge avec bras de levier et moment
  const LoadRow = ({ label, value, onChange, max, armValue, armLabel }) => {
    const moment = calculateMoment(value, armValue || 0);
    
    return (
      <div style={{ 
        padding: '12px', 
        backgroundColor: '#f9fafb', 
        borderRadius: '8px',
        marginBottom: '12px'
      }}>
        <LoadInput
          label={label}
          value={value}
          onChange={onChange}
          max={max}
        />
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          marginTop: '8px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📏 Bras de levier:</span>
            <span style={{ fontWeight: '500', color: '#374151' }}>
              {armValue?.toFixed(2) || '0.00'} m
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚖️ Moment:</span>
            <span style={{ fontWeight: '600', color: '#059669' }}>
              {moment} kg.m
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Fonction pour obtenir la limite avant à une masse donnée
  const getForwardLimitAtWeight = (weight) => {
    if (!selectedAircraft) return 0;
    
    const wb = selectedAircraft.weightBalance;
    const forwardVariable = wb.cgLimits.forwardVariable;
    
    if (!forwardVariable || forwardVariable.length === 0) {
      return wb.cgLimits.forward;
    }
    
    // Trier les points par masse
    const sortedPoints = [...forwardVariable].sort((a, b) => a.weight - b.weight);
    
    // Si la masse est en dehors de la plage, utiliser les limites
    if (weight <= sortedPoints[0].weight) {
      return sortedPoints[0].cg;
    }
    if (weight >= sortedPoints[sortedPoints.length - 1].weight) {
      return sortedPoints[sortedPoints.length - 1].cg;
    }
    
    // Interpolation linéaire entre deux points
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      if (weight >= sortedPoints[i].weight && weight <= sortedPoints[i + 1].weight) {
        const ratio = (weight - sortedPoints[i].weight) / (sortedPoints[i + 1].weight - sortedPoints[i].weight);
        return sortedPoints[i].cg + ratio * (sortedPoints[i + 1].cg - sortedPoints[i].cg);
      }
    }
    
    return wb.cgLimits.forward;
  };

  // Échelles pour le graphique
  const getScales = () => {
    if (!selectedAircraft) return null;
    
    const wb = selectedAircraft.weightBalance;
    let cgMin = wb.cgLimits.forward;
    let cgMax = wb.cgLimits.aft;
    
    // Si limites variables, trouver le min et max des CG
    if (wb.cgLimits.forwardVariable && wb.cgLimits.forwardVariable.length > 0) {
      wb.cgLimits.forwardVariable.forEach(point => {
        cgMin = Math.min(cgMin, point.cg);
        cgMax = Math.max(cgMax, point.cg);
      });
    }
    
    const cgRange = cgMax - cgMin;
    cgMin = cgMin - cgRange * 0.1;
    cgMax = cgMax + cgRange * 0.1;
    
    const weightMin = selectedAircraft.emptyWeight - 50;
    const weightMax = selectedAircraft.maxTakeoffWeight + 50;
    
    return {
      cgMin: cgMin * 1000, // Conversion en mm
      cgMax: cgMax * 1000,
      weightMin,
      weightMax
    };
  };

  const scales = getScales();

  // Fonction pour créer l'enveloppe de centrage avec limites variables
  const createEnvelopePoints = () => {
    if (!selectedAircraft || !scales) return '';
    
    const wb = selectedAircraft.weightBalance;
    const minWeight = selectedAircraft.minTakeoffWeight;
    const maxWeight = selectedAircraft.maxTakeoffWeight;
    
    // Vérifier s'il y a des limites avant variables
    const hasForwardVariable = wb.cgLimits.forwardVariable && wb.cgLimits.forwardVariable.length > 0;
    
    if (!hasForwardVariable) {
      // Enveloppe rectangulaire simple
      const points = [
        { weight: minWeight, cg: wb.cgLimits.forward },
        { weight: maxWeight, cg: wb.cgLimits.forward },
        { weight: maxWeight, cg: wb.cgLimits.aft },
        { weight: minWeight, cg: wb.cgLimits.aft },
      ];
      
      return points.map(p => `${50 + (p.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500},${350 - (p.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}`).join(' ');
    }
    
    // Enveloppe avec limites avant variables
    const forwardPoints = [...wb.cgLimits.forwardVariable]
      .sort((a, b) => a.weight - b.weight);
    
    // Ajouter les points extrêmes si nécessaire
    if (forwardPoints[0].weight > minWeight) {
      forwardPoints.unshift({ weight: minWeight, cg: wb.cgLimits.forward });
    }
    if (forwardPoints[forwardPoints.length - 1].weight < maxWeight) {
      forwardPoints.push({ weight: maxWeight, cg: wb.cgLimits.forward });
    }
    
    // Construire l'enveloppe complète
    const envelopePoints = [];
    
    // Côté avant (montée)
    forwardPoints.forEach(p => {
      envelopePoints.push({ weight: p.weight, cg: p.cg });
    });
    
    // Côté arrière (descente)
    envelopePoints.push({ weight: maxWeight, cg: wb.cgLimits.aft });
    envelopePoints.push({ weight: minWeight, cg: wb.cgLimits.aft });
    
    // Convertir en coordonnées SVG
    return envelopePoints.map(p => 
      `${50 + (p.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500},${350 - (p.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}`
    ).join(' ');
  };

  // Calcul du moment total
  const totalMoment = selectedAircraft ? 
    selectedAircraft.emptyWeight * selectedAircraft.weightBalance.emptyWeightArm +
    loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
    loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
    loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
    loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm +
    loads.baggage * selectedAircraft.weightBalance.baggageArm +
    loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm +
    loads.fuel * selectedAircraft.weightBalance.fuelArm : 0;

  // Déterminer si c'est dans les limites
  const isWithinLimits = selectedAircraft ? 
    currentCalculation.cg >= getForwardLimitAtWeight(currentCalculation.totalWeight) && 
    currentCalculation.cg <= selectedAircraft.weightBalance.cgLimits.aft &&
    currentCalculation.totalWeight >= selectedAircraft.minTakeoffWeight &&
    currentCalculation.totalWeight <= selectedAircraft.maxTakeoffWeight : false;

  return (
    <div>
      {/* Panel de chargement et moments */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px' 
        }}>
          ⚖️ Chargement et Moments
        </h3>
        
        <div>
          {/* Masse à vide avec moment */}
          {selectedAircraft && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#e0f2fe', 
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid #0ea5e9'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0c4a6e', marginBottom: '8px' }}>
                ✈️ Masse à vide de base
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Masse:</span>
                  <div style={{ fontWeight: '600', color: '#0c4a6e' }}>
                    {selectedAircraft.emptyWeight} kg
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Bras:</span>
                  <div style={{ fontWeight: '600', color: '#0c4a6e' }}>
                    {selectedAircraft.weightBalance.emptyWeightArm.toFixed(2)} m
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Moment:</span>
                  <div style={{ fontWeight: '600', color: '#0c4a6e' }}>
                    {calculateMoment(selectedAircraft.emptyWeight, selectedAircraft.weightBalance.emptyWeightArm)} kg.m
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sièges avant côte à côte */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <LoadRow
              label="👨‍✈️ Siège avant gauche (Pilote)"
              value={loads.frontLeft}
              onChange={(v) => setLoads({...loads, frontLeft: v})}
              armValue={selectedAircraft?.weightBalance.frontLeftSeatArm}
              armLabel="Siège avant G"
            />
            
            <LoadRow
              label="🧑‍🤝‍🧑 Siège avant droit"
              value={loads.frontRight}
              onChange={(v) => setLoads({...loads, frontRight: v})}
              armValue={selectedAircraft?.weightBalance.frontRightSeatArm}
              armLabel="Siège avant D"
            />
          </div>
          
          {/* Sièges arrière */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <LoadRow
              label="👥 Siège arrière gauche"
              value={loads.rearLeft}
              onChange={(v) => setLoads({...loads, rearLeft: v})}
              armValue={selectedAircraft?.weightBalance.rearLeftSeatArm}
              armLabel="Siège arrière G"
            />
            <LoadRow
              label="👥 Siège arrière droit"
              value={loads.rearRight}
              onChange={(v) => setLoads({...loads, rearRight: v})}
              armValue={selectedAircraft?.weightBalance.rearRightSeatArm}
              armLabel="Siège arrière D"
            />
          </div>
          
          {/* Bagages et auxiliaire */}
          <LoadRow
            label={`🎒 Bagages (max ${selectedAircraft?.maxBaggageWeight || 0} kg)`}
            value={loads.baggage}
            onChange={(v) => setLoads({...loads, baggage: v})}
            max={selectedAircraft?.maxBaggageWeight}
            armValue={selectedAircraft?.weightBalance.baggageArm}
            armLabel="Compartiment bagages"
          />
          
          <LoadRow
            label={`📦 Rangement annexe (max ${selectedAircraft?.maxAuxiliaryWeight || 0} kg)`}
            value={loads.auxiliary}
            onChange={(v) => setLoads({...loads, auxiliary: v})}
            max={selectedAircraft?.maxAuxiliaryWeight}
            armValue={selectedAircraft?.weightBalance.auxiliaryArm}
            armLabel="Rangement auxiliaire"
          />
        </div>

        {/* Section Carburant détaillée */}
        {selectedAircraft && (
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1f2937', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⛽ Scénarios de carburant
            </h4>
            
            {/* Carburant plein */}
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#dbeafe', 
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid #3b82f6'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                🛫 Fuel Mass Fulltank (Réservoirs pleins)
              </div>
              
              {/* Détail des calculs */}
              {(() => {
                // Calcul des masses individuelles
                const emptyWeight = selectedAircraft.emptyWeight;
                const passengersWeight = loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight;
                const baggageWeight = loads.baggage + loads.auxiliary;
                const fuelFullTank = selectedAircraft.fuelCapacity * FUEL_DENSITIES[selectedAircraft.fuelType];
                const totalWithFullTank = emptyWeight + passengersWeight + baggageWeight + fuelFullTank;
                
                // Calcul des moments
                const emptyMoment = emptyWeight * selectedAircraft.weightBalance.emptyWeightArm;
                const passengersMoment = 
                  loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
                  loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
                  loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
                  loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm;
                const baggageMoment = 
                  loads.baggage * selectedAircraft.weightBalance.baggageArm +
                  loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm;
                const fuelMoment = fuelFullTank * selectedAircraft.weightBalance.fuelArm;
                const totalMomentFullTank = emptyMoment + passengersMoment + baggageMoment + fuelMoment;
                
                // CG avec réservoirs pleins
                const cgFullTank = totalMomentFullTank / totalWithFullTank;
                
                return (
                  <>
                    {/* Tableau de calcul détaillé */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '6px', 
                      padding: '8px',
                      marginBottom: '12px',
                      fontSize: '12px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>Masse à vide</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{emptyWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>+ Passagers ({(loads.frontLeft > 0 ? 1 : 0) + (loads.frontRight > 0 ? 1 : 0) + (loads.rearLeft > 0 ? 1 : 0) + (loads.rearRight > 0 ? 1 : 0)} pers.)</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{passengersWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>+ Bagages/Auxiliaire</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{baggageWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '2px solid #3b82f6' }}>
                            <td style={{ padding: '4px', fontWeight: '600', color: '#1e40af' }}>+ Carburant plein ({selectedAircraft.fuelCapacity}L)</td>
                            <td style={{ textAlign: 'right', padding: '4px', fontWeight: '600', color: '#1e40af' }}>{fuelFullTank.toFixed(1)} kg</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 4px', fontWeight: '700', fontSize: '13px' }}>MASSE TOTALE</td>
                            <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: '700', fontSize: '13px', color: totalWithFullTank > selectedAircraft.maxTakeoffWeight ? '#ef4444' : '#065f46' }}>
                              {totalWithFullTank.toFixed(1)} kg
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Vérification MTOW */}
                      {totalWithFullTank > selectedAircraft.maxTakeoffWeight && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '6px', 
                          backgroundColor: '#fef2f2', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#dc2626'
                        }}>
                          ⚠️ Dépassement MTOW de {(totalWithFullTank - selectedAircraft.maxTakeoffWeight).toFixed(1)} kg
                        </div>
                      )}
                    </div>
                    
                    {/* Résultats CG */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>CG résultant:</span>
                        <div style={{ fontWeight: '600', color: '#1e40af' }}>
                          {cgFullTank.toFixed(2)} m
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          ({(cgFullTank * 1000).toFixed(0)} mm)
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Moment total:</span>
                        <div style={{ fontWeight: '600', color: '#1e40af' }}>
                          {totalMomentFullTank.toFixed(0)} kg.m
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Marge MTOW:</span>
                        <div style={{ 
                          fontWeight: '600', 
                          color: totalWithFullTank <= selectedAircraft.maxTakeoffWeight ? '#059669' : '#ef4444' 
                        }}>
                          {(selectedAircraft.maxTakeoffWeight - totalWithFullTank).toFixed(1)} kg
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Carburant au décollage (CRM) */}
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#d1fae5', 
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid #10b981'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#065f46', marginBottom: '8px' }}>
                ✈️ Mass Fuel T/O (Bloc CRM au décollage)
              </div>
              <div style={{ marginBottom: '12px' }}>
                <LoadInput
                  label="Masse carburant au décollage (kg)"
                  value={loads.fuel}
                  onChange={(v) => setLoads({...loads, fuel: v})}
                  max={selectedAircraft.fuelCapacity * FUEL_DENSITIES[selectedAircraft.fuelType]}
                />
              </div>
              
              {/* Détail des calculs */}
              {(() => {
                // Calcul des masses individuelles
                const emptyWeight = selectedAircraft.emptyWeight;
                const passengersWeight = loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight;
                const baggageWeight = loads.baggage + loads.auxiliary;
                const totalAtTakeoff = emptyWeight + passengersWeight + baggageWeight + loads.fuel;
                
                // Calcul des moments
                const emptyMoment = emptyWeight * selectedAircraft.weightBalance.emptyWeightArm;
                const passengersMoment = 
                  loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
                  loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
                  loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
                  loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm;
                const baggageMoment = 
                  loads.baggage * selectedAircraft.weightBalance.baggageArm +
                  loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm;
                const fuelMoment = loads.fuel * selectedAircraft.weightBalance.fuelArm;
                const totalMomentTakeoff = emptyMoment + passengersMoment + baggageMoment + fuelMoment;
                
                // CG au décollage
                const cgTakeoff = totalMomentTakeoff / totalAtTakeoff;
                
                return (
                  <>
                    {/* Tableau de calcul détaillé */}
                    <div style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '6px', 
                      padding: '8px',
                      marginBottom: '12px',
                      fontSize: '12px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>Masse à vide</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{emptyWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>+ Passagers ({(loads.frontLeft > 0 ? 1 : 0) + (loads.frontRight > 0 ? 1 : 0) + (loads.rearLeft > 0 ? 1 : 0) + (loads.rearRight > 0 ? 1 : 0)} pers.)</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{passengersWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '4px' }}>+ Bagages/Auxiliaire</td>
                            <td style={{ textAlign: 'right', padding: '4px' }}>{baggageWeight} kg</td>
                          </tr>
                          <tr style={{ borderBottom: '2px solid #10b981' }}>
                            <td style={{ padding: '4px', fontWeight: '600', color: '#065f46' }}>+ Carburant T/O ({(loads.fuel / FUEL_DENSITIES[selectedAircraft.fuelType || 'AVGAS 100LL']).toFixed(0)}L)</td>
                            <td style={{ textAlign: 'right', padding: '4px', fontWeight: '600', color: '#065f46' }}>{loads.fuel} kg</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 4px', fontWeight: '700', fontSize: '13px' }}>MASSE DÉCOLLAGE</td>
                            <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: '700', fontSize: '13px', color: totalAtTakeoff > selectedAircraft.maxTakeoffWeight ? '#ef4444' : '#065f46' }}>
                              {totalAtTakeoff.toFixed(1)} kg
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Vérification MTOW */}
                      {totalAtTakeoff > selectedAircraft.maxTakeoffWeight && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '6px', 
                          backgroundColor: '#fef2f2', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#dc2626'
                        }}>
                          ⚠️ Dépassement MTOW de {(totalAtTakeoff - selectedAircraft.maxTakeoffWeight).toFixed(1)} kg
                        </div>
                      )}
                      
                      {/* Pourcentage de carburant */}
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '6px', 
                        backgroundColor: '#d1fae5', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#065f46'
                      }}>
                        ℹ️ Carburant : {((loads.fuel / FUEL_DENSITIES[selectedAircraft.fuelType]) / selectedAircraft.fuelCapacity * 100).toFixed(0)}% de la capacité totale
                      </div>
                    </div>
                    
                    {/* Résultats CG */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>CG résultant:</span>
                        <div style={{ fontWeight: '600', color: '#065f46' }}>
                          {cgTakeoff.toFixed(2)} m
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          ({(cgTakeoff * 1000).toFixed(0)} mm)
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Moment total:</span>
                        <div style={{ fontWeight: '600', color: '#065f46' }}>
                          {totalMomentTakeoff.toFixed(0)} kg.m
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Marge MTOW:</span>
                        <div style={{ 
                          fontWeight: '600', 
                          color: totalAtTakeoff <= selectedAircraft.maxTakeoffWeight ? '#059669' : '#ef4444' 
                        }}>
                          {(selectedAircraft.maxTakeoffWeight - totalAtTakeoff).toFixed(1)} kg
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  onClick={() => setLoads({...loads, fuel: Math.round(selectedAircraft.fuelCapacity * FUEL_DENSITIES[selectedAircraft.fuelType])})}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ⛽ Réservoirs pleins
                </button>
                <button
                  onClick={() => {
                    if (navigationResults && selectedAircraft) {
                      const fuelLiters = navigationResults.fuelWithReserve || 0;
                      const fuelMass = fuelLiters * FUEL_DENSITIES[selectedAircraft.fuelType];
                      setLoads({...loads, fuel: Math.round(fuelMass)});
                    }
                  }}
                  disabled={!navigationResults}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: navigationResults ? '#10b981' : '#e5e7eb',
                    color: navigationResults ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: navigationResults ? 'pointer' : 'not-allowed'
                  }}
                >
                  📊 Selon navigation
                </button>
              </div>
            </div>

            {/* Carburant minimum à l'atterrissage */}
            {navigationResults && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fef3c7', 
                borderRadius: '8px',
                marginBottom: '12px',
                border: '1px solid #f59e0b'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                  🛬 Minimum Mass Fuel LDG (CRM - Bilan Carb)
                </div>
                
                {/* Détail des calculs */}
                {(() => {
                  // Calcul des masses individuelles
                  const emptyWeight = selectedAircraft.emptyWeight;
                  const passengersWeight = loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight;
                  const baggageWeight = loads.baggage + loads.auxiliary;
                  const fuelReserve = navigationResults.regulationReserveLiters * FUEL_DENSITIES[selectedAircraft.fuelType];
                  const totalAtLanding = emptyWeight + passengersWeight + baggageWeight + fuelReserve;
                  
                  // Calcul des moments
                  const emptyMoment = emptyWeight * selectedAircraft.weightBalance.emptyWeightArm;
                  const passengersMoment = 
                    loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
                    loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
                    loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
                    loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm;
                  const baggageMoment = 
                    loads.baggage * selectedAircraft.weightBalance.baggageArm +
                    loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm;
                  const fuelMoment = fuelReserve * selectedAircraft.weightBalance.fuelArm;
                  const totalMomentLanding = emptyMoment + passengersMoment + baggageMoment + fuelMoment;
                  
                  // CG à l'atterrissage
                  const cgLanding = totalMomentLanding / totalAtLanding;
                  
                  // Carburant consommé
                  const fuelConsumed = loads.fuel - fuelReserve;
                  
                  return (
                    <>
                      {/* Tableau de calcul détaillé */}
                      <div style={{ 
                        backgroundColor: 'white', 
                        borderRadius: '6px', 
                        padding: '8px',
                        marginBottom: '12px',
                        fontSize: '12px'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '4px' }}>Masse à vide</td>
                              <td style={{ textAlign: 'right', padding: '4px' }}>{emptyWeight} kg</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '4px' }}>+ Passagers ({(loads.frontLeft > 0 ? 1 : 0) + (loads.frontRight > 0 ? 1 : 0) + (loads.rearLeft > 0 ? 1 : 0) + (loads.rearRight > 0 ? 1 : 0)} pers.)</td>
                              <td style={{ textAlign: 'right', padding: '4px' }}>{passengersWeight} kg</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '4px' }}>+ Bagages/Auxiliaire</td>
                              <td style={{ textAlign: 'right', padding: '4px' }}>{baggageWeight} kg</td>
                            </tr>
                            <tr style={{ borderBottom: '2px solid #f59e0b' }}>
                              <td style={{ padding: '4px', fontWeight: '600', color: '#92400e' }}>+ Réserve finale ({navigationResults.regulationReserveLiters}L)</td>
                              <td style={{ textAlign: 'right', padding: '4px', fontWeight: '600', color: '#92400e' }}>{fuelReserve.toFixed(1)} kg</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '6px 4px', fontWeight: '700', fontSize: '13px' }}>MASSE ATTERRISSAGE</td>
                              <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: '700', fontSize: '13px', color: totalAtLanding > selectedAircraft.maxLandingWeight ? '#ef4444' : '#065f46' }}>
                                {totalAtLanding.toFixed(1)} kg
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        
                        {/* Vérification MLW */}
                        {totalAtLanding > selectedAircraft.maxLandingWeight && (
                          <div style={{ 
                            marginTop: '8px', 
                            padding: '6px', 
                            backgroundColor: '#fef2f2', 
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#dc2626'
                          }}>
                            ⚠️ Dépassement MLW de {(totalAtLanding - selectedAircraft.maxLandingWeight).toFixed(1)} kg
                          </div>
                        )}
                        
                        {/* Info carburant consommé */}
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '6px', 
                          backgroundColor: '#fef3c7', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#78350f'
                        }}>
                          ℹ️ Carburant consommé en vol : {fuelConsumed.toFixed(1)} kg ({(fuelConsumed / FUEL_DENSITIES[selectedAircraft.fuelType]).toFixed(0)} L)
                        </div>
                      </div>
                      
                      {/* Résultats CG */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>CG résultant:</span>
                          <div style={{ fontWeight: '600', color: '#92400e' }}>
                            {cgLanding.toFixed(2)} m
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            ({(cgLanding * 1000).toFixed(0)} mm)
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Moment total:</span>
                          <div style={{ fontWeight: '600', color: '#92400e' }}>
                            {totalMomentLanding.toFixed(0)} kg.m
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Marge MLW:</span>
                          <div style={{ 
                            fontWeight: '600', 
                            color: totalAtLanding <= selectedAircraft.maxLandingWeight ? '#059669' : '#ef4444' 
                          }}>
                            {(selectedAircraft.maxLandingWeight - totalAtLanding).toFixed(1)} kg
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Note d'information */}
            <div style={{ 
              padding: '12px',
              backgroundColor: '#e0f2fe',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c4a6e'
            }}>
              <p style={{ margin: '0', fontWeight: '600' }}>
                💡 Information carburant :
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                • Densité {selectedAircraft.fuelType} : {FUEL_DENSITIES[selectedAircraft.fuelType]} kg/L<br/>
                • Capacité totale : {selectedAircraft.fuelCapacity} L = {(selectedAircraft.fuelCapacity * FUEL_DENSITIES[selectedAircraft.fuelType]).toFixed(1)} kg<br/>
                • Le bras de levier du carburant est constant : {selectedAircraft.weightBalance.fuelArm} m<br/>
                • <strong>Fulltank</strong> : Configuration réservoirs pleins<br/>
                • <strong>T/O (CRM)</strong> : Carburant réel au décollage selon votre planification<br/>
                • <strong>LDG minimum</strong> : Réserve finale réglementaire à l'atterrissage
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tableau récapitulatif des moments */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: '#f9fafb', 
          borderRadius: '8px', 
          padding: '16px'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            📐 Récapitulatif des moments
          </h4>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#6b7280' }}>Élément</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Masse (kg)</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Bras (m)</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280' }}>Moment (kg.m)</th>
              </tr>
            </thead>
            <tbody>
              {selectedAircraft && (
                <>
                  <tr>
                    <td style={{ padding: '6px 0' }}>Masse à vide</td>
                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.emptyWeight}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.emptyWeightArm.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                      {calculateMoment(selectedAircraft.emptyWeight, selectedAircraft.weightBalance.emptyWeightArm)}
                    </td>
                  </tr>
                  {loads.frontLeft > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Pilote</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.frontLeft}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.frontLeftSeatArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.frontLeft, selectedAircraft.weightBalance.frontLeftSeatArm)}
                      </td>
                    </tr>
                  )}
                  {loads.frontRight > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Passager avant</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.frontRight}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.frontRightSeatArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.frontRight, selectedAircraft.weightBalance.frontRightSeatArm)}
                      </td>
                    </tr>
                  )}
                  {loads.rearLeft > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Passager arrière gauche</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.rearLeft}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.rearLeftSeatArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.rearLeft, selectedAircraft.weightBalance.rearLeftSeatArm)}
                      </td>
                    </tr>
                  )}
                  {loads.rearRight > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Passager arrière droit</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.rearRight}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.rearRightSeatArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.rearRight, selectedAircraft.weightBalance.rearRightSeatArm)}
                      </td>
                    </tr>
                  )}
                  {loads.baggage > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Bagages</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.baggage}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.baggageArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.baggage, selectedAircraft.weightBalance.baggageArm)}
                      </td>
                    </tr>
                  )}
                  {loads.auxiliary > 0 && (
                    <tr>
                      <td style={{ padding: '6px 0' }}>Rangement auxiliaire</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{loads.auxiliary}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{selectedAircraft.weightBalance.auxiliaryArm.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '500' }}>
                        {calculateMoment(loads.auxiliary, selectedAircraft.weightBalance.auxiliaryArm)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 0', fontWeight: '600', color: '#059669' }}>Carburant T/O</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>{loads.fuel}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>{selectedAircraft.weightBalance.fuelArm.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#059669' }}>
                      {calculateMoment(loads.fuel, selectedAircraft.weightBalance.fuelArm)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #374151' }}>
                <td style={{ padding: '8px 0', fontWeight: '600' }}>TOTAL</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600' }}>
                  {currentCalculation.totalWeight?.toFixed(1) || 0}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600' }}>
                  {currentCalculation.cg?.toFixed(2) || 0}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: '600', color: '#059669' }}>
                  {totalMoment.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
          
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            backgroundColor: '#e0f2fe', 
            borderRadius: '4px', 
            fontSize: '12px', 
            color: '#0c4a6e' 
          }}>
            <p style={{ margin: '0', fontWeight: '600' }}>
              💡 Formule du Centre de Gravité:
            </p>
            <p style={{ margin: '4px 0 0 0' }}>
              CG = Moment total ÷ Masse totale = {totalMoment.toFixed(1)} ÷ {currentCalculation.totalWeight?.toFixed(1) || 1} = {currentCalculation.cg?.toFixed(3) || 0} m
            </p>
          </div>
        </div>
      </div>

      {/* Panel des résultats et calculs */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px' 
        }}>
          📊 Résultats et Calculs
        </h3>
        
        {/* Statut général */}
        <div style={{ 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '16px',
          backgroundColor: isWithinLimits ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${isWithinLimits ? '#10b981' : '#ef4444'}`
        }}>
          <p style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            margin: '0',
            color: isWithinLimits ? '#065f46' : '#dc2626'
          }}>
            {isWithinLimits ? '✅ Dans les limites' : '❌ Hors limites'}
          </p>
        </div>

        {/* Détails des calculs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Masse totale</span>
              <span style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: currentCalculation.totalWeight > (selectedAircraft?.maxTakeoffWeight || 0) ? '#ef4444' : '#1f2937'
              }}>
                {currentCalculation.totalWeight?.toFixed(1) || 0} kg
              </span>
            </div>
          </div>
          
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Centre de gravité</span>
              <span style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: (selectedAircraft && (currentCalculation.cg < selectedAircraft.weightBalance.cgLimits.forward || 
                       currentCalculation.cg > selectedAircraft.weightBalance.cgLimits.aft)) ? '#ef4444' : '#1f2937'
              }}>
                {currentCalculation.cg?.toFixed(2) || 0} m
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>
              ({(currentCalculation.cg * 1000)?.toFixed(0) || 0} mm)
            </div>
          </div>
        </div>

        {/* Scénarios de centrage */}
        {selectedAircraft && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1f2937', 
              marginBottom: '12px' 
            }}>
              🔄 Scénarios de centrage
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {/* Scénario actuel */}
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#dbeafe', 
                borderRadius: '6px',
                border: '1px solid #3b82f6'
              }}>
                <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                  Configuration actuelle
                </h5>
                <div style={{ fontSize: '12px', color: '#1e40af' }}>
                  <p style={{ margin: '0 0 4px 0' }}>
                    Masse: <strong>{currentCalculation.totalWeight.toFixed(0)} kg</strong>
                  </p>
                  <p style={{ margin: '0 0 4px 0' }}>
                    CG: <strong>{currentCalculation.cg.toFixed(2)} m</strong>
                  </p>
                  <p style={{ margin: '0' }}>
                    Carburant: <strong>{loads.fuel} kg</strong>
                  </p>
                </div>
              </div>

              {/* Scénario sans carburant */}
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fee2e2', 
                borderRadius: '6px',
                border: '1px solid #ef4444'
              }}>
                <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
                  Sans carburant (ZFW)
                </h5>
                {(() => {
                  const zfWeight = currentCalculation.totalWeight - loads.fuel;
                  const zfMoment = totalMoment - (loads.fuel * selectedAircraft.weightBalance.fuelArm);
                  const zfCG = zfWeight > 0 ? zfMoment / zfWeight : 0;
                  
                  return (
                    <div style={{ fontSize: '12px', color: '#dc2626' }}>
                      <p style={{ margin: '0 0 4px 0' }}>
                        Masse: <strong>{zfWeight.toFixed(0)} kg</strong>
                      </p>
                      <p style={{ margin: '0 0 4px 0' }}>
                        CG: <strong>{zfCG.toFixed(2)} m</strong>
                      </p>
                      <p style={{ margin: '0' }}>
                        Moment: <strong>{zfMoment.toFixed(0)} kg.m</strong>
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Scénario réserve minimum */}
              {navigationResults && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#fef3c7', 
                  borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                    À la réserve finale
                  </h5>
                  {(() => {
                    const reserveFuel = navigationResults.regulationReserveLiters * FUEL_DENSITIES[selectedAircraft.fuelType];
                    const ldgWeight = currentCalculation.totalWeight - loads.fuel + reserveFuel;
                    const ldgMoment = totalMoment - (loads.fuel * selectedAircraft.weightBalance.fuelArm) + 
                                     (reserveFuel * selectedAircraft.weightBalance.fuelArm);
                    const ldgCG = ldgWeight > 0 ? ldgMoment / ldgWeight : 0;
                    
                    return (
                      <div style={{ fontSize: '12px', color: '#92400e' }}>
                        <p style={{ margin: '0 0 4px 0' }}>
                          Masse: <strong>{ldgWeight.toFixed(0)} kg</strong>
                        </p>
                        <p style={{ margin: '0 0 4px 0' }}>
                          CG: <strong>{ldgCG.toFixed(2)} m</strong>
                        </p>
                        <p style={{ margin: '0' }}>
                          Carburant: <strong>{reserveFuel.toFixed(0)} kg</strong>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Limites */}
        {selectedAircraft && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px' 
          }}>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              📏 Limites CG:
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span>
                Avant: {selectedAircraft.weightBalance.cgLimits.forwardVariable?.length > 0 ? (
                  <>
                    <span style={{ color: '#3b82f6', fontWeight: '600' }}>Variable</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}> (actuellement {getForwardLimitAtWeight(currentCalculation.totalWeight).toFixed(2)}m)</span>
                  </>
                ) : (
                  <>{selectedAircraft.weightBalance.cgLimits.forward} m ({(selectedAircraft.weightBalance.cgLimits.forward * 1000).toFixed(0)} mm)</>
                )}
              </span>
              <span>Arrière: {selectedAircraft.weightBalance.cgLimits.aft} m ({(selectedAircraft.weightBalance.cgLimits.aft * 1000).toFixed(0)} mm)</span>
            </div>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', marginBottom: '0' }}>
              🏋️ MTOW: {selectedAircraft.maxTakeoffWeight} kg | Min TO: {selectedAircraft.minTakeoffWeight} kg
            </p>
          </div>
        )}
      </div>

      {/* Aperçu enveloppe de centrage */}
      <div style={{ marginTop: '32px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px' 
        }}>
          📈 Enveloppe de centrage
        </h3>
        
        {selectedAircraft && scales ? (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '24px'
          }}>
            <svg
              viewBox="0 0 600 400"
              style={{ width: '100%', maxWidth: '800px', height: 'auto', margin: '0 auto', display: 'block' }}
            >
              {/* Grille de fond */}
              <defs>
                <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="600" height="400" fill="url(#grid)" />
              
              {/* Axes */}
              <line x1="50" y1="350" x2="550" y2="350" stroke="#374151" strokeWidth="2" />
              <line x1="50" y1="50" x2="50" y2="350" stroke="#374151" strokeWidth="2" />
              
              {/* Flèches des axes */}
              <path d="M 545 345 L 550 350 L 545 355" fill="none" stroke="#374151" strokeWidth="2" />
              <path d="M 45 55 L 50 50 L 55 55" fill="none" stroke="#374151" strokeWidth="2" />
              
              {/* Labels des axes */}
              <text x="300" y="390" textAnchor="middle" fontSize="14" fill="#374151">
                Centre de Gravité (mm)
              </text>
              <text x="25" y="200" textAnchor="middle" fontSize="14" fill="#374151" transform="rotate(-90 25 200)">
                Masse (kg)
              </text>
              
              {/* Échelle X (CG) */}
              {[0, 1, 2, 3, 4].map(i => {
                const cgValue = scales.cgMin + (scales.cgMax - scales.cgMin) * i / 4;
                const x = 50 + (500 * i / 4);
                return (
                  <g key={`x-${i}`}>
                    <line x1={x} y1="345" x2={x} y2="355" stroke="#374151" strokeWidth="1" />
                    <text x={x} y="370" textAnchor="middle" fontSize="12" fill="#6b7280">
                      {cgValue.toFixed(0)}
                    </text>
                  </g>
                );
              })}
              
              {/* Échelle Y (Masse) */}
              {[0, 1, 2, 3, 4].map(i => {
                const weightValue = scales.weightMin + (scales.weightMax - scales.weightMin) * i / 4;
                const y = 350 - (300 * i / 4);
                return (
                  <g key={`y-${i}`}>
                    <line x1="45" y1={y} x2="55" y2={y} stroke="#374151" strokeWidth="1" />
                    <text x="35" y={y + 5} textAnchor="end" fontSize="12" fill="#6b7280">
                      {weightValue.toFixed(0)}
                    </text>
                  </g>
                );
              })}
              
              {/* Enveloppe de centrage */}
              <polygon
                points={createEnvelopePoints()}
                fill="#dbeafe"
                fillOpacity="0.5"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              
              {/* Points limites de l'enveloppe avec labels */}
              {selectedAircraft.weightBalance.cgLimits.forward && selectedAircraft.weightBalance.cgLimits.aft && (
                <>
                  {/* Points de limite avant - peuvent être multiples si limites variables */}
                  {(() => {
                    const wb = selectedAircraft.weightBalance;
                    const forwardPoints = [];
                    
                    if (wb.cgLimits.forwardVariable && wb.cgLimits.forwardVariable.length > 0) {
                      // Ajouter tous les points variables
                      const sortedPoints = [...wb.cgLimits.forwardVariable].sort((a, b) => a.weight - b.weight);
                      
                      // Ajouter le point min si nécessaire
                      if (sortedPoints[0].weight > selectedAircraft.minTakeoffWeight) {
                        forwardPoints.push({ weight: selectedAircraft.minTakeoffWeight, cg: wb.cgLimits.forward });
                      }
                      
                      // Ajouter tous les points variables
                      forwardPoints.push(...sortedPoints);
                      
                      // Ajouter le point max si nécessaire
                      if (sortedPoints[sortedPoints.length - 1].weight < selectedAircraft.maxTakeoffWeight) {
                        forwardPoints.push({ weight: selectedAircraft.maxTakeoffWeight, cg: wb.cgLimits.forward });
                      }
                    } else {
                      // Enveloppe rectangulaire simple
                      forwardPoints.push(
                        { weight: selectedAircraft.minTakeoffWeight, cg: wb.cgLimits.forward },
                        { weight: selectedAircraft.maxTakeoffWeight, cg: wb.cgLimits.forward }
                      );
                    }
                    
                    return forwardPoints.map((point, index) => (
                      <g key={`forward-${index}`}>
                        <circle
                          cx={50 + (point.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                          cy={350 - (point.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                          r="5"
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <rect
                          x={50 + (point.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 - 50}
                          y={350 - (point.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 25}
                          width="45"
                          height="30"
                          fill="white"
                          fillOpacity="0.9"
                          rx="3"
                        />
                        <text
                          x={50 + (point.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 - 28}
                          y={350 - (point.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 8}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#1e40af"
                          fontWeight="600"
                        >
                          {point.weight}kg
                        </text>
                        <text
                          x={50 + (point.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 - 28}
                          y={350 - (point.weight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 6}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#1e40af"
                          fontWeight="600"
                        >
                          {(point.cg * 1000).toFixed(0)}mm
                        </text>
                      </g>
                    ));
                  })()}
                  
                  {/* Points de limite arrière - toujours seulement deux */}
                  <g>
                    <circle
                      cx={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                      cy={350 - (selectedAircraft.minTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                      r="5"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <rect
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 5}
                      y={350 - (selectedAircraft.minTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 25}
                      width="45"
                      height="30"
                      fill="white"
                      fillOpacity="0.9"
                      rx="3"
                    />
                    <text
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 28}
                      y={350 - (selectedAircraft.minTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#1e40af"
                      fontWeight="600"
                    >
                      {selectedAircraft.minTakeoffWeight}kg
                    </text>
                    <text
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 28}
                      y={350 - (selectedAircraft.minTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 6}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#1e40af"
                      fontWeight="600"
                    >
                      {(selectedAircraft.weightBalance.cgLimits.aft * 1000).toFixed(0)}mm
                    </text>
                  </g>
                  
                  <g>
                    <circle
                      cx={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                      cy={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                      r="5"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                    <rect
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 5}
                      y={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 5}
                      width="45"
                      height="30"
                      fill="white"
                      fillOpacity="0.9"
                      rx="3"
                    />
                    <text
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 28}
                      y={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 22}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#1e40af"
                      fontWeight="600"
                    >
                      {selectedAircraft.maxTakeoffWeight}kg
                    </text>
                    <text
                      x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 + 28}
                      y={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 36}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#1e40af"
                      fontWeight="600"
                    >
                      {(selectedAircraft.weightBalance.cgLimits.aft * 1000).toFixed(0)}mm
                    </text>
                  </g>
                </>
              )}
              
              {/* Ligne masse maximale */}
              <line
                x1="50"
                y1={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                x2="550"
                y2={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              <text
                x="555"
                y={350 - (selectedAircraft.maxTakeoffWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 5}
                fontSize="12"
                fill="#ef4444"
              >
                MTOW
              </text>
              
              {/* Lignes verticales CG limites - seulement si pas de limites variables */}
              {selectedAircraft.weightBalance.cgLimits.forward && selectedAircraft.weightBalance.cgLimits.aft && 
               (!selectedAircraft.weightBalance.cgLimits.forwardVariable || selectedAircraft.weightBalance.cgLimits.forwardVariable.length === 0) && (
                <>
                  {/* Ligne CG avant */}
                  <line
                    x1={50 + (selectedAircraft.weightBalance.cgLimits.forward * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y1="70"
                    x2={50 + (selectedAircraft.weightBalance.cgLimits.forward * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y2="350"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.5"
                  />
                  <text
                    x={50 + (selectedAircraft.weightBalance.cgLimits.forward * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y="60"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#3b82f6"
                  >
                    CG avant
                  </text>
                </>
              )}
              
              {/* Ligne CG arrière - toujours affichée */}
              {selectedAircraft.weightBalance.cgLimits.aft && (
                <>
                  <line
                    x1={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y1="70"
                    x2={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y2="350"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.5"
                  />
                  <text
                    x={50 + (selectedAircraft.weightBalance.cgLimits.aft * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y="60"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#3b82f6"
                  >
                    CG arrière
                  </text>
                </>
              )}
              
              {/* Point actuel */}
              {currentCalculation.cg && currentCalculation.totalWeight && (
                <g>
                  {/* Fond blanc pour les labels */}
                  <rect
                    x={50 + (currentCalculation.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 - 35}
                    y={350 - (currentCalculation.totalWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 35}
                    width="70"
                    height="30"
                    fill="white"
                    fillOpacity="0.95"
                    rx="4"
                  />
                  <rect
                    x={50 + (currentCalculation.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500 - 35}
                    y={350 - (currentCalculation.totalWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 12}
                    width="70"
                    height="20"
                    fill="white"
                    fillOpacity="0.95"
                    rx="4"
                  />
                  
                  {/* Point actuel */}
                  <circle
                    cx={50 + (currentCalculation.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    cy={350 - (currentCalculation.totalWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300}
                    r="10"
                    fill={isWithinLimits ? '#10b981' : '#ef4444'}
                    stroke="white"
                    strokeWidth="3"
                  />
                  
                  {/* Labels */}
                  <text
                    x={50 + (currentCalculation.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y={350 - (currentCalculation.totalWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 - 15}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="bold"
                    fill={isWithinLimits ? '#065f46' : '#dc2626'}
                  >
                    {currentCalculation.totalWeight.toFixed(0)} kg
                  </text>
                  <text
                    x={50 + (currentCalculation.cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500}
                    y={350 - (currentCalculation.totalWeight - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300 + 25}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="bold"
                    fill={isWithinLimits ? '#065f46' : '#dc2626'}
                  >
                    {(currentCalculation.cg * 1000).toFixed(0)} mm
                  </text>
                </g>
              )}
              
              {/* Zone de titre du graphique */}
              <text x="300" y="25" textAnchor="middle" fontSize="16" fontWeight="600" fill="#1f2937">
                Diagramme de Masse et Centrage
              </text>
              <text x="300" y="45" textAnchor="middle" fontSize="13" fill="#6b7280">
                {selectedAircraft.registration} - {selectedAircraft.model}
              </text>
            </svg>
            
            {/* Informations supplémentaires */}
            <div style={{ 
              marginTop: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '16px'
            }}>
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '6px'
              }}>
                <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                  💡 Guide de lecture du graphique
                </h5>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    • Les <span style={{ color: '#3b82f6', fontWeight: '600' }}>points bleus avec étiquettes blanches</span> indiquent les limites de l'enveloppe autorisée (masse en kg, CG en mm)
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    • Le <span style={{ color: '#10b981', fontWeight: '600' }}>point vert</span> représente la position actuelle de votre avion selon le chargement
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    • Le <span style={{ color: '#ef4444', fontWeight: '600' }}>point rouge</span> indique un dépassement des limites de centrage ou de masse
                  </p>
                  {selectedAircraft?.weightBalance?.cgLimits?.forwardVariable?.length > 0 ? (
                    <p style={{ margin: '0 0 8px 0' }}>
                      • L'<span style={{ color: '#3b82f6', fontWeight: '600' }}>enveloppe bleue non rectangulaire</span> montre des limites avant variables selon la masse
                    </p>
                  ) : (
                    <p style={{ margin: '0 0 8px 0' }}>
                      • Les <span style={{ color: '#3b82f6', fontWeight: '600' }}>lignes verticales pointillées</span> marquent les limites CG avant et arrière
                    </p>
                  )}
                  <p style={{ margin: '0' }}>
                    • La <span style={{ color: '#ef4444', fontWeight: '600' }}>ligne horizontale rouge pointillée</span> indique la masse maximale au décollage (MTOW)
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ 
            padding: '32px', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#6b7280' }}>
              Sélectionnez un avion pour afficher l'enveloppe de centrage
            </p>
          </div>
        )}
      </div>
    </div>
  );
};