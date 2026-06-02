// src/features/aircraft/components/AdvancedPerformanceAnalyzer.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Upload, Loader, CheckCircle, AlertTriangle, Info, X, Brain,
  Download, Edit3, Plus, Minus, Save, FileText, Table, BarChart3,
  Eye, EyeOff, Copy, Trash2, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import unifiedPerformanceService from '../../../features/performance/services/unifiedPerformanceService';
import { OPERATION_CATALOG, isValidOperationId } from '../../../abac/curves/core/operationCatalog';
import pdfToImageConverter from '../../../services/pdfToImageConverter';
import pdfToImageConverterOptimized from '../../../services/pdfToImageConverterOptimized';
import TableDisplay from './TableDisplay';
import APIConfiguration from '../../performance/components/APIConfiguration';
import apiKeyManager from '../../../utils/apiKeyManager';
import testEnvVars from '../../../utils/testEnvVars';

// ─────────────────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT D'EXTRACTION (Option B)
// ─────────────────────────────────────────────────────────────────────────
//
// L'utilisateur indique une opération principale (operationId du catalogue
// canonique) sur la page sélectionnée. L'IA doit :
//   1. Extraire OBLIGATOIREMENT cette opération
//   2. Si la page contient AUSSI d'autres grandeurs (ex: ground roll + over 50ft
//      sur le même tableau MANEX), retourner CHAQUE grandeur dans un tableau
//      SÉPARÉ avec son propre operationId.
//   3. Une ligne du tableau = un point de calcul, avec UNE seule valeur (`value`)

// ─────────────────────────────────────────────────────────────────────────
// PAIRES D'OPÉRATIONS SŒURS (Option 2 — split forcé)
// ─────────────────────────────────────────────────────────────────────────
//
// Sur la plupart des MANEX, les tableaux "Take-off Distance" et
// "Landing Distance" contiennent 2 grandeurs côte à côte : ground roll
// (roulage seul) ET over 50 ft (passage 15m total). L'IA n'extrait pas
// toujours correctement les 2 (cas observé : takeoff splittée ✓, landing
// non splittée ✗).
//
// Stratégie : pour les operationId qui ont une "sœur logique" (= autre
// grandeur quasi-systématiquement présente sur la même page MANEX), faire
// un 2ème appel OpenAI focalisé sur la sœur si elle n'est pas déjà retournée.
// Coût : +1 appel pour la moitié des extractions. 0 friction utilisateur.
const SISTER_OPERATIONS = {
  takeoff_50ft: 'takeoff_ground_roll',
  takeoff_ground_roll: 'takeoff_50ft',
  landing_50ft_flaps_landing: 'landing_ground_roll_flaps_landing',
  landing_ground_roll_flaps_landing: 'landing_50ft_flaps_landing',
  landing_50ft_flaps_up: 'landing_ground_roll_flaps_up',
  landing_ground_roll_flaps_up: 'landing_50ft_flaps_up'
};

/** Retourne la sœur logique d'un operationId, ou null si pas de sœur définie. */
function getSisterOperation(operationId) {
  return SISTER_OPERATIONS[operationId] || null;
}
//      pour l'operationId du tableau parent. Plus de mélange ground_roll/over_50ft
//      dans la même ligne.

/** Catalogue formaté pour injection dans le prompt OpenAI. */
const buildCatalogForPrompt = () => OPERATION_CATALOG.map(op => {
  const outputs = op.acceptedOutputs.map(o => `${o.kind} (${o.defaultUnit})`).join(' OR ');
  const config = op.configuration?.flaps ? ` [flaps=${op.configuration.flaps}]` : '';
  return `  - "${op.id}" — ${op.labelEn}${config} → output: ${outputs}`;
}).join('\n');

/**
 * Construit un prompt d'extraction adapté à l'operationId attendu.
 *
 * @param {string|null} expectedOperationId  L'operationId que le pilote a indiqué
 *                                            comme classification de la page. Si null
 *                                            ou invalide, l'IA détecte librement.
 * @returns {string} Prompt complet à envoyer à OpenAI Vision
 */
const buildExtractionPrompt = (expectedOperationId) => {
  const isValidExpected = expectedOperationId && isValidOperationId(expectedOperationId);
  const expectedClause = isValidExpected
    ? `The user classified this page as containing data for operationId="${expectedOperationId}".
You MUST extract this operation as a separate table.`
    : `The user has not specified a classification. Detect the operationId(s) yourself from the page content.`;

  return `Extract aircraft performance data from this MANEX page image.

═════ AVAILABLE OPERATION IDs (strict catalog) ═════
${buildCatalogForPrompt()}

═════ INSTRUCTIONS ═════
${expectedClause}

═════ MANDATORY COLUMN-SPLITTING RULE ═════
⚠ ABSOLUTE PRIORITY ⚠
A SINGLE MANEX table in the image often shows MULTIPLE output quantities
side-by-side (one column per quantity). YOU MUST ALWAYS split them.

EXAMPLE 1 — "Take-Off Distance" table with both ground roll AND over 50 ft:
  The MANEX image shows:
    | Altitude | Temp | Mass | Ground Roll (m) | Over 50 ft (m) |
    |    0     |  15  | 1200 |       285       |       425      |
    |   2000   |  15  | 1200 |       320       |       475      |

  YOU MUST RETURN 2 SEPARATE TABLES (not 1 table with 2 columns):
    Table A: operationId="takeoff_ground_roll", data with value=285, 320, ...
    Table B: operationId="takeoff_50ft",        data with value=425, 475, ...

EXAMPLE 2 — "Landing Distance Flaps LDG" table with ground roll AND over 50 ft:
  YOU MUST RETURN 2 SEPARATE TABLES:
    Table A: operationId="landing_ground_roll_flaps_landing"
    Table B: operationId="landing_50ft_flaps_landing"

EXAMPLE 3 — "Climb performance" table with rate of climb AND climb gradient:
  YOU MUST RETURN 2 SEPARATE TABLES (or 1 if only one quantity is shown):
    Table A: operationId="climb_takeoff" with outputKind="rate_of_climb" (ft/min)
    Table B: operationId="climb_takeoff" with outputKind="climb_gradient" (°)

Look at each COLUMN of the MANEX table. Each output column = ONE separate
output table. If you see 2 output columns, return 2 tables. If you see 3
output columns, return 3 tables. Never merge them into a single table.

═════ OTHER CRITICAL RULES ═════
1. ONE table = ONE operationId from the catalog. Never mix multiple operations.
2. Each row has ONE single output value in field "value" (number, in defaultUnit of the operation).
3. Input columns: Altitude (ft), Temperature (°C), Masse (kg). Other relevant inputs are allowed (e.g. windComponent, runwaySlope).
4. If mass is in the header (ex: column "1100 kg") instead of in rows, expand: create one row per mass value with Masse:1100 added.
5. Only return operationIds from the catalog. NEVER invent new ids.

═════ OUTPUT FORMAT (strict JSON) ═════
{
  "tables": [
    {
      "operationId": "takeoff_ground_roll",
      "outputUnit": "m",
      "table_name": "Take-off Ground Roll - Normal Procedure",
      "data": [
        {"Altitude": 0,    "Temperature": 15, "Masse": 1200, "value": 285},
        {"Altitude": 2000, "Temperature": 15, "Masse": 1200, "value": 320}
      ]
    },
    {
      "operationId": "takeoff_50ft",
      "outputUnit": "m",
      "table_name": "Take-off Distance over 50 ft - Normal Procedure",
      "data": [
        {"Altitude": 0,    "Temperature": 15, "Masse": 1200, "value": 425},
        {"Altitude": 2000, "Temperature": 15, "Masse": 1200, "value": 475}
      ]
    }
  ]
}

LIMIT: 30 rows max per table. Extract key data points only.

═════ FINAL REMINDER ═════
Count the OUTPUT columns (distance, time, speed, climb rate...) in the
MANEX image. Return EXACTLY that many tables in the array. If you return
1 table when there are 2 output columns, your answer is WRONG.`;
};

// ─────────────────────────────────────────────────────────────────────────
// HELPER : analyse d'une image avec auto-split via sœur (Option 2)
// ─────────────────────────────────────────────────────────────────────────
//
// Stratégie :
//   1. Appel principal avec expectedOpId. L'IA est censée détecter et splitter.
//   2. Si l'expectedOpId a une sœur logique (SISTER_OPERATIONS) et que l'IA
//      n'a renvoyé qu'UN tableau (donc pas splitté) → 2ème appel ciblé sur la sœur.
//   3. On dédoublonne les résultats par operationId.
//   4. Si l'IA a déjà retourné les 2 grandeurs au 1er appel → pas de 2ème appel
//      (économie de coût).

/**
 * Effectue l'analyse OpenAI avec auto-split via opération sœur.
 *
 * @param {object} unifiedPerformanceService  Service d'analyse
 * @param {string} base64Image                Image base64 sans préfixe data:
 * @param {string|null} expectedOpId          operationId attendu par le pilote
 * @param {function} buildExtractionPromptFn  Constructeur de prompt
 * @param {function} [onProgress]             Callback de progression (msg string)
 * @returns {Promise<object>}                 { tables: [...], confidence, detectionMethod, _splitTriggered: bool }
 */
