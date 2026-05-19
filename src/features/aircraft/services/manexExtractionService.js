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

// Nombre de pages analysées par défaut.
// null = analyser TOUTES les pages du MANEX (recommandé pour exhaustivité).
// Un MANEX d'avion GA standard fait 50-300 pages réparties en sections :
// couverture / specs / limitations / normal procedures / emergency / performance /
// weight & balance / systems description / supplements / appendices.
// Les données chiffrées (vitesses, masses, performances) sont dispersées un peu
// partout — limiter à 8 pages comme on faisait avant manquait jusqu'à 95% des
// données utiles.
const DEFAULT_PAGES_TO_SCAN = null;

// Concurrence : nombre de pages analysées EN PARALLÈLE.
// Compromis entre vitesse et rate-limit Anthropic.
//   - Tier free Anthropic : 5 req/min → CONCURRENCY=2 max
//   - Tier paid (Build) : 50 req/min → CONCURRENCY=5 confortable
//   - Tier paid (Scale) : 1000 req/min → CONCURRENCY=10+ ok
// On reste prudent à 5 par défaut. Le pilote peut surcharger via options.concurrency.
const DEFAULT_CONCURRENCY = 5;

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
Schéma STRICT — n'extraire QUE ces champs (ils correspondent exactement à ce
que le wizard de création d'avion sait stocker, ni plus ni moins) :

{
  "aircraft_identification": {
    "model": ".. (TYPE générique de l'avion, ex: \"DA40 NG\", \"Cessna 172S\", \"Piper PA-28-181\")",
    "registration": ".. (IMMATRICULATION spécifique du tail-number, ex: \"F-HSTR\", \"N12345\", \"G-ABCD\")"
  },
  "engine": {
    "type_category": ".. (UNE valeur ENUM parmi : \"singleEngine\", \"twinEngine\", \"turboprop\", \"jet\". Choisis selon : avion monomoteur thermique → singleEngine ; bimoteur thermique → twinEngine ; turbopropulseur (PT6, TPE331...) → turboprop ; turbofan/turbojet → jet)"
  },
  "certification": {
    "wake_turbulence_category": ".. (ICAO catégorie turbulence : \"L\" (Light < 7000 kg), \"M\" (Medium 7-136 t), \"H\" (Heavy > 136 t), \"S\" (Super). Pour un monomoteur GA léger, c'est \"L\")"
  },
  "fuel": {
    "fuel_type": ".. (UNE valeur ENUM parmi : \"AVGAS\", \"JET-A1\", \"MOGAS\". \"AVGAS 100LL\" → \"AVGAS\". \"Jet A-1\" → \"JET-A1\". \"MOGAS UL91\" → \"MOGAS\")",
    "capacity_total": ".. (capacité totale carburant, en L ou US gal)",
    "consumption_cruise": ".. (consommation croisière, en L/h ou GPH)"
  },
  "compatibility": {
    "runway_surfaces": ".. (liste textuelle CSV des revêtements de piste compatibles : \"asphalte, herbe, gravier, terre, sable, neige\". Le mapper convertira automatiquement vers codes ICAO.)"
  },
  "speeds": {
    "vso": ".. (stall flaps LDG)", "vs1": ".. (stall clean)",
    "vfe_takeoff": ".. (VFE en config T/O flaps)",
    "vfe_landing": ".. (VFE en config LDG flaps)",
    "vno": ".. (max structural cruising)",
    "vne": ".. (never exceed)",
    "vr": ".. (rotation)",
    "vx": ".. (best angle of climb)", "vy": ".. (best rate of climb)",
    "vapp": ".. (approach)",
    "vglide": ".. (best glide)",
    "vle": ".. (landing gear extended)", "vlo": ".. (gear operating)",
    "initial_climb_rate": ".. (taux montée initiale en ft/min)"
  },
  "wind_limits": {
    "max_crosswind": ".. (demonstrated crosswind component)",
    "max_tailwind": "..",
    "max_crosswind_wet": ".."
  },
  "weights": {
    "empty_weight": ".. (BEW - Basic Empty Weight, masse à vide en kg ou lbs)",
    "mtow": ".. (Maximum Takeoff Weight)",
    "mlw": ".. (Maximum Landing Weight, souvent = MTOW pour avions GA)",
    "mzfw": ".. (Maximum Zero Fuel Weight, souvent absent pour avions GA)",
    "min_takeoff_weight": ".. (masse mini décollage, rare)"
  },
  "arms": {
    "empty_cg_arm": ".. (bras de levier du CG à vide)",
    "front_seats_arm": "..",
    "rear_seats_arm": "..",
    "fuel_main_arm": ".. (bras du réservoir principal)",
    "aft_cg_min_weight": ".. (masse min de la zone arrière de l'enveloppe CG)",
    "aft_cg_max_weight": ".. (masse max de la zone arrière de l'enveloppe CG)",
    "cg_aft_limit": ".. (CG arrière maximum)"
  },
  "performance_summary": {
    "cruise_speed_75percent": ".. (TAS à 75% puissance, kt)"
  }
}
</schema>

