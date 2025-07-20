import React from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { LoadInput } from '../../../components/ui/LoadInput';

export const WeightBalanceModule = () => {
  const { 
    selectedAircraft,
    loads, 
    setLoads, 
    navigationResults,
    currentCalculation,
    isWithinLimits
  } = useFlightSystem();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Panel de chargement */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '16px' 
          }}>
            ⚖️ Chargement
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <LoadInput
              label="👨‍✈️ Siège avant gauche (Pilote)"
              value={loads.frontLeft}
              onChange={(v) => setLoads({...loads, frontLeft: v})}
            />
            <LoadInput
              label="🧑‍🤝‍🧑 Siège avant droit"
              value={loads.frontRight}
              onChange={(v) => setLoads({...loads, frontRight: v})}
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <LoadInput
                label="👥 Siège arrière gauche"
                value={loads.rearLeft}
                onChange={(v) => setLoads({...loads, rearLeft: v})}
              />
              <LoadInput
                label="👥 Siège arrière droit"
                value={loads.rearRight}
                onChange={(v) => setLoads({...loads, rearRight: v})}
              />
            </div>
            
            <LoadInput
              label={`🎒 Bagages (max ${selectedAircraft?.maxBaggageWeight || 0} kg)`}
              value={loads.baggage}
              onChange={(v) => setLoads({...loads, baggage: v})}
              max={selectedAircraft?.maxBaggageWeight}
            />
            <LoadInput
              label={`📦 Rangement annexe (max ${selectedAircraft?.maxAuxiliaryWeight || 0} kg)`}
              value={loads.auxiliary}
              onChange={(v) => setLoads({...loads, auxiliary: v})}
              max={selectedAircraft?.maxAuxiliaryWeight}
            />
          </div>
        </div>
        
        {/* Panel des résultats */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937', 
            marginBottom: '16px' 
          }}>
            📊 Résultats
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span style={{ color: '#6b7280' }}>Masse à vide</span>
              <span style={{ fontWeight: '500' }}>{selectedAircraft?.emptyWeight || 0} kg</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span style={{ color: '#6b7280' }}>Charge utile</span>
              <span style={{ fontWeight: '500' }}>
                {(loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight + loads.baggage + loads.auxiliary).toFixed(1)} kg
              </span>
            </div>
            
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: '600' }}>Masse totale</span>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold',
                  color: currentCalculation.totalWeight > (selectedAircraft?.maxTakeoffWeight || 0) ? '#ef4444' : '#1f2937'
                }}>
                  {currentCalculation.totalWeight?.toFixed(1) || 0} kg
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: '500' }}>Centre de gravité</span>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: (selectedAircraft && (currentCalculation.cg < selectedAircraft.weightBalance.cgLimits.forward || 
                         currentCalculation.cg > selectedAircraft.weightBalance.cgLimits.aft)) ? '#ef4444' : '#1f2937'
                }}>
                  {currentCalculation.cg?.toFixed(2) || 0} m
                </span>
              </div>
            </div>
          </div>
          
          {/* Limites */}
          {selectedAircraft && (
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px' 
            }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                📏 Limites CG:
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span>Avant: {selectedAircraft.weightBalance.cgLimits.forward} m</span>
                <span>Arrière: {selectedAircraft.weightBalance.cgLimits.aft} m</span>
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', marginBottom: '0' }}>
                🏋️ MTOW: {selectedAircraft.maxTakeoffWeight} kg
              </p>
            </div>
          )}
        </div>
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
        <div style={{ 
          padding: '32px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            Visualisation graphique
          </h4>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            CG actuel: {currentCalculation.cg?.toFixed(2) || 0} m
          </p>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Masse actuelle: {currentCalculation.totalWeight?.toFixed(1) || 0} kg
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '0' }}>
            (Graphique SVG à implémenter dans une version future)
          </p>
        </div>
      </div>
    </div>
  );
};
