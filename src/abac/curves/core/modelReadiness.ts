// src/abac/curves/core/modelReadiness.ts
//
// Lot 1-D — CALCULATEUR D'AVANCEMENT DU MODÈLE (refonte atelier abaques).
//
// Module PUR (aucun React, aucun effet, aucune mutation des entrées) qui dit
// à la checklist permanente ce qui est fait / à faire / bloquant :
//   - par cadre  : computeGraphReadiness(graph, ctx)
//   - pour le set : computeSetReadiness(graphs, workshop, referenceCases, modelName)
//
// Source métier : audit-4.md §5 « fil conducteur » — promouvoir en checklist
// visible en permanence les validations aujourd'hui éparpillées entre le
// <details> replié du panneau d'identité, le needsAttention limité aux
// primaires et les window.confirm du save (AbacBuilder.handleExportJSON).
//
// Sémantique des états :
//   - 'done'    : l'étape du parcours est faite.
//   - 'todo'    : pas encore fait — rien de contradictoire, juste à faire.
//   - 'blocked' : configuration CONTRADICTOIRE (lecture X hors dernier cadre,
//                 deux primaires, chaîne invalide…) — à corriger, pas à finir.
//
// canSave : décision existante (R13, « le pilote juge ») — le banc de
// référence en échec est un AVERTISSEMENT : il apparaît 'blocked' dans la
// checklist mais N'EMPÊCHE PAS l'enregistrement. Tous les autres 'blocked'
// du set le bloquent.
//
// Convention « saisi vs défaut » : les graphes naissent avec des axes
// 0..100 sans pas ni titre (AbacBuilder.addGraphToWorkshop) — on considère
// des bornes « saisies » quand min/max sont finis ET distincts ET qu'un pas
// (> 0) est renseigné : le pas est le discriminant fiable entre un axe
// intact et un axe configuré dans le wizard.

import type {
  Curve,
  GraphConfig,
  ReferenceCase,
  WorkshopConfig,
  WorkshopFrame
} from './types';
import { validateGraphChain } from './cascade';
import { ensureFittedGraphs } from './fittedRuntime';
import { runAllReferenceCases } from './referenceBench';
import { getOperation } from './operationCatalog';
import { getAxisVariable, getAxisVariableLabel } from './axisVariables';
import { usesNumberedGuides, guideNumber } from './guideMode';

// ─────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────

export interface ReadinessItem {
  id: string;
  label: string;
  state: 'done' | 'todo' | 'blocked';
  detail?: string;
}

/** Contexte de position d'un graphe dans la chaîne (ordre des cadres). */
export interface GraphReadinessContext {
  /** Premier cadre de la chaîne (gauche → droite sur l'image). */
  isFirst: boolean;
  /** Dernier cadre de la chaîne. */
  isLast: boolean;
  /** Cadre du graphe sur l'image (undefined si pas encore cadré). */
  frame?: WorkshopFrame;
  /** Y commun calibré au niveau du set (info affichée en détail — la
   *  vérification elle-même vit dans computeSetReadiness). */
  sharedYCalibrated: boolean;
}

export interface SetReadinessResult {
  items: ReadinessItem[];
  canSave: boolean;
}

/** Id de l'item « banc de test » du set — le seul dont l'état 'blocked'
 *  n'empêche PAS l'enregistrement (avertissement, décision R13). */
export const READINESS_BENCH_ITEM_ID = 'set:reference-bench';

// ─────────────────────────────────────────────────────────────────────────
// Helpers purs
// ─────────────────────────────────────────────────────────────────────────

const isPrimaryRole = (g: GraphConfig): boolean => (g.role || 'primary') === 'primary';

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** Bornes « saisies » : min/max finis et distincts + pas > 0 (cf. en-tête). */
function axisBoundsEntered(axis?: { min: number; max: number; step?: number }): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!axis || !isFiniteNumber(axis.min) || !isFiniteNumber(axis.max) || axis.min === axis.max) {
    missing.push('bornes (min / max)');
  }
  if (!axis || !isFiniteNumber(axis.step) || (axis.step as number) <= 0) {
    missing.push('pas entre graduations');
  }
  return { ok: missing.length === 0, missing };
}

const hasFamilyValue = (c: Curve): boolean => isFiniteNumber(c.familyValue);

const curveCountLabel = (n: number): string => `${n} courbe${n > 1 ? 's' : ''}`;

// ─────────────────────────────────────────────────────────────────────────
// Avancement PAR CADRE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Checklist d'un graphe, dans l'ordre du parcours réel de construction :
 *   ① variable d'axe X choisie (canonique)
 *   ② bornes / pas X saisis
 *   ③ calibration X du cadre faite (≥ 2 graduations cliquées)
 *   ④ identité : premier cadre → primaire + opération + famille ;
 *                 lecture descendante (readoutAxis 'x') → famille + dernier cadre
 *   ⑤ au moins 1 courbe avec ≥ 2 points
 *   ⑥ si famille déclarée : toutes les courbes portent familyValue
 *   ⑦ si graphe vent : toutes les courbes ont une direction de vent
 *
 * Les items ④/⑥/⑦ ne sont émis que lorsqu'ils s'appliquent au graphe.
 */
export function computeGraphReadiness(
  graph: GraphConfig,
  ctx: GraphReadinessContext
): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const gid = graph.id;
  const curves = graph.curves || [];
  const isReadoutX = graph.readoutAxis === 'x';

  // ── ① Variable d'axe X (canonique) ─────────────────────────────────────
  {
    const xTitle = graph.axes?.xAxis?.title;
    const xVar = getAxisVariable(xTitle);
    const label = isReadoutX
      ? "Variable de l'axe X (sortie lue en bas)"
      : "Variable de l'axe X";
    if (!xTitle) {
      items.push({
        id: `${gid}:x-variable`, label, state: 'todo',
        detail: "aucune variable choisie pour l'axe X de ce cadre"
      });
    } else if (!xVar) {
      items.push({
        id: `${gid}:x-variable`, label, state: 'todo',
        detail: `« ${xTitle} » n'est pas une variable canonique du catalogue — choisis-la dans la liste`
      });
    } else if (xVar.id === 'custom') {
      items.push({
        id: `${gid}:x-variable`, label, state: 'todo',
        detail: "l'axe de transfert ne convient pas à l'axe X — choisis la variable réelle (OAT, masse, vent, distance…)"
      });
    } else {
      items.push({
        id: `${gid}:x-variable`, label, state: 'done',
        detail: xVar.label
      });
    }
  }

  // ── ② Bornes / pas de l'axe X ──────────────────────────────────────────
  {
    const check = axisBoundsEntered(graph.axes?.xAxis);
    items.push({
      id: `${gid}:x-bounds`,
      label: "Bornes et pas de l'axe X",
      state: check.ok ? 'done' : 'todo',
      ...(check.ok
        ? {}
        : { detail: `à saisir : ${check.missing.join(' et ')}` })
    });
  }

  // ── ③ Calibration X du cadre (clics graduations) ───────────────────────
  {
    const ticks = ctx.frame?.xTicks?.length ?? 0;
    if (!ctx.frame) {
      items.push({
        id: `${gid}:x-calibration`,
        label: 'Calibration X du cadre',
        state: 'todo',
        detail: "cadre non posé sur l'image — dessine d'abord le cadre de ce graphe"
      });
    } else if (ticks < 2) {
      items.push({
        id: `${gid}:x-calibration`,
        label: 'Calibration X du cadre',
        state: 'todo',
        detail: `clique au moins 2 graduations X sur l'image (${ticks}/2)`
      });
    } else {
      items.push({
        id: `${gid}:x-calibration`,
        label: 'Calibration X du cadre',
        state: 'done',
        ...(ctx.sharedYCalibrated
          ? {}
          : { detail: 'X calibré — le Y commun du set reste à calibrer (voir checklist du set)' })
      });
    }
  }

  // ── ④ Identité du cadre ────────────────────────────────────────────────
  if (isReadoutX) {
    // Lecture descendante : famille des guides obligatoire, dernier cadre
    // obligatoire, jamais le premier (règles miroir de validateGraphChain).
    const problems: string[] = [];
    if (ctx.isFirst) {
      problems.push("la lecture sur X est impossible sur le premier cadre (il reçoit son entrée sur X)");
    } else if (!ctx.isLast) {
      problems.push("la lecture sur X n'est autorisée que sur le DERNIER cadre de la chaîne — déplace le cadre ou repasse en lecture standard");
    }
    if (!graph.familyAxisVariable) {
      problems.push('variable de famille des guides requise (ex. composante de vent signée) — sans elle la zone est illisible');
    }
    items.push({
      id: `${gid}:identity`,
      label: 'Lecture descendante (résultat sur X)',
      state: problems.length > 0 ? 'blocked' : 'done',
      ...(problems.length > 0
        ? { detail: problems.join(' · ') }
        : { detail: `famille : ${getAxisVariableLabel(graph.familyAxisVariable)}` })
    });
  } else if (ctx.isFirst) {
    // Premier cadre : c'est lui qui porte l'identité du set (primaire +
    // opération canonique) et la famille de ses courbes.
    const problems: string[] = [];
    if (!isPrimaryRole(graph)) {
      problems.push("le premier cadre devrait être le graphique primaire (celui qui porte l'opération du set)");
    } else if (!graph.operationId) {
      problems.push('aucune opération canonique sélectionnée (classifieur Phase / Métrique / Volets)');
    } else if (!getOperation(graph.operationId)) {
      problems.push(`operationId « ${graph.operationId} » inconnu du catalogue`);
    }
    if (!graph.familyAxisVariable) {
      problems.push('variable de famille des courbes non déclarée (ex. altitude pression)');
    }
    items.push({
      id: `${gid}:identity`,
      label: 'Identité du premier cadre (primaire + opération)',
      state: problems.length > 0 ? 'todo' : 'done',
      ...(problems.length > 0
        ? { detail: problems.join(' · ') }
        : { detail: getOperation(graph.operationId)?.labelFr })
    });
  }
  // (Cadre intermédiaire standard hors premier : pas d'item ④ — son identité
  //  est sa position dans la chaîne, vérifiée au niveau du set.)

  // ── ⑤ Au moins 1 courbe avec ≥ 2 points ────────────────────────────────
  {
    const usable = curves.filter(c => (c.points?.length ?? 0) >= 2);
    if (usable.length > 0) {
      items.push({
        id: `${gid}:curves`,
        label: 'Courbes tracées',
        state: 'done',
        detail: curveCountLabel(usable.length)
      });
    } else {
      items.push({
        id: `${gid}:curves`,
        label: 'Courbes tracées',
        state: 'todo',
        detail: curves.length === 0
          ? 'aucune courbe tracée — trace au moins une courbe (≥ 2 points)'
          : 'aucune courbe ne compte au moins 2 points'
      });
    }
  }

  // ── ⑥ Valeurs de famille des courbes ───────────────────────────────────
  // 23/08 (retour pilote) : sur un panneau de CORRECTION, les courbes sont des
  // guides de pente — le moteur ne lit pas leur valeur, il exige seulement un
  // NUMÉRO distinct par guide. On vérifie donc la numérotation, pas une masse
  // ou un vent (qui n'ont jamais eu de sens ici).
  if (usesNumberedGuides(graph, ctx.isFirst) && curves.length > 0) {
    const sansNumero = curves.filter(c => guideNumber(c) === null);
    items.push({
      id: `${gid}:family-values`,
      label: 'Numérotation des guides',
      state: sansNumero.length > 0 ? 'todo' : 'done',
      detail: sansNumero.length > 0
        ? `${curveCountLabel(sansNumero.length)} sur ${curves.length} sans numéro — utilise « Déduire des noms » ou recrée le guide`
        : `${curveCountLabel(curves.length)} numérotés`
    });
  } else if (graph.familyAxisVariable && curves.length > 0) {
    const missing = curves.filter(c => !hasFamilyValue(c));
    items.push({
      id: `${gid}:family-values`,
      label: 'Valeurs de famille des courbes',
      state: missing.length > 0 ? 'todo' : 'done',
      detail: missing.length > 0
        ? `${curveCountLabel(missing.length)} sur ${curves.length} sans valeur de famille (${getAxisVariableLabel(graph.familyAxisVariable)}) — saisis-la dans le gestionnaire de courbes`
        : `${getAxisVariableLabel(graph.familyAxisVariable)} renseignée sur ${curveCountLabel(curves.length)}`
    });
  }

  // ── ⑦ Direction du vent (si graphe vent) ───────────────────────────────
  if (graph.isWindRelated && curves.length > 0) {
    const missing = curves.filter(c => !c.windDirection);
    items.push({
      id: `${gid}:wind-direction`,
      label: 'Direction du vent des courbes',
      state: missing.length > 0 ? 'todo' : 'done',
      ...(missing.length > 0
        ? { detail: `${curveCountLabel(missing.length)} sans direction de vent (face / arrière / vent nul)` }
        : {})
    });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────
// Avancement DU SET
// ─────────────────────────────────────────────────────────────────────────

/** Cadres triés gauche → droite : c'est l'ordre de la chaîne (R2a). */
function orderedFramesOf(workshop: WorkshopConfig): WorkshopFrame[] {
  return [...(workshop.frames || [])].sort((a, b) => a.xLeftPx - b.xLeftPx);
}

/**
 * Chaîne ordonnée par les cadres, avec linkedFrom/linkedTo NORMALISÉS sur
 * cet ordre (réplique pure de l'effet R2a d'AbacBuilder — la checklist ne
 * doit pas dépendre d'un état de liens transitoire).
 */
function chainFromFrames(graphs: GraphConfig[], workshop: WorkshopConfig): GraphConfig[] {
  const chain = orderedFramesOf(workshop)
    .map(f => graphs.find(g => g.id === f.graphId))
    .filter((g): g is GraphConfig => !!g);
  return chain.map((g, i) => ({
    ...g,
    linkedFrom: i > 0 ? [chain[i - 1].id] : [],
    linkedTo: i < chain.length - 1 ? [chain[i + 1].id] : []
  }));
}

/**
 * Checklist du set :
 *   ① exactement 1 primaire avec operationId valide (catalogue)
 *   ② tous les graphes cadrés sur l'image
 *   ③ Y commun calibré (≥ 2 graduations) OU bornes/pas saisis
 *   ④ chaîne valide (validateGraphChain sur la chaîne ordonnée par les cadres)
 *   ⑤ nom de modèle non vide
 *   ⑥ banc de test : 0 cas = à faire, cas en échec = AVERTISSEMENT (blocked
 *      non bloquant — le pilote juge, décision R13)
 *
 * canSave = aucun item 'blocked', hormis le banc (READINESS_BENCH_ITEM_ID).
 */
export function computeSetReadiness(
  graphs: GraphConfig[],
  workshop: WorkshopConfig,
  referenceCases: ReferenceCase[],
  modelName: string
): SetReadinessResult {
  const items: ReadinessItem[] = [];
  const allGraphs = graphs || [];
  const cases = referenceCases || [];
  const framedIds = new Set((workshop.frames || []).map(f => f.graphId));
  const chain = chainFromFrames(allGraphs, workshop);

  // ── ① Exactement 1 primaire avec opération valide ──────────────────────
  {
    const label = 'Graphique primaire et opération du set';
    const id = 'set:primary';
    if (allGraphs.length === 0) {
      items.push({
        id, label, state: 'todo',
        detail: "aucun graphique — importe l'image du manuel et pose les cadres"
      });
    } else {
      const primaries = allGraphs.filter(isPrimaryRole);
      if (primaries.length === 0) {
        items.push({
          id, label, state: 'blocked',
          detail: 'aucun graphique primaire — le set ne produira aucune valeur exploitable. Marque un graphique comme primaire.'
        });
      } else if (primaries.length > 1) {
        items.push({
          id, label, state: 'blocked',
          detail: `${primaries.length} graphiques primaires (${primaries.map(g => `« ${g.name} »`).join(', ')}) — un seul doit produire la valeur finale du set`
        });
      } else {
        const primary = primaries[0];
        const op = getOperation(primary.operationId);
        if (!primary.operationId) {
          items.push({
            id, label, state: 'blocked',
            detail: `le primaire « ${primary.name} » n'a pas d'opération canonique sélectionnée — sans elle, l'abaque ne sera pas consommé par la préparation de vol`
          });
        } else if (!op) {
          items.push({
            id, label, state: 'blocked',
            detail: `operationId « ${primary.operationId} » inconnu du catalogue`
          });
        } else {
          items.push({ id, label, state: 'done', detail: op.labelFr });
        }
      }
    }
  }

  // ── ② Tous les graphes cadrés ──────────────────────────────────────────
  {
    const label = "Tous les graphiques cadrés sur l'image";
    const id = 'set:frames';
    if (allGraphs.length === 0) {
      items.push({ id, label, state: 'todo', detail: 'aucun graphique à cadrer' });
    } else {
      const unframed = allGraphs.filter(g => !framedIds.has(g.id));
      if (unframed.length > 0) {
        items.push({
          id, label, state: 'todo',
          detail: `${unframed.length} graphique${unframed.length > 1 ? 's' : ''} sans cadre : ${unframed.map(g => `« ${g.name} »`).join(', ')}`
        });
      } else {
        items.push({
          id, label, state: 'done',
          detail: chain.map(g => g.name).join(' → ')
        });
      }
    }
  }

  // ── ③ Y commun calibré OU bornes saisies ───────────────────────────────
  {
    const label = 'Axe Y commun paramétré';
    const id = 'set:shared-y';
    const yTicks = workshop.yTicks?.length ?? 0;
    const bounds = axisBoundsEntered(workshop.sharedY);
    if (yTicks >= 2) {
      items.push({
        id, label, state: 'done',
        detail: `calibré par graduations (${yTicks} points)`
      });
    } else if (bounds.ok) {
      items.push({ id, label, state: 'done', detail: 'bornes et pas saisis' });
    } else {
      items.push({
        id, label, state: 'todo',
        detail: 'calibre le Y commun (clique ≥ 2 graduations) ou saisis ses bornes et son pas'
      });
    }
  }

  // ── ④ Chaîne valide (ordre des cadres) ─────────────────────────────────
  {
    const label = 'Chaîne de lecture valide';
    const id = 'set:chain';
    if (chain.length === 0) {
      items.push({
        id, label, state: 'todo',
        detail: "chaîne non établie — pose les cadres (l'ordre gauche → droite fait la chaîne)"
      });
    } else {
      const validation = validateGraphChain(ensureFittedGraphs(chain));
      if (validation.valid) {
        items.push({
          id, label, state: 'done',
          detail: chain.map(g => g.name).join(' → ')
        });
      } else {
        items.push({
          id, label, state: 'blocked',
          detail: validation.errors.join(' · ')
        });
      }
    }
  }

  // ── ⑤ Nom de modèle ────────────────────────────────────────────────────
  {
    const trimmed = (modelName || '').trim();
    items.push({
      id: 'set:model-name',
      label: 'Nom du modèle',
      state: trimmed ? 'done' : 'todo',
      ...(trimmed ? { detail: trimmed } : { detail: 'saisis le nom du modèle avant d\'enregistrer' })
    });
  }

  // ── ⑥ Banc de test (cas de référence du manuel) ────────────────────────
  {
    const label = 'Banc de test (cas de référence du manuel)';
    if (cases.length === 0) {
      items.push({
        id: READINESS_BENCH_ITEM_ID, label, state: 'todo',
        detail: "aucun cas de référence — ajoute l'exemple du manuel"
      });
    } else {
      // Le banc rejoue la chaîne telle qu'elle sera enregistrée : la chaîne
      // ordonnée par les cadres si elle existe, sinon les graphes en l'état.
      const benchGraphs = chain.length > 0 ? chain : allGraphs;
      const results = runAllReferenceCases(benchGraphs, cases);
      const failures = results
        .map((r, i) => ({ r, rc: cases[i] }))
        .filter(({ r }) => r.status !== 'pass');
      const nbPass = results.length - failures.length;
      if (failures.length === 0) {
        items.push({
          id: READINESS_BENCH_ITEM_ID, label, state: 'done',
          detail: `${nbPass}/${results.length} PASS`
        });
      } else {
        const lines = failures.map(({ r, rc }) =>
          `« ${rc.label || `Cas ${rc.expected}`} » : ` +
          (r.status === 'fail'
            ? `calculé ${r.computed !== undefined ? r.computed.toFixed(0) : '?'} pour ${rc.expected} attendu (écart ${r.deviationPct !== undefined ? r.deviationPct.toFixed(1) : '?'} % > ±${rc.tolerancePct ?? 5} %)`
            : `erreur — ${r.message || 'échec du calcul'}`));
        items.push({
          id: READINESS_BENCH_ITEM_ID, label, state: 'blocked',
          detail: `${nbPass}/${results.length} PASS — ${lines.join(' · ')} (avertissement : n'empêche pas l'enregistrement, le pilote juge)`
        });
      }
    }
  }

  // ── canSave : aucun 'blocked' hormis le banc (avertissement R13) ───────
  const canSave = items.every(
    it => it.state !== 'blocked' || it.id === READINESS_BENCH_ITEM_ID
  );

  return { items, canSave };
}
