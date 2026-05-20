// src/features/aircraft/components/CentrogramReader.jsx
//
// Wizard de lecture graphique d'un centrogramme MANEX pour déterminer les
// bras de levier (front seats, rear seats, fuel, baggage, ...) par clic.
//
// REFONTE V2 : réutilise EXACTEMENT le système Chart.tsx de l'AbacBuilder
// (axesConfig min/max/step/unit, imageAdjustMode drag-resize, calibrationMode
// guidé point-par-point, click pour placer les points de la courbe).
//
// Pipeline par bras de levier :
//   1. Saisir axes : xMin/xMax/xStep/xUnit + yMin/yMax/yStep/yUnit
//   2. Uploader l'image du mini-graphique
//   3. Ajuster (drag/resize) l'image pour que le cadre du graphique colle au
//      cadre des axes du Chart
//   4. Calibrer X point par point (clic sur chaque graduation, dans l'ordre
//      min, min+step, ..., max)
//   5. Calibrer Y idem
//   6. Cliquer N points sur la droite affine du mini-graphique
//   7. Régression linéaire → a (bras) + b (intercept) + R²
//   8. Valider → bras stocké, possibilité de recommencer avec une nouvelle
//      image pour un autre bras

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  IconButton,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Tooltip,
  Grid,
  Switch,
  FormControlLabel,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  RestartAlt as ResetIcon,
  Visibility as VisibilityIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  OpenWith as MoveIcon,
  Tune as CalibrateIcon,
  Add as AddIcon,
  Luggage as LuggageIcon,
  AirlineSeatReclineNormal as SeatIcon,
  LocalGasStation as FuelIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { Chart } from '../../../abac/curves/ui/Chart';
import {
  linearRegression,
  predictMoment,
  convertArmUnit,
  buildStageList
} from '../utils/centrogramMath';
import { unitsSelectors } from '@core/stores/unitsStore';

const STEPS = [
  'Axes & image',
  'Ajuster image',
  'Calibrer X',
  'Calibrer Y',
  'Lecture du bras'
];

// Dimensions par défaut du chart
const DEFAULT_CHART_WIDTH = 900;
const DEFAULT_CHART_HEIGHT = 650;

// Génère la liste des valeurs de graduations à partir de min/max/pas
function buildAxisValues(min, max, step) {
  if (!isFinite(min) || !isFinite(max) || !isFinite(step) || step <= 0) {
    return [min, max].filter(v => isFinite(v));
  }
  const values = [];
  const eps = step * 1e-6;
  for (let v = min; v <= max + eps; v += step) {
    values.push(parseFloat(v.toFixed(10)));
  }
  if (values[values.length - 1] < max - eps) values.push(max);
  return values;
}

