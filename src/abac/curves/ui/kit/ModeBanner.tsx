/**
 * ModeBanner — bandeau nommant le MODE courant du canevas (Lot 1-B).
 *
 * Généralisation de la bannière de calibration de WorkshopCanvas (la seule
 * réussie de l'audit) : fond accent doux, contour accent 2 px, une ligne :
 *
 *   MODE  instruction…                    3 / 7  [✕ Annuler]  Échap pour annuler
 *
 *  - `mode`        : nom court du mode (« Calibration Y », « Pose de points »).
 *  - `instruction` : ce que le pilote doit faire MAINTENANT.
 *  - `progress`    : avancement optionnel (ex. « 3 / 7 »).
 *  - `onCancel`    : sortie du mode. Branché sur le bouton Annuler ET sur la
 *                    touche Échap (écouteur clavier actif tant que le bandeau
 *                    est monté) — la mention « Échap pour annuler » est vraie.
 *
 * role="status" + aria-live : le changement de mode est annoncé aux lecteurs
 * d'écran.
 */
import { useEffect } from 'react';
import { KitButton } from './KitButton';
import { FONT, RADIUS, SPACING } from './tokens';

export interface ModeBannerProps {
  mode: string;
  instruction: string;
  progress?: string;
  onCancel: () => void;
}

export function ModeBanner({ mode, instruction, progress, onCancel }: ModeBannerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: RADIUS,
        backgroundColor: 'var(--accent-soft)',
        border: '2px solid var(--accent-primary)',
        fontSize: FONT.body,
        color: 'var(--text-primary)',
      }}
    >
      <strong
        style={{
          color: 'var(--accent-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {mode}
      </strong>
      <span>{instruction}</span>
      <span
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.sm,
          flexShrink: 0,
        }}
      >
        {progress != null && (
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{progress}</span>
        )}
        <KitButton level="secondary" size="compact" icon="✕" onClick={onCancel}>
          Annuler
        </KitButton>
        <span style={{ fontSize: FONT.note, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          Échap pour annuler
        </span>
      </span>
    </div>
  );
}
