// src/features/aircraft/utils/stallSpeedTable.js
//
// Tableau des vitesses de décrochage (demande pilote, 21/08/2026).
//
// Lignes = configuration volets (lisse / décollage / atterrissage), colonnes =
// inclinaison 0° / 20° / 30° / 35° / 40° / 45° / 60°. La colonne 0° EST
// vs1 / vsTO / vso : mêmes champs que les arcs du badin — une seule source de
// vérité, pas de duplication. Les inclinaisons vivent dans une structure
// dédiée :
//
//   speeds.stallByBank = { clean: { b20, b30, b35, b40, b45, b60 },
//                          takeoff: {…}, landing: {…} }
//
// TABLEAU GÉNÉRAL (décision pilote, 24/08/2026) : les mêmes colonnes pour TOUS
// les avions, TOUTES facultatives. Les inclinaisons publiées varient d'un
// manuel à l'autre (20/40/60 chez Piper, 30/45 ailleurs) : plutôt que de
// paramétrer les colonnes avion par avion, on offre la grille complète et
// chaque fiche ne remplit que ce que son manuel donne. Une colonne vide sur
// toute la flotte reste vide — elle ne coûte rien et n'invente rien.
//
// Valeurs numériques en kt, ABSENTES si non saisies — jamais un 0 fabriqué
// (règle du projet, cf. writeNumeric dans Step2Speeds). Une configuration sans
// aucune valeur disparaît de l'objet ; un objet sans configuration devient
// undefined (la clé disparaît du JSON). Une fiche sans stallByBank s'ouvre
// telle quelle : colonnes vides.

export const STALL_CONFIGS = [
  { key: 'clean',   label: 'Lisse',        field: 'vs1',  short: 'VS1' },
  { key: 'takeoff', label: 'Décollage',    field: 'vsTO', short: 'VS T/O' },
  { key: 'landing', label: 'Atterrissage', field: 'vso',  short: 'VSO' },
];

// Grille générale, triée par inclinaison croissante — l'ordre porte le sens :
// stallSpeedWarnings compare les colonnes de proche en proche.
export const STALL_BANKS = [
  { key: 'b20', deg: 20 },
  { key: 'b30', deg: 30 },
  { key: 'b35', deg: 35 },
  { key: 'b40', deg: 40 },
  { key: 'b45', deg: 45 },
  { key: 'b60', deg: 60 },
];

// Nombre fini ou null ('' / null / undefined / non numérique → null).
const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Vitesse de décrochage d'une configuration à une inclinaison donnée.
 * 0° → champ de base (vs1 / vsTO / vso) ; toute inclinaison de STALL_BANKS →
 * speeds.stallByBank. Une inclinaison hors grille rend null (jamais
 * d'interpolation : le manuel de vol fait foi).
 * @param {object} speeds  aircraft.speeds
 * @param {'clean'|'takeoff'|'landing'} configKey
 * @param {0|20|30|35|40|45|60} bankDeg
 * @returns {number|null}
 */
export function getStallSpeed(speeds, configKey, bankDeg) {
  const cfg = STALL_CONFIGS.find((c) => c.key === configKey);
  if (!cfg || !speeds) return null;
  if (bankDeg === 0) return toNum(speeds[cfg.field]);
  const bank = STALL_BANKS.find((b) => b.deg === bankDeg);
  if (!bank) return null;
  return toNum(speeds.stallByBank?.[configKey]?.[bank.key]);
}

/**
 * Nouvelle valeur de `speeds.stallByBank` après saisie d'une cellule inclinée.
 * Pure : ne mute pas l'objet reçu.
 *   • vidé → la clé disparaît ; configuration vide → disparaît ; plus rien →
 *     undefined (la clé speeds.stallByBank quitte le JSON) — JAMAIS un 0 ;
 *   • saisie parsable → nombre (« 55 » → 55, « 55,5 » → 55.5) ;
 *   • saisie transitoire non parsable (« 4, », « - ») → conservée telle quelle,
 *     sinon le champ contrôlé se viderait sous les doigts du pilote.
 * @returns {object|undefined}
 */
export function setStallByBank(stallByBank, configKey, bankKey, raw) {
  const next = {};
  for (const [k, v] of Object.entries(stallByBank || {})) {
    if (v && typeof v === 'object') next[k] = { ...v };
  }
  const row = { ...(next[configKey] || {}) };
  if (raw === '' || raw === null || raw === undefined) {
    delete row[bankKey];
  } else {
    const n = Number(String(raw).replace(',', '.'));
    row[bankKey] = Number.isFinite(n) ? n : raw;
  }
  if (Object.keys(row).length === 0) delete next[configKey];
  else next[configKey] = row;
  return Object.keys(next).length === 0 ? undefined : next;
}

/**
 * Avertissements de cohérence du tableau — SIMPLES AVERTISSEMENTS, jamais
 * bloquants : le manuel de vol fait foi.
 *   1. Pour une configuration, le décrochage CROÎT avec l'inclinaison
 *      (0° < 20° < … < 60°) — comparaison des valeurs RENSEIGNÉES consécutives,
 *      les colonnes laissées vides sont simplement sautées.
 *   2. À inclinaison égale, l'ordre habituel est lisse ≥ décollage ≥ atterrissage
 *      (paires adjacentes : la paire VS1 / VSO à 0° est déjà couverte par
 *      l'avertissement des arcs, pas de doublon).
 * @returns {string[]}
 */
export function stallSpeedWarnings(speeds) {
  const w = [];
  if (!speeds) return w;
  const degs = [0, ...STALL_BANKS.map((b) => b.deg)];

  for (const cfg of STALL_CONFIGS) {
    let prev = null; // { deg, v }
    for (const deg of degs) {
      const v = getStallSpeed(speeds, cfg.key, deg);
      if (v === null) continue;
      if (prev && v <= prev.v) {
        w.push(
          `Décrochage ${cfg.label.toLowerCase()} : la vitesse à ${deg}° (${v} kt) devrait être supérieure à celle à ${prev.deg}° (${prev.v} kt) — le décrochage croît avec l'inclinaison.`
        );
      }
      prev = { deg, v };
    }
  }

  for (const deg of degs) {
    for (let i = 0; i < STALL_CONFIGS.length - 1; i++) {
      const upper = STALL_CONFIGS[i];
      const lower = STALL_CONFIGS[i + 1];
      const vu = getStallSpeed(speeds, upper.key, deg);
      const vl = getStallSpeed(speeds, lower.key, deg);
      if (vu !== null && vl !== null && vl > vu) {
        w.push(
          `À ${deg}° d'inclinaison : décrochage ${lower.label.toLowerCase()} (${vl} kt) supérieur à ${upper.label.toLowerCase()} (${vu} kt) — l'ordre habituel est lisse ≥ décollage ≥ atterrissage (le manuel fait foi).`
        );
      }
    }
  }
  return w;
}
