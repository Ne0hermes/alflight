import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  LocalGasStation as FuelIcon,
  AirlineSeatReclineNormal as SeatIcon,
  Luggage as LuggageIcon,
  FitnessCenter as WeightIcon,
  CenterFocusStrong as CenterIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  EditNote as EditNoteIcon,
  TouchApp as TouchAppIcon,
  AutoGraph as AutoGraphIcon
} from '@mui/icons-material';
import { unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import CGEnvelopeDualChart from '../CgEnvelopeDualChart';
import CentrogramReader from '../CentrogramReader';
import { getFuelDensity } from '../../utils/mbUnits';
import { StyledTextField } from './FormFieldStyles';

const Step3WeightBalance = ({ data, updateData, errors = {}, onNext, onPrevious, registerStepNav }) => {
  // ─── Sélecteur de méthode : 'manual' | 'graphical' | null (pas encore choisi) ───
  // Persistence locale UI uniquement : ne touche pas au store.
  const [inputMethod, setInputMethod] = useState(null);

  // Réf vers le contrat de navigation interne du CentrogramReader (sous-étapes
  // de calibration), relayé au pied de page du wizard pour une cascade complète.
  const readerNavRef = useRef(null);
  const registerReaderNav = useCallback((api) => { readerNavRef.current = api; }, []);

  // Contrat de navigation en cascade exposé au wizard (pied de page unique) :
  //  • en mode graphique, on remonte d'abord les sous-étapes de calibration ;
  //  • puis on sort de la sous-vue (graphique/manuel) vers le choix de méthode ;
  //  • puis seulement on recule d'une étape principale.
  useEffect(() => {
    if (!registerStepNav) return;
    registerStepNav({
      canGoBack: () => {
        if (inputMethod === 'graphical' && readerNavRef.current?.canBack) return true;
        return inputMethod !== null;
      },
      goBack: () => {
        if (inputMethod === 'graphical' && readerNavRef.current?.canBack) {
          readerNavRef.current.back();
          return;
        }
        setInputMethod(null);
      },
      canGoNext: () => (
        inputMethod === 'graphical' &&
        (!!readerNavRef.current?.canNext || !!readerNavRef.current?.isLastStep)
      ),
      goNext: () => {
        const nav = readerNavRef.current;
        if (nav?.canNext) { nav.next(); return; }   // sous-étape suivante du centrogramme
        // Fin de la lecture du centrogramme (dernière sous-étape) → on bascule vers
        // l'ÉCRITURE MANUELLE pour CONSTATER les éléments extraits, AVANT les Vitesses.
        if (nav?.isLastStep) { setInputMethod('manual'); }
      },
    });
    return () => registerStepNav(null);
  }, [registerStepNav, inputMethod]);

  const [expandedPanels, setExpandedPanels] = useState({
    fuel: false,
    seats: false,
    baggage: false,
    limits: false,
    cgEnvelope: false,
    utility: false
  });

  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        fuel: false,
        seats: false,
        baggage: false,
        limits: false,
        cgEnvelope: false,
        utility: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };
  
  // État pour Most Forward CG - liste de points
  const [forwardCGPoints, setForwardCGPoints] = useState(() => {
    // Si des données existent dans le nouveau format (forwardPoints)
    if (data.cgEnvelope?.forwardPoints && data.cgEnvelope.forwardPoints.length > 0) {
      return data.cgEnvelope.forwardPoints;
    }
    // Sinon, migrer depuis l'ancien format si disponible
    if (data.cgEnvelope?.forwardMinWeight || data.cgEnvelope?.forwardMaxWeight || data.cgEnvelope?.forwardCG) {
      const points = [];
      if (data.cgEnvelope.forwardMinWeight && data.cgEnvelope.forwardCG) {
        points.push({
          id: Date.now() + Math.random(),
          weight: data.cgEnvelope.forwardMinWeight,
          cg: data.cgEnvelope.forwardCG
        });
      }
      if (data.cgEnvelope.forwardMaxWeight && data.cgEnvelope.forwardCG &&
          data.cgEnvelope.forwardMaxWeight !== data.cgEnvelope.forwardMinWeight) {
        points.push({
          id: Date.now() + Math.random() + 1,
          weight: data.cgEnvelope.forwardMaxWeight,
          cg: data.cgEnvelope.forwardCG
        });
      }
      return points;
    }
    return [];
  });

  // État pour Most Rearward CG : 2 POINTS INDÉPENDANTS (masse min et masse max),
  // chacun avec son propre CG et son propre moment.
  // Modèle réel : la limite arrière n'est PAS toujours un segment vertical à
  // CG constant — elle peut être inclinée (CG variable selon la masse).
  //
  // Format : { minWeight, minCG, minMoment, maxWeight, maxCG, maxMoment }
  // Migration légère : si data.cgEnvelope.aftCG (ancien format) est présent,
  // on le copie dans minCG ET maxCG pour préserver le visuel à l'ouverture.
  const [aftCG, setAftCG] = useState(() => {
    const legacyCG = data.cgEnvelope?.aftCG || '';
    return {
      minWeight: data.cgEnvelope?.aftMinWeight || '',
      maxWeight: data.cgEnvelope?.aftMaxWeight || '',
      minCG:    data.cgEnvelope?.aftMinCG    || legacyCG,
      maxCG:    data.cgEnvelope?.aftMaxCG    || legacyCG,
      minMoment: data.cgEnvelope?.aftMinMoment || '',
      maxMoment: data.cgEnvelope?.aftMaxMoment || ''
    };
  });

  // État pour les points intermédiaires de l'enveloppe CG
  const [intermediatePoints, setIntermediatePoints] = useState(data.cgEnvelope?.intermediatePoints || []);
  // 🔧 audit QA (D6) : corde MAC + LEMAC (mm) — optionnels, pour afficher le centrage en %MAC.
  const [macLength, setMacLength] = useState(data.cgEnvelope?.macLength ?? '');
  const [lemac, setLemac] = useState(data.cgEnvelope?.lemac ?? '');
  const [additionalSeats, setAdditionalSeats] = useState(data.additionalSeats || []);
  const [baggageCompartments, setBaggageCompartments] = useState(data.baggageCompartments && data.baggageCompartments.length > 0
      ? data.baggageCompartments
      : [] // Vide par défaut
  );
  // Tous les réservoirs : principal, aile gauche/droite, optionnel, tip, aux…
  // Refonte : le « principal » est désormais juste un réservoir parmi les autres,
  // au même niveau (type: 'main'). data.fuelMainCapacity est legacy uniquement.
  const [additionalFuelTanks, setAdditionalFuelTanks] = useState(data.additionalFuelTanks || []);

  // ─── Sync local ← data après mise à jour externe (ex. CentrogramReader) ──
  // Quand le CentrogramReader écrit dans data.additionalFuelTanks[i].arm via
  // updateData, parsePath fait une copie profonde → nouvelle référence.
  // Les useState locaux gardent l'ancienne référence → l'UI ne re-render pas.
  // Ces useEffect détectent les changements de référence et re-syncent.
  useEffect(() => {
    if (data.additionalFuelTanks && data.additionalFuelTanks !== additionalFuelTanks) {
      setAdditionalFuelTanks(data.additionalFuelTanks);
    }
  }, [data.additionalFuelTanks]);

  useEffect(() => {
    if (data.baggageCompartments && data.baggageCompartments !== baggageCompartments) {
      setBaggageCompartments(data.baggageCompartments);
    }
  }, [data.baggageCompartments]);

  useEffect(() => {
    if (data.additionalSeats && data.additionalSeats !== additionalSeats) {
      setAdditionalSeats(data.additionalSeats);
    }
  }, [data.additionalSeats]);

  // ─── Migration legacy → array : convertit data.fuelMainCapacity en tank ─
  // Si l'avion a été créé avant la refonte (fuelMainCapacity > 0 et pas de
  // tank de type 'main' dans la liste), on insère automatiquement un tank
  // principal avec les valeurs legacy, puis on nettoie les champs obsolètes.
  // Idempotent : une fois migré, ne s'exécute plus.
  useEffect(() => {
    const legacyCap = parseFloat(data.fuelMainCapacity);
    const hasLegacy = Number.isFinite(legacyCap) && legacyCap > 0;
    const hasMainTank = (data.additionalFuelTanks || []).some(t => t.type === 'main');
    if (!hasLegacy || hasMainTank) return;

    const mainTank = {
      id: Date.now() + Math.random(),
      name: 'Réservoir principal',
      type: 'main',
      capacity: legacyCap,
      arm: data.arms?.fuelMain || '',
      momentAtFull: data.moments?.fuelMain || ''
    };
    const newTanks = [mainTank, ...(data.additionalFuelTanks || [])];
    setAdditionalFuelTanks(newTanks);
    updateData('additionalFuelTanks', newTanks);
    // Nettoyer les champs legacy (un seul endroit de vérité maintenant)
    updateData('fuelMainCapacity', '');
    if (data.arms?.fuelMain) updateData('arms.fuelMain', '');
    if (data.moments?.fuelMain) updateData('moments.fuelMain', '');
    console.log('🔄 [Step3] Migration legacy fuelMainCapacity → tank principal (additionalFuelTanks)');
  }, []); // mount uniquement

  // ─── Sync auto : data.fuelCapacity = somme des réservoirs ───────────────
  // La capacité totale devient une valeur DÉRIVÉE de la somme de tous les
  // réservoirs (refonte demandée par le pilote). Si la somme diverge de
  // ce qui est stocké actuellement (ex. ancien total MANEX), on aligne.
  useEffect(() => {
    if (!additionalFuelTanks || additionalFuelTanks.length === 0) return;
    const sum = additionalFuelTanks.reduce(
      (s, t) => s + (parseFloat(t.capacity) || 0), 0
    );
    if (sum <= 0) return;
    const current = parseFloat(data.fuelCapacity) || 0;
    if (Math.abs(sum - current) > 0.5) {
      updateData('fuelCapacity', sum);
    }
  }, [additionalFuelTanks, data.fuelCapacity]);

  // ─── Auto-calcul dynamique masse/bras/moment pour la masse à vide ───
  // Relation physique : moment = masse × bras
  //   - Saisir masse + bras → moment auto-calculé
  //   - Saisir masse + moment → bras auto-calculé (bras = moment / masse)
  //   - Saisir bras + moment → masse auto-calculée (masse = moment / bras)
  // Le state lastEditedEmptyField track quel champ a été édité en dernier
  // pour décider lequel des autres recalculer (évite les boucles).
  const [lastEditedEmptyField, setLastEditedEmptyField] = useState(null); // 'mass' | 'arm' | 'moment'

  useEffect(() => {
    if (!lastEditedEmptyField) return;
    const e = parseFloat(data.weights?.emptyWeight);
    const a = parseFloat(data.arms?.empty);
    const m = parseFloat(data.moments?.empty);
    const hasE = Number.isFinite(e) && e > 0;
    const hasA = Number.isFinite(a) && a !== 0;
    const hasM = Number.isFinite(m) && m > 0;

    // Si l'utilisateur vient de changer la masse OU le bras :
    //   recalcule le moment (si les deux autres sont là)
    if (lastEditedEmptyField === 'mass' || lastEditedEmptyField === 'arm') {
      if (hasE && hasA) {
        const newMoment = e * a;
        // Compare arrondi à 4 décimales pour éviter les micro-loops
        if (Math.abs((m || 0) - newMoment) > 0.001) {
          updateData('moments.empty', Math.round(newMoment * 1000) / 1000);
        }
      }
    } else if (lastEditedEmptyField === 'moment') {
      // L'utilisateur vient de changer le moment : recalcule bras (si masse) ou masse (si bras)
      if (hasM && hasE) {
        const newArm = m / e;
        if (Math.abs((a || 0) - newArm) > 0.0001) {
          updateData('arms.empty', Math.round(newArm * 10000) / 10000);
        }
      } else if (hasM && hasA) {
        const newMass = m / a;
        if (Math.abs((e || 0) - newMass) > 0.01) {
          updateData('weights.emptyWeight', Math.round(newMass * 100) / 100);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weights?.emptyWeight, data.arms?.empty, data.moments?.empty, lastEditedEmptyField]);
  const units = unitsSelectors.useUnits();
  const [previousUnits, setPreviousUnits] = useState(units);

  // Gérer les conversions automatiques lors du changement d'unités
  useEffect(() => {
    // Convertir toutes les masses
    const weightFields = [
      'weights.emptyWeight',
      'weights.mtow',
      'weights.mlw',
      'weights.minTakeoffWeight',
      'weights.maxBaggageFwd',
      'weights.maxBaggageAft'
    ];
    
    if (previousUnits.weight !== units.weight) {
      weightFields.forEach(field => {
        const keys = field.split('.');
        const value = keys.reduce((obj, key) => obj?.[key], data);
        if (value) {
          const convertedValue = convertValue(
            value,
            previousUnits.weight,
            units.weight,
            'weight'
          );
          if (convertedValue && convertedValue !== value) {
            updateData(field, Math.round(convertedValue * 10) / 10);
          }
        }
      });

    }

    // Convertir les bras de levier
    const armFields = [
      'arms.empty',
      'arms.frontSeats',
      'arms.rearSeats',
      'arms.fuelMain',
      'arms.baggageFwd',
      'arms.baggageAft',
      'cgLimits.forward',
      'cgLimits.aft'
    ];
    
    if (previousUnits.armLength !== units.armLength) {
      armFields.forEach(field => {
        const keys = field.split('.');
        const value = keys.reduce((obj, key) => obj?.[key], data);
        if (value) {
          const convertedValue = convertValue(
            value,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          );
          if (convertedValue && convertedValue !== value) {
            updateData(field, Math.round(convertedValue * 100) / 100);
          }
        }
      });

      // Convertir les sièges supplémentaires
      if (additionalSeats.length > 0) {
        const convertedSeats = additionalSeats.map(seat => ({
          ...seat,
          arm: seat.arm ? Math.round(convertValue(
            seat.arm,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 100) / 100 : ''
        }));
        setAdditionalSeats(convertedSeats);
        updateData('additionalSeats', convertedSeats);
      }

      // Convertir les compartiments bagages
      if (baggageCompartments.length > 0) {
        const convertedCompartments = baggageCompartments.map(compartment => ({
          ...compartment,
          arm: compartment.arm ? Math.round(convertValue(
            compartment.arm,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 100) / 100 : '',
          maxWeight: compartment.maxWeight && previousUnits.weight !== units.weight ? 
            Math.round(convertValue(
              compartment.maxWeight,
              previousUnits.weight,
              units.weight,
              'weight'
            ) * 10) / 10 : compartment.maxWeight
        }));
        setBaggageCompartments(convertedCompartments);
        updateData('baggageCompartments', convertedCompartments);
      }

    }

    // Convertir les points Forward CG
    if (forwardCGPoints.length > 0) {
      const convertedForwardPoints = forwardCGPoints.map(point => ({
        ...point,
        weight: point.weight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            point.weight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.weight,
        cg: point.cg && previousUnits.armLength !== units.armLength ?
          Math.round(convertValue(
            point.cg,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 10000) / 10000 : point.cg
      }));
      setForwardCGPoints(convertedForwardPoints);
      updateData('cgEnvelope.forwardPoints', convertedForwardPoints);
    }

    // Convertir les données Aft CG (2 points : min + max, chacun avec son CG)
    if (aftCG.minWeight || aftCG.maxWeight || aftCG.minCG || aftCG.maxCG) {
      const convertWeight = (v) => v && previousUnits.weight !== units.weight
        ? Math.round(convertValue(v, previousUnits.weight, units.weight, 'weight') * 10) / 10
        : v;
      const convertArm = (v) => v && previousUnits.armLength !== units.armLength
        ? Math.round(convertValue(v, previousUnits.armLength || 'mm', units.armLength || 'mm', 'armLength') * 10000) / 10000
        : v;
      const convertedAft = {
        minWeight: convertWeight(aftCG.minWeight),
        maxWeight: convertWeight(aftCG.maxWeight),
        minCG: convertArm(aftCG.minCG),
        maxCG: convertArm(aftCG.maxCG),
        // Moments : recalculés à partir des nouvelles valeurs (masse × bras)
        minMoment: aftCG.minMoment,  // gardés tels quels — le 2-sur-3 les recalculera
        maxMoment: aftCG.maxMoment
      };
      setAftCG(convertedAft);
    }

    // Convertir les points intermédiaires
    if (intermediatePoints.length > 0) {
      const convertedPoints = intermediatePoints.map(point => ({
        ...point,
        minWeight: point.minWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            point.minWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.minWeight,
        maxWeight: point.maxWeight && previousUnits.weight !== units.weight ?
          Math.round(convertValue(
            point.maxWeight,
            previousUnits.weight,
            units.weight,
            'weight'
          ) * 10) / 10 : point.maxWeight,
        cg: point.cg && previousUnits.armLength !== units.armLength ?
          Math.round(convertValue(
            point.cg,
            previousUnits.armLength || 'mm',
            units.armLength || 'mm',
            'armLength'
          ) * 10000) / 10000 : point.cg
      }));
      setIntermediatePoints(convertedPoints);
      updateData('cgEnvelope.intermediatePoints', convertedPoints);
    }

    setPreviousUnits(units);
  }, [units]);

  // Gestion des points Forward CG
  const addForwardPoint = () => {
    const newPoint = {
      id: Date.now() + Math.random(),
      weight: '',
      cg: ''
    };
    const updatedPoints = [...forwardCGPoints, newPoint];
    setForwardCGPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const removeForwardPoint = (pointId) => {
    const updatedPoints = forwardCGPoints.filter(p => p.id !== pointId);
    setForwardCGPoints(updatedPoints);
    updateData('cgEnvelope.forwardPoints', updatedPoints);
  };

  const updateForwardPoint = (pointId, field, value) => {
    setForwardCGPoints(prev => {
      const updated = prev.map(p =>
        p.id === pointId ? { ...p, [field]: value } : p
      );
      updateData('cgEnvelope.forwardPoints', updated);
      return updated;
    });
  };

  // Variante multi-champs (évite l'écrasement par closure obsolète)
  const updateForwardPointFields = (pointId, fields) => {
    setForwardCGPoints(prev => {
      const updated = prev.map(p =>
        p.id === pointId ? { ...p, ...fields } : p
      );
      updateData('cgEnvelope.forwardPoints', updated);
      return updated;
    });
  };

  // Fonction de validation et sauvegarde Most Rearward CG (2 points indépendants)
  const handleValidateAftCG = () => {
    let finalMinWeight = aftCG.minWeight;
    let finalMaxWeight = aftCG.maxWeight;

    // Auto-complétion intelligente des masses
    if (!finalMinWeight && finalMaxWeight) {
      finalMinWeight = data.weights?.minTakeoffWeight || '';
    }
    if (!finalMaxWeight && finalMinWeight) {
      finalMaxWeight = data.weights?.mtow || '';
    }

    // Mettre à jour l'état local
    const updatedAft = {
      ...aftCG,
      minWeight: finalMinWeight,
      maxWeight: finalMaxWeight
    };
    setAftCG(updatedAft);

    // Sauvegarder dans les données principales (nouveau format à 2 points)
    updateData('cgEnvelope.aftMinWeight', finalMinWeight);
    updateData('cgEnvelope.aftMaxWeight', finalMaxWeight);
    updateData('cgEnvelope.aftMinCG', aftCG.minCG);
    updateData('cgEnvelope.aftMaxCG', aftCG.maxCG);
    updateData('cgEnvelope.aftMinMoment', aftCG.minMoment);
    updateData('cgEnvelope.aftMaxMoment', aftCG.maxMoment);
    // RÉTRO-COMPAT : on garde aussi aftCG (= aftMinCG par défaut) pour ne pas
    // casser les consommateurs externes qui lisent encore aftCG (PDF, exports…)
    // Mais à terme, ils devront lire aftMinCG/aftMaxCG explicitement.
    updateData('cgEnvelope.aftCG', aftCG.maxCG || aftCG.minCG);

    return true;
  };

  // Gestion des sièges supplémentaires
  const addSeat = () => {
    const newSeat = { 
      id: Date.now(), 
      name: `Siège ${additionalSeats.length + 3}`, 
      arm: '' 
    };
    const updatedSeats = [...additionalSeats, newSeat];
    setAdditionalSeats(updatedSeats);
    updateData('additionalSeats', updatedSeats);
  };

  const removeSeat = (id) => {
    const updatedSeats = additionalSeats.filter(seat => seat.id !== id);
    setAdditionalSeats(updatedSeats);
    updateData('additionalSeats', updatedSeats);
  };

  const updateSeat = (id, field, value) => {
    setAdditionalSeats(prev => {
      const updated = prev.map(seat =>
        seat.id === id ? { ...seat, [field]: value } : seat
      );
      updateData('additionalSeats', updated);
      return updated;
    });
  };

  // Variante multi-champs (évite l'écrasement par closure obsolète)
  const updateSeatFields = (id, fields) => {
    setAdditionalSeats(prev => {
      const updated = prev.map(seat =>
        seat.id === id ? { ...seat, ...fields } : seat
      );
      updateData('additionalSeats', updated);
      return updated;
    });
  };

  // Gestion des compartiments bagages
  const addBaggageCompartment = () => {
    const newCompartment = { 
      id: Date.now() + Math.random(), 
      name: `Compartiment ${baggageCompartments.length + 1}`, 
      arm: '', 
      maxWeight: '' 
    };
    const updatedCompartments = [...baggageCompartments, newCompartment];
    setBaggageCompartments(updatedCompartments);
    updateData('baggageCompartments', updatedCompartments);
  };

  const removeBaggageCompartment = (compartmentId) => {
    const updatedCompartments = baggageCompartments.filter(c => c.id !== compartmentId);
    setBaggageCompartments(updatedCompartments);
    updateData('baggageCompartments', updatedCompartments);
  };

  const updateBaggageCompartment = (compartmentId, field, value) => {
    setBaggageCompartments(prev => {
      const updated = prev.map(c =>
        c.id === compartmentId ? { ...c, [field]: value } : c
      );
      updateData('baggageCompartments', updated);
      return updated;
    });
  };

  // Variante multi-champs (évite l'écrasement par closure obsolète)
  const updateBaggageCompartmentFields = (compartmentId, fields) => {
    setBaggageCompartments(prev => {
      const updated = prev.map(c =>
        c.id === compartmentId ? { ...c, ...fields } : c
      );
      updateData('baggageCompartments', updated);
      return updated;
    });
  };

  // ─── Gestion des réservoirs additionnels (aile, optionnel, tip-tank...) ───
  // Le réservoir principal est géré séparément via data.arms.fuelMain.
  // Ici on gère uniquement les réservoirs SUPPLÉMENTAIRES.
  const addFuelTank = (type = 'wing') => {
    const defaultNames = {
      main: 'Réservoir principal',
      wing: 'Réservoir aile',
      optional: 'Réservoir optionnel',
      tip: 'Réservoir d\'extrémité',
      aux: 'Réservoir auxiliaire'
    };
    const newTank = {
      id: Date.now() + Math.random(),
      name: `${defaultNames[type] || 'Réservoir'} ${additionalFuelTanks.length + 1}`,
      type,
      arm: '',
      capacity: ''
    };
    const updated = [...additionalFuelTanks, newTank];
    setAdditionalFuelTanks(updated);
    updateData('additionalFuelTanks', updated);
  };

  const removeFuelTank = (tankId) => {
    const updated = additionalFuelTanks.filter(t => t.id !== tankId);
    setAdditionalFuelTanks(updated);
    updateData('additionalFuelTanks', updated);
  };

  const updateFuelTank = (tankId, field, value) => {
    // Utilisation du functional updater pour éviter les closures obsolètes
    // quand plusieurs updateFuelTank sont appelés dans le même event handler.
    setAdditionalFuelTanks(prev => {
      const updated = prev.map(t =>
        t.id === tankId ? { ...t, [field]: value } : t
      );
      updateData('additionalFuelTanks', updated);
      return updated;
    });
  };

  // Variante multi-champs pour les onChange qui modifient plusieurs valeurs
  // simultanément (ex: changer le bras déclenche aussi le recalcul du moment).
  const updateFuelTankFields = (tankId, fields) => {
    setAdditionalFuelTanks(prev => {
      const updated = prev.map(t =>
        t.id === tankId ? { ...t, ...fields } : t
      );
      updateData('additionalFuelTanks', updated);
      return updated;
    });
  };

  // Gestion des points intermédiaires de l'enveloppe CG
  const addIntermediatePoint = () => {
    // Déterminer la masse min du nouveau point (masse max du point précédent)
    let autoMinWeight = '';

    if (intermediatePoints.length > 0) {
      // Si des points intermédiaires existent, prendre la masse max du dernier
      const lastPoint = intermediatePoints[intermediatePoints.length - 1];
      autoMinWeight = lastPoint.maxWeight || '';
    } else if (forwardCGPoints.length > 0) {
      // Si aucun point intermédiaire, prendre la masse du dernier point Forward CG
      const lastForwardPoint = forwardCGPoints[forwardCGPoints.length - 1];
      autoMinWeight = lastForwardPoint.weight || '';
    }

    const newPoint = {
      id: Date.now() + Math.random(),
      minWeight: autoMinWeight,
      maxWeight: '',
      cg: ''
    };
    const updatedPoints = [...intermediatePoints, newPoint];
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  const removeIntermediatePoint = (pointId) => {
    const updatedPoints = intermediatePoints.filter(p => p.id !== pointId);
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  const updateIntermediatePoint = (pointId, field, value) => {
    const updatedPoints = intermediatePoints.map(p =>
      p.id === pointId ? { ...p, [field]: value } : p
    );
    setIntermediatePoints(updatedPoints);
    updateData('cgEnvelope.intermediatePoints', updatedPoints);
  };

  // ════════════════════════════════════════════════════════════════════════
  // ARCHITECTURE M&C : 2 modes simples au choix du pilote
  //
  //   Mode 🖼 'graphical' → CentrogramReader (lecture clic sur centrogramme MANEX)
  //   Mode ✏️ 'manual'    → Accordéons standards de saisie au clavier
  //
  // Les deux modes remplissent le MÊME modèle de données (standard historique) :
  //   data.weights.{emptyWeight, mtow, mlw, minTakeoffWeight}
  //   data.arms.{empty, frontSeats, rearSeats, fuelMain}
  //   data.moments.empty
  //   data.fuelCapacity, data.fuelMainCapacity
  //   data.additionalFuelTanks[]   (aile, optionnel, tip, aux)
  //   data.additionalSeats[]
  //   data.baggageCompartments[]
  //   data.cgEnvelope.{forwardPoints, aftMinWeight, aftMaxWeight, aftCG, intermediatePoints}
  //
  // Toutes les unités viennent des préférences utilisateur (unitsStore).
  // ════════════════════════════════════════════════════════════════════════

  // ─── Mode 🖼 GRAPHIQUE — CentrogramReader ───
  if (inputMethod === 'graphical') {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <CentrogramReader
          aircraftData={data}
          updateData={updateData}
          onBack={() => setInputMethod(null)}
          onExit={() => setInputMethod('manual')}
          registerNav={registerReaderNav}
        />
      </Box>
    );
  }

  // ─── ÉCRAN D'ENTRÉE — Sélecteur 2 cartes simple ───
  if (inputMethod === null) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center', mb: 1 }}>
          Masse & Centrage — Choisis ta méthode de saisie
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>
          Tu peux soit lire les bras de levier par clic sur le centrogramme du MANEX,
          soit les saisir manuellement au clavier. Les deux modes remplissent les mêmes
          données — tu peux passer de l'un à l'autre à tout moment.
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
          {/* Carte 🖼 Centrogramme */}
          <Paper
            elevation={0}
            sx={{
              flex: '1 1 380px',
              maxWidth: 460,
              p: 4,
              border: '2px solid',
              borderColor: 'divider',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'success.main',
                bgcolor: 'action.hover',
                transform: 'translateY(-2px)',
                boxShadow: 2
              }
            }}
            onClick={() => setInputMethod('graphical')}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2 }}>
              <AutoGraphIcon sx={{ fontSize: 64, color: 'success.main' }} />
              <Typography variant="h6">Lecture graphique du centrogramme</Typography>
              <Typography variant="body2" color="text.secondary">
                Charge une image du centrogramme MANEX, calibre les axes par clic,
                puis lis chaque bras de levier (sièges, carburant, bagages) avec
                régression linéaire automatique.
              </Typography>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<TouchAppIcon />}
                sx={{ mt: 1 }}
                onClick={(e) => { e.stopPropagation(); setInputMethod('graphical'); }}
              >
                Démarrer la lecture
              </Button>
            </Box>
          </Paper>

          {/* Carte ✏️ Manuel */}
          <Paper
            elevation={0}
            sx={{
              flex: '1 1 380px',
              maxWidth: 460,
              p: 4,
              border: '2px solid',
              borderColor: 'divider',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
                transform: 'translateY(-2px)',
                boxShadow: 2
              }
            }}
            onClick={() => setInputMethod('manual')}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2 }}>
              <EditNoteIcon sx={{ fontSize: 64, color: 'primary.main' }} />
              <Typography variant="h6">Saisie manuelle</Typography>
              <Typography variant="body2" color="text.secondary">
                Saisis directement au clavier les bras de levier, masses limites
                et points de l'enveloppe à partir du rapport M&C de ton MANEX.
                Calcul dynamique masse × bras = moment partout.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<EditNoteIcon />}
                sx={{ mt: 1 }}
                onClick={(e) => { e.stopPropagation(); setInputMethod('manual'); }}
              >
                Saisie au clavier
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          {onPrevious && (
            <Button
              variant="outlined"
              color="primary"
              size="large"
              onClick={onPrevious}
              startIcon={<ChevronLeftIcon />}
            >
              Précédent
            </Button>
          )}
          {onNext && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={onNext}
              endIcon={<ChevronRightIcon />}
            >
              Passer cette étape
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // ─── Mode ✏️ MANUEL — Accordéons standards de saisie ───

  // Helpers pour les libellés/unités de l'enveloppe (mode CG par défaut)
  const envLabel = 'Bras de levier (CG)';
  const envUnit = getUnitSymbol(units.armLength);
  const envPlaceholder = '2130';
  const isMoment = false; // legacy — gardé pour les helpers UI plus bas

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Carburant */}
      <Accordion 
        expanded={expandedPanels.fuel}
        onChange={handlePanelChange('fuel')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <FuelIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Capacité utilisable
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Capacité totale (importée depuis Step1, lecture seule).
                NOTE : data.fuelCapacity est stocké en CANONIQUE (litres). On
                convertit vers l'unité de préférence pilote pour l'affichage. */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 2 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Capacité totale carburant (importée du MANEX)"
                type="number"
                value={
                  data.fuelCapacity
                    ? Math.round(convertValue(data.fuelCapacity, 'ltr', units.fuel, 'fuel') * 10) / 10
                    : ''
                }
                disabled
                InputProps={{
                  readOnly: true,
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                }}
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    color: 'text.primary',
                    WebkitTextFillColor: 'unset',
                  },
                }}
              />
            </Box>

            {/* ─── Réservoirs (refonte) ───
                Tous les types de réservoirs (principal, aile, optionnel, tip,
                aux…) sont gérés uniformément dans additionalFuelTanks. Chacun
                a son type modifiable via le sélecteur en ligne. La capacité
                totale (au-dessus) est la SOMME calculée de tous ces réservoirs. */}
            <Box sx={{ width: '100%', mt: 3 }}>
              <Divider sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Réservoirs (principal, ailes, optionnel, tip-tank…)
                </Typography>
              </Divider>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('main')}
                >
                  Réservoir principal
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('wing')}
                >
                  Réservoir d'aile
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('optional')}
                >
                  Réservoir optionnel
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('tip')}
                >
                  Tip tank
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('aux')}
                >
                  Auxiliaire
                </Button>
              </Box>

              {additionalFuelTanks.length === 0 ? (
                <Alert severity="warning" icon={<InfoIcon />} sx={{ maxWidth: 700, mx: 'auto' }}>
                  <Typography variant="body2">
                    <strong>Aucun réservoir défini.</strong> Ajoute au moins un réservoir
                    en cliquant sur l'un des boutons ci-dessus. La plupart des avions
                    GA ont juste un « Réservoir principal » ; certains ont aussi des
                    réservoirs d'aile et/ou un optionnel. La capacité totale affichée
                    en haut sera la <em>somme de tous les réservoirs</em>.
                  </Typography>
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  {additionalFuelTanks.map((tank, index) => (
                    <Box key={tank.id} sx={{ width: '100%', maxWidth: 700, mb: index < additionalFuelTanks.length - 1 ? 2 : 0 }}>
                      {index > 0 && <Divider sx={{ mb: 2 }} />}
                      <Grid container spacing={2}>
                        <Grid size={12}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                            <StyledTextField
                              fullWidth
                              size="small"
                              label="Nom du réservoir"
                              value={tank.name || ''}
                              onChange={(e) => updateFuelTank(tank.id, 'name', e.target.value)}
                            />
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                              <InputLabel>Type</InputLabel>
                              <Select
                                value={tank.type || 'wing'}
                                label="Type"
                                onChange={(e) => updateFuelTank(tank.id, 'type', e.target.value)}
                              >
                                <MenuItem value="main">Principal</MenuItem>
                                <MenuItem value="wing">Aile</MenuItem>
                                <MenuItem value="optional">Optionnel</MenuItem>
                                <MenuItem value="tip">Tip tank</MenuItem>
                                <MenuItem value="aux">Auxiliaire</MenuItem>
                              </Select>
                            </FormControl>
                            <IconButton
                              color="error"
                              onClick={() => removeFuelTank(tank.id)}
                              size="small"
                              sx={{ mb: 0.25 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Capacité"
                            type="number"
                            value={
                              tank.capacity
                                ? Math.round(convertValue(tank.capacity, 'ltr', units.fuel, 'fuel') * 10) / 10
                                : ''
                            }
                            onChange={(e) => {
                              const newCapUser = e.target.value;
                              // Convertir saisie user → canonique (litres) pour stockage
                              const newCapCanonical = newCapUser
                                ? convertValue(newCapUser, units.fuel, 'ltr', 'fuel')
                                : '';
                              const cap = parseFloat(newCapCanonical);
                              const arm = parseFloat(tank.arm);
                              const density = getFuelDensity(data.fuelType);
                              const fields = { capacity: newCapCanonical };
                              if (Number.isFinite(cap) && Number.isFinite(arm)) {
                                fields.momentAtFull = Math.round(cap * density * arm * 100) / 100;
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="Capacité utilisable"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Bras de levier"
                            type="number"
                            value={tank.arm || ''}
                            onChange={(e) => {
                              const newArm = e.target.value;
                              const cap = parseFloat(tank.capacity);
                              const arm = parseFloat(newArm);
                              const density = getFuelDensity(data.fuelType);
                              const fields = { arm: newArm };
                              if (Number.isFinite(cap) && Number.isFinite(arm)) {
                                fields.momentAtFull = Math.round(cap * density * arm * 100) / 100;
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="CG"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Moment à plein"
                            type="number"
                            value={tank.momentAtFull || ''}
                            onChange={(e) => {
                              const newMoment = e.target.value;
                              const M = parseFloat(newMoment);
                              const cap = parseFloat(tank.capacity);
                              const arm = parseFloat(tank.arm);
                              const density = getFuelDensity(data.fuelType);
                              const fields = { momentAtFull: newMoment };
                              if (Number.isFinite(M) && Number.isFinite(cap) && cap !== 0 && density !== 0) {
                                fields.arm = Math.round((M / (cap * density)) * 100) / 100;
                              } else if (Number.isFinite(M) && Number.isFinite(arm) && arm !== 0 && density !== 0) {
                                fields.capacity = Math.round((M / (arm * density)) * 100) / 100;
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="Auto"
                            helperText={`× ${getFuelDensity(data.fuelType)}`}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* ─── Récap : somme calculée vs total importé MANEX ───
                Toutes les valeurs en mémoire sont en CANONIQUE (litres).
                Le total est désormais la SOMME de tous les réservoirs (le
                « principal » est juste un réservoir parmi les autres). On
                garde le total MANEX en comparaison pour vérifier la cohérence. */}
            {(() => {
              const total = parseFloat(data.fuelCapacity) || 0;          // litres (MANEX/Step1)
              const computed = additionalFuelTanks.reduce(
                (sum, t) => sum + (parseFloat(t.capacity) || 0), 0        // litres
              );
              const hasData = computed > 0;
              if (!hasData && total <= 0) return null;
              const diff = computed - total;
              const isMatch = Math.abs(diff) < 0.5;
              // Helper local : convertit canonique (L) vers unité user
              const toDisp = (v) => Math.round(convertValue(v, 'ltr', units.fuel, 'fuel') * 10) / 10;
              return (
                <Box sx={{ width: '100%', maxWidth: 700, mt: 2 }}>
                  <Alert
                    severity={isMatch ? 'success' : Math.abs(diff) < total * 0.05 ? 'info' : 'warning'}
                    icon={isMatch ? false : <WarningIcon />}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      Récapitulatif des capacités
                    </Typography>
                    <Box sx={{ mt: 1, fontFamily: 'monospace', fontSize: 13 }}>
                      {additionalFuelTanks.map(t => (
                        <div key={t.id}>
                          {t.name || 'Réservoir'} :{' '}
                          <strong>{toDisp(parseFloat(t.capacity) || 0).toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                        </div>
                      ))}
                      <Divider sx={{ my: 0.5 }} />
                      <div>
                        <strong>Somme calculée :</strong>{' '}
                        <strong style={{ color: isMatch ? 'var(--text-primary)' : 'var(--color-red-critical)' }}>
                          {toDisp(computed).toFixed(1)} {getUnitSymbol(units.fuel)}
                        </strong>
                      </div>
                      <div>
                        <strong>Capacité totale (MANEX) :</strong>{' '}
                        <strong>{toDisp(total).toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                      </div>
                      {!isMatch && (
                        <div style={{ marginTop: 6, color: Math.abs(diff) < total * 0.05 ? 'var(--text-secondary)' : 'var(--color-red-critical)' }}>
                          Écart : <strong>{diff > 0 ? '+' : ''}{diff.toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                          {' '}({((diff / total) * 100).toFixed(1)}%)
                        </div>
                      )}
                    </Box>
                  </Alert>
                </Box>
              );
            })()}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Sièges */}
      <Accordion
        expanded={expandedPanels.seats}
        onChange={handlePanelChange('seats')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <SeatIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Sièges (bras de levier)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addSeat}
              >
                Ajouter un siège
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>

              {/* ─── Sièges avant — bras de levier seul ─── */}
              <Box sx={{ width: '100%', maxWidth: 700 }}>
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Sièges avant (Pilote + Copilote)"
                  type="number"
                  value={data.arms?.frontSeats || ''}
                  onChange={(e) => updateData('arms.frontSeats', e.target.value)}
                  error={!!errors['arms.frontSeats']}
                  helperText="Position du siège. Moment = bras × masse occupant (calculé au chargement)"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>

              {/* ─── Sièges arrière — bras de levier seul ─── */}
              <Box sx={{ width: '100%', maxWidth: 700 }}>
                <StyledTextField
                  fullWidth
                  size="small"
                  label="Sièges arrière (Rangée 2)"
                  type="number"
                  value={data.arms?.rearSeats || ''}
                  onChange={(e) => updateData('arms.rearSeats', e.target.value)}
                  error={!!errors['arms.rearSeats']}
                  helperText="Position du siège. Moment = bras × masse passager (calculé au chargement)"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>

              {/* ─── Sièges supplémentaires — bras de levier seul par siège ─── */}
              {additionalSeats.map((seat) => (
                <Box key={seat.id} sx={{ width: '100%', maxWidth: 700, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label={seat.name || 'Siège additionnel'}
                    type="number"
                    value={seat.arm || ''}
                    onChange={(e) => updateSeat(seat.id, 'arm', e.target.value)}
                    placeholder="Station du siège"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                    }}
                  />
                  <IconButton
                    color="error"
                    onClick={() => removeSeat(seat.id)}
                    size="small"
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>

          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Compartiments bagages */}
      <Accordion
        expanded={expandedPanels.baggage}
        onChange={handlePanelChange('baggage')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <LuggageIcon color="warning" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Compartiments bagages
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            {/* ─── Limite cumulée bagages (optionnel) ───
                Beaucoup de MANEX définissent une LIMITE GLOBALE en plus des
                limites par compartiment. Ex : « max 40 kg compartiment avant,
                max 60 kg compartiment arrière, MAIS total max 80 kg ». Ce
                champ stocke cette borne globale et sera utilisé en garde-fou
                lors du calcul M&C de préparation de vol. */}
            <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', mb: 2 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Masse max cumulée bagages (optionnelle)"
                type="number"
                value={
                  data.maxBaggageTotalMass
                    ? Math.round(convertValue(data.maxBaggageTotalMass, 'kg', units.weight, 'weight') * 10) / 10
                    : ''
                }
                onChange={(e) => {
                  const newMassUser = e.target.value;
                  // Stockage canonique en kg
                  const newMassCanonical = newMassUser
                    ? convertValue(newMassUser, units.weight, 'kg', 'weight')
                    : '';
                  updateData('maxBaggageTotalMass', newMassCanonical);
                }}
                helperText="Si l'avion a une limite globale cumulée distincte des limites par compartiment (ex : « total max 80 kg »). Sera contrôlée lors du calcul M&C en préparation de vol."
                placeholder="Ex : 80"
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<AddIcon />}
                onClick={addBaggageCompartment}
                sx={{ textTransform: 'none' }}
              >
                Ajouter un compartiment
              </Button>
            </Box>

            {baggageCompartments.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Aucun compartiment défini. Cliquez sur "Ajouter un compartiment" pour commencer.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {baggageCompartments.map((compartment, index) => (
                  <Box key={compartment.id} sx={{ width: '100%', maxWidth: 700, mb: index < baggageCompartments.length - 1 ? 2 : 0 }}>
                    {index > 0 && <Divider sx={{ mb: 2 }} />}

                    <Grid container spacing={2}>
                      {/* Nom du compartiment + Bouton supprimer */}
                      <Grid size={12}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Nom du compartiment"
                            value={compartment.name}
                            onChange={(e) => updateBaggageCompartment(compartment.id, 'name', e.target.value)}
                            placeholder={`Compartiment ${index + 1}`}
                          />
                          {baggageCompartments.length > 0 && (
                            <IconButton
                              color="error"
                              onClick={() => removeBaggageCompartment(compartment.id)}
                              size="small"
                              sx={{ mt: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>

                      {/* Trio dynamique : Masse max × Bras = Moment max */}
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Masse max"
                          type="number"
                          value={compartment.maxWeight || ''}
                          onChange={(e) => {
                            const newMass = e.target.value;
                            const m = parseFloat(newMass);
                            const a = parseFloat(compartment.arm);
                            const fields = { maxWeight: newMass };
                            if (Number.isFinite(m) && Number.isFinite(a)) {
                              fields.momentMax = Math.round(m * a * 100) / 100;
                            }
                            updateBaggageCompartmentFields(compartment.id, fields);
                          }}
                          placeholder="Charge max"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Bras de levier"
                          type="number"
                          value={compartment.arm || ''}
                          onChange={(e) => {
                            const newArm = e.target.value;
                            const m = parseFloat(compartment.maxWeight);
                            const a = parseFloat(newArm);
                            const fields = { arm: newArm };
                            if (Number.isFinite(m) && Number.isFinite(a)) {
                              fields.momentMax = Math.round(m * a * 100) / 100;
                            }
                            updateBaggageCompartmentFields(compartment.id, fields);
                          }}
                          placeholder="Station"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <StyledTextField
                          fullWidth
                          size="small"
                          label="Moment max"
                          type="number"
                          value={compartment.momentMax || ''}
                          onChange={(e) => {
                            const newMoment = e.target.value;
                            const M = parseFloat(newMoment);
                            const m = parseFloat(compartment.maxWeight);
                            const a = parseFloat(compartment.arm);
                            const fields = { momentMax: newMoment };
                            if (Number.isFinite(M) && Number.isFinite(m) && m !== 0) {
                              fields.arm = Math.round((M / m) * 100) / 100;
                            } else if (Number.isFinite(M) && Number.isFinite(a) && a !== 0) {
                              fields.maxWeight = Math.round((M / a) * 100) / 100;
                            }
                            updateBaggageCompartmentFields(compartment.id, fields);
                          }}
                          placeholder="Auto (masse × bras)"
                          helperText={(() => {
                            const m = parseFloat(compartment.maxWeight);
                            const a = parseFloat(compartment.arm);
                            const M = parseFloat(compartment.momentMax);
                            if (Number.isFinite(m) && Number.isFinite(a) && Number.isFinite(M)) {
                              const computed = m * a;
                              return Math.abs(computed - M) < 0.5 ? '✓' : `⚠ ≠ ${computed.toFixed(1)}`;
                            }
                            return '';
                          })()}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Masses limites (toujours visible) */}
      <Accordion
        expanded={expandedPanels.limits}
        onChange={handlePanelChange('limits')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <WeightIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>
            Masses limites
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Masse à vide + Bras de levier + Moment à vide */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <StyledTextField
                  sx={{ flex: 1, minWidth: 180 }}
                  size="small"
                  label="Masse à vide *"
                  type="number"
                  value={data.weights?.emptyWeight || ''}
                  onChange={(e) => {
                    updateData('weights.emptyWeight', e.target.value);
                    setLastEditedEmptyField('mass');
                  }}
                  error={!!errors['weights.emptyWeight']}
                  helperText={errors['weights.emptyWeight']}
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                  }}
                />
                <StyledTextField
                  sx={{ flex: 1, minWidth: 180 }}
                  size="small"
                  label="Bras de levier"
                  type="number"
                  value={data.arms?.empty || ''}
                  onChange={(e) => {
                    updateData('arms.empty', e.target.value);
                    setLastEditedEmptyField('arm');
                  }}
                  error={!!errors['arms.empty']}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
                <StyledTextField
                  sx={{ flex: 1, minWidth: 180 }}
                  size="small"
                  label="Moment à vide"
                  type="number"
                  value={data.moments?.empty || ''}
                  onChange={(e) => {
                    updateData('moments.empty', e.target.value);
                    setLastEditedEmptyField('moment');
                  }}
                  error={!!errors['moments.empty']}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
                  }}
                />
              </Box>

              {/* Indicateur cohérence + aide dynamique */}
              {(() => {
                const e = parseFloat(data.weights?.emptyWeight);
                const a = parseFloat(data.arms?.empty);
                const m = parseFloat(data.moments?.empty);
                const hasE = Number.isFinite(e) && e > 0;
                const hasA = Number.isFinite(a) && a !== 0;
                const hasM = Number.isFinite(m) && m > 0;
                const count = [hasE, hasA, hasM].filter(Boolean).length;

                if (count === 0) {
                  return (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      💡 Récupère l'information dans le rapport de masse et centrage joint au MANEX.
                      Tu peux saisir <strong>2 des 3 champs</strong> ci-dessus, le 3e sera calculé automatiquement
                      (relation : moment = masse × bras).
                    </Typography>
                  );
                }
                if (count < 2) {
                  return (
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                      Saisis encore un champ pour que le 3e se calcule automatiquement.
                    </Typography>
                  );
                }
                if (count === 2) {
                  let missing = '';
                  if (!hasE) missing = `masse ≈ ${(m / a).toFixed(2)} ${getUnitSymbol(units.weight)}`;
                  else if (!hasA) missing = `bras ≈ ${(m / e).toFixed(4)} ${getUnitSymbol(units.armLength)}`;
                  else if (!hasM) missing = `moment ≈ ${(e * a).toFixed(2)} ${getUnitSymbol(units.weight)}·${getUnitSymbol(units.armLength)}`;
                  return (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                      ✓ Calcul automatique en cours : {missing}
                    </Typography>
                  );
                }
                // count === 3 : vérifier la cohérence
                const computedMoment = e * a;
                const diff = Math.abs(m - computedMoment);
                const tolerance = Math.max(0.5, computedMoment * 0.01); // 1% ou 0.5
                if (diff < tolerance) {
                  return (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                      ✓ Cohérent : {e.toFixed(2)} × {a.toFixed(4)} = {computedMoment.toFixed(2)} ≈ moment saisi
                    </Typography>
                  );
                }
                return (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                    ⚠ Incohérence : masse × bras = {computedMoment.toFixed(2)} (écart {diff.toFixed(2)}). Vérifie tes valeurs.
                  </Typography>
                );
              })()}
            </Box>

            {/* Rapport de pesée déplacé en bas de Step3 (juste avant les
                boutons de navigation) pour plus de cohérence visuelle :
                le pilote saisit ses masses puis joint le document. */}

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MTOW *"
                type="number"
                value={data.weights?.mtow || ''}
                onChange={(e) => updateData('weights.mtow', e.target.value)}
                error={!!errors['weights.mtow']}
                helperText={errors['weights.mtow'] || "Masse maximale au décollage"}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MLW"
                type="number"
                value={data.weights?.mlw || ''}
                onChange={(e) => updateData('weights.mlw', e.target.value)}
                error={!!errors['weights.mlw']}
                helperText={errors['weights.mlw'] || "Masse maximale à l'atterrissage"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>

            {/* MZFW retiré : peu utile en aviation générale, source de confusion */}

            <Box sx={{ width: '100%', maxWidth: 700 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Masse minimale de vol"
                type="number"
                value={data.weights?.minTakeoffWeight || ''}
                onChange={(e) => updateData('weights.minTakeoffWeight', e.target.value)}
                error={!!errors['weights.minTakeoffWeight']}
                helperText={errors['weights.minTakeoffWeight'] || "Masse minimale de vol (Minimum Flight Mass)"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* CENTER OF GRAVITY - Enveloppe de centrage */}
      <Accordion 
        expanded={expandedPanels.cgEnvelope}
        onChange={handlePanelChange('cgEnvelope')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '2px solid',
          borderColor: 'error.main',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <CenterIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'error.main' }}>
            Enveloppe de centrage — base {isMoment ? 'moment' : 'CG (bras de levier)'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            {/* 🔧 audit QA (D6) : Corde MAC (optionnelle) — active l'affichage du centrage
                en %MAC sur la fiche avion. Saisie en mm, même repère que les bras. */}
            <Box sx={{ mb: 3, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 'var(--radius-sm)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                Corde MAC (optionnel — affiche le centrage en %MAC)
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Longueur corde MAC (mm)"
                    value={macLength}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMacLength(v);
                      updateData('cgEnvelope.macLength', v === '' ? null : parseFloat(v));
                    }}
                    helperText="Mean Aerodynamic Chord (MANEX)"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    type="number"
                    label="LEMAC — bord d'attaque MAC (mm)"
                    value={lemac}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLemac(v);
                      updateData('cgEnvelope.lemac', v === '' ? null : parseFloat(v));
                    }}
                    helperText="Station du bord d'attaque (même repère que les bras)"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* CG Avant (Most forward) - Liste de points */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                Most Forward CG (Limite avant)
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addForwardPoint}
                  sx={{ textTransform: 'none' }}
                >
                  Ajouter un point
                </Button>
              </Box>

              {forwardCGPoints.length === 0 ? null : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  {forwardCGPoints.map((point, index) => (
                    <Box
                      key={point.id}
                      sx={{
                        width: '100%',
                        maxWidth: 700,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 'var(--radius-sm)',
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                          Point Forward #{index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeForwardPoint(point.id)}
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Grid container spacing={1.5} alignItems="flex-end">
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Masse *"
                            type="number"
                            value={point.weight || ''}
                            onChange={(e) => {
                              const newW = e.target.value;
                              const w = parseFloat(newW);
                              const cg = parseFloat(point.cg);
                              const fields = { weight: newW };
                              if (Number.isFinite(w) && Number.isFinite(cg)) {
                                fields.moment = Math.round(w * cg * 100) / 100;
                              }
                              updateForwardPointFields(point.id, fields);
                            }}
                            required
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label={`${envLabel} *`}
                            type="number"
                            value={point.cg || ''}
                            onChange={(e) => {
                              const newCg = e.target.value;
                              const w = parseFloat(point.weight);
                              const cg = parseFloat(newCg);
                              const fields = { cg: newCg };
                              if (Number.isFinite(w) && Number.isFinite(cg)) {
                                fields.moment = Math.round(w * cg * 100) / 100;
                              }
                              updateForwardPointFields(point.id, fields);
                            }}
                            inputProps={{ step: "0.0001" }}
                            required
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{envUnit}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Moment"
                            type="number"
                            value={point.moment || ''}
                            onChange={(e) => {
                              const newMoment = e.target.value;
                              const M = parseFloat(newMoment);
                              const w = parseFloat(point.weight);
                              const cg = parseFloat(point.cg);
                              const fields = { moment: newMoment };
                              if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                                fields.cg = Math.round((M / w) * 10000) / 10000;
                              } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                                fields.weight = Math.round((M / cg) * 100) / 100;
                              }
                              updateForwardPointFields(point.id, fields);
                            }}
                            placeholder="Auto"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              )}

            </Box>

            {/* CG Arrière (Most rearward) — 2 POINTS INDÉPENDANTS */}
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                Most Rearward CG (Limite arrière)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                La limite arrière peut être inclinée — chaque point (masse min et masse max) a son propre bras et son propre moment.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>

                {/* ─── POINT BAS : masse min — trio dynamique ─── */}
                <Box sx={{ width: '100%', maxWidth: 700, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--radius-sm)', bgcolor: 'background.paper' }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>
                    Point bas (à masse min)
                  </Typography>
                  <Grid container spacing={1.5} alignItems="flex-end">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label="Masse min *"
                        type="number"
                        value={aftCG.minWeight}
                        onChange={(e) => {
                          const newW = e.target.value;
                          const w = parseFloat(newW);
                          const cg = parseFloat(aftCG.minCG);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100
                            : aftCG.minMoment;
                          setAftCG(prev => ({ ...prev, minWeight: newW, minMoment: newMoment }));
                        }}
                        placeholder={String(data.weights?.minTakeoffWeight || '940')}
                        required
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label={`${envLabel} à masse min *`}
                        type="number"
                        value={aftCG.minCG}
                        onChange={(e) => {
                          const newCG = e.target.value;
                          const w = parseFloat(aftCG.minWeight);
                          const cg = parseFloat(newCG);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100
                            : aftCG.minMoment;
                          setAftCG(prev => ({ ...prev, minCG: newCG, minMoment: newMoment }));
                        }}
                        placeholder={envPlaceholder}
                        inputProps={{ step: "0.0001" }}
                        required
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{envUnit}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label="Moment à masse min"
                        type="number"
                        value={aftCG.minMoment}
                        onChange={(e) => {
                          const newMoment = e.target.value;
                          const M = parseFloat(newMoment);
                          const w = parseFloat(aftCG.minWeight);
                          const cg = parseFloat(aftCG.minCG);
                          // Saisir moment → déduit cg si masse, sinon masse si cg
                          if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              minMoment: newMoment,
                              minCG: String(Math.round((M / w) * 10000) / 10000)
                            }));
                          } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              minMoment: newMoment,
                              minWeight: String(Math.round((M / cg) * 100) / 100)
                            }));
                          } else {
                            setAftCG(prev => ({ ...prev, minMoment: newMoment }));
                          }
                        }}
                        placeholder="Auto"
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* ─── POINT HAUT : masse max — trio dynamique ─── */}
                <Box sx={{ width: '100%', maxWidth: 700, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--radius-sm)', bgcolor: 'background.paper' }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>
                    Point haut (à masse max)
                  </Typography>
                  <Grid container spacing={1.5} alignItems="flex-end">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label="Masse max *"
                        type="number"
                        value={aftCG.maxWeight}
                        onChange={(e) => {
                          const newW = e.target.value;
                          const w = parseFloat(newW);
                          const cg = parseFloat(aftCG.maxCG);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100
                            : aftCG.maxMoment;
                          setAftCG(prev => ({ ...prev, maxWeight: newW, maxMoment: newMoment }));
                        }}
                        placeholder={String(data.weights?.mtow || '1310')}
                        required
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label={`${envLabel} à masse max *`}
                        type="number"
                        value={aftCG.maxCG}
                        onChange={(e) => {
                          const newCG = e.target.value;
                          const w = parseFloat(aftCG.maxWeight);
                          const cg = parseFloat(newCG);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100
                            : aftCG.maxMoment;
                          setAftCG(prev => ({ ...prev, maxCG: newCG, maxMoment: newMoment }));
                        }}
                        placeholder={envPlaceholder}
                        inputProps={{ step: "0.0001" }}
                        required
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{envUnit}</InputAdornment>
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <StyledTextField
                        fullWidth size="small"
                        label="Moment à masse max"
                        type="number"
                        value={aftCG.maxMoment}
                        onChange={(e) => {
                          const newMoment = e.target.value;
                          const M = parseFloat(newMoment);
                          const w = parseFloat(aftCG.maxWeight);
                          const cg = parseFloat(aftCG.maxCG);
                          if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              maxMoment: newMoment,
                              maxCG: String(Math.round((M / w) * 10000) / 10000)
                            }));
                          } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              maxMoment: newMoment,
                              maxWeight: String(Math.round((M / cg) * 100) / 100)
                            }));
                          } else {
                            setAftCG(prev => ({ ...prev, maxMoment: newMoment }));
                          }
                        }}
                        placeholder="Auto"
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Bouton de validation */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleValidateAftCG}
                    disabled={(!aftCG.minCG && !aftCG.maxCG) || (!aftCG.minWeight && !aftCG.maxWeight)}
                    sx={{ textTransform: 'none' }}
                  >
                    ✓ Valider Most Rearward CG (2 points)
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Double graphique de l'enveloppe — CG + Moment côte à côte (2 points aft) */}
      <CGEnvelopeDualChart
        cgEnvelope={{
          forwardPoints: forwardCGPoints,
          aftMinWeight: data.cgEnvelope?.aftMinWeight || aftCG.minWeight,
          aftMaxWeight: data.cgEnvelope?.aftMaxWeight || aftCG.maxWeight,
          aftMinCG: data.cgEnvelope?.aftMinCG || aftCG.minCG,
          aftMaxCG: data.cgEnvelope?.aftMaxCG || aftCG.maxCG
        }}
        massUnit={getUnitSymbol(units.weight)}
        armUnit={getUnitSymbol(units.armLength)}
      />

      {/* Catégorie Utilitaire (U) retirée (demande utilisateur) : section
          encore vide / non utilisée. */}

      {/* ─── Rapport de pesée (PDF) — OBLIGATOIRE ─────────────────────────
          Placé en bas de Step3 (juste avant la navigation) pour suivre l'ordre
          logique : le pilote saisit toutes ses données M&C, puis joint le
          document officiel qui les justifie. Fichier stocké en base64 dans
          data.weighingReport (offline-accessible avec l'avion). Le wizard
          bloque le passage à l'étape suivante tant qu'aucun PDF n'est joint. */}
      <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', mt: 3, mb: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 'var(--radius-sm)',
            bgcolor: 'transparent'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Rapport de pesée (PDF) <span style={{ color: 'var(--color-red-critical)' }}>*</span>
              </Typography>
              {data.weighingReport?.hasData ? (
                <Typography variant="caption" color="text.secondary">
                  {data.weighingReport.fileName}
                  {' • '}
                  {data.weighingReport.fileSize
                    ? `${(data.weighingReport.fileSize / 1024 / 1024).toFixed(2)} MB`
                    : ''}
                  {data.weighingReport.uploadDate
                    ? ` • ${new Date(data.weighingReport.uploadDate).toLocaleDateString('fr-FR')}`
                    : ''}
                </Typography>
              ) : (
                <Typography variant="caption" color={errors?.weighingReport ? 'error.main' : 'text.secondary'}>
                  <strong>Document obligatoire</strong> justifiant la masse à vide et le bras de levier.
                  Sera accessible <strong>en préparation de vol</strong>, même hors ligne.
                </Typography>
              )}
              {errors?.weighingReport && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                  ⚠ {errors.weighingReport}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {data.weighingReport?.hasData && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      if (data.weighingReport?.pdfData) {
                        const w = window.open();
                        if (w) {
                          w.document.write(
                            `<iframe src="${data.weighingReport.pdfData}" style="width:100%;height:100vh;border:none;" title="Rapport de pesée"></iframe>`
                          );
                        }
                      }
                    }}
                  >
                    Voir
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => updateData('weighingReport', null)}
                    aria-label="Supprimer le rapport de pesée"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </>
              )}
              <Button
                variant={data.weighingReport?.hasData ? 'outlined' : 'contained'}
                color={data.weighingReport?.hasData ? 'primary' : 'warning'}
                size="small"
                component="label"
              >
                {data.weighingReport?.hasData ? 'Remplacer' : 'Importer PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.type !== 'application/pdf') {
                      alert('Le fichier doit être un PDF.');
                      return;
                    }
                    if (file.size > 20 * 1024 * 1024) {
                      alert('Le fichier dépasse 20 MB. Compresse-le ou splite-le en plusieurs pages.');
                      return;
                    }
                    try {
                      const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Lecture base64 échouée'));
                        reader.readAsDataURL(file);
                      });
                      updateData('weighingReport', {
                        fileName: file.name,
                        fileSize: file.size,
                        pdfData: base64,
                        uploadDate: new Date().toISOString(),
                        hasData: true
                      });
                    } catch (err) {
                      console.error('[Step3] Upload rapport de pesée échoué:', err);
                      alert('Erreur lors de l\'import du fichier.');
                    }
                    e.target.value = '';
                  }}
                />
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Boutons de navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        {/* Bouton Précédent */}
        {onPrevious && (
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={onPrevious}
            startIcon={<ChevronLeftIcon />}
          >
            Précédent
          </Button>
        )}

        {/* Bouton Suivant */}
        {onNext && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onNext}
            endIcon={<ChevronRightIcon />}
          >
            Suivant
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Step3WeightBalance;