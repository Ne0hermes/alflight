// src/core/stores/weightBalanceStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { FUEL_DENSITIES } from '@utils/constants';

export const useWeightBalanceStore = create(
  immer((set, get) => ({
    // État
    loads: {
      frontLeft: 0,  // 🔧 FIX: Pas de valeur par défaut (utilisateur doit saisir)
      frontRight: 0,
      rearLeft: 0,
      rearRight: 0,
      baggage: 0,
      auxiliary: 0,
      fuel: 0
    },
    
    // Actions
    setLoads: (loads) => set(state => {
            state.loads = loads;
    }),
    
    updateLoad: (type, value) => set(state => {
            state.loads[type] = value;
    }),
    
    updateFuelLoad: (fuelLiters, fuelDensity) => set(state => {
      const fuelWeight = parseFloat((fuelLiters * fuelDensity).toFixed(1));
            state.loads.fuel = fuelWeight;
    }),
    
    // Méthode de calcul principale (pure function - no side effects)
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      
      // Utiliser les masses directement depuis aircraft ou depuis masses
      // Prioriser weights.emptyWeight (nouveau format) puis emptyWeight (legacy)
      const emptyWeight = parseFloat(
        aircraft.weights?.emptyWeight ||
        aircraft.emptyWeight ||
        aircraft.masses?.emptyMass ||
        600
      );
      const minTakeoffWeight = parseFloat(aircraft.minTakeoffWeight || aircraft.masses?.minTakeoffMass || 600);
      const maxTakeoffWeight = parseFloat(aircraft.weights?.mtow || aircraft.maxTakeoffWeight || 1150);
      
      // Vérifier les propriétés requises de l'avion
      if (!emptyWeight || !minTakeoffWeight || !maxTakeoffWeight) {
        console.error('WeightBalanceStore - Missing aircraft weight properties:', {
          emptyWeight,
          minTakeoffWeight,
          maxTakeoffWeight
        });
        return null;
      }

      // Utiliser weightBalance s'il existe, sinon créer depuis armLengths
      let wb = aircraft.weightBalance;

      // 🐛 DEBUG CG CALCULATION
      console.log('🔍 [WB-STORE] Aircraft:', aircraft.registration);
      console.log('  - aircraft.arms:', aircraft.arms);
      console.log('  - aircraft.weightBalance:', aircraft.weightBalance);
      console.log('  - aircraft.cgEnvelope:', aircraft.cgEnvelope);
      console.log('  - aircraft.cgLimits (racine):', aircraft.cgLimits);
      console.log('  - wb?.cgLimits:', wb?.cgLimits);

      if (!wb || !wb.emptyWeightArm) {
        // Fallback vers armLengths si weightBalance n'existe pas
                wb = {
          emptyWeightArm: aircraft.armLengths?.emptyMassArm || 2.00,
          frontLeftSeatArm: aircraft.armLengths?.frontSeat1Arm || 2.00,
          frontRightSeatArm: aircraft.armLengths?.frontSeat2Arm || 2.00,
          rearLeftSeatArm: aircraft.armLengths?.rearSeat1Arm || 2.90,
          rearRightSeatArm: aircraft.armLengths?.rearSeat2Arm || 2.90,
          baggageArm: aircraft.armLengths?.standardBaggageArm || 3.50,
          auxiliaryArm: aircraft.armLengths?.aftBaggageExtensionArm || aircraft.armLengths?.baggageTubeArm || 3.70,
          fuelArm: aircraft.armLengths?.fuelArm || 2.18,
          cgLimits: aircraft.cgEnvelope ? {
            forward: parseFloat(aircraft.cgEnvelope.forwardPoints?.[0]?.cg) || 2.00,
            aft: parseFloat(aircraft.cgEnvelope.aftCG) || 2.45
          } : {
            forward: 2.00,
            aft: 2.45
          }
        };
        console.log('  ⚠️ Using fallback weightBalance from armLengths');
      }

      // 🔧 FIX CRITIQUE: TOUJOURS utiliser cgEnvelope comme source de vérité
      // cgEnvelope est plus précis (varie avec la masse) que cgLimits (valeur fixe)
      const parseOrNull = (value) => {
        if (!value || value === '' || value === '0') return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      };

      if (aircraft.cgEnvelope) {
        // PRIORITÉ 1: cgEnvelope (source de vérité)
        wb.cgLimits = {
          forward: parseOrNull(aircraft.cgEnvelope.forwardPoints?.[0]?.cg),
          aft: parseOrNull(aircraft.cgEnvelope.aftCG),
          forwardVariable: aircraft.cgEnvelope.forwardPoints || []
        };
        console.log('  ✅ [WB-STORE] cgLimits créé depuis cgEnvelope (source de vérité):', wb.cgLimits);
      } else if (!wb.cgLimits && aircraft.cgLimits) {
        // PRIORITÉ 2: aircraft.cgLimits (racine)
        wb.cgLimits = {
          forward: parseOrNull(aircraft.cgLimits.forward),
          aft: parseOrNull(aircraft.cgLimits.aft),
          forwardVariable: aircraft.cgLimits.forwardVariable || []
        };
        console.log('  ✅ [WB-STORE] cgLimits créé depuis aircraft.cgLimits:', wb.cgLimits);
      } else if (!wb.cgLimits) {
        // PRIORITÉ 3: Aucune donnée disponible
        wb.cgLimits = { forward: null, aft: null, forwardVariable: [] };
        console.warn('  ⚠️ [WB-STORE] Aucune donnée cgEnvelope/cgLimits, cgLimits = null');
      } else {
        // wb.cgLimits existe déjà - le garder tel quel
        console.log('  ℹ️ [WB-STORE] wb.cgLimits existe déjà, conservation:', wb.cgLimits);
      }

      console.log('  - wb.emptyWeightArm:', wb.emptyWeightArm);
      console.log('  - wb.fuelArm:', wb.fuelArm);
      console.log('  - wb.frontLeftSeatArm:', wb.frontLeftSeatArm);
      console.log('  - wb.cgLimits (final):', wb.cgLimits);
      
      // Vérifier que toutes les propriétés requises existent
      // NOTE: baggageArm et auxiliaryArm ne sont plus requis (compartiments dynamiques)
      const requiredProps = [
        'emptyWeightArm', 'frontLeftSeatArm', 'frontRightSeatArm',
        'rearLeftSeatArm', 'rearRightSeatArm', 'fuelArm', 'cgLimits'
      ];
      
      for (const prop of requiredProps) {
        if (wb[prop] === undefined) {
          console.error(`WeightBalanceStore - Missing required property: ${prop} for aircraft:`, aircraft.registration);
          return null;
        }
      }
      
      // Vérifier cgLimits - accepter null mais pas undefined
      if (!wb.cgLimits || (wb.cgLimits.forward === undefined && wb.cgLimits.aft === undefined)) {
        console.error('WeightBalanceStore - Missing CG limits structure for aircraft:', aircraft.registration);
        return null;
      }

      // Si les valeurs sont null, log warning mais continuer (pas de vérif CG disponible)
      if (wb.cgLimits.forward === null || wb.cgLimits.aft === null) {
        console.warn('⚠️ WeightBalanceStore - CG limits are null for aircraft:', aircraft.registration, 'calculations will proceed but CG envelope check disabled');
      }
      
      let loads = get().loads;
      
      
      // Si fobFuel est fourni, utiliser ce poids de carburant pour le calcul
      // (sans modifier le state - cela doit être fait séparément)
      if (fobFuel?.ltr) {
        // Utiliser FUEL_DENSITIES pour une détection robuste du type de carburant
        const normalizedFuelType = aircraft.fuelType?.replace(/-/g, ' ');
        const fuelDensity = FUEL_DENSITIES[aircraft.fuelType] ||
                            FUEL_DENSITIES[normalizedFuelType] ||
                            FUEL_DENSITIES['JET A-1'] ||
                            0.84;
        const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
        // Créer une copie des loads avec le nouveau poids de carburant pour ce calcul
        loads = { ...loads, fuel: fuelWeight };
      }
      
      // Calcul du poids total incluant les compartiments bagages dynamiques
      let baggageWeight = 0;
      let baggageMoment = 0;
      
      // Si l'avion a des compartiments bagages définis, les utiliser
      if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
        aircraft.baggageCompartments.forEach((compartment, index) => {
          const loadKey = `baggage_${compartment.id || index}`;
          const weight = loads[loadKey] || 0;
          const arm = parseFloat(compartment.arm) || 3.50;
          baggageWeight += weight;
          baggageMoment += weight * arm;
        });
      } else {
        // Sinon, utiliser les compartiments par défaut
        baggageWeight = (loads.baggage || 0) + (loads.auxiliary || 0);
        baggageMoment = (loads.baggage || 0) * wb.baggageArm + (loads.auxiliary || 0) * wb.auxiliaryArm;
      }
      
      const totalWeight = 
        emptyWeight +
        (loads.frontLeft || 0) +
        (loads.frontRight || 0) +
        (loads.rearLeft || 0) +
        (loads.rearRight || 0) +
        baggageWeight +
        (loads.fuel || 0);
      
      // Calcul du moment total
      const emptyMoment = emptyWeight * wb.emptyWeightArm;
      const frontLeftMoment = (loads.frontLeft || 0) * wb.frontLeftSeatArm;
      const frontRightMoment = (loads.frontRight || 0) * wb.frontRightSeatArm;
      const rearLeftMoment = (loads.rearLeft || 0) * wb.rearLeftSeatArm;
      const rearRightMoment = (loads.rearRight || 0) * wb.rearRightSeatArm;
      const fuelMoment = (loads.fuel || 0) * wb.fuelArm;

      const totalMoment =
        emptyMoment +
        frontLeftMoment +
        frontRightMoment +
        rearLeftMoment +
        rearRightMoment +
        baggageMoment +
        fuelMoment;

      // 🐛 DEBUG MOMENT CALCULATION
      console.log('📊 [WB-STORE] Moment calculation:');
      console.log(`  - Empty: ${emptyWeight} kg × ${wb.emptyWeightArm} m = ${emptyMoment.toFixed(1)} kg.m`);
      console.log(`  - Front L: ${loads.frontLeft || 0} kg × ${wb.frontLeftSeatArm} m = ${frontLeftMoment.toFixed(1)} kg.m`);
      console.log(`  - Front R: ${loads.frontRight || 0} kg × ${wb.frontRightSeatArm} m = ${frontRightMoment.toFixed(1)} kg.m`);
      console.log(`  - Rear L: ${loads.rearLeft || 0} kg × ${wb.rearLeftSeatArm} m = ${rearLeftMoment.toFixed(1)} kg.m`);
      console.log(`  - Rear R: ${loads.rearRight || 0} kg × ${wb.rearRightSeatArm} m = ${rearRightMoment.toFixed(1)} kg.m`);
      console.log(`  - Baggage: ${baggageWeight} kg (moment: ${baggageMoment.toFixed(1)} kg.m)`);
      console.log(`  - Fuel: ${loads.fuel || 0} kg × ${wb.fuelArm} m = ${fuelMoment.toFixed(1)} kg.m`);
      console.log(`  - TOTAL MOMENT: ${totalMoment.toFixed(1)} kg.m`);

      // Calcul du CG
      const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
      console.log(`  - TOTAL WEIGHT: ${totalWeight.toFixed(1)} kg`);
      console.log(`  - CG: ${totalMoment.toFixed(1)} ÷ ${totalWeight.toFixed(1)} = ${cg.toFixed(4)} m (${(cg * 1000).toFixed(0)} mm)`);
      
      // Vérification des limites
      const isWithinWeight = 
        totalWeight >= minTakeoffWeight &&
        totalWeight <= maxTakeoffWeight;
      
      const isWithinCG = 
        cg >= wb.cgLimits.forward &&
        cg <= wb.cgLimits.aft;
      
      const result = {
        totalWeight: parseFloat(totalWeight.toFixed(1)),
        totalMoment: parseFloat(totalMoment.toFixed(1)),
        cg: parseFloat(cg.toFixed(3)),
        isWithinLimits: isWithinWeight && isWithinCG,
        isWithinWeight,
        isWithinCG
      };
      

      return result;
    }
  }))
);