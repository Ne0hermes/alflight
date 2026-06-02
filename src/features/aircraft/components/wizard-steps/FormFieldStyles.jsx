// ─────────────────────────────────────────────────────────────────────────────
//  FormFieldStyles — Wrappers MUI du wizard avion
//  ----------------------------------------------------------------------------
//  Depuis la refonte v3 du thème ALFlight (src/styles/muiTheme.js), le PATTERN
//  STACKED LABEL CENTRÉ est désormais porté GLOBALEMENT par le thème MUI :
//
//    • Tous les <MuiInputLabel> sont stackés AU-DESSUS de l'input (jamais
//      chevauchés sur la bordure du fieldset).
//    • Tous les <MuiOutlinedInput> centrent leur texte input.
//    • Police, taille, espacement, encart noir disparu — TOUT est uniformisé
//      via le thème, plus besoin de redéclarer ici.
//
//  Ce fichier ne sert plus qu'à :
//    1) Conserver la rétrocompatibilité d'import (StyledFormControl,
//       StyledTextField sont importés dans 30+ endroits du wizard).
//    2) Fournir les configs par défaut (`formControlConfig`, `textFieldConfig`)
//       avec largeur max + centrage horizontal (mx: 'auto') pour les blocs
//       d'inputs centrés du wizard.
//
//  Ne PAS ajouter de styles ici — modifier muiTheme.js à la place pour que
//  toute l'application bénéficie de la cohérence.
// ─────────────────────────────────────────────────────────────────────────────

import { styled } from '@mui/material/styles';
import { FormControl, TextField } from '@mui/material';

// Alias pass-through (le thème global fait tout le travail)
export const StyledFormControl = styled(FormControl)({});
export const StyledTextField = styled(TextField)({});

// Configuration par défaut pour les FormControl (Select + Label)
// Centré horizontalement via mx auto.
export const formControlConfig = {
  fullWidth: true,
  size: 'small',
  sx: { maxWidth: 350, mx: 'auto' }
};

// Configuration par défaut pour les TextField
// Centré horizontalement via mx auto.
export const textFieldConfig = {
  fullWidth: true,
  size: 'small',
  sx: { maxWidth: 400, mx: 'auto' }
};
