// src/features/navigation/components/WaypointSelectorModal.jsx
import React, { useState } from 'react';
import { X, MapPin, Users } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { SimpleAirportSelector } from './SimpleAirportSelector';
import { CommunityPointsManager } from './CommunityPointsManager';

/**
 * Modal pour sélectionner un waypoint avec onglets : Aérodromes ou Points Communauté
 */
export const WaypointSelectorModal = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState('aerodromes'); // 'aerodromes' ou 'community'
  const [selectedAirport, setSelectedAirport] = useState(null);

  if (!isOpen) return null;

  const handleSelectAirport = (airport) => {
    setSelectedAirport(airport);
  };

  const handleConfirm = () => {
    if (activeTab === 'aerodromes' && selectedAirport) {
      onSelect({
        type: 'aerodrome',
        data: selectedAirport
      });
      onClose();
      setSelectedAirport(null);
    }
  };

  const handleSelectCommunityPoint = (pointData) => {
    // Le CommunityPointsManager envoie déjà le point formaté
    onSelect(pointData);
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>Ajouter un point de navigation</h3>
          <button
            onClick={onClose}
            style={styles.closeButton}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('aerodromes')}
            style={{
              ...styles.tab,
              ...(activeTab === 'aerodromes' ? styles.tabActive : {})
            }}
          >
            <MapPin size={16} style={{ marginRight: '6px' }} />
            Aérodromes
          </button>
          <button
            onClick={() => setActiveTab('community')}
            style={{
              ...styles.tab,
              ...(activeTab === 'community' ? styles.tabActive : {})
            }}
          >
            <Users size={16} style={{ marginRight: '6px' }} />
            Points Communauté
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'aerodromes' && (
            <div>
              <p style={styles.description}>
                Sélectionnez un aérodrome dans la liste ci-dessous :
              </p>
              <SimpleAirportSelector
                label="Rechercher un aérodrome"
                value={selectedAirport}
                onChange={handleSelectAirport}
                placeholder="Code OACI ou nom..."
              />
            </div>
          )}

          {activeTab === 'community' && (
            <CommunityPointsManager onSelectPoint={handleSelectCommunityPoint} />
          )}
        </div>

        {/* Footer - Affiché seulement pour l'onglet aérodromes */}
        {activeTab === 'aerodromes' && (
          <div style={styles.footer}>
            <button
              onClick={onClose}
              style={styles.cancelButton}
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedAirport}
              style={{
                ...styles.confirmButton,
                ...(!selectedAirport ? styles.confirmButtonDisabled : {})
              }}
            >
              Ajouter l'aérodrome
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '4px',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 20px'
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabActive: {
    color: '#3b82f6',
    borderBottom: '2px solid #3b82f6',
    fontWeight: '600'
  },
  content: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto'
  },
  description: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  footer: {
    padding: '20px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  confirmButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  confirmButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed'
  }
};

export default WaypointSelectorModal;
