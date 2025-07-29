import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAircraftManager } from '../hooks/useAircraftManager';
import { useNavigation } from '../hooks/useNavigation';
import { FUEL_DENSITIES } from '../utils/constants';

// Création du contexte
const FlightSystemContext = createContext();

// Hook personnalisé pour utiliser le contexte
export const useFlightSystem = () => {
  const context = useContext(FlightSystemContext);
  if (!context) {
    throw new Error('useFlightSystem must be used within FlightSystemProvider');
  }
  return context;
};

// Provider du contexte
export const FlightSystemProvider = ({ children }) => {
  // État centralisé des modules
  const { aircraftList, selectedAircraft, setSelectedAircraft, dispatch, clearAllData } = useAircraftManager();
  const navigation = useNavigation(selectedAircraft);
  
  // État pour l'onglet actif
  const [activeTab, setActiveTab] = useState('navigation');
  
  // État pour le module masse et centrage
  const [loads, setLoads] = useState({
    frontLeft: 75,
    frontRight: 0,
    rearLeft: 0,
    rearRight: 0,
    baggage: 0,
    auxiliary: 0,
    fuel: 0
  });

  // État pour le module carburant
  const [fuelData, setFuelData] = useState({
    roulage: { gal: 1.0, ltr: 3.79 },
    trip: { gal: 0, ltr: 0 },
    contingency: { gal: 0, ltr: 0 },
    alternate: { gal: 2.0, ltr: 7.57 },
    finalReserve: { gal: 0, ltr: 0 },
    additional: { gal: 0, ltr: 0 },
    extra: { gal: 0, ltr: 0 }
  });

  // État pour le FOB (Fuel On Board)
  const [fobFuel, setFobFuel] = useState({ gal: 0, ltr: 0 });

  // Calcul automatique du Trip Fuel depuis la navigation
  useEffect(() => {
    if (navigation.navigationResults?.fuelRequired) {
      const tripLiters = navigation.navigationResults.fuelRequired;
      const tripGallons = tripLiters / 3.78541;
      
      setFuelData(prev => ({
        ...prev,
        trip: { 
          gal: parseFloat(tripGallons.toFixed(1)), 
          ltr: parseFloat(tripLiters.toFixed(1)) 
        }
      }));
    }
  }, [navigation.navigationResults?.fuelRequired]);

  // Calcul automatique du Contingency Fuel (5% du trip fuel, minimum 1 gallon)
  useEffect(() => {
    const contingencyGal = Math.max(1.0, fuelData.trip.gal * 0.05);
    const contingencyLtr = contingencyGal * 3.78541;
    
    setFuelData(prev => ({
      ...prev,
      contingency: { 
        gal: parseFloat(contingencyGal.toFixed(1)), 
        ltr: parseFloat(contingencyLtr.toFixed(1)) 
      }
    }));
  }, [fuelData.trip.gal]);

  // Calcul automatique de la Final Reserve depuis la navigation
  useEffect(() => {
    if (navigation.navigationResults?.regulationReserveLiters) {
      const reserveLiters = navigation.navigationResults.regulationReserveLiters;
      const reserveGallons = reserveLiters / 3.78541;
      
      setFuelData(prev => ({
        ...prev,
        finalReserve: { 
          gal: parseFloat(reserveGallons.toFixed(1)), 
          ltr: parseFloat(reserveLiters.toFixed(1)) 
        }
      }));
    }
  }, [navigation.navigationResults?.regulationReserveLiters]);

  // Calcul automatique du carburant en masse pour le centrage
  useEffect(() => {
    if (selectedAircraft && fobFuel.ltr > 0) {
      const fuelDensity = FUEL_DENSITIES[selectedAircraft.fuelType];
      const fuelMass = fobFuel.ltr * fuelDensity;
      
      setLoads(prev => ({
        ...prev,
        fuel: parseFloat(fuelMass.toFixed(1))
      }));
    }
  }, [fobFuel.ltr, selectedAircraft]);

  // Calculs pour masse et centrage
  const currentCalculation = (() => {
    if (!selectedAircraft) {
      return { totalWeight: 0, cg: 0, moment: 0 };
    }

    const totalWeight = 
      selectedAircraft.emptyWeight +
      loads.frontLeft +
      loads.frontRight +
      loads.rearLeft +
      loads.rearRight +
      loads.baggage +
      loads.auxiliary +
      loads.fuel;

    const totalMoment = 
      selectedAircraft.emptyWeight * selectedAircraft.weightBalance.emptyWeightArm +
      loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
      loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
      loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
      loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm +
      loads.baggage * selectedAircraft.weightBalance.baggageArm +
      loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm +
      loads.fuel * selectedAircraft.weightBalance.fuelArm;

    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;

    return {
      totalWeight: parseFloat(totalWeight.toFixed(1)),
      cg: parseFloat(cg.toFixed(3)),
      moment: parseFloat(totalMoment.toFixed(1))
    };
  })();

  // Mise à jour automatique de la masse minimale de décollage
  useEffect(() => {
    if (selectedAircraft) {
      const minWeight = selectedAircraft.emptyWeight + 75; // Masse vide + 1 pilote (75kg)
      
      // Mettre à jour l'avion si nécessaire
      if (!selectedAircraft.minTakeoffWeight || selectedAircraft.minTakeoffWeight !== minWeight) {
        dispatch({
          type: 'UPDATE_AIRCRAFT',
          payload: {
            ...selectedAircraft,
            minTakeoffWeight: minWeight
          }
        });
      }
    }
  }, [selectedAircraft, dispatch]);

  // Valeurs du contexte
  const value = {
    // Navigation
    activeTab,
    setActiveTab,
    
    // Gestion des avions
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    dispatch,
    clearAllData,
    
    // Navigation et route
    ...navigation,
    
    // Masse et centrage
    loads,
    setLoads,
    currentCalculation,
    
    // Carburant
    fuelData,
    setFuelData,
    fobFuel,
    setFobFuel
  };

  return (
    <FlightSystemContext.Provider value={value}>
      {children}
    </FlightSystemContext.Provider>
  );
};