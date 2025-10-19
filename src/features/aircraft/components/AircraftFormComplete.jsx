// src/features/aircraft/components/AircraftFormComplete.jsx
import React, { memo, useState, useEffect } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { ChevronDown, ChevronRight, Upload, FileText } from 'lucide-react';
import AdvancedPerformanceAnalyzer from './AdvancedPerformanceAnalyzer';
import performanceDataManager from '../../../utils/performanceDataManager';
import SpeedLimitationChart from './SpeedLimitationChart';
import CGEnvelopeChart from './CGEnvelopeChart';

// Composant InfoIcon pour les tooltips
const InfoIcon = memo(({ tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <span 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        marginLeft: '4px',
        alignItems: 'center'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      ℹ️
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '0',
          backgroundColor: '#1F2937',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.4',
          zIndex: 10000,
          minWidth: '180px',
          maxWidth: '280px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {tooltip}
        </div>
      )}
    </span>

});

InfoIcon.displayName = 'InfoIcon';

const AircraftFormComplete = memo(({ aircraft, onSubmit, onCancel, onOpenManexImporter }) => {
  useUnitsWatcher();
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();

  // Test de logging Google Sheets
  useEffect(() => {
    if (window.sheetsLogger) {
      window.sheetsLogger.log(
        'Test Google Sheets',
        'Formulaire avion chargé avec succès',
        {
          component: 'AircraftFormComplete',
          timestamp: new Date().toISOString(),
          details: 'Test de vérification du système de logging automatique'
        }
    }
  }, []);
  
  // États pour les sections collapsibles
  const [showGeneral, setShowGeneral] = useState(true);
  const [showPerformances, setShowPerformances] = useState(false);
  const [showMasseCentrage, setShowMasseCentrage] = useState(false);
  const [showEquipements, setShowEquipements] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showRemarques, setShowRemarques] = useState(false);
  const [showPerformancesIA, setShowPerformancesIA] = useState(false);
  
  // État du formulaire
  const [formData, setFormData] = useState({
    registration: '',
    type: '',
    model: '',
    year: '',
    serialNumber: '',
    mtow: '',
    mlw: '',
    mzfw: '',
    basicEmptyWeight: '',
    maxFuel: '',
    usableFuel: '',
    fuelType: '',
    cruiseSpeed: '',
    vne: '',
    vno: '',
    vfe: '',
    vs0: '',
    vs1: '',
    vx: '',
    vy: '',
    va: '',
    vapp: '',
    vle: '',
    vlo: ''
    servicesCeiling: '',
    range: '',
    endurance: '',
    takeoffDistance15m: '',
    takeoffDistance50ft: '',
    landingDistance15m: '',
    landingDistance50ft: '',
    climbRate: '',
    glideRatio: '',
    maxCrosswind: '',
    maxTailwind: '',
    engineType: '',
    engineModel: '',
    propellerType: '',
    propellerModel: '',
    avionicsType: '',
    autopilot: '',
    equipmentCOM: '',
    equipmentNAV: '',
    equipmentSurveillance: '',
    specialEquipment: '',
    compatibleRunwaySurfaces: [],
    minimumRunwayLength: '',
    remarks: '',
    photo: null,
    manex: null,
    advancedPerformance: null,
    // Masses et bras de levier
    emptyWeightCG: '',
    fuelArmForward: '',
    fuelArmAft: '',
    baggageCompartments: [],
    // Enveloppe CG
    cgEnvelope: {
      forward: [],
      aft: []
    },
    ...aircraft
  });
  
  useEffect(() => {
    if (aircraft) {
      setFormData(prev => ({ ...prev, ...aircraft }));
    }
  }, [aircraft]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    
    // Convertir les valeurs au format de stockage
    const dataToSubmit = {
      ...formData,
      // Conversion des vitesses
      cruiseSpeed: toStorage(formData.cruiseSpeed, 'speed'),
      vne: toStorage(formData.vne, 'speed'),
      vno: toStorage(formData.vno, 'speed'),
      vfe: toStorage(formData.vfe, 'speed'),
      vs0: toStorage(formData.vs0, 'speed'),
      vs1: toStorage(formData.vs1, 'speed'),
      vx: toStorage(formData.vx, 'speed'),
      vy: toStorage(formData.vy, 'speed'),
      va: toStorage(formData.va, 'speed'),
      vapp: toStorage(formData.vapp, 'speed'),
      vle: toStorage(formData.vle, 'speed'),
      vlo: toStorage(formData.vlo, 'speed'),
      // Conversion des masses
      mtow: toStorage(formData.mtow, 'mass'),
      mlw: toStorage(formData.mlw, 'mass'),
      mzfw: toStorage(formData.mzfw, 'mass'),
      basicEmptyWeight: toStorage(formData.basicEmptyWeight, 'mass'),
      // Conversion des distances
      takeoffDistance15m: toStorage(formData.takeoffDistance15m, 'distance'),
      takeoffDistance50ft: toStorage(formData.takeoffDistance50ft, 'distance'),
      landingDistance15m: toStorage(formData.landingDistance15m, 'distance'),
      landingDistance50ft: toStorage(formData.landingDistance50ft, 'distance'),
      minimumRunwayLength: toStorage(formData.minimumRunwayLength, 'distance'),
      // Conversion du taux de montée
      climbRate: toStorage(formData.climbRate, 'climbRate'),
      // Conversion des vents
      maxCrosswind: toStorage(formData.maxCrosswind, 'speed'),
      maxTailwind: toStorage(formData.maxTailwind, 'speed'),
    };
    
    onSubmit(dataToSubmit);
  };
  
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La photo ne doit pas dépasser 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({ ...prev, photo: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSurfaceChange = (surface) => {
    const surfaces = formData.compatibleRunwaySurfaces || [];
    const newSurfaces = surfaces.includes(surface)
      ? surfaces.filter(s => s !== surface)
      : [...surfaces, surface];
    
    setFormData(prev => ({
      ...prev,
      compatibleRunwaySurfaces: newSurfaces
    }));
  };
  
  // Styles pour les sections
  const sectionButtonStyle = (isOpen) => ({
    width: '100%',
    padding: '12px',
    backgroundColor: isOpen ? '#e5e7eb' : '#f3f4f6',
    color: '#000000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  });
  
  const sectionContentStyle = {
    marginTop: '16px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  };
  
  const inputGroupStyle = {
    marginBottom: '16px'
  };
  
  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  };
  
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  };

  return (
    <form onSubmit={handleSubmit} style={{ color: '#000000' }}>
      {/* Section Général */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowGeneral(!showGeneral)}
          style={sectionButtonStyle(showGeneral)}
        >
          {showGeneral ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          📋 Informations Générales
        </button>
        
        {showGeneral && (
          <div style={sectionContentStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Immatriculation *
                  <InfoIcon tooltip="Numéro d'immatriculation de l'aéronef (ex: F-ABCD)" />
                </label>
                <input
                  type="text"
                  name="registration"
                  value={formData.registration}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Type d'aéronef *</label>
                <input
                  type="text"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Modèle</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Année</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Numéro de série</label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Photo de l'aéronef</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={inputStyle}
                />
                {formData.photo && (
                  <img 
                    src={formData.photo} 
                    alt="Aircraft" 
                    style={{ marginTop: '8px', maxWidth: '100px', borderRadius: '4px' }}
                  />
                )}
              </div>
            </div>
            
            {/* Import MANEX */}
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={onOpenManexImporter}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                <FileText size={20} style={{ marginRight: '8px' }} />
                Importer le Manuel d'Exploitation (MANEX)
              </button>
              {formData.manex && (
                <span style={{ marginLeft: '12px', color: '#10B981' }}>
                  ✅ MANEX importé
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section Vitesses et Limitations */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowPerformances(!showPerformances)}
          style={sectionButtonStyle(showPerformances)}
        >
          {showPerformances ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          ✈️ Vitesses et Limitations
        </button>
        
        {showPerformances && (
          <div style={sectionContentStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {/* Vitesses de décrochage */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VSO (Volets sortis) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse de décrochage en configuration atterrissage" />
                </label>
                <input
                  type="number"
                  name="vs0"
                  value={format(formData.vs0, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VS1 (Lisse) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse de décrochage en configuration lisse" />
                </label>
                <input
                  type="number"
                  name="vs1"
                  value={format(formData.vs1, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              {/* Vitesses de montée */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VX (Pente max) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse de meilleur angle de montée" />
                </label>
                <input
                  type="number"
                  name="vx"
                  value={format(formData.vx, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VY (Taux max) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse de meilleur taux de montée" />
                </label>
                <input
                  type="number"
                  name="vy"
                  value={format(formData.vy, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              {/* Vitesses limites */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VFE (Volets) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse maximale volets sortis" />
                </label>
                <input
                  type="number"
                  name="vfe"
                  value={format(formData.vfe, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VA (Manœuvre) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse de manœuvre" />
                </label>
                <input
                  type="number"
                  name="va"
                  value={format(formData.va, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VApp (Approche) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse d'approche" />
                </label>
                <input
                  type="number"
                  name="vapp"
                  value={format(formData.vapp, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VNO (Normale) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse maximale de croisière structurale" />
                </label>
                <input
                  type="number"
                  name="vno"
                  value={format(formData.vno, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VNE (Jamais dépasser) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse à ne jamais dépasser" />
                </label>
                <input
                  type="number"
                  name="vne"
                  value={format(formData.vne, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              {/* Vitesses train (si applicable) */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VLE (Train sorti) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse maximale train sorti" />
                </label>
                <input
                  type="number"
                  name="vle"
                  value={format(formData.vle, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Si applicable"
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  VLO (Manœuvre train) {getSymbol('speed')}
                  <InfoIcon tooltip="Vitesse maximale pour manœuvrer le train" />
                </label>
                <input
                  type="number"
                  name="vlo"
                  value={format(formData.vlo, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Si applicable"
                />
              </div>
              
              {/* Performances */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Vitesse de croisière {getSymbol('speed')}
                </label>
                <input
                  type="number"
                  name="cruiseSpeed"
                  value={format(formData.cruiseSpeed, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Taux de montée {getSymbol('climbRate')}
                </label>
                <input
                  type="number"
                  name="climbRate"
                  value={format(formData.climbRate, 'climbRate')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Plafond pratique {getSymbol('altitude')}
                </label>
                <input
                  type="number"
                  name="servicesCeiling"
                  value={format(formData.servicesCeiling, 'altitude')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              {/* Distances */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Distance décollage (15m) {getSymbol('distance')}
                </label>
                <input
                  type="number"
                  name="takeoffDistance15m"
                  value={format(formData.takeoffDistance15m, 'distance')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Distance décollage (50ft) {getSymbol('distance')}
                </label>
                <input
                  type="number"
                  name="takeoffDistance50ft"
                  value={format(formData.takeoffDistance50ft, 'distance')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Distance atterrissage (15m) {getSymbol('distance')}
                </label>
                <input
                  type="number"
                  name="landingDistance15m"
                  value={format(formData.landingDistance15m, 'distance')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Distance atterrissage (50ft) {getSymbol('distance')}
                </label>
                <input
                  type="number"
                  name="landingDistance50ft"
                  value={format(formData.landingDistance50ft, 'distance')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              {/* Limitations vent */}
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Vent traversier max {getSymbol('speed')}
                </label>
                <input
                  type="number"
                  name="maxCrosswind"
                  value={format(formData.maxCrosswind, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Vent arrière max {getSymbol('speed')}
                </label>
                <input
                  type="number"
                  name="maxTailwind"
                  value={format(formData.maxTailwind, 'speed')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>
            
            {/* Graphique de limitation des vitesses */}
            <SpeedLimitationChart speeds={{
              vso: toStorage(formData.vs0, 'speed'),
              vs1: toStorage(formData.vs1, 'speed'),
              vfe: toStorage(formData.vfe, 'speed'),
              vfeLdg: toStorage(formData.vfe, 'speed'),
              vfeTO: toStorage(formData.vfe, 'speed'),
              vno: toStorage(formData.vno, 'speed'),
              vne: toStorage(formData.vne, 'speed'),
              voSpeed1: toStorage(formData.va, 'speed')
            }} />
          </div>
        )}
      </div>

      {/* Section Masse & Centrage */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowMasseCentrage(!showMasseCentrage)}
          style={sectionButtonStyle(showMasseCentrage)}
        >
          {showMasseCentrage ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          ⚖️ Masse & Centrage
        </button>
        
        {showMasseCentrage && (
          <div style={sectionContentStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  MTOW {getSymbol('mass')}
                  <InfoIcon tooltip="Masse maximale au décollage" />
                </label>
                <input
                  type="number"
                  name="mtow"
                  value={format(formData.mtow, 'mass')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  MLW {getSymbol('mass')}
                  <InfoIcon tooltip="Masse maximale à l'atterrissage" />
                </label>
                <input
                  type="number"
                  name="mlw"
                  value={format(formData.mlw, 'mass')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  MZFW {getSymbol('mass')}
                  <InfoIcon tooltip="Masse maximale sans carburant" />
                </label>
                <input
                  type="number"
                  name="mzfw"
                  value={format(formData.mzfw, 'mass')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Masse à vide {getSymbol('mass')}
                </label>
                <input
                  type="number"
                  name="basicEmptyWeight"
                  value={format(formData.basicEmptyWeight, 'mass')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  CG à vide (mm)
                </label>
                <input
                  type="number"
                  name="emptyWeightCG"
                  value={formData.emptyWeightCG}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>
            
            {/* Graphique d'enveloppe de centrage */}
            <CGEnvelopeChart 
              cgEnvelope={formData.cgEnvelope || {
                forwardPoints: [],
                aftMinWeight: '',
                aftCG: '',
                aftMaxWeight: ''
              }} 
              massUnit={getSymbol('mass')} 
            />
          </div>
        )}
      </div>

      {/* Autres sections suivront le même pattern */}
      {/* Pour l'instant, je vais simplifier les autres sections */}

      {/* Section Équipements */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowEquipements(!showEquipements)}
          style={sectionButtonStyle(showEquipements)}
        >
          {showEquipements ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          🛠️ Équipements
        </button>
        
        {showEquipements && (
          <div style={sectionContentStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Équipements COM</label>
                <textarea
                  name="equipmentCOM"
                  value={formData.equipmentCOM}
                  onChange={handleChange}
                  rows="3"
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Équipements NAV</label>
                <textarea
                  name="equipmentNAV"
                  value={formData.equipmentNAV}
                  onChange={handleChange}
                  rows="3"
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Équipements Surveillance</label>
                <textarea
                  name="equipmentSurveillance"
                  value={formData.equipmentSurveillance}
                  onChange={handleChange}
                  rows="3"
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Équipements Spéciaux</label>
                <textarea
                  name="specialEquipment"
                  value={formData.specialEquipment}
                  onChange={handleChange}
                  rows="3"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section Opérations */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowOperations(!showOperations)}
          style={sectionButtonStyle(showOperations)}
        >
          {showOperations ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          🛫 Opérations
        </button>
        
        {showOperations && (
          <div style={sectionContentStyle}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Surfaces de piste compatibles</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['Bitume', 'Herbe', 'Gravier', 'Terre', 'Neige', 'Eau'].map(surface => (
                  <label key={surface} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.compatibleRunwaySurfaces?.includes(surface) || false}
                      onChange={() => handleSurfaceChange(surface)}
                      style={{ marginRight: '4px' }}
                    />
                    {surface}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>
                  Longueur piste minimale {getSymbol('distance')}
                </label>
                <input
                  type="number"
                  name="minimumRunwayLength"
                  value={format(formData.minimumRunwayLength, 'distance')}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
              
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Type de carburant</label>
                <select
                  name="fuelType"
                  value={formData.fuelType}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Sélectionner...</option>
                  <option value="AVGAS 100LL">AVGAS 100LL</option>
                  <option value="JET A1">JET A1</option>
                  <option value="MOGAS">MOGAS</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section Remarques */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowRemarques(!showRemarques)}
          style={sectionButtonStyle(showRemarques)}
        >
          {showRemarques ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          📋 Remarques
        </button>
        
        {showRemarques && (
          <div style={sectionContentStyle}>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="5"
              placeholder="Notes additionnelles..."
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {/* Section Performances IA */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowPerformancesIA(!showPerformancesIA)}
          style={sectionButtonStyle(showPerformancesIA)}
        >
          {showPerformancesIA ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          🤖 Performances IA
        </button>
        
        {showPerformancesIA && (
          <div style={sectionContentStyle}>
            <AdvancedPerformanceAnalyzer 
              aircraft={{
                ...formData,
                id: aircraft?.id,
                performance: aircraft?.performance,
                advancedPerformance: aircraft?.advancedPerformance
              }}
              onPerformanceUpdate={async (performanceData) => {
                
                
                try {
                  if (aircraft?.id) {
                    await performanceDataManager.storePerformanceData(aircraft.id, performanceData);
                    
                  }
                  
                  setFormData(prev => ({
                    ...prev,
                    advancedPerformance: performanceData.advancedPerformance
                  }));
                } catch (error) {
                  console.error('❌ Erreur lors de la sauvegarde des performances:', error);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '12px', 
        marginTop: '24px',
        padding: '16px 0',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          type="button"
          onClick={onCancel}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          Annuler
        </button>
        <button
          type="submit"
          style={sx.combine(sx.components.button.base, sx.components.button.primary)}
        >
          {aircraft ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>

});

AircraftFormComplete.displayName = 'AircraftFormComplete';

export default AircraftFormComplete;