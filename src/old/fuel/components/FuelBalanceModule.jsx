import React from 'react';
import { Fuel, Calculator, Plane, Clock, Navigation, Lock, Home, Navigation2, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { useFlightSystem } from '../../../context/FlightSystemContext';

export const FuelBalanceModule = () => {
  // 🔗 UTILISATION DES DONNÉES CENTRALISÉES DU CONTEXTE
  const { 
    selectedAircraft, 
    navigationResults, 
    flightType,
    fuelData,
    setFuelData,
    fobFuel,
    setFobFuel
  } = useFlightSystem();
  
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
    // 🔒 VERROUILLAGE DES VALEURS AUTOMATIQUES
    if (fuelType === 'finalReserve' || fuelType === 'contingency' || fuelType === 'trip') return;
    
    const numValue = parseFloat(value) || 0;
    
    setFuelData(prev => ({
      ...prev,
      [fuelType]: {
        [inputUnit]: numValue,
        [inputUnit === 'gal' ? 'ltr' : 'gal']: convertValue(numValue, inputUnit)
      }
    }));
  };

  const handleFobChange = (inputUnit, value) => {
    const numValue = parseFloat(value) || 0;
    setFobFuel({
      [inputUnit]: numValue,
      [inputUnit === 'gal' ? 'ltr' : 'gal']: convertValue(numValue, inputUnit)
    });
  };

  const calculateTotal = (unit) => {
    return Object.values(fuelData).reduce((total, fuel) => {
      if (fuel && typeof fuel === 'object' && fuel[unit] !== undefined) {
        return total + fuel[unit];
      }
      return total;
    }, 0);
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

  // Déterminer le détail de la réserve réglementaire
  const getReserveDescription = () => {
    if (!flightType || !navigationResults) return 'Réserve réglementaire (définir type de vol)';
    
    let desc = `${navigationResults?.regulationReserveMinutes || 0} min - `;
    desc += `${flightType.rules} `;
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    
    if (flightType.period === 'nuit') {
      desc += 'NUIT (45 min)';
    } else if (flightType.category === 'local') {
      desc += 'JOUR (10 min)';
    } else {
      desc += 'JOUR (30 min)';
    }
    
    if (flightType.rules === 'IFR') {
      desc += ' + IFR (15 min)';
    }
    
    return desc;
  };

  // Déterminer la description du trip fuel
  const getTripDescription = () => {
    if (!navigationResults || !navigationResults.fuelRequired) {
      return 'Calculé depuis Navigation (aucune route définie)';
    }
    
    return `Calculé depuis Navigation (${navigationResults.totalDistance || 0} Nm en ${Math.round(navigationResults.totalTime || 0)} min)`;
  };

  // Vérifier si le carburant FOB est suffisant
  const isFobSufficient = () => {
    const totalRequired = calculateTotal('ltr');
    return fobFuel.ltr >= totalRequired;
  };

  const getFuelDifference = () => {
    const totalRequired = calculateTotal('ltr');
    return fobFuel.ltr - totalRequired;
  };

  const fuelTypes = [
    { key: 'roulage', label: 'Roulage', description: 'Taxi et attente', color: '#dbeafe' },
    { 
      key: 'trip', 
      label: 'Trip Fuel', 
      description: getTripDescription(), 
      color: '#d1fae5', 
      readonly: true,
      automatic: true
    },
    { key: 'contingency', label: 'Contingency Fuel', description: '5% du trip fuel (min. 1 gal)', color: '#fef3c7', readonly: true },
    { key: 'alternate', label: 'Alternate Fuel', description: 'Vers aérodrome de dégagement', color: '#fed7aa' },
    { key: 'finalReserve', label: 'Final Reserve', description: '', color: '#fee2e2', readonly: true },
    { key: 'additional', label: 'Additional Fuel', description: 'Météo, ATC, etc.', color: '#e9d5ff' },
    { key: 'extra', label: 'Extra Fuel', description: 'À la discrétion du pilote', color: '#fce7f3' }
  ];

  // Fonctions pour réinitialiser les valeurs
  const resetToDefault = () => {
    setFuelData(prev => ({
      ...prev,
      roulage: { gal: 1.0, ltr: 1.0 * GAL_TO_LTR },
      alternate: { gal: 2.0, ltr: 2.0 * GAL_TO_LTR },
      additional: { gal: 0, ltr: 0 },
      extra: { gal: 0, ltr: 0 }
    }));
    setFobFuel({ gal: 0, ltr: 0 });
  };

  const clearAll = () => {
    setFuelData(prev => ({
      ...prev,
      roulage: { gal: 0, ltr: 0 },
      alternate: { gal: 0, ltr: 0 },
      additional: { gal: 0, ltr: 0 },
      extra: { gal: 0, ltr: 0 }
    }));
    setFobFuel({ gal: 0, ltr: 0 });
  };

  // Vérification de l'initialisation des données
  if (!fuelData || typeof fuelData !== 'object') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>Chargement des données de carburant...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      {/* 🚀 ALERTE AUTOMATISATION */}
      {navigationResults?.fuelRequired > 0 && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          backgroundColor: '#f0fdf4', 
          border: '2px solid #10b981', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: '16px', height: '16px', color: '#10b981' }} />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#065f46', margin: '0 0 4px 0' }}>
              🚀 Automatisation activée
            </h3>
            <p style={{ fontSize: '14px', color: '#047857', margin: '0' }}>
              Le <strong>Trip Fuel</strong> ({fuelData.trip?.ltr?.toFixed(1) || '0.0'} L), 
              le <strong>Contingency Fuel</strong> ({fuelData.contingency?.ltr?.toFixed(1) || '0.0'} L) et 
              la <strong>Final Reserve</strong> ({fuelData.finalReserve?.ltr?.toFixed(1) || '0.0'} L) 
              sont calculés automatiquement depuis l'onglet Navigation.
            </p>
          </div>
        </div>
      )}

      {/* Alerte si aucun type de vol défini */}
      {!flightType && (
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          backgroundColor: '#fef3c7', 
          border: '2px solid #f59e0b', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#fde68a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '16px' }}>!</span>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', margin: '0 0 4px 0' }}>
              Type de vol non défini
            </h3>
            <p style={{ fontSize: '14px', color: '#92400e', margin: '0' }}>
              Veuillez définir le type de vol dans l'onglet "Navigation" pour calculer automatiquement la réserve réglementaire.
            </p>
          </div>
        </div>
      )}

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
          {/* Badge type de vol */}
          {flightType && (
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              marginLeft: '24px'
            }}>
              <span style={{ 
                padding: '4px 12px', 
                borderRadius: '9999px', 
                fontSize: '12px', 
                fontWeight: '600',
                backgroundColor: flightType.rules === 'VFR' ? '#dbeafe' : '#e0e7ff',
                color: flightType.rules === 'VFR' ? '#1e40af' : '#4338ca'
              }}>
                {flightType.rules}
              </span>
              <span style={{ 
                padding: '4px 12px', 
                borderRadius: '9999px', 
                fontSize: '12px', 
                fontWeight: '600',
                backgroundColor: flightType.category === 'local' ? '#fef3c7' : '#d1fae5',
                color: flightType.category === 'local' ? '#92400e' : '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {flightType.category === 'local' ? <Home size={12} /> : <Navigation2 size={12} />}
                {flightType.category === 'local' ? 'LOCAL' : 'NAVIGATION'}
              </span>
              <span style={{ 
                padding: '4px 12px', 
                borderRadius: '9999px', 
                fontSize: '12px', 
                fontWeight: '600',
                backgroundColor: flightType.period === 'jour' ? '#fef3c7' : '#e0e7ff',
                color: flightType.period === 'jour' ? '#92400e' : '#4338ca'
              }}>
                {flightType.period === 'jour' ? 'JOUR' : 'NUIT'}
              </span>
            </div>
          )}
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
              const fuel = fuelData[fuelType.key] || { gal: 0, ltr: 0 };
              const percentage = calculateTotal('gal') > 0 
                ? (fuel.gal / calculateTotal('gal') * 100).toFixed(1)
                : '0.0';
              const flightTime = calculateFlightTime(fuel.ltr);
              const distance = calculateDistance(fuel.ltr);
              
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
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {fuelType.label}
                            {fuelType.readonly && <Lock style={{ width: '12px', height: '12px', color: '#6b7280' }} />}
                            {fuelType.automatic && <Zap style={{ width: '12px', height: '12px', color: '#10b981' }} />}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280' }}>
                            {fuelType.key === 'finalReserve' ? getReserveDescription() : fuelType.description}
                          </span>
                        </div>
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.1"
                        value={fuel.gal.toFixed(1)}
                        onChange={(e) => handleInputChange(fuelType.key, 'gal', e.target.value)}
                        disabled={fuelType.readonly}
                        style={{ 
                          width: '80px', 
                          padding: '8px 12px', 
                          textAlign: 'center', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px', 
                          backgroundColor: fuelType.readonly ? '#f3f4f6' : 'white',
                          cursor: fuelType.readonly ? 'not-allowed' : 'text',
                          opacity: fuelType.readonly ? 0.8 : 1
                        }}
                        placeholder="0.0"
                      />
                      {fuelType.readonly && (
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          color: fuelType.automatic ? '#10b981' : '#6b7280',
                          backgroundColor: fuelType.automatic ? '#d1fae5' : '#e5e7eb',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {fuelType.automatic && <Zap style={{ width: '8px', height: '8px' }} />}
                          AUTO
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.1"
                        value={fuel.ltr.toFixed(1)}
                        onChange={(e) => handleInputChange(fuelType.key, 'ltr', e.target.value)}
                        disabled={fuelType.readonly}
                        style={{ 
                          width: '80px', 
                          padding: '8px 12px', 
                          textAlign: 'center', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px', 
                          backgroundColor: fuelType.readonly ? '#f3f4f6' : 'white',
                          cursor: fuelType.readonly ? 'not-allowed' : 'text',
                          opacity: fuelType.readonly ? 0.8 : 1
                        }}
                        placeholder="0.0"
                      />
                      {fuelType.readonly && (
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          color: fuelType.automatic ? '#10b981' : '#6b7280',
                          backgroundColor: fuelType.automatic ? '#d1fae5' : '#e5e7eb',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {fuelType.automatic && <Zap style={{ width: '8px', height: '8px' }} />}
                          AUTO
                        </span>
                      )}
                    </div>
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
                        {selectedAircraft ? Math.round(distance) : '-'} Nm
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
                  {selectedAircraft ? Math.round(calculateDistance(calculateTotal('ltr'))) : '-'} Nm
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

      {/* Carburant FOB Section */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        border: '2px solid #e5e7eb', 
        borderRadius: '8px', 
        padding: '24px',
        marginBottom: '32px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Fuel style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          Carburant FOB (Fuel On Board - Constaté à bord)
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Ligne 1 : Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                Gallons
              </label>
              <input
                type="number"
                step="0.1"
                value={fobFuel.gal.toFixed(1)}
                onChange={(e) => handleFobChange('gal', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  textAlign: 'center', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
                placeholder="0.0"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                Litres
              </label>
              <input
                type="number"
                step="0.1"
                value={fobFuel.ltr.toFixed(1)}
                onChange={(e) => handleFobChange('ltr', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  textAlign: 'center', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
                placeholder="0.0"
              />
            </div>
          </div>
          
          {/* Ligne 2 : Statut */}
          <div style={{
            padding: '16px',
            backgroundColor: isFobSufficient() ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${isFobSufficient() ? '#10b981' : '#ef4444'}`,
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isFobSufficient() ? (
                <CheckCircle style={{ width: '24px', height: '24px', color: '#10b981', flexShrink: 0 }} />
              ) : (
                <AlertTriangle style={{ width: '24px', height: '24px', color: '#ef4444', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ 
                  margin: '0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: isFobSufficient() ? '#065f46' : '#dc2626'
                }}>
                  {isFobSufficient() ? 'Carburant SUFFISANT' : 'Carburant INSUFFISANT'}
                </p>
                <p style={{ 
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: isFobSufficient() ? '#065f46' : '#dc2626'
                }}>
                  {isFobSufficient() 
                    ? `Excédent: ${Math.abs(getFuelDifference()).toFixed(1)} L`
                    : `Manque: ${Math.abs(getFuelDifference()).toFixed(1)} L`
                  }
                </p>
              </div>
            </div>
          </div>
          
          {/* Information supplémentaire */}
          <div style={{
            padding: '12px',
            backgroundColor: '#e0f2fe',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#0c4a6e'
          }}>
            <p style={{ margin: '0', fontWeight: '600' }}>
              ℹ️ Qu'est-ce que le FOB ?
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              Le FOB (Fuel On Board) représente la quantité de carburant réellement constatée à bord 
              avant le vol.
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              📝 <strong>Instructions :</strong> Entrez la quantité de carburant constatée à bord. 
              Le système compare automatiquement cette valeur avec le carburant total requis.
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              ⚖️ <strong>Utilisation :</strong> Cette valeur sera automatiquement utilisée dans l'onglet "Masse et Centrage" pour 
              calculer la position du centre de gravité.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
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
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
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
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0', fontStyle: 'italic' }}>
          Note : Ces boutons n'affectent que les valeurs manuelles. Les valeurs automatiques restent calculées.
        </p>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '32px', backgroundColor: '#f0fdf4', border: '1px solid #10b981', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ color: '#10b981', width: '16px', height: '16px' }} />
            </div>
          </div>
          <div style={{ marginLeft: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#065f46', marginBottom: '4px', margin: '0' }}>🚀 Automatisation activée</h3>
            <p style={{ fontSize: '14px', color: '#047857', margin: '0' }}>
              <strong>Trip Fuel :</strong> Calculé automatiquement depuis l'onglet Navigation (distance × consommation).
              <br/>
              <strong>Contingency Fuel :</strong> Calculé automatiquement à 5% du trip fuel (minimum 1 gallon).
              <br/>
              <strong>Final Reserve :</strong> Calculée automatiquement selon la réglementation du type de vol.
              {selectedAircraft && (
                <span style={{ display: 'block', marginTop: '8px', fontWeight: '500' }}>
                  Calculs basés sur : {selectedAircraft.registration} - 
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