<output_format>
Retourne UNIQUEMENT le JSON, sans markdown (pas de \`\`\`json), sans préambule,
sans commentaire. Ne retourne que les sections où tu as trouvé AU MOINS un champ.
Le JSON doit être directement parseable par JSON.parse().
</output_format>

<important>
RÈGLES STRICTES D'EXTRACTION :

1) DISTINCTION ABSOLUE model ↔ registration :
   - "model" = TYPE GÉNÉRIQUE (ex: "DA40 NG", "Cessna 172S", "PA-28-181")
   - "registration" = IMMATRICULATION (ex: "F-HSTR", "N12345", "G-ABCD")
   - JAMAIS mettre une immatriculation dans "model" ni l'inverse.

2) Si la page est sommaire / table des matières / page blanche / illustration
   sans données chiffrées : retourne {} (objet vide).

3) ENUM strict pour engine.type_category : choisis UNE valeur exacte parmi
   "singleEngine" | "twinEngine" | "turboprop" | "jet".
   Ex: Lycoming O-360 → "singleEngine". Austro AE300 (diesel) → "singleEngine".
   PT6A turbopropulseur → "turboprop".

4) ENUM strict pour fuel.fuel_type : "AVGAS" | "JET-A1" | "MOGAS".
   Normalise : "AVGAS 100LL" / "100 LL" / "Avgas" → "AVGAS".
   "Jet A-1" / "JET A-1" / "Jet-A1" → "JET-A1".
   "MOGAS UL91" / "Premium 95" essence auto → "MOGAS".

5) ENUM strict pour wake_turbulence_category : "L" | "M" | "H" | "S".
   Pour avion GA monomoteur sous 7000 kg : c'est toujours "L".

6) VFE : extrais BIEN les versions TAKEOFF et LANDING séparément si présentes
   (souvent valeurs différentes : VFE T/O > VFE LDG car flaps moins sortis).
   Si une seule valeur VFE générale : la stocker dans vfe_landing par défaut.

7) Vitesses : conserve l'unité originale (kt ou MPH). Le mapper convertira.

8) Masses : si tu vois "1500 lbs / 680 kg" sur la même ligne, préfère "kg".

9) Bras (arms) : conserve le signe si négatif (FS - fuselage station négatif).

10) Confiance honnête : si tu hésites entre 2 valeurs, baisse à 50-65 et
    choisis la plus probable. Mieux vaut un faible score qu'une fausse certitude.
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
 * Analyse UNE page MANEX et retourne le résultat normalisé.
 * Utilisé par extractCompleteManexData en mode parallèle (Promise.all batches).
 */
async function analyzeSinglePage(page) {
  try {
    const rawResponse = await unifiedPerformanceService.analyzeWithVision(
      page.image,
      MANEX_EXTRACTION_PROMPT
    );

    let pageData;
    if (typeof rawResponse === 'string') {
      pageData = safeParseJSON(rawResponse);
    } else if (rawResponse && typeof rawResponse === 'object') {
      pageData = rawResponse;
    }

    if (pageData) {
      pageData._pageNumber = page.pageNumber;
      pageData._provider = rawResponse?._provider;
      pageData._model = rawResponse?._model;
      // Compter les sections non-vides (utile pour stats)
      pageData._sectionsFound = Object.keys(pageData).filter(k => !k.startsWith('_')).length;
      return pageData;
    }
  } catch (err) {
    console.warn(`[manexExtractionService] Page ${page.pageNumber} a échoué:`, err.message);
  }
  return null;
}

/**
 * Extrait les données complètes d'un MANEX (analyse intégrale par défaut).
 *
 * @param {File} pdfFile - Fichier PDF du MANEX
 * @param {Object} options
 * @param {number|null} options.maxPages - Nombre max de pages à analyser.
 *                                          null (défaut) = TOUTES les pages.
 * @param {number} options.concurrency - Nombre de pages en parallèle
 *                                        (défaut: 5, attention rate-limit Anthropic).
 * @param {function} options.onProgress - Callback(progress, message) appelé pendant l'extraction
 * @returns {Promise<{extraction: Object, metadata: Object}>}
 */
export async function extractCompleteManexData(pdfFile, options = {}) {
  const {
    maxPages = DEFAULT_PAGES_TO_SCAN,
    concurrency = DEFAULT_CONCURRENCY,
    onProgress
  } = options;

  if (!pdfFile) throw new Error('Aucun fichier PDF fourni');

  onProgress?.(2, 'Conversion du PDF en images...');

  // Réutilise le helper existant qui rend chaque page en canvas
  const allPages = await unifiedPerformanceService.extractPDFPages(pdfFile);
  // Si maxPages est null → analyser TOUTES les pages
  const pagesToScan = maxPages === null || maxPages === undefined
    ? allPages
    : allPages.slice(0, maxPages);

  onProgress?.(5, `${pagesToScan.length} page(s) à analyser (parallélisme ${concurrency})`);

  // ── ANALYSE PARALLÈLE PAR LOTS ──
  // Au lieu d'attendre chaque page séquentiellement (200 pages × 3s = 10min),
  // on traite N pages en parallèle (200 pages × 3s / 5 = 2min). Compromis
  // vitesse vs rate-limit Anthropic. Le pilote peut adjuster `concurrency`.
  const pageResults = [];
  let pagesAnalyzed = 0;
  const total = pagesToScan.length;

  // Découpe en chunks de taille `concurrency`
  for (let chunkStart = 0; chunkStart < total; chunkStart += concurrency) {
    const chunk = pagesToScan.slice(chunkStart, chunkStart + concurrency);

    // Lance les N appels en parallèle
    const chunkResults = await Promise.all(chunk.map(page => analyzeSinglePage(page)));

    // Aggréger
    for (const r of chunkResults) {
      pagesAnalyzed += 1;
      if (r) pageResults.push(r);
    }

    // Progress après chaque chunk (entre 5 et 95)
    const progress = 5 + Math.round((pagesAnalyzed / total) * 90);
    const lastPageInChunk = chunk[chunk.length - 1]?.pageNumber;
    onProgress?.(
      progress,
      `Page ${pagesAnalyzed}/${total} analysée${pagesAnalyzed > 1 ? 's' : ''}${lastPageInChunk ? ` (dernière : p.${lastPageInChunk})` : ''}`
    );
  }

  onProgress?.(97, 'Fusion des résultats…');

  const extraction = mergePageResults(pageResults);

  // Stats globales
  let totalFields = 0;
  let sumConfidence = 0;
  for (const section of Object.values(extraction)) {
    for (const field of Object.values(section)) {
      totalFields += 1;
      sumConfidence += Number(field.confidence) || 0;
    }
  }

  // Stats par page : combien de pages ont produit ≥1 champ
  const pagesWithData = pageResults.filter(r => r._sectionsFound > 0).length;

  const metadata = {
    pagesAnalyzed,
    pagesWithData,
    pagesEmpty: pagesAnalyzed - pagesWithData,
    fieldsFound: totalFields,
    overallConfidence: totalFields > 0 ? Math.round(sumConfidence / totalFields) : 0,
    extractedAt: new Date().toISOString()
  };

  onProgress?.(100, `Terminé : ${totalFields} champs extraits sur ${pagesWithData}/${pagesAnalyzed} pages utiles`);

  return { extraction, metadata };
}

export default {
  extractCompleteManexData
};
