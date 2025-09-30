// Service unifié pour l'analyse des performances aéronautiques
// Remplace et consolide : performanceTableAnalyzer, advancedPerformanceAnalyzer, openAIIngestionService

import ABACProtocolHandler from './abacProtocolHandler';
import ABACValidationService from './abacValidationService';
import apiKeyManager from '../../../utils/apiKeyManager';

class UnifiedPerformanceService {
  constructor() {
    // Configuration API unifiée - initialisée de manière lazy
    this.apiKey = null;
    this.endpoint = import.meta?.env?.VITE_AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o'; // Modèle avec vision
    
    // Services intégrés - initialisés de manière lazy
    this.protocolHandler = null;
    this.validationService = null;
    
    // Mode de fonctionnement
    this.mode = 'abac'; // 'abac' | 'legacy' | 'manual'
    
    // Flag d'initialisation
    this.initialized = false;
  }
  
  // Initialisation lazy pour éviter les problèmes avec window/localStorage
  initialize() {
    if (this.initialized) return;
    
    // Initialiser le gestionnaire de clés d'abord
    apiKeyManager.initialize();
    
    this.apiKey = this.getAPIKey();
    this.protocolHandler = new ABACProtocolHandler();
    this.validationService = new ABACValidationService();
    this.initialized = true;
    
    console.log('🔧 Service unifié des performances initialisé avec clé:', this.apiKey ? 'Oui' : 'Non');
  }

  // Obtenir la clé API de manière unifiée
  getAPIKey() {
    // S'assurer que le gestionnaire est initialisé
    apiKeyManager.initialize();
    
    // Utiliser le gestionnaire centralisé
    const key = apiKeyManager.getAPIKey();
    
    console.log('🔑 Récupération de la clé API:', key ? `Trouvée (${key.substring(0, 10)}...)` : 'Non trouvée');
    
    return key;
  }

  // Définir/mettre à jour la clé API
  setAPIKey(apiKey) {
    this.initialize();
    const success = apiKeyManager.setAPIKey(apiKey);
    if (success) {
      this.apiKey = apiKey;
    }
    return success;
  }

