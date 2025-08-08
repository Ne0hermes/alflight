// src/features/pilot/components/FlightCurrencyTracker.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock, Calendar, TrendingUp, Info, AlertCircle, Activity } from 'lucide-react';

const FlightCurrencyTracker = ({ pilotData = {}, flightLog = [] }) => {
  const [currentDate] = useState(new Date());
  const [licenses, setLicenses] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  
  // Charger les licences et qualifications depuis localStorage
  useEffect(() => {
    const loadLicensesAndQualifications = () => {
      // Charger depuis pilotCertifications (nouvelle structure)
      const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
      
      // Convertir les licences
      const licensesData = [];
      if (certifications.licenses) {
        certifications.licenses.forEach(lic => {
          licensesData.push({
            id: lic.id,
            type: lic.type ? lic.type.split(' - ')[0] : lic.name, // Extraire PPL, CPL, etc.
            name: lic.name || lic.type,
            number: lic.number,
            issuedBy: lic.issuedBy,
            issueDate: lic.issueDate,
            expiryDate: lic.expiryDate,
            active: true, // Considérer toutes les licences comme actives
            country: lic.issuedBy || 'France'
          });
        });
      }
      
      // Convertir les qualifications (ratings)
      const qualificationsData = [];
      if (certifications.ratings) {
        certifications.ratings.forEach(rating => {
          // Déterminer le type de qualification
          let qualType = 'other';
          const ratingName = (rating.type || rating.name || '').toLowerCase();
          
          if (ratingName.includes('night')) qualType = 'night';
          else if (ratingName.includes('ir') || ratingName.includes('instrument')) qualType = 'ifr';
          else if (ratingName.includes('mountain')) qualType = 'mountain';
          else if (ratingName.includes('aerobatic')) qualType = 'aerobatic';
          else if (ratingName.includes('towing')) qualType = 'towing';
          else if (ratingName.includes('sep')) qualType = 'sep';
          else if (ratingName.includes('mep')) qualType = 'mep';
          
          qualificationsData.push({
            id: rating.id,
            type: qualType,
            name: rating.name || rating.type,
            number: rating.number,
            issueDate: rating.issueDate,
            expiryDate: rating.expiryDate,
            active: true
          });
        });
      }
      
      // Fallback vers l'ancienne structure si elle existe
      if (licensesData.length === 0) {
        const oldLicenses = JSON.parse(localStorage.getItem('pilotLicenses') || '[]');
        if (oldLicenses.length > 0) {
          licensesData.push(...oldLicenses);
        }
      }
      
      if (qualificationsData.length === 0) {
        const oldQualifications = JSON.parse(localStorage.getItem('pilotQualifications') || '[]');
        if (oldQualifications.length > 0) {
          qualificationsData.push(...oldQualifications);
        }
      }
      
      setLicenses(licensesData);
      setQualifications(qualificationsData);
    };
    
    loadLicensesAndQualifications();
    
    // Écouter les changements
    const handleStorageChange = () => {
      loadLicensesAndQualifications();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('licenses-updated', handleStorageChange);
    window.addEventListener('qualifications-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('licenses-updated', handleStorageChange);
      window.removeEventListener('qualifications-updated', handleStorageChange);
    };
  }, []);
  
  // Calculer automatiquement les dates limites basées sur les dates de validité
  const getExpiryBasedRequirements = (license, qualification) => {
    const today = new Date();
    const requirements = [];
    
    // Pour chaque licence/qualification avec date d'expiration
    if (license && license.expiryDate) {
      const expiryDate = new Date(license.expiryDate);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // SEP : 12 vols et 12h dans les 12 mois précédant l'expiration
      if (license.type === 'PPL' || license.type === 'CPL') {
        const checkPeriodStart = new Date(expiryDate);
        checkPeriodStart.setMonth(checkPeriodStart.getMonth() - 12);
        
        requirements.push({
          type: 'SEP_REVALIDATION',
          description: `Revalidation SEP (exp: ${expiryDate.toLocaleDateString()})`,
          periodStart: checkPeriodStart,
          periodEnd: expiryDate,
          daysRemaining: daysUntilExpiry,
          minFlights: 12,
          minHours: 12,
          minTakeoffs: 12,
          minLandings: 12,
          instructorFlightRequired: true,
          regulation: 'FCL.740.A'
        });
      }
    }
    
    // Pour chaque qualification avec date d'expiration
    if (qualification && qualification.expiryDate) {
      const expiryDate = new Date(qualification.expiryDate);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      if (qualification.type === 'night') {
        // Vol de nuit : 3 vols dans les 90 jours
        requirements.push({
          type: 'NIGHT_CURRENCY',
          description: `Maintien vol de nuit`,
          periodDays: 90,
          minFlights: 3,
          minTakeoffs: 3,
          minLandings: 3,
          regulation: 'FCL.060'
        });
      }
      
      if (qualification.type === 'ifr' || qualification.type === 'ir') {
        const checkPeriodStart = new Date(expiryDate);
        checkPeriodStart.setMonth(checkPeriodStart.getMonth() - 12);
        
        requirements.push({
          type: 'IFR_REVALIDATION',
          description: `Revalidation IFR (exp: ${expiryDate.toLocaleDateString()})`,
          periodStart: checkPeriodStart,
          periodEnd: expiryDate,
          daysRemaining: daysUntilExpiry,
          minApproaches: 6,
          minHours: 1,
          checkRequired: true,
          regulation: 'FCL.625'
        });
      }
    }
    
    return requirements;
  };
  
  // Règles réglementaires selon EASA Part-FCL
  const CURRENCY_REQUIREMENTS = {
    // PPL - Avion monomoteur à pistons (SEP)
    SEP: {
      period: 24, // mois
      minFlights: 12, // vols minimum
      minHours: 12, // heures minimum
      minTakeoffs: 12, // décollages
      minLandings: 12, // atterrissages
      instructorFlightRequired: true, // Vol avec instructeur requis
      instructorFlightPeriod: 24, // tous les 24 mois
      description: 'SEP (Single Engine Piston)',
      regulation: 'FCL.740.A'
    },
    
    // PPL - Vol de nuit
    NIGHT: {
      period: 90, // jours (3 mois)
      minFlights: 3, // vols de nuit minimum
      minTakeoffs: 3, // décollages de nuit
      minLandings: 3, // atterrissages de nuit (dont 1 complet)
      minFullStopLandings: 1, // au moins 1 atterrissage complet
      description: 'Vol de nuit',
      regulation: 'FCL.060(b)(1)'
    },
    
    // Transport de passagers
    PASSENGERS: {
      period: 90, // jours
      minTakeoffs: 3,
      minLandings: 3,
      description: 'Transport de passagers',
      regulation: 'FCL.060(b)(1)'
    },
    
    // IFR (Instrument Rating)
    IFR: {
      period: 12, // mois
      minApproaches: 6, // approches IFR
      minHours: 1, // heure minimum en IFR
      checkRequired: true, // Contrôle de compétences
      checkPeriod: 12, // tous les 12 mois
      description: 'IFR (Instrument Flight Rules)',
      regulation: 'FCL.625'
    },
    
    // Vol acrobatique
    AEROBATIC: {
      period: 90, // jours
      minFlights: 3,
      description: 'Vol acrobatique',
      regulation: 'FCL.800'
    },
    
    // Remorquage
    TOWING: {
      period: 24, // mois
      minTows: 5, // remorquages minimum
      description: 'Remorquage planeur/bannière',
      regulation: 'FCL.805'
    },
    
    // Montagne
    MOUNTAIN: {
      period: 24, // mois
      minLandings: 6, // atterrissages en montagne
      description: 'Qualification montagne',
      regulation: 'FCL.815'
    }
  };

  // Analyser les vols pour calculer les totaux sur une période
  const analyzeFlights = (periodDays, startDate = null) => {
    const cutoffDate = startDate || new Date(currentDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    
    const recentFlights = flightLog.filter(flight => {
      const flightDate = new Date(flight.date);
      return flightDate >= cutoffDate && flightDate <= currentDate;
    });

    const stats = {
      totalFlights: recentFlights.length,
      totalHours: 0,
      totalTakeoffs: 0,
      totalLandings: 0,
      nightFlights: 0,
      nightTakeoffs: 0,
      nightLandings: 0,
      nightFullStopLandings: 0,
      ifrApproaches: 0,
      ifrHours: 0,
      instructorFlights: 0,
      mountainLandings: 0,
      towingOperations: 0,
      aerobaticFlights: 0,
      lastFlightDate: null,
      daysSinceLastFlight: null
    };

    recentFlights.forEach(flight => {
      stats.totalHours += flight.hours || 0;
      stats.totalTakeoffs += flight.takeoffs || 1;
      stats.totalLandings += flight.landings || 1;
      
      if (flight.night) {
        stats.nightFlights++;
        stats.nightTakeoffs += flight.nightTakeoffs || 0;
        stats.nightLandings += flight.nightLandings || 0;
        stats.nightFullStopLandings += flight.nightFullStopLandings || 0;
      }
      
      if (flight.ifr) {
        stats.ifrApproaches += flight.approaches || 0;
        stats.ifrHours += flight.ifrHours || 0;
      }
      
      if (flight.withInstructor) {
        stats.instructorFlights++;
      }
      
      if (flight.mountainLanding) {
        stats.mountainLandings += flight.landings || 1;
      }
      
      if (flight.towing) {
        stats.towingOperations += flight.towingCount || 1;
      }
      
      if (flight.aerobatic) {
        stats.aerobaticFlights++;
      }
    });

    // Calculer la date du dernier vol
    if (recentFlights.length > 0) {
      const lastFlight = recentFlights.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      stats.lastFlightDate = new Date(lastFlight.date);
      stats.daysSinceLastFlight = Math.floor((currentDate - stats.lastFlightDate) / (1000 * 60 * 60 * 24));
    }

    return stats;
  };

  // Déterminer quelles vérifications effectuer selon les licences et qualifications
  const getActiveRequirements = () => {
    const active = [];
    const expiryRequirements = [];
    
    // Vérifier chaque licence
    licenses.forEach(license => {
      if (license) {  // Toutes les licences sont actives
        const licenseType = (license.type || '').toUpperCase();
        
        // Ajouter les exigences standards pour les licences de pilote
        if (licenseType.includes('PPL') || licenseType.includes('CPL') || licenseType.includes('ATPL')) {
          active.push('SEP', 'PASSENGERS');
          
          // Ajouter les exigences basées sur la date d'expiration
          const reqs = getExpiryBasedRequirements(license, null);
          expiryRequirements.push(...reqs);
        }
      }
    });
    
    // Vérifier qualifications spécifiques
    qualifications.forEach(qual => {
      if (qual.active) {
        switch(qual.type) {
          case 'night':
            active.push('NIGHT');
            break;
          case 'ifr':
          case 'ir':
            active.push('IFR');
            const ifrReqs = getExpiryBasedRequirements(null, qual);
            expiryRequirements.push(...ifrReqs);
            break;
          case 'aerobatic':
            active.push('AEROBATIC');
            break;
          case 'towing':
            active.push('TOWING');
            break;
          case 'mountain':
            active.push('MOUNTAIN');
            break;
        }
      }
    });
    
    return { active, expiryRequirements };
  };
  
  // Vérifier la validité pour chaque type de qualification
  const checkCurrency = () => {
    const results = {};
    const { active: activeRequirements, expiryRequirements } = getActiveRequirements();
    
    // D'ABORD, vérifier si les licences elles-mêmes sont expirées
    const today = new Date();
    licenses.forEach(license => {
      if (license && license.expiryDate) {
        const expiryDate = new Date(license.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        const licenseType = (license.type || license.name || '').split(' - ')[0];
        
        if (daysUntil < 0) {
          // Licence EXPIRÉE
          results[`LICENSE_${licenseType}_EXPIRED`] = {
            description: `⛔ ${licenseType} - LICENCE EXPIRÉE`,
            regulation: 'LICENCE EXPIRÉE',
            period: daysUntil,
            periodText: `Expirée depuis ${Math.abs(daysUntil)} jours`,
            current: { totalFlights: 0, totalHours: 0 },
            isValid: false,
            isExpired: true,
            expiryDate: expiryDate.toLocaleDateString(),
            missingFlights: 0,
            missingHours: 0,
            needsRenewal: true,
            daysRemaining: daysUntil
          };
          console.log('🔴 Licence expirée détectée:', licenseType, '- Expirée depuis', Math.abs(daysUntil), 'jours');
        }
      }
    });
    
    // Vérifier les qualifications expirées
    qualifications.forEach(qual => {
      if (qual.active && qual.expiryDate) {
        const expiryDate = new Date(qual.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil < 0) {
          results[`QUAL_${qual.type}_EXPIRED`] = {
            description: `⛔ ${qual.name || qual.type} - QUALIFICATION EXPIRÉE`,
            regulation: 'QUALIFICATION EXPIRÉE',
            period: daysUntil,
            periodText: `Expirée depuis ${Math.abs(daysUntil)} jours`,
            current: { totalFlights: 0, totalHours: 0 },
            isValid: false,
            isExpired: true,
            expiryDate: expiryDate.toLocaleDateString(),
            needsRenewal: true,
            daysRemaining: daysUntil
          };
        }
      }
    });
    
    // VÉRIFIER LE CERTIFICAT MÉDICAL
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    if (medicalRecords.length === 0) {
      // AUCUN certificat médical enregistré
      results['MEDICAL_MISSING'] = {
        description: `⛔ CERTIFICAT MÉDICAL MANQUANT`,
        regulation: 'PART-MED - OBLIGATOIRE',
        period: -999,
        periodText: `Aucun certificat médical enregistré`,
        current: { totalFlights: 0, totalHours: 0 },
        isValid: false,
        isExpired: true,
        isMissing: true,
        isMedical: true,
        needsRenewal: true,
        daysRemaining: -999
      };
    } else {
      // Trier par date d'expiration pour obtenir le plus récent
      const sortedMedical = medicalRecords.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
      const latestMedical = sortedMedical[0];
      
      if (latestMedical && latestMedical.expiryDate) {
        const expiryDate = new Date(latestMedical.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        const medicalClass = latestMedical.type === 'class1' ? 'Classe 1' : 
                           latestMedical.type === 'class2' ? 'Classe 2' : 
                           latestMedical.type === 'lapl' ? 'LAPL' : 'Médical';
        
        if (daysUntil < 0) {
          // Médical EXPIRÉ
          results['MEDICAL_EXPIRED'] = {
            description: `⛔ CERTIFICAT MÉDICAL ${medicalClass} - EXPIRÉ`,
            regulation: 'PART-MED',
            period: daysUntil,
            periodText: `Expiré depuis ${Math.abs(daysUntil)} jours`,
            current: { totalFlights: 0, totalHours: 0 },
            isValid: false,
            isExpired: true,
            isMedical: true,
            expiryDate: expiryDate.toLocaleDateString(),
            needsRenewal: true,
            daysRemaining: daysUntil,
            medicalType: medicalClass
          };
        } else if (daysUntil < 60) {
          // Médical expire bientôt
          results['MEDICAL_WARNING'] = {
            description: `⚠️ CERTIFICAT MÉDICAL ${medicalClass}`,
            regulation: 'PART-MED',
            period: daysUntil,
            periodText: daysUntil < 30 ? 
              `⚠️ Expire dans ${daysUntil} jours (URGENT)` : 
              `📅 Expire dans ${daysUntil} jours`,
            current: { totalFlights: 0, totalHours: 0 },
            isValid: daysUntil > 30,
            isExpired: false,
            isMedical: true,
            expiryDate: expiryDate.toLocaleDateString(),
            daysRemaining: daysUntil,
            medicalType: medicalClass,
            needsAction: daysUntil < 30
          };
        } else {
          // Médical valide
          results['MEDICAL_VALID'] = {
            description: `✅ CERTIFICAT MÉDICAL ${medicalClass}`,
            regulation: 'PART-MED',
            period: daysUntil,
            periodText: `Valide jusqu'au ${expiryDate.toLocaleDateString()}`,
            current: { totalFlights: 0, totalHours: 0 },
            isValid: true,
            isExpired: false,
            isMedical: true,
            expiryDate: expiryDate.toLocaleDateString(),
            daysRemaining: daysUntil,
            medicalType: medicalClass
          };
        }
      }
    }
    
    // ENSUITE, ajouter les vérifications basées sur les dates d'expiration
    expiryRequirements.forEach(req => {
      if (req.periodStart && req.periodEnd) {
        // Analyser les vols dans la période spécifique
        const periodFlights = flightLog.filter(flight => {
          const flightDate = new Date(flight.date);
          return flightDate >= req.periodStart && flightDate <= currentDate;
        });
        
        const stats = {
          totalFlights: periodFlights.length,
          totalHours: 0,
          totalTakeoffs: 0,
          totalLandings: 0,
          ifrApproaches: 0,
          instructorFlights: 0
        };
        
        periodFlights.forEach(flight => {
          stats.totalHours += parseFloat(flight.hours || flight.totalTime) || 0;
          stats.totalTakeoffs += flight.takeoffs || 1;
          stats.totalLandings += flight.landings || 1;
          if (flight.ifr) stats.ifrApproaches += flight.approaches || 0;
          if (flight.withInstructor) stats.instructorFlights++;
        });
        
        results[req.type] = {
          description: req.description,
          regulation: req.regulation,
          period: req.daysRemaining,
          periodText: `Du ${req.periodStart.toLocaleDateString()} au ${req.periodEnd.toLocaleDateString()}`,
          current: stats,
          isValid: stats.totalFlights >= (req.minFlights || 0) &&
                   stats.totalHours >= (req.minHours || 0) &&
                   stats.totalTakeoffs >= (req.minTakeoffs || 0) &&
                   stats.totalLandings >= (req.minLandings || 0) &&
                   (!req.instructorFlightRequired || stats.instructorFlights > 0) &&
                   (!req.minApproaches || stats.ifrApproaches >= req.minApproaches),
          missingFlights: Math.max(0, (req.minFlights || 0) - stats.totalFlights),
          missingHours: Math.max(0, (req.minHours || 0) - stats.totalHours),
          missingTakeoffs: Math.max(0, (req.minTakeoffs || 0) - stats.totalTakeoffs),
          missingLandings: Math.max(0, (req.minLandings || 0) - stats.totalLandings),
          missingApproaches: req.minApproaches ? Math.max(0, req.minApproaches - stats.ifrApproaches) : 0,
          needsInstructorFlight: req.instructorFlightRequired && stats.instructorFlights === 0,
          daysRemaining: req.daysRemaining,
          isExpiryBased: true
        };
      }
    });
    
    // SEP (Single Engine Piston) - seulement si actif
    if (activeRequirements.includes('SEP')) {
      const sep24Months = analyzeFlights(365 * 2);
      results.SEP = {
      ...CURRENCY_REQUIREMENTS.SEP,
      current: sep24Months,
      isValid: sep24Months.totalFlights >= CURRENCY_REQUIREMENTS.SEP.minFlights &&
               sep24Months.totalHours >= CURRENCY_REQUIREMENTS.SEP.minHours &&
               sep24Months.totalTakeoffs >= CURRENCY_REQUIREMENTS.SEP.minTakeoffs &&
               sep24Months.totalLandings >= CURRENCY_REQUIREMENTS.SEP.minLandings,
      missingFlights: Math.max(0, CURRENCY_REQUIREMENTS.SEP.minFlights - sep24Months.totalFlights),
      missingHours: Math.max(0, CURRENCY_REQUIREMENTS.SEP.minHours - sep24Months.totalHours),
      missingTakeoffs: Math.max(0, CURRENCY_REQUIREMENTS.SEP.minTakeoffs - sep24Months.totalTakeoffs),
        missingLandings: Math.max(0, CURRENCY_REQUIREMENTS.SEP.minLandings - sep24Months.totalLandings),
        needsInstructorFlight: sep24Months.instructorFlights === 0
      };
    }

    // Vol de nuit - seulement si qualification active
    if (activeRequirements.includes('NIGHT')) {
      const night90Days = analyzeFlights(90);
      results.NIGHT = {
      ...CURRENCY_REQUIREMENTS.NIGHT,
      current: night90Days,
      isValid: night90Days.nightTakeoffs >= CURRENCY_REQUIREMENTS.NIGHT.minTakeoffs &&
               night90Days.nightLandings >= CURRENCY_REQUIREMENTS.NIGHT.minLandings &&
               night90Days.nightFullStopLandings >= CURRENCY_REQUIREMENTS.NIGHT.minFullStopLandings,
      missingTakeoffs: Math.max(0, CURRENCY_REQUIREMENTS.NIGHT.minTakeoffs - night90Days.nightTakeoffs),
        missingLandings: Math.max(0, CURRENCY_REQUIREMENTS.NIGHT.minLandings - night90Days.nightLandings),
        missingFullStop: Math.max(0, CURRENCY_REQUIREMENTS.NIGHT.minFullStopLandings - night90Days.nightFullStopLandings)
      };
    }

    // Transport passagers - seulement si licence active
    if (activeRequirements.includes('PASSENGERS')) {
      const pax90Days = analyzeFlights(90);
      results.PASSENGERS = {
      ...CURRENCY_REQUIREMENTS.PASSENGERS,
      current: pax90Days,
      isValid: pax90Days.totalTakeoffs >= CURRENCY_REQUIREMENTS.PASSENGERS.minTakeoffs &&
               pax90Days.totalLandings >= CURRENCY_REQUIREMENTS.PASSENGERS.minLandings,
        missingTakeoffs: Math.max(0, CURRENCY_REQUIREMENTS.PASSENGERS.minTakeoffs - pax90Days.totalTakeoffs),
        missingLandings: Math.max(0, CURRENCY_REQUIREMENTS.PASSENGERS.minLandings - pax90Days.totalLandings)
      };
    }

    // IFR - seulement si qualification active
    if (activeRequirements.includes('IFR')) {
      const ifr12Months = analyzeFlights(365);
      results.IFR = {
      ...CURRENCY_REQUIREMENTS.IFR,
      current: ifr12Months,
      isValid: ifr12Months.ifrApproaches >= CURRENCY_REQUIREMENTS.IFR.minApproaches &&
               ifr12Months.ifrHours >= CURRENCY_REQUIREMENTS.IFR.minHours,
        missingApproaches: Math.max(0, CURRENCY_REQUIREMENTS.IFR.minApproaches - ifr12Months.ifrApproaches),
        missingHours: Math.max(0, CURRENCY_REQUIREMENTS.IFR.minHours - ifr12Months.ifrHours)
      };
    }
    
    // Ajouter les autres qualifications si actives
    if (activeRequirements.includes('AEROBATIC')) {
      const aerobatic90Days = analyzeFlights(90);
      results.AEROBATIC = {
        ...CURRENCY_REQUIREMENTS.AEROBATIC,
        current: aerobatic90Days,
        isValid: aerobatic90Days.aerobaticFlights >= CURRENCY_REQUIREMENTS.AEROBATIC.minFlights,
        missingFlights: Math.max(0, CURRENCY_REQUIREMENTS.AEROBATIC.minFlights - aerobatic90Days.aerobaticFlights)
      };
    }
    
    if (activeRequirements.includes('TOWING')) {
      const towing24Months = analyzeFlights(365 * 2);
      results.TOWING = {
        ...CURRENCY_REQUIREMENTS.TOWING,
        current: towing24Months,
        isValid: towing24Months.towingOperations >= CURRENCY_REQUIREMENTS.TOWING.minTows,
        missingTows: Math.max(0, CURRENCY_REQUIREMENTS.TOWING.minTows - towing24Months.towingOperations)
      };
    }
    
    if (activeRequirements.includes('MOUNTAIN')) {
      const mountain24Months = analyzeFlights(365 * 2);
      results.MOUNTAIN = {
        ...CURRENCY_REQUIREMENTS.MOUNTAIN,
        current: mountain24Months,
        isValid: mountain24Months.mountainLandings >= CURRENCY_REQUIREMENTS.MOUNTAIN.minLandings,
        missingLandings: Math.max(0, CURRENCY_REQUIREMENTS.MOUNTAIN.minLandings - mountain24Months.mountainLandings)
      };
    }

    return results;
  };

  const currencyStatus = useMemo(() => checkCurrency(), [flightLog, currentDate]);

  // Calculer le statut global
  const getOverallStatus = () => {
    // Vérifier d'abord si des licences/qualifications sont expirées
    const today = new Date();
    let hasExpiredLicense = false;
    let hasExpiringLicense = false;
    
    licenses.forEach(license => {
      if (license.active && license.expiryDate) {
        const expiryDate = new Date(license.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) hasExpiredLicense = true;
        else if (daysUntil < 90) hasExpiringLicense = true;
      }
    });
    
    qualifications.forEach(qual => {
      if (qual.active && qual.expiryDate) {
        const expiryDate = new Date(qual.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) hasExpiredLicense = true;
        else if (daysUntil < 90) hasExpiringLicense = true;
      }
    });
    
    // Si une licence est expirée, statut critique
    if (hasExpiredLicense) return 'critical';
    
    // Vérifier les exigences de vol
    const statuses = Object.values(currencyStatus);
    const invalidCount = statuses.filter(s => !s.isValid).length;
    
    // Si des exigences ne sont pas remplies ou des licences expirent bientôt
    if (invalidCount > 0 || hasExpiringLicense) {
      if (invalidCount > 2) return 'critical';
      return 'warning';
    }
    
    return 'valid';
  };

  const overallStatus = getOverallStatus();

  // Calculer les jours restants avant expiration
  const getDaysUntilExpiry = (requirement, lastDate) => {
    if (!lastDate) return 0;
    const expiryDate = new Date(lastDate.getTime() + requirement.period * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  };

  // Calculer le résumé des statuts
  const getStatusSummary = () => {
    const today = new Date();
    const summary = {
      licenses: { expired: 0, expiring: 0, valid: 0, total: 0 },
      qualifications: { expired: 0, expiring: 0, valid: 0, total: 0 },
      medical: { status: 'unknown', daysRemaining: null },
      flightRequirements: { satisfied: 0, pending: 0, total: 0 }
    };
    
    // Analyser les licences
    licenses.forEach(license => {
      if (license) {  // Toutes les licences sont considérées actives
        summary.licenses.total++;
        if (license.expiryDate) {
          const expiryDate = new Date(license.expiryDate);
          const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
          
          if (daysUntil < 0) {
            summary.licenses.expired++;
            console.log('🔴 Licence expirée:', license.type, 'depuis', Math.abs(daysUntil), 'jours');
          } else if (daysUntil < 90) {
            summary.licenses.expiring++;
          } else {
            summary.licenses.valid++;
          }
        } else {
          // Si pas de date d'expiration, considérer comme valide
          summary.licenses.valid++;
        }
      }
    });
    
    // Analyser les qualifications
    qualifications.forEach(qual => {
      if (qual.active) {
        summary.qualifications.total++;
        if (qual.expiryDate) {
          const expiryDate = new Date(qual.expiryDate);
          const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
          
          if (daysUntil < 0) summary.qualifications.expired++;
          else if (daysUntil < 90) summary.qualifications.expiring++;
          else summary.qualifications.valid++;
        }
      }
    });
    
    // Analyser le médical
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const currentMedical = medicalRecords.find(record => {
      const expiry = new Date(record.expiryDate);
      return expiry > today;
    });
    
    if (currentMedical) {
      const expiryDate = new Date(currentMedical.expiryDate);
      const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil < 0) summary.medical = { status: 'expired', daysRemaining: daysUntil };
      else if (daysUntil < 30) summary.medical = { status: 'urgent', daysRemaining: daysUntil };
      else if (daysUntil < 90) summary.medical = { status: 'warning', daysRemaining: daysUntil };
      else summary.medical = { status: 'valid', daysRemaining: daysUntil };
    } else {
      const lastExpired = medicalRecords.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))[0];
      if (lastExpired) {
        const expiryDate = new Date(lastExpired.expiryDate);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
        summary.medical = { status: 'expired', daysRemaining: daysUntil };
      }
    }
    
    // Analyser les exigences de vol
    Object.values(currencyStatus).forEach(status => {
      if (!status.isExpired) {
        summary.flightRequirements.total++;
        if (status.isValid) summary.flightRequirements.satisfied++;
        else summary.flightRequirements.pending++;
      }
    });
    
    return summary;
  };
  
  const statusSummary = getStatusSummary();
  
  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Résumé global des statuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Statut des licences */}
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: statusSummary.licenses.expired > 0 ? '#fee2e2' :
                         statusSummary.licenses.expiring > 0 ? '#fef3c7' : '#f0fdf4',
          border: `1px solid ${statusSummary.licenses.expired > 0 ? '#fca5a5' :
                              statusSummary.licenses.expiring > 0 ? '#fcd34d' : '#86efac'}`
        }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
            📄 LICENCES ({statusSummary.licenses.total})
          </h4>
          {statusSummary.licenses.expired > 0 && (
            <p style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>
              ⛔ {statusSummary.licenses.expired} expirée{statusSummary.licenses.expired > 1 ? 's' : ''}
            </p>
          )}
          {statusSummary.licenses.expiring > 0 && (
            <p style={{ fontSize: '11px', color: '#f59e0b' }}>
              ⚠️ {statusSummary.licenses.expiring} expire{statusSummary.licenses.expiring > 1 ? 'nt' : ''} bientôt
            </p>
          )}
          {statusSummary.licenses.valid > 0 && (
            <p style={{ fontSize: '11px', color: '#059669' }}>
              ✅ {statusSummary.licenses.valid} valide{statusSummary.licenses.valid > 1 ? 's' : ''}
            </p>
          )}
          {statusSummary.licenses.total === 0 && (
            <p style={{ fontSize: '11px', color: '#6b7280' }}>Aucune licence active</p>
          )}
        </div>
        
        {/* Statut des qualifications */}
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: statusSummary.qualifications.total === 0 ? '#f3f4f6' :
                         statusSummary.qualifications.expired > 0 ? '#fee2e2' :
                         statusSummary.qualifications.expiring > 0 ? '#fef3c7' : '#f0fdf4',
          border: `1px solid ${statusSummary.qualifications.total === 0 ? '#d1d5db' :
                              statusSummary.qualifications.expired > 0 ? '#fca5a5' :
                              statusSummary.qualifications.expiring > 0 ? '#fcd34d' : '#86efac'}`
        }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
            🎓 QUALIFICATIONS ({statusSummary.qualifications.total})
          </h4>
          {statusSummary.qualifications.expired > 0 && (
            <p style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>
              ⛔ {statusSummary.qualifications.expired} expirée{statusSummary.qualifications.expired > 1 ? 's' : ''}
            </p>
          )}
          {statusSummary.qualifications.expiring > 0 && (
            <p style={{ fontSize: '11px', color: '#f59e0b' }}>
              ⚠️ {statusSummary.qualifications.expiring} expire{statusSummary.qualifications.expiring > 1 ? 'nt' : ''} bientôt
            </p>
          )}
          {statusSummary.qualifications.valid > 0 && (
            <p style={{ fontSize: '11px', color: '#059669' }}>
              ✅ {statusSummary.qualifications.valid} valide{statusSummary.qualifications.valid > 1 ? 's' : ''}
            </p>
          )}
          {statusSummary.qualifications.total === 0 && (
            <p style={{ fontSize: '11px', color: '#6b7280' }}>Aucune qualification enregistrée</p>
          )}
        </div>
        
        {/* Statut médical */}
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: statusSummary.medical.status === 'expired' ? '#fee2e2' :
                         statusSummary.medical.status === 'urgent' ? '#fee2e2' :
                         statusSummary.medical.status === 'warning' ? '#fef3c7' :
                         statusSummary.medical.status === 'valid' ? '#f0fdf4' : '#f3f4f6',
          border: `1px solid ${statusSummary.medical.status === 'expired' ? '#fca5a5' :
                              statusSummary.medical.status === 'urgent' ? '#fca5a5' :
                              statusSummary.medical.status === 'warning' ? '#fcd34d' :
                              statusSummary.medical.status === 'valid' ? '#86efac' : '#d1d5db'}`
        }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
            🏥 CERTIFICAT MÉDICAL
          </h4>
          {statusSummary.medical.status === 'expired' && (
            <p style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>
              ⛔ Expiré {statusSummary.medical.daysRemaining && `(${Math.abs(statusSummary.medical.daysRemaining)}j)`}
            </p>
          )}
          {statusSummary.medical.status === 'urgent' && (
            <p style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>
              ⚠️ Expire dans {statusSummary.medical.daysRemaining}j
            </p>
          )}
          {statusSummary.medical.status === 'warning' && (
            <p style={{ fontSize: '11px', color: '#f59e0b' }}>
              📅 Expire dans {statusSummary.medical.daysRemaining}j
            </p>
          )}
          {statusSummary.medical.status === 'valid' && (
            <p style={{ fontSize: '11px', color: '#059669' }}>
              ✅ Valide ({statusSummary.medical.daysRemaining}j restants)
            </p>
          )}
          {statusSummary.medical.status === 'unknown' && (
            <p style={{ fontSize: '11px', color: '#6b7280' }}>Non renseigné</p>
          )}
        </div>
        
        {/* Exigences de vol */}
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: statusSummary.flightRequirements.pending > 0 ? '#fef3c7' : '#f0fdf4',
          border: `1px solid ${statusSummary.flightRequirements.pending > 0 ? '#fcd34d' : '#86efac'}`
        }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>
            ✈️ EXIGENCES DE VOL
          </h4>
          {statusSummary.flightRequirements.total > 0 ? (
            <>
              {statusSummary.flightRequirements.satisfied > 0 && (
                <p style={{ fontSize: '11px', color: '#059669' }}>
                  ✅ {statusSummary.flightRequirements.satisfied}/{statusSummary.flightRequirements.total} satisfaite{statusSummary.flightRequirements.satisfied > 1 ? 's' : ''}
                </p>
              )}
              {statusSummary.flightRequirements.pending > 0 && (
                <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>
                  ⏳ {statusSummary.flightRequirements.pending} en attente
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '11px', color: '#6b7280' }}>Aucune exigence active</p>
          )}
        </div>
      </div>
      
      {/* En-tête avec statut global */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            <Activity size={20} style={{ marginRight: '8px' }} />
            Détail des obligations réglementaires
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Basé sur vos licences et qualifications actives
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Bouton ajouter un vol */}
          <button
            onClick={() => {
              if (window.setPilotActiveTab) {
                window.setPilotActiveTab('logbook');
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📝 Ajouter un vol
          </button>
        </div>
      </div>

      {/* Alertes pour les licences arrivant à expiration */}
      {(() => {
        const expiringLicenses = [];
        
        // Vérifier les licences
        licenses.forEach(license => {
          if (license.active && license.expiryDate) {
            const expiryDate = new Date(license.expiryDate);
            const daysUntil = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
            
            if (daysUntil < 90) {
              expiringLicenses.push({
                type: 'license',
                name: `${license.type} - ${license.number}`,
                expiryDate,
                daysUntil
              });
            }
          }
        });
        
        // Vérifier les qualifications
        qualifications.forEach(qual => {
          if (qual.active && qual.expiryDate) {
            const expiryDate = new Date(qual.expiryDate);
            const daysUntil = Math.floor((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
            
            if (daysUntil < 90) {
              expiringLicenses.push({
                type: 'qualification',
                name: qual.name || qual.type,
                expiryDate,
                daysUntil
              });
            }
          }
        });
        
        if (expiringLicenses.length > 0) {
          const mostUrgent = expiringLicenses.sort((a, b) => a.daysUntil - b.daysUntil)[0];
          const urgency = mostUrgent.daysUntil < 0 ? 'expired' :
                         mostUrgent.daysUntil < 30 ? 'critical' :
                         mostUrgent.daysUntil < 60 ? 'warning' : 'info';
          
          return (
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              backgroundColor: urgency === 'expired' ? '#fee2e2' :
                             urgency === 'critical' ? '#fee2e2' :
                             urgency === 'warning' ? '#fed7aa' : '#fef3c7',
              border: `1px solid ${urgency === 'expired' ? '#dc2626' :
                                  urgency === 'critical' ? '#fca5a5' :
                                  urgency === 'warning' ? '#fb923c' : '#fcd34d'}`
            }}>
              <AlertTriangle size={16} color={urgency === 'expired' ? '#dc2626' : '#f59e0b'} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {urgency === 'expired' ? '⛔ Licences/Qualifications EXPIRÉES' :
                   urgency === 'critical' ? '⚠️ Renouvellement URGENT requis' :
                   urgency === 'warning' ? '📅 Renouvellement à prévoir' :
                   'ℹ️ Dates d\'expiration à surveiller'}
                </p>
                <ul style={{ fontSize: '12px', marginLeft: '20px', marginTop: '8px' }}>
                  {expiringLicenses.map((item, idx) => (
                    <li key={idx}>
                      <strong>{item.name}</strong> - 
                      {item.daysUntil < 0 ? 
                        <span style={{ color: '#dc2626', fontWeight: 'bold' }}> EXPIRÉ depuis {Math.abs(item.daysUntil)} jours</span> :
                        <span> expire dans <strong>{item.daysUntil} jours</strong> ({item.expiryDate.toLocaleDateString()})</span>
                      }
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                  💡 Vérifiez ci-dessous les vols requis pour la revalidation
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Message si aucune licence/qualification ou éléments manquants */}
      {(() => {
        const hasNoLicenses = licenses.length === 0;
        const hasNoMedical = !Object.keys(currencyStatus).some(key => key.includes('MEDICAL'));
        
        if (hasNoLicenses) {
          return (
            <div style={{
              padding: '20px',
              backgroundColor: '#fee2e2',
              borderRadius: '8px',
              border: '2px solid #dc2626',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>⛔</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', marginBottom: '4px' }}>
                    AUCUNE LICENCE ENREGISTRÉE
                  </p>
                  <p style={{ fontSize: '14px', color: '#991b1b' }}>
                    Vous devez enregistrer au moins une licence de pilote pour voler légalement.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.setPilotActiveTab) {
                      window.setPilotActiveTab('certifications');
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  AJOUTER UNE LICENCE
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}
      
      {/* Tableau de suivi par qualification */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(() => {
          // Regrouper les statuts par catégorie
          const grouped = {
            expired: [],
            medical: [],
            revalidation: [],
            currency: [],
            valid: []
          };
          
          Object.entries(currencyStatus).forEach(([key, status]) => {
            if (status.isMedical) {
              // Séparer le médical dans sa propre catégorie
              if (status.isExpired || status.needsAction) {
                grouped.medical.push({ key, ...status });
              } else if (status.isValid) {
                grouped.valid.push({ key, ...status });
              }
            } else if (status.isExpired) {
              grouped.expired.push({ key, ...status });
            } else if (status.isExpiryBased) {
              grouped.revalidation.push({ key, ...status });
            } else if (!status.isValid) {
              grouped.currency.push({ key, ...status });
            } else {
              grouped.valid.push({ key, ...status });
            }
          });
          
          return (
            <>
              {/* Certificat médical */}
              {grouped.medical.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: grouped.medical[0].isExpired ? '#dc2626' : '#f59e0b' }}>
                    🏥 CERTIFICAT MÉDICAL
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {grouped.medical.map(status => (
                      <div key={status.key} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: status.isMissing ? '#fee2e2' :
                                       status.isExpired ? '#fee2e2' : 
                                       status.needsAction ? '#fed7aa' : '#fef3c7',
                        border: `2px solid ${status.isMissing ? '#dc2626' :
                                           status.isExpired ? '#dc2626' : 
                                           status.needsAction ? '#f59e0b' : '#fcd34d'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ 
                              fontSize: '14px', 
                              fontWeight: 'bold', 
                              color: status.isMissing ? '#dc2626' :
                                    status.isExpired ? '#dc2626' : 
                                    status.needsAction ? '#f59e0b' : '#059669'
                            }}>
                              {status.description.replace('⛔ ', '').replace('⚠️ ', '').replace('✅ ', '')}
                            </p>
                            <p style={{ fontSize: '12px', color: status.isMissing || status.isExpired ? '#991b1b' : '#6b7280' }}>
                              {status.periodText} • {status.regulation}
                            </p>
                          </div>
                          {(status.isExpired || status.needsAction) && (
                            <button
                              onClick={() => {
                                if (window.setPilotActiveTab) {
                                  window.setPilotActiveTab('medical');
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: status.isExpired ? '#dc2626' : '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              {status.isMissing ? 'AJOUTER' : status.isExpired ? 'RENOUVELER' : 'PRENDRE RDV'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Licences/Qualifications expirées */}
              {grouped.expired.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#dc2626' }}>
                    🚫 Licences/Qualifications EXPIRÉES
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {grouped.expired.map(status => (
                      <div key={status.key} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#fee2e2',
                        border: '2px solid #dc2626'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
                              {status.description.replace('⛔ ', '')}
                            </p>
                            <p style={{ fontSize: '12px', color: '#991b1b' }}>
                              {status.periodText} • Expirée le {status.expiryDate}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (window.setPilotActiveTab) {
                                window.setPilotActiveTab('certifications');
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          >
                            RENOUVELER
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Exigences pour revalidation */}
              {grouped.revalidation.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#f59e0b' }}>
                    📋 Exigences pour revalidation
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {grouped.revalidation.map(status => (
                      <div key={status.key} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: status.isValid ? '#f0fdf4' : '#fef3c7',
                        border: `1px solid ${status.isValid ? '#86efac' : '#fcd34d'}`
                      }}>
                        <div style={{ marginBottom: '8px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                            {status.isValid ? <CheckCircle size={14} color="#10b981" /> : <AlertTriangle size={14} color="#f59e0b" />}
                            <span style={{ marginLeft: '6px' }}>{status.description}</span>
                          </p>
                          <p style={{ fontSize: '11px', color: '#6b7280' }}>
                            {status.periodText} • {status.regulation}
                          </p>
                        </div>
                        
                        {/* Barre de progression simplifiée */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                          {status.minFlights && (
                            <div style={{ fontSize: '11px' }}>
                              <span style={{ color: '#6b7280' }}>Vols: </span>
                              <span style={{ fontWeight: 'bold', color: status.missingFlights > 0 ? '#dc2626' : '#059669' }}>
                                {status.current.totalFlights}/{status.minFlights}
                              </span>
                            </div>
                          )}
                          {status.minHours && (
                            <div style={{ fontSize: '11px' }}>
                              <span style={{ color: '#6b7280' }}>Heures: </span>
                              <span style={{ fontWeight: 'bold', color: status.missingHours > 0 ? '#dc2626' : '#059669' }}>
                                {status.current.totalHours.toFixed(1)}/{status.minHours}h
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {!status.isValid && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#92400e' }}>
                            ⚠️ Manque: {status.missingFlights > 0 && `${status.missingFlights} vol(s)`}
                            {status.missingHours > 0 && ` • ${status.missingHours.toFixed(1)}h`}
                            {status.needsInstructorFlight && ' • Vol instructeur'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Maintien des compétences */}
              {grouped.currency.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#6b7280' }}>
                    ✈️ Maintien des compétences
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {grouped.currency.map(status => (
                      <div key={status.key} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: status.isValid ? '#f0fdf4' : '#fef3c7',
                        border: `1px solid ${status.isValid ? '#86efac' : '#fcd34d'}`
                      }}>
                        <div style={{ marginBottom: '8px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 'bold' }}>
                            {status.description}
                          </p>
                          <p style={{ fontSize: '11px', color: '#6b7280' }}>
                            Période: {status.period} jours • {status.regulation}
                          </p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                          {status.minTakeoffs && (
                            <span>
                              Décollages: <strong style={{ color: status.missingTakeoffs > 0 ? '#dc2626' : '#059669' }}>
                                {status.current.totalTakeoffs}/{status.minTakeoffs}
                              </strong>
                            </span>
                          )}
                          {status.minLandings && (
                            <span>
                              Atterrissages: <strong style={{ color: status.missingLandings > 0 ? '#dc2626' : '#059669' }}>
                                {status.current.totalLandings}/{status.minLandings}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Éléments valides (résumé compact) */}
              {grouped.valid.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#059669' }}>
                    ✅ Éléments valides
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {grouped.valid.map(status => (
                      <div key={status.key} style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        fontSize: '12px'
                      }}>
                        <span style={{ color: '#059669' }}>✓</span> {status.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
      
      {/* Informations réglementaires - En bas de page */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        marginTop: '20px',
        backgroundColor: '#eff6ff',
        border: '1px solid #60a5fa'
      }}>
        <Info size={16} />
        <div style={{ width: '100%' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold' }}>Références réglementaires</p>
          <p style={{ fontSize: '12px' }}>
            Ces exigences sont basées sur la réglementation EASA Part-FCL. Consultez toujours les textes officiels
            et votre école de pilotage pour les exigences spécifiques à votre situation.
          </p>
          <ul style={{ fontSize: '12px', marginLeft: '20px', marginTop: '8px' }}>
            <li>FCL.740 - Validité et renouvellement des qualifications</li>
            <li>FCL.060 - Expérience récente</li>
            <li>FCL.625 - Validité de la qualification IR</li>
            <li>AMC1 FCL.740.A(b)(1) - Renouvellement SEP</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FlightCurrencyTracker;