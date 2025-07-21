import React, { createContext, useContext, useState, useCallback } from 'react';
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
  
  // État Masse et Centrage
  const [loads, setLoads] = useState({
    frontLeft: 85,
    frontRight: 0,
    rearLeft: 0,
    rearRight: 0,
    baggage: 10,
    auxiliary: 0
  });

  // Calculs de masse et centrage
  const calculateCG = useCallback(() => {
    if (!aircraftManager.selectedAircraft) return { totalWeight: 0, cg: 0 };
    
    const aircraft = aircraftManager.selectedAircraft;
    const wb = aircraft.weightBalance;
    const emptyMoment = aircraft.emptyWeight * wb.emptyWeightArm;
    
    const totalWeight = aircraft.emptyWeight + 
      loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight + 
      loads.baggage + loads.auxiliary;
    
    const totalMoment = emptyMoment +
      loads.frontLeft * wb.frontLeftSeatArm + loads.frontRight * wb.frontRightSeatArm +
      loads.rearLeft * wb.rearLeftSeatArm + loads.rearRight * wb.rearRightSeatArm +
      loads.baggage * wb.baggageArm + loads.auxiliary * wb.auxiliaryArm;
    
    const cg = totalMoment / totalWeight;
    return { totalWeight, cg };
  }, [aircraftManager.selectedAircraft, loads]);

  // Calculs actuels
  const currentCalculation = calculateCG();
  const isWithinLimits = aircraftManager.selectedAircraft ? 
    currentCalculation.cg >= aircraftManager.selectedAircraft.weightBalance.cgLimits.forward && 
    currentCalculation.cg <= aircraftManager.selectedAircraft.weightBalance.cgLimits.aft &&
    currentCalculation.totalWeight <= aircraftManager.selectedAircraft.maxTakeoffWeight : false;

  // Valeur du contexte - inclure toutes les propriétés du hook navigation
  const value = {
    activeTab,
    setActiveTab,
    ...aircraftManager,
    ...navigation,  // Ceci inclut maintenant flightType et setFlightType
    loads,
    setLoads,
    currentCalculation,
    isWithinLimits
  };

  return (
    <FlightSystemContext.Provider value={value}>
      {children}
    </FlightSystemContext.Provider>
  );
};