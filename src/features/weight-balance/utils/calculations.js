// src/features/weight-balance/utils/calculations.js
import { FUEL_DENSITIES } from '@utils/constants';

// Helper pour extraire les litres de fobFuel (peut être un nombre ou un objet {gal, ltr})
const getFuelLiters = (fobFuel) => {
  if (typeof fobFuel === 'number') {
    return fobFuel;
  }
  return fobFuel?.ltr || 0;
};

const GAL_TO_LTR = 3.78541;

export const calculateScenarios = (aircraft, calculations, loads, fobFuel, fuelData, fuelUnit = 'ltr') => {
  if (!aircraft || !calculations) return null;

  // ⚠️ PROTECTION CRITIQUE : Vérifier que weightBalance existe
  // Si pas de weightBalance, les calculs ne peuvent pas être effectués
  if (!aircraft.weightBalance) {
    console.error('❌ aircraft.weightBalance is undefined - cannot calculate scenarios');
    console.error('Aircraft data:', aircraft);
    return null;
  }

  const wb = aircraft.weightBalance;

  // Utiliser FUEL_DENSITIES pour une détection robuste du type de carburant
  const normalizedFuelType = aircraft.fuelType?.replace(/-/g, ' ');
  const fuelDensity = FUEL_DENSITIES[aircraft.fuelType] ||
                      FUEL_DENSITIES[normalizedFuelType] ||
                      FUEL_DENSITIES['JET A-1'] ||
                      0.84;

  // Valeurs par défaut pour éviter les NaN
  const safeTotalWeight = calculations.totalWeight || 0;
  const safeTotalMoment = calculations.totalMoment || 0;
  const safeFuel = loads.fuel || 0;
  const safeCG = calculations.cg || 0;

  // S'assurer que fuelArm existe
  const fuelArm = wb.fuelArm || 0;
  if (fuelArm === 0) {
    console.warn('⚠️ wb.fuelArm is 0 or undefined - using 0 for calculations');
  }

  // Calcul du carburant restant
  const fobFuelLiters = getFuelLiters(fobFuel);
  const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
  const remainingFuelL = Math.max(0, fobFuelLiters - fuelBalance);
  const remainingFuelKg = remainingFuelL * fuelDensity;

  // ✅ NOUVELLE APPROCHE : Calculer TOUS les scénarios depuis buildMassDetails
  // Fonction helper pour calculer poids/CG depuis items
  const calculateFromItems = (items) => {
    const totalWeight = items.reduce((sum, item) => sum + parseFloat(item.value || 0), 0);
    const totalMoment = items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0);
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    return { totalWeight, totalMoment, cg };
  };

  // Scénario 1: FULLTANK
  // 🔧 FIX: aircraft.fuelCapacity est TOUJOURS en litres (storage unit)
  // Pas besoin de conversion selon fuelUnit, c'est déjà en litres !
  const fuelCapacityLtr = aircraft.fuelCapacity || 0;
  const fulltankFuelKg = fuelCapacityLtr * fuelDensity;

  // Scénario 2: T/O FOB (actuel)
  const toCrmFuel = safeFuel;

  // Scénario 3: LANDING
  const landingFuelKg = fobFuelLiters > 0 ? remainingFuelKg : 0;

  // Construire les listes détaillées de masses pour chaque scénario
  const buildMassDetails = (fuelKg) => {
    const items = [];

    // Masse à vide (toujours présente) - Utiliser weights.emptyWeight en priorité
    const emptyWeight = parseFloat(
      aircraft.weights?.emptyWeight ||
      aircraft.emptyWeight ||
      aircraft.masses?.emptyMass ||
      0
    );

    if (emptyWeight > 0) {
      items.push({
        label: 'Masse à vide',
        value: emptyWeight,
        arm: wb.emptyWeightArm,
        moment: emptyWeight * (wb.emptyWeightArm || 0)
      });
    }

    // Sièges
    if (loads.frontLeft > 0) {
      items.push({
        label: 'Siège avant gauche',
        value: loads.frontLeft,
        arm: wb.frontLeftSeatArm,
        moment: loads.frontLeft * (wb.frontLeftSeatArm || 0)
      });
    }
    if (loads.frontRight > 0) {
      items.push({
        label: 'Siège avant droit',
        value: loads.frontRight,
        arm: wb.frontRightSeatArm,
        moment: loads.frontRight * (wb.frontRightSeatArm || 0)
      });
    }
    if (loads.rearLeft > 0) {
      items.push({
        label: 'Siège arrière gauche',
        value: loads.rearLeft,
        arm: wb.rearLeftSeatArm,
        moment: loads.rearLeft * (wb.rearLeftSeatArm || 0)
      });
    }
    if (loads.rearRight > 0) {
      items.push({
        label: 'Siège arrière droit',
        value: loads.rearRight,
        arm: wb.rearRightSeatArm,
        moment: loads.rearRight * (wb.rearRightSeatArm || 0)
      });
    }

    // Bagages (dynamiques ou par défaut)
    if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
      aircraft.baggageCompartments.forEach((compartment, index) => {
        const loadKey = `baggage_${compartment.id || index}`;
        const weight = loads[loadKey] || 0;
        const arm = parseFloat(compartment.arm) || 0;
        if (weight > 0) {
          items.push({
            label: compartment.name || `Compartiment ${index + 1}`,
            value: weight,
            arm: arm,
            moment: weight * arm
          });
        }
      });
    } else {
      if (loads.baggage > 0) {
        items.push({
          label: 'Bagages',
          value: loads.baggage,
          arm: wb.baggageArm,
          moment: loads.baggage * (wb.baggageArm || 0)
        });
      }
      if (loads.auxiliary > 0) {
        items.push({
          label: 'Rangement auxiliaire',
          value: loads.auxiliary,
          arm: wb.auxiliaryArm,
          moment: loads.auxiliary * (wb.auxiliaryArm || 0)
        });
      }
    }

    // Carburant (variable selon scénario)
    if (fuelKg > 0) {
      items.push({
        label: 'Carburant',
        value: fuelKg,
        arm: fuelArm,
        moment: fuelKg * (fuelArm || 0)
      });
    }

    return items;
  };

  // ✅ CALCUL UNIFIÉ : Tous les scénarios calculés depuis buildMassDetails
  // Construire les items d'abord, puis calculer poids/CG depuis items
  const fulltankItems = buildMassDetails(fulltankFuelKg);
  const fulltankCalc = calculateFromItems(fulltankItems);

  const toCrmItems = buildMassDetails(toCrmFuel);
  const toCrmCalc = calculateFromItems(toCrmItems);

  const landingItems = buildMassDetails(landingFuelKg);
  const landingCalc = calculateFromItems(landingItems);

  const zfwItems = buildMassDetails(0);
  const zfwCalc = calculateFromItems(zfwItems);

  // ⚠️ VÉRIFICATION MZFW : Masse sans carburant ne doit pas dépasser MZFW
  const maxZeroFuelMassRaw = aircraft.weights?.mzfw || aircraft.weights?.zfm || aircraft.maxZeroFuelWeight || null;
  const maxZeroFuelMass = maxZeroFuelMassRaw ? parseFloat(maxZeroFuelMassRaw) : null;
  const isZfwExceeded = maxZeroFuelMass && zfwCalc.totalWeight > maxZeroFuelMass;

  if (isZfwExceeded) {
    console.warn(`⚠️ MZFW DÉPASSÉ : ${zfwCalc.totalWeight.toFixed(1)} kg > ${maxZeroFuelMass.toFixed(1)} kg (limite MZFW)`);
  }

  return {
    fulltank: {
      w: fulltankCalc.totalWeight,
      cg: fulltankCalc.cg,
      fuel: fulltankFuelKg || 0,
      items: fulltankItems
    },
    toCrm: {
      w: toCrmCalc.totalWeight,
      cg: toCrmCalc.cg,
      fuel: toCrmFuel || 0,
      items: toCrmItems
    },
    landing: {
      w: landingCalc.totalWeight,
      cg: landingCalc.cg,
      fuel: landingFuelKg || 0,
      items: landingItems
    },
    zfw: {
      w: zfwCalc.totalWeight,
      cg: zfwCalc.cg,
      fuel: 0,
      items: zfwItems,
      isExceeded: isZfwExceeded,
      maxZfm: maxZeroFuelMass
    }
  };
};