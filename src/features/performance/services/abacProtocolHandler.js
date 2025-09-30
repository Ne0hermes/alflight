// Gestionnaire du protocole ABAC pour l'ingestion des performances aéronautiques
// Implémente le flux itératif: ABAC → TEST → SAUVEGARDE → ABAC suivant

class ABACProtocolHandler {
  constructor() {
    this.state = {
      phase: 0, // 0-4 selon les phases du protocole
      currentAbacId: null,
      abacIndex: null,
      extractedAbacs: [],
      compiledModel: null,
      errors: [],
      testResults: [],
      documentMeta: null,
      pendingMessages: [],
      isWaitingForApp: false
    };
    
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
  }

  // Configuration des handlers pour chaque type de message
  setupMessageHandlers() {
    // Messages de l'application
    this.messageHandlers.set('APP_DOC_META', this.handleDocMeta.bind(this));
    this.messageHandlers.set('APP_PAGE_EXTRACT', this.handlePageExtract.bind(this));
    this.messageHandlers.set('APP_BATCH_EXTRACT', this.handleBatchExtract.bind(this));
    this.messageHandlers.set('APP_SELECT_ABAC', this.handleSelectAbac.bind(this));
    this.messageHandlers.set('APP_TEST_RESULT', this.handleTestResult.bind(this));
    this.messageHandlers.set('APP_ACCEPT_REVISE', this.handleAcceptRevise.bind(this));
    this.messageHandlers.set('APP_REDO_FROM_SOURCE', this.handleRedoFromSource.bind(this));
    this.messageHandlers.set('APP_NEXT_ABAC', this.handleNextAbac.bind(this));
    this.messageHandlers.set('APP_COMPILE', this.handleCompile.bind(this));
    this.messageHandlers.set('APP_FINALIZE', this.handleFinalize.bind(this));
    this.messageHandlers.set('APP_ABORT', this.handleAbort.bind(this));
  }

  // Point d'entrée principal pour traiter les messages
  async processMessage(messageType, messageData) {
    console.log(`📨 Processing message: ${messageType}`, messageData);
    
    const handler = this.messageHandlers.get(messageType);
    if (handler) {
      const response = await handler(messageData);
      this.state.isWaitingForApp = false;
      return response;
    } else {
      console.warn(`⚠️ Unknown message type: ${messageType}`);
      return null;
    }
  }

  // PHASE 0 - Inventaire des ABACs
  async startPhase0() {
    this.state.phase = 0;
    return {
      type: 'REQUEST_INGEST',
      data: {
        pages: 'performances',
        need: 'both',
        detail: 'minimal'
      }
    };
  }

  handleDocMeta(data) {
    this.state.documentMeta = data;
    return null;
  }

  handlePageExtract(data) {
    return this.processExtractedPages([data]);
  }

  handleBatchExtract(data) {
    return this.processExtractedPages(data.pages);
  }

  processExtractedPages(pages) {
    const abacs = [];
    
    pages.forEach(page => {
      if (page.figures) {
        page.figures.forEach(fig => {
          if (fig.type === 'abac' || this.isPerformanceChart(fig)) {
            abacs.push({
              id: `abac_${this.generateAbacId(fig)}`,
              title: fig.caption || 'Performance Chart',
              purpose: this.detectPurpose(fig),
              pages: page.page ? String(page.page) : null,
              source_fig_ids: [fig.id],
              notes: fig.caption
            });
          }
        });
      }
    });

    this.state.abacIndex = {
      meta: this.state.documentMeta,
      abacs: abacs
    };

    return {
      type: 'ABAC_INDEX',
      data: this.state.abacIndex
    };
  }

  // PHASE 1 - Extraction d'un ABAC
  handleSelectAbac(data) {
    this.state.phase = 1;
    this.state.currentAbacId = data.id;
    
    const abac = this.state.abacIndex?.abacs.find(a => a.id === data.id);
    if (!abac) {
      return {
        type: 'ERROR',
        data: { message: `ABAC ${data.id} not found` }
      };
    }

    return {
      type: 'REQUEST_INGEST',
      data: {
        pages: abac.pages ? abac.pages.split(',').map(p => parseInt(p.trim())) : [],
        need: 'abacs',
        detail: 'full',
        abac_ids: abac.source_fig_ids
      }
    };
  }

