import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Calendar, Heart, Activity,
  Clock, TrendingUp, AlertCircle, Shield, Award, Plane,
  Moon, Sun, Cloud, Navigation, ChevronDown, ChevronUp, Eye, RefreshCw, Wand2, X, Database
} from 'lucide-react';
import { theme } from '../styles/theme';
import { getAIXMDataStatus, formatAIXMAlert } from '../utils/aixmDataValidator';

export const PilotDashboard = ({ onNavigate }) => {
  const [medicalStatus, setMedicalStatus] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState([]);
  const [currencyStatus, setCurrencyStatus] = useState([]);
  const [qualificationStatus, setQualificationStatus] = useState([]);
  const [pilotAge, setPilotAge] = useState(null);
  const [hasAgeError, setHasAgeError] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [flightStats, setFlightStats] = useState({
    totalHours: 0,
    picHours: 0,
    p2Hours: 0,
    dayHours: 0,
    nightHours: 0,
    ifrHours: 0,
    last30Days: 0,
    last90Days: 0,
    totalLandings: 0,
    recentFlights: []
  });
  const [wizardDraft, setWizardDraft] = useState(null);
  const [aixmDataStatus, setAixmDataStatus] = useState(null);
  const [aixmDetailsExpanded, setAixmDetailsExpanded] = useState(false);

  useEffect(() => {
    checkPilotAge();
    checkMedicalStatus();
    checkLicenseStatus();
    checkCurrencyStatus();
    checkQualificationStatus();
    calculateFlightStats();
    checkWizardDraft();
    loadAIXMStatus();
  }, []);

  // Charger le statut des données AIXM
  const loadAIXMStatus = async () => {
    const status = await getAIXMDataStatus();
    setAixmDataStatus(status);
  };

  // Vérifier s'il y a un brouillon d'assistant de création
  const checkWizardDraft = () => {
    const draft = localStorage.getItem('aircraft_wizard_draft');
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        setWizardDraft(draftData);
      } catch (e) {
        console.error('Erreur lors du chargement du brouillon:', e);
      }
    }
  };

  // Reprendre la configuration de l'assistant
  const handleResumeWizard = () => {
    // Naviguer vers le module avion
    if (onNavigate) {
      onNavigate('aircraft');
      // Après un court délai, déclencher l'ouverture de l'assistant
      setTimeout(() => {
        // Émettre un événement personnalisé pour ouvrir l'assistant
        window.dispatchEvent(new CustomEvent('resume-aircraft-wizard'));
      }, 100);
    }
  };

  // Annuler le brouillon
  const handleCancelDraft = () => {
    localStorage.removeItem('aircraft_wizard_draft');
    setWizardDraft(null);
  };

  // Vérifier l'âge du pilote
  const checkPilotAge = () => {
    const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const today = new Date();
    
    // Vérifier les deux noms possibles : dateOfBirth (nouveau) ou birthDate (ancien)
    const birthDateValue = pilotProfile.dateOfBirth || pilotProfile.birthDate;
    
    if (birthDateValue) {
      const birth = new Date(birthDateValue);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      setPilotAge(age);
      setHasAgeError(false);
    } else {
      setHasAgeError(true);
    }
  };

  // Vérifier le statut médical avec prise en compte de l'âge
  const checkMedicalStatus = () => {
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const today = new Date();
    
    // Calculer l'âge du pilote
    let pilotAge = null;
    const birthDateValue = pilotProfile.dateOfBirth || pilotProfile.birthDate;
    if (birthDateValue) {
      const birth = new Date(birthDateValue);
      pilotAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        pilotAge--;
      }
    }
    if (medicalRecords.length > 0) {
      const latestMedical = medicalRecords.sort((a, b) => 
        new Date(b.expiryDate) - new Date(a.expiryDate)
      )[0];
      
      const expiryDate = new Date(latestMedical.expiryDate);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // Obtenir le nom complet du type de certificat
      const medicalTypeName = {
        'class1': 'Classe 1',
        'class2': 'Classe 2', 
        'lapl': 'LAPL'
      }[latestMedical.type] || latestMedical.type;
      
      // Information sur la validité selon l'âge
      let validityInfo = '';
      if (pilotAge) {
        if (latestMedical.type === 'class1') {
          validityInfo = pilotAge < 40 ? '(12 mois)' : '(6 mois)';
        } else if (latestMedical.type === 'class2') {
          validityInfo = pilotAge < 40 ? '(5 ans)' : pilotAge < 50 ? '(2 ans)' : '(1 an)';
        } else if (latestMedical.type === 'lapl') {
          validityInfo = pilotAge < 40 ? '(5 ans)' : '(2 ans)';
        }
      }
      
      setMedicalStatus({
        type: medicalTypeName,
        validityInfo,
        expiryDate: latestMedical.expiryDate,
        daysUntilExpiry,
        pilotAge,
        status: daysUntilExpiry < 0 ? 'expired' : 
                daysUntilExpiry <= 30 ? 'warning' : 
                daysUntilExpiry <= 60 ? 'attention' : 'valid'
      });
    }
  };

  // Vérifier le statut des licences
  const checkLicenseStatus = () => {
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    const statuses = [];

    // Les licences sont à vie, on affiche juste leur existence
    if (certifications.licenses) {
      certifications.licenses.forEach(license => {
        statuses.push({
          name: license.name || license.type,
          issueDate: license.issueDate,
          status: 'valid', // Les licences sont toujours valides
          permanent: true
        });
      });
    }
    
    setLicenseStatus(statuses);
  };

  // Vérifier l'expérience récente basée sur les qualifications actives
  const checkCurrencyStatus = () => {
    const flightLog = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    const today = new Date();
    const twelveMonthsAgo = new Date(today.getTime() - (12 * 30 * 24 * 60 * 60 * 1000)); // ~12 mois
    const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const currencyStatuses = [];
    
    // Vérifier si le pilote a une qualification SEP active (non expirée)
    const sepRating = certifications.ratings?.find(rating => {
      const ratingName = (rating.name || rating.type || '').toUpperCase();
      return ratingName.includes('SEP') || 
             ratingName.includes('SINGLE ENGINE PISTON') ||
             ratingName.includes('SINGLE-ENGINE PISTON');
    });
    
    // Vérifier si la qualification SEP est expirée
    let isSEPExpired = false;
    if (sepRating && sepRating.expiryDate) {
      const expiryDate = new Date(sepRating.expiryDate);
      isSEPExpired = expiryDate < today;
    }
    
    const hasSEP = sepRating && !isSEPExpired;
    
    // Vérifier si le pilote a une licence PPL ou CPL
    const hasPilotLicense = certifications.licenses?.some(license => {
      const licenseName = (license.name || license.type || '').toUpperCase();
      return licenseName.includes('PPL') || 
             licenseName.includes('CPL') || 
             licenseName.includes('ATPL') ||
             licenseName.includes('PRIVATE') ||
             licenseName.includes('COMMERCIAL') ||
             licenseName.includes('AIRLINE');
    });
    
    // Si le pilote a une qualification SEP (expirée ou non), afficher le statut approprié
    if (sepRating) {
      if (isSEPExpired) {
        // Qualification SEP expirée - afficher la procédure de renouvellement
        currencyStatuses.push({
          type: 'sep_expired',
          label: 'SEP (Single Engine Piston) - EXPIRÉE',
          regulation: 'FCL.740.A',
          period: 'Expirée le ' + new Date(sepRating.expiryDate).toLocaleDateString('fr-FR'),
          status: 'expired',
          renewalProcedure: {
            title: 'Procédure de renouvellement :',
            steps: [
              '1. Vol de contrôle avec un examinateur de classe (FE)',
              '2. Test de compétence (Skill Test) complet',
              '3. Vérification des connaissances théoriques si nécessaire',
              '4. Certificat médical valide requis'
            ],
            note: 'La prorogation par expérience n\'est plus possible après expiration'
          }
        });
      } else {
        // Qualification SEP active - vérifier les conditions de prorogation
        const sep12Months = flightLog.filter(flight => {
          const flightDate = new Date(flight.date);
          return flightDate >= twelveMonthsAgo && flightDate <= today;
        });
        
        const sepTotalHours = sep12Months.reduce((sum, flight) => 
          sum + (parseFloat(flight.totalTime) || 0), 0
        );
        
        const sepPicHours = sep12Months.reduce((sum, flight) => {
          if (flight.functionOnBoard === 'pic' || flight.pic) {
            return sum + (parseFloat(flight.totalTime) || 0);
          }
          return sum;
        }, 0);
        
        const sepTakeoffs = sep12Months.reduce((sum, flight) => 
          sum + (parseInt(flight.dayLandings) || 0) + (parseInt(flight.nightLandings) || 0), 0
        );
        
        const sepLandings = sepTakeoffs;
        
        const hasInstructorFlight = sep12Months.some(flight => {
          // Vérifier dans les remarques
          const remarksHasInstructor = flight.remarks && (
            flight.remarks.toUpperCase().includes('FI') ||
            flight.remarks.toUpperCase().includes('CRI') ||
            flight.remarks.toLowerCase().includes('instructeur')
          );

          // Vérifier dans le champ functionOnBoard principal
          const mainFunctionIsFiCri = flight.functionOnBoard === 'fi-cri';

          // Vérifier dans les segments
          const segmentsHaveInstructor = flight.flightSegments && flight.flightSegments.some(segment => {
            const isFiCri = segment.functionOnBoard === 'fi-cri';
            const hasMinTime = parseFloat(segment.time) >= 1;
            return isFiCri && hasMinTime;
          });

          // Convertir totalTime en heures décimales (gère HH:MM et décimal)
          let totalTimeHours = 0;
          if (flight.totalTime) {
            if (typeof flight.totalTime === 'string' && flight.totalTime.includes(':')) {
              const [h, m] = flight.totalTime.split(':').map(Number);
              totalTimeHours = h + (m / 60);
            } else {
              totalTimeHours = parseFloat(flight.totalTime) || 0;
            }
          }
          const totalTimeValid = totalTimeHours >= 1;

          return totalTimeValid && (remarksHasInstructor || mainFunctionIsFiCri || segmentsHaveInstructor);
        });
        
        const canRenew = sepTotalHours >= 12 && sepPicHours >= 6 && sepTakeoffs >= 12 && sepLandings >= 12 && hasInstructorFlight;
        
        currencyStatuses.push({
          type: 'sep',
          label: 'SEP (Single Engine Piston)',
          regulation: 'FCL.740.A',
          period: '12 mois',
          expiryDate: sepRating.expiryDate,
          totalHours: sepTotalHours,
          requiredTotalHours: 12,
          picHours: sepPicHours,
          requiredPicHours: 6,
          takeoffs: sepTakeoffs,
          landings: sepLandings,
          requiredTakeoffs: 12,
          requiredLandings: 12,
          hasInstructorFlight: hasInstructorFlight,
          canRenew: canRenew,
          status: canRenew ? 'valid' : 
                  (sepTotalHours >= 6 || sepPicHours >= 3) ? 'attention' : 'warning'
        });
      }
    }
    
    // Si le pilote a une licence de pilote, vérifier les conditions pour transport de passagers
    if (hasPilotLicense) {
      // Compter les vols des 90 derniers jours pour passagers
      const recent90Days = flightLog.filter(flight => {
        const flightDate = new Date(flight.date);
        return flightDate >= ninetyDaysAgo && flightDate <= today;
      });
      
      const passengerTakeoffs = recent90Days.reduce((sum, flight) => 
        sum + (parseInt(flight.dayLandings) || 0) + (parseInt(flight.nightLandings) || 0), 0
      );
      
      const passengerLandings = passengerTakeoffs;
      
      currencyStatuses.push({
        type: 'passengers',
        label: 'Transport de passagers',
        regulation: 'FCL.060(b)(1)',
        period: '90 jours',
        takeoffs: passengerTakeoffs,
        landings: passengerLandings,
        requiredTakeoffs: 3,
        requiredLandings: 3,
        status: passengerTakeoffs >= 3 && passengerLandings >= 3 ? 'valid' : 'warning'
      });
    }
    
    // Vérifier si le pilote a une qualification MEP (Multi Engine Piston)
    const mepRating = certifications.ratings?.find(rating => {
      const ratingName = (rating.name || rating.type || '').toUpperCase();
      return ratingName.includes('MEP') || 
             ratingName.includes('MULTI ENGINE PISTON') ||
             ratingName.includes('MULTI-ENGINE PISTON');
    });
    
    // Vérifier si la qualification MEP est expirée
    let isMEPExpired = false;
    if (mepRating && mepRating.expiryDate) {
      const expiryDate = new Date(mepRating.expiryDate);
      isMEPExpired = expiryDate < today;
    }
    if (mepRating) {
      if (isMEPExpired) {
        // Qualification MEP expirée
        currencyStatuses.push({
          type: 'mep_expired',
          label: 'MEP (Multi Engine Piston) - EXPIRÉE',
          regulation: 'FCL.740.A',
          period: 'Expirée le ' + new Date(mepRating.expiryDate).toLocaleDateString('fr-FR'),
          status: 'expired',
          renewalProcedure: {
            title: 'Procédure de renouvellement :',
            steps: [
              '1. Vol de contrôle avec un examinateur de classe (FE)',
              '2. Test de compétence (Skill Test) complet',
              '3. Vérification des connaissances théoriques si nécessaire',
              '4. Certificat médical valide requis'
            ],
            note: 'La prorogation par expérience n\'est plus possible après expiration'
          }
        });
      } else {
        // Qualification MEP active
        const mep12Months = flightLog.filter(flight => {
          const flightDate = new Date(flight.date);
          return flightDate >= twelveMonthsAgo && flightDate <= today && 
                 (flight.aircraftType?.includes('MEP') || flight.aircraftType?.includes('multi'));
        });
        
        const mepTakeoffs = mep12Months.reduce((sum, flight) => 
          sum + (parseInt(flight.dayLandings) || 0) + (parseInt(flight.nightLandings) || 0), 0
        );
        
        currencyStatuses.push({
          type: 'mep',
          label: 'MEP (Multi Engine Piston)',
          regulation: 'FCL.740.A',
          period: '12 mois',
          expiryDate: mepRating.expiryDate,
          takeoffs: mepTakeoffs,
          landings: mepTakeoffs,
          requiredTakeoffs: 6,
          requiredLandings: 6,
          status: mepTakeoffs >= 6 ? 'valid' : mepTakeoffs >= 3 ? 'attention' : 'warning'
        });
      }
    }
    
    // Si aucune qualification n'est trouvée, afficher un message par défaut
    if (currencyStatuses.length === 0) {
      currencyStatuses.push({
        type: 'none',
        label: 'Aucune qualification active',
        regulation: '',
        period: '',
        status: 'warning',
        message: 'Ajoutez vos licences et qualifications dans l\'espace pilote'
      });
    }
    
    setCurrencyStatus(currencyStatuses);
  };

  // Calculer les statistiques de vol
  const calculateFlightStats = () => {
    const entries = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let stats = {
      totalHours: 0,
      picHours: 0,
      p2Hours: 0,
      dayHours: 0,
      nightHours: 0,
      ifrHours: 0,
      instructorHours: 0,
      last30Days: 0,
      last90Days: 0,
      totalLandings: 0,
      dayLandings30Days: 0,
      nightLandings90Days: 0,
      recentFlights: []
    };

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);

      // Convertir le temps total en heures décimales
      let hours = 0;
      if (entry.totalTime) {
        if (entry.totalTime.includes(':')) {
          const [h, m] = entry.totalTime.split(':').map(Number);
          hours = h + (m / 60);
        } else {
          hours = parseFloat(entry.totalTime) || 0;
        }
      }

      // Totaux généraux
      stats.totalHours += hours;

      // Si l'entrée a des segments de vol, les utiliser pour calculer P1/P2 et jour/nuit
      if (entry.flightSegments && Array.isArray(entry.flightSegments) && entry.flightSegments.length > 0) {
        entry.flightSegments.forEach(segment => {
          const segmentTime = parseFloat(segment.time) || 0;

          // Calcul des heures P1/P2 depuis les segments
          if (segment.functionOnBoard === 'pic') stats.picHours += segmentTime;
          if (segment.functionOnBoard === 'copilot') stats.p2Hours += segmentTime;

          // Calcul des heures jour/nuit depuis les segments
          if (segment.flightType === 'vfr-night' || segment.flightType === 'ifr-night') {
            stats.nightHours += segmentTime;
          } else if (segment.flightType === 'vfr-day' || segment.flightType === 'ifr-day') {
            stats.dayHours += segmentTime;
          }

          // Calcul des heures IFR depuis les segments
          if (segment.flightType === 'ifr-day' || segment.flightType === 'ifr-night') {
            stats.ifrHours += segmentTime;
          }
        });
      } else {
        // Compatibilité avec l'ancien format (sans segments)
        if (entry.functionOnBoard === 'pic' || entry.pic) {
          stats.picHours += hours;
        } else if (entry.functionOnBoard === 'copilot' || entry.functionOnBoard === 'p2' || entry.copilot) {
          stats.p2Hours += hours;
        }

        const nightTime = parseFloat(entry.nightTime) || 0;
        stats.nightHours += nightTime;
        stats.dayHours += Math.max(0, hours - nightTime);
        stats.ifrHours += parseFloat(entry.ifrTime) || 0;
      }

      stats.totalLandings += (parseInt(entry.dayLandings) || 0) + (parseInt(entry.nightLandings) || 0);

      // Heures récentes
      if (entryDate >= thirtyDaysAgo) {
        stats.last30Days += hours;
        stats.dayLandings30Days += parseInt(entry.dayLandings) || 0;
      }
      if (entryDate >= ninetyDaysAgo) {
        stats.last90Days += hours;
        stats.nightLandings90Days += parseInt(entry.nightLandings) || 0;
      }
    });

    // 5 derniers vols
    stats.recentFlights = entries
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    setFlightStats(stats);
  };

  // Vérifier les qualifications
  const checkQualificationStatus = () => {
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    const today = new Date();
    const statuses = [];

    if (certifications.ratings) {
      certifications.ratings.forEach(rating => {
        if (rating.expiryDate) {
          const expiryDate = new Date(rating.expiryDate);
          const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
          
          statuses.push({
            name: rating.name || rating.type,
            expiryDate: rating.expiryDate,
            daysUntilExpiry,
            status: daysUntilExpiry < 0 ? 'expired' : 
                    daysUntilExpiry <= 30 ? 'warning' : 
                    daysUntilExpiry <= 90 ? 'attention' : 'valid'
          });
        }
      });
    }
    
    setQualificationStatus(statuses);
  };

  // Vérifier si tous les documents sont valides ET hors période de rappel
  const areAllDocumentsValid = () => {
    // Pour le médical, on considère qu'il faut afficher la section si on est à moins de 60 jours de l'expiration
    const medicalOk = medicalStatus?.status === 'valid' && medicalStatus?.daysUntilExpiry > 60;

    // Les licences sont toujours valides (permanentes)
    const licensesOk = licenseStatus.every(l => l.status === 'valid');

    // Pour les qualifications, on vérifie qu'elles sont toutes valides
    // et qu'aucune n'est en période d'attention ou warning
    const qualificationsOk = qualificationStatus.every(q =>
      q.status === 'valid' || (q.status === 'attention' && q.daysRemaining > 30)
    );

    // On masque la section seulement si tout est OK et hors période de rappel
    return medicalOk && licensesOk && qualificationsOk;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'valid': return '#10b981';
      case 'attention': return '#f59e0b';
      case 'warning': return '#ef4444';
      case 'expired': return '#991b1b';
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'valid': return <CheckCircle size={16} />;
      case 'attention': return <AlertCircle size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'expired': return <AlertTriangle size={16} />;
      default: return null;
    }
  };

  return (
    <section style={styles.container}>
      <h2 style={styles.title}>
        <Shield size={24} style={{ marginRight: '8px' }} />
        Tableau de bord pilote
      </h2>
      
      {/* Alerte si l'âge n'est pas configuré */}
      {hasAgeError && (
        <div style={{ ...styles.ageErrorAlert, maxWidth: '400px', width: '100%', margin: '0 auto 20px auto' }}>
          <div style={styles.ageErrorContent}>
            <AlertTriangle size={20} />
            <div style={{ flex: 1 }}>
              <p style={styles.ageErrorTitle}>Configuration requise</p>
              <p style={styles.ageErrorMessage}>
                Votre date de naissance n'est pas configurée. Elle est nécessaire pour calculer automatiquement
                la validité de votre certificat médical et les examens requis selon votre âge.
              </p>
            </div>
          </div>
          <button
            style={{ ...styles.configureButton, width: '100%', marginTop: '12px' }}
            onClick={() => onNavigate && onNavigate('pilot')}
          >
            Configurer mon profil
          </button>
        </div>
      )}

      {/* Alerte pour les unités */}
      {!localStorage.getItem('unitsConfigured') && (
        <div style={{
          ...styles.ageErrorAlert,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          maxWidth: '400px',
          width: '100%',
          margin: '0 auto 20px auto'
        }}>
          <div style={{
            ...styles.ageErrorContent,
            color: '#f59e0b'
          }}>
            <AlertCircle size={20} />
            <div style={{ flex: 1 }}>
              <p style={styles.ageErrorTitle}>Configuration des unités</p>
              <p style={styles.ageErrorMessage}>
                ⚠️ Pensez à configurer vos unités de mesure dans le module Info Pilote &gt; Configuration des unités
              </p>
            </div>
          </div>
          <button
            style={{
              ...styles.configureButton,
              backgroundColor: '#f59e0b',
              width: '100%',
              marginTop: '12px'
            }}
            onClick={() => onNavigate && onNavigate('pilot')}
          >
            Configurer les unités
          </button>
        </div>
      )}

      {/* Alerte statut base de données AIXM - Réductible */}
      {aixmDataStatus && (
        <div style={{
          ...styles.ageErrorAlert,
          backgroundColor: formatAIXMAlert(aixmDataStatus.status).bgColor,
          borderColor: formatAIXMAlert(aixmDataStatus.status).color,
          border: `2px solid ${formatAIXMAlert(aixmDataStatus.status).color}`,
          maxWidth: '400px',
          width: '100%',
          margin: '0 auto 20px auto'
        }}>
          <div style={{
            ...styles.ageErrorContent,
            color: formatAIXMAlert(aixmDataStatus.status).color,
            alignItems: 'flex-start'
          }}>
            <div style={{ fontSize: '20px', marginTop: '2px' }}>
              {formatAIXMAlert(aixmDataStatus.status).icon}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...styles.ageErrorTitle, margin: 0, marginBottom: '4px' }}>
                <Database size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {formatAIXMAlert(aixmDataStatus.status).title}
              </p>
              <p style={styles.ageErrorMessage}>
                {aixmDataStatus.message}
              </p>
            </div>
          </div>
          {aixmDetailsExpanded && (
            <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.6', marginTop: '12px', paddingLeft: '32px' }}>
              <div><strong>Fichier :</strong> {aixmDataStatus.filename}</div>
              <div><strong>Date effective :</strong> {aixmDataStatus.effectiveDate}</div>
              <div><strong>Date expiration :</strong> {aixmDataStatus.expiryDate}</div>
              {aixmDataStatus.nextAIRACDate && (
                <div><strong>Prochain cycle AIRAC :</strong> {aixmDataStatus.nextAIRACDate}</div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => setAixmDetailsExpanded(!aixmDetailsExpanded)}
              style={{
                ...styles.configureButton,
                backgroundColor: formatAIXMAlert(aixmDataStatus.status).color,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              {aixmDetailsExpanded ? (
                <>
                  Masquer <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Détails <ChevronDown size={16} />
                </>
              )}
            </button>
            {(aixmDataStatus.status === 'expired' || aixmDataStatus.status === 'warning' || aixmDataStatus.status === 'expiring-today') && (
              <a
                href={aixmDataStatus.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.configureButton,
                  backgroundColor: formatAIXMAlert(aixmDataStatus.status).color,
                  textDecoration: 'none',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                📥 Télécharger
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alerte pour reprendre la configuration d'avion */}
      {wizardDraft && (
        <div style={{
          ...styles.ageErrorAlert,
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          maxWidth: '400px',
          width: '100%',
          margin: '0 auto 20px auto'
        }}>
          <div style={{
            ...styles.ageErrorContent,
            color: '#8b5cf6'
          }}>
            <Wand2 size={20} />
            <div style={{ flex: 1 }}>
              <p style={styles.ageErrorTitle}>Configuration d'avion en cours</p>
              <p style={styles.ageErrorMessage}>
                Vous avez une configuration d'avion non terminée{wizardDraft.aircraftData?.registration ? ` (${wizardDraft.aircraftData.registration})` : ''}.
                Reprenez là où vous vous êtes arrêté à l'étape {wizardDraft.currentStep + 1}.
              </p>
              <p style={{ ...styles.ageErrorMessage, fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                Sauvegardé le {new Date(wizardDraft.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '4px',
                  color: '#8b5cf6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={handleCancelDraft}
                title="Supprimer le brouillon"
              >
                <X size={16} />
              </button>
              <button
                style={{
                  ...styles.configureButton,
                  backgroundColor: '#8b5cf6'
                }}
                onClick={handleResumeWizard}
              >
                Reprendre la configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...styles.grid, maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        {/* Statistiques de vol */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Plane size={20} />
            <span>Expérience totale</span>
          </div>
          <div style={styles.cardContent}>
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <Clock size={16} style={{ color: '#3b82f6' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.totalHours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures totales (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Award size={16} style={{ color: '#10b981' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.picHours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures P1/CDB (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Navigation size={16} style={{ color: '#06b6d4' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.p2Hours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures P2/OPL (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Plane size={16} style={{ color: '#ec4899' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.totalLandings}</div>
                  <div style={styles.statLabel}>Atterrissages totaux (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Moon size={16} style={{ color: '#8b5cf6' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.nightHours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures de nuit (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Cloud size={16} style={{ color: '#f59e0b' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.ifrHours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures IFR (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <Sun size={16} style={{ color: '#fbbf24' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.dayHours.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures voyage (auto)</div>
                </div>
              </div>
              <div style={styles.statItem}>
                <TrendingUp size={16} style={{ color: '#06b6d4' }} />
                <div>
                  <div style={styles.statValue}>{flightStats.last30Days.toFixed(1)}h</div>
                  <div style={styles.statLabel}>Heures instruction (auto)</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => {
                  // Définir une action pour ouvrir directement l'onglet d'ajout
                  window.logbookAction = 'add';
                  onNavigate && onNavigate('logbook');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                <Plane size={16} />
                Ajouter un vol
              </button>
            </div>
          </div>
        </div>

        {/* Expérience récente - Afficher seulement si des qualifications ne sont pas valides */}
        {currencyStatus.filter(item => item.status !== 'valid').length > 0 && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Activity size={20} />
              <span>Validité des qualifications</span>
            </div>
            <div style={styles.cardContent}>
              {currencyStatus.filter(item => item.status !== 'valid').map((item, index) => (
              <div key={index} style={styles.currencySection}>
                {item.type === 'none' ? (
                  <div style={styles.noQualificationMessage}>
                    <AlertCircle size={20} style={{ color: theme.colors.textSecondary }} />
                    <div>
                      <p style={styles.noQualificationTitle}>{item.label}</p>
                      <p style={styles.noQualificationText}>{item.message}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={styles.currencyHeader}>
                      <span style={styles.currencyTitle}>{item.label}</span>
                      <span style={{
                        ...styles.currencyBadge,
                        backgroundColor: `${getStatusColor(item.status)}20`,
                        color: getStatusColor(item.status),
                        borderColor: getStatusColor(item.status)
                      }}>
                        {getStatusIcon(item.status)}
                        <span style={{ marginLeft: '4px' }}>
                          {item.status === 'valid' ? 'Valide' : 
                           item.status === 'attention' ? 'Attention' : 
                           item.status === 'expired' ? 'Expirée' : 'Non valide'}
                        </span>
                      </span>
                    </div>
                    <div style={styles.currencyDetails}>
                      <div style={styles.regulationInfo}>
                        <span style={styles.regulationText}>
                          Période: {item.period}
                        </span>
                      </div>
                      {(item.type === 'sep_expired' || item.type === 'mep_expired') ? (
                        <div style={styles.renewalProcedure}>
                          <div style={styles.procedureTitle}>
                            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>
                              {item.renewalProcedure.title}
                            </span>
                          </div>
                          <div style={styles.procedureSteps}>
                            {item.renewalProcedure.steps.map((step, idx) => (
                              <div key={idx} style={styles.procedureStep}>
                                {step}
                              </div>
                            ))}
                          </div>
                          <div style={styles.procedureNote}>
                            <strong>Note:</strong> {item.renewalProcedure.note}
                          </div>
                        </div>
                      ) : (
                        <div style={styles.currencyStats}>
                          {item.type === 'sep' && (
                            <>
                              <div style={styles.statRow}>
                                <span style={styles.sepStatLabel}>Heures totales SEP:</span>
                                <span style={{
                                  ...styles.sepStatValue,
                                  color: item.totalHours >= item.requiredTotalHours ? '#10b981' : '#ef4444'
                                }}>
                                  {item.totalHours.toFixed(1)}h/{item.requiredTotalHours}h
                                </span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={styles.sepStatLabel}>Heures P1/CDB:</span>
                                <span style={{
                                  ...styles.sepStatValue,
                                  color: item.picHours >= item.requiredPicHours ? '#10b981' : '#ef4444'
                                }}>
                                  {item.picHours.toFixed(1)}h/{item.requiredPicHours}h
                                </span>
                              </div>
                            </>
                          )}
                          {item.takeoffs !== undefined && (
                            <div style={styles.statRow}>
                              <span style={styles.sepStatLabel}>Décollages:</span>
                              <span style={{
                                ...styles.sepStatValue,
                                color: item.takeoffs >= item.requiredTakeoffs ? '#10b981' : '#ef4444'
                              }}>
                                {item.takeoffs}/{item.requiredTakeoffs}
                              </span>
                            </div>
                          )}
                          {item.landings !== undefined && (
                            <div style={styles.statRow}>
                              <span style={styles.sepStatLabel}>Atterrissages:</span>
                              <span style={{
                                ...styles.sepStatValue,
                                color: item.landings >= item.requiredLandings ? '#10b981' : '#ef4444'
                              }}>
                                {item.landings}/{item.requiredLandings}
                              </span>
                            </div>
                          )}
                          {item.type === 'sep' && (
                            <div style={styles.statRow}>
                              <span style={styles.sepStatLabel}>Vol avec FI/CRI (1h):</span>
                              <span style={{
                                ...styles.sepStatValue,
                                color: item.hasInstructorFlight ? '#10b981' : '#ef4444'
                              }}>
                                {item.hasInstructorFlight ? '✓ Effectué' : '✗ Requis'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {item.type === 'sep' && !item.renewalProcedure && (
                        <div style={styles.renewalAdvice}>
                          {item.canRenew ? (
                            <div style={styles.adviceSuccess}>
                              <CheckCircle size={16} />
                              <span>Toutes les conditions sont remplies pour la prorogation par instructeur</span>
                            </div>
                          ) : (
                            <div style={styles.adviceWarning}>
                              <AlertTriangle size={16} />
                              <span>
                                Conditions non remplies : vol de contrôle avec examinateur (PC/LPC) requis avant expiration
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Documents regroupés (Certificat médical, Licences, Qualifications) - Masquer si tout est valide */}
        {!areAllDocumentsValid() && (
          <div style={styles.card}>
          <div 
            style={styles.expandableHeader}
            onClick={() => setDocumentsExpanded(!documentsExpanded)}
          >
            <div style={styles.expandableTitle}>
              <Shield size={20} />
              <span>Documents & Qualifications</span>
            </div>
            <div style={styles.expandableRight}>
              {!documentsExpanded && (
                <div style={styles.documentsSummary}>
                  {/* Compte total des éléments valides */}
                  <span style={styles.summaryTotal}>
                    {[
                      medicalStatus?.status === 'valid' ? 1 : 0,
                      licenseStatus.filter(l => l.status === 'valid').length,
                      qualificationStatus.filter(q => q.status === 'valid').length
                    ].reduce((a, b) => a + b, 0)}/
                    {[
                      medicalStatus ? 1 : 0,
                      licenseStatus.length,
                      qualificationStatus.length
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              )}
              {documentsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
          
          {documentsExpanded && (
            <div style={styles.expandableContent}>
              {/* Section Certificat médical */}
              <div style={styles.documentSection}>
                <h4 style={styles.documentSectionTitle}>
                  <Heart size={16} />
                  Certificat médical
                </h4>
                {medicalStatus ? (
                  <div style={styles.documentDetails}>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: `${getStatusColor(medicalStatus.status)}20`,
                      borderColor: getStatusColor(medicalStatus.status)
                    }}>
                      {getStatusIcon(medicalStatus.status)}
                      <span style={{ color: getStatusColor(medicalStatus.status) }}>
                        {medicalStatus.daysUntilExpiry < 0 
                          ? `Expiré depuis ${Math.abs(medicalStatus.daysUntilExpiry)}j`
                          : `Expire dans ${medicalStatus.daysUntilExpiry}j`
                        }
                      </span>
                    </div>
                    <div style={styles.detail}>
                      Type: {medicalStatus.type} {medicalStatus.validityInfo}
                    </div>
                    <div style={styles.detail}>
                      Validité: {new Date(medicalStatus.expiryDate).toLocaleDateString('fr-FR')}
                    </div>
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'medical')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: medicalStatus.status === 'expired' ? '#ef4444' : '#3b82f6',
                        marginTop: '8px'
                      }}
                    >
                      {medicalStatus.status === 'expired' ? (
                        <><RefreshCw size={14} /> Mettre à jour</>
                      ) : (
                        <><Eye size={14} /> Consulter</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={styles.noData}>
                    Aucun certificat médical enregistré
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'medical')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: '#ef4444',
                        marginTop: '8px'
                      }}
                    >
                      <RefreshCw size={14} /> Ajouter
                    </button>
                  </div>
                )}
              </div>

              {/* Section Licences */}
              <div style={styles.documentSection}>
                <h4 style={styles.documentSectionTitle}>
                  <Award size={16} />
                  Licences
                </h4>
                {licenseStatus.length > 0 ? (
                  <div style={styles.documentList}>
                    {licenseStatus.map((license, index) => (
                      <div key={index} style={styles.item}>
                        <span style={styles.itemLabel}>{license.name}</span>
                        <span style={{
                          ...styles.itemStatus,
                          color: '#10b981'
                        }}>
                          <CheckCircle size={16} />
                          <span style={{ marginLeft: '4px' }}>
                            {license.permanent ? 'À vie' : 'Valide'}
                          </span>
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'certifications')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: '#3b82f6',
                        marginTop: '8px'
                      }}
                    >
                      <Eye size={14} /> Consulter
                    </button>
                  </div>
                ) : (
                  <div style={styles.noData}>
                    Aucune licence enregistrée
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'certifications')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: '#ef4444',
                        marginTop: '8px'
                      }}
                    >
                      <RefreshCw size={14} /> Ajouter
                    </button>
                  </div>
                )}
              </div>

              {/* Section Qualifications */}
              <div style={styles.documentSection}>
                <h4 style={styles.documentSectionTitle}>
                  <TrendingUp size={16} />
                  Qualifications
                </h4>
                {qualificationStatus.length > 0 ? (
                  <div style={styles.documentList}>
                    {qualificationStatus.map((qual, index) => (
                      <div key={index} style={styles.item}>
                        <span style={styles.itemLabel}>{qual.name}</span>
                        <span style={{
                          ...styles.itemStatus,
                          color: getStatusColor(qual.status)
                        }}>
                          {getStatusIcon(qual.status)}
                          {qual.daysUntilExpiry < 0 
                            ? ` Expirée`
                            : ` ${qual.daysUntilExpiry}j`
                          }
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'certifications')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: qualificationStatus.some(q => q.status === 'expired') ? '#ef4444' : '#3b82f6',
                        marginTop: '8px'
                      }}
                    >
                      {qualificationStatus.some(q => q.status === 'expired') ? (
                        <><RefreshCw size={14} /> Mettre à jour</>
                      ) : (
                        <><Eye size={14} /> Consulter</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={styles.noData}>
                    Aucune qualification enregistrée
                    <button
                      onClick={() => onNavigate && onNavigate('pilot', 'certifications')}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: '#ef4444',
                        marginTop: '8px'
                      }}
                    >
                      <RefreshCw size={14} /> Ajouter
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )}

      </div>
    </section>
  );
};

const styles = {
  container: {
    padding: '32px 16px',
    background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}10)`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '20px',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
  },
  ageErrorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },
  ageErrorContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#ef4444',
  },
  ageErrorTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  ageErrorMessage: {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    lineHeight: '1.4',
  },
  configureButton: {
    backgroundColor: theme.colors.primary,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  card: {
    backgroundColor: 'rgba(30, 28, 28, 0.6)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    color: theme.colors.primary,
    fontSize: '14px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: '600',
  },
  detail: {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    marginTop: '4px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.colors.border}20`,
  },
  itemLabel: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
  },
  itemStatus: {
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  noData: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    padding: '8px 0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  currencySection: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: `1px solid ${theme.colors.border}20`,
  },
  currencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  currencyTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  currencyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '12px',
    border: '1px solid',
    fontSize: '11px',
    fontWeight: '600',
  },
  currencyDetails: {
    marginLeft: '4px',
  },
  regulationInfo: {
    marginBottom: '8px',
  },
  regulationText: {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  currencyStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
  },
  sepStatLabel: {
    color: theme.colors.textSecondary,
  },
  sepStatValue: {
    fontWeight: '700',
  },
  renewalAdvice: {
    marginTop: '12px',
    padding: '8px',
    borderRadius: '6px',
  },
  adviceSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    fontSize: '12px',
    color: '#065f46',
  },
  adviceWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    fontSize: '12px',
    color: '#92400e',
  },
  expandableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.colors.border}20`,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(147, 22, 60, 0.05)',
    },
  },
  expandableTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  expandableRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: theme.colors.textSecondary,
  },
  documentsSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  summaryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    border: '1px solid',
    fontSize: '11px',
    fontWeight: '600',
  },
  summaryCount: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(147, 22, 60, 0.1)',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  summaryTotal: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    backgroundColor: 'rgba(147, 22, 60, 0.1)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: theme.colors.primary,
  },
  expandableContent: {
    padding: '16px',
  },
  documentSection: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: `1px solid ${theme.colors.border}20`,
  },
  documentSectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '12px',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  documentDetails: {
    marginLeft: '22px',
  },
  documentList: {
    marginLeft: '22px',
  },
  renewalProcedure: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '12px',
  },
  procedureTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: '600',
  },
  procedureSteps: {
    marginLeft: '24px',
    marginBottom: '12px',
  },
  procedureStep: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
    marginBottom: '6px',
    lineHeight: '1.5',
  },
  procedureNote: {
    fontSize: '12px',
    color: '#92400e',
    backgroundColor: 'rgba(254, 243, 199, 0.5)',
    padding: '8px',
    borderRadius: '4px',
    borderLeft: '3px solid #f59e0b',
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, opacity 0.2s',
    '&:hover': {
      opacity: 0.9,
      transform: 'translateY(-1px)',
    },
  },
  noQualificationMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  noQualificationTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: '4px',
  },
  noQualificationText: {
    fontSize: '12px',
    color: theme.colors.textSecondary,
  },
};

export default PilotDashboard;