// src/modules/aircraft/components/AircraftForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plane, Fuel, Scale, Settings, AlertTriangle, Info, TrendingUp } from 'lucide-react';

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
    },
    // Nouvelles données de performances
    performances: {
      takeoffDistance: 385,  // Distance de décollage (TOD) en mètres
      accelerateStopDistance: 450,  // Distance accélération-arrêt (ASD) en mètres
      landingDistance: 630,  // Distance atterrissage (LD) en mètres
      landingDistanceFlapsUp: 800  // Distance atterrissage volets UP en mètres
    }
  });

  // État pour les erreurs
  const [errors, setErrors] = useState({});

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
        },
        performances: {
          takeoffDistance: aircraft.performances?.takeoffDistance || 385,
          accelerateStopDistance: aircraft.performances?.accelerateStopDistance || 450,
          landingDistance: aircraft.performances?.landingDistance || 630,
          landingDistanceFlapsUp: aircraft.performances?.landingDistanceFlapsUp || 800
        }
      });
    }
  }, [aircraft]);

  // Fonction pour calculer automatiquement la masse min décollage
  const getMinTakeoffWeight = () => {
    return formData.emptyWeight + 75; // Masse vide + 1 pilote minimum (75kg)
  };

  // Fonction de validation complète
  const validateForm = () => {
    const newErrors = {};
    const minTakeoffWeight = getMinTakeoffWeight();

    // Validation immatriculation
    if (!formData.registration) {
      newErrors.registration = "L'immatriculation est obligatoire";
    } else if (!/^[A-Z]-[A-Z0-9]{4}$/.test(formData.registration)) {
      newErrors.registration = "Format invalide (ex: F-ABCD)";
    }

    // Validation modèle
    if (!formData.model) {
      newErrors.model = "Le modèle d'avion est obligatoire";
    }

    // Validation des performances
    if (formData.cruiseSpeed <= 0) {
      newErrors.cruiseSpeed = "La vitesse de croisière doit être positive";
    }
    if (formData.serviceCeiling <= 0) {
      newErrors.serviceCeiling = "Le plafond pratique doit être positif";
    }

    // Validation carburant
    if (formData.fuelCapacity <= 0) {
      newErrors.fuelCapacity = "La capacité carburant doit être positive";
    }
    if (formData.fuelConsumption <= 0) {
      newErrors.fuelConsumption = "La consommation doit être positive";
    }

    // Validation des masses
    if (formData.emptyWeight <= 0) {
      newErrors.emptyWeight = "La masse à vide doit être positive";
    }
    if (formData.maxTakeoffWeight <= minTakeoffWeight) {
      newErrors.maxTakeoffWeight = `La MTOW doit être > masse min décollage (${minTakeoffWeight} kg)`;
    }
    if (formData.maxLandingWeight > formData.maxTakeoffWeight) {
      newErrors.maxLandingWeight = "La masse max atterrissage doit être ≤ MTOW";
    }
    if (formData.maxBaggageWeight < 0) {
      newErrors.maxBaggageWeight = "La masse max bagages ne peut pas être négative";
    }
    if (formData.maxAuxiliaryWeight < 0) {
      newErrors.maxAuxiliaryWeight = "La masse max auxiliaire ne peut pas être négative";
    }

    // Validation des bras de levier
    const wb = formData.weightBalance;
    if (wb.frontLeftSeatArm <= 0) newErrors.frontLeftSeatArm = "Le bras de levier doit être positif";
    if (wb.frontRightSeatArm <= 0) newErrors.frontRightSeatArm = "Le bras de levier doit être positif";
    if (wb.rearLeftSeatArm <= 0) newErrors.rearLeftSeatArm = "Le bras de levier doit être positif";
    if (wb.rearRightSeatArm <= 0) newErrors.rearRightSeatArm = "Le bras de levier doit être positif";
    if (wb.baggageArm <= 0) newErrors.baggageArm = "Le bras de levier doit être positif";
    if (wb.auxiliaryArm <= 0) newErrors.auxiliaryArm = "Le bras de levier doit être positif";
    if (wb.fuelArm <= 0) newErrors.fuelArm = "Le bras de levier doit être positif";
    if (wb.emptyWeightArm <= 0) newErrors.emptyWeightArm = "Le bras de levier doit être positif";

    // Validation des limites CG
    if (wb.cgLimits.forward <= 0) {
      newErrors.cgForward = "La limite CG avant doit être positive";
    }
    if (wb.cgLimits.aft <= wb.cgLimits.forward) {
      newErrors.cgAft = "La limite CG arrière doit être > limite avant";
    }

    // Validation des performances
    if (formData.performances.takeoffDistance <= 0) {
      newErrors.takeoffDistance = "La distance de décollage doit être positive";
    }
    if (formData.performances.accelerateStopDistance <= 0) {
      newErrors.accelerateStopDistance = "La distance accélération-arrêt doit être positive";
    }
    if (formData.performances.landingDistance <= 0) {
      newErrors.landingDistance = "La distance d'atterrissage doit être positive";
    }
    if (formData.performances.landingDistanceFlapsUp <= 0) {
      newErrors.landingDistanceFlapsUp = "La distance d'atterrissage volets UP doit être positive";
    }
    // Validation logique : la distance d'atterrissage volets UP doit être supérieure à celle avec volets
    if (formData.performances.landingDistanceFlapsUp <= formData.performances.landingDistance) {
      newErrors.landingDistanceFlapsUp = "La distance volets UP doit être supérieure à celle avec volets";
    }

    // Calculer les limites dynamiques pour la validation
    const maxAftLimit = wb.cgLimits.aftVariable && wb.cgLimits.aftVariable.length > 0 
      ? Math.max(...wb.cgLimits.aftVariable.map(p => p.cg), wb.cgLimits.aft)
      : wb.cgLimits.aft;
    
    const minForwardLimit = wb.cgLimits.forwardVariable && wb.cgLimits.forwardVariable.length > 0
      ? Math.min(...wb.cgLimits.forwardVariable.map(p => p.cg), wb.cgLimits.forward)  
      : wb.cgLimits.forward;

    // Validation des points variables avant
    wb.cgLimits.forwardVariable?.forEach((point, index) => {
      if (!point.weight || point.weight < minTakeoffWeight || point.weight > formData.maxTakeoffWeight) {
        newErrors[`forwardVariable_${index}_weight`] = `Masse invalide (${minTakeoffWeight}-${formData.maxTakeoffWeight} kg)`;
      }
      if (!point.cg || point.cg <= 0 || point.cg >= maxAftLimit) {
        newErrors[`forwardVariable_${index}_cg`] = `CG invalide (0-${maxAftLimit.toFixed(2)} m)`;
      }
    });

    // Validation des points variables arrière
    wb.cgLimits.aftVariable?.forEach((point, index) => {
      if (!point.weight || point.weight < minTakeoffWeight || point.weight > formData.maxTakeoffWeight) {
        newErrors[`aftVariable_${index}_weight`] = `Masse invalide (${minTakeoffWeight}-${formData.maxTakeoffWeight} kg)`;
      }
      if (!point.cg || point.cg <= minForwardLimit || point.cg > 5) {
        newErrors[`aftVariable_${index}_cg`] = `CG invalide (${minForwardLimit.toFixed(2)}-5 m)`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
      // Gestion des champs imbriqués (ex: weightBalance.frontLeftSeatArm, performances.takeoffDistance)
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      } else if (parts.length === 3) {
        const [parent, child, subchild] = parts;
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

    // Effacer l'erreur pour ce champ s'il y en avait une
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validation du formulaire
  const isValid = () => {
    return validateForm();
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
        // S'assurer que les performances sont incluses
        performances: {
          ...formData.performances
        },
        // Ajouter la config si elle n'existe pas
        config: aircraft?.config || {
          maxTakeoffWeight: formData.maxTakeoffWeight,
          minTakeoffWeight: getMinTakeoffWeight(),
          maxLandingWeight: formData.maxLandingWeight,
          emptyWeight: formData.emptyWeight,
          fuelCapacity: formData.fuelCapacity,
          fuelDensity: formData.fuelType === 'JET A-1' ? 0.84 : 0.72,
          takeoff: {
            baseDistance: formData.performances.takeoffDistance, // Utiliser la valeur saisie
            altitudeFactor: 0.10, tempFactor: 0.015,
            weightFactor: -0.008, windInterval: 10, headwindFactor: -0.10,
            tailwindFactor: 0.15, wetRunwayFactor: 1.15, slopeFactor: 0.10, groundRatio: 0.60
          },
          landing: {
            baseDistance: formData.performances.landingDistance, // Utiliser la valeur saisie
            altitudeFactor: 0.05, tempFactor: 0.010,
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

  const inputErrorStyle = {
    ...inputStyle,
    border: '2px solid #ef4444',
    backgroundColor: '#fef2f2'
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

  const errorStyle = {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  // Compter le nombre d'erreurs total
  const errorCount = Object.keys(errors).length;

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

        {/* Affichage des erreurs globales */}
        {errorCount > 0 && (
          <div style={{
            margin: '24px',
            padding: '16px',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            border: '2px solid #fecaca'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <AlertTriangle size={20} style={{ color: '#ef4444' }} />
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#dc2626', 
                margin: 0 
              }}>
                {errorCount} erreur{errorCount > 1 ? 's' : ''} {errorCount > 1 ? 'empêchent' : 'empêche'} l'enregistrement
              </h3>
            </div>
            <p style={{ 
              fontSize: '14px', 
              color: '#991b1b', 
              margin: '0 0 8px 0' 
            }}>
              Veuillez corriger les champs marqués en rouge ci-dessous :
            </p>
            <ul style={{ 
              fontSize: '13px', 
              color: '#991b1b', 
              margin: 0, 
              paddingLeft: '20px' 
            }}>
              {Object.entries(errors).map(([field, message]) => (
                <li key={field} style={{ marginBottom: '4px' }}>
                  <strong>
                    {field.includes('takeoffDistance') ? 'Distance de décollage' :
                     field.includes('accelerateStopDistance') ? 'Distance accélération-arrêt' :
                     field.includes('landingDistance') && !field.includes('FlapsUp') ? "Distance d'atterrissage" :
                     field.includes('landingDistanceFlapsUp') ? "Distance d'atterrissage volets UP" :
                     field.includes('forwardVariable') ? 'Limite avant variable' :
                     field.includes('aftVariable') ? 'Limite arrière variable' :
                     field.charAt(0).toUpperCase() + field.slice(1)
                    } :</strong> {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Informations générales */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plane size={20} />
              Informations générales (General Information)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Immatriculation (Registration) *</label>
                <input
                  type="text"
                  value={formData.registration}
                  onChange={(e) => handleChange('registration', e.target.value.toUpperCase())}
                  style={errors.registration ? inputErrorStyle : inputStyle}
                  placeholder="F-ABCD"
                  required
                />
                {errors.registration && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.registration}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Modèle (Aircraft Model) *</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  style={errors.model ? inputErrorStyle : inputStyle}
                  placeholder="Cessna 172"
                  required
                />
                {errors.model && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.model}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Performances */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} />
              Performances (Performance)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Vitesse de croisière (Cruise Speed - km/h)</label>
                <input
                  type="number"
                  value={formData.cruiseSpeed}
                  onChange={(e) => handleChange('cruiseSpeed', parseFloat(e.target.value) || 0)}
                  style={errors.cruiseSpeed ? inputErrorStyle : inputStyle}
                />
                {errors.cruiseSpeed && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.cruiseSpeed}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Vitesse de croisière (Cruise Speed - kt)</label>
                <input
                  type="number"
                  value={formData.cruiseSpeedKt}
                  onChange={(e) => handleChange('cruiseSpeedKt', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Plafond pratique (Service Ceiling - ft)</label>
                <input
                  type="number"
                  value={formData.serviceCeiling}
                  onChange={(e) => handleChange('serviceCeiling', parseInt(e.target.value) || 0)}
                  style={errors.serviceCeiling ? inputErrorStyle : inputStyle}
                />
                {errors.serviceCeiling && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.serviceCeiling}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Carburant */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fuel size={20} />
              Carburant (Fuel)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Type de carburant (Fuel Type)</label>
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
                <label style={labelStyle}>Capacité (Fuel Capacity - L)</label>
                <input
                  type="number"
                  value={formData.fuelCapacity}
                  onChange={(e) => handleChange('fuelCapacity', parseFloat(e.target.value) || 0)}
                  style={errors.fuelCapacity ? inputErrorStyle : inputStyle}
                />
                {errors.fuelCapacity && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.fuelCapacity}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Capacité (Fuel Capacity - Gal)</label>
                <input
                  type="number"
                  value={formData.fuelCapacityGal}
                  onChange={(e) => handleChange('fuelCapacityGal', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                  step="0.1"
                />
              </div>
              <div>
                <label style={labelStyle}>Consommation (Fuel Consumption - L/h)</label>
                <input
                  type="number"
                  value={formData.fuelConsumption}
                  onChange={(e) => handleChange('fuelConsumption', parseFloat(e.target.value) || 0)}
                  style={errors.fuelConsumption ? inputErrorStyle : inputStyle}
                />
                {errors.fuelConsumption && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.fuelConsumption}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Consommation (Fuel Consumption - Gal/h)</label>
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
              Masses (Weight & Balance)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Masse à vide (Empty Weight - kg)</label>
                <input
                  type="number"
                  value={formData.emptyWeight}
                  onChange={(e) => handleChange('emptyWeight', parseInt(e.target.value) || 0)}
                  style={errors.emptyWeight ? inputErrorStyle : inputStyle}
                  min="50"
                />
                {errors.emptyWeight && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.emptyWeight}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  💡 Masse min décollage : {getMinTakeoffWeight()} kg (masse vide + 75 kg)
                </div>
              </div>
              <div>
                <label style={labelStyle}>MTOW (Max Takeoff Weight - kg)</label>
                <input
                  type="number"
                  value={formData.maxTakeoffWeight}
                  onChange={(e) => handleChange('maxTakeoffWeight', parseInt(e.target.value) || 0)}
                  style={errors.maxTakeoffWeight ? inputErrorStyle : inputStyle}
                />
                {errors.maxTakeoffWeight && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.maxTakeoffWeight}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Masse max atterrissage (Max Landing Weight - kg)</label>
                <input
                  type="number"
                  value={formData.maxLandingWeight}
                  onChange={(e) => handleChange('maxLandingWeight', parseInt(e.target.value) || 0)}
                  style={errors.maxLandingWeight ? inputErrorStyle : inputStyle}
                />
                {errors.maxLandingWeight && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.maxLandingWeight}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Max bagages (Max Baggage Weight - kg)</label>
                <input
                  type="number"
                  value={formData.maxBaggageWeight}
                  onChange={(e) => handleChange('maxBaggageWeight', parseInt(e.target.value) || 0)}
                  style={errors.maxBaggageWeight ? inputErrorStyle : inputStyle}
                />
                {errors.maxBaggageWeight && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.maxBaggageWeight}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Max auxiliaire (Max Auxiliary Weight - kg)</label>
                <input
                  type="number"
                  value={formData.maxAuxiliaryWeight}
                  onChange={(e) => handleChange('maxAuxiliaryWeight', parseInt(e.target.value) || 0)}
                  style={errors.maxAuxiliaryWeight ? inputErrorStyle : inputStyle}
                />
                {errors.maxAuxiliaryWeight && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.maxAuxiliaryWeight}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bras de levier */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              📐 Bras de levier (Arms)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Siège avant gauche (Front Left Seat Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.frontLeftSeatArm}
                  onChange={(e) => handleChange('weightBalance.frontLeftSeatArm', parseFloat(e.target.value) || 0)}
                  style={errors.frontLeftSeatArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.frontLeftSeatArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.frontLeftSeatArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Siège avant droit (Front Right Seat Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.frontRightSeatArm}
                  onChange={(e) => handleChange('weightBalance.frontRightSeatArm', parseFloat(e.target.value) || 0)}
                  style={errors.frontRightSeatArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.frontRightSeatArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.frontRightSeatArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Siège arrière gauche (Rear Left Seat Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.rearLeftSeatArm}
                  onChange={(e) => handleChange('weightBalance.rearLeftSeatArm', parseFloat(e.target.value) || 0)}
                  style={errors.rearLeftSeatArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.rearLeftSeatArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.rearLeftSeatArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Siège arrière droit (Rear Right Seat Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.rearRightSeatArm}
                  onChange={(e) => handleChange('weightBalance.rearRightSeatArm', parseFloat(e.target.value) || 0)}
                  style={errors.rearRightSeatArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.rearRightSeatArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.rearRightSeatArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Bagages (Baggage Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.baggageArm}
                  onChange={(e) => handleChange('weightBalance.baggageArm', parseFloat(e.target.value) || 0)}
                  style={errors.baggageArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.baggageArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.baggageArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Auxiliaire (Auxiliary Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.auxiliaryArm}
                  onChange={(e) => handleChange('weightBalance.auxiliaryArm', parseFloat(e.target.value) || 0)}
                  style={errors.auxiliaryArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.auxiliaryArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.auxiliaryArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Carburant (Fuel Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.fuelArm}
                  onChange={(e) => handleChange('weightBalance.fuelArm', parseFloat(e.target.value) || 0)}
                  style={errors.fuelArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.fuelArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.fuelArm}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Masse à vide (Empty Weight Arm)</label>
                <input
                  type="number"
                  value={formData.weightBalance.emptyWeightArm}
                  onChange={(e) => handleChange('weightBalance.emptyWeightArm', parseFloat(e.target.value) || 0)}
                  style={errors.emptyWeightArm ? inputErrorStyle : inputStyle}
                  step="0.01"
                />
                {errors.emptyWeightArm && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.emptyWeightArm}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Limites CG */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              ⚖️ Limites de centrage (CG Limits)
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
                📊 Limites avant variables (Forward Variable Limits)
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
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Masse (Weight - kg)</label>
                            <input
                              type="number"
                              value={point.weight || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.forwardVariable];
                                newPoints[index] = { ...newPoints[index], weight: parseInt(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.forwardVariable', newPoints);
                              }}
                              style={errors[`forwardVariable_${index}_weight`] ? inputErrorStyle : { ...inputStyle, fontSize: '14px' }}
                              min={getMinTakeoffWeight()}
                              max={formData.maxTakeoffWeight}
                            />
                            {errors[`forwardVariable_${index}_weight`] && (
                              <div style={errorStyle}>
                                <AlertTriangle size={12} />
                                {errors[`forwardVariable_${index}_weight`]}
                              </div>
                            )}
                          </div>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Limite CG avant (Forward CG Limit - m)</label>
                            <input
                              type="number"
                              value={point.cg || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.forwardVariable];
                                newPoints[index] = { ...newPoints[index], cg: parseFloat(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.forwardVariable', newPoints);
                              }}
                              style={errors[`forwardVariable_${index}_cg`] ? inputErrorStyle : { ...inputStyle, fontSize: '14px' }}
                              step="0.01"
                              min="0"
                              max={formData.weightBalance.cgLimits.aftVariable && formData.weightBalance.cgLimits.aftVariable.length > 0 
                                ? Math.max(...formData.weightBalance.cgLimits.aftVariable.map(p => p.cg), formData.weightBalance.cgLimits.aft)
                                : formData.weightBalance.cgLimits.aft}
                            />
                            {errors[`forwardVariable_${index}_cg`] && (
                              <div style={errorStyle}>
                                <AlertTriangle size={12} />
                                {errors[`forwardVariable_${index}_cg`]}
                              </div>
                            )}
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
                    : getMinTakeoffWeight();
                  
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
            </div>

            {/* Limites arrière variables */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
                📊 Limites arrière variables (Aft Variable Limits)
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
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Masse (Weight - kg)</label>
                            <input
                              type="number"
                              value={point.weight || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.aftVariable];
                                newPoints[index] = { ...newPoints[index], weight: parseInt(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.aftVariable', newPoints);
                              }}
                              style={errors[`aftVariable_${index}_weight`] ? inputErrorStyle : { ...inputStyle, fontSize: '14px' }}
                              min={getMinTakeoffWeight()}
                              max={formData.maxTakeoffWeight}
                            />
                            {errors[`aftVariable_${index}_weight`] && (
                              <div style={errorStyle}>
                                <AlertTriangle size={12} />
                                {errors[`aftVariable_${index}_weight`]}
                              </div>
                            )}
                          </div>
                          <div style={fieldStyle}>
                            <label style={{ ...labelStyle, fontSize: '12px' }}>Limite CG arrière (Aft CG Limit - m)</label>
                            <input
                              type="number"
                              value={point.cg || ''}
                              onChange={(e) => {
                                const newPoints = [...formData.weightBalance.cgLimits.aftVariable];
                                newPoints[index] = { ...newPoints[index], cg: parseFloat(e.target.value) || 0 };
                                handleChange('weightBalance.cgLimits.aftVariable', newPoints);
                              }}
                              style={errors[`aftVariable_${index}_cg`] ? inputErrorStyle : { ...inputStyle, fontSize: '14px' }}
                              step="0.01"
                              min={formData.weightBalance.cgLimits.forwardVariable && formData.weightBalance.cgLimits.forwardVariable.length > 0
                                ? Math.min(...formData.weightBalance.cgLimits.forwardVariable.map(p => p.cg), formData.weightBalance.cgLimits.forward)
                                : formData.weightBalance.cgLimits.forward}
                              max="5"
                            />
                            {errors[`aftVariable_${index}_cg`] && (
                              <div style={errorStyle}>
                                <AlertTriangle size={12} />
                                {errors[`aftVariable_${index}_cg`]}
                              </div>
                            )}
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
                    : getMinTakeoffWeight();
                  
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

            {/* Graphique de l'enveloppe */}
            {(formData.weightBalance.cgLimits.forwardVariable?.length > 0 || 
              formData.weightBalance.cgLimits.aftVariable?.length > 0) && (
              <div style={{ 
                marginTop: '32px',
                padding: '16px',
                backgroundColor: '#eff6ff',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e40af'
              }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: '600' }}>
                  💡 Aperçu de l'enveloppe de centrage :
                </p>
                <p style={{ margin: '4px 0 16px 0' }}>
                  L'enveloppe sera automatiquement adaptée avec interpolation entre les points définis
                </p>
                
                {/* Mini aperçu de l'enveloppe */}
                <div style={{ marginTop: '12px' }}>
                  <svg viewBox="0 0 300 200" style={{ width: '100%', maxWidth: '300px', height: '150px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white' }}>
                    {/* Axes */}
                    <line x1="30" y1="170" x2="270" y2="170" stroke="#374151" strokeWidth="1" />
                    <line x1="30" y1="30" x2="30" y2="170" stroke="#374151" strokeWidth="1" />
                    
                    {/* Labels */}
                    <text x="150" y="190" textAnchor="middle" fontSize="10" fill="#6b7280">CG (m)</text>
                    <text x="10" y="100" textAnchor="middle" fontSize="10" fill="#6b7280" transform="rotate(-90 10 100)">Masse (kg)</text>
                    
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
                      const weightMin = getMinTakeoffWeight();
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
                    • Points <span style={{ color: '#3b82f6', fontWeight: '600' }}>bleus</span> : limites avant variables (forward variable limits)<br/>
                    • Points <span style={{ color: '#ef4444', fontWeight: '600' }}>rouges</span> : limites arrière variables (aft variable limits)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section Performances de vol */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} />
              Performances de vol (Flight Performance)
            </h3>
            
            {/* Note explicative */}
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#e0f2fe',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c4a6e',
              border: '1px solid #bae6fd'
            }}>
              <p style={{ margin: '0', fontWeight: '600' }}>
                📚 Configuration des performances de référence :
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                Ces valeurs correspondent aux <strong>performances standard</strong> de l'avion dans les conditions ISA au niveau de la mer.<br/>
                Elles serviront de base pour les calculs d'abaques avec corrections (altitude, température, vent, piste).
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Distance de décollage */}
              <div>
                <label style={labelStyle}>
                  Distance de décollage - TOD (Take-off Distance Over 50ft) *
                </label>
                <input
                  type="number"
                  value={formData.performances.takeoffDistance}
                  onChange={(e) => handleChange('performances.takeoffDistance', parseInt(e.target.value) || 0)}
                  style={errors.takeoffDistance ? inputErrorStyle : inputStyle}
                  placeholder="385"
                  min="1"
                />
                {errors.takeoffDistance && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.takeoffDistance}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={10} /> Distance totale nécessaire pour décoller et passer un obstacle de 50ft (15m)
                </div>
              </div>
              
              {/* Distance accélération-arrêt */}
              <div>
                <label style={labelStyle}>
                  Distance accélération-arrêt - ASD (Accelerate-Stop Distance) *
                </label>
                <input
                  type="number"
                  value={formData.performances.accelerateStopDistance}
                  onChange={(e) => handleChange('performances.accelerateStopDistance', parseInt(e.target.value) || 0)}
                  style={errors.accelerateStopDistance ? inputErrorStyle : inputStyle}
                  placeholder="450"
                  min="1"
                />
                {errors.accelerateStopDistance && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.accelerateStopDistance}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={10} /> Distance pour accélérer jusqu'à V1 puis s'arrêter en cas d'interruption
                </div>
              </div>
              
              {/* Distance d'atterrissage */}
              <div>
                <label style={labelStyle}>
                  Distance d'atterrissage - LD (Landing Distance / Flaps LDG) *
                </label>
                <input
                  type="number"
                  value={formData.performances.landingDistance}
                  onChange={(e) => handleChange('performances.landingDistance', parseInt(e.target.value) || 0)}
                  style={errors.landingDistance ? inputErrorStyle : inputStyle}
                  placeholder="630"
                  min="1"
                />
                {errors.landingDistance && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.landingDistance}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={10} /> Distance depuis 50ft jusqu'à l'arrêt complet avec volets en position atterrissage
                </div>
              </div>
              
              {/* Distance d'atterrissage volets UP */}
              <div>
                <label style={labelStyle}>
                  Distance d'atterrissage volets UP (Landing Distance / Flaps UP) *
                </label>
                <input
                  type="number"
                  value={formData.performances.landingDistanceFlapsUp}
                  onChange={(e) => handleChange('performances.landingDistanceFlapsUp', parseInt(e.target.value) || 0)}
                  style={errors.landingDistanceFlapsUp ? inputErrorStyle : inputStyle}
                  placeholder="800"
                  min="1"
                />
                {errors.landingDistanceFlapsUp && (
                  <div style={errorStyle}>
                    <AlertTriangle size={14} />
                    {errors.landingDistanceFlapsUp}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={10} /> Distance d'atterrissage sans volets (configuration d'urgence)
                </div>
              </div>
            </div>
            
            {/* Informations supplémentaires */}
            <div style={{ 
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#92400e'
            }}>
              <p style={{ margin: '0', fontWeight: '600' }}>
                ⚠️ Important :
              </p>
              <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
                <li>Toutes les distances sont exprimées en <strong>mètres (m)</strong></li>
                <li>Ces valeurs correspondent aux conditions <strong>ISA standard</strong> (15°C au niveau de la mer)</li>
                <li>Masse de référence : <strong>MTOW</strong> pour le décollage, <strong>MLW</strong> pour l'atterrissage</li>
                <li>Piste : sèche, en dur, sans pente, sans vent</li>
                <li>Consultez le manuel de vol pour les valeurs exactes de votre appareil</li>
              </ul>
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
              disabled={errorCount > 0}
              style={{
                padding: '10px 24px',
                backgroundColor: errorCount > 0 ? '#ef4444' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: errorCount > 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: errorCount > 0 ? 0.7 : 1
              }}
              title={errorCount > 0 ? `${errorCount} erreur${errorCount > 1 ? 's' : ''} à corriger` : ''}
            >
              <Save size={20} />
              {errorCount > 0 ? `${errorCount} erreur${errorCount > 1 ? 's' : ''} à corriger` : (aircraft ? 'Enregistrer les modifications' : 'Ajouter l\'avion')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};