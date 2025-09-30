// src/features/weight-balance/utils/calculations.js

export const calculateScenarios = (aircraft, calculations, loads, fobFuel, fuelData) => {
  if (!aircraft || !calculations) return null;

  const wb = aircraft.weightBalance;
  const fuelDensity = aircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
  
  // Valeurs par défaut pour éviter les NaN
  const safeTotalWeight = calculations.totalWeight || 0;
  const safeTotalMoment = calculations.totalMoment || 0;
  const safeFuel = loads.fuel || 0;
  const safeCG = calculations.cg || 0;
  
  // Calcul du carburant restant
  const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
  const remainingFuelL = Math.max(0, (fobFuel?.ltr || 0) - fuelBalance);
  const remainingFuelKg = remainingFuelL * fuelDensity;
  
  // Poids sans carburant
  const zeroFuelWeight = Math.max(0, safeTotalWeight - safeFuel);
  
  // Moment sans carburant
  const zeroFuelMoment = safeTotalMoment - (safeFuel * wb.fuelArm);
  
  // Scénario 1: FULLTANK
  const fulltankFuelKg = aircraft.fuelCapacity * fuelDensity;
  const fulltankWeight = zeroFuelWeight + fulltankFuelKg;
  const fulltankMoment = zeroFuelMoment + (fulltankFuelKg * wb.fuelArm);
  const fulltankCG = fulltankWeight > 0 ? fulltankMoment / fulltankWeight : 0;
  
  // Scénario 2: T/O CRM (actuel)
  const toCrmWeight = safeTotalWeight;
  const toCrmCG = safeCG;
  const toCrmFuel = safeFuel;
  
  // Scénario 3: LANDING
  const landingFuelKg = fobFuel?.ltr > 0 ? remainingFuelKg : 0;
  const landingWeight = zeroFuelWeight + landingFuelKg;
  const landingMoment = zeroFuelMoment + (landingFuelKg * wb.fuelArm);
  const landingCG = landingWeight > 0 ? landingMoment / landingWeight : 0;
  
  // Scénario 4: ZFW
  const zfwCG = zeroFuelWeight > 0 ? zeroFuelMoment / zeroFuelWeight : 0;
  
  return {
    fulltank: {
      w: fulltankWeight || 0,
      cg: fulltankCG || 0,
      fuel: fulltankFuelKg || 0
    },
    toCrm: {
      w: toCrmWeight || 0,
      cg: toCrmCG || 0,
      fuel: toCrmFuel || 0
    },
    landing: {
      w: landingWeight || 0,
      cg: landingCG || 0,
      fuel: landingFuelKg || 0
    },
    zfw: {
      w: zeroFuelWeight || 0,
      cg: zfwCG || 0,
      fuel: 0
    }
  };
};