async function analyzeImageWithSplitCheck(
  unifiedPerformanceService,
  base64Image,
  expectedOpId,
  buildExtractionPromptFn,
  onProgress
) {
  // ── 1er appel : prompt avec expectedOpId ──
  if (onProgress) onProgress(`Analyse 1/2 : ${expectedOpId || 'détection auto'}`);
  const promptMain = buildExtractionPromptFn(expectedOpId);
  const result1 = await unifiedPerformanceService.analyzeManualPerformance(base64Image, promptMain);
  const tables1 = (result1?.tables || []).filter(t => t?.operationId);
  const opIdsReturned = new Set(tables1.map(t => t.operationId));

  // ── Détection : faut-il un 2ème appel ? ──
  const sister = expectedOpId ? getSisterOperation(expectedOpId) : null;
  const sisterAlreadyReturned = sister && opIdsReturned.has(sister);
  const shouldDoSecondCall = sister && !sisterAlreadyReturned;

  if (!shouldDoSecondCall) {
    console.log(`[Analyzer] Pas de 2ème appel nécessaire (sister=${sister}, alreadyReturned=${sisterAlreadyReturned})`);
    return { ...result1, _splitTriggered: false };
  }

  // ── 2ème appel : focalisé sur la sœur ──
  console.log(`[Analyzer] Split auto : 2ème appel pour la sœur "${sister}" (1er appel n'a pas splitté)`);
  if (onProgress) onProgress(`Analyse 2/2 : ${sister} (split auto)`);
  const promptSister = buildExtractionPromptFn(sister);
  let result2 = null;
  try {
    result2 = await unifiedPerformanceService.analyzeManualPerformance(base64Image, promptSister);
  } catch (err) {
    console.warn(`[Analyzer] 2ème appel échoué (sister=${sister}):`, err.message);
    // En cas d'échec du 2ème appel, on conserve juste le 1er résultat
    return { ...result1, _splitTriggered: true, _splitError: err.message };
  }

  // ── Fusion : on garde les tableaux du 1er appel + ceux du 2ème dont
  // l'operationId n'était pas déjà retourné. Préférence donnée au 1er appel. ──
  const tables2 = (result2?.tables || []).filter(t => t?.operationId);
  const mergedTables = [...tables1];
  for (const t of tables2) {
    if (!opIdsReturned.has(t.operationId)) {
      mergedTables.push(t);
      opIdsReturned.add(t.operationId);
    }
  }

  console.log(`[Analyzer] Split résultat : ${tables1.length} (1er appel) + ${tables2.length - (tables1.length === mergedTables.length ? tables2.length : 0)} (2ème appel) = ${mergedTables.length} tableau(x) final`);

  return {
    ...result1,
    tables: mergedTables,
    _splitTriggered: true,
    _splitOperationIds: { primary: expectedOpId, sister },
    confidence: Math.min(result1.confidence ?? 1, result2.confidence ?? 1) // confiance = min des 2
  };
}

/**
 * Composant d'analyse avancée des performances aéronautiques
 * Traite images/PDFs de manuels de vol pour extraire et structurer les données
 */
