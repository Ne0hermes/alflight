// src/features/aircraft/services/manexExtractionService.js
//
// Service d'extraction COMPLÈTE des caractéristiques d'un avion depuis son
// MANEX (PDF). Différent des tableaux de performance (cf. AdvancedPerformanceAnalyzer)
// — ici on extrait les caractéristiques générales (masses, vitesses, fuel, etc.)
// pour pré-remplir le wizard de création d'avion.
//
// Pipeline :
//   1. Convertit les N premières pages du PDF en images (où se trouvent typiquement
//      les sections "specifications", "limitations", "weights", "limitations").
//   2. Envoie chaque image au provider Vision actif (Claude par défaut, OpenAI
//      en fallback) via unifiedPerformanceService.analyzeWithVision.
//   3. Fusionne les résultats en gardant la valeur de plus haute confiance par champ.
//
// Retour : objet JSON suivant le schéma MANEX_EXTRACTION_COMPLETE. Chaque champ
// chiffré porte {value, unit, confidence}.

import unifiedPerformanceService from '@features/performance/services/unifiedPerformanceService';

// Nombre de pages analysées par défaut (couverture + specs + limitations).
// Empiriquement, ces données tiennent dans les 8 premières pages d'un MANEX standard.
const DEFAULT_PAGES_TO_SCAN = 8;

// ─────────────────────────────────────────────────────────────────────────
// PROMPT OPTIMISÉ POUR CLAUDE (avec fallback compatible OpenAI)
// ─────────────────────────────────────────────────────────────────────────
//
// Stratégie spécifique Claude :
//   - Framing fort en système (qui je suis + tâche + format de sortie)
//   - Balises XML pour structurer les sections importantes (Claude les comprend
//     mieux que markdown)
//   - Demande explicite d'EXHAUSTIVITÉ (extrais TOUT ce que tu vois)
//   - Confidence guidelines détaillées avec EXEMPLES (Claude calibre mieux)
//   - Output JSON strict, prefix "{" appliqué côté callClaude
const MANEX_EXTRACTION_PROMPT = `<role>
Tu es un expert en extraction de données depuis des manuels de vol (MANEX / POH /
Pilot Operating Handbook) d'aéronefs civils. Tu lis des pages de manuels en
français ou anglais et tu extrais SYSTÉMATIQUEMENT toutes les données chiffrées
et qualitatives pertinentes, sans en oublier.
</role>

<task>
Extrais de cette page MANEX TOUTES les valeurs qui figurent dans le schéma cible
ci-dessous. Pour chaque champ trouvé, retourne :
  { "value": <nombre ou string>, "unit": "<unité littérale du document>", "confidence": <0-100> }

Si un champ N'EST PAS visible sur cette page, OMETS-LE entièrement (ne mets jamais "null"
ni "value": null).
</task>

<confidence_calibration>
- 95-100 : valeur clairement écrite, sans ambiguïté (ex: "MTOW : 1200 kg")
- 70-94  : valeur lisible mais demande légère inférence (ex: ligne d'un tableau,
           cellule jouxtant un en-tête, unité implicite dans la section)
- 40-69  : valeur déduite, possiblement ambiguë (mauvaise qualité d'image,
           valeur partiellement coupée, plusieurs candidats plausibles)
- <40    : NE PAS RETOURNER (omet le champ)
</confidence_calibration>

<units_rules>
Conserve EXACTEMENT l'unité originale du document, ne convertis JAMAIS rien.
Exemples valides : "kg", "lbs", "kt", "kts", "KIAS", "mph", "km/h", "L", "litres",
"gal", "USG", "in", "inches", "cm", "m", "mm", "ft", "ft/min", "fpm", "m/s",
"°C", "°F". Si une vitesse est marquée "VR = 60 kt", retourne unit:"kt".
</units_rules>

<schema>
{
  "aircraft_identification": {
    "model": "..", "manufacturer": "..", "manex_edition": "..", "manex_date": ".."
  },
  "weights": {
    "empty_weight": ".. (masse à vide BEW)", "mtow": ".. (max takeoff weight)",
    "mlw": ".. (max landing weight)", "min_takeoff_weight": "..",
    "max_payload": "..", "max_baggage_fwd": "..", "max_baggage_aft": ".."
  },
  "arms": {
    "empty_cg_arm": "..", "front_seats_arm": "..", "rear_seats_arm": "..",
    "fuel_main_arm": "..", "baggage_fwd_arm": "..", "baggage_aft_arm": "..",
    "cg_forward_limit": "..", "cg_aft_limit": ".."
  },
  "speeds": {
    "vso": ".. (stall flaps extended)", "vs1": ".. (stall clean)",
    "vfe": ".. (max flaps extended)", "vfe_takeoff": "..", "vfe_landing": "..",
    "vno": ".. (max structural cruising)", "vne": ".. (never exceed)",
    "vr": ".. (rotation)", "vx": ".. (best angle climb)", "vy": ".. (best rate climb)",
    "vapp": ".. (approach)", "vglide": ".. (best glide)",
    "vle": ".. (landing gear extended)", "vlo": ".. (gear operating)",
    "va": ".. (manoeuvring)", "initial_climb_rate": ".. en ft/min ou m/s"
  },
  "fuel": {
    "capacity_total": "..", "capacity_usable": "..",
    "fuel_type": ".. (JET A-1, AVGAS 100LL, MOGAS...)",
    "consumption_cruise": ".. en L/h ou GPH"
  },
  "wind_limits": {
    "max_crosswind": "..", "max_tailwind": "..", "max_crosswind_wet": ".."
  },
  "performance_summary": {
    "takeoff_distance_50ft": "..", "landing_distance_50ft": "..",
    "service_ceiling": "..", "cruise_speed_75percent": "..",
    "endurance": "..", "range_cruise": ".."
  }
}
</schema>

<output_format>
Retourne UNIQUEMENT le JSON, sans markdown (pas de \`\`\`json), sans préambule,
sans commentaire. Ne retourne que les sections où tu as trouvé AU MOINS un champ.
Le JSON doit être directement parseable par JSON.parse().
</output_format>

<important>
- Si la page est un sommaire / table des matières / page blanche : retourne {}
- Si tu hésites entre 2 valeurs (ex: VR = 55 vs 60), choisis la plus probable et
  baisse la confidence à 50-65 pour signaler l'incertitude.
- Distingue VFE général de VFE TAKEOFF et VFE LANDING (souvent valeurs différentes).
- Pour les bras (arms), conserve le signe si négatif (FS - fuselage station).
- Pour les masses : si tu vois "1500 lbs / 680 kg" sur la même ligne, retourne
  la version en kg avec unit:"kg" (préférence métrique pour MANEX FR).
</important>`;

