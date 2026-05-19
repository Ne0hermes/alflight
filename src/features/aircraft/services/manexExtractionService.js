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
{
  "aircraft_identification": {
    "model": ".. (TYPE générique de l'avion, ex: DA40 NG, Cessna 172S, Piper PA-28-181)",
    "registration": ".. (IMMATRICULATION spécifique de cet aéronef, ex: F-HSTR, N12345, G-ABCD)",
    "serial_number": ".. (numéro de série / MSN)",
    "manufacturer": ".. (ex: Diamond Aircraft, Cessna, Piper)",
    "year_of_construction": ".. (année de fabrication)",
    "manex_edition": ".. (numéro / version d'édition du MANEX, ex: Rev 4)",
    "manex_date": ".. (date d'édition du MANEX)"
  },
  "certification": {
    "certification_basis": ".. (ex: CS-23, FAR Part 23, JAR-VLA)",
    "aircraft_category": ".. (Normal / Utility / Aerobatic / Commuter)",
    "ifr_certified": ".. (boolean ou Yes/No - certifié IFR ?)",
    "icing_certified": ".. (vol en conditions givrantes autorisé ?)",
    "max_seats": ".. (nombre de sièges max, pilote inclus)",
    "max_pob": ".. (max persons on board)",
    "wake_turbulence_category": ".. (ICAO : L / M / H — Light / Medium / Heavy)"
  },
  "engine": {
    "type": ".. (ex: Austro AE300, Lycoming O-360-A4M, Continental IO-550-N)",
    "manufacturer": ".. (ex: Austro Engine, Lycoming, Continental, Rotax)",
    "count": ".. (nombre de moteurs)",
    "power_max": ".. (puissance max en kW, hp ou CV)",
    "power_cruise": ".. (puissance croisière typique)",
    "rpm_max": ".. (RPM max moteur)",
    "rpm_idle": ".. (RPM ralenti)",
    "oil_pressure_min": "..", "oil_pressure_max": "..",
    "oil_temp_max": "..", "cht_max": ".. (cylinder head temp max si applicable)"
  },
  "propeller": {
    "type": ".. (ex: MT-Propeller MTV-6-A-C-F, McCauley...)",
    "manufacturer": "..",
    "diameter": ".. (en m ou inches)",
    "blade_count": ".. (nombre de pales)",
    "pitch_type": ".. (fixed pitch / constant speed / variable pitch)"
  },
  "weights": {
    "empty_weight": ".. (BEW - Basic Empty Weight, masse à vide)",
    "ramp_weight": ".. (max au sol avant taxi, souvent MTOW + ~10 kg)",
    "mtow": ".. (Maximum Takeoff Weight)",
    "mlw": ".. (Maximum Landing Weight, souvent = MTOW pour avions GA)",
    "mzfw": ".. (Maximum Zero Fuel Weight, surtout pour gros avions)",
    "min_takeoff_weight": "..",
    "max_payload": ".. (charge utile max)",
    "useful_load": ".. (MTOW - empty_weight)",
    "max_baggage_fwd": "..", "max_baggage_aft": ".."
  },
  "arms": {
    "empty_cg_arm": ".. (bras de levier du CG à vide)",
    "front_seats_arm": "..", "rear_seats_arm": "..",
    "fuel_main_arm": "..",
    "baggage_fwd_arm": "..", "baggage_aft_arm": "..",
    "cg_forward_limit": ".. (limite avant centrage)",
    "cg_aft_limit": ".. (limite arrière centrage)",
    "datum_reference": ".. (description du point de référence, ex: \"nose tip\", \"firewall\")"
  },
  "g_limits": {
    "max_positive_g_normal": ".. (ex: +3.8g cat Normal)",
    "max_negative_g_normal": ".. (ex: -1.5g)",
    "max_positive_g_utility": ".. (ex: +4.4g cat Utility)",
    "max_negative_g_utility": "..",
    "max_positive_g_aerobatic": ".. (ex: +6g cat Aerobatic)",
    "max_negative_g_aerobatic": ".."
  },
  "speeds": {
    "vso": ".. (stall flaps extended)", "vs1": ".. (stall clean)",
    "vfe": ".. (max flaps extended général)",
    "vfe_takeoff": ".. (VFE T/O flaps)", "vfe_landing": ".. (VFE LDG flaps)",
    "vfe_approach": ".. (si flaps APP distinct)",
    "vno": ".. (max structural cruising)", "vne": ".. (never exceed)",
    "vr": ".. (rotation)",
    "vx": ".. (best angle of climb)", "vy": ".. (best rate of climb)",
    "vx_takeoff": ".. (VX au décollage avec flaps T/O si distinct)",
    "vy_takeoff": ".. (VY au décollage avec flaps T/O si distinct)",
    "vapp": ".. (approach)", "vref": ".. (reference landing speed)",
    "vglide": ".. (best glide)",
    "vle": ".. (landing gear extended)", "vlo": ".. (gear operating)",
    "va": ".. (manoeuvring speed, dépend masse)",
    "initial_climb_rate": ".. (taux montée initiale en ft/min)"
  },
  "fuel": {
    "capacity_total": ".. (capacité totale)",
    "capacity_usable": ".. (capacité utilisable, exclut le fuel non-disponible)",
    "capacity_unusable": "..",
    "fuel_type": ".. (JET A-1, AVGAS 100LL, MOGAS UL91, ULSD...)",
    "fuel_grades_allowed": ".. (liste textuelle des carburants alternatifs autorisés)",
    "consumption_cruise": ".. en L/h ou GPH",
    "consumption_taxi": "..",
    "consumption_takeoff_climb": ".."
  },
  "wind_limits": {
    "max_crosswind": ".. (demonstrated crosswind component)",
    "max_tailwind": "..", "max_crosswind_wet": ".."
  },
  "performance_summary": {
    "takeoff_run": ".. (ground roll)",
    "takeoff_distance_50ft": ".. (distance totale passage 50ft / 15m)",
    "landing_run": ".. (landing ground roll)",
    "landing_distance_50ft": "..",
    "service_ceiling": ".. (plafond pratique)",
    "max_operating_altitude": ".. (plafond opérationnel certifié)",
    "cruise_speed_75percent": ".. (TAS à 75% puissance)",
    "cruise_speed_max": ".. (TAS max croisière)",
    "endurance": ".. (autonomie en heures à conso croisière)",
    "range_cruise": ".. (distance franchissable, NM ou km)"
  },
  "landing_gear": {
    "type": ".. (tricycle / tailwheel / retractable / fixed)",
    "tire_pressure_main": "..", "tire_pressure_nose": ".."
  },
  "compatibility": {
    "runway_surfaces": ".. (revêtements compatibles : asphalte, herbe, gravier, neige... liste textuelle)",
    "min_runway_length": ".."
  }
}
</schema>

