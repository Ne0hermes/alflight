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
 * Lot 1-G — variante REPLIABLE (`collapsible`) : même anatomie, mais l'en-tête
 * devient le <summary> d'un <details> (les gros blocs repliés des écrans Tracé
 * et Validation gardent ainsi l'anatomie du kit au lieu de <details> ad hoc).
 *  - non contrôlé : `defaultOpen` (défaut false) ;
 *  - contrôlé : `open` + `onToggle` (mêmes sémantiques que l'attribut natif).
 *  - `action` est ignorée en repliable (un bouton dans un <summary> serait un
 *    piège de clic) — la garder pour les panneaux fixes.
 *
 * Marges internes sur la grille de 8 (padding 16, gaps 8/16).
 */
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { CONTROL_HEIGHT, FONT, RADIUS, SPACING } from './tokens';

export interface KitPanelProps {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'attention';
  /** Rend le panneau repliable (<details>). L'en-tête devient le <summary>. */
  collapsible?: boolean;
  /** Repliable non contrôlé : état d'ouverture initial (défaut false). */
  defaultOpen?: boolean;
  /** Repliable contrôlé : état d'ouverture + callback de bascule. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

export function KitPanel({
  title,
  badge,
  action,
  children,
  tone = 'default',
  collapsible = false,
  defaultOpen = false,
  open,
  onToggle
}: KitPanelProps) {
  const frameStyle: CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    border: `1px solid ${tone === 'attention' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
    borderRadius: RADIUS,
    padding: SPACING.md,
  };

  const titleEl = (
    <span
      style={{
        margin: 0,
        fontSize: FONT.title,
        fontWeight: 600,
        lineHeight: 1.2,
        color: 'var(--text-primary)',
      }}
    >
      {title}
    </span>
  );

  const bodyEl = (
    <div style={{ fontSize: FONT.body, color: 'var(--text-primary)' }}>{children}</div>
  );

  if (collapsible) {
    return (
      <details
        style={frameStyle}
        {...(open !== undefined ? { open } : defaultOpen ? { open: true } : {})}
        {...(onToggle
          ? { onToggle: (e: SyntheticEvent<HTMLDetailsElement>) => onToggle(e.currentTarget.open) }
          : {})}
      >
        <summary
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            minHeight: CONTROL_HEIGHT.compact,
            cursor: 'pointer',
            listStyle: 'none',
          }}
        >
          <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', fontSize: FONT.note }}>▸</span>
          {titleEl}
          {badge}
        </summary>
        <div style={{ marginTop: SPACING.md }}>{bodyEl}</div>
      </details>
    );
  }

  return (
    <section style={frameStyle}>
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
      {bodyEl}
    </section>
  );
}
