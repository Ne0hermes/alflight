// src/features/pilot/components/PilotLogbook.jsx
// Restructuré selon le format du carnet de vol français
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Download, Upload, Trash2, Edit2, Plane, Clock, MapPin, Moon, Sun, Search } from 'lucide-react';
// Style system removed - using inline styles
import { useAircraftStore } from '../../../core/stores/aircraftStore';
import { logToGoogleSheets } from '../../../utils/googleSheetsLogger';

const PilotLogbook = ({ showFormProp }) => {
  const { aircraftList } = useAircraftStore();
  const fileInputRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAircraftData, setSelectedAircraftData] = useState(null);
  const [pilotsList, setPilotsList] = useState([]);
  const [timeValidation, setTimeValidation] = useState({ valid: true, message: '' });
  const [timeOrderValidation, setTimeOrderValidation] = useState({ valid: true, message: '' });
  const [flightSegments, setFlightSegments] = useState([
    {
      id: 1,
      time: '',
      flightType: '',
      functionOnBoard: '',
      pilotInCommand: ''
    }
  ]);
  const [useUniformFlight, setUseUniformFlight] = useState(false);

  // Fonctions utilitaires pour conversion temps
  const decimalToHHMM = (decimal) => {
    if (!decimal || isNaN(decimal)) return '';
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const HHMMToDecimal = (hhmm) => {
    if (!hhmm || !hhmm.includes(':')) return 0;
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours + (minutes / 60);
  };
  
  // Utiliser showFormProp pour l'ajout, mais toujours permettre l'édition
  // Si on édite une entrée, toujours afficher le formulaire
  const isFormVisible = editingEntry ? true : (showFormProp !== undefined ? showFormProp : showForm);

  // Debug: surveiller les changements d'état
  useEffect(() => {
    console.log('🔄 === CHANGEMENT D\'ÉTAT ===');
    console.log('📊 showForm:', showForm);
    console.log('📊 showFormProp:', showFormProp);
    console.log('📊 isFormVisible:', isFormVisible);
    console.log('📊 editingEntry:', editingEntry);
  }, [showForm, showFormProp, isFormVisible, editingEntry]);
  
  const [formData, setFormData] = useState({
    // Section 1: Date et Lieu
    date: new Date().toISOString().split('T')[0],
    departure: '',
    arrival: '',
    route: '',

    // Section 2: Avion
    aircraft: '',
    aircraftType: '',
    aircraftGroup: 'singleEngine', // singleEngine, multiEngine, turboprop, jet

    // Section 3: Équipage
    pilotInCommand: '',  // Nom du CDB
    copilot: '',         // Nom du copilote

    // Section 4: Heures de vol
    blockOff: '',
    takeOff: '',
    landing: '',
    blockOn: '',
    totalTime: '', // Format HH:MM
    nightTime: 0,
    ifrTime: 0,

    // Section 5: Type de vol et Fonction (déplacé dans segments)
    flightType: '', // vfr-day, vfr-night, ifr-day, ifr-night, simulator, mixed
    mixedFlightMode: false, // Mode division manuelle du temps
    functionOnBoard: '', // pic, copilot, dualCommand, student, instructor, examiner

    // Section 6: Décollages et Atterrissages
    dayTakeoffs: 0,
    nightTakeoffs: 0,
    dayLandings: 0,
    nightLandings: 0,
    ifrApproaches: 0,

    // Section 7: Temps de vol par condition
    vfrTime: 0,
    actualIMC: 0,
    simulatedIMC: 0,
    crossCountryTime: 0,

    // Section 8: Approches aux instruments
    ilsApproaches: 0,
    vorApproaches: 0,
    ndbApproaches: 0,
    gpsApproaches: 0,

    // Section 9: Formation et Contrôles
    dualReceived: 0,     // Temps d'instruction reçue
    dualGiven: 0,        // Temps d'instruction donnée
    examinerTime: 0,     // Temps comme examinateur

    // Section 10: Observations
    simulatorTime: 0,
    remarks: ''
  });

  // Charger les entrées depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pilotLogbook');
    if (saved) {
      setEntries(JSON.parse(saved));
    }

    // Charger dynamiquement les fonctions de test
    import('../../../utils/testFlightSegments').then(module => {
      window.testFlightSegments = module.default;
      console.log('📊 Fonctions de test disponibles:');
      console.log('  testFlightSegments.testFlightSegments() - Analyser les segments existants');
      console.log('  testFlightSegments.addTestFlightWithSegments() - Ajouter un vol test avec segments');
      console.log('  testFlightSegments.clearTestFlights() - Supprimer les vols test');
    }).catch(err => {
      console.log('Fonctions de test non disponibles:', err);
    });

    // Charger les fonctions de debug pour l'édition
    import('../../../utils/debugEditLogbook').then(module => {
      window.debugLogbook = module.default;
      console.log('🔧 Fonctions de debug disponibles:');
      console.log('  debugLogbook.debugEditLogbook() - Analyser toutes les entrées');
      console.log('  debugLogbook.testEditEntry(0) - Tester l\'édition de la première entrée');
      console.log('  debugLogbook.fixMissingSegments() - Ajouter des segments aux anciennes entrées');
    }).catch(err => {
      console.log('Fonctions de debug non disponibles:', err);
    });

    // Charger les fonctions pour forcer l'édition
    import('../../../utils/forceEditLogbook').then(module => {
      window.forceEditEntry = module.default;
      console.log('✏️ Fonctions d\'édition forcée disponibles:');
      console.log('  forceEditEntry.editByIndex(0) - Forcer l\'édition de l\'entrée par index');
      console.log('  forceEditEntry.deleteEntry(0) - Supprimer une entrée par index');
    }).catch(err => {
      console.log('Fonctions d\'édition forcée non disponibles:', err);
    });
  }, []);

  // Construire la liste des pilotes à partir des entrées et du profil
  useEffect(() => {
    const pilots = new Set();
    
    // Ajouter le pilote actuel depuis le profil
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    if (profile.firstName && profile.lastName) {
      pilots.add(`${profile.firstName} ${profile.lastName}`);
    }
    
    // Ajouter les pilotes des entrées précédentes
    entries.forEach(entry => {
      if (entry.pilotInCommand) pilots.add(entry.pilotInCommand);
      if (entry.copilot) pilots.add(entry.copilot);
    });
    
    setPilotsList(Array.from(pilots).sort());
  }, [entries]);
  
  // Synchroniser showForm avec showFormProp quand il change (sauf en édition)
  useEffect(() => {
    // Ne pas synchroniser si on est en train d'éditer
    if (!editingEntry && showFormProp !== undefined) {
      setShowForm(showFormProp);
    }
  }, [showFormProp, editingEntry]);

  // Valider l'ordre des heures (mise en route avant décollage, atterrissage avant arrêt moteur)
  useEffect(() => {
    const warnings = [];

    if (formData.blockOff && formData.takeOff) {
      const blockOffTime = new Date(`1970-01-01T${formData.blockOff}`);
      const takeOffTime = new Date(`1970-01-01T${formData.takeOff}`);
      if (blockOffTime > takeOffTime) {
        warnings.push('La mise en route ne peut pas être après le décollage');
      }
    }

    if (formData.takeOff && formData.landing) {
      const takeOffTime = new Date(`1970-01-01T${formData.takeOff}`);
      const landingTime = new Date(`1970-01-01T${formData.landing}`);
      if (takeOffTime > landingTime) {
        warnings.push('Le décollage ne peut pas être après l\'atterrissage');
      }
    }

    if (formData.landing && formData.blockOn) {
      const landingTime = new Date(`1970-01-01T${formData.landing}`);
      const blockOnTime = new Date(`1970-01-01T${formData.blockOn}`);
      if (landingTime > blockOnTime) {
        warnings.push('L\'atterrissage ne peut pas être après l\'arrêt moteur');
      }
    }

    if (warnings.length > 0) {
      setTimeOrderValidation({ valid: false, message: warnings.join(' | ') });
    } else {
      setTimeOrderValidation({ valid: true, message: '' });
    }
  }, [formData.blockOff, formData.takeOff, formData.landing, formData.blockOn]);

  // Calculer automatiquement le temps total et les heures selon le type de vol
  useEffect(() => {
    if (formData.blockOff && formData.blockOn) {
      const off = new Date(`1970-01-01T${formData.blockOff}`);
      const on = new Date(`1970-01-01T${formData.blockOn}`);
      const diff = (on - off) / (1000 * 60 * 60); // en heures

      if (diff > 0) {
        const totalTimeDecimal = parseFloat(diff.toFixed(1));
        const updates = {
          totalTime: decimalToHHMM(totalTimeDecimal) // Convertir en format HH:MM
        };

        // Calculer automatiquement les heures selon le type de vol (sauf en mode mixte)
        if (formData.flightType && formData.flightType !== 'mixed') {
          switch(formData.flightType) {
            case 'vfr-day':
              updates.vfrTime = totalTimeDecimal;
              updates.nightTime = 0;
              updates.ifrTime = 0;
              updates.simulatorTime = 0;
              updates.mixedFlightMode = false;
              break;
            case 'vfr-night':
              updates.vfrTime = totalTimeDecimal;
              updates.nightTime = totalTimeDecimal;
              updates.ifrTime = 0;
              updates.simulatorTime = 0;
              updates.mixedFlightMode = false;
              break;
            case 'ifr-day':
              updates.vfrTime = 0;
              updates.nightTime = 0;
              updates.ifrTime = totalTimeDecimal;
              updates.simulatorTime = 0;
              updates.mixedFlightMode = false;
              break;
            case 'ifr-night':
              updates.vfrTime = 0;
              updates.nightTime = totalTimeDecimal;
              updates.ifrTime = totalTimeDecimal;
              updates.simulatorTime = 0;
              updates.mixedFlightMode = false;
              break;
            case 'simulator':
              updates.vfrTime = 0;
              updates.nightTime = 0;
              updates.ifrTime = 0;
              updates.simulatorTime = totalTimeDecimal;
              updates.totalTime = '0:00'; // Le simulateur ne compte pas dans le temps total
              updates.mixedFlightMode = false;
              break;
          }
        } else if (formData.flightType === 'mixed') {
          updates.mixedFlightMode = true;
        }

        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
    }
  }, [formData.blockOff, formData.blockOn, formData.flightType]);

  // Valider la somme des temps en mode mixte
  useEffect(() => {
    if (formData.mixedFlightMode && formData.totalTime) {
      const total = HHMMToDecimal(formData.totalTime) || 0;
      const vfr = parseFloat(formData.vfrTime) || 0;
      const ifr = parseFloat(formData.ifrTime) || 0;
      const simulator = parseFloat(formData.simulatorTime) || 0;
      const dual = parseFloat(formData.dualReceived) || 0;
      const instruction = parseFloat(formData.dualGiven) || 0;

      // La somme VFR + IFR ne doit pas dépasser le temps total
      const flightSum = vfr + ifr;

      if (flightSum > total && !simulator) {
        setTimeValidation({
          valid: false,
          message: `Attention: La somme VFR (${vfr}h) + IFR (${ifr}h) = ${flightSum.toFixed(1)}h dépasse le temps total de ${total}h`
        });
      } else if (dual > total) {
        setTimeValidation({
          valid: false,
          message: `Le temps en double commande (${dual}h) ne peut pas dépasser le temps total (${total}h)`
        });
      } else if (instruction > total) {
        setTimeValidation({
          valid: false,
          message: `Le temps d'instruction donnée (${instruction}h) ne peut pas dépasser le temps total (${total}h)`
        });
      } else {
        setTimeValidation({ valid: true, message: '' });
      }
    } else {
      setTimeValidation({ valid: true, message: '' });
    }
  }, [formData.vfrTime, formData.ifrTime, formData.simulatorTime, formData.dualReceived,
      formData.dualGiven, formData.totalTime, formData.mixedFlightMode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Si on sélectionne un avion, récupérer ses infos et mettre à jour le type et le groupe
    if (field === 'aircraft') {
      // Si la valeur est vide (Sélectionner un avion...)
      if (!value) {
        setSelectedAircraftData(null);
        setFormData(prev => ({
          ...prev,
          aircraft: '',
          aircraftType: '',
          aircraftGroup: ''
        }));
        return;
      }
      
      // Si c'est "Autre avion"
      if (value === 'OTHER') {
        setSelectedAircraftData(null);
        setFormData(prev => ({
          ...prev,
          aircraft: 'OTHER',
          aircraftType: '',
          aircraftGroup: ''
        }));
        return;
      }
      
      // Si c'est un avion de la liste
      if (value && value !== 'OTHER') {
      const aircraft = aircraftList.find(a => a.registration === value);
      if (aircraft) {
        setSelectedAircraftData(aircraft);
        // Mettre à jour automatiquement le type et le groupe d'avion
        const updates = {
          aircraft: value,
          aircraftType: aircraft.model || aircraft.type || ''
        };
        
        // Utiliser directement engineType s'il est défini dans les données de l'avion
        if (aircraft.engineType) {
          updates.aircraftGroup = aircraft.engineType;
        } else {
          // Fallback sur la détection automatique si engineType n'est pas défini
          // D'abord vérifier engineCount s'il existe
          if (aircraft.engineCount === 1) {
            updates.aircraftGroup = 'singleEngine';
          } else if (aircraft.engineCount === 2) {
            updates.aircraftGroup = 'multiEngine';
          }
          
          // Ensuite, détecter le type de moteur basé sur le modèle et le carburant
          const modelUpper = (aircraft.model || '').toUpperCase();
          const fuelType = (aircraft.fuelType || '').toUpperCase();
          
          // Détection des turbopropulseurs
          if (modelUpper.includes('TBM') || 
              modelUpper.includes('PC-12') || 
              modelUpper.includes('KING AIR') ||
              modelUpper.includes('CARAVAN') ||
              modelUpper.includes('PILATUS') ||
              fuelType.includes('JET')) {
            // Si c'est un turboprop monomoteur ou multimoteur
            if (!aircraft.engineCount || aircraft.engineCount === 1) {
              updates.aircraftGroup = 'turboprop';
            } else if (aircraft.engineCount > 1) {
              updates.aircraftGroup = 'turboprop'; // Turboprop multimoteur reste turboprop
            }
          }
          
          // Détection des jets
          if (modelUpper.includes('CITATION') || 
              modelUpper.includes('MUSTANG') ||
              modelUpper.includes('JET') ||
              modelUpper.includes('FALCON') ||
              modelUpper.includes('GULFSTREAM')) {
            updates.aircraftGroup = 'jet';
          }
          
          // Pour DA40NG spécifiquement (diesel monomoteur)
          if (modelUpper.includes('DA40NG') || modelUpper.includes('DA42')) {
            if (modelUpper.includes('DA40')) {
              updates.aircraftGroup = 'singleEngine'; // DA40NG est monomoteur diesel
            } else if (modelUpper.includes('DA42')) {
              updates.aircraftGroup = 'multiEngine'; // DA42 est bimoteur diesel
            }
          }
          
          // Si on n'a pas pu déterminer et qu'on a le type de carburant
          if (!updates.aircraftGroup && fuelType) {
            if (fuelType.includes('AVGAS') || fuelType.includes('100LL')) {
              // Probablement un avion à pistons
              updates.aircraftGroup = aircraft.engineCount === 2 ? 'multiEngine' : 'singleEngine';
            }
          }
          
          // Valeur par défaut si rien n'a été détecté
          if (!updates.aircraftGroup) {
            updates.aircraftGroup = 'singleEngine';
          }
        }
        
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
      }
    }
  };

  const handleSubmit = () => {
    // Si "Autre avion" est sélectionné, utiliser la valeur personnalisée
    const finalAircraft = formData.aircraft === 'OTHER' ? formData.aircraftCustom : formData.aircraft;

    const entry = {
      ...formData,
      aircraft: finalAircraft,
      // Sauvegarder les segments de vol avec l'entrée
      flightSegments: flightSegments.filter(seg => seg.time && seg.time !== '0'), // Ne garder que les segments avec du temps
      id: editingEntry ? editingEntry.id : Date.now(),
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    delete entry.aircraftCustom; // Ne pas stocker le champ temporaire

    let newEntries;
    if (editingEntry) {
      newEntries = entries.map(e => e.id === editingEntry.id ? entry : e);
    } else {
      newEntries = [...entries, entry];
    }

    // Trier par date
    newEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    setEntries(newEntries);
    localStorage.setItem('pilotLogbook', JSON.stringify(newEntries));

    resetForm();

    // Mettre à jour l'expérience du pilote automatiquement
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    if (profile.firstName) {
      // Déclencher une mise à jour du profil
      window.dispatchEvent(new Event('logbook-updated'));
    }

    // Logger vers Google Sheets
    const action = editingEntry ? 'Modification vol' : 'Ajout vol';
    const details = `${formData.date} - ${formData.departure} → ${formData.arrival} (${finalAircraft})`;
    logToGoogleSheets(action, details);

    alert(editingEntry ? 'Entrée modifiée avec succès !' : 'Vol enregistré dans le carnet !');

    // Retourner à la page d'accueil après l'enregistrement
    if (!editingEntry) {
      // Déclencher un événement pour naviguer vers l'accueil
      window.dispatchEvent(new CustomEvent('navigate-to-home'));
    }
  };

  const resetForm = () => {
    // Réinitialiser les segments de vol
    setFlightSegments([
      {
        id: 1,
        time: '',
        flightType: '',
        functionOnBoard: '',
        pilotInCommand: ''
      }
    ]);

    setFormData({
      // Section 1: Date et Lieu
      date: new Date().toISOString().split('T')[0],
      departure: '',
      arrival: '',
      route: '',
      
      // Section 2: Avion
      aircraft: '',
      aircraftType: '',
      aircraftGroup: 'singleEngine',
      
      // Section 3: Équipage
      pilotInCommand: '',
      copilot: '',
      
      // Section 4: Heures de vol
      blockOff: '',
      takeOff: '',
      landing: '',
      blockOn: '',
      totalTime: '',
      nightTime: 0,
      ifrTime: 0,
      
      // Section 5: Fonction à bord
      functionOnBoard: 'pic',
      
      // Section 6: Décollages et Atterrissages
      dayTakeoffs: 0,
      nightTakeoffs: 0,
      dayLandings: 0,
      nightLandings: 0,
      
      // Section 7: Temps de vol par condition
      vfrTime: 0,
      actualIMC: 0,
      simulatedIMC: 0,
      crossCountryTime: 0,
      
      // Section 8: Approches aux instruments
      ilsApproaches: 0,
      vorApproaches: 0,
      ndbApproaches: 0,
      gpsApproaches: 0,
      
      // Section 9: Formation et Contrôles
      dualReceived: 0,
      dualGiven: 0,
      examinerTime: 0,
      
      // Section 10: Observations
      simulatorTime: 0,
      remarks: '',
      
      aircraftCustom: ''
    });
    setEditingEntry(null);
    setShowForm(false);
    setSelectedAircraftData(null);
  };

  const handleEdit = (entry) => {
    console.log('🔍 === DÉBUT ÉDITION ===');
    console.log('📝 Entrée complète:', entry);
    console.log('📅 Date:', entry.date);
    console.log('✈️ Vol:', `${entry.departure} → ${entry.arrival}`);
    console.log('🛩️ Avion:', entry.aircraft);
    console.log('⏱️ Temps total:', entry.totalTime);
    console.log('📊 Segments existants:', entry.flightSegments);

    // Logger vers Google Sheets
    logToGoogleSheets('Tentative édition', `${entry.date} - ${entry.departure} → ${entry.arrival}`, {
      component: 'Carnet de vol',
      summary: 'Ouverture formulaire édition',
      files: 'PilotLogbook.jsx'
    });

    setFormData(entry);
    setEditingEntry(entry);
    setShowForm(true);

    console.log('📌 État formulaire:', { showForm: true, editingEntry: entry });

    // Charger les segments de vol s'ils existent
    if (entry.flightSegments && Array.isArray(entry.flightSegments) && entry.flightSegments.length > 0) {
      console.log('✅ Chargement des segments existants:', entry.flightSegments);
      setFlightSegments(entry.flightSegments);
    } else {
      console.log('⚠️ Pas de segments - création d\'un segment par défaut');
      const defaultSegment = {
        id: 1,
        time: entry.totalTime ? (entry.totalTime.includes(':') ? HHMMToDecimal(entry.totalTime).toString() : entry.totalTime) : '',
        flightType: entry.flightType || '',
        functionOnBoard: entry.functionOnBoard || '',
        pilotInCommand: entry.pilotInCommand || ''
      };
      console.log('📝 Segment créé:', defaultSegment);
      // Si pas de segments, créer un segment par défaut avec les données existantes
      setFlightSegments([defaultSegment]);
    }

    // Vérifier si l'avion existe dans la liste
    const aircraft = aircraftList.find(a => a.registration === entry.aircraft);
    if (aircraft) {
      setSelectedAircraftData(aircraft);
      // S'assurer que le type est bien mis à jour avec les données de l'avion
      setFormData(prev => ({
        ...prev,
        aircraftType: aircraft.model || aircraft.type || entry.aircraftType || ''
      }));
    } else {
      setSelectedAircraftData(null);
    }
  };

  const handleDelete = (id) => {
    const entryToDelete = entries.find(e => e.id === id);
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      const newEntries = entries.filter(e => e.id !== id);
      setEntries(newEntries);
      localStorage.setItem('pilotLogbook', JSON.stringify(newEntries));

      // Logger vers Google Sheets
      if (entryToDelete) {
        const details = `${entryToDelete.date} - ${entryToDelete.departure} → ${entryToDelete.arrival} (${entryToDelete.aircraft})`;
        logToGoogleSheets('Suppression vol', details);
      }
    }
  };

  const handleExport = () => {
    // Obtenir la configuration des unités actuelle
    const unitsConfig = JSON.parse(localStorage.getItem('unitsConfig') || '{}');

    // Créer l'objet d'export avec métadonnées
    const exportData = {
      version: '1.1',
      exportDate: new Date().toISOString(),
      unitsConfig: unitsConfig,
      entries: entries
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `pilot-logbook-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    // Log l'export
    logToGoogleSheets('Export carnet de vol', `${entries.length} entrées exportées avec configuration des unités`);
  };

  // Fonctions de conversion d'unités
  const convertValue = (value, fromUnit, toUnit, type) => {
    if (!value || isNaN(value)) return value;
    const numValue = parseFloat(value);

    // Conversions de distance
    if (type === 'distance') {
      if (fromUnit === 'nm' && toUnit === 'km') return Math.round(numValue * 1.852 * 100) / 100;
      if (fromUnit === 'km' && toUnit === 'nm') return Math.round(numValue / 1.852 * 100) / 100;
      if (fromUnit === 'nm' && toUnit === 'mi') return Math.round(numValue * 1.15078 * 100) / 100;
      if (fromUnit === 'mi' && toUnit === 'nm') return Math.round(numValue / 1.15078 * 100) / 100;
      if (fromUnit === 'km' && toUnit === 'mi') return Math.round(numValue * 0.621371 * 100) / 100;
      if (fromUnit === 'mi' && toUnit === 'km') return Math.round(numValue / 0.621371 * 100) / 100;
    }

    // Conversions d'altitude
    if (type === 'altitude') {
      if (fromUnit === 'ft' && toUnit === 'm') return Math.round(numValue * 0.3048 * 100) / 100;
      if (fromUnit === 'm' && toUnit === 'ft') return Math.round(numValue / 0.3048 * 100) / 100;
    }

    // Conversions de vitesse
    if (type === 'speed') {
      if (fromUnit === 'kt' && toUnit === 'km/h') return Math.round(numValue * 1.852 * 100) / 100;
      if (fromUnit === 'km/h' && toUnit === 'kt') return Math.round(numValue / 1.852 * 100) / 100;
      if (fromUnit === 'kt' && toUnit === 'mph') return Math.round(numValue * 1.15078 * 100) / 100;
      if (fromUnit === 'mph' && toUnit === 'kt') return Math.round(numValue / 1.15078 * 100) / 100;
      if (fromUnit === 'km/h' && toUnit === 'mph') return Math.round(numValue * 0.621371 * 100) / 100;
      if (fromUnit === 'mph' && toUnit === 'km/h') return Math.round(numValue / 0.621371 * 100) / 100;
    }

    // Conversions de poids
    if (type === 'weight') {
      if (fromUnit === 'kg' && toUnit === 'lbs') return Math.round(numValue * 2.20462 * 100) / 100;
      if (fromUnit === 'lbs' && toUnit === 'kg') return Math.round(numValue / 2.20462 * 100) / 100;
    }

    // Conversions de carburant
    if (type === 'fuel') {
      if (fromUnit === 'ltr' && toUnit === 'gal') return Math.round(numValue * 0.264172 * 100) / 100;
      if (fromUnit === 'gal' && toUnit === 'ltr') return Math.round(numValue / 0.264172 * 100) / 100;
      if (fromUnit === 'ltr' && toUnit === 'kg') return Math.round(numValue * 0.72 * 100) / 100; // Densité AVGAS
      if (fromUnit === 'kg' && toUnit === 'ltr') return Math.round(numValue / 0.72 * 100) / 100;
      if (fromUnit === 'ltr' && toUnit === 'lbs') return Math.round(numValue * 0.72 * 2.20462 * 100) / 100;
      if (fromUnit === 'lbs' && toUnit === 'ltr') return Math.round(numValue / (0.72 * 2.20462) * 100) / 100;
    }

    // Conversions de consommation
    if (type === 'fuelConsumption') {
      if (fromUnit === 'lph' && toUnit === 'gph') return Math.round(numValue * 0.264172 * 100) / 100;
      if (fromUnit === 'gph' && toUnit === 'lph') return Math.round(numValue / 0.264172 * 100) / 100;
    }

    return value; // Retourner la valeur originale si pas de conversion
  };

  // Convertir une entrée du carnet de vol selon la configuration des unités
  const convertLogbookEntry = (entry, fromUnits, toUnits) => {
    const convertedEntry = { ...entry };

    // Mapping des champs qui peuvent contenir des valeurs d'unités
    const fieldMappings = {
      // Distances (si on ajoute des champs de distance dans le futur)
      distanceTotal: 'distance',
      crossCountryDistance: 'distance',

      // Altitudes (si on ajoute des champs d'altitude dans le futur)
      cruiseAltitude: 'altitude',
      maxAltitude: 'altitude',

      // Vitesses (si on ajoute des champs de vitesse dans le futur)
      cruiseSpeed: 'speed',
      maxSpeed: 'speed',

      // Carburant (si on ajoute des champs de carburant dans le futur)
      fuelUsed: 'fuel',
      fuelRemaining: 'fuel',
      fuelConsumption: 'fuelConsumption',

      // Poids (si on ajoute des champs de poids dans le futur)
      takeoffWeight: 'weight',
      landingWeight: 'weight'
    };

    // Convertir chaque champ selon sa mappingt de type
    Object.entries(fieldMappings).forEach(([fieldName, unitType]) => {
      if (convertedEntry[fieldName] !== undefined && convertedEntry[fieldName] !== '') {
        const fromUnit = fromUnits[unitType];
        const toUnit = toUnits[unitType];

        if (fromUnit && toUnit && fromUnit !== toUnit) {
          convertedEntry[fieldName] = convertValue(convertedEntry[fieldName], fromUnit, toUnit, unitType);
        }
      }
    });

    return convertedEntry;
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      // Obtenir la configuration des unités actuelle
      const currentUnits = JSON.parse(localStorage.getItem('unitsConfig') || '{}');

      // Déterminer s'il s'agit d'un nouveau format avec métadonnées ou ancien format simple
      let entries_to_import;
      let sourceUnits = currentUnits; // Par défaut, assumer les mêmes unités
      let needsConversion = false;

      if (importedData.version && importedData.entries) {
        // Nouveau format avec métadonnées
        entries_to_import = importedData.entries;
        sourceUnits = importedData.unitsConfig || {};
        needsConversion = JSON.stringify(sourceUnits) !== JSON.stringify(currentUnits);

        console.log('Import avec métadonnées détecté:');
        console.log('- Unités source:', sourceUnits);
        console.log('- Unités actuelles:', currentUnits);
        console.log('- Conversion nécessaire:', needsConversion);
      } else if (Array.isArray(importedData)) {
        // Ancien format simple (tableau d'entrées)
        entries_to_import = importedData;
        console.log('Import ancien format détecté (aucune conversion)');
      } else {
        alert('Format de fichier invalide. Le fichier doit contenir un tableau d\'entrées ou un objet avec métadonnées.');
        return;
      }

      // Validation basique des entrées
      const validEntries = entries_to_import.filter(entry =>
        entry.date && (entry.departure || entry.arrival)
      );

      if (validEntries.length === 0) {
        alert('Aucune entrée valide trouvée dans le fichier.');
        return;
      }

      // Convertir les unités si nécessaire
      let processedEntries = validEntries;
      if (needsConversion) {
        processedEntries = validEntries.map(entry =>
          convertLogbookEntry(entry, sourceUnits, currentUnits)
        );
        console.log(`Conversion appliquée à ${processedEntries.length} entrées`);
      }

      // Fusionner avec les entrées existantes (éviter les doublons basés sur date + départ + arrivée)
      const existingKeys = new Set(
        entries.map(e => `${e.date}_${e.departure}_${e.arrival}`)
      );

      const newEntries = processedEntries.filter(entry => {
        const key = `${entry.date}_${entry.departure}_${entry.arrival}`;
        return !existingKeys.has(key);
      });

      const mergedEntries = [...entries, ...newEntries].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );

      // Sauvegarder
      setEntries(mergedEntries);
      localStorage.setItem('pilotLogbook', JSON.stringify(mergedEntries));

      // Log l'import
      const logMessage = needsConversion
        ? `${newEntries.length} nouvelles entrées importées avec conversion d'unités (${validEntries.length - newEntries.length} doublons ignorés)`
        : `${newEntries.length} nouvelles entrées importées (${validEntries.length - newEntries.length} doublons ignorés)`;

      logToGoogleSheets('Import carnet de vol', logMessage);

      const alertMessage = needsConversion
        ? `Import réussi avec conversion d'unités ! ${newEntries.length} nouvelles entrées ajoutées.`
        : `Import réussi ! ${newEntries.length} nouvelles entrées ajoutées.`;

      alert(alertMessage);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de l\'import du fichier. Vérifiez que le fichier est au format JSON valide.');
    }

    // Réinitialiser l'input pour permettre de réimporter le même fichier
    event.target.value = '';
  };

  // Calculer les totaux selon les sections du carnet français
  const calculateTotals = () => {
    const totals = {
      // Heures totales
      totalHours: 0,

      // Par fonction
      picHours: 0,
      copilotHours: 0,
      dualCommandHours: 0,
      instructorHours: 0,

      // Par type d'avion
      singleEngineHours: 0,
      multiEngineHours: 0,
      turbopropHours: 0,
      jetHours: 0,

      // Par conditions
      nightHours: 0,
      ifrHours: 0,
      vfrHours: 0,
      actualIMCHours: 0,
      crossCountryHours: 0,

      // Formation
      dualReceivedHours: 0,
      dualGivenHours: 0,

      // Décollages et atterrissages
      dayTakeoffs: 0,
      nightTakeoffs: 0,
      dayLandings: 0,
      nightLandings: 0,

      // Approches
      approaches: 0,
      ilsApproaches: 0,
      vorApproaches: 0,
      ndbApproaches: 0,
      gpsApproaches: 0
    };

    entries.forEach(entry => {
      // Gérer à la fois les anciens formats décimaux et les nouveaux formats HH:MM
      const time = entry.totalTime && entry.totalTime.includes(':')
        ? HHMMToDecimal(entry.totalTime)
        : parseFloat(entry.totalTime) || 0;
      totals.totalHours += time;

      // Si l'entrée a des segments de vol, les utiliser pour calculer les heures par fonction
      if (entry.flightSegments && Array.isArray(entry.flightSegments) && entry.flightSegments.length > 0) {
        entry.flightSegments.forEach(segment => {
          const segmentTime = parseFloat(segment.time) || 0;

          // Par fonction basé sur les segments
          if (segment.functionOnBoard === 'pic') totals.picHours += segmentTime;
          if (segment.functionOnBoard === 'copilot') totals.copilotHours += segmentTime;
          if (segment.functionOnBoard === 'dualCommand') totals.dualCommandHours += segmentTime;
          if (segment.functionOnBoard === 'instructor' || segment.functionOnBoard === 'fi-cri') totals.instructorHours += segmentTime;

          // Par conditions basé sur le type de vol
          if (segment.flightType === 'vfr-night' || segment.flightType === 'ifr-night') {
            totals.nightHours += segmentTime;
          }
          if (segment.flightType === 'ifr-day' || segment.flightType === 'ifr-night') {
            totals.ifrHours += segmentTime;
          }
          if (segment.flightType === 'vfr-day' || segment.flightType === 'vfr-night') {
            totals.vfrHours += segmentTime;
          }
        });
      } else {
        // Compatibilité avec l'ancien format (pas de segments)
        if (entry.functionOnBoard === 'pic' || entry.pic) totals.picHours += time;
        if (entry.functionOnBoard === 'copilot' || entry.copilot) totals.copilotHours += time;
        if (entry.functionOnBoard === 'dualCommand' || entry.dualCommand) totals.dualCommandHours += time;
        if (entry.functionOnBoard === 'instructor' || entry.instructor) totals.instructorHours += time;
      }

      // Par type d'avion
      if (entry.aircraftGroup === 'singleEngine' || entry.singleEngine) totals.singleEngineHours += time;
      if (entry.aircraftGroup === 'multiEngine' || entry.multiEngine) totals.multiEngineHours += time;
      if (entry.aircraftGroup === 'turboprop' || entry.turboprop) totals.turbopropHours += time;
      if (entry.aircraftGroup === 'jet' || entry.jet) totals.jetHours += time;
      
      // Par conditions
      totals.nightHours += parseFloat(entry.nightTime) || 0;
      totals.ifrHours += parseFloat(entry.ifrTime) || 0;
      totals.vfrHours += parseFloat(entry.vfrTime) || 0;
      totals.actualIMCHours += parseFloat(entry.actualIMC) || 0;
      totals.crossCountryHours += parseFloat(entry.crossCountryTime) || 0;
      
      // Formation
      totals.dualReceivedHours += parseFloat(entry.dualReceived) || 0;
      totals.dualGivenHours += parseFloat(entry.dualGiven) || 0;
      
      // Décollages et atterrissages
      totals.dayTakeoffs += parseInt(entry.dayTakeoffs) || 0;
      totals.nightTakeoffs += parseInt(entry.nightTakeoffs) || 0;
      totals.dayLandings += parseInt(entry.dayLandings) || 0;
      totals.nightLandings += parseInt(entry.nightLandings) || 0;
      
      // Approches
      const ils = parseInt(entry.ilsApproaches) || 0;
      const vor = parseInt(entry.vorApproaches) || 0;
      const ndb = parseInt(entry.ndbApproaches) || 0;
      const gps = parseInt(entry.gpsApproaches) || 0;
      
      totals.ilsApproaches += ils;
      totals.vorApproaches += vor;
      totals.ndbApproaches += ndb;
      totals.gpsApproaches += gps;
      totals.approaches += ils + vor + ndb + gps;
    });

    return totals;
  };

  const totals = calculateTotals();

  // Filtrer les entrées
  const filteredEntries = entries.filter(entry => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!entry.aircraft?.toLowerCase().includes(search) &&
          !entry.departure?.toLowerCase().includes(search) &&
          !entry.arrival?.toLowerCase().includes(search) &&
          !entry.pilotInCommand?.toLowerCase().includes(search) &&
          !entry.copilot?.toLowerCase().includes(search) &&
          !entry.remarks?.toLowerCase().includes(search)) {
        return false;
      }
    }

    if (filter === 'pic' && !(entry.functionOnBoard === 'pic' || entry.pic)) return false;
    if (filter === 'night' && !entry.nightTime) return false;
    if (filter === 'ifr' && !entry.ifrTime) return false;
    if (filter === 'crossCountry' && !(entry.crossCountryTime > 0 || entry.crossCountry)) return false;
    if (filter === 'training' && !(entry.dualReceived > 0 || entry.dualGiven > 0)) return false;

    return true;
  });

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

  return (
    <div>
      {/* Input file caché pour l'import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Statistiques globales - Afficher seulement si on n'est pas dans le formulaire */}
      {!isFormVisible && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Statistiques de vol</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleImport}
                style={{ padding: '8px 16px', backgroundColor: '#93163C', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={16} />
                Importer
              </button>
              {entries.length > 0 && (
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
          
          {/* Statistiques fusionnées */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            {/* Total général - Plus important */}
            <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '12px' }}>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Total général</p>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'black' }}>{totals.totalHours.toFixed(1)}h</p>
            </div>

            {/* Fonction à bord */}
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>CDB</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.picHours.toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Copilote</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.copilotHours.toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Double commande</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.dualCommandHours.toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Instructeur</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.instructorHours.toFixed(1)}h</p>
            </div>

            {/* Conditions de vol */}
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Jour</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{(totals.totalHours - totals.nightHours).toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Nuit</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.nightHours.toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>IFR</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.ifrHours.toFixed(1)}h</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Voyage</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.crossCountryHours.toFixed(1)}h</p>
            </div>

            {/* Atterrissages et approches */}
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Att. jour</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.dayLandings}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Att. nuit</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.nightLandings}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Approches</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{totals.approaches}</p>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire d'ajout/édition */}
      {isFormVisible && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
          {/* Disclaimer dans le formulaire */}
          <div style={{ 
            backgroundColor: '#fef3c7', 
            border: '1px solid #fbbf24', 
            borderRadius: '6px', 
            padding: '10px 12px', 
            marginBottom: '20px',
            fontSize: '12px',
            color: '#92400e'
          }}>
            <strong>Rappel :</strong> Ces informations ne remplacent pas votre carnet de vol officiel qui doit être tenu à jour conformément à la réglementation en vigueur.
          </div>

          {/* Section 1: Date */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>1. DATE</span>
            </div>
            <div style={{ width: '250px' }}>
              <label style={labelStyle}>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* Section 2: Départ */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>2. DÉPART</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Aérodrome de départ *</label>
                <input
                  type="text"
                  value={formData.departure}
                  onChange={(e) => handleChange('departure', e.target.value)}
                  placeholder="LFXX"
                  style={inputStyle}
                  required
                />
              </div>
              
              <div>
                <label style={labelStyle}>Mise en route (Block Off)</label>
                <input
                  type="time"
                  value={formData.blockOff}
                  onChange={(e) => handleChange('blockOff', e.target.value)}
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Heure de décollage</label>
                <input
                  type="time"
                  value={formData.takeOff}
                  onChange={(e) => handleChange('takeOff', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Arrivée */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>3. ARRIVÉE</span>
            </div>
            
            {/* Arrivée et heures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Aérodrome d'arrivée *</label>
                <input
                  type="text"
                  value={formData.arrival}
                  onChange={(e) => handleChange('arrival', e.target.value)}
                  placeholder="LFXX"
                  style={inputStyle}
                  required
                />
              </div>
              
              <div>
                <label style={labelStyle}>Heure d'atterrissage</label>
                <input
                  type="time"
                  value={formData.landing}
                  onChange={(e) => handleChange('landing', e.target.value)}
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Arrêt moteur (Block On)</label>
                <input
                  type="time"
                  value={formData.blockOn}
                  onChange={(e) => handleChange('blockOn', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Afficher l'avertissement de validation de l'ordre des heures */}
            {!timeOrderValidation.valid && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '8px 12px',
                marginTop: '12px',
                color: '#dc2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                ⚠️ {timeOrderValidation.message}
              </div>
            )}

          </div>

          {/* Section 3 BIS: SEGMENTS DE VOL - Nouvelle section combinée */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'rgb(0, 0, 0)',
              backgroundColor: 'transparent',
              marginBottom: '12px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '4px'
            }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>3 BIS. SEGMENTS DE VOL</span>
            </div>

            {/* Temps total calculé avec bouton Vol uniforme */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Temps total de vol (heures) *</label>
              <input
                type="text"
                value={formData.totalTime}
                onChange={(e) => {
                  const value = e.target.value;
                  // Permettre la saisie du format HH:MM
                  if (value === '' || value.match(/^\d{0,3}:?\d{0,2}$/)) {
                    handleChange('totalTime', value);
                  }
                }}
                onBlur={(e) => {
                  // Formater lors de la perte de focus
                  if (e.target.value && !e.target.value.includes(':')) {
                    // Si c'est un nombre décimal, convertir en HH:MM
                    const decimal = parseFloat(e.target.value) || 0;
                    handleChange('totalTime', decimalToHHMM(decimal));
                  }
                }}
                placeholder="1:30"
                style={{...inputStyle, backgroundColor: '#fef3c7', fontWeight: 'bold', maxWidth: '200px'}}
                pattern="\d{1,3}:\d{2}"
                title="Format: HH:MM (ex: 1:30)"
                required
              />
                {formData.blockOff && formData.blockOn && (
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    <div>
                      Bloc à bloc : {decimalToHHMM((new Date(`1970-01-01T${formData.blockOn}`) - new Date(`1970-01-01T${formData.blockOff}`)) / (1000 * 60 * 60))}
                    </div>
                    {formData.takeOff && formData.landing && (
                      <div>
                        Vol effectif : {decimalToHHMM((new Date(`1970-01-01T${formData.landing}`) - new Date(`1970-01-01T${formData.takeOff}`)) / (1000 * 60 * 60))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (formData.totalTime) {
                    const totalDecimal = HHMMToDecimal(formData.totalTime);

                    // Récupérer le nom du pilote avec la même logique améliorée
                    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
                    const personalInfo = JSON.parse(localStorage.getItem('personalInfo') || '{}');
                    let pilotName = '';

                    // Si la fonction est CDB, récupérer automatiquement le nom du pilote
                    if (formData.functionOnBoard === 'pic') {
                      // Chercher dans différentes structures possibles
                      if (profile.personalInfo?.firstName && profile.personalInfo?.lastName) {
                        pilotName = `${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`;
                      } else if (profile.firstName && profile.lastName) {
                        pilotName = `${profile.firstName} ${profile.lastName}`;
                      } else if (personalInfo.firstName && personalInfo.lastName) {
                        pilotName = `${personalInfo.firstName} ${personalInfo.lastName}`;
                      } else if (profile.personalInfo?.name) {
                        pilotName = profile.personalInfo.name;
                      } else if (profile.name) {
                        pilotName = profile.name;
                      } else if (personalInfo.name) {
                        pilotName = personalInfo.name;
                      }

                      if (pilotName) {
                        pilotName = pilotName.toUpperCase();
                      }
                    }

                    setFlightSegments([{
                      id: 1,
                      time: totalDecimal.toString(),
                      flightType: formData.flightType || '',
                      functionOnBoard: formData.functionOnBoard || '',
                      pilotInCommand: pilotName || formData.pilotInCommand || ''
                    }]);
                    setUseUniformFlight(true);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  height: 'fit-content'
                }}
              >
                🔄 Vol uniforme
              </button>
            </div>

            {/* Segments de vol */}
            {flightSegments.map((segment, index) => (
              <div key={segment.id} style={{
                padding: '12px',
                backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff',
                borderRadius: '6px',
                marginBottom: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 2fr 80px', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{...labelStyle, fontSize: '11px'}}>Temps</label>
                    <input
                      type="text"
                      value={segment.rawTime !== undefined ? segment.rawTime : (segment.time ? decimalToHHMM(parseFloat(segment.time)) : '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permettre la saisie du format HH:MM ou HHMM (jusqu'à 4 chiffres)
                        if (value === '' || value.match(/^\d{0,4}$/) || value.match(/^\d{1,2}:\d{0,2}$/)) {
                          const newSegments = [...flightSegments];
                          // Stocker temporairement la valeur brute pour la saisie
                          newSegments[index].rawTime = value;
                          setFlightSegments(newSegments);
                        }
                      }}
                      onBlur={(e) => {
                        // Convertir en décimal lors de la perte de focus
                        let value = e.target.value;

                        if (!value) {
                          // Si vide, laisser vide
                          const newSegments = [...flightSegments];
                          newSegments[index].time = '';
                          delete newSegments[index].rawTime;
                          setFlightSegments(newSegments);
                          return;
                        }

                        // Formater automatiquement en HH:MM
                        if (value && !value.includes(':')) {
                          // Si c'est 3 ou 4 chiffres, traiter comme HHMM
                          if (value.length === 3) {
                            // Format HMM -> H:MM
                            value = `${value[0]}:${value.slice(1)}`;
                          } else if (value.length === 4) {
                            // Format HHMM -> HH:MM
                            value = `${value.slice(0, 2)}:${value.slice(2)}`;
                          } else if (value.length <= 2) {
                            // Si 1 ou 2 chiffres, considérer comme minutes
                            const minutes = parseInt(value);
                            value = `0:${minutes.toString().padStart(2, '0')}`;
                          }
                        }

                        const decimal = HHMMToDecimal(value);
                        const newSegments = [...flightSegments];
                        newSegments[index].time = decimal.toString();
                        delete newSegments[index].rawTime;
                        setFlightSegments(newSegments);
                      }}
                      placeholder="--:--"
                      style={{
                        ...inputStyle,
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        letterSpacing: '1px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{...labelStyle, fontSize: '11px'}}>Type de vol</label>
                    <select
                      value={segment.flightType}
                      onChange={(e) => {
                        const newSegments = [...flightSegments];
                        newSegments[index].flightType = e.target.value;
                        setFlightSegments(newSegments);
                        // Mettre à jour le formData global
                        if (flightSegments.length === 1) {
                          handleChange('flightType', e.target.value);
                        }
                      }}
                      style={{...inputStyle, fontSize: '13px'}}
                    >
                      <option value="">Sélectionner...</option>
                      <option value="vfr-day">VFR Jour</option>
                      <option value="vfr-night">VFR Nuit</option>
                      <option value="ifr-day">IFR Jour</option>
                      <option value="ifr-night">IFR Nuit</option>
                      <option value="mixed">Vol Mixte</option>
                      <option value="simulator">Simulateur</option>
                    </select>
                  </div>

                  <div>
                    <label style={{...labelStyle, fontSize: '11px'}}>Fonction</label>
                    <select
                      value={segment.functionOnBoard}
                      onChange={(e) => {
                        const newSegments = [...flightSegments];
                        newSegments[index].functionOnBoard = e.target.value;

                        // Si CDB est sélectionné, auto-remplir avec le nom du profil
                        if (e.target.value === 'pic') {
                          // Essayer plusieurs emplacements possibles dans localStorage
                          const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
                          const personalInfo = JSON.parse(localStorage.getItem('personalInfo') || '{}');

                          let pilotName = '';

                          // Chercher dans différentes structures possibles
                          if (profile.personalInfo?.firstName && profile.personalInfo?.lastName) {
                            pilotName = `${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`;
                          } else if (profile.firstName && profile.lastName) {
                            pilotName = `${profile.firstName} ${profile.lastName}`;
                          } else if (personalInfo.firstName && personalInfo.lastName) {
                            pilotName = `${personalInfo.firstName} ${personalInfo.lastName}`;
                          } else if (profile.personalInfo?.name) {
                            pilotName = profile.personalInfo.name;
                          } else if (profile.name) {
                            pilotName = profile.name;
                          } else if (personalInfo.name) {
                            pilotName = personalInfo.name;
                          }

                          // Mettre en majuscules et assigner
                          if (pilotName) {
                            newSegments[index].pilotInCommand = pilotName.toUpperCase();
                          }
                        } else {
                          // Optionnel : vider le champ nom CDB si ce n'est pas CDB
                          // newSegments[index].pilotInCommand = '';
                        }

                        setFlightSegments(newSegments);
                        // Mettre à jour le formData global
                        if (flightSegments.length === 1) {
                          handleChange('functionOnBoard', e.target.value);
                          if (e.target.value === 'pic' && newSegments[index].pilotInCommand) {
                            handleChange('pilotInCommand', newSegments[index].pilotInCommand);
                          }
                        }
                      }}
                      style={{...inputStyle, fontSize: '13px'}}
                    >
                      <option value="">Sélectionner...</option>
                      <option value="pic">CDB - Commandant</option>
                      <option value="copilot">OPL - Copilote</option>
                      <option value="dualCommand">Double commande</option>
                      <option value="student">Élève</option>
                      <option value="instructor">Instructeur (FI)</option>
                      <option value="examiner">Examinateur (FE)</option>
                      <option value="fi-cri">FI/CRI (Formateur)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{...labelStyle, fontSize: '11px'}}>Nom CDB</label>
                    <input
                      type="text"
                      value={segment.pilotInCommand}
                      onChange={(e) => {
                        const newSegments = [...flightSegments];
                        newSegments[index].pilotInCommand = e.target.value;
                        setFlightSegments(newSegments);
                        // Mettre à jour le formData global
                        if (flightSegments.length === 1) {
                          handleChange('pilotInCommand', e.target.value);
                        }
                      }}
                      placeholder="Nom du CDB"
                      style={{...inputStyle, fontSize: '13px'}}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {flightSegments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFlightSegments(flightSegments.filter(s => s.id !== segment.id));
                        }}
                        style={{
                          padding: '6px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    )}
                    {index === flightSegments.length - 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFlightSegments([...flightSegments, {
                            id: Date.now(),
                            time: '',
                            flightType: '',
                            functionOnBoard: '',
                            pilotInCommand: ''
                          }]);
                        }}
                        style={{
                          padding: '6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Récapitulatif des segments */}
            {flightSegments.length > 1 && (
              <div style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#6b7280'
              }}>
                <strong>Total segments :</strong> {
                  decimalToHHMM(flightSegments.reduce((sum, seg) => sum + parseFloat(seg.time || 0), 0))
                } sur {formData.totalTime || '0:00'}
                {flightSegments.reduce((sum, seg) => sum + parseFloat(seg.time || 0), 0) > HHMMToDecimal(formData.totalTime || '0:00') && (
                  <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                    ⚠️ Dépassement !
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Avion */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>4. AVION</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Immatriculation *</label>
                <select
                  value={formData.aircraft}
                  onChange={(e) => handleChange('aircraft', e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Sélectionner un avion...</option>
                  {aircraftList.map(aircraft => (
                    <option key={aircraft.id} value={aircraft.registration}>
                      {aircraft.registration}
                    </option>
                  ))}
                  <option value="OTHER">Autre avion</option>
                </select>
                {formData.aircraft === 'OTHER' && (
                  <input
                    type="text"
                    value={formData.aircraftCustom || ''}
                    onChange={(e) => handleChange('aircraftCustom', e.target.value)}
                    placeholder="Immatriculation..."
                    style={{...inputStyle, marginTop: '8px'}}
                  />
                )}
              </div>
              
              <div>
                <label style={labelStyle}>
                  Type <span style={{ fontSize: '10px', color: '#10b981' }}>(auto)</span>
                </label>
                <input
                  type="text"
                  value={formData.aircraftType}
                  onChange={(e) => handleChange('aircraftType', e.target.value)}
                  placeholder="C172, PA28..."
                  style={{
                    ...inputStyle,
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'not-allowed'
                  }}
                  disabled={true}
                  title='Type géré depuis le module gestion avion'
                />
              </div>
              
              <div>
                <label style={labelStyle}>
                  Groupe * <span style={{ fontSize: '10px', color: '#10b981' }}>(auto)</span>
                </label>
                <input
                  type="text"
                  value={
                    formData.aircraftGroup === 'singleEngine' ? 'Monomoteur' :
                    formData.aircraftGroup === 'multiEngine' ? 'Multimoteur' :
                    formData.aircraftGroup === 'turboprop' ? 'Turbopropulseur' :
                    formData.aircraftGroup === 'jet' ? 'Réacteur' :
                    formData.aircraftGroup === 'electric' ? 'Électrique' : ''
                  }
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    width: '100%',
                    backgroundColor: '#f3f4f6',
                    cursor: 'not-allowed',
                    color: '#6b7280'
                  }}
                  disabled={true}
                  required
                  title='Groupe géré depuis le module gestion avion'
                />
              </div>
            </div>
          </div>

          {/* Section 5: Atterrissages */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>5. ATTERRISSAGES</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Atterrissages jour</label>
                <input
                  type="number"
                  value={formData.dayLandings}
                  onChange={(e) => handleChange('dayLandings', e.target.value)}
                  min="0"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Atterrissages nuit</label>
                <input
                  type="number"
                  value={formData.nightLandings}
                  onChange={(e) => handleChange('nightLandings', e.target.value)}
                  min="0"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Approches IFR</label>
                <input
                  type="number"
                  value={formData.ifrApproaches || 0}
                  onChange={(e) => handleChange('ifrApproaches', e.target.value)}
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>


          {/* Section 6: Observations */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(0, 0, 0)', backgroundColor: 'transparent', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              <span style={{ color: 'rgb(0, 0, 0)' }}>6. OBSERVATIONS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Remarques et observations</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Conditions météo, exercices effectués, observations particulières..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              {editingEntry ? 'Modifier' : 'Enregistrer'}
            </button>
            
            {/* Afficher le bouton Annuler seulement si showFormProp n'est pas défini */}
            {showFormProp === undefined && (
              <button
                onClick={resetForm}
                style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtres et recherche - Afficher seulement si on n'est pas dans le formulaire */}
      {!isFormVisible && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                style={{...inputStyle, paddingLeft: '36px', width: '200px'}}
              />
            </div>
            
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">Tous les vols</option>
              <option value="pic">CDB uniquement</option>
              <option value="night">Vols de nuit</option>
              <option value="ifr">Vols IFR</option>
              <option value="crossCountry">Vols voyage</option>
              <option value="training">Formation</option>
            </select>
          </div>
          
          <p style={{ fontSize: '14px' }}>
            {filteredEntries.length} vol(s) trouvé(s)
          </p>
        </div>
      </div>
      )}

      {/* Liste des vols - Afficher seulement si on n'est pas dans le formulaire */}
      {!isFormVisible && filteredEntries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEntries.map(entry => (
            <div key={entry.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ marginRight: '12px' }}>{entry.date}</strong>
                  <span style={{ fontSize: '16px', marginRight: '12px' }}>
                    {entry.departure} → {entry.arrival}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>
                    {entry.aircraft} ({entry.aircraftType})
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {
                      console.log('🖱️ === CLIC BOUTON ÉDITION ===');
                      console.log('🎯 Entrée sélectionnée:', entry);
                      console.log('📋 ID:', entry.id);
                      console.log('📅 Date:', entry.date);
                      handleEdit(entry);
                    }}
                    style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {entry.totalTime}
                </span>
                
                {/* Fonction à bord */}
                {(entry.functionOnBoard === 'pic' || entry.pic) && <span style={{ color: '#3b82f6', fontWeight: '500' }}>CDB</span>}
                {(entry.functionOnBoard === 'copilot' || entry.copilot) && <span>OPL</span>}
                {(entry.functionOnBoard === 'dualCommand' || entry.dualCommand) && <span>DC</span>}
                {(entry.functionOnBoard === 'student') && <span style={{ color: '#f59e0b' }}>Élève</span>}
                {(entry.functionOnBoard === 'instructor' || entry.instructor) && <span style={{ color: '#10b981' }}>FI</span>}
                {(entry.functionOnBoard === 'examiner' || entry.examiner) && <span style={{ color: '#8b5cf6' }}>FE</span>}
                {(entry.functionOnBoard === 'fi-cri') && <span style={{ color: '#f59e0b' }}>FI/CRI</span>}
                
                {/* Conditions de vol */}
                {entry.nightTime > 0 && (
                  <span>
                    <Moon size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {entry.nightTime}h nuit
                  </span>
                )}
                
                {entry.ifrTime > 0 && (
                  <span>IFR {entry.ifrTime}h</span>
                )}
                
                {entry.vfrTime > 0 && (
                  <span>VFR {entry.vfrTime}h</span>
                )}
                
                {/* Décollages et atterrissages */}
                {(entry.dayLandings > 0 || entry.nightLandings > 0) && (
                  <span>
                    {entry.dayLandings > 0 && `${entry.dayLandings} att. jour`}
                    {entry.dayLandings > 0 && entry.nightLandings > 0 && ', '}
                    {entry.nightLandings > 0 && `${entry.nightLandings} att. nuit`}
                  </span>
                )}
                
                {/* Formation */}
                {entry.dualReceived > 0 && <span style={{ color: '#dc2626' }}>Formation {entry.dualReceived}h</span>}
                {entry.dualGiven > 0 && <span style={{ color: '#059669' }}>Instruction {entry.dualGiven}h</span>}
                
                {/* Voyage */}
                {(entry.crossCountryTime > 0 || entry.crossCountry) && <span>✈️ Voyage</span>}
              </div>
              
              {entry.remarks && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  💬 {entry.remarks}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : !isFormVisible ? (
        <div style={{ backgroundColor: 'white', textAlign: 'center', padding: '32px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <Plane size={48} style={{ margin: '0 auto 16px', color: '#9ca3af' }} />
          <p style={{ fontSize: '16px' }}>Aucun vol enregistré</p>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            Commencez à remplir votre carnet de vol
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default PilotLogbook;