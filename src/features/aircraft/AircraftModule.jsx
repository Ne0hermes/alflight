// src/features/aircraft/AircraftModule.jsx
import React, { memo, useState } from 'react';
import { useAircraft } from '@core/contexts';
import { Plus, Edit2, Trash2, Download, Upload, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

// Composant pour l'aide contextuelle
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
      <Info
        size={14}
        style={{ cursor: 'help', color: '#9CA3AF' }}
      />
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
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '12px',
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1F2937',
          }} />
        </div>
      )}
    </span>
  );
});

InfoIcon.displayName = 'InfoIcon';

export const AircraftModule = memo(() => {
  const { aircraftList, selectedAircraft, setSelectedAircraft, addAircraft, updateAircraft, deleteAircraft } = useAircraft();
  const [showForm, setShowForm] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState(null);

  const handleEdit = (aircraft) => {
    setEditingAircraft(aircraft);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr de supprimer cet avion ?')) {
      deleteAircraft(id);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(aircraftList, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `aircraft-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (Array.isArray(importedData)) {
            if (window.confirm(`Voulez-vous importer ${importedData.length} avion(s) ?`)) {
              importedData.forEach(aircraft => {
                addAircraft(aircraft);
              });
              alert('Import réussi !');
            }
          } else {
            alert('Format de fichier invalide');
          }
        } catch (error) {
          alert('Erreur lors de l\'import : ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          ✈️ Gestion des avions
        </h3>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <label style={sx.combine(sx.components.button.base, sx.components.button.secondary, { cursor: 'pointer' })}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <Upload size={16} />
            Importer
          </label>
          <button
            onClick={handleExport}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
          >
            <Download size={16} />
            Exporter
          </button>
          <button
            onClick={() => {
              setEditingAircraft(null);
              setShowForm(true);
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.primary)}
          >
            <Plus size={16} />
            Nouvel avion
          </button>
        </div>
      </div>

      {/* Liste des avions */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {aircraftList.map(aircraft => (
          <div
            key={aircraft.id}
            style={sx.combine(
              sx.components.card.base,
              aircraft.id === selectedAircraft?.id && {
                borderColor: '#3182CE',
                backgroundColor: '#EBF8FF'
              }
            )}
          >
            <div style={sx.flex.between}>
              <div 
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => setSelectedAircraft(aircraft)}
              >
                <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(1))}>
                  {aircraft.registration} - {aircraft.model}
                  {aircraft.id === selectedAircraft?.id && (
                    <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(2))}>
                      (sélectionné)
                    </span>
                  )}
                </h4>
                <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  <p>Carburant: {aircraft.fuelType} • Capacité: {aircraft.fuelCapacity}L</p>
                  <p>Vitesse: {aircraft.cruiseSpeedKt}kt • Conso: {aircraft.fuelConsumption}L/h</p>
                  <p>MTOW: {aircraft.maxTakeoffWeight}kg</p>
                  {aircraft.masses?.emptyMass && (
                    <p style={{ color: '#3182CE' }}>
                      ⚖️ Masse à vide: {aircraft.masses.emptyMass}kg • MLM: {aircraft.limitations?.maxLandingMass || 'N/A'}kg
                    </p>
                  )}
                  {aircraft.armLengths?.emptyMassArm && (
                    <p style={{ color: '#7C3AED' }}>
                      📏 Bras masse à vide: {aircraft.armLengths.emptyMassArm}mm • Carburant: {aircraft.armLengths.fuelArm}mm
                    </p>
                  )}
                  {aircraft.cgEnvelope && aircraft.cgEnvelope.length > 0 && (
                    <p style={{ color: '#EC4899' }}>
                      📈 Enveloppe CG: {aircraft.cgEnvelope.length} points définis
                    </p>
                  )}
                </div>
                {/* Mini graphique de l'enveloppe pour l'avion sélectionné */}
                {aircraft.id === selectedAircraft?.id && aircraft.cgEnvelope && aircraft.cgEnvelope.length >= 2 && (
                  <div style={{ marginTop: '12px' }}>
                    <CGEnvelopeMini envelope={aircraft.cgEnvelope} />
                  </div>
                )}
              </div>
              <div style={sx.combine(sx.flex.row, sx.spacing.gap(1))}>
                <button
                  onClick={() => handleEdit(aircraft)}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '8px' })}
                >
                  <Edit2 size={16} />
                </button>
                {aircraftList.length > 1 && (
                  <button
                    onClick={() => handleDelete(aircraft.id)}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px' })}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal formulaire */}
      {showForm && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
              {editingAircraft ? 'Modifier l\'avion' : 'Nouvel avion'}
            </h3>
            
            <AircraftForm
              aircraft={editingAircraft}
              onSubmit={(formData) => {
                if (editingAircraft) {
                  updateAircraft(editingAircraft.id, formData);
                } else {
                  addAircraft(formData);
                }
                setShowForm(false);
                setEditingAircraft(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingAircraft(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

AircraftModule.displayName = 'AircraftModule';

// Composant de formulaire pour ajouter/modifier un avion
const AircraftForm = memo(({ aircraft, onSubmit, onCancel }) => {
  // TODO: Récupérer l'unité depuis le contexte utilisateur
  // const { massUnit } = useUserPreferences();
  const massUnit = 'kg'; // ou 'lbs' selon les préférences utilisateur

  const [formData, setFormData] = useState({
    registration: aircraft?.registration || '',
    model: aircraft?.model || '',
    fuelType: aircraft?.fuelType || 'AVGAS',
    fuelCapacity: aircraft?.fuelCapacity || '',
    cruiseSpeedKt: aircraft?.cruiseSpeedKt || '',
    fuelConsumption: aircraft?.fuelConsumption || '',
    maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
    masses: {
      emptyMass: aircraft?.masses?.emptyMass || '',
      minTakeoffMass: aircraft?.masses?.minTakeoffMass || '',
      baseFactor: aircraft?.masses?.baseFactor || '',
      maxBaggageTube: aircraft?.masses?.maxBaggageTube || '',
      maxAftBaggageExtension: aircraft?.masses?.maxAftBaggageExtension || ''
    },
    armLengths: {
      emptyMassArm: aircraft?.armLengths?.emptyMassArm || '',
      fuelArm: aircraft?.armLengths?.fuelArm || '',
      frontSeat1Arm: aircraft?.armLengths?.frontSeat1Arm || '',
      frontSeat2Arm: aircraft?.armLengths?.frontSeat2Arm || '',
      rearSeat1Arm: aircraft?.armLengths?.rearSeat1Arm || '',
      rearSeat2Arm: aircraft?.armLengths?.rearSeat2Arm || '',
      standardBaggageArm: aircraft?.armLengths?.standardBaggageArm || '',
      baggageTubeArm: aircraft?.armLengths?.baggageTubeArm || '',
      aftBaggageExtensionArm: aircraft?.armLengths?.aftBaggageExtensionArm || ''
    },
    limitations: {
      maxLandingMass: aircraft?.limitations?.maxLandingMass || '',
      maxBaggageLest: aircraft?.limitations?.maxBaggageLest || ''
    },
    cgEnvelope: aircraft?.cgEnvelope || [
      { weight: '', forwardLimit: '', aftLimit: '' },
      { weight: '', forwardLimit: '', aftLimit: '' },
      { weight: '', forwardLimit: '', aftLimit: '' },
      { weight: '', forwardLimit: '', aftLimit: '' }
    ]
  });

  const handleChange = (field, value, index = null) => {
    if (field === 'cgEnvelope' && index !== null) {
      const [subField] = value;
      setFormData(prev => {
        const newEnvelope = [...prev.cgEnvelope];
        newEnvelope[index] = {
          ...newEnvelope[index],
          [subField]: value[1]
        };
        return {
          ...prev,
          cgEnvelope: newEnvelope
        };
      });
    } else if (field.includes('.')) {
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
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation basique
    if (!formData.registration || !formData.model) {
      alert('L\'immatriculation et le modèle sont obligatoires');
      return;
    }

    // Conversion des valeurs numériques
    const processedData = {
      ...formData,
      fuelCapacity: Number(formData.fuelCapacity),
      cruiseSpeedKt: Number(formData.cruiseSpeedKt),
      fuelConsumption: Number(formData.fuelConsumption),
      maxTakeoffWeight: Number(formData.maxTakeoffWeight),
      masses: Object.values(formData.masses).some(v => v)
        ? {
            emptyMass: Number(formData.masses.emptyMass) || 0,
            minTakeoffMass: Number(formData.masses.minTakeoffMass) || 0,
            baseFactor: Number(formData.masses.baseFactor) || 0,
            maxBaggageTube: Number(formData.masses.maxBaggageTube) || 0,
            maxAftBaggageExtension: Number(formData.masses.maxAftBaggageExtension) || 0
          }
        : null,
      armLengths: Object.values(formData.armLengths).some(v => v)
        ? {
            emptyMassArm: Number(formData.armLengths.emptyMassArm) || 0,
            fuelArm: Number(formData.armLengths.fuelArm) || 0,
            frontSeat1Arm: Number(formData.armLengths.frontSeat1Arm) || 0,
            frontSeat2Arm: Number(formData.armLengths.frontSeat2Arm) || 0,
            rearSeat1Arm: Number(formData.armLengths.rearSeat1Arm) || 0,
            rearSeat2Arm: Number(formData.armLengths.rearSeat2Arm) || 0,
            standardBaggageArm: Number(formData.armLengths.standardBaggageArm) || 0,
            baggageTubeArm: Number(formData.armLengths.baggageTubeArm) || 0,
            aftBaggageExtensionArm: Number(formData.armLengths.aftBaggageExtensionArm) || 0
          }
        : null,
      limitations: Object.values(formData.limitations).some(v => v)
        ? {
            maxLandingMass: Number(formData.limitations.maxLandingMass) || 0,
            maxBaggageLest: Number(formData.limitations.maxBaggageLest) || 0
          }
        : null,
      cgEnvelope: formData.cgEnvelope
        .filter(point => point.weight && (point.forwardLimit || point.aftLimit))
        .map(point => ({
          weight: Number(point.weight) || 0,
          forwardLimit: Number(point.forwardLimit) || 0,
          aftLimit: Number(point.aftLimit) || 0
        }))
    };

    onSubmit(processedData);
  };

  const inputStyle = sx.combine(
    sx.components.input.base,
    sx.spacing.mb(3)
  );

  const labelStyle = sx.combine(
    sx.text.sm,
    sx.text.bold,
    sx.spacing.mb(1),
    { display: 'flex', alignItems: 'center' }
  );

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        backgroundColor: '#EBF8FF',
        border: '1px solid #90CDF4',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '20px'
      }}>
        <p style={sx.combine(sx.text.sm, { color: '#2B6CB0' })}>
          💡 <strong>Important :</strong> Les données de masse et centrage sont essentielles pour la sécurité du vol. 
          Elles seront utilisées pour calculer le devis de masse et vérifier le respect des limites réglementaires.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Informations de base */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Informations générales
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Immatriculation *</label>
              <input
                type="text"
                value={formData.registration}
                onChange={(e) => handleChange('registration', e.target.value)}
                placeholder="F-GXXX"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Modèle *</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Cessna 172"
                required
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Carburant */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Carburant
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Type de carburant</label>
              <select
                value={formData.fuelType}
                onChange={(e) => handleChange('fuelType', e.target.value)}
                style={inputStyle}
              >
                <option value="AVGAS">AVGAS 100LL</option>
                <option value="JET-A1">JET A-1</option>
                <option value="MOGAS">MOGAS</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Capacité (L)</label>
              <input
                type="number"
                value={formData.fuelCapacity}
                onChange={(e) => handleChange('fuelCapacity', e.target.value)}
                placeholder="200"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Consommation (L/h)</label>
              <input
                type="number"
                value={formData.fuelConsumption}
                onChange={(e) => handleChange('fuelConsumption', e.target.value)}
                placeholder="35"
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Masses structurelles */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Masses structurelles ({massUnit})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>
                Masse à vide
                <InfoIcon tooltip="Masse de l'avion sans carburant ni charge utile" />
              </label>
              <input
                type="number"
                value={formData.masses.emptyMass}
                onChange={(e) => handleChange('masses.emptyMass', e.target.value)}
                placeholder="650"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse max atterrissage
                <InfoIcon tooltip="Masse maximale autorisée à l'atterrissage (MLM)" />
              </label>
              <input
                type="number"
                value={formData.limitations.maxLandingMass}
                onChange={(e) => handleChange('limitations.maxLandingMass', e.target.value)}
                placeholder="1100"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse max décollage
                <InfoIcon tooltip="Masse maximale autorisée au décollage (MTOW)" />
              </label>
              <input
                type="number"
                value={formData.maxTakeoffWeight}
                onChange={(e) => handleChange('maxTakeoffWeight', e.target.value)}
                placeholder="1150"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Masse min décollage
                <InfoIcon tooltip="Masse minimale pour le décollage" />
              </label>
              <input
                type="number"
                value={formData.masses.minTakeoffMass}
                onChange={(e) => handleChange('masses.minTakeoffMass', e.target.value)}
                placeholder="700"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Facteur de base
                <InfoIcon tooltip="Facteur utilisé pour les calculs de centrage" />
              </label>
              <input
                type="number"
                value={formData.masses.baseFactor}
                onChange={(e) => handleChange('masses.baseFactor', e.target.value)}
                placeholder="1.0"
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max bagages + lest
                <InfoIcon tooltip="Masse maximale cumulée des bagages et du lestage" />
              </label>
              <input
                type="number"
                value={formData.limitations.maxBaggageLest}
                onChange={(e) => handleChange('limitations.maxBaggageLest', e.target.value)}
                placeholder="45"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max Baggage Tube
                <InfoIcon tooltip="Masse maximale dans le tube à bagages" />
              </label>
              <input
                type="number"
                value={formData.masses.maxBaggageTube}
                onChange={(e) => handleChange('masses.maxBaggageTube', e.target.value)}
                placeholder="10"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Max AFT Baggage Extension
                <InfoIcon tooltip="Masse maximale dans l'extension arrière" />
              </label>
              <input
                type="number"
                value={formData.masses.maxAftBaggageExtension}
                onChange={(e) => handleChange('masses.maxAftBaggageExtension', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Bras de levier */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Bras de levier (mm)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Première ligne */}
            <div>
              <label style={labelStyle}>
                Masse à vide
                <InfoIcon tooltip="Distance du CG de la masse à vide par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.emptyMassArm}
                onChange={(e) => handleChange('armLengths.emptyMassArm', e.target.value)}
                placeholder="2150"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Carburant
                <InfoIcon tooltip="Distance du CG du carburant par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.fuelArm}
                onChange={(e) => handleChange('armLengths.fuelArm', e.target.value)}
                placeholder="2180"
                min="0"
                style={inputStyle}
              />
            </div>
            
            {/* Deuxième ligne */}
            <div>
              <label style={labelStyle}>
                Siège avant gauche
                <InfoIcon tooltip="Distance du siège pilote par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.frontSeat1Arm}
                onChange={(e) => handleChange('armLengths.frontSeat1Arm', e.target.value)}
                placeholder="2000"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège avant droit
                <InfoIcon tooltip="Distance du siège passager avant par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.frontSeat2Arm}
                onChange={(e) => handleChange('armLengths.frontSeat2Arm', e.target.value)}
                placeholder="2000"
                min="0"
                style={inputStyle}
              />
            </div>
            
            {/* Troisième ligne */}
            <div>
              <label style={labelStyle}>
                Siège arrière gauche
                <InfoIcon tooltip="Distance du siège arrière gauche par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.rearSeat1Arm}
                onChange={(e) => handleChange('armLengths.rearSeat1Arm', e.target.value)}
                placeholder="2300"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Siège arrière droit
                <InfoIcon tooltip="Distance du siège arrière droit par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.rearSeat2Arm}
                onChange={(e) => handleChange('armLengths.rearSeat2Arm', e.target.value)}
                placeholder="2300"
                min="0"
                style={inputStyle}
              />
            </div>
            
            {/* Compartiments bagages */}
            <div>
              <label style={labelStyle}>
                Compartiment standard
                <InfoIcon tooltip="Distance du compartiment bagages principal par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.standardBaggageArm}
                onChange={(e) => handleChange('armLengths.standardBaggageArm', e.target.value)}
                placeholder="2450"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Tube à bagages
                <InfoIcon tooltip="Distance du tube à bagages par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.baggageTubeArm}
                onChange={(e) => handleChange('armLengths.baggageTubeArm', e.target.value)}
                placeholder="2500"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Extension bagages AR
                <InfoIcon tooltip="Distance de l'extension arrière par rapport à la référence" />
              </label>
              <input
                type="number"
                value={formData.armLengths.aftBaggageExtensionArm}
                onChange={(e) => handleChange('armLengths.aftBaggageExtensionArm', e.target.value)}
                placeholder="2550"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Enveloppe de centrage */}
        <div>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), { display: 'flex', alignItems: 'center' })}>
            Enveloppe de centrage
            <InfoIcon tooltip="Définissez les limites avant et arrière du CG en fonction de la masse pour créer l'enveloppe de centrage" />
          </h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: formData.cgEnvelope.length > 2 ? '1fr 1fr 1fr auto' : '1fr 1fr 1fr', gap: '16px', fontWeight: 'bold', fontSize: '14px' }}>
              <div>Masse ({massUnit})</div>
              <div>Limite avant (mm)</div>
              <div>Limite arrière (mm)</div>
              {formData.cgEnvelope.length > 2 && <div></div>}
            </div>
            {formData.cgEnvelope.map((point, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: formData.cgEnvelope.length > 2 ? '1fr 1fr 1fr auto' : '1fr 1fr 1fr', gap: '16px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={point.weight}
                  onChange={(e) => handleChange('cgEnvelope', ['weight', e.target.value], index)}
                  placeholder={index === 0 ? "700" : index === 1 ? "900" : index === 2 ? "1100" : "1150"}
                  min="0"
                  style={sx.components.input.base}
                />
                <input
                  type="number"
                  value={point.forwardLimit}
                  onChange={(e) => handleChange('cgEnvelope', ['forwardLimit', e.target.value], index)}
                  placeholder={index === 0 ? "2050" : index === 1 ? "2080" : index === 2 ? "2120" : "2150"}
                  min="0"
                  style={sx.components.input.base}
                />
                <input
                  type="number"
                  value={point.aftLimit}
                  onChange={(e) => handleChange('cgEnvelope', ['aftLimit', e.target.value], index)}
                  placeholder="2350"
                  min="0"
                  style={sx.components.input.base}
                />
                {formData.cgEnvelope.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        cgEnvelope: prev.cgEnvelope.filter((_, i) => i !== index)
                      }));
                    }}
                    style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '8px' })}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  cgEnvelope: [...prev.cgEnvelope, { weight: '', forwardLimit: '', aftLimit: '' }]
                }));
              }}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary, { marginTop: '8px' })}
            >
              + Ajouter un point
            </button>
          </div>
          
          {/* Graphique de l'enveloppe */}
          <div style={{ marginTop: '16px', padding: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', fontSize: '12px', color: '#6B7280' }}>
            <div>Points valides pour le graphique : {formData.cgEnvelope.filter(p => p.weight && p.forwardLimit && p.aftLimit).length}</div>
            <div style={{ marginTop: '4px' }}>
              Données entrées :
              {formData.cgEnvelope.map((p, i) => (
                <div key={i} style={{ marginLeft: '12px' }}>
                  {i+1}. Masse: {p.weight || '-'}, Avant: {p.forwardLimit || '-'}, Arrière: {p.aftLimit || '-'}
                </div>
              ))}
            </div>
          </div>
          {formData.cgEnvelope.filter(p => p.weight && p.forwardLimit && p.aftLimit).length >= 2 && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Visualisation de l'enveloppe de centrage
              </h5>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '4px', padding: '8px', backgroundColor: 'white' }}>
                <CGEnvelopeChart 
                  envelope={formData.cgEnvelope.filter(p => p.weight && p.forwardLimit && p.aftLimit)}
                  massUnit={massUnit}
                />
              </div>
              {/* Test SVG simple pour vérifier que les SVG fonctionnent */}
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
                Test SVG: 
                <svg width="50" height="20" style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
                  <rect x="0" y="0" width="50" height="20" fill="#3B82F6" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={sx.combine(sx.flex.end, sx.spacing.gap(2), sx.spacing.mt(4))}>
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
  );
});

AircraftForm.displayName = 'AircraftForm';

// Composant pour afficher le graphique de l'enveloppe de centrage
const CGEnvelopeChart = memo(({ envelope, massUnit }) => {
  try {
    console.log('CGEnvelopeChart - envelope:', envelope);
    
    // Trier les points par masse croissante
    const sortedEnvelope = [...envelope].sort((a, b) => Number(a.weight) - Number(b.weight));
    console.log('CGEnvelopeChart - sortedEnvelope:', sortedEnvelope);
    
    // Trouver les min/max pour l'échelle
    const weights = sortedEnvelope.map(p => Number(p.weight));
    const allCGValues = sortedEnvelope.flatMap(p => [Number(p.forwardLimit), Number(p.aftLimit)]);
    
    const minWeight = Math.min(...weights) * 0.9;
    const maxWeight = Math.max(...weights) * 1.1;
    const minCG = Math.min(...allCGValues) * 0.98;
    const maxCG = Math.max(...allCGValues) * 1.02;
    
    console.log('CGEnvelopeChart - scales:', { minWeight, maxWeight, minCG, maxCG });
    
    // Vérifier que les valeurs sont valides
    if (!isFinite(minWeight) || !isFinite(maxWeight) || !isFinite(minCG) || !isFinite(maxCG)) {
      console.error('CGEnvelopeChart - Invalid scale values');
      return <div>Données invalides pour le graphique</div>;
    }
  
  // Dimensions du graphique
  const width = 400;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Échelles
  const xScale = (cg) => ((cg - minCG) / (maxCG - minCG)) * chartWidth;
  const yScale = (weight) => chartHeight - ((weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
  
  // Créer le path pour l'enveloppe
  const forwardPath = sortedEnvelope
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(Number(p.forwardLimit))},${yScale(Number(p.weight))}`)
    .join(' ');
  
  // Pour le chemin arrière, on doit parcourir dans l'ordre inverse
  const aftPath = [...sortedEnvelope]
    .reverse()
    .map((p) => `L ${xScale(Number(p.aftLimit))},${yScale(Number(p.weight))}`)
    .join(' ');
  
  const envelopePath = `${forwardPath} ${aftPath} Z`;
  console.log('CGEnvelopeChart - envelopePath:', envelopePath);
  
  // Points originaux pour le dessin des cercles
  const originalSortedEnvelope = [...sortedEnvelope];
  
  // Grille
  const gridLinesY = 5;
  const gridLinesX = 6;
  
  return (
    <svg width={width} height={height} style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E7EB' }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Grille horizontale */}
        {Array.from({ length: gridLinesY }).map((_, i) => {
          const y = (chartHeight / (gridLinesY - 1)) * i;
          const weight = minWeight + ((maxWeight - minWeight) / (gridLinesY - 1)) * (gridLinesY - 1 - i);
          return (
            <g key={`grid-y-${i}`}>
              <line
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke="#E5E7EB"
                strokeDasharray={i === gridLinesY - 1 ? "0" : "2,2"}
              />
              <text
                x={-5}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                fontSize="11"
                fill="#6B7280"
              >
                {Math.round(weight)}
              </text>
            </g>
          );
        })}
        
        {/* Grille verticale */}
        {Array.from({ length: gridLinesX }).map((_, i) => {
          const x = (chartWidth / (gridLinesX - 1)) * i;
          const cg = minCG + ((maxCG - minCG) / (gridLinesX - 1)) * i;
          return (
            <g key={`grid-x-${i}`}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={chartHeight}
                stroke="#E5E7EB"
                strokeDasharray={i === 0 ? "0" : "2,2"}
              />
              <text
                x={x}
                y={chartHeight + 15}
                textAnchor="middle"
                fontSize="11"
                fill="#6B7280"
              >
                {Math.round(cg)}
              </text>
            </g>
          );
        })}
        
        {/* Enveloppe */}
        <path
          d={envelopePath}
          fill="#3B82F6"
          fillOpacity="0.2"
          stroke="#3B82F6"
          strokeWidth="2"
        />
        
        {/* Points de l'enveloppe */}
        {originalSortedEnvelope.map((point, i) => (
          <g key={`points-${i}`}>
            <circle
              cx={xScale(Number(point.forwardLimit))}
              cy={yScale(Number(point.weight))}
              r="4"
              fill="#3B82F6"
            />
            <circle
              cx={xScale(Number(point.aftLimit))}
              cy={yScale(Number(point.weight))}
              r="4"
              fill="#3B82F6"
            />
            <text
              x={xScale(Number(point.forwardLimit))}
              y={yScale(Number(point.weight)) - 8}
              fontSize="10"
              fill="#1F2937"
              textAnchor="middle"
            >
              {i + 1}
            </text>
          </g>
        ))}
        
        {/* Axes */}
        <line
          x1={0}
          y1={chartHeight}
          x2={chartWidth}
          y2={chartHeight}
          stroke="#374151"
          strokeWidth="2"
        />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={chartHeight}
          stroke="#374151"
          strokeWidth="2"
        />
      </g>
      
      {/* Labels des axes */}
      <text
        x={width / 2}
        y={height - 5}
        textAnchor="middle"
        fontSize="12"
        fill="#374151"
        fontWeight="bold"
      >
        Centre de gravité (mm)
      </text>
      <text
        x={15}
        y={height / 2}
        textAnchor="middle"
        fontSize="12"
        fill="#374151"
        fontWeight="bold"
        transform={`rotate(-90, 15, ${height / 2})`}
      >
        Masse ({massUnit})
      </text>
    </svg>
  );
  } catch (error) {
    console.error('CGEnvelopeChart - Error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#EF4444' }}>
        Erreur lors de l'affichage du graphique: {error.message}
      </div>
    );
  }
});

