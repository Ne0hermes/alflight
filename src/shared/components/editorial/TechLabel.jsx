import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * TechLabel
 * ---------
 * Label technique ALL CAPS court (eyebrow inline).
 * Letter-spacing 0.10em, mono. Couleur tertiaire par défaut,
 * orange si `active=true`.
 *
 * Usage :
 *   <TechLabel>Coords</TechLabel>
 *   <TechLabel active>Wpt actif</TechLabel>
 *   <TechLabel as="label" htmlFor="qnh">QNH</TechLabel>
 */
export const TechLabel = ({
  children,
  active = false,
  as = 'span',
  style,
  className,
  ...rest
}) => {
  const Tag = as;
  return (
    <Tag
      className={className}
      style={{
        fontFamily: tokens.fontFamily.mono,
        fontSize: 'var(--fs-caption)',
        lineHeight: 1.2,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        fontWeight: 500,
        color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
        transition: `color ${tokens.motion.fast}`,
        ...(style || {}),
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default TechLabel;