/**
 * Fusionne les résultats de plusieurs pages en gardant la valeur de plus haute confiance par champ.
 */
function mergePageResults(pageResults) {
  const merged = {};

  for (const result of pageResults) {
    if (!result || typeof result !== 'object') continue;

    for (const [section, fields] of Object.entries(result)) {
      if (!fields || typeof fields !== 'object') continue;
      if (!merged[section]) merged[section] = {};

      for (const [fieldName, fieldData] of Object.entries(fields)) {
        if (!fieldData || typeof fieldData !== 'object') continue;
        if (fieldData.value === undefined || fieldData.value === null || fieldData.value === '') continue;

        const incomingConfidence = Number(fieldData.confidence) || 0;
        const existing = merged[section][fieldName];

        if (!existing || incomingConfidence > (Number(existing.confidence) || 0)) {
          merged[section][fieldName] = {
            value: fieldData.value,
            unit: fieldData.unit || null,
            confidence: incomingConfidence,
            sourcePage: result._pageNumber
          };
        }
      }
    }
  }

  return merged;
}

/**
 * Parse JSON tolérant aux réponses OpenAI mal formées (entourées de ```json).
 */
function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();

  // Retirer les fences markdown
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Tenter de couper avant un éventuel texte de fin
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[manexExtractionService] JSON parse failed:', e.message);
    return null;
  }
}

/**
 * Extrait les données complètes d'un MANEX.
 *
 * @param {File} pdfFile - Fichier PDF du MANEX
 * @param {Object} options
 * @param {number} options.maxPages - Nombre max de pages à analyser (défaut: 8)
 * @param {function} options.onProgress - Callback(progress, message) appelé pendant l'extraction
 * @returns {Promise<{extraction: Object, metadata: Object}>}
 */
export async function extractCompleteManexData(pdfFile, options = {}) {
  const { maxPages = DEFAULT_PAGES_TO_SCAN, onProgress } = options;

  if (!pdfFile) throw new Error('Aucun fichier PDF fourni');

  onProgress?.(5, 'Conversion du PDF en images...');

  // Réutilise le helper existant qui rend chaque page en canvas
  const allPages = await unifiedPerformanceService.extractPDFPages(pdfFile);
  const pagesToScan = allPages.slice(0, maxPages);

  onProgress?.(15, `${pagesToScan.length} pages à analyser`);

  const pageResults = [];
  let pagesAnalyzed = 0;

  for (const page of pagesToScan) {
    pagesAnalyzed += 1;
    const progress = 15 + Math.round((pagesAnalyzed / pagesToScan.length) * 80);
    onProgress?.(progress, `Page ${pagesAnalyzed}/${pagesToScan.length}`);

    try {
      // Route automatique vers Claude OU OpenAI selon apiKeyManager.getActiveProvider().
      // Pour Claude : le response prefill "{" garantit un JSON pur en sortie.
      const rawResponse = await unifiedPerformanceService.analyzeWithVision(
        page.image,
        MANEX_EXTRACTION_PROMPT
      );

      // analyzeWithVision retourne soit l'objet déjà parsé, soit la string brute selon
      // ce qui a réussi côté API. On normalise.
      let pageData;
      if (typeof rawResponse === 'string') {
        pageData = safeParseJSON(rawResponse);
      } else if (rawResponse && typeof rawResponse === 'object') {
        pageData = rawResponse;
      }

      if (pageData) {
        pageData._pageNumber = page.pageNumber;
        // Préserver les métadonnées provider (utile pour traçabilité)
        pageData._provider = rawResponse._provider;
        pageData._model = rawResponse._model;
        pageResults.push(pageData);
      }
    } catch (err) {
      console.warn(`[manexExtractionService] Page ${page.pageNumber} a échoué:`, err.message);
    }
  }

  onProgress?.(98, 'Fusion des résultats...');

  const extraction = mergePageResults(pageResults);

  // Compter les champs trouvés et leur confiance moyenne
  let totalFields = 0;
  let sumConfidence = 0;
  for (const section of Object.values(extraction)) {
    for (const field of Object.values(section)) {
      totalFields += 1;
      sumConfidence += Number(field.confidence) || 0;
    }
  }

  const metadata = {
    pagesAnalyzed,
    fieldsFound: totalFields,
    overallConfidence: totalFields > 0 ? Math.round(sumConfidence / totalFields) : 0,
    extractedAt: new Date().toISOString()
  };

  onProgress?.(100, `Terminé : ${totalFields} champs extraits`);

  return { extraction, metadata };
}

export default {
  extractCompleteManexData
};