  // Tester la connexion API
  async testAPIConnection() {
    this.initialize();
    if (!this.apiKey) {
      return {
        success: false,
        message: 'Clé API non configurée',
        mode: this.mode
      };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        })
      });

      return {
        success: response.ok,
        message: response.ok ? 'Connexion OK' : `Erreur ${response.status}`,
        mode: this.mode
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        mode: this.mode
      };
    }
  }

  // ===== MODE ABAC (Protocole structuré) =====
  
  async startABACIngestion(pdfFile) {
    this.initialize();
    this.mode = 'abac';
    
    // Démarrer le protocole ABAC
    const startMessage = await this.protocolHandler.startPhase0();
    
    // Si un PDF est fourni, l'ingérer
    if (pdfFile) {
      const pages = await this.extractPDFPages(pdfFile);
      return await this.ingestPagesABAC(pages, startMessage.data);
    }
    
    return startMessage;
  }

  async processABACMessage(messageType, messageData) {
    this.initialize();
    return await this.protocolHandler.processMessage(messageType, messageData);
  }

  async validateABACData(abacData, testCases) {
    this.initialize();
    return await this.validationService.executeValidationTests(abacData, testCases);
  }

  async interpolateABAC(abacData, inputs) {
    this.initialize();
    return await this.validationService.interpolate(abacData, inputs);
  }

  // ===== MODE LEGACY (Extraction simple) =====
  
  async analyzeLegacyPerformance(imageBase64, options = {}) {
    this.initialize();
    this.mode = 'legacy';
    
    const prompt = `
      Extract performance data from this aircraft manual:
      - Takeoff distances (TOD, TODA 15m, TODA 50ft)
      - Landing distances (LD, LDA 15m, LDA 50ft)
      - Conditions (weight, altitude, temperature)
      Return as structured JSON.
    `;

    return await this.callOpenAI(imageBase64, prompt);
  }

  // ===== MODE MANUEL (Analyse guidée) =====
  
  async analyzeManualPerformance(imageBase64, userPrompt) {
    this.initialize();
    this.mode = 'manual';
    return await this.callOpenAI(imageBase64, userPrompt);
  }

  // ===== MÉTHODES COMMUNES =====

  async callOpenAI(imageBase64, prompt) {
    // S'assurer que le service est initialisé
    this.initialize();
    
    // Réessayer d'obtenir la clé API si elle n'est pas définie
    if (!this.apiKey) {
      this.apiKey = this.getAPIKey();
    }
    
    // Si toujours pas de clé, essayer directement depuis les différentes sources
    if (!this.apiKey) {
      // Essayer directement depuis localStorage
      this.apiKey = localStorage.getItem('alflight_ai_api_key') || 
                    localStorage.getItem('openai_api_key');
      
      // Si toujours pas trouvée, essayer la variable d'environnement
      if (!this.apiKey) {
        try {
          this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        } catch (e) {
          console.warn('Impossible d\'accéder aux variables d\'environnement');
        }
      }
      
      // Ne plus utiliser de clé en dur
    }
    
    if (!this.apiKey) {
      throw new Error('Clé API non configurée. Veuillez configurer votre clé OpenAI dans les paramètres.');
    }

    // S'assurer que l'image base64 a le bon format
    let formattedImage = imageBase64;
    if (imageBase64 && !imageBase64.startsWith('data:')) {
      // Déterminer le type d'image basé sur les premiers caractères
      if (imageBase64.startsWith('/9j/')) {
        formattedImage = `data:image/jpeg;base64,${imageBase64}`;
      } else if (imageBase64.startsWith('iVBOR')) {
        formattedImage = `data:image/png;base64,${imageBase64}`;
      } else {
        // Par défaut, supposer JPEG
        formattedImage = `data:image/jpeg;base64,${imageBase64}`;
      }
      console.log('📸 Image formatée avec le préfixe data URL');
    }

    const messages = [
      {
        role: 'system',
        content: 'You are an expert aviation performance data analyst specializing in extracting data from aircraft manuals.'
      },
      {
        role: 'user',
        content: formattedImage ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: formattedImage, detail: 'high' } }
        ] : prompt
      }
    ];

    console.log('📤 Envoi à OpenAI avec modèle:', this.model);
    console.log('📤 Prompt length:', prompt.length, 'caractères');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Erreur API:', error);
        throw new Error(error.error?.message || `API Error ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Réponse API reçue');
      const content = data.choices[0].message.content;
      console.log('📝 Contenu de la réponse (100 premiers caractères):', content.substring(0, 100));

      // Essayer de parser comme JSON
      try {
        // Nettoyer le contenu si il est entouré de ```json ... ```
        let cleanContent = content;
        if (content.includes('```json')) {
          // Extraire uniquement le JSON entre les backticks
          const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanContent = jsonMatch[1].trim();
            console.log('🧹 JSON extrait du markdown');
          } else {
            // Fallback: enlever simplement les marqueurs
            cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            console.log('🧹 Nettoyage basique du markdown');
          }
        } else if (content.includes('```')) {
          // Gérer le cas où il y a juste ``` sans json
          const codeMatch = content.match(/```\s*([\s\S]*?)```/);
          if (codeMatch && codeMatch[1]) {
            cleanContent = codeMatch[1].trim();
            console.log('🧹 Contenu extrait des backticks simples');
          }
        }

        console.log('🔍 Tentative de parse, premiers 500 caractères:', cleanContent.substring(0, 500));
        console.log('📏 Longueur du contenu nettoyé:', cleanContent.length);

        // Vérifier si le JSON semble complet
        const openBraces = (cleanContent.match(/{/g) || []).length;
        const closeBraces = (cleanContent.match(/}/g) || []).length;
        const openBrackets = (cleanContent.match(/\[/g) || []).length;
        const closeBrackets = (cleanContent.match(/\]/g) || []).length;
        console.log(`🔍 Vérification structure: ${openBraces} { vs ${closeBraces} }, ${openBrackets} [ vs ${closeBrackets} ]`);

        if (openBraces !== closeBraces) {
          console.warn('⚠️ JSON incomplet détecté (accolades), tentative de réparation...');
          // Ajouter les accolades manquantes
          while ((cleanContent.match(/{/g) || []).length > (cleanContent.match(/}/g) || []).length) {
            cleanContent += '}';
          }
        }

        if (openBrackets !== closeBrackets) {
          console.warn('⚠️ JSON incomplet détecté (crochets), tentative de réparation...');
          // Ajouter les crochets manquants
          while ((cleanContent.match(/\[/g) || []).length > (cleanContent.match(/\]/g) || []).length) {
            cleanContent += ']';
          }
        }

        // Vérifier si le JSON se termine brutalement (valeur non terminée)
        const lastChars = cleanContent.trim().slice(-100);

        console.log('🔍 Derniers 100 caractères du JSON:', lastChars);

        // Nouvelle logique de réparation plus robuste pour les cas spécifiques rencontrés
        // Cas 1: Valeur tronquée avec fermetures multiples (ex: "840",}}}]])
        const truncatedValueWithClosures = cleanContent.match(/"[^"]*",?\s*[}\]]{2,}$/);
        if (truncatedValueWithClosures) {
          console.warn('⚠️ Valeur tronquée avec fermetures multiples détectée:', truncatedValueWithClosures[0]);
          // Garder la valeur mais retirer les fermetures excessives
          cleanContent = cleanContent.replace(/([^,])\s*[}\]]{2,}$/, '$1');
          console.log('🔧 Fermetures excessives supprimées');
        }

        // Cas 2: Valeur incomplète qui se termine par des fermetures (ex: "Distance_passage_15m": "}}}]])
        const incompleteValueWithClosures = cleanContent.match(/:\s*"[^"]*[}\]]+\s*$/);
        if (incompleteValueWithClosures) {
          console.warn('⚠️ Valeur incomplète avec fermetures détectée:', incompleteValueWithClosures[0]);
          // Remplacer par une chaîne vide
          cleanContent = cleanContent.replace(/:\s*"[^"]*[}\]]+\s*$/, ': ""');
          console.log('🔧 Valeur incomplète remplacée par chaîne vide');
        }

        // Cas 3: Nom de champ sans valeur suivi de fermetures (ex: "Distance_passage_15m}}}]])
        const fieldNameWithClosures = cleanContent.match(/"[^":,\s]+[}\]]+\s*$/);
        if (fieldNameWithClosures) {
          console.warn('⚠️ Nom de champ sans valeur avec fermetures détecté:', fieldNameWithClosures[0]);
          // Extraire le nom du champ et ajouter une valeur vide
          const fieldName = fieldNameWithClosures[0].match(/"([^"}\]]+)/);
          if (fieldName && fieldName[1]) {
            cleanContent = cleanContent.replace(/"[^":,\s]+[}\]]+\s*$/, `"${fieldName[1]}": ""`);
            console.log('🔧 Champ complété avec valeur vide');
          }
        }

        // Cas 4: Virgule suivie immédiatement de fermetures (ex: ,}}}]])
        const commaWithClosures = cleanContent.match(/,\s*[}\]]{2,}$/);
        if (commaWithClosures) {
          console.warn('⚠️ Virgule avec fermetures multiples détectée');
          cleanContent = cleanContent.replace(/,\s*[}\]]{2,}$/, '');
          console.log('🔧 Virgule et fermetures supprimées');
        }

        // Détecter les autres cas de troncature
        const lastChar = cleanContent.trim().slice(-1);
        console.log('🔍 Dernier caractère:', lastChar);

        // Cas généraux de réparation
        const incompleteLine = cleanContent.match(/:\s*"[^"]*$/);
        const incompleteObject = cleanContent.match(/,\s*{\s*[^}]*$/);
        const incompleteArray = cleanContent.match(/\[\s*"[^"]*$/);
        const incompleteArrayElement = cleanContent.match(/,\s*"[^"]*$/);

        if (incompleteLine || incompleteObject || incompleteArray || incompleteArrayElement || lastChar === '"' || lastChar === ':' || lastChar === ',') {
          console.warn('⚠️ JSON tronqué détecté, tentative de réparation...');
          console.log('📝 État avant réparation - Accolades:', (cleanContent.match(/{/g) || []).length, 'vs', (cleanContent.match(/}/g) || []).length);
          console.log('📝 État avant réparation - Crochets:', (cleanContent.match(/\[/g) || []).length, 'vs', (cleanContent.match(/\]/g) || []).length);

          // Si on a une chaîne non terminée dans un tableau
          if (incompleteArray) {
            console.log('🔧 Élément de tableau incomplet détecté:', incompleteArray[0]);
            cleanContent = cleanContent.replace(/\[\s*"[^"]*$/, '[');
            console.log('🔧 Suppression de l\'élément incomplet du tableau');
          }

          // Si on a un élément de tableau incomplet après une virgule
          else if (incompleteArrayElement) {
            console.log('🔧 Élément de tableau incomplet après virgule:', incompleteArrayElement[0]);
            cleanContent = cleanContent.replace(/,\s*"[^"]*$/, '');
            console.log('🔧 Suppression de l\'élément incomplet');
          }

          // Si on a une chaîne non terminée
          else if (incompleteLine) {
            console.log('🔧 Chaîne non terminée détectée:', incompleteLine[0]);
            cleanContent = cleanContent.replace(/:\s*"[^"]*$/, ': ""');
            console.log('🔧 Ajout d\'une chaîne vide pour terminer la valeur');
          }

          // Si on a un objet incomplet
          else if (incompleteObject) {
            console.log('🔧 Objet incomplet détecté');
            // Fermer l'objet incomplet
            cleanContent = cleanContent.replace(/,\s*{\s*[^}]*$/, '');
            console.log('🔧 Suppression de l\'objet incomplet');
          }

          // Si on a une virgule en fin
          else if (lastChar === ',') {
            cleanContent = cleanContent.slice(0, -1);
            console.log('🔧 Suppression de la virgule finale');
          }
        }

        // Nettoyer les virgules multiples qui pourraient causer des erreurs
        cleanContent = cleanContent.replace(/,\s*,+/g, ',');
        cleanContent = cleanContent.replace(/\[\s*,/g, '[');
        cleanContent = cleanContent.replace(/,\s*\]/g, ']');
        cleanContent = cleanContent.replace(/,\s*}/g, '}');

        // Vérification et ajout des fermetures manquantes
        let needCloseBraces = (cleanContent.match(/{/g) || []).length - (cleanContent.match(/}/g) || []).length;
        let needCloseBrackets = (cleanContent.match(/\[/g) || []).length - (cleanContent.match(/\]/g) || []).length;

        console.log('🔧 Structures à fermer - Accolades:', needCloseBraces, ', Crochets:', needCloseBrackets);

        // Ajouter les fermetures manquantes dans le bon ordre
        if (needCloseBrackets > 0 || needCloseBraces > 0) {
          // D'abord fermer les objets internes, puis les tableaux
          for (let i = 0; i < needCloseBrackets; i++) cleanContent += ']';
          for (let i = 0; i < needCloseBraces; i++) cleanContent += '}';

          console.log('📝 État après ajout fermetures - Accolades:', (cleanContent.match(/{/g) || []).length, 'vs', (cleanContent.match(/}/g) || []).length);
          console.log('📝 État après ajout fermetures - Crochets:', (cleanContent.match(/\[/g) || []).length, 'vs', (cleanContent.match(/\]/g) || []).length);
        }

        // Tentative de réparation du JSON avant parsing
        let fixedContent = cleanContent;

        // Vérifier si le JSON est tronqué
        const trimmed = fixedContent.trim();
        if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
          console.warn('⚠️ JSON potentiellement tronqué, tentative de réparation...');

          // Compter les accolades et crochets ouverts
          const openBraces = (trimmed.match(/{/g) || []).length;
          const closeBraces = (trimmed.match(/}/g) || []).length;
          const openBrackets = (trimmed.match(/\[/g) || []).length;
          const closeBrackets = (trimmed.match(/]/g) || []).length;

          // Ajouter les fermetures manquantes
          for (let i = 0; i < openBrackets - closeBrackets; i++) {
            fixedContent += ']';
          }
          for (let i = 0; i < openBraces - closeBraces; i++) {
            fixedContent += '}';
          }
        }

        const parsed = JSON.parse(fixedContent);
        console.log('✅ JSON parsé avec succès !');
        console.log('📊 Structure parsée:', Object.keys(parsed));
        console.log('📊 Tables trouvées:', parsed.tables?.length || 0);

        if (parsed.tables && parsed.tables.length > 0) {
          console.log('📋 Première table:', parsed.tables[0].table_name);
          console.log('📋 Structure première table:', Object.keys(parsed.tables[0]));
        }

        return parsed;
      } catch (parseError) {
        console.error('❌ Erreur de parsing JSON:', parseError.message);
        console.log('📝 Contenu brut (500 premiers caractères):', content.substring(0, 500));
        console.log('📝 Contenu brut (500 derniers caractères):', content.substring(Math.max(0, content.length - 500)));
        console.log('📏 Longueur totale:', content.length);

        // Position de l'erreur dans le JSON
        const errorPosition = parseError.message.match(/position (\d+)/);
        if (errorPosition) {
          const pos = parseInt(errorPosition[1]);
          console.log('📍 Erreur à la position:', pos);
          console.log('📍 Contexte autour de l\'erreur:', content.substring(Math.max(0, pos - 50), Math.min(content.length, pos + 50)));
        }

        // Essayer de détecter si le contenu ressemble à une structure de tableau
        const looksLikeTable = content.includes('table') || content.includes('headers') ||
                              content.includes('rows') || content.includes('data');

        if (looksLikeTable) {
          console.log('⚠️ Le contenu semble contenir des données de tableau mais n\'est pas du JSON valide');

          // Tentative de récupération partielle du JSON tronqué
          try {
            // Si on a une erreur de position, essayer de tronquer avant
            if (errorPosition) {
              const pos = parseInt(errorPosition[1]);
              console.log('🔧 Tentative de troncature avant l\'erreur à la position', pos);

              // Trouver le dernier objet complet avant la position d'erreur
              let truncatedContent = content.substring(0, pos);

              // Chercher le dernier '},' complet avant l'erreur
              const lastCompleteObject = truncatedContent.lastIndexOf('},');
              if (lastCompleteObject > 0) {
                truncatedContent = truncatedContent.substring(0, lastCompleteObject + 1);

                // Fermer toutes les structures ouvertes
                const openBraces = (truncatedContent.match(/\{/g) || []).length;
                const closeBraces = (truncatedContent.match(/\}/g) || []).length;
                const openBrackets = (truncatedContent.match(/\[/g) || []).length;
                const closeBrackets = (truncatedContent.match(/\]/g) || []).length;

                // Ajouter les fermetures manquantes
                for (let i = 0; i < openBrackets - closeBrackets; i++) truncatedContent += ']';
                for (let i = 0; i < openBraces - closeBraces; i++) truncatedContent += '}';

                try {
                  const partialParsed = JSON.parse(truncatedContent);
                  if (partialParsed.tables && partialParsed.tables[0] && partialParsed.tables[0].data && partialParsed.tables[0].data.length > 0) {
                    console.log(`✅ Récupération réussie: ${partialParsed.tables[0].data.length} entrées`);
                    return partialParsed;
                  }
                } catch (e) {
                  console.log('⚠️ Échec de la récupération par troncature');
                }
              }
            }

            // Chercher le dernier objet complet dans "data"
            const dataArrayMatch = content.match(/"data"\s*:\s*\[([\s\S]*?)(?=\],|\]$|\]\})/);
            if (dataArrayMatch) {
              console.log('🔧 Tentative de récupération des données depuis le JSON partiel');

              const dataContent = dataArrayMatch[1];
              const objects = dataContent.split(/\},\s*\{/);
              const validData = [];

              for (let objStr of objects) {
                // Nettoyer et compléter l'objet
                objStr = objStr.replace(/^\{?/, '{').replace(/\}?$/, '}');

                try {
                  // Vérifier si l'objet semble complet
                  if (objStr.includes('Distance_') || objStr.includes('Masse')) {
                    // Compléter les guillemets manquants si nécessaire
                    objStr = objStr.replace(/:\s*"(\d+)(?!")/, ': "$1"');

                    // Si l'objet est tronqué, fermer proprement
                    const openQuotes = (objStr.match(/"/g) || []).length;
                    if (openQuotes % 2 !== 0) {
                      objStr = objStr.replace(/"[^"]*$/, '""');
                    }

                    // Fermer les accolades manquantes
                    const needCloseBrace = (objStr.match(/\{/g) || []).length - (objStr.match(/\}/g) || []).length;
                    for (let i = 0; i < needCloseBrace; i++) objStr += '}';

                    const parsed = JSON.parse(objStr);
                    validData.push(parsed);
                  }
                } catch (e) {
                  // Ignorer les objets invalides
                }
              }

              if (validData.length > 0) {
                console.log(`✅ ${validData.length} entrées récupérées depuis le JSON partiel`);
                return {
                  tables: [{
                    table_name: content.includes('Take') ? 'Take-Off Distance' : 'Performance Data',
                    table_type: content.includes('takeoff') ? 'takeoff' : 'performance',
                    data: validData,
                    headers: Object.keys(validData[0]),
                    units: {
                      'Distance_roulement': 'm',
                      'Distance_passage_15m': 'm',
                      'Distance_passage_50ft': 'm',
                      'Altitude': 'ft',
                      'Temperature': '°C',
                      'Masse': 'kg'
                    },
                    partial_recovery: true
                  }],
                  raw: content,
                  error: 'Partial recovery from truncated JSON'
                };
              }
            }

            // Si on ne peut pas récupérer les données, créer une structure minimale
            if (content.includes('Table') || content.includes('Landing') || content.includes('Takeoff')) {
              console.log('🔧 Création d\'une structure de fallback minimale');
              return {
                tables: [{
                  table_name: 'Extracted Data (Manual Review Required)',
                  table_type: 'extracted',
                  data: [],
                  raw_content: content.substring(0, 1000),
                  needs_manual_parsing: true
                }],
                raw: content,
                error: 'Parsed as fallback structure - manual review required'
              };
            }
          } catch (e) {
            console.log('❌ Impossible de créer une structure de fallback:', e.message);
          }
        }

        // Retourner le texte brut si ce n'est pas du JSON
        return { raw: content, tables: [], error: 'JSON parse failed: ' + parseError.message };
      }

    } catch (error) {
      console.error('Erreur OpenAI:', error);
      throw error;
    }
  }

  async extractPDFPages(pdfFile) {
    // Utiliser PDF.js pour extraire les pages
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js non chargé');
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const imageBase64 = canvas.toDataURL('image/png');
      pages.push({
        pageNumber: i,
        image: imageBase64
      });
    }

    return pages;
  }

  async ingestPagesABAC(pages, requestOptions) {
    const results = [];
    
    for (const page of pages) {
      const prompt = this.buildABACPrompt(requestOptions, page.pageNumber);
      const extracted = await this.callOpenAI(page.image, prompt);
      
      results.push({
        page: page.pageNumber,
        ...extracted
      });
    }

    return {
      type: 'APP_BATCH_EXTRACT',
      data: { pages: results }
    };
  }

  buildABACPrompt(options, pageNumber) {
    const { need = 'both', detail = 'full' } = options;
    
    let prompt = `Analyze aviation performance page ${pageNumber}.\n`;
    
    if (need === 'tables' || need === 'both') {
      prompt += `Extract tables with structure, headers, units, and data.\n`;
    }
    
    if (need === 'abacs' || need === 'both') {
      prompt += `Extract performance charts/abacs with axes, curves, and digitized points.\n`;
    }
    
    prompt += `Return as JSON in APP_PAGE_EXTRACT format with: page, text_blocks, tables, figures, notes.`;
    
    return prompt;
  }

  // ===== MÉTHODES DE MIGRATION =====

  // Convertir les données legacy vers le format ABAC
  convertLegacyToABAC(legacyData) {
    return {
      id: `converted_${Date.now()}`,
      meta: {
        title: 'Converted Performance Data',
        purpose: this.detectPurposeFromLegacy(legacyData),
        source_pages: 'legacy'
      },
      grid: {
        values: this.extractValuesFromLegacy(legacyData)
      },
      interpolation: {
        method: 'bilinear',
        extrapolation_policy: 'forbid'
      }
    };
  }

  detectPurposeFromLegacy(data) {
    if (data.takeoff || data.tod) return 'distance_ground_roll';
    if (data.landing || data.ld) return 'landing_distance';
    return 'other';
  }

  extractValuesFromLegacy(data) {
    const values = [];
    
    // Convertir les données plates en grille
    if (data.takeoff) {
      values.push({
        pressure_alt_ft: data.conditions?.altitude || 0,
        oat_c: data.conditions?.temperature || 15,
        mass_kg: data.conditions?.weight || 1000,
        value: data.takeoff.tod || data.takeoff.distance || 0
      });
    }
    
    return values;
  }

  // ===== ÉTAT ET CONFIGURATION =====

  getState() {
    this.initialize();
    return {
      mode: this.mode,
      hasAPIKey: !!this.apiKey,
      protocolState: this.protocolHandler.getState(),
      endpoint: this.endpoint,
      model: this.model
    };
  }

  setMode(mode) {
    if (['abac', 'legacy', 'manual'].includes(mode)) {
      this.mode = mode;
      console.log(`🔄 Mode changé : ${mode}`);
      return true;
    }
    return false;
  }

  reset() {
    this.initialize();
    this.protocolHandler.reset();
    this.mode = 'abac';
    console.log('🔄 Service réinitialisé');
  }
}

// Export singleton
const unifiedPerformanceService = new UnifiedPerformanceService();
export default unifiedPerformanceService;