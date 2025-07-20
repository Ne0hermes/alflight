import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEFAULT_AIRCRAFT_LIST, FUEL_DENSITIES } from '../utils/constants';
import { useAircraftManager } from '../hooks/useAircraftManager';
import { useNavigation } from '../hooks/useNavigation';

const FlightSystemContext = createContext();

export const useFlightSystem = () => {
  const context = useContext(FlightSystemContext);
  if (!context) {
    throw new Error('useFlightSystem must be used within FlightSystemProvider');
  }
  return context;
};

export const FlightSystemProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('navigation');
  
  // Hooks métier
  const aircraftManager = useAircraftManager();
  const navigation = useNavigation(aircraftManager.selectedAircraft);
  
  // État Masse et Centrage (avec réserve !)
  const [loads, setLoads] = useState({
    frontLeft: 85,
    frontRight: 0,
    rearLeft: 0,
    rearRight: 0,
    baggage: 10,
    auxiliary: 0,
    fuel: 70,        // Carburant de base
    reserve: 30      // Réserve ajoutée ici !
  });

  // Calculs de masse et centrage (avec carburant total)
  const calculateCG = useCallback((customFuel = null) => {
    if (!aircraftManager.selectedAircraft) return { totalWeight: 0, cg: 0, fuelWeight: 0 };
    
    const aircraft = aircraftManager.selectedAircraft;
    const wb = aircraft.weightBalance;
    const emptyMoment = aircraft.emptyWeight * wb.emptyWeightArm;
    
    // Carburant total = carburant + réserve
    const totalFuel = customFuel !== null ? customFuel : (loads.fuel + loads.reserve);
    const fuelWeight = totalFuel * FUEL_DENSITIES[aircraft.fuelType];
    
    const totalWeight = aircraft.emptyWeight + 
      loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight + 
      loads.baggage + loads.auxiliary + fuelWeight;
    
    const totalMoment = emptyMoment +
      loads.frontLeft * wb.frontLeftSeatArm + loads.frontRight * wb.frontRightSeatArm +
      loads.rearLeft * wb.rearLeftSeatArm + loads.rearRight * wb.rearRightSeatArm +
      loads.baggage * wb.baggageArm + loads.auxiliary * wb.auxiliaryArm +
      fuelWeight * wb.fuelArm;
    
    const cg = totalMoment / totalWeight;
    return { totalWeight, cg, fuelWeight, totalFuel };
  }, [aircraftManager.selectedAircraft, loads]);

  // Plus besoin de synchronisation !
  // const syncFuelToWeightBalance = supprimé

  // Calculs actuels
  const currentCalculation = calculateCG();
  const isWithinLimits = aircraftManager.selectedAircraft ? 
    currentCalculation.cg >= aircraftManager.selectedAircraft.weightBalance.cgLimits.forward && 
    currentCalculation.cg <= aircraftManager.selectedAircraft.weightBalance.cgLimits.aft &&
    currentCalculation.totalWeight <= aircraftManager.selectedAircraft.maxTakeoffWeight : false;

  // Calcul automatique du carburant requis pour la navigation
  const fuelRequiredForTrip = navigation.navigationResults.fuelRequired || 0;
  const fuelSufficient = (loads.fuel + loads.reserve) >= fuelRequiredForTrip;

  // Valeur du contexte
  const value = {
    activeTab,
    setActiveTab,
    ...aircraftManager,
    ...navigation,
    loads,
    setLoads,
    currentCalculation,
    isWithinLimits,
    fuelRequiredForTrip,    // Nouveau
    fuelSufficient          // Nouveau
  };

  return (
    <FlightSystemContext.Provider value={value}>
      {children}
    </FlightSystemContext.Provider>
  );
};