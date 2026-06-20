// src/features/weight-balance/utils/calculations.js
import { getFuelDensity } from '@utils/fuelDensity';
import { normalizeAircraftArmsToMeters } from '@utils/armUnits';
import { computeScenarioFuel } from '@utils/fuelArm';

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

  // 🔧 Item L (m/mm) : bras garantis en MÈTRES avant tout calcul (couvre wizard/import/stocké).
  aircraft = normalizeAircraftArmsToMeters(aircraft);
  const wb = aircraft.weightBalance;

  // 🔒 P0 (densité) : getFuelDensity renvoie null si le type carburant est
  // inconnu/absent. On NE fabrique plus 0.84. Densité absente ⇒ les scénarios
  // CONTENANT du carburant (fulltank/FOB/atterrissage) sont marqués INDISPONIBLES
  // dans le retour (jamais une masse carburant inventée) ; seul ZFW (masse sans
  // carburant) reste calculable. `fuelDensityForCalc` n'est qu'un calcul neutre
  // intermédiaire — son résultat est écarté quand la densité manque.
  const fuelDensity = getFuelDensity(aircraft.fuelType);
  const fuelDensityMissing = fuelDensity == null;
  const fuelDensityForCalc = fuelDensity ?? 0;

  // Valeurs par défaut pour éviter les NaN
  const safeTotalWeight = calculations.totalWeight || 0;
  const safeTotalMoment = calculations.totalMoment || 0;
  const safeFuel = loads.fuel || 0;
  const safeCG = calculations.cg || 0;

  // 🔧 CARBURANT STRICT PAR RÉSERVOIR (cf. src/utils/fuelArm.js) :
  // le moment carburant de chaque scénario est calculé réservoir par réservoir,
  // avec le bras PROPRE de chacun. Aucune moyenne de bras, aucune multiplication
  // par un bras absent, aucun bras de repli. Un réservoir chargé sans bras, ou
  // des réservoirs à bras différents sans répartition, rendent le scénario
  // INDISPONIBLE (unavailableReason) plutôt que de produire un chiffre faux.

  // Calcul du carburant restant À L'ATTERRISSAGE (FIX bug H).
  // ⚠️ AVANT : remaining = FOB − somme de TOUT fuelData (roulage+trip+contingency+alternate+réserve).
  // C'était le SURPLUS au-delà des besoins, PAS le carburant réellement à bord à l'atterrissage,
  // et ça SOUS-ESTIMAIT la masse d'atterrissage (incohérent avec PerformanceModule = trip+roulage).
  // CORRECT : carburant BRÛLÉ jusqu'à l'atterrissage destination = roulage (taxi) + trip (vol).
  // Le contingency / alternate / réserve finale restent À BORD à l'atterrissage normal.
  const fobFuelLiters = getFuelLiters(fobFuel);
  const burnedFuelL = (fuelData?.roulage?.ltr || 0) + (fuelData?.trip?.ltr || 0);
  const remainingFuelL = Math.max(0, fobFuelLiters - burnedFuelL);
  const remainingFuelKg = remainingFuelL * fuelDensityForCalc;

  // ✅ NOUVELLE APPROCHE : Calculer TOUS les scénarios depuis buildMassDetails
  // Fonction helper pour calculer poids/CG depuis items
  const calculateFromItems = (items) => {
    const totalWeight = items.reduce((sum, item) => sum + parseFloat(item.value || 0), 0);
    const totalMoment = items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0);
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
    return { totalWeight, totalMoment, cg };
  };

  // 🔧 Carburant PAR RÉSERVOIR pour chaque scénario (poids + moment exacts,
  // bras propre de chaque réservoir). Renvoie { ok:false, reason } si un bras
  // manque ('fuelArm') ou si des bras différents exigent une répartition non
  // fournie ('distribution') → le scénario devient indisponible (jamais faux).
  const fuelArgs = { aircraft, density: fuelDensityForCalc, fobLiters: fobFuelLiters, loads, wb };
  const fuelFull = computeScenarioFuel({ ...fuelArgs, scenario: 'full' });
  const fuelFob = computeScenarioFuel({ ...fuelArgs, scenario: 'fob' });
  const fuelLanding = computeScenarioFuel({ ...fuelArgs, scenario: 'landing', burnedLiters: burnedFuelL });

  // Construire les listes détaillées de masses pour chaque scénario.
  // `fuelRows` = lignes carburant (une par réservoir, ou une seule mono-bras).
  const buildMassDetails = (fuelRows = []) => {
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

    // Carburant : une ligne PAR RÉSERVOIR (bras propre de chacun), ou une seule
    // ligne pour un avion mono-bras. Produit par computeScenarioFuel — jamais de
    // moyenne ni de multiplication par un bras absent.
    for (const r of fuelRows) {
      items.push({ label: r.label, value: r.value, arm: r.arm, moment: r.moment });
    }

    return items;
  };

  // ✅ CALCUL UNIFIÉ : Tous les scénarios calculés depuis buildMassDetails
  // ZFW (sans carburant) — toujours calculable, seul scénario garanti.
  const zfwItems = buildMassDetails([]);
  const zfwCalc = calculateFromItems(zfwItems);

  // ⚠️ VÉRIFICATION MZFW : Masse sans carburant ne doit pas dépasser MZFW
  const maxZeroFuelMassRaw = aircraft.weights?.mzfw || aircraft.weights?.zfm || aircraft.maxZeroFuelWeight || null;
  const maxZeroFuelMass = maxZeroFuelMassRaw ? parseFloat(maxZeroFuelMassRaw) : null;
  const isZfwExceeded = maxZeroFuelMass && zfwCalc.totalWeight > maxZeroFuelMass;

  if (isZfwExceeded) {
    console.warn(`⚠️ MZFW DÉPASSÉ : ${zfwCalc.totalWeight.toFixed(1)} kg > ${maxZeroFuelMass.toFixed(1)} kg (limite MZFW)`);
  }

  // Construit un scénario CONTENANT du carburant à partir du résultat par
  // réservoir. INDISPONIBLE (jamais un chiffre faux) si :
  //   • densité inconnue        → 'fuelDensity'
  //   • un réservoir chargé sans bras → 'fuelArm'
  //   • bras différents sans répartition saisie → 'distribution'
  const buildFuelScenario = (fuelRes, extra = {}) => {
    if (fuelDensityMissing) return { w: null, cg: null, fuel: null, items: [], unavailableReason: 'fuelDensity', ...extra };
    if (!fuelRes.ok) return { w: null, cg: null, fuel: null, items: [], unavailableReason: fuelRes.reason, ...extra };
    const items = buildMassDetails(fuelRes.rows);
    const c = calculateFromItems(items);
    return { w: c.totalWeight, cg: c.cg, fuel: fuelRes.weight, items, ...extra };
  };

  return {
    fuelDensityMissing,
    fulltank: buildFuelScenario(fuelFull),
    toCrm: buildFuelScenario(fuelFob),
    landing: buildFuelScenario(fuelLanding, {
      // FIX H : dérivation explicite du carburant restant à l'atterrissage (total, affichage vérifiable).
      fuelDerivation: {
        fobL: fobFuelLiters,
        burnedL: burnedFuelL,
        remainingL: remainingFuelL,
        remainingKg: remainingFuelKg,
        density: fuelDensity
      }
    }),
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