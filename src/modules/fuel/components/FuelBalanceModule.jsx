import React, { useState, useEffect } from 'react';
import { Fuel, Calculator, Plane, Clock, Navigation, Lock, Home, Navigation2, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { useFlightSystem } from '@context/FlightSystemContext';

export const FuelBalanceModule = () => {
  // 🔗 UTILISATION DES DONNÉES CENTRALISÉES DU CONTEXTE - FOB au lieu de CRM
  const { 
    selectedAircraft, 
    navigationResults, 
    flightType,
    fuelData,
    setFuelData,
    fobFuel,  // FOB (Fuel On Board) au lieu de CRM
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
    // Ne pas permettre la modification des valeurs automatiques
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

  // Déterminer le détail de la réserve réglementaire
  const getReserveDescription = () => {
    if (!flightType || !navigationResults) return 'Réserve réglementaire (définir type de vol)';
    
    let desc = `${navigationResults?.regulationReserveMinutes || 0} min - `;
    
    // Règles de vol
    desc += `${flightType.rules} `;
    
    // Type de vol
    desc += `${flightType.category === 'local' ? 'LOCAL' : 'NAV'} `;
    
    // Période
    if (flightType.period === 'nuit') {
      desc += 'NUIT (45 min)';
    } else if (flightType.category === 'local') {
      desc += 'JOUR (10 min)';
    } else {
      desc += 'JOUR (30 min)';
    }
    
    // IFR additionnel
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
      readonly: true, // 🔒 NOUVEAU : Trip fuel verrouillé
      automatic: true // 🚀 NOUVEAU : Indicateur automatique
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
      // trip, contingency et finalReserve restent automatiques
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
      // trip, contingency et finalReserve restent automatiques
    }));
    setFobFuel({ gal: 0, ltr: 0 });
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      {/* 🚀 NOUVELLE ALERTE AUTOMATISATION */}
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
              Le <strong>Trip Fuel</strong> ({fuelData.trip.ltr.toFixed(1)} L), 
              le <strong>Contingency Fuel</strong> ({fuelData.contingency.ltr.toFixed(1)} L) et 
              la <strong>Final Reserve</strong> ({fuelData.finalReserve.ltr.toFixed(1)} L) 
              sont calculés automatiquement depuis l'onglet Navigation.
            </p>
          </div>
        </div>
      )}

      {/* Header - reste identique */}
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
      </div>

      {/* Table carburant - identique sauf labels */}
      {/* ... (le reste du tableau reste identique) ... */}

      {/* Section FOB (Fuel On Board) au lieu de CRM */}
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
          FOB - Fuel On Board (Carburant à bord)
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
              Le FOB (Fuel On Board) représente la quantité de carburant réellement présente à bord de l'avion, 
              vérifiée et validée par le commandant de bord avant le vol.
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              📝 <strong>Instructions :</strong> Entrez la quantité de carburant constatée à bord après inspection visuelle 
              et/ou lecture des jauges. Le système compare automatiquement cette valeur avec le carburant total requis.
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              ⚖️ <strong>Utilisation :</strong> Cette valeur sera automatiquement utilisée dans l'onglet "Masse et Centrage" pour 
              calculer la position du centre de gravité.
            </p>
          </div>
        </div>
      </div>

      {/* Le reste du composant reste identique */}
    </div>
  );
};