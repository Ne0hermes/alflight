// Composant pour l'édition des services depuis les données AIXM
import React from 'react';
import { Plus, Trash2, Settings, Fuel, Wrench, Phone, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const ServicesEditor = ({ editedData, updateValue }) => {
  
  
  // Services de base avec leurs états
  const baseServices = [
    { key: 'fuel', label: 'Avitaillement carburant', icon: Fuel },
    { key: 'avgas100LL', label: 'AVGAS 100LL disponible', icon: Fuel },
    { key: 'jetA1', label: 'JET A1 disponible', icon: Fuel },
    { key: 'maintenance', label: 'Maintenance aéronefs', icon: Wrench },
    { key: 'hangar', label: 'Hangar disponible', icon: Settings },
    { key: 'parking', label: 'Parking aéronefs', icon: Settings },
    { key: 'customs', label: 'Douanes', icon: Info },
    { key: 'immigration', label: 'Immigration', icon: Info },
    { key: 'handling', label: 'Assistance en escale', icon: Settings },
    { key: 'catering', label: 'Restauration', icon: Settings },
    { key: 'hotel', label: 'Hébergement', icon: Info },
    { key: 'rental', label: 'Location véhicules', icon: Info },
    { key: 'medical', label: 'Services médicaux', icon: Info },
    { key: 'deicing', label: 'Dégivrage', icon: Wrench }
  ];
  
  const toggleService = (serviceKey) => {
    const currentServices = editedData.services || {};
    updateValue('services', {
      ...currentServices,
      [serviceKey]: !currentServices[serviceKey]
    });
  };
  
  // Gestion des services personnalisés
  const addCustomService = () => {
    const currentCustomServices = editedData.customServices || [];
    const newService = {
      name: '',
      available: true,
      schedule: 'H24',
      phone: '',
      email: '',
      description: ''
    };
    updateValue('customServices', [...currentCustomServices, newService]);
  };
  
  const removeCustomService = (index) => {
    const currentCustomServices = editedData.customServices || [];
    updateValue('customServices', currentCustomServices.filter((_, i) => i !== index));
  };
  
  const updateCustomServiceField = (index, field, value) => {
    const currentCustomServices = [...(editedData.customServices || [])];
    currentCustomServices[index] = {
      ...currentCustomServices[index],
      [field]: value
    };
    updateValue('customServices', currentCustomServices);
  };
  
  // Gestion des horaires d'ouverture
  const updateOperatingHours = (field, value) => {
    const currentOperatingHours = editedData.operatingHours || {};
    updateValue('operatingHours', {
      ...currentOperatingHours,
      [field]: value
    });
  };
  
  // Gestion des contacts
  const updateContact = (type, field, value) => {
    const currentContacts = editedData.contacts || {};
    updateValue('contacts', {
      ...currentContacts,
      [type]: {
        ...currentContacts[type],
        [field]: value
      }
    });
  };
  
  return (
    <div>
      {/* Services de base */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
        <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#166534', marginBottom: '16px' }}>
          Services disponibles sur l'aérodrome
        </h5>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {baseServices.map(service => {
            const Icon = service.icon;
            const isActive = editedData.services?.[service.key] || false;
            
            return (
              <div
                key={service.key}
                onClick={() => toggleService(service.key)}
                style={{
                  padding: '12px',
                  backgroundColor: isActive ? '#dcfce7' : '#f9fafb',
                  border: `2px solid ${isActive ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => {}}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#22c55e'
                  }}
                />
                <Icon size={16} style={{ color: isActive ? '#16a34a' : '#6b7280' }} />
                <span style={{
                  fontSize: '13px',
                  color: isActive ? '#166534' : '#4b5563',
                  fontWeight: isActive ? 'bold' : 'normal'
                }}>
                  {service.label}
                </span>
              </div>

          })}
        </div>
      </div>
      
      {/* Horaires d'ouverture */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
        <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', marginBottom: '16px' }}>
          Horaires d'ouverture
        </h5>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Aérodrome
            </label>
            <input
              type="text"
              value={editedData.operatingHours?.aerodrome || ''}
              onChange={(e) => updateOperatingHours('aerodrome', e.target.value)}
              placeholder="HJ (Heures de jour) ou H24"
              style={sx.components.input.base}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Tour de contrôle
            </label>
            <input
              type="text"
              value={editedData.operatingHours?.tower || ''}
              onChange={(e) => updateOperatingHours('tower', e.target.value)}
              placeholder="08:00-20:00 UTC"
              style={sx.components.input.base}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Avitaillement
            </label>
            <input
              type="text"
              value={editedData.operatingHours?.fuel || ''}
              onChange={(e) => updateOperatingHours('fuel', e.target.value)}
              placeholder="09:00-18:00 LT"
              style={sx.components.input.base}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Douanes
            </label>
            <input
              type="text"
              value={editedData.operatingHours?.customs || ''}
              onChange={(e) => updateOperatingHours('customs', e.target.value)}
              placeholder="PPR 2H"
              style={sx.components.input.base}
            />
          </div>
        </div>
        
        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            Remarques sur les horaires
          </label>
          <textarea
            value={editedData.operatingHours?.remarks || ''}
            onChange={(e) => updateOperatingHours('remarks', e.target.value)}
            placeholder="Fermeture jours fériés, horaires d'été/hiver..."
            rows="2"
            style={{
              ...sx.components.input.base,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>
      
      {/* Contacts */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
        <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', marginBottom: '16px' }}>
          <Phone size={16} style={{ display: 'inline', marginRight: '4px' }} />
          Contacts
        </h5>
        
        <div style={{ display: 'grid', gap: '16px' }}>
          {['operations', 'fuel', 'maintenance', 'emergency'].map(contactType => (
            <div key={contactType} style={{
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #dbeafe'
            }}>
              <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563', textTransform: 'capitalize' }}>
                {contactType === 'operations' ? 'Opérations' :
                 contactType === 'fuel' ? 'Avitaillement' :
                 contactType === 'maintenance' ? 'Maintenance' :
                 'Urgences'}
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <input
                  type="text"
                  value={editedData.contacts?.[contactType]?.phone || ''}
                  onChange={(e) => updateContact(contactType, 'phone', e.target.value)}
                  placeholder="Téléphone"
                  style={{ ...sx.components.input.base, fontSize: '12px' }}
                />
                <input
                  type="email"
                  value={editedData.contacts?.[contactType]?.email || ''}
                  onChange={(e) => updateContact(contactType, 'email', e.target.value)}
                  placeholder="Email"
                  style={{ ...sx.components.input.base, fontSize: '12px' }}
                />
                <input
                  type="text"
                  value={editedData.contacts?.[contactType]?.frequency || ''}
                  onChange={(e) => updateContact(contactType, 'frequency', e.target.value)}
                  placeholder="Fréquence MHz"
                  style={{ ...sx.components.input.base, fontSize: '12px' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Services personnalisés */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
            Services additionnels / Remarques
          </h5>
          <button
            onClick={addCustomService}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={14} /> Ajouter un service
          </button>
        </div>
        
        {editedData.customServices && editedData.customServices.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {editedData.customServices.map((service, idx) => (
              <div key={idx} style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={service.name || ''}
                    onChange={(e) => updateCustomServiceField(idx, 'name', e.target.value)}
                    placeholder="Nom du service"
                    style={{ ...sx.components.input.base, fontSize: '13px', fontWeight: 'bold' }}
                  />
                  <button
                    onClick={() => removeCustomService(idx)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={service.schedule || ''}
                    onChange={(e) => updateCustomServiceField(idx, 'schedule', e.target.value)}
                    placeholder="Horaires"
                    style={{ ...sx.components.input.base, fontSize: '12px' }}
                  />
                  <input
                    type="text"
                    value={service.phone || ''}
                    onChange={(e) => updateCustomServiceField(idx, 'phone', e.target.value)}
                    placeholder="Téléphone"
                    style={{ ...sx.components.input.base, fontSize: '12px' }}
                  />
                  <input
                    type="email"
                    value={service.email || ''}
                    onChange={(e) => updateCustomServiceField(idx, 'email', e.target.value)}
                    placeholder="Email"
                    style={{ ...sx.components.input.base, fontSize: '12px' }}
                  />
                </div>
                
                <textarea
                  value={service.description || ''}
                  onChange={(e) => updateCustomServiceField(idx, 'description', e.target.value)}
                  placeholder="Description du service..."
                  rows="2"
                  style={{
                    ...sx.components.input.base,
                    width: '100%',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: '12px'
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
            <Settings size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ fontSize: '13px' }}>Aucun service additionnel défini.</p>
          </div>
        )}
      </div>
      
      {/* Notes générales */}
      <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '8px' }}>
          Notes et informations complémentaires
        </label>
        <textarea
          value={editedData.servicesNotes || ''}
          onChange={(e) => updateValue('servicesNotes', e.target.value)}
          placeholder="Informations complémentaires sur les services disponibles, particularités locales, tarifs spéciaux..."
          rows="4"
          style={{
            ...sx.components.input.base,
            width: '100%',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
      </div>
    </div>
