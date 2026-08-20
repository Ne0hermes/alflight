// src/abac/curves/core/plancheSetup.ts
//
// Lot 1-C — DÉDUCTION du set depuis l'écran « Opération » de l'atelier.
// L'utilisateur répond à TROIS questions (opération canonique, type de
// planche, nombre de panneaux) et tout ce que l'audit-7 classait en pièges
// (rôles, lecture descendante, familles, chaîne) est déduit ici.
//
// VÉRITÉ MOTEUR (cascade.ts — positionnel) :
//   • premier graphe de la chaîne = panneau d'ENTRÉE (bracket par famille) ;
//   • graphes suivants = corrections (suivi de pente) ;
//   • dernier graphe éventuellement `readoutAxis: 'x'` (lecture descendante :
//     le résultat se lit sur l'échelle du bas — planches Piper).
// Le rôle 'primary' sert uniquement à porter l'operationId et à identifier le
// DÉPART de chaîne pour l'adaptateur : LE PRIMAIRE EST LE PREMIER CADRE
// (convention des modèles existants F-GIEA/F-GUVV — ne jamais le mettre en
// dernier, même en lecture descendante).
//
// Fonctions PURES (générateur d'id injecté) → testées dans
// __tests__/plancheSetup.test.ts.

import { GraphConfig, WorkshopFrame } from './types';
import { getOperation } from './operationCatalog';

/** Type de planche choisi à l'écran « Opération » (persisté en
 *  metadata.plancheType — informatif, le moteur ne lit que readoutAxis). */
export type PlancheType = 'standard' | 'descendante';

export interface SetupChoice {
  /** operationId du catalogue canonique (résolu par le classifieur). */
  operationId: string;
  plancheType: PlancheType;
  /** Nombre de panneaux (cadres) de la chaîne, 1..5. */
  panelCount: number;
}

/** Défauts du sélecteur de panneaux : 3 en standard, 2 en descendante. */
export const DEFAULT_PANEL_COUNT: Record<PlancheType, number> = {
  standard: 3,
  descendante: 2
};

// Géométrie par défaut du WorkshopCanvas (width 960, MARGIN left 64/right 16).
// Les cadres pré-répartis reprennent la formule du bandeau compat D4
// (WorkshopCanvas.handleConvertExisting) : gap 12, largeur égale, min 60.
const CANVAS_INNER_W = 960 - 64 - 16; // 880
const FRAME_GAP = 12;
const FRAME_MIN_W = 60;

const emptyAxes = (): GraphConfig['axes'] => ({
  xAxis: { min: 0, max: 100, unit: '', title: '' },
  yAxis: { min: 0, max: 100, unit: '', title: '' }
});

/** Nom utile déduit de la position dans la chaîne. */
export function defaultPanelName(idx: number, total: number, plancheType: PlancheType): string {
  if (idx === 0) return 'Panneau d\'entrée';
  if (plancheType === 'descendante' && idx === total - 1) return 'Zone de sortie (lue en bas)';
  return `Correction ${idx + 1}`;
}

/** Vrai si le nom vient d'une génération automatique (renommable sans perdre
 *  un libellé personnalisé de l'utilisateur). */
