import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  GroupWork as ClubIcon,
  Verified as VerifiedIcon
} from '@mui/icons-material';
import {
  getAllAeroclubs,
  addUserAeroclub,
  searchAeroclubs
} from '../../../utils/aeroclubsService';

/**
 * Autocomplete for selecting an aeroclub from the merged FFA + user-added
 * catalog. Supports `freeSolo` and offers a "+ Ajouter ce club" action when
 * the typed value does not match any entry.
 *
 * Props:
 *   value         (string)  — current aeroclub NAME (we store the name)
 *   onChange      (fn)      — called with the new aeroclub name (string) or null
 *   onSelectIcao  (fn)      — optional callback called with the ICAO of the
 *                             selected aeroclub (when known). Used by the
 *                             parent to auto-fill the « Terrain de base » field.
 *   label         (string)  — input label (default "Aéroclub d'attache")
 *   helperText    (string)  — input helper text
 *   error         (boolean)
 *   required      (boolean)
 *   fullWidth     (boolean) default true
 *   sx            (object)
 */
const AeroclubAutocomplete = ({
  value,
  onChange,
  onSelectIcao,
  label = "Aéroclub d'attache",
  helperText,
  error,
  required = false,
  fullWidth = true,
  sx
}) => {
  const [inputValue, setInputValue] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', icao: '', city: '', region: '' });

  // Reload merged list on each input change (cheap; localStorage)
  const options = useMemo(() => {
    // refreshKey is intentionally referenced to invalidate memo after a new add
    void refreshKey;
    if (!inputValue) return getAllAeroclubs().slice(0, 100);
    return searchAeroclubs(inputValue, { limit: 80 });
  }, [inputValue, refreshKey]);

  // Find the currently-selected option object (so we can show extra info)
  const selectedOption = useMemo(() => {
    if (!value) return null;
    const all = getAllAeroclubs();
    return (
      all.find(
        (o) => (o.name || '').toLowerCase() === value.toLowerCase()
      ) || { name: value, _userAdded: true }
    );
  }, [value, refreshKey]);

  const handleOpenAddDialog = (prefillName = '') => {
    setDraft({ name: prefillName, icao: '', city: '', region: '' });
    setAddDialogOpen(true);
  };

  const handleSaveNew = () => {
    if (!draft.name || !draft.name.trim()) {
      return;
    }
    try {
      addUserAeroclub(draft);
      setRefreshKey((k) => k + 1);
      onChange?.(draft.name.trim());
      // Propage aussi l'OACI si l'utilisateur l'a renseigné dans le dialog
      if (draft.icao && onSelectIcao) {
        onSelectIcao(draft.icao);
      }
      setAddDialogOpen(false);
    } catch (err) {
      console.error('[AeroclubAutocomplete] add failed:', err);
      alert(err.message || "Erreur lors de l'ajout de l'aéroclub");
    }
  };

  return (
    <>
      <Autocomplete
        fullWidth={fullWidth}
        value={selectedOption}
        inputValue={inputValue}
        onInputChange={(_, v) => setInputValue(v)}
        onChange={(_, newValue) => {
          if (!newValue) {
            onChange?.(null);
            return;
          }
          // String case (freeSolo typed value, no match)
          if (typeof newValue === 'string') {
            // Prompt to formalize the new entry
            handleOpenAddDialog(newValue);
            return;
          }
          // "Create new" action item
          if (newValue.__createNew) {
            handleOpenAddDialog(newValue.inputValue || inputValue);
            return;
          }
          onChange?.(newValue.name);
          // Propage le code OACI au parent s'il est connu (auto-fill terrain
          // de base si le champ est encore vide).
          if (newValue.icao && onSelectIcao) {
            onSelectIcao(newValue.icao);
          }
        }}
        options={options}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option?.name || '';
        }}
        isOptionEqualToValue={(option, val) =>
          (option?.name || '').toLowerCase() ===
          (val?.name || val || '').toString().toLowerCase()
        }
        filterOptions={(opts, params) => {
          // Add a "Create new" suggestion when the typed value doesn't match
          const filtered = opts;
          const typed = (params.inputValue || '').trim();
          if (
            typed &&
            !opts.some(
              (o) => (o.name || '').toLowerCase() === typed.toLowerCase()
            )
          ) {
            filtered.push({
              __createNew: true,
              inputValue: typed,
              name: `+ Ajouter "${typed}" comme nouvel aéroclub`
            });
          }
          return filtered;
        }}
        renderOption={(props, option) => {
          if (option.__createNew) {
            return (
              <li {...props} key="__create_new__">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main', fontWeight: 600 }}>
                  <AddIcon fontSize="small" />
                  <Typography variant="body2">{option.name}</Typography>
                </Box>
              </li>
            );
          }
          return (
            <li {...props} key={`${option.name}-${option.icao || ''}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <ClubIcon
                  fontSize="small"
                  sx={{ color: option._userAdded ? 'secondary.main' : 'primary.main' }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[option.icao, option.city, option.region]
                      .filter(Boolean)
                      .join(' • ')}
                  </Typography>
                </Box>
                {option._userAdded ? (
                  <Chip
                    label="Perso"
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ) : (
                  <VerifiedIcon fontSize="small" sx={{ color: 'success.main' }} />
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Tapez pour rechercher ou ajouter…"
            error={error}
            helperText={
              helperText ||
              "Sélectionnez votre aéroclub. Si absent, tapez son nom et cliquez « Ajouter »."
            }
            required={required}
            InputLabelProps={{ shrink: true }}
          />
        )}
        freeSolo
        clearOnBlur={false}
        handleHomeEndKeys
        sx={sx}
      />

      {/* Dialog d'ajout d'un nouvel aéroclub */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon color="primary" />
          Ajouter un aéroclub
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cet aéroclub sera ajouté à votre liste personnelle et restera
            disponible dans toutes vos futures sélections.
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Nom du club *"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Aéroclub des Trois Vallées"
                autoFocus
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Code OACI du terrain"
                value={draft.icao}
                onChange={(e) =>
                  setDraft({ ...draft, icao: e.target.value.toUpperCase() })
                }
                placeholder="Ex: LFPN"
                inputProps={{ maxLength: 4 }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Ville"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                placeholder="Ex: Toussus-le-Noble"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Région"
                value={draft.region}
                onChange={(e) =>
                  setDraft({ ...draft, region: e.target.value })
                }
                placeholder="Ex: Île-de-France"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleSaveNew}
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled={!draft.name || !draft.name.trim()}
          >
            Ajouter le club
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AeroclubAutocomplete;
