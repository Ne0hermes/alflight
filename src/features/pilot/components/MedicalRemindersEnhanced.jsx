// src/features/pilot/components/MedicalRemindersEnhanced.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, Bell, Plus, Edit2, Trash2, Heart, Activity, Eye, Brain, User, Info } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';

const MedicalRemindersEnhanced = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [pilotAge, setPilotAge] = useState(null);
  const [pilotBirthDate, setPilotBirthDate] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'class2', // Par défaut Classe 2
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

  // Classes médicales et leurs durées de validité selon l'âge
  const medicalClasses = {
    class1: {
      name: 'Classe 1 - Transport public',
      validity: (age) => {
        if (age < 40) return 12; // 12 mois
        if (age < 60) return 6;  // 6 mois
        return 6; // 6 mois pour 60+
      },
      requiresECG: (age) => age >= 30, // ECG requis à partir de 30 ans
      requiresAudiometry: (age) => age >= 40, // Audiométrie à partir de 40 ans
      requiresOphthalmology: (age) => age >= 60, // Ophtalmo à partir de 60 ans
      ecgFrequency: (age) => {
        if (age < 30) return null;
        if (age < 40) return 60; // tous les 5 ans
        if (age < 50) return 24; // tous les 2 ans
        return 12; // annuel après 50 ans
      }
    },
    class2: {
      name: 'Classe 2 - Pilote privé',
      validity: (age) => {
        if (age < 40) return 60; // 5 ans
        if (age < 50) return 24; // 2 ans
        return 12; // 1 an après 50 ans
      },
      requiresECG: (age) => age >= 40, // ECG à partir de 40 ans
      requiresAudiometry: (age) => age >= 50, // Audiométrie à partir de 50 ans
      requiresOphthalmology: (age) => age >= 60, // Ophtalmo à partir de 60 ans
      ecgFrequency: (age) => {
        if (age < 40) return null;
        if (age < 50) return 24; // tous les 2 ans
        return 12; // annuel après 50 ans
      }
    },
    lapl: {
      name: 'LAPL Medical',
      validity: (age) => {
        if (age < 40) return 60; // 5 ans
        return 24; // 2 ans après 40 ans
      },
      requiresECG: (age) => age >= 50, // Plus souple pour LAPL
      requiresAudiometry: (age) => age >= 50,
      requiresOphthalmology: (age) => age >= 60,
      ecgFrequency: (age) => age >= 50 ? 24 : null
    }
  };

  // Charger les données au montage
  useEffect(() => {
    // Charger les certificats médicaux
    const savedRecords = localStorage.getItem('pilotMedicalRecords');
    if (savedRecords) {
      setMedicalRecords(JSON.parse(savedRecords));
    }
    
    // Charger l'âge du pilote depuis le profil
    const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    // Vérifier les deux noms possibles : dateOfBirth (nouveau) ou birthDate (ancien)
    const birthDateValue = pilotProfile.dateOfBirth || pilotProfile.birthDate;
    if (birthDateValue) {
      setPilotBirthDate(birthDateValue);
      const age = calculateAge(birthDateValue);
      setPilotAge(age);
    }
    
    checkReminders();
  }, []);

  // Calculer l'âge à partir de la date de naissance
  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Calculer automatiquement la date d'expiration selon l'âge et le type
  const calculateExpiryDate = (examDate, type) => {
    if (!examDate || !pilotAge) return '';
    
    const medicalClass = medicalClasses[type];
    if (!medicalClass) return '';
    
    const validityMonths = medicalClass.validity(pilotAge);
    const exam = new Date(examDate);
    exam.setMonth(exam.getMonth() + validityMonths);
    
    return exam.toISOString().split('T')[0];
  };

  // Vérifier si les examens complémentaires sont requis
  const getRequiredExams = (type, age) => {
    if (!age || !medicalClasses[type]) return {};
    
    const medicalClass = medicalClasses[type];
    return {
      ecg: medicalClass.requiresECG(age),
      audiometry: medicalClass.requiresAudiometry(age),
      ophthalmology: medicalClass.requiresOphthalmology(age)
    };
  };

  // Gérer le changement de date d'examen
  const handleExamDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      examDate: date,
      expiryDate: calculateExpiryDate(date, prev.type)
    }));
  };

  // Gérer le changement de type de certificat
  const handleTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      type: type,
      expiryDate: calculateExpiryDate(prev.examDate, type)
    }));
  };

  // Vérifier les rappels
  const checkReminders = () => {
    const savedRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const today = new Date();
    const newReminders = [];

    savedRecords.forEach(record => {
      if (record.expiryDate) {
        const expiryDate = new Date(record.expiryDate);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          newReminders.push({
            id: `${record.id}-expired`,
            type: 'expired',
            message: `Certificat médical ${medicalClasses[record.type]?.name || record.type} EXPIRÉ depuis ${Math.abs(daysUntilExpiry)} jours`,
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
      }
    });

    setReminders(newReminders);
  };

  // Sauvegarder un certificat
  const handleSave = () => {
    // Validation des champs obligatoires
    if (!formData.type || !formData.examDate || !formData.expiryDate) {
      alert('Le type, la date d\'examen et la date de validité sont obligatoires');
      return;
    }

    const newRecord = {
      ...formData,
      id: editingRecord ? editingRecord.id : Date.now().toString(),
      addedDate: editingRecord ? editingRecord.addedDate : new Date().toISOString()
    };

    let newRecords;
    if (editingRecord) {
      newRecords = medicalRecords.map(r => r.id === editingRecord.id ? newRecord : r);
    } else {
      newRecords = [...medicalRecords, newRecord];
    }

    setMedicalRecords(newRecords);
    localStorage.setItem('pilotMedicalRecords', JSON.stringify(newRecords));
    
    resetForm();
    checkReminders();
  };

  const resetForm = () => {
    setFormData({
      type: 'class2',
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

  const requiredExams = getRequiredExams(formData.type, pilotAge);

  return (
    <div style={sx.spacing.p(4)}>
      {/* En-tête avec bouton d'ajout */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          <Heart size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          Certificats médicaux
        </h3>
        <button
          style={sx.combine(sx.components.button.primary, sx.flex.center)}
          onClick={() => setShowForm(true)}
        >
          <Plus size={16} />
          <span style={sx.spacing.ml(1)}>Ajouter</span>
        </button>
      </div>

      {/* Affichage de l'âge du pilote */}
      {pilotAge && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <User size={16} />
          <div>
            <p style={sx.text.sm}>
              Âge du pilote : <strong>{pilotAge} ans</strong>
            </p>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
              Les durées de validité et examens requis sont adaptés automatiquement selon votre âge.
            </p>
          </div>
        </div>
      )}

      {/* Rappels actifs */}
      {reminders.length > 0 && (
        <div style={sx.spacing.mb(4)}>
          <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
            <Bell size={16} style={{ display: 'inline', marginRight: '4px' }} />
            Rappels actifs
          </h4>
          {reminders.map(reminder => (
            <div 
              key={reminder.id}
              style={sx.combine(
                sx.components.alert.base,
                reminder.priority === 'critical' ? sx.components.alert.error :
                reminder.priority === 'high' ? sx.components.alert.warning :
                sx.components.alert.info,
                sx.spacing.mb(2)
              )}
            >
              <AlertTriangle size={16} />
              <div>
                <p style={sx.text.sm}>{reminder.message}</p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                  Échéance : {new Date(reminder.date).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout/édition */}
      {showForm && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
            {editingRecord ? 'Modifier' : 'Ajouter'} un certificat médical
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Type de certificat (obligatoire) */}
            <div>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Type de certificat * 
                {!pilotAge && (
                  <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                    (Configurez votre date de naissance dans le profil)
                  </span>
                )}
              </label>
              <select
                style={sx.components.input.base}
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                required
              >
                <option value="class1">Classe 1 - Transport public</option>
                <option value="class2">Classe 2 - Pilote privé</option>
                <option value="lapl">LAPL Medical</option>
              </select>
            </div>

            {/* Date d'examen (obligatoire) */}
            <div>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Date d'examen *
              </label>
              <input
                type="date"
                style={sx.components.input.base}
                value={formData.examDate}
                onChange={(e) => handleExamDateChange(e.target.value)}
                required
              />
            </div>

            {/* Date d'expiration (obligatoire, calculée automatiquement) */}
            <div>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Date d'expiration *
                {pilotAge && formData.type && (
                  <span style={{ color: '#10b981', marginLeft: '8px' }}>
                    (Validité: {medicalClasses[formData.type].validity(pilotAge)} mois)
                  </span>
                )}
              </label>
              <input
                type="date"
                style={sx.components.input.base}
                value={formData.expiryDate}
                onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                required
              />
            </div>

            {/* Médecin examinateur (facultatif) */}
            <div>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Médecin examinateur
              </label>
              <input
                type="text"
                style={sx.components.input.base}
                value={formData.examiner}
                onChange={(e) => setFormData({...formData, examiner: e.target.value})}
                placeholder="Dr. Nom (facultatif)"
              />
            </div>

            {/* ECG (affiché selon l'âge et le type) */}
            {requiredExams.ecg && (
              <div>
                <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  <Activity size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Prochain ECG
                  <span style={{ color: '#f59e0b', marginLeft: '4px' }}>
                    (Requis pour votre âge)
                  </span>
                </label>
                <input
                  type="date"
                  style={sx.components.input.base}
                  value={formData.nextECG}
                  onChange={(e) => setFormData({...formData, nextECG: e.target.value})}
                />
              </div>
            )}

            {/* Audiométrie (affiché selon l'âge et le type) */}
            {requiredExams.audiometry && (
              <div>
                <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  <Brain size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Prochaine audiométrie
                  <span style={{ color: '#f59e0b', marginLeft: '4px' }}>
                    (Requis pour votre âge)
                  </span>
                </label>
                <input
                  type="date"
                  style={sx.components.input.base}
                  value={formData.nextAudiometry}
                  onChange={(e) => setFormData({...formData, nextAudiometry: e.target.value})}
                />
              </div>
            )}

            {/* Ophtalmologie (affiché selon l'âge et le type) */}
            {requiredExams.ophthalmology && (
              <div>
                <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  <Eye size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Prochaine ophtalmologie
                  <span style={{ color: '#f59e0b', marginLeft: '4px' }}>
                    (Requis pour votre âge)
                  </span>
                </label>
                <input
                  type="date"
                  style={sx.components.input.base}
                  value={formData.nextOphthalmology}
                  onChange={(e) => setFormData({...formData, nextOphthalmology: e.target.value})}
                />
              </div>
            )}

            {/* Limitations (facultatif) */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Limitations
              </label>
              <input
                type="text"
                style={sx.components.input.base}
                value={formData.limitations}
                onChange={(e) => setFormData({...formData, limitations: e.target.value})}
                placeholder="Ex: VML, VDL, etc. (facultatif)"
              />
            </div>

            {/* Remarques (facultatif) */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Remarques
              </label>
              <textarea
                style={sx.combine(sx.components.input.base, { minHeight: '80px' })}
                value={formData.remarks}
                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                placeholder="Notes personnelles (facultatif)"
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div style={sx.combine(sx.flex.end, sx.spacing.mt(3), { gap: '8px' })}>
            <button
              style={sx.combine(sx.components.button.secondary)}
              onClick={resetForm}
            >
              Annuler
            </button>
            <button
              style={sx.combine(sx.components.button.primary)}
              onClick={handleSave}
            >
              {editingRecord ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des certificats */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {medicalRecords.map(record => (
          <div key={record.id} style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
            <div style={sx.flex.between}>
              <div>
                <h4 style={sx.combine(sx.text.md, sx.text.bold)}>
                  {medicalClasses[record.type]?.name || record.type}
                </h4>
                <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                  Examen : {new Date(record.examDate).toLocaleDateString('fr-FR')}
                  {record.examiner && ` • Dr. ${record.examiner}`}
                </p>
                {record.limitations && (
                  <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
                    <strong>Limitations :</strong> {record.limitations}
                  </p>
                )}
              </div>
              <div style={sx.flex.center}>
                {/* Badge de statut */}
                {getStatusBadge(record.expiryDate)}
                <button
                  style={sx.combine(sx.components.button.icon, sx.spacing.ml(2))}
                  onClick={() => handleEdit(record)}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  style={sx.combine(sx.components.button.icon, sx.spacing.ml(1))}
                  onClick={() => handleDelete(record.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {medicalRecords.length === 0 && !showForm && (
        <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
          <Heart size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p>Aucun certificat médical enregistré</p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
            Cliquez sur "Ajouter" pour enregistrer votre certificat médical
          </p>
        </div>
      )}
    </div>

};

// Fonction helper pour obtenir le badge de statut
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
      padding: '4px 12px',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {daysUntilExpiry < 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
      {text}
    </span>

};

// Fonction helper pour gérer la suppression
const handleDelete = (id) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce certificat médical ?')) {
    const records = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const newRecords = records.filter(r => r.id !== id);
    localStorage.setItem('pilotMedicalRecords', JSON.stringify(newRecords));
    window.location.reload(); // Recharger pour mettre à jour
  }
};

export default MedicalRemindersEnhanced;