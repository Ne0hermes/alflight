import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  InputAdornment,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Air as WindIcon,
  ExpandMore as ExpandMoreIcon,
  PriorityHigh as CriticalIcon,
  CheckCircle as OptionalIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { unitsSelectors } from '@core/stores/unitsStore';
import { getUnitSymbol } from '@utils/unitConversions';
import { StyledTextField } from './FormFieldStyles';

const Step2Speeds = ({ data, updateData, errors = {}, onNext, onPrevious }) => {
  const units = unitsSelectors.useUnits();
  const unit = units.speed; // Utiliser l'unité de vitesse depuis le store
  const [expandedPanels, setExpandedPanels] = useState({
    cruise: true,   // Accordion vitesse de croisière (auto-ouvert au chargement)
    flapsOut: false,
    clean: false,
    vne: false,
    vo: false,
    optional: false,
    wind: false
  });

  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        cruise: false,
        flapsOut: false,
        clean: false,
        vne: false,
        vo: false,
        optional: false,
        wind: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // ─── Vitesse de croisière + Base Factor (déplacés depuis Step1) ────────
  // Le baseFactor (60 / cruiseSpeedKt) est utilisé par les calculs de navigation.
  // Il est auto-calculé à chaque saisie et au montage si la vitesse existe déjà.
  const calculateBaseFactor = (cruiseSpeed) => {
    if (cruiseSpeed && parseFloat(cruiseSpeed) > 0) {
      return (60 / parseFloat(cruiseSpeed)).toFixed(3);
    }
    return '';
  };

  const handleCruiseSpeedChange = (value) => {
    updateData('cruiseSpeedKt', value);
    const factor = calculateBaseFactor(value);
    if (factor) {
      updateData('baseFactor', factor);
    }
  };

  useEffect(() => {
    if (data.cruiseSpeedKt && !data.baseFactor) {
      const factor = calculateBaseFactor(data.cruiseSpeedKt);
      if (factor) {
        updateData('baseFactor', factor);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // au montage uniquement

  // Initialiser les plages VO si elles n'existent pas
  const [voRanges, setVoRanges] = useState(data.speeds?.voRanges || [
    { minWeight: '', maxWeight: '', speed: '', saved: false }
  ]);
  const [voTempRanges, setVoTempRanges] = useState(voRanges.map(r => ({ ...r })));

  // 🔧 FIX: Synchroniser voRanges avec data.speeds?.voRanges quand les données changent
  useEffect(() => {
    const newVoRanges = data.speeds?.voRanges || [
      { minWeight: '', maxWeight: '', speed: '', saved: false }
    ];
    // Comparer le contenu réel (pas juste la référence)
    const currentSerialized = JSON.stringify(voRanges);
    const newSerialized = JSON.stringify(newVoRanges);

    if (currentSerialized !== newSerialized) {
      setVoRanges(newVoRanges);
      setVoTempRanges(newVoRanges.map(r => ({ ...r })));
      console.log('🔄 [Step2Speeds] VO ranges synchronized:', {
        old: voRanges,
        new: newVoRanges
      });
    }
  }, [JSON.stringify(data.speeds?.voRanges)]);

  // 🆕 État pour les limitations de vent dynamiques
  const [windLimits, setWindLimits] = useState(data.windLimits?.limits || []);
  const [windTempLimits, setWindTempLimits] = useState(windLimits.map(l => ({ ...l })));

  // Types de limitations de vent disponibles
  const windLimitTypes = [
    { value: 'maxCrosswind', label: 'Vent de travers max' },
    { value: 'maxTailwind', label: 'Vent arrière max' },
    { value: 'maxCrosswindWet', label: 'Vent travers piste mouillée' },
    { value: 'maxCrosswindIce', label: 'Vent travers piste contaminée' },
    { value: 'maxHeadwind', label: 'Vent de face max' },
    { value: 'maxGustDifferential', label: 'Différentiel de rafale max' },
    { value: 'maxDemonstrated', label: 'Vent de travers démontré' }
  ];

  // Synchroniser windLimits avec data
  useEffect(() => {
    const newLimits = data.windLimits?.limits || [];
    const currentSerialized = JSON.stringify(windLimits);
    const newSerialized = JSON.stringify(newLimits);

    if (currentSerialized !== newSerialized) {
      setWindLimits(newLimits);
      setWindTempLimits(newLimits.map(l => ({ ...l })));
      console.log('🔄 [Step2Speeds] Wind limits synchronized:', newLimits);
    }
  }, [JSON.stringify(data.windLimits?.limits)]);

  const addWindLimit = () => {
    const newLimit = { type: 'maxCrosswind', value: '', saved: false };
    const newLimits = [...windLimits, newLimit];
    setWindLimits(newLimits);
    setWindTempLimits([...windTempLimits, { ...newLimit }]);
  };

  const removeWindLimit = (index) => {
    const newLimits = windLimits.filter((_, i) => i !== index);
    setWindLimits(newLimits);
    setWindTempLimits(windTempLimits.filter((_, i) => i !== index));
    updateData('windLimits.limits', newLimits);
  };

  const updateWindLimitTemp = (index, field, value) => {
    // Persistance dynamique (plus de bouton « Sauvegarder » par ligne).
    const newLimits = windTempLimits.map((l, i) =>
      i === index ? { ...l, [field]: value, saved: true } : l
    );
    setWindTempLimits(newLimits);
    setWindLimits(newLimits);
    updateData('windLimits.limits', newLimits);
  };

  const saveWindLimit = (index) => {
    const tempLimit = windTempLimits[index];
    const newLimits = [...windLimits];
    newLimits[index] = {
      type: tempLimit.type,
      value: tempLimit.value,
      saved: true
    };
    setWindLimits(newLimits);

    const newTempLimits = [...windTempLimits];
    newTempLimits[index] = { ...newLimits[index] };
    setWindTempLimits(newTempLimits);

    updateData('windLimits.limits', newLimits);
  };

  const addVoRange = () => {
    const newRange = { minWeight: '', maxWeight: '', speed: '', saved: false };
    const newRanges = [...voRanges, newRange];
    setVoRanges(newRanges);
    setVoTempRanges([...voTempRanges, { ...newRange }]);
  };

  const removeVoRange = (index) => {
    const newRanges = voRanges.filter((_, i) => i !== index);
    setVoRanges(newRanges);
    setVoTempRanges(voTempRanges.filter((_, i) => i !== index));
    updateData('speeds.voRanges', newRanges);
  };

  const updateVoRangeTemp = (index, field, value) => {
    // Persistance dynamique : plus de bouton « Sauvegarder » par ligne — chaque
    // modification est écrite directement dans les données de l'avion (la
    // sauvegarde globale se fait en fin de création du wizard).
    const newRanges = voTempRanges.map((r, i) =>
      i === index ? { ...r, [field]: value, saved: true } : r
    );
    setVoTempRanges(newRanges);
    setVoRanges(newRanges);
    updateData('speeds.voRanges', newRanges);
  };

  const saveVoRange = (index) => {
    const tempRange = voTempRanges[index];

    // Auto-complétion des masses depuis data.weights
    let finalMinWeight = tempRange.minWeight;
    let finalMaxWeight = tempRange.maxWeight;

    // Si masse min vide mais max remplie, utiliser emptyWeight
    if ((!finalMinWeight || finalMinWeight === '') && finalMaxWeight && data.weights?.emptyWeight) {
      finalMinWeight = data.weights.emptyWeight;
    }

    // Si masse max vide mais min remplie, utiliser mtow
    if ((!finalMaxWeight || finalMaxWeight === '') && finalMinWeight && data.weights?.mtow) {
      finalMaxWeight = data.weights.mtow;
    }

    const newRanges = [...voRanges];
    newRanges[index] = {
      minWeight: finalMinWeight,
      maxWeight: finalMaxWeight,
      speed: tempRange.speed,
      saved: true
    };
    setVoRanges(newRanges);

    // Mettre à jour aussi voTempRanges avec les valeurs auto-complétées
    const newTempRanges = [...voTempRanges];
    newTempRanges[index] = { ...newRanges[index] };
    setVoTempRanges(newTempRanges);

    updateData('speeds.voRanges', newRanges);
  };

  // Vitesses critiques (obligatoires) - incluant VO
  const criticalSpeeds = {
    vso: {
      name: "VSO",
      label: "Vitesse de décrochage volets sortis",
      description: "",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vfeLdg: {
      name: "VFE LDG",
      label: "Vitesse max volets atterrissage",
      description: "",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vfeTO: {
      name: "VFE T/O",
      label: "Vitesse max volets décollage",
      description: "",
      color: "#ffffff",
      category: "critical",
      required: true
    },
    vs1: {
      name: "VS1",
      label: "Vitesse de décrochage lisse",
      description: "",
      color: "#28a745",
      category: "critical",
      required: true
    },
    vno: {
      name: "VNO",
      label: "Vitesse maximale de croisière",
      description: "",
      color: "var(--accent-primary)",
      category: "critical",
      required: true
    },
    vne: {
      name: "VNE",
      label: "Vitesse à ne jamais dépasser",
      description: "",
      color: "var(--color-red-critical)",
      category: "critical",
      required: true
    }
  };

  // Vitesses facultatives (avec VA)
  const optionalSpeeds = {
    va: {
      name: "VA",
      label: "VA - Vitesse de manœuvre",
      description: "",
      color: "#9c27b0",
      category: "optional",
      required: false
    },
    vr: {
      name: "VR",
      label: "VR - Vitesse de rotation",
      description: "Vitesse à laquelle le pilote tire sur le manche pour décoller",
      color: "#17a2b8",
      category: "optional",
      required: false
    },
    vx: {
      name: "VX",
      label: "VX - Vitesse de meilleur angle de montée",
      description: "Vitesse pour la pente de montée maximale",
      color: "#6610f2",
      category: "optional",
      required: false
    },
    vy: {
      name: "VY",
      label: "VY - Vitesse de meilleur taux de montée",
      description: "Vitesse pour le taux de montée maximal",
      color: "#e83e8c",
      category: "optional",
      required: false
    },
    initialClimb: {
      name: "V Montée initiale",
      label: "V Montée initiale - Vitesse de montée initiale",
      description: "Vitesse recommandée pour la montée initiale après décollage",
      color: "#795548",
      category: "optional",
      required: false
    },
    vglide: {
      name: "V Glide",
      label: "V Glide - Vitesse de plané optimal",
      description: "Vitesse pour la meilleure finesse",
      color: "#007bff",
      category: "optional",
      required: false
    },
    vle: {
      name: "VLE",
      label: "VLE - Vitesse max train sorti",
      description: "Vitesse maximale avec train d'atterrissage sorti",
      color: "#fd7e14",
      category: "optional",
      required: false
    },
    vlo: {
      name: "VLO",
      label: "VLO - Vitesse max manœuvre train",
      description: "Vitesse maximale pour sortir/rentrer le train",
      color: "#20c997",
      category: "optional",
      required: false
    }
  };

  const renderSpeedInput = (key, speed) => {
    const value = data.speeds?.[key] || '';
    const isRequired = speed.required;
    const displayLabel = speed.label || `${speed.name} - ${speed.label || speed.description}`;
    
    return (
      <StyledTextField
        key={key}
        fullWidth
        variant="outlined"
        label={displayLabel}
        type="number"
        value={value}
        onChange={(e) => updateData(`speeds.${key}`, e.target.value)}
        placeholder="---"
        error={!!errors[`speeds.${key}`]}
        helperText={errors[`speeds.${key}`] || speed.description}
        required={isRequired}
        InputProps={{
          endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
        }}
        InputLabelProps={{
          shrink: true,
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'background.default',
            // height: '56px' RETIRÉ — laisse la hauteur naturelle commune
            // (= champ de référence "Modèle") pour uniformité totale.
          }
        }}
      />
    );
  };

  const renderSpeedChart = () => {
    const speeds = data.speeds || {};
    const maxSpeed = Math.max(
      parseFloat(speeds.vne) || 200,
      200
    );

    const getPosition = (speed) => {
      if (!speed) return 0;
      return (parseFloat(speed) / maxSpeed) * 100;
    };

    // Couleurs AVIATION des arcs de vitesse — EXCEPTION assumée à la charte
    // sombre : blanc / vert / jaune / rouge / violet / cyan sont les repères
    // normalisés de l'anémomètre, ils DOIVENT rester fidèles à la réalité.
    const SA = {
      white: '#E8EAED',
      whiteBorder: '#AAB2BD',
      whiteText: '#1A1D21',
      // Mêmes teintes (vert/jaune/rouge/violet/cyan) mais désaturées : plus
      // douces, moins « flash », pour mieux s'intégrer à la charte sombre.
      green: '#5BA378',
      yellow: '#D9C06A',
      yellowText: '#1A1D21',
      red: '#D17268',
      violet: '#A079B5',
      cyan: '#5FA3AE',
    };

    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 'var(--radius-sm)' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Visualisation de l'arc de vitesses
        </Typography>
        
        <Box sx={{
          position: 'relative',
          height: 120,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          overflow: 'visible',
          mb: 2
        }}>
          {/* Arc blanc - VSO à VFE LDG (en bas) */}
          {speeds.vso && speeds.vfeLdg && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vso)}%`,
                width: `${getPosition(speeds.vfeLdg) - getPosition(speeds.vso)}%`,
                height: '40%',
                bottom: 0,
                bgcolor: SA.white,
                border: '2px solid',
                borderColor: SA.whiteBorder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: SA.whiteText,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                zIndex: 1
              }}
            >
              Arc blanc
            </Box>
          )}

          {/* Arc vert - VS1 à VNO (au milieu) */}
          {speeds.vs1 && speeds.vno && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vs1)}%`,
                width: `${getPosition(speeds.vno) - getPosition(speeds.vs1)}%`,
                height: '60%',
                top: 0,
                bgcolor: SA.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                zIndex: 2
              }}
            >
              Arc vert
            </Box>
          )}

          {/* Arc jaune - VNO à VNE (au milieu, continuation du vert) */}
          {speeds.vno && speeds.vne && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vno)}%`,
                width: `${getPosition(speeds.vne) - getPosition(speeds.vno)}%`,
                height: '60%',
                top: 0,
                bgcolor: SA.yellow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: SA.yellowText,
                fontSize: '0.75rem',
                fontWeight: 'bold',
                zIndex: 2
              }}
            >
              Arc jaune
            </Box>
          )}
          
          {/* Trait rouge - VNE */}
          {speeds.vne && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vne)}%`,
                width: '3px',
                height: '60%',
                top: 0,
                bgcolor: SA.red,
                zIndex: 3
              }}
            />
          )}

          {/* Indicateurs VO dynamiques */}
          {voRanges && voRanges.map((range, index) => {
            if (!range.speed) return null;
            return (
              <React.Fragment key={`vo-${index}`}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${getPosition(range.speed)}%`,
                    width: '2px',
                    height: '40%',
                    bottom: 0,
                    bgcolor: SA.violet,
                    zIndex: 5
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${getPosition(range.speed)}%`,
                    bottom: '-25px',
                    transform: 'translateX(-50%)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: SA.violet,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'nowrap',
                    zIndex: 10
                  }}
                >
                  {range.speed}
                </Box>
              </React.Fragment>
            );
          })}

          {/* Labels de vitesse aux bornes des arcs */}
          {/* VSO - Début arc blanc */}
          {speeds.vso && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vso)}%`,
                top: '-25px',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                px: 0.75,
                py: 0.25,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              {speeds.vso}
            </Box>
          )}

          {/* VFE LDG - Fin arc blanc */}
          {speeds.vfeLdg && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vfeLdg)}%`,
                top: '-25px',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                px: 0.75,
                py: 0.25,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              {speeds.vfeLdg}
            </Box>
          )}

          {/* VS1 - Début arc vert */}
          {speeds.vs1 && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vs1)}%`,
                top: '-25px',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: SA.green,
                px: 0.75,
                py: 0.25,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              {speeds.vs1}
            </Box>
          )}

          {/* VNO - Fin arc vert / Début arc jaune */}
          {speeds.vno && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vno)}%`,
                top: '-25px',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: SA.yellow,
                px: 0.75,
                py: 0.25,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              {speeds.vno}
            </Box>
          )}

          {/* VNE - Trait rouge */}
          {speeds.vne && (
            <Box
              sx={{
                position: 'absolute',
                left: `${getPosition(speeds.vne)}%`,
                top: '-25px',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: SA.red,
                px: 0.75,
                py: 0.25,
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              {speeds.vne}
            </Box>
          )}

          {/* VFE T/O - Vitesse max volets décollage */}
          {speeds.vfeTO && speeds.vfeTO !== speeds.vfeLdg && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  left: `${getPosition(speeds.vfeTO)}%`,
                  width: '2px',
                  height: '60%',
                  top: 0,
                  bgcolor: SA.cyan,
                  zIndex: 5
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  left: `${getPosition(speeds.vfeTO)}%`,
                  top: '-25px',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: SA.cyan,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                  zIndex: 10
                }}
              >
                {speeds.vfeTO}
              </Box>
            </>
          )}

        </Box>
        
        <Grid container spacing={1}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.green, borderRadius: 0.5 }} />
              Arc vert: Plage normale d'utilisation
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.white, border: '1px solid', borderColor: SA.whiteBorder, borderRadius: 0.5 }} />
              Arc blanc: Plage volets sortis
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.yellow, borderRadius: 0.5 }} />
              Arc jaune: Précaution (air calme)
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.red, borderRadius: 0.5 }} />
              Trait rouge: Ne jamais dépasser
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.violet, borderRadius: 0.5 }} />
              Trait violet: Vitesses de manœuvre (VO)
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 16, height: 16, bgcolor: SA.cyan, borderRadius: 0.5 }} />
              Trait cyan: VFE T/O (Volets décollage)
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

      {/* 0. Vitesse de croisière + Base Factor (déplacé depuis Step1) */}
      <Accordion
        expanded={expandedPanels.cruise}
        onChange={handlePanelChange('cruise')}
        elevation={0}
        sx={{
          mb: 2,
          border: '2px solid',
          borderColor: 'primary.main',
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
          <SpeedIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Vitesse de croisière (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                size="small"
                variant="outlined"
                label="Vitesse de croisière *"
                type="number"
                value={data.cruiseSpeedKt || ''}
                onChange={(e) => handleCruiseSpeedChange(e.target.value)}
                error={!!errors.cruiseSpeedKt}
                helperText={errors.cruiseSpeedKt || "Vitesse réelle de croisière utilisée pour les calculs de navigation"}
                required
                placeholder="Ex: 110"
                InputProps={{
                  endAdornment: <InputAdornment position="end">{getUnitSymbol(unit)}</InputAdornment>,
                }}
              />
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              <StyledTextField
                fullWidth
                size="small"
                variant="outlined"
                label="Base Factor"
                type="number"
                value={data.baseFactor || ''}
                placeholder="Auto-calculé"
                helperText="60 / vitesse de croisière (auto-calculé)"
                InputProps={{
                  readOnly: true,
                }}
              />
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 1. Configuration volets sortis (obligatoire) */}
      <Accordion
        expanded={expandedPanels.flapsOut}
        onChange={handlePanelChange('flapsOut')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Configuration volets sortis (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vso', {
                name: "VSO",
                label: "VSO - Vitesse de décrochage volets atterrissage *",
                description: "Vitesse minimale de sustentation en configuration atterrissage (volets pleine sortie)",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vsTO', {
                name: "VS T/O",
                label: "VS T/O - Vitesse de décrochage volets décollage",
                description: "Vitesse minimale de sustentation en configuration décollage (volets T/O sortis). Distinct de VSO si l'avion a une position volets décollage intermédiaire.",
                color: "#ffffff",
                category: "critical",
                required: false
              })}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vfeLdg', {
                name: "VFE LDG",
                label: "VFE LDG - Vitesse max volets atterrissage *",
                description: "Vitesse maximale avec volets en configuration atterrissage",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vfeTO', {
                name: "VFE T/O",
                label: "VFE T/O - Vitesse max volets décollage *",
                description: "Vitesse maximale avec volets en configuration décollage",
                color: "#ffffff",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 2. Configuration lisse (obligatoire) */}
      <Accordion 
        expanded={expandedPanels.clean}
        onChange={handlePanelChange('clean')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Configuration lisse (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vs1', {
                name: "VS1",
                label: "VS1 - Vitesse de décrochage lisse *",
                description: "Vitesse minimale de sustentation en configuration lisse",
                color: "#28a745",
                category: "critical",
                required: true
              })}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vno', {
                name: "VNO",
                label: "VNO - Vitesse max en air calme *",
                description: "Vitesse maximale pour opérations normales",
                color: "var(--accent-primary)",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 3. VNE (obligatoire) */}
      <Accordion 
        expanded={expandedPanels.vne}
        onChange={handlePanelChange('vne')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            VNE (obligatoire)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vne', {
                name: "VNE",
                label: "VNE - Vitesse à ne jamais dépasser *",
                description: "Vitesse maximale absolue de l'avion",
                color: "var(--color-red-critical)",
                category: "critical",
                required: true
              })}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 4. VO - Vitesses de manœuvre */}
      <Accordion 
        expanded={expandedPanels.vo}
        onChange={handlePanelChange('vo')}
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
          <CriticalIcon color="error" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            VO - Vitesses de manœuvre
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>

            <Grid container spacing={2} justifyContent="center">
              {voTempRanges.map((range, index) => (
                <Grid size={12} key={index} sx={{ maxWidth: 800 }}>
                  <Box sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'flex-end',
                  }}>
                    <Chip
                      label={`VO${index + 1}`}
                      sx={{
                        bgcolor: 'purple',
                        color: 'var(--text-primary)',
                        fontWeight: 'bold',
                        minWidth: '50px'
                      }}
                    />

                    <Grid container spacing={1.5} sx={{ flex: 1 }}>
                      <Grid size={{ xs: 12, sm: 4, md: 4 }}>
                        <StyledTextField
                          fullWidth
                          label="Masse min"
                          type="number"
                          value={range.minWeight || ''}
                          onChange={(e) => updateVoRangeTemp(index, 'minWeight', e.target.value)}
                          placeholder={index === 0 ? "0" : "900"}
                          variant="outlined"
                          size="small"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>

                      <Grid size={{ xs: 12, sm: 4, md: 4 }}>
                        <StyledTextField
                          fullWidth
                          label="Masse max *"
                          type="number"
                          value={range.maxWeight || ''}
                          onChange={(e) => updateVoRangeTemp(index, 'maxWeight', e.target.value)}
                          placeholder="1150"
                          variant="outlined"
                          size="small"
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.weight)}</InputAdornment>,
                          }}
                        />
                      </Grid>

                      <Grid size={{ xs: 12, sm: 4, md: 4 }}>
                        <StyledTextField
                          fullWidth
                          label="Vitesse VO *"
                          type="number"
                          value={range.speed || ''}
                          onChange={(e) => updateVoRangeTemp(index, 'speed', e.target.value)}
                          placeholder="95"
                          variant="outlined"
                          size="small"
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                          }}
                        />
                      </Grid>

                    </Grid>

                    <IconButton
                      onClick={() => removeVoRange(index)}
                      disabled={voRanges.length === 1}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addVoRange}
                size="small"
              >
                Ajouter une plage
              </Button>
            </Box>
            
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 5. Autres vitesses (facultatif) */}
      <Accordion 
        expanded={expandedPanels.optional}
        onChange={handlePanelChange('optional')}
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
          <OptionalIcon color="success" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Autres vitesses (facultatif)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vr', optionalSpeeds.vr)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vx', optionalSpeeds.vx)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vy', optionalSpeeds.vy)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vapp', {
                name: "VApp",
                label: "VApp - Vitesse d'approche",
                description: "Vitesse de référence en approche finale",
                color: "#17a2b8",
                category: "optional",
                required: false
              })}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('initialClimb', optionalSpeeds.initialClimb)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vglide', optionalSpeeds.vglide)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vle', optionalSpeeds.vle)}
            </Grid>
            <Grid size={12} sx={{ width: '100%', maxWidth: 350, mx: 'auto' }}>
              {renderSpeedInput('vlo', optionalSpeeds.vlo)}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* 6. Limitations de vent */}
      <Accordion
        expanded={expandedPanels.wind}
        onChange={handlePanelChange('wind')}
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
          <WindIcon color="warning" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Limitations de vent
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1.5 }}>
            <Grid container spacing={2} justifyContent="center">
              {windTempLimits.map((limit, index) => (
                <Grid size={12} key={index} sx={{ maxWidth: 800 }}>
                  <Box sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'flex-end',
                  }}>
                    <Grid container spacing={1.5} sx={{ flex: 1 }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Type de limitation *</InputLabel>
                          <Select
                            value={limit.type || 'maxCrosswind'}
                            onChange={(e) => updateWindLimitTemp(index, 'type', e.target.value)}
                            label="Type de limitation *"
                          >
                            {windLimitTypes.map(type => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 4 }}>
                        <StyledTextField
                          fullWidth
                          label="Valeur *"
                          type="number"
                          value={limit.value || ''}
                          onChange={(e) => updateWindLimitTemp(index, 'value', e.target.value)}
                          placeholder="Ex: 17"
                          variant="outlined"
                          size="small"
                          required
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{getUnitSymbol(units.speed)}</InputAdornment>,
                          }}
                        />
                      </Grid>

                    </Grid>

                    <IconButton
                      onClick={() => removeWindLimit(index)}
                      disabled={windLimits.length === 0}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addWindLimit}
                size="small"
              >
                Ajouter une limitation
              </Button>
            </Box>

          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Visualisation graphique */}
      {renderSpeedChart()}

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

export default Step2Speeds;