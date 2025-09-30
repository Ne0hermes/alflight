import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Table, LineChart, ChevronRight, AlertCircle, Check, X } from 'lucide-react';
import unifiedPerformanceService from '../../performance/services/unifiedPerformanceService';
import pdfToImageConverterOptimized from '../../../services/pdfToImageConverterOptimized';
import AdvancedPerformanceAnalyzer from './AdvancedPerformanceAnalyzer';
import { AbacBuilder } from '../../../abac/curves/ui/AbacBuilder';

// Styles de base
const styles = {
  container: {
    padding: '16px'
  },
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  flexRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  cardHover: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    border: '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  buttonPrimary: {
    backgroundColor: '#1e40af',
    color: 'white'
  },
  buttonSecondary: {
    backgroundColor: '#e5e7eb',
    color: '#374151'
  },
  alert: {
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px'
  },
  alertSuccess: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #86efac'
  },
  alertWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d'
  },
  alertError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5'
  },
  text: {
    sm: { fontSize: '14px' },
    md: { fontSize: '16px' },
    lg: { fontSize: '18px' },
    bold: { fontWeight: 'bold' },
    muted: { color: '#6b7280' }
  }
};

const PerformanceWizard = ({ aircraft, onPerformanceUpdate, initialData, startAtStep = 1 }) => {
  console.log('🟦 PerformanceWizard - startAtStep reçu:', startAtStep);
  console.log('🟦 PerformanceWizard - initialData reçu:', initialData);

  // États
  const [currentStep, setCurrentStep] = useState(startAtStep);
  const [manualFile, setManualFile] = useState(null);
  const [extractedPages, setExtractedPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [autoExtractPages, setAutoExtractPages] = useState(null);
  const [performanceType, setPerformanceType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [detectionResult, setDetectionResult] = useState(null);
  const [thumbnailSize, setThumbnailSize] = useState(150); // Taille des miniatures
  const [pageClassifications, setPageClassifications] = useState({}); // Classifications des pages
  const fileInputRef = useRef(null);

  // Restaurer les données initiales si on démarre à l'étape 2
  useEffect(() => {
    console.log('🟪 useEffect PerformanceWizard - startAtStep:', startAtStep, 'initialData:', !!initialData);
    if (startAtStep === 2 && initialData) {
      console.log('🔄 Restauration des données pour démarrage direct');
      console.log('🔄 Données à restaurer:', initialData);

      // Simuler les pages extraites si on a des données
      if (initialData.performanceTables || initialData.advancedPerformance) {
        // Créer des pages factices pour l'étape 2
        const mockPages = [];
        if (initialData.performanceTables) {
          initialData.performanceTables.forEach((table, index) => {
            mockPages.push({
              pageNumber: index + 1,
              image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Image placeholder 1x1
              category: table.table_type || 'performance'
            });
          });
        }

        if (mockPages.length > 0) {
          setExtractedPages(mockPages);
          setSelectedPages(mockPages.map((_, index) => index));
          console.log(`📄 ${mockPages.length} pages restaurées`);
        }
      }

      // Marquer qu'on a un manuel (nécessaire pour l'étape 2)
      setManualFile({ name: 'Manuel existant', restored: true });

      // IMPORTANT: Si on a des données de performance, définir le type et passer à l'étape 4
      if (initialData.advancedPerformance || initialData.performanceTables) {
        console.log('🚀 Configuration pour accès direct aux tableaux (étape 4)');
        setPerformanceType('tables'); // Définir le type comme 'tables'
        // Ne pas changer currentStep ici, il sera mis à jour par l'autre useEffect
      }
    }
  }, [startAtStep, initialData]);

  // Mettre à jour currentStep quand startAtStep change
  useEffect(() => {
    console.log('🔄 useEffect startAtStep change:', startAtStep);
    if (startAtStep === 2 && initialData && (initialData.advancedPerformance || initialData.performanceTables)) {
      // Si on démarre à l'étape 2 avec des données, aller directement à l'étape 4
      console.log('🎯 Redirection vers étape 4 (AdvancedPerformanceAnalyzer)');
      setCurrentStep(4);
    } else {
      setCurrentStep(startAtStep);
    }
  }, [startAtStep, initialData]);

  // Types de performance disponibles
  const performanceTypes = [
    { value: '', label: 'Non classifié' },
    { value: 'takeoff-normal', label: 'Take-off Distance - Normal Procedure' },
    { value: 'takeoff-climb', label: 'Take-off Climb - Flaps T/O' },
    { value: 'cruise-climb', label: 'Cruise Climb - Flaps Up' },
    { value: 'landing-normal', label: 'Landing Distance - Flaps LDG' },
    { value: 'landing-abnormal', label: 'Landing Distance - Abnormal Position' }
  ];

  // Gestion de l'upload du manuel
  const handleManualUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Veuillez sélectionner un fichier PDF');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setManualFile(file);

    try {
      // Déterminer si on utilise le mode optimisé
      const sizeInMB = file.size / (1024 * 1024);
      console.log(`📚 Upload du manuel: ${file.name} (${sizeInMB.toFixed(2)} MB)`);

      // Toujours extraire toutes les pages pour permettre la navigation complète
      console.log('📄 Extraction de toutes les pages du PDF...');
      const allPages = await extractAllPages(file);
      setExtractedPages(allPages);
      console.log(`✅ ${allPages.length} pages extraites`);

      if (sizeInMB > 5) {
        // Pour les gros PDFs, essayer la détection automatique
        console.log('🔍 Tentative de détection automatique des pages de performance...');

        try {
          const analysis = await pdfToImageConverterOptimized.analyzeManualPDF(file);

          if (analysis.performancePages && analysis.performancePages.length > 0) {
            console.log(`✅ ${analysis.performancePages.length} pages de performance détectées automatiquement`);

            // Trouver les indices correspondants dans allPages
            const detectedIndices = [];
            analysis.performancePages.forEach(perfPage => {
              const index = allPages.findIndex(p => p.pageNumber === perfPage.pageNumber);
              if (index !== -1) detectedIndices.push(index);
            });

            setSelectedPages(detectedIndices);
            setDetectionResult({
              success: true,
              pageCount: detectedIndices.length,
              summary: analysis.summary,
              message: `${detectedIndices.length} pages présélectionnées (vous pouvez en ajouter ou retirer)`
            });
          } else {
            console.log('⚠️ Aucune page de performance détectée automatiquement');
            setDetectionResult({
              success: false,
              message: 'Sélectionnez manuellement les pages de performance dans le PDF'
            });
          }
        } catch (err) {
          console.warn('Erreur lors de la détection automatique:', err);
          setDetectionResult({
            success: false,
            message: 'Sélectionnez manuellement les pages de performance'
          });
        }

        setCurrentStep(2);
      } else {
        // Petits PDFs : essayer de détecter automatiquement les pages
        console.log('📄 PDF de petite taille - recherche automatique des pages de performance');

        const performancePages = detectPerformancePages(allPages);
        if (performancePages.length > 0) {
          setSelectedPages(performancePages.map(p => p.index));
          setDetectionResult({
            success: true,
            pageCount: performancePages.length,
            autoDetected: true,
            message: `${performancePages.length} pages présélectionnées (vous pouvez en ajouter ou retirer)`
          });
        } else {
          setDetectionResult({
            success: false,
            message: 'Veuillez sélectionner manuellement les pages contenant les données de performance'
          });
        }
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement du PDF:', error);
      setError(`Erreur lors du traitement: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Extraction de toutes les pages d'un PDF
  const extractAllPages = async (file) => {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js non chargé');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    // Charger toutes les pages du PDF
    setLoadingMessage(`Chargement du PDF (${pdf.numPages} pages)...`);

    for (let i = 1; i <= pdf.numPages; i++) {
      // Mise à jour du message de progression
      if (i % 10 === 0) {
        setLoadingMessage(`Extraction page ${i}/${pdf.numPages}...`);
      }

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      pages.push({
        pageNumber: i,
        image: canvas.toDataURL('image/png'),
        text: await extractPageText(page)
      });
    }

    return pages;
  };

  // Extraction du texte d'une page
  const extractPageText = async (page) => {
    try {
      const textContent = await page.getTextContent();
      return textContent.items.map(item => item.str).join(' ');
    } catch (e) {
      return '';
    }
  };

  // Détection automatique des pages de performance
  const detectPerformancePages = (pages) => {
    const keywords = [
      'takeoff', 'décollage', 'landing', 'atterrissage',
      'performance', 'distance', 'tod', 'lda', 'climb',
      'cruise', 'altitude', 'temperature', 'weight', 'masse'
    ];

    return pages.map((page, index) => {
      const text = page.text.toLowerCase();
      const score = keywords.reduce((acc, keyword) =>
        acc + (text.includes(keyword) ? 1 : 0), 0
      );

      return { ...page, index, score };
    }).filter(p => p.score > 2);
  };

  // Navigation vers l'outil approprié
  const handleToolSelection = async (type) => {
    setPerformanceType(type);

    // Si on sélectionne les tableaux, lancer automatiquement l'extraction
    if (type === 'tables' && selectedPages.length > 0) {
      // Préparer les pages pour l'extraction immédiate
      const pagesToExtract = extractedPages
        .filter((_, idx) => selectedPages.includes(idx))
        .map((page, i) => {
          const originalIndex = selectedPages[i];
          return {
            id: `page_${page.pageNumber}`,
            name: `Page ${page.pageNumber}`,
            base64: page.image.replace(/^data:image\/\w+;base64,/, ''),
            preview: page.image,
            classification: pageClassifications[originalIndex] || 'non-classified'
          };
        });

      // Stocker les pages préparées pour l'étape 4
      setAutoExtractPages(pagesToExtract);
    }

    setCurrentStep(4);
  };

  // Rendu des étapes
  const renderStep = () => {
    console.log('🟧 renderStep - currentStep actuel:', currentStep);
    switch (currentStep) {
      case 1:
        return (
          <div style={styles.flexCol}>
            <div style={{ ...styles.card, textAlign: 'center' }}>
              <Upload size={48} style={{ margin: '0 auto 16px', color: '#1e40af' }} />

              <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '8px' }}>
                Étape 1 : Upload du manuel de vol
              </h3>

              <p style={{ ...styles.text.sm, ...styles.text.muted, marginBottom: '16px' }}>
                Chargez le manuel de vol complet de votre {aircraft?.model || 'avion'} au format PDF.
                Ce document sera archivé avec la configuration pour référence future.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleManualUpload}
                style={{ display: 'none' }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  width: '100%',
                  maxWidth: '400px',
                  opacity: isProcessing ? 0.5 : 1
                }}
              >
                {isProcessing ? (loadingMessage || 'Traitement en cours...') : 'Sélectionner le manuel PDF'}
              </button>

              {manualFile && (
                <div style={{
                  ...styles.card,
                  marginTop: '16px',
                  backgroundColor: '#f0f9ff'
                }}>
                  <FileText size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  <span style={styles.text.sm}>{manualFile.name}</span>
                  <span style={{ ...styles.text.sm, ...styles.text.muted, marginLeft: '8px' }}>
                    ({(manualFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
              )}

              {error && (
                <div style={{ ...styles.alert, ...styles.alertError, marginTop: '16px' }}>
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            <div style={{
              ...styles.card,
              backgroundColor: '#f0f9ff',
              borderColor: '#1e40af',
              marginBottom: '16px'
            }}>
              <h4 style={{ ...styles.text.sm, ...styles.text.bold, marginBottom: '8px', color: '#1e40af' }}>
                📕 Manuel de vol
              </h4>
              <ul style={{ ...styles.text.sm, paddingLeft: '20px', margin: 0 }}>
                <li><strong>Le manuel sera conservé dans votre configuration</strong></li>
                <li>Les données extraites seront vérifiées par rapport au manuel</li>
                <li>Vous pourrez le consulter à tout moment depuis votre profil avion</li>
              </ul>
            </div>

            <div style={{
              ...styles.card,
              backgroundColor: '#fef3c7',
              borderColor: '#f59e0b'
            }}>
              <h4 style={{ ...styles.text.sm, ...styles.text.bold, marginBottom: '8px' }}>
                💡 Conseils pour de meilleurs résultats
              </h4>
              <ul style={{ ...styles.text.sm, paddingLeft: '20px', margin: 0 }}>
                <li>Utilisez le manuel complet officiel du constructeur</li>
                <li>Assurez-vous que le PDF n'est pas protégé par mot de passe</li>
                <li>Les PDFs de plus de 5 MB seront analysés intelligemment</li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div style={styles.flexCol}>
            <div style={styles.card}>
              <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '16px' }}>
                Étape 2 : Sélection des pages de performance
              </h3>

              {detectionResult && !detectionResult.success && (
                <div style={{ ...styles.alert, ...styles.alertWarning }}>
                  <AlertCircle size={16} />
                  {detectionResult.message}
                </div>
              )}

              <p style={{ ...styles.text.sm, ...styles.text.muted, marginBottom: '16px' }}>
                1️⃣ <strong>Cliquez sur les pages</strong> pour les sélectionner (bordure bleue)<br/>
                2️⃣ <strong>Utilisez le menu déroulant</strong> qui apparaît sur chaque page sélectionnée pour classifier le type de données<br/>
                3️⃣ <strong>Classifications disponibles</strong> : Take-off, Landing, Climb, etc.
              </p>

              {/* Afficher un résumé des classifications */}
              {selectedPages.length > 0 && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid #3b82f6'
                }}>
                  <h4 style={{ ...styles.text.sm, fontWeight: 'bold', marginBottom: '8px' }}>
                    📋 Pages sélectionnées et leurs classifications :
                  </h4>
                  <ul style={{ ...styles.text.sm, paddingLeft: '20px', margin: 0 }}>
                    {selectedPages.map(idx => {
                      const page = extractedPages[idx];
                      const classification = pageClassifications[idx];
                      const type = performanceTypes.find(t => t.value === classification);
                      return (
                        <li key={idx}>
                          Page {page.pageNumber} : <strong>{type?.label || 'Non classifié (sélectionnez dans le menu)'}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Contrôle de la taille des miniatures */}
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <label style={{ ...styles.text.sm, fontWeight: '500' }}>
                  Taille des miniatures:
                </label>
                <input
                  type="range"
                  min="100"
                  max="400"
                  step="50"
                  value={thumbnailSize}
                  onChange={(e) => setThumbnailSize(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{
                  ...styles.text.sm,
                  minWidth: '50px',
                  padding: '4px 8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  {thumbnailSize}px
                </span>
                <button
                  onClick={() => setThumbnailSize(150)}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                    padding: '4px 12px',
                    fontSize: '12px'
                  }}
                >
                  Réinitialiser
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
                gap: '16px',
                maxHeight: '600px',
                overflowY: 'auto',
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                {extractedPages.map((page, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (selectedPages.includes(index)) {
                        setSelectedPages(prev => prev.filter(i => i !== index));
                      } else {
                        setSelectedPages(prev => [...prev, index]);
                      }
                    }}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: selectedPages.includes(index) ? '3px solid #1e40af' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '4px',
                      backgroundColor: selectedPages.includes(index) ? '#eff6ff' : 'white'
                    }}
                  >
                    <img
                      src={page.image}
                      alt={`Page ${page.pageNumber}`}
                      style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: selectedPages.includes(index) ? '#1e40af' : 'rgba(0,0,0,0.5)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '12px'
                    }}>
                      Page {page.pageNumber}
                    </div>
                    {/* Menu déroulant pour classifier la page */}
                    {selectedPages.includes(index) && (
                      <>
                        <select
                          style={{
                            position: 'absolute',
                            bottom: '35px',
                            left: '4px',
                            right: '4px',
                            padding: '6px 4px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '2px solid #1e40af',
                            backgroundColor: '#fef3c7',
                            color: '#1e40af',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            zIndex: 10,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                          value={pageClassifications[index] || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            setPageClassifications(prev => ({
                              ...prev,
                              [index]: e.target.value
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {performanceTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>

                        {/* Indicateur visuel pour attirer l'attention */}
                        {!pageClassifications[index] && (
                          <div style={{
                            position: 'absolute',
                            top: '35px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            ⚠️ À CLASSIFIER
                          </div>
                        )}

                        <Check
                          size={20}
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            backgroundColor: '#1e40af',
                            color: 'white',
                            borderRadius: '50%',
                            padding: '2px'
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>


              <div style={{
                ...styles.flexRow,
                justifyContent: 'space-between',
                marginTop: '16px'
              }}>
                <button
                  onClick={() => setCurrentStep(1)}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  Retour
                </button>

                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={selectedPages.length === 0}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: selectedPages.length === 0 ? 0.5 : 1
                  }}
                >
                  Continuer ({selectedPages.length} page{selectedPages.length > 1 ? 's' : ''} sélectionnée{selectedPages.length > 1 ? 's' : ''})
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div style={styles.flexCol}>
            <div style={styles.card}>
              <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '16px' }}>
                Étape 3 : Type de données de performance
              </h3>

              {detectionResult?.success && (
                <div style={{ ...styles.alert, ...styles.alertSuccess }}>
                  <Check size={16} />
                  {detectionResult.pageCount} page{detectionResult.pageCount > 1 ? 's' : ''} de performance détectée{detectionResult.pageCount > 1 ? 's' : ''} automatiquement
                </div>
              )}

              <p style={{ ...styles.text.sm, ...styles.text.muted, marginBottom: '24px' }}>
                Quel type de données de performance contiennent les pages sélectionnées ?
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px'
              }}>
                <div
                  onClick={() => handleToolSelection('tables')}
                  style={styles.cardHover}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#1e40af'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <Table size={48} style={{ margin: '0 auto 16px', color: '#1e40af' }} />
                  <h4 style={{ ...styles.text.md, ...styles.text.bold, marginBottom: '8px' }}>
                    Tableaux
                  </h4>
                  <p style={{ ...styles.text.sm, ...styles.text.muted }}>
                    Données structurées en lignes et colonnes
                    (distances de décollage/atterrissage, performances de montée)
                  </p>
                </div>

                <div
                  onClick={() => handleToolSelection('abacs')}
                  style={styles.cardHover}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#1e40af'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <LineChart size={48} style={{ margin: '0 auto 16px', color: '#1e40af' }} />
                  <h4 style={{ ...styles.text.md, ...styles.text.bold, marginBottom: '8px' }}>
                    Abaques / Graphiques
                  </h4>
                  <p style={{ ...styles.text.sm, ...styles.text.muted }}>
                    Courbes et graphiques de performance
                    (graphiques avec axes et courbes)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                style={{ ...styles.button, ...styles.buttonSecondary, marginTop: '16px' }}
              >
                Retour à la sélection des pages
              </button>
            </div>
          </div>
        );

      case 4:
        // Rendu du composant approprié selon le type choisi
        if (performanceType === 'tables') {
          return (
            <div>
              <div style={{ ...styles.flexRow, marginBottom: '16px' }}>
                <button
                  onClick={() => setCurrentStep(3)}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  ← Retour
                </button>
                <h3 style={{ ...styles.text.lg, ...styles.text.bold }}>
                  Extraction des tableaux de performance
                </h3>
              </div>

              <AdvancedPerformanceAnalyzer
                aircraft={aircraft}
                initialData={initialData}
                onPerformanceUpdate={(data) => {
                  // Inclure le manuel de vol avec les données de performance
                  if (onPerformanceUpdate) {
                    onPerformanceUpdate({
                      ...data,
                      flightManual: manualFile
                    });
                  }
                }}
                preloadedImages={autoExtractPages || extractedPages
                  .filter((_, idx) => selectedPages.includes(idx))
                  .map((page, i) => {
                    const originalIndex = selectedPages[i];
                    return {
                      id: `page_${page.pageNumber}`,
                      name: `Page ${page.pageNumber}`,
                      base64: page.image.replace(/^data:image\/\w+;base64,/, ''),
                      preview: page.image,
                      classification: pageClassifications[originalIndex] || 'non-classified'
                    };
                  })}
                pageClassifications={pageClassifications}
                autoExtract={!!autoExtractPages}
                hideUploadedImages={true}
              />
            </div>
          );
        } else if (performanceType === 'abacs') {
          return (
            <div>
              <div style={{ ...styles.flexRow, marginBottom: '16px' }}>
                <button
                  onClick={() => setCurrentStep(3)}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  ← Retour
                </button>
                <h3 style={{ ...styles.text.lg, ...styles.text.bold }}>
                  Construction des courbes ABAC
                </h3>
              </div>

              <AbacBuilder
                aircraft={aircraft}
                onSave={(abacData) => {
                  if (onPerformanceUpdate) {
                    onPerformanceUpdate({
                      abacCurves: abacData,
                      flightManual: manualFile
                    });
                  }
                }}
                existingData={null}
              />
            </div>
          );
        }
        break;

      default:
        return null;
    }
  };

  // Indicateur de progression
  const renderProgressIndicator = () => {
    if (currentStep > 3) return null;

    const steps = [
      { num: 1, label: 'Upload manuel' },
      { num: 2, label: 'Sélection pages' },
      { num: 3, label: 'Type de données' }
    ];

    return (
      <div style={{
        ...styles.flexRow,
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '120px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: currentStep >= step.num ? '#1e40af' : '#e5e7eb',
                color: currentStep >= step.num ? 'white' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                marginBottom: '4px'
              }}>
                {step.num}
              </div>
              <span style={{
                ...styles.text.sm,
                color: currentStep >= step.num ? '#1e40af' : '#9ca3af',
                textAlign: 'center'
              }}>
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: currentStep > step.num ? '#1e40af' : '#e5e7eb',
                marginTop: '15px',
                maxWidth: '60px'
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {renderProgressIndicator()}
      {renderStep()}
    </div>
  );
};

export default PerformanceWizard;