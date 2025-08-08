// src/features/pilot/components/PilotProfile.jsx
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save, Camera, Calendar, Award, Heart } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import FlightCurrencyTracker from './FlightCurrencyTracker';

const PilotProfile = ({ setActiveTab }) => {
  const [profile, setProfile] = useState({
    // Informations personnelles
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    
    // Informations pilote
    licenseNumber: '',
    licenseType: 'PPL', // PPL, CPL, ATPL
    licenseCountry: 'France',
    licenseIssueDate: '',
    licenseExpiryDate: '',
    
    // Expérience
    totalFlightHours: 0,
    totalLandings: 0,
    hoursAsP1: 0,
    hoursAsP2: 0,
    nightHours: 0,
    ifrHours: 0,
    crossCountryHours: 0,
    instructorHours: 0,
    
    // Préférences
    preferredUnits: 'metric', // metric, imperial
    defaultAircraft: '',
    homeBase: '',
    
    // Photo
    photo: null
  });

  const [stats, setStats] = useState({
    last30Days: { hours: 0, landings: 0 },
    last90Days: { hours: 0, landings: 0 },
    last12Months: { hours: 0, landings: 0 }
  });

  const [medicalReminder, setMedicalReminder] = useState(null);
  const [licensesAlerts, setLicensesAlerts] = useState([]);

  // Charger le profil depuis localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('pilotProfile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
    
    // Calculer les statistiques depuis le carnet de vol
    calculateStats();
    updateExperienceFromLogbook();
    detectMostUsedAircraft();
    checkMedicalReminder();
    checkLicensesAndQualifications();
    
    // Écouter les mises à jour du carnet de vol
    const handleLogbookUpdate = () => {
      calculateStats();
      updateExperienceFromLogbook();
      detectMostUsedAircraft();
    };
    
    const handleLicensesUpdate = () => {
      checkLicensesAndQualifications();
    };
    
    window.addEventListener('logbook-updated', handleLogbookUpdate);
    window.addEventListener('licenses-updated', handleLicensesUpdate);
    window.addEventListener('qualifications-updated', handleLicensesUpdate);
    
    // Vérifier régulièrement les licences
    const interval = setInterval(() => {
      checkLicensesAndQualifications();
    }, 60000); // Toutes les minutes
    
    return () => {
      window.removeEventListener('logbook-updated', handleLogbookUpdate);
      window.removeEventListener('licenses-updated', handleLicensesUpdate);
      window.removeEventListener('qualifications-updated', handleLicensesUpdate);
      clearInterval(interval);
    };
  }, []);

  // Mettre à jour l'expérience totale depuis le carnet de vol
  const updateExperienceFromLogbook = () => {
    const logs = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
    
    let totalHours = 0;
    let p1Hours = 0;
    let p2Hours = 0;
    let nightHours = 0;
    let ifrHours = 0;
    let crossCountryHours = 0;
    let instructorHours = 0;
    let totalLandings = 0;

    logs.forEach(log => {
      const hours = parseFloat(log.totalTime) || 0;
      totalHours += hours;
      
      if (log.pic) p1Hours += hours;
      if (log.copilot) p2Hours += hours;
      if (log.instructor) instructorHours += hours;
      
      nightHours += parseFloat(log.nightTime) || 0;
      ifrHours += parseFloat(log.ifrTime) || 0;
      if (log.crossCountry) crossCountryHours += hours;
      
      totalLandings += (parseInt(log.dayLandings) || 0) + (parseInt(log.nightLandings) || 0);
    });

    setProfile(prev => ({
      ...prev,
      totalFlightHours: totalHours.toFixed(1),
      hoursAsP1: p1Hours.toFixed(1),
      hoursAsP2: p2Hours.toFixed(1),
      nightHours: nightHours.toFixed(1),
      ifrHours: ifrHours.toFixed(1),
      crossCountryHours: crossCountryHours.toFixed(1),
      instructorHours: instructorHours.toFixed(1),
      totalLandings: totalLandings
    }));
  };

  // Détecter l'avion le plus utilisé
  // Obtenir le statut du certificat médical
  const getMedicalStatus = () => {
    const today = new Date();
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const currentMedical = medicalRecords.find(record => {
      const expiry = new Date(record.expiryDate);
      return expiry > today;
    });
    
    if (!currentMedical) {
      return { status: 'none', message: 'Aucun certificat', daysRemaining: null };
    }
    
    const expiryDate = new Date(currentMedical.expiryDate);
    const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { 
        status: 'expired', 
        message: 'EXPIRÉ', 
        daysRemaining: daysUntilExpiry,
        expiryDate: expiryDate.toLocaleDateString()
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        status: 'urgent', 
        message: `${daysUntilExpiry}j`, 
        daysRemaining: daysUntilExpiry,
        expiryDate: expiryDate.toLocaleDateString()
      };
    } else if (daysUntilExpiry <= 60) {
      return { 
        status: 'warning', 
        message: `${daysUntilExpiry}j`, 
        daysRemaining: daysUntilExpiry,
        expiryDate: expiryDate.toLocaleDateString()
      };
    } else {
      return { 
        status: 'valid', 
        message: 'VALIDE', 
        daysRemaining: daysUntilExpiry,
        expiryDate: expiryDate.toLocaleDateString()
      };
    }
  };

  const getMedicalStatusColor = () => {
    const status = getMedicalStatus();
    switch(status.status) {
      case 'expired': return '#fee2e2';
      case 'urgent': return '#fed7aa';
      case 'warning': return '#fef3c7';
      case 'valid': return '#d1fae5';
      case 'none': return '#f3f4f6';
      default: return '#f3f4f6';
    }
  };

  const getMedicalStatusBorderColor = () => {
    const status = getMedicalStatus();
    switch(status.status) {
      case 'expired': return '#fecaca';
      case 'urgent': return '#fb923c';
      case 'warning': return '#fcd34d';
      case 'valid': return '#86efac';
      case 'none': return '#d1d5db';
      default: return '#d1d5db';
    }
  };

  const getMedicalStatusBadge = () => {
    const status = getMedicalStatus();
    const styles = {
      expired: { backgroundColor: '#991b1b', color: 'white' },
      urgent: { backgroundColor: '#ea580c', color: 'white' },
      warning: { backgroundColor: '#f59e0b', color: 'white' },
      valid: { backgroundColor: '#10b981', color: 'white' },
      none: { backgroundColor: '#6b7280', color: 'white' }
    };
    
    const icons = {
      expired: '⛔',
      urgent: '⚠️',
      warning: '📅',
      valid: '✅',
      none: '❌'
    };
    
    return (
      <div style={{
        ...styles[status.status],
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        display: 'inline-block'
      }}>
        {icons[status.status]} {status.message}
      </div>
    );
  };

  const getMedicalExpiryInfo = () => {
    const status = getMedicalStatus();
    if (status.status === 'none') {
      return 'Non renseigné';
    }
    if (status.status === 'expired') {
      return `Expiré depuis ${Math.abs(status.daysRemaining)} jours`;
    }
    return `Expire le ${status.expiryDate}`;
  };

  // Obtenir le résumé de licence depuis l'onglet Licences
  const getLicenseSummary = () => {
    const licenses = JSON.parse(localStorage.getItem('pilotLicenses') || '[]');
    const activeLicense = licenses.find(l => l.active);
    
    if (activeLicense) {
      return `${activeLicense.type} - N°${activeLicense.number} (${activeLicense.country || 'France'})`;
    }
    
    // Fallback sur les données du profil si pas de licence dans l'onglet dédié
    if (profile.licenseNumber && profile.licenseType) {
      return `${profile.licenseType} - N°${profile.licenseNumber}`;
    }
    
    return 'Aucune licence enregistrée';
  };
  
  // Vérifier les licences et qualifications pour les alertes
  const checkLicensesAndQualifications = () => {
    const today = new Date();
    const alerts = [];
    
    // Charger depuis pilotCertifications (nouvelle structure)
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    
    // Vérifier les licences
    if (certifications.licenses) {
      certifications.licenses.forEach(license => {
        if (license.expiryDate) {
          const expiryDate = new Date(license.expiryDate);
          const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
          const licenseType = (license.type || license.name || '').split(' - ')[0];
          const licenseName = license.type || license.name || 'Licence';
          
          if (daysUntil < 0) {
            alerts.push({
              type: 'license',
              severity: 'expired',
              name: licenseType,
              number: license.number,
              message: `${licenseType} - ${licenseName.includes('-') ? licenseName.split('-')[1].trim() : 'Licence de pilote'} - Expiré`,
              daysOverdue: Math.abs(daysUntil),
              expiryDate
            });
          } else if (daysUntil < 30) {
            alerts.push({
              type: 'license',
              severity: 'critical',
              name: licenseType,
              number: license.number,
              message: `${licenseType} - Expire dans ${daysUntil} jours`,
              daysRemaining: daysUntil,
              expiryDate
            });
          } else if (daysUntil < 90) {
            alerts.push({
              type: 'license',
              severity: 'warning',
              name: licenseType,
              number: license.number,
              message: `${licenseType} - Expire dans ${daysUntil} jours`,
              daysRemaining: daysUntil,
              expiryDate
            });
          }
        }
      });
    }
    
    // Vérifier les qualifications (ratings)
    if (certifications.ratings) {
      certifications.ratings.forEach(rating => {
        if (rating.expiryDate) {
          const expiryDate = new Date(rating.expiryDate);
          const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
          const ratingName = rating.type || rating.name || 'Qualification';
          
          if (daysUntil < 0) {
            alerts.push({
              type: 'qualification',
              severity: 'expired',
              name: ratingName,
              message: `${ratingName} - Expiré`,
              daysOverdue: Math.abs(daysUntil),
              expiryDate
            });
          } else if (daysUntil < 30) {
            alerts.push({
              type: 'qualification',
              severity: 'critical',
              name: ratingName,
              message: `${ratingName} - Expire dans ${daysUntil} jours`,
              daysRemaining: daysUntil,
              expiryDate
            });
          } else if (daysUntil < 90) {
            alerts.push({
              type: 'qualification',
              severity: 'warning',
              name: ratingName,
              message: `${ratingName} - Expire dans ${daysUntil} jours`,
              daysRemaining: daysUntil,
              expiryDate
            });
          }
        }
      });
    }
    
    // Trier par sévérité
    alerts.sort((a, b) => {
      const severityOrder = { expired: 0, critical: 1, warning: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    setLicensesAlerts(alerts);
  };

  // Vérifier les rappels médicaux basés sur l'âge
  const checkMedicalReminder = () => {
    if (!profile.dateOfBirth) return;
    
    const today = new Date();
    const birthDate = new Date(profile.dateOfBirth);
    const age = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24 * 365));
    
    // Obtenir le certificat médical actuel
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const currentMedical = medicalRecords.find(record => {
      const expiry = new Date(record.expiryDate);
      return expiry > today;
    });
    
    if (!currentMedical) {
      setMedicalReminder({
        type: 'missing',
        message: 'Aucun certificat médical valide enregistré',
        priority: 'critical'
      });
      return;
    }
    
    const expiryDate = new Date(currentMedical.expiryDate);
    const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
    
    // Calculer la périodicité recommandée selon l'âge et le type de licence
    let recommendedRenewal = 60; // jours avant expiration
    let periodicityInfo = '';
    
    if (currentMedical.type === 'class1') {
      if (age < 40) {
        periodicityInfo = 'Validité 12 mois (moins de 40 ans)';
      } else if (age < 60) {
        periodicityInfo = 'Validité 6 mois (40-60 ans)';
        recommendedRenewal = 45;
      } else {
        periodicityInfo = 'Validité 6 mois (plus de 60 ans) + examens complémentaires';
        recommendedRenewal = 45;
      }
    } else if (currentMedical.type === 'class2') {
      if (age < 40) {
        periodicityInfo = 'Validité 60 mois (moins de 40 ans)';
      } else if (age < 50) {
        periodicityInfo = 'Validité 24 mois (40-50 ans)';
      } else {
        periodicityInfo = 'Validité 12 mois (plus de 50 ans)';
        recommendedRenewal = 60;
      }
    }
    
    // Créer le rappel approprié
    if (daysUntilExpiry < 0) {
      setMedicalReminder({
        type: 'expired',
        message: `Certificat médical EXPIRÉ depuis ${Math.abs(daysUntilExpiry)} jours`,
        priority: 'critical',
        periodicityInfo,
        age
      });
    } else if (daysUntilExpiry <= recommendedRenewal) {
      setMedicalReminder({
        type: 'renewal',
        message: `Certificat médical expire dans ${daysUntilExpiry} jours`,
        priority: daysUntilExpiry <= 30 ? 'high' : 'medium',
        periodicityInfo,
        age,
        nextRenewalRecommendation: `Prévoir le renouvellement ${recommendedRenewal} jours avant expiration`
      });
    } else {
      setMedicalReminder({
        type: 'valid',
        message: `Certificat valide jusqu'au ${expiryDate.toLocaleDateString()}`,
        priority: 'low',
        periodicityInfo,
        age
      });
    }
  };

  const detectMostUsedAircraft = () => {
    const logs = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
    const aircraftCount = {};
    
    logs.forEach(log => {
      if (log.aircraft) {
        aircraftCount[log.aircraft] = (aircraftCount[log.aircraft] || 0) + 1;
      }
    });
    
    const mostUsed = Object.entries(aircraftCount).sort((a, b) => b[1] - a[1])[0];
    if (mostUsed) {
      setProfile(prev => ({
        ...prev,
        defaultAircraft: mostUsed[0]
      }));
    }
  };

  const calculateStats = () => {
    const logs = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
    const now = new Date();
    const stats = {
      last30Days: { hours: 0, landings: 0 },
      last90Days: { hours: 0, landings: 0 },
      last12Months: { hours: 0, landings: 0 }
    };

    logs.forEach(log => {
      const logDate = new Date(log.date);
      const daysDiff = (now - logDate) / (1000 * 60 * 60 * 24);
      
      const hours = parseFloat(log.totalTime) || 0;
      const landings = parseInt(log.dayLandings || 0) + parseInt(log.nightLandings || 0);

      if (daysDiff <= 30) {
        stats.last30Days.hours += hours;
        stats.last30Days.landings += landings;
      }
      if (daysDiff <= 90) {
        stats.last90Days.hours += hours;
        stats.last90Days.landings += landings;
      }
      if (daysDiff <= 365) {
        stats.last12Months.hours += hours;
        stats.last12Months.landings += landings;
      }
    });

    setStats(stats);
  };

  const handleChange = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({
          ...prev,
          photo: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    localStorage.setItem('pilotProfile', JSON.stringify(profile));
    alert('Profil sauvegardé avec succès !');
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

  // Récupérer les vols du carnet
  const getFlightLog = () => {
    return JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  };

  return (
    <div>
      {/* Notification des certifications nécessitant une attention */}
      {licensesAlerts.length > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: licensesAlerts[0].severity === 'expired' ? '#fee2e2' :
                         licensesAlerts[0].severity === 'critical' ? '#fed7aa' : '#fef3c7',
          border: `2px solid ${licensesAlerts[0].severity === 'expired' ? '#dc2626' :
                              licensesAlerts[0].severity === 'critical' ? '#f59e0b' : '#fcd34d'}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '8px',
                color: licensesAlerts[0].severity === 'expired' ? '#991b1b' : '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {licensesAlerts[0].severity === 'expired' ? '⛔' :
                 licensesAlerts[0].severity === 'critical' ? '⚠️' : '📅'}
                {licensesAlerts.length} certification{licensesAlerts.length > 1 ? 's' : ''} nécessite{licensesAlerts.length > 1 ? 'nt' : ''} votre attention
              </h3>
              
              <ul style={{
                margin: '0',
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#374151'
              }}>
                {licensesAlerts.slice(0, 3).map((alert, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>
                    <strong>{alert.message}</strong>
                    {alert.severity === 'expired' && alert.daysOverdue && (
                      <span style={{ color: '#dc2626', fontSize: '12px', marginLeft: '8px' }}>
                        (depuis {alert.daysOverdue} jours)
                      </span>
                    )}
                  </li>
                ))}
                {licensesAlerts.length > 3 && (
                  <li style={{ color: '#6b7280', fontSize: '12px' }}>
                    Et {licensesAlerts.length - 3} autre{licensesAlerts.length - 3 > 1 ? 's' : ''}...
                  </li>
                )}
              </ul>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  checkLicensesAndQualifications();
                  // Afficher un feedback visuel
                  const btn = event.currentTarget;
                  const originalText = btn.textContent;
                  btn.textContent = '✓ Mis à jour';
                  btn.style.backgroundColor = '#10b981';
                  setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '#3b82f6';
                  }, 2000);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.3s'
                }}
              >
                🔄 Mettre à jour
              </button>
              
              <button
                onClick={() => {
                  if (setActiveTab) {
                    setActiveTab('certifications');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: licensesAlerts[0].severity === 'expired' ? '#dc2626' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                🎓 Gérer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Suivi des obligations réglementaires */}
      <FlightCurrencyTracker 
        pilotData={profile} 
        flightLog={getFlightLog()}
      />
      
      {/* Carte de profil */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4), sx.spacing.mt(4))}>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(4))}>
          {/* Photo de profil */}
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {profile.photo ? (
                <img 
                  src={profile.photo} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={40} color="#9ca3af" />
              )}
            </div>
            <label style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              padding: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              <Camera size={16} color="white" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Informations principales */}
          <div style={{ flex: 1 }}>
            <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
              {profile.firstName && profile.lastName 
                ? `${profile.firstName} ${profile.lastName}`
                : 'Nom du pilote'}
            </h3>
            
            {profile.licenseNumber && (
              <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                <Award size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Licence {profile.licenseType} - N° {profile.licenseNumber}
              </p>
            )}
            
            {profile.email && (
              <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                <Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {profile.email}
              </p>
            )}
            
            {profile.phone && (
              <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {profile.phone}
              </p>
            )}
          </div>

          {/* Statistiques rapides et statut médical */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Statut médical */}
            <div style={{
              backgroundColor: getMedicalStatusColor(),
              padding: '16px',
              borderRadius: '8px',
              minWidth: '180px',
              border: `1px solid ${getMedicalStatusBorderColor()}`
            }}>
              <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                <Heart size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Certificat médical
              </h4>
              <div style={{ textAlign: 'center' }}>
                {getMedicalStatusBadge()}
                {getMedicalExpiryInfo() && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    {getMedicalExpiryInfo()}
                  </p>
                )}
              </div>
            </div>
            
            {/* Activité récente */}
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderRadius: '8px',
              minWidth: '200px'
            }}>
              <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Activité récente
              </h4>
              <div style={sx.spacing.mb(2)}>
                <p style={sx.text.xs}>30 derniers jours</p>
                <p style={sx.text.sm}>
                  <strong>{stats.last30Days.hours.toFixed(1)}h</strong> / {stats.last30Days.landings} att.
                </p>
              </div>
              <div style={sx.spacing.mb(2)}>
                <p style={sx.text.xs}>90 derniers jours</p>
                <p style={sx.text.sm}>
                  <strong>{stats.last90Days.hours.toFixed(1)}h</strong> / {stats.last90Days.landings} att.
                </p>
              </div>
              <div>
                <p style={sx.text.xs}>12 derniers mois</p>
                <p style={sx.text.sm}>
                  <strong>{stats.last12Months.hours.toFixed(1)}h</strong> / {stats.last12Months.landings} att.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rappel médical basé sur l'âge */}
      {medicalReminder && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            <Heart size={16} style={{ display: 'inline', marginRight: '8px' }} />
            Suivi médical aéronautique
          </h4>
          
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: medicalReminder.priority === 'critical' ? '#fecaca' :
                        medicalReminder.priority === 'high' ? '#fb923c' :
                        medicalReminder.priority === 'medium' ? '#fcd34d' : '#86efac',
            backgroundColor: medicalReminder.priority === 'critical' ? '#fee2e2' :
                            medicalReminder.priority === 'high' ? '#fed7aa' :
                            medicalReminder.priority === 'medium' ? '#fef3c7' : '#f0fdf4',
            marginBottom: '16px'
          }}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              {medicalReminder.priority === 'critical' && '🚨'}
              {medicalReminder.priority === 'high' && '⚠️'}
              {medicalReminder.priority === 'medium' && '📅'}
              {medicalReminder.priority === 'low' && '✅'}
              {' '}{medicalReminder.message}
            </p>
            {medicalReminder.age && (
              <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                Âge actuel: {medicalReminder.age} ans - {medicalReminder.periodicityInfo}
              </p>
            )}
            {medicalReminder.nextRenewalRecommendation && (
              <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
                💡 {medicalReminder.nextRenewalRecommendation}
              </p>
            )}
          </div>

          {/* Méthode de relance détaillée */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              📋 Méthode de relance automatique
            </h5>
            <ul style={sx.combine(sx.text.xs, { marginLeft: '20px', lineHeight: '1.6' })}>
              <li><strong>60 jours avant:</strong> Premier rappel informatif</li>
              <li><strong>45 jours avant:</strong> Rappel de prise de RDV (Classe 1 &gt;40 ans)</li>
              <li><strong>30 jours avant:</strong> Rappel urgent - Action requise</li>
              <li><strong>15 jours avant:</strong> Alerte critique</li>
              <li><strong>Après expiration:</strong> Blocage avec alerte permanente</li>
            </ul>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(2))}>
              Les rappels sont calculés automatiquement selon votre âge ({medicalReminder?.age || '?'} ans) 
              et le type de certificat médical.
            </p>
          </div>

          {/* Réglementation EASA */}
          <div style={{
            backgroundColor: '#eff6ff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dbeafe'
          }}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              📚 Réglementation EASA Part-MED
            </h5>
            
            <div style={sx.combine(sx.text.xs, { lineHeight: '1.8' })}>
              <p style={sx.spacing.mb(2)}>
                <strong>Périodicité selon l'âge et la classe:</strong>
              </p>
              
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e0e7ff' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #c7d2fe' }}>Classe</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #c7d2fe' }}>Âge</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #c7d2fe' }}>Validité</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td rowSpan="3" style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}><strong>Classe 1</strong></td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>&lt; 40 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>12 mois</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>40-60 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>6 mois</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>&gt; 60 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>6 mois</td>
                  </tr>
                  
                  <tr>
                    <td rowSpan="3" style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}><strong>Classe 2</strong></td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>&lt; 40 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>60 mois</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>40-50 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>24 mois</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>&gt; 50 ans</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>12 mois</td>
                  </tr>
                  
                  <tr>
                    <td rowSpan="2" style={{ padding: '8px' }}><strong>LAPL</strong></td>
                    <td style={{ padding: '8px' }}>&lt; 40 ans</td>
                    <td style={{ padding: '8px' }}>60 mois</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px' }}>&gt; 40 ans</td>
                    <td style={{ padding: '8px' }}>24 mois</td>
                  </tr>
                </tbody>
              </table>
              
              <p style={sx.spacing.mt(3)}>
                <strong>Examens complémentaires requis:</strong>
              </p>
              <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                <li><strong>ECG au repos:</strong> Initial à 40 ans, puis selon AME</li>
                <li><strong>Audiométrie:</strong> Initial à 40 ans, puis tous les 5 ans</li>
                <li><strong>Ophtalmologie:</strong> Selon limitations ou à partir de 40 ans</li>
                <li><strong>ECG d'effort:</strong> Classe 1 à partir de 65 ans</li>
              </ul>
              
              <div style={sx.spacing.mt(3)}>
                <p style={sx.text.bold}>📖 Liens officiels:</p>
                <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                  <li>
                    <a href="https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-medical-requirements" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style={{ color: '#2563eb', textDecoration: 'underline' }}>
                      EASA Easy Access Rules for Medical Requirements
                    </a>
                  </li>
                  <li>
                    <a href="https://www.ecologie.gouv.fr/sites/default/files/Part_MED.pdf" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style={{ color: '#2563eb', textDecoration: 'underline' }}>
                      Part-MED (Version française - DGAC)
                    </a>
                  </li>
                  <li>
                    <a href="https://www.easa.europa.eu/en/downloads/20016/en" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style={{ color: '#2563eb', textDecoration: 'underline' }}>
                      AMC and GM to Part-MED
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div style={sx.spacing.mt(3)}>
            <button
              onClick={() => {
                // Basculer vers l'onglet Suivi Médical
                if (window.setActiveTab) {
                  window.setActiveTab('pilot');
                  // Attendre un peu puis changer l'onglet interne
                  setTimeout(() => {
                    const medicalTab = document.querySelector('[data-tab-id="medical"]');
                    if (medicalTab) medicalTab.click();
                  }, 100);
                }
              }}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              <Calendar size={16} />
              Gérer mes certificats médicaux
            </button>
          </div>
        </div>
      )}

      {/* Formulaire détaillé */}
      <div style={sx.combine(sx.components.card.base)}>
        {/* Informations personnelles */}
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Informations personnelles
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>Prénom *</label>
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          
          <div>
            <label style={labelStyle}>Nom *</label>
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          
          <div>
            <label style={labelStyle}>Date de naissance</label>
            <input
              type="date"
              value={profile.dateOfBirth}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => handleChange('email', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Téléphone</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Nationalité</label>
            <input
              type="text"
              value={profile.nationality}
              onChange={(e) => handleChange('nationality', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Adresse */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>Adresse</label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => handleChange('address', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Ville</label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => handleChange('city', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Code postal</label>
            <input
              type="text"
              value={profile.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              style={inputStyle}
            />
          </div>
          
          <div>
            <label style={labelStyle}>Pays</label>
            <input
              type="text"
              value={profile.country}
              onChange={(e) => handleChange('country', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Expérience de vol */}
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Expérience totale
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>Heures totales (auto)</label>
            <input
              type="number"
              value={profile.totalFlightHours}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures P1/CDB (auto)</label>
            <input
              type="number"
              value={profile.hoursAsP1}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures P2/OPL (auto)</label>
            <input
              type="number"
              value={profile.hoursAsP2}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Atterrissages totaux (auto)</label>
            <input
              type="number"
              value={profile.totalLandings}
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures de nuit (auto)</label>
            <input
              type="number"
              value={profile.nightHours}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures IFR (auto)</label>
            <input
              type="number"
              value={profile.ifrHours}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures voyage (auto)</label>
            <input
              type="number"
              value={profile.crossCountryHours}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Heures instruction (auto)</label>
            <input
              type="number"
              value={profile.instructorHours}
              step="0.1"
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Calculé automatiquement depuis le carnet de vol"
            />
          </div>
        </div>

        {/* Préférences */}
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Préférences
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={labelStyle}>Unités préférées</label>
            <select
              value={profile.preferredUnits}
              onChange={(e) => handleChange('preferredUnits', e.target.value)}
              style={inputStyle}
            >
              <option value="metric">Métrique (m, km, kg)</option>
              <option value="imperial">Impérial (ft, nm, lbs)</option>
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>Avion par défaut (le plus utilisé)</label>
            <input
              type="text"
              value={profile.defaultAircraft}
              style={{...inputStyle, backgroundColor: '#f3f4f6'}}
              disabled
              title="Détecté automatiquement comme l'avion le plus utilisé"
            />
          </div>
          
          <div>
            <label style={labelStyle}>Base d'attache</label>
            <input
              type="text"
              value={profile.homeBase}
              onChange={(e) => handleChange('homeBase', e.target.value)}
              placeholder="LFXX"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <button
          onClick={handleSave}
          style={sx.combine(sx.components.button.base, sx.components.button.primary)}
        >
          <Save size={16} />
          Sauvegarder le profil
        </button>
      </div>
    </div>
  );
};

export default PilotProfile;