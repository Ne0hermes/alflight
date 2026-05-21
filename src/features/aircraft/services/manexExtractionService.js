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
    "manufacturer": ".. (MARQUE / CONSTRUCTEUR seul, ex: \"Cessna\", \"Diamond Aircraft\", \"Robin Aviation\", \"Piper Aircraft\", \"Cirrus Aircraft\". Sans le modèle.)",
    "model": ".. (MODÈLE seul, ex: \"172S\", \"DA40 NG\", \"DR400-180\", \"PA-28-181\". Sans la marque.)",
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
    "capacity_total": ".. (capacité totale carburant TOUS RÉSERVOIRS CONFONDUS, en L ou US gal)",
    "capacity_main": ".. (capacité du réservoir PRINCIPAL seul, si distinct du total. Ex: \"main tank: 110 L\" séparé d'un total de 200 L)",
    "capacity_wing_left": ".. (réservoir AILE GAUCHE / LEFT WING TANK, si présent)",
    "capacity_wing_right": ".. (réservoir AILE DROITE / RIGHT WING TANK, si présent)",
    "capacity_wing": ".. (réservoir d'aile UNIQUE / WING TANK, si l'avion a UN seul réservoir d'aile non latéralisé)",
    "capacity_tip": ".. (tip tank / réservoir d'EXTRÉMITÉ d'aile, si présent)",
    "capacity_aux": ".. (réservoir AUXILIAIRE / AUX TANK / réservoir de fuselage, si présent)",
    "capacity_optional": ".. (réservoir OPTIONNEL ajouté en kit, si présent)",
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
    "min_takeoff_weight": ".. (masse mini décollage, rare)"
  },
  "performance_summary": {
    "cruise_speed_75percent": ".. (TAS à 75% puissance, kt)"
  },

  "baggage": {
    "max_total_mass": ".. (masse maximale CUMULÉE des bagages tous compartiments confondus, en kg ou lbs. Exemple : « total baggage 80 kg » ou « max combined baggage load 175 lbs ». ⚠️ Différent des limites individuelles par compartiment.)"
  },

  "equipment_com": {
    "vhf1": "true|false (présence VHF COM 1, standard sur tous les avions équipés radio)",
    "vhf2": "true|false (présence VHF COM 2, fréquent en aviation générale)",
    "hf": "true|false (radio Haute Fréquence, rare en aviation générale)",
    "satcom": "true|false (communications satellite)",
    "acars": "true|false (Aircraft Communications Addressing and Reporting System)",
    "cpdlc": "true|false (Controller-Pilot Data Link Communications)"
  },
  "equipment_nav": {
    "vor": "true|false (récepteur VOR)",
    "dme": "true|false (Distance Measuring Equipment)",
    "adf": "true|false (Automatic Direction Finder, NDB)",
    "gnss": "true|false (GNSS/GPS)",
    "ils": "true|false (Instrument Landing System récepteur)",
    "mls": "true|false (Microwave Landing System)",
    "gbas": "true|false (Ground-Based Augmentation System)",
    "lpv": "true|false (approche LPV via SBAS/WAAS)",
    "ahrs": "true|false (Attitude and Heading Reference System)",
    "adc": "true|false (Air Data Computer)",
    "rnav": "true|false (capacité Area Navigation)",
    "rnav_types": ".. (texte libre si rnav=true, ex: 'B-RNAV, P-RNAV, RNAV 1, RNAV 5')",
    "rnp": "true|false (Required Navigation Performance)",
    "rnp_types": ".. (texte libre si rnp=true, ex: 'RNP 0.3, RNP APCH, RNP AR')"
  },
  "equipment_surv": {
    "adsb": "true|false (ADS-B receiver/transmitter)",
    "adsc": "true|false (ADS-C, Automatic Dependent Surveillance-Contract)",
    "tcas": "true|false (TCAS I)",
    "acas": "true|false (ACAS II / TCAS II)",
    "taws": "true|false (Terrain Awareness Warning System / EGPWS)",
    "cvr": "true|false (Cockpit Voice Recorder)",
    "fdr": "true|false (Flight Data Recorder)",
    "weather": "true|false (radar météo)",
    "transponder_modes": ".. (liste CSV des modes : 'A,C,S' — ou un seul si seul mode)",
    "adsb_out": "true|false (ADS-B Out spécifiquement)"
  },
  "special_capabilities": {
    "pbn": "true|false (Performance-Based Navigation approuvé)",
    "lvto": "true|false (Low Visibility Take-Off)",
    "cat_ii": "true|false (approche ILS catégorie II)",
    "cat_iiia": "true|false (cat IIIa)",
    "cat_iiib": "true|false (cat IIIb)",
    "cat_iiic": "true|false (cat IIIc)",
    "etops": "true|false (Extended-range Twin-engine Operational Performance Standards)",
    "rvsm": "true|false (Reduced Vertical Separation Minimum)",
    "mnps": "true|false (Minimum Navigation Performance Specifications)",
    "icing": "true|false (vol en conditions givrantes connues approuvé)"
  },
  "approved_operations": {
    "vfr_day": "true|false (VFR de jour autorisé)",
    "vfr_night": "true|false (VFR de nuit autorisé)",
    "ifr_day": "true|false (IFR de jour autorisé)",
    "ifr_night": "true|false (IFR de nuit autorisé)",
    "svfr": "true|false (Special VFR)",
    "formation": "true|false (vol en formation)",
    "aerobatics": "true|false (voltige aérienne approuvée)",
    "banner": "true|false (remorquage de banderoles)",
    "glider": "true|false (remorquage de planeurs)",
    "parachute": "true|false (largage de parachutistes)",
    "agricultural": "true|false (épandage agricole)",
    "aerial": "true|false (travail aérien autre / photographie)",
    "training": "true|false (utilisation école / instruction)",
    "charter": "true|false (transport public à la demande)",
    "mountainous": "true|false (vol en zone montagneuse approuvé)",
    "seaplane": "true|false (configuration hydravion)",
    "ski_plane": "true|false (configuration skis)"
  },
  "safety_equipment": {
    "elt": "true|false (Emergency Locator Transmitter installé, 121.5 ou 406 MHz)",
    "life_vests": "true|false (gilets de sauvetage à bord)",
    "fire_extinguisher_halon": "true|false (extincteur Halon)",
    "fire_extinguisher_water": "true|false (extincteur eau)",
    "fire_extinguisher_powder": "true|false (extincteur poudre)",
    "oxygen_bottles": "true|false (bouteilles oxygène)",
    "life_raft": "true|false (radeau de survie)",
    "survival_kit": "true|false (kit de survie)",
    "plb": "true|false (Personal Locator Beacon)",
    "first_aid_kit": "true|false (trousse de premiers secours)"
  }
}

NOTE IMPORTANTE :
- N'extrais PAS les bras de levier (front_seats_arm, rear_seats_arm, fuel_main_arm, etc.)
  → ces données seront déterminées par le pilote via la lecture graphique du
    centrogramme dans une étape dédiée (Détermination graphique des bras de levier).
- N'extrais PAS l'enveloppe de centrage (forward CG points, aft CG points, etc.)
  → également déterminée graphiquement.
- Concentre-toi sur les valeurs numériques scalaires bien identifiables ET les
  équipements/opérations listés explicitement dans le MANEX (sections "Equipment",
  "Avionics", "Approved Operations", "Limitations", "Kinds of Operations Equipment List").

RÈGLES SPÉCIFIQUES ÉQUIPEMENTS / OPÉRATIONS :

A) Booléens : retourner explicitement true ou false selon ce qui est trouvé.
   - true  : l'équipement est CITÉ comme installé/présent/approuvé
   - false : l'équipement est EXPLICITEMENT cité comme absent/non installé
   - OMETTRE le champ entièrement si le MANEX ne mentionne pas du tout cet équipement
     (ne pas inventer false par défaut). Le pilote saura que c'est "non analysé".

B) Confiance honnête sur les équipements :
   - 90-100 : MANEX dit clairement "ADS-B Out installed" → adsb_out = true, conf=95
   - 70-89  : déduit du contexte (ex: "Mode S transponder" → transponder_modes = "S")
   - 40-69  : présence ambiguë (mentionné dans une liste de specs sans être confirmé)
   - <40    : NE PAS retourner

