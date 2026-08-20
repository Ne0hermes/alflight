/**
 * KitPanel — anatomie UNIQUE de panneau de l'atelier abaques (Lot 1-B).
 *
 * Structure imposée (fin des pilules/capsules/bandeaux ad hoc) :
 *   ┌─────────────────────────────────────────────┐
 *   │ Titre  [badge]                    [action]  │  ← en-tête
 *   │ ─────────────────────────────────────────── │
 *   │ children                                    │  ← corps
 *   └─────────────────────────────────────────────┘
 *
 *  - `badge`  : typiquement un <KitBadge>, accolé au titre.
 *  - `action` : typiquement UN <KitButton size="compact">, calé à droite.
 *  - `tone="attention"` : contour accent pour le panneau qui requiert
 *    l'attention du pilote (à n'utiliser que pour UN panneau à la fois).
 *
 * Marges internes sur la grille de 8 (padding 16, gaps 8/16).
 */
import type { ReactNode } from 'react';
import { CONTROL_HEIGHT, FONT, RADIUS, SPACING } from './tokens';

export interface KitPanelProps {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'attention';
}

export function KitPanel({ title, badge, action, children, tone = 'default' }: KitPanelProps) {
  return (
    <section
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${tone === 'attention' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        borderRadius: RADIUS,
        padding: SPACING.md,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          minHeight: CONTROL_HEIGHT.compact,
          marginBottom: SPACING.md,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: FONT.title,
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h3>
        {badge}
        {action != null && <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{action}</div>}
      </header>
      <div style={{ fontSize: FONT.body, color: 'var(--text-primary)' }}>{children}</div>
    </section>
  );
}
