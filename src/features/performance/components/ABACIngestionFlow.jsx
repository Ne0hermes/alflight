import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Brain, CheckCircle, AlertTriangle,
  RefreshCw, Play, Pause, Save, Download, Terminal,
  ChevronRight, Activity, TestTube, Database
} from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import unifiedPerformanceService from '../services/unifiedPerformanceService';

const ABACIngestionFlow = ({ aircraft, onComplete }) => {
  // États principaux
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [abacIndex, setAbacIndex] = useState(null);
  const [selectedAbac, setSelectedAbac] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [compiledModel, setCompiledModel] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [openAIKey, setOpenAIKey] = useState(localStorage.getItem('openai_api_key') || '');
  
  // Références
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Phases du protocole
  const phases = [
    { id: 0, name: 'Inventaire', icon: FileText, color: '#3b82f6' },
    { id: 1, name: 'Extraction', icon: Brain, color: '#8b5cf6' },
    { id: 2, name: 'Validation', icon: TestTube, color: '#f59e0b' },
    { id: 3, name: 'Compilation', icon: Database, color: '#10b981' },
    { id: 4, name: 'Finalisation', icon: Save, color: '#06b6d4' }
  ];

  // Initialisation du service unifié
  useEffect(() => {
    if (openAIKey) {
      unifiedPerformanceService.setAPIKey(openAIKey);
    }
  }, [openAIKey]);

  // Auto-scroll des messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ajouter un message au terminal
  const addMessage = (type, content, data = null) => {
    const message = {
      id: Date.now(),
      type,
      content,
      data,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, message]);
    return message;
  };

  // Traiter un message du protocole
  const processProtocolMessage = async (messageType, messageData) => {
    const response = await unifiedPerformanceService.processABACMessage(messageType, messageData);
    
    if (response) {
      addMessage('output', `<${response.type}>`, response.data);
      
      // Gérer les requêtes spéciales
      if (response.type === 'REQUEST_INGEST') {
        await handleIngestionRequest(response.data);
      } else if (response.type === 'ABAC_INDEX') {
        setAbacIndex(response.data);
        addMessage('info', 'Index ABAC créé', response.data);
      } else if (response.type === 'ABAC_TEST') {
        await runTests(response.data);
      } else if (response.type === 'PERF_MODEL_COMPILED') {
        setCompiledModel(response.data);
        setCurrentPhase(3);
      } else if (response.type === 'PERF_MODEL_SAVE_OK') {
        await saveModel(response.data);
        setCurrentPhase(4);
      }
    }
  };

  // Gérer une requête d'ingestion
  const handleIngestionRequest = async (request) => {
    const state = unifiedPerformanceService.getState();
    if (!state.hasAPIKey) {
      addMessage('error', 'Service OpenAI non initialisé');
      return;
    }

    try {
      addMessage('info', 'Ingestion en cours...', request);
      
      // Simuler l'ingestion (remplacer par l'appel réel à OpenAI)
      const mockData = generateMockIngestionData(request);
      
      // Envoyer les données ingérées au protocole
      await processProtocolMessage('APP_BATCH_EXTRACT', mockData);
      
    } catch (error) {
      addMessage('error', `Erreur ingestion: ${error.message}`);
    }
  };

  // Générer des données mock pour test (à remplacer par OpenAI réel)
  const generateMockIngestionData = (request) => {
    return {
      pages: [
        {
          page: 1,
          text_blocks: [],
          tables: [],
          figures: [
            {
              id: 'fig_p1_idx1',
              caption: 'Takeoff Distance vs Altitude and Temperature',
              type: 'abac',
              axes: {
                x: { label: 'Pressure Altitude', unit: 'ft', min: 0, max: 8000 },
                y: { label: 'Distance', unit: 'm', min: 200, max: 800 },
                z_or_series: [
                  { label: 'Mass', value: '1000 kg' },
                  { label: 'Mass', value: '1200 kg' }
                ]
              },
              digitized_points: [
                { series: '1000kg', x: 0, y: 250 },
                { series: '1000kg', x: 2000, y: 320 },
                { series: '1000kg', x: 4000, y: 410 },
                { series: '1200kg', x: 0, y: 300 },
                { series: '1200kg', x: 2000, y: 380 },
                { series: '1200kg', x: 4000, y: 490 }
              ]
            }
          ],
          notes: []
        }
      ]
    };
  };

  // Exécuter les tests de validation
  const runTests = async (testData) => {
    addMessage('info', 'Exécution des tests...', testData);
    
    // Simuler l'exécution des tests
    const results = {
      id: testData.id,
      status: Math.random() > 0.3 ? 'pass' : 'fail',
      details: testData.cases.map(testCase => ({
        case: testCase.name,
        ok: Math.random() > 0.2,
        pred: testCase.expected + (Math.random() - 0.5) * 10,
        exp: testCase.expected,
        abs_err: Math.random() * 20,
        pct_err: Math.random() * 5
      }))
    };
    
    setTestResults(prev => [...prev, results]);
    await processProtocolMessage('APP_TEST_RESULT', results);
  };

  // Sauvegarder le modèle compilé
  const saveModel = async (saveData) => {
    try {
      const modelJson = JSON.stringify(compiledModel, null, 2);
      const blob = new Blob([modelJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = saveData.file || 'perf-model.json';
      a.click();
      URL.revokeObjectURL(url);
      
      addMessage('success', 'Modèle sauvegardé', saveData);
      
      if (onComplete) {
        onComplete(compiledModel);
      }
    } catch (error) {
      addMessage('error', `Erreur sauvegarde: ${error.message}`);
    }
  };

  // Démarrer le processus
  const startProcess = async () => {
    if (!pdfFile && !aircraft?.advancedPerformance) {
      addMessage('error', 'Aucun fichier PDF ou données de performance disponibles');
      return;
    }

    setIsProcessing(true);
    setCurrentPhase(0);
    unifiedPerformanceService.reset();
    unifiedPerformanceService.setMode('abac');
    
    try {
      // Démarrer l'ingestion ABAC
      if (pdfFile) {
        const result = await unifiedPerformanceService.startABACIngestion(pdfFile);
        await processProtocolMessage(result.type, result.data);
      } else {
        const startMessage = await unifiedPerformanceService.startABACIngestion(null);
        await processProtocolMessage('REQUEST_INGEST', startMessage.data);
      }
    } catch (error) {
      addMessage('error', `Erreur démarrage: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sélectionner un ABAC
  const selectAbac = async (abacId) => {
    setSelectedAbac(abacId);
    setCurrentPhase(1);
    await processProtocolMessage('APP_SELECT_ABAC', { id: abacId });
  };

  // Passer à la compilation
  const proceedToCompilation = async () => {
    setCurrentPhase(3);
    await processProtocolMessage('APP_COMPILE', {});
  };

  // Finaliser le processus
  const finalizeProcess = async () => {
    setCurrentPhase(4);
    await processProtocolMessage('APP_FINALIZE', { status: 'pass' });
  };

  // Composant pour afficher un message
  const MessageDisplay = ({ message }) => {
    const getIcon = () => {
      switch (message.type) {
        case 'input': return '→';
        case 'output': return '←';
        case 'info': return 'ℹ';
        case 'error': return '✗';
        case 'success': return '✓';
        default: return '•';
      }
    };

    const getColor = () => {
      switch (message.type) {
        case 'input': return '#3b82f6';
        case 'output': return '#8b5cf6';
        case 'info': return '#6b7280';
        case 'error': return '#ef4444';
        case 'success': return '#10b981';
        default: return '#9ca3af';
      }
    };

    return (
      <div style={{
        fontFamily: 'monospace',
        fontSize: '12px',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'flex-start'
      }}>
        <span style={{ color: getColor(), marginRight: '8px', fontWeight: 'bold' }}>
          {getIcon()}
        </span>
        <div style={{ flex: 1 }}>
          <span style={{ color: '#9ca3af', marginRight: '8px' }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <span style={{ color: message.type === 'error' ? '#ef4444' : '#e5e7eb' }}>
            {message.content}
          </span>
          {message.data && (
            <details style={{ marginTop: '4px', marginLeft: '16px' }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                Data
              </summary>
              <pre style={{
                fontSize: '10px',
                color: '#9ca3af',
                marginTop: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {JSON.stringify(message.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={sx.spacing.p(6)}>
      {/* En-tête */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(4))}>
          <Brain size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          Ingestion ABAC des Performances
        </h2>

        {/* Configuration OpenAI */}
        {!openAIKey && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
            <AlertTriangle size={16} />
            <div>
              <input
                type="password"
                placeholder="Entrez votre clé API OpenAI"
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                style={sx.combine(sx.components.input.base, { width: '100%' })}
              />
            </div>
          </div>
        )}

        {/* Upload PDF */}
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <div style={sx.flex.start}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              <Upload size={16} style={{ marginRight: '4px' }} />
              {pdfFile ? pdfFile.name : 'Charger PDF'}
            </button>
          </div>

          <button
            onClick={startProcess}
            disabled={isProcessing || (!pdfFile && !aircraft?.advancedPerformance)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              (isProcessing || (!pdfFile && !aircraft?.advancedPerformance)) && {
                opacity: 0.5,
                cursor: 'not-allowed'
              }
            )}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} style={{ marginRight: '4px', animation: 'spin 1s linear infinite' }} />
                Traitement...
              </>
            ) : (
              <>
                <Play size={16} style={{ marginRight: '4px' }} />
                Démarrer
              </>
            )}
          </button>
        </div>

        {/* Indicateur de phases */}
        <div style={sx.combine(sx.flex.between, sx.spacing.p(3), sx.bg.gray, { borderRadius: '6px' })}>
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            const isActive = currentPhase === phase.id;
            const isCompleted = currentPhase > phase.id;
            
            return (
              <div
                key={phase.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: isActive || isCompleted ? 1 : 0.5
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? phase.color : isCompleted ? '#10b981' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '8px'
                }}>
                  {isCompleted ? (
                    <CheckCircle size={16} style={{ color: 'white' }} />
                  ) : (
                    <Icon size={16} style={{ color: isActive ? 'white' : '#6b7280' }} />
                  )}
                </div>
                <span style={sx.combine(
                  sx.text.sm,
                  isActive && sx.text.bold
                )}>
                  {phase.name}
                </span>
                {index < phases.length - 1 && (
                  <ChevronRight size={16} style={{ margin: '0 8px', color: '#9ca3af' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contenu principal en deux colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Colonne gauche: Terminal de messages */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
          <h3 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
            <Terminal size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Flux de protocole
          </h3>
          
          <div style={{
            backgroundColor: '#111827',
            borderRadius: '6px',
            padding: '12px',
            height: '400px',
            overflowY: 'auto',
            border: '1px solid #374151'
          }}>
            {messages.map(msg => (
              <MessageDisplay key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Actions rapides */}
          <div style={sx.combine(sx.flex.between, sx.spacing.mt(3))}>
            <button
              onClick={() => setMessages([])}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary, sx.text.xs)}
            >
              Effacer
            </button>
            <button
              onClick={() => {
                const log = messages.map(m => 
                  `[${new Date(m.timestamp).toISOString()}] ${m.type}: ${m.content}`
                ).join('\n');
                const blob = new Blob([log], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'protocol-log.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={sx.combine(sx.components.button.base, sx.components.button.secondary, sx.text.xs)}
            >
              <Download size={14} style={{ marginRight: '4px' }} />
              Exporter log
            </button>
          </div>
        </div>

        {/* Colonne droite: Contenu dynamique selon la phase */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
          {/* Phase 0: Index des ABACs */}
          {currentPhase === 0 && abacIndex && (
            <div>
              <h3 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
                <FileText size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Index des ABACs ({abacIndex.abacs?.length || 0})
              </h3>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {abacIndex.abacs?.map(abac => (
                  <div
                    key={abac.id}
                    style={sx.combine(
                      sx.spacing.p(3),
                      sx.spacing.mb(2),
                      sx.bg.gray,
                      { 
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        ':hover': { backgroundColor: '#e5e7eb' }
                      }
                    )}
                    onClick={() => selectAbac(abac.id)}
                  >
                    <h4 style={sx.combine(sx.text.sm, sx.text.bold)}>
                      {abac.title}
                    </h4>
                    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      Type: {abac.purpose} | Pages: {abac.pages || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>

              {abacIndex.abacs?.length > 0 && (
                <button
                  onClick={proceedToCompilation}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.primary,
                    sx.spacing.mt(3),
                    { width: '100%' }
                  )}
                >
                  Passer à la compilation
                </button>
              )}
            </div>
          )}

          {/* Phase 1-2: Tests de validation */}
          {(currentPhase === 1 || currentPhase === 2) && testResults.length > 0 && (
            <div>
              <h3 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
                <TestTube size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Résultats des tests
              </h3>
              
              {testResults.map((result, idx) => (
                <div key={idx} style={sx.combine(sx.spacing.mb(3), sx.spacing.p(3), sx.bg.gray, { borderRadius: '6px' })}>
                  <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                    <span style={sx.text.sm}>{result.id}</span>
                    <span style={sx.combine(
                      sx.text.xs,
                      sx.spacing.px(2),
                      sx.spacing.py(1),
                      {
                        backgroundColor: result.status === 'pass' ? '#10b981' : '#ef4444',
                        color: 'white',
                        borderRadius: '4px'
                      }
                    )}>
                      {result.status}
                    </span>
                  </div>
                  
                  {result.details?.slice(0, 3).map((detail, detailIdx) => (
                    <div key={detailIdx} style={sx.combine(sx.text.xs, sx.spacing.mb(1))}>
                      <span style={{ color: detail.ok ? '#10b981' : '#ef4444' }}>
                        {detail.ok ? '✓' : '✗'}
                      </span>
                      {' '}{detail.case}: {detail.pred.toFixed(1)} (±{detail.pct_err.toFixed(1)}%)
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Phase 3: Modèle compilé */}
          {currentPhase === 3 && compiledModel && (
            <div>
              <h3 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
                <Database size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                Modèle compilé
              </h3>
              
              <div style={sx.combine(sx.spacing.p(3), sx.bg.gray, { borderRadius: '6px' })}>
                <p style={sx.combine(sx.text.sm, sx.spacing.mb(2))}>
                  <strong>ABACs inclus:</strong> {compiledModel.abacs_included?.length || 0}
                </p>
                <p style={sx.combine(sx.text.sm, sx.spacing.mb(2))}>
                  <strong>Fonctions disponibles:</strong>
                </p>
                <ul style={{ marginLeft: '20px' }}>
                  {Object.keys(compiledModel.functions || {}).map(fn => (
                    <li key={fn} style={sx.text.xs}>
                      {fn} ({compiledModel.functions[fn].unit})
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={finalizeProcess}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.primary,
                  sx.spacing.mt(3),
                  { width: '100%' }
                )}
              >
                <Save size={16} style={{ marginRight: '4px' }} />
                Sauvegarder le modèle
              </button>
            </div>
          )}

          {/* Phase 4: Finalisation */}
          {currentPhase === 4 && (
            <div style={sx.text.center}>
              <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
              <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
                Processus terminé
              </h3>
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Le modèle de performances a été généré et sauvegardé avec succès.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ABACIngestionFlow;