import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * DatasheetCard
 * -------------
 * Card éditoriale style SR-71 datasheet : 4 coins (top-left, top-right,
 * bottom-left, bottom-right) avec slot central optionnel.
 * Peut afficher une image en background (cinematic photo).
 *
 * Usage :
 *   <DatasheetCard
 *     topLeft="LFPG · CDG"
 *     topRight="34°R"
 *     bottomLeft={<TechLabel>Distance</TechLabel>}
 *     bottomRight={<DataReadout value={245} unit="NM" />}
 *     image="/photos/cdg.jpg"
 *     interactive
 *     onClick={...}
 *   >
 *     <EditorialHeading level={3}>Charles de Gaulle</EditorialHeading>
 *   </DatasheetCard>
 */
export const DatasheetCard = ({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  children,
  image,
  interactive = false,
  padding = '6',
  minHeight,
  style,
  className,
  onClick,
  as = 'div',
  ...rest
}) => {
  const Tag = as;
  const paddingValue = tokens.spacing[padding] || tokens.spacing[6];

  const handleKeyDown = (event) => {
    if (!interactive || !onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(event);
    }
  };

  return (
    <Tag
      className={className}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
        border: `${tokens.border.thin} solid var(--border-subtle)`,
        borderRadius: tokens.radius.sm,
        padding: paddingValue,
        minHeight: minHeight || '180px',
        overflow: 'hidden',
        cursor: interactive ? 'pointer' : 'default',
        transition: `border-color ${tokens.motion.base}, transform ${tokens.motion.base}`,
        ...(interactive
          ? {
              outline: 'none',
            }
          : {}),
        ...(style || {}),
      }}
      onMouseEnter={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = 'var(--border-ghost)';
        }
      }}
      onMouseLeave={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }
      }}
      {...rest}
    >
      {/* Image cinematic en background (atténuée) */}
      {image && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(180deg, var(--app-bg-alpha-55) 0%, var(--app-bg-alpha-85) 100%), url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      )}

      {/* Coins haut */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: tokens.spacing[4],
          minHeight: '14px',
        }}
      >
        <div
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 500,
          }}
        >
          {topLeft}
        </div>
        <div
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 500,
            textAlign: 'right',
          }}
        >
          {topRight}
        </div>
      </div>

      {/* Slot central */}
      {children && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: `${tokens.spacing[5]} 0`,
          }}
        >
          {children}
        </div>
      )}

      {/* Coins bas */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: tokens.spacing[4],
          minHeight: '14px',
        }}
      >
        <div style={{ textAlign: 'left' }}>{bottomLeft}</div>
        <div style={{ textAlign: 'right' }}>{bottomRight}</div>
      </div>
    </Tag>
  );
};

export default DatasheetCard;
