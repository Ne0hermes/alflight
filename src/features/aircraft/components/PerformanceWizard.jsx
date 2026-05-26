import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Table, LineChart, ChevronRight, AlertCircle, Check, X } from 'lucide-react';
import unifiedPerformanceService from '../../performance/services/unifiedPerformanceService';
import pdfToImageConverterOptimized from '../../../services/pdfToImageConverterOptimized';
import AdvancedPerformanceAnalyzer from './AdvancedPerformanceAnalyzer';
import { AbacBuilder } from '../../../abac/curves/ui/AbacBuilder';
import { OPERATION_CATALOG } from '../../../abac/curves/core/operationCatalog';

// Styles de base
const styles = {
  container: {
    // Pas de padding ici - chaque step gère son propre padding
  },
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
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
    padding: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  cardHover: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '10px',
    border: '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  button: {
    padding: '10px',
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
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '10px',
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
    backgroundColor: 'rgba(242, 105, 33, 0.10)',
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

const PerformanceWizard = ({ aircraft, onPerformanceUpdate, initialData, startAtStep = 2, onCancel, abacBuilderRefCallback }) => {
  
  
  

  // États - DÉMARRAGE PAR DÉFAUT À L'ÉTAPE 2 (le MANEX est déjà géré ailleurs)
  const [currentStep, setCurrentStep] = useState(startAtStep);
  const [manualFile, setManualFile] = useState(null);
  const [extractedPages, setExtractedPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [autoExtractPages, setAutoExtractPages] = useState(null);
  const [performanceType, setPerformanceType] = useState(null);
  const [pageSystemTypes, setPageSystemTypes] = useState({}); // Type de système pour chaque page (table ou abaque)
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [detectionResult, setDetectionResult] = useState(null);
  const [thumbnailSize, setThumbnailSize] = useState(150); // Taille des miniatures
  const [pageClassifications, setPageClassifications] = useState({}); // Classifications des pages
  const [showAnalyzer, setShowAnalyzer] = useState(false); // Pour basculer entre sélection et analyse
  const fileInputRef = useRef(null);
  const abacBuilderRef = useRef(null);
  const abacBuilderRefCallbackRef = useRef(abacBuilderRefCallback);

  // Mettre à jour le callback ref quand il change
  useEffect(() => {
    abacBuilderRefCallbackRef.current = abacBuilderRefCallback;
  }, [abacBuilderRefCallback]);

  // Créer un callback mémorisé pour éviter les boucles infinies
  const handleAbacBuilderRef = React.useCallback((ref) => {
    if (ref && ref !== abacBuilderRef.current) {
      abacBuilderRef.current = ref;
      
      if (abacBuilderRefCallbackRef.current) {
        abacBuilderRefCallbackRef.current(ref);
      }
    }
  }, []); // Dépendance vide car on utilise abacBuilderRefCallbackRef

  // FUSIONNÉ: Restaurer les données initiales ET mettre à jour currentStep EN UN SEUL useEffect
  useEffect(() => {
    

    if (startAtStep === 2 && initialData) {
      
      

      // Si on édite un abaque existant
      if (initialData.abacCurves && initialData.editingModelIndex !== undefined) {
        
        setPerformanceType('abacs');
        setManualFile({ name: 'Manuel existant', restored: true });
        setCurrentStep(4); // ✅ Changement d'état UNIQUE vers l'étape 4
        return;
      }

      // Si on a des tables/performances avancées
      if (initialData.advancedPerformance || initialData.performanceTables) {
        

        // Créer des pages factices pour l'étape 2
        const mockPages = [];
        if (initialData.performanceTables) {
          initialData.performanceTables.forEach((table, index) => {
            mockPages.push({
              pageNumber: index + 1,
              image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
              category: table.table_type || 'performance'
            });
          });
        }

        if (mockPages.length > 0) {
          setExtractedPages(mockPages);
          setSelectedPages(mockPages.map((_, index) => index));
          
        }

        setManualFile({ name: 'Manuel existant', restored: true });
        setPerformanceType('tables');
        setCurrentStep(4); // ✅ Changement d'état UNIQUE vers l'étape 4
        return;
      }

      // Cas par défaut
      
      setCurrentStep(startAtStep);
    } else {
      
      setCurrentStep(startAtStep);
    }
  }, [startAtStep, initialData]);

  // ─── Types de performance disponibles ───
  // Source de vérité : OPERATION_CATALOG (src/abac/curves/core/operationCatalog.ts).
  // Les 9 opérations canoniques utilisées aussi par les abaques côté pilote
  // (matrice de couverture). Le pilote sélectionne UNE opération principale par
  // page MANEX ; l'IA peut détecter d'autres grandeurs et les retourner en
  // tableaux séparés (cf. prompt OpenAI plus bas).
  const performanceTypes = [
    { value: '', label: 'Non classifié' },
    ...OPERATION_CATALOG.map(op => ({
      value: op.id,
      label: op.labelFr,
      phase: op.phase,
      acceptedOutputs: op.acceptedOutputs
    }))
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
      console.log(`File size: ${sizeInMB.toFixed(2)} MB`);

      // Toujours extraire toutes les pages pour permettre la navigation complète
      
      const allPages = await extractAllPages(file);
      setExtractedPages(allPages);
      

      if (sizeInMB > 5) {
        // Pour les gros PDFs, essayer la détection automatique
        

        try {
          const analysis = await pdfToImageConverterOptimized.analyzeManualPDF(file);

          if (analysis.performancePages && analysis.performancePages.length > 0) {
            

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
            
            setDetectionResult({
              success: false,
              message: 'Sélectionnez manuellement les pages de performance dans le PDF'
            });
          }
        } catch (err) {
          
          setDetectionResult({
            success: false,
            message: 'Sélectionnez manuellement les pages de performance'
          });
        }

        setCurrentStep(2);
      } else {
        // Petits PDFs : essayer de détecter automatiquement les pages
        

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

    // 🔧 FIX: Support plusieurs formats de données (File, Blob, ArrayBuffer, Uint8Array)
    let arrayBuffer;
    if (file instanceof Uint8Array) {
      // Déjà un Uint8Array, utiliser directement
      arrayBuffer = file;
    } else if (file instanceof ArrayBuffer) {
      // Déjà un ArrayBuffer, utiliser directement
      arrayBuffer = file;
    } else if (file.arrayBuffer && typeof file.arrayBuffer === 'function') {
      // File ou Blob standard avec méthode arrayBuffer()
      arrayBuffer = await file.arrayBuffer();
    } else if (file instanceof Blob) {
      // Blob sans méthode arrayBuffer (navigateurs anciens)
      arrayBuffer = await new Response(file).arrayBuffer();
    } else {
      throw new Error('Format de fichier non supporté');
    }

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

  // useEffect pour extraire automatiquement les pages du MANEX quand on arrive à l'étape 3
  useEffect(() => {
    const extractPagesFromManex = async () => {
      // Ne rien faire si on n'est pas à l'étape 3 ou si les pages sont déjà extraites
      if (currentStep !== 3 || extractedPages.length > 0) {
        return;
      }

      // Vérifier qu'un MANEX est présent
      if (!aircraft?.manex) {
        
        return;
      }

      
      setIsProcessing(true);
      setError(null);

      try {
        // Récupérer le PDF depuis différentes sources possibles
        let pdfData = null;
        let pdfFile = null;

        if (aircraft.manex.pdfData) {
          // 🔧 FIX: Convertir base64 en Uint8Array directement (plus efficace)
          const base64Data = aircraft.manex.pdfData.includes(',')
            ? aircraft.manex.pdfData.split(',')[1]
            : aircraft.manex.pdfData;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);

          // Passer directement le byteArray (évite conversion File inutile)
          pdfFile = byteArray;

          // Créer un File pour setManualFile (UI uniquement)
          const fileForUI = new File([byteArray], aircraft.manex.fileName || 'manex.pdf', { type: 'application/pdf' });
          setManualFile(fileForUI);
        } else if (aircraft.manex.file) {
          pdfFile = aircraft.manex.file;
          setManualFile(pdfFile);
        } else if (aircraft.manex.data) {
          // data peut être déjà un File ou Blob
          pdfFile = aircraft.manex.data;
          setManualFile(pdfFile);
        }

        if (!pdfFile) {

          setError('Impossible de récupérer le fichier PDF du MANEX');
          setIsProcessing(false);
          return;
        }


        // Note: setManualFile déjà appelé ci-dessus selon le cas

        // Extraire toutes les pages
        const allPages = await extractAllPages(pdfFile);
        setExtractedPages(allPages);
        

        // Ne pas présélectionner automatiquement - sélection manuelle uniquement
        
      } catch (error) {
        console.error('❌ Erreur lors de l\'extraction des pages:', error);
        setError(`Erreur lors de l'extraction: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    extractPagesFromManex();
  }, [currentStep, extractedPages.length, aircraft]);

  // Navigation vers l'outil approprié
  const handleToolSelection = async (type) => {
    setPerformanceType(type);

    if (type === 'tables') {
      // Pour les tableaux, aller à l'étape 3 (sélection des pages)
      setCurrentStep(3);
    } else if (type === 'abacs') {
      // Pour les abaques, aller directement à l'étape 4 (construction manuelle)
      setCurrentStep(4);
    }
  };

  // Rendu des étapes
  const renderStep = () => {
    
    switch (currentStep) {
      // ⚠️ STEP 1 RETIRÉ - Le MANEX est déjà géré dans l'étape "Informations générales" de l'avion
      // Le wizard démarre maintenant directement à l'étape 2 (choix du type de données)

      case 2:
        // Vérifier si un MANEX est présent (vérifier toutes les propriétés possibles)
        
        
        

        const hasManex = aircraft?.manex && (
          aircraft.manex.file ||
          aircraft.manex.url ||
          aircraft.manex.data ||
          aircraft.manex.pdfData ||
          aircraft.manex.hasData ||
          aircraft.manex.remoteUrl ||
          aircraft.manex.uploadedToSupabase ||
          aircraft.manex.fileName // Ajout: si un fileName existe, c'est qu'un MANEX est présent
        );

        // Vérifier si MANEX disponible dans Supabase mais téléchargement échoué
        const hasManexInSupabase = aircraft?.manexAvailableInSupabase;

        
        

        return (
          <div style={styles.card}>
            <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '16px' }}>
              Étape 2 : Sélection des sections de performance
            </h3>

              {/* Alerte si MANEX disponible dans Supabase mais téléchargement échoué */}
              {!hasManex && hasManexInSupabase && (
                <div style={{ ...styles.alert, ...styles.alertWarning }}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>Téléchargement du MANEX en cours...</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                      Le MANEX est disponible dans Supabase ({hasManexInSupabase.fileName}). Rechargez la page (F5) pour réessayer le téléchargement.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerte si MANEX manquant */}
              {!hasManex && !hasManexInSupabase && (
                <div style={{ ...styles.alert, ...styles.alertError }}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>MANEX requis</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                      Vous devez d'abord ajouter un manuel de vol (MANEX) dans l'étape "Informations générales"
                      avant de pouvoir extraire des données de performance.
                    </p>
                  </div>
                </div>
              )}

              {detectionResult?.success && (
                <div style={{ ...styles.alert, ...styles.alertSuccess }}>
                  <Check size={16} />
                  {detectionResult.pageCount} page{detectionResult.pageCount > 1 ? 's' : ''} de performance détectée{detectionResult.pageCount > 1 ? 's' : ''} automatiquement
                </div>
              )}

              <p style={{ ...styles.text.sm, ...styles.text.muted, marginBottom: '24px' }}>
                Choisissez le type de données que vous souhaitez extraire du MANEX :
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {/* Carte Tableaux - CLIQUABLE - Navigation directe */}
                <div
                  onClick={() => {
                    if (hasManex) {
                      setPerformanceType('tables');
                      setCurrentStep(3); // Aller directement à la sélection des pages
                    }
                  }}
                  style={{
                    padding: '10px',
                    backgroundColor: '#eff6ff',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    cursor: hasManex ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: hasManex ? 1 : 0.4,
                    transform: 'scale(1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => {
                    if (hasManex) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 64, 175, 0.3)';
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Table size={28} style={{ color: '#1e40af' }} />
                    <h4 style={{ ...styles.text.md, ...styles.text.bold, color: '#1e40af', margin: 0 }}>
                      Tableaux
                    </h4>
                  </div>
                  <p style={{ ...styles.text.sm, color: '#6b7280', margin: 0 }}>
                    Extraction automatique avec OpenAI
                  </p>
                </div>

                {/* Carte Graphiques/Abaques - CLIQUABLE - Navigation directe */}
                <div
                  onClick={() => {
                    if (hasManex) {
                      setPerformanceType('abacs');
                      setCurrentStep(4); // Aller directement à l'AbacBuilder
                    }
                  }}
                  style={{
                    padding: '10px',
                    backgroundColor: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: '8px',
                    cursor: hasManex ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: hasManex ? 1 : 0.4,
                    transform: 'scale(1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => {
                    if (hasManex) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <LineChart size={28} style={{ color: '#16a34a' }} />
                    <h4 style={{ ...styles.text.md, ...styles.text.bold, color: '#16a34a', margin: 0 }}>
                      Graphiques/Abaques
                    </h4>
                  </div>
                  <p style={{ ...styles.text.sm, color: '#6b7280', margin: 0 }}>
                    Construction manuelle interactive
                  </p>
                </div>
              </div>

              {/* Bouton Précédent pour revenir à la page d'accueil des performances */}
              {onCancel && (
                <div style={{ marginTop: '24px' }}>
                  <button
                    onClick={() => {
                      
                      onCancel();
                    }}
                    style={{
                      ...styles.button,
                      ...styles.buttonSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    ← Précédent
                  </button>
                </div>
              )}
          </div>
        );

      case 3:
        // Si l'analyseur est affiché, afficher directement l'AdvancedPerformanceAnalyzer
        if (showAnalyzer) {
          return (
            <div>
              <div style={{ ...styles.flexRow, marginBottom: '16px' }}>
                <button
                  onClick={() => setShowAnalyzer(false)}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  ← Retour à la sélection
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
                autoExtract={true}
                hideUploadedImages={true}
              />
            </div>
          );
        }

        // Sinon, afficher la sélection des pages
        return (
          <div style={styles.card}>
            <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '8px' }}>
              Étape 3 : Sélection des pages de performance
            </h3>

              {/* Informations sur l'extraction */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '10px',
                flexWrap: 'wrap'
              }}>
                {/* Statut API OpenAI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} style={{ color: '#10b981' }} />
                  <span style={{ ...styles.text.sm, color: '#10b981', fontWeight: '500' }}>
                    API connectée
                  </span>
                </div>

                {/* Nombre de pages */}
                {extractedPages.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: '#3b82f6' }} />
                    <span style={{ ...styles.text.sm, color: '#3b82f6', fontWeight: '500' }}>
                      {extractedPages.length} page(s) chargée(s)
                    </span>
                  </div>
                )}

                {/* Message d'action */}
                {selectedPages.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ ...styles.text.sm, color: '#6b7280' }}>
                      Cliquez sur le bouton "Continuer" pour lancer l'extraction automatique
                    </span>
                  </div>
                )}
              </div>

              {isProcessing && (
                <div style={{ ...styles.alert, ...styles.alertSuccess }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #166534',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }} />
                  <div>
                    <strong>Extraction en cours...</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                      {loadingMessage || 'Extraction des pages du MANEX...'}
                    </p>
                  </div>
                  <style>{`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              )}

              {detectionResult && !detectionResult.success && !isProcessing && (
                <div style={{ ...styles.alert, ...styles.alertWarning }}>
                  <AlertCircle size={16} />
                  {detectionResult.message}
                </div>
              )}

              <p style={{ ...styles.text.sm, ...styles.text.muted, marginBottom: '16px' }}>
                1️⃣ <strong>Cliquez sur les pages</strong> pour les sélectionner (bordure bleue)<br/>
                2️⃣ <strong>Menu</strong> : Classifiez la section de performance (Distance de décollage, etc.)
              </p>

              {/* Afficher un résumé des classifications */}
              {selectedPages.length > 0 && (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  border: '1px solid #3b82f6'
                }}>
                  <h4 style={{ ...styles.text.sm, fontWeight: 'bold', marginBottom: '8px' }}>
                    📋 Pages sélectionnées et leurs configurations :
                  </h4>
                  <ul style={{ ...styles.text.sm, paddingLeft: '20px', margin: 0 }}>
                    {selectedPages.map(idx => {
                      const page = extractedPages[idx];
                      const classification = pageClassifications[idx];
                      const type = performanceTypes.find(t => t.value === classification);

                      return (
                        <li key={idx}>
                          Page {page.pageNumber} : <strong>{type?.label || 'Non classifié'}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Contrôle de la taille des miniatures */}
              <div style={{
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <label style={{ ...styles.text.sm, fontWeight: '500' }}>
                  Taille des miniatures: {thumbnailSize}px
                </label>
                <input
                  type="range"
                  min="100"
                  max="400"
                  step="50"
                  value={thumbnailSize}
                  onChange={(e) => setThumbnailSize(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <button
                  onClick={() => setThumbnailSize(150)}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                    alignSelf: 'flex-start'
                  }}
                >
                  Réinitialiser
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
                gap: '10px',
                maxHeight: '600px',
                overflowY: 'auto',
                padding: '10px',
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
                    {/* Menu de classification de performance */}
                    {selectedPages.includes(index) && (
                      <>
                        {/* Classification de performance */}
                        <select
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '4px',
                            right: '4px',
                            padding: '8px 6px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '2px solid #1e40af',
                            backgroundColor: '#eff6ff',
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
                            // Définir automatiquement le type de système à 'table'
                            setPageSystemTypes(prev => ({
                              ...prev,
                              [index]: 'table'
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
                            top: '8px',
                            left: '8px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            ⚠️ À CONFIGURER
                          </div>
                        )}

                        {pageClassifications[index] && (
                          <Check
                            size={20}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              backgroundColor: '#16a34a',
                              color: 'white',
                              borderRadius: '50%',
                              padding: '2px'
                            }}
                          />
                        )}
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
                  onClick={() => setCurrentStep(2)}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  Retour
                </button>

                <button
                  onClick={() => setShowAnalyzer(true)}
                  disabled={selectedPages.length === 0}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    opacity: selectedPages.length === 0 ? 0.5 : 1
                  }}
                >
                  Analyser ({selectedPages.length} page{selectedPages.length > 1 ? 's' : ''})
                </button>
              </div>
          </div>
        );

      case 4:
        // Étape 4 : uniquement pour les abaques
        if (performanceType === 'abacs') {
          return (
            <AbacBuilder
              ref={handleAbacBuilderRef}
              aircraft={aircraft}
              onSave={(abacData) => {
                if (onPerformanceUpdate) {
                  // Récupérer le systemType depuis la première page sélectionnée (ou 'abaque' par défaut)
                  const firstSelectedPageIndex = selectedPages[0];
                  const systemType = pageSystemTypes[firstSelectedPageIndex] || 'abaque';

                  // Récupérer la classification depuis les métadonnées de l'abaque
                  // Si aucune page n'est sélectionnée, utiliser le systemType de l'abaque lui-même
                  let classificationLabel = 'Non classifié';
                  let classificationValue = '';

                  if (abacData.metadata?.systemName) {
                    // Utiliser le nom du système de l'abaque comme classification
                    classificationLabel = abacData.metadata.systemName;
                    classificationValue = abacData.metadata.systemType || '';
                  } else if (selectedPages.length > 0) {
                    // Sinon, essayer de récupérer depuis pageClassifications
                    classificationValue = pageClassifications[firstSelectedPageIndex];
                    const classificationType = performanceTypes.find(t => t.value === classificationValue);
                    classificationLabel = classificationType?.label || 'Non classifié';
                  }
                  onPerformanceUpdate({
                    abacCurves: abacData,
                    flightManual: manualFile,
                    systemType: systemType, // Passer le type de système (table ou abaque)
                    classification: classificationLabel, // Passer la classification complète
                    classificationValue: classificationValue, // Passer la valeur de la classification
                    editingModelIndex: initialData?.editingModelIndex
                  });
                }
              }}
              onBack={() => {

                if (onCancel) {
                  onCancel(); // Retourner à la page listant les données de performance
                } else {
                  // Fallback si onCancel n'est pas fourni
                  setCurrentStep(2);
                  setPerformanceType(null);
                }
              }}
              initialData={initialData?.abacCurves || null}
              modelName={initialData?.abacCurves?.metadata?.modelName || null}
              aircraftModel={aircraft?.model || null}
            />
          );
        }
        break;

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {renderStep()}
    </div>
  );
};

export default PerformanceWizard;