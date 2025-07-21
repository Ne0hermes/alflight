// src/modules/aircraft/components/AircraftForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plane, Fuel, Scale, Settings } from 'lucide-react';

export const AircraftForm = ({ aircraft, onSave, onClose }) => {
  // État initial basé sur l'avion existant ou valeurs par défaut
  const [formData, setFormData] = useState({
    registration: '',
    model: '',
    fuelType: 'AVGAS 100LL',
    cruiseSpeed: 200,
    cruiseSpeedKt: 108,
    cruiseTimePerNm: 0.56,
    serviceCeiling: 13000,
    fuelCapacity: 150,
    fuelCapacityGal: 39.6,
    fuelConsumption: 30,
    fuelConsumptionGph: 7.9,
    emptyWeight: 700,
    minTakeoffWeight: 850,
    maxTakeoffWeight: 1150,
    maxLandingWeight: 1150,
    maxBaggageWeight: 60,
    maxAuxiliaryWeight: 15,
    weightBalance: {
      frontLeftSeatArm: 2.00,
      frontRightSeatArm: 2.00,
      rearLeftSeatArm: 2.90,
      rearRightSeatArm: 2.90,
      baggageArm: 3.50,
      auxiliaryArm: 3.70,
      fuelArm: 2.40,
      emptyWeightArm: 2.30,
      cgLimits: { forward: 2.05, aft: 2.45 }
    }
  });

  // Facteurs de conversion
  const LTR_TO_GAL = 0.264172;
  const GAL_TO_LTR = 3.78541;
  const KPH_TO_KT = 0.539957;
  const KT_TO_KPH = 1.852;

  // Charger les données de l'avion si modification
  useEffect(() => {
    if (aircraft) {
      setFormData({
        ...aircraft,
        // S'assurer que toutes les propriétés existent
        weightBalance: {
          ...aircraft.weightBalance,
          cgLimits: aircraft.weightBalance?.cgLimits || { forward: 2.05, aft: 2.45 }
        }
      });
    }
  }, [aircraft]);

  // Gestion des changements dans le formulaire
  const handleChange = (field, value) => {
    if (field.includes('.')) {
      // Gestion des champs imbriqués (ex: weightBalance.frontLeftSeatArm)
      const [parent, child, subchild] = field.split('.');
      if (subchild) {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: {
              ...prev[parent][child],
              [subchild]: value
            }
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      }
    } else {
      // Conversions automatiques selon le champ
      let updates = { [field]: value };
      
      // Conversions carburant
      if (field === 'fuelCapacity') {
        updates.fuelCapacityGal = parseFloat((value * LTR_TO_GAL).toFixed(1));
      } else if (field === 'fuelCapacityGal') {
        updates.fuelCapacity = parseFloat((value * GAL_TO_LTR).toFixed(0));
      }
      
      if (field === 'fuelConsumption') {
        updates.fuelConsumptionGph = parseFloat((value * LTR_TO_GAL).toFixed(1));
      } else if (field === 'fuelConsumptionGph') {
        updates.fuelConsumption = parseFloat((value * GAL_TO_LTR).toFixed(0));
      }
      
      // Conversions vitesse
      if (field === 'cruiseSpeed') {
        updates.cruiseSpeedKt = parseFloat((value * KPH_TO_KT).toFixed(0));
        updates.cruiseTimePerNm = parseFloat((60 / (value * KPH_TO_KT)).toFixed(2));
      } else if (field === 'cruiseSpeedKt') {
        updates.cruiseSpeed = parseFloat((value * KT_TO_KPH).toFixed(0));
        updates.cruiseTimePerNm = parseFloat((60 / value).toFixed(2));
      }
      
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  // Validation du formulaire
  const isValid = () => {
    return formData.registration && 
           formData.model && 
           formData.maxTakeoffWeight >= formData.emptyWeight &&
           formData.maxLandingWeight <= formData.maxTakeoffWeight &&
           formData.minTakeoffWeight >= formData.emptyWeight;
  };

  // Sauvegarde
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid()) {
      const dataToSave = {
        ...formData,
        id: aircraft?.id || `aircraft-${Date.now()}`,
        // Ajouter la config si elle n'existe pas
        config: aircraft?.config || {
          maxTakeoffWeight: formData.maxTakeoffWeight,
          minTakeoffWeight: formData.minTakeoffWeight,
          maxLandingWeight: formData.maxLandingWeight,
          emptyWeight: formData.emptyWeight,
          fuelCapacity: formData.fuelCapacity,
          fuelDensity: formData.fuelType === 'JET A-1' ? 0.84 : 0.72,
          takeoff: {
            baseDistance: 385, altitudeFactor: 0.10, tempFactor: 0.015,
            weightFactor: -0.008, windInterval: 10, headwindFactor: -0.10,
            tailwindFactor: 0.15, wetRunwayFactor: 1.15, slopeFactor: 0.10, groundRatio: 0.60
          },
          landing: {
            baseDistance: 630, altitudeFactor: 0.05, tempFactor: 0.010,
            weightFactor: -0.005, windInterval: 10, headwindFactor: -0.08,
            tailwindFactor: 0.13, wetRunwayFactor: 1.43, slopeFactor: 0.05, groundRatio: 0.60
          }
        }
      };
      onSave(dataToSave);
    }
  };

  const sectionStyle = {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '4px'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plane size={24} />
            {aircraft ? 'Modifier l\'avion' : 'Nouvel avion'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Informations générales */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plane size={20} />
              Informations générales
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Immatriculation *</label>
                <input
                  type="text"
                  value={formData.registration}
                  onChange={(e) => handleChange('registration', e.target.value.toUpperCase())}
                  style={inputStyle}
                  placeholder="F-ABCD"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Modèle *</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  style={inputStyle}
                  placeholder="Cessna 172"
                  required
                />
              </div>
            </div>
          </div>

          {/* Performances */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} />
              Performances
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Vitesse de croisière (km/h)</label>
                <input
                  type="number"
                  value={formData.cruiseSpeed}
                  onChange={(e) => handleChange('cruiseSpeed', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Vitesse de croisière (kt)</label>
                <input
                  type="number"
                  value={formData.cruiseSpeedKt}
                  onChange={(e) => handleChange('cruiseSpeedKt', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Plafond pratique (ft)</label>
                <input
                  type="number"
                  value={formData.serviceCeiling}
                  onChange={(e) => handleChange('serviceCeiling', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Carburant */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fuel size={20} />
              Carburant
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Type de carburant</label>
                <select
                  value={formData.fuelType}
                  onChange={(e) => handleChange('fuelType', e.target.value)}
                  style={inputStyle}
                >
                  <option value="AVGAS 100LL">AVGAS 100LL</option>
                  <option value="JET A-1">JET A-1</option>
                  <option value="MOGAS">MOGAS</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Capacité (L)</label>
                <input
                  type="number"
                  value={formData.fuelCapacity}
                  onChange={(e) => handleChange('fuelCapacity', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Capacité (Gal)</label>
                <input
                  type="number"
                  value={formData.fuelCapacityGal}
                  onChange={(e) => handleChange('fuelCapacityGal', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.1"
                />
              </div>
              <div>
                <label style={labelStyle}>Consommation (L/h)</label>
                <input
                  type="number"
                  value={formData.fuelConsumption}
                  onChange={(e) => handleChange('fuelConsumption', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Consommation (Gal/h)</label>
                <input
                  type="number"
                  value={formData.fuelConsumptionGph}
                  onChange={(e) => handleChange('fuelConsumptionGph', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {/* Masses */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={20} />
              Masses
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Masse à vide (kg)</label>
                <input
                  type="number"
                  value={formData.emptyWeight}
                  onChange={(e) => handleChange('emptyWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Masse min décollage (kg)</label>
                <input
                  type="number"
                  value={formData.minTakeoffWeight}
                  onChange={(e) => handleChange('minTakeoffWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>MTOW (kg)</label>
                <input
                  type="number"
                  value={formData.maxTakeoffWeight}
                  onChange={(e) => handleChange('maxTakeoffWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Masse max atterrissage (kg)</label>
                <input
                  type="number"
                  value={formData.maxLandingWeight}
                  onChange={(e) => handleChange('maxLandingWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Max bagages (kg)</label>
                <input
                  type="number"
                  value={formData.maxBaggageWeight}
                  onChange={(e) => handleChange('maxBaggageWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Max auxiliaire (kg)</label>
                <input
                  type="number"
                  value={formData.maxAuxiliaryWeight}
                  onChange={(e) => handleChange('maxAuxiliaryWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Bras de levier */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              📐 Bras de levier (m)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Siège avant gauche</label>
                <input
                  type="number"
                  value={formData.weightBalance.frontLeftSeatArm}
                  onChange={(e) => handleChange('weightBalance.frontLeftSeatArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Siège avant droit</label>
                <input
                  type="number"
                  value={formData.weightBalance.frontRightSeatArm}
                  onChange={(e) => handleChange('weightBalance.frontRightSeatArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Siège arrière gauche</label>
                <input
                  type="number"
                  value={formData.weightBalance.rearLeftSeatArm}
                  onChange={(e) => handleChange('weightBalance.rearLeftSeatArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Siège arrière droit</label>
                <input
                  type="number"
                  value={formData.weightBalance.rearRightSeatArm}
                  onChange={(e) => handleChange('weightBalance.rearRightSeatArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Bagages</label>
                <input
                  type="number"
                  value={formData.weightBalance.baggageArm}
                  onChange={(e) => handleChange('weightBalance.baggageArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Auxiliaire</label>
                <input
                  type="number"
                  value={formData.weightBalance.auxiliaryArm}
                  onChange={(e) => handleChange('weightBalance.auxiliaryArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Carburant</label>
                <input
                  type="number"
                  value={formData.weightBalance.fuelArm}
                  onChange={(e) => handleChange('weightBalance.fuelArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Masse à vide</label>
                <input
                  type="number"
                  value={formData.weightBalance.emptyWeightArm}
                  onChange={(e) => handleChange('weightBalance.emptyWeightArm', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Limites CG */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              ⚖️ Limites de centrage (m)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Limite avant</label>
                <input
                  type="number"
                  value={formData.weightBalance.cgLimits.forward}
                  onChange={(e) => handleChange('weightBalance.cgLimits.forward', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>Limite arrière</label>
                <input
                  type="number"
                  value={formData.weightBalance.cgLimits.aft}
                  onChange={(e) => handleChange('weightBalance.cgLimits.aft', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid()}
              style={{
                padding: '10px 24px',
                backgroundColor: isValid() ? '#10b981' : '#e5e7eb',
                color: isValid() ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: isValid() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save size={20} />
              {aircraft ? 'Enregistrer les modifications' : 'Ajouter l\'avion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};