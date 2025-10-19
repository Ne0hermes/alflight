import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Compare as CompareIcon } from '@mui/icons-material';
import communityService from '../../../services/communityService';
import dataBackupManager from '../../../utils/dataBackupManager';

/**
 * Composant pour comparer et mettre à jour les données Supabase
 */
const SupabaseUpdater = ({ aircraft, onUpdateComplete }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [differences, setDifferences] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Comparer les données locales avec Supabase
   */
  const handleCompare = async () => {
    try {
      setComparing(true);
      setError(null);

      
      // Récupérer les données FRAÎCHES depuis dataBackupManager
      const allAircraft = await dataBackupManager.getAllAircraft();
      const freshLocalData = allAircraft.find(a => a.registration === aircraft.registration);

      
      // Utiliser les données fraîches si disponibles, sinon fallback sur aircraft prop
      const localData = freshLocalData || aircraft;

      // Récupérer les données depuis Supabase
      const supabaseData = await communityService.getPresetById(aircraft.communityPresetId);

            
      // Comparer les données
      const diffs = compareData(supabaseData, localData);

      setDifferences(diffs);
      setOpen(true);
    } catch (err) {
      console.error('❌ Erreur lors de la comparaison:', err);
      setError(err.message);
    } finally {
      setComparing(false);
    }
  };

  /**
   * Comparer deux objets et retourner les différences
   */
  const compareData = (supabase, local) => {
    const diffs = [];


        
    // Champs à comparer
    const fieldsToCompare = [
      { key: 'registration', label: 'Immatriculation' },
      { key: 'manufacturer', label: 'Constructeur' },
      { key: 'aircraftType', label: 'Type d\'appareil' },
      { key: 'category', label: 'Catégorie' },
      { key: 'fuelType', label: 'Type de carburant' },
      { key: 'cruiseSpeed', label: 'Vitesse de croisière' },
      { key: 'maxRange', label: 'Autonomie max' },
      { key: 'fuelCapacity', label: 'Capacité carburant' },
      { key: 'fuelConsumption', label: 'Consommation' },
      { key: 'emptyWeight', label: 'Masse à vide' },
      { key: 'maxTakeoffWeight', label: 'Masse max au décollage' },
      { key: 'maxLandingWeight', label: 'Masse max à l\'atterrissage' },
      { key: 'usefulLoad', label: 'Charge utile' },
      { key: 'seats', label: 'Nombre de sièges' },
      { key: 'compatibleRunwaySurfaces', label: 'Surfaces compatibles', isArray: true },
      { key: 'minimumRunwayLength', label: 'Longueur piste minimale' },
      { key: 'engineType', label: 'Type moteur' },
      { key: 'engineModel', label: 'Modèle moteur' },
      { key: 'enginePower', label: 'Puissance moteur' },
      { key: 'remarks', label: 'Remarques' }
    ];

    fieldsToCompare.forEach(({ key, label, isArray }) => {
      const supabaseValue = supabase[key];
      const localValue = local[key];

      // Comparer les valeurs
      let isDifferent = false;

      if (isArray) {
        // Comparer les tableaux
        const supabaseArray = Array.isArray(supabaseValue) ? supabaseValue : [];
        const localArray = Array.isArray(localValue) ? localValue : [];
        isDifferent = JSON.stringify(supabaseArray.sort()) !== JSON.stringify(localArray.sort());
      } else {
        isDifferent = supabaseValue !== localValue;
      }

      // Log détaillé pour chaque comparaison
      if (isDifferent) {
        console.log(`Difference found in ${label}:`, {
          supabase: supabaseValue,
          local: localValue,
          type: isArray ? 'array' : typeof localValue
        });
      }

      if (isDifferent) {
        diffs.push({
          field: label,
          key: key,
          supabase: isArray ? (supabaseValue || []).join(', ') : supabaseValue || 'N/A',
          local: isArray ? (localValue || []).join(', ') : localValue || 'N/A'
        });
      }
    });

    return diffs;
  };

  /**
   * Mettre à jour Supabase avec les données locales
   */
  const handleUpdate = async () => {
    try {
      setLoading(true);
      setError(null);

      
      // Récupérer les données FRAÎCHES depuis dataBackupManager
      const allAircraft = await dataBackupManager.getAllAircraft();
      const freshLocalData = allAircraft.find(a => a.registration === aircraft.registration);
      const localData = freshLocalData || aircraft;

      
      // Préparer les données à mettre à jour
      const updateData = {
        registration: localData.registration,
        model: localData.model,
        manufacturer: localData.manufacturer,
        aircraftType: localData.aircraftType,
        category: localData.category,
        aircraft_data: localData // Toutes les données fraîches
      };

      
      // Appeler l'API Supabase pour mettre à jour
      const { supabase } = await import('../../../services/communityService');
      const { data, error: updateError } = await supabase
        .from('community_presets')
        .update(updateData)
        .eq('id', aircraft.communityPresetId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      
      setOpen(false);
      setDifferences(null);

      if (onUpdateComplete) {
        onUpdateComplete();
      }

      alert('✅ Données mises à jour sur Supabase avec succès!');
    } catch (err) {
      console.error('❌ Erreur lors de la mise à jour:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Annuler
   */
  const handleCancel = () => {
    setOpen(false);
    setDifferences(null);
    setError(null);
  };

  return (
    <>
      {/* Bouton pour ouvrir la comparaison */}
      <Button
        variant="contained"
        color="primary"
        startIcon={comparing ? <CircularProgress size={16} /> : <CompareIcon />}
        onClick={handleCompare}
        disabled={comparing || !aircraft.communityPresetId}
        sx={{ minWidth: 200 }}
      >
        {comparing ? 'Comparaison...' : 'Mettre à jour Supabase'}
      </Button>

      {/* Dialog de comparaison */}
      <Dialog
        open={open}
        onClose={handleCancel}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareIcon />
            <Typography variant="h6">
              Comparaison et mise à jour Supabase
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Immatriculation: <strong>{aircraft.registration}</strong>
          </Typography>

          {differences && differences.length === 0 ? (
            <Alert severity="info">
              ✅ Aucune différence détectée. Les données sont identiques sur Supabase et localement.
            </Alert>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>{differences?.length || 0} différence(s) détectée(s)</strong>
                <br />
                Les données locales seront utilisées pour remplacer les données Supabase.
              </Alert>

              <TableContainer component={Paper} elevation={2}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>Champ</strong></TableCell>
                      <TableCell><strong>Valeur Supabase (actuelle)</strong></TableCell>
                      <TableCell><strong>Valeur locale (nouvelle)</strong></TableCell>
                      <TableCell align="center"><strong>Statut</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {differences?.map((diff, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="500">
                            {diff.field}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="error.main">
                            {diff.supabase}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="success.main">
                            {diff.local}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label="Sera remplacé"
                            color="warning"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCancel}
            color="inherit"
            disabled={loading}
          >
            Annuler
          </Button>
          {differences && differences.length > 0 && (
            <Button
              onClick={handleUpdate}
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
              disabled={loading}
            >
              {loading ? 'Mise à jour...' : 'Confirmer et mettre à jour'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SupabaseUpdater;