const CentrogramReader = ({ aircraftData, updateData, onExit, onBack }) => {
  const [activeStep, setActiveStep] = useState(0);

  // Préférences d'unités utilisateur (mm par défaut pour armLength).
  // Le bras de levier sera stocké dans cette unité, pour rester cohérent avec
  // Step3 (qui affiche les valeurs telles que stockées).
  const units = unitsSelectors.useUnits();
  const userArmUnit = units?.armLength || 'mm';

  // ─── Image ──────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  // ─── Axes config (min/max/step/unit + titre) ────────────────────────────
  const [axesConfig, setAxesConfig] = useState({
    xAxis: { min: 0, max: 200, step: 50, unit: 'kg', title: 'Masse ajoutée' },
    yAxis: { min: 0, max: 500, step: 100, unit: 'm·kg', title: 'Moment cumulé' }
  });

  // Sur quel axe se trouve la MASSE sur ce mini-graphique ?
  //   - 'x' = cas standard (masse horizontale, moment vertical) → arm = pente directe
  //   - 'y' = cas inversé (masse verticale, moment horizontal) → arm = 1/pente
  // Le bras de levier physique reste le même, c'est juste la façon dont
  // le centrogramme est dessiné qui change.
  const [massAxis, setMassAxis] = useState('x');

  /**
   * Inverse les axes X et Y :
   *   - swap les configs xAxis ↔ yAxis (min/max/step/unit/title)
   *   - swap massAxis ('x' ↔ 'y')
   *   - reset la calibration et les points (les pixels n'ont plus de sens)
   */
  const swapAxes = () => {
    setAxesConfig(prev => ({
      xAxis: { ...prev.yAxis },
      yAxis: { ...prev.xAxis }
    }));
    setMassAxis(prev => prev === 'x' ? 'y' : 'x');
    // Les ticks calibrés et les points cliqués sont liés aux pixels actuels.
    // Comme on inverse les rôles des axes, on doit recalibrer.
    setCustomXTicks([]);
    setCustomYTicks([]);
    setCurvePoints([]);
    setCalibrationState(null);
  };

  // Dimensions du chart (modifiables via drag souris quand "Mode ajustement" est activé)
  const [chartSize, setChartSize] = useState({
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT
  });
  // État du drag de redimensionnement du chart
  const [chartResize, setChartResize] = useState(null); // { kind: 'right'|'bottom'|'corner', startX, startY, originW, originH }

  // Effet de drag : écoute mousemove/mouseup globalement quand un resize est en cours
  useEffect(() => {
    if (!chartResize) return;
    const onMove = (e) => {
      const dx = e.clientX - chartResize.startClientX;
      const dy = e.clientY - chartResize.startClientY;
      setChartSize({
        width: chartResize.kind === 'bottom'
          ? chartResize.originW
          : Math.max(500, Math.min(1600, chartResize.originW + dx)),
        height: chartResize.kind === 'right'
          ? chartResize.originH
          : Math.max(400, Math.min(1400, chartResize.originH + dy))
      });
    };
    const onUp = () => setChartResize(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [chartResize]);

  // ─── Background image (position en pixels SVG inner) ────────────────────
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [imageAdjustMode, setImageAdjustMode] = useState(false);

  // ─── Calibration multi-points par axe ───────────────────────────────────
  // Format : [{value, pixel}, ...] — voir Chart.tsx pour le format attendu
  const [customXTicks, setCustomXTicks] = useState([]);
  const [customYTicks, setCustomYTicks] = useState([]);

  // État de calibration GUIDÉE (axe + valeurs restantes à cliquer)
  // null si pas de calibration en cours.
  // Format : { axis: 'x'|'y', valuesToCalibrate: number[], currentIndex: number, collected: [] }
  const [calibrationState, setCalibrationState] = useState(null);

  // ─── Stages + points + résultats ────────────────────────────────────────
  const stageList = useMemo(() => buildStageList(aircraftData), [aircraftData]);
  const [currentStageKey, setCurrentStageKey] = useState('');
  // Pour Chart : on stocke les points dans le format "curve" (Curve.points)
  const [curvePoints, setCurvePoints] = useState([]); // [{id, x, y}]
  // Résultats validés par stage : {a, b, r2, n, armCm, ...}
  const [resultsByStage, setResultsByStage] = useState({});

  // ─── Test prédictif ─────────────────────────────────────────────────────
  const [testMass, setTestMass] = useState('');

  // ─── Menu d'ajout rapide de stages ──────────────────────────────────────
  const [addStageMenuAnchor, setAddStageMenuAnchor] = useState(null);

  /**
   * Ajoute à la volée un nouveau stage (bagage, siège, réservoir) dans
   * aircraftData et le sélectionne immédiatement pour la mesure.
   * Évite au pilote de revenir dans Step3 juste pour créer le slot.
   */
  const addStageQuick = (kind) => {
    setAddStageMenuAnchor(null);
    const id = Date.now() + Math.random();
    let newStageKey = null;

    if (kind === 'baggage') {
      const existing = aircraftData?.baggageCompartments || [];
      const newCompartment = {
        id,
        name: `Compartiment ${existing.length + 1}`,
        arm: '',
        maxWeight: ''
      };
      const updated = [...existing, newCompartment];
      updateData('baggageCompartments', updated);
      newStageKey = `baggage_${id}`;
    } else if (kind === 'seat') {
      const existing = aircraftData?.additionalSeats || [];
      const newSeat = {
        id,
        name: `Siège additionnel ${existing.length + 1}`,
        arm: ''
      };
      const updated = [...existing, newSeat];
      updateData('additionalSeats', updated);
      newStageKey = `seat_${id}`;
    } else if (kind === 'fuelWing' || kind === 'fuelOptional' || kind === 'fuelTip' || kind === 'fuelAux') {
      const existing = aircraftData?.additionalFuelTanks || [];
      const typeMap = {
        fuelWing:     { type: 'wing',     name: 'Réservoir aile' },
        fuelOptional: { type: 'optional', name: 'Réservoir optionnel' },
        fuelTip:      { type: 'tip',      name: 'Tip tank' },
        fuelAux:      { type: 'aux',      name: 'Réservoir auxiliaire' }
      };
      const info = typeMap[kind];
      const newTank = {
        id,
        name: `${info.name} ${existing.length + 1}`,
        type: info.type,
        arm: '',
        capacity: ''
      };
      const updated = [...existing, newTank];
      updateData('additionalFuelTanks', updated);
      newStageKey = `fuelTank_${id}`;
    }

    // Auto-sélectionne le nouveau stage après un tick (le temps que stageList
    // se reconstruise à partir du nouveau aircraftData)
    if (newStageKey) {
      setTimeout(() => {
        setCurrentStageKey(newStageKey);
        setCurvePoints([]);
        setTestMass('');
      }, 50);
    }
  };

  // ─── Conversion d'unités ────────────────────────────────────────────────
  const [armOutputUnit, setArmOutputUnit] = useState('cm');

  // ════════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE
  // ════════════════════════════════════════════════════════════════════════
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Merci de charger une image (PNG, JPG, etc.).');
      return;
    }
    if (imageUrl) {
      try { URL.revokeObjectURL(imageUrl); } catch (_) {}
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Pose l'image sur toute la zone inner du Chart par défaut.
    // Marges Chart.tsx : top 40, right 40, bottom 60, left 60.
    const INNER_W = chartSize.width - 60 - 40;
    const INNER_H = chartSize.height - 40 - 60;
    setBackgroundImage({ url, x: 0, y: 0, width: INNER_W, height: INNER_H });
    setImageAdjustMode(true); // active automatiquement le mode ajustement
  };

  /**
   * Reset complet pour mesurer un nouveau bras de levier sur une nouvelle image.
   * Préserve resultsByStage uniquement.
   */
  const handleStartNewArm = () => {
    if (imageUrl) {
      try { URL.revokeObjectURL(imageUrl); } catch (_) {}
    }
    setImageUrl(null);
    setImageFile(null);
    setBackgroundImage(null);
    setImageAdjustMode(false);
    setCustomXTicks([]);
    setCustomYTicks([]);
    setCalibrationState(null);
    setCurvePoints([]);
    setCurrentStageKey('');
    setTestMass('');
    setActiveStep(0);
  };

  // ════════════════════════════════════════════════════════════════════════
  // CALIBRATION GUIDÉE — pattern AbacBuilder
  // ════════════════════════════════════════════════════════════════════════
  const startCalibration = (axis) => {
    const cfg = axis === 'x' ? axesConfig.xAxis : axesConfig.yAxis;
    const values = buildAxisValues(cfg.min, cfg.max, cfg.step);
    if (values.length < 2) {
      alert(`Configure d'abord min/max/pas de l'axe ${axis.toUpperCase()}.`);
      return;
    }
    setCalibrationState({
      axis,
      valuesToCalibrate: values,
      currentIndex: 0,
      collected: []
    });
    // Reset les ticks existants pour cet axe (on recommence)
    if (axis === 'x') setCustomXTicks([]);
    else setCustomYTicks([]);
  };

  const cancelCalibration = () => setCalibrationState(null);

  /**
   * Reçoit un clic en pixel inner depuis Chart pendant la calibration.
   * Pattern AbacBuilder : on collecte les pixels dans l'ordre des valeurs
   * à calibrer (min → max par step).
   */
  const handleCalibrationClick = useCallback((pixelInner) => {
    if (!calibrationState) return;
    const { axis, valuesToCalibrate, currentIndex, collected } = calibrationState;
    const value = valuesToCalibrate[currentIndex];
    const pixel = axis === 'x' ? pixelInner.x : pixelInner.y;
    const newCollected = [...collected, { value, pixel }];

    if (currentIndex + 1 >= valuesToCalibrate.length) {
      // Calibration finie : commit dans customXTicks/customYTicks
      if (axis === 'x') setCustomXTicks(newCollected);
      else setCustomYTicks(newCollected);
      setCalibrationState(null);
      return;
    }

    setCalibrationState({
      ...calibrationState,
      currentIndex: currentIndex + 1,
      collected: newCollected
    });
  }, [calibrationState]);

  // ════════════════════════════════════════════════════════════════════════
  // CLIC SUR LA COURBE (lecture des points)
  // ════════════════════════════════════════════════════════════════════════
  const [stageRequiredHint, setStageRequiredHint] = useState(false);
  const handlePointClick = useCallback((x, y) => {
    if (!currentStageKey) {
      setStageRequiredHint(true);
      setTimeout(() => setStageRequiredHint(false), 4000);
      return;
    }
    setCurvePoints(prev => [...prev, { id: uuidv4(), x, y }].sort((a, b) => a.x - b.x));
  }, [currentStageKey]);

  const handlePointDrag = useCallback((curveId, pointId, x, y) => {
    setCurvePoints(prev => prev.map(p => p.id === pointId ? { ...p, x, y } : p)
                                  .sort((a, b) => a.x - b.x));
  }, []);

  const handlePointDelete = useCallback((curveId, pointId) => {
    setCurvePoints(prev => prev.filter(p => p.id !== pointId));
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // RÉGRESSION LINÉAIRE (live)
  // ════════════════════════════════════════════════════════════════════════
  const regression = useMemo(() => {
    if (curvePoints.length < 2) return null;
    return linearRegression(curvePoints);
  }, [curvePoints]);

  const currentStage = stageList.find(s => s.key === currentStageKey);

  // ════════════════════════════════════════════════════════════════════════
  // VALIDATION DU BRAS COURANT
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Calcule le BRAS physique à partir de la régression et de la position
   * de la masse (X ou Y).
   *
   *   - massAxis === 'x' : standard. y = a·x + b avec y=moment, x=masse.
   *                        Bras = a (pente directe). Unité = unitY/unitX.
   *
   *   - massAxis === 'y' : inversé. y = a·x + b avec y=masse, x=moment.
   *                        Là : masse = a·moment + b → moment = (masse-b)/a
   *                                                  → moment = (1/a)·masse - b/a
   *                        Bras = 1/a (pente inverse). Unité = unitX/unitY.
   */
  const computeArmFromRegression = (reg) => {
    if (!reg) return null;
    // Quelle unité de moment et de masse selon massAxis ?
    const massUnit = massAxis === 'x' ? axesConfig.xAxis.unit : axesConfig.yAxis.unit;
    const momentUnit = massAxis === 'x' ? axesConfig.yAxis.unit : axesConfig.xAxis.unit;

    // Bras brut = moment / masse (ou 1/pente si massAxis='y'), en unité
    // momentUnit/massUnit. Ex : m·kg / kg = m, kg·cm / kg = cm.
    const armRaw = massAxis === 'x' ? reg.a : (1 / reg.a);
    if (!Number.isFinite(armRaw)) return null;

    // Détecter l'unité de longueur dans momentUnit ("m·kg", "kg·cm", etc.)
    const lengthRegex = /(mm|cm|m|in)/i;
    const matchMoment = momentUnit.match(lengthRegex);
    const lengthUnit = matchMoment ? matchMoment[1].toLowerCase() : 'm';

    // Conversion vers UNITÉ UTILISATEUR (préférence Step3). C'est cette
    // valeur qui sera stockée et affichée tout le reste du wizard.
    const armInUserUnit = convertArmUnit(armRaw, lengthUnit, userArmUnit);

    return {
      armRaw,
      armInUserUnit,    // ← clé pour le storage
      lengthUnit,       // unité lue sur le graphe
      userArmUnit,      // unité de stockage / affichage Step3
      massUnit,
      momentUnit
    };
  };

  const validateStage = () => {
    if (!regression || !currentStage) return;
    const armInfo = computeArmFromRegression(regression);
    if (!armInfo) {
      alert('Impossible de calculer le bras à partir de cette régression (pente nulle ?).');
      return;
    }

    setResultsByStage(prev => ({
      ...prev,
      [currentStageKey]: {
        a: regression.a,
        b: regression.b,
        r2: regression.r2,
        n: regression.n,
        armValue: armInfo.armInUserUnit,
        armUnit: armInfo.userArmUnit,
        armRaw: armInfo.armRaw,
        slopeUnit: armInfo.lengthUnit,
        massUnit: armInfo.massUnit,
        momentUnit: armInfo.momentUnit,
        massAxis
      }
    }));

    // Stockage dans l'unité utilisateur (mm par défaut). Step3 affichera
    // directement cette valeur avec le bon suffixe d'unité.
    if (currentStage.aircraftPath) {
      // Arrondi adapté : 1 décimale pour mm/cm (précision raisonnable),
      // 4 décimales pour m (besoin de précision plus fine).
      const decimals = userArmUnit === 'm' ? 4 : userArmUnit === 'in' ? 3 : 1;
      const factor = Math.pow(10, decimals);
      updateData(currentStage.aircraftPath, Math.round(armInfo.armInUserUnit * factor) / factor);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // STRUCTURE DES COURBES POUR Chart.tsx
  // ════════════════════════════════════════════════════════════════════════
  // IMPORTANT : Chart.tsx exige un selectedCurveId NON-NULL pour accepter les
  // clics qui ajoutent des points. On garde donc TOUJOURS une courbe avec un
  // id stable, même quand elle est vide. Sans ça, le premier clic est ignoré
  // silencieusement et l'utilisateur ne peut jamais poser le premier point.
  const CURVE_ID = 'centrogram-curve';
  const curves = useMemo(() => [{
    id: CURVE_ID,
    name: currentStage?.label || 'Courbe en cours',
    color: '#ef4444',
    points: curvePoints
  }], [curvePoints, currentStage]);

  const selectedCurveIdForChart = CURVE_ID;

  // ════════════════════════════════════════════════════════════════════════
  // RENDU AXES FORM (compact)
  // ════════════════════════════════════════════════════════════════════════
  const renderAxesForm = () => {
    // Affiche le rôle physique de chaque axe selon massAxis
    const xRole = massAxis === 'x' ? 'MASSE ajoutée' : 'MOMENT cumulé';
    const yRole = massAxis === 'y' ? 'MASSE ajoutée' : 'MOMENT cumulé';
    const xUnits = massAxis === 'x' ? ['kg', 'lbs'] : ['m·kg', 'kg·m', 'cm·kg', 'kg·cm', 'mm·kg', 'lbs·in', 'in·lbs'];
    const yUnits = massAxis === 'y' ? ['kg', 'lbs'] : ['m·kg', 'kg·m', 'cm·kg', 'kg·cm', 'mm·kg', 'lbs·in', 'in·lbs'];

    return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2">
          📐 Configuration des axes du mini-graphique
        </Typography>
        <Tooltip title="Inverse les rôles X ↔ Y. À utiliser si ton centrogramme a la masse sur l'axe vertical au lieu de l'horizontal.">
          <Button
            size="small"
            variant="outlined"
            startIcon={<MoveIcon sx={{ transform: 'rotate(90deg)' }} />}
            onClick={swapAxes}
            color={massAxis === 'y' ? 'warning' : 'primary'}
          >
            Inverser X ↔ Y
          </Button>
        </Tooltip>
      </Stack>

      <Alert severity={massAxis === 'y' ? 'warning' : 'info'} sx={{ mb: 2, py: 0.5 }}>
        <Typography variant="caption">
          {massAxis === 'x' ? (
            <>
              ✓ Configuration <strong>standard</strong> : la masse est sur l'axe X (horizontal),
              le moment sur l'axe Y (vertical).
              <br/>Le bras de levier est calculé directement : <strong>arm = pente (a)</strong>.
            </>
          ) : (
            <>
              ⚠ Configuration <strong>inversée</strong> : la masse est sur l'axe Y (vertical),
              le moment sur l'axe X (horizontal).
              <br/>Le bras de levier est calculé inversement : <strong>arm = 1 / pente (1/a)</strong>.
            </>
          )}
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        {/* Axe X */}
        <Grid size={12}>
          <Typography variant="caption" fontWeight={700} color="success.main">
            Axe X (horizontal — {xRole})
          </Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Min"
            value={axesConfig.xAxis.min}
            onChange={(e) => setAxesConfig(c => ({
              ...c, xAxis: { ...c.xAxis, min: parseFloat(e.target.value) || 0 }
            }))}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Max"
            value={axesConfig.xAxis.max}
            onChange={(e) => setAxesConfig(c => ({
              ...c, xAxis: { ...c.xAxis, max: parseFloat(e.target.value) || 0 }
            }))}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Pas"
            value={axesConfig.xAxis.step}
            onChange={(e) => setAxesConfig(c => ({
              ...c, xAxis: { ...c.xAxis, step: parseFloat(e.target.value) || 1 }
            }))}
            helperText={`${buildAxisValues(axesConfig.xAxis.min, axesConfig.xAxis.max, axesConfig.xAxis.step).length} ticks`}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Unité X</InputLabel>
            <Select
              label="Unité X"
              value={axesConfig.xAxis.unit}
              onChange={(e) => setAxesConfig(c => ({
                ...c, xAxis: { ...c.xAxis, unit: e.target.value }
              }))}
            >
              {xUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            fullWidth size="small" label="Titre axe X"
            value={axesConfig.xAxis.title}
            onChange={(e) => setAxesConfig(c => ({
              ...c, xAxis: { ...c.xAxis, title: e.target.value }
            }))}
          />
        </Grid>
        <Grid size={12}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!axesConfig.xAxis.reversed}
                onChange={(e) => {
                  setAxesConfig(c => ({
                    ...c, xAxis: { ...c.xAxis, reversed: e.target.checked }
                  }));
                  setCustomXTicks([]);  // ré-calibration nécessaire
                  setCalibrationState(null);
                }}
              />
            }
            label={
              <Typography variant="caption">
                Inverser l'axe X (origine à droite) — valeurs décroissantes de gauche à droite
              </Typography>
            }
          />
        </Grid>

        {/* Axe Y */}
        <Grid size={12}>
          <Typography variant="caption" fontWeight={700} color="primary.main">
            Axe Y (vertical — {yRole})
          </Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Min"
            value={axesConfig.yAxis.min}
            onChange={(e) => setAxesConfig(c => ({
              ...c, yAxis: { ...c.yAxis, min: parseFloat(e.target.value) || 0 }
            }))}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Max"
            value={axesConfig.yAxis.max}
            onChange={(e) => setAxesConfig(c => ({
              ...c, yAxis: { ...c.yAxis, max: parseFloat(e.target.value) || 0 }
            }))}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <TextField
            fullWidth size="small" type="number" label="Pas"
            value={axesConfig.yAxis.step}
            onChange={(e) => setAxesConfig(c => ({
              ...c, yAxis: { ...c.yAxis, step: parseFloat(e.target.value) || 1 }
            }))}
            helperText={`${buildAxisValues(axesConfig.yAxis.min, axesConfig.yAxis.max, axesConfig.yAxis.step).length} ticks`}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Unité Y</InputLabel>
            <Select
              label="Unité Y"
              value={axesConfig.yAxis.unit}
              onChange={(e) => setAxesConfig(c => ({
                ...c, yAxis: { ...c.yAxis, unit: e.target.value }
              }))}
            >
              {yUnits.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            fullWidth size="small" label="Titre axe Y"
            value={axesConfig.yAxis.title}
            onChange={(e) => setAxesConfig(c => ({
              ...c, yAxis: { ...c.yAxis, title: e.target.value }
            }))}
          />
        </Grid>
        <Grid size={12}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!axesConfig.yAxis.reversed}
                onChange={(e) => {
                  setAxesConfig(c => ({
                    ...c, yAxis: { ...c.yAxis, reversed: e.target.checked }
                  }));
                  setCustomYTicks([]);  // ré-calibration nécessaire
                  setCalibrationState(null);
                }}
                color="warning"
              />
            }
            label={
              <Typography variant="caption">
                <strong>Inverser l'axe Y (origine en haut)</strong> — valeurs croissantes du haut vers le bas
                {axesConfig.yAxis.reversed && ' ← ACTIVÉ'}
              </Typography>
            }
          />
        </Grid>
      </Grid>

    </Paper>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDU CHART (au centre, partagé entre toutes les étapes)
  // ════════════════════════════════════════════════════════════════════════
  const renderChart = () => (
    <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto', position: 'relative' }}>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <Chart
        axesConfig={axesConfig}
        curves={curves}
        selectedCurveId={selectedCurveIdForChart}
        onPointClick={activeStep === 4 && !imageAdjustMode ? handlePointClick : undefined}
        onPointDrag={activeStep === 4 && !imageAdjustMode ? handlePointDrag : undefined}
        onPointDelete={activeStep === 4 && !imageAdjustMode ? handlePointDelete : undefined}
        responsive={false}
        width={chartSize.width}
        height={chartSize.height}
        backgroundImage={backgroundImage}
        imageAdjustMode={imageAdjustMode}
        onBackgroundImageChange={(next) => setBackgroundImage(next)}
        customXTicks={customXTicks.length >= 2 ? customXTicks : undefined}
        customYTicks={customYTicks.length >= 2 ? customYTicks : undefined}
        calibrationMode={calibrationState?.axis || null}
        onCalibrationClick={handleCalibrationClick}
        showGrid={true}
        showLegend={false}
      />

      {/* Poignées de redimensionnement du chart (visibles uniquement en mode ajustement) */}
      {imageAdjustMode && (
        <>
          {/* Poignée bord droit : étire horizontalement */}
          <Box
            onMouseDown={(e) => {
              e.stopPropagation();
              setChartResize({
                kind: 'right',
                startClientX: e.clientX, startClientY: e.clientY,
                originW: chartSize.width, originH: chartSize.height
              });
            }}
            title="Étirer horizontalement"
            sx={{
              position: 'absolute', right: -3, top: 40, bottom: 60, width: 8,
              cursor: 'ew-resize',
              bgcolor: chartResize?.kind === 'right' ? '#3b82f6' : '#dbeafe',
              borderRadius: 1,
              opacity: 0.8,
              '&:hover': { bgcolor: '#3b82f6' }
            }}
          />
          {/* Poignée bord bas : étire verticalement */}
          <Box
            onMouseDown={(e) => {
              e.stopPropagation();
              setChartResize({
                kind: 'bottom',
                startClientX: e.clientX, startClientY: e.clientY,
                originW: chartSize.width, originH: chartSize.height
              });
            }}
            title="Étirer verticalement"
            sx={{
              position: 'absolute', bottom: -3, left: 60, right: 40, height: 8,
              cursor: 'ns-resize',
              bgcolor: chartResize?.kind === 'bottom' ? '#3b82f6' : '#dbeafe',
              borderRadius: 1,
              opacity: 0.8,
              '&:hover': { bgcolor: '#3b82f6' }
            }}
          />
          {/* Poignée coin bas-droit : étire en 2D */}
          <Box
            onMouseDown={(e) => {
              e.stopPropagation();
              setChartResize({
                kind: 'corner',
                startClientX: e.clientX, startClientY: e.clientY,
                originW: chartSize.width, originH: chartSize.height
              });
            }}
            title="Étirer dans les deux directions"
            sx={{
              position: 'absolute', right: -8, bottom: -8, width: 18, height: 18,
              cursor: 'nwse-resize',
              bgcolor: chartResize?.kind === 'corner' ? '#3b82f6' : '#3b82f6',
              border: '2px solid white',
              borderRadius: 1,
              opacity: 0.9,
              '&:hover': { opacity: 1 }
            }}
          />
        </>
      )}
      </Box>
    </Paper>
  );


  // ════════════════════════════════════════════════════════════════════════
  // RENDU PAR ÉTAPE
  // ════════════════════════════════════════════════════════════════════════
  const renderStepContent = () => {
    // ─── ÉTAPE 0 — Axes + upload image ───
    if (activeStep === 0) {
      return (
        <Box>
          {renderAxesForm()}
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              📷 Image du mini-graphique
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Charge un export JPG/PNG du mini-graphique à mesurer (PLACES AVANT, CARBURANT, …).
              Chaque mini-graphique a sa propre échelle — tu pourras recharger une nouvelle image
              pour chaque bras de levier.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<UploadIcon />}
              component="label"
              color={imageUrl ? 'secondary' : 'primary'}
            >
              {imageUrl ? 'Charger une autre image' : 'Charger une image'}
              <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
            </Button>
            {imageFile && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'success.main' }}>
                ✓ {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)
              </Typography>
            )}
          </Paper>
        </Box>
      );
    }

    // ─── ÉTAPE 1 — Ajuster image ───
    if (activeStep === 1) {
      return (
        <Box>
          <Alert severity="info" icon={<MoveIcon />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              🎯 Ajuste l'image ET le graphique pour qu'ils collent parfaitement
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }} component="div">
              Active la checkbox <strong>"🎯 Mode ajustement"</strong> dans le bandeau au-dessus de l'image.
              <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                <li>L'image se déplace au drag (8 poignées bleues sur ses bords).</li>
                <li>Le graphique se redimensionne via les <strong>3 poignées sur ses bords</strong>
                    (droit, bas, coin bas-droit).</li>
                <li>Objectif : caler les graduations <strong>0 sur 0</strong> et
                    <strong>max sur max</strong> de chaque axe.</li>
                <li>Décoche la checkbox quand c'est bon pour passer à la calibration.</li>
              </ul>
            </Typography>
          </Alert>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              color="warning"
              onClick={() => {
                const INNER_W = chartSize.width - 60 - 40;
                const INNER_H = chartSize.height - 40 - 60;
                setBackgroundImage(b => b ? { ...b, x: 0, y: 0, width: INNER_W, height: INNER_H } : b);
              }}
            >
              Reset position image
            </Button>
            <Button
              size="small"
              color="warning"
              onClick={() => setChartSize({ width: DEFAULT_CHART_WIDTH, height: DEFAULT_CHART_HEIGHT })}
            >
              Reset taille chart
            </Button>
          </Stack>
        </Box>
      );
    }

    // ─── ÉTAPES 2-3 — Calibrer X / Y ───
    if (activeStep === 2 || activeStep === 3) {
      const axis = activeStep === 2 ? 'x' : 'y';
      const cfg = axis === 'x' ? axesConfig.xAxis : axesConfig.yAxis;
      const values = buildAxisValues(cfg.min, cfg.max, cfg.step);
      const ticks = axis === 'x' ? customXTicks : customYTicks;
      const isCalibrating = calibrationState?.axis === axis;
      const currentValue = isCalibrating ? calibrationState.valuesToCalibrate[calibrationState.currentIndex] : null;
      const remaining = isCalibrating ? calibrationState.valuesToCalibrate.length - calibrationState.currentIndex : 0;

      return (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              📍 Calibration de l'axe {axis.toUpperCase()} ({cfg.title} en {cfg.unit})
            </Typography>
            <Typography variant="body2">
              Tu vas cliquer sur <strong>{values.length} graduations</strong> de l'axe {axis.toUpperCase()},
              dans l'ordre : <strong>{values.slice(0, 5).join(', ')}{values.length > 5 ? '…' : ''}</strong>{' '}
              jusqu'à <strong>{values[values.length - 1]}</strong>.
              Le système t'indique à chaque clic quelle graduation tu dois cliquer.
            </Typography>
          </Alert>

          {!isCalibrating && ticks.length === 0 && (
            <Button
              variant="contained"
              color={axis === 'x' ? 'success' : 'primary'}
              size="large"
              startIcon={<CalibrateIcon />}
              onClick={() => startCalibration(axis)}
            >
              Démarrer la calibration de l'axe {axis.toUpperCase()} ({values.length} clics)
            </Button>
          )}

          {!isCalibrating && ticks.length > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✓ Axe {axis.toUpperCase()} calibré ({ticks.length} graduations).
              Tu peux <Button size="small" onClick={() => startCalibration(axis)}>Recommencer la calibration</Button> si nécessaire.
            </Alert>
          )}

          {isCalibrating && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(249,115,22,0.08)', borderColor: '#f97316', borderWidth: 2 }}>
              <Typography variant="h6" sx={{ color: '#9a3412' }}>
                🎯 Clique sur la graduation <strong>{axis.toUpperCase()} = {currentValue}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Reste {remaining} clic{remaining > 1 ? 's' : ''} : {calibrationState.valuesToCalibrate.slice(calibrationState.currentIndex).join(', ')}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button size="small" color="error" onClick={cancelCalibration}>
                  Annuler la calibration
                </Button>
              </Box>
            </Paper>
          )}

          {/* Tableau historique des ticks calibrés */}
          {ticks.length > 0 && (
            <Paper variant="outlined" sx={{ mt: 2 }}>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  📋 Graduations calibrées — axe {axis.toUpperCase()}
                </Typography>
              </Box>
              <Box sx={{ p: 1 }}>
                {ticks.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: i < ticks.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      bgcolor: axis === 'x' ? '#22c55e' : '#3b82f6',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, mr: 2
                    }}>
                      {i + 1}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        <strong>{t.value} {cfg.unit}</strong> → pixel {Math.round(t.pixel)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Box>
      );
    }

    // ─── ÉTAPE 4 — Lecture du bras (clic des points + régression) ───
    if (activeStep === 4) {
      return (
        <Box>
          {/* Alerte si le user clique sans avoir choisi de stage */}
          {stageRequiredHint && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setStageRequiredHint(false)}>
              ⚠ <strong>Sélectionne d'abord un stage</strong> dans le menu déroulant ci-dessous
              avant de cliquer sur la courbe.
            </Alert>
          )}

          {/* Bannière de signalement quand aucun stage choisi */}
          {!currentStageKey && (
            <Alert severity="info" sx={{ mb: 2 }}>
              👉 <strong>Étape 1 :</strong> Choisis le bras de levier à mesurer dans le menu
              déroulant ci-dessous, puis clique 3-5 points sur la droite affine du mini-graphique.
            </Alert>
          )}

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
            <FormControl
              size="small"
              sx={{ minWidth: 300 }}
              color={!currentStageKey ? 'warning' : 'primary'}
              error={stageRequiredHint}
            >
              <InputLabel>Stage à mesurer *</InputLabel>
              <Select
                value={currentStageKey}
                label="Stage à mesurer *"
                onChange={(e) => {
                  setCurrentStageKey(e.target.value);
                  setCurvePoints([]); // reset points si on change de stage
                  setTestMass('');
                  setStageRequiredHint(false);
                }}
              >
                {stageList.map(s => (
                  <MenuItem key={s.key} value={s.key}>
                    {s.label}
                    {resultsByStage[s.key] && (
                      <CheckCircleIcon sx={{ ml: 1, color: 'success.main', fontSize: 16 }} />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Bouton + Ajouter un stage à la volée */}
            <Tooltip title="Ajouter un nouveau stage (bagages, siège, réservoir) sans repasser par Step3">
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<AddIcon />}
                onClick={(e) => setAddStageMenuAnchor(e.currentTarget)}
              >
                Ajouter
              </Button>
            </Tooltip>
            <Menu
              anchorEl={addStageMenuAnchor}
              open={Boolean(addStageMenuAnchor)}
              onClose={() => setAddStageMenuAnchor(null)}
            >
              <MenuItem onClick={() => addStageQuick('baggage')}>
                <ListItemIcon><LuggageIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Compartiment bagages" secondary="🧳 Pour un soute / compartiment" />
              </MenuItem>
              <MenuItem onClick={() => addStageQuick('seat')}>
                <ListItemIcon><SeatIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Siège additionnel" secondary="💺 3e/4e siège, jump seat…" />
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => addStageQuick('fuelWing')}>
                <ListItemIcon><FuelIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Réservoir d'aile" secondary="✈️ Aile gauche/droite" />
              </MenuItem>
              <MenuItem onClick={() => addStageQuick('fuelTip')}>
                <ListItemIcon><FuelIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Tip tank" secondary="🛢️ Réservoir d'extrémité" />
              </MenuItem>
              <MenuItem onClick={() => addStageQuick('fuelAux')}>
                <ListItemIcon><FuelIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Réservoir auxiliaire" secondary="🔧 Aux / fuselage" />
              </MenuItem>
              <MenuItem onClick={() => addStageQuick('fuelOptional')}>
                <ListItemIcon><FuelIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Réservoir optionnel" secondary="🔋 Kit additionnel" />
              </MenuItem>
            </Menu>

            <Chip
              label={`${curvePoints.length} point${curvePoints.length > 1 ? 's' : ''} cliqué${curvePoints.length > 1 ? 's' : ''}`}
              color={curvePoints.length >= 2 ? 'success' : 'default'}
              variant={curvePoints.length >= 2 ? 'filled' : 'outlined'}
            />
            <IconButton
              color="error"
              onClick={() => setCurvePoints([])}
              disabled={curvePoints.length === 0}
              title="Effacer tous les points cliqués"
            >
              <ResetIcon />
            </IconButton>
          </Stack>

          {currentStage && (
            <Alert severity="success" icon={false} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                🎯 Mesure : {currentStage.label}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {currentStage.helper}
              </Typography>
              <Typography variant="caption" component="div">
                <strong>Clique 3 à 5 points</strong> directement sur la droite affine
                du mini-graphique au-dessus.
                <br/>• Clic droit sur un point pour le supprimer
                <br/>• Glisser-déposer pour ajuster un point
              </Typography>
            </Alert>
          )}

          {regression && (() => {
            const armInfo = computeArmFromRegression(regression);
            const armUser = armInfo?.armInUserUnit;
            // Labels adaptatifs selon massAxis
            const massUnit = massAxis === 'x' ? axesConfig.xAxis.unit : axesConfig.yAxis.unit;
            const momentUnit = massAxis === 'x' ? axesConfig.yAxis.unit : axesConfig.xAxis.unit;
            // Test prédictif :
            //   - massAxis='x' : input masse → predict moment = a·mass + b
            //   - massAxis='y' : input masse → predict moment = (mass - b) / a
            const testMassNum = parseFloat(testMass);
            let predictedMoment = NaN;
            if (Number.isFinite(testMassNum)) {
              predictedMoment = massAxis === 'x'
                ? regression.a * testMassNum + regression.b
                : (testMassNum - regression.b) / regression.a;
            }

            return (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(168, 85, 247, 0.08)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                🧮 Régression linéaire (live){massAxis === 'y' && ' — config inversée'}
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Chip color="primary" label={`a (pente régression) = ${regression.a.toFixed(4)} ${axesConfig.yAxis.unit}/${axesConfig.xAxis.unit}`} />
                <Chip label={`b (intercept) = ${regression.b.toFixed(2)} ${axesConfig.yAxis.unit}`} />
                <Chip
                  color={regression.r2 >= 0.99 ? 'success' : regression.r2 >= 0.95 ? 'warning' : 'error'}
                  label={`R² = ${regression.r2.toFixed(4)}`}
                />
                <Chip variant="outlined" label={`${regression.n} points`} />
              </Stack>

              {/* Bras physique calculé (différent de la pente si massAxis='y') */}
              {armInfo && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(34,197,94,0.1)', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {massAxis === 'x'
                      ? <>📏 Bras de levier = pente <strong>a</strong> = {armInfo.armRaw.toFixed(4)} {armInfo.lengthUnit} = <strong>{armUser.toFixed(2)} {userArmUnit}</strong></>
                      : <>📏 Bras de levier = <strong>1/a</strong> (inversé) = {armInfo.armRaw.toFixed(4)} {armInfo.lengthUnit} = <strong>{armUser.toFixed(2)} {userArmUnit}</strong></>
                    }
                  </Typography>
                </Box>
              )}

              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label={`Masse test (${massUnit})`}
                  type="number"
                  value={testMass}
                  onChange={(e) => setTestMass(e.target.value)}
                  sx={{ width: 180 }}
                />
                {Number.isFinite(predictedMoment) && (
                  <Chip
                    icon={<VisibilityIcon />}
                    color="info"
                    label={`Moment prédit = ${predictedMoment.toFixed(2)} ${momentUnit}`}
                  />
                )}
              </Box>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={validateStage}
                  disabled={regression.r2 < 0.95 || !armInfo}
                >
                  ✓ Valider ce bras ({armUser ? armUser.toFixed(2) : '?'} {userArmUnit})
                </Button>
                {resultsByStage[currentStageKey] && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<UploadIcon />}
                    onClick={handleStartNewArm}
                  >
                    Charger l'image du bras suivant
                  </Button>
                )}
              </Box>

              {resultsByStage[currentStageKey] && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  ✅ Bras validé pour <strong>{currentStage?.label}</strong> :
                  {' '}<strong>{resultsByStage[currentStageKey].armValue.toFixed(2)} {resultsByStage[currentStageKey].armUnit}</strong>
                  {resultsByStage[currentStageKey].massAxis === 'y' && ' (config inversée)'}
                </Alert>
              )}
            </Paper>
            );
          })()}

          {curvePoints.length > 0 && curvePoints.length < 2 && (
            <Alert severity="warning">
              Encore 1 point minimum pour calculer la régression linéaire.
            </Alert>
          )}
        </Box>
      );
    }

    return null;
  };

  // ════════════════════════════════════════════════════════════════════════
  // CALCUL : étape suivante autorisée ?
  // ════════════════════════════════════════════════════════════════════════
  const canGoNext = () => {
    if (activeStep === 0) return !!imageUrl;
    if (activeStep === 1) return true;
    if (activeStep === 2) return customXTicks.length >= 2;
    if (activeStep === 3) return customYTicks.length >= 2;
    return false;
  };

  const handleNext = () => {
    // Quand on passe d'ajustement image à calibration X, on désactive le mode image
    if (activeStep === 1) setImageAdjustMode(false);
    setActiveStep(s => Math.min(STEPS.length - 1, s + 1));
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════
  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ChevronLeftIcon />} onClick={onBack} size="small">
          Retour
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircleIcon />}
          onClick={onExit}
          disabled={Object.keys(resultsByStage).length === 0}
        >
          Terminer ({Object.keys(resultsByStage).length} bras validé{Object.keys(resultsByStage).length > 1 ? 's' : ''})
        </Button>
      </Box>

      <Typography variant="h6" gutterBottom>
        🧭 Lecture graphique du centrogramme
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Mesure les bras de levier des étapes (sièges, carburant, bagages…) par clic sur le centrogramme MANEX.
        Chaque mini-graphique se mesure indépendamment.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
        {STEPS.map((label, idx) => (
          <Step key={label} completed={idx < activeStep}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Récap bras validés */}
      {Object.keys(resultsByStage).length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(34,197,94,0.06)', borderColor: 'success.main' }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
            ✅ Bras déjà validés
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(resultsByStage).map(([k, r]) => {
              const s = stageList.find(s => s.key === k);
              return (
                <Chip
                  key={k}
                  size="small"
                  color="success"
                  label={`${s?.label || k} : ${r.armValue.toFixed(2)} ${r.armUnit}`}
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Bandeau "actions image + ajustement" — visible dès qu'une image est chargée */}
      {imageUrl && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: imageAdjustMode ? 'rgba(59,130,246,0.08)' : 'action.hover', borderColor: imageAdjustMode ? 'primary.main' : 'divider', borderWidth: imageAdjustMode ? 2 : 1 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" sx={{ flex: 1, minWidth: 150 }}>
              📷 {imageFile?.name}
            </Typography>

            {/* Checkbox "Mode ajustement" — active drag image + drag chart */}
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  color="primary"
                  checked={imageAdjustMode}
                  onChange={(e) => setImageAdjustMode(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption" fontWeight={imageAdjustMode ? 700 : 400}>
                  🎯 Mode ajustement {imageAdjustMode && '(drag image + chart à la souris)'}
                </Typography>
              }
            />

            <Tooltip title={axesConfig.yAxis.reversed ? "Y normal (origine en bas)" : "Y inversé (origine en haut)"}>
              <Button
                size="small"
                variant={axesConfig.yAxis.reversed ? 'contained' : 'outlined'}
                color="warning"
                onClick={() => {
                  setAxesConfig(c => ({
                    ...c,
                    yAxis: { ...c.yAxis, reversed: !c.yAxis.reversed }
                  }));
                  setCustomYTicks([]);
                  setCalibrationState(null);
                }}
              >
                {axesConfig.yAxis.reversed ? '↓ Y inversé' : '↑ Y normal'}
              </Button>
            </Tooltip>
            <Button size="small" startIcon={<UploadIcon />} onClick={handleStartNewArm}>
              Nouvelle image
            </Button>
          </Stack>
          {imageAdjustMode && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
              💡 Drag l'image avec ses poignées bleues. Le chart se redimensionne via les 3 poignées
              bleues sur ses bords (droit, bas, coin). Décoche la checkbox pour cliquer des points.
            </Typography>
          )}
        </Paper>
      )}

      {/* Chart (visible dès qu'une image est chargée) */}
      {imageUrl && renderChart()}

      {/* Contenu de l'étape */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {renderStepContent()}
      </Paper>

      {/* Navigation entre étapes */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          startIcon={<ChevronLeftIcon />}
          onClick={() => setActiveStep(s => Math.max(0, s - 1))}
          disabled={activeStep === 0}
        >
          Étape précédente
        </Button>
        <Button
          variant="contained"
          endIcon={<ChevronRightIcon />}
          onClick={handleNext}
          disabled={!canGoNext() || activeStep === STEPS.length - 1}
        >
          Étape suivante
        </Button>
      </Box>
    </Box>
  );
};

export default CentrogramReader;
