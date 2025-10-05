import React, { useState, useRef } from 'react';
import {
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
  Box
} from '@mui/material';
import {
  Upload as UploadIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

/**
 * Bouton d'import de fichier JSON pour restaurer une progression
 */
const ImportButton = ({ onImport, variant = "outlined", size = "small" }) => {
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, data: null });
  const fileInputRef = useRef(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);

        // Vérifier que c'est bien un fichier d'export d'avion
        if (!jsonData.aircraftData) {
          throw new Error('Format de fichier invalide');
        }

        // Ouvrir le dialog de confirmation
        setConfirmDialog({
          open: true,
          data: jsonData
        });

      } catch (error) {
        setNotification({
          open: true,
          message: '❌ Erreur : Fichier JSON invalide',
          severity: 'error'
        });
      }
    };

    reader.onerror = () => {
      setNotification({
        open: true,
        message: '❌ Erreur lors de la lecture du fichier',
        severity: 'error'
      });
    };

    reader.readAsText(file);

    // Reset input pour permettre de ré-importer le même fichier
    event.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!confirmDialog.data) return;

    try {
      // Appeler le callback d'import
      onImport(confirmDialog.data);

      setNotification({
        open: true,
        message: '✅ Données importées avec succès !',
        severity: 'success'
      });

      setConfirmDialog({ open: false, data: null });

    } catch (error) {
      setNotification({
        open: true,
        message: '❌ Erreur lors de l\'import des données',
        severity: 'error'
      });
    }
  };

  const handleCancelImport = () => {
    setConfirmDialog({ open: false, data: null });
  };

  const getImportPreview = () => {
    if (!confirmDialog.data) return null;

    const { aircraftData, currentStep, exportDate } = confirmDialog.data;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Immatriculation :</strong> {aircraftData.registration || 'Non définie'}
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Modèle :</strong> {aircraftData.model || 'Non défini'}
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Étape sauvegardée :</strong> {currentStep !== undefined ? `Étape ${currentStep + 1}` : 'Non définie'}
        </Typography>
        {exportDate && (
          <Typography variant="body2" gutterBottom>
            <strong>Date d'export :</strong> {new Date(exportDate).toLocaleString('fr-FR')}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Button
        variant={variant}
        size={size}
        startIcon={<UploadIcon />}
        onClick={handleFileClick}
        sx={{ textTransform: 'none' }}
      >
        Importer une sauvegarde
      </Button>

      {/* Dialog de confirmation */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCancelImport}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Confirmer l'import
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Voulez-vous vraiment importer cette sauvegarde ? Les données actuelles non sauvegardées seront perdues.
          </DialogContentText>

          {getImportPreview()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleConfirmImport}
            variant="contained"
            color="primary"
            autoFocus
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ImportButton;
