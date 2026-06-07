// src/core/stores/weightBalanceStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getFuelDensity } from '@utils/fuelDensity';
import { cgLimitsAtMass } from '@utils/cgEnvelope';
import { normalizeAircraftArmsToMeters } from '@utils/armUnits';

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

      // 🔧 Item L (m/mm) : bras garantis en MÈTRES avant tout calcul (wizard/import/stocké).
      aircraft = normalizeAircraftArmsToMeters(aircraft);

      // Utiliser les masses directement depuis aircraft ou depuis masses
      // Prioriser weights.emptyWeight (nouveau format) puis emptyWeight (legacy)
      // 🔧 A6/P0 — Plus de masse FABRIQUÉE. Absente ⇒ NaN ⇒ calcul refusé (return
      // null ci-dessous), jamais un 600/1150 inventé qui masquerait une surcharge.
      const emptyWeight = parseFloat(
        aircraft.weights?.emptyWeight ||
        aircraft.emptyWeight ||
        aircraft.masses?.emptyMass
      );
      const maxTakeoffWeight = parseFloat(aircraft.weights?.mtow || aircraft.maxTakeoffWeight);
      // minTakeoffWeight optionnel : absent ⇒ pas de borne basse imposée (au lieu d'inventer 600).
      const minTakeoffWeight = parseFloat(aircraft.minTakeoffWeight || aircraft.masses?.minTakeoffMass);
      
      // Masse à vide et MTOW indispensables. Absentes ⇒ calcul refusé (P0) ;
      // l'UI doit afficher « masse à vide / MTOW non renseignée », jamais un chiffre.
      if (!Number.isFinite(emptyWeight) || !Number.isFinite(maxTakeoffWeight)) {
        console.error('WeightBalanceStore - Masse à vide / MTOW non renseignée:', {
          emptyWeight, maxTakeoffWeight, registration: aircraft.registration
        });
        return null;
      }

      // Utiliser weightBalance s'il existe, sinon créer depuis armLengths
      let wb = aircraft.weightBalance;

      if (!wb || !wb.emptyWeightArm) {
        // 🔧 A6/P0 — Bras dérivés de armLengths SANS fabrication. Absent ⇒ null
        // (au lieu de 2.00/2.90/3.50… inventés, qui produisaient un CG faux mais
        // d'apparence valide). Un bras null d'une station CHARGÉE rend le CG non
        // fiable ⇒ isWithinCG = null + warning (détection plus bas).
        const armOrNull = (v) => {
          const n = parseFloat(v);
          return Number.isFinite(n) && n !== 0 ? n : null;
        };
        wb = {
          emptyWeightArm: armOrNull(aircraft.armLengths?.emptyMassArm),
          frontLeftSeatArm: armOrNull(aircraft.armLengths?.frontSeat1Arm),
          frontRightSeatArm: armOrNull(aircraft.armLengths?.frontSeat2Arm),
          rearLeftSeatArm: armOrNull(aircraft.armLengths?.rearSeat1Arm),
          rearRightSeatArm: armOrNull(aircraft.armLengths?.rearSeat2Arm),
          baggageArm: armOrNull(aircraft.armLengths?.standardBaggageArm),
          auxiliaryArm: armOrNull(aircraft.armLengths?.aftBaggageExtensionArm) || armOrNull(aircraft.armLengths?.baggageTubeArm),
          fuelArm: armOrNull(aircraft.armLengths?.fuelArm),
          cgLimits: null // l'enveloppe réelle est recalculée plus bas via cgEnvelope
        };
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
      } else if (!wb.cgLimits && aircraft.cgLimits) {
        // PRIORITÉ 2: aircraft.cgLimits (racine)
        wb.cgLimits = {
          forward: parseOrNull(aircraft.cgLimits.forward),
          aft: parseOrNull(aircraft.cgLimits.aft),
          forwardVariable: aircraft.cgLimits.forwardVariable || []
        };
      } else if (!wb.cgLimits) {
        // PRIORITÉ 3: Aucune donnée disponible
        wb.cgLimits = { forward: null, aft: null, forwardVariable: [] };
        console.warn('  ⚠️ [WB-STORE] Aucune donnée cgEnvelope/cgLimits, cgLimits = null');
      } else {
        // wb.cgLimits existe déjà - le garder tel quel
      }

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
        // Densité depuis la source unique (constants.js), alias normalisés.
        const fuelDensity = getFuelDensity(aircraft.fuelType) ?? 0.84;
        const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
        // Créer une copie des loads avec le nouveau poids de carburant pour ce calcul
        loads = { ...loads, fuel: fuelWeight };
      }
      
      // Calcul du poids total incluant les compartiments bagages dynamiques
      let baggageWeight = 0;
      let baggageMoment = 0;
      
      // Si l'avion a des compartiments bagages définis, les utiliser
      let baggageArmMissing = false;
      if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
        aircraft.baggageCompartments.forEach((compartment, index) => {
          const loadKey = `baggage_${compartment.id || index}`;
          const weight = loads[loadKey] || 0;
          const arm = parseFloat(compartment.arm); // A6/P0 : plus de 3.50 inventé
          if (weight > 0 && !Number.isFinite(arm)) baggageArmMissing = true;
          baggageWeight += weight;
          baggageMoment += weight * (Number.isFinite(arm) ? arm : 0);
        });
      } else {
        // Sinon, utiliser les compartiments par défaut
        baggageWeight = (loads.baggage || 0) + (loads.auxiliary || 0);
        const bArm = parseFloat(wb.baggageArm);
        const aArm = parseFloat(wb.auxiliaryArm);
        if ((loads.baggage || 0) > 0 && !Number.isFinite(bArm)) baggageArmMissing = true;
        if ((loads.auxiliary || 0) > 0 && !Number.isFinite(aArm)) baggageArmMissing = true;
        baggageMoment = (loads.baggage || 0) * (Number.isFinite(bArm) ? bArm : 0) +
                        (loads.auxiliary || 0) * (Number.isFinite(aArm) ? aArm : 0);
      }
      
      // ─── Carburant : PAR RÉSERVOIR si l'avion en a (bras distincts), sinon
      //     bloc unique. Demande pilote : répartir le carburant dans les
      //     différents réservoirs pour un centrage exact (chaque réservoir a
      //     son propre bras de levier). Les loads par réservoir sont en LITRES,
      //     clé `fuel_${tank.id}` ; convertis en kg via la densité.
      const fuelTanks = Array.isArray(aircraft.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
      const fuelDensityWB = getFuelDensity(aircraft.fuelType) ?? 0.84;
      let fuelWeight = 0;
      let fuelMoment = 0;
      let fuelArmMissing = false;
      const usePerTankFuel = fuelTanks.length > 0 &&
        fuelTanks.some((t, i) => Number.isFinite(parseFloat(loads[`fuel_${t.id ?? i}`])));
      if (usePerTankFuel) {
        fuelTanks.forEach((t, i) => {
          const liters = parseFloat(loads[`fuel_${t.id ?? i}`]) || 0; // litres dans ce réservoir
          const w = liters * fuelDensityWB;
          const arm = parseFloat(t.arm);
          if (w > 0 && !Number.isFinite(arm)) fuelArmMissing = true;
          fuelWeight += w;
          fuelMoment += w * (Number.isFinite(arm) ? arm : 0);
        });
      } else {
        // Repli : bloc carburant unique (loads.fuel en kg = FOB×densité), bras unique.
        fuelWeight = loads.fuel || 0;
        const fArm = parseFloat(wb.fuelArm);
        if (fuelWeight > 0 && !Number.isFinite(fArm)) fuelArmMissing = true;
        fuelMoment = fuelWeight * (Number.isFinite(fArm) ? fArm : 0);
      }

      const totalWeight =
        emptyWeight +
        (loads.frontLeft || 0) +
        (loads.frontRight || 0) +
        (loads.rearLeft || 0) +
        (loads.rearRight || 0) +
        baggageWeight +
        fuelWeight;

      // Calcul du moment total
      const emptyMoment = emptyWeight * wb.emptyWeightArm;
      const frontLeftMoment = (loads.frontLeft || 0) * wb.frontLeftSeatArm;
      const frontRightMoment = (loads.frontRight || 0) * wb.frontRightSeatArm;
      const rearLeftMoment = (loads.rearLeft || 0) * wb.rearLeftSeatArm;
      const rearRightMoment = (loads.rearRight || 0) * wb.rearRightSeatArm;

      const totalMoment =
        emptyMoment +
        frontLeftMoment +
        frontRightMoment +
        rearLeftMoment +
        rearRightMoment +
        baggageMoment +
        fuelMoment;

      // Calcul du CG
      const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;

      // 🔧 A6/P0 — Bras manquant pour une station CHARGÉE ⇒ CG non fiable.
      const warnings = [];
      const missingArms = [
        { w: emptyWeight, a: wb.emptyWeightArm, label: 'masse à vide' },
        { w: loads.frontLeft, a: wb.frontLeftSeatArm, label: 'siège avant gauche' },
        { w: loads.frontRight, a: wb.frontRightSeatArm, label: 'siège avant droit' },
        { w: loads.rearLeft, a: wb.rearLeftSeatArm, label: 'siège arrière gauche' },
        { w: loads.rearRight, a: wb.rearRightSeatArm, label: 'siège arrière droit' },
      ].filter((x) => (parseFloat(x.w) || 0) > 0 && !Number.isFinite(parseFloat(x.a))).map((x) => x.label);
      if (baggageArmMissing) missingArms.push('bagages');
      if (fuelArmMissing) missingArms.push('carburant');
      const cgReliable = missingArms.length === 0;
      if (!cgReliable) warnings.push(`Bras de levier manquant(s) : ${missingArms.join(', ')} — centrage non vérifiable`);

      // Vérification des limites (borne basse seulement si minTakeoffWeight connu).
      const isWithinWeight = totalWeight <= maxTakeoffWeight &&
        (Number.isFinite(minTakeoffWeight) ? totalWeight >= minTakeoffWeight : true);

      // 🔧 A2/A3 — Enveloppe RÉELLE interpolée à la masse (remplace le rectangle
      // constant [forwardPoints[0].cg, aftCG]).
      const cgLimitsAtTOW = cgLimitsAtMass(
        aircraft.cgEnvelope || aircraft.cgLimits || wb.cgLimits,
        totalWeight
      );
      // CG non fiable (bras manquant) ⇒ isWithinCG = null (pas un faux « OK »).
      const isWithinCG = !cgReliable ? null
        : ((cgLimitsAtTOW.forward !== null && cgLimitsAtTOW.aft !== null)
            ? (cg >= cgLimitsAtTOW.forward && cg <= cgLimitsAtTOW.aft)
            : false); // enveloppe incomplète → fail-closed

      // Fail-closed : centrage non fiable ou inconnu ⇒ jamais « dans les limites ».
      const isWithinLimits = cgReliable && isWithinWeight && isWithinCG === true;

      const result = {
        totalWeight: parseFloat(totalWeight.toFixed(1)),
        totalMoment: parseFloat(totalMoment.toFixed(1)),
        cg: parseFloat(cg.toFixed(3)),
        isWithinLimits,
        isWithinWeight,
        isWithinCG,
        cgReliable,
        warnings,
        // Limites CG effectivement appliquées À cette masse (interpolées).
        cgLimits: { forward: cgLimitsAtTOW.forward, aft: cgLimitsAtTOW.aft }
      };
      

      return result;
    }
  }))
);