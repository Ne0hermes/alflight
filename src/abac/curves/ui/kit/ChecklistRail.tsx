/**
 * ChecklistRail — fil d'avancement permanent de l'atelier (Lot 1-B).
 *
 * Le pilote voit à tout instant OÙ il en est dans la construction de
 * l'abaque : rail latéral vertical compact par défaut, variante horizontale
 * (`orientation="horizontal"`) pour les écrans étroits.
 *
 * États (palette de statut charte, cf. tokens.TONE) :
 *  - done    : ✓  couleur succès (orange charte — pas de vert SaaS)
 *  - current : ●  accent, libellé en gras, fond accent doux, aria-current
 *  - blocked : !  rouge NO-GO, avec `detail` expliquant le blocage
 *  - todo    : ○  neutre tamisé
 *
 * Une étape avec `onClick` est rendue en <button> (navigation directe) ;
 * sinon en simple <div> non interactif.
 */
import type { CSSProperties } from 'react';
import { FONT, RADIUS, SPACING, TONE } from './tokens';

export type ChecklistStepState = 'done' | 'todo' | 'blocked' | 'current';

export interface ChecklistStep {
  id: string;
  label: string;
  state: ChecklistStepState;
  detail?: string;
  onClick?: () => void;
}

export interface ChecklistRailProps {
  steps: ChecklistStep[];
  orientation?: 'vertical' | 'horizontal';
}

const MARKER: Record<ChecklistStepState, string> = {
  done: '✓',
  current: '●',
  blocked: '!',
  todo: '○',
};

const MARKER_COLOR: Record<ChecklistStepState, string> = {
  done: TONE.ok.fg,
  current: 'var(--accent-primary)',
  blocked: TONE.crit.fg,
  todo: 'var(--text-tertiary)',
};

const LABEL_COLOR: Record<ChecklistStepState, string> = {
  done: 'var(--text-secondary)',
  current: 'var(--text-primary)',
  blocked: TONE.crit.fg,
  todo: 'var(--text-tertiary)',
};

function StepItem({ step }: { step: ChecklistStep }) {
  const interactive = typeof step.onClick === 'function';

  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    width: '100%',
    padding: `${SPACING.xs}px ${SPACING.sm}px`,
    borderRadius: RADIUS,
    border: 'none',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: FONT.body,
    lineHeight: 1.35,
    backgroundColor: step.state === 'current' ? 'var(--accent-soft)' : 'transparent',
    color: LABEL_COLOR[step.state],
    fontWeight: step.state === 'current' ? 600 : 400,
    cursor: interactive ? 'pointer' : 'default',
  };

  const content = (
    <>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: SPACING.md,
          textAlign: 'center',
          fontWeight: 700,
          color: MARKER_COLOR[step.state],
        }}
      >
        {MARKER[step.state]}
      </span>
      <span style={{ minWidth: 0 }}>
        {step.label}
        {step.detail != null && (
          <span
            style={{
              display: 'block',
              fontSize: FONT.note,
              fontWeight: 400,
              color: step.state === 'blocked' ? TONE.crit.fg : 'var(--text-tertiary)',
            }}
          >
            {step.detail}
          </span>
        )}
      </span>
    </>
  );

  return interactive ? (
    <button type="button" onClick={step.onClick} style={itemStyle}>
      {content}
    </button>
  ) : (
    <div style={itemStyle}>{content}</div>
  );
}

export function ChecklistRail({ steps, orientation = 'vertical' }: ChecklistRailProps) {
  const horizontal = orientation === 'horizontal';
  return (
    <nav aria-label="Avancement de l'atelier">
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          flexWrap: horizontal ? 'wrap' : 'nowrap',
          alignItems: horizontal ? 'center' : 'stretch',
          gap: SPACING.xs,
        }}
      >
        {steps.map((step, i) => (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              minWidth: 0,
              flex: horizontal ? '0 1 auto' : undefined,
            }}
          >
            <StepItem step={step} />
            {horizontal && i < steps.length - 1 && (
              <span
                aria-hidden="true"
                style={{ color: 'var(--text-tertiary)', margin: `0 ${SPACING.xs}px`, fontSize: FONT.note }}
              >
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
