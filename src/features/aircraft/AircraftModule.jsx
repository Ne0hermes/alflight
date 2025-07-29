// src/features/aircraft/AircraftModule.jsx
import React, { memo, useState } from 'react';
import { useAircraft } from '@core/contexts';
import { Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

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

  return (
    <div>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          ✈️ Gestion des avions
        </h3>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
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
                borderColor: sx.theme.colors.primary[500],
                backgroundColor: sx.theme.colors.primary[50]
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
                  {aircraft.performances && (
                    <p style={{ color: sx.theme.colors.primary[600] }}>
                      📊 Perfs: TOD {aircraft.performances.takeoffDistance}m / LD {aircraft.performances.landingDistance}m
                    </p>
                  )}
                </div>
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
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
              {editingAircraft ? 'Modifier l\'avion' : 'Nouvel avion'}
            </h3>
            
            {/* Formulaire simplifié - je peux fournir le formulaire complet si nécessaire */}
            <p>Formulaire d'édition d'avion...</p>
            
            <div style={sx.combine(sx.flex.end, sx.spacing.gap(2), sx.spacing.mt(4))}>
              <button
                onClick={() => setShowForm(false)}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  // Logique de sauvegarde
                  setShowForm(false);
                }}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AircraftModule.displayName = 'AircraftModule';

export default AircraftModule;