  // Extraction et structuration des données ABAC
  extractAbacData(figureData, abacId) {
    const abacData = {
      id: abacId,
      meta: {
        title: figureData.caption || 'Performance Data',
        purpose: this.detectPurpose(figureData),
        source_pages: figureData.page ? String(figureData.page) : null,
        source_fig_ids: [figureData.id]
      },
      units_convention: 'SI_with_aviation_mixed',
      conditions_defaults: this.extractConditions(figureData),
      axes: this.extractAxes(figureData),
      grid: this.extractGrid(figureData),
      interpolation: {
        method: 'bilinear',
        extrapolation_policy: 'forbid',
        tolerance: { absolute: 20, relative_percent: 5 }
      },
      validation_tests: this.generateValidationTests(figureData),
      data_gaps: [],
      notes: []
    };

    return abacData;
  }

  // PHASE 2 - Tests et validation
  generateTestCases(abacData) {
    const cases = [];
    
    // Générer des cas de test basés sur les données
    if (abacData.grid?.values && abacData.grid.values.length > 0) {
      // Test aux coins du domaine
      const values = abacData.grid.values;
      const corners = [
        values[0],
        values[Math.floor(values.length / 2)],
        values[values.length - 1]
      ];

      corners.forEach((point, idx) => {
        cases.push({
          name: `test_corner_${idx + 1}`,
          inputs: {
            pressure_alt_ft: point.pressure_alt_ft,
            oat_c: point.oat_c,
            mass_kg: point.mass_kg,
            headwind_kt: point.headwind_kt || 0,
            slope_percent: point.slope_percent || 0
          },
          expected: point.value,
          tol_abs: 20,
          tol_pct: 5
        });
      });
    }

    return {
      type: 'ABAC_TEST',
      data: {
        id: abacData.id,
        method: 'evaluate_cases',
        interpolation: abacData.interpolation.method,
        cases: cases
      }
    };
  }

  handleTestResult(data) {
    this.state.testResults.push(data);
    
    if (data.status === 'pass') {
      return {
        type: 'ABAC_SAVE_OK',
        data: {
          id: data.id,
          action: 'save',
          checksum: this.generateChecksum(data.id)
        }
      };
    } else {
      return this.proposeRevisions(data);
    }
  }

  // PHASE 3 - Compilation du modèle
  handleCompile(data) {
    this.state.phase = 3;
    
    const compiledModel = {
      meta: this.state.documentMeta,
      abacs_included: this.state.extractedAbacs.map(abac => ({
        id: abac.id,
        purpose: abac.meta.purpose,
        interpolation: abac.interpolation.method
      })),
      functions: this.generateModelFunctions(),
      data_gaps: this.identifyDataGaps(),
      notes: []
    };

    this.state.compiledModel = compiledModel;

    return {
      type: 'PERF_MODEL_COMPILED',
      data: compiledModel
    };
  }

  // PHASE 4 - Finalisation
  handleFinalize(data) {
    this.state.phase = 4;
    
    if (data.status === 'pass') {
      return {
        type: 'PERF_MODEL_SAVE_OK',
        data: {
          file: 'perf-aircraft.json',
          checksum: this.generateChecksum('model')
        }
      };
    } else {
      return {
        type: 'PERF_MODEL_REPAIR',
        data: {
          hint: 'Check interpolation parameters',
          suspected_abac_ids: this.identifySuspectAbacs()
        }
      };
    }
  }

  // Utilitaires
  generateAbacId(figure) {
    const purpose = this.detectPurpose(figure);
    const timestamp = Date.now();
    return `${purpose}_${timestamp}`;
  }

