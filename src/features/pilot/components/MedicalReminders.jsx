// src/features/pilot/components/MedicalReminders.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Bell, Plus, Edit2, Trash2, Heart, Activity, Eye, Brain } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const MedicalReminders = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const [formData, setFormData] = useState({
    type: 'class1',
    examDate: '',
    expiryDate: '',
    examiner: '',
    limitations: '',
    nextECG: '',
    nextAudiometry: '',
    nextOphthalmology: '',
    remarks: '',
    reminderDays: 60 // Rappel par défaut 60 jours avant expiration
  });

  // Classes médicales et leurs durées de validité standard
  const medicalClasses = {
    class1: {
      name: 'Classe 1 - Transport public',
      validity: {
        under40: 12, // mois
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
    
    checkReminders();
  }, []);

  // Vérifier les rappels
  const checkReminders = () => {
    const savedRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const today = new Date();
    const newReminders = [];

    savedRecords.forEach(record => {
      if (record.expiryDate) {
        const expiryDate = new Date(record.expiryDate);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        // Créer des rappels selon l'urgence
        if (daysUntilExpiry < 0) {
          newReminders.push({
            id: `${record.id}-expired`,
            type: 'expired',
            message: `Certificat médical ${medicalClasses[record.type].name} EXPIRÉ depuis ${Math.abs(daysUntilExpiry)} jours`,
            date: record.expiryDate,
            priority: 'critical'
          });
        } else if (daysUntilExpiry <= 30) {
          newReminders.push({
            id: `${record.id}-urgent`,
            type: 'urgent',
            message: `Certificat médical expire dans ${daysUntilExpiry} jours`,
            date: record.expiryDate,
            priority: 'high'
          });
        } else if (daysUntilExpiry <= record.reminderDays) {
          newReminders.push({
            id: `${record.id}-reminder`,
            type: 'reminder',
            message: `Prévoir le renouvellement du certificat médical (expire dans ${daysUntilExpiry} jours)`,
            date: record.expiryDate,
            priority: 'medium'
          });
        }

        // Rappels pour examens complémentaires
        ['nextECG', 'nextAudiometry', 'nextOphthalmology'].forEach(exam => {
          if (record[exam]) {
            const examDate = new Date(record[exam]);
            const daysUntilExam = Math.floor((examDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExam <= 30 && daysUntilExam >= 0) {
              const examName = exam.replace('next', '');
              newReminders.push({
                id: `${record.id}-${exam}`,
                type: 'exam',
                message: `${examName} prévu dans ${daysUntilExam} jours`,
                date: record[exam],
                priority: 'low'
              });
            }
          }
        });
      }
    });

    setReminders(newReminders.sort((a, b) => {
      const priorities = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorities[a.priority] - priorities[b.priority];
    }));
  };

  // Calculer automatiquement la date d'expiration
  const calculateExpiryDate = (examDate, type) => {
    if (!examDate || !type) return '';
    
    const exam = new Date(examDate);
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const age = profile.dateOfBirth ? 
      Math.floor((exam - new Date(profile.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365)) : 40;
    
    let validityMonths = 12; // Par défaut
    
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
    
    // Mettre à jour les rappels
    checkReminders();
    
    resetForm();
    alert(editingRecord ? 'Certificat médical modifié !' : 'Certificat médical enregistré !');
  };

  const resetForm = () => {
    setFormData({
      type: 'class1',
      examDate: '',
      expiryDate: '',
      examiner: '',
      limitations: '',
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
      checkReminders();
    }
  };

  const getStatusBadge = (expiryDate) => {
    if (!expiryDate) return null;
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    
    let style, text;
    if (daysUntilExpiry < 0) {
      style = { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
      text = `Expiré (${Math.abs(daysUntilExpiry)}j)`;
    } else if (daysUntilExpiry <= 30) {
      style = { backgroundColor: '#fed7aa', color: '#9a3412', border: '1px solid #fb923c' };
      text = `Expire dans ${daysUntilExpiry}j`;
    } else if (daysUntilExpiry <= 90) {
      style = { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
      text = `${daysUntilExpiry}j restants`;
    } else {
      style = { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #86efac' };
      text = 'Valide';
    }
    
    return (
      <span style={{
        ...style,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {text}
      </span>
    );
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

  // Obtenir le certificat actuel (le plus récent non expiré)
  const currentMedical = medicalRecords.find(record => {
    const expiry = new Date(record.expiryDate);
    return expiry > new Date();
  });

  return (
    <div>
      {/* Vue d'ensemble */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
            <Heart size={20} style={{ display: 'inline', marginRight: '8px' }} />
            Suivi Médical Aéronautique
          </h3>
          
          <button
            onClick={() => setShowForm(!showForm)}
            style={sx.combine(sx.components.button.base, sx.components.button.primary)}
          >
            <Plus size={16} />
            Nouveau certificat
          </button>
        </div>

        {/* Statut actuel */}
        {currentMedical ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #86efac'
          }}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
              <div>
                <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: '4px', color: '#10b981' }} />
                  Certificat médical actuel
                </h4>
                <p style={sx.text.sm}>
                  {medicalClasses[currentMedical.type].name}
                </p>
              </div>
              {getStatusBadge(currentMedical.expiryDate)}
            </div>
            
            <div style={sx.combine(sx.text.sm, sx.flex.row, sx.spacing.gap(4))}>
              <span>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Examen: {new Date(currentMedical.examDate).toLocaleDateString()}
              </span>
              <span>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Expire: {new Date(currentMedical.expiryDate).toLocaleDateString()}
              </span>
              {currentMedical.examiner && (
                <span>
                  Examinateur: {currentMedical.examiner}
                </span>
              )}
            </div>
            
            {currentMedical.limitations && (
              <p style={sx.combine(sx.text.sm, sx.spacing.mt(2), {
                backgroundColor: '#fef3c7',
                padding: '8px',
                borderRadius: '4px'
              })}>
                ⚠️ Limitations: {currentMedical.limitations}
              </p>
            )}
          </div>
        ) : (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger)}>
            <AlertTriangle size={16} />
            <div>
              <p style={sx.text.sm}>
                <strong>Aucun certificat médical valide</strong>
              </p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Ajoutez votre certificat médical pour activer les rappels automatiques
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rappels et alertes */}
      {reminders.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            <Bell size={16} style={{ display: 'inline', marginRight: '8px' }} />
            Rappels et alertes
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reminders.map(reminder => (
              <div
                key={reminder.id}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: reminder.priority === 'critical' ? '#fecaca' :
                              reminder.priority === 'high' ? '#fb923c' :
                              reminder.priority === 'medium' ? '#fcd34d' : '#d1d5db',
                  backgroundColor: reminder.priority === 'critical' ? '#fee2e2' :
                                  reminder.priority === 'high' ? '#fed7aa' :
                                  reminder.priority === 'medium' ? '#fef3c7' : '#f9fafb'
                }}
              >
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  {reminder.priority === 'critical' && '🚨'}
                  {reminder.priority === 'high' && '⚠️'}
                  {reminder.priority === 'medium' && '📅'}
                  {reminder.priority === 'low' && 'ℹ️'}
                  {' '}{reminder.message}
                </p>
                {reminder.date && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Date: {new Date(reminder.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
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
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Médecin examinateur</label>
              <input
                type="text"
                value={formData.examiner}
                onChange={(e) => handleChange('examiner', e.target.value)}
                placeholder="Dr. Nom"
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>Rappel (jours avant)</label>
              <input
                type="number"
                value={formData.reminderDays}
                onChange={(e) => handleChange('reminderDays', e.target.value)}
                min="1"
                max="365"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Limitations / Restrictions</label>
            <input
              type="text"
              value={formData.limitations}
              onChange={(e) => handleChange('limitations', e.target.value)}
              placeholder="Ex: VDL (port de verres correcteurs), etc."
              style={inputStyle}
            />
          </div>

          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Examens complémentaires programmés
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>
                <Activity size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Prochain ECG
              </label>
              <input
                type="date"
                value={formData.nextECG}
                onChange={(e) => handleChange('nextECG', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>
                <Brain size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Prochaine audiométrie
              </label>
              <input
                type="date"
                value={formData.nextAudiometry}
                onChange={(e) => handleChange('nextAudiometry', e.target.value)}
                style={inputStyle}
              />
            </div>
            
            <div>
              <label style={labelStyle}>
                <Eye size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Prochaine ophtalmo
              </label>
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
              placeholder="Notes, observations médicales..."
              rows={2}
              style={sx.combine(inputStyle, { resize: 'vertical' })}
            />
          </div>

          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <button
              onClick={handleSubmit}
              style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            >
              {editingRecord ? 'Modifier' : 'Enregistrer'}
            </button>
            
            <button
              onClick={resetForm}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Historique des certificats */}
      <div>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Historique des certificats médicaux
        </h4>
        
        {medicalRecords.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {medicalRecords.map(record => (
              <div key={record.id} style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <div>
                    <strong>{medicalClasses[record.type].name}</strong>
                    <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                      Examen: {new Date(record.examDate).toLocaleDateString()} - 
                      Expire: {new Date(record.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), { alignItems: 'center' })}>
                    {getStatusBadge(record.expiryDate)}
                    
                    <div style={sx.combine(sx.flex.row, sx.spacing.gap(1))}>
                      <button
                        onClick={() => handleEdit(record)}
                        style={{...sx.components.button.base, padding: '4px 8px'}}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        style={{...sx.components.button.base, ...sx.components.button.danger, padding: '4px 8px'}}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {record.examiner && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Examinateur: {record.examiner}
                  </p>
                )}
                
                {record.limitations && (
                  <p style={sx.combine(sx.text.xs, {
                    backgroundColor: '#fef3c7',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '8px',
                    display: 'inline-block'
                  })}>
                    Limitations: {record.limitations}
                  </p>
                )}
                
                <div style={sx.combine(sx.text.xs, sx.flex.row, sx.spacing.gap(3), sx.spacing.mt(2))}>
                  {record.nextECG && (
                    <span>ECG: {new Date(record.nextECG).toLocaleDateString()}</span>
                  )}
                  {record.nextAudiometry && (
                    <span>Audio: {new Date(record.nextAudiometry).toLocaleDateString()}</span>
                  )}
                  {record.nextOphthalmology && (
                    <span>Ophtalmo: {new Date(record.nextOphthalmology).toLocaleDateString()}</span>
                  )}
                </div>
                
                {record.remarks && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    📝 {record.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={sx.combine(sx.components.card.base, sx.text.center, sx.spacing.p(8))}>
            <Heart size={48} style={{ margin: '0 auto 16px', color: '#9ca3af' }} />
            <p style={sx.text.base}>Aucun certificat médical enregistré</p>
            <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(2))}>
              Ajoutez votre certificat médical pour activer le suivi et les rappels automatiques
            </p>
          </div>
        )}
      </div>

      {/* Information réglementaire */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(4))}>
        <p style={sx.combine(sx.text.sm, sx.text.bold)}>
          ℹ️ Validité des certificats médicaux (EASA)
        </p>
        <ul style={sx.combine(sx.text.xs, sx.spacing.mt(2), { marginLeft: '20px' })}>
          <li><strong>Classe 1:</strong> 12 mois (&lt;40 ans) / 6 mois (&gt;40 ans)</li>
          <li><strong>Classe 2:</strong> 60 mois (&lt;40 ans) / 24 mois (40-50 ans) / 12 mois (&gt;50 ans)</li>
          <li><strong>LAPL:</strong> 60 mois (&lt;40 ans) / 24 mois (&gt;40 ans)</li>
          <li>ECG requis: À partir de 40 ans puis selon périodicité définie</li>
          <li>Audiométrie: À partir de 40 ans puis tous les 5 ans</li>
        </ul>
      </div>
    </div>
  );
};

export default MedicalReminders;