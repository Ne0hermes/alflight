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
  Snackbar
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

// Simulation de la base de données communautaire
// En production, ceci sera remplacé par un appel API vers la base de données en ligne
const MOCK_COMMUNITY_AIRCRAFT = [
  {
    registration: 'F-GBYU',
    model: 'Diamond DA40 NG',
    manufacturer: 'Diamond Aircraft',
    type: 'DA40 NG',
    addedBy: 'Pilot123',
    dateAdded: '2024-03-15',
    downloads: 156,
    verified: true,
    votes: { up: 42, down: 2 },
    validationThreshold: 10, // Nombre de votes positifs nets nécessaires
    hasFlightManual: true,
    manualVersion: 'Rev. 7 - 2023',
    adminVerified: true // Vérifié par les administrateurs
  },
  {
    registration: 'F-HXYZ',
    model: 'Cessna 172S',
    manufacturer: 'Cessna',
    type: 'C172S',
    addedBy: 'AeroClub75',
    dateAdded: '2024-02-28',
    downloads: 89,
    verified: true,
    votes: { up: 28, down: 1 },
    hasFlightManual: true,
    manualVersion: 'Rev. 5 - 2022',
    adminVerified: true
  },
  {
    registration: 'F-GJKL',
    model: 'Piper PA-28-181',
    manufacturer: 'Piper',
    type: 'PA28',
    addedBy: 'FlightSchool',
    dateAdded: '2024-01-10',
    downloads: 234,
    verified: false,
    votes: { up: 8, down: 3 },
    hasFlightManual: true,
    manualVersion: 'Report 2215 - 2021',
    adminVerified: false // En attente de vérification admin
  },
  {
    registration: 'F-GMNO',
    model: 'Robin DR400-140B',
    manufacturer: 'Robin',
    type: 'DR400',
    addedBy: 'FrenchPilot',
    dateAdded: '2024-03-01',
    downloads: 178,
    verified: true,
    votes: { up: 35, down: 0 },
    hasFlightManual: true,
    manualVersion: 'Ed. 2020',
    adminVerified: true
  }
];

