// src/features/vac/VACModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SIAReportEnhanced } from './components/SIAReportEnhanced';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

export const VACModule = memo(({ wizardMode = false, config = {} }) => {
  const [showWizardReturn, setShowWizardReturn] = useState(false);

  // Vérifier si on vient du wizard
  useEffect(() => {
    const hasTempDraft = localStorage.getItem('flightPlanDraft_temp');
    if (hasTempDraft) {
      setShowWizardReturn(true);
    }
  }, []);

  const handleReturnToWizard = () => {
    if (window.restoreFlightPlanWizard) {
      window.restoreFlightPlanWizard();
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-vac.jpg"
          eyebrow="DOCS · CARTES VAC SIA"
          title="Cartes VAC"
        />
      )}

      {/* Bandeau de retour au wizard — couleurs éditoriales */}
      {showWizardReturn && (
        <div style={{
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--text-inverse)',
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: tokens.radius?.sm || '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              EN VOL
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                Préparation de vol en cours
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                Après avoir mis à jour vos VAC, cliquez sur le bouton pour continuer votre préparation
              </div>
            </div>
          </div>
          <button
            onClick={handleReturnToWizard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-regular)',
              borderRadius: tokens.radius?.sm || '2px',
              fontFamily: tokens.fontFamily.mono,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: `transform ${tokens.motion.fast}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <ArrowLeft size={14} />
            Retour wizard
          </button>
        </div>
      )}

      {/* Afficher directement le rapport SIA amélioré */}
      <SIAReportEnhanced />
    </div>
  );
});

// Code original conservé mais désactivé
const VACModuleOld = memo(() => {
  const { waypoints } = useNavigation();
  const [searchIcao, setSearchIcao] = useState('');
  const [filter, setFilter] = useState('downloaded'); // Afficher par défaut uniquement les cartes téléchargées/importées
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSIASearch, setShowSIASearch] = useState(true); // Toujours visible
  const [siaAerodromes, setSIAAerodromes] = useState([]);
  const [filteredSIAAerodromes, setFilteredSIAAerodromes] = useState([]);
  const [siaSearchTerm, setSIASearchTerm] = useState('');
  const [importIcao, setImportIcao] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    // Vérifier si le disclaimer a déjà été accepté
    return localStorage.getItem('vac-disclaimer-accepted') === 'true';
  });
  
  const charts = useVACStore(state => state.charts || {});
  const downloadedCharts = Object.values(charts).filter(c => c?.isDownloaded) || [];
  const { deleteChart, selectChart, addCustomChart } = useVACStore(state => ({
    deleteChart: state.deleteChart,
    selectChart: state.selectChart,
    addCustomChart: state.addCustomChart
  }));
  
  // Handler pour accepter le disclaimer
  const handleAcceptDisclaimer = () => {
    setDisclaimerAccepted(true);
    localStorage.setItem('vac-disclaimer-accepted', 'true');
  };
  
  // Handler pour la sélection de fichier
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Veuillez sélectionner une image (PNG, JPG) ou un fichier PDF');
      event.target.value = '';
      return;
    }
    
    // Ajouter la date de dernière modification du fichier
    file.fileDate = file.lastModified ? new Date(file.lastModified).toISOString().split('T')[0] : null;
    
    setSelectedFile(file);
  };
  
  // Handler pour l'import manuel de carte VAC
  const handleFileImport = async () => {
    if (!selectedFile) {
      alert('Veuillez sélectionner un fichier');
      return;
    }
    
    // Vérifier le code ICAO
    if (!importIcao.match(/^[A-Z]{4}$/)) {
      alert('Veuillez entrer un code OACI valide (ex: LFPG)');
      return;
    }
    
    // Vérifier si une carte existe déjà pour cet ICAO
    const existingChart = charts[importIcao];
    if (existingChart) {
      const confirmMessage = existingChart.isCustom 
        ? `Une carte importée manuellement existe déjà pour ${importIcao}. Voulez-vous la remplacer ?`
        : `Une carte SIA existe déjà pour ${importIcao}. Voulez-vous ajouter votre version personnalisée ?\n\n` +
          `Note: Les deux versions seront conservées séparément.`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      // Si c'est une carte SIA, on va créer une version custom avec un suffixe
      if (!existingChart.isCustom) {
        // On ajoute un suffixe pour différencier
        // Mais on garde le même ICAO pour les recherches
      }
    }
    
    try {
      // Essayer d'extraire le texte pour l'analyse automatique
      let extractedText = '';
      let pdfMetadata = null;
      let extractionConfidence = 0;
      
      // Pour les fichiers texte/PDF, essayer d'extraire le contenu
      if (selectedFile.type === 'application/pdf') {
        console.log('📄 PDF détecté - extraction avec PDF.js...');
        
        try {
          // Utiliser pdfExtractors pour extraire le texte
          const pdfResult = await pdfExtractors.extractAuto(selectedFile, { 
            includeMetadata: true 
          });
          
          if (pdfResult.success && pdfResult.text) {
            extractedText = pdfResult.text;
            pdfMetadata = pdfResult.metadata;
            extractionConfidence = pdfResult.confidence || 0;
            
            console.log('✅ Texte extrait du PDF avec succès');
            console.log(`📊 Confiance: ${Math.round(extractionConfidence * 100)}%`);
            console.log(`📝 Longueur du texte: ${extractedText.length} caractères`);
            
            if (pdfMetadata) {
              console.log('📋 Métadonnées PDF:', pdfMetadata);
            }
          } else {
            console.warn('⚠️ Impossible d\'extraire le texte du PDF');
            if (pdfResult.error) {
              console.error('Erreur:', pdfResult.error);
            }
            if (pdfResult.requiresOCR) {
              console.log('💡 Ce PDF semble être scanné - OCR nécessaire');
            }
            
            // Obtenir des suggestions
            const suggestions = pdfExtractors.getSuggestions(pdfResult);
            if (suggestions.length > 0) {
              console.log('💡 Suggestions pour améliorer l\'extraction:');
              suggestions.forEach(s => {
                console.log(`  - ${s.message}`);
                if (s.tools) console.log('    Outils:', s.tools);
                if (s.actions) console.log('    Actions:', s.actions);
              });
            }
          }
        } catch (error) {
          console.error('❌ Erreur lors de l\'extraction PDF:', error);
        }
      } else if (selectedFile.type.startsWith('image/')) {
        console.log('🖼️ Image détectée - OCR nécessaire');
        console.log('💡 Utilisez le bouton "Analyser" pour saisir le texte manuellement');
      }
      
      // Convertir le fichier en base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        
        // Extraire automatiquement les données si du texte a été trouvé
        let extractedData = vacDataExtractor.extractFromText(extractedText, importIcao);
        
        // Utiliser la date du fichier si aucune date n'a été extraite du contenu
        if (!extractedData.publicationDate && selectedFile.fileDate) {
          // Vérifier que la date du fichier est raisonnable (pas dans le futur et pas trop ancienne)
          const fileDate = new Date(selectedFile.fileDate);
          const today = new Date();
          const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
          
          if (fileDate <= today && fileDate >= fiveYearsAgo) {
            extractedData.publicationDate = selectedFile.fileDate;
            console.log(`📅 Date du fichier utilisée: ${selectedFile.fileDate}`);
          } else {
            console.log(`⚠️ Date du fichier ignorée (non raisonnable): ${selectedFile.fileDate}`);
          }
        }
        
        // Afficher un résumé de l'extraction basé sur le score de confiance
        let extractionMessage = '';
        const confidenceScore = extractedData.confidenceScore || extractionConfidence || 0;
        
        if (extractedText && confidenceScore > 0.3) {
          // Extraction réussie (même partielle)
          console.log('✅ Extraction automatique approfondie effectuée');
          console.log(`📊 Score de confiance: ${Math.round(confidenceScore * 100)}%`);
          
          // Compter les données extraites
          const dataCount = [];
          if (extractedData.airportElevation > 0) {
            console.log(`- Altitude: ${extractedData.airportElevation} ft`);
            dataCount.push(`Altitude: ${extractedData.airportElevation} ft`);
          }
          if (extractedData.runways && extractedData.runways.length > 0) {
            console.log(`- Pistes: ${extractedData.runways.length}`);
            dataCount.push(`${extractedData.runways.length} piste(s)`);
          }
          const freqCount = Object.keys(extractedData.frequencies || {}).filter(k => extractedData.frequencies[k]).length;
          if (freqCount > 0) {
            console.log(`- Fréquences: ${freqCount}`);
            dataCount.push(`${freqCount} fréquence(s)`);
          }
          if (extractedData.vfrPoints && extractedData.vfrPoints.length > 0) {
            dataCount.push(`${extractedData.vfrPoints.length} point(s) VFR`);
          }
          if (extractedData.obstacles && extractedData.obstacles.length > 0) {
            dataCount.push(`${extractedData.obstacles.length} obstacle(s)`);
          }
          if (extractedData.publicationDate) {
            console.log(`- Date de publication: ${extractedData.publicationDate}`);
            dataCount.push(`Date: ${new Date(extractedData.publicationDate).toLocaleDateString('fr-FR')}`);
          }
          
          // Construire le message selon le score de confiance
          if (confidenceScore >= 0.7) {
            extractionMessage = `\n\n✅ Extraction approfondie réussie (${Math.round(confidenceScore * 100)}%)\n`;
          } else if (confidenceScore >= 0.5) {
            extractionMessage = `\n\n⚠️ Extraction partielle (${Math.round(confidenceScore * 100)}%)\n`;
          } else {
            extractionMessage = `\n\n⚠️ Extraction limitée (${Math.round(confidenceScore * 100)}%)\n`;
          }
          
          // Ajouter les données extraites
          if (dataCount.length > 0) {
            extractionMessage += `\nDonnées extraites:\n`;
            dataCount.forEach(item => {
              extractionMessage += `• ${item}\n`;
            });
          }
          
          // Vérifier si la carte est périmée
          if (extractedData.publicationDate) {
            const publicationDate = new Date(extractedData.publicationDate);
            const today = new Date();
            const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
            
            if (publicationDate < oneYearAgo) {
              extractionMessage += `\n⚠️ ATTENTION: Cette carte date de plus d'un an !`;
            }
          }
          
          // Message de vérification selon le score
          if (confidenceScore < 0.7) {
            extractionMessage += `\n\nVérifiez et complétez les données avec le bouton ✏️`;
          } else {
            extractionMessage += `\n\nVérifiez les données avec le bouton ✏️ si nécessaire`;
          }
        } else if (extractedText) {
          // Texte extrait mais analyse très faible
          console.log('⚠️ Extraction limitée - peu de données trouvées');
          extractionMessage = `\n\n⚠️ Extraction très limitée (${Math.round(confidenceScore * 100)}%)\n`;
          extractionMessage += `Le texte a été extrait mais peu de données ont été identifiées.\n`;
          extractionMessage += `Utilisez le bouton ✏️ pour compléter les données manuellement.`;
        } else {
          // Pas de texte extrait du tout
          console.log('⚠️ Aucun texte extrait - saisie manuelle nécessaire');
          extractionMessage = '\n\n⚠️ Impossible d\'extraire le texte automatiquement\n';
          if (selectedFile.type === 'application/pdf') {
            extractionMessage += 'Ce PDF est probablement scanné (image).\n';
          }
          extractionMessage += 'Utilisez le bouton "Analyser" 🔍 pour saisir le texte manuellement.';
        }
        
        // Créer l'objet chart avec les données extraites ou par défaut
        const customChart = {
          icao: importIcao,
          name: `${importIcao} - Import manuel`,
          url: dataUrl,
          fileSize: (selectedFile.size / 1024).toFixed(1) + ' KB',
          isDownloaded: true,
          downloadDate: new Date().toISOString(),
          isCustom: true,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          // Coordonnées par défaut (France métropolitaine)
          coordinates: extractedData.coordinates || {
            lat: 48.8566,  // Paris par défaut
            lon: 2.3522
          },
          // Utiliser les données extraites ou les valeurs par défaut
          extractedData: {
            ...extractedData,
            // S'assurer que la date de publication est incluse
            publicationDate: extractedData.publicationDate || null,
            // S'assurer que certains champs existent
            airportElevation: extractedData.airportElevation || 0,
            runways: extractedData.runways || [],
            frequencies: extractedData.frequencies || {
              twr: '',
              gnd: '',
              atis: ''
            },
            circuitAltitude: extractedData.circuitAltitude || 0,
            magneticVariation: extractedData.magneticVariation || 2,
            vfrPoints: extractedData.vfrPoints || [],
            obstacles: extractedData.obstacles || [],
            // Marquer si extraction manuelle nécessaire selon la confiance
            needsManualExtraction: (extractedData.confidenceScore || extractionConfidence || 0) < 0.7 || !extractedText,
            autoExtracted: true,
            extractionConfidence: extractedData.confidenceScore || extractionConfidence || 0,
            extractionMethod: 'enhanced' // Toujours enhanced maintenant
          },
          // Sauvegarder le texte extrait pour réanalyse future
          extractedText: extractedText || null,
          // Ajouter les métadonnées d'extraction
          extractionDetails: {
            method: pdfMetadata ? 'pdf-enhanced' : 'manual-enhanced',
            confidence: extractedData.confidenceScore || extractionConfidence || 0,
            hasText: !!extractedText,
            timestamp: new Date().toISOString()
          }
        };
        
        // Stocker dans le store via l'action appropriée
        addCustomChart(importIcao, customChart);
        
        // Stocker dans localStorage pour persistance
        const storedCharts = JSON.parse(localStorage.getItem('customVACCharts') || '{}');
        storedCharts[importIcao] = customChart;
        localStorage.setItem('customVACCharts', JSON.stringify(storedCharts));
        
        // Fermer le modal et réinitialiser
        setShowImportModal(false);
        setImportIcao('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        console.log(`✅ Carte VAC importée pour ${importIcao}`);
        
        // Afficher un message de succès avec résumé de l'extraction
        alert(`✅ Carte VAC importée pour ${importIcao}${extractionMessage}`);
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de l\'import du fichier');
    }
  };
  
  // Charger les aérodromes SIA au démarrage
  useEffect(() => {
    loadSIAAerodromes();
  }, []);

  const handleSIAImport = async (aerodrome) => {
    const props = aerodrome.properties || {};
    const coords = aerodrome.geometry?.coordinates || [];
    
    try {
      // Obtenir les données complètes depuis AIXM
      const fullAerodromeData = await aixmParser.getAerodromeByICAO(props.icao);
      
      console.log(`📊 Import VAC pour ${props.icao} - Données AIXM complètes:`, fullAerodromeData);
      console.log(`📻 Fréquences trouvées:`, fullAerodromeData?.frequencies);
      
      // Créer l'objet VAC avec TOUTES les données AIXM disponibles
      const vacData = {
        icao: props.icao,
        name: fullAerodromeData?.name || props.name || props.icao,
        city: fullAerodromeData?.city || props.city || '',
        type: 'AIXM_COMPLETE',
        isDownloaded: true,
        isCustom: false,
        downloadDate: new Date().toISOString(),
        source: 'AIXM4.5/SIA',
        coordinates: {
          lat: fullAerodromeData?.coordinates?.lat || coords[1] || 0,
          lon: fullAerodromeData?.coordinates?.lon || coords[0] || 0
        },
        magneticVariation: fullAerodromeData?.magneticVariation,
        transitionAltitude: fullAerodromeData?.transitionAltitude,
        referencePoint: fullAerodromeData?.referencePoint,
        // Ajouter les fréquences directement au niveau racine pour compatibilité
        frequencies: fullAerodromeData?.frequencies || {},
        extractedData: {
          airportName: fullAerodromeData?.name || props.name || props.icao,
          airportElevation: fullAerodromeData?.elevation?.value || props.elevation_ft || 0,
          airportType: fullAerodromeData?.type || props.type || 'UNKNOWN',
          runways: (fullAerodromeData?.runways || props.runways || []).map(rwy => ({
            // Toutes les données complètes de piste depuis AIXM
            identifier: rwy.designation || rwy.id,
            designation: rwy.designation,
            length: rwy.length || 0,
            width: rwy.width || 0,
            length_m: rwy.length || 0,
            width_m: rwy.width || 0,
            // QFU et orientation RÉELS depuis AIXM
            qfu: rwy.magneticBearing || rwy.qfu || 0,
            trueBearing: rwy.trueBearing,
            magneticBearing: rwy.magneticBearing,
            orientation: rwy.magneticBearing || rwy.qfu || 0,
            // Distances déclarées RÉELLES depuis AIXM
            tora: rwy.tora || rwy.length || 0,
            toda: rwy.toda || rwy.length || 0,
            asda: rwy.asda || rwy.length || 0,
            lda: rwy.lda || rwy.length || 0,
            surface: rwy.surface || 'ASPH',
            pcn: rwy.pcn,
            // Équipements
            vasis: rwy.vasis,
            ils: rwy.ils,
            threshold: rwy.threshold,
            strength: rwy.strength || '',
            elevation: rwy.elevation || 0,
            threshold_displaced: rwy.threshold_displaced || 0,
            papi: rwy.papi || '',
            lighting: rwy.lighting || '',
            approach_lighting: rwy.approach_lighting || '',
            coordinates: rwy.coordinates || [],
            status: rwy.status || 'ACTIVE',
            remarks: rwy.remarks || ''
          })),
          // Ajouter les fréquences extraites depuis AIXM
          frequencies: fullAerodromeData?.frequencies || props.frequencies || {},
          circuitAltitude: fullAerodromeData?.vacInfo?.circuitAltitude || props.vacInfo?.circuitAltitude || 1000,
          magneticVariation: fullAerodromeData?.magneticVariation?.value || props.vacInfo?.magneticVariation || 2,
          operatingHours: fullAerodromeData?.operatingHours || props.vacInfo?.operatingHours || '',
          fuel: fullAerodromeData?.fuel || props.vacInfo?.fuel || false,
          customs: fullAerodromeData?.customs || props.vacInfo?.customs || false,
          handling: fullAerodromeData?.handling || props.vacInfo?.handling || false,
          remarks: fullAerodromeData?.remarks || props.vacInfo?.remarks || '',
          airspaces: fullAerodromeData?.airspaces || props.airspaces || {},
          navaids: fullAerodromeData?.navaids || [],
          iata: fullAerodromeData?.iata,
          city: fullAerodromeData?.city,
          admin: fullAerodromeData?.admin,
          transitionAltitude: fullAerodromeData?.transitionAltitude || 0,
          referencePoint: fullAerodromeData?.referencePoint || '',
          dataSource: 'AIXM4.5/SIA',
          airac: '2025-09-04',
          extractionDate: new Date().toISOString(),
          confidenceScore: 1.0,
          autoExtracted: true
        }
      };
      
      // Ajouter au store
      addCustomChart(props.icao, vacData);
      
      // Sauvegarder dans localStorage
      const storedCharts = JSON.parse(localStorage.getItem('customVACCharts') || '{}');
      storedCharts[props.icao] = vacData;
      
      // Debug: vérifier ce qui est sauvegardé
      console.log(`💾 Sauvegarde VAC ${props.icao} - Fréquences au niveau racine:`, vacData.frequencies);
      console.log(`💾 Sauvegarde VAC ${props.icao} - Fréquences dans extractedData:`, vacData.extractedData?.frequencies);
      
      localStorage.setItem('customVACCharts', JSON.stringify(storedCharts));
      
      // Mettre à jour uniquement le statut de l'aérodrome importé
      setSIAAerodromes(prevAerodromes => 
        prevAerodromes.map(a => 
          a.properties?.icao === props.icao 
            ? { ...a, properties: { ...a.properties, isImported: true } }
            : a
        )
      );
      
      console.log(`✅ Données VAC importées depuis XML pour ${props.icao}`);
    } catch (error) {
      console.error('Erreur import VAC:', error);
      alert('❌ Erreur lors de l\'import des données VAC');
    }
  };

  const loadSIAAerodromes = async () => {
    try {
      // Ne charger qu'une seule fois si déjà chargé
      if (siaAerodromes.length > 0) {
        return;
      }
      console.log('🔄 Chargement des aérodromes depuis les fichiers AIXM/SIA...');
      const aerodromes = await aixmParser.loadAndParse();
      
      // Convertir au format attendu par le composant
      const formattedAerodromes = aerodromes.map(aerodrome => ({
        geometry: {
          type: 'Point',
          coordinates: [aerodrome.coordinates.lon, aerodrome.coordinates.lat]
        },
        properties: {
          icao: aerodrome.icao,
          name: aerodrome.name,
          city: aerodrome.city,
          // ⚠ DEAD CODE : ce composant `VACModuleOld` n'est plus exporté/utilisé.
          // Conservé pour référence. Conversion d'unité maintenant gérée via
          // `normalizeElevationToFeet` côté parser (cf. aixmParser.js).
          elevation_ft: aerodrome.elevation?.valueFt
            ?? (aerodrome.elevation?.unit === 'FT' ? aerodrome.elevation.value : aerodrome.elevation?.value * 3.28084),
          type: aerodrome.type,
          runways: aerodrome.runways || [],
          frequencies: aerodrome.frequencies || {},
          airspaces: aerodrome.airspaces || {},
          vacInfo: aerodrome.vacInfo || {},
          source: aerodrome.source,
          isImported: !!charts[aerodrome.icao]?.isDownloaded
        }
      }));
      
      setSIAAerodromes(formattedAerodromes);
      setFilteredSIAAerodromes(formattedAerodromes);
      console.log(`✅ ${formattedAerodromes.length} aérodromes chargés depuis XML`);
    } catch (error) {
      console.error('❌ Erreur chargement aérodromes SIA:', error);
    }
  };

  // Filtrer les aérodromes SIA selon la recherche
  useEffect(() => {
    if (!siaSearchTerm) {
      setFilteredSIAAerodromes(siaAerodromes);
      return;
    }

    const search = siaSearchTerm.toLowerCase();
    const filtered = siaAerodromes.filter(aerodrome => {
      const props = aerodrome.properties || {};
      return (
        props.icao?.toLowerCase().includes(search) ||
        props.name?.toLowerCase().includes(search) ||
        props.city?.toLowerCase().includes(search)
      );
    });
    
    setFilteredSIAAerodromes(filtered);
  }, [siaSearchTerm, siaAerodromes]);

  // Charger les cartes custom au démarrage
  useEffect(() => {
    const storedCharts = JSON.parse(localStorage.getItem('customVACCharts') || '{}');
    let needsUpdate = false;
    
    Object.entries(storedCharts).forEach(([icao, chart]) => {
      // Migration: Si pas de publicationDate mais une downloadDate, utiliser la downloadDate
      if (!chart.extractedData?.publicationDate && chart.downloadDate) {
        if (!chart.extractedData) {
          chart.extractedData = {};
        }
        // Utiliser la downloadDate comme approximation de la date de publication
        const downloadDate = new Date(chart.downloadDate);
        // Soustraire 1 mois pour approximer la date de publication
        const approxPublicationDate = new Date(downloadDate);
        approxPublicationDate.setMonth(approxPublicationDate.getMonth() - 1);
        
        chart.extractedData.publicationDate = approxPublicationDate.toISOString().split('T')[0];
        needsUpdate = true;
        console.log(`🔄 Migration: Carte ${icao} - date approximée: ${chart.extractedData.publicationDate}`);
      }
      
      // Log pour debug
      if (chart.extractedData?.publicationDate) {
        console.log(`📅 Carte ${icao} chargée avec date: ${chart.extractedData.publicationDate}`);
      } else {
        console.log(`⚠️ Carte ${icao} chargée sans date de publication`);
      }
      
      // Debug des fréquences chargées
      if (icao === 'LFST') {
        console.log(`🔍 LFST chargé depuis localStorage:`, chart);
        console.log(`🔍 LFST frequencies au niveau racine:`, chart.frequencies);
        console.log(`🔍 LFST frequencies dans extractedData:`, chart.extractedData?.frequencies);
        console.log(`🛬 LFST runways dans extractedData:`, chart.extractedData?.runways);
        console.log(`🛬 LFST runways au niveau racine:`, chart.runways);
      }
      
      // Vérifier si une carte existe déjà (custom ou SIA)
      const existingChart = charts[icao];
      const customVersionExists = charts[`${icao}_CUSTOM`];
      
      // Ne charger que si nécessaire
      if (!existingChart && !customVersionExists) {
        // Pas de carte du tout, ajouter la custom
        addCustomChart(icao, chart);
      } else if (existingChart && !existingChart.isCustom && !customVersionExists) {
        // Une carte SIA existe mais pas de version custom, ajouter la version custom
        addCustomChart(icao, chart);
      }
    });
    
    // Sauvegarder les modifications si nécessaire
    if (needsUpdate) {
      localStorage.setItem('customVACCharts', JSON.stringify(storedCharts));
      console.log('✅ Migration des dates effectuée');
    }
  }, []);
  
  
  // Extraire les codes OACI de la navigation
  const navigationIcaos = waypoints
    .map(wp => wp.name)
    .filter(name => name && name.match(/^[A-Z]{4}$/));
  
  // Filtrer les cartes selon le filtre actif
  const getFilteredCharts = () => {
    // Ne montrer que les cartes importées (isDownloaded = true)
    let filtered = Object.values(charts).filter(c => c.isDownloaded);
    
    // Appliquer les filtres
    switch (filter) {
      case 'custom':
        filtered = filtered.filter(c => c.isCustom);
        break;
      case 'navigation':
        filtered = filtered.filter(c => navigationIcaos.includes(c.icao));
        break;
      // 'all' montre toutes les cartes importées
    }
    
    // Appliquer la recherche
    if (searchIcao) {
      filtered = filtered.filter(c => 
        c.icao.includes(searchIcao.toUpperCase()) ||
        c.name.toLowerCase().includes(searchIcao.toLowerCase())
      );
    }
    
    return filtered;
  };
  
  const filteredCharts = getFilteredCharts();
  
  // Statistiques
  const stats = {
    totalSize: downloadedCharts.reduce((sum, c) => {
      const size = c.fileSize;
      const numericSize = typeof size === 'string' ? parseFloat(size) : (size || 0);
      return sum + (isNaN(numericSize) ? 0 : numericSize);
    }, 0),
    navigation: navigationIcaos.filter(icao => charts[icao]?.isDownloaded).length
  };
  
  return (
    <div style={sx.spacing.p(6)}>
      {/* Écran de disclaimer si non accepté */}
      {!disclaimerAccepted ? (
        <div style={sx.combine(sx.flex.center, { minHeight: '60vh' })}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            <div style={sx.combine(
              sx.components.card.base,
              sx.spacing.p(6),
              { borderColor: '#C04534', borderWidth: '2px' }
            )}>
              <div style={sx.combine(sx.flex.center, sx.spacing.mb(4))}>
                <AlertTriangle size={48} color="#C04534" />
              </div>
              
              <h3 style={sx.combine(sx.text.xl, sx.text.bold, sx.text.left, sx.spacing.mb(4))}>
                AVERTISSEMENT IMPORTANT - RESPONSABILITÉ DU COMMANDANT DE BORD
              </h3>
              
              <div style={sx.combine(sx.text.base, sx.spacing.mb(6))}>
                <p style={sx.spacing.mb(3)}>
                  <strong>Avant d'utiliser ce module, vous devez comprendre et accepter les conditions suivantes :</strong>
                </p>
                
                <ul style={{ paddingLeft: '24px', lineHeight: '1.8' }}>
                  <li style={sx.spacing.mb(2)}>
                    Les cartes VAC et leurs analyses sont fournies <strong>à titre indicatif uniquement</strong> et ne remplacent en aucun cas les documents officiels
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Le commandant de bord est <strong>seul responsable</strong> de télécharger et vérifier les cartes VAC officielles depuis le site du Service de l'Information Aéronautique (SIA)
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Les données extraites peuvent contenir des <strong>erreurs, être incomplètes ou obsolètes</strong>
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Toute décision opérationnelle reste sous la <strong>responsabilité exclusive du commandant de bord</strong>
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Vous devez <strong>toujours vérifier</strong> la validité, l'exactitude et la mise à jour des cartes avant utilisation
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Cette application est un <strong>outil d'aide</strong> et ne peut se substituer au jugement professionnel du pilote
                  </li>
                  <li style={sx.spacing.mb(2)}>
                    Les développeurs de cette application <strong>déclinent toute responsabilité</strong> en cas d'erreur, d'omission ou de mauvaise utilisation
                  </li>
                </ul>
                
                <div style={sx.combine(
                  sx.components.alert.base,
                  sx.components.alert.warning,
                  sx.spacing.mt(4)
                )}>
                  <Info size={20} />
                  <div>
                    <p style={sx.text.sm}>
                      <strong>Rappel réglementaire :</strong> Conformément à la réglementation aéronautique, 
                      le commandant de bord doit s'assurer de disposer de toute la documentation à jour 
                      nécessaire au vol, incluant les cartes VAC officielles.
                    </p>
                  </div>
                </div>
              </div>
              
              <div style={sx.combine(sx.flex.center, sx.spacing.gap(4))}>
                <button
                  onClick={() => window.history.back()}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                >
                  ← Retour
                </button>
                
                <button
                  onClick={handleAcceptDisclaimer}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.primary,
                    { 
                      backgroundColor: '#C04534',
                      '&:hover': { backgroundColor: '#C04534' }
                    }
                  )}
                >
                  J'ai lu et j'accepte ces conditions
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Disclaimer permanent en haut du module */}
          <div style={sx.combine(
            sx.components.alert.base, 
            sx.components.alert.danger, 
            sx.spacing.mb(6),
            { borderWidth: '2px' }
          )}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                ⚠️ RAPPEL - RESPONSABILITÉ DU COMMANDANT DE BORD
              </h4>
              <p style={sx.text.sm}>
                Les cartes VAC doivent être téléchargées depuis le site officiel du SIA. 
                Les données affichées ici sont indicatives. Le commandant de bord reste seul responsable de la vérification des informations.
                <button
                  onClick={() => {
                    localStorage.removeItem('vac-disclaimer-accepted');
                    setDisclaimerAccepted(false);
                  }}
                  style={{
                    marginLeft: '12px',
                    fontSize: '12px',
                    color: '#C04534',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Relire l'avertissement complet
                </button>
              </p>
            </div>
          </div>

          {/* Contenu du module */}
          <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
              <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
                🗺️ Gestion des cartes VAC
              </h3>
              
              {/* Boutons d'import */}
              <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
                <button
                  onClick={() => {
                    setShowImportModal(true);
                    setSelectedFile(null);
                    setImportIcao('');
                  }}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.primary,
                    sx.flex.row,
                    sx.spacing.gap(2)
                  )}
                >
                  <Upload size={16} />
                  Import manuel
                </button>
              </div>
            </div>
          
          {/* Statistiques */}
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(4), sx.text.sm)}>
            <StatCard 
              icon={Map} 
              value={downloadedCharts.length} 
              label="Cartes importées" 
              color="primary"
            />
            <StatCard 
              icon={HardDrive} 
              value={stats.totalSize.toFixed(1)} 
              label="MB utilisés" 
              color="secondary"
            />
            {navigationIcaos.length > 0 && (
              <StatCard 
                icon={CheckCircle} 
                value={stats.navigation} 
                total={navigationIcaos.length} 
                label="Navigation" 
                color="warning"
              />
            )}
          </div>
        </section>
        
        {/* Alerte si cartes manquantes pour la navigation */}
        {navigationIcaos.length > 0 && stats.navigation < navigationIcaos.length && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
            <AlertTriangle size={20} />
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                Cartes manquantes pour votre navigation
              </p>
              <p style={sx.text.sm}>
                {navigationIcaos.filter(icao => !charts[icao]?.isDownloaded).join(', ')}
              </p>
            </div>
          </div>
        )}
        
        {/* Section de recherche SIA - Toujours visible */}
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(4))}>
          <div style={sx.combine(sx.spacing.mb(3))}>
            <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
              Rechercher dans la base SIA locale
            </h4>
              
              {/* Barre de recherche */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: sx.theme.colors.gray[400]
                }} />
                <input
                  type="text"
                  placeholder="Rechercher par code OACI, nom ou ville..."
                  value={siaSearchTerm}
                  onChange={(e) => setSIASearchTerm(e.target.value)}
                  autoFocus
                  style={sx.combine(sx.components.input.base, { paddingLeft: '36px' })}
                />
              </div>
              
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {filteredSIAAerodromes.length} aérodrome(s) trouvé(s) dans la base SIA
              </div>
              
              {/* Liste des aérodromes SIA */}
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '8px'
                }}>
                  {filteredSIAAerodromes.slice(0, 50).map((aerodrome) => {
                    const props = aerodrome.properties || {};
                    const isImported = props.isImported;
                    
                    return (
                      <div
                        key={props.icao}
                        onClick={() => !isImported && handleSIAImport(aerodrome)}
                        style={{
                          padding: '10px',
                          border: `1px solid ${isImported ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: isImported ? 'default' : 'pointer',
                          background: isImported ? '#E8F5E9' : 'white',
                          transition: 'all 0.2s',
                          ':hover': !isImported && { borderColor: 'var(--text-secondary)', background: 'var(--bg-overlay)' }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {props.icao}
                              {props.source && (
                                <span style={{ 
                                  fontSize: '9px', 
                                  padding: '1px 4px', 
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: props.source === 'AIXM' ? '#e3f2fd' : '#fff3e0',
                                  color: props.source === 'AIXM' ? '#1976d2' : '#f57c00'
                                }}>
                                  {props.source}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {props.name || 'Sans nom'}
                            </div>
                            {props.city && (
                              <div style={{ fontSize: '11px', color: '#999' }}>
                                {props.city}
                              </div>
                            )}
                            {props.elevation_ft > 0 && (
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Alt: {props.elevation_ft}ft
                              </div>
                            )}
                          </div>
                          {isImported && (
                            <CheckCircle size={16} color="var(--text-primary)" />
                          )}
                        </div>
                        {(props.frequencies?.twr || props.frequencies?.info) && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {props.frequencies.twr && `TWR: ${props.frequencies.twr}`}
                            {props.frequencies.twr && props.frequencies.info && ' • '}
                            {props.frequencies.info && `INFO: ${props.frequencies.info}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filteredSIAAerodromes.length > 50 && (
                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Affichage limité aux 50 premiers résultats. Affinez votre recherche.
                  </div>
                )}
            </div>
          </div>
        </section>
      
      {/* Liste des cartes */}
      <section>
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredCharts.map(chart => (
            <ChartCard 
              key={chart.icao}
              chart={chart}
              isInNavigation={navigationIcaos.includes(chart.icao)}
              onDelete={() => deleteChart(chart.icao)}
              onView={() => selectChart(chart.icao)}
              onImportManual={(icao) => {
                setImportIcao(icao);
                setShowImportModal(true);
                setSelectedFile(null);
              }}
            />
          ))}
        </div>
        
        {filteredCharts.length === 0 && (
          <div style={sx.combine(sx.text.left, sx.text.secondary, sx.spacing.p(8))}>
            {searchIcao ? 'Aucune carte trouvée' : 'Aucune carte dans cette catégorie'}
          </div>
        )}
      </section>
      
      {/* L'extraction des données est maintenant intégrée dans chaque carte VAC */}
      
      {/* Note d'information */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(6))}>
        <Info size={20} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>
            💡 À propos des cartes VAC
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
            Les cartes VAC (Visual Approach Charts) contiennent les informations essentielles pour les approches à vue.
            Importez vos cartes VAC personnelles en format PDF ou image pour les consulter et extraire les données.
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2), sx.text.secondary)}>
            <strong>Fonctionnalités :</strong> Import de cartes PDF/images • Visualisation • Extraction et édition des données 
            (altitude, pistes, fréquences, points VFR, obstacles, etc.)
          </p>
        </div>
      </div>
      
          {/* Visualiseur de cartes */}
          <VACViewer />
          
          {/* Modal d'import manuel */}
          {showImportModal && (
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
              zIndex: 9999
            }}>
              <div style={sx.combine(
                sx.components.card.base,
                {
                  maxWidth: '500px',
                  width: '90%',
                  padding: '24px',
                  backgroundColor: 'var(--bg-overlay)'
                }
              )}>
                <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
                  <FileImage size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  Importer une carte VAC
                </h3>
                
                <div style={sx.spacing.mb(4)}>
                  <label style={sx.combine(sx.components.label.base, sx.spacing.mb(2))}>
                    Code OACI de l'aérodrome
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LFPG"
                    value={importIcao}
                    onChange={(e) => setImportIcao(e.target.value.toUpperCase())}
                    maxLength={4}
                    style={sx.combine(sx.components.input.base)}
                  />
                </div>
                
                <div style={sx.spacing.mb(4)}>
                  <label style={sx.combine(sx.components.label.base, sx.spacing.mb(2))}>
                    Fichier de la carte VAC
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={sx.combine(sx.components.input.base, {
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: selectedFile ? 'var(--bg-overlay)' : 'white',
                      borderColor: selectedFile ? 'var(--text-primary)' : 'var(--text-tertiary)'
                    })}
                  >
                    <FileImage size={20} color={selectedFile ? 'var(--text-primary)' : 'var(--text-secondary)'} />
                    {selectedFile ? (
                      <span style={{ color: 'var(--text-primary)' }}>
                        ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Cliquez pour sélectionner un fichier...</span>
                    )}
                  </div>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                    Formats acceptés : PNG, JPG, PDF (max 10 MB)
                  </p>
                </div>
                
                <div style={sx.combine(
                  sx.components.alert.base,
                  sx.components.alert.info,
                  sx.spacing.mb(4)
                )}>
                  <Info size={16} />
                  <div>
                    <p style={sx.text.sm}>
                      Les cartes importées manuellement sont stockées localement dans votre navigateur. 
                      Assurez-vous d'utiliser des cartes VAC officielles et à jour.
                    </p>
                    <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
                      <strong>Date de la carte :</strong> Le système extrait automatiquement la date depuis le contenu 
                      de la carte (AIRAC, date de publication). Si aucune date n'est trouvée, la date de création 
                      du fichier sera utilisée.
                    </p>
                  </div>
                </div>
                
                <div style={sx.combine(sx.flex.row, sx.flex.end, sx.spacing.gap(3))}>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportIcao('');
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleFileImport}
                    disabled={!importIcao.match(/^[A-Z]{4}$/) || !selectedFile}
                    style={sx.combine(
                      sx.components.button.base,
                      sx.components.button.primary,
                      (!importIcao.match(/^[A-Z]{4}$/) || !selectedFile) && { 
                        opacity: 0.5, 
                        cursor: 'not-allowed' 
                      }
                    )}
                  >
                    <Upload size={16} />
                    Importer la carte
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

