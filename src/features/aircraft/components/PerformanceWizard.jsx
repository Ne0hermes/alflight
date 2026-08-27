import React, { useState, useRef, useEffect } from 'react';
import { FileText, Table, AlertCircle, Check } from 'lucide-react';
import pdfToImageConverterOptimized from '../../../services/pdfToImageConverterOptimized';
// 🔄 Lot 2.0 (correctif purge) : re-téléchargement à la demande du MANEX quand
// le blob local a été purgé mais que la référence serveur existe (ensureManexLocal).
import communityService from '../../../services/communityService';
import AdvancedPerformanceAnalyzer from './AdvancedPerformanceAnalyzer';
import { AbacBuilder } from '../../../abac/curves/ui/AbacBuilder';
import { OPERATION_CATALOG } from '../../../abac/curves/core/operationCatalog';
// R23 — classifieur d'opération PARTAGÉ avec les abaques (3 listes
// Phase/Métrique/Volets) : classification unifiée des deux méthodes de saisie.
import { OperationClassifier } from '../../../abac/curves/ui/OperationClassifier';

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
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid var(--border-subtle)'
  },
  cardHover: {
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px',
    border: '2px solid var(--border-subtle)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  button: {
    padding: '10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--fs-body)',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  buttonPrimary: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)'
  },
  buttonSecondary: {
    backgroundColor: 'var(--border-subtle)',
    color: 'var(--text-secondary)'
  },
  alert: {
    padding: '10px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px'
  },
  alertSuccess: {
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    border: '1px solid var(--accent-primary)'
  },
  alertWarning: {
    backgroundColor: 'rgba(242, 105, 33, 0.10)',
    color: 'var(--accent-primary)',
    border: '1px solid var(--accent-primary)'
  },
  alertError: {
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--color-red-critical)',
    border: '1px solid var(--color-red-critical)'
  },
  text: {
    sm: { fontSize: 'var(--fs-body)' },
    md: { fontSize: 'var(--fs-title)' },
    lg: { fontSize: 'var(--fs-title)' },
    bold: { fontWeight: 'bold' },
    muted: { color: 'var(--text-secondary)' }
  }
};