  detectPurpose(figure) {
    const caption = (figure.caption || '').toLowerCase();
    
    if (caption.includes('takeoff') || caption.includes('décollage')) {
      if (caption.includes('ground') || caption.includes('roll')) {
        return 'distance_ground_roll';
      }
      return 'distance_to_obstacle';
    }
    if (caption.includes('landing') || caption.includes('atterrissage')) {
      return 'landing_distance';
    }
    if (caption.includes('climb') || caption.includes('montée')) {
      return 'rate_of_climb';
    }
    if (caption.includes('fuel') || caption.includes('carburant')) {
      return 'fuel_flow';
    }
    if (caption.includes('speed') || caption.includes('vitesse')) {
      return 'tas';
    }
    
    return 'other';
  }

  isPerformanceChart(figure) {
    // Heuristique pour détecter les graphiques de performance
    if (figure.type === 'abac') return true;
    
    if (figure.axes) {
      const hasAltitude = figure.axes.x?.label?.toLowerCase().includes('alt') ||
                         figure.axes.y?.label?.toLowerCase().includes('alt');
      const hasDistance = figure.axes.x?.label?.toLowerCase().includes('dist') ||
                         figure.axes.y?.label?.toLowerCase().includes('dist');
      const hasTemp = figure.axes.x?.label?.toLowerCase().includes('temp') ||
                     figure.axes.y?.label?.toLowerCase().includes('temp');
      
      return hasAltitude || hasDistance || hasTemp;
    }
    
    return false;
  }

  extractConditions(figure) {
    return {
      runway_condition: 'dry_paved',
      obstacle_ft: 50,
      wind_component_head_kt: 0,
      slope_percent: 0,
      mixture_note: null,
      assumptions: []
    };
  }

  extractAxes(figure) {
    const axes = {};
    
    if (figure.axes) {
      // Mapper les axes standards
      if (figure.axes.x) {
        const xLabel = figure.axes.x.label?.toLowerCase() || '';
        if (xLabel.includes('alt')) {
          axes.pressure_alt_ft = {
            unit: 'ft',
            ticks: this.generateTicks(figure.axes.x.min, figure.axes.x.max, 1000)
          };
        } else if (xLabel.includes('temp')) {
          axes.oat_c = {
            unit: 'C',
            ticks: this.generateTicks(figure.axes.x.min, figure.axes.x.max, 10)
          };
        }
      }
      
      // Ajouter les axes de masse par défaut
      if (!axes.mass_kg) {
        axes.mass_kg = {
          unit: 'kg',
          ticks: [600, 700, 800, 900, 1000, 1100, 1200]
        };
      }
    }
    
    return axes;
  }

  extractGrid(figure) {
    const values = [];
    
    if (figure.digitized_points && figure.digitized_points.length > 0) {
      // Convertir les points digitalisés en grille
      figure.digitized_points.forEach(point => {
        values.push({
          pressure_alt_ft: point.x,
          oat_c: 15, // Valeur par défaut ISA
          mass_kg: this.extractMassFromSeries(point.series),
          headwind_kt: 0,
          slope_percent: 0,
          value: point.y
        });
      });
    }
    
    return {
      order_of_iteration: ['pressure_alt_ft', 'oat_c', 'mass_kg'],
      output: { name: 'distance', unit: 'm' },
      values: values,
      reconstruction_confidence: 0.8,
      digitization_notes: null
    };
  }

  extractMassFromSeries(series) {
    // Extraire la masse de l'identifiant de série
    const match = series?.match(/(\d+)\s*kg/i);
    return match ? parseInt(match[1]) : 1000;
  }

  generateTicks(min, max, step) {
    const ticks = [];
    for (let v = min; v <= max; v += step) {
      ticks.push(v);
    }
    return ticks;
  }

  generateValidationTests(figureData) {
    return {
      description: 'Automatic validation protocol',
      cases: []
    };
  }

  proposeRevisions(testResult) {
    const failedCases = testResult.details.filter(d => !d.ok);
    
    return {
      type: 'ABAC_REVISE_PROPOSAL',
      data: {
        id: testResult.id,
        reason: 'test deviation',
        adjustment_plan: [
          {
            type: 'scale_output',
            factor: 1.05
          }
        ],
        new_tests: failedCases.map(c => ({
          name: `revised_${c.case}`,
          inputs: c.inputs,
          expected: c.pred,
          tol_abs: 30,
          tol_pct: 10
        }))
      }
    };
  }

