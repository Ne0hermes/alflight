import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer les accordéons avec un seul panneau ouvert à la fois
 * @param {string} defaultPanel - Le panneau ouvert par défaut (optionnel)
 * @returns {Object} - { expanded, handleChange }
 */
export const useAccordion = (defaultPanel = false) => {
  const [expanded, setExpanded] = useState(defaultPanel);

  const handleChange = useCallback((panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  }, []);

  return {
    expanded,
    handleChange,
    setExpanded
  };
};

/**
 * Hook pour gérer plusieurs accordéons indépendants
 * @param {Object} defaultPanels - Les panneaux ouverts par défaut
 * @returns {Object} - { expandedPanels, handlePanelChange, resetPanels }
 */
export const useMultipleAccordions = (defaultPanels = {}) => {
  const [expandedPanels, setExpandedPanels] = useState(defaultPanels);

  const handlePanelChange = useCallback((panel) => (event, isExpanded) => {
    setExpandedPanels(prev => {
      // Fermer tous les autres panneaux
      const newState = {};
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      // Ouvrir uniquement le panneau cliqué
      newState[panel] = isExpanded;
      return newState;
    });
  }, []);

  const resetPanels = useCallback(() => {
    setExpandedPanels(defaultPanels);
  }, [defaultPanels]);

  return {
    expandedPanels,
    handlePanelChange,
    resetPanels
  };
};

export default useAccordion;