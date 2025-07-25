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
    emptyWeight: 200,
    minTakeoffWeight: 250,
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
      cgLimits: { 
        forward: 2.05, 
        aft: 2.45,
        forwardVariable: [],
        aftVariable: []
      }
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
        registration: aircraft.registration || '',
        model: aircraft.model || '',
        fuelType: aircraft.fuelType || 'AVGAS 100LL',
        cruiseSpeed: aircraft.cruiseSpeed || 200,
        cruiseSpeedKt: aircraft.cruiseSpeedKt || 108,
        cruiseTimePerNm: aircraft.cruiseTimePerNm || 0.56,
        serviceCeiling: aircraft.serviceCeiling || 13000,
        fuelCapacity: aircraft.fuelCapacity || 150,
        fuelCapacityGal: aircraft.fuelCapacityGal || 39.6,
        fuelConsumption: aircraft.fuelConsumption || 30,
        fuelConsumptionGph: aircraft.fuelConsumptionGph || 7.9,
        emptyWeight: aircraft.emptyWeight || 700,
        minTakeoffWeight: aircraft.minTakeoffWeight || 850,
        maxTakeoffWeight: aircraft.maxTakeoffWeight || 1150,
        maxLandingWeight: aircraft.maxLandingWeight || 1150,
        maxBaggageWeight: aircraft.maxBaggageWeight || 60,
        maxAuxiliaryWeight: aircraft.maxAuxiliaryWeight || 15,
        weightBalance: {
          frontLeftSeatArm: aircraft.weightBalance?.frontLeftSeatArm || 2.00,
          frontRightSeatArm: aircraft.weightBalance?.frontRightSeatArm || 2.00,
          rearLeftSeatArm: aircraft.weightBalance?.rearLeftSeatArm || 2.90,
          rearRightSeatArm: aircraft.weightBalance?.rearRightSeatArm || 2.90,
          baggageArm: aircraft.weightBalance?.baggageArm || 3.50,
          auxiliaryArm: aircraft.weightBalance?.auxiliaryArm || 3.70,
          fuelArm: aircraft.weightBalance?.fuelArm || 2.40,
          emptyWeightArm: aircraft.weightBalance?.emptyWeightArm || 2.30,
          cgLimits: {
            forward: aircraft.weightBalance?.cgLimits?.forward || 2.05,
            aft: aircraft.weightBalance?.cgLimits?.aft || 2.45,
            forwardVariable: aircraft.weightBalance?.cgLimits?.forwardVariable || [],
            aftVariable: aircraft.weightBalance?.cgLimits?.aftVariable || []
          }
        }
      });
    }
  }, [aircraft]);

  // Gestion des changements dans le formulaire
  const handleChange = (field, value) => {
    if (field === 'weightBalance.cgLimits.forwardVariable' || field === 'weightBalance.cgLimits.aftVariable') {
      // Cas spécial pour forwardVariable et aftVariable qui sont des tableaux
      const variableType = field.split('.').pop(); // 'forwardVariable' ou 'aftVariable'
      setFormData(prev => ({
        ...prev,
        weightBalance: {
          ...prev.weightBalance,
          cgLimits: {
            ...prev.weightBalance.cgLimits,
            [variableType]: value
          }
        }
      }));
    } else if (field.includes('.')) {
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
        // S'assurer que forwardVariable et aftVariable existent toujours
        weightBalance: {
          ...formData.weightBalance,
          cgLimits: {
            ...formData.weightBalance.cgLimits,
            forwardVariable: formData.weightBalance.cgLimits.forwardVariable || [],
            aftVariable: formData.weightBalance.cgLimits.aftVariable || []
          }
        },
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

  const fieldStyle = {
    marginBottom: '12px'
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
                  min="50"
                />
              </div>
              <div>
                <label style={labelStyle}>Masse min décollage (kg)</label>
                <input
                  type="number"
                  value={formData.minTakeoffWeight}
                  onChange={(e) => handleChange('minTakeoffWeight', parseInt(e.target.value) || 0)}
                  style={inputStyle}
                  min="250"
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
            
            {/* Note explicative */}
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c4a6e',
              border: '1px solid #bae6fd'
            }}>
              <p style={{ margin: '0', fontWeight: '600' }}>
                📚 Configuration de l'enveloppe de centrage :
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                • Pour les <strong>limites avant</strong> et <strong>arrière</strong>, toutes les valeurs (minimale, intermédiaire et maximale) doivent être remplies manuellement<br/>
                • Si votre avion a des <strong>limites intermédiaires</strong> (enveloppe non-rectangulaire), ajoutez-les en cliquant sur "Ajouter un point"<br/>
                • Si votre avion n'a <strong>pas de limites intermédiaires</strong> (enveloppe rectangulaire), ajoutez simplement les limites min et max avec la même valeur CG<br/>
                • <strong>Exemple</strong> : Pour une limite avant constante de 2.05m, ajoutez deux points : (masse min, 2.05m) et (masse max, 2.05m)
              </p>
            </div>

            {/* Limites avant variables */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
                📊 Limites avant variables
              </h4>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                Définissez des limites CG avant différentes selon la masse pour créer une enveloppe non rectangulaire
              </p>
              
              {formData.weightBalance.cgLimits.forwardVariable && formData.weightBalance.cgLimits.forwardVariable.length > 0 ? (
                <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
                  {formData.weightBalance.cgLimits.forwardVariable
                    .map((point, index) => {
                      // Créer une copie triée pour l'affichage uniquement
                      const sortedPoints = [...formData.weightBalance.cgLimits.forwardVariable]
                        .map((p, i) => ({ ...p, originalIndex: i }))
                        .sort((a, b) => a.weight - b.weight);
                      
                      // Trouver la position d'affichage de ce point
                      const displayIndex = sortedPoints.findIndex(p => p.originalIndex === index);
                      
                      return (
                        <div key={index} style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr auto', 
                          gap: '12px',
                          marginBottom: '8px',
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          order: displayIndex
                        }}>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Masse (kg)</label>
                            <input
                              type="number"
                              value={point.weight || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.forwardVariable];
                                newPoints[index] = { ...newPoints[index], weight: parseInt(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.forwardVariable', newPoints);
                              }}
                              style={{ ...inputStyle, fontSize: '14px' }}
                              min={formData.minTakeoffWeight}
                              max={formData.maxTakeoffWeight}
                            />
                          </div>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Limite CG (m)</label>
                            <input
                              type="number"
                              value={point.cg || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.forwardVariable];
                                newPoints[index] = { ...newPoints[index], cg: parseFloat(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.forwardVariable', newPoints);
                              }}
                              style={{ ...inputStyle, fontSize: '14px' }}
                              step="0.01"
                              min="0"
                              max={formData.weightBalance.cgLimits.aft}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newPoints = formData.weightBalance.cgLimits.forwardVariable.filter((_, i) => i !== index);
                              handleChange('weightBalance.cgLimits.forwardVariable', newPoints);
                            }}
                            style={{
                              alignSelf: 'flex-end',
                              padding: '8px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : null}
              
              <button
                type="button"
                onClick={() => {
                  const currentPoints = formData.weightBalance.cgLimits.forwardVariable || [];
                  const newWeight = currentPoints.length > 0 
                    ? Math.max(...currentPoints.map(p => p.weight)) + 50
                    : formData.minTakeoffWeight;
                  
                  const newPoint = { 
                    weight: Math.min(newWeight, formData.maxTakeoffWeight), 
                    cg: formData.weightBalance.cgLimits.forward 
                  };
                  
                  handleChange('weightBalance.cgLimits.forwardVariable', [...currentPoints, newPoint]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                + Ajouter un point de limite variable
              </button>

              {formData.weightBalance.cgLimits.forwardVariable && formData.weightBalance.cgLimits.forwardVariable.length > 0 && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  <p style={{ margin: '0', fontWeight: '600' }}>
                    💡 Info : L'enveloppe de centrage sera automatiquement adaptée
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    Les points seront triés par masse et interpolés pour créer une limite avant progressive
                  </p>
                  
                  {/* Mini aperçu de l'enveloppe */}
                  {(formData.weightBalance.cgLimits.forwardVariable?.length > 0 || 
                    formData.weightBalance.cgLimits.aftVariable?.length > 0) && (
                    <div style={{ marginTop: '12px' }}>
                      <svg viewBox="0 0 300 200" style={{ width: '100%', maxWidth: '300px', height: '150px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white' }}>
                        {/* Axes */}
                        <line x1="30" y1="170" x2="270" y2="170" stroke="#374151" strokeWidth="1" />
                        <line x1="30" y1="30" x2="30" y2="170" stroke="#374151" strokeWidth="1" />
                        
                        {/* Labels */}
                        <text x="150" y="190" textAnchor="middle" fontSize="10" fill="#6b7280">CG</text>
                        <text x="10" y="100" textAnchor="middle" fontSize="10" fill="#6b7280" transform="rotate(-90 10 100)">Masse</text>
                        
                        {/* Enveloppe */}
                        {(() => {
                          const forwardPoints = formData.weightBalance.cgLimits.forwardVariable || [];
                          const aftPoints = formData.weightBalance.cgLimits.aftVariable || [];
                          
                          // Trier les points
                          const sortedForward = [...forwardPoints].sort((a, b) => a.weight - b.weight);
                          const sortedAft = [...aftPoints].sort((a, b) => a.weight - b.weight);
                          
                          // Calculer les échelles
                          const allCGs = [
                            formData.weightBalance.cgLimits.forward,
                            formData.weightBalance.cgLimits.aft,
                            ...sortedForward.map(p => p.cg),
                            ...sortedAft.map(p => p.cg)
                          ];
                          const cgMin = Math.min(...allCGs) - 0.05;
                          const cgMax = Math.max(...allCGs) + 0.05;
                          const weightMin = formData.minTakeoffWeight;
                          const weightMax = formData.maxTakeoffWeight;
                          
                          // Construire l'enveloppe
                          const points = [];
                          
                          // Côté avant
                          if (sortedForward.length === 0 || sortedForward[0].weight > weightMin) {
                            points.push({ weight: weightMin, cg: formData.weightBalance.cgLimits.forward });
                          }
                          points.push(...sortedForward);
                          if (sortedForward.length === 0 || sortedForward[sortedForward.length - 1].weight < weightMax) {
                            points.push({ weight: weightMax, cg: formData.weightBalance.cgLimits.forward });
                          }
                          
                          // Côté arrière (en ordre inverse)
                          if (sortedAft.length === 0 || sortedAft[sortedAft.length - 1].weight < weightMax) {
                            points.push({ weight: weightMax, cg: formData.weightBalance.cgLimits.aft });
                          }
                          if (sortedAft.length > 0) {
                            for (let i = sortedAft.length - 1; i >= 0; i--) {
                              points.push(sortedAft[i]);
                            }
                          }
                          if (sortedAft.length === 0 || sortedAft[0].weight > weightMin) {
                            points.push({ weight: weightMin, cg: formData.weightBalance.cgLimits.aft });
                          }
                          
                          // Convertir en coordonnées SVG
                          const svgPoints = points.map(p => 
                            `${30 + (p.cg - cgMin) / (cgMax - cgMin) * 240},${170 - (p.weight - weightMin) / (weightMax - weightMin) * 140}`
                          ).join(' ');
                          
                          return (
                            <>
                              <polygon points={svgPoints} fill="#dbeafe" fillOpacity="0.5" stroke="#3b82f6" strokeWidth="2" />
                              {/* Points avant */}
                              {sortedForward.map((point, i) => (
                                <circle
                                  key={`f-${i}`}
                                  cx={30 + (point.cg - cgMin) / (cgMax - cgMin) * 240}
                                  cy={170 - (point.weight - weightMin) / (weightMax - weightMin) * 140}
                                  r="4"
                                  fill="#3b82f6"
                                  stroke="white"
                                  strokeWidth="1"
                                />
                              ))}
                              {/* Points arrière */}
                              {sortedAft.map((point, i) => (
                                <circle
                                  key={`a-${i}`}
                                  cx={30 + (point.cg - cgMin) / (cgMax - cgMin) * 240}
                                  cy={170 - (point.weight - weightMin) / (weightMax - weightMin) * 140}
                                  r="4"
                                  fill="#ef4444"
                                  stroke="white"
                                  strokeWidth="1"
                                />
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                      <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                        • Points <span style={{ color: '#3b82f6', fontWeight: '600' }}>bleus</span> : limites avant variables<br/>
                        • Points <span style={{ color: '#ef4444', fontWeight: '600' }}>rouges</span> : limites arrière variables
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Limites arrière variables */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
                📊 Limites arrière variables
              </h4>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                Définissez des limites CG arrière différentes selon la masse
              </p>
              
              {formData.weightBalance.cgLimits.aftVariable && formData.weightBalance.cgLimits.aftVariable.length > 0 ? (
                <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
                  {formData.weightBalance.cgLimits.aftVariable
                    .map((point, index) => {
                      // Créer une copie triée pour l'affichage uniquement
                      const sortedPoints = [...formData.weightBalance.cgLimits.aftVariable]
                        .map((p, i) => ({ ...p, originalIndex: i }))
                        .sort((a, b) => a.weight - b.weight);
                      
                      // Trouver la position d'affichage de ce point
                      const displayIndex = sortedPoints.findIndex(p => p.originalIndex === index);
                      
                      return (
                        <div key={index} style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr auto', 
                          gap: '12px',
                          marginBottom: '8px',
                          padding: '12px',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          order: displayIndex
                        }}>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Masse (kg)</label>
                            <input
                              type="number"
                              value={point.weight || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.aftVariable];
                                newPoints[index] = { ...newPoints[index], weight: parseInt(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.aftVariable', newPoints);
                              }}
                              style={{ ...inputStyle, fontSize: '14px' }}
                              min={formData.minTakeoffWeight}
                              max={formData.maxTakeoffWeight}
                            />
                          </div>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Limite CG (m)</label>
                            <input
                              type="number"
                              value={point.cg || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.aftVariable];
                                newPoints[index] = { ...newPoints[index], cg: parseFloat(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.aftVariable', newPoints);
                              }}
                              style={{ ...inputStyle, fontSize: '14px' }}
                              step="0.01"
                              min={formData.weightBalance.cgLimits.forward}
                              max="5"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newPoints = formData.weightBalance.cgLimits.aftVariable.filter((_, i) => i !== index);
                              handleChange('weightBalance.cgLimits.aftVariable', newPoints);
                            }}
                            style={{
                              alignSelf: 'flex-end',
                              padding: '8px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : null}
              
              <button
                type="button"
                onClick={() => {
                  const currentPoints = formData.weightBalance.cgLimits.aftVariable || [];
                  const newWeight = currentPoints.length > 0 
                    ? Math.max(...currentPoints.map(p => p.weight)) + 50
                    : formData.minTakeoffWeight;
                  
                  const newPoint = { 
                    weight: Math.min(newWeight, formData.maxTakeoffWeight), 
                    cg: formData.weightBalance.cgLimits.aft 
                  };
                  
                  handleChange('weightBalance.cgLimits.aftVariable', [...currentPoints, newPoint]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                + Ajouter un point de limite arrière variable
              </button>

              {formData.weightBalance.cgLimits.aftVariable && formData.weightBalance.cgLimits.aftVariable.length > 0 && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#991b1b'
                }}>
                  <p style={{ margin: '0', fontWeight: '600' }}>
                    💡 Info : Les limites arrière variables sont définies
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    L'enveloppe suivra l'interpolation entre les points pour créer une limite arrière progressive
                  </p>
                </div>
              )}
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