// packages/calc-engine/src/wb/computeWeightBalance.js
//
// VERDICT DE MASSE & CENTRAGE — extrait du store zustand (Phase 2, vague 2).
//
// Le calcul était déterministe mais enfermé dans une action de store : il lisait
// les charges et la configuration réservoirs directement dans deux stores, ce qui
// le rendait inexécutable côté serveur. Ces deux lectures sont devenues des
// PARAMÈTRES ; le corps du calcul est inchangé, déplacé texte pour texte.
//
// Fail-closed conservé : masse absente, densité inconnue, bras ambigu ou
// enveloppe incomplète ⇒ refus explicite, jamais un verdict fabriqué.
//
// @param {object}   p.aircraft        avion (bras et enveloppe normalisés ici même)
// @param {object}   p.loads           charges par poste (kg)
// @param {object|number} p.fobFuel    carburant embarqué ({ltr} ou litres)
// @param {string[]|null} p.activeTankIds réservoirs embarqués (null = tous)
// @returns {object|null} verdict, ou null si le calcul est refusé

import { getFuelDensity } from '../units/fuelDensity.js';
import { normalizeAircraftArmsToMeters, normalizeAircraftCgEnvelopeToMeters } from './armUnits.js';
import { cgLimitsAtMass } from './cgEnvelope.js';
import { singleFuelArm } from './fuelArm.js';

/**
 * Bras de levier du bilan : weightBalance s'il existe, sinon DÉRIVÉS de
 * armLengths SANS fabrication (A6/P0 — absent ⇒ null, jamais un bras inventé).
 * Extrait du corps de computeWeightBalance (27/08/2026) pour être partagé avec
 * le banc de cas de référence M&C (referenceCases.js) — même résolution,
 * texte pour texte, jamais une seconde logique qui pourrait diverger.
 * ⚠️ Attend un avion DÉJÀ normalisé en mètres (normalizeAircraftArmsToMeters).
 * @param {object} aircraft
 * @returns {object} bras du bilan (l'objet weightBalance d'origine, ou un dérivé)
 */
export function resolveWbArms(aircraft) {
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
      return wb;
}

