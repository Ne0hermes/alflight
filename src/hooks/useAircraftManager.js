// src/hooks/useAircraftManager.js
import { useState, useReducer, useEffect } from 'react';
import { DEFAULT_AIRCRAFT_LIST } from '../utils/constants';

// Clé pour le localStorage
const STORAGE_KEY = 'flight-system-aircraft-list';

// Fonction pour charger les données depuis localStorage
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Vérifier que c'est un tableau valide
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des avions:', error);
  }
  return DEFAULT_AIRCRAFT_LIST;
};

// Fonction pour sauvegarder dans localStorage
const saveToStorage = (aircraftList) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aircraftList));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des avions:', error);
  }
};

const aircraftReducer = (state, action) => {
  let newState;
  
  switch (action.type) {
    case 'ADD_AIRCRAFT': 
      newState = [...state, action.payload];
      break;
    case 'UPDATE_AIRCRAFT': 
      newState = state.map(a => a.id === action.payload.id ? action.payload : a);
      break;
    case 'DELETE_AIRCRAFT': 
      newState = state.filter(a => a.id !== action.payload);
      break;
    case 'RESET_TO_DEFAULT': 
      newState = DEFAULT_AIRCRAFT_LIST;
      break;
    case 'IMPORT_AIRCRAFT': 
      newState = action.payload;
      break;
    default: 
      return state;
  }
  
  // Sauvegarder automatiquement après chaque modification
  saveToStorage(newState);
  return newState;
};

export const useAircraftManager = () => {
  // Charger les données depuis localStorage au démarrage
  const [aircraftList, dispatch] = useReducer(aircraftReducer, [], loadFromStorage);
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  // Sélectionner automatiquement le premier avion si aucun n'est sélectionné
  useEffect(() => {
    if (!selectedAircraft && aircraftList.length > 0) {
      setSelectedAircraft(aircraftList[0]);
    }
  }, [aircraftList, selectedAircraft]);

  // Mettre à jour l'avion sélectionné si ses données changent
  useEffect(() => {
    if (selectedAircraft) {
      const updatedAircraft = aircraftList.find(a => a.id === selectedAircraft.id);
      if (updatedAircraft && JSON.stringify(updatedAircraft) !== JSON.stringify(selectedAircraft)) {
        setSelectedAircraft(updatedAircraft);
      }
    }
  }, [aircraftList, selectedAircraft]);

  // Fonction pour effacer complètement les données
  const clearAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'RESET_TO_DEFAULT' });
  };

  return {
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    dispatch,
    clearAllData
  };
};