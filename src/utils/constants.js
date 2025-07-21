export const FUEL_DENSITIES = {
  'JET A-1': 0.84,
  'AVGAS 100LL': 0.72,
  'MOGAS': 0.72
};

export const DEFAULT_AIRCRAFT = {
  id: 'da40ng-default',
  registration: 'F-DEMO',
  model: 'DA40NG',
  fuelType: 'JET A-1',
  cruiseSpeed: 285,
  cruiseSpeedKt: 154,
  cruiseTimePerNm: 0.39,
  serviceCeiling: 16400,
  fuelCapacity: 148,
  fuelCapacityGal: 39.1,
  fuelConsumption: 26,
  fuelConsumptionGph: 5,
  emptyWeight: 870,
  minTakeoffWeight: 1000,
  maxTakeoffWeight: 1310,
  maxLandingWeight: 1280,
  maxBaggageWeight: 100,
  maxAuxiliaryWeight: 20,
  weightBalance: {
    frontLeftSeatArm: 2.00,
    frontRightSeatArm: 2.00,
    rearLeftSeatArm: 2.90,
    rearRightSeatArm: 2.90,
    baggageArm: 3.50,
    auxiliaryArm: 3.70,
    fuelArm: 2.40,
    emptyWeightArm: 2.30,
    cgLimits: { 
      forward: 2.05, 
      aft: 2.45, 
      forwardVariable: [
        { weight: 1000, cg: 2.00 },
        { weight: 1100, cg: 2.05 },
        { weight: 1310, cg: 2.05 }
      ]
    }
  },
  config: {
    maxTakeoffWeight: 1310,
    minTakeoffWeight: 1000,
    maxLandingWeight: 1280,
    emptyWeight: 870,
    fuelCapacity: 148,
    fuelDensity: 0.84,
    takeoff: {
      baseDistance: 385, altitudeFactor: 0.10, tempFactor: 0.015,
      weightFactor: -0.008, windInterval: 10, headwindFactor: -0.10,
      tailwindFactor: 0.15, wetRunwayFactor: 1.15, slopeFactor: 0.10, groundRatio: 0.60
    },
    landing: {
      baseDistance: 630, altitudeFactor: 0.05, tempFactor: 0.010,
      weightFactor: -0.005, windInterval: 10, headwindFactor: -0.08,
      tailwindFactor: 0.13, wetRunwayFactor: 1.43, slopeFactor: 0.05, groundRatio: 0.60
    }
  }
};

// Nouveau : liste d'avions par défaut
export const DEFAULT_AIRCRAFT_LIST = [
  DEFAULT_AIRCRAFT,
  {
    id: 'cessna-172-demo',
    registration: 'F-TEST',
    model: 'Cessna 172',
    fuelType: 'AVGAS 100LL',
    cruiseSpeed: 222,
    cruiseSpeedKt: 120,
    cruiseTimePerNm: 0.50,
    serviceCeiling: 14000,
    fuelCapacity: 204,
    fuelCapacityGal: 54,
    fuelConsumption: 24,
    fuelConsumptionGph: 6.3,
    emptyWeight: 745,
    minTakeoffWeight: 900,
    maxTakeoffWeight: 1157,
    maxLandingWeight: 1157,
    maxBaggageWeight: 54,
    maxAuxiliaryWeight: 10,
    weightBalance: {
      frontLeftSeatArm: 1.95,
      frontRightSeatArm: 1.95,
      rearLeftSeatArm: 2.90,
      rearRightSeatArm: 2.90,
      baggageArm: 3.68,
      auxiliaryArm: 3.80,
      fuelArm: 2.40,
      emptyWeightArm: 2.30,
      cgLimits: { 
        forward: 2.00, 
        aft: 2.40, 
        forwardVariable: [
          { weight: 900, cg: 1.95 },
          { weight: 1000, cg: 2.00 },
          { weight: 1157, cg: 2.00 }
        ]
      }
    },
    config: {
      maxTakeoffWeight: 1157,
      minTakeoffWeight: 900,
      maxLandingWeight: 1157,
      emptyWeight: 745,
      fuelCapacity: 204,
      fuelDensity: 0.72,
      takeoff: {
        baseDistance: 365, altitudeFactor: 0.12, tempFactor: 0.020,
        weightFactor: -0.010, windInterval: 10, headwindFactor: -0.12,
        tailwindFactor: 0.18, wetRunwayFactor: 1.25, slopeFactor: 0.12, groundRatio: 0.65
      },
      landing: {
        baseDistance: 520, altitudeFactor: 0.06, tempFactor: 0.012,
        weightFactor: -0.007, windInterval: 10, headwindFactor: -0.09,
        tailwindFactor: 0.15, wetRunwayFactor: 1.30, slopeFactor: 0.07, groundRatio: 0.58
      }
    }
  }
];