// src/features/weight-balance/utils/calculations.js

export const calculateScenarios = (aircraft, calculations, loads, fobFuel, fuelData) => {
  if (!aircraft || !calculations) return null;

  const wb = aircraft.weightBalance;
  const fuelDensity = aircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
  
  // Calcul du carburant restant
  const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
  const remainingFuelL = Math.max(0, (fobFuel?.ltr || 0) - fuelBalance);
  const remainingFuelKg = remainingFuelL * fuelDensity;
  
  // Poids sans carburant
  const zeroFuelWeight = calculations.totalWeight - loads.fuel;
  
  // Moment sans carburant
  const zeroFuelMoment = calculations.totalMoment - (loads.fuel * wb.fuelArm);
  
  // Scénario 1: FULLTANK
  const fulltankFuelKg = aircraft.fuelCapacity * fuelDensity;
  const fulltankWeight = zeroFuelWeight + fulltankFuelKg;
  const fulltankMoment = zeroFuelMoment + (fulltankFuelKg * wb.fuelArm);
  const fulltankCG = fulltankWeight > 0 ? fulltankMoment / fulltankWeight : 0;
  
  // Scénario 2: T/O CRM (actuel)
  const toCrmWeight = calculations.totalWeight;
  const toCrmCG = calculations.cg;
  const toCrmFuel = loads.fuel;
  
  // Scénario 3: LANDING
  const landingFuelKg = fobFuel?.ltr > 0 ? remainingFuelKg : 0;
  const landingWeight = zeroFuelWeight + landingFuelKg;
  const landingMoment = zeroFuelMoment + (landingFuelKg * wb.fuelArm);
  const landingCG = landingWeight > 0 ? landingMoment / landingWeight : 0;
  
  // Scénario 4: ZFW
  const zfwCG = zeroFuelWeight > 0 ? zeroFuelMoment / zeroFuelWeight : 0;
  
  return {
    fulltank: {
      w: fulltankWeight,
      cg: fulltankCG,
      fuel: fulltankFuelKg
    },
    toCrm: {
      w: toCrmWeight,
      cg: toCrmCG,
      fuel: toCrmFuel
    },
    landing: {
      w: landingWeight,
      cg: landingCG,
      fuel: landingFuelKg
    },
    zfw: {
      w: zeroFuelWeight,
      cg: zfwCG,
      fuel: 0
    }
  };
};