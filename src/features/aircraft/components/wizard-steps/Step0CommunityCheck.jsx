import React, { useState, useEffect, useRef } from 'react';
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
import { getCurrentUserId } from '../../../../lib/supabaseAuth';
import dataBackupManager from '../../../../utils/dataBackupManager';
import CleanDuplicatesButton from '../../../../components/CleanDuplicatesButton';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { extractCompleteManexData } from '../../services/manexExtractionService';
import { mapExtractionToReviewItems, buildBulkUpdatePayload } from '../../utils/manexExtractionMapper';
import ManexExtractionReview from '../ManexExtractionReview';

const Step0CommunityCheck = ({ data, updateData, updateDataBulk, onSkip, onComplete, onCancel }) => {
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

  // Extraction MANEX automatique
  const manexFileInputRef = useRef(null);
  const [showExtractionReview, setShowExtractionReview] = useState(false);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionProgressMessage, setExtractionProgressMessage] = useState('');
  const [extractionMetadata, setExtractionMetadata] = useState(null);
  const [extractionItems, setExtractionItems] = useState([]);
  const [extractionError, setExtractionError] = useState(null);

  const handleManexFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setExtractionError('Le fichier doit être un PDF');
      return;
    }

    setExtractionError(null);
    setShowExtractionReview(true);
    setExtractionLoading(true);
    setExtractionProgress(0);
    setExtractionItems([]);
    setExtractionMetadata(null);

    try {
      const { extraction, metadata } = await extractCompleteManexData(file, {
        onProgress: (pct, msg) => {
          setExtractionProgress(pct);
          setExtractionProgressMessage(msg);
        }
      });
      setExtractionMetadata(metadata);
      setExtractionItems(mapExtractionToReviewItems(extraction));

      // ─── Stocker le PDF MANEX dans data.manex pour que le fichier soit
      //     attaché à l'avion à la sortie du wizard (sans cela, seules les
      //     données extraites sont importées, le PDF lui-même est perdu).
      try {
        const pdfBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Lecture base64 échouée'));
          reader.readAsDataURL(file);
        });
        const manexObject = {
          fileName: file.name,
          fileSize: file.size,
          pdfData: pdfBase64,
          uploadDate: new Date().toISOString(),
          uploadedToSupabase: false,
          hasData: true,
          // Métadonnées d'extraction (pour traçabilité)
          extractionMetadata: metadata
        };
        updateData('manex', manexObject);
        console.log('✅ [Step0] MANEX attaché à l\'avion (sera sauvegardé en fin de wizard)');
      } catch (storeErr) {
        // Échec stockage : non bloquant pour l'extraction de données
        console.warn('[Step0] Stockage MANEX échoué (extraction OK):', storeErr.message);
      }
    } catch (err) {
      console.error('[Step0] Extraction MANEX échouée:', err);
      setExtractionError(err.message || 'Extraction échouée');
      setShowExtractionReview(false);
    } finally {
      setExtractionLoading(false);
      // Réinitialiser l'input pour permettre une nouvelle sélection du même fichier
      if (manexFileInputRef.current) manexFileInputRef.current.value = '';
    }
  };

  const handleApplyExtraction = () => {
    const payload = buildBulkUpdatePayload(extractionItems);
    if (updateDataBulk) {
      updateDataBulk(payload);
    } else if (updateData) {
      // Fallback : mises à jour individuelles
      const flatten = (obj, prefix = '') => {
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path);
          else updateData(path, v);
        }
      };
      flatten(payload);
    }
    setShowExtractionReview(false);
    if (onSkip) onSkip(); // passe au Step1 pour vérification visuelle
  };

  // Simuler le chargement des avions depuis la base de données communautaire
  useEffect(() => {
    loadCommunityAircraft();
  }, []);

  // Si on revient de l'étape 1 avec une immatriculation, la pré-sélectionner
  useEffect(() => {
    // 🔧 FIX INFINITE LOOP: Ajouter une condition pour éviter la boucle
    // Ne traiter que si searchRegistration est défini ET non vide
    if (data.searchRegistration && data.searchRegistration !== '' && communityAircraft.length > 0) {
      const found = communityAircraft.find(ac => ac.registration === data.searchRegistration);
      if (found) {
        setSelectedAircraft(found);
        setSearchValue(data.searchRegistration);
      }
      // Nettoyer après utilisation (ne se déclenchera qu'une seule fois)
      updateData('searchRegistration', '');
    }
  }, [data.searchRegistration, communityAircraft]);

  const loadCommunityAircraft = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 [DEBUG] Chargement des presets...');

      const presets = await communityService.getAllPresets();
      console.log(`🔍 [DEBUG] Presets reçus: ${presets.length}`);

      // 🔧 ANCIENNE LIMITATION DEBUG RETIRÉE :
      // const limitedPresets = presets.slice(0, 2);  ← MASQUAIT LES AUTRES AVIONS
      // → Maintenant on affiche TOUS les presets de la communauté.

      // Transformer les presets Supabase au format attendu par le composant
      // NOTE: communityService.getAllPresets() retourne déjà SEULEMENT les métadonnées
      const formattedAircraft = presets.map(preset => {
        // Ne PAS spread ...preset pour éviter de copier des champs non nécessaires
        return {
          id: preset.id,
          registration: preset.registration,
          model: preset.model,
          manufacturer: preset.manufacturer,
          type: preset.type || preset.aircraftType,
          category: preset.category,
          addedBy: preset.addedBy,
          dateAdded: preset.dateAdded,
          downloads: preset.downloads,
          votes: preset.votes,
          verified: preset.verified,
          adminVerified: preset.adminVerified,
          description: preset.description,
          version: preset.version,
          hasManex: preset.hasManex,
          requiresFullDataLoad: preset.requiresFullDataLoad
        };
      });

      console.log('🔍 [DEBUG] Presets formatés, mise à jour état...');
      setCommunityAircraft(formattedAircraft);
      console.log('✅ [DEBUG] État mis à jour avec succès');
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
      

      // 1. Enregistrer le téléchargement dans Supabase (userId réel ou null si anonyme)
      await communityService.recordDownload(aircraft.id, await getCurrentUserId());

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
      await communityService.recordDownload(aircraft.id, await getCurrentUserId());

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
      const willDownloadManex = communityData.hasManex && communityData.manexAvailableInSupabase?.filePath;
      setDownloadStatus(communityData.manex ? 'Préparation des données avec MANEX...' : 'Préparation des données...');
      setDownloadProgress(willDownloadManex ? 85 : 90);


      // Petit délai pour afficher le statut final
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ne pas mettre à 100% si le MANEX doit encore être téléchargé
      if (!willDownloadManex) {
        setDownloadStatus('Terminé !');
        setDownloadProgress(100);
      }

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

      // Importer les données (MANEX inclus si disponible)
      // Le dialog reste ouvert pendant le téléchargement du MANEX
      await importAircraftData(communityData, aircraft);

      // Fermer le dialog après import complet (délai pour voir le message de succès)
      setTimeout(() => {
        setShowDownloadDialog(false);
      }, 1500);

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
  const importAircraftData = async (communityData, aircraft) => {
    console.log('🔧 [MEMORY FIX] Import groupé des données avion');

    // 🔧 FIX MEMORY: Utiliser updateDataBulk pour UNE SEULE mise à jour
    // Au lieu de 50+ appels updateData (50+ copies de l'état)

    // Créer une référence légère au lieu d'une copie profonde JSON.stringify
    // On garde juste la référence pour comparaison si nécessaire
    const baseReference = {
      id: communityData.communityPresetId,  // 🔧 FIX: Ajouter l'ID pour la détection UPDATE vs CREATE
      registration: communityData.registration,
      model: communityData.model,
      communityPresetId: communityData.communityPresetId,
      version: communityData.version
    };

    // 🔧 FIX: Garder les données en STORAGE units (ltr/lph/kg/kt)
    // Step1BasicInfo fera la conversion vers USER units lors de l'affichage
    // Cela évite la double conversion qui causait 148 L → 39 gal → 10.3 gal
    console.log('📦 [Step0] Keeping aircraft data in STORAGE units (ltr/lph/kg/kt)');

    // Préparer TOUTES les données pour UNE SEULE mise à jour groupée
    const bulkData = {
      ...communityData,  // ✅ Données en STORAGE units (ltr/lph/kg/kt)
      isImportedFromCommunity: true,
      baseAircraft: baseReference, // Référence légère au lieu de copie complète
      // Ne PAS stocker originalCommunityData (doublon inutile)
    };

    // UNE SEULE mise à jour au lieu de 50+
    if (updateDataBulk) {
      updateDataBulk(bulkData);
    } else {
      // Fallback si updateDataBulk n'est pas disponible (ancien code)
      console.warn('⚠️ updateDataBulk non disponible, utilisation de updateData (moins performant)');
      Object.keys(bulkData).forEach(key => {
        updateData(key, bulkData[key]);
      });
    }

    console.log('✅ Import groupé terminé - 1 seule mise à jour au lieu de 50+');

    // 📥 Télécharger le MANEX IMMÉDIATEMENT si disponible (pour accès hors ligne)
    if (communityData.hasManex && communityData.manexAvailableInSupabase?.filePath) {
      console.log('📥 Démarrage téléchargement MANEX immédiat...');

      setDownloadStatus('Téléchargement du manuel de vol (11.82 MB)...');
      setDownloadProgress(95);

      try {
        const manexData = await communityService.downloadManexLazy(
          communityData.manexAvailableInSupabase.filePath
        );

        // Ajouter le MANEX aux données de l'avion
        const manexObject = {
          fileName: communityData.manexAvailableInSupabase.fileName,
          fileSize: communityData.manexAvailableInSupabase.fileSize,
          pdfData: manexData.pdfData,
          uploadDate: new Date().toISOString(),
          uploadedToSupabase: true,
          supabasePath: communityData.manexAvailableInSupabase.filePath,
          hasData: true
        };

        // Mettre à jour avec le MANEX téléchargé
        updateData('manex', manexObject);

        console.log('✅ MANEX téléchargé et disponible hors ligne');
        setDownloadStatus('✅ Manuel de vol disponible hors ligne !');
        setDownloadProgress(100);
      } catch (error) {
        console.error('❌ Erreur téléchargement MANEX:', error);
        setDownloadStatus('⚠️ Échec téléchargement manuel - L\'avion sera importé sans MANEX');
        setDownloadProgress(100);
        // Continuer même en cas d'erreur - l'avion sera importé sans MANEX
      }
    }

    setIsImporting(false);

    // Passer directement à l'étape suivante du wizard
    if (onSkip) onSkip();
  };

  const handleVote = async (aircraftReg, voteType) => {
    try {
      // Trouver l'avion
      const aircraft = communityAircraft.find(a => a.registration === aircraftReg);
      if (!aircraft) return;

      

      // Envoyer le vote à Supabase (userId réel issu de la session)
      const voterId = await getCurrentUserId();
      if (!voterId) {
        alert('Connecte-toi pour voter.');
        return;
      }
      await communityService.votePreset(
        aircraft.id,
        voterId,
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
              {selectedAircraft.version && (
                <Typography variant="body2">
                  <strong>Version :</strong> {selectedAircraft.version}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Validation :</strong> <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{selectedAircraft.votes.up} ✓ / {selectedAircraft.votes.down} ✗</Box>
              </Typography>
              <Typography variant="body2">
                <strong>Téléchargements :</strong> {selectedAircraft.downloads}
              </Typography>
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
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          {/* Bouton 1 : Import MANEX automatique (recommandé) */}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => manexFileInputRef.current?.click()}
            sx={{ flex: { sm: 1.5 } }}
          >
            Importer depuis un MANEX (PDF)
          </Button>
          <input
            ref={manexFileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={handleManexFileSelected}
          />

          {/* NOTE: bouton "Saisie manuelle" retiré — la création d'un avion
              passe désormais systématiquement par l'import du MANEX (PDF),
              qui pré-remplit le wizard automatiquement. */}
          <Button
            variant="outlined"
            onClick={() => {
              window.location.href = 'mailto:contact@alflight.fr?subject=Demande d\'ajout avion&body=Bonjour, je souhaiterais ajouter mon avion à la liste...';
            }}
            sx={{ flex: { sm: 1 } }}
          >
            Envoyer le MANEX
          </Button>
        </Box>
        {extractionError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setExtractionError(null)}>
            {extractionError}
          </Alert>
        )}
      </Box>

      {/* Modal de validation des données extraites du MANEX */}
      {showExtractionReview && (
        <ManexExtractionReview
          isLoading={extractionLoading}
          progress={extractionProgress}
          progressMessage={extractionProgressMessage}
          metadata={extractionMetadata}
          items={extractionItems}
          onItemsChange={setExtractionItems}
          onApply={handleApplyExtraction}
          onCancel={() => setShowExtractionReview(false)}
        />
      )}

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