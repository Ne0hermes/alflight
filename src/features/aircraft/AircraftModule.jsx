// src/features/aircraft/AircraftModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { useAircraft } from '@core/contexts';
import { useAircraftStore } from '@core/stores/aircraftStore';
import { Plus, Edit2, Trash2, Info, AlertTriangle, FileText, Eye, X, ChevronDown, ChevronUp, Wand2, FileDown, CheckCircle } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sx } from '@shared/styles/styleSystem';
import AccordionButton from '@shared/components/AccordionButton';
import { ManexImporter } from './components/ManexImporter';
import ManexViewer from './components/ManexViewer';
import AdvancedPerformanceAnalyzer from './components/AdvancedPerformanceAnalyzer';
import AircraftCreationWizard from './components/AircraftCreationWizard';
// import APIKeyTest from '../performance/components/APIKeyTest'; // Temporairement désactivé
import { useUnits } from '@hooks/useUnits';
import performanceDataManager from '../../utils/performanceDataManager';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import dataBackupManager from '@utils/dataBackupManager';
import indexedDBStorage from '@utils/indexedDBStorage';
import { formatCanonical } from '@utils/unitsDisplay';
import { useUnitsStore } from '@core/stores/unitsStore';

// Composant pour l'aide contextuelle
const InfoIcon = memo(({ tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <span 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        marginLeft: '4px',
        alignItems: 'center'
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Info
        size={14}
        style={{ cursor: 'help', color: '#9CA3AF' }}
      />
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '0',
          backgroundColor: '#1F2937',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.4',
          zIndex: 10000,
          minWidth: '180px',
          maxWidth: '280px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '12px',
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1F2937',
          }} />
        </div>
      )}
    </span>
  );
});

InfoIcon.displayName = 'InfoIcon';

