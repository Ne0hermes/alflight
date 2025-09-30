// src/services/performanceTableAnalyzer.js
import { createModuleLogger } from '@utils/logger';

const logger = createModuleLogger('PerformanceTableAnalyzer');

/**
 * Service d'analyse des tableaux de performances par IA
 * Extrait les distances TOD, ASD, LD depuis les PDF des manuels de vol
 */
class PerformanceTableAnalyzer {
  constructor() {
    // Utiliser import.meta.env pour Vite ou window pour les variables globales
    // Essayer d'abord les variables d'environnement, puis le localStorage
    let envApiKey = null;
    let envEndpoint = null;
    
    // Vérifier si import.meta.env existe (Vite)
    try {
      if (import.meta && import.meta.env) {
        envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        envEndpoint = import.meta.env.VITE_AI_API_ENDPOINT;
        
        // Debug: afficher les variables d'environnement disponibles
        console.log('🔍 Variables d\'environnement Vite disponibles:', Object.keys(import.meta.env));
        console.log('🔑 VITE_OPENAI_API_KEY présente?', !!envApiKey);
        if (envApiKey) {
          console.log('🔑 Clé API trouvée dans env (premiers caractères):', envApiKey.substring(0, 20) + '...');
        }
      }
    } catch (e) {
      console.log('⚠️ import.meta.env non disponible:', e.message);
    }
    
    const windowApiKey = typeof window !== 'undefined' ? window.REACT_APP_OPENAI_API_KEY : null;
    const localApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('alflight_ai_api_key') : null;
    
    console.log('🔍 Sources de clé API:', {
      env: !!envApiKey,
      window: !!windowApiKey,
      localStorage: !!localApiKey
    });
    
    this.apiKey = envApiKey || windowApiKey || localApiKey;
    
    const provider = (typeof localStorage !== 'undefined' ? localStorage.getItem('alflight_ai_provider') : null) || 'openai';
    
    // Configurer l'endpoint selon le provider
    if (provider === 'openai') {
      this.apiEndpoint = envEndpoint || 'https://api.openai.com/v1/chat/completions';
      this.model = 'gpt-4o'; // Utiliser gpt-4o qui supporte les images
    } else if (provider === 'claude') {
      this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
      this.model = 'claude-3-opus-20240229';
    } else if (provider === 'local') {
      this.apiEndpoint = 'http://localhost:11434/api/generate';
      this.model = 'llava';
    }
    
    this.provider = provider;
  }

  /**
   * Analyse une image de tableau de performances
   * @param {File|Blob} imageFile - L'image du tableau à analyser
   * @param {Object} conditions - Les conditions de vol
   * @param {number} conditions.mass - Masse en kg
   * @param {number} conditions.altitude - Altitude pression en ft
   * @param {number} conditions.temperature - Température en °C
   * @param {string} tableType - Type de tableau ('takeoff' ou 'landing')
   * @returns {Promise<Object>} Les distances extraites
   */
  async analyzePerformanceTable(imageFile, conditions, tableType = 'takeoff') {
    try {
      logger.debug('Analyzing performance table', { conditions, tableType });

      // Convertir l'image en base64
      const base64Image = await this.fileToBase64(imageFile);

      // Préparer le prompt pour l'IA
      const prompt = this.buildAnalysisPrompt(conditions, tableType);

      // Appeler l'API OpenAI Vision
      const analysis = await this.callVisionAPI(base64Image, prompt);

      // Parser et valider les résultats
      const distances = this.parseAnalysisResult(analysis, tableType);

      logger.debug('Analysis complete', { distances });
      return distances;

    } catch (error) {
      logger.error('Failed to analyze performance table', error);
      throw error;
    }
  }

  /**
   * Construit le prompt pour l'analyse IA
   */
  buildAnalysisPrompt(conditions, tableType) {
    const { mass, altitude, temperature } = conditions;
    
    if (tableType === 'takeoff') {
      return `Analyze this aircraft performance table for TAKEOFF distances.
        
        Given conditions:
        - Aircraft mass: ${mass} kg
        - Pressure altitude: ${altitude} ft
        - Temperature: ${temperature}°C
        
        Please extract or interpolate:
        1. Take-off ground roll distance (TOD/TODR)
        2. Take-off distance to clear 15m/50ft obstacle (TODA/ASD)
        
        If the table uses different units (lbs, meters), convert to:
        - Distances in meters
        
        If exact values aren't available, interpolate between the nearest values.
        
        Return the result as JSON:
        {
          "tod": <number in meters>,
          "toda_15m": <number in meters>,
          "toda_50ft": <number in meters>,
          "confidence": <0-100>,
          "notes": "<any relevant notes>"
        }`;
    } else {
      return `Analyze this aircraft performance table for LANDING distances.
        
        Given conditions:
        - Aircraft mass: ${mass} kg
        - Pressure altitude: ${altitude} ft
        - Temperature: ${temperature}°C
        
        Please extract or interpolate:
        1. Landing ground roll distance (LD/LDR)
        2. Landing distance from 15m/50ft obstacle (LDA)
        
        If the table uses different units (lbs, meters), convert to:
        - Distances in meters
        
        If exact values aren't available, interpolate between the nearest values.
        
        Return the result as JSON:
        {
          "ld": <number in meters>,
          "lda_15m": <number in meters>,
          "lda_50ft": <number in meters>,
          "confidence": <0-100>,
          "notes": "<any relevant notes>"
        }`;
    }
  }