const Step0CommunityCheck = ({ data, updateData, onSkip, onComplete }) => {
  const [searchValue, setSearchValue] = useState(data.searchRegistration || '');
  const [isLoading, setIsLoading] = useState(false);
  const [communityAircraft, setCommunityAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false); // Réduit par défaut
  const [userVotes, setUserVotes] = useState({}); // Simule les votes de l'utilisateur
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

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
    // Simuler un délai de chargement
    setTimeout(() => {
      setCommunityAircraft(MOCK_COMMUNITY_AIRCRAFT);
      setIsLoading(false);
    }, 1000);

    // En production, remplacer par :
    // try {
    //   const response = await fetch('https://api.alflight.com/aircraft/community');
    //   const data = await response.json();
    //   setCommunityAircraft(data);
    // } catch (error) {
    //   console.error('Erreur lors du chargement des avions:', error);
    // } finally {
    //   setIsLoading(false);
    // }
  };

  // Import direct sans passer par le wizard
  const handleDirectImport = async (aircraft) => {
    setIsImporting(true);

    try {
      // Créer un nouvel avion avec TOUTES les données de l'avion communautaire
      const newAircraft = {
        ...aircraft, // Copier toutes les propriétés de l'avion
        id: `aircraft-${Date.now()}`, // Format attendu par le store
        importedFrom: 'community',
        dateImported: new Date().toISOString(),
      };

      // Ajouter l'avion au store
      const result = addAircraft(newAircraft);

      if (result !== null) {
        // Sélectionner automatiquement le nouvel avion
        setSelectedAircraft(newAircraft);

        // Afficher la notification de succès
        setNotificationMessage(`✅ L'avion ${aircraft.registration} (${aircraft.model}) a été ajouté à votre liste d'avions`);
        setShowSuccessNotification(true);

        // Retourner à l'accueil après 2 secondes
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 2000);
      } else {
        // L'avion existe déjà
        setNotificationMessage(`⚠️ L'avion ${aircraft.registration} existe déjà dans votre liste`);
        setShowSuccessNotification(true);
      }

    } catch (error) {
      console.error('Erreur lors de l\'import direct:', error);
      setNotificationMessage(`❌ Erreur lors de l'import de l'avion`);
      setShowSuccessNotification(true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportAircraft = async (aircraft) => {
    setIsImporting(true);
    setSelectedAircraft(aircraft);

    // Simuler l'importation complète des données depuis la communauté
    setTimeout(async () => {
      try {
        // En production, récupérer TOUTES les données de l'avion depuis l'API
        // Pour la démo, on simule des données complètes
        const communityData = {
          // Identification
          registration: aircraft.registration,
          model: aircraft.model,
          manufacturer: aircraft.manufacturer,
          aircraftType: aircraft.type,
          category: 'SEP',

          // Vitesses (exemple de données communautaires)
          speeds: {
            vne: 154,
            vno: 127,
            va: 108,
            vfe: 103,
            vs0: 49,
            vs1: 55,
            vx: 64,
            vy: 76,
            vr: 60,
            vapp: 75
          },

          // Masses
          weights: {
            emptyWeight: 795,
            maxTakeoffWeight: 1280,
            maxLandingWeight: 1280,
            baggageCapacity: 100
          },

          // Performances (si disponibles)
          performance: {
            cruise: { speed75: 127, endurance: 5.5 },
            takeoff: { groundRoll: 335, fiftyFeet: 580 },
            landing: { groundRoll: 295, fiftyFeet: 590 }
          },

          // Marqueur pour indiquer que c'est une importation communautaire
          importedFromCommunity: true,
          communityVersion: aircraft.version || 1,
          importDate: new Date().toISOString()
        };

        // Importer toutes les données dans le wizard
        Object.keys(communityData).forEach(key => {
          updateData(key, communityData[key]);
        });

        // Marquer comme importé depuis la communauté
        updateData('isImportedFromCommunity', true);
        updateData('originalCommunityData', communityData);

        setIsImporting(false);

        // Message informatif
        alert(`✅ Données importées depuis la communauté

Les données de ${aircraft.registration} ont été chargées.

Le wizard va continuer pour que vous puissiez :
• Vérifier tous les paramètres importés
• Modifier si nécessaire
• Ajouter des informations manquantes

À la fin, vous pourrez choisir entre :
- Soumettre vos modifications à la communauté
- Garder les changements en local uniquement`);

        // Passer à l'étape suivante du wizard
        if (onSkip) onSkip();
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'importation des données');
        setIsImporting(false);
      }
    }, 1500);
  };

  const handleVote = (aircraftReg, voteType) => {
    // Simuler le vote de l'utilisateur
    setUserVotes(prev => ({
      ...prev,
      [aircraftReg]: voteType
    }));

    // Mettre à jour les votes dans la liste
    setCommunityAircraft(prev =>
      prev.map(aircraft => {
        if (aircraft.registration === aircraftReg) {
          const currentUserVote = userVotes[aircraftReg];
          let updatedVotes = { ...aircraft.votes };

          // Annuler le vote précédent
          if (currentUserVote === 'up') updatedVotes.up--;
          if (currentUserVote === 'down') updatedVotes.down--;

          // Appliquer le nouveau vote
          if (voteType === 'up') updatedVotes.up++;
          if (voteType === 'down') updatedVotes.down++;

          // Vérifier si l'avion atteint le seuil de validation
          const netVotes = updatedVotes.up - updatedVotes.down;
          const verified = netVotes >= 10;

          return { ...aircraft, votes: updatedVotes, verified };
        }
        return aircraft;
      })
    );
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

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Avantage :</strong> En utilisant une configuration validée, vous économisez du temps
              et bénéficiez de données fiables testées par d'autres pilotes.
            </Typography>
          </Alert>

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
          sx={{ mb: 2 }}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Rechercher par immatriculation"
              placeholder="Ex: F-GBYU"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: '40px',
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
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
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
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
              Options disponibles :
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              {/* Importer directement les données */}
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
                      Personnaliser cet avion
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Modifier les paramètres pour adapter à votre avion spécifique
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Paper>
        )}
      </Paper>


      {/* Option pour créer un nouvel avion */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          Votre avion n'est pas dans la liste ? Pas de problème !
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ mt: 1 }}
          onClick={onSkip}
        >
          Créer une nouvelle configuration
        </Button>
      </Alert>

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