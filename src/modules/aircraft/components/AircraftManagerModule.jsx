import React, { useState } from 'react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { Edit, Trash2, FileText, Plus } from 'lucide-react';

export const AircraftManagerModule = () => {
  const { aircraftList, selectedAircraft, setSelectedAircraft, dispatch } = useFlightSystem();
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleDelete = (aircraftId) => {
    if (aircraftList.length > 1 && window.confirm('Êtes-vous sûr de vouloir supprimer cet avion ?')) {
      dispatch({ type: 'DELETE_AIRCRAFT', payload: aircraftId });
      showNotification('Avion supprimé avec succès', 'success');
    } else if (aircraftList.length === 1) {
      showNotification('Impossible de supprimer le dernier avion', 'error');
    }
  };

  const exportAircraft = () => {
    const dataStr = JSON.stringify(aircraftList, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `aircraft-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Configuration exportée avec succès !', 'success');
  };

  const importAircraft = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported) && imported.length > 0) {
          dispatch({ type: 'IMPORT_AIRCRAFT', payload: imported });
          showNotification(`${imported.length} avion(s) importé(s) avec succès !`, 'success');
        } else {
          showNotification('Format de fichier invalide', 'error');
        }
      } catch (error) {
        showNotification('Erreur lors de l\'import du fichier', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const resetToDefault = () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser tous les avions aux valeurs par défaut ?')) {
      dispatch({ type: 'RESET_TO_DEFAULT' });
      showNotification('Avions réinitialisés aux valeurs par défaut', 'success');
    }
  };

  return (
    <div>
      {/* Notification */}
      {notification.show && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: notification.type === 'success' ? '#065f46' : '#dc2626'
        }}>
          {notification.message}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          marginBottom: '8px' 
        }}>
          🛩️ Gestion des Avions
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
          Gérez votre flotte d'aéronefs et leurs caractéristiques
        </p>
      </div>

      {/* Avion actuellement sélectionné */}
      <div style={{ 
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#eff6ff',
        border: '2px solid #3b82f6',
        borderRadius: '8px'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e40af', 
          marginBottom: '12px' 
        }}>
          ✈️ Avion sélectionné pour les calculs
        </h3>
        {selectedAircraft && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                {selectedAircraft.registration} - {selectedAircraft.model}
              </h4>
              <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                Carburant: {selectedAircraft.fuelType} • 
                Capacité: {selectedAircraft.fuelCapacity} L
              </p>
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              <p style={{ margin: '0 0 4px 0' }}>Vitesse: {selectedAircraft.cruiseSpeedKt} kt</p>
              <p style={{ margin: '0 0 4px 0' }}>Consommation: {selectedAircraft.fuelConsumption} L/h</p>
              <p style={{ margin: '0' }}>MTOW: {selectedAircraft.maxTakeoffWeight} kg</p>
            </div>
          </div>
        )}
      </div>

      {/* Liste des avions */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px' 
        }}>
          📋 Avions enregistrés ({aircraftList.length})
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {aircraftList.map(aircraft => (
            <div
              key={aircraft.id}
              style={{
                padding: '16px',
                borderRadius: '8px',
                border: aircraft.id === selectedAircraft?.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                backgroundColor: aircraft.id === selectedAircraft?.id ? '#eff6ff' : '#f9fafb',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => setSelectedAircraft(aircraft)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: aircraft.id === selectedAircraft?.id ? '#1e40af' : '#1f2937'
                  }}>
                    {aircraft.registration} - {aircraft.model}
                    {aircraft.id === selectedAircraft?.id && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#3b82f6',
                        fontWeight: 'normal'
                      }}>
                        (sélectionné)
                      </span>
                    )}
                  </h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '12px', 
                    fontSize: '14px', 
                    color: '#6b7280' 
                  }}>
                    <div>Carburant: {aircraft.fuelType}</div>
                    <div>Volume: {aircraft.fuelCapacity} L</div>
                    <div>Vitesse: {aircraft.cruiseSpeedKt} kt</div>
                    <div>Consommation: {aircraft.fuelConsumption} L/h</div>
                    <div>MTOW: {aircraft.maxTakeoffWeight} kg</div>
                    <div>Facteur: {aircraft.cruiseTimePerNm} min/Nm</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showNotification(`Détails de ${aircraft.registration} (fonctionnalité à implémenter)`, 'success');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Voir les détails"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showNotification(`Modification de ${aircraft.registration} (fonctionnalité à implémenter)`, 'success');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    title="Modifier"
                  >
                    <Edit size={18} />
                  </button>
                  {aircraftList.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(aircraft.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => showNotification('Ajout d\'avion (fonctionnalité à implémenter)', 'success')}
          style={{
            flex: 1,
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Plus size={20} />
          Ajouter un nouvel avion
        </button>
      </div>

      {/* Gestion des données */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f9fafb', 
        borderRadius: '8px' 
      }}>
        <h4 style={{ 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '12px' 
        }}>
          💾 Gestion des données
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <button
            onClick={exportAircraft}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📥 Exporter
          </button>
          
          <label style={{
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            textAlign: 'center',
            display: 'block'
          }}>
            📤 Importer
            <input
              type="file"
              accept=".json"
              onChange={importAircraft}
              style={{ display: 'none' }}
            />
          </label>
          
          <button
            onClick={resetToDefault}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ↺ Réinitialiser
          </button>
        </div>
        
        <p style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          marginTop: '12px', 
          marginBottom: '0' 
        }}>
          💾 Les modifications sont stockées en mémoire pendant la session
        </p>
      </div>
    </div>
  );
};