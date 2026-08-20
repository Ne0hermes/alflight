/**
 * KitButton — bouton unique de l'atelier abaques (Lot 1-B).
 *
 * Trois niveaux et RIEN d'autre :
 *  - primary   : L'action principale de l'écran (UNE seule par écran).
 *                Fond var(--accent-primary), texte blanc.
 *  - secondary : actions secondaires. Contour accent, fond transparent.
 *  - tertiary  : actions discrètes. Texte seul, souligné au survol.
 *
 * Libellé STABLE par construction : le composant n'a AUCUNE logique d'état —
 * il rend `children` tel quel. L'état (calibré, 3/4 OK…) s'affiche dans un
 * KitBadge À CÔTÉ du bouton, jamais dans son texte.
 *
 * Un bouton désactivé DIT pourquoi (audit : boutons grisés muets) :
 * `disabledReason` est rendue en `title` (info-bulle) ET dans un span
 * accessible (aria-describedby). Le bouton reste focusable (aria-disabled
 * plutôt que l'attribut natif) pour que l'info-bulle et les lecteurs d'écran
 * fonctionnent ; le clic est neutralisé.
 */
import { useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CONTROL_HEIGHT, FONT, RADIUS, SPACING } from './tokens';

export type KitButtonLevel = 'primary' | 'secondary' | 'tertiary';
export type KitButtonSize = 'normal' | 'compact';

export interface KitButtonProps {
  level: KitButtonLevel;
  size?: KitButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  /** Obligatoire moralement dès que disabled : la raison, en clair. */
  disabledReason?: string;
  /** Info-bulle du bouton ACTIF (jamais un état — libellés stables) ;
   *  quand le bouton est désactivé, `disabledReason` prime. */
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}

/** Masquage visuel sans retrait de l'arbre d'accessibilité (screen-reader only). */
const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function KitButton({
  level,
  size = 'normal',
  icon,
  disabled = false,
  disabledReason,
  title,
  onClick,
  children,
}: KitButtonProps) {
  const [hover, setHover] = useState(false);
  const reasonId = useId();
  const active = hover && !disabled;
  const showReason = disabled && Boolean(disabledReason);

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size === 'compact' ? SPACING.xs : SPACING.sm,
    height: CONTROL_HEIGHT[size],
    padding: `0 ${size === 'compact' ? SPACING.sm : SPACING.md}px`,
    borderRadius: RADIUS,
    fontFamily: 'inherit',
    fontSize: FONT.control,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background-color var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast)',
    userSelect: 'none',
  };

  const byLevel: Record<KitButtonLevel, CSSProperties> = {
    primary: {
      backgroundColor: active ? 'var(--accent-hover)' : 'var(--accent-primary)',
      color: 'var(--color-white-pure)',
      border: '1px solid transparent',
    },
    secondary: {
      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
      color: 'var(--accent-primary)',
      border: '1px solid var(--accent-primary)',
    },
    tertiary: {
      backgroundColor: 'transparent',
      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
      border: '1px solid transparent',
      textDecoration: active ? 'underline' : 'none',
      textUnderlineOffset: 3,
    },
  };

  return (
    <button
      type="button"
      title={showReason ? disabledReason : title}
      aria-disabled={disabled || undefined}
      aria-describedby={showReason ? reasonId : undefined}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...byLevel[level] }}
    >
      {icon != null && (
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {showReason && (
        <span id={reasonId} style={SR_ONLY}>
          {disabledReason}
        </span>
      )}
    </button>
  );
}