export function computeWeightBalance({ aircraft, loads = {}, fobFuel = null, activeTankIds = null }) {
      if (!aircraft) return null;

      // Avertissements métier remontés à l'appelant (l'ancienne version les
      // écrivait en console). Déclaré ICI : le premier avertissement possible
      // (limites de centrage absentes) survient bien avant l'endroit où la
      // liste était créée dans le store.
      const warnings = [];

      // 🔧 Item L (m/mm) : bras garantis en MÈTRES avant tout calcul (wizard/import/stocké).
      aircraft = normalizeAircraftArmsToMeters(aircraft);
      // 🔧 C3.3 (ANO-13) : l'ENVELOPPE CG aussi — sans quoi un avion legacy
      // (copie IndexedDB locale, import) avec limites en mm était comparé à un
      // CG en mètres → verdict faux. CG uniquement, jamais masses ni moments.
      aircraft = normalizeAircraftCgEnvelopeToMeters(aircraft);

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
        // Masse à vide ou masse maximale absente : calcul REFUSÉ. Jamais une
        // masse inventée, qui masquerait une surcharge (règle A6/P0).
        return null;
      }

      // Bras du bilan : weightBalance ou dérivés d'armLengths (résolution
      // partagée avec le banc de cas de référence — cf. resolveWbArms ci-dessus).
      let wb = resolveWbArms(aircraft);

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
          return null;
        }
      }
      
      // Vérifier cgLimits - accepter null mais pas undefined
      if (!wb.cgLimits || (wb.cgLimits.forward === undefined && wb.cgLimits.aft === undefined)) {
        return null;
      }

      // Si les valeurs sont null, log warning mais continuer (pas de vérif CG disponible)
      if (wb.cgLimits.forward === null || wb.cgLimits.aft === null) {
        warnings.push('Limites de centrage non renseignées : la vérification de l\'enveloppe est désactivée.');
      }
      
      // (paramètre explicite — était `get().loads`, attache au store zustand)
      
      
      // 🔒 P0 (densité) : getFuelDensity (source unique constants.js) renvoie
      // null si le type carburant est inconnu/absent. On NE fabrique PLUS 0.84 :
      // densité absente ⇒ masse carburant non calculable ⇒ bilan fail-closed
      // (cf. fuelDensityMissing plus bas). Carburant fourni DIRECTEMENT en kg
      // (loads.fuel, sans fobFuel/réservoirs) ⇒ densité inutile, pas de blocage.
      const fuelDensity = getFuelDensity(aircraft.fuelType);
      let fuelDensityMissing = false;

      // Si fobFuel est fourni, utiliser ce poids de carburant pour le calcul
      // (sans modifier le state - cela doit être fait séparément)
      if (fobFuel?.ltr) {
        if (fuelDensity == null) {
          fuelDensityMissing = true; // type inconnu → aucune masse carburant inventée
        } else {
          const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
          // Créer une copie des loads avec le nouveau poids de carburant pour ce calcul
          loads = { ...loads, fuel: fuelWeight };
        }
      }
      
      // Calcul du poids total incluant les compartiments bagages dynamiques
      let baggageWeight = 0;
      let baggageMoment = 0;

      // ─── Limites BAGAGES du manuel (19/08/2026, cas F-BXQT : C1 max 54 kg,
      //     C2 max 18 kg, MAIS total soute max 54 kg) ───────────────────────
      // Jusqu'ici, maxBaggageTotalMass (saisi dans Step3 avec la promesse
      // « sera contrôlée lors du calcul M&C ») n'était LU PAR AUCUN calcul, et
      // les maxWeight PAR compartiment n'étaient qu'une borne d'UI (champ
      // plafonné dans Step6). L'application déclarait donc un contrôle qui
      // n'existait pas. Le moteur contrôle désormais les deux : dépassement ⇒
      // avertissement explicite ET verdict hors limites (isBaggageOverLimit
      // participe à isWithinLimits, exposé à part pour un affichage dédié).
      // ⚠️ Aucune limite FABRIQUÉE : champ absent / non fini / ≤ 0 ⇒ aucun
      // contrôle, comportement strictement inchangé.
      const baggageWarnings = [];

      // Si l'avion a des compartiments bagages définis, les utiliser
      let baggageArmMissing = false;
      if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
        aircraft.baggageCompartments.forEach((compartment, index) => {
          const loadKey = `baggage_${compartment.id || index}`;
          const weight = loads[loadKey] || 0;
          const arm = parseFloat(compartment.arm); // A6/P0 : plus de 3.50 inventé
          // 🔧 25/08/2026 (Lot 1.0) — un bras à 0 est un bras MANQUANT : aucun
          // poste réel n'est au point de référence, et le normaliseur a
          // longtemps écrit 0 pour « absent ». Il déclenchait un moment nul
          // d'apparence normale — fail-closed en façade, fail-open en fait.
          const armOk = Number.isFinite(arm) && arm !== 0;
          if (weight > 0 && !armOk) baggageArmMissing = true;
          baggageWeight += weight;
          baggageMoment += weight * (armOk ? arm : 0);
          // Limite PAR compartiment (manuel de vol). Contrôle moteur : l'UI
          // borne la saisie mais rien ne verrouillait le VERDICT jusqu'ici.
          const maxW = parseFloat(compartment.maxWeight);
          if (Number.isFinite(maxW) && maxW > 0 && weight > maxW) {
            baggageWarnings.push(
              `Compartiment « ${compartment.name || `bagages ${index + 1}`} » : ${weight.toFixed(1)} kg > maximum ${maxW.toFixed(1)} kg du manuel`
            );
          }
        });
      } else {
        // Sinon, utiliser les compartiments par défaut
        baggageWeight = (loads.baggage || 0) + (loads.auxiliary || 0);
        const bArm = parseFloat(wb.baggageArm);
        const aArm = parseFloat(wb.auxiliaryArm);
        // 🔧 25/08/2026 — même règle : 0 = manquant (cf. compartiments).
        const bOk = Number.isFinite(bArm) && bArm !== 0;
        const aOk = Number.isFinite(aArm) && aArm !== 0;
        if ((loads.baggage || 0) > 0 && !bOk) baggageArmMissing = true;
        if ((loads.auxiliary || 0) > 0 && !aOk) baggageArmMissing = true;
        baggageMoment = (loads.baggage || 0) * (bOk ? bArm : 0) +
                        (loads.auxiliary || 0) * (aOk ? aArm : 0);
      }

      // Limite TOTALE de soute (maxBaggageTotalMass, kg canonique, racine de la
      // fiche). Somme des charges de soute du vol : compartiments dynamiques
      // (déjà dans baggageWeight) + clés legacy baggage/auxiliary — en mode
      // compartiments elles ne participent pas au bilan mais restent comptées
      // dans la limite par sécurité (elles devraient être nulles).
      let baggageLoadTotal = baggageWeight;
      if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
        baggageLoadTotal += (loads.baggage || 0) + (loads.auxiliary || 0);
      }
      const maxBaggageTotal = parseFloat(aircraft.maxBaggageTotalMass);
      if (Number.isFinite(maxBaggageTotal) && maxBaggageTotal > 0 && baggageLoadTotal > maxBaggageTotal) {
        baggageWarnings.push(
          `Bagages : ${baggageLoadTotal.toFixed(1)} kg > maximum total ${maxBaggageTotal.toFixed(1)} kg du manuel`
        );
      }
      const isBaggageOverLimit = baggageWarnings.length > 0;
      warnings.push(...baggageWarnings);
      
      // ─── Carburant : PAR RÉSERVOIR si l'avion en a (bras distincts), sinon
      //     bloc unique. Demande pilote : répartir le carburant dans les
      //     différents réservoirs pour un centrage exact (chaque réservoir a
      //     son propre bras de levier). Les loads par réservoir sont en LITRES,
      //     clé `fuel_${tank.id}` ; convertis en kg via la densité.
      const fuelTanks = Array.isArray(aircraft.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
      // Configuration réservoirs du vol (fuelStore) : null si non engagée pour
      // cet avion → comportement historique (tous les réservoirs comptent).
      // Engagée : seuls les réservoirs COCHÉS (embarqués) participent au bilan.
      // (paramètre explicite — était une lecture directe du store carburant)
      const activeTankSet = activeTankIds == null ? null : new Set(activeTankIds.map(String));
      let fuelWeight = 0;
      let fuelMoment = 0;
      let fuelArmMissing = false;
      const usePerTankFuel = fuelTanks.length > 0 &&
        fuelTanks.some((t, i) => Number.isFinite(parseFloat(loads[`fuel_${t.id ?? i}`])));
      if (usePerTankFuel) {
        fuelTanks.forEach((t, i) => {
          if (activeTankSet && !activeTankSet.has(String(t.id ?? i))) return; // non embarqué ce vol
          const liters = parseFloat(loads[`fuel_${t.id ?? i}`]) || 0; // litres dans ce réservoir
          if (liters > 0 && fuelDensity == null) fuelDensityMissing = true;
          const w = fuelDensity == null ? 0 : liters * fuelDensity;
          const arm = parseFloat(t.arm);
          if (w > 0 && !Number.isFinite(arm)) fuelArmMissing = true;
          fuelWeight += w;
          fuelMoment += w * (Number.isFinite(arm) ? arm : 0);
        });
      } else {
        // Repli : bloc carburant unique (loads.fuel en kg = FOB×densité), sans
        // répartition par réservoir. 🔧 STRICT (cf. src/utils/fuelArm.js) :
        // on n'utilise un bras unique QUE s'il est non ambigu (1 réservoir, ou
        // tous au MÊME bras, ou legacy). Bras manquant OU bras DIFFÉRENTS sans
        // répartition ⇒ fuelArmMissing (centrage non vérifiable). JAMAIS de
        // moyenne, jamais de × bras absent : le pilote doit répartir par
        // réservoir (branche usePerTankFuel ci-dessus) pour lever l'ambiguïté.
        fuelWeight = loads.fuel || 0;
        const fa = singleFuelArm(aircraft, wb, activeTankIds);
        if (fuelWeight > 0 && fa.error) fuelArmMissing = true;
        fuelMoment = fa.arm != null ? fuelWeight * fa.arm : 0;
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
      // (la liste `warnings` est déclarée en tête de fonction)
      const missingArms = [
        { w: emptyWeight, a: wb.emptyWeightArm, label: 'masse à vide' },
        { w: loads.frontLeft, a: wb.frontLeftSeatArm, label: 'siège avant gauche' },
        { w: loads.frontRight, a: wb.frontRightSeatArm, label: 'siège avant droit' },
        { w: loads.rearLeft, a: wb.rearLeftSeatArm, label: 'siège arrière gauche' },
        { w: loads.rearRight, a: wb.rearRightSeatArm, label: 'siège arrière droit' },
      ].filter((x) => (parseFloat(x.w) || 0) > 0 && !Number.isFinite(parseFloat(x.a))).map((x) => x.label);
      if (baggageArmMissing) missingArms.push('bagages');
      if (fuelArmMissing) missingArms.push('carburant');
      // ⛔ Lot 1.0 (25/08) — SIÈGES ADDITIONNELS : la fiche peut en déclarer
      // (3 éditeurs le permettent, « configurations 6+ places ») mais AUCUN
      // moteur ne les pèse — l'occupant du 5e siège n'existe pas pour ce devis.
      // Tant que leur prise en compte n'est pas implémentée, un avion qui en
      // déclare rend son devis NON FIABLE, explicitement (jamais un
      // « dans les limites » silencieusement amputé d'un occupant).
      const additionalSeatsDeclared = Array.isArray(aircraft.additionalSeats)
        ? aircraft.additionalSeats.filter((s) => s != null)
        : [];
      if (additionalSeatsDeclared.length > 0) {
        missingArms.push(`${additionalSeatsDeclared.length} siège(s) additionnel(s) déclaré(s) mais NON PRIS EN COMPTE par le calcul`);
      }
      const cgReliable = missingArms.length === 0;
      if (!cgReliable) warnings.push(`Bras de levier manquant(s) : ${missingArms.join(', ')} — centrage non vérifiable`);
      // 🔒 P0 (densité) : carburant chargé (litres) mais type inconnu ⇒ masse non
      // calculable ⇒ bilan non fiable (jamais un faux « dans les limites »).
      if (fuelDensityMissing) warnings.push('Densité carburant inconnue (type non renseigné) — masse carburant non calculable, bilan non fiable');
      const fuelReliable = !fuelDensityMissing;

      // Vérification des limites (borne basse seulement si minTakeoffWeight connu).
      const isWithinWeight = totalWeight <= maxTakeoffWeight &&
        (Number.isFinite(minTakeoffWeight) ? totalWeight >= minTakeoffWeight : true);

      // ⚠️ CORRECTIF (16/08) — la masse maximale à l'ATTERRISSAGE n'était
      // vérifiée nulle part dans le verdict principal : elle n'apparaissait
      // que dans un écran précis du wizard. Un vol pouvait donc être déclaré
      // « dans les limites » tout en dépassant la MLW à l'arrivée.
      // On ne peut pas connaître ici le carburant brûlé : on signale donc le
      // cas où la masse au décollage dépasse déjà la MLW — un atterrissage
      // immédiat (demi-tour, panne) serait alors hors limites.
      const maxLandingWeight = parseFloat(
        aircraft.weights?.mlw ?? aircraft.maxLandingWeight ?? aircraft.masses?.maxLandingMass
      );
      const exceedsMlwAtTakeoff = Number.isFinite(maxLandingWeight)
        && totalWeight > maxLandingWeight;
      if (exceedsMlwAtTakeoff) {
        warnings.push(
          `Masse au décollage (${totalWeight.toFixed(0)} kg) supérieure à la masse maximale à l'atterrissage (${maxLandingWeight.toFixed(0)} kg) : un retour immédiat imposerait un délestage.`
        );
      }

      // 🔧 A2/A3 — Enveloppe RÉELLE interpolée à la masse (remplace le rectangle
      // constant [forwardPoints[0].cg, aftCG]).
      const cgLimitsAtTOW = cgLimitsAtMass(
        aircraft.cgEnvelope || aircraft.cgLimits || wb.cgLimits,
        totalWeight,
        // Catégorie de certification (Cat N / Cat U) si l'enveloppe en porte
        // plusieurs ET qu'un choix est défini sur l'avion. Sinon undefined →
        // enveloppe principale (comportement historique inchangé).
        { category: aircraft.cgCategory }
      );
      // 🔧 25/08/2026 — les avertissements de l'interpolation d'enveloppe
      // (« masse hors plage — limite bornée ») rejoignent le verdict au lieu
      // d'être jetés : comparer un CG à une limite prolongée hors de la
      // plage certifiée doit se voir.
      if (Array.isArray(cgLimitsAtTOW.warnings) && cgLimitsAtTOW.warnings.length) {
        warnings.push(...cgLimitsAtTOW.warnings);
      }
      // CG non fiable (bras manquant) ⇒ isWithinCG = null (pas un faux « OK »).
      const isWithinCG = !cgReliable ? null
        : ((cgLimitsAtTOW.forward !== null && cgLimitsAtTOW.aft !== null)
            ? (cg >= cgLimitsAtTOW.forward && cg <= cgLimitsAtTOW.aft)
            : false); // enveloppe incomplète → fail-closed

      // Fail-closed : centrage non fiable ou inconnu ⇒ jamais « dans les limites ».
      // 19/08/2026 : les limites BAGAGES du manuel (totale + par compartiment)
      // composent désormais le verdict, au même titre que masse et centrage.
      const isWithinLimits = cgReliable && fuelReliable && isWithinWeight && isWithinCG === true && !isBaggageOverLimit;

      // 🔧 25/08/2026 — un chiffre que le moteur SAIT faux ne sort plus :
      //   • bras manquant  ⇒ cg et totalMoment sont amputés ⇒ null ;
      //   • densité inconnue avec carburant chargé ⇒ totalWeight ampute le
      //     carburant (72 kg pour 100 L) ⇒ totalWeight, totalMoment, cg null.
      // Les consommateurs affichent déjà « — » pour null (WeightBalanceTable
      // supprimé, ScenarioCards et Step6 tolèrent null) ; un nombre faux à
      // trois décimales, personne ne le remet en cause.
      const fuelMasked = fuelDensityMissing && fuelWeight === 0 &&
        Object.keys(loads || {}).some((k) => k.startsWith('fuel') && parseFloat(loads[k]) > 0);
      const masseFiable = !fuelMasked;
      const result = {
        totalWeight: masseFiable ? parseFloat(totalWeight.toFixed(1)) : null,
        totalMoment: (cgReliable && masseFiable) ? parseFloat(totalMoment.toFixed(1)) : null,
        cg: (cgReliable && masseFiable) ? parseFloat(cg.toFixed(3)) : null,
        isWithinLimits,
        isWithinWeight,
        isWithinCG,
        cgReliable,
        fuelDensityMissing,
        // Dépassement d'une limite BAGAGES du manuel (totale maxBaggageTotalMass
        // et/ou maxWeight d'un compartiment). Exposé à part pour que l'UI
        // l'affiche distinctement du dépassement de masse globale ; les
        // messages détaillés sont dans `warnings`.
        isBaggageOverLimit,
        // Masse au décollage supérieure à la MLW (retour immédiat impossible
        // sans délestage). Exposé pour l'UI et la synthèse.
        exceedsMlwAtTakeoff,
        maxLandingWeight: Number.isFinite(maxLandingWeight) ? maxLandingWeight : null,
        warnings,
        // Limites CG effectivement appliquées À cette masse (interpolées).
        cgLimits: { forward: cgLimitsAtTOW.forward, aft: cgLimitsAtTOW.aft }
      };
      


  return result;
}