export const AircraftModule = memo(() => {
  const aircraftContext = useAircraft();
  const { getSymbol, format, getUnit, convert } = useUnits();


  // Vérifier si le contexte est valide
  if (!aircraftContext) {
    console.error('❌ AircraftModule - useAircraft returned null/undefined');
    return (
      <div style={{ padding: '20px', backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: '8px' }}>
        <h3 style={{ color: '#B91C1C', marginBottom: '10px' }}>Erreur: Contexte Aircraft non disponible</h3>
        <p style={{ color: '#DC2626' }}>Vérifiez que AircraftProvider enveloppe bien votre application.</p>
      </div>
    );
  };
  const { aircraftList, selectedAircraft, setSelectedAircraft, addAircraft, updateAircraft, deleteAircraft } = aircraftContext;

  // Importer la fonction de migration depuis le store
  const migrateAircraftSurfaces = useAircraftStore(state => state.migrateAircraftSurfaces);

  // Importer refreshFromSupabase depuis le store pour recharger après sauvegarde
  const refreshFromSupabase = useAircraftStore(state => state.refreshFromSupabase);
  
  // Vérifier les avions ayant des données manquantes
  const [showIncompleteDataAlert, setShowIncompleteDataAlert] = useState(false);
  const [incompleteAircraft, setIncompleteAircraft] = useState([]);
  
  // Vérifier les données manquantes au premier chargement
  useEffect(() => {
    const incomplete = aircraftList.filter(aircraft =>
      !aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0
    );

    if (incomplete.length > 0) {
      console.log('⚠️ Avions avec données manquantes trouvés:', incomplete.map(a => a.registration));
      setIncompleteAircraft(incomplete);
      setShowIncompleteDataAlert(true);
    }
  }, [aircraftList]); // Se réexécute quand la liste change

  // Écouter l'événement pour reprendre l'assistant de création
  useEffect(() => {
    const handleResumeWizard = () => {
      console.log('🔄 Event: resume-aircraft-wizard received');
      const draft = localStorage.getItem('aircraft_wizard_draft');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          console.log('📂 Draft loaded:', draftData);

          // Ouvrir l'assistant avec les données du brouillon
          setWizardAircraft(draftData.aircraftData);
          setShowWizard(true);
        } catch (e) {
          console.error('❌ Error loading draft:', e);
        }
      }
    };

    window.addEventListener('resume-aircraft-wizard', handleResumeWizard);

    return () => {
      window.removeEventListener('resume-aircraft-wizard', handleResumeWizard);
    };
  }, []);
  
  
  const [showForm, setShowForm] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState(null);
  const [showManexImporter, setShowManexImporter] = useState(false);
  const [showManexViewer, setShowManexViewer] = useState(false);
  const [manexAircraft, setManexAircraft] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardAircraft, setWizardAircraft] = useState(null);
  const [aircraftPhotos, setAircraftPhotos] = useState({});
  const updateAircraftManex = useAircraftStore(state => state.updateAircraftManex);

  // Charger les photos depuis IndexedDB pour tous les avions qui en ont
  useEffect(() => {
    const loadPhotos = async () => {
      const photosMap = {};

      for (const aircraft of aircraftList) {
        // 🔧 FIX: Toujours essayer de charger la photo depuis IndexedDB
        // Même si hasPhoto est false (pour compatibilité avec anciens avions)
        try {
          const fullData = await dataBackupManager.getAircraftData(aircraft.id);
          if (fullData && fullData.photo) {
            photosMap[aircraft.id] = fullData.photo;
            console.log(`📸 Photo chargée pour ${aircraft.registration}`);
          }
        } catch (error) {
          console.warn(`⚠️ Erreur lors du chargement de la photo pour ${aircraft.registration}:`, error);
        }
      }

      setAircraftPhotos(photosMap);
    };

    if (aircraftList.length > 0) {
      loadPhotos();
    }
  }, [aircraftList]);

  const handleSelectAircraft = (aircraft) => {
    console.log('🎯 AircraftModule - Selecting aircraft:', aircraft);
    console.log('🔧 AircraftModule - Aircraft ID:', aircraft.id);
    console.log('📝 AircraftModule - Aircraft Registration:', aircraft.registration);
    console.log('🔍 AircraftModule - Current selectedAircraft before:', selectedAircraft);
    console.log('🔍 AircraftModule - Type of setSelectedAircraft:', typeof setSelectedAircraft);
    
    // Appel réel de la fonction
    setSelectedAircraft(aircraft);
    console.log('✅ AircraftModule - setSelectedAircraft called');
    
    // Vérifier après un court délai
    setTimeout(() => {
      console.log('⏱️ AircraftModule - Checking selectedAircraft after 100ms:', selectedAircraft);
    }, 100);
  };

  const handleEdit = async (aircraft) => {
    console.log('✏️ AircraftModule - Editing aircraft:', aircraft);
    // Récupérer l'avion le plus récent depuis la liste pour avoir les dernières modifications
    let currentAircraft = aircraftList.find(a => a.id === aircraft.id) || aircraft;
    console.log('✏️ AircraftModule - Current aircraft from list:', currentAircraft);
    console.log('✏️ AircraftModule - Aircraft surfaces:', currentAircraft.compatibleRunwaySurfaces);

    // Si l'avion a des données volumineuses, essayer de les récupérer depuis IndexedDB avec timeout
    if (currentAircraft.hasPhoto || currentAircraft.hasManex) {
      try {
        console.log('🔍 Récupération des données volumineuses depuis IndexedDB...');
        console.log('🔍 ID de l\'avion:', currentAircraft.id);
        console.log('🔍 hasPhoto:', currentAircraft.hasPhoto);
        console.log('🔍 hasManex:', currentAircraft.hasManex);

        // Attendre que la DB soit initialisée
        await dataBackupManager.initPromise;
        console.log('✅ DB initialisée');

        // Ajouter un timeout pour éviter d'attendre indéfiniment
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000); // 5 secondes max
        });

        const dataPromise = dataBackupManager.getAircraftData(currentAircraft.id);

        const fullAircraft = await Promise.race([dataPromise, timeoutPromise]);

        console.log('📦 Données récupérées:', fullAircraft ? 'OUI' : 'NON');
        if (fullAircraft) {
          console.log('📸 Photo présente:', !!fullAircraft.photo);
          console.log('📚 Manex présent:', !!fullAircraft.manex);
          currentAircraft = {
            ...currentAircraft,
            photo: fullAircraft.photo || currentAircraft.photo,
            manex: fullAircraft.manex || currentAircraft.manex
          };
          console.log('✅ Données volumineuses récupérées depuis IndexedDB');
        } else {
          console.log('⚠️ Aucune donnée volumineuse trouvée dans IndexedDB');
        }
      } catch (error) {
        console.error('❌ Erreur ou timeout lors de la récupération des données depuis IndexedDB:', error);
        console.error('❌ Type d\'erreur:', error.name);
        console.error('❌ Message:', error.message);
        console.log('➡️ Continuons sans les données volumineuses');
      }
    }

    console.log('📝 Ouverture du formulaire d\'édition...');

    setEditingAircraft(currentAircraft);
    setShowForm(true);
  };

  const handleOpenWizard = async (aircraft) => {
    console.log('🪄 AircraftModule - Opening wizard for aircraft:', aircraft);
    // Récupérer l'avion le plus récent depuis la liste pour avoir les dernières modifications
    let currentAircraft = aircraftList.find(a => a.id === aircraft.id) || aircraft;

    // Si l'avion a des données volumineuses, essayer de les récupérer depuis IndexedDB
    if (currentAircraft.hasPhoto || currentAircraft.hasManex || currentAircraft.hasPerformance) {
      try {
        console.log('🔍 Chargement des données volumineuses (photos/manex/performances) pour le wizard...');
        await dataBackupManager.initPromise;

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });

        const dataPromise = dataBackupManager.getAircraftData(currentAircraft.id);
        const fullAircraft = await Promise.race([dataPromise, timeoutPromise]);

        if (fullAircraft) {
          currentAircraft = {
            ...currentAircraft,
            photo: fullAircraft.photo || currentAircraft.photo,
            manex: fullAircraft.manex || currentAircraft.manex,
            advancedPerformance: fullAircraft.advancedPerformance || currentAircraft.advancedPerformance,
            performanceTables: fullAircraft.performanceTables || currentAircraft.performanceTables,
            performanceModels: fullAircraft.performanceModels || currentAircraft.performanceModels
          };
          console.log('✅ Données volumineuses chargées pour le wizard');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement pour le wizard:', error);
      }
    }

    setWizardAircraft(currentAircraft);
    setShowWizard(true);
  };

  const handleGeneratePDF = async (aircraft) => {
    try {
      console.log('📄 Génération du PDF pour:', aircraft.registration);

      // Récupérer toutes les données de l'avion
      let fullAircraft = { ...aircraft };
      if (aircraft.hasPhoto || aircraft.hasManex || aircraft.hasPerformance) {
        try {
          await dataBackupManager.initPromise;
          const data = await dataBackupManager.getAircraftData(aircraft.id);
          if (data) {
            fullAircraft = { ...fullAircraft, ...data };
          }
        } catch (error) {
          console.warn('⚠️ Impossible de charger toutes les données:', error);
        }
      }

      // Créer un nouveau document PDF
      const pdfDoc = await PDFDocument.create();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Ajouter une page
      let page = pdfDoc.addPage([595, 842]); // A4
      const { width, height } = page.getSize();
      let yPosition = height - 50;

      // Fonction helper pour ajouter du texte
      const addText = (text, x, y, options = {}) => {
        const font = options.bold ? helveticaBold : helveticaFont;
        const size = options.size || 12;
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
          ...options
        });
      };

      // Fonction pour ajouter une nouvelle page si nécessaire
      const checkNewPage = (neededSpace = 50) => {
        if (yPosition < neededSpace) {
          page = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }
      };

      // Titre
      addText(`Fiche Technique - ${fullAircraft.registration}`, 50, yPosition, { bold: true, size: 20 });
      yPosition -= 40;

      // Avertissement "À DÉVELOPPER" en gros et en rouge
      const warningText = 'À DÉVELOPPER';
      const warningSize = 18;
      const warningWidth = helveticaBold.widthOfTextAtSize(warningText, warningSize);
      const warningX = (width - warningWidth) / 2; // Centrer le texte
      addText(warningText, warningX, yPosition, { bold: true, size: warningSize, color: rgb(1, 0, 0) });
      yPosition -= 40;

      // Ajouter la photo de l'avion si disponible
      if (fullAircraft.photo) {
        try {
          checkNewPage(200);

          // Convertir la photo base64 en image
          let imageBytes;
          let image;

          if (fullAircraft.photo.startsWith('data:image/png')) {
            imageBytes = fullAircraft.photo.split(',')[1];
            image = await pdfDoc.embedPng(imageBytes);
          } else if (fullAircraft.photo.startsWith('data:image/jpeg') || fullAircraft.photo.startsWith('data:image/jpg')) {
            imageBytes = fullAircraft.photo.split(',')[1];
            image = await pdfDoc.embedJpg(imageBytes);
          }

          if (image) {
            const imageWidth = 200;
            const imageHeight = (image.height / image.width) * imageWidth;

            // Centrer l'image
            const xPos = (width - imageWidth) / 2;

            page.drawImage(image, {
              x: xPos,
              y: yPosition - imageHeight,
              width: imageWidth,
              height: imageHeight,
            });

            yPosition -= imageHeight + 20;
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de l\'ajout de la photo:', error);
        }
      }

      checkNewPage(50);

      // Informations générales
      addText('INFORMATIONS GÉNÉRALES', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const generalInfo = [
        ['Immatriculation', fullAircraft.registration],
        ['Modèle', fullAircraft.model],
        ['Constructeur', fullAircraft.manufacturer],
        ['Type', fullAircraft.category],
        ['Année', fullAircraft.year],
        ['Propriétaire', fullAircraft.owner],
      ];

      generalInfo.forEach(([label, value]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(String(value), 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Masses et dimensions
      addText('MASSES ET DIMENSIONS', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const massInfo = [
        ['Masse à vide', fullAircraft.emptyWeight ? `${fullAircraft.emptyWeight} kg` : null],
        ['Masse max au décollage', fullAircraft.maxTakeoffWeight ? `${fullAircraft.maxTakeoffWeight} kg` : null],
        ['Charge utile', fullAircraft.usefulLoad ? `${fullAircraft.usefulLoad} kg` : null],
        ['Capacité carburant', fullAircraft.fuelCapacity ? `${fullAircraft.fuelCapacity} L` : null],
        ['Envergure', fullAircraft.wingspan ? `${fullAircraft.wingspan} m` : null],
        ['Longueur', fullAircraft.length ? `${fullAircraft.length} m` : null],
      ];

      massInfo.forEach(([label, value]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(value, 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Vitesses caractéristiques
      if (fullAircraft.speeds) {
        addText('VITESSES CARACTÉRISTIQUES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const speedsInfo = [
          ['VSO (Volets sortis)', fullAircraft.speeds.vso],
          ['VS1 (Config lisse)', fullAircraft.speeds.vs1],
          ['VFE Landing', fullAircraft.speeds.vfeLdg],
          ['VFE Takeoff', fullAircraft.speeds.vfeTO],
          ['VNO (Normale)', fullAircraft.speeds.vno],
          ['VNE (Ne jamais excéder)', fullAircraft.speeds.vne],
          ['VA (Manœuvre)', fullAircraft.speeds.va],
          ['V Glide', fullAircraft.speeds.vglide],
          ['VR (Rotation)', fullAircraft.speeds.vr],
          ['V2 (Sécurité)', fullAircraft.speeds.v2],
          ['VREF (Référence)', fullAircraft.speeds.vref],
        ];

        speedsInfo.forEach(([label, value]) => {
          if (value) {
            checkNewPage();
            addText(`${label}:`, 50, yPosition, { bold: true, size: 10 });
            addText(`${value} kt`, 250, yPosition, { size: 10 });
            yPosition -= 18;
          }
        });

        yPosition -= 10;
        checkNewPage(50);
      }

      // Masse et centrage — section enrichie avec moments + arrays
      if (fullAircraft.weights || fullAircraft.arms || fullAircraft.cgEnvelope) {
        addText('MASSE ET CENTRAGE', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const massBalanceInfo = [
          // Masse à vide (trio masse / bras / moment)
          ['Masse à vide', fullAircraft.weights?.emptyWeight, 'kg'],
          ['Bras à vide', fullAircraft.arms?.empty, 'mm'],
          ['Moment à vide', fullAircraft.moments?.empty, 'kg·mm'],
          // Masses limites
          ['MTOW', fullAircraft.weights?.mtow || fullAircraft.maxTakeoffWeight, 'kg'],
          ['MLW', fullAircraft.weights?.mlw, 'kg'],
          ['MZFW', fullAircraft.weights?.mzfw || fullAircraft.weights?.zfm, 'kg'],
          ['Masse min vol', fullAircraft.weights?.minTakeoffWeight, 'kg'],
          // Carburant principal
          ['Capacité totale carburant', fullAircraft.fuel?.maxCapacity || fullAircraft.fuelCapacity, 'L'],
          ['Capacité rés. principal', fullAircraft.fuelMainCapacity, 'L'],
          ['Bras rés. principal', fullAircraft.arms?.fuelMain || fullAircraft.arms?.fuel, 'mm'],
          ['Moment rés. principal (plein)', fullAircraft.moments?.fuelMain, 'kg·mm'],
          // Sièges (bras seul — moment dépend du passager au chargement)
          ['Bras sièges avant', fullAircraft.arms?.frontSeats, 'mm'],
          ['Bras sièges arrière', fullAircraft.arms?.rearSeats, 'mm']
        ];

        massBalanceInfo.forEach(([label, value, unit]) => {
          if (value) {
            checkNewPage();
            addText(`${label}:`, 50, yPosition, { bold: true, size: 10 });
            addText(`${value} ${unit}`, 250, yPosition, { size: 10 });
            yPosition -= 18;
          }
        });

        // Réservoirs additionnels
        if (fullAircraft.additionalFuelTanks && fullAircraft.additionalFuelTanks.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Réservoirs additionnels:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.additionalFuelTanks.forEach((tank, idx) => {
            const name = tank.name || `Réservoir ${idx + 1}`;
            checkNewPage();
            addText(`  ${name}: ${tank.capacity || '?'} L, bras ${tank.arm || '?'} mm, moment ${tank.momentAtFull || '?'} kg·mm`,
              60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Sièges additionnels (bras seul)
        if (fullAircraft.additionalSeats && fullAircraft.additionalSeats.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Sièges additionnels:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.additionalSeats.forEach((seat, idx) => {
            const name = seat.name || `Siège ${idx + 3}`;
            checkNewPage();
            addText(`  ${name}: bras ${seat.arm || '?'} mm`, 60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Compartiments bagages
        if (fullAircraft.baggageCompartments && fullAircraft.baggageCompartments.length > 0) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Compartiments bagages:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 18;
          fullAircraft.baggageCompartments.forEach((comp, idx) => {
            const name = comp.name || `Compartiment ${idx + 1}`;
            checkNewPage();
            addText(`  ${name}: masse max ${comp.maxWeight || '?'} kg, bras ${comp.arm || '?'} mm, moment max ${comp.momentMax || '?'} kg·mm`,
              60, yPosition, { size: 10 });
            yPosition -= 16;
          });
        }

        // Limites CG et graphique d'enveloppe
        if (fullAircraft.cgEnvelope) {
          yPosition -= 5;
          checkNewPage(50);
          addText('Limites de centrage:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 20;

          if (fullAircraft.cgEnvelope.forwardPoints && fullAircraft.cgEnvelope.forwardPoints.length > 0) {
            addText(`CG avant (min): ${fullAircraft.cgEnvelope.forwardPoints[0].cg} mm`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }
          // Arrière : 2 points indépendants (rétro-compat aftCG)
          const legacyAftCG = fullAircraft.cgEnvelope.aftCG;
          const aftMinCG = fullAircraft.cgEnvelope.aftMinCG || legacyAftCG;
          const aftMaxCG = fullAircraft.cgEnvelope.aftMaxCG || legacyAftCG;
          if (aftMinCG) {
            addText(`CG arrière à masse min (${fullAircraft.cgEnvelope.aftMinWeight || '?'} kg): ${aftMinCG} mm`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }
          if (aftMaxCG && aftMaxCG !== aftMinCG) {
            addText(`CG arrière à masse max (${fullAircraft.cgEnvelope.aftMaxWeight || '?'} kg): ${aftMaxCG} mm`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          }

          // Dessiner le graphique de l'enveloppe de centrage
          yPosition -= 10;
          checkNewPage(250);

          try {
            // Dimensions du graphique
            const chartWidth = 400;
            const chartHeight = 200;
            const chartX = (width - chartWidth) / 2; // Centrer le graphique
            const chartY = yPosition - chartHeight;

            // Collecter tous les points pour déterminer les échelles
            const forwardPoints = fullAircraft.cgEnvelope.forwardPoints || [];
            const aftMinWeight = fullAircraft.cgEnvelope.aftMinWeight || 0;
            const aftMaxWeight = fullAircraft.cgEnvelope.aftMaxWeight || fullAircraft.weights?.mtow || 1000;
            const aftCG = fullAircraft.cgEnvelope.aftCG || 0;

            // Trouver les valeurs min/max pour les échelles
            const allWeights = [...forwardPoints.map(p => p.weight), aftMinWeight, aftMaxWeight].filter(w => w);
            const allCGs = [...forwardPoints.map(p => p.cg), aftCG].filter(cg => cg);

            if (allWeights.length > 0 && allCGs.length > 0) {
              const minWeight = Math.min(...allWeights);
              const maxWeight = Math.max(...allWeights);
              const minCG = Math.min(...allCGs);
              const maxCG = Math.max(...allCGs);

              // Marges pour l'affichage
              const weightMargin = (maxWeight - minWeight) * 0.1 || 50;
              const cgMargin = (maxCG - minCG) * 0.1 || 10;

              const weightRange = {
                min: Math.max(0, minWeight - weightMargin),
                max: maxWeight + weightMargin
              };
              const cgRange = {
                min: minCG - cgMargin,
                max: maxCG + cgMargin
              };

              // Fonction pour convertir les coordonnées données en coordonnées PDF
              const scaleX = (weight) => {
                return chartX + ((weight - weightRange.min) / (weightRange.max - weightRange.min)) * chartWidth;
              };
              const scaleY = (cg) => {
                return chartY + ((cg - cgRange.min) / (cgRange.max - cgRange.min)) * chartHeight;
              };

              // Dessiner les axes
              page.drawLine({
                start: { x: chartX, y: chartY },
                end: { x: chartX, y: chartY + chartHeight },
                thickness: 1,
                color: rgb(0, 0, 0)
              });
              page.drawLine({
                start: { x: chartX, y: chartY },
                end: { x: chartX + chartWidth, y: chartY },
                thickness: 1,
                color: rgb(0, 0, 0)
              });

              // Labels des axes
              addText('Masse (kg)', chartX + chartWidth / 2 - 30, chartY - 20, { size: 10, bold: true });

              // Label axe Y (vertical) - rotation simulée avec texte vertical
              const cgLabelX = chartX - 25;
              const cgLabelY = chartY + chartHeight / 2;
              addText('CG (mm)', cgLabelX - 20, cgLabelY, { size: 10, bold: true });

              // Graduations et labels sur l'axe X (masse)
              const numXTicks = 5;
              for (let i = 0; i <= numXTicks; i++) {
                const weight = weightRange.min + (i / numXTicks) * (weightRange.max - weightRange.min);
                const x = scaleX(weight);
                page.drawLine({
                  start: { x, y: chartY },
                  end: { x, y: chartY - 5 },
                  thickness: 1,
                  color: rgb(0, 0, 0)
                });
                addText(Math.round(weight).toString(), x - 15, chartY - 15, { size: 8 });
              }

              // Graduations et labels sur l'axe Y (CG)
              const numYTicks = 5;
              for (let i = 0; i <= numYTicks; i++) {
                const cg = cgRange.min + (i / numYTicks) * (cgRange.max - cgRange.min);
                const y = scaleY(cg);
                page.drawLine({
                  start: { x: chartX, y },
                  end: { x: chartX - 5, y },
                  thickness: 1,
                  color: rgb(0, 0, 0)
                });
                addText(Math.round(cg).toString(), chartX - 35, y - 3, { size: 8 });
              }

              // Dessiner l'enveloppe de centrage
              // Zone verte pour l'enveloppe acceptable
              if (forwardPoints.length >= 2) {
                // Ligne limite avant (forward CG)
                forwardPoints.sort((a, b) => a.weight - b.weight);
                for (let i = 0; i < forwardPoints.length - 1; i++) {
                  const p1 = forwardPoints[i];
                  const p2 = forwardPoints[i + 1];
                  page.drawLine({
                    start: { x: scaleX(p1.weight), y: scaleY(p1.cg) },
                    end: { x: scaleX(p2.weight), y: scaleY(p2.cg) },
                    thickness: 2,
                    color: rgb(0, 0.6, 0),
                    opacity: 0.8
                  });
                }
              }

              // Ligne limite arrière (aft CG)
              if (aftMinWeight && aftMaxWeight && aftCG) {
                page.drawLine({
                  start: { x: scaleX(aftMinWeight), y: scaleY(aftCG) },
                  end: { x: scaleX(aftMaxWeight), y: scaleY(aftCG) },
                  thickness: 2,
                  color: rgb(0.8, 0, 0),
                  opacity: 0.8
                });
              }

              // Légende
              const legendX = chartX + chartWidth - 120;
              const legendY = chartY + chartHeight - 30;

              // Ligne verte
              page.drawLine({
                start: { x: legendX, y: legendY },
                end: { x: legendX + 20, y: legendY },
                thickness: 2,
                color: rgb(0, 0.6, 0)
              });
              addText('Limite avant', legendX + 25, legendY - 3, { size: 8 });

              // Ligne rouge
              page.drawLine({
                start: { x: legendX, y: legendY - 15 },
                end: { x: legendX + 20, y: legendY - 15 },
                thickness: 2,
                color: rgb(0.8, 0, 0)
              });
              addText('Limite arrière', legendX + 25, legendY - 18, { size: 8 });

              yPosition = chartY - 30;

              addText('Graphique: Enveloppe de centrage', chartX, yPosition, { size: 9, bold: true });
              yPosition -= 25;
            }
          } catch (error) {
            console.warn('⚠️ Erreur lors de la génération du graphique CG:', error);
            addText('(Graphique non disponible)', 70, yPosition, { size: 9 });
            yPosition -= 20;
          }
        }

        yPosition -= 10;
        checkNewPage(50);
      }

      // Performances générales
      addText('PERFORMANCES GÉNÉRALES', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const perfInfo = [
        ['Vitesse de croisière', fullAircraft.cruiseSpeed || fullAircraft.cruiseSpeedKt, 'kt'],
        ['Vitesse max', fullAircraft.maxSpeed, 'kt'],
        ['Plafond', fullAircraft.ceiling, 'ft'],
        ['Autonomie', fullAircraft.range, 'NM'],
        ['Taux de montée', fullAircraft.climbRate, 'ft/min'],
        ['Consommation', fullAircraft.fuelConsumption, 'L/h'],
      ];

      perfInfo.forEach(([label, value, unit]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(`${value} ${unit}`, 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Moteur et hélice
      addText('MOTEUR ET HÉLICE', 50, yPosition, { bold: true, size: 14 });
      yPosition -= 25;

      const engineInfo = [
        ['Type moteur', fullAircraft.engineType],
        ['Modèle moteur', fullAircraft.engineModel],
        ['Puissance', fullAircraft.enginePower ? `${fullAircraft.enginePower} HP` : null],
        ['Nombre de moteurs', fullAircraft.engineCount],
        ['Type hélice', fullAircraft.propellerType],
      ];

      engineInfo.forEach(([label, value]) => {
        if (value) {
          checkNewPage();
          addText(`${label}:`, 50, yPosition, { bold: true });
          addText(String(value), 200, yPosition);
          yPosition -= 20;
        }
      });

      yPosition -= 10;
      checkNewPage(50);

      // Équipements
      if (fullAircraft.avionics || fullAircraft.equipment) {
        addText('ÉQUIPEMENTS', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        if (fullAircraft.avionics) {
          checkNewPage();
          addText('Avionique:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const avionicsText = fullAircraft.avionics.split('\n');
          avionicsText.forEach(line => {
            checkNewPage();
            addText(line, 70, yPosition, { size: 10 });
            yPosition -= 15;
          });
        }

        yPosition -= 10;
      }

      // Surfaces compatibles
      if (fullAircraft.compatibleRunwaySurfaces && fullAircraft.compatibleRunwaySurfaces.length > 0) {
        checkNewPage(50);
        addText('SURFACES DE PISTE COMPATIBLES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const surfaces = fullAircraft.compatibleRunwaySurfaces.join(', ');
        addText(surfaces, 50, yPosition);
        yPosition -= 20;
        yPosition -= 10;
      }

      // Opérations approuvées
      if (fullAircraft.approvedOperations) {
        checkNewPage(100);
        addText('OPÉRATIONS APPROUVÉES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const ops = fullAircraft.approvedOperations;
        const approvedOps = [];

        if (ops.vfrDay) approvedOps.push('VFR Jour');
        if (ops.vfrNight) approvedOps.push('VFR Nuit');
        if (ops.ifrDay) approvedOps.push('IFR Jour');
        if (ops.ifrNight) approvedOps.push('IFR Nuit');
        if (ops.aerobatics) approvedOps.push('Voltige');
        if (ops.spinning) approvedOps.push('Vrille');
        if (ops.waterOperations) approvedOps.push('Opérations sur eau');
        if (ops.skiOperations) approvedOps.push('Opérations sur skis');
        if (ops.icingConditions) approvedOps.push('Conditions givrantes');

        if (approvedOps.length > 0) {
          addText('Règles de vol et opérations spéciales:', 50, yPosition, { bold: true, size: 11 });
          yPosition -= 20;

          approvedOps.forEach(op => {
            checkNewPage();
            addText(`• ${op}`, 70, yPosition, { size: 10 });
            yPosition -= 18;
          });
        } else {
          addText('Aucune opération spécifique approuvée', 50, yPosition, { size: 10 });
          yPosition -= 18;
        }

        yPosition -= 10;
      }

      // Performances de décollage/atterrissage si disponibles
      if (fullAircraft.performance) {
        checkNewPage(70);
        addText('DONNÉES DE PERFORMANCE', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        if (fullAircraft.performance.takeoff) {
          addText('Décollage:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const takeoff = fullAircraft.performance.takeoff;
          if (takeoff.tod) {
            addText(`  TOD: ${takeoff.tod} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (takeoff.toda15m) {
            addText(`  15m: ${takeoff.toda15m} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (takeoff.toda50ft) {
            addText(`  50ft: ${takeoff.toda50ft} m`, 70, yPosition);
            yPosition -= 18;
          }
          yPosition -= 10;
        }

        if (fullAircraft.performance.landing) {
          checkNewPage(70);
          addText('Atterrissage:', 50, yPosition, { bold: true });
          yPosition -= 20;
          const landing = fullAircraft.performance.landing;
          if (landing.ld) {
            addText(`  LD: ${landing.ld} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (landing.lda15m) {
            addText(`  15m: ${landing.lda15m} m`, 70, yPosition);
            yPosition -= 18;
          }
          if (landing.lda50ft) {
            addText(`  50ft: ${landing.lda50ft} m`, 70, yPosition);
            yPosition -= 18;
          }
        }
      }

      // Remarques
      if (fullAircraft.notes) {
        checkNewPage(50);
        yPosition -= 10;
        addText('REMARQUES', 50, yPosition, { bold: true, size: 14 });
        yPosition -= 25;

        const notesLines = fullAircraft.notes.split('\n');
        notesLines.forEach(line => {
          checkNewPage();
          addText(line, 50, yPosition, { size: 10 });
          yPosition -= 15;
        });
      }

      // Pied de page sur toutes les pages
      const pages = pdfDoc.getPages();
      pages.forEach((p, index) => {
        p.drawText(`Page ${index + 1}/${pages.length}`, {
          x: width / 2 - 30,
          y: 30,
          size: 10,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
        p.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
          x: 50,
          y: 30,
          size: 8,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      });

      // Sauvegarder le PDF
      const pdfBytes = await pdfDoc.save();

      // Télécharger le PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fiche_${fullAircraft.registration}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('✅ PDF généré avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Consultez la console pour plus de détails.');
    }
  };

  const handleDelete = (id) => {
    console.log('🗑️ AircraftModule - Attempting to delete aircraft:', id);
    if (window.confirm('Êtes-vous sûr de supprimer cet avion ?')) {
      deleteAircraft(id);
      console.log('✅ AircraftModule - Aircraft deleted:', id);
    }
  };



  return (
    <div>
      {/* Alerte pour les avions avec données manquantes */}
      {showIncompleteDataAlert && incompleteAircraft.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px'
        }}>
          <AlertTriangle size={24} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#92400e',
              marginBottom: '8px'
            }}>
              ⚠️ Configuration incomplète détectée
            </h4>
            <p style={{ 
              fontSize: '14px', 
              color: '#78350f',
              marginBottom: '12px'
            }}>
              {incompleteAircraft.length} avion{incompleteAircraft.length > 1 ? 's' : ''} n'a{incompleteAircraft.length > 1 ? 'ont' : ''} pas de surfaces compatibles définies. 
              Ces informations sont essentielles pour la sélection automatique des aérodromes compatibles.
            </p>
            <div style={{ 
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: '#fffbeb',
              borderRadius: '4px',
              border: '1px solid #fbbf24'
            }}>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                Avions concernés:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#78350f' }}>
                {incompleteAircraft.map(aircraft => (
                  <li key={aircraft.id}>
                    {aircraft.registration} ({aircraft.model})
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  // Ouvrir le formulaire de modification pour le premier avion incomplet
                  if (incompleteAircraft.length > 0) {
                    handleEdit(incompleteAircraft[0]);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📝 Configurer maintenant
              </button>
              <button
                onClick={() => {
                  setShowIncompleteDataAlert(false);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#78350f',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Ignorer pour le moment
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Définition du style pour les boutons */}
      {(() => {
        const buttonSectionStyle = {
          width: '100%',
          padding: '12px !important',
          backgroundColor: 'rgba(55, 65, 81, 0.35) !important',
          color: 'white !important',
          border: '1px solid rgba(0, 0, 0, 0.7) !important',
          borderRadius: '8px !important',
          fontSize: '16px !important',
          fontWeight: 'bold !important',
          cursor: 'pointer !important',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s !important',
          background: 'rgba(55, 65, 81, 0.35) !important',
          textTransform: 'none !important',
          letterSpacing: 'normal !important'
        };
        window.buttonSectionStyle = buttonSectionStyle;
      })()}
      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              console.log('➕ AircraftModule - Opening wizard for new aircraft');
              setWizardAircraft(null);
              setShowWizard(true);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            Nouvel avion
          </button>
        </div>
      </div>


      {/* Liste des avions */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {aircraftList && aircraftList.length > 0 ? (
          aircraftList.map((aircraft, index) => {
            const isSelected = selectedAircraft && selectedAircraft.id === aircraft.id;
            const hasIncompleteSurfaces = !aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0;
            
            console.log(`🔍 Rendering aircraft ${index}:`, {
              aircraftId: aircraft.id,
              selectedId: selectedAircraft?.id,
              isSelected: isSelected,
              strictEquality: selectedAircraft?.id === aircraft.id,
              typeOfAircraftId: typeof aircraft.id,
              typeOfSelectedId: typeof selectedAircraft?.id,
              hasIncompleteSurfaces: hasIncompleteSurfaces
            });
            
            return (
              <div
                key={aircraft.id}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: hasIncompleteSurfaces ? '2px solid #f59e0b' : (isSelected ? '2px solid #3182CE' : '1px solid #E5E7EB'),
                  backgroundColor: hasIncompleteSurfaces ? '#fffbeb' : (isSelected ? '#EBF8FF' : 'white'),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  marginBottom: '8px',
                  boxShadow: isSelected ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
                onClick={(e) => {
                  console.log(`🖱️ AircraftModule - Card clicked for aircraft index ${index}`);
                  if (e.target.closest('button')) {
                    console.log('⚠️ AircraftModule - Click on button, stopping propagation');
                    return;
                  }
                  handleSelectAircraft(aircraft);
                }}
              >
                {/* Badge d'avertissement pour données incomplètes */}
                {hasIncompleteSurfaces && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    zIndex: 1
                  }}>
                    <AlertTriangle size={12} />
                    Config requise
                  </div>
                )}
                
                {/* Contenu principal de la carte */}
                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                  {/* Photo de l'avion */}
                  {aircraftPhotos[aircraft.id] && (
                    <div style={{
                      flexShrink: 0,
                      width: '120px',
                      height: '90px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      <img
                        src={aircraftPhotos[aircraft.id]}
                        alt={`${aircraft.registration}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', color: '#000000' }}>
                      <span style={{ color: '#000000' }}>{aircraft.registration} - {aircraft.model}</span>
                      {aircraft.wakeTurbulenceCategory && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          backgroundColor: 
                            aircraft.wakeTurbulenceCategory === 'L' ? '#DBEAFE' :
                            aircraft.wakeTurbulenceCategory === 'M' ? '#FEF3C7' :
                            aircraft.wakeTurbulenceCategory === 'H' ? '#FED7AA' :
                            '#FECACA',
                          color: 
                            aircraft.wakeTurbulenceCategory === 'L' ? '#1E40AF' :
                            aircraft.wakeTurbulenceCategory === 'M' ? '#92400E' :
                            aircraft.wakeTurbulenceCategory === 'H' ? '#9A3412' :
                            '#991B1B',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          CAT {aircraft.wakeTurbulenceCategory}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ fontSize: '14px', color: '#6B7280', marginLeft: '8px' }}>
                          (sélectionné)
                        </span>
                      )}
                    </h4>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>
                      <p>Carburant: {aircraft.fuelType} • Capacité: {
                        // CANONIQUE → user pref via formatCanonical (double affichage)
                        formatCanonical(aircraft.fuelCapacity, 'fuel', useUnitsStore.getState().units, { both: true })
                      }</p>
                      <p>Vitesse: {
                        formatCanonical(aircraft.cruiseSpeed || aircraft.cruiseSpeedKt, 'speed', useUnitsStore.getState().units)
                      } • Conso: {
                        formatCanonical(aircraft.fuelConsumption, 'fuelConsumption', useUnitsStore.getState().units, { both: true })
                      }</p>
                      <p>MTOW: {
                        formatCanonical(aircraft.maxTakeoffWeight || aircraft.weights?.mtow, 'weight', useUnitsStore.getState().units, { both: true })
                      }</p>
                      {/* Affichage des informations MANEX si présent */}
                      {(aircraft.hasManex || aircraft.manex) && (
                        <p style={{ color: '#059669', fontSize: '12px', marginTop: '4px' }}>
                          📚 MANEX: {aircraft.manex?.fileName || 'Chargé'} {aircraft.manex?.pageCount ? `(${aircraft.manex.pageCount} pages)` : ''}
                        </p>
                      )}
                      {aircraft.masses?.emptyMass && (
                        <p style={{ color: '#3182CE' }}>
                          ⚖️ Masse à vide: {aircraft.masses.emptyMass || aircraft.weights?.emptyWeight} {getSymbol('weight')} • MLM: {aircraft.limitations?.maxLandingMass || aircraft.weights?.mlw ? `${aircraft.limitations?.maxLandingMass || aircraft.weights?.mlw} ${getSymbol('weight')}` : 'N/A'}
                        </p>
                      )}
                      {aircraft.armLengths?.emptyMassArm && (
                        <p style={{ color: '#7C3AED' }}>
                          📏 Bras masse à vide: {aircraft.armLengths.emptyMassArm || aircraft.arms?.empty} {getSymbol('armLength')} • Carburant: {aircraft.armLengths.fuelArm || aircraft.arms?.fuelMain} {getSymbol('armLength')}
                        </p>
                      )}
                      {/* Types de pistes compatibles */}
                      {aircraft.compatibleRunwaySurfaces && aircraft.compatibleRunwaySurfaces.length > 0 && (
                        <p style={{ color: '#059669', fontSize: '13px', marginTop: '4px' }}>
                          🛬 Pistes compatibles: {(() => {
                            const surfaceMap = {
                              'ASPH': 'Asphalte',
                              'CONC': 'Béton',
                              'GRASS': 'Herbe',
                              'GRVL': 'Gravier',
                              'UNPAVED': 'Terre',
                              'SAND': 'Sable',
                              'SNOW': 'Neige',
                              'WATER': 'Eau'
                            };
                            return aircraft.compatibleRunwaySurfaces
                              .map(s => surfaceMap[s] || s)
                              .join(', ');
                          })()}
                        </p>
                      )}
                      
                      {/* Opérations approuvées */}
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {aircraft.approvedOperations?.vfrDay !== false && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            VFR jour
                          </span>
                        )}
                        {aircraft.approvedOperations?.vfrNight && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#1e293b',
                            color: '#e0f2fe',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            VFR nuit 🌙
                          </span>
                        )}
                        {aircraft.approvedOperations?.ifrDay && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#dcfce7',
                            color: '#14532d',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            IFR jour
                          </span>
                        )}
                        {aircraft.approvedOperations?.ifrNight && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#064e3b',
                            color: '#d1fae5',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            IFR nuit 🌙
                          </span>
                        )}
                        {aircraft.approvedOperations?.svfr && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#fef3c7',
                            color: '#78350f',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            SVFR
                          </span>
                        )}
                        {aircraft.approvedOperations?.training && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#fce7f3',
                            color: '#831843',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            École ✈️
                          </span>
                        )}
                        {aircraft.approvedOperations?.mountainous && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            Montagne ⛰️
                          </span>
                        )}
                        {aircraft.approvedOperations?.aerobatics && (
                          <span style={{ 
                            padding: '2px 6px', 
                            fontSize: '10px', 
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '3px',
                            fontWeight: '500'
                          }}>
                            Voltige 🎪
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action en bas de la carte */}
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  {/* Bouton Sélectionner */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('✅ AircraftModule - Select button clicked for:', aircraft.registration);
                        setSelectedAircraft(aircraft);
                      }}
                      style={{
                        ...window.buttonSectionStyle,
                        padding: '8px',
                        background: selectedAircraft?.id === aircraft.id ? '#dcfce7' : 'rgba(55, 65, 81, 0.35)',
                        borderColor: selectedAircraft?.id === aircraft.id ? '#10b981' : 'rgba(0, 0, 0, 0.7)'
                      }}
                      title={selectedAircraft?.id === aircraft.id ? "Avion sélectionné" : "Sélectionner cet avion"}
                    >
                      <CheckCircle size={16} color={selectedAircraft?.id === aircraft.id ? '#10b981' : undefined} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const alreadyHasManex = !!(aircraft.hasManex || aircraft.manex);
                        console.log('📚 AircraftModule - MANEX button clicked, hasManex=', alreadyHasManex);
                        setManexAircraft(aircraft);
                        if (alreadyHasManex) {
                          setShowManexViewer(true);
                        } else {
                          setShowManexImporter(true);
                        }
                      }}
                      style={{
                        ...window.buttonSectionStyle,
                        padding: '8px',
                        background: (aircraft.hasManex || aircraft.manex) ? '#fef3c7' : 'rgba(55, 65, 81, 0.35)',
                        borderColor: (aircraft.hasManex || aircraft.manex) ? '#fbbf24' : 'rgba(0, 0, 0, 0.7)'
                      }}
                      title={(aircraft.hasManex || aircraft.manex) ? "Voir le MANEX" : "Importer le MANEX"}
                    >
                      <FileText size={16} color={(aircraft.hasManex || aircraft.manex) ? '#f59e0b' : undefined} />
                    </button>
                    
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('📄 AircraftModule - Generate PDF button clicked');
                        handleGeneratePDF(aircraft);
                      }}
                      style={{
                        ...window.buttonSectionStyle,
                        padding: '8px',
                        color: '#ef4444'
                      }}
                      title="Générer PDF"
                    >
                      <FileDown size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenWizard(aircraft);
                      }}
                      style={{
                        ...window.buttonSectionStyle,
                        padding: '8px',
                        color: '#8b5cf6'
                      }}
                      title="Modifier avec l'assistant"
                    >
                      <Wand2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🗑️ AircraftModule - Delete button clicked');
                        handleDelete(aircraft.id);
                      }}
                      style={{
                        ...window.buttonSectionStyle,
                        padding: '8px',
                        color: '#dc2626'
                      }}
                      title="Supprimer l'avion"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            border: '1px solid #E5E7EB' 
          }}>
            <p style={{ marginBottom: '16px', fontSize: '16px', color: '#6B7280' }}>Aucun avion enregistré.</p>
            <p style={{ color: '#6B7280' }}>Cliquez sur "Nouvel avion" pour commencer.</p>
          </div>
        )}
      </div>

      {/* API Key Test Component - Temporairement désactivé */}
      {/* <APIKeyTest /> */}

      {/* Modal formulaire */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '24px',
              position: 'sticky',
              top: '-24px',
              backgroundColor: 'white',
              paddingBottom: '12px',
              zIndex: 10
            }}>
              <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
                {editingAircraft ? `Informations ${editingAircraft.registration}` : 'Nouvel avion'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingAircraft(null);
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#000'}
                onMouseLeave={(e) => e.target.style.color = '#6b7280'}
              >
                <X size={24} />
              </button>
            </div>
            
            <AircraftForm
              aircraft={editingAircraft}
              onSubmit={async (processedData) => {
                console.log('💾 AircraftModule - Form submitted with processed data:', processedData);
                console.log('💾 AircraftModule - Speeds in processed data:', processedData.speeds);
                console.log('💾 AircraftModule - Surfaces compatibles:', processedData.compatibleRunwaySurfaces);
                
                try {
                  // Séparer les données volumineuses
                  const { photo, manex, ...lightData } = processedData;
                  
                  if (editingAircraft) {
                    const updatedAircraft = {...lightData, id: editingAircraft.id};
                    
                    // Marquer si l'avion a des données volumineuses
                    if (photo) updatedAircraft.hasPhoto = true;
                    if (manex) updatedAircraft.hasManex = true;
                    
                    console.log('💾 AircraftModule - Updating aircraft with speeds:', updatedAircraft.speeds);
                    
                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex) {
                      const fullAircraft = {
                        ...updatedAircraft,
                        photo: photo || null,
                        manex: manex || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Données volumineuses sauvegardées dans IndexedDB');
                    }
                    
                    // Mettre à jour avec les données légères
                    updateAircraft(updatedAircraft);
                    console.log('✅ AircraftModule - Aircraft updated with speeds');
                  } else {
                    console.log('💾 AircraftModule - Adding new aircraft');
                    console.log('💾 AircraftModule - Données complètes à ajouter:', lightData);
                    
                    // Utiliser l'ID existant ou en créer un nouveau
                    if (!lightData.id) {
                      lightData.id = `aircraft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }
                    
                    // Marquer si l'avion a des données volumineuses
                    if (photo) lightData.hasPhoto = true;
                    if (manex) lightData.hasManex = true;
                    
                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex) {
                      const fullAircraft = {
                        ...lightData,
                        photo: photo || null,
                        manex: manex || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Données volumineuses sauvegardées dans IndexedDB');
                    }
                    
                    try {
                      const result = addAircraft(lightData);
                      console.log('✅ AircraftModule - addAircraft result:', result);
                      console.log('✅ AircraftModule - New aircraft added');
                    } catch (error) {
                      console.error('❌ AircraftModule - Erreur lors de l\'ajout:', error);
                      console.error('❌ Stack trace:', error.stack);
                    }
                  }
                  setShowForm(false);
                  setEditingAircraft(null);
                } catch (error) {
                  console.error('❌ AircraftModule - Erreur lors de la sauvegarde:', error);
                  
                  // Si c'est une erreur de quota, proposer le nettoyage
                  if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                    if (window.confirm('Le stockage est plein. Voulez-vous nettoyer le stockage et réessayer ?')) {
                      await dataBackupManager.cleanupLocalStorage();
                      alert('Stockage nettoyé. Veuillez réessayer.');
                    }
                  } else {
                    alert(`Erreur lors de la sauvegarde: ${error.message}`);
                  }
                }
              }}
              onCancel={() => {
                console.log('❌ AircraftModule - Form cancelled');
                setShowForm(false);
                setEditingAircraft(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal MANEX Importer */}
      {showManexImporter && manexAircraft && (
        <ManexImporter
          aircraft={manexAircraft}
          onManexUpdate={updateAircraftManex}
          onClose={() => {
            setShowManexImporter(false);
            setManexAircraft(null);
          }}
        />
      )}

      {/* Modal MANEX Viewer */}
      {showManexViewer && manexAircraft && (
        <ManexViewer
          aircraft={manexAircraft}
          onClose={() => {
            setShowManexViewer(false);
            setManexAircraft(null);
          }}
        />
      )}

      {/* Modal Assistant de création/modification */}
      {showWizard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '1200px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <AircraftCreationWizard
              existingAircraft={wizardAircraft}
              onClose={() => {
                setShowWizard(false);
                setWizardAircraft(null);
              }}
              onComplete={async (aircraftData) => {
                console.log('✅ Wizard completed with data:', aircraftData);

                try {
                  // Séparer les données volumineuses
                  const { photo, manex, ...lightData } = aircraftData;

                  if (wizardAircraft) {
                    // Mode édition : mettre à jour l'avion existant
                    const updatedAircraft = {
                      ...lightData,
                      id: wizardAircraft.id,
                      photo: photo || null,
                      manex: manex || null
                    };

                    // Marquer si l'avion a des données volumineuses
                    if (photo) updatedAircraft.hasPhoto = true;
                    if (manex) updatedAircraft.hasManex = true;
                    if (updatedAircraft.advancedPerformance || updatedAircraft.performanceTables || updatedAircraft.performanceModels) {
                      updatedAircraft.hasPerformance = true;
                      console.log('✅ Wizard - Données de performance détectées et marquées');
                    }

                    console.log('💾 Wizard - Updating aircraft with photo:', !!photo, 'manex:', !!manex);

                    if (manex) {
                      console.log('📦 MANEX à sauvegarder (update):', {
                        fileName: manex.fileName,
                        hasPdfData: !!manex.pdfData,
                        hasFile: !!manex.file,
                        pdfDataLength: manex.pdfData ? manex.pdfData.length : 0,
                        fileLength: manex.file ? manex.file.length : 0,
                        keys: Object.keys(manex)
                      });
                    }

                    // Sauvegarder les données volumineuses dans IndexedDB
                    await dataBackupManager.saveAircraftData(updatedAircraft);
                    console.log('✅ Wizard - Données volumineuses sauvegardées dans IndexedDB');

                    // Mettre à jour avec l'objet complet (photo/manex inclus)
                    updateAircraft(updatedAircraft);
                    console.log('✅ Wizard - Aircraft updated');
                  } else {
                    // Mode création : ajouter un nouvel avion
                    console.log('💾 Wizard - Adding new aircraft');

                    // Utiliser l'ID existant ou en créer un nouveau
                    if (!lightData.id) {
                      lightData.id = `aircraft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }

                    // Marquer si l'avion a des données volumineuses
                    if (photo) lightData.hasPhoto = true;
                    if (manex) lightData.hasManex = true;
                    if (lightData.advancedPerformance || lightData.performanceTables || lightData.performanceModels) {
                      lightData.hasPerformance = true;
                      console.log('✅ Wizard - Données de performance détectées et marquées (nouveau)');
                    }

                    console.log('💾 Wizard - New aircraft photo:', !!photo, 'manex:', !!manex);

                    // Sauvegarder les données volumineuses dans IndexedDB si elles existent
                    if (photo || manex || lightData.hasPerformance) {
                      const fullAircraft = {
                        ...lightData,
                        photo: photo || null,
                        manex: manex || null
                      };
                      await dataBackupManager.saveAircraftData(fullAircraft);
                      console.log('✅ Wizard - Données volumineuses sauvegardées dans IndexedDB');
                    }

                    addAircraft(lightData);
                    console.log('✅ Wizard - New aircraft added');
                  }

                  // 🔧 FIX: Recharger la liste des avions depuis Supabase pour synchroniser
                  console.log('🔄 Rechargement de la liste des avions depuis Supabase...');
                  await refreshFromSupabase();
                  console.log('✅ Liste des avions rechargée');

                  // 🔧 FIX CRITIQUE: Copier les données volumineuses de l'ID temporaire vers l'ID Supabase
                  const tempId = wizardAircraft?.id || lightData?.id;
                  const aircraftRegistration = wizardAircraft?.registration || lightData?.registration;

                  // Récupérer la liste à jour depuis le store (pas depuis le contexte qui n'est pas encore mis à jour)
                  const updatedAircraftList = useAircraftStore.getState().aircraftList;
                  const supabaseAircraft = updatedAircraftList.find(a => a.registration === aircraftRegistration);
                  const supabaseId = supabaseAircraft?.id;

                  console.log('🔄 Migration données volumineuses:', {
                    tempId,
                    aircraftRegistration,
                    supabaseId,
                    hasPhoto: !!photo,
                    hasManex: !!manex,
                    updatedListLength: updatedAircraftList.length
                  });

                  if (tempId && supabaseId && tempId !== supabaseId && (photo || manex)) {
                    try {
                      // Récupérer les données de l'ID temporaire
                      const tempData = await dataBackupManager.getAircraftData(tempId);
                      console.log('📦 Données temp récupérées:', {
                        hasData: !!tempData,
                        hasPhoto: !!tempData?.photo,
                        hasManex: !!tempData?.manex
                      });

                      if (tempData) {
                        // Sauvegarder avec le nouvel ID Supabase
                        const migratedData = {
                          ...tempData,
                          id: supabaseId
                        };
                        await dataBackupManager.saveAircraftData(migratedData);
                        console.log('✅ Données migrées vers ID Supabase:', supabaseId);

                        // Supprimer l'ancienne entrée avec l'ID temporaire
                        await dataBackupManager.deleteAircraftData(tempId);
                        console.log('🗑️ Anciennes données temp supprimées:', tempId);
                      }
                    } catch (err) {
                      console.error('⚠️ Erreur migration données volumineuses:', err);
                    }
                  }

                  setShowWizard(false);
                  setWizardAircraft(null);
                } catch (error) {
                  console.error('❌ Wizard - Erreur lors de la sauvegarde:', error);
                  alert(`Erreur lors de la sauvegarde: ${error.message}`);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
});

AircraftModule.displayName = 'AircraftModule';

// Composant de formulaire pour ajouter/modifier un avion
const AircraftForm = memo(({ aircraft, onSubmit, onCancel }) => {
  const { format, convert, getSymbol, toStorage, getUnit } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change
  const massUnit = getSymbol('weight');
  const fuelUnit = getSymbol('fuel');
  const armUnit = getSymbol('armLength');
  const consumptionUnit = getUnit('fuel') === 'ltr' ? 'L/h' : getUnit('fuel') === 'gal' ? 'gal/h' : `${getSymbol('fuel')}/h`;
  // États pour les sections collapsibles
  const [showGeneral, setShowGeneral] = useState(false);
  const [showPerformances, setShowPerformances] = useState(false);
  const [showMasseCentrage, setShowMasseCentrage] = useState(false);
  const [showEquipements, setShowEquipements] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showRemarques, setShowRemarques] = useState(false);
  const [showPerformancesIA, setShowPerformancesIA] = useState(false);
  const [aircraftPhoto, setAircraftPhoto] = useState(aircraft?.photo || null);

  // DEBUG : Afficher l'avion reçu en props
  // console.log('🛩️ AircraftForm - aircraft reçu:', aircraft);
  // console.log('🛩️ AircraftForm - surfaces compatibles de l\'avion:', aircraft?.compatibleRunwaySurfaces);
  // console.log('🛩️ AircraftForm - ID de l\'avion:', aircraft?.id);

  // Valider et normaliser les surfaces compatibles
  const getValidSurfaces = (surfaces) => {
    // Pour un nouvel avion (aircraft est null), pas de valeurs par défaut
    if (!aircraft) return [];
    
    // Pour un avion existant, préserver ses surfaces ou utiliser un tableau vide
    if (!surfaces) return [];
    if (!Array.isArray(surfaces)) return [];
    
    // S'assurer que toutes les surfaces sont des chaînes valides
    return surfaces.filter(s => typeof s === 'string' && s.trim().length > 0);
  };
  
  // Fonction pour gérer l'upload de photo
  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Limite à 5MB
        alert('La photo est trop volumineuse. Veuillez choisir une image de moins de 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAircraftPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [formData, setFormData] = useState({
    registration: aircraft?.registration || '',
    model: aircraft?.model || '',
    fuelType: aircraft?.fuelType || 'AVGAS',
    fuelCapacity: aircraft?.fuelCapacity || '',
    cruiseSpeedKt: aircraft?.cruiseSpeedKt || aircraft?.cruiseSpeed || '',
    baseFactor: aircraft?.baseFactor || '',  // Facteur de base calculé automatiquement
    fuelConsumption: aircraft?.fuelConsumption || '',
    maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
    wakeTurbulenceCategory: aircraft?.wakeTurbulenceCategory || 'L', // L=Light, M=Medium, H=Heavy, J=Super
    compatibleRunwaySurfaces: getValidSurfaces(aircraft?.compatibleRunwaySurfaces), // Valider les surfaces
    // Section Performances - Vitesses caractéristiques
    speeds: {
      vso: aircraft?.speeds?.vso || aircraft?.manex?.performances?.vso || '',  // Vitesse de décrochage volets sortis
      vs1: aircraft?.speeds?.vs1 || aircraft?.manex?.performances?.vs1 || '',  // Vitesse de décrochage volets rentrés
      vr: aircraft?.speeds?.vr || '',    // Vitesse de rotation
      vfe: aircraft?.speeds?.vfe || aircraft?.manex?.performances?.vfe || '',  // Vitesse max volets sortis (compatibilité ancienne)
      vfeLdg: aircraft?.speeds?.vfeLdg || '',    // Vitesse max volets LDG (atterrissage)
      vfeTO: aircraft?.speeds?.vfeTO || '',      // Vitesse max volets T/O (décollage)
      vno: aircraft?.speeds?.vno || aircraft?.manex?.performances?.vno || '',  // Vitesse max en air calme
      vne: aircraft?.speeds?.vne || aircraft?.manex?.performances?.vne || '',  // Vitesse à ne jamais dépasser
      vx: aircraft?.speeds?.vx || aircraft?.manex?.performances?.vx || '',    // Vitesse de montée max (pente)
      vy: aircraft?.speeds?.vy || aircraft?.manex?.performances?.vy || '',    // Vitesse de montée optimale (taux)
      vapp: aircraft?.speeds?.vapp || '',  // Vitesse d'approche
      vle: aircraft?.speeds?.vle || '',  // Vitesse max train sorti
      vlo: aircraft?.speeds?.vlo || '',  // Vitesse max manœuvre train
      initialClimb: aircraft?.speeds?.initialClimb || '',  // Vitesse de montée initiale
      vglide: aircraft?.speeds?.vglide || '',  // Vitesse de plané optimal
      // VO - Operating manoeuvring speed (variable selon la masse)
      voWeight1: aircraft?.speeds?.voWeight1 || '',     // Masse max pour VO1
      voSpeed1: aircraft?.speeds?.voSpeed1 || '',       // VO1
      voWeight2Min: aircraft?.speeds?.voWeight2Min || '', // Masse min pour VO2
      voWeight2Max: aircraft?.speeds?.voWeight2Max || '', // Masse max pour VO2
      voSpeed2: aircraft?.speeds?.voSpeed2 || '',       // VO2
      voWeight3: aircraft?.speeds?.voWeight3 || '',     // Masse min pour VO3
      voSpeed3: aircraft?.speeds?.voSpeed3 || ''        // VO3
    },
    // Section Performances - Distances
    distances: {
      takeoffRoll: aircraft?.distances?.takeoffRoll || aircraft?.manex?.performances?.takeoffRoll || '',
      takeoffDistance15m: aircraft?.distances?.takeoffDistance15m || '',
      takeoffDistance50ft: aircraft?.distances?.takeoffDistance50ft || aircraft?.manex?.performances?.takeoffDistance || '',
      landingRoll: aircraft?.distances?.landingRoll || aircraft?.manex?.performances?.landingRoll || '',
      landingDistance15m: aircraft?.distances?.landingDistance15m || '',
      landingDistance50ft: aircraft?.distances?.landingDistance50ft || aircraft?.manex?.performances?.landingDistance || ''
    },
    // Section Performances - Montée et plafonds
    climb: {
      rateOfClimb: aircraft?.climb?.rateOfClimb || '',  // Taux de montée (ft/min)
      serviceCeiling: aircraft?.climb?.serviceCeiling || '',  // Plafond pratique (ft)
      climbGradient: aircraft?.climb?.climbGradient || ''  // Gradient de montée (%)
    },
    // Section Limitations de vent
    windLimits: {
      maxCrosswind: aircraft?.windLimits?.maxCrosswind || aircraft?.manex?.limitations?.maxCrosswind || '',
      maxTailwind: aircraft?.windLimits?.maxTailwind || aircraft?.manex?.limitations?.maxTailwind || '',
      maxCrosswindWet: aircraft?.windLimits?.maxCrosswindWet || ''
    },
    masses: {
      emptyMass: aircraft?.masses?.emptyMass || '',
      minTakeoffMass: aircraft?.masses?.minTakeoffMass || '',
      maxBaggageTube: aircraft?.masses?.maxBaggageTube || '',
      maxAftBaggageExtension: aircraft?.masses?.maxAftBaggageExtension || ''
    },
    armLengths: {
      emptyMassArm: aircraft?.armLengths?.emptyMassArm || '',
      fuelArm: aircraft?.armLengths?.fuelArm || '',
      frontSeat1Arm: aircraft?.armLengths?.frontSeat1Arm || '',
      frontSeat2Arm: aircraft?.armLengths?.frontSeat2Arm || '',
      rearSeat1Arm: aircraft?.armLengths?.rearSeat1Arm || '',
      rearSeat2Arm: aircraft?.armLengths?.rearSeat2Arm || '',
      standardBaggageArm: aircraft?.armLengths?.standardBaggageArm || '',
      baggageTubeArm: aircraft?.armLengths?.baggageTubeArm || '',
      aftBaggageExtensionArm: aircraft?.armLengths?.aftBaggageExtensionArm || ''
    },
    limitations: {
      maxLandingMass: aircraft?.limitations?.maxLandingMass || '',
      maxBaggageLest: aircraft?.limitations?.maxBaggageLest || ''
    },
    // Enveloppe de centrage
    cgEnvelope: {
      // Points CG avant (forward) - tableau dynamique
      forwardPoints: aircraft?.cgEnvelope?.forwardPoints && aircraft.cgEnvelope.forwardPoints.length > 0
        ? aircraft.cgEnvelope.forwardPoints
        : [{ weight: '', cg: '', id: Date.now() + Math.random() }],
      // CG arrière (aft)
      aftMinWeight: aircraft?.cgEnvelope?.aftMinWeight || '',  // Masse min pour CG arrière
      aftCG: aircraft?.cgEnvelope?.aftCG || '',  // CG arrière (constant ou à masse min)
      aftMaxWeight: aircraft?.cgEnvelope?.aftMaxWeight || '',  // Masse max pour CG arrière (si différente)
    },
    // Sièges supplémentaires dynamiques
    additionalSeats: aircraft?.additionalSeats || [],
    // Compartiments bagages dynamiques
    baggageCompartments: aircraft?.baggageCompartments && aircraft.baggageCompartments.length > 0
      ? aircraft.baggageCompartments
      : [
          { 
            id: Date.now() + Math.random(), 
            name: 'Compartiment standard', 
            arm: aircraft?.armLengths?.standardBaggageArm || '', 
            maxWeight: aircraft?.limitations?.maxBaggageLest || '' 
          }
        ],
    // Remarques du manuel
    manualRemarks: aircraft?.manualRemarks || '',
    emergencyNotes: aircraft?.emergencyNotes || '',
    maintenanceNotes: aircraft?.maintenanceNotes || '',
    // Analyse IA des performances
    performance: aircraft?.performance || null,
    // Section Équipements COM/NAV/APP
    equipmentCom: {
      vhf1: aircraft?.equipmentCom?.vhf1 !== false,  // VHF COM 1
      vhf2: aircraft?.equipmentCom?.vhf2 !== false,  // VHF COM 2
      hf: aircraft?.equipmentCom?.hf || false,  // HF
      satcom: aircraft?.equipmentCom?.satcom || false,  // SATCOM
      elt: aircraft?.equipmentCom?.elt !== false,  // ELT (Emergency Locator Transmitter)
      acars: aircraft?.equipmentCom?.acars || false,  // ACARS
      cpdlc: aircraft?.equipmentCom?.cpdlc || false  // CPDLC (Controller-Pilot Data Link)
    },
    equipmentNav: {
      vor: aircraft?.equipmentNav?.vor !== false,  // VOR
      dme: aircraft?.equipmentNav?.dme !== false,  // DME
      adf: aircraft?.equipmentNav?.adf || false,  // ADF
      gnss: aircraft?.equipmentNav?.gnss !== false,  // GNSS/GPS
      ils: aircraft?.equipmentNav?.ils !== false,  // ILS
      mls: aircraft?.equipmentNav?.mls || false,  // MLS
      rnav: aircraft?.equipmentNav?.rnav || false,  // RNAV
      rnavTypes: aircraft?.equipmentNav?.rnavTypes || '',  // Types RNAV (ex: "RNAV 10, RNAV 5, RNAV 1")
      rnp: aircraft?.equipmentNav?.rnp || false,  // RNP
      rnpTypes: aircraft?.equipmentNav?.rnpTypes || '',  // Types RNP (ex: "RNP 4, RNP 1, RNP APCH")
      gbas: aircraft?.equipmentNav?.gbas || false,  // GBAS Landing System
      lnav: aircraft?.equipmentNav?.lnav || false,  // LNAV
      vnav: aircraft?.equipmentNav?.vnav || false,  // VNAV
      lpv: aircraft?.equipmentNav?.lpv || false  // LPV approach
    },
    // Section Équipements de surveillance
    equipmentSurv: {
      transponderMode: aircraft?.equipmentSurv?.transponderMode || 'C',  // A, C, S ou None
      adsb: aircraft?.equipmentSurv?.adsb || false,  // ADS-B Out
      adsbIn: aircraft?.equipmentSurv?.adsbIn || false,  // ADS-B In
      tcas: aircraft?.equipmentSurv?.tcas || 'None',  // None, TCAS I, TCAS II
      gpws: aircraft?.equipmentSurv?.gpws || false,  // GPWS/TAWS
      egpws: aircraft?.equipmentSurv?.egpws || false,  // Enhanced GPWS
      taws: aircraft?.equipmentSurv?.taws || false,  // TAWS
      cvr: aircraft?.equipmentSurv?.cvr || false,  // Cockpit Voice Recorder
      fdr: aircraft?.equipmentSurv?.fdr || false,  // Flight Data Recorder
      ras: aircraft?.equipmentSurv?.ras || false,  // Runway Awareness System
      flarm: aircraft?.equipmentSurv?.flarm || false  // FLARM (collision avoidance)
    },
    // Capacités spéciales et remarques
    specialCapabilities: {
      rvsm: aircraft?.specialCapabilities?.rvsm || false,  // RVSM approved
      mnps: aircraft?.specialCapabilities?.mnps || false,  // MNPS approved
      etops: aircraft?.specialCapabilities?.etops || false,  // ETOPS
      etopsMinutes: aircraft?.specialCapabilities?.etopsMinutes || '',  // ETOPS time (60, 120, 180, etc.)
      catII: aircraft?.specialCapabilities?.catII || false,  // CAT II approach
      catIII: aircraft?.specialCapabilities?.catIII || false,  // CAT III approach
      pbn: aircraft?.specialCapabilities?.pbn || false,  // Performance Based Navigation
      remarks: aircraft?.specialCapabilities?.remarks || ''  // Remarques additionnelles
    },
    // Opérations approuvées
    approvedOperations: {
      vfrDay: aircraft?.approvedOperations?.vfrDay !== false,  // VFR jour (par défaut true)
      vfrNight: aircraft?.approvedOperations?.vfrNight || false,  // VFR nuit
      ifrDay: aircraft?.approvedOperations?.ifrDay || false,  // IFR jour
      ifrNight: aircraft?.approvedOperations?.ifrNight || false,  // IFR nuit
      svfr: aircraft?.approvedOperations?.svfr || false,  // Special VFR
      formation: aircraft?.approvedOperations?.formation || false,  // Vol en formation
      aerobatics: aircraft?.approvedOperations?.aerobatics || false,  // Voltige
      banner: aircraft?.approvedOperations?.banner || false,  // Remorquage de bannière
      glider: aircraft?.approvedOperations?.glider || false,  // Remorquage de planeur
      parachute: aircraft?.approvedOperations?.parachute || false,  // Largage de parachutistes
      agricultural: aircraft?.approvedOperations?.agricultural || false,  // Épandage agricole
      aerial: aircraft?.approvedOperations?.aerial || false,  // Photographie/surveillance aérienne
      training: aircraft?.approvedOperations?.training || false,  // École de pilotage
      charter: aircraft?.approvedOperations?.charter || false,  // Transport public
      mountainous: aircraft?.approvedOperations?.mountainous || false,  // Vol en montagne
      seaplane: aircraft?.approvedOperations?.seaplane || false,  // Hydravion
      skiPlane: aircraft?.approvedOperations?.skiPlane || false,  // Avion sur skis
      icing: aircraft?.approvedOperations?.icing || false  // Vol en conditions givrantes
    }
  });

  // Réinitialiser le formulaire quand l'avion change
  React.useEffect(() => {
    // console.log('🔄 AircraftForm - useEffect triggered, aircraft changed:', aircraft?.id);
    if (aircraft) {
      // console.log('🔄 AircraftForm - Réinitialisation avec les nouvelles surfaces:', aircraft.compatibleRunwaySurfaces);
      setFormData({
        registration: aircraft?.registration || '',
        model: aircraft?.model || '',
        fuelType: aircraft?.fuelType || 'AVGAS',
        fuelCapacity: aircraft?.fuelCapacity || '',
        cruiseSpeedKt: aircraft?.cruiseSpeedKt || aircraft?.cruiseSpeed || '',
        baseFactor: aircraft?.baseFactor || '',
        fuelConsumption: aircraft?.fuelConsumption || '',
        maxTakeoffWeight: aircraft?.maxTakeoffWeight || '',
        wakeTurbulenceCategory: aircraft?.wakeTurbulenceCategory || 'L',
        engineType: aircraft?.engineType || 'singleEngine',
        compatibleRunwaySurfaces: getValidSurfaces(aircraft?.compatibleRunwaySurfaces),
        speeds: {
          vso: aircraft?.speeds?.vso || aircraft?.manex?.performances?.vso || '',
          vs1: aircraft?.speeds?.vs1 || aircraft?.manex?.performances?.vs1 || '',
          vfe: aircraft?.speeds?.vfe || aircraft?.manex?.performances?.vfe || '',
          vfeLdg: aircraft?.speeds?.vfeLdg || '',
          vfeTO: aircraft?.speeds?.vfeTO || '',
          vno: aircraft?.speeds?.vno || aircraft?.manex?.performances?.vno || '',
          vne: aircraft?.speeds?.vne || aircraft?.manex?.performances?.vne || '',
          vx: aircraft?.speeds?.vx || aircraft?.manex?.performances?.vx || '',
          vy: aircraft?.speeds?.vy || aircraft?.manex?.performances?.vy || '',
          vapp: aircraft?.speeds?.vapp || '',
          vle: aircraft?.speeds?.vle || '',
          vlo: aircraft?.speeds?.vlo || '',
          initialClimb: aircraft?.speeds?.initialClimb || '',
          vglide: aircraft?.speeds?.vglide || '',
          // VO - Operating manoeuvring speed
          voWeight1: aircraft?.speeds?.voWeight1 || '',
          voSpeed1: aircraft?.speeds?.voSpeed1 || '',
          voWeight2Min: aircraft?.speeds?.voWeight2Min || '',
          voWeight2Max: aircraft?.speeds?.voWeight2Max || '',
          voSpeed2: aircraft?.speeds?.voSpeed2 || '',
          voWeight3: aircraft?.speeds?.voWeight3 || '',
          voSpeed3: aircraft?.speeds?.voSpeed3 || ''
        },
        distances: {
          takeoffRoll: aircraft?.distances?.takeoffRoll || aircraft?.manex?.performances?.takeoffRoll || '',
          takeoffDistance15m: aircraft?.distances?.takeoffDistance15m || '',
          takeoffDistance50ft: aircraft?.distances?.takeoffDistance50ft || aircraft?.manex?.performances?.takeoffDistance || '',
          landingRoll: aircraft?.distances?.landingRoll || aircraft?.manex?.performances?.landingRoll || '',
          landingDistance15m: aircraft?.distances?.landingDistance15m || '',
          landingDistance50ft: aircraft?.distances?.landingDistance50ft || aircraft?.manex?.performances?.landingDistance || ''
        },
        climb: {
          rateOfClimb: aircraft?.climb?.rateOfClimb || '',
          serviceCeiling: aircraft?.climb?.serviceCeiling || '',
          climbGradient: aircraft?.climb?.climbGradient || ''
        },
        windLimits: {
          maxCrosswind: aircraft?.windLimits?.maxCrosswind || aircraft?.manex?.limitations?.maxCrosswind || '',
          maxTailwind: aircraft?.windLimits?.maxTailwind || aircraft?.manex?.limitations?.maxTailwind || '',
          maxCrosswindWet: aircraft?.windLimits?.maxCrosswindWet || ''
        },
        masses: {
          emptyMass: aircraft?.masses?.emptyMass || '',
          minTakeoffMass: aircraft?.masses?.minTakeoffMass || '',
          baseFactor: aircraft?.masses?.baseFactor || '',
          maxBaggageTube: aircraft?.masses?.maxBaggageTube || '',
          maxAftBaggageExtension: aircraft?.masses?.maxAftBaggageExtension || ''
        },
        armLengths: {
          emptyMassArm: aircraft?.armLengths?.emptyMassArm || '',
          fuelArm: aircraft?.armLengths?.fuelArm || '',
          frontSeat1Arm: aircraft?.armLengths?.frontSeat1Arm || '',
          frontSeat2Arm: aircraft?.armLengths?.frontSeat2Arm || '',
          rearSeat1Arm: aircraft?.armLengths?.rearSeat1Arm || '',
          rearSeat2Arm: aircraft?.armLengths?.rearSeat2Arm || '',
          standardBaggageArm: aircraft?.armLengths?.standardBaggageArm || '',
          baggageTubeArm: aircraft?.armLengths?.baggageTubeArm || '',
          aftBaggageExtensionArm: aircraft?.armLengths?.aftBaggageExtensionArm || ''
        },
        limitations: {
          maxLandingMass: aircraft?.limitations?.maxLandingMass || '',
          maxBaggageLest: aircraft?.limitations?.maxBaggageLest || ''
        },
        // Enveloppe de centrage
        cgEnvelope: {
          forwardPoints: aircraft?.cgEnvelope?.forwardPoints && aircraft.cgEnvelope.forwardPoints.length > 0
            ? aircraft.cgEnvelope.forwardPoints
            : [{ weight: '', cg: '', id: Date.now() + Math.random() }],
          aftMinWeight: aircraft?.cgEnvelope?.aftMinWeight || '',
          aftCG: aircraft?.cgEnvelope?.aftCG || '',
          aftMaxWeight: aircraft?.cgEnvelope?.aftMaxWeight || '',
        },
        // Compartiments bagages dynamiques
        baggageCompartments: aircraft?.baggageCompartments && aircraft.baggageCompartments.length > 0
          ? aircraft.baggageCompartments
          : [
              { 
                id: Date.now() + Math.random(), 
                name: 'Compartiment standard', 
                arm: aircraft?.armLengths?.standardBaggageArm || '', 
                maxWeight: aircraft?.limitations?.maxBaggageLest || '' 
              }
            ],
        // Remarques du manuel
        manualRemarks: aircraft?.manualRemarks || '',
        emergencyNotes: aircraft?.emergencyNotes || '',
        maintenanceNotes: aircraft?.maintenanceNotes || '',
        equipmentCom: aircraft?.equipmentCom || {
          vhf1: true,
          vhf2: true,
          hf: false,
          satcom: false,
          elt: true,
          acars: false,
          cpdlc: false
        },
        equipmentNav: aircraft?.equipmentNav || {
          vor: true,
          dme: true,
          adf: false,
          gnss: true,
          ils: true,
          mls: false,
          rnav: false,
          rnavTypes: '',
          rnp: false,
          rnpTypes: '',
          gbas: false,
          lnav: false,
          vnav: false,
          lpv: false
        },
        equipmentSurv: aircraft?.equipmentSurv || {
          transponderMode: 'C',
          adsb: false,
          adsbIn: false,
          tcas: 'None',
          gpws: false,
          egpws: false,
          taws: false,
          cvr: false,
          fdr: false,
          ras: false,
          flarm: false
        },
        specialCapabilities: aircraft?.specialCapabilities || {
          rvsm: false,
          mnps: false,
          etops: false,
          etopsMinutes: '',
          catII: false,
          catIII: false,
          pbn: false,
          remarks: ''
        },
        approvedOperations: aircraft?.approvedOperations || {
          vfrDay: true,
          vfrNight: false,
          ifrDay: false,
          ifrNight: false,
          svfr: false,
          formation: false,
          aerobatics: false,
          banner: false,
          glider: false,
          parachute: false,
          agricultural: false,
          aerial: false,
          training: false,
          charter: false,
          mountainous: false,
          seaplane: false,
          skiPlane: false,
          icing: false
        },
        // Ajouter les performances avancées si elles existent
        advancedPerformance: aircraft?.advancedPerformance || null
      });
    }
  }, [aircraft?.id]); // Se déclenche SEULEMENT quand l'ID de l'avion change

  // Fonctions pour gérer les compartiments bagages dynamiques
  const addBaggageCompartment = () => {
    setFormData(prev => {
      const currentCompartments = prev.baggageCompartments || [];
      return {
        ...prev,
        baggageCompartments: [
          ...currentCompartments,
          { 
            id: Date.now() + Math.random(), 
            name: `Compartiment ${currentCompartments.length + 1}`, 
            arm: '', 
            maxWeight: '' 
          }
        ]
      };
    });
  };

  const removeBaggageCompartment = (compartmentId) => {
    setFormData(prev => ({
      ...prev,
      baggageCompartments: (prev.baggageCompartments || []).filter(c => c.id !== compartmentId)
    }));
  };

  const updateBaggageCompartment = (compartmentId, field, value) => {
    setFormData(prev => ({
      ...prev,
      baggageCompartments: (prev.baggageCompartments || []).map(c => 
        c.id === compartmentId ? { ...c, [field]: value } : c
      )
    }));
  };

  // Fonctions pour gérer les sièges supplémentaires
  const addAdditionalSeat = () => {
    setFormData(prev => {
      const currentSeats = prev.additionalSeats || [];
      return {
        ...prev,
        additionalSeats: [
          ...currentSeats,
          { 
            id: Date.now() + Math.random(), 
            name: `Siège ${currentSeats.length + 5}`, // +5 car on a déjà 4 sièges standard
            arm: ''
          }
        ]
      };
    });
  };

  const removeAdditionalSeat = (seatId) => {
    setFormData(prev => ({
      ...prev,
      additionalSeats: (prev.additionalSeats || []).filter(s => s.id !== seatId)
    }));
  };

  const updateAdditionalSeat = (seatId, field, value) => {
    setFormData(prev => ({
      ...prev,
      additionalSeats: (prev.additionalSeats || []).map(s => 
        s.id === seatId ? { ...s, [field]: value } : s
      )
    }));
  };

  // Fonctions pour gérer les points CG avant
  const addForwardPoint = () => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: [
          ...prev.cgEnvelope.forwardPoints,
          { weight: '', cg: '', id: Date.now() + Math.random() }
        ]
      }
    }));
  };

  const removeForwardPoint = (pointId) => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: prev.cgEnvelope.forwardPoints.filter(point => point.id !== pointId)
      }
    }));
  };

  const updateForwardPoint = (pointId, field, value) => {
    setFormData(prev => ({
      ...prev,
      cgEnvelope: {
        ...prev.cgEnvelope,
        forwardPoints: prev.cgEnvelope.forwardPoints.map(point => 
          point.id === pointId 
            ? { ...point, [field]: value }
            : point
        )
      }
    }));
  };

  const handleChange = (field, value, index = null) => {
    if (field === 'cruiseSpeedKt') {
      // Calculer automatiquement le facteur de base
      const speed = parseFloat(value);
      const baseFactor = speed > 0 ? (60 / speed).toFixed(3) : '';
      
      setFormData(prev => ({
        ...prev,
        cruiseSpeedKt: value,
        baseFactor: baseFactor
      }));
    } else if (field === 'maxTakeoffWeight') {
      // Auto-déterminer la catégorie de turbulence basée sur MTOW
      const mtow = parseFloat(value);
      let category = formData.wakeTurbulenceCategory;
      
      if (!isNaN(mtow)) {
        if (mtow <= 7000) {
          category = 'L';
        } else if (mtow <= 136000) {
          category = 'M';
        } else {
          category = 'H';
        }
      }
      
      setFormData(prev => ({
        ...prev,
        maxTakeoffWeight: value,
        wakeTurbulenceCategory: category
      }));
    } else if (field === 'compatibleRunwaySurfaces') {
      // Gestion des surfaces compatibles (toggle)
      // console.log('🔄 Toggle surface:', value);
      // console.log('🔄 Surfaces actuelles:', formData.compatibleRunwaySurfaces);
      
      setFormData(prev => {
        const surfaces = prev.compatibleRunwaySurfaces || [];
        let newSurfaces;
        
        if (surfaces.includes(value)) {
          // Retirer la surface
          newSurfaces = surfaces.filter(s => s !== value);
          // console.log('🔄 Surface retirée:', value);
        } else {
          // Ajouter la surface
          newSurfaces = [...surfaces, value];
          // console.log('🔄 Surface ajoutée:', value);
        }
        
        // console.log('🔄 Nouvelles surfaces après toggle:', newSurfaces);
        // console.log('🔄 Type du nouveau tableau:', typeof newSurfaces);
        // console.log('🔄 Est un tableau:', Array.isArray(newSurfaces));
        
        const newFormData = {
          ...prev,
          compatibleRunwaySurfaces: newSurfaces
        };
        
        // console.log('🔄 Nouveau formData surfaces:', newFormData.compatibleRunwaySurfaces);
        
        return newFormData;
      });
    } else if (field.includes('.')) {
      const parts = field.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setFormData(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    console.log('🟢 handleSubmit APPELÉ !');
    e.preventDefault();
    
    console.log('📋 handleSubmit - Début de la validation');
    console.log('📋 handleSubmit - Registration:', formData.registration);
    console.log('📋 handleSubmit - Model:', formData.model);
    console.log('📋 handleSubmit - FormData complet:', formData);
    console.log('📋 handleSubmit - Surfaces:', formData.compatibleRunwaySurfaces);
    
    if (!formData.registration || !formData.model) {
      alert('L\'immatriculation et le modèle sont obligatoires');
      return;
    }
    
    // Valider que l'immatriculation n'a pas de caractères spéciaux problématiques
    if (!/^[A-Za-z0-9\-]+$/.test(formData.registration)) {
      alert('L\'immatriculation ne peut contenir que des lettres, chiffres et tirets');
      return;
    }
    if (!formData.compatibleRunwaySurfaces || formData.compatibleRunwaySurfaces.length === 0) {
      console.log('❌ handleSubmit - Validation des surfaces échouée');
      console.log('❌ handleSubmit - Surfaces actuelles:', formData.compatibleRunwaySurfaces);
      alert('Vous devez sélectionner au moins un type de piste compatible');
      return;
    }
    
    console.log('✅ handleSubmit - Toutes les validations passées');

    // DEBUG : Afficher les surfaces compatibles avant de sauvegarder
    console.log('🛩️ Surfaces compatibles sélectionnées:', formData.compatibleRunwaySurfaces);

    // Fonction helper pour valider et convertir les nombres
    const toValidNumber = (value, defaultValue = 0) => {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    };

    // DEBUG : Vérifier les surfaces avant traitement
    console.log('💾 handleSubmit - formData.compatibleRunwaySurfaces:', formData.compatibleRunwaySurfaces);
    console.log('💾 handleSubmit - Type:', typeof formData.compatibleRunwaySurfaces);
    console.log('💾 handleSubmit - Est un tableau:', Array.isArray(formData.compatibleRunwaySurfaces));

    const processedData = {
      ...formData,
      fuelCapacity: toValidNumber(formData.fuelCapacity, 0),
      cruiseSpeed: toValidNumber(formData.cruiseSpeedKt, 0), // Ajouter cruiseSpeed pour compatibilité
      cruiseSpeedKt: toValidNumber(formData.cruiseSpeedKt, 0),
      baseFactor: formData.baseFactor || (formData.cruiseSpeedKt ? (60 / parseFloat(formData.cruiseSpeedKt)).toFixed(3) : ''),
      fuelConsumption: toValidNumber(formData.fuelConsumption, 0),
      maxTakeoffWeight: toValidNumber(formData.maxTakeoffWeight, 0),
      wakeTurbulenceCategory: formData.wakeTurbulenceCategory,
      compatibleRunwaySurfaces: formData.compatibleRunwaySurfaces || [],
      // Nouvelles sections de performances
      speeds: Object.values(formData.speeds).some(v => v)
        ? {
            vso: toValidNumber(formData.speeds.vso, 0),
            vs1: toValidNumber(formData.speeds.vs1, 0),
            vr: toValidNumber(formData.speeds.vr, 0),
            vfe: toValidNumber(formData.speeds.vfe, 0), // Garder pour compatibilité
            vfeLdg: toValidNumber(formData.speeds.vfeLdg, 0),
            vfeTO: toValidNumber(formData.speeds.vfeTO, 0),
            vno: toValidNumber(formData.speeds.vno, 0),
            vne: toValidNumber(formData.speeds.vne, 0),
            vx: toValidNumber(formData.speeds.vx, 0),
            vy: toValidNumber(formData.speeds.vy, 0),
            vapp: toValidNumber(formData.speeds.vapp, 0),
            vle: toValidNumber(formData.speeds.vle, 0),
            vlo: toValidNumber(formData.speeds.vlo, 0),
            initialClimb: toValidNumber(formData.speeds.initialClimb, 0),
            vglide: toValidNumber(formData.speeds.vglide, 0),
            // VO - Operating manoeuvring speed
            voWeight1: toValidNumber(formData.speeds.voWeight1, 0),
            voSpeed1: toValidNumber(formData.speeds.voSpeed1, 0),
            voWeight2Min: toValidNumber(formData.speeds.voWeight2Min, 0),
            voWeight2Max: toValidNumber(formData.speeds.voWeight2Max, 0),
            voSpeed2: toValidNumber(formData.speeds.voSpeed2, 0),
            voWeight3: toValidNumber(formData.speeds.voWeight3, 0),
            voSpeed3: toValidNumber(formData.speeds.voSpeed3, 0)
          }
        : undefined,
      distances: Object.values(formData.distances).some(v => v)
        ? {
            takeoffRoll: toValidNumber(formData.distances.takeoffRoll, 0),
            takeoffDistance15m: toValidNumber(formData.distances.takeoffDistance15m, 0),
            takeoffDistance50ft: toValidNumber(formData.distances.takeoffDistance50ft, 0),
            landingRoll: toValidNumber(formData.distances.landingRoll, 0),
            landingDistance15m: toValidNumber(formData.distances.landingDistance15m, 0),
            landingDistance50ft: toValidNumber(formData.distances.landingDistance50ft, 0)
          }
        : undefined,
      climb: Object.values(formData.climb).some(v => v)
        ? {
            rateOfClimb: toValidNumber(formData.climb.rateOfClimb, 0),
            serviceCeiling: toValidNumber(formData.climb.serviceCeiling, 0),
            climbGradient: toValidNumber(formData.climb.climbGradient, 0)
          }
        : undefined,
      windLimits: Object.values(formData.windLimits).some(v => v)
        ? {
            maxCrosswind: toValidNumber(formData.windLimits.maxCrosswind, 0),
            maxTailwind: toValidNumber(formData.windLimits.maxTailwind, 0),
            maxCrosswindWet: toValidNumber(formData.windLimits.maxCrosswindWet, 0)
          }
        : undefined,
      masses: Object.values(formData.masses).some(v => v)
        ? {
            emptyMass: toValidNumber(formData.masses.emptyMass, 0),
            minTakeoffMass: toValidNumber(formData.masses.minTakeoffMass, 0),
            baseFactor: toValidNumber(formData.masses.baseFactor, 0),
            maxBaggageTube: toValidNumber(formData.masses.maxBaggageTube, 0),
            maxAftBaggageExtension: toValidNumber(formData.masses.maxAftBaggageExtension, 0)
          }
        : undefined,
      armLengths: Object.values(formData.armLengths).some(v => v)
        ? {
            emptyMassArm: toValidNumber(formData.armLengths.emptyMassArm, 0),
            fuelArm: toValidNumber(formData.armLengths.fuelArm, 0),
            frontSeat1Arm: toValidNumber(formData.armLengths.frontSeat1Arm, 0),
            frontSeat2Arm: toValidNumber(formData.armLengths.frontSeat2Arm, 0),
            rearSeat1Arm: toValidNumber(formData.armLengths.rearSeat1Arm, 0),
            rearSeat2Arm: toValidNumber(formData.armLengths.rearSeat2Arm, 0),
            standardBaggageArm: toValidNumber(formData.armLengths.standardBaggageArm, 0),
            baggageTubeArm: toValidNumber(formData.armLengths.baggageTubeArm, 0),
            aftBaggageExtensionArm: toValidNumber(formData.armLengths.aftBaggageExtensionArm, 0)
          }
        : undefined,
      limitations: Object.values(formData.limitations).some(v => v)
        ? {
            maxLandingMass: toValidNumber(formData.limitations.maxLandingMass, 0),
            maxBaggageLest: toValidNumber(formData.limitations.maxBaggageLest, 0)
          }
        : undefined,
      // Enveloppe de centrage - TOUJOURS sauvegarder pour préserver les points en cours de saisie
      cgEnvelope: {
        forwardPoints: formData.cgEnvelope.forwardPoints.map(point => ({
          weight: point.weight || '',
          cg: point.cg || '',
          id: point.id
        })),
        aftMinWeight: formData.cgEnvelope.aftMinWeight || '',
        aftCG: formData.cgEnvelope.aftCG || '',
        aftMaxWeight: formData.cgEnvelope.aftMaxWeight || '',
      },
      
      // Mettre à jour weightBalance avec les données armLengths ET cgLimits
      weightBalance: {
        ...aircraft?.weightBalance,
        // Mapper les bras de levier depuis armLengths vers la structure attendue par WeightBalance
        emptyWeightArm: toValidNumber(formData.armLengths.emptyMassArm, 2.00),
        frontLeftSeatArm: toValidNumber(formData.armLengths.frontSeat1Arm, 2.00),
        frontRightSeatArm: toValidNumber(formData.armLengths.frontSeat2Arm, 2.00),
        rearLeftSeatArm: toValidNumber(formData.armLengths.rearSeat1Arm, 2.90),
        rearRightSeatArm: toValidNumber(formData.armLengths.rearSeat2Arm, 2.90),
        baggageArm: toValidNumber(formData.armLengths.standardBaggageArm, 3.50),
        auxiliaryArm: toValidNumber(formData.armLengths.aftBaggageExtensionArm || formData.armLengths.baggageTubeArm, 3.70),
        fuelArm: toValidNumber(formData.armLengths.fuelArm, 2.18),
        // CG Limits
        ...((formData.cgEnvelope.forwardPoints.some(p => p.weight && p.cg) || 
             formData.cgEnvelope.aftCG) ? {
          cgLimits: {
            forward: formData.cgEnvelope.forwardPoints.length > 0 ? 
              toValidNumber(formData.cgEnvelope.forwardPoints[0].cg, aircraft?.weightBalance?.cgLimits?.forward || 2.00) :
              aircraft?.weightBalance?.cgLimits?.forward || 2.00,
            aft: toValidNumber(formData.cgEnvelope.aftCG, aircraft?.weightBalance?.cgLimits?.aft || 2.45),
            forwardVariable: formData.cgEnvelope.forwardPoints
              .filter(point => point.weight && point.cg)
              .map(point => ({
                weight: toValidNumber(point.weight, 0),
                cg: toValidNumber(point.cg, 0)
              }))
              .filter(point => point.weight > 0 && point.cg > 0)
              .sort((a, b) => a.weight - b.weight)
          }
        } : {
          cgLimits: {
            forward: 2.00,
            aft: 2.45
          }
        })
      },
      // Ajouter aussi les masses importantes pour le module Weight & Balance
      emptyWeight: toValidNumber(formData.masses.emptyMass, 600),
      minTakeoffWeight: toValidNumber(formData.masses.minTakeoffMass, 600),
      maxBaggageWeight: toValidNumber(formData.limitations.maxBaggageLest, 50),
      maxAuxiliaryWeight: 20, // Valeur par défaut pour rangement annexe
      // Équipements
      equipmentCom: formData.equipmentCom,
      equipmentNav: formData.equipmentNav,
      equipmentSurv: formData.equipmentSurv,
      specialCapabilities: formData.specialCapabilities,
      // Opérations approuvées
      approvedOperations: formData.approvedOperations,
      // Sièges supplémentaires
      additionalSeats: formData.additionalSeats || [],
      // Compartiments bagages dynamiques
      baggageCompartments: formData.baggageCompartments || [],
      // Remarques du manuel
      manualRemarks: formData.manualRemarks || '',
      emergencyNotes: formData.emergencyNotes || '',
      maintenanceNotes: formData.maintenanceNotes || '',
      // Analyse IA des performances
      performance: formData.performance || null,
      // Performances avancées extraites par IA
      advancedPerformance: formData.advancedPerformance || null,
      // Photo de l'avion
      photo: aircraftPhoto
    };

    // DEBUG : Afficher les données complètes avant de sauvegarder
    console.log('💾 AircraftForm - processedData complet:', processedData);
    console.log('💾 AircraftForm - compatibleRunwaySurfaces dans processedData:', processedData.compatibleRunwaySurfaces);

    try {
      onSubmit(processedData);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const inputStyle = sx.combine(
    sx.components.input.base,
    sx.spacing.mb(3)
  );

  const labelStyle = sx.combine(
    sx.text.sm,
    sx.text.bold,
    sx.spacing.mb(1),
    { display: 'flex', alignItems: 'center', color: '#000000' }
  );

  const buttonSectionStyle = {
    width: '100%',
    padding: '12px !important',
    backgroundColor: 'rgba(55, 65, 81, 0.35) !important',
    color: 'white !important',
    border: '1px solid rgba(0, 0, 0, 0.7) !important',
    borderRadius: '8px !important',
    fontSize: '16px !important',
    fontWeight: 'bold !important',
    cursor: 'pointer !important',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s !important',
    background: 'rgba(55, 65, 81, 0.35) !important',
    textTransform: 'none !important',
    letterSpacing: 'normal !important'
  };

  return (
    <form onSubmit={handleSubmit} style={{ color: '#000000' }}>
      {/* Section Général */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showGeneral}
          onClick={() => setShowGeneral(!showGeneral)}
          icon="📋"
          title="Général"
        />
      </div>

      {showGeneral && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', color: '#000000' }}>
          <>
            {/* Informations de base */}
            <div style={{ color: '#000000' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', WebkitTextFillColor: '#000000', opacity: 1, filter: 'none' }}>
                Informations générales
              </h4>
              
              {/* Photo de l'avion */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Photo de l'avion</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  {aircraftPhoto ? (
                    <div style={{ position: 'relative', width: '200px', height: '150px' }}>
                      <img 
                        src={aircraftPhoto} 
                        alt="Aircraft" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '1px solid #d1d5db'
                        }} 
                      />
                      <button
                        type="button"
                        onClick={() => setAircraftPhoto(null)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ 
                      width: '200px', 
                      height: '150px', 
                      border: '2px dashed #d1d5db',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f9fafb'
                    }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Aucune photo</p>
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="file"
                      id="aircraft-photo"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="aircraft-photo"
                      style={{
                        ...window.buttonSectionStyle,
                        cursor: 'pointer',
                        display: 'inline-block'
                      }}
                    >
                      {aircraftPhoto ? 'Changer la photo' : 'Ajouter une photo'}
                    </label>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', textAlign: 'center' }}>
                      Max 5MB • JPG, PNG
                    </p>
                  </div>
                </div>
              </div>
              
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Immatriculation *</label>
              <input
                type="text"
                value={formData.registration}
                onChange={(e) => handleChange('registration', e.target.value)}
                placeholder="F-GXXX"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Modèle *</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Cessna 172"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Type de moteur */}
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>
              Type de moteur *
              <InfoIcon tooltip="Type de motorisation de l'aéronef" />
            </label>
            <select
              value={formData.engineType || 'singleEngine'}
              onChange={(e) => handleChange('engineType', e.target.value)}
              style={inputStyle}
              required
            >
              <option value="singleEngine">Monomoteur à pistons</option>
              <option value="multiEngine">Multimoteur à pistons</option>
              <option value="turboprop">Turbopropulseur</option>
              <option value="jet">Réacteur (Jet)</option>
              <option value="electric">Électrique</option>
            </select>
          </div>

          {/* Catégorie de turbulence de sillage */}
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>
              Catégorie de turbulence de sillage *
            </label>
            <select
              value={formData.wakeTurbulenceCategory}
              onChange={(e) => handleChange('wakeTurbulenceCategory', e.target.value)}
              style={inputStyle}
              required
            >
              <option value="L">L - Light / Léger (MTOW &lt;= 7 000 kg)</option>
              <option value="M">M - Medium / Moyen (7 000 kg &lt; MTOW &lt;= 136 000 kg)</option>
              <option value="H">H - Heavy / Lourd (MTOW &gt; 136 000 kg)</option>
              <option value="J">J - Super (A380, An-225)</option>
            </select>
          </div>
        </div>

        {/* Carburant */}
        <div style={{ color: '#000000' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', WebkitTextFillColor: '#000000', opacity: 1, filter: 'none' }}>
            Carburant
          </h4>
          {/* Première ligne : Type et capacités */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Type de carburant</label>
              <select
                value={formData.fuelType}
                onChange={(e) => handleChange('fuelType', e.target.value)}
                style={inputStyle}
              >
                <option value="AVGAS">AVGAS 100LL</option>
                <option value="JET-A1">JET A-1</option>
                <option value="MOGAS">MOGAS</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Capacité ({fuelUnit})</label>
              <input
                type="number"
                value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelCapacity, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelCapacity}
                onChange={(e) => {
                  const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                  handleChange('fuelCapacity', valueInStorageUnit);
                }}
                placeholder={getUnit('fuel') === 'gal' ? "53" : getUnit('fuel') === 'kg' ? "160" : "200"}
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Consommation ({consumptionUnit})</label>
              <input
                type="number"
                value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelConsumption, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelConsumption}
                onChange={(e) => {
                  const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                  handleChange('fuelConsumption', valueInStorageUnit);
                }}
                placeholder={getUnit('fuel') === 'gal' ? "9.2" : getUnit('fuel') === 'kg' ? "28" : "35"}
                min="0"
                step="0.1"
                style={inputStyle}
              />
            </div>
          </div>
          
          {/* Deuxième ligne : Vitesse et facteur de base */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Vitesse de croisière (kt)
                <InfoIcon tooltip="Vitesse de croisière en nœuds (knots)" />
              </label>
              <input
                type="number"
                value={formData.cruiseSpeedKt}
                onChange={(e) => handleChange('cruiseSpeedKt', e.target.value)}
                placeholder="120"
                min="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Facteur de base (min/NM)
                <InfoIcon tooltip="Calculé automatiquement : 60 / vitesse de croisière" />
              </label>
              <div>
                <input
                  type="text"
                  value={formData.baseFactor || (formData.cruiseSpeedKt ? (60 / parseFloat(formData.cruiseSpeedKt)).toFixed(3) : '')}
                  readOnly
                  style={{
                    ...inputStyle, 
                    backgroundColor: '#f3f4f6', 
                    cursor: 'not-allowed',
                    fontWeight: '600',
                    color: formData.baseFactor ? '#059669' : '#9ca3af'
                  }}
                  placeholder="Auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Types de pistes compatibles */}
        <div style={{ color: '#000000' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', WebkitTextFillColor: '#000000', opacity: 1, filter: 'none' }}>
            Types de pistes compatibles
          </h4>
          <div>
            <label style={labelStyle}>Type de surfaces compatibles *</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '8px',
              marginTop: '8px'
            }}>
              {[
                { code: 'ASPH', name: 'Asphalte', icon: '🛣️' },
                { code: 'CONC', name: 'Béton', icon: '🏗️' },
                { code: 'GRASS', name: 'Herbe', icon: '🌱' },
                { code: 'GRVL', name: 'Gravier', icon: '🪨' },
                { code: 'UNPAVED', name: 'Terre', icon: '🏜️' },
                { code: 'SAND', name: 'Sable', icon: '🏖️' },
                { code: 'SNOW', name: 'Neige', icon: '❄️' },
                { code: 'WATER', name: 'Eau', icon: '💧' }
              ].map(surface => (
                <label
                  key={surface.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: formData.compatibleRunwaySurfaces?.includes(surface.code) ? '#3b82f6' : 'white',
                    color: formData.compatibleRunwaySurfaces?.includes(surface.code) ? 'white' : '#374151',
                    border: `1px solid ${formData.compatibleRunwaySurfaces?.includes(surface.code) ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.compatibleRunwaySurfaces?.includes(surface.code) || false}
                    onChange={() => handleChange('compatibleRunwaySurfaces', surface.code)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ marginRight: '6px' }}>{surface.icon}</span>
                  <span>{surface.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
          </>
        </div>
      )}

      {/* Section Performances */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showPerformances}
          onClick={() => setShowPerformances(!showPerformances)}
          icon="✈️"
          title="Vitesses et Limitations"
        />
      </div>

      {showPerformances && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>
            {/* Section Performances - Vitesses caractéristiques */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>✈️</span>
            Vitesses caractéristiques (kt)
            <InfoIcon tooltip="Vitesses de référence pour les différentes phases de vol" />
          </h4>
          
          {/* Vitesses critiques pour les arcs de l'indicateur */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '2px solid #374151'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
              Vitesses critiques de l'indicateur de vitesse
            </h5>
            
            {/* Arcs de limitation de vitesse (Airspeed Indicator Markings) */}
            <div style={{
              backgroundColor: '#1f2937',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <h6 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                🎯 Arcs de limitation de vitesse (Airspeed Indicator Markings)
              </h6>
              
              {/* Indicateur visuel des arcs */}
              <div style={{
                backgroundColor: '#374151',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                position: 'relative',
                minHeight: '120px'
              }}>
                {/* Calcul et affichage des arcs */}
                {(() => {
                  const vso = parseFloat(formData.speeds.vso) || 0;
                  const vs1 = parseFloat(formData.speeds.vs1) || 0;
                  const vfeLdg = parseFloat(formData.speeds.vfeLdg) || 0;
                  const vfeTO = parseFloat(formData.speeds.vfeTO) || 0;
                  const vno = parseFloat(formData.speeds.vno) || 0;
                  const vne = parseFloat(formData.speeds.vne) || 0;
                  
                  // VO - Déterminer la vitesse VO basée sur la masse actuelle (utiliser la plus restrictive par défaut)
                  const voSpeed1 = parseFloat(formData.speeds.voSpeed1) || 0;
                  const voSpeed2 = parseFloat(formData.speeds.voSpeed2) || 0;
                  const voSpeed3 = parseFloat(formData.speeds.voSpeed3) || 0;
                  // Afficher la VO la plus élevée (la plus restrictive)
                  const vo = Math.max(voSpeed1, voSpeed2, voSpeed3);
                  
                  // Calculer la vitesse max pour l'échelle
                  const maxSpeed = Math.max(vne * 1.1, 200);
                  const scale = 100 / maxSpeed;
                  
                  return (
                    <>
                      {/* Échelle de vitesse */}
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '20px',
                        right: '20px',
                        height: '4px',
                        backgroundColor: '#4b5563',
                        borderRadius: '2px'
                      }}>
                        {/* Arc blanc - Volets sortis (Vso à VfeLdg) */}
                        {vso > 0 && vfeLdg > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vso * scale}%`,
                              width: `${(vfeLdg - vso) * scale}%`,
                              height: '20px',
                              backgroundColor: 'white',
                              bottom: '0',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc blanc: ${vso} - ${vfeLdg} kt (Plage volets)`}
                          />
                        )}
                        
                        {/* Arc vert - Vol normal (Vs1 à Vno) */}
                        {vs1 > 0 && vno > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vs1 * scale}%`,
                              width: `${(vno - vs1) * scale}%`,
                              height: '20px',
                              backgroundColor: '#10b981',
                              bottom: '25px',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc vert: ${vs1} - ${vno} kt (Plage normale)`}
                          />
                        )}
                        
                        {/* Arc jaune - Précaution (Vno à Vne) */}
                        {vno > 0 && vne > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vno * scale}%`,
                              width: `${(vne - vno) * scale}%`,
                              height: '20px',
                              backgroundColor: '#fbbf24',
                              bottom: '25px',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                            title={`Arc jaune: ${vno} - ${vne} kt (Précaution)`}
                          />
                        )}
                        
                        {/* Trait rouge - Vne */}
                        {vne > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vne * scale}%`,
                              width: '3px',
                              height: '40px',
                              backgroundColor: '#dc2626',
                              bottom: '15px',
                              borderRadius: '2px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}
                            title={`Trait rouge: ${vne} kt (Ne jamais dépasser)`}
                          />
                        )}
                        
                        {/* Trait blanc - VFE T/O */}
                        {vfeTO > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vfeTO * scale}%`,
                              width: '2px',
                              height: '30px',
                              backgroundColor: 'white',
                              bottom: '10px',
                              borderRadius: '1px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                            }}
                            title={`VFE T/O: ${vfeTO} kt (Max volets décollage)`}
                          />
                        )}
                        
                        {/* Trait blanc pointillé - VO (Operating manoeuvring speed) */}
                        {vo > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${vo * scale}%`,
                              width: '2px',
                              height: '35px',
                              background: 'repeating-linear-gradient(to bottom, white 0px, white 4px, transparent 4px, transparent 8px)',
                              bottom: '12px',
                              borderRadius: '1px',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                            }}
                            title={`VO: ${vo} kt (Operating manoeuvring speed - ne pas faire de mouvements brusques au-dessus)`}
                          />
                        )}
                      </div>
                      
                      {/* Labels de vitesse */}
                      <div style={{
                        position: 'absolute',
                        bottom: '-5px',
                        left: '20px',
                        right: '20px',
                        height: '20px',
                        fontSize: '10px',
                        color: '#9ca3af'
                      }}>
                        {vso > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vso * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vso}
                          </span>
                        )}
                        {vs1 > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vs1 * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vs1}
                          </span>
                        )}
                        {vno > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vno * scale}%`,
                            transform: 'translateX(-50%)'
                          }}>
                            {vno}
                          </span>
                        )}
                        {vne > 0 && (
                          <span style={{
                            position: 'absolute',
                            left: `${vne * scale}%`,
                            transform: 'translateX(-50%)',
                            color: '#dc2626',
                            fontWeight: 'bold'
                          }}>
                            {vne}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              
              {/* Légende des arcs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: 'white',
                    borderRadius: '2px',
                    border: '1px solid #6b7280'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Arc blanc:</strong> Plage volets (Vso - Vfe LDG)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: '#10b981',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Arc vert:</strong> Plage normale (Vs1 - Vno)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: '#fbbf24',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Arc jaune:</strong> Air calme (Vno - Vne)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '8px',
                    backgroundColor: '#dc2626',
                    borderRadius: '2px'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Trait rouge:</strong> Ne jamais dépasser (Vne)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '2px',
                    height: '20px',
                    backgroundColor: 'white',
                    marginLeft: '14px',
                    marginRight: '14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Trait blanc:</strong> VFE T/O (Max volets décollage)
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '20px',
                    background: 'repeating-linear-gradient(to bottom, white 0px, white 3px, transparent 3px, transparent 6px)',
                    borderRadius: '1px'
                  }} />
                  <span style={{ color: '#d1d5db' }}>
                    <strong>Trait pointillé:</strong> VO (Manœuvre max)
                  </span>
                </div>
              </div>
              
              {/* Avertissement si des vitesses manquent */}
              {(!formData.speeds.vso || !formData.speeds.vs1 || !formData.speeds.vno || !formData.speeds.vne) && (
                <div style={{
                  backgroundColor: '#7f1d1d',
                  padding: '10px',
                  borderRadius: '6px',
                  marginTop: '12px'
                }}>
                  <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0 }}>
                    ⚠️ Certaines vitesses critiques ne sont pas définies. Remplissez les vitesses pour afficher les arcs complets.
                  </p>
                </div>
              )}
            </div>
            
            {/* Configuration volets sortis */}
            <div style={{
              backgroundColor: '#f0f9ff',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '12px',
              border: '1px solid #93c5fd'
            }}>
              <h6 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
                Configuration volets sortis
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Vso - Décrochage volets sortis
                    <InfoIcon tooltip="Vitesse de décrochage en configuration atterrissage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vso}
                    onChange={(e) => handleChange('speeds.vso', e.target.value)}
                    placeholder="60"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Vfe LDG - Volets atterrissage
                    <InfoIcon tooltip="Vitesse max volets en position atterrissage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vfeLdg}
                    onChange={(e) => handleChange('speeds.vfeLdg', e.target.value)}
                    placeholder="98"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Vfe T/O - Volets décollage
                    <InfoIcon tooltip="Vitesse max volets en position décollage" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vfeTO}
                    onChange={(e) => handleChange('speeds.vfeTO', e.target.value)}
                    placeholder="110"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            
            {/* Configuration lisse */}
            <div style={{
              backgroundColor: '#f0fdf4',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '12px',
              border: '1px solid #86efac'
            }}>
              <h6 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
                Configuration lisse
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Vs1 - Décrochage volets rentrés
                    <InfoIcon tooltip="Vitesse de décrochage en configuration lisse" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vs1}
                    onChange={(e) => handleChange('speeds.vs1', e.target.value)}
                    placeholder="66"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Vno - Max en air calme
                    <InfoIcon tooltip="Vitesse max de croisière structurale" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.vno}
                    onChange={(e) => handleChange('speeds.vno', e.target.value)}
                    placeholder="130"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            
            {/* Vitesse limite absolue */}
            <div style={{
              backgroundColor: '#fef2f2',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '12px',
              border: '1px solid #fca5a5'
            }}>
              <div>
                <label style={labelStyle}>
                  Vne - Ne jamais dépasser
                  <InfoIcon tooltip="Vitesse à ne jamais dépasser" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vne}
                  onChange={(e) => handleChange('speeds.vne', e.target.value)}
                  placeholder="163"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
            
            {/* VO - Operating manoeuvring speed (variable selon la masse) */}
            <div style={{
              backgroundColor: '#fef3c7',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #fcd34d'
            }}>
              <h6 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
                VO - Operating Manoeuvring Speed (variable selon la masse)
              </h6>
              <p style={{ fontSize: '11px', color: '#78350f', marginBottom: '8px' }}>
                Ne pas effectuer de mouvements complets ou brusques des commandes au-dessus de ces vitesses
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>
                    Jusqu'à ({massUnit})
                    <InfoIcon tooltip="Masse max pour cette VO" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.voWeight1}
                    onChange={(e) => handleChange('speeds.voWeight1', e.target.value)}
                    placeholder="1080"
                    min="0"
                    style={{ ...inputStyle, marginBottom: '4px' }}
                  />
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed1}
                    onChange={(e) => handleChange('speeds.voSpeed1', e.target.value)}
                    placeholder="101"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>
                    De ({massUnit}) à ({massUnit})
                    <InfoIcon tooltip="Plage de masse intermédiaire" />
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      value={formData.speeds.voWeight2Min}
                      onChange={(e) => handleChange('speeds.voWeight2Min', e.target.value)}
                      placeholder="1080"
                      min="0"
                      style={{ ...inputStyle, marginBottom: '4px', flex: 1 }}
                    />
                    <input
                      type="number"
                      value={formData.speeds.voWeight2Max}
                      onChange={(e) => handleChange('speeds.voWeight2Max', e.target.value)}
                      placeholder="1180"
                      min="0"
                      style={{ ...inputStyle, marginBottom: '4px', flex: 1 }}
                    />
                  </div>
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed2}
                    onChange={(e) => handleChange('speeds.voSpeed2', e.target.value)}
                    placeholder="108"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>
                    Au-dessus de ({massUnit})
                    <InfoIcon tooltip="Masse min pour cette VO" />
                  </label>
                  <input
                    type="number"
                    value={formData.speeds.voWeight3}
                    onChange={(e) => handleChange('speeds.voWeight3', e.target.value)}
                    placeholder="1180"
                    min="0"
                    style={{ ...inputStyle, marginBottom: '4px' }}
                  />
                  <label style={{ ...labelStyle, fontSize: '11px', color: '#000000' }}>VO (KIAS)</label>
                  <input
                    type="number"
                    value={formData.speeds.voSpeed3}
                    onChange={(e) => handleChange('speeds.voSpeed3', e.target.value)}
                    placeholder="113"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Vitesses de montée et plané */}
          <div style={{
            backgroundColor: '#f3f4f6',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '16px',
            marginBottom: '16px'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
              Vitesses de montée et plané
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  VR - Vitesse de rotation
                  <InfoIcon tooltip="Vitesse à laquelle le pilote tire sur le manche pour décoller" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vr}
                  onChange={(e) => handleChange('speeds.vr', e.target.value)}
                  placeholder="55"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Vx - Montée max (pente)
                  <InfoIcon tooltip="Meilleur angle de montée" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vx}
                  onChange={(e) => handleChange('speeds.vx', e.target.value)}
                  placeholder="59"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Vy - Montée optimale (taux)
                  <InfoIcon tooltip="Meilleur taux de montée" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vy}
                  onChange={(e) => handleChange('speeds.vy', e.target.value)}
                  placeholder="73"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  VApp - Vitesse d'approche
                  <InfoIcon tooltip="Vitesse d'approche en finale" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vapp}
                  onChange={(e) => handleChange('speeds.vapp', e.target.value)}
                  placeholder="65"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Montée initiale
                  <InfoIcon tooltip="Vitesse de montée après décollage" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.initialClimb}
                  onChange={(e) => handleChange('speeds.initialClimb', e.target.value)}
                  placeholder="65"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Vglide - Plané optimal
                  <InfoIcon tooltip="Vitesse de finesse max" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vglide}
                  onChange={(e) => handleChange('speeds.vglide', e.target.value)}
                  placeholder="65"
                  min="0"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>
                  VLE - Train sorti
                  <InfoIcon tooltip="Vitesse maximale train sorti" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vle}
                  onChange={(e) => handleChange('speeds.vle', e.target.value)}
                  placeholder="140"
                  min="0"
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>
                  VLO - Manœuvre train
                  <InfoIcon tooltip="Vitesse maximale pour manœuvrer le train" />
                </label>
                <input
                  type="number"
                  value={formData.speeds.vlo}
                  onChange={(e) => handleChange('speeds.vlo', e.target.value)}
                  placeholder="120"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Section Limitations de vent */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>💨</span>
            Limitations de vent (kt)
            <InfoIcon tooltip="Limites maximales démontrées" />
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={labelStyle}>
                Vent traversier max
                <InfoIcon tooltip="Composante traversière maximale démontrée" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxCrosswind}
                onChange={(e) => handleChange('windLimits.maxCrosswind', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={labelStyle}>
                Vent arrière max
                <InfoIcon tooltip="Vent arrière max pour décollage/atterrissage" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxTailwind}
                onChange={(e) => handleChange('windLimits.maxTailwind', e.target.value)}
                placeholder="10"
                min="0"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={labelStyle}>
                Vent de travers sur piste mouillée
                <InfoIcon tooltip="Vent de travers max sur piste mouillée" />
              </label>
              <input
                type="number"
                value={formData.windLimits.maxCrosswindWet}
                onChange={(e) => handleChange('windLimits.maxCrosswindWet', e.target.value)}
                placeholder="15"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
          </>

        </div>
      )}

      {/* Section Masse & Centrage */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showMasseCentrage}
          onClick={() => setShowMasseCentrage(!showMasseCentrage)}
          icon="⚖️"
          title="Masse & Centrage"
        />
      </div>

      {showMasseCentrage && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>

            {/* Masses et Centrage */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
            ⚖️ Masses et Centrage
          </h4>
          
          {/* Masse à vide et son bras de levier */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #e5e7eb'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
              Masse à vide
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Masse ({massUnit})
                  <InfoIcon tooltip="Masse de l'avion sans carburant ni charge utile" />
                </label>
                <input
                  type="number"
                  value={formData.masses.emptyMass}
                  onChange={(e) => handleChange('masses.emptyMass', e.target.value)}
                  placeholder="650"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Bras de levier ({armUnit})
                  <InfoIcon tooltip="Distance du CG de la masse à vide par rapport à la référence" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.emptyMassArm}
                  onChange={(e) => handleChange('armLengths.emptyMassArm', e.target.value)}
                  placeholder="2.15"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Carburant et son bras de levier */}
          <div style={{ 
            backgroundColor: '#f0f9ff', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #bfdbfe'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
              Carburant
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Capacité max ({fuelUnit})
                  <InfoIcon tooltip="Capacité maximale des réservoirs" />
                </label>
                <input
                  type="number"
                  value={getUnit('fuel') !== 'ltr' ? convert(formData.fuelCapacity, 'fuel', 'ltr', { toUnit: getUnit('fuel') }).toFixed(1) : formData.fuelCapacity}
                  onChange={(e) => {
                    const valueInStorageUnit = getUnit('fuel') !== 'ltr' ? toStorage(parseFloat(e.target.value) || 0, 'fuel') : e.target.value;
                    handleChange('fuelCapacity', valueInStorageUnit);
                  }}
                  placeholder={getUnit('fuel') === 'gal' ? "40" : getUnit('fuel') === 'kg' ? "120" : "150"}
                  min="0"
                  step="0.1"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Bras de levier ({armUnit})
                  <InfoIcon tooltip="Distance du CG du carburant par rapport à la référence" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.fuelArm}
                  onChange={(e) => handleChange('armLengths.fuelArm', e.target.value)}
                  placeholder="2.18"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Sièges et leurs bras de levier */}
          <div style={{ 
            backgroundColor: '#fef3f2', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fecaca'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
              Sièges (bras de levier en m)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Siège avant gauche (Pilote) - Bras (m)
                  <InfoIcon tooltip="Distance du siège pilote par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.frontSeat1Arm}
                  onChange={(e) => handleChange('armLengths.frontSeat1Arm', e.target.value)}
                  placeholder="2.00"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège avant droit - Bras (m)
                  <InfoIcon tooltip="Distance du siège passager avant par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.frontSeat2Arm}
                  onChange={(e) => handleChange('armLengths.frontSeat2Arm', e.target.value)}
                  placeholder="2.00"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège arrière gauche - Bras (m)
                  <InfoIcon tooltip="Distance du siège arrière gauche par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.rearSeat1Arm}
                  onChange={(e) => handleChange('armLengths.rearSeat1Arm', e.target.value)}
                  placeholder="2.30"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Siège arrière droit - Bras (m)
                  <InfoIcon tooltip="Distance du siège arrière droit par rapport à la référence (en mètres)" />
                </label>
                <input
                  type="number"
                  value={formData.armLengths.rearSeat2Arm}
                  onChange={(e) => handleChange('armLengths.rearSeat2Arm', e.target.value)}
                  placeholder="2.30"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Sièges supplémentaires dynamiques */}
          <div style={{ 
            backgroundColor: '#f0f9ff', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #93c5fd'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', margin: 0 }}>
                💺 Sièges supplémentaires
              </h5>
              <button
                type="button"
                onClick={addAdditionalSeat}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                + Ajouter un siège
              </button>
            </div>
            
            {!formData.additionalSeats || formData.additionalSeats.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0' }}>
                Aucun siège supplémentaire. Cliquez sur "Ajouter un siège" pour les configurations 6+ places.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(formData.additionalSeats || []).map((seat) => (
                  <div key={seat.id} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr auto', 
                    gap: '12px',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Nom du siège
                        <InfoIcon tooltip="Identifiant du siège (ex: Rangée 3 gauche)" />
                      </label>
                      <input
                        type="text"
                        value={seat.name}
                        onChange={(e) => updateAdditionalSeat(seat.id, 'name', e.target.value)}
                        placeholder="Ex: Rangée 3 gauche"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Bras de levier ({armUnit})
                        <InfoIcon tooltip="Distance par rapport à la référence" />
                      </label>
                      <input
                        type="number"
                        value={seat.arm}
                        onChange={(e) => updateAdditionalSeat(seat.id, 'arm', e.target.value)}
                        placeholder="2.50"
                        min="0"
                        step="0.01"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAdditionalSeat(seat.id)}
                      style={{
                        padding: '4px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        alignSelf: 'end',
                        marginBottom: '4px'
                      }}
                      title="Supprimer ce siège"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>
              Utile pour les avions 6+ places, les configurations club ou les sièges additionnels
            </p>
          </div>

          {/* Compartiments bagages dynamiques */}
          <div style={{ 
            backgroundColor: '#fefce8', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fde047'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000', margin: 0 }}>
                🏎️ Compartiments bagages
              </h5>
              <button
                type="button"
                onClick={addBaggageCompartment}
                style={{
                  backgroundColor: '#fbbf24',
                  color: '#78350f',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={16} />
                Ajouter un compartiment
              </button>
            </div>
            
            {formData.baggageCompartments && formData.baggageCompartments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formData.baggageCompartments.map((compartment, index) => (
                  <div key={compartment.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr auto',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Nom du compartiment
                      </label>
                      <input
                        type="text"
                        value={compartment.name}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'name', e.target.value)}
                        placeholder="Nom du compartiment"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Bras de levier ({armUnit})
                        <InfoIcon tooltip="Distance par rapport à la référence" />
                      </label>
                      <input
                        type="number"
                        value={compartment.arm}
                        onChange={(e) => updateBaggageCompartment(compartment.id, 'arm', e.target.value)}
                        placeholder="2.45"
                        min="0"
                        step="0.01"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Masse max ({massUnit})
                        <InfoIcon tooltip="Masse maximale autorisée" />
                      </label>
                      <input
                        type="number"
                        value={getUnit('weight') !== 'kg' ?
                          (Number(convert(compartment.maxWeight || 0, 'weight', 'kg', { toUnit: getUnit('weight') })) || 0).toFixed(1) :
                          compartment.maxWeight}
                        onChange={(e) => {
                          const valueInStorageUnit = getUnit('weight') !== 'kg' ? 
                            toStorage(parseFloat(e.target.value) || 0, 'weight') : 
                            e.target.value;
                          updateBaggageCompartment(compartment.id, 'maxWeight', valueInStorageUnit);
                        }}
                        placeholder={getUnit('weight') === 'lbs' ? "110" : "50"}
                        min="0"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      {formData.baggageCompartments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBaggageCompartment(compartment.id)}
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            height: '32px',
                            width: '32px'
                          }}
                          title="Supprimer ce compartiment"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#9ca3af',
                fontStyle: 'italic'
              }}>
                Aucun compartiment défini. Cliquez sur "Ajouter un compartiment" pour commencer.
              </div>
            )}
          </div>

          {/* Masses limites */}
          <div style={{ 
            backgroundColor: '#fee2e2', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fca5a5'
          }}>
            <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#000000' }}>
              Masses limites ({massUnit})
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  Masse min décollage
                  <InfoIcon tooltip="Masse minimale pour le décollage" />
                </label>
                <input
                  type="number"
                  value={formData.masses.minTakeoffMass}
                  onChange={(e) => handleChange('masses.minTakeoffMass', e.target.value)}
                  placeholder="900"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Masse max décollage
                  <InfoIcon tooltip="Masse maximale au décollage (MTOW)" />
                </label>
                <input
                  type="number"
                  value={formData.maxTakeoffWeight}
                  onChange={(e) => handleChange('maxTakeoffWeight', e.target.value)}
                  placeholder="1200"
                  min="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Masse max atterrissage
                  <InfoIcon tooltip="Masse maximale à l'atterrissage (MLW)" />
                </label>
                <input
                  type="number"
                  value={formData.limitations.maxLandingMass}
                  onChange={(e) => handleChange('limitations.maxLandingMass', e.target.value)}
                  placeholder="1150"
                  min="0"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* CENTER OF GRAVITY - Enveloppe de centrage */}
          <div style={{ 
            backgroundColor: '#fef2f2', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '2px solid #dc2626',
            marginTop: '24px'
          }}>
            <h5 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
              ⚠️ CENTER OF GRAVITY - Enveloppe de centrage
            </h5>

            {/* CG Avant (Most forward) - Points dynamiques */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>
                  📍 Most Forward CG (Limite avant)
                </h6>
                <button
                  type="button"
                  onClick={addForwardPoint}
                  style={{
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ➕ Ajouter un point
                </button>
              </div>
              
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', margin: '0 0 12px 0' }}>
                  💡 <strong>Astuce:</strong> Ajoutez plusieurs points pour définir une courbe de limite CG avant. Les points seront connectés par ordre croissant de masse.
                </p>
                
                {formData.cgEnvelope.forwardPoints.map((point, index) => (
                  <div key={point.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '12px',
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        Masse ({massUnit})
                        <InfoIcon tooltip={`Point ${index + 1} - Masse pour la limite CG avant`} />
                      </label>
                      <input
                        type="number"
                        value={point.weight}
                        onChange={(e) => updateForwardPoint(point.id, 'weight', e.target.value)}
                        placeholder="940"
                        min="0"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div>
                      <label style={{...labelStyle, fontSize: '11px', color: '#000000'}}>
                        CG (m)
                        <InfoIcon tooltip={`Point ${index + 1} - Position CG avant à cette masse`} />
                      </label>
                      <input
                        type="number"
                        value={point.cg}
                        onChange={(e) => updateForwardPoint(point.id, 'cg', e.target.value)}
                        placeholder="2.4000"
                        min="0"
                        step="0.0001"
                        style={{...inputStyle, fontSize: '13px'}}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '4px' }}>
                      {formData.cgEnvelope.forwardPoints.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeForwardPoint(point.id)}
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            minWidth: '32px',
                            height: '32px'
                          }}
                          title="Supprimer ce point"
                        >
                          🗑️
                        </button>
                      )}
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#6b7280', 
                        alignSelf: 'center',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        Point {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
                
                {formData.cgEnvelope.forwardPoints.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#9ca3af',
                    fontStyle: 'italic'
                  }}>
                    Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
                  </div>
                )}
              </div>
            </div>

            {/* CG Arrière (Most rearward) */}
            <div>
              <h6 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                📍 Most Rearward CG (Limite arrière)
              </h6>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>
                    Masse min ({massUnit})
                    <InfoIcon tooltip="Masse minimale pour la limite CG arrière" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftMinWeight}
                    onChange={(e) => handleChange('cgEnvelope.aftMinWeight', e.target.value)}
                    placeholder="940"
                    min="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    CG arrière constant (m)
                    <InfoIcon tooltip="Position CG arrière (constante sur toute la plage)" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftCG}
                    onChange={(e) => handleChange('cgEnvelope.aftCG', e.target.value)}
                    placeholder="2.5300"
                    min="0"
                    step="0.0001"
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>
                    Masse max ({massUnit})
                    <InfoIcon tooltip="Masse maximale pour la limite CG arrière" />
                  </label>
                  <input
                    type="number"
                    value={formData.cgEnvelope.aftMaxWeight}
                    onChange={(e) => handleChange('cgEnvelope.aftMaxWeight', e.target.value)}
                    placeholder="1310"
                    min="0"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Visualisation graphique de l'enveloppe */}
            {(() => {
              // Récupérer les points avant dynamiques
              const forwardPoints = formData.cgEnvelope.forwardPoints
                .filter(point => parseFloat(point.weight) > 0 && parseFloat(point.cg) > 0)
                .map(point => ({
                  w: parseFloat(point.weight),
                  cg: parseFloat(point.cg),
                  label: 'Forward'
                }))
                .sort((a, b) => a.w - b.w); // Trier par masse croissante

              // Points arrière
              const aftMinWeight = parseFloat(formData.cgEnvelope.aftMinWeight) || 0;
              const aftCG = parseFloat(formData.cgEnvelope.aftCG) || 0;
              const aftMaxWeight = parseFloat(formData.cgEnvelope.aftMaxWeight) || 0;

              // Calculer les échelles pour le graphique
              const forwardWeights = forwardPoints.map(p => p.w);
              const forwardCGs = forwardPoints.map(p => p.cg);
              const aftWeights = [aftMinWeight, aftMaxWeight].filter(w => w > 0);
              const aftCGs = [aftCG].filter(cg => cg > 0);

              const allWeights = [...forwardWeights, ...aftWeights];
              const allCGs = [...forwardCGs, ...aftCGs];
              
              const minWeight = allWeights.length > 0 ? Math.min(...allWeights) - 50 : 900;
              const maxWeight = allWeights.length > 0 ? Math.max(...allWeights) + 50 : 1400;
              const minCG = allCGs.length > 0 ? Math.min(...allCGs) - 0.1 : 2.0;
              const maxCG = allCGs.length > 0 ? Math.max(...allCGs) + 0.1 : 2.8;

              const toSvgX = (cg) => 50 + (cg - minCG) / (maxCG - minCG) * 400;
              const toSvgY = (weight) => 250 - (weight - minWeight) / (maxWeight - minWeight) * 200;

              // Créer les points de l'enveloppe
              const envelopePoints = [];
              
              // Ajouter tous les points avant (déjà triés)
              forwardPoints.forEach((point, index) => {
                envelopePoints.push({ 
                  ...point, 
                  label: `Forward ${index + 1}` 
                });
              });
              
              // Points arrière (ordre décroissant de masse)
              if (aftMaxWeight > 0 && aftCG > 0) {
                envelopePoints.push({ w: aftMaxWeight, cg: aftCG, label: 'Aft Max' });
              }
              if (aftMinWeight > 0 && aftCG > 0 && aftMinWeight !== aftMaxWeight) {
                envelopePoints.push({ w: aftMinWeight, cg: aftCG, label: 'Aft Min' });
              }

              return (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: '20px',
                  borderRadius: '12px',
                  marginTop: '20px',
                  border: '2px solid #0ea5e9',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '16px',
                    padding: '20px',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: '600px',
                      aspectRatio: '5/3'
                    }}>
                      <svg 
                        viewBox="0 0 500 300" 
                        style={{ 
                          width: '100%',
                          height: '100%',
                          border: '1px solid #cbd5e1', 
                          borderRadius: '4px', 
                          backgroundColor: 'white'
                        }}>
                      {/* Grille */}
                      <defs>
                        <pattern id="cgGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="500" height="300" fill="url(#cgGrid)" />
                      
                      {/* Axes */}
                      <line x1="50" y1="250" x2="450" y2="250" stroke="#374151" strokeWidth="2" />
                      <line x1="50" y1="50" x2="50" y2="250" stroke="#374151" strokeWidth="2" />
                      
                      {/* Labels des axes */}
                      <text x="250" y="280" textAnchor="middle" fontSize="12" fill="#374151">Centre de Gravité (m)</text>
                      <text x="20" y="150" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 20 150)">Masse ({massUnit})</text>
                      
                      {/* Graduations X (CG) */}
                      {(() => {
                        const ticks = [];
                        for (let i = 0; i <= 4; i++) {
                          const cgValue = minCG + (maxCG - minCG) * (i / 4);
                          const x = 50 + (400 * i) / 4;
                          ticks.push(
                            <g key={`x-${i}`}>
                              <line x1={x} y1="250" x2={x} y2="255" stroke="#374151" strokeWidth="1" />
                              <text x={x} y="270" textAnchor="middle" fontSize="10" fill="#374151">
                                {cgValue.toFixed(2)}
                              </text>
                            </g>
                          );
                        }
                        return ticks;
                      })()}
                      
                      {/* Graduations Y (Masse) */}
                      {(() => {
                        const ticks = [];
                        for (let i = 0; i <= 4; i++) {
                          const weightValue = minWeight + (maxWeight - minWeight) * (i / 4);
                          const y = 250 - (200 * i) / 4;
                          ticks.push(
                            <g key={`y-${i}`}>
                              <line x1="45" y1={y} x2="50" y2={y} stroke="#374151" strokeWidth="1" />
                              <text x="40" y={y + 3} textAnchor="end" fontSize="10" fill="#374151">
                                {Math.round(weightValue)}
                              </text>
                            </g>
                          );
                        }
                        return ticks;
                      })()}
                      
                      {/* Enveloppe */}
                      {envelopePoints.length >= 3 && (
                        <polygon 
                          points={envelopePoints.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ')}
                          fill="rgba(34, 197, 94, 0.2)" 
                          stroke="#22c55e" 
                          strokeWidth="2"
                        />
                      )}
                      
                      {/* Points de l'enveloppe */}
                      {envelopePoints.map((point, index) => (
                        <g key={index}>
                          <circle 
                            cx={toSvgX(point.cg)} 
                            cy={toSvgY(point.w)} 
                            r="4" 
                            fill="#dc2626" 
                            stroke="white" 
                            strokeWidth="2"
                          />
                          <text 
                            x={toSvgX(point.cg)} 
                            y={toSvgY(point.w) + 20} 
                            textAnchor="middle" 
                            fontSize="8" 
                            fill="#6b7280"
                          >
                            {point.w}kg / {point.cg}m
                          </text>
                        </g>
                      ))}
                      
                      {/* Message si pas assez de données */}
                      {envelopePoints.length < 3 && (
                        <text x="250" y="150" textAnchor="middle" fontSize="14" fill="#9ca3af">
                          Saisissez au moins 3 points pour visualiser l'enveloppe
                        </text>
                      )}
                    </svg>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

          </>

        </div>
      )}

      {/* Section Équipements */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showEquipements}
          onClick={() => setShowEquipements(!showEquipements)}
          icon="📡"
          title="Équipements"
        />
      </div>

      {showEquipements && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>

            {/* Section Communication */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>📻</span>
                Équipements de radiocommunication (COM)
                <InfoIcon tooltip="Équipements de communication avec l'ATC et autres aéronefs" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F9FAFB',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.vhf1}
                    onChange={(e) => handleChange('equipmentCom.vhf1', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VHF COM 1</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.vhf2}
                    onChange={(e) => handleChange('equipmentCom.vhf2', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VHF COM 2</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.hf}
                    onChange={(e) => handleChange('equipmentCom.hf', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>HF (Haute fréquence)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.satcom}
                    onChange={(e) => handleChange('equipmentCom.satcom', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>SATCOM (Communication satellite)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.elt}
                    onChange={(e) => handleChange('equipmentCom.elt', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ELT (Balise de détresse)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.acars}
                    onChange={(e) => handleChange('equipmentCom.acars', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ACARS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentCom.cpdlc}
                    onChange={(e) => handleChange('equipmentCom.cpdlc', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CPDLC (Datalink)</span>
                </label>
              </div>
            </div>

            {/* Section Navigation et Approche */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>🧭</span>
                Équipements de navigation et approche (NAV/APP)
                <InfoIcon tooltip="Systèmes de navigation et capacités d'approche aux instruments" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F0F9FF',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #BAE6FD',
                marginBottom: '16px'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.vor}
                    onChange={(e) => handleChange('equipmentNav.vor', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>VOR</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.dme}
                    onChange={(e) => handleChange('equipmentNav.dme', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>DME</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.adf}
                    onChange={(e) => handleChange('equipmentNav.adf', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADF/NDB</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.gnss}
                    onChange={(e) => handleChange('equipmentNav.gnss', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GNSS/GPS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.ils}
                    onChange={(e) => handleChange('equipmentNav.ils', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ILS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.mls}
                    onChange={(e) => handleChange('equipmentNav.mls', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>MLS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.gbas}
                    onChange={(e) => handleChange('equipmentNav.gbas', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GBAS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentNav.lpv}
                    onChange={(e) => handleChange('equipmentNav.lpv', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>LPV (approche GPS)</span>
                </label>
              </div>

              {/* RNAV/RNP capabilities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.equipmentNav.rnav}
                      onChange={(e) => handleChange('equipmentNav.rnav', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>Capacité RNAV</span>
                  </label>
                  {formData.equipmentNav.rnav && (
                    <input
                      type="text"
                      value={formData.equipmentNav.rnavTypes}
                      onChange={(e) => handleChange('equipmentNav.rnavTypes', e.target.value)}
                      placeholder="Ex: RNAV 10, RNAV 5, RNAV 1"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.equipmentNav.rnp}
                      onChange={(e) => handleChange('equipmentNav.rnp', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>Capacité RNP</span>
                  </label>
                  {formData.equipmentNav.rnp && (
                    <input
                      type="text"
                      value={formData.equipmentNav.rnpTypes}
                      onChange={(e) => handleChange('equipmentNav.rnpTypes', e.target.value)}
                      placeholder="Ex: RNP 4, RNP 1, RNP APCH"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section Surveillance */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>📍</span>
                Équipements de surveillance
                <InfoIcon tooltip="Systèmes de surveillance et anti-collision" />
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Mode transpondeur</label>
                  <select
                    value={formData.equipmentSurv.transponderMode}
                    onChange={(e) => handleChange('equipmentSurv.transponderMode', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="None">Aucun</option>
                    <option value="A">Mode A</option>
                    <option value="C">Mode C (altitude)</option>
                    <option value="S">Mode S</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Système TCAS</label>
                  <select
                    value={formData.equipmentSurv.tcas}
                    onChange={(e) => handleChange('equipmentSurv.tcas', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="None">Aucun</option>
                    <option value="TCAS I">TCAS I</option>
                    <option value="TCAS II">TCAS II</option>
                  </select>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#FFF7ED',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #FED7AA'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.adsb}
                    onChange={(e) => handleChange('equipmentSurv.adsb', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADS-B Out</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.adsbIn}
                    onChange={(e) => handleChange('equipmentSurv.adsbIn', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>ADS-B In</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.gpws}
                    onChange={(e) => handleChange('equipmentSurv.gpws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>GPWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.egpws}
                    onChange={(e) => handleChange('equipmentSurv.egpws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>Enhanced GPWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.taws}
                    onChange={(e) => handleChange('equipmentSurv.taws', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>TAWS</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.ras}
                    onChange={(e) => handleChange('equipmentSurv.ras', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>RAS (Runway Awareness)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.cvr}
                    onChange={(e) => handleChange('equipmentSurv.cvr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CVR (Enregistreur vocal)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.fdr}
                    onChange={(e) => handleChange('equipmentSurv.fdr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>FDR (Enregistreur de vol)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.equipmentSurv.flarm}
                    onChange={(e) => handleChange('equipmentSurv.flarm', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>FLARM (Anti-collision)</span>
                </label>
              </div>
            </div>

            {/* Capacités spéciales */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px' }}>🌟</span>
                Capacités spéciales et approbations
                <InfoIcon tooltip="Approbations opérationnelles spéciales" />
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                backgroundColor: '#F0FDF4',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #86EFAC',
                marginBottom: '16px'
              }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.rvsm}
                    onChange={(e) => handleChange('specialCapabilities.rvsm', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>RVSM (FL290-FL410)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.mnps}
                    onChange={(e) => handleChange('specialCapabilities.mnps', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>MNPS (Atlantique Nord)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.catII}
                    onChange={(e) => handleChange('specialCapabilities.catII', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CAT II (Approche)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.catIII}
                    onChange={(e) => handleChange('specialCapabilities.catIII', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>CAT III (Approche)</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.specialCapabilities.pbn}
                    onChange={(e) => handleChange('specialCapabilities.pbn', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>PBN (Performance Based Nav)</span>
                </label>
                <div>
                  <label style={sx.flex.start}>
                    <input
                      type="checkbox"
                      checked={formData.specialCapabilities.etops}
                      onChange={(e) => handleChange('specialCapabilities.etops', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={sx.text.sm}>ETOPS</span>
                  </label>
                  {formData.specialCapabilities.etops && (
                    <input
                      type="text"
                      value={formData.specialCapabilities.etopsMinutes}
                      onChange={(e) => handleChange('specialCapabilities.etopsMinutes', e.target.value)}
                      placeholder="Minutes (60, 120, 180...)"
                      style={sx.combine(sx.components.input.base, sx.spacing.mt(2))}
                    />
                  )}
                </div>
              </div>

              {/* Remarques */}
              <div>
                <label style={labelStyle}>
                  Remarques additionnelles
                  <InfoIcon tooltip="Autres équipements ou capacités spéciales" />
                </label>
                <textarea
                  value={formData.specialCapabilities.remarks}
                  onChange={(e) => handleChange('specialCapabilities.remarks', e.target.value)}
                  placeholder="Ex: Équipé pour le vol en montagne, skis rétractables, etc."
                  style={sx.combine(sx.components.input.base, { minHeight: '80px' })}
                />
              </div>
            </div>
          </>
        
        </div>
      )}

      {/* Section Opérations */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showOperations}
          onClick={() => setShowOperations(!showOperations)}
          icon="✈️"
          title="Opérations"
        />
      </div>

      {showOperations && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>

            {/* Opérations de base */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                📋 Règles de vol
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.vfrDay}
                    onChange={(e) => handleChange('approvedOperations.vfrDay', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>☀️ VFR Jour</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.vfrNight}
                    onChange={(e) => handleChange('approvedOperations.vfrNight', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌙 VFR Nuit</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.ifrDay}
                    onChange={(e) => handleChange('approvedOperations.ifrDay', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>☁️ IFR Jour</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.ifrNight}
                    onChange={(e) => handleChange('approvedOperations.ifrNight', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌙☁️ IFR Nuit</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.svfr}
                    onChange={(e) => handleChange('approvedOperations.svfr', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌫️ VFR Spécial (SVFR)</span>
                </label>
              </div>
            </div>

            {/* Opérations spéciales */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                🎯 Opérations spéciales
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.formation}
                    onChange={(e) => handleChange('approvedOperations.formation', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>✈️✈️ Vol en formation</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.aerobatics}
                    onChange={(e) => handleChange('approvedOperations.aerobatics', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎪 Voltige aérienne</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.banner}
                    onChange={(e) => handleChange('approvedOperations.banner', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🏴 Remorquage bannière</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.glider}
                    onChange={(e) => handleChange('approvedOperations.glider', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🪂 Remorquage planeur</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.parachute}
                    onChange={(e) => handleChange('approvedOperations.parachute', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🪂 Largage parachutistes</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.agricultural}
                    onChange={(e) => handleChange('approvedOperations.agricultural', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🚜 Épandage agricole</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.aerial}
                    onChange={(e) => handleChange('approvedOperations.aerial', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>📷 Photo/Surveillance</span>
                </label>
              </div>
            </div>

            {/* Opérations commerciales et environnement */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                🏔️ Environnement et usage
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.training}
                    onChange={(e) => handleChange('approvedOperations.training', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎓 École de pilotage</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.charter}
                    onChange={(e) => handleChange('approvedOperations.charter', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🎫 Transport public</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.mountainous}
                    onChange={(e) => handleChange('approvedOperations.mountainous', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>⛰️ Vol en montagne</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.seaplane}
                    onChange={(e) => handleChange('approvedOperations.seaplane', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>🌊 Hydravion</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.skiPlane}
                    onChange={(e) => handleChange('approvedOperations.skiPlane', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>⛷️ Avion sur skis</span>
                </label>
                <label style={sx.flex.start}>
                  <input
                    type="checkbox"
                    checked={formData.approvedOperations.icing}
                    onChange={(e) => handleChange('approvedOperations.icing', e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={sx.text.sm}>❄️ Conditions givrantes</span>
                </label>
              </div>
            </div>
          </>

        </div>
      )}

      {/* Section Remarques */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showRemarques}
          onClick={() => setShowRemarques(!showRemarques)}
          icon="📋"
          title="Remarques"
        />
      </div>

      {showRemarques && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>

            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#000000' }}>
                Notes et remarques
              </h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Remarques générales
                  <InfoIcon tooltip="Ajoutez ici toute information pertinente du manuel de vol non couverte dans les autres sections" />
                </label>
                <textarea
                  value={formData.manualRemarks || ''}
                  onChange={(e) => handleChange('manualRemarks', e.target.value)}
                  placeholder="Exemple : Limitations spécifiques, procédures particulières, notes sur les performances, recommandations du constructeur..."
                  style={{
                    ...inputStyle,
                    minHeight: '150px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Procédures d'urgence spécifiques
                  <InfoIcon tooltip="Notes sur les procédures d'urgence particulières à cet aéronef" />
                </label>
                <textarea
                  value={formData.emergencyNotes || ''}
                  onChange={(e) => handleChange('emergencyNotes', e.target.value)}
                  placeholder="Procédures d'urgence spécifiques non standards..."
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  Notes de maintenance
                  <InfoIcon tooltip="Informations de maintenance importantes pour le pilote" />
                </label>
                <textarea
                  value={formData.maintenanceNotes || ''}
                  onChange={(e) => handleChange('maintenanceNotes', e.target.value)}
                  placeholder="Points de vigilance, intervalles de maintenance critiques..."
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                />
              </div>

            </div>
          </>
        
        </div>
      )}

      {/* Section Performances IA */}
      <div style={{ marginBottom: '16px' }}>
        <AccordionButton
          isOpen={showPerformancesIA}
          onClick={() => setShowPerformancesIA(!showPerformancesIA)}
          icon="🤖"
          title="Analyse Avancée des Performances"
        />
      </div>

      {showPerformancesIA && (
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <>
            <div style={{ marginTop: '20px' }}>
              <AdvancedPerformanceAnalyzer 
                aircraft={{
                  ...formData,
                  id: aircraft?.id,
                  performance: aircraft?.performance,
                  advancedPerformance: aircraft?.advancedPerformance
                }}
                onPerformanceUpdate={async (performanceData) => {
                  // Mettre à jour les données de performance dans le formulaire
                  console.log('📊 Mise à jour des performances IA avancées:', performanceData);
                  
                  try {
                    // Stocker avec le gestionnaire optimisé pour éviter QuotaExceededError
                    if (aircraft?.id) {
                      await performanceDataManager.storePerformanceData(aircraft.id, performanceData);
                      console.log('✅ Données de performance stockées avec le gestionnaire optimisé');
                    }
                    
                    // Mettre à jour le formulaire avec des données allégées (sans images base64)
                    const lightweightData = {
                      advancedPerformance: performanceData.advancedPerformance ? {
                        tables: performanceData.advancedPerformance.tables?.map(table => ({
                          table_name: table.table_name,
                          table_type: table.table_type,
                          conditions: table.conditions,
                          units: table.units,
                          data: table.data,
                          confidence: table.confidence
                        })) || [],
                        extractionMetadata: {
                          analyzedAt: performanceData.advancedPerformance.extractionMetadata?.analyzedAt,
                          totalTables: performanceData.advancedPerformance.extractionMetadata?.totalTables
                        }
                      } : null
                    };
                    
                    setFormData(prev => ({
                      ...prev,
                      ...lightweightData,
                      // S'assurer que advancedPerformance est bien ajouté au formData
                      advancedPerformance: lightweightData.advancedPerformance || prev.advancedPerformance
                    }));
                    
                  } catch (error) {
                    console.error('❌ Erreur lors de la sauvegarde des performances:', error);
                    // Afficher une notification à l'utilisateur
                    alert('Erreur lors de la sauvegarde des données de performance. Les données sont trop volumineuses.');
                  }
                }}
              />
            </div>
          </>
        </div>
      )}

      {/* Boutons d'action (toujours visibles) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          type="submit"
          style={{
            ...buttonSectionStyle,
            padding: '12px 32px'
          }}
          onClick={() => console.log('🔴 BOUTON CLIQUÉ - Type:', aircraft ? 'UPDATE' : 'CREATE')}
        >
          {aircraft ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  );
});

AircraftForm.displayName = 'AircraftForm';

export default AircraftModule;
