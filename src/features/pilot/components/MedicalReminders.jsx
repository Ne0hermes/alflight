// src/features/pilot/components/MedicalReminders.jsx
import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, AlertCircle } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const MedicalReminders = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const [formData, setFormData] = useState({
    type: 'class2',
    examDate: '',
    expiryDate: '',
    nextECG: '',
    nextAudiometry: '',
    nextOphthalmology: '',
    remarks: '',
    reminderDays: 60
  });

  // Classes médicales et leurs durées de validité standard
  const medicalClasses = {
    class1: {
      name: 'Classe 1 - Transport public',
      validity: {
        under40: 12,
        over40: 6
      }
    },
    class2: {
      name: 'Classe 2 - Pilote privé',
      validity: {
        under40: 60,
        under50: 24,
        over50: 12
      }
    },
    lapl: {
      name: 'LAPL Medical',
      validity: {
        under40: 60,
        over40: 24
      }
    }
  };

  // Charger les données depuis localStorage
  useEffect(() => {
    const savedRecords = localStorage.getItem('pilotMedicalRecords');
    if (savedRecords) {
      setMedicalRecords(JSON.parse(savedRecords));
    }
  }, []);

  // Calculer automatiquement la date d'expiration
  const calculateExpiryDate = (examDate, type) => {
    if (!examDate || !type) return '';
    
    const exam = new Date(examDate);
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const age = profile.dateOfBirth ? 
      Math.floor((exam - new Date(profile.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365)) : 40;
    
    let validityMonths = 12;
    
    if (type === 'class1') {
      validityMonths = age < 40 ? 12 : 6;
    } else if (type === 'class2') {
      if (age < 40) validityMonths = 60;
      else if (age < 50) validityMonths = 24;
      else validityMonths = 12;
    } else if (type === 'lapl') {
      validityMonths = age < 40 ? 60 : 24;
    }
    
    exam.setMonth(exam.getMonth() + validityMonths);
    return exam.toISOString().split('T')[0];
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculer la date d'expiration
      if (field === 'examDate' || field === 'type') {
        updated.expiryDate = calculateExpiryDate(
          field === 'examDate' ? value : prev.examDate,
          field === 'type' ? value : prev.type
        );
      }
      
      return updated;
    });
  };

  const handleSubmit = () => {
    const record = {
      ...formData,
      id: editingRecord ? editingRecord.id : Date.now(),
      createdAt: editingRecord ? editingRecord.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let newRecords;
    if (editingRecord) {
      newRecords = medicalRecords.map(r => r.id === editingRecord.id ? record : r);
    } else {
      newRecords = [...medicalRecords, record];
    }

    // Trier par date d'examen
    newRecords.sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
    
    setMedicalRecords(newRecords);
    localStorage.setItem('pilotMedicalRecords', JSON.stringify(newRecords));
    
    resetForm();
    alert(editingRecord ? 'Certificat médical modifié !' : 'Certificat médical enregistré !');
  };

  const resetForm = () => {
    setFormData({
      type: 'class2',
      examDate: '',
      expiryDate: '',
      nextECG: '',
      nextAudiometry: '',
      nextOphthalmology: '',
      remarks: '',
      reminderDays: 60
    });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleEdit = (record) => {
    setFormData(record);
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce certificat médical ?')) {
      const newRecords = medicalRecords.filter(r => r.id !== id);
      setMedicalRecords(newRecords);
      localStorage.setItem('pilotMedicalRecords', JSON.stringify(newRecords));
    }
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

  // Vérifier les dates d'expiration
  const getExpiryColor = (expiryDate) => {
    if (!expiryDate) return '#6b7280';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return '#dc2626';
    if (daysUntilExpiry <= 30) return '#ea580c';
    if (daysUntilExpiry <= 90) return '#f59e0b';
    return '#6b7280';
  };

  const renderMedicalRecord = (record, index) => (
    <div key={record.id}>
      <div style={{ 
        padding: '12px 0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: '#111827',
            marginBottom: '4px'
          }}>
            {medicalClasses[record.type].name}
          </p>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '16px', 
            fontSize: '12px', 
            color: '#6b7280',
            marginBottom: (record.limitations || record.remarks) ? '4px' : '0'
          }}>
            {record.examDate && (
              <span>Examen: {new Date(record.examDate).toLocaleDateString()}</span>
            )}
            {record.expiryDate && (
              <span style={{ color: getExpiryColor(record.expiryDate) }}>
                Expire: {new Date(record.expiryDate).toLocaleDateString()}
              </span>
            )}
            {record.examiner && <span>Dr. {record.examiner}</span>}
          </div>
          {record.limitations && (
            <p style={{ 
              fontSize: '12px', 
              color: '#f59e0b',
              marginBottom: record.remarks ? '2px' : '0'
            }}>
              Limitations: {record.limitations}
            </p>
          )}
          {record.remarks && (
            <p style={{ 
              fontSize: '12px', 
              color: '#9ca3af', 
              fontStyle: 'italic'
            }}>
              {record.remarks}
            </p>
          )}
          {/* Examens complémentaires */}
          {(record.nextECG || record.nextAudiometry || record.nextOphthalmology) && (
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              fontSize: '11px', 
              color: '#9ca3af',
              marginTop: '4px'
            }}>
              {record.nextECG && <span>ECG: {new Date(record.nextECG).toLocaleDateString()}</span>}
              {record.nextAudiometry && <span>Audio: {new Date(record.nextAudiometry).toLocaleDateString()}</span>}
              {record.nextOphthalmology && <span>Ophtalmo: {new Date(record.nextOphthalmology).toLocaleDateString()}</span>}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => handleEdit(record)}
            style={{ 
              padding: '6px', 
              backgroundColor: 'transparent',
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              color: '#6b7280',
              transition: 'all 0.2s'
            }}
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleDelete(record.id)}
            style={{ 
              padding: '6px', 
              backgroundColor: 'transparent',
              color: '#ef4444', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {index < medicalRecords.length - 1 && (
        <div style={{
          height: '1px',
          backgroundColor: '#e5e7eb',
          margin: '0'
        }} />
      )}
    </div>
  );

  // Trouver le certificat médical valide actuel
  const currentMedical = medicalRecords.find(record => {
    const today = new Date();
    const expiry = new Date(record.expiryDate);
    return expiry > today;
  });

  return (
    <div>
      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
          marginBottom: '16px' 
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
            {editingRecord ? 'Modifier le certificat médical' : 'Nouveau certificat médical'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Classe médicale *</label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                style={inputStyle}
                required
              >
                <option value="class1">Classe 1 - Transport public</option>
                <option value="class2">Classe 2 - Pilote privé</option>
                <option value="lapl">LAPL Medical</option>
              </select>
            </div>
            
            <div>
              <label style={labelStyle}>Date d'examen *</label>
              <input
                type="date"
                value={formData.examDate}
                onChange={(e) => handleChange('examDate', e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Date d'expiration *</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                style={{...inputStyle, backgroundColor: '#fef3c7'}}
                required
                title="Calculée automatiquement selon l'âge et la classe"
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Rappel (jours avant expiration)</label>
            <input
              type="number"
              value={formData.reminderDays}
              onChange={(e) => handleChange('reminderDays', e.target.value)}
              min="1"
              max="365"
              style={{...inputStyle, maxWidth: '200px'}}
            />
          </div>

          <h5 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
            Examens complémentaires programmés
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Prochain ECG</label>
              <input
                type="date"
                value={formData.nextECG}
                onChange={(e) => handleChange('nextECG', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Prochaine audiométrie</label>
              <input
                type="date"
                value={formData.nextAudiometry}
                onChange={(e) => handleChange('nextAudiometry', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Prochaine ophtalmologie</label>
              <input
                type="date"
                value={formData.nextOphthalmology}
                onChange={(e) => handleChange('nextOphthalmology', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Remarques</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Notes, observations..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '14px', 
                fontWeight: '500', 
                cursor: 'pointer' 
              }}
            >
              {editingRecord ? 'Modifier' : 'Ajouter'}
            </button>
            
            <button
              onClick={resetForm}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#e5e7eb', 
                color: '#374151', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '14px', 
                fontWeight: '500', 
                cursor: 'pointer' 
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des certificats médicaux */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px' }}>
        {/* Bouton Ajouter centré */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ 
              padding: '8px 24px', 
              backgroundColor: showForm ? '#ef4444' : '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontSize: '14px', 
              fontWeight: '500', 
              cursor: 'pointer'
            }}
          >
            {showForm ? 'Fermer' : 'Ajouter'}
          </button>
        </div>
        
        <div style={{ 
          height: '2px',
          backgroundColor: '#3b82f6',
          marginBottom: '20px'
        }} />

        {medicalRecords.length > 0 && (
          <>
            <div style={{ 
              marginBottom: '8px'
            }}>
              <h4 style={{ 
                fontSize: '16px', 
                fontWeight: '600',
                color: '#111827'
              }}>
                Certificats médicaux
              </h4>
            </div>
            
            <div>
              {medicalRecords.map((record, index) => renderMedicalRecord(record, index))}
            </div>
          </>
        )}

        {medicalRecords.length === 0 && (
          <div style={{ 
            color: '#9ca3af',
            fontSize: '14px',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 0'
          }}>
            <span style={{ color: '#f59e0b', fontSize: '16px', fontWeight: 'bold' }}>!</span>
            Aucun certificat médical enregistré
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalReminders;