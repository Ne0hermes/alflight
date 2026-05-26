// src/abac/v2/aiChartAnalysisService.js
//
// Détecte automatiquement les courbes et leurs points sur une image de graphique
// d'abaque (page de manuel de vol rasterisée), via gpt-4o vision.
//
// Hypothèse : l'utilisateur a déjà calé l'image en filigrane dans le Chart pour que
// les axes du graphique du manuel correspondent visuellement aux axes du Chart.
// L'IA reçoit en contexte les bornes data des axes + l'image, et retourne les
// points caractéristiques de chaque courbe DANS LE REPÈRE DATA (donc utilisables
// directement par le Chart).

import unifiedPerformanceService from '@features/performance/services/unifiedPerformanceService';

// Palette de couleurs distinctes pour chaque courbe détectée.
// Choisies pour rester lisibles sur fond clair et bien se différencier entre elles.
export const AI_CURVE_COLORS = [
  '#ef4444', // rouge
  '#3b82f6', // bleu
  '#10b981', // vert
  '#f59e0b', // orange
  '#a855f7', // violet
  '#06b6d4', // cyan
  '#ec4899', // rose
  '#84cc16'  // lime
];

// System message neutre — évite les heuristiques de refus qu'OpenAI applique
// parfois sur "aviation" / "manuel de vol".
const NEUTRAL_SYSTEM = 'You are a precise mathematical chart digitizer. Your job is to read XY plot data from chart images and return clean numeric points in JSON.';

function buildPrompt(axesConfig, extraContext) {
  const x = axesConfig.xAxis;
  const y = axesConfig.yAxis;
  const xLabel = `${x.title}${x.unit ? ` (${x.unit})` : ''}`;
  const yLabel = `${y.title}${y.unit ? ` (${y.unit})` : ''}`;

  const userHint = extraContext && extraContext.trim()
    ? `\n\nContexte fourni par l'utilisateur : ${extraContext.trim()}\n`
    : '';

  // Prompt volontairement générique : on parle de "graphique XY mathématique"
  // sans mentionner "manuel de vol" / "performance d'avion" pour éviter les refus.
  return `Image d'un graphique XY (courbes mathématiques). Digitalise les courbes visibles.

Axes du graphique :
- X : ${xLabel}, plage ${x.min} → ${x.max}
- Y : ${yLabel}, plage ${y.min} → ${y.max}${userHint}

Cherche dans l'image :
- Toute ligne continue qui traverse le repère cartésien. Ce sont des courbes à digitaliser.
- Chaque courbe peut porter une étiquette : un nombre, une lettre, ou un nom (ex: "0", "5000", "10000", "1.5", "ISA", "A", "B"). Ces étiquettes sont souvent écrites le long ou à l'extrémité de la courbe.

Pour chaque courbe trouvée :
1. Lis son étiquette si présente. Si non, attribue "Courbe 1", "Courbe 2", etc.
2. Échantillonne 10 à 20 points le long de la courbe (extrémités, points d'inflexion, points intermédiaires régulièrement espacés).
3. Donne les coordonnées dans le repère du graphique (en unités de l'axe, PAS en pixels). Utilise les graduations visibles des axes comme référence.

Règles importantes :
- Si tu vois plusieurs lignes proches ou qui se croisent, retourne-les comme des courbes DISTINCTES.
- N'invente pas une courbe si tu n'en vois pas.
- Si tu ne distingues AUCUNE courbe lisible, retourne curves: [] et explique pourquoi dans notes (image floue, zone vide, etc.).

Format de sortie (JSON valide, sans markdown, sans commentaires) :
{
  "curves": [
    {
      "name": "...",
      "label_seen": "..." | null,
      "points": [{ "x": <number>, "y": <number> }, ...]
    }
  ],
  "notes": "..."
}

Réponds UNIQUEMENT avec du JSON.`;
}

function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[aiChartAnalysis] JSON parse failed:', e.message);
    return null;
  }
}

/**
 * Analyse une image de graphique pour extraire automatiquement les courbes et points.
 *
 * @param {string} imageDataUrl - data URL (base64) de l'image en filigrane
 * @param {Object} axesConfig - { xAxis: { title, unit, min, max }, yAxis: { ... } }
 * @param {Object} [options]
 * @param {string} [options.extraContext] - Contexte libre fourni par l'utilisateur, injecté
 *        dans le prompt pour aider l'IA (ex: "Les courbes représentent des altitudes de pression en pieds").
 * @returns {Promise<{ curves: Array<{ name, label_seen, points, color }>, notes }>}
 */
export async function analyzeChartImage(imageDataUrl, axesConfig, options = {}) {
  if (!imageDataUrl) throw new Error('Aucune image fournie');
  if (!axesConfig?.xAxis || !axesConfig?.yAxis) throw new Error('axesConfig manquant');

  const prompt = buildPrompt(axesConfig, options.extraContext);

  // Note : callOpenAI retourne soit un objet (déjà parsé via le bloc try/catch interne du service)
  // soit la string brute. On normalise.
  // On passe un system message neutre pour minimiser les refus liés au contexte "aviation".
  const raw = await unifiedPerformanceService.callOpenAI(imageDataUrl, prompt, {
    systemMessage: NEUTRAL_SYSTEM
  });

  let data;
  if (typeof raw === 'string') {
    data = safeParseJSON(raw);
  } else if (raw && typeof raw === 'object') {
    data = raw;
  }

  if (!data || !Array.isArray(data.curves)) {
    console.warn('[aiChartAnalysis] Réponse invalide :', data);
    throw new Error('Réponse IA invalide (pas de tableau curves)');
  }

  // Filtrer : retirer les courbes sans points exploitables et clamper les coords dans les bornes
  const { xMin, xMax } = axesConfig.xAxis;
  const { yMin, yMax } = axesConfig.yAxis;
  const inBoundsX = (v) => typeof v === 'number' && isFinite(v) && v >= Math.min(xMin, xMax) && v <= Math.max(xMin, xMax);
  const inBoundsY = (v) => typeof v === 'number' && isFinite(v) && v >= Math.min(yMin, yMax) && v <= Math.max(yMin, yMax);

  const enrichedCurves = data.curves
    .filter(c => Array.isArray(c.points) && c.points.length >= 2)
    .map((c, idx) => {
      const validPoints = c.points
        .filter(p => p && typeof p === 'object' && inBoundsX(p.x) && inBoundsY(p.y))
        .map(p => ({ x: Number(p.x), y: Number(p.y) }));
      return {
        name: c.name || `Courbe ${idx + 1}`,
        label_seen: c.label_seen || null,
        points: validPoints,
        color: AI_CURVE_COLORS[idx % AI_CURVE_COLORS.length]
      };
    })
    .filter(c => c.points.length >= 2);

  return {
    curves: enrichedCurves,
    notes: data.notes || null
  };
}

export default { analyzeChartImage, AI_CURVE_COLORS };
