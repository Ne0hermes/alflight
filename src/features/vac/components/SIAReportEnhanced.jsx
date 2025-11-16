// Rapport SIA amélioré avec onglets, sélection et import VAC
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Save, RefreshCw, ChevronDown, ChevronUp,
  Upload, Star, Plus, Edit2, Lock,
  MapPin, Radio, Plane, Settings, FileText, Navigation, AlertTriangle
} from 'lucide-react';
import { aixmParser } from '@services/aixmParser';
import { useVACStore } from '@core/stores/vacStore';
import { useCustomVFRStore } from '@core/stores/customVFRStore';
// REMOVED: import { getCircuitAltitudes } from '@data/circuitAltitudesComplete'; - File deleted, data must come from official XML

export const SIAReportEnhanced = () => {
  // États principaux
  const [aerodromes, setAerodromes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedData, setEditedData] = useState({});
  const [favoriteAerodromes, setFavoriteAerodromes] = useState(() => {
    const saved = localStorage.getItem('sia_favorite_aerodromes');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('favorites'); // 'all', 'favorites', 'vac'
  const [expandedAerodrome, setExpandedAerodrome] = useState(null);
  const [expandedSection, setExpandedSection] = useState('general');
  const [hideClosedAirports, setHideClosedAirports] = useState(true); // Filtre pour AD CLOSED
  const [dataDate, setDataDate] = useState(''); // Date des données
  const [editMode, setEditMode] = useState({}); // État pour gérer le mode édition par aérodrome
  
  // Référence pour l'import de fichiers (un par aérodrome)
  const fileInputRefs = useRef({});
  
  // Store VAC pour gérer les cartes importées
  const { charts, addCustomChart } = useVACStore(state => ({
    charts: state.charts || {},
    addCustomChart: state.addCustomChart
  }));
  
  // Store pour les points VFR personnalisés
  const { 
    customVFRPoints,
    addCustomVFRPoint,
    updateCustomVFRPoint,
    deleteCustomVFRPoint,
    getCustomVFRPointsByAerodrome
  } = useCustomVFRStore(state => ({
    customVFRPoints: state.customVFRPoints || [],
    addCustomVFRPoint: state.addCustomVFRPoint,
    updateCustomVFRPoint: state.updateCustomVFRPoint,
    deleteCustomVFRPoint: state.deleteCustomVFRPoint,
    getCustomVFRPointsByAerodrome: state.getCustomVFRPointsByAerodrome
  }));

  // Charger toutes les données au montage
  useEffect(() => {
    loadAllAerodromes();
  }, []);

  const loadAllAerodromes = async () => {
    setLoading(true);
    try {
      console.log('📊 Chargement des données SIA/AIXM...');
      const data = await aixmParser.loadAndParse();
      console.log(`✅ ${data.length} aérodromes chargés`);

      // Debug: vérifier si LFST et LFGA sont dans les données
      const lfst = data.find(ad => ad?.icao === 'LFST');
      const lfga = data.find(ad => ad?.icao === 'LFGA');
      console.log('🔍 LFST dans les données chargées:', lfst ? 'OUI' : 'NON', lfst);
      console.log('🔍 LFGA dans les données chargées:', lfga ? 'OUI' : 'NON', lfga);

      // Récupérer la date des données
      const date = aixmParser.getDataDate();
      setDataDate(date);
      
      // Enrichir les données avec les points VFR et services
      const enrichedData = data.map(ad => {
        // Vérifier que l'aérodrome a un ICAO valide
        if (!ad || !ad.icao || typeof ad.icao !== 'string') {
          console.warn('Aérodrome avec ICAO invalide dans les données:', ad);
          return null;
        }

        // TODO: circuitAltitude, integrationAltitude, circuitRemarks must be extracted from official AIXM XML

        return {
          ...ad,
          icao: ad.icao, // S'assurer que l'ICAO est toujours présent
          // NE PAS inventer de valeurs - garder null si pas de données
          runways: ad.runways?.map(rwy => ({
            ...rwy,
            // Garder les valeurs telles quelles - null si pas de données
            tora: rwy.tora,  // null si pas de données dans AIXM
            toda: rwy.toda,  // null si pas de données dans AIXM
            asda: rwy.asda,  // null si pas de données dans AIXM
            lda: rwy.lda     // null si pas de données dans AIXM
          })),
          // Ajouter les points VFR (à implémenter dans le parser)
          vfrPoints: ad.vfrPoints || [],
          // Ajouter les services
          services: ad.services || {
            fuel: false,
            avgas100LL: false,
            jetA1: false,
            maintenance: false,
            customs: false,
            handling: false,
            restaurant: false,
            hotel: false,
            parking: false,
            hangar: false
          },
          // Ajouter les obstacles
          obstacles: ad.obstacles || [],
          // Ajouter les procédures
          procedures: ad.procedures || { departure: [], arrival: [] }
          // circuitAltitude, integrationAltitude, circuitRemarks will be undefined for now
        };
      }).filter(ad => ad !== null); // Filtrer les entrées nulles
      
      // Debug: vérifier les données après enrichissement
      const enrichedLfst = enrichedData.find(ad => ad?.icao === 'LFST');
      const enrichedLfga = enrichedData.find(ad => ad?.icao === 'LFGA');
      console.log('🔍 LFST après enrichissement:', enrichedLfst ? 'OUI' : 'NON', enrichedLfst);
      console.log('🔍 LFGA après enrichissement:', enrichedLfga ? 'OUI' : 'NON', enrichedLfga);

      // Compter les aérodromes valides
      const validCount = enrichedData.filter(ad => ad && ad.icao).length;
      console.log(`✅ ${validCount} aérodromes valides sur ${enrichedData.length}`);

      setAerodromes(enrichedData);

      // Initialiser les données éditables
      const edited = {};
      enrichedData.forEach(ad => {
        if (ad && ad.icao) {
          edited[ad.icao] = { ...ad };
        }
      });
      setEditedData(edited);
      
      // Charger les sélections sauvegardées
      // Les favoris sont déjà chargés dans l'initialisation du state
      // Donc on n'a pas besoin de les recharger ici
    } catch (error) {
      console.error('❌ Erreur chargement SIA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonctions de formatage
  
  // Convertir décimal en DMS (Degrés Minutes Secondes)
  const decimalToDMS = (decimal, isLongitude) => {
    if (!decimal && decimal !== 0) return '';
    
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const secondsDecimal = (minutesDecimal - minutes) * 60;
    const seconds = Math.floor(secondsDecimal);
    
    // Format standard aéronautique : DD°MM'SS"N ou DDD°MM'SS"E
    let dms;
    if (isLongitude) {
      // Longitude : 3 chiffres pour les degrés
      dms = `${degrees.toString().padStart(3, '0')}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
      const direction = decimal >= 0 ? 'E' : 'W';
      return `${dms}${direction}`;
    } else {
      // Latitude : 2 chiffres pour les degrés
      dms = `${degrees.toString().padStart(2, '0')}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"`;
      const direction = decimal >= 0 ? 'N' : 'S';
      return `${dms}${direction}`;
    }
  };
  
  // Convertir DMS en décimal
  const dmsToDecimal = (dmsString) => {
    if (!dmsString) return null;
    
    // Patterns possibles :
    // - Format standard : DD°MM'SS"N ou DDD°MM'SS"E
    // - Format avec espaces : DD MM SS N
    // - Format AIXM : DDMMSS.SSN (compact)
    
    // D'abord essayer le format AIXM compact
    const aixmPattern = /^(\d{2,3})(\d{2})(\d{2})(?:\.(\d+))?([NSEW])$/;
    let match = dmsString.trim().match(aixmPattern);
    
    if (!match) {
      // Essayer le format standard avec séparateurs
      const standardPattern = /(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2})(?:\.(\d+))?["'\s]*([NSEW])/i;
      match = dmsString.match(standardPattern);
    };
    if (!match) return null;
    
    const degrees = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const decimals = match[4] ? parseInt(match[4]) / Math.pow(10, match[4].length) : 0;
    const direction = match[5].toUpperCase();
    
    let decimal = degrees + minutes/60 + (seconds + decimals)/3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  };
  
  const formatSurface = (surface) => {
    if (!surface) return '';
    // Convertir les codes AIXM en texte lisible
    const surfaceMap = {
      'CONC': 'Béton',
      'ASPH': 'Asphalte',
      'GRASS': 'Herbe',
      'GRAVEL': 'Gravier',
      'SAND': 'Sable',
      'WATER': 'Eau',
      'CONC_ASPH': 'Béton/Asphalte',
      'UNKNOWN': 'Inconnue'
    };
    return surfaceMap[surface] || surface;
  };

  const formatQFU = (qfu) => {
    if (!qfu) return '';
    const value = parseFloat(qfu);
    if (isNaN(value)) return '';
    return value.toFixed(1);
  };

  // Mettre à jour une valeur
  const updateValue = (icao, path, value) => {
    const newData = { ...editedData };
    const keys = path.split('.');
    let obj = newData[icao];

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    setEditedData(newData);
    setHasChanges(true);
  };

  // Style des inputs en fonction du mode édition
  const getInputStyle = (icao, hasValue, isRequired = false) => {
    const isEditable = editMode[icao];
    if (!isEditable) {
      return {
        ...styles.input,
        backgroundColor: '#f3f4f6',
        cursor: 'default',
        borderColor: '#d1d5db'
      };
    }
    return {
      ...styles.input,
      backgroundColor: hasValue ? 'white' : (isRequired ? '#fee2e2' : '#fef3c7'),
      borderColor: hasValue ? '#d1d5db' : (isRequired ? '#ef4444' : '#f59e0b'),
      cursor: 'text'
    };
  };

  // Gérer les favoris
  const toggleFavorite = (icao) => {
    const newFavorites = new Set(favoriteAerodromes);
    if (newFavorites.has(icao)) {
      newFavorites.delete(icao);
    } else {
      newFavorites.add(icao);
    }
    setFavoriteAerodromes(newFavorites);
    localStorage.setItem('sia_favorite_aerodromes', JSON.stringify(Array.from(newFavorites)));
  };

  // Importer une carte VAC pour un aérodrome spécifique
  const handleVACImport = (icao) => async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Debug: voir ce qui est passé
    console.log('handleVACImport called with icao:', icao, 'type:', typeof icao);
    
    // Vérifier que l'ICAO est valide
    if (!icao || typeof icao !== 'string') {
      console.error('ICAO invalide:', icao, 'type:', typeof icao);
      return;
    }
    
    try {
      // Créer une URL pour le fichier
      const fileUrl = URL.createObjectURL(file);
      
      // Ajouter la carte au store pour cet aérodrome spécifique
      await addCustomChart(icao, {
        name: file.name,
        url: fileUrl,
        file: file,
        isDownloaded: true,
        downloadDate: Date.now(),
        needsManualExtraction: true
      });
      
      // Forcer le re-render pour voir le badge VAC mis à jour
      setEditedData(prev => ({...prev}));
      
      console.log(`✅ Carte VAC importée pour ${icao}`);
    } catch (error) {
      console.error('Erreur import VAC:', error);
    }
    
    // Réinitialiser l'input pour permettre de réimporter
    event.target.value = '';
  };

  // Sauvegarder toutes les modifications
  const saveAllChanges = () => {
    localStorage.setItem('sia_edited_data', JSON.stringify(editedData));
    setHasChanges(false);
    alert('✅ Modifications sauvegardées');
  };

  // Filtrer les aérodromes
  const filteredAerodromes = aerodromes.filter(ad => {
    // Debug: vérifier la structure des aérodromes
    if (!ad || !ad.icao) {
      console.warn('Aérodrome sans ICAO:', ad);
      return false;
    }

    // Debug LFST et LFGA
    if (ad.icao === 'LFST' || ad.icao === 'LFGA') {
      console.log(`🔍 Debug ${ad.icao}:`, {
        icao: ad.icao,
        name: ad.name,
        city: ad.city,
        searchTerm: searchTerm,
        matchesSearch: ad.icao?.toLowerCase().includes(searchTerm.toLowerCase()),
        activeTab: activeTab,
        isFavorite: favoriteAerodromes.has(ad.icao),
        hasVAC: charts[ad.icao]?.isDownloaded
      });
    }

    // Filtre pour les aérodromes fermés
    const isClosed = ad.remarks?.toLowerCase().includes('ad closed') ||
                     ad.remarks?.toLowerCase().includes('closed') ||
                     ad.specialInstructions?.toLowerCase().includes('fermé');

    if (hideClosedAirports && isClosed) {
      return false;
    }

    const matchesSearch = !searchTerm ||
      ad.icao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.city?.toLowerCase().includes(searchTerm.toLowerCase());

    // Si on fait une recherche, ignorer le filtre d'onglet pour afficher tous les résultats
    if (searchTerm) {
      return matchesSearch;
    }

    // Si pas de recherche, appliquer le filtre d'onglet
    const matchesTab =
      activeTab === 'all' ? true :
      activeTab === 'favorites' ? favoriteAerodromes.has(ad.icao) :
      activeTab === 'vac' ? charts[ad.icao]?.isDownloaded :
      true;

    return matchesSearch && matchesTab;
  });

  // Styles
  const styles = {
    container: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '16px',
      backgroundColor: '#f3f4f6'
    },
    header: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: '12px'
    },
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '12px',
      borderBottom: '2px solid #e5e7eb',
      paddingBottom: '0'
    },
    tab: {
      padding: '8px 16px',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottomWidth: '2px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'transparent',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      color: '#6b7280',
      transition: 'all 0.2s',
      marginBottom: '-2px'
    },
    tabActive: {
      color: '#3b82f6',
      borderBottomColor: '#3b82f6'
    },
    controls: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchBox: {
      flex: '1',
      minWidth: '200px',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s'
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: 'white',
      color: '#374151',
      border: '1px solid #d1d5db'
    },
    successButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    gridContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '12px'
    },
    aerodromeCard: {
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer'
    },
    aerodromeCardSelected: {
      boxShadow: '0 0 0 2px #3b82f6',
      transform: 'scale(1.02)'
    },
    cardHeader: {
      padding: '12px',
      backgroundColor: '#1e293b',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: 'bold'
    },
    cardSubtitle: {
      fontSize: '12px',
      opacity: '0.9',
      marginTop: '2px'
    },
    cardBody: {
      padding: '12px'
    },
    detailSection: {
      marginBottom: '16px'
    },
    sectionTabs: {
      display: 'flex',
      flexWrap: 'wrap', // Permet aux onglets de passer à la ligne si nécessaire
      gap: '2px',
      marginBottom: '12px',
      borderBottom: '1px solid #e5e7eb'
    },
    sectionTab: {
      padding: '6px 12px',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottomWidth: '2px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'transparent',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '500',
      color: '#6b7280',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      marginBottom: '-1px'
    },
    sectionTabActive: {
      color: '#3b82f6',
      borderBottomColor: '#3b82f6',
      backgroundColor: '#eff6ff'
    },
    field: {
      marginBottom: '8px'
    },
    label: {
      fontSize: '11px',
      fontWeight: '500',
      color: '#6b7280',
      marginBottom: '2px',
      display: 'block'
    },
    input: {
      width: '100%',
      padding: '6px 8px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: '13px',
      backgroundColor: 'white'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '10px',
      fontWeight: '600'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p>Chargement des données SIA/AIXM...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Disclaimer important */}
      <div style={{
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        fontSize: '12px',
        lineHeight: '1.6'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '8px',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            <strong style={{ color: '#92400e', fontSize: '13px' }}>
              AVERTISSEMENT IMPORTANT - Données SIA incomplètes
            </strong>
          </div>
          {dataDate && (
            <span style={{ 
              fontSize: '11px', 
              color: '#92400e',
              fontWeight: '600',
              backgroundColor: '#fed7aa',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              📅 Cycle AIRAC: {dataDate}
            </span>
          )}
        </div>
        <div style={{ color: '#78350f' }}>
          Les extraits du SIA affichés ne comprennent PAS les sections suivantes qui doivent être consultées séparément :
          <ul style={{ 
            margin: '6px 0 6px 20px', 
            padding: 0,
            display: 'grid',
            gridTemplateColumns: window.innerWidth > 768 ? 'repeat(2, 1fr)' : '1fr',
            gap: '4px'
          }}>
            <li>• Consignes particulières / Special instructions</li>
            <li>• Conditions d'utilisation de l'AD</li>
            <li>• Dangers à la navigation aérienne</li>
            <li>• Procédures et consignes particulières</li>
            <li>• Arrivées VFR</li>
            <li>• Départs VFR</li>
            <li>• Transit VFR</li>
            <li>• Vols d'entraînement</li>
            <li>• VFR Spécial</li>
            <li>• VFR de nuit</li>
            <li>• Consignes particulières de radiocommunication</li>
            <li>• Cartes VAC complètes</li>
          </ul>
          <div style={{ 
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #fbbf24',
            fontWeight: '600'
          }}>
            📋 Ces éléments essentiels doivent être ajoutés manuellement par le commandant de bord après consultation des documents officiels (AIP, VAC, NOTAM).
          </div>
        </div>
      </div>

      {/* En-tête avec onglets et contrôles */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          📊 Rapport SIA - Aérodromes France
          {dataDate && (
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 'normal',
              color: '#6b7280',
              marginLeft: '12px'
            }}>
              (Données du {dataDate})
            </span>
          )}
        </h1>
        
        {/* Onglets principaux - Afficher uniquement Favoris */}
        <div style={styles.tabs}>
          <button
            onClick={() => {
              // Effacer la recherche pour voir les favoris
              setSearchTerm('');
              setActiveTab('favorites');
              // Scroll vers le haut de la page
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              ...styles.tab,
              ...(activeTab === 'favorites' ? styles.tabActive : {})
            }}
          >
            ⭐ Mes aérodromes sauvegardés ({favoriteAerodromes.size})
          </button>
        </div>
        
        {/* Barre de recherche principale */}
        <div style={styles.controls}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280'
              }} />
              <input
                type="text"
                placeholder="Rechercher un aérodrome (ex: LFST, LFGA, Strasbourg)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    // La recherche se fait automatiquement via le useEffect
                  }
                }}
                style={{ ...styles.searchBox, paddingLeft: '35px' }}
              />
            </div>
            <button
              onClick={() => {
                if (searchTerm) {
                  // Forcer un refresh de la recherche
                  const temp = searchTerm;
                  setSearchTerm('');
                  setTimeout(() => setSearchTerm(temp), 10);
                }
              }}
              style={{
                ...styles.button,
                ...styles.primaryButton,
                padding: '8px 20px'
              }}
              disabled={!searchTerm}
            >
              <Search size={14} />
              Rechercher
            </button>
          </div>
          
          <button
            onClick={() => setHideClosedAirports(!hideClosedAirports)}
            style={{ 
              ...styles.button, 
              ...styles.secondaryButton,
              ...(hideClosedAirports ? { backgroundColor: '#ef4444', color: 'white' } : {})
            }}
            title={hideClosedAirports ? "Afficher les aérodromes fermés" : "Masquer les aérodromes fermés"}
          >
            {hideClosedAirports ? '🚫' : '✈️'} AD Fermés
          </button>
          
          {hasChanges && (
            <button
              onClick={saveAllChanges}
              style={{ ...styles.button, ...styles.successButton }}
            >
              <Save size={14} />
              Sauver
            </button>
          )}
        </div>
        
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
          {filteredAerodromes.length} aérodrome(s) affiché(s) • 
          {favoriteAerodromes.size} favori(s) • 
          {hideClosedAirports && (() => {
            const closedCount = aerodromes.filter(ad => 
              ad.remarks?.toLowerCase().includes('ad closed') || 
              ad.remarks?.toLowerCase().includes('closed') ||
              ad.specialInstructions?.toLowerCase().includes('fermé')
            ).length;
            return closedCount > 0 ? `${closedCount} fermé(s) masqué(s)` : '';
          })()}
        </div>
      </div>

      {/* Afficher les résultats de recherche uniquement si une recherche est active */}
      {searchTerm && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
            Résultats de recherche ({filteredAerodromes.filter(ad => ad && ad.icao && !favoriteAerodromes.has(ad.icao)).length} trouvés)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '8px' }}>
            {filteredAerodromes
              .filter(ad => ad && ad.icao && typeof ad.icao === 'string' && !favoriteAerodromes.has(ad.icao)) // Vérifier que l'aérodrome est valide
              .slice(0, 20) // Augmenter à 20 résultats
              .map(aerodrome => (
                <div
                  key={aerodrome.icao}
                  style={{
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    ':hover': { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }
                  }}
                  onClick={() => toggleFavorite(aerodrome.icao)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>{aerodrome.icao}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{aerodrome.name}</div>
                      {aerodrome.city && (
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{aerodrome.city}</div>
                      )}
                    </div>
                    <Plus size={16} color="#3b82f6" />
                  </div>
                </div>
              ))}
          </div>
          {filteredAerodromes.filter(ad => !favoriteAerodromes.has(ad.icao)).length > 10 && (
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', textAlign: 'center' }}>
              Affinez votre recherche pour voir plus de résultats
            </p>
          )}
        </div>
      )}

      {/* Grille des aérodromes favoris */}
      {!searchTerm && (
      <div style={styles.gridContainer}>
        {filteredAerodromes
          .filter(aerodrome => aerodrome && aerodrome.icao && typeof aerodrome.icao === 'string' && favoriteAerodromes.has(aerodrome.icao))
          .map(aerodrome => {
          const data = editedData[aerodrome.icao] || aerodrome;
          const isFavorite = favoriteAerodromes.has(aerodrome.icao);
          const isExpanded = expandedAerodrome === aerodrome.icao;
          const hasVAC = charts[aerodrome.icao]?.isDownloaded;
          const isClosed = aerodrome.remarks?.toLowerCase().includes('ad closed') || 
                           aerodrome.remarks?.toLowerCase().includes('closed') ||
                           aerodrome.specialInstructions?.toLowerCase().includes('fermé');
          
          return (
            <div 
              key={aerodrome.icao} 
              style={{
                ...styles.aerodromeCard,
                ...(isFavorite ? styles.aerodromeCardSelected : {}),
                ...(isClosed ? { opacity: 0.7, backgroundColor: '#fee2e2' } : {})
              }}
            >
              {/* En-tête de la carte */}
              <div style={styles.cardHeader}>
                <div 
                  style={{ flex: 1 }}
                  onClick={() => setExpandedAerodrome(isExpanded ? null : aerodrome.icao)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={styles.cardTitle}>
                      {data.icao}
                      {data.iata && <span style={{ opacity: 0.7, fontSize: '14px' }}> / {data.iata}</span>}
                    </div>
                    {isClosed && (
                      <span style={{ 
                        ...styles.badge, 
                        backgroundColor: '#dc2626', 
                        color: 'white' 
                      }}>
                        FERMÉ
                      </span>
                    )}
                    {hasVAC ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Options : visualiser ou réimporter
                          const action = confirm('Carte VAC présente.\n\nOK = Visualiser\nAnnuler = Réimporter');
                          if (action) {
                            // Visualiser la carte
                            const chart = charts[aerodrome.icao];
                            if (chart?.url) {
                              window.open(chart.url, '_blank');
                            } else {
                              console.log('Pas d\'URL disponible pour cette carte');
                            }
                          } else {
                            // Réimporter
                            const inputId = `vac-input-${aerodrome.icao}`;
                            if (!fileInputRefs.current[inputId]) {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,image/*';
                              input.style.display = 'none';
                              input.id = inputId;
                              console.log('Setting up VAC import for aerodrome:', aerodrome, 'icao:', aerodrome.icao);
                            input.onchange = handleVACImport(aerodrome.icao);
                              document.body.appendChild(input);
                              fileInputRefs.current[inputId] = input;
                            }
                            fileInputRefs.current[inputId].click();
                          }
                        }}
                        style={{ 
                          ...styles.badge, 
                          backgroundColor: '#10b981', 
                          color: 'white',
                          cursor: 'pointer',
                          border: 'none',
                          padding: '2px 8px',
                          fontSize: '10px'
                        }}
                        title="Carte VAC importée - Cliquer pour voir ou réimporter"
                      >
                        VAC ✓
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const inputId = `vac-input-${aerodrome.icao}`;
                          if (!fileInputRefs.current[inputId]) {
                            // Créer l'input s'il n'existe pas
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.pdf,image/*';
                            input.style.display = 'none';
                            input.id = inputId;
                            console.log('Setting up VAC import for aerodrome:', aerodrome, 'icao:', aerodrome.icao);
                            input.onchange = handleVACImport(aerodrome.icao);
                            document.body.appendChild(input);
                            fileInputRefs.current[inputId] = input;
                          }
                          fileInputRefs.current[inputId].click();
                        }}
                        style={{
                          ...styles.badge,
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          cursor: 'pointer',
                          border: '1px solid #d1d5db',
                          padding: '2px 8px',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Importer carte VAC"
                      >
                        <Upload size={10} />
                        VAC
                      </button>
                    )}
                  </div>
                  <div style={styles.cardSubtitle}>
                    {data.name || 'Sans nom'}
                    {data.city && ` • ${data.city}`}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Bouton d'édition */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const isEditing = editMode[aerodrome.icao];
                      setEditMode(prev => ({ ...prev, [aerodrome.icao]: !isEditing }));
                      if (!isEditing) {
                        // Ouvrir automatiquement l'aérodrome quand on passe en mode édition
                        setExpandedAerodrome(aerodrome.icao);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    title={editMode[aerodrome.icao] ? 'Verrouiller les modifications' : 'Éditer les données'}
                  >
                    {editMode[aerodrome.icao] ? (
                      <Lock size={20} color="#ef4444" />
                    ) : (
                      <Edit2 size={20} color="#6b7280" />
                    )}
                  </div>

                  {/* Bouton favori */}
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(aerodrome.icao); }}
                    style={{ cursor: 'pointer' }}
                    title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star
                      size={20}
                      color={isFavorite ? '#fbbf24' : 'white'}
                      fill={isFavorite ? '#fbbf24' : 'none'}
                      style={{ transition: 'all 0.2s' }}
                    />
                  </div>
                </div>
              </div>

              {/* Corps de la carte (expandable) */}
              {isExpanded && (
                <div style={styles.cardBody}>
                  {/* Onglets de sections */}
                  <div style={styles.sectionTabs}>
                    <button
                      onClick={() => setExpandedSection('general')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'general' ? styles.sectionTabActive : {})
                      }}
                    >
                      <MapPin size={12} /> Général
                    </button>
                    <button
                      onClick={() => setExpandedSection('runways')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'runways' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Plane size={12} /> Pistes
                    </button>
                    <button
                      onClick={() => setExpandedSection('frequencies')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'frequencies' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Radio size={12} /> Fréq
                    </button>
                    <button
                      onClick={() => setExpandedSection('vfr')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'vfr' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Navigation size={12} /> VFR
                    </button>
                    <button
                      onClick={() => setExpandedSection('services')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'services' ? styles.sectionTabActive : {})
                      }}
                    >
                      <Settings size={12} /> Services
                    </button>
                    <button
                      onClick={() => setExpandedSection('vac')}
                      style={{
                        ...styles.sectionTab,
                        ...(expandedSection === 'vac' ? styles.sectionTabActive : {})
                      }}
                    >
                      <FileText size={12} /> VAC
                    </button>
                  </div>

                  {/* Contenu selon l'onglet actif */}
                  <div style={styles.detailSection}>
                    {expandedSection === 'general' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        <div style={styles.field}>
                          <label style={styles.label}>Altitude terrain (ft)</label>
                          <input
                            type="number"
                            value={data.elevation?.value || ''}
                            onChange={(e) => updateValue(aerodrome.icao, 'elevation.value', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!editMode[aerodrome.icao]}
                            placeholder="?"
                            style={getInputStyle(aerodrome.icao, data.elevation?.value, true)}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Altitude transition (ft)</label>
                          <input
                            type="number"
                            value={data.transitionAltitude || ''}
                            onChange={(e) => updateValue(aerodrome.icao, 'transitionAltitude', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!editMode[aerodrome.icao]}
                            placeholder="?"
                            style={getInputStyle(aerodrome.icao, data.transitionAltitude, true)}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Alt. tour de piste</label>
                          <input
                            type="number"
                            value={data.elevation?.value && data.circuitAltitude ? data.elevation.value + data.circuitAltitude : ''}
                            onChange={(e) => {
                              if (data.elevation?.value && e.target.value) {
                                const aal = parseInt(e.target.value) - data.elevation.value;
                                updateValue(aerodrome.icao, 'circuitAltitude', aal > 0 ? aal : null);
                              }
                            }}
                            placeholder={data.elevation?.value ? data.elevation.value + 1000 : "1627"}
                            title={data.circuitRemarks || 'Altitude QNH des tours de piste'}
                            style={{
                              ...styles.input,
                              backgroundColor: data.circuitAltitude ? 'white' : '#fef3c7',
                              borderColor: data.circuitAltitude ? '#d1d5db' : '#f59e0b'
                            }}
                          />
                          {data.circuitAltitude && (
                            <small style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                              ({data.circuitAltitude} ft AAL)
                            </small>
                          )}
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Alt. intégration</label>
                          <input
                            type="number"
                            value={data.elevation?.value && data.integrationAltitude ? data.elevation.value + data.integrationAltitude : ''}
                            onChange={(e) => {
                              if (data.elevation?.value && e.target.value) {
                                const aal = parseInt(e.target.value) - data.elevation.value;
                                updateValue(aerodrome.icao, 'integrationAltitude', aal > 0 ? aal : null);
                              }
                            }}
                            placeholder={data.elevation?.value ? data.elevation.value + 1500 : "2127"}
                            title="Altitude QNH d'intégration dans le circuit"
                            style={{
                              ...styles.input,
                              backgroundColor: data.integrationAltitude ? 'white' : '#fef3c7',
                              borderColor: data.integrationAltitude ? '#d1d5db' : '#f59e0b'
                            }}
                          />
                          {data.integrationAltitude && (
                            <small style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                              ({data.integrationAltitude} ft AAL)
                            </small>
                          )}
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Latitude</label>
                          <input
                            type="number"
                            value={data.coordinates?.lat || ''}
                            onChange={(e) => updateValue(aerodrome.icao, 'coordinates.lat', e.target.value ? parseFloat(e.target.value) : null)}
                            step="0.0001"
                            placeholder="?"
                            style={{
                              ...styles.input,
                              backgroundColor: data.coordinates?.lat ? 'white' : '#fee2e2',
                              borderColor: data.coordinates?.lat ? '#d1d5db' : '#ef4444'
                            }}
                          />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Longitude</label>
                          <input
                            type="number"
                            value={data.coordinates?.lon || ''}
                            onChange={(e) => updateValue(aerodrome.icao, 'coordinates.lon', e.target.value ? parseFloat(e.target.value) : null)}
                            step="0.0001"
                            placeholder="?"
                            style={{
                              ...styles.input,
                              backgroundColor: data.coordinates?.lon ? 'white' : '#fee2e2',
                              borderColor: data.coordinates?.lon ? '#d1d5db' : '#ef4444'
                            }}
                          />
                        </div>
                        {/* Affichage des coordonnées en DMS */}
                        {(data.coordinates?.lat || data.coordinates?.lon) && (
                          <>
                            <div style={styles.field}>
                              <label style={styles.label}>Lat (DMS)</label>
                              <input
                                type="text"
                                value={data.coordinates?.latDMS || decimalToDMS(data.coordinates?.lat, false)}
                                onChange={(e) => {
                                  // Permettre l'édition manuelle et convertir en décimal
                                  const decimal = dmsToDecimal(e.target.value);
                                  if (decimal !== null) {
                                    updateValue(aerodrome.icao, 'coordinates.lat', decimal);
                                    updateValue(aerodrome.icao, 'coordinates.latDMS', e.target.value);
                                  }
                                }}
                                style={{
                                  ...styles.input,
                                  backgroundColor: data.coordinates?.latDMS ? '#f9fafb' : 'white'
                                }}
                                title={'Format: DD°MM\'SS"N (ex: 48°06\'37"N)'}
                                placeholder={'48°06\'37"N'}
                              />
                            </div>
                            <div style={styles.field}>
                              <label style={styles.label}>Long (DMS)</label>
                              <input
                                type="text"
                                value={data.coordinates?.lonDMS || decimalToDMS(data.coordinates?.lon, true)}
                                onChange={(e) => {
                                  // Permettre l'édition manuelle et convertir en décimal
                                  const decimal = dmsToDecimal(e.target.value);
                                  if (decimal !== null) {
                                    updateValue(aerodrome.icao, 'coordinates.lon', decimal);
                                    updateValue(aerodrome.icao, 'coordinates.lonDMS', e.target.value);
                                  }
                                }}
                                style={{
                                  ...styles.input,
                                  backgroundColor: data.coordinates?.lonDMS ? '#f9fafb' : 'white'
                                }}
                                title={'Format: DDD°MM\'SS"E (ex: 007°21\'33"E)'}
                                placeholder={'007°21\'33"E'}
                              />
                            </div>
                          </>
                        )}
                        {/* Déclinaison magnétique */}
                        <div style={styles.field}>
                          <label style={styles.label}>VAR magnétique</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="number"
                              value={data.magneticVariation?.value || ''}
                              onChange={(e) => updateValue(aerodrome.icao, 'magneticVariation.value', e.target.value ? parseFloat(e.target.value) : null)}
                              step="0.1"
                              placeholder="2.0"
                              style={{
                                ...styles.input,
                                flex: '1',
                                backgroundColor: data.magneticVariation?.value ? 'white' : '#f3f4f6'
                              }}
                              title="Déclinaison magnétique en degrés (+ pour Est, - pour Ouest)"
                            />
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>°</span>
                            <select
                              value={data.magneticVariation?.value > 0 ? 'E' : 'W'}
                              onChange={(e) => {
                                const val = Math.abs(data.magneticVariation?.value || 0);
                                updateValue(aerodrome.icao, 'magneticVariation.value', e.target.value === 'E' ? val : -val);
                              }}
                              style={{
                                ...styles.input,
                                width: '50px',
                                backgroundColor: data.magneticVariation?.value ? 'white' : '#f3f4f6'
                              }}
                            >
                              <option value="E">E</option>
                              <option value="W">W</option>
                            </select>
                          </div>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Année VAR</label>
                          <input
                            type="text"
                            value={data.magneticVariation?.date || ''}
                            onChange={(e) => updateValue(aerodrome.icao, 'magneticVariation.date', e.target.value || null)}
                            placeholder="2025"
                            maxLength="4"
                            style={{
                              ...styles.input,
                              backgroundColor: data.magneticVariation?.date ? 'white' : '#f3f4f6'
                            }}
                            title="Année de référence pour la déclinaison magnétique"
                          />
                        </div>
                        </div>
                        {/* Disclaimer pour les altitudes */}
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '6px', 
                          backgroundColor: '#fef3c7', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#92400e'
                        }}>
                          <strong>⚠️ Altitudes indicatives</strong> : Les altitudes de circuit affichées sont des valeurs standards (1000/1500 ft AAL). 
                          Consultez impérativement les cartes VAC officielles.
                        </div>
                      </div>
                    )}

                    {expandedSection === 'runways' && (
                      <div>
                        {data.runways && data.runways.length > 0 ? (
                          <div style={{ fontSize: '12px' }}>
                            {data.runways.map((rwy, idx) => (
                              <div key={idx} style={{ 
                                padding: '6px', 
                                backgroundColor: idx % 2 ? '#f9fafb' : 'white',
                                borderRadius: '4px',
                                marginBottom: '4px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <strong>{rwy.designation || rwy.identifier}</strong>
                                  <span>{rwy.length}×{rwy.width}m</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>TORA</label>
                                    <input
                                      type="number"
                                      value={rwy.tora || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.tora`, e.target.value ? parseInt(e.target.value) : null)}
                                      placeholder="?"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: rwy.tora ? 'white' : '#fee2e2',
                                        borderColor: rwy.tora ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>TODA</label>
                                    <input
                                      type="number"
                                      value={rwy.toda || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.toda`, e.target.value ? parseInt(e.target.value) : null)}
                                      placeholder="?"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: rwy.toda ? 'white' : '#fee2e2',
                                        borderColor: rwy.toda ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>ASDA</label>
                                    <input
                                      type="number"
                                      value={rwy.asda || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.asda`, e.target.value ? parseInt(e.target.value) : null)}
                                      placeholder="?"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: rwy.asda ? 'white' : '#fee2e2',
                                        borderColor: rwy.asda ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>LDA</label>
                                    <input
                                      type="number"
                                      value={rwy.lda || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.lda`, e.target.value ? parseInt(e.target.value) : null)}
                                      placeholder="?"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: rwy.lda ? 'white' : '#fee2e2',
                                        borderColor: rwy.lda ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                </div>
                                <div style={{ marginTop: '4px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>Surface</label>
                                    <input
                                      type="text"
                                      value={rwy.surface || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.surface`, e.target.value || null)}
                                      placeholder="ASPH"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: rwy.surface ? 'white' : '#fee2e2',
                                        borderColor: rwy.surface ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>QFU (°)</label>
                                    <input
                                      type="number"
                                      value={rwy.qfu || rwy.magneticBearing || ''}
                                      onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.qfu`, e.target.value ? parseFloat(e.target.value) : null)}
                                      placeholder="?"
                                      step="0.1"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        backgroundColor: (rwy.qfu || rwy.magneticBearing) ? 'white' : '#fee2e2',
                                        borderColor: (rwy.qfu || rwy.magneticBearing) ? '#d1d5db' : '#ef4444'
                                      }}
                                    />
                                  </div>
                                </div>
                                <div style={{ marginTop: '4px' }}>
                                  <label style={{ fontSize: '10px', color: '#6b7280' }}>ILS</label>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <select
                                      value={rwy.ils?.category || ''}
                                      onChange={(e) => {
                                        const ilsData = rwy.ils || {};
                                        ilsData.category = e.target.value || null;
                                        updateValue(aerodrome.icao, `runways.${idx}.ils`, e.target.value ? ilsData : null);
                                      }}
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        flex: '0 0 80px',
                                        backgroundColor: rwy.ils ? 'white' : '#fee2e2',
                                        borderColor: rwy.ils ? '#d1d5db' : '#ef4444'
                                      }}
                                    >
                                      <option value="">Aucun</option>
                                      <option value="I">CAT I</option>
                                      <option value="II">CAT II</option>
                                      <option value="III">CAT III</option>
                                      <option value="IIIA">CAT IIIA</option>
                                      <option value="IIIB">CAT IIIB</option>
                                      <option value="IIIC">CAT IIIC</option>
                                    </select>
                                    <input
                                      type="number"
                                      value={rwy.ils?.frequency || ''}
                                      onChange={(e) => {
                                        const ilsData = rwy.ils || {};
                                        ilsData.frequency = e.target.value ? parseFloat(e.target.value) : null;
                                        updateValue(aerodrome.icao, `runways.${idx}.ils`, ilsData);
                                      }}
                                      placeholder="Fréquence MHz"
                                      step="0.01"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        flex: '1'
                                      }}
                                      title="Fréquence ILS en MHz"
                                    />
                                    <input
                                      type="text"
                                      value={rwy.ils?.identifier || ''}
                                      onChange={(e) => {
                                        const ilsData = rwy.ils || {};
                                        ilsData.identifier = e.target.value || null;
                                        updateValue(aerodrome.icao, `runways.${idx}.ils`, ilsData);
                                      }}
                                      placeholder="ID"
                                      maxLength="3"
                                      style={{ 
                                        ...styles.input, 
                                        padding: '2px 4px', 
                                        fontSize: '11px',
                                        flex: '0 0 45px',
                                        textTransform: 'uppercase'
                                      }}
                                      title="Indicatif ILS (3 lettres)"
                                    />
                                  </div>
                                </div>
                                {/* Aides lumineuses */}
                                {rwy.vasis?.type && (
                                  <div style={{ marginTop: '4px' }}>
                                    <label style={{ fontSize: '10px', color: '#6b7280' }}>Aide visuelle</label>
                                    <div style={{ 
                                      display: 'flex', 
                                      gap: '4px',
                                      alignItems: 'center',
                                      padding: '2px 4px',
                                      backgroundColor: '#fef3c7',
                                      borderRadius: '4px',
                                      fontSize: '11px'
                                    }}>
                                      <span style={{ fontWeight: '600' }}>💡 {rwy.vasis.type}</span>
                                      {rwy.vasis.angle > 0 && <span>• Angle: {rwy.vasis.angle}°</span>}
                                      {rwy.vasis.meht > 0 && <span>• MEHT: {rwy.vasis.meht}ft</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: '12px', color: '#6b7280' }}>Aucune piste définie</p>
                        )}
                      </div>
                    )}

                    {expandedSection === 'frequencies' && (
                      <div style={{ fontSize: '12px' }}>
                        {/* Numéro de téléphone d'urgence en haut */}
                        {data.adminInfo?.telephone && (
                          <div style={{
                            marginBottom: '12px',
                            padding: '10px',
                            backgroundColor: '#fef2f2',
                            border: '2px solid #ef4444',
                            borderRadius: '6px'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ fontSize: '16px' }}>☎️</span>
                              <div>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: '#991b1b',
                                  marginBottom: '2px'
                                }}>
                                  URGENCE - Téléphone aérodrome
                                </div>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: '#dc2626'
                                }}>
                                  {data.adminInfo.telephone}
                                </div>
                                <div style={{
                                  fontSize: '10px',
                                  color: '#7f1d1d',
                                  marginTop: '2px',
                                  fontStyle: 'italic'
                                }}>
                                  En cas de panne radio ou urgence au sol
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {data.frequencies && Object.keys(data.frequencies).length > 0 ? (
                          Object.entries(data.frequencies).map(([service, freqs]) => {
                            // Définir les styles et icônes selon le type de service
                            const serviceConfig = {
                              'TWR': { icon: '🗼', color: '#ef4444', label: 'Tour (TWR)' },
                              'GND': { icon: '🚖', color: '#f59e0b', label: 'Sol (GND)' },
                              'APP': { icon: '📡', color: '#3b82f6', label: 'Approche (APP)' },
                              'DEP': { icon: '✈️', color: '#8b5cf6', label: 'Départ (DEP)' },
                              'ATIS': { icon: '📻', color: '#10b981', label: 'ATIS' },
                              'AFIS': { icon: '📢', color: '#06b6d4', label: 'AFIS' },
                              'INFO': { icon: 'ℹ️', color: '#6b7280', label: 'Info' },
                              'CTAF': { icon: '🔊', color: '#ec4899', label: 'Auto-info (CTAF)' },
                              'CLRD': { icon: '📋', color: '#84cc16', label: 'Prévol (CLRD)' },
                              'DEL': { icon: '🎯', color: '#f97316', label: 'Delivery' }
                            };
                            
                            const config = serviceConfig[service.toUpperCase()] || 
                                          { icon: '📻', color: '#6b7280', label: service };
                            
                            return (
                              <div key={service} style={{ 
                                marginBottom: '8px',
                                padding: '6px',
                                backgroundColor: '#f9fafb',
                                borderRadius: '4px',
                                border: `1px solid ${config.color}20`
                              }}>
                                <div style={{ 
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '4px'
                                }}>
                                  <span style={{ fontSize: '14px' }}>{config.icon}</span>
                                  <label style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '600', 
                                    color: config.color
                                  }}>
                                    {config.label}
                                  </label>
                                </div>
                                {Array.isArray(freqs) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {freqs.map((freq, idx) => (
                                      <div key={idx} style={{ display: 'flex', gap: '4px' }}>
                                        <input
                                          type="text"
                                          value={freq.frequency || ''}
                                          onChange={(e) => {
                                            const newFreqs = [...freqs];
                                            newFreqs[idx] = { ...freq, frequency: e.target.value };
                                            updateValue(aerodrome.icao, `frequencies.${service}`, newFreqs);
                                          }}
                                          style={{ 
                                            ...styles.input, 
                                            flex: 1,
                                            backgroundColor: 'white',
                                            borderColor: config.color + '40'
                                          }}
                                          placeholder="118.000"
                                        />
                                        {freq.name && (
                                          <input
                                            type="text"
                                            value={freq.name || ''}
                                            onChange={(e) => {
                                              const newFreqs = [...freqs];
                                              newFreqs[idx] = { ...freq, name: e.target.value };
                                              updateValue(aerodrome.icao, `frequencies.${service}`, newFreqs);
                                            }}
                                            style={{ 
                                              ...styles.input,
                                              flex: 1,
                                              backgroundColor: 'white',
                                              borderColor: config.color + '40'
                                            }}
                                            placeholder="Nom"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={freqs || ''}
                                    onChange={(e) => updateValue(aerodrome.icao, `frequencies.${service}`, e.target.value)}
                                    style={{ 
                                      ...styles.input,
                                      backgroundColor: 'white',
                                      borderColor: config.color + '40'
                                    }}
                                    placeholder="118.000"
                                  />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ 
                            padding: '20px',
                            textAlign: 'center',
                            color: '#9ca3af'
                          }}>
                            <Radio size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p style={{ fontSize: '12px' }}>Aucune fréquence définie</p>
                            <p style={{ fontSize: '11px', marginTop: '4px' }}>
                              Ajoutez des fréquences manuellement
                            </p>
                          </div>
                        )}
                        
                        {/* Bouton pour ajouter une nouvelle fréquence */}
                        <button
                          onClick={() => {
                            const newFreq = prompt('Type de fréquence (TWR, GND, ATIS, APP, etc.):');
                            if (newFreq) {
                              updateValue(aerodrome.icao, `frequencies.${newFreq.toUpperCase()}`, '');
                            }
                          }}
                          style={{
                            marginTop: '8px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={12} /> Ajouter fréquence
                        </button>
                      </div>
                    )}

                    {expandedSection === 'vfr' && (
                      <div>
                        {/* Tous les points VFR (officiels + personnalisés) */}
                        <h4 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                          📍 Points VFR
                        </h4>
                        {(() => {
                          // Combiner les points officiels et personnalisés
                          const officialPoints = data.vfrPoints || [];
                          const customPoints = data.customVfrPoints || [];
                          const allPoints = [...officialPoints, ...customPoints];
                          
                          return allPoints.length > 0 ? (
                            <div style={{ fontSize: '12px', marginBottom: '16px' }}>
                              {allPoints.map((point, idx) => (
                              <div key={point.id || idx} style={{ 
                                padding: '6px',
                                marginBottom: '4px',
                                backgroundColor: point.isCustom ? '#ecfdf5' : (idx % 2 ? '#f9fafb' : 'white'),
                                borderRadius: '4px',
                                border: point.isCustom ? '1px solid #10b981' : 'none'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '2px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {point.isCustom && <span title="Point personnalisé">✨</span>}
                                    <strong>{point.name || point.id}</strong>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: '#6b7280', fontSize: '10px' }}>
                                      {point.type || 'VRP'}
                                    </span>
                                    {point.isCustom && (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Supprimer ${point.name} ?`)) {
                                            // Supprimer le point personnalisé
                                            const newCustomPoints = (data.customVfrPoints || []).filter(p => p.id !== point.id);
                                            updateValue(aerodrome.icao, 'customVfrPoints', newCustomPoints);
                                          }
                                        }}
                                        style={{
                                          padding: '2px',
                                          fontSize: '10px',
                                          backgroundColor: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '2px',
                                          cursor: 'pointer'
                                        }}
                                        title="Supprimer ce point personnalisé"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize: '11px', color: point.isCustom ? '#047857' : '#6b7280' }}>
                                  {point.description}
                                </div>
                                {point.coordinates && (
                                  <div style={{ fontSize: '10px', color: point.isCustom ? '#059669' : '#9ca3af', marginTop: '2px' }}>
                                    {point.coordinates.lat?.toFixed(4)}°N, {point.coordinates.lon?.toFixed(4)}°E
                                  </div>
                                )}
                              </div>
                            ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '12px' }}>
                              Aucun point VFR défini
                            </div>
                          );
                        })()}
                        
                        {/* Bouton pour ajouter un point VFR personnalisé */}
                        <button
                          onClick={() => {
                            const name = prompt('Nom du nouveau point VFR :');
                            if (name) {
                              const lat = parseFloat(prompt('Latitude (décimal) :') || '0');
                              const lon = parseFloat(prompt('Longitude (décimal) :') || '0');
                              const description = prompt('Description (optionnel) :') || '';
                              const type = prompt('Type (E=Entrée, S=Sortie, W=Transit, N=VRP) :') || 'W';
                              
                              const newPoint = {
                                id: `CUSTOM_${Date.now()}`,
                                name,
                                type: type.toUpperCase(),
                                description,
                                coordinates: { lat, lon },
                                isCustom: true
                              };
                              
                              // Ajouter aux points personnalisés de cet aérodrome
                              const currentCustomPoints = data.customVfrPoints || [];
                              updateValue(aerodrome.icao, 'customVfrPoints', [...currentCustomPoints, newPoint]);
                            }
                          }}
                          style={{ 
                            marginTop: '8px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={12} /> Ajouter un point VFR personnalisé
                        </button>
                      </div>
                    )}

                    {expandedSection === 'services' && (
                      <div>
                        {/* Informations de contact */}
                        {data.adminInfo && (
                          <div style={{ 
                            marginBottom: '12px',
                            padding: '8px',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '6px',
                            border: '1px solid #0284c7'
                          }}>
                            <h4 style={{ 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              color: '#075985',
                              marginBottom: '6px'
                            }}>
                              📞 Informations de contact
                            </h4>
                            
                            {data.adminInfo.telephone && (
                              <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                <strong>Téléphone:</strong> {data.adminInfo.telephone}
                              </div>
                            )}
                            
                            {data.adminInfo.fax && (
                              <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                <strong>Fax:</strong> {data.adminInfo.fax}
                              </div>
                            )}
                            
                            {data.adminInfo.email && (
                              <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                <strong>Email:</strong> <a href={`mailto:${data.adminInfo.email}`} style={{ color: '#0284c7' }}>{data.adminInfo.email}</a>
                              </div>
                            )}
                            
                            {data.adminInfo.website && (
                              <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                <strong>Site web:</strong> <a href={data.adminInfo.website} target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7' }}>{data.adminInfo.website}</a>
                              </div>
                            )}
                            
                            {data.adminInfo.gestion && (
                              <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                                <strong>Gestionnaire:</strong> {data.adminInfo.gestion}
                              </div>
                            )}
                            
                            {data.adminInfo.adresse && (
                              <div style={{ fontSize: '11px' }}>
                                <strong>Adresse:</strong> {data.adminInfo.adresse.replace(/#/g, ', ')}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Services disponibles */}
                        <h4 style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#374151',
                          marginBottom: '6px'
                        }}>
                          ✈️ Services disponibles
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                          {[
                            { key: 'fuel', label: 'Carburant' },
                            { key: 'avgas100LL', label: 'AVGAS 100LL' },
                            { key: 'jetA1', label: 'JET A1' },
                            { key: 'maintenance', label: 'Maintenance' },
                            { key: 'customs', label: 'Douanes' },
                            { key: 'handling', label: 'Assistance' },
                            { key: 'restaurant', label: 'Restaurant' },
                            { key: 'hotel', label: 'Hôtel' },
                            { key: 'parking', label: 'Parking' },
                            { key: 'hangar', label: 'Hangar' }
                          ].map(service => (
                            <label key={service.key} style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={data.services?.[service.key] || false}
                                onChange={(e) => updateValue(aerodrome.icao, `services.${service.key}`, e.target.checked)}
                                style={{ width: '14px', height: '14px' }}
                              />
                              {service.label}
                            </label>
                          ))}
                        </div>

                    {/* Consignes particulières extraites */}
                    {(data.specialInstructions || data.remarks || data.additionalRemarks?.length > 0) && (
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '10px', 
                        background: '#fef3c7',
                        borderRadius: '6px',
                        border: '1px solid #fbbf24'
                      }}>
                        <div style={{ 
                          fontSize: '11px', 
                          fontWeight: '600', 
                          color: '#92400e',
                          marginBottom: '6px'
                        }}>
                          📋 Consignes extraites automatiquement
                        </div>
                        
                        {data.specialInstructions && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#78350f',
                            marginBottom: '4px',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {data.specialInstructions}
                          </div>
                        )}
                        
                        {data.remarks && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#78350f',
                            marginBottom: '4px',
                            fontStyle: 'italic'
                          }}>
                            {data.remarks}
                          </div>
                        )}
                        
                        {data.additionalRemarks?.length > 0 && (
                          <ul style={{ 
                            margin: '4px 0 0 16px', 
                            padding: 0,
                            fontSize: '11px',
                            color: '#78350f'
                          }}>
                            {data.additionalRemarks.map((remark, idx) => (
                              <li key={idx}>{remark}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Zone éditable pour consignes manuelles */}
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '10px', 
                      background: '#e0f2fe',
                      borderRadius: '6px',
                      border: '1px solid #0284c7'
                    }}>
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: '600', 
                        color: '#075985',
                        marginBottom: '6px'
                      }}>
                        ✏️ Consignes particulières à ajouter manuellement
                      </div>
                      <textarea
                        placeholder="Ajouter ici : Conditions d'utilisation, Arrivées/Départs VFR, Transit VFR, VFR Spécial, VFR de nuit, Consignes radio, Dangers..."
                        value={data.manualInstructions || ''}
                        onChange={(e) => updateValue(aerodrome.icao, 'manualInstructions', e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '6px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          backgroundColor: 'white'
                        }}
                      />
                      <div style={{ 
                        fontSize: '10px', 
                        color: '#64748b',
                        marginTop: '4px'
                      }}>
                        Consulter AIP, VAC et NOTAM pour les informations complètes
                      </div>
                    </div>
                      </div>
                    )}

                    {/* Section VAC - Gestion des cartes */}
                    {expandedSection === 'vac' && (
                      <div>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f0f9ff',
                          borderRadius: '6px',
                          border: '1px solid #3b82f6',
                          marginBottom: '12px'
                        }}>
                          <h4 style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#1e40af',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <FileText size={14} />
                            Carte VAC pour {aerodrome.icao}
                          </h4>

                          {/* Vérifier si une carte VAC existe */}
                          {charts[aerodrome.icao] ? (
                            <div>
                              <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                                ✅ Carte VAC importée
                                {charts[aerodrome.icao].downloadDate && (
                                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                                    {new Date(charts[aerodrome.icao].downloadDate).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>

                              {/* Informations de la carte */}
                              {charts[aerodrome.icao].extractedData && (
                                <div style={{
                                  fontSize: '11px',
                                  padding: '8px',
                                  backgroundColor: 'white',
                                  borderRadius: '4px',
                                  marginBottom: '8px'
                                }}>
                                  {charts[aerodrome.icao].extractedData.circuitAltitude && (
                                    <div>Circuit: {charts[aerodrome.icao].extractedData.circuitAltitude} ft AAL</div>
                                  )}
                                  {charts[aerodrome.icao].extractedData.runways?.length > 0 && (
                                    <div>{charts[aerodrome.icao].extractedData.runways.length} piste(s) extraite(s)</div>
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (charts[aerodrome.icao]?.url) {
                                      window.open(charts[aerodrome.icao].url, '_blank');
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <FileText size={12} />
                                  Visualiser
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const inputId = `vac-input-${aerodrome.icao}`;
                                    if (!fileInputRefs.current[inputId]) {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = '.pdf,image/*';
                                      input.style.display = 'none';
                                      input.id = inputId;
                                      input.onchange = handleVACImport(aerodrome.icao);
                                      document.body.appendChild(input);
                                      fileInputRefs.current[inputId] = input;
                                    }
                                    fileInputRefs.current[inputId].click();
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Upload size={12} />
                                  Remplacer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '11px', marginBottom: '8px', color: '#6b7280' }}>
                                ℹ️ Aucune carte VAC importée pour cet aérodrome
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const inputId = `vac-input-${aerodrome.icao}`;
                                  if (!fileInputRefs.current[inputId]) {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.pdf,image/*';
                                    input.style.display = 'none';
                                    input.id = inputId;
                                    input.onchange = handleVACImport(aerodrome.icao);
                                    document.body.appendChild(input);
                                    fileInputRefs.current[inputId] = input;
                                  }
                                  fileInputRefs.current[inputId].click();
                                }}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Upload size={14} />
                                Importer carte VAC
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Avertissement */}
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          padding: '8px',
                          backgroundColor: '#fef3c7',
                          borderRadius: '4px',
                          border: '1px solid #f59e0b'
                        }}>
                          ⚠️ Les cartes VAC doivent être téléchargées depuis le site officiel du SIA.
                          Les données affichées sont indicatives.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Résumé quand replié */}
              {!isExpanded && (
                <div style={{ ...styles.cardBody, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                    <span>
                      {data.elevation?.value ? `${data.elevation.value}ft` : '-'}
                      {data.runways?.length > 0 && ` • ${data.runways.length} piste(s)`}
                      {data.polarReference?.beacon && data.polarReference?.bearing && data.polarReference?.distance && 
                        ` • ${data.polarReference.beacon} ${data.polarReference.bearing}°/${data.polarReference.distance}NM`}
                    </span>
                    <span>
                      {data.frequencies && Object.keys(data.frequencies).length > 0 && 
                        `${Object.keys(data.frequencies).length} freq`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* État vide - Aucun favori */}
      {!searchTerm && favoriteAerodromes.size === 0 && (
        <div style={styles.emptyState}>
          <Star size={48} style={{ opacity: 0.3, marginBottom: '16px', color: '#fbbf24' }} />
          <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Aucun aérodrome sauvegardé</p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Utilisez la barre de recherche ci-dessus pour trouver et ajouter des aérodromes
          </p>
        </div>
      )}

      {/* Styles pour l'animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SIAReportEnhanced;