import { useState, useReducer, useEffect } from 'react';
import { DEFAULT_AIRCRAFT_LIST } from '../utils/constants';

const aircraftReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_AIRCRAFT': 
      return [...state, action.payload];
    case 'UPDATE_AIRCRAFT': 
      return state.map(a => a.id === action.payload.id ? action.payload : a);
    case 'DELETE_AIRCRAFT': 
      return state.filter(a => a.id !== action.payload);
    case 'RESET_TO_DEFAULT': 
      return DEFAULT_AIRCRAFT_LIST;  // Modifié ici
    case 'IMPORT_AIRCRAFT': 
      return action.payload;
    default: 
      return state;
  }
};

export const useAircraftManager = () => {  // Supprimé le paramètre
  const [aircraftList, dispatch] = useReducer(aircraftReducer, DEFAULT_AIRCRAFT_LIST);  // Modifié ici
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  useEffect(() => {
    if (!selectedAircraft && aircraftList.length > 0) {
      setSelectedAircraft(aircraftList[0]);
    }
  }, [aircraftList, selectedAircraft]);

  useEffect(() => {
    if (selectedAircraft) {
      const updatedAircraft = aircraftList.find(a => a.id === selectedAircraft.id);
      if (updatedAircraft && JSON.stringify(updatedAircraft) !== JSON.stringify(selectedAircraft)) {
        setSelectedAircraft(updatedAircraft);
      }
    }
  }, [aircraftList, selectedAircraft]);

  return {
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    dispatch
  };
};