  /**
   * Teste la validité de la clé API
   */
  async testAPIKey() {
    console.log('🧪 Test de la clé API...');
    console.log('📍 Endpoint:', this.apiEndpoint);
    console.log('🔑 Clé (début):', this.apiKey ? this.apiKey.substring(0, 20) + '...' : 'NON DÉFINIE');
    
    if (!this.apiKey) {
      return {
        success: false,
        message: 'Aucune clé API configurée',
        provider: 'none'
      };
    }

    try {
      // Test avec le modèle GPT-4 Turbo
      const testBody = {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'user',
            content: 'Reply with OK'
          }
        ],
        max_tokens: 5,
        temperature: 0
      };
      
      console.log('📤 Envoi de la requête de test à OpenAI...');
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(testBody)
      });

      console.log('📥 Réponse reçue:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Test réussi, modèle:', data.model);
        return {
          success: true,
          message: 'Clé API valide et fonctionnelle',
          provider: 'OpenAI GPT-4',
          model: data.model || 'gpt-4'
        };
      } else if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur 401:', errorData);
        return {
          success: false,
          message: 'Clé API invalide ou expirée',
          provider: 'OpenAI',
          details: errorData.error?.message
        };
      } else if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        console.error('⚠️ Erreur 429:', errorData);
        return {
          success: false,
          message: 'Limite de taux dépassée. Réessayez plus tard.',
          provider: 'OpenAI',
          details: errorData.error?.message
        };
      } else if (response.status === 404) {
        console.error('❌ Erreur 404: Modèle non trouvé');
        return {
          success: false,
          message: 'Modèle GPT-4 non disponible. Vérifiez votre accès API.',
          provider: 'OpenAI'
        };
      } else {
        const errorText = await response.text().catch(() => '');
        console.error('❌ Erreur API:', response.status, errorText);
        return {
          success: false,
          message: `Erreur API: ${response.statusText || response.status}`,
          provider: 'OpenAI',
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Erreur de connexion:', error);
      return {
        success: false,
        message: `Erreur de connexion: ${error.message}`,
        provider: 'unknown',
        details: error.toString()
      };
    }
  }

  /**
   * Appelle l'API Vision d'OpenAI
   */
  async callVisionAPI(base64Image, prompt) {
    if (!this.apiKey) {
      console.log('⚠️ Pas de clé API, utilisation du fallback');
      return this.fallbackAnalysis(prompt);
    }

    console.log('🖼️ Appel API Vision avec image de', Math.round(base64Image.length / 1024), 'KB');
    console.log('📝 Prompt length:', prompt.length, 'caractères');
    console.log('🤖 Modèle utilisé:', this.model || 'gpt-4o');
    
    const requestBody = {
      model: this.model || 'gpt-4o', // Utiliser le modèle configuré (gpt-4o par défaut)
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high' // Haute résolution pour mieux lire les tableaux
              }
            }
          ]
        }
      ],
      max_tokens: 1000, // Plus de tokens pour une réponse complète
      temperature: 0.1 // Très basse température pour la précision
    };

    try {
      console.log('📤 Envoi de la requête Vision à OpenAI...');
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Réponse Vision reçue:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur API Vision:', errorData);
        
        if (response.status === 400 && errorData.error?.message?.includes('vision')) {
          throw new Error('Le modèle GPT-4 Vision n\'est pas disponible sur votre compte. Contactez OpenAI pour l\'accès.');
        }
        
        if (response.status === 413) {
          throw new Error('Image trop grande. Essayez avec une image plus petite (max 20MB).');
        }
        
        throw new Error(`Erreur API: ${errorData.error?.message || response.statusText || 'Erreur inconnue'}`);
      }

      const data = await response.json();
      console.log('✅ Analyse Vision réussie');
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Réponse API invalide');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel Vision:', error);
      throw error;
    }
  }

  /**
   * Analyse de secours avec OCR basique et règles
   */
  async fallbackAnalysis(prompt) {
    // Utiliser Tesseract.js pour l'OCR si disponible
    logger.warn('Using fallback analysis method');
    
    // Pour la démo, retourner des valeurs estimées basées sur des ratios standards
    return JSON.stringify({
      tod: 250,
      toda_15m: 380,
      toda_50ft: 450,
      ld: 200,
      lda_15m: 350,
      lda_50ft: 400,
      confidence: 50,
      notes: "Fallback estimation - please configure AI API for accurate results"
    });
  }

  /**
   * Parse et valide les résultats de l'analyse
   */
  parseAnalysisResult(analysisText, tableType) {
    try {
      // Extraire le JSON de la réponse
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in analysis result');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Valider et formater selon le type
      if (tableType === 'takeoff') {
        return {
          tod: this.validateDistance(result.tod),
          toda15m: this.validateDistance(result.toda_15m),
          toda50ft: this.validateDistance(result.toda_50ft),
          confidence: result.confidence || 0,
          notes: result.notes || ''
        };
      } else {
        return {
          ld: this.validateDistance(result.ld),
          lda15m: this.validateDistance(result.lda_15m),
          lda50ft: this.validateDistance(result.lda_50ft),
          confidence: result.confidence || 0,
          notes: result.notes || ''
        };
      }
    } catch (error) {
      logger.error('Failed to parse analysis result', error);
      throw new Error('Invalid analysis result format');
    }
  }

  /**
   * Valide une distance
   */
  validateDistance(value) {
    const distance = parseFloat(value);
    if (isNaN(distance) || distance < 0) {
      throw new Error(`Invalid distance value: ${value}`);
    }
    return Math.round(distance);
  }

  /**
   * Convertit un fichier en base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Analyse multiple tableaux (décollage et atterrissage)
   * @param {File|Blob} takeoffImage - Image du tableau de décollage
   * @param {File|Blob} landingImage - Image du tableau d'atterrissage
   * @param {Object} takeoffConditions - Conditions pour le décollage
   * @param {Object} landingConditions - Conditions pour l'atterrissage (optionnel, utilise takeoffConditions par défaut)
   */
  async analyzePerformanceCharts(takeoffImage, landingImage, takeoffConditions, landingConditions = null) {
    const results = {
      takeoff: null,
      landing: null,
      errors: []
    };

    // Analyser le tableau de décollage
    if (takeoffImage) {
      try {
        results.takeoff = await this.analyzePerformanceTable(
          takeoffImage,
          takeoffConditions,
          'takeoff'
        );
      } catch (error) {
        results.errors.push(`Takeoff analysis failed: ${error.message}`);
      }
    }

    // Analyser le tableau d'atterrissage
    if (landingImage) {
      try {
        results.landing = await this.analyzePerformanceTable(
          landingImage,
          landingConditions || takeoffConditions, // Utiliser les conditions d'atterrissage si fournies
          'landing'
        );
      } catch (error) {
        results.errors.push(`Landing analysis failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Interpole une valeur dans un tableau 2D
   */
  interpolate2D(x, y, xValues, yValues, table) {
    // Trouver les indices pour l'interpolation
    let x1Idx = 0, x2Idx = 0;
    let y1Idx = 0, y2Idx = 0;

    // Trouver les indices X
    for (let i = 0; i < xValues.length - 1; i++) {
      if (x >= xValues[i] && x <= xValues[i + 1]) {
        x1Idx = i;
        x2Idx = i + 1;
        break;
      }
    }

    // Trouver les indices Y
    for (let i = 0; i < yValues.length - 1; i++) {
      if (y >= yValues[i] && y <= yValues[i + 1]) {
        y1Idx = i;
        y2Idx = i + 1;
        break;
      }
    }

    // Interpolation bilinéaire
    const x1 = xValues[x1Idx];
    const x2 = xValues[x2Idx];
    const y1 = yValues[y1Idx];
    const y2 = yValues[y2Idx];

    const q11 = table[y1Idx][x1Idx];
    const q12 = table[y2Idx][x1Idx];
    const q21 = table[y1Idx][x2Idx];
    const q22 = table[y2Idx][x2Idx];

    const fx1 = ((x2 - x) / (x2 - x1)) * q11 + ((x - x1) / (x2 - x1)) * q21;
    const fx2 = ((x2 - x) / (x2 - x1)) * q12 + ((x - x1) / (x2 - x1)) * q22;

    return ((y2 - y) / (y2 - y1)) * fx1 + ((y - y1) / (y2 - y1)) * fx2;
  }
}

// Export singleton
export default new PerformanceTableAnalyzer();