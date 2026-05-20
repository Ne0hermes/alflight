import React, { useState, useEffect, Fragment } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Paper,
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Scale as ScaleIcon,
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
  AutoGraph as AutoGraphIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useUnitsStore, unitsSelectors } from '@core/stores/unitsStore';
import { convertValue, getUnitSymbol } from '@utils/unitConversions';
import CGEnvelopeChart from '../CgEnvelopeChart';
import CGEnvelopeDualChart from '../CgEnvelopeDualChart';
import CentrogramReader from '../CentrogramReader';
import { getFuelDensity } from '../../utils/mbUnits';
import { StyledTextField } from './FormFieldStyles';

const Step3WeightBalance = ({ data, updateData, errors = {}, onNext, onPrevious }) => {
  // ─── Sélecteur de méthode : 'manual' | 'graphical' | null (pas encore choisi) ───
  // Persistence locale UI uniquement : ne touche pas au store.
  const [inputMethod, setInputMethod] = useState(null);

  const [expandedPanels, setExpandedPanels] = useState({
    fuel: false,
    seats: false,
    baggage: false,
    limits: false,
    cgEnvelope: false
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
  const [additionalSeats, setAdditionalSeats] = useState(data.additionalSeats || []);
  const [baggageCompartments, setBaggageCompartments] = useState(data.baggageCompartments && data.baggageCompartments.length > 0
      ? data.baggageCompartments
      : [] // Vide par défaut
  );
  // Réservoirs additionnels : aile gauche/droite, optionnel, tip-tank, etc.
  // Le réservoir principal reste géré via data.arms.fuelMain (rétro-compat).
  const [additionalFuelTanks, setAdditionalFuelTanks] = useState(data.additionalFuelTanks || []);

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
      'weights.mzfw',
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
  //   data.weights.{emptyWeight, mtow, mlw, mzfw, minTakeoffWeight}
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
              borderRadius: 2,
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
              <Typography variant="h6">🖼 Lecture graphique du centrogramme</Typography>
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
              borderRadius: 2,
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
              <Typography variant="h6">✏️ Saisie manuelle</Typography>
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
      {/* Bannière mode + bouton pour basculer vers le mode graphique */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2,
        p: 1.5,
        bgcolor: 'action.hover',
        borderRadius: 1,
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" color="text.secondary">
          <EditNoteIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
          Mode saisie manuelle au clavier
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="success"
          startIcon={<AutoGraphIcon />}
          onClick={() => setInputMethod('graphical')}
        >
          Passer à la lecture graphique
        </Button>
      </Box>

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
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Capacité utilisable
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Capacité totale (importée depuis Step1, lecture seule) */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 2 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="Capacité totale carburant (importée du MANEX)"
                type="number"
                value={data.fuelCapacity || ''}
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
                  '& .MuiOutlinedInput-root.Mui-disabled': {
                    '& fieldset': {
                      borderColor: 'success.main',
                      borderStyle: 'dashed'
                    }
                  }
                }}
              />
            </Box>

            {/* ─── Réservoir principal — trio dynamique : capacité × densité × bras = moment ─── */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 2 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  ⛽ Réservoir principal
                </Typography>
              </Divider>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="Capacité"
                    type="number"
                    value={data.fuelMainCapacity || ''}
                    onChange={(e) => {
                      const newCap = e.target.value;
                      updateData('fuelMainCapacity', newCap);
                      // Recalcul du moment à plein si bras présent
                      const cap = parseFloat(newCap);
                      const arm = parseFloat(data.arms?.fuelMain);
                      const density = getFuelDensity(data.fuelType);
                      if (Number.isFinite(cap) && Number.isFinite(arm)) {
                        updateData('moments.fuelMain', Math.round(cap * density * arm * 100) / 100);
                      }
                    }}
                    helperText="Litrage utilisable"
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
                    value={data.arms?.fuelMain || ''}
                    onChange={(e) => {
                      const newArm = e.target.value;
                      updateData('arms.fuelMain', newArm);
                      const cap = parseFloat(data.fuelMainCapacity);
                      const arm = parseFloat(newArm);
                      const density = getFuelDensity(data.fuelType);
                      if (Number.isFinite(cap) && Number.isFinite(arm)) {
                        updateData('moments.fuelMain', Math.round(cap * density * arm * 100) / 100);
                      }
                    }}
                    error={!!errors['arms.fuelMain']}
                    helperText="Centre de gravité"
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
                    value={data.moments?.fuelMain || ''}
                    onChange={(e) => {
                      const newMoment = e.target.value;
                      updateData('moments.fuelMain', newMoment);
                      const M = parseFloat(newMoment);
                      const cap = parseFloat(data.fuelMainCapacity);
                      const arm = parseFloat(data.arms?.fuelMain);
                      const density = getFuelDensity(data.fuelType);
                      // Si capacité connue → calcule bras. Sinon si bras → calcule capacité.
                      if (Number.isFinite(M) && Number.isFinite(cap) && cap !== 0) {
                        updateData('arms.fuelMain', Math.round((M / (cap * density)) * 100) / 100);
                      } else if (Number.isFinite(M) && Number.isFinite(arm) && arm !== 0 && density !== 0) {
                        updateData('fuelMainCapacity', Math.round((M / (arm * density)) * 100) / 100);
                      }
                    }}
                    placeholder="Auto"
                    helperText={`densité ${getFuelDensity(data.fuelType)}`}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* ─── Réservoirs additionnels ─── */}
            <Box sx={{ width: '100%', mt: 3 }}>
              <Divider sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Réservoirs additionnels (ailes, optionnel, tip-tank…)
                </Typography>
              </Divider>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('wing')}
                >
                  + Réservoir d'aile
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('optional')}
                >
                  + Réservoir optionnel
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('tip')}
                >
                  + Tip tank
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank('aux')}
                >
                  + Auxiliaire
                </Button>
              </Box>

              {additionalFuelTanks.length === 0 ? (
                <Alert severity="info" icon={<InfoIcon />} sx={{ maxWidth: 700, mx: 'auto' }}>
                  <Typography variant="body2">
                    Aucun réservoir additionnel. Si ton avion a uniquement un réservoir
                    principal (cas standard GA), c'est OK. Sinon, clique sur l'un des boutons
                    ci-dessus pour ajouter aile gauche/droite, optionnel, tip-tank, etc.
                  </Typography>
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  {additionalFuelTanks.map((tank, index) => (
                    <Box key={tank.id} sx={{ width: '100%', maxWidth: 700, mb: index < additionalFuelTanks.length - 1 ? 2 : 0 }}>
                      {index > 0 && <Divider sx={{ mb: 2 }} />}
                      <Grid container spacing={2}>
                        <Grid size={12}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
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
                              sx={{ mt: 0.5 }}
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
                            value={tank.capacity || ''}
                            onChange={(e) => {
                              const newCap = e.target.value;
                              const cap = parseFloat(newCap);
                              const arm = parseFloat(tank.arm);
                              const density = getFuelDensity(data.fuelType);
                              const fields = { capacity: newCap };
                              if (Number.isFinite(cap) && Number.isFinite(arm)) {
                                fields.momentAtFull = Math.round(cap * density * arm * 100) / 100;
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="Litres"
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

            {/* ─── Récap : somme calculée vs total importé ─── */}
            {(() => {
              const total = parseFloat(data.fuelCapacity) || 0;
              const mainCap = parseFloat(data.fuelMainCapacity) || 0;
              const additionalSum = additionalFuelTanks.reduce(
                (sum, t) => sum + (parseFloat(t.capacity) || 0), 0
              );
              const computed = mainCap + additionalSum;
              const hasData = mainCap > 0 || additionalSum > 0;
              if (!hasData) return null;
              const diff = computed - total;
              const isMatch = Math.abs(diff) < 0.5;
              return (
                <Box sx={{ width: '100%', maxWidth: 700, mt: 2 }}>
                  <Alert
                    severity={isMatch ? 'success' : Math.abs(diff) < total * 0.05 ? 'info' : 'warning'}
                    icon={isMatch ? <CheckCircleIcon /> : <WarningIcon />}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      Récapitulatif des capacités
                    </Typography>
                    <Box sx={{ mt: 1, fontFamily: 'monospace', fontSize: 13 }}>
                      <div>
                        Réservoir principal :{' '}
                        <strong>{mainCap.toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                      </div>
                      {additionalFuelTanks.map(t => (
                        <div key={t.id}>
                          {t.name || 'Réservoir'} :{' '}
                          <strong>{(parseFloat(t.capacity) || 0).toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                        </div>
                      ))}
                      <Divider sx={{ my: 0.5 }} />
                      <div>
                        <strong>Somme calculée :</strong>{' '}
                        <strong style={{ color: isMatch ? '#16a34a' : '#dc2626' }}>
                          {computed.toFixed(1)} {getUnitSymbol(units.fuel)}
                        </strong>
                      </div>
                      <div>
                        <strong>Capacité totale (MANEX) :</strong>{' '}
                        <strong>{total.toFixed(1)} {getUnitSymbol(units.fuel)}</strong>
                      </div>
                      {!isMatch && (
                        <div style={{ marginTop: 6, color: Math.abs(diff) < total * 0.05 ? '#0284c7' : '#dc2626' }}>
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
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
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

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
              💡 Le <strong>moment d'un siège dépend du passager</strong> qui s'y assied — il est calculé au chargement
              (<code>moment = bras × masse_pax</code>). Seule la position (bras de levier) est figée pour l'avion.
            </Typography>
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
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Compartiments bagages
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
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
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Masses limites
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Masse à vide + Bras de levier + Moment à vide */}
            <Box sx={{ width: '100%', maxWidth: 800, mb: 1.5 }}>
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
                      ⏳ Saisis encore un champ pour que le 3e se calcule automatiquement.
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

            <Box sx={{ width: '100%', maxWidth: 700, mb: 1.5 }}>
              <StyledTextField
                fullWidth
                size="small"
                label="MZFW"
                type="number"
                value={data.weights?.mzfw || ''}
                onChange={(e) => updateData('weights.mzfw', e.target.value)}
                error={!!errors['weights.mzfw']}
                helperText={errors['weights.mzfw'] || "Maximum Zero Fuel Weight (MZFW)"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                }}
              />
            </Box>

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
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600, color: 'error.main' }}>
            Enveloppe de centrage — base {isMoment ? 'moment' : 'CG (bras de levier)'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ width: '100%' }}>
            {/* CG Avant (Most forward) - Liste de points */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', fontSize: '14px' }}>
                📍 Most Forward CG (Limite avant)
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

              {forwardCGPoints.length === 0 ? (
                <Alert severity="info" sx={{ maxWidth: 700, mx: 'auto' }}>
                  <Typography variant="body2">
                    💡 Aucun point défini. Cliquez sur "Ajouter un point" pour commencer.
                  </Typography>
                </Alert>
              ) : (
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
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: '13px' }}>
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

                      <Grid container spacing={1.5}>
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

              <Alert severity="info" sx={{ mt: 2, maxWidth: 700, mx: 'auto' }}>
                <Typography variant="body2">
                  💡 <strong>Info :</strong> Pour une masse donnée, vous rentrez {isMoment ? 'un moment' : 'un bras de levier (CG)'} ({envUnit}).
                  Vous pouvez ajouter autant de points que nécessaire pour définir la limite avant de l'enveloppe.
                </Typography>
              </Alert>
            </Box>

            {/* CG Arrière (Most rearward) — 2 POINTS INDÉPENDANTS */}
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold', fontSize: '14px' }}>
                📍 Most Rearward CG (Limite arrière)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                La limite arrière peut être inclinée — chaque point (masse min et masse max) a son propre bras et son propre moment.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 2 }}>

                {/* ─── POINT BAS : masse min — trio dynamique ─── */}
                <Box sx={{ width: '100%', maxWidth: 700, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>
                    Point bas (à masse min)
                  </Typography>
                  <Grid container spacing={1.5}>
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
                        helperText={!aftCG.minWeight && data.weights?.minTakeoffWeight ? "Auto: Masse min de vol" : ""}
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
                <Box sx={{ width: '100%', maxWidth: 700, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>
                    Point haut (à masse max)
                  </Typography>
                  <Grid container spacing={1.5}>
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
                        helperText={!aftCG.maxWeight && data.weights?.mtow ? "Auto: MTOW" : ""}
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