const AdvancedPerformanceAnalyzer = ({ aircraft, onPerformanceUpdate, preloadedImages, pageClassifications, autoExtract = false, hideUploadedImages = false, initialData, onRetourClick }) => {
  
  
  
  
  // États pour l'upload et l'analyse
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  
  // États pour la sélection de page PDF
  const [showPdfPageSelector, setShowPdfPageSelector] = useState(false);
  const [pdfPages, setPdfPages] = useState([]);
  const [selectedPdfPages, setSelectedPdfPages] = useState([]);
  const [currentPdfFile, setCurrentPdfFile] = useState(null);
  
  // États pour les résultats d'analyse
  const [extractedTables, setExtractedTables] = useState([]);
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tableViewMode, setTableViewMode] = useState('grouped'); // 'grouped' ou 'individual'
  const [groupedTables, setGroupedTables] = useState({});

  // États pour la gestion des erreurs et l'API
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);

  // États pour l'interface
  const [viewMode, setViewMode] = useState('table'); // 'table', 'json', 'csv'
  const [showMetadata, setShowMetadata] = useState(true);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showAPIConfig, setShowAPIConfig] = useState(false);
  const [showPredictionPanel, setShowPredictionPanel] = useState(false);

  // Test de connexion API au chargement
  useEffect(() => {
    

    // Tester les variables d'environnement
    const testResult = testEnvVars();
    

    // Forcer l'initialisation du gestionnaire de clés API
    apiKeyManager.initialize();

    // Récupérer directement la clé depuis l'environnement (sans le ?.)
    const envKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (envKey) {
      
      localStorage.setItem('alflight_ai_api_key', envKey);
      localStorage.setItem('openai_api_key', envKey);

      // Aussi stocker l'endpoint si disponible
      const endpoint = import.meta?.env?.VITE_AI_API_ENDPOINT;
      if (endpoint) {
        localStorage.setItem('alflight_ai_endpoint', endpoint);
      }
    }

    // Vérifier si une clé est maintenant configurée
    const hasKey = apiKeyManager.getAPIKey();

    if (hasKey) {
      setApiStatus({ success: true, message: 'Clé API configurée' });
    } else {
      
      testAPIConnection();
    }
  }, []);

  // Chargement des performances existantes
  useEffect(() => {
    

    // Priorité 1: Données initiales fournies (depuis localStorage)
    if (initialData?.advancedPerformance?.tables) {
      console.log('Loaded from initialData:', initialData.advancedPerformance.tables.length, 'tables');
      setExtractedTables(initialData.advancedPerformance.tables);
      setSelectedTableIndex(0);
    }
    // Priorité 2: Données dans l'aircraft
    else if (aircraft?.advancedPerformance) {
      
      setExtractedTables(aircraft.advancedPerformance.tables || []);
      setSelectedTableIndex(0);
    } else {
      
    }
  }, [aircraft?.advancedPerformance, initialData]);

  // Chargement des images préchargées
  useEffect(() => {
    if (preloadedImages && preloadedImages.length > 0) {
      
      setUploadedImages(preloadedImages);
    }
  }, [preloadedImages]);

  // Extraction automatique quand les images sont chargées et autoExtract est activé
  useEffect(() => {
    if (autoExtract && uploadedImages.length > 0 && !isAnalyzing && extractedTables.length === 0) {
      
      // Délai plus long pour éviter les conflits de rendu
      const timer = setTimeout(() => {
        analyzeImages();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [uploadedImages, autoExtract, isAnalyzing, extractedTables.length]);

  // Fonction d'interpolation pour les données du tableau
  const interpolateFromTableData = (tableData, testValues) => {
    if (!tableData || tableData.length === 0) {
      return { distances: {}, method: 'error', confidence: 0 };
    }
    
    // Identifier TOUTES les colonnes de résultat (ground roll, distance 50ft, etc.)
    const distanceKeywords = [
      'distance', 'Distance', 'DISTANCE',
      'ground_roll', 'groundRoll', 'Ground Roll', 'GROUND ROLL', 'ground', 'roulage',
      'distance_50ft', 'Distance 50ft', 'DISTANCE 50FT', '50ft', '50 ft', 'fifty',
      'totalDistance', 'Total Distance', 'TOTAL DISTANCE', 'total',
      'takeoff_distance', 'Takeoff Distance',
      'landing_distance', 'Landing Distance'
    ];
    
    // Trouver toutes les colonnes de distance
    const resultColumns = [];
    const keys = Object.keys(tableData[0]);
    
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      // Vérifier si c'est une colonne de distance
      if ((lowerKey.includes('distance') ||
           lowerKey.includes('roll') ||
           lowerKey.includes('total') ||
           lowerKey.includes('50ft') ||
           lowerKey.includes('15m') ||
           lowerKey.includes('50 ft') ||
           lowerKey.includes('ground') ||
           lowerKey.includes('roulage') ||
           lowerKey.includes('roulement') ||
           lowerKey.includes('passage')) &&
          !lowerKey.includes('altitude') &&
          !lowerKey.includes('temperature') &&
          !lowerKey.includes('temp') &&
          !lowerKey.includes('mass') &&
          !lowerKey.includes('wind')) {
        // Vérifier que la première valeur est numérique ou peut être convertie en nombre
        const firstValue = tableData[0][key];
        const numValue = typeof firstValue === 'number' ? firstValue : parseFloat(firstValue);
        if (!isNaN(numValue)) {
          resultColumns.push(key);
          
        }
      }
    }
    
    if (resultColumns.length === 0) {
      console.error('Aucune colonne de distance trouvée dans:', Object.keys(tableData[0]));
      return { distances: {}, method: 'no_result_column', confidence: 0 };
    }
    
    // Identifier les colonnes de paramètres (altitude, température, masse)
    const paramColumns = Object.keys(tableData[0]).filter(col => {
      const lowerCol = col.toLowerCase();
      return !resultColumns.includes(col) &&
             (lowerCol.includes('altitude') ||
              lowerCol.includes('temperature') ||
              lowerCol.includes('temp') ||
              lowerCol.includes('masse') ||
              lowerCol.includes('mass') ||
              lowerCol.includes('weight') ||
              lowerCol.includes('poids'));
    });
    
    
    
    
    // Calculer la distance euclidienne normalisée pour chaque point
    const pointsWithDistance = tableData.map((point, index) => {
      let totalDist = 0;
      let validParams = 0;
      let paramDetails = [];

      paramColumns.forEach(param => {
        const testValue = testValues[param];
        const pointValue = point[param];

        if (testValue !== undefined && pointValue !== undefined && pointValue !== null) {
          // Convertir en nombre si nécessaire
          const numTestValue = typeof testValue === 'string' ? parseFloat(testValue) : testValue;
          const numPointValue = typeof pointValue === 'string' ? parseFloat(pointValue) : pointValue;

          if (!isNaN(numTestValue) && !isNaN(numPointValue)) {
            // Normaliser par la plage de valeurs
            const values = tableData.map(p => {
              const val = p[param];
              return typeof val === 'string' ? parseFloat(val) : val;
            }).filter(v => !isNaN(v) && v !== null && v !== undefined);

            if (values.length > 0) {
              const min = Math.min(...values);
              const max = Math.max(...values);
              const range = max - min || 1;

              const normalizedDist = Math.abs(numPointValue - numTestValue) / range;
              totalDist += normalizedDist * normalizedDist;
              validParams++;

              // Pour debug
              if (index < 3) {
                paramDetails.push(`${param}: test=${numTestValue}, point=${numPointValue}, dist=${normalizedDist.toFixed(3)}`);
              }
            }
          }
        }
      });

      const distance = validParams > 0 ? Math.sqrt(totalDist / validParams) : Infinity;

      // Log les points les plus proches pour debug
      if (distance < 0.1) {
        console.log(`Point proche trouvé: distance=${distance.toFixed(4)}, params=[${paramDetails.join(', ')}]`);
      }

      return { ...point, _distance: distance };
    }).sort((a, b) => a._distance - b._distance);
    
    // Prendre les k points les plus proches
    const k = Math.min(3, pointsWithDistance.length);
    const nearestPoints = pointsWithDistance.slice(0, k);
    
    // Interpoler chaque colonne de distance séparément
    const interpolatedDistances = {};
    
    resultColumns.forEach(resultCol => {
      let totalWeight = 0;
      let weightedSum = 0;
      let hasValidData = false;
      let exactMatch = false;

      nearestPoints.forEach(point => {
        const value = point[resultCol];
        const numValue = typeof value === 'string' ? parseFloat(value) : value;

        if (value !== null && value !== undefined && !isNaN(numValue)) {
          hasValidData = true;

          if (point._distance < 0.001) {
            // Point exact trouvé - retourner directement cette valeur
            interpolatedDistances[resultCol] = numValue;
            
            exactMatch = true;
            return; // Sortir de forEach pour ce point
          }

          const weight = 1 / (point._distance + 0.01);
          totalWeight += weight;
          weightedSum += numValue * weight;
        }
      });

      // Seulement calculer l'interpolation si pas de correspondance exacte
      if (!exactMatch && hasValidData && totalWeight > 0) {
        interpolatedDistances[resultCol] = Math.round(weightedSum / totalWeight);
      }
    });
    
    // Calculer la confiance basée sur la distance moyenne
    const avgDistance = nearestPoints.reduce((sum, p) => sum + p._distance, 0) / k;
    const confidence = Math.max(0, Math.min(100, Math.round((1 - avgDistance) * 100)));
    
    return {
      distances: interpolatedDistances,
      method: avgDistance < 0.1 ? 'interpolation' : 'extrapolation',
      confidence: confidence,
      nearestPoints: k,
      columns: resultColumns
    };
  };

  const testAPIConnection = async () => {
    
    setIsTestingAPI(true);
    try {
      const result = await unifiedPerformanceService.testAPIConnection();
      
      setApiStatus(result);
    } catch (err) {
      console.error('❌ API test failed:', err);
      setApiStatus({
        success: false,
        message: `Erreur lors du test: ${err.message}`,
        provider: 'unknown'
      });
    } finally {
      setIsTestingAPI(false);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;

    const newImages = [];
    
    for (const file of files) {
      try {
        if (pdfToImageConverter.isPDF(file)) {
          
          setCurrentPdfFile(file);

          // Déterminer si c'est un gros PDF (>50 pages ou >5MB)
          const sizeInMB = file.size / (1024 * 1024);
          const useOptimized = sizeInMB > 5; // Réduit le seuil à 5MB pour activer le mode optimisé plus souvent

          if (useOptimized) {
            

            // Analyse intelligente du PDF volumineux
            const analysis = await pdfToImageConverterOptimized.analyzeManualPDF(file);
            

            // Afficher un résumé à l'utilisateur
            alert(`📚 Analyse du manuel terminée!\n\n` +
                  `📖 ${analysis.totalPages} pages analysées\n` +
                  `✅ ${analysis.summary.totalRelevantPages} pages pertinentes détectées:\n` +
                  `  • Décollage: ${analysis.summary.takeoffPages} pages\n` +
                  `  • Atterrissage: ${analysis.summary.landingPages} pages\n` +
                  `  • Montée: ${analysis.summary.climbPages} pages\n` +
                  `  • Croisière: ${analysis.summary.cruisePages} pages\n` +
                  `  • Masse/Balance: ${analysis.summary.weightPages} pages\n\n` +
                  `⏱️ Temps d'analyse: ${analysis.summary.analysisTime}s`);

            // Ajouter les pages pertinentes
            for (const page of analysis.relevantPages) {
              newImages.push({
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: `${file.name} - Page ${page.pageNumber} (${page.types.join(', ')})`,
                type: 'pdf-performance-table',
                tableType: page.type,
                originalFile: file,
                pageNumber: page.pageNumber,
                base64: page.base64,
                preview: `data:image/jpeg;base64,${page.base64}`,
                autoDetected: true,
                confidence: page.confidence,
                analysisMetadata: {
                  isLargeDocument: true,
                  totalPages: analysis.totalPages,
                  relevantTypes: page.types
                }
              });
            }

            // Sauvegarder l'analyse complète pour référence
                      } else {
            // Mode standard pour les petits PDFs
            

            // Essayer de détecter automatiquement les pages avec tableaux de performances
            try {
              // Rechercher les pages contenant "takeoff" ou "landing"
              const takeoffTable = await pdfToImageConverter.findPerformanceTablePage(file, 'takeoff');
              const landingTable = await pdfToImageConverter.findPerformanceTablePage(file, 'landing');

              const performancePages = [];

              // Ajouter la page de décollage si trouvée
              if (takeoffTable && !takeoffTable.warning) {
                performancePages.push({
                  pageNumber: takeoffTable.pageNumber,
                  base64: takeoffTable.base64,
                  type: 'takeoff',
                  confidence: 'high'
                });
                
            }
            
            // Ajouter la page d'atterrissage si trouvée et différente
            if (landingTable && !landingTable.warning && 
                landingTable.pageNumber !== takeoffTable?.pageNumber) {
              performancePages.push({
                pageNumber: landingTable.pageNumber,
                base64: landingTable.base64,
                type: 'landing',
                confidence: 'high'
              });
              
            }
            
            // Si des pages ont été trouvées automatiquement
            if (performancePages.length > 0) {
              
              
              // Ajouter les pages trouvées
              for (const page of performancePages) {
                newImages.push({
                  id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: `${file.name} - Page ${page.pageNumber} (${page.type})`,
                  type: 'pdf-performance-table',
                  tableType: page.type,
                  originalFile: file,
                  pageNumber: page.pageNumber,
                  base64: page.base64,
                  preview: `data:image/jpeg;base64,${page.base64}`,
                  autoDetected: true,
                  confidence: page.confidence
                });
              }
              
              // Proposer aussi la sélection manuelle pour d'autres pages
              const allPages = await pdfToImageConverter.extractAllPages(file);
              setPdfPages(allPages);
              setSelectedPdfPages(performancePages.map(p => p.pageNumber));
              
              // Afficher un message pour proposer d'ajouter d'autres pages
              if (allPages.length > performancePages.length) {
                
                setShowPdfPageSelector(true);
              }
              
            } else {
              // Aucune détection automatique, extraction de toutes les pages pour sélection manuelle
              
              const allPages = await pdfToImageConverter.extractAllPages(file);
              setPdfPages(allPages);
              setSelectedPdfPages([]);
              setShowPdfPageSelector(true);
            }

            } catch (detectionError) {
              console.error('Erreur lors de la détection automatique:', detectionError);

              // Fallback: extraire toutes les pages
              const pages = await pdfToImageConverter.extractAllPages(file);
              setPdfPages(pages);
              setSelectedPdfPages([]);
              setShowPdfPageSelector(true);
            }
          } // Fermeture du else (mode standard)

        } else {
          // Image normale
          const base64 = await fileToBase64(file);
          newImages.push({
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: 'image',
            originalFile: file,
            base64: base64,
            preview: `data:${file.type};base64,${base64}`,
            size: file.size
          });
        }
      } catch (error) {
        console.error('Erreur lors du traitement du fichier:', file.name, error);
        setError(`Erreur lors du traitement de ${file.name}: ${error.message}`);
      }
    }

    if (newImages.length > 0) {
      setUploadedImages(prev => [...prev, ...newImages]);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const analyzeImages = async () => {
    if (uploadedImages.length === 0) {
      setError('Veuillez charger au moins une image ou un PDF');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);
    setCurrentStep('Initialisation de l\'analyse...');

    try {
      const results = [];
      
      
      
      for (let i = 0; i < uploadedImages.length; i++) {
        const image = uploadedImages[i];
        

        setAnalysisProgress((i / uploadedImages.length) * 100);

        try {
          // Appel du service d'analyse avancée avec un prompt typé sur le catalogue
          unifiedPerformanceService.setMode('manual');
          // operationId attendu sur cette page (saisi par le pilote dans le wizard)
          const expectedOpId = image.classification && image.classification !== 'non-classified'
            ? image.classification
            : null;

          // Option 2 : auto-split via sœur logique si l'IA ne split pas seule.
          // Pour takeoff_50ft ↔ takeoff_ground_roll, landing_50ft ↔ landing_ground_roll
          // → fait jusqu'à 2 appels et fusionne les résultats.
          const analysisResult = await analyzeImageWithSplitCheck(
            unifiedPerformanceService,
            image.base64,
            expectedOpId,
            buildExtractionPrompt,
            (msg) => setCurrentStep(`Image ${i + 1}/${uploadedImages.length} — ${msg}`)
          );

          if (analysisResult._splitTriggered) {
            console.log(`✅ [Analyzer] Split auto déclenché pour ${image.name} : ${expectedOpId} + sœur`);
          }



          if (analysisResult.tables && analysisResult.tables.length > 0) {
            const imageTables = analysisResult.tables.map(table => {
              // ─── Validation du nouveau schéma (Option B) ───
              // L'IA doit retourner : { operationId, outputUnit, table_name, data: [{...inputs, value}] }
              // Si l'operationId est absent ou hors catalogue, on garde le tableau mais on
              // le marque comme "needs review" pour que le pilote le corrige manuellement.
              const opIdValid = table.operationId && isValidOperationId(table.operationId);
              if (!opIdValid) {
                console.warn(
                  `⚠️ [Analyzer] Tableau sans operationId valide retourné par l'IA (table_name="${table.table_name}")`,
                  { receivedOperationId: table.operationId }
                );
              }

              // Utiliser le format data s'il est fourni, sinon convertir headers+rows (legacy)
              let tableData = table.data;
              if (!tableData && table.headers && table.rows) {
                tableData = table.rows.map(row => {
                  const rowObj = {};
                  table.headers.forEach((header, index) => {
                    rowObj[header] = row[index] || '';
                  });
                  return rowObj;
                });
              }

              // Post-traitement pour s'assurer que la colonne "Masse" existe
              if (tableData && tableData.length > 0) {
                const hasMasse = tableData.some(row => row.Masse !== undefined);
                if (!hasMasse) {
                  // Chercher la masse dans les headers (ex: "1100kg", "900kg")
                  const massHeaders = table.headers?.filter(h => /\d+\s*kg/i.test(h)) || [];
                  if (massHeaders.length > 0) {
                    // Créer des lignes séparées pour chaque masse
                    const expandedData = [];
                    for (const massHeader of massHeaders) {
                      const massValue = massHeader.match(/(\d+)/)?.[1];
                      if (massValue) {
                        tableData.forEach(row => {
                          const newRow = { ...row };
                          newRow.Masse = massValue;
                          // Pour le nouveau schéma : la valeur de la colonne masse devient `value`
                          if (row[massHeader] !== undefined && newRow.value === undefined) {
                            newRow.value = row[massHeader];
                          }
                          expandedData.push(newRow);
                        });
                      }
                    }
                    if (expandedData.length > 0) {
                      tableData = expandedData;
                    }
                  } else if (table.table_name?.match(/\d+\s*kg/i) || table.conditions?.match(/\d+\s*kg/i)) {
                    // Extraire la masse du titre ou des conditions
                    const massMatch = (table.table_name + ' ' + (table.conditions || '')).match(/(\d+)\s*kg/i);
                    if (massMatch) {
                      tableData = tableData.map(row => ({ ...row, Masse: massMatch[1] }));
                    }
                  }
                  // Plus de défaut hardcodé à 1050 — laisser sans Masse plutôt que mentir
                }
              }

              // Extraire le numéro de page depuis image.name pour la fusion
              // Format attendu: "Page 177", "Page 178", etc.
              const pageMatch = image.name.match(/Page\s+(\d+)/i);
              const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : undefined;

              return {
                // Schéma normalisé Option B
                operationId: opIdValid ? table.operationId : null,
                outputUnit: table.outputUnit || null,
                table_name: table.table_name || `Tableau page ${pageNumber || '?'}`,
                data: tableData || [],
                pageNumber,
                sourceImage: {
                  id: image.id,
                  name: image.name,
                  preview: image.preview
                },
                // classification = operationId du catalogue (legacy field name conservé pour compat)
                classification: opIdValid ? table.operationId : (image.classification || 'non-classified'),
                analysisMetadata: {
                  analyzedAt: new Date().toISOString(),
                  confidence: analysisResult.confidence,
                  detectionMethod: analysisResult.detectionMethod,
                  needsReview: !opIdValid
                }
              };
            });

            results.push(...imageTables);
            console.log(`✅ ${imageTables.length} tableaux extraits depuis ${image.name}`);
          } else {
            
            
            
            // Créer une entrée "placeholder" pour pouvoir ré-analyser plus tard
            results.push({
              table_name: `⚠️ Non détecté: ${image.name}`,
              table_type: 'undetected',
              conditions: 'Aucun tableau détecté - Cliquez sur "Ré-analyser" pour réessayer',
              units: {},
              data: [],
              sourceImage: {
                id: image.id,
                name: image.name,
                preview: image.preview
              },
              analysisMetadata: {
                analyzedAt: new Date().toISOString(),
                confidence: 0,
                detectionMethod: 'failed',
                needsReanalysis: true,
                originalResult: analysisResult
              }
            });
            
            // Ne pas afficher d'erreur ici, elle sera affichée dans les encarts après l'analyse complète
          }
        } catch (imageError) {
          console.error(`❌ Erreur lors de l'analyse de ${image.name}:`, imageError);
          console.error(`❌ Stack trace:`, imageError.stack);
          
          // Ajouter le document non analysé à la liste des erreurs
          setValidationErrors(prev => [...prev, `Échec de l'analyse de ${image.name}: ${imageError.message}`]);
          
          // Créer une entrée d'erreur dans les résultats pour ne pas perdre la trace
          results.push({
            table_name: `❌ Erreur: ${image.name}`,
            table_type: 'error',
            conditions: `Erreur d'analyse: ${imageError.message}`,
            units: {},
            data: [],
            sourceImage: {
              id: image.id,
              name: image.name,
              preview: image.preview
            },
            analysisMetadata: {
              analyzedAt: new Date().toISOString(),
              confidence: 0,
              detectionMethod: 'error',
              error: imageError.message
            }
          });
          
          // Continuer avec les autres images même si une échoue
        }
      }
      
      
      
      // Créer un résumé de l'analyse
      const analysisSummary = {
        totalDocuments: uploadedImages.length,
        successfulDocuments: results.filter(r => r.table_type !== 'error' && r.table_type !== 'undetected').length,
        failedDocuments: results.filter(r => r.table_type === 'error').length,
        undetectedDocuments: results.filter(r => r.table_type === 'undetected').length,
        totalTables: results.filter(r => r.table_type !== 'error' && r.table_type !== 'undetected').length,
        documentsWithErrors: results.filter(r => r.table_type === 'error').map(r => r.sourceImage?.name),
        documentsUndetected: results.filter(r => r.table_type === 'undetected').map(r => r.sourceImage?.name)
      };
      
      
      
      // Afficher un message récapitulatif
      if (analysisSummary.failedDocuments > 0) {
        console.log(`⚠️ ${analysisSummary.failedDocuments} document(s) n'ont pas pu être analysés`);
      }

      setCurrentStep('Validation et structuration des données...');
      setAnalysisProgress(90);

      // Validation des données extraites - inclure TOUS les résultats pour garder la trace
      const validatedResults = await validateExtractedData(results);
      
      // Option pour fusionner avec les tableaux existants
      const shouldMerge = extractedTables.length > 0 && 
        confirm('Des tableaux existent déjà. Voulez-vous fusionner les nouveaux tableaux avec les existants ?\n\nOK = Fusionner\nAnnuler = Remplacer');
      
      if (shouldMerge) {
        // Fusionner avec les tableaux existants
        const mergedTables = [...extractedTables, ...validatedResults];
        setExtractedTables(mergedTables);
        
        
        // Les données seront sauvegardées automatiquement via useEffect
      } else {
        // Remplacer les tableaux existants
        setExtractedTables(validatedResults);
        
        
        // Les données seront sauvegardées automatiquement via useEffect
      }
      
      setSelectedTableIndex(0);
      setAnalysisProgress(100);

      // Grouper les tableaux par classification après extraction
      groupTablesByClassification(shouldMerge ? mergedTables : validatedResults);
      
      // Message de fin avec résumé
      if (analysisSummary.failedDocuments > 0 || analysisSummary.undetectedDocuments > 0) {
        const problemCount = analysisSummary.failedDocuments + analysisSummary.undetectedDocuments;
        setCurrentStep(`⚠️ Analyse terminée : ${analysisSummary.totalTables} tableau(x) extrait(s), ${problemCount} document(s) avec problèmes`);
        
        // Afficher les problèmes de manière plus visible
        let problemMessage = `Analyse terminée avec des problèmes :\n`;
        problemMessage += `- Documents analysés : ${analysisSummary.totalDocuments}\n`;
        problemMessage += `- Tableaux extraits avec succès : ${analysisSummary.totalTables}\n`;
        
        if (analysisSummary.undetectedDocuments > 0) {
          problemMessage += `\n⚠️ Documents où aucun tableau n'a été détecté (${analysisSummary.undetectedDocuments}) :\n`;
          problemMessage += analysisSummary.documentsUndetected.map(d => `  - ${d}`).join('\n');
          problemMessage += `\n\nCes documents ont été ajoutés à la liste. Vous pouvez :\n`;
          problemMessage += `• Cliquer sur "Ré-analyser" pour réessayer l'extraction\n`;
          problemMessage += `• Éditer manuellement les données\n`;
          problemMessage += `• Supprimer les entrées non pertinentes\n`;
        }
        
        if (analysisSummary.failedDocuments > 0) {
          problemMessage += `\n❌ Documents en erreur (${analysisSummary.failedDocuments}) :\n`;
          problemMessage += analysisSummary.documentsWithErrors.map(d => `  - ${d}`).join('\n');
        }
        
        problemMessage += `\nVérifiez la console pour plus de détails.`;
        
        alert(problemMessage);
      } else {
        setCurrentStep(`✅ Analyse terminée ! ${analysisSummary.totalTables} tableau(x) extrait(s) avec succès`)
      }

    } catch (err) {
      setError(`Erreur lors de l'analyse: ${err.message}`);
      console.error('Erreur d\'analyse:', err);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => {
        setAnalysisProgress(0);
        setCurrentStep('');
      }, 2000);
    }
  };

  const validateExtractedData = async (tables) => {
    const validatedTables = [];
    const errors = [];

    for (const table of tables) {
      try {
        // Validation de la structure
        if (!table.table_name || !table.data || !Array.isArray(table.data)) {
          errors.push(`Table "${table.table_name || 'Sans nom'}" : structure invalide`);
          continue;
        }

        // Validation des données numériques
        const validatedData = table.data.map((row, index) => {
          const validatedRow = {};
          for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
              errors.push(`Table "${table.table_name}", ligne ${index + 1} : valeur invalide pour "${key}"`);
              validatedRow[key] = null;
            } else {
              validatedRow[key] = value;
            }
          }
          return validatedRow;
        });

        validatedTables.push({
          ...table,
          data: validatedData,
          validation: {
            isValid: errors.length === 0,
            errors: errors.filter(err => err.includes(table.table_name))
          }
        });

      } catch (error) {
        errors.push(`Erreur lors de la validation de "${table.table_name}": ${error.message}`);
      }
    }

    setValidationErrors(errors);
    return validatedTables;
  };

  const exportToJSON = () => {
    if (extractedTables.length === 0) return;
    
    const dataToExport = {
      aircraft: {
        registration: aircraft?.registration,
        model: aircraft?.model
      },
      extraction_metadata: {
        exported_at: new Date().toISOString(),
        total_tables: extractedTables.length
      },
      performance_tables: extractedTables
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performances_${aircraft?.registration || 'aircraft'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!selectedTable || !selectedTable.data || selectedTable.data.length === 0) return;

    const table = selectedTable;

    const headers = Object.keys(table.data[0]);
    const csvContent = [
      `# ${table.table_name}`,
      `# Conditions: ${table.conditions || 'Non spécifiées'}`,
      `# Unités: ${Object.entries(table.units || {}).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      '',
      headers.join(','),
      ...table.data.map(row => headers.map(header => row[header] || '').join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.table_name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Mémoriser les fonctions pour éviter les re-renders
  const handleEditModeChange = useCallback((newEditMode) => {
    
    setIsEditMode(newEditMode);
  }, []);

  const handleTableUpdate = useCallback((updatedTable) => {
    
    setExtractedTables(prevTables => {
      const newTables = [...prevTables];
      newTables[selectedTableIndex] = updatedTable;
      
      // Sauvegarder les modifications
      if (onPerformanceUpdate) {
        const performanceData = {
          tables: newTables,
          extractionMetadata: {
            analyzedAt: new Date().toISOString(),
            totalTables: newTables.length,
            analysisVersion: '2.0',
            lastModified: new Date().toISOString()
          }
        };
        onPerformanceUpdate({ advancedPerformance: performanceData });
      }
      
      return newTables;
    });
  }, [selectedTableIndex, onPerformanceUpdate]);

  const deleteTable = useCallback((indexToDelete) => {
    // En mode groupé, on ne peut pas supprimer directement
    if (tableViewMode === 'grouped') {
      alert('Passez en vue individuelle pour supprimer des tableaux spécifiques');
      return;
    }

    

    // Confirmer la suppression
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le tableau "${extractedTables[indexToDelete]?.table_name || 'Sans nom'}" ?`)) {
      return;
    }
    
    setExtractedTables(prevTables => {
      const newTables = prevTables.filter((_, index) => index !== indexToDelete);
      
      // Ajuster l'index sélectionné si nécessaire
      if (indexToDelete === selectedTableIndex && newTables.length > 0) {
        // Si on supprime le tableau sélectionné, sélectionner le précédent ou le premier
        const newIndex = Math.max(0, indexToDelete - 1);
        setSelectedTableIndex(newIndex);
      } else if (indexToDelete < selectedTableIndex) {
        // Si on supprime un tableau avant celui sélectionné, décrémenter l'index
        setSelectedTableIndex(prev => prev - 1);
      } else if (newTables.length === 0) {
        setSelectedTableIndex(0);
      }
      
      // Sauvegarder les modifications
      if (onPerformanceUpdate) {
        const performanceData = newTables.length > 0 ? {
          tables: newTables,
          extractionMetadata: {
            analyzedAt: new Date().toISOString(),
            totalTables: newTables.length,
            analysisVersion: '2.0',
            lastModified: new Date().toISOString()
          }
        } : null;
        onPerformanceUpdate({ advancedPerformance: performanceData });
      }
      
      return newTables;
    });
  }, [extractedTables, selectedTableIndex, onPerformanceUpdate, tableViewMode]);

  const deleteAllTables = useCallback(() => {
    
    
    // Confirmer la suppression
    if (!confirm(`Êtes-vous sûr de vouloir supprimer TOUS les ${extractedTables.length} tableaux ?`)) {
      return;
    }
    
    setExtractedTables([]);
    setSelectedTableIndex(0);
    
    // Sauvegarder les modifications (supprimer toutes les performances)
    if (onPerformanceUpdate) {
      onPerformanceUpdate({ advancedPerformance: null });
    }
  }, [extractedTables.length, onPerformanceUpdate]);

  const reanalyzeTable = useCallback(async (tableIndex) => {
    const table = extractedTables[tableIndex];
    if (!table || !table.sourceImage) {
      console.error('Impossible de ré-analyser: données source manquantes');
      return;
    }
    
    
    setIsAnalyzing(true);
    setCurrentStep(`Ré-analyse de ${table.sourceImage.name}...`);
    
    try {
      // Forcer une nouvelle analyse avec le même prompt détaillé
      unifiedPerformanceService.setMode('manual');
      // RE-ANALYSE en mode strict catalogue : extrait les opérations détectables
      // sur l'image, chaque opération dans son propre tableau (Option B).
      const detailedPrompt = buildExtractionPrompt(null) + `

═════ RE-ANALYSIS MODE ═════
This is a RE-ANALYSIS — the previous attempt may have missed data.
Look CAREFULLY for ANY tables, graphs, or numerical grids related to aircraft performance.
Extract EVERYTHING you can identify. If unsure about operationId, omit it (the user will review).
Do NOT return empty tables array.`;

      const analysisResult = await unifiedPerformanceService.analyzeManualPerformance(
        table.sourceImage.preview.split(',')[1], // Extraire le base64 de la preview
        detailedPrompt
      );

      if (analysisResult.tables && analysisResult.tables.length > 0) {
        // Remplacer l'entrée existante par les nouveaux résultats
        const newTables = [...extractedTables];
        newTables[tableIndex] = {
          ...analysisResult.tables[0],
          sourceImage: table.sourceImage,
          analysisMetadata: {
            ...analysisResult.tables[0].analysisMetadata,
            reanalyzed: true,
            reanalyzedAt: new Date().toISOString()
          }
        };
        
        setExtractedTables(newTables);
        setCurrentStep('✅ Ré-analyse réussie !');
        
        // Sauvegarder
        if (onPerformanceUpdate) {
          const performanceData = {
            tables: newTables,
            extractionMetadata: {
              analyzedAt: new Date().toISOString(),
              totalTables: newTables.length,
              analysisVersion: '2.0',
              lastModified: new Date().toISOString()
            }
          };
          onPerformanceUpdate({ advancedPerformance: performanceData });
        }
      } else {
        setError('La ré-analyse n\'a pas permis d\'extraire de tableau. Essayez d\'éditer manuellement.');
      }
    } catch (error) {
      console.error('Erreur lors de la ré-analyse:', error);
      setError(`Erreur lors de la ré-analyse: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setCurrentStep(''), 2000);
    }
  }, [extractedTables, onPerformanceUpdate]);

  // Fonction pour créer un tableau vide manuellement
  const createManualTable = useCallback(() => {
    

    const emptyTable = {
      table_name: 'Tableau de performance manuel',
      classification: 'takeoff',
      headers: ['Altitude (ft)', 'Temperature (°C)', 'Distance roulage (m)', 'Distance 50ft (m)'],
      data: [
        { 'Altitude (ft)': '0', 'Temperature (°C)': '15', 'Distance roulage (m)': '', 'Distance 50ft (m)': '' },
        { 'Altitude (ft)': '1000', 'Temperature (°C)': '15', 'Distance roulage (m)': '', 'Distance 50ft (m)': '' },
        { 'Altitude (ft)': '2000', 'Temperature (°C)': '15', 'Distance roulage (m)': '', 'Distance 50ft (m)': '' },
        { 'Altitude (ft)': '3000', 'Temperature (°C)': '15', 'Distance roulage (m)': '', 'Distance 50ft (m)': '' }
      ],
      metadata: {
        extractedAt: new Date().toISOString(),
        sourceType: 'manual',
        confidence: 1.0,
        isManuallyCreated: true
      }
    };

    setExtractedTables(prevTables => {
      const newTables = [...prevTables, emptyTable];
      setSelectedTableIndex(newTables.length - 1);
      setIsEditMode(true); // Activer automatiquement le mode édition

      // Les données seront sauvegardées automatiquement via useEffect

      return newTables;
    });
  }, []);

  // Fonction pour grouper les tableaux par classification
  const groupTablesByClassification = useCallback((tables) => {
    const grouped = {};

    tables.forEach((table, index) => {
      // Exclure les tableaux non détectés ou en erreur du groupement
      if (table.table_type === 'undetected' || table.table_type === 'error') {
        return;
      }
      const classification = table.classification || 'non-classified';
      if (!grouped[classification]) {
        grouped[classification] = [];
      }
      grouped[classification].push({ ...table, originalIndex: index });
    });

    setGroupedTables(grouped);
  }, []);

  // Effet pour regrouper les tableaux quand ils changent
  useEffect(() => {
    if (extractedTables.length > 0) {
      groupTablesByClassification(extractedTables);
    }
  }, [extractedTables, groupTablesByClassification]);

  // État pour suivre si les données ont été envoyées au parent
  const [lastSentTablesCount, setLastSentTablesCount] = useState(0);

  // Effet pour notifier les changements de performance au parent
  useEffect(() => {
    if (extractedTables.length > 0 && onPerformanceUpdate) {
      const validTables = extractedTables.filter(t => t.table_type !== 'undetected' && t.table_type !== 'error');

      // Ne mettre à jour que si le nombre de tableaux valides a changé
      if (validTables.length > 0 && validTables.length !== lastSentTablesCount) {
        const performanceData = {
          tables: validTables,
          extractionMetadata: {
            analyzedAt: new Date().toISOString(),
            totalTables: validTables.length,
            analysisVersion: '2.0'
          }
        };

        // Utiliser setTimeout pour éviter la mise à jour pendant le rendu
        setTimeout(() => {
          onPerformanceUpdate({ advancedPerformance: performanceData });
          setLastSentTablesCount(validTables.length);
        }, 0);
      }
    }
  }, [extractedTables, onPerformanceUpdate, lastSentTablesCount]);

  // Fonction pour combiner les données de tableaux similaires
  const combineTablesData = useCallback((tables) => {
    if (tables.length === 0) return null;
    if (tables.length === 1) return tables[0];

    // Prendre le premier tableau comme base
    const combinedTable = { ...tables[0] };
    combinedTable.table_name = `${combinedTable.table_name} (Combiné - ${tables.length} tableaux)`;

    // Combiner toutes les données
    const allData = [];
    const sourceImages = [];

    tables.forEach(table => {
      if (table.data && Array.isArray(table.data)) {
        allData.push(...table.data);
      }
      if (table.sourceImage) {
        sourceImages.push(table.sourceImage);
      }
    });

    combinedTable.data = allData;
    combinedTable.sourceImages = sourceImages; // Garder la trace de toutes les images sources
    combinedTable.isCombined = true;

    
    return combinedTable;
  }, []);

  // Obtenir le tableau sélectionné en fonction du mode de vue
  const selectedTable = useMemo(() => {
    if (tableViewMode === 'individual') {
      return extractedTables[selectedTableIndex];
    } else {
      // Mode groupé : afficher le tableau combiné pour la classification sélectionnée
      const classifications = Object.keys(groupedTables);
      if (classifications.length === 0) return null;

      // Utiliser l'index pour naviguer entre les groupes
      const selectedClassification = classifications[Math.min(selectedTableIndex, classifications.length - 1)];
      const tablesInGroup = groupedTables[selectedClassification];

      return combineTablesData(tablesInGroup);
    }
  }, [extractedTables, selectedTableIndex, tableViewMode, groupedTables, combineTablesData]);

  return (
    <div>

          {/* Images chargées */}
          {uploadedImages.length > 0 && !hideUploadedImages && (
            <div style={sx.spacing.mb(4)}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                📋 Documents chargés ({uploadedImages.length})
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                {uploadedImages.map((image) => (
                  <div key={image.id} style={sx.combine(sx.components.card.base, { position: 'relative' })}>
                    {/* Badge pour les pages auto-détectées */}
                    {image.autoDetected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        zIndex: 1
                      }}>
                        AUTO
                      </div>
                    )}
                    
                    {/* Badge pour le type de tableau */}
                    {image.tableType && (
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        backgroundColor: image.tableType === 'takeoff' ? 'var(--text-secondary)' : 'var(--accent-primary)',
                        color: 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        zIndex: 1
                      }}>
                        {image.tableType === 'takeoff' ? 'DÉCOLLAGE' : 'ATTERRISSAGE'}
                      </div>
                    )}
                    
                    <img
                      src={image.preview}
                      alt={image.name}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    />
                    <button
                      onClick={() => removeImage(image.id)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: '#C04534',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <X size={12} />
                    </button>
                    <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))} title={image.name}>
                      {image.name.length > 20 ? `${image.name.substring(0, 20)}...` : image.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

      {/* Barre de progression */}
      {isAnalyzing && (
        <div style={sx.spacing.mb(4)}>
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(1))}>
            <span style={sx.text.sm}>{currentStep}</span>
            <span style={sx.text.sm}>{Math.round(analysisProgress)}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${analysisProgress}%`,
              height: '100%',
              backgroundColor: 'var(--text-secondary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Affichage des erreurs globales */}
      {error && !error.includes('Document') && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>{error}</p>
        </div>
      )}

      {/* Erreurs de validation */}
      {validationErrors.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>Erreurs de validation détectées:</p>
            <ul style={sx.combine(sx.text.xs, { marginLeft: '16px', marginTop: '4px' })}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tableaux avec erreurs d'analyse après extraction complète */}
      {extractedTables.filter(t => t.table_type === 'undetected' || t.table_type === 'error').length > 0 && (
        <div style={sx.spacing.mb(4)}>
          {extractedTables.filter(t => t.table_type === 'undetected').map((table, index) => (
            <div key={`undetected-${index}`} style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.warning,
              sx.spacing.mb(2)
            )}>
              <AlertTriangle size={16} />
              <div style={{ flex: 1 }}>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  {table.sourceImage?.name || `Document ${index + 1}`}
                </p>
                <p style={sx.text.xs}>Aucune table détectée dans ce document</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    // Ré-analyser uniquement ce document
                    const imageToReanalyze = uploadedImages.find(img => img.id === table.sourceImage?.id);
                    if (imageToReanalyze) {
                      setIsAnalyzing(true);
                      setError(null);
                      try {
                        // Ré-analyser avec le prompt typé sur le catalogue
                        const expectedOpId = imageToReanalyze.classification && imageToReanalyze.classification !== 'non-classified'
                          ? imageToReanalyze.classification
                          : null;
                        const detailedPrompt = buildExtractionPrompt(expectedOpId);

                        // Extraire le base64 de l'image
                        const base64Data = imageToReanalyze.preview.includes('base64,')
                          ? imageToReanalyze.preview.split(',')[1]
                          : imageToReanalyze.preview;

                        const result = await unifiedPerformanceService.analyzeManualPerformance(
                          base64Data,
                          detailedPrompt
                        );

                        if (result && result.tables && result.tables.length > 0) {
                          // Remplacer le tableau non détecté par les nouveaux résultats
                          const newTables = [...extractedTables];
                          const indexToReplace = newTables.findIndex(t => t.sourceImage?.id === imageToReanalyze.id);
                          if (indexToReplace !== -1) {
                            newTables.splice(indexToReplace, 1, ...result.tables.map(t => ({
                              ...t,
                              sourceImage: {
                                id: imageToReanalyze.id,
                                name: imageToReanalyze.name,
                                preview: imageToReanalyze.preview
                              }
                            })));
                            setExtractedTables(newTables);
                          }
                        }
                      } catch (error) {
                        console.error('Erreur lors de la ré-analyse:', error);
                      } finally {
                        setIsAnalyzing(false);
                      }
                    }
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary, { padding: '4px 12px' })}
                >
                  <RefreshCw size={14} style={{ marginRight: '4px' }} />
                  Ré-analyser
                </button>
                <button
                  onClick={createManualTable}
                  style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '4px 12px' })}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  Créer manuellement
                </button>
                <button
                  onClick={() => {
                    // Supprimer ce tableau non détecté
                    const newTables = extractedTables.filter(t => t !== table);
                    setExtractedTables(newTables);
                  }}
                  style={sx.combine(sx.components.button.base, {
                    backgroundColor: '#C04534',
                    color: 'var(--text-primary)',
                    padding: '4px 12px'
                  })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {extractedTables.filter(t => t.table_type === 'error').map((table, index) => (
            <div key={`error-${index}`} style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.danger,
              sx.spacing.mb(2)
            )}>
              <AlertTriangle size={16} />
              <div style={{ flex: 1 }}>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  {table.sourceImage?.name || `Document ${index + 1}`}
                </p>
                <p style={sx.text.xs}>{table.conditions || 'Erreur lors de l\'analyse'}</p>
              </div>
              <button
                onClick={() => {
                  // Supprimer ce tableau en erreur
                  const newTables = extractedTables.filter(t => t !== table);
                  setExtractedTables(newTables);
                }}
                style={sx.combine(sx.components.button.base, {
                  backgroundColor: '#C04534',
                  color: 'var(--text-primary)',
                  padding: '4px 12px'
                })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Résultats d'analyse */}
      {extractedTables.length > 0 && (
        <div>
          {/* Boutons Vue groupée / Modifier les extractions — retirés de l'interface */}

          {/* Sélecteur de tableau — retiré de l'interface */}
          {false && extractedTables.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={sx.combine(sx.text.sm, sx.text.bold, { display: 'block', marginBottom: '8px' })}>
                {tableViewMode === 'grouped' ? 'Catégorie à afficher:' : 'Tableau à afficher:'}
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={selectedTableIndex}
                  onChange={(e) => setSelectedTableIndex(parseInt(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--text-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    flex: 1
                  }}
                >
                  {tableViewMode === 'grouped' ? (
                    // Mode groupé : afficher les catégories (en excluant les tableaux non détectés/erreur)
                    Object.entries(groupedTables).map(([classification, tables], index) => (
                      <option key={index} value={index}>
                        {classification === 'non-classified' ? 'Non classifié' : classification}
                        {` (${tables.length} tableau${tables.length > 1 ? 'x' : ''}, ${tables.reduce((acc, t) => acc + (t.data?.length || 0), 0)} lignes)`}
                      </option>
                    ))
                  ) : (
                    // Mode individuel : afficher seulement les tableaux valides
                    extractedTables
                      .filter(table => table.table_type !== 'undetected' && table.table_type !== 'error')
                      .map((table, filteredIndex) => {
                        const originalIndex = extractedTables.indexOf(table);
                        return (
                          <option key={originalIndex} value={originalIndex}>
                            {table.classification && table.classification !== 'non-classified' ? `[${table.classification}] ` : ''}
                            {table.table_name || `Tableau ${filteredIndex + 1}`}
                            {table.data && table.data.length > 0 ? ` (${table.data.length} lignes)` : ''}
                          </option>
                        );
                      })
                  )}
                </select>
                {/* Bouton de ré-analyse si le tableau n'a pas été détecté */}
                {selectedTable && (selectedTable.table_type === 'undetected' || selectedTable.table_type === 'error') && (
                  <button
                    onClick={() => {
                      if (tableViewMode === 'grouped') {
                        // En mode groupé, trouver l'index original du premier tableau non détecté
                        const classifications = Object.keys(groupedTables);
                        const selectedClassification = classifications[Math.min(selectedTableIndex, classifications.length - 1)];
                        const tablesInGroup = groupedTables[selectedClassification];
                        if (tablesInGroup && tablesInGroup.length > 0) {
                          reanalyzeTable(tablesInGroup[0].originalIndex);
                        }
                      } else {
                        reanalyzeTable(selectedTableIndex);
                      }
                    }}
                    disabled={isAnalyzing}
                    style={sx.combine(
                      sx.components.button.base,
                      {
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      },
                      isAnalyzing && { opacity: 0.5, cursor: 'not-allowed' }
                    )}
                    title="Ré-analyser ce document"
                  >
                    <RefreshCw size={16} />
                    Ré-analyser
                  </button>
                )}

                {/* Bouton de suppression (seulement en vue individuelle) */}
                {tableViewMode === 'individual' && (
                  <button
                    onClick={() => deleteTable(selectedTableIndex)}
                    style={sx.combine(
                    sx.components.button.base,
                    { 
                      backgroundColor: '#C04534',
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }
                  )}
                    title="Supprimer ce tableau"
                  >
                    <Trash2 size={16} />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Message informatif en mode groupé */}

          {/* Affichage du tableau sélectionné */}
          {selectedTable && (
            <>
              <TableDisplay
                table={selectedTable}
                viewMode={viewMode}
                showMetadata={showMetadata}
                isEditMode={tableViewMode === 'individual' ? isEditMode : false}
                onEditModeChange={tableViewMode === 'individual' ? handleEditModeChange : undefined}
                onTableUpdate={tableViewMode === 'individual' ? handleTableUpdate : undefined}
              />
              
              {/* Panneau "Test de prédiction" retiré de l'interface (bloc neutralisé) */}
              {false && selectedTable.data && selectedTable.data.length > 0 && (
                <div style={sx.combine(sx.components.card.base, sx.spacing.mt(3))}>
                  <button
                    onClick={() => setShowPredictionPanel(!showPredictionPanel)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
                  >
                    <span>🧪 Test de prédiction sur les données extraites</span>
                    {showPredictionPanel ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  {showPredictionPanel && (
                  <div style={sx.spacing.p(3)}>
                  
                  <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
                    <p style={sx.text.sm}>
                      Testez l'interpolation basée sur les {selectedTable.data.length} points extraits du tableau
                    </p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {/* Afficher altitude, température et masse */}
                    {Object.keys(selectedTable.data[0] || {})
                      .filter(key => {
                        const lowerKey = key.toLowerCase();
                        return (lowerKey.includes('altitude') ||
                                lowerKey.includes('temperature') ||
                                lowerKey.includes('temp') ||
                                lowerKey === 'temperature_c' ||
                                lowerKey === 'temperature_f' ||
                                lowerKey.includes('masse') ||
                                lowerKey.includes('mass') ||
                                lowerKey.includes('weight') ||
                                lowerKey.includes('poids')) &&
                               !lowerKey.includes('distance') &&
                               !lowerKey.includes('roll') &&
                               !lowerKey.includes('total');
                      })
                      .map(key => (
                      <div key={key}>
                        <label style={sx.combine(sx.text.xs, sx.text.secondary, { display: 'block', marginBottom: '4px' })}>
                          {key} {selectedTable.units?.[key] ? `(${selectedTable.units[key]})` : ''}
                        </label>
                        <input
                          type="number"
                          id={`test-${key}`}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid var(--text-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '14px'
                          }}
                          placeholder="Valeur"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => {
                      // Récupérer les valeurs des champs altitude, température et masse
                      const testValues = {};
                      Object.keys(selectedTable.data[0] || {})
                        .filter(key => {
                          const lowerKey = key.toLowerCase();
                          return (lowerKey.includes('altitude') ||
                                  lowerKey.includes('temperature') ||
                                  lowerKey.includes('temp') ||
                                  lowerKey === 'temperature_c' ||
                                  lowerKey === 'temperature_f' ||
                                  lowerKey.includes('masse') ||
                                  lowerKey.includes('mass') ||
                                  lowerKey.includes('weight') ||
                                  lowerKey.includes('poids')) &&
                                 !lowerKey.includes('distance') &&
                                 !lowerKey.includes('roll') &&
                                 !lowerKey.includes('total');
                        })
                        .forEach(key => {
                          const input = document.getElementById(`test-${key}`);
                          if (input && input.value) {
                            testValues[key] = parseFloat(input.value);
                          }
                        });
                      
                      // Interpolation simple basée sur les points les plus proches
                      const result = interpolateFromTableData(selectedTable.data, testValues);
                      
                      // Afficher le résultat
                      const resultDiv = document.getElementById('prediction-result');
                      if (resultDiv) {
                        // Formater le message selon la méthode
                        let methodText = result.method;
                        if (result.method === 'no_result_column') {
                          methodText = 'Erreur: Aucune colonne de distance trouvée';
                        } else if (result.method === 'interpolation') {
                          methodText = 'Interpolation IDW (proche)';
                        } else if (result.method === 'extrapolation') {
                          methodText = 'Extrapolation IDW (éloigné)';
                        }
                        
                        // Afficher les valeurs de test utilisées
                        const testValuesText = Object.entries(testValues)
                          .map(([key, value]) => `${key}: ${value}${selectedTable.units?.[key] ? ' ' + selectedTable.units[key] : ''}`)
                          .join(', ');
                        
                        // Créer le HTML pour toutes les distances
                        let distancesHtml = '';
                        if (result.distances && Object.keys(result.distances).length > 0) {
                          distancesHtml = Object.entries(result.distances).map(([col, value]) => {
                            const unit = selectedTable.units?.[col] || 'm';
                            // Formatter le nom de la colonne
                            let displayName = col;
                            if (col.toLowerCase().includes('ground') || col.toLowerCase().includes('roll')) {
                              displayName = 'Ground Roll (Roulage)';
                            } else if (col.toLowerCase().includes('50ft') || col.toLowerCase().includes('50 ft')) {
                              displayName = 'Distance 50ft (Passage 15m)';
                            } else if (col.toLowerCase().includes('total')) {
                              displayName = 'Distance Totale';
                            }
                            
                            return `
                              <div style="margin: 8px 0; padding: 8px; background: var(--bg-overlay); border-radius: 4px;">
                                <strong style="color: var(--text-secondary);">${displayName}:</strong>
                                <span style="font-size: 20px; font-weight: bold; margin-left: 10px;">
                                  ${value} ${unit}
                                </span>
                              </div>
                            `;
                          }).join('');
                        }
                        
                        resultDiv.innerHTML = `
                          <div style="padding: 12px; background: ${result.method === 'no_result_column' ? 'var(--bg-overlay)' : 'var(--bg-overlay)'}; border: 1px solid ${result.method === 'no_result_column' ? '#C04534' : 'var(--text-secondary)'}; border-radius: 6px; margin-top: 12px;">
                            <strong style="font-size: 16px;">📊 Résultat de la prédiction</strong><br/>
                            ${result.method !== 'no_result_column' ? `
                              <div style="margin-top: 12px;">
                                <div style="background: white; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                                  ${distancesHtml || '<span style="color: #C04534;">Aucune distance calculée</span>'}
                                </div>
                                <div style="border-top: 1px solid var(--border-subtle); padding-top: 8px; margin-top: 8px;">
                                  <span style="color: var(--text-tertiary); font-size: 12px;">
                                    <strong>Conditions:</strong> ${testValuesText}<br/>
                                    <strong>Méthode:</strong> ${methodText}<br/>
                                    <strong>Confiance:</strong> ${result.confidence}%<br/>
                                    <strong>Points utilisés:</strong> ${result.nearestPoints || 0}
                                  </span>
                                </div>
                              </div>
                            ` : `
                              <div style="margin-top: 8px;">
                                <span style="color: #C04534;">${methodText}</span><br/>
                                <span style="color: var(--text-tertiary); font-size: 12px;">
                                  <strong>Colonnes disponibles:</strong><br/>
                                  ${Object.keys(selectedTable.data[0] || {}).join(', ')}
                                </span>
                              </div>
                            `}
                          </div>
                        `;
                      }
                    }}
                    style={sx.combine(sx.components.button.base, sx.components.button.primary, { width: '100%' })}
                  >
                    Prédire la distance
                  </button>

                  <div id="prediction-result"></div>
                  </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Barre de navigation - Boutons Retour et Sauvegarder */}
      {!isAnalyzing && extractedTables.filter(t => t.table_type !== 'undetected' && t.table_type !== 'error').length > 0 && (
        <div style={{
          ...sx.spacing.mt(4),
          display: 'flex',
          justifyContent: onRetourClick ? 'space-between' : 'flex-end',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Bouton Retour - seulement si onRetourClick est fourni */}
          {onRetourClick && (
            <button
              onClick={onRetourClick}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ← Retour
            </button>
          )}

          {/* Bouton Suivant */}
          <button
            onClick={() => {
              const validTables = extractedTables.filter(t => t.table_type !== 'undetected' && t.table_type !== 'error');

              if (validTables.length === 0) {
                alert('Aucun tableau valide à sauvegarder');
                return;
              }

              

              // Afficher notification éphémère
              const notification = document.createElement('div');
              notification.textContent = 'Performances sauvegardées';
              notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--bg-overlay);
                color: var(--text-primary);
                border: 1px solid var(--border-subtle);
                border-left: 3px solid var(--accent-primary);
                padding: 14px 20px;
                border-radius: var(--radius-sm);
                font-family: var(--font-sans);
                font-weight: 600;
                font-size: 14px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
              `;
              document.body.appendChild(notification);

              // Supprimer après 3 secondes
              setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => document.body.removeChild(notification), 300);
              }, 3000);

              // Préparer les données finales
              const performanceData = {
                tables: validTables,
                extractionMetadata: {
                  analyzedAt: new Date().toISOString(),
                  totalTables: validTables.length,
                  analysisVersion: '2.0',
                  completedAt: new Date().toISOString()
                }
              };

              // Sauvegarder et le parent naviguera automatiquement vers l'équipement
              if (onPerformanceUpdate) {
                onPerformanceUpdate({ advancedPerformance: performanceData });
                
              }
            }}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              {
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                flex: onRetourClick ? '0 1 auto' : '1'
              }
            )}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Message d'action si pages chargées mais pas analysées */}
      {!isAnalyzing && uploadedImages.length > 0 && extractedTables.length === 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(4))}>
          <Info size={16} />
          <p style={sx.text.sm}>
            Cliquez sur le bouton "🚀 Analyser les documents" pour lancer l'extraction automatique.
          </p>
        </div>
      )}

      {/* Modal de configuration API */}
      {showAPIConfig && (
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
            backgroundColor: 'var(--bg-overlay)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <APIConfiguration onClose={() => {
              setShowAPIConfig(false);
              // Retester l'API après configuration
              setTimeout(() => testAPIConnection(), 1000);
            }} />
          </div>
        </div>
      )}

      {/* Dialog pour sélection de pages PDF */}
      {showPdfPageSelector && (
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
          <div style={{
            backgroundColor: 'var(--bg-overlay)',
            borderRadius: 'var(--radius-sm)',
            padding: '24px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
              <h3 style={sx.text.lg}>
                <FileText size={20} style={{ display: 'inline', marginRight: '8px' }} />
                Sélectionner les pages contenant les tableaux de performances
              </h3>
              <button
                onClick={() => setShowPdfPageSelector(false)}
                style={sx.combine(sx.components.button.icon)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={sx.spacing.mb(3)}>
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                {selectedPdfPages.length > 0 
                  ? `✅ ${selectedPdfPages.length} page(s) détectée(s) automatiquement. Vous pouvez en ajouter d'autres.`
                  : '⚠️ Aucune table détectée automatiquement. Sélectionnez les pages manuellement.'}
              </p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                💡 Recherchez les pages contenant : "TAKEOFF", "LANDING", "DÉCOLLAGE", "ATTERRISSAGE", distances en mètres/pieds
              </p>
            </div>

            {/* Grille de pages */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              {pdfPages.map((page) => {
                const isSelected = selectedPdfPages.includes(page.pageNumber);
                const isAutoDetected = uploadedImages.some(
                  img => img.pageNumber === page.pageNumber && img.autoDetected
                );

                return (
                  <div
                    key={page.pageNumber}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPdfPages(prev => prev.filter(p => p !== page.pageNumber));
                      } else {
                        setSelectedPdfPages(prev => [...prev, page.pageNumber]);
                      }
                    }}
                    style={{
                      border: isSelected ? '3px solid var(--text-secondary)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--bg-overlay)' : 'white',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {isAutoDetected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        AUTO
                      </div>
                    )}
                    
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      color: isSelected ? 'var(--text-secondary)' : 'var(--text-secondary)'
                    }}>
                      Page {page.pageNumber}
                    </div>
                    
                    <div style={{
                      width: '100%',
                      paddingBottom: '141.4%', // A4 ratio
                      position: 'relative',
                      backgroundColor: 'var(--bg-overlay)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden'
                    }}>
                      <img
                        src={`data:image/jpeg;base64,${page.base64}`}
                        alt={`Page ${page.pageNumber}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                    
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text-tertiary)',
                      marginTop: '4px'
                    }}>
                      {page.size} KB
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Boutons d'action */}
            <div style={sx.combine(sx.flex.end, { gap: '12px' })}>
              <button
                onClick={() => setShowPdfPageSelector(false)}
                style={sx.combine(sx.components.button.secondary)}
              >
                Annuler
              </button>
              
              <button
                onClick={() => {
                  // Ajouter les pages sélectionnées non encore ajoutées
                  const newPages = selectedPdfPages.filter(pageNum =>
                    !uploadedImages.some(img => img.pageNumber === pageNum)
                  );

                  const newImages = [];
                  for (const pageNum of newPages) {
                    const page = pdfPages.find(p => p.pageNumber === pageNum);
                    if (page) {
                      newImages.push({
                        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: `${currentPdfFile.name} - Page ${pageNum}`,
                        type: 'pdf-page',
                        originalFile: currentPdfFile,
                        pageNumber: pageNum,
                        base64: page.base64,
                        preview: `data:image/jpeg;base64,${page.base64}`,
                        size: page.size,
                        manuallySelected: true
                      });
                    }
                  }
                  
                  if (newImages.length > 0) {
                    setUploadedImages(prev => [...prev, ...newImages]);
                    console.log(`${newImages.length} page(s) ajoutée(s) manuellement`);
                  }
                  
                  setShowPdfPageSelector(false);
                }}
                style={sx.combine(sx.components.button.primary)}
                disabled={selectedPdfPages.length === 0}
              >
                <CheckCircle size={16} style={{ marginRight: '4px' }} />
                Utiliser {selectedPdfPages.length} page(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedPerformanceAnalyzer;