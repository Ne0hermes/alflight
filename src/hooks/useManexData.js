// src/hooks/useManexData.js
import { useState, useEffect } from 'react';
import { useManexStore } from '../core/stores/manexStore';

/**
 * Hook pour accéder facilement aux données MANEX d'un avion
 * Gère le chargement depuis le store MANEX séparé
 */
export const useManexData = (aircraftId) => {
  const [manexData, setManexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getManexData = useManexStore(state => state.getManexData);
  const setManexDataStore = useManexStore(state => state.setManexData);
  const removeManexData = useManexStore(state => state.removeManexData);
  
  useEffect(() => {
    if (!aircraftId) {
      setManexData(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = getManexData(aircraftId);
      
      if (data) {
        // Reconstituer la structure complète
        setManexData({
          ...data.metadata,
          pdfData: data.pdfData
        });
      } else {
        setManexData(null);
      }
      setError(null);
    } catch (err) {
      console.error('Erreur lors du chargement des données MANEX:', err);
      setError(err.message);
      setManexData(null);
    } finally {
      setLoading(false);
    }
  }, [aircraftId, getManexData]);
  
  // Fonction pour mettre à jour les données MANEX
  const updateManexData = (newData) => {
    if (!aircraftId) return;
    
    try {
      // Séparer les métadonnées du PDF
      const { pdfData, ...metadata } = newData;
      
      setManexDataStore(aircraftId, {
        metadata,
        pdfData: pdfData || null,
        compressed: false
      });
      
      // Mettre à jour l'état local
      setManexData(newData);
    } catch (err) {
      console.error('Erreur lors de la mise à jour des données MANEX:', err);
      setError(err.message);
    }
  };
  
  // Fonction pour supprimer les données MANEX
  const deleteManexData = () => {
    if (!aircraftId) return;
    
    try {
      removeManexData(aircraftId);
      setManexData(null);
    } catch (err) {
      console.error('Erreur lors de la suppression des données MANEX:', err);
      setError(err.message);
    }
  };
  
  return {
    manexData,
    loading,
    error,
    updateManexData,
    deleteManexData,
    hasManex: !!manexData
  };
};

export default useManexData;