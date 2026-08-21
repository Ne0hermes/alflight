// src/features/aircraft/components/PerformanceCorrectionsEditor.jsx
// ============================================================================
// ✈️ FACTEURS CORRECTIFS DE PERFORMANCE — éditeur du wizard (admin)
// ----------------------------------------------------------------------------
// Saisie des règles du manuel de vol quand celui-ci donne des FACTEURS et non
// des tableaux : « ×0,85 par 10 kt de vent de face », « +10 % par 2 kt de
// vent arrière », « +15 % piste en herbe »…
//
// 🔀 SÉPARATION PAR PHASE (demande César 16/08) : les manuels donnent des
// facteurs DIFFÉRENTS au décollage et à l'atterrissage. L'éditeur est donc
// organisé en deux colonnes indépendantes ; chaque pré-réglage crée une règle
// pour SA phase (plus de « les deux phases » implicite). Une règle commune aux
// deux phases reste possible via le formulaire détaillé, et apparaît alors dans
// les deux colonnes avec une pastille « 2 phases ».
//
// Stocké dans aircraft.performanceCorrections, appliqué (avec détail visuel)
// dans le module Performance. Voir utils/performanceCorrections.
// ============================================================================

import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, TextField, MenuItem, Chip, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Speed as SpeedIcon,
  FlightTakeoff as TakeoffIcon,
  FlightLand as LandingIcon
} from '@mui/icons-material';
import { CORRECTION_TYPES, describeCorrection } from '@utils/performanceCorrections';

const TYPE_OPTIONS = Object.entries(CORRECTION_TYPES).map(([value, t]) => ({ value, label: t.label }));

const MODE_OPTIONS = [
  { value: 'percent_fixed', label: '± % fixe' },
  { value: 'percent_per_step', label: '± % par tranche de vent' },
  { value: 'factor_per_step', label: '× facteur par tranche de vent' },
  // Le manuel donne souvent un TABLEAU (« pour 10 kt ×0,85, pour 20 kt ×0,65,
  // pour 30 kt ×0,55 ») et non un facteur récurrent. Recopié en trois règles
  // « par tranche », il se multipliait ; ici il tient dans UNE règle à paliers.
  { value: 'factor_table', label: '× tableau de paliers du manuel' },
  { value: 'percent_table', label: '± % tableau de paliers du manuel' },
];

const APPLIES_OPTIONS = [
  { value: 'takeoff', label: 'Décollage' },
  { value: 'landing', label: 'Atterrissage' },
  { value: 'both', label: 'Les deux phases' },
];

// Cas classiques des manuels — proposés SÉPARÉMENT par phase
const PRESETS = [
  { label: 'Vent de face ×0,85 / 10 kt', rule: { type: 'headwind', mode: 'factor_per_step', value: 0.85, stepKt: 10 } },
  { label: 'Vent arrière +10 % / 2 kt', rule: { type: 'tailwind', mode: 'percent_per_step', value: 10, stepKt: 2 } },
  { label: 'Herbe +15 %', rule: { type: 'grass', mode: 'percent_fixed', value: 15, stepKt: null } },
];

const PHASES = [
  { key: 'takeoff', label: 'Décollage', Icon: TakeoffIcon },
  { key: 'landing', label: 'Atterrissage', Icon: LandingIcon },
];

const EMPTY_BRACKETS = [{ fromKt: '', value: '' }, { fromKt: '', value: '' }, { fromKt: '', value: '' }];
const EMPTY_DRAFT = { type: 'headwind', mode: 'factor_per_step', value: '', stepKt: '', appliesTo: 'takeoff', label: '', brackets: EMPTY_BRACKETS };