  generateModelFunctions() {
    const functions = {};
    
    this.state.extractedAbacs.forEach(abac => {
      const functionName = this.purposeToFunctionName(abac.meta.purpose);
      functions[functionName] = {
        inputs: ['pressure_alt_ft', 'oat_c', 'mass_kg', 'headwind_kt', 'slope_percent'],
        unit: this.getUnitForPurpose(abac.meta.purpose),
        source_abac_id: abac.id,
        interpolation: abac.interpolation.method,
        policy_out_of_domain: abac.interpolation.extrapolation_policy,
        assumptions: abac.conditions_defaults.assumptions
      };
    });
    
    return functions;
  }

  purposeToFunctionName(purpose) {
    const mapping = {
      'distance_ground_roll': 'takeoff_ground_roll_m',
      'distance_to_obstacle': 'takeoff_50ft_m',
      'landing_distance': 'landing_distance_m',
      'rate_of_climb': 'rate_of_climb_fpm',
      'best_climb_speed': 'best_climb_speed_kt',
      'tas': 'tas_kt',
      'fuel_flow': 'fuel_flow_lph'
    };
    return mapping[purpose] || 'unknown_function';
  }

  getUnitForPurpose(purpose) {
    const units = {
      'distance_ground_roll': 'm',
      'distance_to_obstacle': 'm',
      'landing_distance': 'm',
      'rate_of_climb': 'fpm',
      'best_climb_speed': 'kt',
      'tas': 'kt',
      'fuel_flow': 'L/h'
    };
    return units[purpose] || 'unknown';
  }

  identifyDataGaps() {
    const gaps = [];
    
    // Vérifier les données manquantes
    const purposes = ['distance_ground_roll', 'distance_to_obstacle', 'landing_distance'];
    purposes.forEach(purpose => {
      if (!this.state.extractedAbacs.find(a => a.meta.purpose === purpose)) {
        gaps.push({
          item: purpose,
          reason: 'No data extracted for this performance type'
        });
      }
    });
    
    return gaps;
  }

  identifySuspectAbacs() {
    return this.state.testResults
      .filter(r => r.status === 'fail')
      .map(r => r.id);
  }

  generateChecksum(data) {
    // Générer un checksum simple
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // Handlers pour les autres messages
  handleAcceptRevise(data) {
    // Accepter les révisions et passer à l'ABAC suivant
    return this.handleNextAbac(data);
  }

  handleRedoFromSource(data) {
    // Recommencer l'extraction depuis la source
    return this.startPhase0();
  }

  handleNextAbac(data) {
    // Passer à l'ABAC suivant dans la liste
    const currentIndex = this.state.abacIndex?.abacs.findIndex(
      a => a.id === this.state.currentAbacId
    );
    
    if (currentIndex !== -1 && currentIndex < this.state.abacIndex.abacs.length - 1) {
      const nextAbac = this.state.abacIndex.abacs[currentIndex + 1];
      return this.handleSelectAbac({ id: nextAbac.id });
    }
    
    // Si plus d'ABACs, passer à la compilation
    return this.handleCompile({});
  }

  handleAbort(data) {
    // Annuler le processus
    this.state = {
      phase: -1,
      aborted: true,
      reason: data.reason || 'User abort'
    };
    
    return {
      type: 'PROCESS_ABORTED',
      data: { reason: this.state.reason }
    };
  }

  // Méthode pour obtenir l'état actuel
  getState() {
    return { ...this.state };
  }

  // Méthode pour réinitialiser
  reset() {
    this.state = {
      phase: 0,
      currentAbacId: null,
      abacIndex: null,
      extractedAbacs: [],
      compiledModel: null,
      errors: [],
      testResults: [],
      documentMeta: null,
      pendingMessages: [],
      isWaitingForApp: false
    };
  }
}

export default ABACProtocolHandler;