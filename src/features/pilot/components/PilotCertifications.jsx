// src/features/pilot/components/PilotCertifications.jsx
import React, { useState, useEffect } from 'react';
import { Award, Upload, Download, Trash2, Eye, Plus, Calendar, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
// Style system removed - using inline styles

const PilotCertifications = () => {
  const [certifications, setCertifications] = useState({
    licenses: [],
    ratings: [],
    endorsements: [],
    training: []
  });

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('licenses');
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    type: '',
    name: '',
    number: '',
    issuedBy: '',
    issueDate: '',
    expiryDate: '',
    nextCheckDate: '',
    document: null,
    documentName: '',
    remarks: ''
  });

  // Types prédéfinis
  const certTypes = {
    licenses: [
      'PPL - Private Pilot License',
      'CPL - Commercial Pilot License',
      'ATPL - Airline Transport Pilot License',
      'LAPL - Light Aircraft Pilot License',
      'ULM - Ultra Léger Motorisé',
      'FI - Flight Instructor',
      'FE - Flight Examiner'
    ],
    ratings: [
      'SEP - Single Engine Piston',
      'MEP - Multi Engine Piston',
      'SET - Single Engine Turbine',
      'MET - Multi Engine Turbine',
      'IR - Instrument Rating',
      'Night Rating',
      'Mountain Rating',
      'Aerobatic Rating',
      'Towing Rating',
      'Type Rating'
    ],
    endorsements: [
      'Tailwheel',
      'Complex Aircraft',
      'High Performance',
      'Pressurized Aircraft',
      'Glass Cockpit',
      'EFIS',
      'TCAS',
      'RVSM'
    ],
    training: [
      'BFR - Biennial Flight Review',
      'IPC - Instrument Proficiency Check',
      'Line Check',
      'Emergency Procedures',
      'CRM - Crew Resource Management',
      'Dangerous Goods',
      'Security Training',
      'Ditching Training'
    ]
  };

  // Charger les certifications depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pilotCertifications');
    if (saved) {
      setCertifications(JSON.parse(saved));
    }
  }, []);

  // Vérifier les dates d'expiration
  const checkExpiry = (date) => {
    if (!date) return 'none';
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'urgent';
    if (daysUntilExpiry <= 90) return 'warning';
    return 'valid';
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDocumentUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          document: reader.result,
          documentName: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    const item = {
      ...formData,
      id: editingItem ? editingItem.id : Date.now(),
      createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newCertifications = { ...certifications };
    
    if (editingItem) {
      const index = newCertifications[formType].findIndex(c => c.id === editingItem.id);
      if (index !== -1) {
        newCertifications[formType][index] = item;
      }
    } else {
      newCertifications[formType].push(item);
    }

    setCertifications(newCertifications);
    localStorage.setItem('pilotCertifications', JSON.stringify(newCertifications));
    
    resetForm();
    alert(editingItem ? 'Certification modifiée !' : 'Certification ajoutée !');
  };

  const resetForm = () => {
    setFormData({
      type: '',
      name: '',
      number: '',
      issuedBy: '',
      issueDate: '',
      expiryDate: '',
      nextCheckDate: '',
      document: null,
      documentName: '',
      remarks: ''
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (type, item) => {
    setFormType(type);
    setFormData(item);
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = (type, id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette certification ?')) {
      const newCertifications = { ...certifications };
      newCertifications[type] = newCertifications[type].filter(c => c.id !== id);
      setCertifications(newCertifications);
      localStorage.setItem('pilotCertifications', JSON.stringify(newCertifications));
    }
  };

  const handleViewDocument = (doc, name) => {
    const link = document.createElement('a');
    link.href = doc;
    link.download = name;
    link.target = '_blank';
    link.click();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(certifications, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `pilot-certifications-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    backgroundColor: 'white'
  };

  const labelStyle = {
    fontSize: '12px',
    color: '#374151',
    fontWeight: '500',
    marginBottom: '4px',
    display: 'block'
  };

  const getExpiryBadge = (date) => {
    const status = checkExpiry(date);
    const styles = {
      expired: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
      urgent: { backgroundColor: '#fed7aa', color: '#9a3412', border: '1px solid #fb923c' },
      warning: { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
      valid: { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #86efac' },
      none: { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' }
    };

    const labels = {
      expired: 'Expiré',
      urgent: 'Urgent',
      warning: 'Attention',
      valid: 'Valide',
      none: 'N/A'
    };

    if (!date) return null;

    const expiryDate = new Date(date);
    const daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

    return (
      <span style={{
        ...styles[status],
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {labels[status]} {status !== 'none' && `(${Math.abs(daysUntilExpiry)}j)`}
      </span>
    );
  };

  const renderCertificationCard = (type, item) => (
    <div key={item.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <h5 style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {item.name || item.type}
          </h5>
          {item.number && (
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              N° {item.number}
            </p>
          )}
          {item.issuedBy && (
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Délivré par: {item.issuedBy}
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {getExpiryBadge(item.expiryDate)}
          
          <div style={{ display: 'flex', gap: '4px' }}>
            {item.document && (
              <button
                onClick={() => handleViewDocument(item.document, item.documentName)}
                style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                title="Voir le document"
              >
                <Eye size={14} />
              </button>
            )}
            <button
              onClick={() => handleEdit(type, item)}
              style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              ✏️
            </button>
            <button
              onClick={() => handleDelete(type, item.id)}
              style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      
      <div style={{ fontSize: '12px', display: 'flex', gap: '12px' }}>
        {item.issueDate && (
          <span>
            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Délivré: {new Date(item.issueDate).toLocaleDateString()}
          </span>
        )}
        {item.expiryDate && (
          <span>
            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Expire: {new Date(item.expiryDate).toLocaleDateString()}
          </span>
        )}
        {item.nextCheckDate && (
          <span>
            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Prochain contrôle: {new Date(item.nextCheckDate).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {item.remarks && (
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          📝 {item.remarks}
        </p>
      )}
    </div>
  );

  return (
    <div>
      {/* En-tête */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <Award size={20} style={{ display: 'inline', marginRight: '8px' }} />
            Licences et Qualifications
          </h3>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {Object.values(certifications).some(arr => arr.length > 0) && (
              <button
                onClick={handleExport}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                Exporter
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
            {editingItem ? 'Modifier la certification' : 'Ajouter une certification'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Catégorie *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                style={inputStyle}
                disabled={editingItem}
              >
                <option value="licenses">Licences</option>
                <option value="ratings">Qualifications</option>
                <option value="endorsements">Variantes</option>
                <option value="training">Formations</option>
              </select>
            </div>
            
            <div>
              <label style={labelStyle}>Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Sélectionner...</option>
                {certTypes[formType].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {formData.type === 'other' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Nom personnalisé *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nom de la certification"
                style={inputStyle}
                required
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Numéro</label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => handleChange('number', e.target.value)}
                placeholder="N° de licence/certificat"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Délivré par</label>
              <input
                type="text"
                value={formData.issuedBy}
                onChange={(e) => handleChange('issuedBy', e.target.value)}
                placeholder="DGAC, EASA..."
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Date de délivrance</label>
              <input
                type="date"
                value={formData.issueDate}
                onChange={(e) => handleChange('issueDate', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Date d'expiration</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Prochain contrôle</label>
              <input
                type="date"
                value={formData.nextCheckDate}
                onChange={(e) => handleChange('nextCheckDate', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Document (PDF, image)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={16} />
                Choisir un fichier
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleDocumentUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {formData.documentName && (
                <span style={{ fontSize: '14px' }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {formData.documentName}
                </span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Remarques</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Notes, restrictions, observations..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              {editingItem ? 'Modifier' : 'Ajouter'}
            </button>
            
            <button
              onClick={resetForm}
              style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Sections de certifications */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        {/* Licences */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>
              ✈️ Licences
            </h4>
            <button
              onClick={() => {
                setFormType('licenses');
                setShowForm(true);
              }}
              style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Plus size={14} />
            </button>
          </div>
          {certifications.licenses.length > 0 ? (
            certifications.licenses.map(item => renderCertificationCard('licenses', item))
          ) : (
            <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Aucune licence</p>
            </div>
          )}
        </div>

        {/* Qualifications */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>
              🎯 Qualifications
            </h4>
            <button
              onClick={() => {
                setFormType('ratings');
                setShowForm(true);
              }}
              style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Plus size={14} />
            </button>
          </div>
          {certifications.ratings.length > 0 ? (
            certifications.ratings.map(item => renderCertificationCard('ratings', item))
          ) : (
            <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Aucune qualification</p>
            </div>
          )}
        </div>

        {/* Variantes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>
              📋 Variantes
            </h4>
            <button
              onClick={() => {
                setFormType('endorsements');
                setShowForm(true);
              }}
              style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Plus size={14} />
            </button>
          </div>
          {certifications.endorsements.length > 0 ? (
            certifications.endorsements.map(item => renderCertificationCard('endorsements', item))
          ) : (
            <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Aucune variante</p>
            </div>
          )}
        </div>

        {/* Formations */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 'bold' }}>
              🎓 Formations
            </h4>
            <button
              onClick={() => {
                setFormType('training');
                setShowForm(true);
              }}
              style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Plus size={14} />
            </button>
          </div>
          {certifications.training.length > 0 ? (
            certifications.training.map(item => renderCertificationCard('training', item))
          ) : (
            <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>Aucune formation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PilotCertifications;