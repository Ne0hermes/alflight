// src/abac/curves/core/guideMode.ts
// ============================================================================
// 🧭 GUIDES NUMÉROTÉS — retour pilote du 23/08/2026
// ----------------------------------------------------------------------------
// « Lorsque je configure les courbes de vent et de masse, il me demande de
//   donner des masses et des forces de vent. Ce n'est jamais une question de
//   valeur de courbe : c'est simplement un numéro qui permet de différencier
//   les courbes entre elles. »
//
// VÉRITÉ MOTEUR (cascade.ts → calculateOutputWithParameterCorrect) : sur un
// panneau de CORRECTION (graphe non-premier, lecture standard sur Y), les
// courbes sont des GUIDES DE PENTE. Le moteur les trie par leur ordonnée à la
// ligne de référence (yAtRef) et suit la pente entre les deux guides qui
// encadrent la valeur transférée : il ne lit JAMAIS leur valeur. Il exige
// seulement un nombre FINI et DISTINCT par guide — un simple numéro d'ordre —
// et, sur un panneau vent, le tag `windDirection` qui filtre par sens.
//
// Les seules courbes qui portent une VRAIE valeur :
//   • le PREMIER graphe de la chaîne (famille d'entrée : 0 / 2000 / 4000 ft…),
//     bracké par valeur (cascade.ts, branche i === 0) ;
//   • une zone en LECTURE DESCENDANTE (`readoutAxis: 'x'`), dont les guides
//     de vent sont bracketés par valeur SIGNÉE (+15 face / 0 / −5 arrière).
//
// Ce module centralise la règle pour que l'atelier cesse de réclamer des
// masses et des vents là où le moteur n'attend qu'une numérotation.
// ============================================================================

import { GraphConfig, Curve, WorkshopConfig } from './types';

/**
 * Ce graphe utilise-t-il des GUIDES NUMÉROTÉS (aucune valeur à saisir) ?
 * Vrai pour tout panneau de correction : ni le premier de la chaîne, ni une
 * zone en lecture descendante.
 */
export function usesNumberedGuides(
  graph: Pick<GraphConfig, 'readoutAxis'> | null | undefined,
  isFirst: boolean
): boolean {
  if (!graph) return false;
  if (isFirst) return false;
  if (graph.readoutAxis === 'x') return false;
  return true;
}

/**
 * Ordre de lecture des cadres (gauche → droite) : l'ordre des `xLeftPx` EST la
 * chaîne de calcul (effet R2a du builder). Retourne les identifiants de graphe.
 */
export function orderedGraphIds(workshop: Pick<WorkshopConfig, 'frames'> | null | undefined): string[] {
  const frames = workshop?.frames;
  if (!Array.isArray(frames)) return [];
  return [...frames].sort((a, b) => a.xLeftPx - b.xLeftPx).map(f => f.graphId);
}

/** Le graphe est-il le PREMIER cadre (panneau d'entrée) de l'atelier ? */
export function isFirstFramedGraph(
  workshop: Pick<WorkshopConfig, 'frames'> | null | undefined,
  graphId: string | null | undefined
): boolean {
  if (!graphId) return false;
  const ids = orderedGraphIds(workshop);
  return ids.length > 0 && ids[0] === graphId;
}

/** Numéro lisible d'un guide : `familyValue` si fini, sinon le nombre du nom. */
export function guideNumber(curve: Curve | null | undefined): number | null {
  if (!curve) return null;
  if (typeof curve.familyValue === 'number' && Number.isFinite(curve.familyValue)) {
    return curve.familyValue;
  }
  const m = (curve.name || '').match(/-?\d+(?:\.\d+)?/);
  const v = m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(v) ? v : null;
}

/**
 * Prochain numéro libre pour un nouveau guide : max des numéros existants + 1
 * (1 si le graphe n'a encore aucun guide numéroté). Les numéros n'ont pas de
 * signification physique — ils doivent seulement être distincts.
 */
export function nextGuideNumber(curves: Curve[] | null | undefined): number {
  const nums = (curves || []).map(guideNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) return 1;
  return Math.floor(Math.max(...nums)) + 1;
}

/**
 * Nom automatique d'un guide numéroté. Sur un panneau vent, le SENS reste
 * porté par le nom ET par le tag `windDirection` (le moteur filtre dessus).
 */
export function guideAutoName(
  n: number,
  windDirection?: 'headwind' | 'tailwind' | 'none' | ''
): string {
  if (windDirection === 'headwind') return `Face ${n}`;
  if (windDirection === 'tailwind') return `Arrière ${n}`;
  return `Guide ${n}`;
}
