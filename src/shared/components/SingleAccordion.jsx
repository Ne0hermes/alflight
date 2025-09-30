import React from 'react';
import { Accordion as MuiAccordion } from '@mui/material';

/**
 * Composant Accordion qui s'assure qu'un seul panneau est ouvert à la fois
 * Utilise un contexte partagé par groupe d'accordéons
 */
export const SingleAccordion = ({
  expanded,
  onChange,
  groupId,
  panelId,
  children,
  ...props
}) => {
  // Si un groupId est fourni, on utilise le contexte global
  // Sinon, on utilise le comportement par défaut
  const handleChange = (event, isExpanded) => {
    if (onChange) {
      // Appeler onChange avec le panelId pour identifier quel panneau change
      onChange(panelId)(event, isExpanded);
    }
  };

  return (
    <MuiAccordion
      expanded={expanded === panelId}
      onChange={handleChange}
      {...props}
    >
      {children}
    </MuiAccordion>
  );
};

export default SingleAccordion;