<output_format>
Retourne UNIQUEMENT le JSON, sans markdown (pas de \`\`\`json), sans préambule,
sans commentaire. Ne retourne que les sections où tu as trouvé AU MOINS un champ.
Le JSON doit être directement parseable par JSON.parse().
</output_format>

<important>
- **DISTINCTION MAJEURE entre model et registration** :
  * "model" = TYPE générique de l'avion (ex: "DA40 NG", "Cessna 172S", "Piper PA-28-181")
  * "registration" = IMMATRICULATION spécifique du tail-number (ex: "F-HSTR",
    "N12345", "G-ABCD", "D-EFGH"). Format : préfixe pays + suffixe alphanumérique.
  * Le MANEX peut contenir les deux. Ne JAMAIS mettre une immatriculation dans
    "model" ni l'inverse.
- Si la page est un sommaire / table des matières / page blanche : retourne {}
- Si tu hésites entre 2 valeurs (ex: VR = 55 vs 60), choisis la plus probable et
  baisse la confidence à 50-65 pour signaler l'incertitude.
- Distingue VFE général de VFE TAKEOFF et VFE LANDING (souvent valeurs différentes).
- Pour les bras (arms), conserve le signe si négatif (FS - fuselage station).
- Pour les masses : si tu vois "1500 lbs / 680 kg" sur la même ligne, retourne
  la version en kg avec unit:"kg" (préférence métrique pour MANEX FR).
- Pour les surfaces piste compatibles : retourne string liste, ex:
  "asphalte, herbe, gravier" plutôt qu'un array (le mapper se charge de parser).
- Pour les certifications booléennes (IFR, icing) : retourne "Yes"/"No" en string.
- wake_turbulence_category : retourne "L" (Light), "M" (Medium) ou "H" (Heavy).
  Pour un avion GA monomoteur léger sous 7000 lbs : c'est "L".
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
