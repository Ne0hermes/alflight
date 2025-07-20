import React, { useState } from 'react';
import { Fuel, Calculator, Plane, Clock, Navigation } from 'lucide-react';
import { useFlightSystem } from '../../../context/FlightSystemContext';

export const FuelBalanceModule = () => {
  // Récupération de l'avion sélectionné depuis le contexte
  const { selectedAircraft } = useFlightSystem();
  
  // Valeurs par défaut réalistes pour un vol type
  const defaultValues = {
    roulage: { gal: 1.0, ltr: 3.8 },
    trip: { gal: 0, ltr: 0 },
    contingency: { gal: 1, ltr: 3.8 },
    alternate: { gal: 2.0, ltr: 7.6 },
    finalReserve: { gal: 0, ltr: 0 },
    additional: { gal: 0, ltr: 0 },
    extra: { gal: 0, ltr: 0 }
  };

  const [fuelData, setFuelData] = useState(defaultValues);

  // Facteur de conversion: 1 gallon US = 3.78541 litres
  const GAL_TO_LTR = 3.78541;

  const convertValue = (value, fromUnit) => {
    if (fromUnit === 'gal') {
      return value * GAL_TO_LTR;
    } else {
      return value / GAL_TO_LTR;
    }
  };

  const handleInputChange = (fuelType, inputUnit, value) => {
    const numValue = parseFloat(value) || 0;
    
    setFuelData(prev => ({
      ...prev,
      [fuelType]: {
        [inputUnit]: numValue,
        [inputUnit === 'gal' ? 'ltr' : 'gal']: convertValue(numValue, inputUnit)
      }
    }));
  };

  const calculateTotal = (unit) => {
    return Object.values(fuelData).reduce((total, fuel) => total + fuel[unit], 0);
  };

  // Calcul du temps de vol en heures basé sur la consommation
  const calculateFlightTime = (liters) => {
    if (!selectedAircraft || selectedAircraft.fuelConsumption === 0) return 0;
    return liters / selectedAircraft.fuelConsumption;
  };

  // Calcul de la distance théorique en Nm
  const calculateDistance = (liters) => {
    if (!selectedAircraft) return 0;
    const hours = calculateFlightTime(liters);
    return hours * selectedAircraft.cruiseSpeedKt;
  };

  // Formatage du temps en heures et minutes
  const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente', color: '#dbeafe' },
    { key: 'trip', label: 'Trip Fuel', description: 'Trajet prévu', color: '#d1fae5' },
    { key: 'contingency', label: 'Contingency Fuel', description: '5% du trip fuel', color: '#fef3c7' },
    { key: 'alternate', label: 'Alternate Fuel', description: 'Vers aérodrome de dégagement', color: '#fed7aa' },
    { key: 'finalReserve', label: 'Final Reserve', description: '30 min VFR / 45 min IFR', color: '#fee2e2' },
    { key: 'additional', label: 'Additional Fuel', description: 'Météo, ATC, etc.', color: '#e9d5ff' },
    { key: 'extra', label: 'Extra Fuel', description: 'À la discrétion du pilote', color: '#fce7f3' }
  ];

  // Fonctions pour réinitialiser les valeurs
  const resetToDefault = () => {
    setFuelData(defaultValues);
  };

  const clearAll = () => {
    setFuelData({
      roulage: { gal: 0, ltr: 0 },
      trip: { gal: 0, ltr: 0 },
      contingency: { gal: 0, ltr: 0 },
      alternate: { gal: 0, ltr: 0 },
      finalReserve: { gal: 0, ltr: 0 },
      additional: { gal: 0, ltr: 0 },
      extra: { gal: 0, ltr: 0 }
    });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      {/* Alerte si aucun avion sélectionné */}
      {!selectedAircraft && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          backgroundColor: '#fef2f2', 
          border: '2px solid #ef4444', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '16px' }}>⚠</span>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', margin: '0 0 4px 0' }}>
              Aucun avion sélectionné
            </h3>
            <p style={{ fontSize: '14px', color: '#dc2626', margin: '0' }}>
              Veuillez sélectionner un avion dans l'onglet "Navigation" ou "Gestion Avions" pour voir les calculs de temps de vol et de distance.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#2563eb', padding: '12px', borderRadius: '50%' }}>
            <Fuel style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '0' }}>Bilan Carburant</h1>
            <p style={{ color: '#6b7280', margin: '0' }}>Calcul et gestion des réserves de carburant</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {selectedAircraft ? (
            <>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                {selectedAircraft.registration} - {selectedAircraft.model}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                Conso: {selectedAircraft.fuelConsumption} L/h | Vitesse: {selectedAircraft.cruiseSpeedKt} kt
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>
                Total: {calculateTotal('gal').toFixed(1)} Gal / {calculateTotal('ltr').toFixed(1)} L
              </div>
            </>
          ) : (
            <div style={{ fontSize: '14px', color: '#ef4444' }}>
              ⚠️ Aucun avion sélectionné
            </div>
          )}
        </div>
      </div>

      {/* Main Fuel Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(to right, #2563eb, #1d4ed8)', color: 'white' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Type de Carburant
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gallons
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Litres
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Temps vol
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Distance
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                %
              </th>
            </tr>
          </thead>
          <tbody style={{ borderTop: '1px solid #e5e7eb' }}>
            {fuelTypes.map((fuelType, index) => {
              const percentage = calculateTotal('gal') > 0 
                ? (fuelData[fuelType.key].gal / calculateTotal('gal') * 100).toFixed(1)
                : '0.0';
              const flightTime = calculateFlightTime(fuelData[fuelType.key].ltr);
              const distance = calculateDistance(fuelData[fuelType.key].ltr);
              
              return (
                <tr key={fuelType.key} style={{ backgroundColor: fuelType.color, transition: 'background-color 0.3s' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        marginRight: '12px',
                        backgroundColor: index === 0 ? '#60a5fa' :
                                       index === 1 ? '#34d399' :
                                       index === 2 ? '#fbbf24' :
                                       index === 3 ? '#fb923c' :
                                       index === 4 ? '#f87171' :
                                       index === 5 ? '#a78bfa' : '#f9a8d4'
                      }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center' }}>
                        <Plane style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span>{fuelType.label}</span>
                          <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280' }}>{fuelType.description}</span>
                        </div>
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <input
                      type="number"
                      step="0.1"
                      value={fuelData[fuelType.key].gal.toFixed(1)}
                      onChange={(e) => handleInputChange(fuelType.key, 'gal', e.target.value)}
                      style={{ 
                        width: '80px', 
                        padding: '8px 12px', 
                        textAlign: 'center', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px', 
                        backgroundColor: 'white' 
                      }}
                      placeholder="0.0"
                    />
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <input
                      type="number"
                      step="0.1"
                      value={fuelData[fuelType.key].ltr.toFixed(1)}
                      onChange={(e) => handleInputChange(fuelType.key, 'ltr', e.target.value)}
                      style={{ 
                        width: '80px', 
                        padding: '8px 12px', 
                        textAlign: 'center', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px', 
                        backgroundColor: 'white' 
                      }}
                      placeholder="0.0"
                    />
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Clock style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {selectedAircraft ? formatTime(flightTime) : '-'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Navigation style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#374151' }}>
                        {selectedAircraft ? Math.round(distance) : '-'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      padding: '4px 12px', 
                      borderRadius: '9999px', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      backgroundColor: '#f3f4f6', 
                      color: '#374151' 
                    }}>
                      {percentage}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          
          {/* Total Row */}
          <tfoot style={{ background: 'linear-gradient(to right, #f3f4f6, #e5e7eb)' }}>
            <tr style={{ borderTop: '2px solid #d1d5db' }}>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Calculator style={{ width: '20px', height: '20px', marginRight: '12px', color: '#2563eb' }} />
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>TOTAL GÉNÉRAL</span>
                </div>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  color: '#2563eb', 
                  backgroundColor: 'white', 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #dbeafe',
                  display: 'inline-block'
                }}>
                  {calculateTotal('gal').toFixed(1)}
                </div>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  color: '#2563eb', 
                  backgroundColor: 'white', 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  border: '2px solid #dbeafe',
                  display: 'inline-block'
                }}>
                  {calculateTotal('ltr').toFixed(1)}
                </div>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Clock style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                  {selectedAircraft ? formatTime(calculateFlightTime(calculateTotal('ltr'))) : '-'}
                </div>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Navigation style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                  {selectedAircraft ? Math.round(calculateDistance(calculateTotal('ltr'))) : '-'}
                </div>
              </td>
              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  padding: '8px 16px', 
                  borderRadius: '9999px', 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  backgroundColor: '#2563eb', 
                  color: 'white' 
                }}>
                  100%
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
        {/* Total en Gallons */}
        <div style={{ background: 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)', borderRadius: '8px', padding: '24px', border: '1px solid #3b82f6' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>
              {calculateTotal('gal').toFixed(1)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e40af' }}>Gallons US Total</div>
          </div>
        </div>
        
        {/* Total en Litres */}
        <div style={{ background: 'linear-gradient(to bottom right, #d1fae5, #a7f3d0)', borderRadius: '8px', padding: '24px', border: '1px solid #10b981' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#059669', marginBottom: '8px' }}>
              {calculateTotal('ltr').toFixed(1)}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#047857' }}>Litres Total</div>
          </div>
        </div>
        
        {/* Autonomie totale */}
        <div style={{ background: 'linear-gradient(to bottom right, #fef3c7, #fde68a)', borderRadius: '8px', padding: '24px', border: '1px solid #f59e0b' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#d97706', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Clock style={{ width: '32px', height: '32px' }} />
              {selectedAircraft ? formatTime(calculateFlightTime(calculateTotal('ltr'))) : '-'}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#92400e' }}>Autonomie totale</div>
          </div>
        </div>
        
        {/* Distance maximale */}
        <div style={{ background: 'linear-gradient(to bottom right, #e0e7ff, #c7d2fe)', borderRadius: '8px', padding: '24px', border: '1px solid #6366f1' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4f46e5', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Navigation style={{ width: '32px', height: '32px' }} />
              {selectedAircraft ? Math.round(calculateDistance(calculateTotal('ltr'))) : '-'} Nm
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#4338ca' }}>Distance maximale</div>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button
          onClick={resetToDefault}
          style={{
            padding: '10px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
        >
          ↻ Valeurs par défaut
        </button>
        <button
          onClick={clearAll}
          style={{
            padding: '10px 24px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
        >
          ✕ Tout effacer
        </button>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '32px', backgroundColor: '#dbeafe', border: '1px solid #3b82f6', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#bfdbfe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#2563eb', fontWeight: '600', fontSize: '14px' }}>ℹ</span>
            </div>
          </div>
          <div style={{ marginLeft: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#1e40af', marginBottom: '4px', margin: '0' }}>Instructions d'utilisation</h3>
            <p style={{ fontSize: '14px', color: '#1d4ed8', margin: '0' }}>
              Saisissez les valeurs directement dans le tableau en gallons ou en litres. 
              La conversion automatique se fait en temps réel. Les pourcentages et totaux sont calculés instantanément.
              Les valeurs par défaut correspondent à un vol type avec réserves réglementaires.
              {selectedAircraft && (
                <span style={{ display: 'block', marginTop: '8px', fontWeight: '500' }}>
                  Les calculs de temps et distance sont basés sur : {selectedAircraft.registration} - 
                  Consommation: {selectedAircraft.fuelConsumption} L/h - Vitesse: {selectedAircraft.cruiseSpeedKt} kt
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};