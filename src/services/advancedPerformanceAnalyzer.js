// src/services/advancedPerformanceAnalyzer.js

/**
 * Service d'analyse avancée des performances aéronautiques
 * Utilise l'IA pour extraire et structurer les données de manuels de vol
 */

class AdvancedPerformanceAnalyzer {
  constructor() {
    // Utiliser la même méthode que l'ancien service
    let envApiKey = null;
    
    // Vérifier si import.meta.env existe (Vite)
    try {
      if (import.meta && import.meta.env) {
        envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        
        if (envApiKey) {
          :', envApiKey.substring(0, 20) + '...');
        }
      }
    } catch (e) {
      
    }
    
    // Priorité: localStorage (même clé que l'ancien système) puis variables d'environnement
    this.apiKey = (typeof localStorage !== 'undefined' ? localStorage.getItem('alflight_ai_api_key') : null) || envApiKey;
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o'; // Modèle avec vision pour l'analyse d'images
    this.maxRetries = 3;
    
    
  }

  /**
   * Test de la connexion API
   */
  async testAPIKey() {
    
    
    if (!this.apiKey) {
      return {
        success: false,
        message: 'Clé API non configurée',
        provider: 'none'
      };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{
            role: 'user',
            content: 'Test de connexion'
          }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connexion réussie',
          provider: 'OpenAI',
          model: data.model || this.model
        };
      } else {
        return {
          success: false,
          message: `Erreur HTTP ${response.status}`,
          provider: 'OpenAI'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
        provider: 'OpenAI'
      };
    }
  }

  /**
   * Analyse un document de performances (image ou page PDF)
   */
  async analyzePerformanceDocument({ imageBase64, fileName, imageType, pageNumber }) {
    
    
    if (!this.apiKey) {
      throw new Error('Clé API OpenAI non configurée');
    }

    try {
      // Étape 1: Détection et classification du contenu
      const detectionResult = await this.detectPerformanceContent(imageBase64, fileName);
      

      // Étape 2: Extraction des données selon le type de contenu
      let extractionResult;
      switch (detectionResult.contentType) {
        case 'table':
          extractionResult = await this.extractTableData(imageBase64, fileName, detectionResult);
          break;
        case 'graph':
          extractionResult = await this.extractGraphData(imageBase64, fileName, detectionResult);
          break;
        case 'mixed':
          extractionResult = await this.extractMixedData(imageBase64, fileName, detectionResult);
          break;
        default:
          extractionResult = await this.extractGenericData(imageBase64, fileName);
      }

      // Étape 3: Validation et structuration
      const structuredResult = await this.validateAndStructure(extractionResult, fileName);

      return {
        tables: structuredResult.tables,
        confidence: structuredResult.confidence,
        detectionMethod: detectionResult.contentType,
        extractionMetadata: {
          fileName,
          imageType,
          pageNumber,
          analyzedAt: new Date().toISOString(),
          processingSteps: ['detection', 'extraction', 'validation', 'structuration']
        }
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse:', error);
      throw new Error(`Erreur d'analyse: ${error.message}`);
    }
  }

  /**
   * Détecte le type de contenu dans l'image
   */
  async detectPerformanceContent(imageBase64, fileName) {
    const prompt = `Tu es un expert en analyse de manuels aéronautiques MANEX (Section 4 - Performances). Analyse cette image et détermine:

1. Le TYPE DE CONTENU principal:
   - "table" : Tableau structuré avec lignes/colonnes (typique des MANEX)
   - "graph" : Graphique, courbe ou diagramme de performances
   - "mixed" : Mélange de tableau et graphique sur la même page
   - "text" : Principalement du texte avec quelques valeurs numériques
   - "other" : Autre type de contenu

2. Le SUJET des performances MANEX:
   - Type exact (Take-off Distance, Landing Distance, Climb Performance, etc.)
   - Configurations mentionnées (Flaps, Train, Power Setting)
   - Variables de conditions (Weight/Mass, Pressure Altitude, Temperature, Wind)
   - Unités utilisées (m, ft, kg, lbs, °C, °F)

3. La QUALITÉ de l'extraction:
   - "excellent" : Très lisible, tableaux nets, texte clair
   - "good" : Lisible, quelques zones floues acceptables
   - "poor" : Difficile à lire, nécessite amélioration

4. SPÉCIFICITÉS MANEX détectées:
   - Numéros de référence des tableaux
   - Conditions standardisées (ISA, ISA+10, etc.)
   - Notes et limitations importantes

Réponds UNIQUEMENT en JSON strict:
{
  "contentType": "table|graph|mixed|text|other",
  "performanceType": "description précise du type de performances",
  "conditions": ["condition1", "condition2"],
  "imageQuality": "excellent|good|poor",
  "confidence": 0.95,
  "detectedElements": ["element1", "element2"],
  "manexSpecifics": {
    "tableReference": "numéro ou nom du tableau",
    "standardConditions": ["ISA", "Flaps 0°", "etc."],
    "units": {"distance": "m", "weight": "kg", "temperature": "°C"}
  }
}`;

    return await this.callVisionAPI(imageBase64, prompt, 'detection', fileName);
  }

  /**
   * Extrait les données d'un tableau structuré
   */
  async extractTableData(imageBase64, fileName, detectionInfo) {
    const prompt = `Analyse cette image de tableau de performances aéronautiques et extrais TOUTES les données visibles.

INSTRUCTIONS CRITIQUES:
1. Lis EXACTEMENT les valeurs numériques telles qu'elles apparaissent dans le tableau
2. N'invente AUCUNE valeur - utilise null si illisible  
3. Extrais TOUTES les colonnes et TOUTES les lignes visibles
4. CAPTURE LES UNITÉS: Identifie l'unité de CHAQUE colonne (ft, m, °C, kg, etc.)
5. SÉPARE LES TEMPÉRATURES: Si le tableau montre °C ET °F, crée des colonnes séparées "temperature_c" et "temperature_f"
6. ALTITUDE: "SL" ou "S.L." = Sea Level = 0 ft (TOUJOURS remplacer SL par 0)

RÈGLES POUR TABLEAUX AÉRONAUTIQUES:
- ALTITUDES STANDARDS:
  * "SL" ou "S.L." ou "Sea Level" = 0 ft (TOUJOURS utiliser 0)
  * "MSL" = Mean Sea Level (utiliser la valeur numérique associée)
  * Les altitudes peuvent être en ft (feet) ou FL (Flight Level)
- Si une altitude/température est partagée entre plusieurs lignes (ex: "0 ft" pour Ground Roll ET Distance 50ft), RÉPÈTE cette valeur pour chaque ligne
- Les tableaux ont souvent cette structure:
  * Une altitude avec 2 lignes: Ground Roll / Distance over 50ft
  * RÉPÈTE l'altitude et la température pour CHAQUE ligne
- Identifie TOUTES les unités visibles (entre parenthèses, après les valeurs, dans les en-têtes)
- IMPORTANT: Si les températures sont données en °C ET °F (ex: 15°C/59°F), crée DEUX colonnes:
  * "temperature_c": 15
  * "temperature_f": 59

FORMAT DE SORTIE:
{
  "tables": [
    {
      "table_name": "nom exact du tableau visible",
      "table_type": "takeoff" ou "landing" ou "climb" ou "cruise",
      "conditions": "conditions exactes mentionnées sur le tableau",
      "units": {
        "nom_colonne1": "unité exacte (ft, m, °C, kg, etc.)",
        "nom_colonne2": "unité exacte"
      },
      "data": [
        {
          "nom_colonne1": valeur_exacte,
          "nom_colonne2": valeur_exacte
        }
      ],
      "notes": "notes ou remarques visibles",
      "confidence": 0.9
    }
  ]
}

EXEMPLE 1 - Tableau avec SL (Sea Level):
Si le tableau montre:
  Altitude: SL    2000 ft    4000 ft
  Ground roll:  280m  340m    410m
  
Tu dois TOUJOURS remplacer SL par 0:
{
  "data": [
    {"altitude": 0, "ground_roll": 280},
    {"altitude": 2000, "ground_roll": 340},
    {"altitude": 4000, "ground_roll": 410}
  ]
}

EXEMPLE 2 - Tableau avec températures doubles (°C et °F):
Si le tableau montre:
  Température: 15°C/59°F    25°C/77°F
  Altitude SL
    Ground roll:     280m         310m
    Distance 50ft:   430m         475m

Tu dois créer des colonnes séparées pour °C et °F ET remplacer SL par 0:
{
  "data": [
    {"altitude": 0, "temperature_c": 15, "temperature_f": 59, "ground_roll": 280, "distance_50ft": 430},
    {"altitude": 0, "temperature_c": 25, "temperature_f": 77, "ground_roll": 310, "distance_50ft": 475}
  ]
}

EXEMPLE 3 - Tableau avec altitude partagée:
Si le tableau montre:

Altitude: 0 ft
  Ground roll:     280m (à 15°C)  310m (à 25°C)
  Distance 50ft:   430m (à 15°C)  475m (à 25°C)
Altitude: 2000 ft  
  Ground roll:     340m (à 11°C)  380m (à 21°C)
  Distance 50ft:   520m (à 11°C)  580m (à 21°C)

Tu dois extraire CHAQUE ligne avec altitude/température RÉPÉTÉE:
{
  "tables": [
    {
      "table_name": "TAKEOFF DISTANCE",
      "table_type": "takeoff",
      "conditions": "Max weight, Flaps 10°, Paved dry runway",
      "units": {
        "altitude": "ft",
        "temperature_c": "°C",
        "temperature_f": "°F",
        "ground_roll": "m",
        "distance_50ft": "m"
      },
      "data": [
        {"altitude": 0, "temperature": 15, "ground_roll": 280, "distance_50ft": null},
        {"altitude": 0, "temperature": 15, "ground_roll": null, "distance_50ft": 430},
        {"altitude": 0, "temperature": 25, "ground_roll": 310, "distance_50ft": null},
        {"altitude": 0, "temperature": 25, "ground_roll": null, "distance_50ft": 475},
        {"altitude": 2000, "temperature": 11, "ground_roll": 340, "distance_50ft": null},
        {"altitude": 2000, "temperature": 11, "ground_roll": null, "distance_50ft": 520},
        {"altitude": 2000, "temperature": 21, "ground_roll": 380, "distance_50ft": null},
        {"altitude": 2000, "temperature": 21, "ground_roll": null, "distance_50ft": 580}
      ],
      "notes": "",
      "confidence": 0.95
    }
  ]
}

OU si tu peux regrouper sur la même ligne:
{
  "tables": [
    {
      "table_name": "TAKEOFF DISTANCE",
      "table_type": "takeoff",
      "conditions": "Max weight, Flaps 10°, Paved dry runway",
      "units": {
        "altitude": "ft",
        "temperature_c": "°C",
        "temperature_f": "°F",
        "ground_roll": "m",
        "distance_50ft": "m"
      },
      "data": [
        {"altitude": 0, "temperature": 15, "ground_roll": 280, "distance_50ft": 430},
        {"altitude": 0, "temperature": 25, "ground_roll": 310, "distance_50ft": 475},
        {"altitude": 2000, "temperature": 11, "ground_roll": 340, "distance_50ft": 520},
        {"altitude": 2000, "temperature": 21, "ground_roll": 380, "distance_50ft": 580}
      ],
      "notes": "",
      "confidence": 0.95
    }
  ]
}

IMPORTANT: 
- Extrais les valeurs EXACTES visibles dans l'image
- CAPTURE TOUTES LES UNITÉS (ft, m, °C, °F, kg, lbs, kt, etc.)
- SÉPARE °C et °F en colonnes distinctes (temperature_c ET temperature_f)
- OMETS les lignes avec TOUTES les valeurs null (sauf altitude/température)
- OMETS les doublons inutiles
- Si seul °C est présent: utilise temperature_c uniquement
- Si seul °F est présent: utilise temperature_f uniquement  
- Si les deux sont présents (15°C/59°F): remplis les deux colonnes
- Retourne UNIQUEMENT le JSON sans commentaire
- IMPORTANT: Garde la réponse CONCISE - pas de valeurs null inutiles`;

    return await this.callVisionAPI(imageBase64, prompt, 'table_extraction', fileName);
  }

  /**
   * Extrait les données d'un graphique ou courbe
   */
  async extractGraphData(imageBase64, fileName, detectionInfo) {
    const prompt = `Tu es un expert en analyse de graphiques aéronautiques. Cette image contient un graphique de performances.

MISSION: Extraire les données du graphique et les convertir en tableau numérique.

MÉTHODE:
1. Identifie les axes X et Y avec leurs unités
2. Lis les valeurs sur les courbes à intervalles réguliers
3. Note les différentes courbes (différents poids, configurations, etc.)
4. Convertis en tableau de données discrètes

INTERPOLATION:
- Prends des points tous les 500ft pour l'altitude
- Tous les 10°C pour la température
- Utilise ton expertise pour les intervalles pertinents

FORMAT DE SORTIE:
{
  "tables": [
    {
      "table_name": "Données extraites du graphique",
      "table_type": "graph_data",
      "conditions": "Conditions lues sur le graphique",
      "units": {
        "axe_x": "unité_x",
        "axe_y": "unité_y"
      },
      "data": [
        {"axe_x": valeur1, "axe_y": valeur2, "courbe": "nom_courbe"},
        {"axe_x": valeur3, "axe_y": valeur4, "courbe": "nom_courbe"}
      ],
      "graph_metadata": {
        "interpolation_method": "linear|spline",
        "sampling_interval": "description",
        "curves_detected": ["courbe1", "courbe2"]
      },
      "confidence": 0.85
    }
  ],
  "extraction_notes": "Méthode utilisée pour la lecture du graphique"
}

IMPORTANT: Même si c'est approximatif, fournis des données exploitables.`;

    return await this.callVisionAPI(imageBase64, prompt, 'graph_extraction', fileName);
  }

  /**
   * Extrait les données d'un contenu mixte (tableau + graphique)
   */
  async extractMixedData(imageBase64, fileName, detectionInfo) {
    const prompt = `Tu es un expert en documents aéronautiques complexes. Cette image contient un mélange de tableaux et graphiques.

MISSION: Extraire SÉPARÉMENT chaque élément de données.

MÉTHODE:
1. Identifie chaque tableau ET chaque graphique
2. Traite-les comme des entités séparées
3. Crée une table pour chaque élément identifié
4. Relie les éléments qui vont ensemble

FORMAT DE SORTIE:
{
  "tables": [
    {
      "table_name": "Premier élément identifié",
      "source_type": "table|graph",
      "table_type": "takeoff|landing|climb|other",
      // ... structure selon le type
    },
    {
      "table_name": "Deuxième élément identifié",
      "source_type": "table|graph",
      // ... structure selon le type
    }
  ],
  "relationships": [
    {
      "table1": "nom_table1",
      "table2": "nom_table2",
      "relationship": "complementary|same_conditions|different_config"
    }
  ]
}

Traite chaque élément avec le même niveau de détail qu'un document simple.`;

    return await this.callVisionAPI(imageBase64, prompt, 'mixed_extraction', fileName);
  }

  /**
   * Extraction générique pour contenu non structuré
   */
  async extractGenericData(imageBase64, fileName) {
    const prompt = `Tu es un expert en données aéronautiques. Cette image contient des informations de performances non structurées.

MISSION: Extraire TOUTES les valeurs numériques et les organiser logiquement.

INSTRUCTIONS:
1. Trouve toutes les valeurs numériques avec leurs unités
2. Identifie leur contexte (à quoi elles correspondent)
3. Groupe-les logiquement par sujet
4. Crée des tableaux structurés même à partir de texte

EXEMPLE de transformation:
Texte: "Décollage à 1200kg: 365m (50ft: 550m), à 1000kg: 320m (50ft: 485m)"
Devient:
{
  "tables": [
    {
      "table_name": "Distances de décollage",
      "table_type": "takeoff",
      "units": {"masse": "kg", "distance_sol": "m", "distance_50ft": "m"},
      "data": [
        {"masse": 1200, "distance_sol": 365, "distance_50ft": 550},
        {"masse": 1000, "distance_sol": 320, "distance_50ft": 485}
      ]
    }
  ]
}

FORMAT DE SORTIE strict:
{
  "tables": [
    {
      "table_name": "Nom descriptif",
      "table_type": "extracted_from_text",
      "conditions": "Conditions identifiées",
      "units": {},
      "data": [],
      "extraction_method": "text_parsing",
      "confidence": 0.7
    }
  ],
  "raw_values_found": ["valeur1: contexte1", "valeur2: contexte2"]
}

Sois créatif mais précis dans l'organisation des données.`;

    return await this.callVisionAPI(imageBase64, prompt, 'generic_extraction', fileName);
  }

  /**
   * Valide et structure les données extraites
   */
  async validateAndStructure(extractionResult, fileName) {
    // Gérer le nouveau format structuré (avec variants et flat_table)
    if (extractionResult.variants && extractionResult.flat_table) {
      return this.processStructuredFormat(extractionResult, fileName);
    }
    
    // Gérer l'ancien format (tables array)
    if (!extractionResult.tables || !Array.isArray(extractionResult.tables)) {
      throw new Error('Format de données invalide: tables manquantes');
    }

    const validatedTables = [];
    let totalConfidence = 0;

    for (const table of extractionResult.tables) {
      try {
        // Validation de la structure
        const validatedTable = this.validateTableStructure(table);
        
        // Normalisation des données
        const normalizedTable = this.normalizeTableData(validatedTable);
        
        // Validation des valeurs numériques
        const validatedData = this.validateNumericalData(normalizedTable);
        
        validatedTables.push(validatedData);
        totalConfidence += (validatedData.confidence || 0.5);
        
      } catch (error) {
        :`, error.message);
      }
    }

    return {
      tables: validatedTables,
      confidence: validatedTables.length > 0 ? totalConfidence / validatedTables.length : 0,
      validationMetadata: {
        originalTablesCount: extractionResult.tables.length,
        validTablesCount: validatedTables.length,
        fileName
      }
    };
  }

  /**
   * Analyse un abaque/graphique de performance
   * Extrait les courbes et points de données
   */
  async analyzePerformanceChart({ imageBase64, chartType = 'takeoff', axes }) {
    
    
    if (!this.apiKey) {
      throw new Error('Clé API OpenAI non configurée');
    }
    
    // Détecter le type MIME de l'image
    let mimeType = 'jpeg'; // Par défaut
    if (imageBase64.startsWith('/9j/')) {
      mimeType = 'jpeg';
    } else if (imageBase64.startsWith('iVBORw0KGgo')) {
      mimeType = 'png';
    } else if (imageBase64.startsWith('R0lGOD')) {
      mimeType = 'gif';
    } else if (imageBase64.startsWith('UklGR')) {
      mimeType = 'webp';
    }
    
    

    const systemPrompt = `Tu es un expert en analyse d'abaques aéronautiques.
    Tu dois extraire précisément les points de données des courbes de performance.
    
    Type d'abaque: ${chartType === 'takeoff' ? 'Décollage' : 'Atterrissage'}
    
    Axes configurés:
    - Température: ${axes?.temperature?.min || -15}°C à ${axes?.temperature?.max || 45}°C
    - Altitude pression: ${axes?.pressure_altitude?.min || 0}ft à ${axes?.pressure_altitude?.max || 10000}ft
    - Masse: ${axes?.mass?.min || 850}kg à ${axes?.mass?.max || 1150}kg
    - Vent: ${axes?.wind?.min || -10}kt à ${axes?.wind?.max || 20}kt
    
    IMPORTANT:
    1. Extraire UNIQUEMENT les points visibles sur les courbes
    2. Pour chaque point, identifier: température, altitude_pression, masse, vent, distance
    3. Convertir toutes les unités en système métrique
    4. Retourner un tableau JSON structuré
    5. Ne pas inventer de données - extraire uniquement ce qui est visible`;

    const userPrompt = `Tu es un expert en extraction de données d'abaques aéronautiques. 
    Analyse cette image qui contient des graphiques de performance d'avion (${chartType === 'takeoff' ? 'décollage' : 'atterrissage'}).

    MÉTHODE D'ANALYSE STRUCTURÉE:
    
    1️⃣ OBSERVATION GÉNÉRALE
    - Cette image contient-elle un ou plusieurs graphiques/abaques ?
    - Si plusieurs, sont-ils côte à côte ou l'un au-dessus de l'autre ?
    - Y a-t-il des tableaux en plus des graphiques ?
    
    2️⃣ POUR CHAQUE GRAPHIQUE VISIBLE, IDENTIFIE:
    - Les axes X et Y (paramètre et unité)
    - Le nombre de courbes tracées
    - La légende ou paramètre qui différencie les courbes
    - Les valeurs min et max sur chaque axe
    
    3️⃣ EXTRACTION SYSTÉMATIQUE DES POINTS
    Pour chaque courbe identifiée:
    - Commence au début de la courbe (gauche)
    - Extrais un point tous les 5-10% de la longueur
    - Continue jusqu'à la fin de la courbe (droite)
    - OBJECTIF: 15-20 points minimum par courbe
    
    4️⃣ STRUCTURE DES DONNÉES EXTRAITES
    Pour chaque point lu sur le graphique, détermine:
    - La valeur X (généralement température en °C)
    - La valeur Y (généralement distance en mètres)
    - Le paramètre de la courbe (altitude, masse, configuration)
    - Assigne les valeurs par défaut si non visibles:
      * mass: 1000 kg si non spécifié
      * wind: 0 kt si non spécifié
      * pressure_altitude: valeur de la courbe ou 0 ft
    
    FORMAT JSON STRICT (NE PAS DÉVIER):
    {
      "chart_type": "${chartType}",
      "extracted_points": [
        {
          "temperature": nombre (en °C),
          "pressure_altitude": nombre (en ft),
          "mass": nombre (en kg),
          "wind": nombre (en kt),
          "distance": nombre (en m)
        }
      ],
      "axes_detected": {
        "x_axis": "paramètre (ex: temperature)",
        "y_axis": "paramètre (ex: distance)",
        "curves": ["liste des paramètres des courbes"]
      },
      "confidence": nombre entre 0 et 1
    }
    
    EXEMPLES DE POINTS À EXTRAIRE:
    - Si tu vois une courbe "0 ft" allant de -15°C à 45°C:
      Extrais des points à: -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45°C
    - Si tu vois 3 courbes (0ft, 2000ft, 4000ft):
      Extrais 15 points de chaque = 45 points au total
    
    RÈGLES CRITIQUES:
    ✅ Extrais TOUS les points visibles (minimum 30-50 points au total)
    ✅ Lis les valeurs EXACTES sur les axes
    ✅ N'invente JAMAIS de valeurs - utilise null si illisible
    ✅ Assure-toi que chaque point a les 5 champs requis
    ✅ Les distances sont généralement entre 200m et 2000m
    ✅ Les températures sont généralement entre -20°C et +50°C`;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${mimeType};base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 8000, // Augmenté pour éviter la troncature
          temperature: 0.1 // Basse température pour plus de précision
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur API (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      
      
      // Parser la réponse JSON avec gestion améliorée des erreurs
      let chartData;
      try {
        // Essayer de parser directement
        chartData = JSON.parse(content);
      } catch (firstError) {
        
        
        // Nettoyer le contenu
        let cleanedContent = content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        // Extraire le JSON s'il est entouré de texte
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('❌ Pas de JSON trouvé dans la réponse');
          throw new Error('Impossible d\'extraire les données JSON de la réponse');
        }
        
        cleanedContent = jsonMatch[0];
        
        // Nettoyage approfondi du JSON
        cleanedContent = cleanedContent
          // Enlever les commentaires de style //
          .replace(/\/\/[^\n\r]*/g, '')
          // Enlever les virgules multiples
          .replace(/,\s*,+/g, ',')
          // Enlever les virgules avant les fermetures
          .replace(/,(\s*[}\]])/g, '$1')
          // Enlever les virgules après les ouvertures
          .replace(/(\[|{)\s*,/g, '$1')
          // Remplacer les valeurs manquantes par null
          .replace(/:\s*,/g, ': null,')
          .replace(/:\s*}/g, ': null}')
          .replace(/:\s*]/g, ': null]')
          // Ajouter des virgules manquantes entre éléments
          .replace(/(\d)\s+(\{)/g, '$1, $2')
          .replace(/(\})\s+(\{)/g, '$1, $2')
          .replace(/(\])\s+(\[)/g, '$1, $2')
          .replace(/(\d)\s+(\[)/g, '$1, $2')
          .replace(/(\])\s+(\d)/g, '$1, $2')
          // Corriger les nombres mal formés
          .replace(/(\d)(\s+)(\d)/g, '$1$3')
          // Enlever les espaces dans les nombres décimaux
          .replace(/(\d+)\s+\.\s+(\d+)/g, '$1.$2')
          // Corriger les guillemets manquants sur les clés
          .replace(/([,{]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
          // Enlever les virgules finales
          .replace(/,\s*$/g, '')
          .replace(/,\s*\}/g, '}')
          .replace(/,\s*\]/g, ']');
        
        // Vérifier si le JSON est tronqué
        const openBraces = (cleanedContent.match(/\{/g) || []).length;
        const closeBraces = (cleanedContent.match(/\}/g) || []).length;
        const openBrackets = (cleanedContent.match(/\[/g) || []).length;
        const closeBrackets = (cleanedContent.match(/\]/g) || []).length;
        
        if (openBraces > closeBraces || openBrackets > closeBrackets) {
          
          
          // Analyser la structure pour fermer proprement
          let stack = [];
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < cleanedContent.length; i++) {
            const char = cleanedContent[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') stack.push('}');
              else if (char === '[') stack.push(']');
              else if (char === '}' || char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === char) {
                  stack.pop();
                }
              }
            }
          }
          
          // Ajouter les fermetures manquantes dans le bon ordre
          while (stack.length > 0) {
            cleanedContent += stack.pop();
          }
          
          // Nettoyer une dernière fois après réparation
          cleanedContent = cleanedContent
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/,+/g, ',')
            .replace(/,\s*$/g, '');
        }
        
        try {
          chartData = JSON.parse(cleanedContent);
          
        } catch (secondError) {
          console.error('❌ Impossible de parser le JSON même après nettoyage:', secondError);
          
          // Logs détaillés pour diagnostiquer le problème
          const errorPosition = parseInt(secondError.message.match(/position (\d+)/)?.[1] || 0);
          
          
          if (errorPosition > 0) {
            
            , errorPosition));
          }
          
          // Afficher les 1000 premiers caractères pour analyse
          
          // Tentative de récupération ultime : extraire les points manuellement
          
          
          try {
            // Essayer d'extraire au moins le tableau de points
            const pointsMatch = cleanedContent.match(/"extracted_points"\s*:\s*\[([\s\S]*?)\]/);
            if (pointsMatch) {
              let pointsString = '[' + pointsMatch[1] + ']';
              
              // Nettoyer spécifiquement la partie des points
              pointsString = pointsString
                .replace(/,\s*,+/g, ',')
                .replace(/,\s*\]/g, ']')
                .replace(/,\s*\}/g, '}')
                .replace(/\[\s*,/g, '[')
                .replace(/\{\s*,/g, '{')
                .replace(/(\d)\s+(\d)/g, '$1, $2')
                .replace(/(\})\s+(\{)/g, '$1, $2');
              
              try {
                const points = JSON.parse(pointsString);
                
                
                // Créer une réponse avec les points récupérés
                chartData = {
                  chart_type: chartType,
                  extracted_points: points,
                  axes_detected: { 
                    x_axis: "temperature",
                    y_axis: "distance"
                  },
                  confidence: 0.5,
                  warning: "JSON partiellement récupéré"
                };
              } catch (e) {
                console.error('Impossible de parser même les points extraits');
                throw e;
              }
            } else {
              throw new Error('Aucun tableau de points trouvé');
            }
          } catch (recoveryError) {
            console.error('❌ Récupération manuelle échouée:', recoveryError);
            
            // Créer une réponse minimale pour éviter le blocage complet
            chartData = {
              chart_type: chartType,
              extracted_points: [],
              axes_detected: { x_axis: "unknown", y_axis: "unknown" },
              confidence: 0,
              error: "Parsing JSON failed completely"
            };
          }
        }
      }
      
      
      
      // Valider et enrichir les données
      if (chartData.extracted_points && Array.isArray(chartData.extracted_points)) {
        
        
        // Afficher les détails des abaques détectés
        if (chartData.abaques_detected && Array.isArray(chartData.abaques_detected)) {
          
          chartData.abaques_detected.forEach(abaque => {
            
            if (abaque.curves) {
              abaque.curves.forEach(curve => {
                
              });
            }
          });
        }
        
        // Afficher les statistiques d'extraction
        if (chartData.extraction_quality) {
          
          .toFixed(1)}%`);
          
          
        }
        
        
        // Ajouter des métadonnées
        chartData.extraction_metadata = {
          timestamp: new Date().toISOString(),
          model: this.model,
          chart_type: chartType,
          points_count: chartData.extracted_points.length,
          abaques_count: chartData.abaques_detected?.length || 1
        };
      }

      return chartData;

    } catch (error) {
      console.error('Erreur lors de l\'analyse de l\'abaque:', error);
      
      // Propager l'erreur au lieu de retourner des données simulées
      throw new Error(`Échec de l'analyse de l'abaque: ${error.message}`);
    }
  }

  /**
   * Génère des points de démonstration pour les tests
   * @deprecated Fonction conservée pour compatibilité mais non utilisée
   */
  generateDemoChartPoints(chartType, axes) {
    const points = [];
    const temps = [-10, 0, 15, 30, 40];
    const alts = [0, 2000, 4000, 6000];
    const masses = [900, 1000, 1100];
    
    temps.forEach(temp => {
      alts.forEach(alt => {
        masses.forEach(mass => {
          const baseDistance = chartType === 'takeoff' ? 500 : 400;
          const distance = Math.round(
            baseDistance + 
            temp * 5 + 
            alt * 0.05 + 
            (mass - 1000) * 0.8
          
          points.push({
            temperature: temp,
            pressure_altitude: alt,
            mass: mass,
            wind: 0,
            distance: distance
          });
        });
      });
    });
    
    return points;
  }

  /**
   * Traite le nouveau format structuré avec variants et flat_table
   */
  processStructuredFormat(extractionResult, fileName) {
    const tables = [];
    
    // Convertir flat_table en format tableau exploitable
    if (extractionResult.flat_table && extractionResult.flat_table.length > 0) {
      const tableData = {
        table_name: `${extractionResult.operation || 'Performance'} - ${fileName}`,
        table_type: extractionResult.operation || 'performance',
        conditions: extractionResult.variants?.[0]?.conditions || {},
        units: extractionResult.variants?.[0]?.units || {
          distance: "m",
          altitude: "ft",
          temperature: "C"
        },
        data: extractionResult.flat_table.map(row => ({
          pressure_alt_ft: row.pressure_alt_ft,
          temperature_C: row.temperature_C,
          ground_roll_m: row.ground_roll_m,
          over_50ft_m: row.over_50ft_m,
          variant_id: row.variant_id
        })),
        warnings: extractionResult.parse_warnings || [],
        confidence: 0.95
      };
      
      tables.push(tableData);
    }
    
    // Si pas de flat_table mais des variants avec series
    if (!tables.length && extractionResult.variants) {
      extractionResult.variants.forEach((variant, vIndex) => {
        if (variant.series) {
          const tableData = {
            table_name: `Variant ${vIndex + 1} - ${fileName}`,
            table_type: extractionResult.operation || 'performance',
            conditions: variant.conditions,
            units: variant.units,
            data: [],
            warnings: variant.warnings || [],
            confidence: 0.95
          };
          
          // Construire les données depuis les series
          const temps = variant.axes?.temperature_C || [];
          const alts = variant.axes?.pressure_alt_ft || [];
          
          for (let i = 0; i < Math.max(temps.length, alts.length); i++) {
            tableData.data.push({
              temperature_C: temps[i] || null,
              pressure_alt_ft: alts[i] || null,
              ground_roll_m: variant.series?.ground_roll_m?.[i] || null,
              over_50ft_m: variant.series?.over_50ft_m?.[i] || null
            });
          }
          
          if (tableData.data.length > 0) {
            tables.push(tableData);
          }
        }
      });
    }
    
    return {
      tables: tables,
      confidence: 0.95,
      validationMetadata: {
        originalFormat: 'structured',
        fileName,
        warnings: extractionResult.parse_warnings || []
      }
    };
  }

  /**
   * Valide la structure d'une table
   */
  validateTableStructure(table) {
    if (!table.table_name || typeof table.table_name !== 'string') {
      table.table_name = `Table_${Date.now()}`;
    }

    if (!table.data || !Array.isArray(table.data)) {
      throw new Error('Données de table manquantes ou invalides');
    }

    if (table.data.length === 0) {
      throw new Error('Table vide');
    }

    // Vérifier la cohérence des colonnes
    const firstRowKeys = Object.keys(table.data[0]);
    for (let i = 1; i < table.data.length; i++) {
      const currentRowKeys = Object.keys(table.data[i]);
          }

    return table;
  }

  /**
   * Normalise les données d'une table
   */
  normalizeTableData(table) {
    // Normaliser les noms de colonnes
    const normalizedData = table.data.map(row => {
      const normalizedRow = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toLowerCase()
          .replace(/[éèê]/g, 'e')
          .replace(/[àâä]/g, 'a')
          .replace(/[îï]/g, 'i')
          .replace(/[ôö]/g, 'o')
          .replace(/[ùûü]/g, 'u')
          .replace(/ç/g, 'c')
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
        
        normalizedRow[normalizedKey] = value;
      }
      return normalizedRow;
    });

    return {
      ...table,
      data: normalizedData
    };
  }

  /**
   * Valide et convertit les données numériques
   */
  validateNumericalData(table) {
    const processedData = table.data.map(row => {
      const processedRow = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined || value === '') {
          processedRow[key] = null;
          continue;
        }

        // Tentative de conversion numérique
        if (typeof value === 'string') {
          // Nettoyer la chaîne (enlever espaces, virgules pour milliers, etc.)
          const cleaned = value.toString()
            .replace(/\s/g, '')
            .replace(/,(\d{3})/g, '$1') // Virgules pour milliers
            .replace(/,/g, '.'); // Virgule décimale vers point

          const numValue = parseFloat(cleaned);
          
          if (!isNaN(numValue) && isFinite(numValue)) {
            processedRow[key] = numValue;
          } else {
            processedRow[key] = value; // Garder comme texte
          }
        } else if (typeof value === 'number') {
          if (isNaN(value) || !isFinite(value)) {
            processedRow[key] = null;
          } else {
            processedRow[key] = value;
          }
        } else {
          processedRow[key] = value;
        }
      }
      
      return processedRow;
    });

    return {
      ...table,
      data: processedData
    };
  }

  /**
   * Appel de l'API Vision avec gestion d'erreurs et retry
   */
  async callVisionAPI(imageBase64, prompt, operation, fileName = 'unknown') {
    // Détecter le type MIME de l'image
    let mimeType = 'jpeg'; // Par défaut
    if (imageBase64.startsWith('/9j/')) {
      mimeType = 'jpeg';
    } else if (imageBase64.startsWith('iVBORw0KGgo')) {
      mimeType = 'png';
    } else if (imageBase64.startsWith('R0lGOD')) {
      mimeType = 'gif';
    } else if (imageBase64.startsWith('UklGR')) {
      mimeType = 'webp';
    }
    
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        
        
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${mimeType};base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }],
            max_tokens: 16000, // Augmenter la limite pour éviter les troncatures
            temperature: 0, // Température à 0 pour extraction déterministe
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Réponse API invalide');
        }

        const content = data.choices[0].message.content;
        
        try {
          // Nettoyer le JSON (enlever les marqueurs markdown si présents)
          let cleanedContent = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          // Nettoyer les virgules en trop avant les accolades/crochets fermants
          cleanedContent = cleanedContent
            .replace(/,(\s*[}\]])/g, '$1')
            // Remplacer les virgules multiples par une seule
            .replace(/,+/g, ',')
            // Enlever les virgules après le dernier élément
            .replace(/,(\s*)}/g, '$1}')
            .replace(/,(\s*)\]/g, '$1]');
          
          const result = JSON.parse(cleanedContent);
          
          
          // Vérifier que le résultat a bien des tables
          if (!result.tables && operation === 'table_extraction') {
            
            return {
              tables: [],
              parse_warnings: ['Aucune table trouvée dans la réponse']
            };
          }
          
          return result;
          
        } catch (parseError) {
          
          :', content.substring(0, 500));
          :', content.substring(content.length - 500));
          
          
          // Tentative de récupération plus agressive
          try {
            // Extraire uniquement le JSON principal
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            
            if (jsonStart >= 0) {
              let jsonContent = content.substring(jsonStart);
              
              // Si le JSON semble tronqué (pas de } final trouvé ou déséquilibré)
              if (jsonEnd === -1 || jsonEnd <= jsonStart) {
                
                
                // Compter les accolades et crochets ouverts
                let braceCount = 0;
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;
                
                for (let i = 0; i < jsonContent.length; i++) {
                  const char = jsonContent[i];
                  
                  if (escapeNext) {
                    escapeNext = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escapeNext = true;
                    continue;
                  }
                  
                  if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                    if (char === '[') bracketCount++;
                    if (char === ']') bracketCount--;
                  }
                }
                
                // Fermer les structures ouvertes
                while (bracketCount > 0) {
                  jsonContent += ']';
                  bracketCount--;
                }
                while (braceCount > 0) {
                  jsonContent += '}';
                  braceCount--;
                }
                
                
              } else {
                jsonContent = content.substring(jsonStart, jsonEnd + 1);
              }
              
              // Nettoyer plus agressivement
              jsonContent = jsonContent
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/,+/g, ',')
                .replace(/,(\s*)}/g, '$1}')
                .replace(/,(\s*)\]/g, '$1]')
                // Enlever les commentaires non JSON
                .replace(/\/\/[^\n]*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');
              
              const result = JSON.parse(jsonContent);
              
              
              // Vérifier que le résultat a bien des tables
              if (result.tables && result.tables.length > 0) {
                return result;
              } else {
                
                return {
                  tables: [],
                  parse_warnings: ['JSON récupéré mais aucune table détectée']
                };
              }
            }
          } catch (recoveryError) {
            
          }
          
          // Si tout échoue, retourner une structure minimale
          
          return {
            tables: [{
              table_name: `Extraction échouée - ${fileName}`,
              table_type: 'error',
              conditions: 'Erreur de parsing JSON',
              units: {},
              data: [],
              confidence: 0.1,
              error: parseError.message
            }],
            parse_warnings: [`Erreur de parsing JSON: ${parseError.message}`]
          };
        }

      } catch (error) {
        lastError = error;
        
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Backoff exponentiel
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Échec de ${operation} après ${this.maxRetries} tentatives. Dernière erreur: ${lastError.message}`);
  }
}

// Instance unique du service
const advancedPerformanceAnalyzer = new AdvancedPerformanceAnalyzer();

export default advancedPerformanceAnalyzer;