// Composant pour une carte statistique
const StatCard = memo(({ icon: Icon, value, total, label, color }) => {
  // Utiliser une couleur par défaut si la couleur n'existe pas
  const validColors = {
    primary: 'var(--text-secondary)',
    success: 'var(--text-primary)',
    warning: 'var(--accent-primary)',
    danger: '#C04534',
    secondary: 'var(--text-secondary)'
  };
  
  const iconColor = validColors[color] || validColors.primary;
  
  return (
    <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
      <Icon size={20} style={{ color: iconColor }} />
      <div>
        <p style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
          {value}{total && <span style={sx.text.secondary}>/{total}</span>}
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary, { margin: 0 })}>
          {label}
        </p>
      </div>
    </div>
  );
});

// Composant pour une carte VAC
const ChartCard = memo(({ chart, isInNavigation, onDelete, onView, onImportManual }) => {
  const [showEditor, setShowEditor] = useState(false);
  const { updateChartData } = useVACStore();
  
  // Vérifier si la carte est périmée (plus d'un an)
  const checkIfOutdated = () => {
    if (!chart.extractedData?.publicationDate) return false;
    
    const publicationDate = new Date(chart.extractedData.publicationDate);
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    return publicationDate < oneYearAgo;
  };
  
  const isOutdated = checkIfOutdated();
  
  // Formater la date pour l'affichage
  const formatPublicationDate = () => {
    if (!chart.extractedData?.publicationDate) return null;
    const date = new Date(chart.extractedData.publicationDate);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };
  
  return (
    <div style={sx.combine(
      sx.components.card.base,
      isInNavigation && {
        borderColor: sx.theme.colors.primary[500],
        backgroundColor: sx.theme.colors.primary[50]
      }
    )}>
      <div style={sx.combine(sx.flex.between)}>
        {/* Informations principales */}
        <div style={{ flex: 1 }}>
          <div style={sx.combine(sx.flex.start, sx.spacing.gap(3), sx.spacing.mb(2))}>
            <h4 style={sx.combine(sx.text.lg, sx.text.bold, { margin: 0 })}>
              {chart.displayIcao || chart.icao}
              {isInNavigation && (
                <span style={sx.combine(
                  sx.text.xs,
                  sx.spacing.ml(2),
                  {
                    backgroundColor: sx.theme.colors.primary[600],
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)'
                  }
                )}>
                  Navigation
                </span>
              )}
              {/* Badges pour indiquer le type de carte */}
              {chart.isCustomVersion && (
                <span style={sx.combine(
                  sx.text.xs,
                  sx.spacing.ml(2),
                  {
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)'
                  }
                )}>
                  Version perso
                </span>
              )}
              {chart.isCustom && !chart.isCustomVersion && (
                <span style={sx.combine(
                  sx.text.xs,
                  sx.spacing.ml(2),
                  {
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)'
                  }
                )}>
                  Import manuel
                </span>
              )}
            </h4>
            <p style={sx.combine(sx.text.base, sx.text.secondary, { margin: 0 })}>
              {chart.name}
            </p>
          </div>
          
          <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {chart.coordinates && (
              <>
                <div style={sx.combine(sx.flex.row, sx.spacing.gap(3))}>
                  <span>Lat: {chart.coordinates.lat.toFixed(4)}°</span>
                  <span>Lon: {chart.coordinates.lon.toFixed(4)}°</span>
                </div>
                <div style={sx.combine(sx.text.xs, sx.spacing.mt(1), { color: 'var(--text-tertiary)' })}>
                  {Conversions.coordinatesToDMS(chart.coordinates.lat, chart.coordinates.lon).formatted}
                </div>
              </>
            )}
            {chart.isDownloaded && (
              <div style={sx.combine(sx.flex.row, sx.spacing.gap(3), sx.spacing.mt(2))}>
                {/* Date de publication de la carte (prioritaire) */}
                {formatPublicationDate() ? (
                  <span style={sx.combine(
                    sx.flex.start, 
                    sx.spacing.gap(1),
                    isOutdated && { color: '#C04534', fontWeight: 'bold' }
                  )}>
                    <Clock size={12} />
                    Carte: {formatPublicationDate()}
                    {isOutdated && ' ⚠️'}
                  </span>
                ) : (
                  // Si pas de date de publication, afficher la date d'import
                  <span style={sx.combine(sx.flex.start, sx.spacing.gap(1))}>
                    <Upload size={12} />
                    Importé: {new Date(chart.downloadDate).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <span style={sx.combine(sx.flex.start, sx.spacing.gap(1))}>
                  <HardDrive size={12} />
                  {chart.fileSize} MB
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <button
            onClick={onView}
            style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            title="Visualiser"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setShowEditor(true)}
            style={sx.combine(sx.components.button.base, sx.components.button.warning)}
            title="Éditer les données"
          >
            <Edit2 size={16} />
          </button>
          {/* Bouton d'import manuel pour remplacer/ajouter une carte VAC */}
          <button
            onClick={() => onImportManual && onImportManual(chart.icao)}
            style={sx.combine(
              sx.components.button.base,
              {
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-primary)',
                '&:hover': { backgroundColor: 'var(--accent-primary)' }
              }
            )}
            title={chart.url ? "Remplacer la carte VAC" : "Importer une carte VAC"}
          >
            <Upload size={16} />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Supprimer la carte importée ${chart.icao} ?`)) {
                onDelete();
              }
            }}
            style={sx.combine(sx.components.button.base, sx.components.button.danger)}
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* Alerte si la carte est périmée */}
      {isOutdated && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(3))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              ⚠️ Carte potentiellement périmée
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Cette carte date de plus d'un an ({formatPublicationDate()}). 
              Vérifiez qu'elle est toujours valide ou importez une version plus récente.
            </p>
          </div>
        </div>
      )}
      
      {/* Modal d'édition des données */}
      {showEditor && (
        <VACDataEditor 
          chart={chart} 
          onClose={() => setShowEditor(false)} 
        />
      )}
    </div>
  );
});

// Export des display names
VACModule.displayName = 'VACModule';
VACModuleOld.displayName = 'VACModuleOld';
StatCard.displayName = 'StatCard';
ChartCard.displayName = 'ChartCard';

export default VACModule;