C) Champs textuels (rnav_types, rnp_types, transponder_modes) :
   - Conserver le texte exact ou normalisé. Ex: "B-RNAV, P-RNAV" ou "A,C,S".

D) Opérations approuvées : chercher dans les sections "Approved Operations",
   "Operating Limitations", "Kinds of Operations Equipment List" (KOEL), ou
   les sections de limitations de vol.

E) Si une catégorie complète n'a aucun champ trouvé (ex: tu n'as vu aucune mention
   d'équipement COM dans les pages analysées), OMETTRE entièrement la section
   equipment_com plutôt que de retourner tous les champs à false. Ça permet à
   l'UI de distinguer "non analysé" vs "analysé et non présent".
</schema>

<output_format>
Retourne UNIQUEMENT le JSON, sans markdown (pas de \`\`\`json), sans préambule,
sans commentaire. Ne retourne que les sections où tu as trouvé AU MOINS un champ.
Le JSON doit être directement parseable par JSON.parse().
</output_format>

<important>
RÈGLES STRICTES D'EXTRACTION :

1) DISTINCTION ABSOLUE manufacturer ↔ model ↔ registration :
   - "manufacturer" = MARQUE/CONSTRUCTEUR seul (ex: "Cessna", "Diamond Aircraft",
     "Robin Aviation", "Piper Aircraft", "Cirrus Aircraft", "Beechcraft")
   - "model" = MODÈLE seul, SANS la marque (ex: "172S", "DA40 NG", "DR400-180",
     "PA-28-181", "SR22"). Si tu lis "Cessna 172S", split en manufacturer="Cessna"
     + model="172S".
   - "registration" = IMMATRICULATION (ex: "F-HSTR", "N12345", "G-ABCD")
   - JAMAIS confondre les 3.

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

9) Confiance honnête : si tu hésites entre 2 valeurs, baisse à 50-65 et
    choisis la plus probable. Mieux vaut un faible score qu'une fausse certitude.

10) BRAS DE LEVIER & ENVELOPPE DE CENTRAGE : NE PAS EXTRAIRE. Ces données sont
    déterminées graphiquement dans un wizard dédié, à partir d'une lecture par
    clic sur le centrogramme. Même si tu vois "Bras CG à vide : 2.13 m" écrit
    explicitement, n'extrais pas (le pilote le saisira manuellement ou via la
    lecture graphique).

11) RÉSERVOIRS CARBURANT — DÉCOMPOSITION :
    - Si le MANEX donne UNIQUEMENT une valeur totale (ex: "Fuel capacity: 200 L"),
      remplis SEULEMENT capacity_total.
    - Si le MANEX donne le détail par réservoir (ex: "Main tank: 110 L, Wing tanks:
      2 × 45 L"), remplis capacity_main + capacity_wing_left + capacity_wing_right
      (ne remplis capacity_total que si calculé EXPLICITEMENT par le MANEX).
    - Tip tank, réservoir auxiliaire, optionnel : extrais-les chacun séparément.
    - Si seules les capacités de gauche ET de droite sont indiquées et identiques,
      remplis les deux quand même (capacity_wing_left + capacity_wing_right).
    - Distingue bien "USABLE" (utile) de "TOTAL" (avec inutile). Préfère USABLE.
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
