/**
 * KitBadge — badge d'état accolable à un titre ou un bouton (Lot 1-B).
 *
 * C'est LUI qui porte l'état (« calibré ✓ », « 3/4 OK », « à faire ») —
 * jamais le texte du bouton voisin (libellés stables, cf. KitButton).
 *
 * Petit (corps note 11 px), mono-ligne, 4 tons sémantiques mappés sur la
 * palette de statut centralisée (tokens.TONE) : ok/warn = orange charte,
 * crit = rouge NO-GO, neutral = ivoire tamisé.
 */
import type { ReactNode } from 'react';
import { FONT, RADIUS, SPACING, TONE } from './tokens';

export type KitBadgeTone = 'ok' | 'warn' | 'crit' | 'neutral';

export interface KitBadgeProps {
  tone: KitBadgeTone;
  children: ReactNode;
}

export function KitBadge({ tone, children }: KitBadgeProps) {
  const { fg, bg } = TONE[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACING.xs,
        padding: `2px ${SPACING.sm}px`,
        borderRadius: RADIUS,
        fontSize: FONT.note,
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        color: fg,
        backgroundColor: bg,
      }}
    >
      {children}
    </span>
  );
}
