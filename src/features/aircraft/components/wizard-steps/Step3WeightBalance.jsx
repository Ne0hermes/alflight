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
  Radio,
  Checkbox,
  FormControlLabel,
  MenuItem
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
import { toStorage, fromStorage, convertMoment } from '../../utils/mbUnits';
import CGEnvelopeDualChart from '../CgEnvelopeDualChart';
import CentrogramReader from '../CentrogramReader';
import { getFuelDensity } from '../../utils/mbUnits';
// ⛽ Deux contenances par réservoir (17/08/2026) : accesseurs canoniques du
// moteur — usableCapacity ?? capacity (utilisable), totalCapacity ?? capacity
// (total). On les IMPORTE, on ne les réécrit pas (source unique de vérité).
import { tankUsableLtr, tankTotalLtr, tankUnusableLtr } from '@alflight/calc-engine/fuel/tankCapacity';
// 🛢️ Refonte 23/08/2026 : CATALOGUE de réservoirs vs CONFIGURATIONS. Les
// capacités de l'avion sont DÉRIVÉES de la configuration par défaut — le
// catalogue n'est plus jamais sommé (cf. moteur, source unique de vérité).
import {
  variantCapacities,
  defaultVariantCapacities,
  DEFAULT_VARIANT_NAME,
  // 🎭 24/08/2026 — le rôle vit dans la configuration : vocabulaire et
  // lecture des entrées viennent du moteur, jamais réécrits ici.
  TANK_ROLES,
  variantEntries,
  variantCapacityBreakdown
} from '@alflight/calc-engine/wb/tankVariants';
import { StyledTextField } from './FormFieldStyles';
import { getWeighingReportAge, WEIGHING_REPORT_WARN_YEARS } from '@utils/weighingReportAge';
import { uploadWeighingReportPdf } from '@services/blobStorage';

// 🎭 24/08/2026 — LE TYPE A QUITTÉ LE CATALOGUE (demande pilote : « il n'est
// plus utile de marquer si c'est un type principal ou optionnel quand je
// déclare les réservoirs ; c'est lorsque je crée les variantes que je dis si
// c'est principal, optionnel, annexe. Sinon ça ne veut plus rien dire. »).
//
// Le catalogue ne décrit plus QUE la pièce : nom, capacité totale, capacité
// utilisable, bras de levier, moment à plein. Le RÔLE se pose configuration
// par configuration, dans le bloc « 2 · Configurations » plus bas — c'est là
// que TANK_ROLES est consommé (importé du moteur, source unique de vérité).

