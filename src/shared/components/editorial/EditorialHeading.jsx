import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * EditorialHeading
 * ----------------
 * Titre éditorial inspiré du SR-71 datasheet :
 *   • Un "eyebrow" optionnel (mono ALL CAPS, letter-spacing large) au-dessus
 *   • Le titre principal en Century Gothic, taille selon level (1/2/3)
 *
 * Usage :
 *   <EditorialHeading level={1} eyebrow="OPS · MASSE ET CENTRAGE">
 *     Préparation du vol
 *   </EditorialHeading>
 */
const LEVELS = {
  1: tokens.typography.display,
  2: tokens.typography.h1,
  3: tokens.typography.h2,
};

export const EditorialHeading = ({
  level = 1,
  eyebrow,
  children,
  style,
  className,
  as,
  ...rest
}) => {
  const Tag = as || `h${Math.min(Math.max(level, 1), 6)}`;
  const titleStyle = LEVELS[level] || LEVELS[1];

  return (
    <div className={className} style={{ display: 'block', ...(style || {}) }} {...rest}>
      {eyebrow && (
        <span
          style={{
            display: 'block',
            ...tokens.typography.eyebrow,
            color: 'var(--text-tertiary)',
            marginBottom: tokens.spacing[3],
          }}
        >
          {eyebrow}
        </span>
      )}
      <Tag
        style={{
          margin: 0,
          color: 'var(--text-primary)',
          ...titleStyle,
        }}
      >
        {children}
      </Tag>
    </div>
  );
};

export default EditorialHeading;