CGEnvelopeChart.displayName = 'CGEnvelopeChart';

// Version miniature du graphique pour l'affichage dans les cartes
const CGEnvelopeMini = memo(({ envelope }) => {
  const sortedEnvelope = [...envelope].sort((a, b) => Number(a.weight) - Number(b.weight));
  
  const weights = sortedEnvelope.map(p => Number(p.weight));
  const allCGValues = sortedEnvelope.flatMap(p => [Number(p.forwardLimit), Number(p.aftLimit)]);
  
  const minWeight = Math.min(...weights) * 0.95;
  const maxWeight = Math.max(...weights) * 1.05;
  const minCG = Math.min(...allCGValues) * 0.99;
  const maxCG = Math.max(...allCGValues) * 1.01;
  
  const width = 200;
  const height = 100;
  const margin = { top: 5, right: 5, bottom: 5, left: 5 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const xScale = (cg) => ((cg - minCG) / (maxCG - minCG)) * chartWidth;
  const yScale = (weight) => chartHeight - ((weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
  
  const forwardPath = sortedEnvelope
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(Number(p.forwardLimit))},${yScale(Number(p.weight))}`)
    .join(' ');
  
  // Pour le chemin arrière, on doit parcourir dans l'ordre inverse
  const aftPath = [...sortedEnvelope]
    .reverse()
    .map((p) => `L ${xScale(Number(p.aftLimit))},${yScale(Number(p.weight))}`)
    .join(' ');
  
  const envelopePath = `${forwardPath} ${aftPath} Z`;
  
  return (
    <svg width={width} height={height} style={{ backgroundColor: '#F9FAFB', borderRadius: '4px' }}>
      <g transform={`translate(${margin.left},${margin.top})`}>
        <path
          d={envelopePath}
          fill="#3B82F6"
          fillOpacity="0.3"
          stroke="#3B82F6"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
});

CGEnvelopeMini.displayName = 'CGEnvelopeMini';

export default AircraftModule;