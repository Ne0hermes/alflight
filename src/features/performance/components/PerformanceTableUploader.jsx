// src/features/performance/components/PerformanceTableUploader.jsx
import React, { useState, useEffect } from 'react';
import { Upload, Loader, CheckCircle, AlertTriangle, Info, X, Image, Key, WifiOff, Wifi, FileText } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import unifiedPerformanceService from '../services/unifiedPerformanceService';
import pdfToImageConverter from '../../../services/pdfToImageConverter';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../../core/contexts';
import airportDataService from '../../../services/airportDataService';

const PerformanceTableUploader = ({ onAnalysisComplete }) => {
  const { selectedAircraft } = useAircraft();
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao, weatherData, fetchWeather } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  
  // Log pour debug (désactivé - décommenter si besoin)
  // console.log('🔧 PerformanceTableUploader - État initial:', {
  //   waypoints,
  //   weatherData,
  //   getWeatherByIcao: typeof getWeatherByIcao,
  //   fetchWeather: typeof fetchWeather,
  //   selectedAircraft: selectedAircraft?.registration
  // });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [takeoffImage, setTakeoffImage] = useState(null);
  const [landingImage, setLandingImage] = useState(null);
  const [takeoffPreview, setTakeoffPreview] = useState(null);
  const [landingPreview, setLandingPreview] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  
  // Récupérer l'altitude de l'aérodrome de départ depuis les données SIA
  const getDepartureAltitude = () => {
    if (waypoints && waypoints.length > 0) {
      const departure = waypoints.find(wp => wp.type === 'departure') || waypoints[0];
      if (departure && departure.name) {
        const icaoCode = departure.name.toUpperCase();
        // Utiliser le service de données aéroport (données SIA exclusivement)
        return airportDataService.getAirportElevation(icaoCode);
      }
    }
    return 0; // Par défaut si aucune altitude trouvée
  };
  
  // Récupérer la température depuis le METAR (départ ou arrivée selon le contexte)
  const getTemperatureFromWeather = (isArrival = false) => {
    if (waypoints && waypoints.length > 0) {
      const airport = isArrival ? 
        (waypoints.find(wp => wp.type === 'arrival') || waypoints[waypoints.length - 1]) :
        (waypoints.find(wp => wp.type === 'departure') || waypoints[0]);
        
      if (airport && airport.name) {
        const icaoCode = airport.name.toUpperCase();
        const weatherData = getWeatherByIcao ? getWeatherByIcao(icaoCode) : null;
        
        // Chercher la température dans différents endroits possibles
        let temperature = null;
        
        // La température est dans decoded.temperature d'après les logs
        if (weatherData?.metar?.decoded?.temperature !== null && weatherData?.metar?.decoded?.temperature !== undefined) {
          temperature = weatherData.metar.decoded.temperature;
        }
        // Fallback sur d'autres emplacements possibles
        else if (weatherData?.metar?.temperature !== null && weatherData?.metar?.temperature !== undefined) {
          temperature = weatherData.metar.temperature;
        }
        
        if (temperature !== null && temperature !== undefined) {
          return temperature;
        }
      }
    }
    return 15; // Température ISA par défaut
  };
  
  // Vérifier si on utilise la température METAR ou ISA
  const hasMetarTemperature = (isArrival = false) => {
    if (waypoints && waypoints.length > 0) {
      const airport = isArrival ? 
        (waypoints.find(wp => wp.type === 'arrival') || waypoints[waypoints.length - 1]) :
        (waypoints.find(wp => wp.type === 'departure') || waypoints[0]);
        
      if (airport && airport.name) {
        const icaoCode = airport.name.toUpperCase();
        const weatherData = getWeatherByIcao(icaoCode);
        
        // Vérifier la température dans decoded.temperature principalement
        const hasTemp = (weatherData?.metar?.decoded?.temperature !== null && weatherData?.metar?.decoded?.temperature !== undefined) ||
                       (weatherData?.metar?.temperature !== null && weatherData?.metar?.temperature !== undefined);
        
        return hasTemp;
      }
    }
    return false;
  };
  
  // Récupérer l'altitude de l'aérodrome d'arrivée depuis les données SIA
  const getArrivalAltitude = () => {
    if (waypoints && waypoints.length > 0) {
      const arrival = waypoints.find(wp => wp.type === 'arrival') || waypoints[waypoints.length - 1];
      if (arrival && arrival.name) {
        const icaoCode = arrival.name.toUpperCase();
        // Utiliser le service de données aéroport (données SIA exclusivement)
        return airportDataService.getAirportElevation(icaoCode);
      }
    }
    return 0; // Par défaut si aucune altitude trouvée
  };
  
  // Calculer la masse d'atterrissage depuis le module Weight & Balance
  const getLandingMass = () => {
    // Si on a des scénarios calculés dans Weight & Balance, utiliser la masse landing
    if (calculations && selectedAircraft && fobFuel) {
      // Calculer les scénarios pour obtenir la masse d'atterrissage
      const fuelDensity = selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72;
      
      // Récupérer les données de carburant
      const fobLiters = fobFuel?.ltr || 0;
      const tripLiters = fuelData?.trip?.ltr || 0;
      
      // Carburant consommé pour le vol
      const consumedFuelKg = tripLiters * fuelDensity;
      
      // Carburant restant à l'atterrissage
      const remainingFuelLiters = Math.max(0, fobLiters - tripLiters);
      const remainingFuelKg = remainingFuelLiters * fuelDensity;
      
      // Masse FOB au décollage en kg
      const fobKg = fobLiters * fuelDensity;
      
      // Masse sans carburant = masse totale - carburant FOB
      const zeroFuelWeight = (calculations?.totalWeight || 0) - fobKg;
      
      // Masse d'atterrissage = masse sans carburant + carburant restant
      const landingMass = zeroFuelWeight + remainingFuelKg;
      
      return Math.round(landingMass);
    }
    
    // Fallback : masse décollage - consommation estimée
    const takeoffMass = calculations?.totalWeight || selectedAircraft?.emptyWeight || 1150;
    const fuelConsumption = fuelData?.trip?.ltr || 0;
    const fuelDensity = selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72;
    const fuelWeight = fuelConsumption * fuelDensity;
    
    return Math.round(takeoffMass - fuelWeight);
  };
  
  // Conditions de vol pour le décollage
  const [takeoffConditions, setTakeoffConditions] = useState({
    mass: calculations?.totalWeight || selectedAircraft?.emptyWeight || 1150,
    altitude: getDepartureAltitude(),
    temperature: getTemperatureFromWeather(false)
  });
  
  // Conditions de vol pour l'atterrissage
  const [landingConditions, setLandingConditions] = useState({
    mass: getLandingMass(),
    altitude: getArrivalAltitude(),
    temperature: getTemperatureFromWeather(true)
  });

  // Tester la clé API au chargement du composant
  useEffect(() => {
    testAPIConnection();
  }, []);
  
  // Charger automatiquement la météo des waypoints
  useEffect(() => {
    const loadWeatherData = async () => {
      if (waypoints && waypoints.length > 0 && fetchWeather) {
        // Charger la météo pour le départ
        const departure = waypoints.find(wp => wp.type === 'departure') || waypoints[0];
        if (departure?.name) {
          const depIcao = departure.name.toUpperCase();
          await fetchWeather(depIcao);
        }
        
        // Charger la météo pour l'arrivée
        const arrival = waypoints.find(wp => wp.type === 'arrival') || waypoints[waypoints.length - 1];
        if (arrival?.name && arrival !== departure) {
          const arrIcao = arrival.name.toUpperCase();
          await fetchWeather(arrIcao);
        }
      }
    };
    
    loadWeatherData();
  }, [waypoints, fetchWeather]);
  
  // Mettre à jour la masse quand l'avion, les calculs ou le carburant changent
  useEffect(() => {
    const takeoffMass = calculations?.totalWeight || selectedAircraft?.emptyWeight || 1150;
    setTakeoffConditions(prev => ({
      ...prev,
      mass: takeoffMass
    }));
    
    // Pour l'atterrissage, utiliser la masse calculée avec la consommation de carburant
    setLandingConditions(prev => ({
      ...prev,
      mass: getLandingMass()
    }));
  }, [selectedAircraft, calculations, fuelData, fobFuel]);
  
  // Mettre à jour les altitudes quand les waypoints changent
  useEffect(() => {
    setTakeoffConditions(prev => ({
      ...prev,
      altitude: getDepartureAltitude()
    }));
    setLandingConditions(prev => ({
      ...prev,
      altitude: getArrivalAltitude()
    }));
  }, [waypoints]);
  
  // Mettre à jour les températures quand la météo change
  useEffect(() => {
    setTakeoffConditions(prev => ({
      ...prev,
      temperature: getTemperatureFromWeather(false)
    }));
    setLandingConditions(prev => ({
      ...prev,
      temperature: getTemperatureFromWeather(true)
    }));
  }, [waypoints, getWeatherByIcao]); // Déclenché quand les waypoints ou la météo changent

  // Fonction pour tester la connexion API
  const testAPIConnection = async () => {
    setIsTestingAPI(true);
    try {
      const result = await unifiedPerformanceService.testAPIConnection();
      setApiStatus(result);
      console.log('API test result:', result);
    } catch (err) {
      setApiStatus({
        success: false,
        message: `Erreur lors du test: ${err.message}`,
        provider: 'unknown'
      });
    } finally {
      setIsTestingAPI(false);
    }
  };

  // Gestion de l'upload d'image ou PDF
  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (file) {
      console.log(`📁 Fichier chargé: ${file.name}, Type: ${file.type}`);
      
      // Vérifier si c'est un PDF
      if (pdfToImageConverter.isPDF(file)) {
        console.log('📄 Détection d\'un fichier PDF');
        
        try {
          // Afficher un indicateur de chargement
          if (type === 'takeoff') {
            setTakeoffPreview('loading');
          } else {
            setLandingPreview('loading');
          }
          
          // Convertir le PDF en image
          const tableData = await pdfToImageConverter.findPerformanceTablePage(file, type);
          const base64Image = tableData.base64;
          
          // Créer un aperçu à partir de l'image convertie
          const previewUrl = `data:image/jpeg;base64,${base64Image}`;
          
          if (type === 'takeoff') {
            setTakeoffImage({ 
              file: file,
              base64: base64Image,
              isPDF: true,
              pageNumber: tableData.pageNumber
            });
            setTakeoffPreview(previewUrl);
          } else {
            setLandingImage({ 
              file: file,
              base64: base64Image,
              isPDF: true,
              pageNumber: tableData.pageNumber
            });
            setLandingPreview(previewUrl);
          }
          
          if (tableData.warning) {
            console.log(`⚠️ ${tableData.warning}`);
          }
          
        } catch (error) {
          console.error('❌ Erreur conversion PDF:', error);
          setError(`Erreur lors de la conversion du PDF: ${error.message}`);
          if (type === 'takeoff') {
            setTakeoffPreview(null);
          } else {
            setLandingPreview(null);
          }
        }
      } else {
        // Traitement normal pour les images
        if (type === 'takeoff') {
          setTakeoffImage(file);
          // Créer un aperçu
          const reader = new FileReader();
          reader.onload = (e) => setTakeoffPreview(e.target.result);
          reader.readAsDataURL(file);
        } else {
          setLandingImage(file);
          // Créer un aperçu
          const reader = new FileReader();
          reader.onload = (e) => setLandingPreview(e.target.result);
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Lancer l'analyse
  const handleAnalyze = async () => {
    if (!takeoffImage && !landingImage) {
      setError('Veuillez charger au moins un tableau de performances');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);

    try {
      // Préparer les images pour l'analyse
      let takeoffImageToAnalyze = null;
      let landingImageToAnalyze = null;
      
      // Pour les PDF, utiliser l'image base64 déjà convertie
      if (takeoffImage) {
        if (takeoffImage.isPDF) {
          // Créer un objet Blob à partir du base64 pour l'analyse
          const byteCharacters = atob(takeoffImage.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          takeoffImageToAnalyze = new Blob([byteArray], { type: 'image/jpeg' });
        } else {
          takeoffImageToAnalyze = takeoffImage;
        }
      }
      
      if (landingImage) {
        if (landingImage.isPDF) {
          const byteCharacters = atob(landingImage.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          landingImageToAnalyze = new Blob([byteArray], { type: 'image/jpeg' });
        } else {
          landingImageToAnalyze = landingImage;
        }
      }
      
      unifiedPerformanceService.setMode('legacy');
      
      // Analyser les images de décollage et atterrissage séparément
      const takeoffResults = takeoffImageToAnalyze ? 
        await unifiedPerformanceService.analyzeLegacyPerformance(takeoffImageToAnalyze, {
          type: 'takeoff',
          conditions: takeoffConditions
        }) : null;
      
      const landingResults = landingImageToAnalyze ?
        await unifiedPerformanceService.analyzeLegacyPerformance(landingImageToAnalyze, {
          type: 'landing',
          conditions: landingConditions
        }) : null;
      
      // Combiner les résultats
      const results = {
        takeoff: takeoffResults,
        landing: landingResults
      };

      setAnalysisResults(results);
      
      // Transmettre les résultats au composant parent
      if (onAnalysisComplete) {
        onAnalysisComplete(results);
      }

      // Sauvegarder les résultats dans l'avion si possible
      if (selectedAircraft && (results.takeoff || results.landing)) {
        const distances = {};
        
        if (results.takeoff) {
          distances.takeoffRoll = results.takeoff.tod;
          distances.takeoffDistance15m = results.takeoff.toda15m;
          distances.takeoffDistance50ft = results.takeoff.toda50ft;
        }
        
        if (results.landing) {
          distances.landingRoll = results.landing.ld;
          distances.landingDistance15m = results.landing.lda15m;
          distances.landingDistance50ft = results.landing.lda50ft;
        }

        // TODO: Mettre à jour l'avion avec les nouvelles distances
        console.log('Distances extraites:', distances);
      }
    } catch (err) {
      setError(`Erreur lors de l'analyse: ${err.message}`);
      console.error('Analyse error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Réinitialiser
  const handleReset = () => {
    setTakeoffImage(null);
    setLandingImage(null);
    setTakeoffPreview(null);
    setLandingPreview(null);
    setAnalysisResults(null);
    setError(null);
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        🤖 Analyse IA des tableaux de performances
      </h4>

      {/* Statut de l'API */}
      <div style={sx.combine(
        sx.components.alert.base,
        apiStatus?.success ? sx.components.alert.success : sx.components.alert.warning,
        sx.spacing.mb(4)
      )}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isTestingAPI ? (
              <Loader size={16} className="animate-spin" />
            ) : apiStatus?.success ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                {isTestingAPI ? 'Test de la connexion API...' : 
                 apiStatus?.success ? '✅ API connectée' : '⚠️ API non configurée'}
              </p>
              {apiStatus && (
                <>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    {apiStatus.message} 
                    {apiStatus.provider && apiStatus.provider !== 'none' && ` (${apiStatus.provider})`}
                  </p>
                  {apiStatus.details && (
                    <p style={sx.combine(sx.text.xs, sx.text.secondary, { marginTop: '4px' })}>
                      Détails: {apiStatus.details}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {!apiStatus?.success && (
              <button
                onClick={() => {
                  // Ouvrir une modal ou rediriger vers la configuration
                  const configUrl = '#config-api';
                  window.open(configUrl, '_blank', 'width=600,height=700');
                }}
                style={{
                  ...sx.components.button.base,
                  ...sx.components.button.primary,
                  padding: '4px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Key size={12} />
                Configurer
              </button>
            )}
            <button
              onClick={testAPIConnection}
              disabled={isTestingAPI}
              style={{
                ...sx.components.button.base,
                ...sx.components.button.secondary,
                padding: '4px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Key size={12} />
              Tester API
            </button>
          </div>
        </div>
      </div>

      {/* Information */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div>
          <p style={sx.text.sm}>
            Chargez une photo ou capture d'écran des tableaux de performances de votre manuel de vol.
            {apiStatus?.success ? 
              " L'IA analysera automatiquement les distances en fonction de vos conditions." :
              " Mode dégradé : estimation basique sans IA. Configurez une clé API pour une analyse précise."}
          </p>
          {!apiStatus?.success && (
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(2))}>
              💡 Ajoutez <code>VITE_OPENAI_API_KEY</code> dans votre fichier .env pour activer l'analyse IA
            </p>
          )}
        </div>
      </div>

      {/* Conditions de vol */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Conditions de décollage */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
            ✈️ Conditions de décollage
            {waypoints && waypoints[0]?.name && (
              <span style={sx.combine(sx.text.xs, sx.text.secondary, { marginLeft: '8px' })}>
                ({waypoints[0].name})
              </span>
            )}
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Masse (kg)
                {calculations?.totalWeight && (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ M&C
                  </span>
                )}
              </label>
              <input
                type="number"
                value={takeoffConditions.mass}
                onChange={(e) => setTakeoffConditions({...takeoffConditions, mass: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Altitude (ft)
                {getDepartureAltitude() > 0 && (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ {getDepartureAltitude()}ft
                  </span>
                )}
              </label>
              <input
                type="number"
                value={takeoffConditions.altitude}
                onChange={(e) => setTakeoffConditions({...takeoffConditions, altitude: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Temp. (°C)
                {hasMetarTemperature(false) ? (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ METAR
                  </span>
                ) : (
                  <span style={{ marginLeft: '4px', color: '#f59e0b' }}>
                    ⚠️ ISA 15°C
                  </span>
                )}
              </label>
              <input
                type="number"
                value={takeoffConditions.temperature}
                onChange={(e) => setTakeoffConditions({...takeoffConditions, temperature: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
          </div>
        </div>
        
        {/* Conditions d'atterrissage */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
            🛬 Conditions d'atterrissage
            {waypoints && waypoints[waypoints.length - 1]?.name && (
              <span style={sx.combine(sx.text.xs, sx.text.secondary, { marginLeft: '8px' })}>
                ({waypoints[waypoints.length - 1].name})
              </span>
            )}
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Masse (kg)
                {fuelData?.trip?.ltr > 0 && (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ Trip -{Math.round(fuelData.trip.ltr * (selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72))}kg
                  </span>
                )}
              </label>
              <input
                type="number"
                value={landingConditions.mass}
                onChange={(e) => setLandingConditions({...landingConditions, mass: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Altitude (ft)
                {getArrivalAltitude() > 0 && (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ {getArrivalAltitude()}ft
                  </span>
                )}
              </label>
              <input
                type="number"
                value={landingConditions.altitude}
                onChange={(e) => setLandingConditions({...landingConditions, altitude: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
            <div>
              <label style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Temp. (°C)
                {hasMetarTemperature(true) ? (
                  <span style={{ marginLeft: '4px', color: '#10b981' }}>
                    ✓ METAR
                  </span>
                ) : (
                  <span style={{ marginLeft: '4px', color: '#f59e0b' }}>
                    ⚠️ ISA 15°C
                  </span>
                )}
              </label>
              <input
                type="number"
                value={landingConditions.temperature}
                onChange={(e) => setLandingConditions({...landingConditions, temperature: parseFloat(e.target.value)})}
                style={sx.combine(sx.components.input.base, { marginTop: '4px' })}
              />
            </div>
          </div>
        </div>
      </div>
      
      {!selectedAircraft && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <Info size={14} />
          <p style={sx.text.xs}>
            Aucun avion sélectionné. Sélectionnez un avion pour charger automatiquement sa masse.
          </p>
        </div>
      )}
      
      {/* Alerte si température ISA utilisée */}
      {waypoints && waypoints.length > 0 && (!hasMetarTemperature(false) || !hasMetarTemperature(true)) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <AlertTriangle size={14} />
          <div>
            <p style={sx.combine(sx.text.xs, sx.text.bold)}>
              ⚠️ Température ISA utilisée par défaut
            </p>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
              {!hasMetarTemperature(false) && waypoints[0]?.name && (
                <>• {waypoints[0].name}: Pas de METAR disponible, utilisation de 15°C (ISA)<br/></>
              )}
              {!hasMetarTemperature(true) && waypoints[waypoints.length - 1]?.name && waypoints.length > 1 && (
                <>• {waypoints[waypoints.length - 1].name}: Pas de METAR disponible, utilisation de 15°C (ISA)</>
              )}
            </p>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(1), { fontStyle: 'italic' })}>
              Vérifiez et ajustez manuellement les températures pour des calculs plus précis.
            </p>
          </div>
        </div>
      )}

      {/* Upload zones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Tableau de décollage */}
        <div>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Tableau de décollage
          </h5>
          <label
            style={{
              ...sx.components.card.base,
              ...sx.bg.gray,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              cursor: 'pointer',
              border: '2px dashed #9ca3af',
              borderRadius: '8px',
              minHeight: '200px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={(e) => handleImageUpload(e, 'takeoff')}
              style={{ display: 'none' }}
            />
            {takeoffPreview === 'loading' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Loader size={32} className="animate-spin" color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  Conversion du PDF...
                </p>
              </div>
            ) : takeoffPreview ? (
              <>
                <img
                  src={takeoffPreview}
                  alt="Tableau de décollage"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.7
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  padding: '4px',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setTakeoffImage(null);
                  setTakeoffPreview(null);
                }}>
                  <X size={16} />
                </div>
                <CheckCircle size={32} color="#10b981" style={{ position: 'relative', zIndex: 1 }} />
                <p style={sx.combine(sx.text.sm, sx.text.bold, { position: 'relative', zIndex: 1, color: '#10b981' })}>
                  Tableau chargé
                </p>
              </>
            ) : (
              <>
                <Upload size={32} color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(2))}>
                  Cliquez pour charger
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  (TOD, ASD, décollage)
                </p>
              </>
            )}
          </label>
        </div>

        {/* Tableau d'atterrissage */}
        <div>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Tableau d'atterrissage
          </h5>
          <label
            style={{
              ...sx.components.card.base,
              ...sx.bg.gray,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              cursor: 'pointer',
              border: '2px dashed #9ca3af',
              borderRadius: '8px',
              minHeight: '200px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={(e) => handleImageUpload(e, 'landing')}
              style={{ display: 'none' }}
            />
            {landingPreview === 'loading' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Loader size={32} className="animate-spin" color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                  Conversion du PDF...
                </p>
              </div>
            ) : landingPreview ? (
              <>
                <img
                  src={landingPreview}
                  alt="Tableau d'atterrissage"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.7
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  padding: '4px',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setLandingImage(null);
                  setLandingPreview(null);
                }}>
                  <X size={16} />
                </div>
                <CheckCircle size={32} color="#10b981" style={{ position: 'relative', zIndex: 1 }} />
                <p style={sx.combine(sx.text.sm, sx.text.bold, { position: 'relative', zIndex: 1, color: '#10b981' })}>
                  Tableau chargé
                </p>
              </>
            ) : (
              <>
                <Upload size={32} color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(2))}>
                  Cliquez pour charger
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  (LD, LDA, atterrissage)
                </p>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mt(4))}>
        <button
          onClick={handleReset}
          disabled={isAnalyzing}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          Réinitialiser
        </button>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!takeoffImage && !landingImage)}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            isAnalyzing && { opacity: 0.5, cursor: 'not-allowed' }
          )}
        >
          {isAnalyzing ? (
            <>
              <Loader size={16} className="animate-spin" style={{ marginRight: '8px' }} />
              Analyse en cours...
            </>
          ) : (
            <>
              <Image size={16} style={{ marginRight: '8px' }} />
              Analyser les tableaux
            </>
          )}
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(4))}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>{error}</p>
        </div>
      )}

      {/* Résultats */}
      {analysisResults && (
        <div style={sx.spacing.mt(4)}>
          <h5 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
            📊 Résultats de l'analyse
          </h5>

          {analysisResults.takeoff && (
            <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(3))}>
              <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Distances de décollage extraites
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <p style={sx.text.xs}>TOD (roulage)</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.takeoff.tod} m
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>Passage 15m</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.takeoff.toda15m} m
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>Passage 50ft</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.takeoff.toda50ft} m
                  </p>
                </div>
              </div>
              {analysisResults.takeoff.confidence && (
                <div style={sx.spacing.mt(2)}>
                  <p style={sx.text.xs}>
                    Confiance: {analysisResults.takeoff.confidence}%
                  </p>
                  {analysisResults.takeoff.notes && (
                    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      {analysisResults.takeoff.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {analysisResults.landing && (
            <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
              <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Distances d'atterrissage extraites
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <p style={sx.text.xs}>LD (roulage)</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.landing.ld} m
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>Depuis 15m</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.landing.lda15m} m
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>Depuis 50ft</p>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {analysisResults.landing.lda50ft} m
                  </p>
                </div>
              </div>
              {analysisResults.landing.confidence && (
                <div style={sx.spacing.mt(2)}>
                  <p style={sx.text.xs}>
                    Confiance: {analysisResults.landing.confidence}%
                  </p>
                  {analysisResults.landing.notes && (
                    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      {analysisResults.landing.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {analysisResults.errors && analysisResults.errors.length > 0 && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mt(3))}>
              <AlertTriangle size={16} />
              <div>
                <p style={sx.text.sm}>Certaines analyses ont échoué:</p>
                <ul style={sx.spacing.mt(1)}>
                  {analysisResults.errors.map((err, idx) => (
                    <li key={idx} style={sx.text.xs}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Détails des formules de calcul */}
      <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mt(4))}>
        <h5 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
          📐 Formules de calcul utilisées
        </h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Formule masse décollage */}
          <div>
            <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Masse de décollage
            </h6>
            <div style={sx.combine(sx.text.xs, { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '4px' })}>
              <p>Masse décollage = Masse totale (depuis Masse & Centrage)</p>
              <p style={{ marginTop: '4px', color: '#6b7280' }}>
                Source: Module Masse & Centrage → Calculs → Masse totale
              </p>
            </div>
            {calculations?.totalWeight && (
              <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                Valeur actuelle: {calculations.totalWeight} kg
              </p>
            )}
          </div>

          {/* Formule masse atterrissage */}
          <div>
            <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Masse d'atterrissage
            </h6>
            <div style={sx.combine(sx.text.xs, { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '4px' })}>
              <p>1. Densité carburant = {selectedAircraft?.fuelType === 'JET A-1' ? '0.84' : '0.72'} kg/L ({selectedAircraft?.fuelType || 'AVGAS 100LL'})</p>
              <p>2. FOB (kg) = FOB (L) × Densité</p>
              <p>3. ZFW = Masse décollage - FOB (kg)</p>
              <p>4. Carburant consommé (kg) = Trip (L) × Densité</p>
              <p>5. Carburant restant (kg) = FOB (kg) - Carburant consommé (kg)</p>
              <p>6. <strong>Masse atterrissage = ZFW + Carburant restant (kg)</strong></p>
              <p style={{ marginTop: '4px', color: '#6b7280' }}>
                Sources: M&C, Module Carburant → FOB & Trip
              </p>
            </div>
            {fobFuel && fuelData?.trip && (
              <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                <p>FOB: {fobFuel.ltr} L = {Math.round(fobFuel.ltr * (selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72))} kg</p>
                <p>Trip: {fuelData.trip.ltr} L = {Math.round(fuelData.trip.ltr * (selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72))} kg</p>
                <p>ZFW: {Math.round((calculations?.totalWeight || 0) - (fobFuel.ltr * (selectedAircraft?.fuelType === 'JET A-1' ? 0.84 : 0.72)))} kg</p>
                <p><strong>Masse atterrissage calculée: {getLandingMass()} kg</strong></p>
              </div>
            )}
          </div>

          {/* Formule altitude aérodrome */}
          <div>
            <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Altitude des aérodromes
            </h6>
            <div style={sx.combine(sx.text.xs, { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '4px' })}>
              <p>Altitude = Élévation officielle AIP (Service Information Aéronautique)</p>
              <p style={{ marginTop: '4px', color: '#6b7280' }}>
                Sources: Données SIA exclusivement depuis src/data
              </p>
            </div>
            {waypoints && waypoints.length > 0 && (
              <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                {waypoints[0]?.name && (
                  <p>Départ ({waypoints[0].name}): {getDepartureAltitude()} ft</p>
                )}
                {waypoints[waypoints.length - 1]?.name && waypoints.length > 1 && (
                  <p>Arrivée ({waypoints[waypoints.length - 1].name}): {getArrivalAltitude()} ft</p>
                )}
              </div>
            )}
          </div>

          {/* Formule température */}
          <div>
            <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Température
            </h6>
            <div style={sx.combine(sx.text.xs, { fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '4px' })}>
              <p>Température = METAR → Temperature (si disponible)</p>
              <p>Sinon: Température ISA standard = 15°C</p>
              <p style={{ marginTop: '4px', color: '#f59e0b' }}>
                ⚠️ IMPORTANT: Si ISA utilisée, la température réelle peut différer significativement
              </p>
              <p style={{ marginTop: '4px', color: '#6b7280' }}>
                Source: Module Météo → METAR de l'aérodrome
              </p>
            </div>
            {waypoints && waypoints.length > 0 && (
              <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                {waypoints[0]?.name && (
                  <p>
                    Départ ({waypoints[0].name}): {getTemperatureFromWeather(false)}°C 
                    {hasMetarTemperature(false) ? 
                      <span style={{ color: '#10b981', marginLeft: '8px' }}>(METAR)</span> : 
                      <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(ISA - pas de METAR)</span>
                    }
                  </p>
                )}
                {waypoints[waypoints.length - 1]?.name && waypoints.length > 1 && (
                  <p>
                    Arrivée ({waypoints[waypoints.length - 1].name}): {getTemperatureFromWeather(true)}°C
                    {hasMetarTemperature(true) ? 
                      <span style={{ color: '#10b981', marginLeft: '8px' }}>(METAR)</span> : 
                      <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(ISA - pas de METAR)</span>
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Note sur l'analyse IA */}
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(2))}>
            <Info size={14} />
            <div style={sx.text.xs}>
              <p style={sx.text.bold}>Analyse IA des tableaux de performances</p>
              <p style={sx.spacing.mt(1)}>
                L'IA utilise les conditions calculées ci-dessus pour analyser les tableaux de performances 
                et extraire automatiquement les distances (TOD, TODA, LD, LDA) correspondantes.
              </p>
              {apiStatus?.success && (
                <p style={sx.spacing.mt(1)}>
                  Modèle utilisé: GPT-4 Vision (OpenAI)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTableUploader;