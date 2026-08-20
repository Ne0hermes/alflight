/**
 * ============================================================================
 *  ALFlight — Kit visuel de l'atelier abaques (Lot 1-B de la refonte)
 * ============================================================================
 *  Source UNIQUE des constantes visuelles de l'atelier. Objectif : éliminer
 *  le chaos relevé par le pilote (tailles disparates, polices 9→13 px,
 *  pilules sans hiérarchie) en imposant :
 *    - une grille de 8 px (SPACING),
 *    - 3 corps de texte seulement (FONT),
 *    - 2 hauteurs de contrôle seulement (CONTROL_HEIGHT),
 *    - 1 rayon d'arrondi (RADIUS).
 *
 *  AUCUNE couleur en dur ici : tout référence les variables CSS globales
 *  définies dans src/index.css (thème nuit/jour automatique).
 * ============================================================================
 */

/** Grille d'espacement — base 8 px (4 = demi-pas pour les micro-écarts). */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * 3 corps de texte SEULEMENT (charte V7, échelle rationalisée de index.css) :
 *  - title → var(--fs-title)   (20 px) : titre de panneau/section
 *  - body  → var(--fs-body)    (14 px) : texte courant, boutons, libellés
 *  - note  → var(--fs-caption) (11 px) : légendes, détails, mentions
 * Les variables existent dans src/index.css — on les consomme telles quelles.
 */
export const FONT = {
  title: 'var(--fs-title)',
  body: 'var(--fs-body)',
  note: 'var(--fs-caption)',
  /** Corps des CONTRÔLES (boutons, champs, selects) — 12 px, aligné sur les
   *  champs historiques de l'atelier (demande pilote 20/08 : boutons plus
   *  petits, même hauteur que les champs). */
  control: '12px',
} as const;

/** Rayon d'arrondi unique du kit (px). */
export const RADIUS = 6;

/** Les 2 hauteurs de contrôle autorisées (px) — demande pilote 20/08 :
 *  compact (24) = EXACTEMENT la hauteur des champs de saisie de l'atelier
 *  (variables, unités, bornes) pour un alignement au pixel. */
export const CONTROL_HEIGHT = {
  normal: 28,
  compact: 24,
} as const;

/**
 * Palette sémantique des états — mappée sur les variables de statut
 * centralisées de index.css. Charte ALFlight : succès/avertissement = orange
 * (pas de vert/jaune SaaS), critique = rouge NO-GO, neutre = ivoire tamisé.
 */
export const TONE = {
  ok: { fg: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  warn: { fg: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  crit: { fg: 'var(--status-error)', bg: 'var(--status-error-bg)' },
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--status-info-bg)' },
} as const;

export type ToneName = keyof typeof TONE;
