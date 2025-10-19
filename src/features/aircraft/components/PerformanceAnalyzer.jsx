// src/features/aircraft/components/PerformanceAnalyzer.jsx
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { Upload, Loader, CheckCircle, AlertTriangle, Info, X, Image, Brain } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import unifiedPerformanceService from '../../../features/performance/services/unifiedPerformanceService';
import pdfToImageConverter from '../../../services/pdfToImageConverter';

const PerformanceAnalyzer = memo(({ aircraft, onPerformanceUpdate }) => {
  
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [takeoffImage, setTakeoffImage] = useState(null);
  const [landingImage, setLandingImage] = useState(null);
  const [takeoffPreview, setTakeoffPreview] = useState(null);
  const [landingPreview, setLandingPreview] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  
  // Utiliser useRef pour détecter les changements non désirés
  const prevAircraftId = React.useRef(aircraft?.id);
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  // Log de l'état actuel
  useEffect(() => {
    :`, {
      isEditMode,
      editedValues,
      analysisResults: analysisResults ? 'Présent' : 'Absent',
      aircraft: aircraft?.registration,
      aircraftId: aircraft?.id,
      prevAircraftId: prevAircraftId.current,
      aircraftChanged: prevAircraftId.current !== aircraft?.id
    });
    
    if (prevAircraftId.current !== aircraft?.id) {
      
      prevAircraftId.current = aircraft?.id;
    }
  }, [isEditMode, editedValues, analysisResults, aircraft]);
  
  // Conditions de vol pour l'analyse (valeurs standards) - mémorisées
  const takeoffConditions = useMemo(() => ({
    mass: aircraft?.maxTakeoffWeight || 1150,
    altitude: 0, // Niveau de la mer par défaut
    temperature: 15 // ISA standard
  }), [aircraft?.maxTakeoffWeight]);
  
  const landingConditions = useMemo(() => ({
    mass: (aircraft?.maxTakeoffWeight || 1150) * 0.9, // 90% du MTOW par défaut
    altitude: 0,
    temperature: 15
  }), [aircraft?.maxTakeoffWeight]);

  // Tester la clé API au chargement
  useEffect(() => {
    testAPIConnection();
  }, []);
  
  // Flag pour éviter les réinitialisations intempestives
  const isEditModeRef = React.useRef(false);
  
  // Synchroniser le ref avec l'état
  useEffect(() => {
    isEditModeRef.current = isEditMode;
    
  }, [isEditMode]);
  
  // Mémoriser l'ID de l'avion pour détecter les vrais changements
  const aircraftId = aircraft?.id;
  const aircraftPerformance = aircraft?.performance;
  
  // Charger les performances existantes de l'avion
  useEffect(() => {
    
    
    // Ne pas réinitialiser si on est en mode édition
    if (aircraftPerformance && !isEditModeRef.current) {
      
      setAnalysisResults(aircraftPerformance);
      // Initialiser les valeurs éditables seulement si elles sont vides
      if (Object.keys(editedValues).length === 0) {
        const newEditedValues = {
          tod: aircraftPerformance.takeoff?.tod || '',
          toda15m: aircraftPerformance.takeoff?.toda15m || '',
          toda50ft: aircraftPerformance.takeoff?.toda50ft || '',
          ld: aircraftPerformance.landing?.ld || '',
          lda15m: aircraftPerformance.landing?.lda15m || '',
          lda50ft: aircraftPerformance.landing?.lda50ft || ''
        };
        
        setEditedValues(newEditedValues);
      } else {
        
      }
    } else if (isEditModeRef.current) {
      
    } else {
      
    }
  }, [aircraftId, aircraftPerformance]); // Utiliser des valeurs primitives

  const testAPIConnection = async () => {
    setIsTestingAPI(true);
    try {
      const result = await unifiedPerformanceService.testAPIConnection();
      setApiStatus(result);
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

  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (pdfToImageConverter.isPDF(file)) {
        try {
          if (type === 'takeoff') {
            setTakeoffPreview('loading');
          } else {
            setLandingPreview('loading');
          }
          
          const tableData = await pdfToImageConverter.findPerformanceTablePage(file, type);
          const base64Image = tableData.base64;
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
        } catch (error) {
          setError(`Erreur lors de la conversion du PDF: ${error.message}`);
          if (type === 'takeoff') {
            setTakeoffPreview(null);
          } else {
            setLandingPreview(null);
          }
        }
      } else {
        // Image normale
        if (type === 'takeoff') {
          setTakeoffImage(file);
          const reader = new FileReader();
          reader.onload = (e) => setTakeoffPreview(e.target.result);
          reader.readAsDataURL(file);
        } else {
          setLandingImage(file);
          const reader = new FileReader();
          reader.onload = (e) => setLandingPreview(e.target.result);
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleAnalyze = async () => {
    if (!takeoffImage && !landingImage) {
      setError('Veuillez charger au moins un tableau de performances');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);

    try {
      let takeoffImageToAnalyze = null;
      let landingImageToAnalyze = null;
      
      if (takeoffImage) {
        if (takeoffImage.isPDF) {
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
      
      // Analyser les images de décollage et atterrissage
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
      
      // Initialiser les valeurs éditables avec les résultats
      setEditedValues({
        tod: results.takeoff?.tod || '',
        toda15m: results.takeoff?.toda15m || '',
        toda50ft: results.takeoff?.toda50ft || '',
        ld: results.landing?.ld || '',
        lda15m: results.landing?.lda15m || '',
        lda50ft: results.landing?.lda50ft || ''
      });
      
      // Transmettre les résultats au composant parent pour sauvegarde
      if (onPerformanceUpdate && (results.takeoff || results.landing)) {
        const performanceData = {
          takeoff: results.takeoff,
          landing: results.landing,
          analyzedAt: new Date().toISOString(),
          conditions: {
            takeoff: takeoffConditions,
            landing: landingConditions
          }
        };
        onPerformanceUpdate(performanceData);
      }
    } catch (err) {
      setError(`Erreur lors de l'analyse: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setTakeoffImage(null);
    setLandingImage(null);
    setTakeoffPreview(null);
    setLandingPreview(null);
    setAnalysisResults(null);
    setError(null);
    setIsEditMode(false);
    setEditedValues({});
  };

  const handleValueChange = useCallback((field, value) => {
    
    setEditedValues(prev => {
      const newValues = {
        ...prev,
        [field]: value
      };
      
      return newValues;
    });
  }, []);

  const handleSaveEditedValues = () => {
    
    if (!onPerformanceUpdate) {
      console.error('❌ onPerformanceUpdate n\'est pas défini');
      return;
    }
    
    try {
      const performanceData = {
        takeoff: {
          tod: parseInt(editedValues.tod) || 0,
          toda15m: parseInt(editedValues.toda15m) || 0,
          toda50ft: parseInt(editedValues.toda50ft) || 0
        },
        landing: {
          ld: parseInt(editedValues.ld) || 0,
          lda15m: parseInt(editedValues.lda15m) || 0,
          lda50ft: parseInt(editedValues.lda50ft) || 0
        },
        analyzedAt: analysisResults?.analyzedAt || new Date().toISOString(),
        conditions: analysisResults?.conditions || {
          takeoff: takeoffConditions,
          landing: landingConditions
        },
        manuallyEdited: true
      };
      
      
      setAnalysisResults(performanceData);
      onPerformanceUpdate(performanceData);
      setIsEditMode(false);
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
    }
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        <Brain size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
        Analyse IA des performances
      </h4>

      {/* Statut API */}
      {apiStatus && (
        <div style={sx.combine(
          sx.components.alert.base,
          apiStatus.success ? sx.components.alert.success : sx.components.alert.warning,
          sx.spacing.mb(4)
        )}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isTestingAPI ? (
              <Loader size={16} className="animate-spin" />
            ) : apiStatus.success ? (
              <CheckCircle size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span style={sx.text.sm}>
              {apiStatus.success ? 'API connectée' : 'API non configurée - Mode fallback'}
            </span>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <p style={sx.text.sm}>
          Chargez les tableaux de performances de votre manuel de vol. 
          L'IA extraira automatiquement les distances TOD, TODA, LD et LDA.
        </p>
      </div>

      {/* Conditions utilisées pour l'analyse */}
      <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(4))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Conditions standards pour l'analyse
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <p style={sx.text.xs}>Décollage</p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Masse: {takeoffConditions.mass} kg | Alt: {takeoffConditions.altitude} ft | Temp: {takeoffConditions.temperature}°C
            </p>
          </div>
          <div>
            <p style={sx.text.xs}>Atterrissage</p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Masse: {landingConditions.mass} kg | Alt: {landingConditions.altitude} ft | Temp: {landingConditions.temperature}°C
            </p>
          </div>
        </div>
      </div>

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
              minHeight: '150px',
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
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setTakeoffImage(null);
                  setTakeoffPreview(null);
                }}>
                  <X size={16} />
                </div>
                <CheckCircle size={32} color="#10b981" style={{ position: 'relative', zIndex: 1 }} />
              </>
            ) : (
              <>
                <Upload size={32} color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(2))}>
                  Cliquez pour charger
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
              minHeight: '150px',
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
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setLandingImage(null);
                  setLandingPreview(null);
                }}>
                  <X size={16} />
                </div>
                <CheckCircle size={32} color="#10b981" style={{ position: 'relative', zIndex: 1 }} />
              </>
            ) : (
              <>
                <Upload size={32} color="#6b7280" />
                <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(2))}>
                  Cliquez pour charger
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
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
            <h5 style={sx.combine(sx.text.md, sx.text.bold)}>
              📊 Distances extraites
            </h5>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                
                if (!isEditMode && analysisResults) {
                  // Initialiser les valeurs éditables en entrant en mode édition
                  const initValues = {
                    tod: analysisResults.takeoff?.tod || '',
                    toda15m: analysisResults.takeoff?.toda15m || '',
                    toda50ft: analysisResults.takeoff?.toda50ft || '',
                    ld: analysisResults.landing?.ld || '',
                    lda15m: analysisResults.landing?.lda15m || '',
                    lda50ft: analysisResults.landing?.lda50ft || ''
                  };
                  
                  setEditedValues(initValues);
                  setIsEditMode(true);
                } else if (isEditMode) {
                  
                  setIsEditMode(false);
                } else {
                  
                  setIsEditMode(!isEditMode);
                }
              }}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.secondary,
                { padding: '6px 12px', fontSize: '12px' }
              )}
            >
              {isEditMode ? '❌ Annuler' : '✏️ Modifier'}
            </button>
          </div>

          {isEditMode ? (
            // Mode édition
            <div>
              <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(3))}>
                <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  Décollage
                </h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>TOD (m)</label>
                    <input
                      type="number"
                      value={editedValues.tod}
                      onChange={(e) => {
                        e.persist && e.persist(); // Préserver l'événement
                        
                        handleValueChange('tod', e.target.value);
                      }}
                      onFocus={() => }
                      onBlur={() => }
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>15m (m)</label>
                    <input
                      type="number"
                      value={editedValues.toda15m}
                      onChange={(e) => handleValueChange('toda15m', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>50ft (m)</label>
                    <input
                      type="number"
                      value={editedValues.toda50ft}
                      onChange={(e) => handleValueChange('toda50ft', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(3))}>
                <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  Atterrissage
                </h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>LD (m)</label>
                    <input
                      type="number"
                      value={editedValues.ld}
                      onChange={(e) => handleValueChange('ld', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>15m (m)</label>
                    <input
                      type="number"
                      value={editedValues.lda15m}
                      onChange={(e) => handleValueChange('lda15m', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={sx.combine(sx.text.xs, sx.text.secondary)}>50ft (m)</label>
                    <input
                      type="number"
                      value={editedValues.lda50ft}
                      onChange={(e) => handleValueChange('lda50ft', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={sx.combine(sx.flex.end, sx.spacing.gap(2))}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    setIsEditMode(false);
                    // Restaurer les valeurs originales
                    if (analysisResults) {
                      const restoredValues = {
                        tod: analysisResults.takeoff?.tod || '',
                        toda15m: analysisResults.takeoff?.toda15m || '',
                        toda50ft: analysisResults.takeoff?.toda50ft || '',
                        ld: analysisResults.landing?.ld || '',
                        lda15m: analysisResults.landing?.lda15m || '',
                        lda50ft: analysisResults.landing?.lda50ft || ''
                      };
                      
                      setEditedValues(restoredValues);
                    }
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    handleSaveEditedValues();
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary)}
                >
                  💾 Sauvegarder les modifications
                </button>
              </div>
            </div>
          ) : (
            // Mode lecture
            <div>
              {analysisResults.takeoff && (
                <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mb(3))}>
                  <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                    Décollage
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <p style={sx.text.xs}>TOD</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.takeoff.tod} m
                      </p>
                    </div>
                    <div>
                      <p style={sx.text.xs}>15m</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.takeoff.toda15m} m
                      </p>
                    </div>
                    <div>
                      <p style={sx.text.xs}>50ft</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.takeoff.toda50ft} m
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analysisResults.landing && (
                <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
                  <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                    Atterrissage
                  </h6>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <p style={sx.text.xs}>LD</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.landing.ld} m
                      </p>
                    </div>
                    <div>
                      <p style={sx.text.xs}>15m</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.landing.lda15m} m
                      </p>
                    </div>
                    <div>
                      <p style={sx.text.xs}>50ft</p>
                      <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                        {analysisResults.landing.lda50ft} m
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {analysisResults.manuallyEdited && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
              ✏️ Valeurs modifiées manuellement
            </p>
          )}
          
          {aircraft?.performance && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              ✅ Ces performances sont sauvegardées dans l'avion
            </p>
          )}
        </div>
      )}
    </div>

});

// Fonction de comparaison pour React.memo
const areEqual = (prevProps, nextProps) => {
  // Comparer uniquement les propriétés importantes
  const prevId = prevProps.aircraft?.id;
  const nextId = nextProps.aircraft?.id;
  const prevPerformance = prevProps.aircraft?.performance;
  const nextPerformance = nextProps.aircraft?.performance;
  
  const isEqual = prevId === nextId && 
                  JSON.stringify(prevPerformance) === JSON.stringify(nextPerformance);
  
  if (!isEqual) {
     !== JSON.stringify(nextPerformance)
    });
  }
  
  return isEqual;
};

export default React.memo(PerformanceAnalyzer, areEqual);