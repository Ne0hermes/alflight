import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Paper,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Stepper,
  Step,
  StepLabel,
  CircularProgress
} from '@mui/material';
import {
  Update as UpdateIcon,
  History as HistoryIcon,
  Merge as MergeIcon,
  Add as AddIcon,
  CloudUpload as UploadIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const UpdateAircraftDialog = ({
  open,
  onClose,
  existingData,
  newData,
  onConfirm
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [updateMode, setUpdateMode] = useState('update'); // 'update', 'variant', 'replace'
  const [updateReason, setUpdateReason] = useState('');
  const [showDifferences, setShowDifferences] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ['Choisir l\'action', 'Décrire les changements', 'Confirmer'];

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Simuler l'envoi
    setTimeout(() => {
      onConfirm({
        mode: updateMode,
        reason: updateReason,
        data: newData
      });
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };

  const calculateDifferences = () => {
    if (!existingData || !newData) return [];

    const differences = [];
    const allKeys = new Set([
      ...Object.keys(existingData),
      ...Object.keys(newData)
    ]);

    allKeys.forEach(key => {
      if (existingData[key] !== newData[key]) {
        differences.push({
          field: key,
          old: existingData[key],
          new: newData[key]
        });
      }
    });

    return differences;
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 2 }}>
                Comment souhaitez-vous procéder ?
              </FormLabel>
              <RadioGroup
                value={updateMode}
                onChange={(e) => setUpdateMode(e.target.value)}
              >
                <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: updateMode === 'update' ? 'primary.50' : 'grey.50' }}>
                  <FormControlLabel
                    value="update"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          <UpdateIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 1 }} />
                          Mettre à jour la configuration existante
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Proposer une mise à jour qui sera soumise à validation communautaire.
                          Les changements seront fusionnés après approbation (10 votes positifs).
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>

                <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: updateMode === 'variant' ? 'primary.50' : 'grey.50' }}>
                  <FormControlLabel
                    value="variant"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          <AddIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 1 }} />
                          Créer une variante
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Créer une configuration spécifique pour votre avion modifié
                          (ex: équipements supplémentaires, modifications STC).
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>

                <Paper elevation={0} sx={{ p: 2, bgcolor: updateMode === 'replace' ? 'warning.50' : 'grey.50' }}>
                  <FormControlLabel
                    value="replace"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          <MergeIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 1 }} />
                          Remplacer complètement
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Remplacer toutes les données existantes (nécessite 20 votes positifs).
                          Utilisé pour corrections majeures ou refonte complète.
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            <Button
              variant="text"
              onClick={() => setShowDifferences(!showDifferences)}
              sx={{ mt: 2 }}
            >
              {showDifferences ? 'Masquer' : 'Voir'} les différences détectées
            </Button>

            {showDifferences && (
              <Paper elevation={0} sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Changements détectés :
                </Typography>
                <List dense>
                  {calculateDifferences().map((diff, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={diff.field}
                        secondary={
                          <span>
                            <span style={{ color: '#d32f2f' }}>{diff.old || 'Non défini'}</span>
                            {' → '}
                            <span style={{ color: '#388e3c' }}>{diff.new || 'Non défini'}</span>
                          </span>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Décrivez les changements apportés
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={updateReason}
              onChange={(e) => setUpdateReason(e.target.value)}
              placeholder="Ex: Mise à jour des performances après révision moteur, ajout d'équipements avionique, correction des données de masse..."
              variant="outlined"
              helperText="Cette description aidera la communauté à comprendre et valider vos modifications"
              sx={{ mb: 2 }}
            />

            {updateMode === 'update' && (
              <Alert severity="info">
                <Typography variant="body2">
                  Votre mise à jour sera visible par tous les utilisateurs et pourra être validée
                  par la communauté. Une fois approuvée, elle remplacera la version actuelle.
                </Typography>
              </Alert>
            )}

            {updateMode === 'variant' && (
              <Alert severity="warning">
                <Typography variant="body2">
                  Une variante créera une configuration séparée liée à l'avion principal.
                  Elle apparaîtra comme "{existingData?.registration}-VAR1" dans la base de données.
                </Typography>
              </Alert>
            )}

            {updateMode === 'replace' && (
              <Alert severity="error">
                <Typography variant="body2">
                  Le remplacement complet nécessite une validation renforcée (20 votes).
                  Toutes les données existantes seront archivées mais resteront consultables.
                </Typography>
              </Alert>
            )}
          </Box>

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirmation
            </Typography>

            <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Action sélectionnée :
              </Typography>
              <Chip
                label={
                  updateMode === 'update' ? 'Mise à jour' :
                  updateMode === 'variant' ? 'Variante' : 'Remplacement'
                }
                color={updateMode === 'replace' ? 'warning' : 'primary'}
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" gutterBottom>
                Raison du changement :
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
                "{updateReason}"
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Prochaines étapes :
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Soumission à la communauté"
                    secondary="Votre proposition sera visible immédiatement"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Phase de validation"
                    secondary={`${updateMode === 'replace' ? '20' : '10'} votes positifs nets requis`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <HistoryIcon color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Historique préservé"
                    secondary="Toutes les versions restent consultables"
                  />
                </ListItem>
              </List>
            </Paper>

            {isSubmitting && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress />
              </Box>
            )}
          </Box>

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UpdateIcon color="primary" />
          Mise à jour de {existingData?.registration}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Annuler
        </Button>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || isSubmitting}
        >
          Retour
        </Button>
        <Button
          onClick={handleNext}
          variant="contained"
          disabled={
            (activeStep === 1 && !updateReason) ||
            isSubmitting
          }
        >
          {activeStep === steps.length - 1 ?
            (isSubmitting ? 'Envoi...' : 'Confirmer') :
            'Suivant'
          }
        </Button>
      </DialogActions>
    </Dialog>
};

export default UpdateAircraftDialog;