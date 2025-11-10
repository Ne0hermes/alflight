import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Autocomplete,
  Button,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Collapse,
  IconButton,
  Snackbar,
  LinearProgress,
  Dialog,
  DialogContent,
  DialogTitle
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudDownload as CloudIcon,
  CheckCircle as CheckIcon,
  Flight as FlightIcon,
  Info as InfoIcon,
  Add as AddIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  ExpandMore as ExpandMoreIcon,
  HowToVote as VoteIcon,
  Group as GroupIcon,
  MenuBook as ManualIcon,
  VerifiedUser as AdminIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { useAircraftStore } from '@core/stores/aircraftStore';
import communityService from '../../../../services/communityService';
import dataBackupManager from '../../../../utils/dataBackupManager';
import CleanDuplicatesButton from '../../../../components/CleanDuplicatesButton';

const Step0CommunityCheck = ({ data, updateData, onSkip, onComplete, onCancel }) => {
  const [searchValue, setSearchValue] = useState(data.searchRegistration || '');
  const [isLoading, setIsLoading] = useState(false);
  const [communityAircraft, setCommunityAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false); // Réduit par défaut
  const [userVotes, setUserVotes] = useState({}); // Simule les votes de l'utilisateur
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Récupérer les fonctions du store
  const { addAircraft } = useAircraftStore();

  // Simuler le chargement des avions depuis la base de données communautaire
  useEffect(() => {
    loadCommunityAircraft();
  }, []);

  // Si on revient de l'étape 1 avec une immatriculation, la pré-sélectionner
  useEffect(() => {
    if (data.searchRegistration && communityAircraft.length > 0) {
      const found = communityAircraft.find(ac => ac.registration === data.searchRegistration);
      if (found) {
        setSelectedAircraft(found);
        setSearchValue(data.searchRegistration);
      }
      // Nettoyer après utilisation
      updateData('searchRegistration', '');
    }
  }, [data.searchRegistration, communityAircraft]);

  const loadCommunityAircraft = async () => {
    setIsLoading(true);
    try {
      
      const presets = await communityService.getAllPresets();

      // Transformer les presets Supabase au format attendu par le composant
      // NOTE: communityService.getAllPresets() retourne déjà aircraftData (mappé)
      const formattedAircraft = presets.map(preset => {
        return {
          ...preset,  // Garder TOUT ce qui vient de communityService (incluant aircraftData)
          // Ajouter/overwrite seulement ce qui est nécessaire pour l'affichage
          type: preset.type || preset.aircraftType
        };
      });

      
      setCommunityAircraft(formattedAircraft);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des avions:', error);
      setCommunityAircraft([]);
    } finally {
      setIsLoading(false);
    }
  };

  /* DÉSACTIVÉ - Oblige l'utilisateur à vérifier les données via l'import personnalisé
  // Import direct sans passer par le wizard
  const handleDirectImport = async (aircraft) => {
    setIsImporting(true);

    try {
      

      // 1. Enregistrer le téléchargement dans Supabase
      await communityService.recordDownload(aircraft.id, 'current-user-id');

      // 2. Récupérer les données complètes depuis aircraft_data
      const fullAircraftData = aircraft.aircraftData || {};

      

      // 3. Créer le nouvel avion avec TOUTES les données depuis aircraft_data
      // IMPORTANT: Ne pas écraser les données de fullAircraftData, les utiliser telles quelles
      const timestamp = Date.now();
      const newAircraft = {
        // Données complètes depuis Supabase (PRIORITY)
        ...fullAircraftData,

        // Générer un nouvel ID local unique (ne pas réutiliser l'ID Supabase!)
        id: `aircraft-${timestamp}`,
        aircraftId: `aircraft-${timestamp}`,

        // Métadonnées d'import (ne pas écraser les données existantes)
        importedFrom: 'community',
        importedFromCommunity: true,
        communityPresetId: aircraft.id,
        originalCommunityId: aircraft.id,  // Conserver l'ID Supabase pour référence
        communityVersion: aircraft.version,
        dateImported: new Date().toISOString(),
      };

      

      // 4. Sauvegarder directement sans télécharger le MANEX
      // Le MANEX sera uploadé manuellement par l'utilisateur dans l'étape 1 du wizard
      await saveAndAddAircraft(newAircraft);

    } catch (error) {
      console.error('❌ Erreur lors de l\'import direct:', error);
      setNotificationMessage(`❌ Erreur lors de l'import: ${error.message}`);
      setShowSuccessNotification(true);
      setIsImporting(false);
    }
  };
  */

  // Fonction helper pour sauvegarder et ajouter l'avion
  const saveAndAddAircraft = async (aircraft) => {
    await dataBackupManager.saveAircraftData(aircraft);
    

    const result = addAircraft(aircraft);

    if (result !== null) {
      setNotificationMessage(`✅ L'avion ${aircraft.registration} (${aircraft.model}) a été ajouté`);
      setShowSuccessNotification(true);

      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2000);
    } else {
      setNotificationMessage(`⚠️ L'avion ${aircraft.registration} existe déjà dans votre liste`);
      setShowSuccessNotification(true);
    }

    setIsImporting(false);
  };

  const handleImportAircraft = async (aircraft) => {
    setIsImporting(true);
    setSelectedAircraft(aircraft);
    setShowDownloadDialog(true);
    setDownloadProgress(0);
    setDownloadStatus('Initialisation...');

    try {
      

      // 1. Enregistrer le téléchargement dans Supabase
      setDownloadStatus('Enregistrement du téléchargement...');
      setDownloadProgress(10);
      await communityService.recordDownload(aircraft.id, 'current-user-id');

      // 2. Récupérer les données complètes depuis Supabase (avec téléchargement automatique du MANEX)
      setDownloadStatus('Téléchargement des données de l\'avion...');
      setDownloadProgress(30);
      const fullAircraftData = await communityService.getPresetById(aircraft.id);

      setDownloadProgress(70);

      

      // 3. Préparer les données pour le wizard
      // IMPORTANT: Utiliser les données de fullAircraftData EN PRIORITÉ
      const communityData = {
        // Toutes les données depuis Supabase (PRIORITY)
        ...fullAircraftData,

        // Marqueurs d'import (ne pas écraser les données existantes)
        importedFromCommunity: true,
        communityPresetId: aircraft.id,
        communityVersion: aircraft.version,
        importDate: new Date().toISOString()
      };

      

      // 4. Importer avec le MANEX s'il est disponible
      setDownloadStatus(communityData.manex ? 'Préparation des données avec MANEX...' : 'Préparation des données...');
      setDownloadProgress(90);
      

      // Petit délai pour afficher le statut final
      await new Promise(resolve => setTimeout(resolve, 500));

      setDownloadStatus('Terminé !');
      setDownloadProgress(100);

      // Logger vers Google Sheets
      try {
        const logData = {
          action: 'DOWNLOAD_AIRCRAFT',
          component: 'Step0CommunityCheck',
          summary: `Téléchargement de l'avion ${aircraft.registration} (${aircraft.model})`,
          details: {
            registration: aircraft.registration,
            model: aircraft.model,
            manufacturer: aircraft.manufacturer || fullAircraftData.manufacturer,
            hasManex: !!communityData.manex,
            manexFileName: communityData.manex?.fileName,
            manexFileSize: communityData.manex?.fileSize,
            dataSize: JSON.stringify(fullAircraftData).length,
            supabaseId: aircraft.id
          },
          status: 'success'
        };

        await fetch('http://localhost:3001/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        }).catch(err => console.error('Error logging to server:', err));
      } catch (logError) {
        console.error('Error in logging attempt:', logError);
      }

      // Fermer le dialog après un court délai
      setTimeout(() => {
        setShowDownloadDialog(false);
        importAircraftData(communityData, aircraft);
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      setDownloadStatus(`Erreur: ${error.message}`);
      setDownloadProgress(0);

      // Logger l'erreur vers Google Sheets
      try {
        const errorLogData = {
          action: 'DOWNLOAD_AIRCRAFT_ERROR',
          component: 'Step0CommunityCheck',
          summary: `Erreur lors du téléchargement de ${aircraft.registration}`,
          details: {
            registration: aircraft.registration,
            model: aircraft.model,
            errorMessage: error.message,
            errorStack: error.stack?.substring(0, 500)
          },
          status: 'error'
        };

        await fetch('http://localhost:3001/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorLogData)
        }).catch(err => console.error('Error logging to server:', err));
      } catch (logError) {
        console.error('Error in logging attempt:', logError);
      }

      setTimeout(() => {
        setShowDownloadDialog(false);
        alert(`Erreur lors de l'importation: ${error.message}`);
        setIsImporting(false);
      }, 2000);
    }
  };

  // Fonction helper pour importer les données dans le wizard
  const importAircraftData = (communityData, aircraft) => {
    // Créer le snapshot baseAircraft AVANT toute modification
    
    const baseSnapshot = JSON.parse(JSON.stringify(communityData));

    // Importer toutes les données dans le wizard
    Object.keys(communityData).forEach(key => {
      updateData(key, communityData[key]);
    });

    updateData('isImportedFromCommunity', true);
    updateData('originalCommunityData', communityData);
    updateData('baseAircraft', baseSnapshot); // Snapshot pour comparaison

    setIsImporting(false);

    // Passer directement à l'étape suivante du wizard
    if (onSkip) onSkip();
  };

  const handleVote = async (aircraftReg, voteType) => {
    try {
      // Trouver l'avion
      const aircraft = communityAircraft.find(a => a.registration === aircraftReg);
      if (!aircraft) return;

      

      // Envoyer le vote à Supabase
      await communityService.votePreset(
        aircraft.id,
        'current-user-id', // En prod: récupérer l'ID utilisateur réel
        voteType
      );

      // Mettre à jour l'état local du vote utilisateur
      setUserVotes(prev => ({
        ...prev,
        [aircraftReg]: voteType
      }));

      // Mettre à jour les votes dans la liste localement
      setCommunityAircraft(prev =>
        prev.map(a => {
          if (a.registration === aircraftReg) {
            const currentUserVote = userVotes[aircraftReg];
            let updatedVotes = { ...a.votes };

            // Annuler le vote précédent
            if (currentUserVote === 'up') updatedVotes.up--;
            if (currentUserVote === 'down') updatedVotes.down--;

            // Appliquer le nouveau vote
            if (voteType === 'up') updatedVotes.up++;
            if (voteType === 'down') updatedVotes.down++;

            // Vérifier si l'avion atteint le seuil de validation
            const netVotes = updatedVotes.up - updatedVotes.down;
            const verified = netVotes >= 10;

            return { ...a, votes: updatedVotes, verified };
          }
          return a;
        })
      );

    } catch (error) {
      console.error('❌ Erreur lors du vote:', error);
      alert(`Erreur lors du vote: ${error.message}`);
    }
  };

  return (
    <Box>
      {/* Encart explicatif */}
      <Collapse in={showExplanation}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'info.50',
            border: '2px solid',
            borderColor: 'info.200',
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.800' }}>
              <VoteIcon />
              Comment fonctionne la validation communautaire ?
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowExplanation(false)}
              sx={{
                bgcolor: 'grey.200',
                color: 'grey.700',
                '&:hover': {
                  bgcolor: 'grey.300'
                }
              }}
            >
              <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'info.800' }}>
                <GroupIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Contribution collaborative
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Les pilotes partagent leurs configurations d'avions
                <br />
                • Le manuel de vol est toujours inclus dans la configuration
                <br />
                • Les administrateurs vérifient la conformité avec les manuels officiels
                <br />
                • La communauté valide l'exactitude des données
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'info.800' }}>
                <ThumbUpIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                Système de validation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Les utilisateurs votent pour valider les données
                <br />
                • 10 votes positifs nets = configuration vérifiée ✓
                <br />
                • Les configurations vérifiées sont prioritaires
              </Typography>
            </Box>
          </Box>

        </Paper>
      </Collapse>

      {/* En-tête */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudIcon color="primary" />
          Recherchez votre avion dans notre base de données partagée
          {!showExplanation && (
            <IconButton
              size="small"
              onClick={() => setShowExplanation(true)}
              sx={{ ml: 'auto' }}
            >
              <InfoIcon />
            </IconButton>
          )}
        </Typography>
      </Box>

      {/* Barre de recherche */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Autocomplete
          value={searchValue}
          onChange={(event, newValue) => {
            setSearchValue(newValue);
            const found = communityAircraft.find(ac => ac.registration === newValue);
            if (found) setSelectedAircraft(found);
          }}
          inputValue={searchValue}
          onInputChange={(event, newInputValue) => {
            setSearchValue(newInputValue);
          }}
          options={communityAircraft.map(ac => ac.registration)}
          loading={isLoading}
          sx={{
            mb: 2,
            '& .MuiAutocomplete-endAdornment': {
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
            },
            '& .MuiAutocomplete-popupIndicator': {
              padding: '4px',
              width: '28px',
              height: '28px',
              '& .MuiSvgIcon-root': {
                fontSize: '20px',
              },
              '& .MuiTouchRipple-root': {
                width: '28px',
                height: '28px',
              }
            },
            '& .MuiAutocomplete-listbox': {
              maxWidth: '400px',
            }
          }}
          size="small"
          disableClearable
          disablePortal
          forcePopupIcon={false}
          ListboxProps={{
            style: { maxWidth: '400px' }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Rechercher par immatriculation"
              placeholder="Ex: F-GBYU"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: '40px',
                  paddingRight: '40px',
                }
              }}
              InputProps={{
                ...params.InputProps,
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                endAdornment: (
                  <>
                    {isLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {/* Statistiques */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            icon={<FlightIcon />}
            label={`${communityAircraft.length} avions disponibles`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<CheckIcon />}
            label={`${communityAircraft.filter(a => a.verified).length} vérifiés`}
            color="success"
            variant="outlined"
          />
        </Box>

        {/* Informations sur l'avion sélectionné */}
        {selectedAircraft && (
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                {selectedAircraft.registration}
                {selectedAircraft.verified && (
                  <Chip
                    icon={<CheckIcon />}
                    label="Vérifié"
                    color="success"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>

              {/* Système de vote */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  color={userVotes[selectedAircraft.registration] === 'up' ? 'success' : 'default'}
                  onClick={() => handleVote(selectedAircraft.registration, 'up')}
                  size="small"
                >
                  <ThumbUpIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
                  {selectedAircraft.votes.up - selectedAircraft.votes.down}
                </Typography>
                <IconButton
                  color={userVotes[selectedAircraft.registration] === 'down' ? 'error' : 'default'}
                  onClick={() => handleVote(selectedAircraft.registration, 'down')}
                  size="small"
                >
                  <ThumbDownIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
              <Typography variant="body2">
                <strong>Modèle :</strong> {selectedAircraft.model}
              </Typography>
              <Typography variant="body2">
                <strong>Type :</strong> {selectedAircraft.type}
              </Typography>
              <Typography variant="body2">
                <strong>Ajouté par :</strong> {selectedAircraft.addedBy}
              </Typography>
              <Typography variant="body2">
                <strong>Date :</strong> {new Date(selectedAircraft.dateAdded).toLocaleDateString()}
              </Typography>
              <Typography variant="body2">
                <strong>Téléchargements :</strong> {selectedAircraft.downloads}
              </Typography>
              <Typography variant="body2">
                <strong>Validation :</strong> {selectedAircraft.votes.up} ✓ / {selectedAircraft.votes.down} ✗
              </Typography>
              {selectedAircraft.version && (
                <Typography variant="body2">
                  <strong>Version :</strong> {selectedAircraft.version}
                </Typography>
              )}
              {selectedAircraft.hasFlightManual && (
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ManualIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <strong>Manuel de vol :</strong> {selectedAircraft.manualVersion}
                </Typography>
              )}
              {selectedAircraft.adminVerified && (
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AdminIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <span style={{ color: 'var(--mui-palette-success-main)' }}>
                    <strong>Vérifié par les administrateurs</strong>
                  </span>
                </Typography>
              )}
            </Box>

            {!selectedAircraft.verified && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="caption">
                  Cette configuration n'est pas encore vérifiée.
                  {10 - (selectedAircraft.votes.up - selectedAircraft.votes.down)} votes positifs nets encore nécessaires.
                </Typography>
              </Alert>
            )}

            {/* Options d'action */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2, mt: 2 }}>
              {/* Importer directement les données */}
              {/* DÉSACTIVÉ - Oblige l'utilisateur à vérifier les données via l'import personnalisé
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'primary.50',
                  border: '1px solid',
                  borderColor: 'primary.200',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'primary.100',
                    transform: 'translateY(-1px)',
                    boxShadow: 1
                  }
                }}
                onClick={() => handleDirectImport(selectedAircraft)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudIcon color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Importer directement
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ajouter immédiatement cet avion à votre liste (aucune modification possible)
                    </Typography>
                  </Box>
                </Box>
              </Paper>
              */}

              {/* Personnaliser/Créer une variante */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'info.50',
                  border: '1px solid',
                  borderColor: 'info.200',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'info.100',
                    transform: 'translateY(-1px)',
                    boxShadow: 1
                  }
                }}
                onClick={() => {
                  // Importer et passer par le wizard pour personnaliser
                  updateData('isVariant', true);
                  updateData('baseAircraft', selectedAircraft);
                  handleImportAircraft(selectedAircraft);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon color="info" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Vérifier la configuration
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Paper>
        )}
      </Paper>


      {/* Option pour créer un nouvel avion */}
      <Box sx={{ mt: 5, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon color="primary" />
          Votre avion n'est pas dans la liste ? Pas de problème !
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ mt: 2 }}
          onClick={onSkip}
        >
          Créer une nouvelle configuration
        </Button>
      </Box>

      {/* Bouton Annuler pour revenir à l'accueil */}
      {onCancel && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={onCancel}
            sx={{ minWidth: 120 }}
          >
            Annuler
          </Button>
        </Box>
      )}

      {/* Dialog de progression du téléchargement */}
      <Dialog
        open={showDownloadDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CloudIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 500 }}>
              Téléchargement en cours...
            </span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {downloadStatus}
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {Math.round(downloadProgress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={downloadProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4
                }
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Notification de succès */}
      <Snackbar
        open={showSuccessNotification}
        autoHideDuration={6000}
        onClose={() => setShowSuccessNotification(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccessNotification(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Step0CommunityCheck;