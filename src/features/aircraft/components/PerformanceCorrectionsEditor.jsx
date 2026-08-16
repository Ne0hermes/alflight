// src/features/aircraft/components/PerformanceCorrectionsEditor.jsx
// ============================================================================
// ✈️ FACTEURS CORRECTIFS DE PERFORMANCE — éditeur du wizard (admin)
// ----------------------------------------------------------------------------
// Saisie des règles du manuel de vol quand celui-ci donne des FACTEURS et non
// des tableaux : « ×0,85 par 10 kt de vent de face », « +10 % par 2 kt de
// vent arrière », « +15 % piste en herbe »… Stocké dans
// aircraft.performanceCorrections, appliqué (avec détail visuel) dans le
// module Performance de la préparation de vol. Voir utils/performanceCorrections.
// ============================================================================

import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, TextField, MenuItem, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { CORRECTION_TYPES, describeCorrection } from '@utils/performanceCorrections';

const TYPE_OPTIONS = Object.entries(CORRECTION_TYPES).map(([value, t]) => ({ value, label: t.label }));

const MODE_OPTIONS = [
  { value: 'percent_fixed', label: '± % fixe' },
  { value: 'percent_per_step', label: '± % par tranche de vent' },
  { value: 'factor_per_step', label: '× facteur par tranche de vent' },
];

const APPLIES_OPTIONS = [
  { value: 'both', label: 'Décollage et atterrissage' },
  { value: 'takeoff', label: 'Décollage' },
  { value: 'landing', label: 'Atterrissage' },
];

// Les trois cas classiques des manuels — pré-remplissage en un clic
const PRESETS = [
  { label: 'Vent de face : ×0,85 / 10 kt', rule: { type: 'headwind', mode: 'factor_per_step', value: 0.85, stepKt: 10, appliesTo: 'both' } },
  { label: 'Vent arrière : +10 % / 2 kt', rule: { type: 'tailwind', mode: 'percent_per_step', value: 10, stepKt: 2, appliesTo: 'both' } },
  { label: 'Piste en herbe : +15 %', rule: { type: 'grass', mode: 'percent_fixed', value: 15, stepKt: null, appliesTo: 'both' } },
];

const EMPTY_DRAFT = { type: 'headwind', mode: 'factor_per_step', value: '', stepKt: '', appliesTo: 'both', label: '' };

const PerformanceCorrectionsEditor = ({ corrections = [], onChange }) => {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const isWindType = draft.type === 'headwind' || draft.type === 'tailwind';
  const needsStep = isWindType && draft.mode !== 'percent_fixed';

  const addRule = (rule) => {
    const id = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([...(corrections || []), { id, label: '', ...rule }]);
  };

  const canAddDraft = draft.value !== '' && Number.isFinite(Number(draft.value))
    && (!needsStep || (draft.stepKt !== '' && Number(draft.stepKt) > 0));

  const handleAddDraft = () => {
    if (!canAddDraft) return;
    addRule({
      type: draft.type,
      mode: isWindType ? draft.mode : 'percent_fixed',
      value: Number(draft.value),
      stepKt: needsStep ? Number(draft.stepKt) : null,
      appliesTo: draft.appliesTo,
      label: draft.label.trim(),
    });
    setDraft(EMPTY_DRAFT);
  };

  const removeRule = (id) => onChange((corrections || []).filter((c) => c.id !== id));

  return (
    <Paper elevation={0} sx={{ mt: 4, p: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SpeedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Facteurs correctifs du manuel
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Quand le manuel donne des facteurs plutôt que des tableaux (vent de face,
        vent arrière, piste en herbe…). Appliqués aux distances calculées dans la
        préparation de vol, avec le détail du calcul affiché au pilote.
        Arrondis conservateurs : vent arrière dès la tranche entamée, vent de
        face par tranche complète uniquement.
      </Typography>

      {/* Règles existantes */}
      {(corrections || []).length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
          {corrections.map((c) => (
            <Box key={c.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              p: 1, borderRadius: 1, bgcolor: 'var(--bg-overlay)'
            }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{describeCorrection(c)}</Typography>
              <IconButton size="small" onClick={() => removeRule(c.id)} aria-label="Supprimer cette règle">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Pré-réglages classiques */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {PRESETS.map((p) => (
          <Chip key={p.label} label={p.label} size="small" variant="outlined"
            onClick={() => addRule(p.rule)} icon={<AddIcon />} />
        ))}
      </Box>

      {/* Saisie libre */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
        <TextField size="small" type="number" label={draft.mode === 'factor_per_step' && isWindType ? 'Facteur (ex. 0,85)' : 'Pourcentage (ex. 15)'}
          value={draft.value}
          onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          sx={{ width: 160 }} inputProps={{ step: 'any' }} />
        {needsStep && (
          <TextField size="small" type="number" label="Tranche (kt)" value={draft.stepKt}
            onChange={(e) => setDraft((d) => ({ ...d, stepKt: e.target.value }))}
            sx={{ width: 120 }} inputProps={{ min: 1, step: 'any' }} />
        )}
        <TextField select size="small" label="S'applique à" value={draft.appliesTo}
          onChange={(e) => setDraft((d) => ({ ...d, appliesTo: e.target.value }))}
          sx={{ minWidth: 200 }}>
          {APPLIES_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Libellé (optionnel)" value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          sx={{ minWidth: 170 }} />
        <Button variant="outlined" size="small" startIcon={<AddIcon />}
          onClick={handleAddDraft} disabled={!canAddDraft} sx={{ mt: 0.25 }}>
          Ajouter
        </Button>
      </Box>
    </Paper>
  );
};

export default PerformanceCorrectionsEditor;