export const isAutoPanelName = (name: string): boolean =>
  /^(Panneau d'entrée|Correction \d+|Zone de sortie \(lue en bas\)|Graphique \d+|Graphique principal)$/.test(name || '');

/** Répartition régulière de N cadres sur la largeur du canevas (D4). */
export function distributeFrames(graphIds: string[]): WorkshopFrame[] {
  const n = graphIds.length;
  if (n === 0) return [];
  const w = Math.max(FRAME_MIN_W, Math.floor((CANVAS_INNER_W - FRAME_GAP * (n + 1)) / n));
  return graphIds.map((graphId, i) => ({
    graphId,
    xLeftPx: FRAME_GAP + i * (w + FRAME_GAP),
    xRightPx: FRAME_GAP + i * (w + FRAME_GAP) + w
  }));
}

/** CRÉATION (set vierge) : N graphes ENTIÈREMENT DÉDUITS + N cadres
 *  pré-répartis. Graphe 1 (le plus à gauche) : primaire, operationId (+
 *  outputKind/outputUnit si l'opération n'accepte qu'une sortie), famille
 *  suggérée 'pressure_altitude' (modifiable ensuite). Suivants :
 *  intermédiaires. Dernier en descendante : readoutAxis 'x', famille
 *  'wind_component', isWindRelated. */
export function buildSetupGraphs(
  choice: SetupChoice,
  mkId: () => string
): { graphs: GraphConfig[]; frames: WorkshopFrame[] } {
  const op = getOperation(choice.operationId);
  const onlyOutput = op && op.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
  const graphs: GraphConfig[] = Array.from({ length: choice.panelCount }, (_, i) => {
    const isFirst = i === 0;
    // !isFirst : un set descendant a toujours ≥ 2 panneaux (entrée + zone de
    // sortie) — garde de robustesse si la fonction est appelée avec 1.
    const isDescOut = choice.plancheType === 'descendante' && i === choice.panelCount - 1 && !isFirst;
    return {
      id: mkId(),
      name: defaultPanelName(i, choice.panelCount, choice.plancheType),
      isWindRelated: isDescOut,
      role: isFirst ? 'primary' as const : 'intermediate' as const,
      ...(isFirst ? {
        operationId: choice.operationId,
        ...(onlyOutput ? { outputKind: onlyOutput.kind, outputUnit: onlyOutput.defaultUnit } : {}),
        // Suggestion la plus courante des panneaux d'entrée (OAT × altitude).
        familyAxisVariable: 'pressure_altitude'
      } : {}),
      ...(isDescOut ? { readoutAxis: 'x' as const, familyAxisVariable: 'wind_component' } : {}),
      axes: emptyAxes(),
      curves: []
    };
  });
  return { graphs, frames: distributeFrames(graphs.map(g => g.id)) };
}

/** APPLIQUER (retour via « Modifier ») : réécrit operationId / rôles /
 *  readoutAxis / familles sur la chaîne `chainIds` (ordre gauche→droite des
 *  cadres) SANS toucher aux graphes hors chaîne, SANS recréer les cadres.
 *  Conserve les noms personnalisés (seuls les noms auto sont re-générés) et
 *  les familles déjà choisies (la suggestion ne s'applique que si absente). */
export function applySetupRoles(
  graphs: GraphConfig[],
  chainIds: string[],
  choice: SetupChoice
): GraphConfig[] {
  const op = getOperation(choice.operationId);
  const onlyOutput = op && op.acceptedOutputs.length === 1 ? op.acceptedOutputs[0] : null;
  return graphs.map(g => {
    const idx = chainIds.indexOf(g.id);
    if (idx === -1) return g;
    const isFirst = idx === 0;
    const isDescOut = choice.plancheType === 'descendante' && idx === chainIds.length - 1 && !isFirst;
    // outputKind conservé s'il reste valide pour la (nouvelle) opération.
    const keptKind = g.outputKind && op && op.acceptedOutputs.some(o => o.kind === g.outputKind)
      ? g.outputKind
      : undefined;
    return {
      ...g,
      ...(isAutoPanelName(g.name) ? { name: defaultPanelName(idx, chainIds.length, choice.plancheType) } : {}),
      role: isFirst ? 'primary' as const : 'intermediate' as const,
      // Le primaire porte l'identité du set ; les autres la perdent (même
      // geste que le radio « Intermédiaire » du GraphIdentityPanel).
      operationId: isFirst ? choice.operationId : undefined,
      outputKind: isFirst ? (onlyOutput ? onlyOutput.kind : keptKind) : undefined,
      outputUnit: isFirst ? (onlyOutput ? onlyOutput.defaultUnit : (keptKind ? g.outputUnit : undefined)) : undefined,
      // Lecture descendante UNIQUEMENT sur le dernier graphe de la chaîne
      // (exigence moteur, cascade.ts:1735) — cleared partout ailleurs, donc
      // un passage descendante → standard nettoie l'ancien readoutAxis.
      readoutAxis: isDescOut ? 'x' as const : undefined,
      ...(isDescOut ? { isWindRelated: true } : {}),
      familyAxisVariable: isFirst
        ? (g.familyAxisVariable || 'pressure_altitude')
        : isDescOut
          ? (g.familyAxisVariable || 'wind_component')
          : g.familyAxisVariable
    };
  });
}

/** Panneaux AJOUTÉS en mode « Appliquer » (nombre augmenté, confirmé par
 *  l'utilisateur) : graphes vierges + cadres appendus à droite du dernier
 *  cadre (même geste que « ＋ Ajouter un cadre » du canevas). Sans cadre
 *  existant (modèle legacy non converti) : aucun cadre créé — le bandeau
 *  compat D4 les créera d'un bloc. Les noms provisoires « Graphique N » sont
 *  re-générés par applySetupRoles (noms auto). */
export function appendPanels(
  existingFrames: WorkshopFrame[],
  count: number,
  startIndex: number,
  mkId: () => string
): { graphs: GraphConfig[]; frames: WorkshopFrame[] } {
  const graphs: GraphConfig[] = Array.from({ length: count }, (_, k) => ({
    id: mkId(),
    name: `Graphique ${startIndex + k + 1}`,
    isWindRelated: false,
    axes: emptyAxes(),
    curves: []
  }));
  const frames: WorkshopFrame[] = [];
  if (existingFrames.length > 0) {
    let lastRight = Math.max(...existingFrames.map(f => f.xRightPx));
    for (const g of graphs) {
      const left = Math.min(lastRight + 14, Math.max(0, CANVAS_INNER_W - FRAME_MIN_W - 4));
      const right = Math.min(CANVAS_INNER_W - 2, left + Math.max(FRAME_MIN_W, Math.round(CANVAS_INNER_W / 4)));
      frames.push({ graphId: g.id, xLeftPx: left, xRightPx: right });
      lastRight = right;
    }
  }
  return { graphs, frames };
}