// startAtType (27/08) : type de données déjà choisi par l'appelant. La page des
// données de performance ouvre désormais le flux TABLEAUX en un clic, sans
// passer par l'écran de choix — il faut donc pouvoir amorcer performanceType.
const PerformanceWizard = ({ aircraft, onPerformanceUpdate, initialData, startAtStep = 2, startAtType = null, onCancel, abacBuilderRefCallback, sessionRef }) => {
  // ─── Session restaurée (partie pdf) ───────────────────────────────────────
  // Ce wizard est démonté au moindre changement d'étape de l'assistant avion :
  // les pages PDF du MANEX rendues en PNG (coûteuses), la sélection et les
  // classifications disparaissaient — tout était à refaire au retour. La
  // session est détenue par le wizard avion (abacSessionRef), donc elle survit
  // jusqu'à l'enregistrement final. `S` est lu au premier rendu : les
  // initialiseurs paresseux ne s'exécutent qu'au montage (motif CentrogramReader).
  //
  // La NAVIGATION (étape courante, type choisi) n'est reprise QUE si le wizard
  // se remonte dans le MÊME contexte d'ouverture (navContext) : rouvrir en mode
  // « Modifier tel abaque » ou « Nouvel abaque direct » doit primer sur l'étape
  // où l'on se trouvait — seules les DONNÉES (pages rendues…) survivent alors.
  const navContext = initialData?.directToBuilder
    ? 'direct'
    : initialData?.abacCurves
    ? `edit:${initialData.editingModelIndex ?? ''}`
    : 'null';
  const S = sessionRef?.current?.pdf || null;
  const navRestored = !!S && S.navContext === navContext;

  // États - DÉMARRAGE PAR DÉFAUT À L'ÉTAPE 2 (le MANEX est déjà géré ailleurs)
  const [currentStep, setCurrentStep] = useState(navRestored ? (S.currentStep ?? startAtStep) : startAtStep);
  const [manualFile, setManualFile] = useState(S?.manualFile ?? null);
  const [extractedPages, setExtractedPages] = useState(S?.extractedPages ?? []);
  const [selectedPages, setSelectedPages] = useState(S?.selectedPages ?? []);
  const [performanceType, setPerformanceType] = useState(navRestored ? (S.performanceType ?? startAtType) : startAtType);
  const [pageSystemTypes, setPageSystemTypes] = useState(S?.pageSystemTypes ?? {}); // Type de système pour chaque page (table ou abaque)
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [detectionResult, setDetectionResult] = useState(S?.detectionResult ?? null);
  const [thumbnailSize, setThumbnailSize] = useState(150); // Taille des miniatures
  const [pageClassifications, setPageClassifications] = useState(S?.pageClassifications ?? {}); // Classifications des pages
  // showAnalyzer N'EST PAS restauré à dessein : le remonter à true relancerait
  // l'extraction IA (autoExtract) au montage — l'analyse se relance depuis la
  // sélection des pages, qui elle est intégralement restaurée.
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

  // ─── Persistance de la session (partie pdf) ───────────────────────────────
  // Un seul effet : à chaque changement, le travail est déposé dans le ref du
  // wizard avion. Volatiles exclus à dessein : isProcessing / loadingMessage /
  // error (extraction en cours), showAnalyzer (voir ci-dessus), thumbnailSize.
  useEffect(() => {
    if (!sessionRef) return;
    sessionRef.current = {
      ...(sessionRef.current || {}),
      pdf: {
        navContext,
        currentStep, performanceType,
        manualFile, extractedPages, selectedPages,
        pageSystemTypes, pageClassifications, detectionResult,
      },
    };
  }, [sessionRef, navContext, currentStep, performanceType, manualFile,
      extractedPages, selectedPages, pageSystemTypes, pageClassifications, detectionResult]);

  // FUSIONNÉ: Restaurer les données initiales ET mettre à jour currentStep EN UN SEUL useEffect
  useEffect(() => {
    // Session reprise dans le MÊME contexte : l'étape restaurée fait foi.
    // Sans cette garde, la branche par défaut ramenait à l'étape 2 (choix
    // Tableaux/Abaques) alors qu'on venait de restaurer l'étape en cours.
    // Contexte différent (édition d'un abaque, nouvel abaque direct…) :
    // navRestored est faux et les branches ci-dessous reprennent la main.
    if (navRestored) return;

    if (startAtStep === 2 && initialData) {


      // R5 (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) — « Nouvel abaque » depuis le
      // récapitulatif : ouverture DIRECTE de l'atelier image unique. L'image
      // s'importe à l'étape 1 du canevas → plus de tunnel type/upload/pages.
      if (initialData.directToBuilder) {
        setPerformanceType('abacs');
        setCurrentStep(4);
        return;
      }

      // Si on édite un abaque existant
      if (initialData.abacCurves && initialData.editingModelIndex !== undefined) {

        setPerformanceType('abacs');
        setManualFile({ name: 'Manuel existant', restored: true });
        setCurrentStep(4); // ✅ Changement d'état UNIQUE vers l'étape 4
        return;
      }

      // ⚠️ Lot 0 — branche legacy supprimée : initialData.advancedPerformance /
      // performanceTables fabriquait des pages factices base64 1×1 px et menait
      // à l'écran blanc (currentStep=4 + performanceType='tables' → switch sans
      // case). Inatteignable : Step4Performance intercepte editingTables avant
      // ce wizard et monte AdvancedPerformanceAnalyzer directement.

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
        setLoadingMessage(`Lecture de la page ${i}/${pdf.numPages}...`);
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

        // 🔄 Lot 2.0 (correctif purge) : pas de PDF local mais une référence
        // serveur (fiche restaurée après vidage du site — le wizard synthétise
        // alors un manex avec filePath SANS pdfData). Téléchargement à la
        // demande via le chemin unique ensureManexLocal : l'indicateur
        // isProcessing couvre l'attente, et le PDF est persisté dans le record
        // IndexedDB de l'avion pour les prochaines ouvertures.
        if (!pdfFile) {
          const remote = await communityService.ensureManexLocal(aircraft);
          if (remote.status === 'ready' && remote.manex?.pdfData) {
            const remoteBase64 = remote.manex.pdfData.includes(',')
              ? remote.manex.pdfData.split(',')[1]
              : remote.manex.pdfData;
            const remoteChars = atob(remoteBase64);
            const remoteBytes = new Uint8Array(remoteChars.length);
            for (let i = 0; i < remoteChars.length; i++) {
              remoteBytes[i] = remoteChars.charCodeAt(i);
            }
            pdfFile = remoteBytes;
            setManualFile(new File([remoteBytes], remote.manex.fileName || 'manex.pdf', { type: 'application/pdf' }));
          } else if (remote.status === 'gone') {
            // Fail-closed : la fiche locale a été corrigée par le service.
            setError('Le manuel de vol n\'existe plus côté serveur — ré-importe le PDF à l\'étape « Informations générales ».');
            setIsProcessing(false);
            return;
          } else if (remote.status === 'offline') {
            setError('Manuel de vol disponible côté serveur, mais téléchargement impossible (connexion ?). Réessaie une fois le réseau revenu.');
            setIsProcessing(false);
            return;
          }
        }

        if (!pdfFile) {

          setError('Impossible de récupérer le fichier PDF du manuel de vol');
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
        setError(`Erreur lors de la lecture des pages du manuel : ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    extractPagesFromManex();
  }, [currentStep, extractedPages.length, aircraft]);

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

        // MANEX pas (encore) en local, mais référencé côté serveur — cas d'une
        // fiche restaurée après vidage des données du site (Lot 2.0) : le PDF
        // sera re-téléchargé automatiquement au lancement de l'extraction.
        const hasManexInSupabase = aircraft?.manexAvailableInSupabase;
        const canUseManex = hasManex || !!hasManexInSupabase;

        return (
          <div style={styles.card}>
            <h3 style={{ ...styles.text.lg, ...styles.text.bold, marginBottom: '16px' }}>
              Étape 2 : Sélection des sections de performance
            </h3>

              {/* MANEX disponible côté serveur mais pas encore sur cet appareil :
                  message HONNÊTE (l'ancien texte prétendait qu'un téléchargement
                  était « en cours » et conseillait F5 — rien ne se passait). */}
              {!hasManex && hasManexInSupabase && (
                <div style={{ ...styles.alert, ...styles.alertWarning }}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>Manuel de vol disponible sur le serveur</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-body)' }}>
                      {hasManexInSupabase.fileName} n'est pas encore téléchargé sur cet appareil :
                      il sera récupéré automatiquement au lancement de l'extraction.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerte si MANEX manquant */}
              {!hasManex && !hasManexInSupabase && (
                <div style={{ ...styles.alert, ...styles.alertError }}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>Manuel de vol requis</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-body)' }}>
                      Vous devez d'abord ajouter un manuel de vol dans l'étape "Informations générales"
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
                Choisissez le type de données que vous souhaitez extraire du manuel de vol :
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {/* Carte Tableaux - CLIQUABLE - Navigation directe.
                    canUseManex : accessible aussi quand le PDF n'est pas encore
                    en local mais existe côté serveur (téléchargé à l'étape 3). */}
                <div
                  onClick={() => {
                    if (canUseManex) {
                      setPerformanceType('tables');
                      setCurrentStep(3); // Aller directement à la sélection des pages
                    }
                  }}
                  style={{
                    padding: '10px',
                    backgroundColor: 'var(--bg-overlay)',
                    border: '2px solid var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: canUseManex ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    opacity: canUseManex ? 1 : 0.4,
                    transform: 'scale(1)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => {
                    if (canUseManex) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 64, 175, 0.3)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-overlay)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-overlay)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Table size={28} style={{ color: 'var(--text-primary)' }} />
                    <h4 style={{ ...styles.text.md, ...styles.text.bold, color: 'var(--text-primary)', margin: 0 }}>
                      Tableaux
                    </h4>
                  </div>
                  <p style={{ ...styles.text.sm, color: 'var(--text-secondary)', margin: 0 }}>
                    Lecture automatique du manuel par l'IA
                  </p>
                </div>

                {/* 27/08 — signalement pilote : la carte « Graphiques/Abaques »
                    a été RETIRÉE. Elle ouvrait le même atelier que le bouton
                    « ➕ Nouvel abaque » de la page des données de performance,
                    qui y mène en un clic au lieu de deux. Les deux entrées
                    d'ajout vivent désormais côte à côte sur cette page ; cet
                    écran n'est plus qu'un relais de retour depuis la sélection
                    des pages. */}
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
                  Lecture des tableaux de performance du manuel
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
                preloadedImages={extractedPages
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
                backgroundColor: 'var(--bg-overlay)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '10px',
                flexWrap: 'wrap'
              }}>
                {/* Statut API OpenAI */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} style={{ color: 'var(--text-primary)' }} />
                  <span style={{ ...styles.text.sm, color: 'var(--text-primary)', fontWeight: '500' }}>
                    API connectée
                  </span>
                </div>

                {/* Nombre de pages */}
                {extractedPages.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ ...styles.text.sm, color: 'var(--text-secondary)', fontWeight: '500' }}>
                      {extractedPages.length} page(s) chargée(s)
                    </span>
                  </div>
                )}

                {/* Message d'action */}
                {selectedPages.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ ...styles.text.sm, color: 'var(--text-secondary)' }}>
                      Cliquez sur le bouton "Continuer" pour lancer la lecture automatique des pages sélectionnées
                    </span>
                  </div>
                )}
              </div>

              {isProcessing && (
                <div style={{ ...styles.alert, ...styles.alertSuccess }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid var(--text-primary)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }} />
                  <div>
                    <strong>Lecture en cours...</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-body)' }}>
                      {loadingMessage || 'Lecture des pages du manuel de vol...'}
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
                  backgroundColor: 'var(--bg-overlay)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '10px',
                  border: '1px solid var(--text-secondary)'
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
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)'
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
                      border: selectedPages.includes(index) ? '3px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px',
                      backgroundColor: selectedPages.includes(index) ? 'var(--bg-overlay)' : 'white'
                    }}
                  >
                    <img
                      src={page.image}
                      alt={`Page ${page.pageNumber}`}
                      style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: selectedPages.includes(index) ? 'var(--accent-primary)' : 'rgba(0,0,0,0.5)',
                      color: selectedPages.includes(index) ? 'var(--text-inverse)' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 6px',
                      fontSize: 'var(--fs-body)'
                    }}>
                      Page {page.pageNumber}
                    </div>
                    {/* Menu de classification de performance */}
                    {selectedPages.includes(index) && (
                      <>
                        {/* R23 — classifieur PARTAGÉ (Phase / Métrique / Volets) :
                            même tri et même taxonomie que les abaques. Remplace
                            l'ancienne liste plate de ~16 opérations. */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '4px',
                            right: '4px',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            border: '2px solid var(--text-primary)',
                            backgroundColor: 'var(--bg-overlay)',
                            zIndex: 10,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <OperationClassifier
                            compact
                            direction="column"
                            value={pageClassifications[index] || ''}
                            onChange={(opId) => {
                              setPageClassifications(prev => ({ ...prev, [index]: opId }));
                              setPageSystemTypes(prev => ({ ...prev, [index]: 'table' }));
                            }}
                          />
                        </div>

                        {/* Indicateur visuel pour attirer l'attention */}
                        {!pageClassifications[index] && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            backgroundColor: 'var(--color-red-critical)',
                            color: 'var(--text-primary)',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--fs-caption)',
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
                              backgroundColor: 'var(--accent-primary)',
                              color: 'var(--text-inverse)',
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
              sessionRef={sessionRef}
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