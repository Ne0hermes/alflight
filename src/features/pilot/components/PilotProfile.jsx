// src/features/pilot/components/PilotProfile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { User, MapPin, Save, Camera, Award, Heart, Settings, Download, Upload } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import FlightCurrencyTracker from './FlightCurrencyTracker';
import PilotCertifications from './PilotCertifications';
import MedicalReminders from './MedicalReminders';
import UnitsConfiguration from './UnitsConfiguration';
import { exportPilotData, importData } from '../utils/exportUtils';
import ImageEditor from '../../../components/ImageEditor';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import AccordionButton from '../../../shared/components/AccordionButton';
import {
  addCompleteTestData,
  verifyCompleteProfile,
  clearAllProfileData,
  runCompleteSystemTest
} from '../../../utils/testCompleteExportImport';

const PilotProfile = () => {
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [showUnitsConfig, setShowUnitsConfig] = useState(false);
  const fileInputRef = useRef(null);

  // Récupérer les unités actuelles depuis le store
  const units = unitsSelectors.useUnits();

  // Liste des nationalités
  const nationalities = [
    'Française',
    'Allemande',
    'Américaine',
    'Anglaise',
    'Argentine',
    'Australienne',
    'Autrichienne',
    'Belge',
    'Brésilienne',
    'Britannique',
    'Canadienne',
    'Chinoise',
    'Colombienne',
    'Coréenne',
    'Croate',
    'Danoise',
    'Écossaise',
    'Égyptienne',
    'Espagnole',
    'Estonienne',
    'Finlandaise',
    'Grecque',
    'Hollandaise',
    'Hongroise',
    'Indienne',
    'Indonésienne',
    'Irlandaise',
    'Islandaise',
    'Israélienne',
    'Italienne',
    'Japonaise',
    'Lettone',
    'Libanaise',
    'Lituanienne',
    'Luxembourgeoise',
    'Marocaine',
    'Mexicaine',
    'Néerlandaise',
    'Néo-Zélandaise',
    'Norvégienne',
    'Pakistanaise',
    'Péruvienne',
    'Philippin(e)',
    'Polonaise',
    'Portugaise',
    'Roumaine',
    'Russe',
    'Serbe',
    'Singapourienne',
    'Slovaque',
    'Slovène',
    'Sud-Africaine',
    'Suédoise',
    'Suisse',
    'Taïwanaise',
    'Tchèque',
    'Thaïlandaise',
    'Tunisienne',
    'Turque',
    'Ukrainienne',
    'Vietnamienne'
  ].sort((a, b) => a.localeCompare(b, 'fr'));
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
    dayHours: 0,
    nightHours: 0,
    ifrHours: 0,
    crossCountryHours: 0,
    instructorHours: 0,
    
    // Préférences
    preferredUnits: 'metric', // metric, imperial
    defaultAircraft: '',
    homeBase: '',
    clubSchool: '',
    
    // Photo
    photo: null
  });

  const [stats, setStats] = useState({
    last30Days: { hours: 0, landings: 0 },
    last90Days: { hours: 0, landings: 0 },
    last12Months: { hours: 0, landings: 0 }
  });

  const [showCertifications, setShowCertifications] = useState(false);
  const [showMedical, setShowMedical] = useState(false);

  // Fonction pour gérer l'ouverture/fermeture des sections
  // Permet de fermer une section ouverte en cliquant dessus
  // ET ferme automatiquement les autres sections quand on en ouvre une nouvelle
  const toggleSection = (section) => {
    // Récupérer l'état actuel de la section cliquée
    let currentSectionState = false;
    switch(section) {
      case 'personalInfo':
        currentSectionState = showPersonalInfo;
        break;
      case 'certifications':
        currentSectionState = showCertifications;
        break;
      case 'medical':
        currentSectionState = showMedical;
        break;
      case 'units':
        currentSectionState = showUnitsConfig;
        break;
    }

    // Si la section était fermée, fermer toutes les autres
    if (!currentSectionState) {
      setShowPersonalInfo(false);
      setShowCertifications(false);
      setShowMedical(false);
      setShowUnitsConfig(false);
    }

    // Toggle la section cliquée
    switch(section) {
      case 'personalInfo':
        setShowPersonalInfo(prev => !prev);
        break;
      case 'certifications':
        setShowCertifications(prev => !prev);
        break;
      case 'medical':
        setShowMedical(prev => !prev);
        break;
      case 'units':
        setShowUnitsConfig(prev => !prev);
        break;
    }
  };

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

    // Ajouter les fonctions de test au window pour faciliter les tests
    if (typeof window !== 'undefined') {
      window.testExportImport = {
        addCompleteTestData,
        verifyCompleteProfile,
        clearAllProfileData,
        runCompleteSystemTest
      };
      console.log('🧪 Fonctions de test disponibles:');
      console.log('  testExportImport.runCompleteSystemTest() - Test complet du système');
      console.log('  testExportImport.addCompleteTestData() - Ajouter des données de test');
      console.log('  testExportImport.verifyCompleteProfile() - Vérifier le profil');
      console.log('  testExportImport.clearAllProfileData() - Vider toutes les données');
    }
    
    // Écouter les mises à jour du carnet de vol
    const handleLogbookUpdate = () => {
      calculateStats();
      updateExperienceFromLogbook();
      detectMostUsedAircraft();
    };
    
    
    window.addEventListener('logbook-updated', handleLogbookUpdate);
    
    return () => {
      window.removeEventListener('logbook-updated', handleLogbookUpdate);
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
    let dayHours = 0; // Ajout des heures de jour
    let crossCountryHours = 0;
    let instructorHours = 0;
    let totalLandings = 0;

    logs.forEach(log => {
      // Convertir le temps total en heures décimales
      let hours = 0;
      if (log.totalTime) {
        if (log.totalTime.includes(':')) {
          const [h, m] = log.totalTime.split(':').map(Number);
          hours = h + (m / 60);
        } else {
          hours = parseFloat(log.totalTime) || 0;
        }
      }
      totalHours += hours;

      // Si l'entrée a des segments de vol, les utiliser pour calculer P1/P2
      if (log.flightSegments && Array.isArray(log.flightSegments) && log.flightSegments.length > 0) {
        log.flightSegments.forEach(segment => {
          const segmentTime = parseFloat(segment.time) || 0;

          // Calcul des heures P1/P2 depuis les segments
          if (segment.functionOnBoard === 'pic') p1Hours += segmentTime;
          if (segment.functionOnBoard === 'copilot') p2Hours += segmentTime;
          if (segment.functionOnBoard === 'instructor') instructorHours += segmentTime;

          // Calcul des heures jour/nuit depuis les segments
          if (segment.flightType === 'vfr-night' || segment.flightType === 'ifr-night') {
            nightHours += segmentTime;
          } else if (segment.flightType === 'vfr-day' || segment.flightType === 'ifr-day') {
            dayHours += segmentTime;
          }

          // Calcul des heures IFR depuis les segments
          if (segment.flightType === 'ifr-day' || segment.flightType === 'ifr-night') {
            ifrHours += segmentTime;
          }
        });
      } else {
        // Compatibilité avec l'ancien format (sans segments)
        if (log.pic || log.functionOnBoard === 'pic') p1Hours += hours;
        if (log.copilot || log.functionOnBoard === 'copilot') p2Hours += hours;
        if (log.instructor || log.functionOnBoard === 'instructor') instructorHours += hours;

        nightHours += parseFloat(log.nightTime) || 0;
        ifrHours += parseFloat(log.ifrTime) || 0;

        // Calculer les heures de jour (total - nuit)
        const currentNight = parseFloat(log.nightTime) || 0;
        dayHours += Math.max(0, hours - currentNight);
      }

      if (log.crossCountry) crossCountryHours += hours;
      totalLandings += (parseInt(log.dayLandings) || 0) + (parseInt(log.nightLandings) || 0);
    });

    setProfile(prev => ({
      ...prev,
      totalFlightHours: totalHours.toFixed(1),
      hoursAsP1: p1Hours.toFixed(1),
      hoursAsP2: p2Hours.toFixed(1),
      dayHours: dayHours.toFixed(1),
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
  
  // Fonction retirée - les notifications sont maintenant dans le dashboard
  /*
  const checkLicensesAndQualifications = () => {
    // Cette fonction a été retirée car les notifications
    // sont maintenant gérées directement dans le dashboard
  };
  */


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

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await importData(file, { merge: false });

      // Message de succès détaillé
      let detailMessage = `✅ Import réussi!\n\n`;
      detailMessage += `Type: ${result.type}\n`;
      detailMessage += `${result.message}\n\n`;
      detailMessage += `La page va se recharger pour afficher les nouvelles données.`;

      alert(detailMessage);

      // Recharger les données après un court délai
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      // Message d'erreur plus détaillé
      let errorMessage = `❌ Erreur d'import\n\n`;
      errorMessage += `${error.message}\n\n`;
      errorMessage += `Vérifiez que:\n`;
      errorMessage += `• Le fichier est un export valide d'ALFlight\n`;
      errorMessage += `• Le fichier n'a pas été modifié manuellement\n`;
      errorMessage += `• Le fichier contient bien les données attendues`;

      console.error('Détails de l\'erreur:', error);
      alert(errorMessage);
    }

    // Réinitialiser l'input file
    event.target.value = '';
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
      {/* Suivi des obligations réglementaires - Désactivé */}
      {false && (
        <FlightCurrencyTracker 
          pilotData={profile} 
          flightLog={getFlightLog()}
        />
      )}
      
      {/* Carte de profil */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4), sx.spacing.mt(4))}>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(4))}>
          {/* Photo de profil avec ImageEditor */}
          <div style={{ position: 'relative' }}>
            <ImageEditor
              src={profile.photo}
              alt="Photo de profil"
              width={120}
              height={120}
              shape="circle"
              showControls={true}
              onSave={(editedData) => {
                // Sauvegarder les données d'édition
                setProfile(prev => ({
                  ...prev,
                  photoEditData: editedData
                }));
              }}
              placeholder={
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={40} color="#9ca3af" />
                </div>
              }
            />
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
          </div>

          {/* Boutons d'export/import */}
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', position: 'relative' }}>
            {/* Input file caché pour l'import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />

            {/* Bouton Import */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
              title="Importer des données JSON"
            >
              <Upload size={16} />
              Importer
            </button>

            {/* Bouton Export direct */}
            <button
              onClick={() => exportPilotData()}
              style={{
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
              title="Exporter le profil pilote"
            >
              <Download size={16} />
              Exporter le profil pilote
            </button>
          </div>
        </div>
      </div>

      {/* Configuration actuelle des unités */}
      <div style={{
        ...sx.combine(sx.components.card.base, sx.spacing.mb(4)),
        backgroundColor: '#f8f9fa',
        border: '1px solid #e5e7eb',
        padding: '20px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#374151'
        }}>
          <Settings size={18} />
          Configuration actuelle
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Distance</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.distance?.toUpperCase() || 'NM'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Altitude</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.altitude?.toUpperCase() || 'FT'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Vitesse</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.speed?.toUpperCase() || 'KT'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Température</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              °{units?.temperature?.toUpperCase() || 'C'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Pression</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.pressure || 'hPa'}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginTop: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Carburant</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.fuel?.toUpperCase() === 'LTR' ? 'L' : units?.fuel?.toUpperCase() || 'GAL'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Masse</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.weight?.toUpperCase() || 'KG'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Piste</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.runway?.toUpperCase() || 'M'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Vent</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.windSpeed?.toUpperCase() || 'KT'}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Bras de levier</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              {units?.armLength?.toUpperCase() || 'MM'}
            </div>
          </div>
        </div>
      </div>


      {/* Section des notifications retirée */}
      {false && (
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

      {/* Section Licences et Qualifications intégrée */}
      <div style={{ marginBottom: '24px' }}>
        <AccordionButton
          isOpen={showCertifications}
          onClick={() => toggleSection('certifications')}
          icon={<Award size={20} />}
          title="Licences et Qualifications"
          color="#3b82f6"
        />
      </div>

      {showCertifications && (
        <div style={{ marginBottom: '24px' }}>
          <PilotCertifications />
        </div>
      )}

      {/* Section Suivi Médical intégrée */}
      <div style={{ marginBottom: '24px' }}>
        <AccordionButton
          isOpen={showMedical}
          onClick={() => toggleSection('medical')}
          icon={<Heart size={20} />}
          title="Suivi Médical"
          color="#10b981"
        />
      </div>

      {showMedical && (
        <div style={{ marginBottom: '24px' }}>
          <MedicalReminders />
        </div>
      )}

      {/* Section Configuration des unités */}
      <div style={{ marginBottom: '24px' }}>
        <AccordionButton
          isOpen={showUnitsConfig}
          onClick={() => toggleSection('units')}
          icon={<Settings size={20} />}
          title="Configuration des Unités"
          color="#8b5cf6"
        />
      </div>

      {showUnitsConfig && (
        <div style={{ marginBottom: '24px' }}>
          <UnitsConfiguration />
        </div>
      )}

      {/* Section Informations personnelles */}
      <div style={{ marginBottom: '24px' }}>
        <AccordionButton
          isOpen={showPersonalInfo}
          onClick={() => toggleSection('personalInfo')}
          icon={<User size={20} />}
          title="Informations personnelles"
          color="#f59e0b"
        />
      </div>

      {showPersonalInfo && (
      <div style={sx.combine(sx.components.card.base, { marginBottom: '24px' })}>
        
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
            <label style={labelStyle}>Nationalité</label>
            <select
              value={profile.nationality}
              onChange={(e) => handleChange('nationality', e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Sélectionner une nationalité --</option>
              {nationalities.map(nationality => (
                <option key={nationality} value={nationality}>
                  {nationality}
                </option>
              ))}
            </select>
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
          
          <div>
            <label style={labelStyle}>Club / École</label>
            <input
              type="text"
              value={profile.clubSchool || ''}
              onChange={(e) => handleChange('clubSchool', e.target.value)}
              placeholder="Nom du club ou de l'école"
              style={inputStyle}
            />
          </div>
        </div>


      </div>
      )}

      {/* Bouton Sauvegarder toujours visible en bas de page */}
      <div style={{
        marginTop: '32px',
        marginBottom: '24px',
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={handleSave}
          style={{
            padding: '12px 48px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#2563eb';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3b82f6';
            e.target.style.transform = 'scale(1)';
          }}
        >
          <Save size={20} />
          Sauvegarder toutes les modifications
        </button>
        <p style={{
          marginTop: '12px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Cliquez pour enregistrer toutes vos modifications (profil, licences, medical, etc.)
        </p>
      </div>
    </div>
  );
};

export default PilotProfile;