const PerformanceCorrectionsEditor = ({ corrections = [], onChange }) => {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const isWindType = draft.type === 'headwind' || draft.type === 'tailwind';
  const isTableMode = isWindType && (draft.mode === 'factor_table' || draft.mode === 'percent_table');
  const needsStep = isWindType && draft.mode !== 'percent_fixed' && !isTableMode;

  const paliersValides = (draft.brackets || []).filter(
    (b) => b.fromKt !== '' && b.value !== '' && Number.isFinite(Number(b.fromKt)) && Number.isFinite(Number(b.value))
  );
  const setBracket = (i, champ, v) => setDraft((d) => {
    const b = [...(d.brackets || [])];
    b[i] = { ...b[i], [champ]: v };
    return { ...d, brackets: b };
  });

  const addRule = (rule) => {
    const id = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([...(corrections || []), { id, label: '', ...rule }]);
  };

  const removeRule = (id) => onChange((corrections || []).filter((c) => c.id !== id));

  // Une règle du même type existe-t-elle déjà pour cette phase ? Le moteur
  // refuse d'appliquer des règles ambiguës : autant l'empêcher à la saisie.
  // Retour pilote 20/08 : le message doit dire QUELLE règle bloque et pour
  // QUELLE phase — le formulaire compare à la phase sélectionnée ci-dessus
  // (défaut « Décollage »), pas à la colonne qu'on regarde.
  const collisions = isWindType
    ? (corrections || []).filter(
        (c) => c.type === draft.type
          && (c.appliesTo === draft.appliesTo || c.appliesTo === 'both' || draft.appliesTo === 'both')
      )
    : [];
  const dejaPresent = collisions.length > 0;
  const phaseLabel = (p) => APPLIES_OPTIONS.find((o) => o.value === p)?.label || p;

  const canAddDraft = !dejaPresent && (isTableMode
    ? paliersValides.length >= 1
    : draft.value !== '' && Number.isFinite(Number(draft.value))
      && (!needsStep || (draft.stepKt !== '' && Number(draft.stepKt) > 0)));

  const handleAddDraft = () => {
    if (!canAddDraft) return;
    if (isTableMode) {
      addRule({
        type: draft.type,
        mode: draft.mode,
        brackets: paliersValides
          .map((b) => ({ fromKt: Number(b.fromKt), value: Number(b.value) }))
          .sort((a, b) => a.fromKt - b.fromKt),
        value: null,
        stepKt: null,
        appliesTo: draft.appliesTo,
        label: draft.label.trim(),
      });
    } else {
      addRule({
        type: draft.type,
        mode: isWindType ? draft.mode : 'percent_fixed',
        value: Number(draft.value),
        stepKt: needsStep ? Number(draft.stepKt) : null,
        appliesTo: draft.appliesTo,
        label: draft.label.trim(),
      });
    }
    setDraft({ ...EMPTY_DRAFT, brackets: EMPTY_BRACKETS.map((b) => ({ ...b })), appliesTo: draft.appliesTo });
  };

  const rulesForPhase = (phase) =>
    (corrections || []).filter((c) => c.appliesTo === phase || c.appliesTo === 'both');

  return (
    <Paper elevation={0} sx={{ mt: 4, p: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SpeedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Facteurs correctifs du manuel
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Quand le manuel donne des facteurs plutôt que des tableaux. Les facteurs
        du <strong>décollage</strong> et de l'<strong>atterrissage</strong> se saisissent
        séparément — ils diffèrent presque toujours. Appliqués aux distances calculées
        en préparation de vol, avec le détail du calcul affiché au pilote.
        Arrondis conservateurs : vent arrière dès la tranche entamée, vent de face
        par tranche complète uniquement.
      </Typography>

      {/* Deux colonnes indépendantes : décollage / atterrissage */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        {PHASES.map(({ key, label, Icon }) => {
          const rules = rulesForPhase(key);
          return (
            <Box key={key} sx={{
              flex: '1 1 320px', minWidth: 300, p: 1.5,
              border: '1px solid', borderColor: 'divider', borderRadius: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Icon fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600}>{label}</Typography>
              </Box>

              {rules.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Aucun facteur — les distances calculées seront utilisées telles quelles.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                  {rules.map((c) => (
                    <Box key={c.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      p: 0.75, borderRadius: 1, bgcolor: 'var(--bg-overlay)'
                    }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {describeCorrection({ ...c, appliesTo: c.appliesTo })}
                      </Typography>
                      {c.appliesTo === 'both' && (
                        <Chip label="2 phases" size="small" variant="outlined" sx={{ height: 20 }} />
                      )}
                      <IconButton size="small" onClick={() => removeRule(c.id)} aria-label={`Supprimer : ${describeCorrection(c)}`}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <Chip
                    key={p.label}
                    label={p.label}
                    size="small"
                    variant="outlined"
                    icon={<AddIcon />}
                    onClick={() => addRule({ ...p.rule, appliesTo: key })}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }}>
        <Typography variant="caption" color="text.secondary">Règle détaillée</Typography>
      </Divider>

      {/* Saisie libre — la phase est un choix EXPLICITE */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TextField select size="small" label="Phase" value={draft.appliesTo}
          onChange={(e) => setDraft((d) => ({ ...d, appliesTo: e.target.value }))}
          sx={{ minWidth: 160 }}>
          {APPLIES_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Condition" value={draft.type}
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          sx={{ minWidth: 170 }}>
          {TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        {isWindType && (
          <TextField select size="small" label="Forme" value={draft.mode}
            onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value }))}
            sx={{ minWidth: 200 }}>
            {MODE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
        )}
        {!isTableMode && (
          <TextField size="small" type="number"
            label={draft.mode === 'factor_per_step' && isWindType ? 'Facteur (ex. 0,85)' : 'Pourcentage (ex. 15)'}
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
            sx={{ width: 160 }} inputProps={{ step: 'any' }} />
        )}
        {needsStep && (
          <TextField size="small" type="number" label="Tranche (kt)" value={draft.stepKt}
            onChange={(e) => setDraft((d) => ({ ...d, stepKt: e.target.value }))}
            sx={{ width: 120 }} inputProps={{ min: 1, step: 'any' }} />
        )}
        <TextField size="small" label="Libellé (optionnel)" value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          sx={{ minWidth: 170 }} />
        <Button variant="outlined" size="small" startIcon={<AddIcon />}
          onClick={handleAddDraft} disabled={!canAddDraft} sx={{ mt: 0.25 }}>
          Ajouter
        </Button>
      </Box>

      {isTableMode && (
        <Box sx={{ mt: 2, pl: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Recopiez les paliers <strong>tels quels</strong> depuis le manuel — par exemple
            « pour 10 kt ×0,85, pour 20 kt ×0,65, pour 30 kt ×0,55 ». Le moteur <strong>lit</strong> le
            palier atteint, il ne cumule jamais les lignes. Entre deux paliers il garde le palier
            inférieur, et il ne corrige rien sous le premier.
          </Typography>
          {(draft.brackets || []).map((b, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 28 }}>{`#${i + 1}`}</Typography>
              <TextField size="small" type="number" label="À partir de (kt)" value={b.fromKt}
                onChange={(e) => setBracket(i, 'fromKt', e.target.value)}
                sx={{ width: 150 }} inputProps={{ min: 0, step: 'any' }} />
              <TextField size="small" type="number"
                label={draft.mode === 'factor_table' ? 'Facteur (ex. 0,85)' : 'Pourcentage (ex. 15)'}
                value={b.value}
                onChange={(e) => setBracket(i, 'value', e.target.value)}
                sx={{ width: 170 }} inputProps={{ step: 'any' }} />
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />}
            onClick={() => setDraft((d) => ({ ...d, brackets: [...(d.brackets || []), { fromKt: '', value: '' }] }))}>
            Ajouter un palier
          </Button>
        </Box>
      )}

      {dejaPresent && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1.5 }}>
          Le formulaire est réglé sur « {phaseLabel(draft.appliesTo)} », et une règle
          « {CORRECTION_TYPES[draft.type]?.label} » y existe déjà :
          {' '}{collisions.map((c) => `${describeCorrection(c)} (${phaseLabel(c.appliesTo)})`).join(' ; ')}.
          Deux règles du même type se multiplieraient au lieu de se lire — le moteur refuserait
          de les appliquer. Pour l'autre phase, changez « Phase » ci-dessus ; sinon supprimez
          l'existante ou complétez-la avec des paliers.
        </Typography>
      )}
    </Paper>
  );
};

export default PerformanceCorrectionsEditor;
