// src/context/FlightSystemContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAircraftManager } from '@hooks/useAircraftManager';
import { useNavigation } from '@hooks/useNavigation';
import { NavigationCalculations } from '@utils/calculations';
import { FUEL_DENSITIES } from '@utils/constants';

const FlightSystemContext = createContext(null);

export const FlightSystemProvider = ({ children }) => {
  // Tab actif
  const [activeTab, setActiveTab] = useState('navigation');
  
  // Gestion des avions
  const {
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    dispatch,
    clearAllData
  } = useAircraftManager();
  
  // Navigation
  const {
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    navigationResults,
    flightType,
    setFlightType
  } = useNavigation(selectedAircraft);
  
  // État pour masse et centrage
  const [loads, setLoads] = useState({
    frontLeft: 80,    // Pilote
    frontRight: 0,    // Copilote/Passager avant
    rearLeft: 0,      // Passager arrière gauche
    rearRight: 0,     // Passager arrière droit
    baggage: 0,       // Bagages
    auxiliary: 0,     // Rangement auxiliaire
    fuel: 100         // Carburant
  });
  
  // État pour le carburant
  const [fuelData, setFuelData] = useState({
    roulage: { gal: 1.0, ltr: 1.0 * 3.78541 },
    trip: { gal: 0, ltr: 0 },
    contingency: { gal: 1, ltr: 1 * 3.78541 },
    alternate: { gal: 2.0, ltr: 2.0 * 3.78541 },
    finalReserve: { gal: 0, ltr: 0 },
    additional: { gal: 0, ltr: 0 },
    extra: { gal: 0, ltr: 0 }
  });
  
  // FOB (Fuel On Board) au lieu de CRM
  const [fobFuel, setFobFuel] = useState({ gal: 0, ltr: 0 });
  
  // 🚀 AUTOMATISATION DU TRIP FUEL
  useEffect(() => {
    if (navigationResults && navigationResults.fuelRequired !== undefined) {
      const tripFuelLiters = navigationResults.fuelRequired || 0;
      const tripFuelGallons = tripFuelLiters / 3.78541;
      
      setFuelData(prev => ({
        ...prev,
        trip: {
          gal: tripFuelGallons,
          ltr: tripFuelLiters
        }
      }));
    }
  }, [navigationResults?.fuelRequired]);
  
  // Mettre à jour automatiquement la réserve finale selon la réglementation
  useEffect(() => {
    if (navigationResults && navigationResults.regulationReserveLiters !== undefined) {
      const regulationReserveLiters = navigationResults.regulationReserveLiters || 0;
      const regulationReserveGallons = regulationReserveLiters / 3.78541;
      
      setFuelData(prev => ({
        ...prev,
        finalReserve: {
          gal: regulationReserveGallons,
          ltr: regulationReserveLiters
        }
      }));
    }
  }, [navigationResults?.regulationReserveLiters]);
  
  // Mettre à jour automatiquement le contingency fuel (5% du trip fuel, minimum 1 gal)
  useEffect(() => {
    if (navigationResults && navigationResults.fuelRequired !== undefined) {
      const tripFuelLiters = navigationResults.fuelRequired || 0;
      const tripFuelGallons = tripFuelLiters / 3.78541;
      const contingencyGallons = Math.max(1, tripFuelGallons * 0.05);
      const contingencyLiters = contingencyGallons * 3.78541;
      
      setFuelData(prev => ({
        ...prev,
        contingency: {
          gal: contingencyGallons,
          ltr: contingencyLiters
        }
      }));
    }
  }, [navigationResults?.fuelRequired]);
  
  // 🔗 SYNCHRONISATION AUTOMATIQUE AVEC LE CENTRAGE
  // Mettre à jour automatiquement le carburant FOB basé sur le total du bilan
  useEffect(() => {
    const totalFuelLiters = Object.values(fuelData).reduce((sum, fuel) => sum + (fuel?.ltr || 0), 0);
    const totalFuelGallons = totalFuelLiters / 3.78541;
    
    // Mettre à jour le FOB automatiquement si pas encore défini manuellement
    if (fobFuel.ltr === 0 && totalFuelLiters > 0) {
      setFobFuel({
        ltr: totalFuelLiters,
        gal: totalFuelGallons
      });
    }
  }, [fuelData]);
  
  // Calculer le carburant à partir des résultats de navigation pour le centrage
  useEffect(() => {
    if (fobFuel.ltr > 0 && selectedAircraft) {
      // Utiliser le FOB défini plutôt que navigationResults
      const fuelDensity = FUEL_DENSITIES[selectedAircraft.fuelType] || 0.72;
      const fuelMass = fobFuel.ltr * fuelDensity;
      
      setLoads(prev => ({
        ...prev,
        fuel: Math.round(fuelMass)
      }));
    } else if (navigationResults && selectedAircraft) {
      // Fallback sur navigationResults si pas de FOB
      const fuelRequiredLiters = navigationResults.fuelWithReserve || 0;
      const fuelDensity = FUEL_DENSITIES[selectedAircraft.fuelType] || 0.72;
      const fuelMass = fuelRequiredLiters * fuelDensity;
      
      setLoads(prev => ({
        ...prev,
        fuel: Math.round(fuelMass)
      }));
    }
  }, [fobFuel, navigationResults, selectedAircraft]);
  
  // Calculs masse et centrage
  const currentCalculation = useMemo(() => {
    if (!selectedAircraft) {
      return {
        totalWeight: 0,
        cg: 0,
        totalMoment: 0,
        isWithinLimits: false
      };
    }
    
    // Calcul de la masse totale
    const totalWeight = 
      selectedAircraft.emptyWeight +
      loads.frontLeft +
      loads.frontRight +
      loads.rearLeft +
      loads.rearRight +
      loads.baggage +
      loads.auxiliary +
      loads.fuel;
    
    // Calcul du moment total
    const totalMoment = 
      selectedAircraft.emptyWeight * selectedAircraft.weightBalance.emptyWeightArm +
      loads.frontLeft * selectedAircraft.weightBalance.frontLeftSeatArm +
      loads.frontRight * selectedAircraft.weightBalance.frontRightSeatArm +
      loads.rearLeft * selectedAircraft.weightBalance.rearLeftSeatArm +
      loads.rearRight * selectedAircraft.weightBalance.rearRightSeatArm +
      loads.baggage * selectedAircraft.weightBalance.baggageArm +
      loads.auxiliary * selectedAircraft.weightBalance.auxiliaryArm +
      loads.fuel * selectedAircraft.weightBalance.fuelArm;
    
    // Calcul du centre de gravité
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    
    // Vérification des limites (incluant les limites variables si présentes)
    let forwardLimit = selectedAircraft.weightBalance.cgLimits.forward;
    
    // Si l'avion a des limites avant variables
    if (selectedAircraft.weightBalance.cgLimits.forwardVariable && 
        selectedAircraft.weightBalance.cgLimits.forwardVariable.length > 0) {
      
      const sortedPoints = [...selectedAircraft.weightBalance.cgLimits.forwardVariable]
        .sort((a, b) => a.weight - b.weight);
      
      // Interpolation pour trouver la limite avant à la masse actuelle
      if (totalWeight <= sortedPoints[0].weight) {
        forwardLimit = sortedPoints[0].cg;
      } else if (totalWeight >= sortedPoints[sortedPoints.length - 1].weight) {
        forwardLimit = sortedPoints[sortedPoints.length - 1].cg;
      } else {
        // Interpolation linéaire
        for (let i = 0; i < sortedPoints.length - 1; i++) {
          if (totalWeight >= sortedPoints[i].weight && totalWeight <= sortedPoints[i + 1].weight) {
            const ratio = (totalWeight - sortedPoints[i].weight) / 
                         (sortedPoints[i + 1].weight - sortedPoints[i].weight);
            forwardLimit = sortedPoints[i].cg + ratio * (sortedPoints[i + 1].cg - sortedPoints[i].cg);
            break;
          }
        }
      }
    }
    
    const isWithinLimits = 
      cg >= forwardLimit &&
      cg <= selectedAircraft.weightBalance.cgLimits.aft &&
      totalWeight >= selectedAircraft.minTakeoffWeight &&
      totalWeight <= selectedAircraft.maxTakeoffWeight;
    
    return {
      totalWeight,
      cg,
      totalMoment,
      isWithinLimits,
      forwardLimit
    };
  }, [selectedAircraft, loads]);
  
  // Contexte value
  const value = {
    // Navigation
    activeTab,
    setActiveTab,
    
    // Avions
    aircraftList,
    selectedAircraft,
    setSelectedAircraft,
    dispatch,
    clearAllData,
    
    // Navigation
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    navigationResults,
    flightType,
    setFlightType,
    
    // Masse et centrage
    loads,
    setLoads,
    currentCalculation,
    
    // Carburant - Avec FOB au lieu de CRM
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

// Hook pour utiliser le contexte
export const useFlightSystem = () => {
  const context = useContext(FlightSystemContext);
  if (!context) {
    throw new Error('useFlightSystem must be used within FlightSystemProvider');
  }
  return context;
};