const Step3WeightBalance = ({ data, updateData, errors = {}, onNext, onPrevious, registerStepNav, centrogramSessionRef }) => {
  // ─── Sélecteur de méthode : 'manual' | 'graphical' | null (pas encore choisi) ───
  // Persistence locale UI uniquement : ne touche pas au store.
  // Restauré depuis la session du wizard : revenir sur cette étape rouvre la
  // méthode en cours au lieu de repartir de l'écran de choix.
  const [inputMethod, setInputMethod] = useState(() => centrogramSessionRef?.current?.inputMethod ?? null);

  // La méthode choisie fait partie de la session : cette étape est démontée au
  // changement d'étape principale, la session, elle, vit dans le wizard.
  useEffect(() => {
    if (!centrogramSessionRef) return;
    centrogramSessionRef.current = { ...(centrogramSessionRef.current || {}), inputMethod };
  }, [inputMethod, centrogramSessionRef]);

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

  // ─── LOT 5 : variantes de configuration des réservoirs ──────────────────
  // Sous-ensembles NOMMÉS de additionalFuelTanks (référence par clé
  // String(id ?? index) — convention fuelStore). À la préparation du vol, le
  // pilote choisit la variante : seuls ses réservoirs existent pour le vol.
  const [tankVariants, setTankVariants] = useState(data.tankVariants || []);
  const tankKeyOf = (tank, index) => String(tank?.id ?? index);

  // Resync locale ← data (même pattern que additionalFuelTanks) : si une
  // écriture externe remplace data.tankVariants, l'éditeur doit suivre.
  useEffect(() => {
    if (Array.isArray(data.tankVariants) && data.tankVariants !== tankVariants) {
      setTankVariants(data.tankVariants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tankVariants]);

  // 🔧 LOT 5 — Backfill d'id AU MONTAGE pour les réservoirs legacy sans id :
  // les variantes référencent par String(id ?? index) et les INDEX bougent à
  // chaque suppression (référence figée sur le MAUVAIS réservoir au save) ;
  // removeFuelTank filtre par id (un id undefined supprimerait d'un coup tous
  // les réservoirs sans id). On assigne les ids une fois pour toutes et on
  // remappe les références par index des variantes existantes.
  useEffect(() => {
    const tanks = data.additionalFuelTanks || [];
    if (!tanks.some(t => t && t.id == null)) return;
    const remap = {};
    const withIds = tanks.map((t, i) => {
      if (t && t.id == null) {
        const withId = { ...t, id: Date.now() + Math.random() };
        remap[String(i)] = String(withId.id);
        return withId;
      }
      return t;
    });
    setAdditionalFuelTanks(withIds);
    updateData('additionalFuelTanks', withIds);
    const variants = Array.isArray(data.tankVariants) ? data.tankVariants : [];
    if (variants.length > 0) {
      const remapped = variants.map(v => ({
        ...v,
        tankIds: (Array.isArray(v?.tankIds) ? v.tankIds : []).map(k => remap[String(k)] ?? String(k))
      }));
      setTankVariants(remapped);
      updateData('tankVariants', remapped);
    }
    console.log('🔧 [Step3] Ids de réservoirs assignés (backfill legacy):', Object.keys(remap).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const syncTankVariants = (updated) => {
    setTankVariants(updated);
    updateData('tankVariants', updated);
  };
  // Message d'interdiction affiché SOUS la configuration concernée (index →
  // texte). Aucune correction silencieuse : on refuse l'action et on l'explique.
  const [variantNotices, setVariantNotices] = useState({});
  const setVariantNotice = (vi, message) =>
    setVariantNotices(prev => ({ ...prev, [vi]: message }));

  const newVariantId = () => `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const addTankVariant = () => {
    const isFirst = tankVariants.length === 0;
    const newVariant = {
      id: newVariantId(),
      // La PREMIÈRE configuration décrit l'avion tel qu'il est équipé : tous les
      // réservoirs déclarés cochés.
      //
      // 🎭 24/08/2026 — les SUIVANTES DUPLIQUENT la configuration par défaut
      // (réservoirs ET rôles). Elles partaient des réservoirs « non optionnels »
      // du catalogue ; ce champ n'existe plus, et le laisser retomber sur « tout
      // cocher » ferait resurgir exactement la somme de réservoirs exclusifs que
      // la refonte du 23/08 a éliminée (F-GOFP 93 + 142 = 235 L). Dupliquer part
      // d'un avion RÉEL, que le pilote ajuste ensuite.
      name: isFirst ? DEFAULT_VARIANT_NAME : `Configuration ${tankVariants.length + 1}`,
      isDefault: isFirst,
      tanks: isFirst
        ? additionalFuelTanks.map((t, i) => ({ id: tankKeyOf(t, i) }))
        : (() => {
            const base = tankVariants.find(v => v?.isDefault) || tankVariants[0];
            return variantEntries(base).map(e => ({ id: e.id, ...(e.role ? { role: e.role } : {}) }));
          })()
    };
    syncTankVariants([...tankVariants, newVariant]);
  };

  // ─── Création AUTOMATIQUE de la configuration par défaut ─────────────────
  // Dès qu'un réservoir existe, l'avion a AU MOINS une configuration — même
  // s'il n'y en a qu'une. C'est elle (et non la somme du catalogue) qui porte
  // la capacité de l'avion : sans elle, un catalogue de réservoirs exclusifs
  // (98 L OU 142 L) donnait un total fantôme de 235 L (cas F-GOFP).
  // Miroir EXACT d'ensureDefaultVariant côté moteur, écrit ici dans le
  // formulaire (le moteur reste pur : il ne connaît pas updateData).
  useEffect(() => {
    if (additionalFuelTanks.length === 0) return;
    if (tankVariants.length > 0) return;
    // ⏳ On attend le backfill d'ids (effet de montage ci-dessus) : créer la
    // configuration avant lui figerait des références par INDEX que
    // l'assignation d'ids rendrait aussitôt mortes.
    if (additionalFuelTanks.some(t => t && t.id == null)) return;
    syncTankVariants([{
      id: newVariantId(),
      name: DEFAULT_VARIANT_NAME,
      isDefault: true,
      tankIds: additionalFuelTanks.map((t, i) => tankKeyOf(t, i))
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalFuelTanks, tankVariants]);

  const updateTankVariant = (vi, patch) =>
    syncTankVariants(tankVariants.map((v, i) => (i === vi ? { ...v, ...patch } : v)));
  const setDefaultTankVariant = (vi) =>
    syncTankVariants(tankVariants.map((v, i) => ({ ...v, isDefault: i === vi })));
  const removeTankVariant = (vi) => {
    // La DERNIÈRE configuration n'est pas supprimable : sans elle l'avion
    // n'aurait plus de capacité du tout (et le catalogue serait re-sommé).
    if (tankVariants.length <= 1) {
      setVariantNotice(vi, "Impossible de supprimer la dernière configuration : c'est elle qui donne la capacité de l'avion. Modifiez plutôt les réservoirs qu'elle embarque.");
      return;
    }
    const removedWasDefault = !!tankVariants[vi]?.isDefault;
    let remaining = tankVariants.filter((_, i) => i !== vi);
    // La configuration par défaut ne disparaît jamais : la première reprend le rôle.
    if (removedWasDefault && remaining.length > 0) {
      remaining = remaining.map((v, i) => ({ ...v, isDefault: i === 0 }));
    }
    setVariantNotices({});
    syncTankVariants(remaining);
  };
  // Coche/décoche un réservoir dans une configuration. Opère sur `tanks`
  // (forme neuve, porteuse des rôles) ; `tankIds` est réécrit en miroir pour
  // les lecteurs non migrés. Décocher OUBLIE le rôle — c'est voulu : un
  // réservoir absent de la configuration n'y tient aucun rôle.
  const toggleVariantTank = (vi, key, checked) => {
    const current = tankVariants[vi];
    const entries = variantEntries(current);
    if (!checked && entries.length <= 1) {
      // Configuration vide INTERDITE : refus explicite, pas de suppression
      // silencieuse au save (l'ancien sanitize jetait la variante sans le dire).
      setVariantNotice(vi, 'Une configuration doit embarquer au moins un réservoir. Cochez-en un autre avant de décocher celui-ci.');
      return;
    }
    setVariantNotice(vi, null);
    const k = String(key);
    const next = checked
      ? (entries.some(e => e.id === k) ? entries : [...entries, { id: k }])
      : entries.filter(e => e.id !== k);
    syncTankVariants(tankVariants.map((v, i) =>
      (i === vi
        ? { ...v, tanks: next.map(e => ({ id: e.id, ...(e.role ? { role: e.role } : {}) })), tankIds: next.map(e => e.id) }
        : v)
    ));
  };

  // 🎭 Pose le RÔLE d'un réservoir DANS une configuration.
  // PLUSIEURS PRINCIPAUX SONT AUTORISÉS (24/08/2026) : un principal central et
  // deux réservoirs d'aile qui remplissent le même office coexistent. Poser
  // « principal » sur B ne le retire donc plus à A. Ce qui reste unique, c'est
  // le miroir arms.fuelMain — le moteur ne l'écrit que si tous les principaux
  // partagent un même bras (fixedTanksArm), sinon rien.
  const setVariantTankRole = (vi, key, role) => {
    const current = tankVariants[vi];
    const k = String(key);
    const entries = variantEntries(current).map(e =>
      e.id === k
        ? { id: e.id, ...(role ? { role } : {}) }
        : { id: e.id, ...(e.role ? { role: e.role } : {}) }
    );
    setVariantNotice(vi, null);
    syncTankVariants(tankVariants.map((v, i) =>
      (i === vi ? { ...v, tanks: entries, tankIds: entries.map(e => e.id) } : v)
    ));
  };

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

  // ─── 🔧 Audit 16/08 (CRITIQUE) : resync local ← data pour l'ENVELOPPE ────
  // Sans ces effets, l'enveloppe construite par le CentrogramReader
  // (updateData('cgEnvelope', …)) restait INVISIBLE en saisie manuelle (états
  // locaux figés au montage — Step3 n'est pas remonté au passage
  // graphique → manuel) et toute édition manuelle réécrivait data.cgEnvelope
  // avec les copies périmées, DÉTRUISANT la lecture : « travail dans le
  // vide ». Resync PAR SOUS-CHAMP — un resync global sur data.cgEnvelope
  // écraserait la saisie arrière en cours (écrite dans data au « Valider »).
  useEffect(() => {
    const fp = data.cgEnvelope?.forwardPoints;
    if (Array.isArray(fp) && fp !== forwardCGPoints) {
      // Backfill d'id : buildCgEnvelope émet {weight, cg} SANS id, or l'UI
      // clé et édite les points par p.id.
      setForwardCGPoints(fp.map((p, i) => (p && p.id != null ? p : { ...p, id: Date.now() + i + Math.random() })));
    }
  }, [data.cgEnvelope?.forwardPoints]);

  useEffect(() => {
    const ip = data.cgEnvelope?.intermediatePoints;
    if (Array.isArray(ip) && ip !== intermediatePoints) setIntermediatePoints(ip);
  }, [data.cgEnvelope?.intermediatePoints]);

  useEffect(() => {
    const env = data.cgEnvelope;
    if (!env) return;
    setAftCG(prev => {
      const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
      const minWeight = env.aftMinWeight ?? prev.minWeight;
      const maxWeight = env.aftMaxWeight ?? prev.maxWeight;
      const minCG = env.aftMinCG ?? env.aftCG ?? prev.minCG;
      const maxCG = env.aftMaxCG ?? env.aftCG ?? prev.maxCG;
      // buildCgEnvelope n'émet pas les moments : recalcul masse × CG
      const minMoment = env.aftMinMoment
        ?? ((num(minWeight) !== null && num(minCG) !== null) ? Math.round(num(minWeight) * num(minCG) * 100) / 100 : prev.minMoment);
      const maxMoment = env.aftMaxMoment
        ?? ((num(maxWeight) !== null && num(maxCG) !== null) ? Math.round(num(maxWeight) * num(maxCG) * 100) / 100 : prev.maxMoment);
      return { ...prev, minWeight, maxWeight, minCG, maxCG, minMoment, maxMoment };
    });
  }, [data.cgEnvelope?.aftMinWeight, data.cgEnvelope?.aftMaxWeight, data.cgEnvelope?.aftMinCG, data.cgEnvelope?.aftMaxCG, data.cgEnvelope?.aftCG]);

  useEffect(() => {
    if (data.cgEnvelope?.macLength != null && data.cgEnvelope.macLength !== macLength) {
      setMacLength(data.cgEnvelope.macLength);
    }
  }, [data.cgEnvelope?.macLength]);

  useEffect(() => {
    if (data.cgEnvelope?.lemac != null && data.cgEnvelope.lemac !== lemac) {
      setLemac(data.cgEnvelope.lemac);
    }
  }, [data.cgEnvelope?.lemac]);

  // ─── Migration legacy → array : convertit data.fuelMainCapacity en tank ─
  // Si l'avion a été créé avant la refonte (fuelMainCapacity > 0 et catalogue
  // VIDE), on insère un réservoir avec les valeurs legacy.
  //
  // 🎭 24/08/2026 — la garde d'idempotence ne peut plus s'appuyer sur
  // `type === 'main'`, qui n'existe plus. Elle devient STRUCTURELLE : un
  // catalogue non vide signifie que la migration a eu lieu, ou qu'elle n'a
  // pas lieu d'être. Sans ce changement, l'effet réinsérerait un réservoir
  // en tête à CHAQUE montage de l'étape tant que fuelMainCapacity traîne —
  // catalogue pollué et capacité de la configuration par défaut fausse.
  useEffect(() => {
    const legacyCap = parseFloat(data.fuelMainCapacity);
    const hasLegacy = Number.isFinite(legacyCap) && legacyCap > 0;
    const catalogueNonVide = (data.additionalFuelTanks || []).length > 0;
    if (!hasLegacy || catalogueNonVide) return;

    const mainTank = {
      id: Date.now() + Math.random(),
      name: 'Réservoir principal',
      // ⛽ Deux contenances (17/08/2026) — EXCEPTION assumée à la règle « on
      // n'écrit plus `capacity` » : fuelMainCapacity est une valeur legacy à
      // la sémantique AMBIGUË (total ? utilisable ?). La relocaliser telle
      // quelle en `capacity` préserve cette ambiguïté que les accesseurs
      // savent lire (usableCapacity ?? capacity) ; l'écrire en usableCapacity
      // ou totalCapacity affirmerait une sémantique que la fiche n'a jamais
      // eue. Le pilote tranchera via les deux champs de l'éditeur.
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

  // ─── Capacités de l'avion = celles de la CONFIGURATION PAR DÉFAUT ───────
  // 🛢️ Refonte 23/08/2026 (demande pilote). Historique du champ :
  //   • à l'origine, fuelCapacity = Σ de TOUS les réservoirs déclarés ;
  //   • Phase 0 (17/08) : la somme ne remplaçait plus une valeur saisie
  //     (F-BXQT — 98 L du manuel écrasés à 85 L par la somme).
  // Les deux règles partaient du même postulat FAUX : que le catalogue de
  // réservoirs décrit un avion. Il décrit ce que la cellule PEUT recevoir, y
  // compris des réservoirs qui s'excluent — d'où le 235 L de F-GOFP (93 + 142
  // de deux configurations alternatives) et le 189 L de F-GGZO (152 + 37).
  // Désormais : la capacité de l'avion est celle de sa configuration PAR
  // DÉFAUT, recalculée en continu, en lecture seule dans l'écran. Fail-closed :
  // une contenance manquante sur un réservoir de la configuration laisse le
  // champ VIDE (jamais un 0, jamais une somme partielle) — cf.
  // defaultVariantCapacities / strictSum côté moteur.
  const derivedCapacities = defaultVariantCapacities({
    additionalFuelTanks,
    tankVariants
  });
  useEffect(() => {
    if (additionalFuelTanks.length === 0) return;
    const { totalLtr, usableLtr } = derivedCapacities;
    const currentTotal = parseFloat(data.fuelCapacity);
    const nextTotal = totalLtr == null ? '' : totalLtr;
    if ((Number.isFinite(currentTotal) ? currentTotal : '') !== nextTotal) {
      updateData('fuelCapacity', nextTotal);
    }
    const currentUsable = parseFloat(data.fuelUsableCapacity);
    const nextUsable = usableLtr == null ? '' : usableLtr;
    if ((Number.isFinite(currentUsable) ? currentUsable : '') !== nextUsable) {
      updateData('fuelUsableCapacity', nextUsable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalFuelTanks, tankVariants, data.fuelCapacity, data.fuelUsableCapacity]);

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

  // ─── C2 (Phase 2) : conversion AUX FRONTIÈRES uniquement ──────────────────
  // data/state ne contiennent QUE du canonique (kg, m, kg·m, L — cf. mbUnits
  // STORAGE_UNITS). Chaque champ AFFICHE via disp* (canonique → unité user) et
  // STOCKE via in* (user → canonique). Un changement de préférence d'unités ne
  // réécrit plus JAMAIS la donnée (l'ancien effet de conversion in-place était
  // le vecteur du bug kg/lbs — ANO-8/ANO-11, AUDIT_MASSE_CENTRAGE_UNITES.md).
  // 🛡️ Garde-fou (16/08) : une préférence d'unité absente (stockage hérité)
  // rendait fromStorage/toStorage fail-closed → champs de bras VIDES malgré
  // une donnée présente. Le défaut de l'application fait foi si la catégorie
  // manque. Cause racine traitée dans unitsStore (fusion profonde du persist).
  const armUnit = units.armLength || 'mm';
  const weightUnit = units.weight || 'kg';
  const dispArm = (v) => {
    const x = fromStorage(v, armUnit, 'armLength');
    return x === '' ? '' : Math.round(x * 10000) / 10000;
  };
  const inArm = (raw) => {
    const x = toStorage(raw, armUnit, 'armLength');
    return x === null ? '' : Math.round(x * 100000) / 100000; // m, 5 déc. = 0,01 mm
  };
  const dispWeight = (v) => {
    const x = fromStorage(v, weightUnit, 'weight');
    return x === '' ? '' : Math.round(x * 100) / 100;
  };
  const inWeight = (raw) => {
    const x = toStorage(raw, weightUnit, 'weight');
    return x === null ? '' : Math.round(x * 1000) / 1000; // kg, 3 déc.
  };
  const dispMoment = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return '';
    const x = convertMoment(n, units, 'fromStorage');
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : '';
  };
  const inMoment = (raw) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return '';
    const x = convertMoment(n, units, 'toStorage');
    return Number.isFinite(x) ? Math.round(x * 10000) / 10000 : ''; // kg·m, 4 déc.
  };

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

    // 🔧 Audit 16/08 : réécrire AUSSI aftPoints — la courbe arrière complète
    // posée par le CentrogramReader reste sinon PRIORITAIRE pour le moteur
    // (cgEnvelope.js) et la correction manuelle des 2 points serait
    // silencieusement ignorée dans les calculs de centrage.
    const nMinW = parseFloat(finalMinWeight);
    const nMaxW = parseFloat(finalMaxWeight);
    const nMinC = parseFloat(aftCG.minCG);
    const nMaxC = parseFloat(aftCG.maxCG);
    if ([nMinW, nMaxW, nMinC, nMaxC].every(Number.isFinite)) {
      updateData('cgEnvelope.aftPoints', [
        { weight: nMinW, cg: nMinC },
        { weight: nMaxW, cg: nMaxC }
      ]);
    }

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

  // ─── Sièges : écriture des champs d'une rangée FIXE (avant / arrière) ───
  // Le bras reste à son emplacement HISTORIQUE arms.<rowKey> (consommé par le
  // moteur M&C, la transposition weightBalance, etc.) ; masse max et moment max
  // (informatif / garde-fou, comme momentMax des compartiments bagages) vivent
  // dans seatLimits.<rowKey>.{maxWeight, momentMax} — nouveaux champs additifs.
  const applySeatRowFields = (rowKey) => (fields) => {
    if ('arm' in fields) updateData(`arms.${rowKey}`, fields.arm);
    if ('maxWeight' in fields) updateData(`seatLimits.${rowKey}.maxWeight`, fields.maxWeight);
    if ('momentMax' in fields) updateData(`seatLimits.${rowKey}.momentMax`, fields.momentMax);
  };

  // ─── Sièges ARRIÈRE supprimables (19/08/2026, biplaces F-BXQT/F-BXNG) ───
  // La rangée arrière était affichée INCONDITIONNELLEMENT : sur un biplace,
  // deux champs vides irrémédiables — et pire, certaines fiches portaient un
  // bras arrière FANTÔME (copie du bras avant) qui aurait faussé le centrage
  // si quelqu'un y avait mis une masse. La rangée devient supprimable :
  //   • détection « absent » : arms.rearSeats ET les deux bras weightBalance
  //     tous absents/vides/null ;
  //   • suppression : bras effacés (JAMAIS 0 — un zéro serait un bras
  //     inventé ; côté weightBalance on écrit null, le contrat moteur pour
  //     « bras absent » — undefined ferait refuser TOUT le calcul via
  //     requiredProps) + seatLimits.rearSeats retiré ;
  //   • Step6 (prépa vol) masque les postes de charge arrière sur la même
  //     détection : un avion sans places arrière n'expose plus ces champs.
  const hasArmValue = (v) =>
    v !== null && v !== undefined && v !== '' && Number.isFinite(parseFloat(v));
  const rearSeatsDefined =
    hasArmValue(data.arms?.rearSeats) ||
    hasArmValue(data.weightBalance?.rearLeftSeatArm) ||
    hasArmValue(data.weightBalance?.rearRightSeatArm);
  // État d'AFFICHAGE de la rangée : données présentes → visible ; sinon le
  // pilote la fait (ré)apparaître explicitement via « + Ajouter des sièges
  // arrière » (rangée vide tant qu'il ne saisit rien). Les seatLimits seuls
  // (limite saisie avant le bras) suffisent aussi à montrer la rangée.
  const [showRearSeats, setShowRearSeats] = useState(() =>
    rearSeatsDefined ||
    hasArmValue(data.seatLimits?.rearSeats?.maxWeight) ||
    hasArmValue(data.seatLimits?.rearSeats?.momentMax)
  );
  // Écriture EXTERNE des bras arrière (CentrogramReader, import…) → la rangée
  // doit réapparaître même si le pilote l'avait masquée auparavant.
  useEffect(() => {
    if (rearSeatsDefined) setShowRearSeats(true);
  }, [rearSeatsDefined]);

  const removeRearSeats = () => {
    // Bras : effacés, jamais 0 (0 = bras fabriqué qui fausserait le centrage).
    updateData('arms.rearSeats', null); // null = suppression VOLONTAIRE (respectée par les gardes anti-perte)
    if (data.weightBalance) {
      // null = « absent » pour le moteur (computeWeightBalance) : les
      // requiredProps acceptent null mais REFUSENT undefined (calcul rejeté).
      updateData('weightBalance.rearLeftSeatArm', null);
      updateData('weightBalance.rearRightSeatArm', null);
    }
    if (data.seatLimits?.rearSeats) {
      updateData('seatLimits.rearSeats', null); // null (et non undefined) : sinon le garde anti-perte restaurerait les limites
    }
    // Formes LEGACY : sans cet effacement, pick()/fallbacks moteur feraient
    // RESSUSCITER le bras fantôme depuis armLengths à la prochaine édition.
    if (data.armLengths) {
      ['rearSeat1Arm', 'rearSeat2Arm', 'rearSeatArm'].forEach((k) => {
        if (data.armLengths[k] !== undefined && data.armLengths[k] !== null && data.armLengths[k] !== '') {
          updateData(`armLengths.${k}`, undefined);
        }
      });
    }
    setShowRearSeats(false);
  };

  // ─── Trio « Masse max × Bras = Moment max » pour une rangée de sièges ───
  // MÊME pattern (et même logique réciproque) que les compartiments bagages :
  //   - saisir la masse ou le bras → moment recalculé ;
  //   - saisir le moment → bras déduit (M/masse), sinon masse déduite (M/bras).
  // `values` = { maxWeight, arm, momentMax } en CANONIQUE (kg / m / kg·m),
  // `applyFields` écrit les champs modifiés au bon endroit (rangée fixe ou
  // siège additionnel). Tous les champs du trio sont OPTIONNELS.
  const renderSeatTrio = (values, applyFields, { armError, armHelper } = {}) => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <StyledTextField
          fullWidth
          size="small"
          label="Masse max occupants"
          type="number"
          value={dispWeight(values.maxWeight)}
          onChange={(e) => {
            const massCanonical = inWeight(e.target.value); // kg
            const m = parseFloat(massCanonical);
            const a = parseFloat(values.arm);               // m
            const fields = { maxWeight: massCanonical };
            if (Number.isFinite(m) && Number.isFinite(a)) {
              fields.momentMax = Math.round(m * a * 100) / 100; // kg·m
            }
            applyFields(fields);
          }}
          placeholder="Optionnel"
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
          value={dispArm(values.arm)}
          onChange={(e) => {
            const armCanonical = inArm(e.target.value);     // m
            const m = parseFloat(values.maxWeight);         // kg
            const a = parseFloat(armCanonical);
            const fields = { arm: armCanonical };
            if (Number.isFinite(m) && Number.isFinite(a)) {
              fields.momentMax = Math.round(m * a * 100) / 100; // kg·m
            }
            applyFields(fields);
          }}
          placeholder="Station"
          error={!!armError}
          helperText={armError || armHelper}
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
          value={dispMoment(values.momentMax)}
          onChange={(e) => {
            const momentCanonical = inMoment(e.target.value); // kg·m
            const M = parseFloat(momentCanonical);
            const m = parseFloat(values.maxWeight);           // kg
            const a = parseFloat(values.arm);                 // m
            const fields = { momentMax: momentCanonical };
            if (Number.isFinite(M) && Number.isFinite(m) && m !== 0) {
              fields.arm = Math.round((M / m) * 100000) / 100000;   // m
            } else if (Number.isFinite(M) && Number.isFinite(a) && a !== 0) {
              fields.maxWeight = Math.round((M / a) * 100) / 100;   // kg
            }
            applyFields(fields);
          }}
          placeholder="Auto (masse × bras)"
          helperText={(() => {
            const m = parseFloat(values.maxWeight);
            const a = parseFloat(values.arm);
            const M = parseFloat(values.momentMax);
            if (Number.isFinite(m) && Number.isFinite(a) && Number.isFinite(M)) {
              const computed = m * a;
              return Math.abs(computed - M) < 0.5 ? '✓' : `⚠ ≠ ${dispMoment(computed)}`;
            }
            return '';
          })()}
          InputProps={{
            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}·{getUnitSymbol(units.armLength)}</InputAdornment>,
          }}
        />
      </Grid>
    </Grid>
  );

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

  // ─── Gestion des réservoirs ───────────────────────────────────────────────
  // 🔧 17/08/2026 — FIN DU MENU DE TYPES (main/wing/optional/tip/aux).
  // Le « type » mélangeait un RÔLE (principal) et une POSITION (aile, tip…) :
  // les réservoirs principaux d'un PA-28 SONT dans les ailes, et il fallait
  // choisir entre dire où il est et dire ce qu'il est. Audit du code : le type
  // n'avait que DEUX effets réels — désigner le réservoir qui alimente les
  // champs de compatibilité (arms.fuelMain), et pré-cocher « amovible ».
  // Tout le reste était décoratif. Désormais :
  //   • la POSITION vit dans le NOM (texte libre, boutons = préremplissages) ;
  //   • le RÔLE « principal » est une pastille unique (type:'main' conservé en
  //     base pour la compatibilité — les moteurs, eux, ignorent le type) ;
  //   • « amovible » reste la case existante (pilote les variantes).
  const addFuelTank = () => {
    const newTank = {
      id: Date.now() + Math.random(),
      // Nom prérempli et TOUJOURS numéroté — « Réservoir 1 », « Réservoir 2 »… —
      // librement renommable ensuite. Aucun type, aucun rôle, aucune notion
      // d'« amovible » : tout cela appartient à la configuration.
      name: `Réservoir ${additionalFuelTanks.length + 1}`,
      arm: ''
      // ⛽ Deux contenances (17/08/2026) : aucune initialisation de volume —
      // totalCapacity / usableCapacity sont écrits à la saisie uniquement
      // (absent reste absent, jamais un 0 fabriqué).
    };
    const updated = [...additionalFuelTanks, newTank];
    setAdditionalFuelTanks(updated);
    updateData('additionalFuelTanks', updated);
  };

  // 🎭 setMainTank et setTankType ont été SUPPRIMÉS le 24/08/2026 : le rôle
  // « principal » ne se pose plus sur le réservoir du catalogue mais sur son
  // entrée dans une configuration (setVariantTankRole, plus bas). Un même
  // réservoir peut ainsi être principal dans une configuration et annexe dans
  // une autre — ce que l'ancien champ unique rendait impossible.
  const removeFuelTank = (tankId) => {
    const updated = additionalFuelTanks.filter(t => t.id !== tankId);
    setAdditionalFuelTanks(updated);
    updateData('additionalFuelTanks', updated);
    // 🛢️ 23/08/2026 — le réservoir disparaît AUSSI des configurations qui le
    // cochaient : sinon elles garderaient une référence morte et leur capacité
    // deviendrait silencieusement fausse. Une configuration qui ne référençait
    // QUE ce réservoir ne décrit plus rien → elle est retirée (le pilote vient
    // de supprimer le réservoir, l'effet est visible et voulu) ; s'il n'en reste
    // aucune, l'effet ci-dessus recrée « Configuration standard ».
    if (tankVariants.length === 0) return;
    // Sécurité : sans id sur chaque réservoir, les clés sont des INDEX que la
    // suppression décale — on ne touche alors à rien plutôt que de repointer
    // une configuration sur le mauvais réservoir (sanitizeTankVariants au save
    // reste le filet pour les références mortes).
    if (updated.some(t => t && t.id == null)) return;
    const validKeys = new Set(updated.map((t, i) => tankKeyOf(t, i)));
    const purged = tankVariants
      .map(v => ({
        ...v,
        tankIds: (Array.isArray(v.tankIds) ? v.tankIds : []).map(String).filter(k => validKeys.has(k))
      }))
      .filter(v => v.tankIds.length > 0);
    if (purged.length > 0 && !purged.some(v => v.isDefault)) {
      purged[0] = { ...purged[0], isDefault: true };
    }
    setVariantNotices({});
    syncTankVariants(purged);
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

  // ─── ⛽ Deux contenances par réservoir (17/08/2026, cas F-BXQT 98/85 L) ───
  // Saisie des contenances totalCapacity / usableCapacity : motif writeNumeric
  // de Step2Speeds — vidé → undefined (la clé DISPARAÎT du JSON, absent reste
  // absent, JAMAIS 0) ; sinon NOMBRE en litres canoniques (saisie en unité
  // user). L'ancien champ `capacity` n'est PLUS JAMAIS écrit par ces handlers :
  // les moteurs lisent usableCapacity ?? capacity (accesseurs calc-engine).
  const inTankLiters = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return undefined;
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) return undefined;
    const canonical = parseFloat(convertValue(n, units.fuel, 'ltr', 'fuel'));
    return Number.isFinite(canonical) ? Math.round(canonical * 100) / 100 : undefined;
  };
  const dispTankLiters = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return '';
    return Math.round(convertValue(n, 'ltr', units.fuel, 'fuel') * 10) / 10;
  };
  // Valeur AFFICHÉE dans le champ « Utilisable » — compatibilité legacy : une
  // fiche antérieure n'a que l'ancien `capacity` ; on l'affiche comme
  // UTILISABLE (hypothèse prudente, EXACTEMENT la lecture des moteurs :
  // usableCapacity ?? capacity, cf. tankUsableLtr) SANS l'écrire en base tant
  // que le pilote ne touche pas au champ — pas d'écriture de masse silencieuse.
  // Le champ « totale » reste vide : déduire un total d'un utilisable
  // exigerait un facteur inventé — interdit.
  const tankUsableFieldValue = (tank) => tank?.usableCapacity ?? tank?.capacity ?? '';

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
          sessionRef={centrogramSessionRef}
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
          Tu peux soit lire les bras de levier par clic sur le centrogramme du manuel de vol,
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
                Charge une image du centrogramme du manuel de vol, calibre les axes par clic,
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
                et points de l'enveloppe à partir du rapport M&C de ton manuel de vol.
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
  const envPlaceholder = { mm: '2130', cm: '213', m: '2.13', in: '83.9' }[units.armLength] || '2.13';
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
            Carburant — réservoirs et configurations
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* ─── Capacités de l'avion : DÉRIVÉES, en lecture seule ─────────
                🛢️ 23/08/2026 — elles ne sont plus jamais saisies à la main ni
                sommées sur le catalogue : elles viennent de la configuration
                par défaut définie plus bas. Vides tant qu'une contenance
                manque (fail-closed : jamais un 0 ni une somme partielle).
                NOTE : data.fuelCapacity est stocké en CANONIQUE (litres). On
                convertit vers l'unité de préférence pilote pour l'affichage. */}
            <Box sx={{ width: '100%', maxWidth: 700, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="Capacité totale de l'avion"
                    type="number"
                    value={dispTankLiters(derivedCapacities.totalLtr)}
                    disabled
                    helperText="Calculé depuis la configuration par défaut"
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
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    label="Capacité utilisable de l'avion"
                    type="number"
                    value={dispTankLiters(derivedCapacities.usableLtr)}
                    disabled
                    helperText="Calculé depuis la configuration par défaut"
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
                </Grid>
              </Grid>
              {additionalFuelTanks.length > 0 &&
                (derivedCapacities.totalLtr == null || derivedCapacities.usableLtr == null) && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Une contenance manque sur au moins un réservoir de la configuration par
                    défaut : la capacité correspondante reste VIDE (aucune somme partielle
                    n'est écrite). Complétez les contenances ci-dessous.
                  </Typography>
                </Alert>
              )}
            </Box>

            {/* ─── (a) CATALOGUE des réservoirs de l'avion ───
                🛢️ 23/08/2026 — cette liste déclare les réservoirs que la
                cellule PEUT recevoir, chacun de façon ISOLÉE, y compris ceux
                qui s'excluent mutuellement. Elle n'est JAMAIS sommée : la
                capacité de l'avion vient des configurations (section suivante). */}
            <Box sx={{ width: '100%', mt: 3 }}>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  1 · Réservoirs de l'avion (catalogue)
                </Typography>
              </Divider>

              <Alert severity="info" icon={<InfoIcon />} sx={{ maxWidth: 700, mx: 'auto', mb: 2 }}>
                <Typography variant="body2">
                  Déclarez ici <strong>tous les réservoirs possibles</strong>, y compris ceux
                  qui s'excluent (98 L standard <em>OU</em> 142 L longue distance). La capacité
                  de l'avion ne vient <strong>PAS</strong> de cette liste mais des
                  configurations ci-dessous.
                </Typography>
              </Alert>

              {/* 🔧 24/08/2026 (demande pilote) — UN SEUL bouton. Les cinq
                  raccourcis de nom (« Réservoir principal », « Réservoir d'aile »,
                  « Tip tank », « Auxiliaire », « Autre ») ne servaient à rien : le
                  pilote renomme de toute façon. Le nom est prérempli « Réservoir 1 »,
                  « Réservoir 2 », … et reste librement modifiable. */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addFuelTank()}
                >
                  Ajouter un réservoir
                </Button>
              </Box>

              {additionalFuelTanks.length === 0 ? (
                <Alert severity="warning" icon={<InfoIcon />} sx={{ maxWidth: 700, mx: 'auto' }}>
                  <Typography variant="body2">
                    <strong>Aucun réservoir défini.</strong> Ajoute au moins un réservoir
                    avec le bouton ci-dessus, puis renomme-le comme dans ton manuel de
                    vol. Dès le premier réservoir, une
                    <em> configuration standard</em> est créée automatiquement : c'est
                    elle qui portera la capacité de l'avion.
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
                            {/* 🎭 Le sélecteur « Type » a été retiré le 24/08/2026 :
                                le catalogue ne décrit plus que la pièce. Le rôle se
                                choisit dans chaque configuration, plus bas. */}
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
                        {/* ⛽ Deux contenances (17/08/2026) : le réservoir porte la capacité
                            TOTALE (volume physique — avitaillement, documentation) ET
                            l'UTILISABLE (la grandeur des moteurs de centrage/autonomie).
                            L'ancien champ unique « Capacité » (sémantique ambiguë) écrasait
                            le total du manuel — cas F-BXQT : 98 L total / 85 L utilisable,
                            le 98 était insaisissable. */}
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Capacité totale"
                            type="number"
                            value={dispTankLiters(tank.totalCapacity)}
                            onChange={(e) => {
                              // Le total ne pilote PAS le moment à plein : le « plein »
                              // opérationnel est le plein UTILISABLE (l'inutilisable est
                              // déjà dans la masse à vide pesée) — pas de recalcul ici.
                              updateFuelTankFields(tank.id, { totalCapacity: inTankLiters(e.target.value) });
                            }}
                            placeholder="Volume physique"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Utilisable"
                            type="number"
                            value={dispTankLiters(tankUsableFieldValue(tank))}
                            onChange={(e) => {
                              const usableL = inTankLiters(e.target.value);   // L canoniques ou undefined
                              const arm = parseFloat(tank.arm);              // m (canonique)
                              const density = getFuelDensity(data.fuelType);
                              const fields = { usableCapacity: usableL };
                              // momentAtFull sur l'UTILISABLE : le plein opérationnel est
                              // le plein utilisable — compter le total pèserait
                              // l'inutilisable deux fois (déjà dans la masse à vide).
                              if (Number.isFinite(usableL) && Number.isFinite(arm) && density != null) {
                                fields.momentAtFull = Math.round(usableL * density * arm * 100) / 100; // kg·m
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="Consommable"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.fuel)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Bras de levier"
                            type="number"
                            value={dispArm(tank.arm)}
                            onChange={(e) => {
                              const armCanonical = inArm(e.target.value); // m
                              // ⛽ momentAtFull recalculé sur l'UTILISABLE (accesseur avec
                              // repli legacy usableCapacity ?? capacity) — le plein
                              // opérationnel est le plein utilisable.
                              const cap = tankUsableLtr(tank);            // L (canonique) ou null
                              const arm = parseFloat(armCanonical);
                              const density = getFuelDensity(data.fuelType);
                              const fields = { arm: armCanonical };
                              if (Number.isFinite(cap) && Number.isFinite(arm) && density != null) {
                                fields.momentAtFull = Math.round(cap * density * arm * 100) / 100; // kg·m
                              }
                              updateFuelTankFields(tank.id, fields);
                            }}
                            placeholder="CG"
                            required
                            error={!!errors[`additionalFuelTanks[${index}].arm`]}
                            helperText={errors[`additionalFuelTanks[${index}].arm`] || 'Obligatoire — bras propre du réservoir'}
                            InputProps={{
                              endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Moment à plein"
                            type="number"
                            value={dispMoment(tank.momentAtFull)}
                            onChange={(e) => {
                              const momentCanonical = inMoment(e.target.value); // kg·m
                              const M = parseFloat(momentCanonical);
                              // ⛽ Trio réciproque sur l'UTILISABLE : M = utilisable ×
                              // densité × bras. Une saisie de moment redérive le bras
                              // (si l'utilisable est connu) ou l'UTILISABLE (si le bras
                              // est connu) — plus jamais l'ancien `capacity`.
                              const cap = tankUsableLtr(tank);                  // L ou null
                              const arm = parseFloat(tank.arm);                 // m
                              const density = getFuelDensity(data.fuelType);
                              const fields = { momentAtFull: momentCanonical };
                              if (Number.isFinite(M) && Number.isFinite(cap) && cap !== 0 && density != null && density !== 0) {
                                fields.arm = Math.round((M / (cap * density)) * 100000) / 100000; // m
                              } else if (Number.isFinite(M) && Number.isFinite(arm) && arm !== 0 && density != null && density !== 0) {
                                fields.usableCapacity = Math.round((M / (arm * density)) * 100) / 100;  // L
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
                        {(() => {
                          // Mention dérivée + garde-fou NON bloquant sous la ligne :
                          //   • « dont inutilisable » = total − utilisable (tankUnusableLtr,
                          //     jamais stocké — dérivé fail-closed si un volume manque) ;
                          //   • utilisable > total = incohérence physique signalée en rouge
                          //     mais SANS bloquer (le pilote corrige la bonne des deux).
                          const totalL = parseFloat(tank.totalCapacity);
                          const usableL = parseFloat(tank.usableCapacity);
                          const usableExceedsTotal =
                            Number.isFinite(totalL) && Number.isFinite(usableL) && usableL > totalL;
                          const unusableL = tankUnusableLtr(tank);
                          if (!usableExceedsTotal && unusableL === null) return null;
                          return (
                            <Grid size={12} sx={{ pt: '0 !important', mt: -1 }}>
                              {usableExceedsTotal ? (
                                <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }}>
                                  L'utilisable ne peut pas dépasser le volume physique
                                  ({dispTankLiters(usableL)} &gt; {dispTankLiters(totalL)} {getUnitSymbol(units.fuel)}).
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  dont inutilisable : {dispTankLiters(unusableL)} {getUnitSymbol(units.fuel)}
                                </Typography>
                              )}
                            </Grid>
                          );
                        })()}
                        {/* 🎭 La case « Réservoir optionnel (amovible) » a été retirée
                            le 24/08/2026 : l'amovibilité est un RÔLE tenu dans une
                            configuration (« Optionnel (amovible) »), pas une propriété
                            de la pièce. Elle se coche configuration par configuration. */}
                      </Grid>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* ─── (b) CONFIGURATIONS (variantes) ────────────────────────────
                🛢️ 23/08/2026 — une configuration est une SÉLECTION de
                réservoirs du catalogue, jamais un réservoir. Il y en a
                toujours AU MOINS UNE (créée automatiquement au premier
                réservoir), même s'il n'y en a qu'une : c'est elle qui donne la
                capacité de l'avion. À la préparation du vol, le pilote choisit
                la configuration — bilan carburant ET devis de masse suivent. */}
            {additionalFuelTanks.length > 0 && (
              <Box sx={{ mt: 3, width: '100%' }}>
                <Divider sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    2 · Configurations (variantes)
                  </Typography>
                </Divider>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Chaque configuration coche, parmi les réservoirs déclarés ci-dessus, ceux
                  qui sont RÉELLEMENT installés ensemble — d'où des volumétries différentes
                  (réservoirs d'ailes standard ou longue distance) et des réservoirs
                  optionnels compatibles avec certaines configurations seulement. La
                  configuration <strong>par défaut</strong> donne la capacité de l'avion ;
                  le pilote choisira la sienne à l'étape 1 de la préparation de vol.
                </Typography>

                {tankVariants.map((variant, vi) => {
                  const entries = variantEntries(variant);
                  const variantKeys = new Set(entries.map(e => e.id));
                  const roleOf = (k) => entries.find(e => e.id === k)?.role || '';
                  // Une configuration sans principal ne peut pas alimenter
                  // arms.fuelMain — sauf si elle n'a qu'un réservoir, auquel cas
                  // le moteur le résout seul (resolveTankRole).
                  // Une configuration dont AUCUN réservoir n'est inamovible n'a pas de
                  // capacité de base. (Les alias main/aux couvrent la version à 3 rôles.)
                  const sansFixe = entries.length > 1 && !entries.some(e => ["fixed", "main", "aux"].includes(e.role));
                  // Capacités de la CONFIGURATION via le moteur (fail-closed :
                  // null si un réservoir coché n'a pas la contenance — on
                  // n'affiche alors pas un « 0 L » qui ferait croire à un vide).
                  const caps = variantCapacities({ additionalFuelTanks, tankVariants }, variant.id);
                  // 🛢️ 24/08/2026 — le total annoncé ne compte QUE ce qui est
                  // toujours à bord (principal + annexe). Les réservoirs
                  // OPTIONNELS sont sortis à part : les additionner ferait
                  // annoncer une contenance que l'avion n'a pas si l'option
                  // n'est pas montée.
                  const rep = variantCapacityBreakdown({ additionalFuelTanks, tankVariants }, variant.id);
                  const notice = variantNotices[vi];
                  return (
                    <Box
                      key={variant.id}
                      sx={{
                        border: '1px solid',
                        borderColor: variant.isDefault ? 'primary.main' : 'divider',
                        borderRadius: 'var(--radius-sm)',
                        p: 2,
                        mb: 2
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <StyledTextField
                            fullWidth
                            size="small"
                            label="Nom de la configuration"
                            value={variant.name || ''}
                            onChange={(e) => updateTankVariant(vi, { name: e.target.value })}
                          />
                        </Grid>
                        <Grid size={{ xs: 8, sm: 5 }}>
                          {/* Pastille RADIO : une seule configuration par défaut
                              (une case à cocher laissait croire qu'on pouvait en
                              avoir plusieurs, ou aucune). */}
                          <FormControlLabel
                            control={
                              <Radio
                                size="small"
                                checked={!!variant.isDefault}
                                onChange={() => setDefaultTankVariant(vi)}
                              />
                            }
                            label={<Typography variant="body2">Configuration par défaut</Typography>}
                          />
                        </Grid>
                        <Grid size={{ xs: 4, sm: 2 }} sx={{ textAlign: 'right' }}>
                          <Button
                            size="small"
                            color="error"
                            disabled={tankVariants.length <= 1}
                            onClick={() => removeTankVariant(vi)}
                          >
                            Supprimer
                          </Button>
                        </Grid>
                        <Grid size={12}>
                          {additionalFuelTanks.map((tank, ti) => {
                            const key = tankKeyOf(tank, ti);
                            const tTotal = tankTotalLtr(tank);
                            const tUsable = tankUsableLtr(tank);
                            const coche = variantKeys.has(key);
                            return (
                              // ⚠️ 24/08/2026 — le thème global impose fullWidth: true à
                              // TOUT MuiTextField / MuiFormControl. Sans fullWidth={false}
                              // ci-dessous, le sélecteur de rôle prenait 942 px et se
                              // superposait au nom du réservoir et à ses contenances
                              // (signalement pilote). La largeur est donc FIXÉE, et la
                              // ligne passe en colonne sous 600 px plutôt que de comprimer.
                              <Box
                                key={key}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                  flexWrap: 'wrap',
                                  py: 0.25
                                }}
                              >
                                <FormControlLabel
                                  sx={{
                                    flex: '1 1 240px',
                                    minWidth: 0,
                                    mr: 0,
                                    // Le libellé doit pouvoir RÉTRÉCIR : sans minWidth 0 sur
                                    // lui aussi, un nom long pousse le sélecteur hors ligne.
                                    '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1 }
                                  }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={coche}
                                      onChange={(e) => toggleVariantTank(vi, key, e.target.checked)}
                                    />
                                  }
                                  label={
                                    <Typography variant="body2">
                                      {tank.name || `Réservoir ${ti + 1}`}
                                      {' — '}
                                      <Typography component="span" variant="caption" color="text.secondary">
                                        {tTotal == null ? 'total non renseigné' : `${dispTankLiters(tTotal)} ${getUnitSymbol(units.fuel)} total`}
                                        {' · '}
                                        {tUsable == null ? 'utilisable non renseigné' : `${dispTankLiters(tUsable)} ${getUnitSymbol(units.fuel)} utilisables`}
                                      </Typography>
                                    </Typography>
                                  }
                                />
                                {/* 🎭 RÔLE dans CETTE configuration — le sens du réservoir
                                    dépend de l'installation, pas de la pièce. Aucun
                                    sélecteur sur un réservoir décoché : il n'y tient
                                    aucun rôle. « — » = rôle non précisé, jamais un
                                    rôle par défaut. */}
                                {coche && (
                                  <StyledTextField
                                    select
                                    size="small"
                                    label="Rôle"
                                    fullWidth={false}
                                    value={roleOf(key)}
                                    onChange={(e) => setVariantTankRole(vi, key, e.target.value)}
                                    sx={{ width: 200, flex: '0 0 200px' }}
                                  >
                                    <MenuItem value="">—</MenuItem>
                                    {TANK_ROLES.map(r => (
                                      <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                                    ))}
                                  </StyledTextField>
                                )}
                              </Box>
                            );
                          })}
                          <Typography variant="body2" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                            Capacité de cette configuration :{' '}
                            {rep.base.totalLtr == null ? '—' : `${dispTankLiters(rep.base.totalLtr)} ${getUnitSymbol(units.fuel)} total`}
                            {' · '}
                            {rep.base.usableLtr == null ? '—' : `${dispTankLiters(rep.base.usableLtr)} ${getUnitSymbol(units.fuel)} utilisables`}
                            {rep.options.count > 0 && (
                              <Typography component="span" variant="caption" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                                {' '}({rep.options.count} option{rep.options.count > 1 ? 's' : ''} de réservoir
                                {rep.options.usableLtr == null
                                  ? ' disponible' + (rep.options.count > 1 ? 's' : '')
                                  : ` : +${dispTankLiters(rep.options.usableLtr)} ${getUnitSymbol(units.fuel)} utilisables`})
                              </Typography>
                            )}
                          </Typography>
                          {(caps.totalLtr == null || caps.usableLtr == null) && (
                            <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                              Contenance manquante sur un réservoir coché : rien n'est sommé
                              partiellement (aucune valeur fabriquée).
                            </Typography>
                          )}
                          {/* Avertissement NON bloquant : sans réservoir principal,
                              les champs de compatibilité arms.fuelMain et
                              moments.fuelMain ne sont pas alimentés. Une
                              configuration à UN seul réservoir est exemptée : le
                              moteur sait qu'il est forcément le principal. */}
                          {sansFixe && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
                              Aucun réservoir inamovible dans cette configuration : sa
                              capacité de base reste vide, et le bras du carburant ne sera
                              sur la fiche.
                            </Typography>
                          )}
                          {notice && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'error.main' }}>
                              {notice}
                            </Typography>
                          )}
                        </Grid>
                      </Grid>
                    </Box>
                  );
                })}

                <Button size="small" variant="outlined" onClick={addTankVariant}>
                  + Ajouter une configuration
                </Button>
              </Box>
            )}

            {/* ─── Récap : capacité par CONFIGURATION ───
                🛢️ 23/08/2026 — l'ancien récapitulatif comparait la capacité
                racine à la SOMME DU CATALOGUE et criait à l'écart : sur un
                avion à réservoirs exclusifs, cet écart est NORMAL et la somme
                du catalogue n'existe sur aucun avion (F-GOFP : 235 L). Il est
                remplacé par la lecture qui a un sens : ce que porte chaque
                configuration, celle par défaut en tête. */}
            {additionalFuelTanks.length > 0 && tankVariants.length > 0 && (() => {
              const rows = tankVariants.map((v) => ({
                name: v.name || 'Configuration',
                isDefault: !!v.isDefault,
                caps: variantCapacities({ additionalFuelTanks, tankVariants }, v.id)
              }));
              const incomplete = rows.some(r => r.caps.totalLtr == null || r.caps.usableLtr == null);
              const fmt = (v) => (v == null ? '—' : `${dispTankLiters(v)} ${getUnitSymbol(units.fuel)}`);
              return (
                <Box sx={{ width: '100%', maxWidth: 700, mt: 2 }}>
                  <Alert severity={incomplete ? 'warning' : 'success'} icon={incomplete ? <WarningIcon /> : false}>
                    <Typography variant="body2" fontWeight={600}>
                      Capacités par configuration
                    </Typography>
                    <Box sx={{ mt: 1, fontFamily: 'monospace', fontSize: 13 }}>
                      {rows.map((r, i) => (
                        <div key={i}>
                          {r.name}{r.isDefault ? ' (par défaut)' : ''} :{' '}
                          <strong>{fmt(r.caps.totalLtr)} total</strong>
                          {' · '}
                          <strong>{fmt(r.caps.usableLtr)} utilisables</strong>
                        </div>
                      ))}
                      <Divider sx={{ my: 0.5 }} />
                      <div>
                        <strong>Capacité de l'avion (configuration par défaut) :</strong>{' '}
                        <strong>{fmt(derivedCapacities.totalLtr)} total</strong>
                        {' · '}
                        <strong>{fmt(derivedCapacities.usableLtr)} utilisables</strong>
                      </div>
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
            Sièges (masse max · bras · moment)
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

              {/* ─── Sièges avant — trio Masse max × Bras = Moment max (comme bagages) ─── */}
              <Box sx={{ width: '100%', maxWidth: 700 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Sièges avant (Pilote + Copilote)
                </Typography>
                {renderSeatTrio(
                  {
                    maxWeight: data.seatLimits?.frontSeats?.maxWeight,
                    arm: data.arms?.frontSeats,
                    momentMax: data.seatLimits?.frontSeats?.momentMax
                  },
                  applySeatRowFields('frontSeats'),
                  {
                    armError: errors['arms.frontSeats'],
                    armHelper: 'Position du siège. Moment au chargement = bras × masse occupant'
                  }
                )}
              </Box>

              <Divider sx={{ width: '100%', maxWidth: 700 }} />

              {/* ─── Sièges arrière — SUPPRIMABLES (19/08/2026, biplaces).
                    La rangée n'est plus inconditionnelle : le bouton poubelle
                    efface les bras (jamais 0) et masque la rangée ; « + Ajouter
                    des sièges arrière » la fait revenir, vide. ─── */}
              {showRearSeats ? (
                <Box sx={{ width: '100%', maxWidth: 700 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Sièges arrière (Rangée 2){' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        — optionnel
                      </Typography>
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon fontSize="small" />}
                      onClick={removeRearSeats}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      Cet avion n'a pas de sièges arrière
                    </Button>
                  </Box>
                  {renderSeatTrio(
                    {
                      maxWeight: data.seatLimits?.rearSeats?.maxWeight,
                      arm: data.arms?.rearSeats,
                      momentMax: data.seatLimits?.rearSeats?.momentMax
                    },
                    applySeatRowFields('rearSeats'),
                    {
                      armError: errors['arms.rearSeats'],
                      armHelper: 'Position du siège. Moment au chargement = bras × masse passager'
                    }
                  )}
                </Box>
              ) : (
                <Box sx={{ width: '100%', maxWidth: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Pas de sièges arrière sur cet avion.
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => setShowRearSeats(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Ajouter des sièges arrière
                  </Button>
                </Box>
              )}

              {/* ─── Sièges supplémentaires — même trio par siège ─── */}
              {additionalSeats.map((seat) => (
                <React.Fragment key={seat.id}>
                  <Divider sx={{ width: '100%', maxWidth: 700 }} />
                  <Box sx={{ width: '100%', maxWidth: 700 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                      <StyledTextField
                        fullWidth
                        size="small"
                        label="Nom du siège"
                        value={seat.name || ''}
                        onChange={(e) => updateSeat(seat.id, 'name', e.target.value)}
                        placeholder="Siège additionnel"
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
                    {renderSeatTrio(
                      { maxWeight: seat.maxWeight, arm: seat.arm, momentMax: seat.momentMax },
                      (fields) => updateSeatFields(seat.id, fields),
                      { armHelper: 'Station du siège' }
                    )}
                  </Box>
                </React.Fragment>
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
                          value={dispWeight(compartment.maxWeight)}
                          onChange={(e) => {
                            const massCanonical = inWeight(e.target.value); // kg
                            const m = parseFloat(massCanonical);
                            const a = parseFloat(compartment.arm);          // m
                            const fields = { maxWeight: massCanonical };
                            if (Number.isFinite(m) && Number.isFinite(a)) {
                              fields.momentMax = Math.round(m * a * 100) / 100; // kg·m
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
                          value={dispArm(compartment.arm)}
                          onChange={(e) => {
                            const armCanonical = inArm(e.target.value);     // m
                            const m = parseFloat(compartment.maxWeight);    // kg
                            const a = parseFloat(armCanonical);
                            const fields = { arm: armCanonical };
                            if (Number.isFinite(m) && Number.isFinite(a)) {
                              fields.momentMax = Math.round(m * a * 100) / 100; // kg·m
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
                          value={dispMoment(compartment.momentMax)}
                          onChange={(e) => {
                            const momentCanonical = inMoment(e.target.value); // kg·m
                            const M = parseFloat(momentCanonical);
                            const m = parseFloat(compartment.maxWeight);      // kg
                            const a = parseFloat(compartment.arm);            // m
                            const fields = { momentMax: momentCanonical };
                            if (Number.isFinite(M) && Number.isFinite(m) && m !== 0) {
                              fields.arm = Math.round((M / m) * 100000) / 100000;   // m
                            } else if (Number.isFinite(M) && Number.isFinite(a) && a !== 0) {
                              fields.maxWeight = Math.round((M / a) * 100) / 100;   // kg
                            }
                            updateBaggageCompartmentFields(compartment.id, fields);
                          }}
                          placeholder="Auto (masse × bras)"
                          helperText={(() => {
                            // Cohérence en CANONIQUE (kg·m), affichage en unité user
                            const m = parseFloat(compartment.maxWeight);
                            const a = parseFloat(compartment.arm);
                            const M = parseFloat(compartment.momentMax);
                            if (Number.isFinite(m) && Number.isFinite(a) && Number.isFinite(M)) {
                              const computed = m * a;
                              return Math.abs(computed - M) < 0.5 ? '✓' : `⚠ ≠ ${dispMoment(computed)}`;
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
                  value={dispWeight(data.weights?.emptyWeight)}
                  onChange={(e) => {
                    updateData('weights.emptyWeight', inWeight(e.target.value));
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
                  value={dispArm(data.arms?.empty)}
                  onChange={(e) => {
                    updateData('arms.empty', inArm(e.target.value));
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
                  value={dispMoment(data.moments?.empty)}
                  onChange={(e) => {
                    updateData('moments.empty', inMoment(e.target.value));
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
                      💡 Récupère l'information dans le rapport de masse et centrage joint au manuel de vol.
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
                  // Calculs en CANONIQUE (kg, m, kg·m), affichage en unité user
                  let missing = '';
                  if (!hasE) missing = `masse ≈ ${dispWeight(m / a)} ${getUnitSymbol(units.weight)}`;
                  else if (!hasA) missing = `bras ≈ ${dispArm(m / e)} ${getUnitSymbol(units.armLength)}`;
                  else if (!hasM) missing = `moment ≈ ${dispMoment(e * a)} ${getUnitSymbol(units.weight)}·${getUnitSymbol(units.armLength)}`;
                  return (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                      ✓ Calcul automatique en cours : {missing}
                    </Typography>
                  );
                }
                // count === 3 : vérifier la cohérence (en canonique)
                const computedMoment = e * a;
                const diff = Math.abs(m - computedMoment);
                const tolerance = Math.max(0.5, computedMoment * 0.01); // 1% ou 0.5 kg·m
                if (diff < tolerance) {
                  return (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                      ✓ Cohérent : {dispWeight(e)} × {dispArm(a)} = {dispMoment(computedMoment)} ≈ moment saisi
                    </Typography>
                  );
                }
                return (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                    ⚠ Incohérence : masse × bras = {dispMoment(computedMoment)} (écart {dispMoment(diff)}). Vérifie tes valeurs.
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
                value={dispWeight(data.weights?.mtow)}
                onChange={(e) => updateData('weights.mtow', inWeight(e.target.value))}
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
                value={dispWeight(data.weights?.mlw)}
                onChange={(e) => updateData('weights.mlw', inWeight(e.target.value))}
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
                value={dispWeight(data.weights?.minTakeoffWeight)}
                onChange={(e) => updateData('weights.minTakeoffWeight', inWeight(e.target.value))}
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
                    label="Longueur corde MAC"
                    value={dispArm(macLength)}
                    onChange={(e) => {
                      const c = inArm(e.target.value); // canonique m
                      setMacLength(c);
                      updateData('cgEnvelope.macLength', c === '' ? null : c);
                    }}
                    helperText="Mean Aerodynamic Chord (manuel de vol)"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StyledTextField
                    fullWidth
                    size="small"
                    type="number"
                    label="LEMAC — bord d'attaque MAC"
                    value={dispArm(lemac)}
                    onChange={(e) => {
                      const c = inArm(e.target.value); // canonique m
                      setLemac(c);
                      updateData('cgEnvelope.lemac', c === '' ? null : c);
                    }}
                    helperText="Station du bord d'attaque (même repère que les bras)"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{getUnitSymbol(units.armLength)}</InputAdornment>,
                    }}
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
                            value={dispWeight(point.weight)}
                            onChange={(e) => {
                              const wCanonical = inWeight(e.target.value); // kg
                              const w = parseFloat(wCanonical);
                              const cg = parseFloat(point.cg);             // m
                              const fields = { weight: wCanonical };
                              if (Number.isFinite(w) && Number.isFinite(cg)) {
                                fields.moment = Math.round(w * cg * 100) / 100; // kg·m
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
                            value={dispArm(point.cg)}
                            onChange={(e) => {
                              const cgCanonical = inArm(e.target.value);   // m
                              const w = parseFloat(point.weight);          // kg
                              const cg = parseFloat(cgCanonical);
                              const fields = { cg: cgCanonical };
                              if (Number.isFinite(w) && Number.isFinite(cg)) {
                                fields.moment = Math.round(w * cg * 100) / 100; // kg·m
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
                            value={dispMoment(point.moment)}
                            onChange={(e) => {
                              const momentCanonical = inMoment(e.target.value); // kg·m
                              const M = parseFloat(momentCanonical);
                              const w = parseFloat(point.weight);               // kg
                              const cg = parseFloat(point.cg);                  // m
                              const fields = { moment: momentCanonical };
                              if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                                fields.cg = Math.round((M / w) * 100000) / 100000;  // m
                              } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                                fields.weight = Math.round((M / cg) * 100) / 100;   // kg
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
                        value={dispWeight(aftCG.minWeight)}
                        onChange={(e) => {
                          const wCanonical = inWeight(e.target.value); // kg
                          const w = parseFloat(wCanonical);
                          const cg = parseFloat(aftCG.minCG);          // m
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100           // kg·m
                            : aftCG.minMoment;
                          setAftCG(prev => ({ ...prev, minWeight: wCanonical, minMoment: newMoment }));
                        }}
                        placeholder={String(dispWeight(data.weights?.minTakeoffWeight) || '940')}
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
                        value={dispArm(aftCG.minCG)}
                        onChange={(e) => {
                          const cgCanonical = inArm(e.target.value);   // m
                          const w = parseFloat(aftCG.minWeight);       // kg
                          const cg = parseFloat(cgCanonical);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100           // kg·m
                            : aftCG.minMoment;
                          setAftCG(prev => ({ ...prev, minCG: cgCanonical, minMoment: newMoment }));
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
                        value={dispMoment(aftCG.minMoment)}
                        onChange={(e) => {
                          const momentCanonical = inMoment(e.target.value); // kg·m
                          const M = parseFloat(momentCanonical);
                          const w = parseFloat(aftCG.minWeight);            // kg
                          const cg = parseFloat(aftCG.minCG);               // m
                          // Saisir moment → déduit cg si masse, sinon masse si cg
                          if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              minMoment: momentCanonical,
                              minCG: Math.round((M / w) * 100000) / 100000   // m
                            }));
                          } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              minMoment: momentCanonical,
                              minWeight: Math.round((M / cg) * 100) / 100    // kg
                            }));
                          } else {
                            setAftCG(prev => ({ ...prev, minMoment: momentCanonical }));
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
                        value={dispWeight(aftCG.maxWeight)}
                        onChange={(e) => {
                          const wCanonical = inWeight(e.target.value); // kg
                          const w = parseFloat(wCanonical);
                          const cg = parseFloat(aftCG.maxCG);          // m
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100           // kg·m
                            : aftCG.maxMoment;
                          setAftCG(prev => ({ ...prev, maxWeight: wCanonical, maxMoment: newMoment }));
                        }}
                        placeholder={String(dispWeight(data.weights?.mtow) || '1310')}
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
                        value={dispArm(aftCG.maxCG)}
                        onChange={(e) => {
                          const cgCanonical = inArm(e.target.value);   // m
                          const w = parseFloat(aftCG.maxWeight);       // kg
                          const cg = parseFloat(cgCanonical);
                          const newMoment = (Number.isFinite(w) && Number.isFinite(cg))
                            ? Math.round(w * cg * 100) / 100           // kg·m
                            : aftCG.maxMoment;
                          setAftCG(prev => ({ ...prev, maxCG: cgCanonical, maxMoment: newMoment }));
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
                        value={dispMoment(aftCG.maxMoment)}
                        onChange={(e) => {
                          const momentCanonical = inMoment(e.target.value); // kg·m
                          const M = parseFloat(momentCanonical);
                          const w = parseFloat(aftCG.maxWeight);            // kg
                          const cg = parseFloat(aftCG.maxCG);               // m
                          if (Number.isFinite(M) && Number.isFinite(w) && w !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              maxMoment: momentCanonical,
                              maxCG: Math.round((M / w) * 100000) / 100000   // m
                            }));
                          } else if (Number.isFinite(M) && Number.isFinite(cg) && cg !== 0) {
                            setAftCG(prev => ({
                              ...prev,
                              maxMoment: momentCanonical,
                              maxWeight: Math.round((M / cg) * 100) / 100    // kg
                            }));
                          } else {
                            setAftCG(prev => ({ ...prev, maxMoment: momentCanonical }));
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
          // Données canoniques (kg, m) converties en unité user POUR L'AFFICHAGE
          forwardPoints: forwardCGPoints.map((p) => ({
            ...p,
            weight: dispWeight(p.weight),
            cg: dispArm(p.cg)
          })),
          aftMinWeight: dispWeight(data.cgEnvelope?.aftMinWeight || aftCG.minWeight),
          aftMaxWeight: dispWeight(data.cgEnvelope?.aftMaxWeight || aftCG.maxWeight),
          aftMinCG: dispArm(data.cgEnvelope?.aftMinCG || aftCG.minCG),
          aftMaxCG: dispArm(data.cgEnvelope?.aftMaxCG || aftCG.maxCG)
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
                      // R20/B — préfère l'URL Storage (pdfUrl) au base64 inline.
                      const src = data.weighingReport?.pdfUrl || data.weighingReport?.pdfData;
                      if (src) {
                        const w = window.open();
                        if (w) {
                          w.document.write(
                            `<iframe src="${src}" style="width:100%;height:100vh;border:none;" title="Rapport de pesée"></iframe>`
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
                      // Upload IMMÉDIAT vers Supabase (motif MANEX) : la fiche suit
                      // l'avion partout, sans attendre une sauvegarde communautaire.
                      // Non bloquant / non destructif — si l'upload échoue (réseau,
                      // session non authentifiée), on garde le base64 en local.
                      let pdfUrl = null;
                      try {
                        pdfUrl = await uploadWeighingReportPdf(data.registration, base64);
                      } catch (upErr) {
                        console.warn('[Step3] Upload Supabase rapport de pesée échoué (conservé en local):', upErr?.message);
                      }
                      updateData('weighingReport', {
                        fileName: file.name,
                        fileSize: file.size,
                        pdfData: base64,                 // accès local immédiat (hors ligne)
                        ...(pdfUrl ? { pdfUrl } : {}),   // URL Supabase → suit l'avion (si upload OK)
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

          {/* ─── Date de la pesée (certification) — OBLIGATOIRE ──────────────
              Date portée sur le rapport (≠ date d'import). Elle alimente
              l'indicateur d'ancienneté en préparation de vol : au-delà de
              10 ans, rappel CdB de vérifier qu'une pesée plus récente
              n'existe pas. Le champ n'apparaît qu'une fois le PDF joint
              (ordre logique : document d'abord, puis sa date) ; le wizard
              bloque l'étape tant qu'elle n'est pas renseignée. Remplacer le
              PDF efface la date : un nouveau rapport = une nouvelle date. */}
          {data.weighingReport?.hasData && (() => {
            const age = getWeighingReportAge(data.weighingReport?.certificationDate);
            return (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                <StyledTextField
                  label="Date de la pesée (certification)"
                  type="date"
                  required
                  size="small"
                  value={data.weighingReport?.certificationDate || ''}
                  onChange={(e) => updateData('weighingReport.certificationDate', e.target.value)}
                  error={!!errors?.weighingReportDate}
                  helperText={errors?.weighingReportDate || 'Date portée sur le rapport de pesée'}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 220 }}
                />
                {age && (
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 1,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: age.isOld ? 'warning.main' : 'divider',
                      color: age.isOld ? 'warning.main' : 'text.secondary',
                      fontWeight: age.isOld ? 600 : 400
                    }}
                  >
                    {age.isOld
                      ? `⚠ Pesée d'il y a ${age.ageLabel} (> ${WEIGHING_REPORT_WARN_YEARS} ans) — vérifiez qu'un rapport plus récent n'existe pas.`
                      : `Pesée d'il y a ${age.ageLabel}.`}
                  </Typography>
                )}
              </Box>
            );
          })()}
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