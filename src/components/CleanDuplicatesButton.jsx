import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  CleaningServices as CleanIcon,
  Visibility as PreviewIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { cleanDuplicatePresets, previewCleanDuplicatePresets } from '../utils/cleanDuplicatePresets';

/**
 * Bouton pour nettoyer les doublons dans la table community_presets
 */
function CleanDuplicatesButton() {
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [cleanResult, setCleanResult] = useState(null);

  const handlePreview = async () => {
    setIsLoading(true);
    setPreviewResult(null);

    try {
      const result = await previewCleanDuplicatePresets();
      setPreviewResult(result);
      setShowPreview(true);
    } catch (error) {
      console.error('Erreur lors de l\'aperçu:', error);
      setPreviewResult({
        success: false,
        error: error.message
      });
      setShowPreview(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClean = async () => {
    setIsLoading(true);
    setCleanResult(null);

    try {
      const result = await cleanDuplicatePresets();
      setCleanResult(result);
      setShowDialog(false);
      setShowPreview(false);

      // Rafraîchir la page après 2 secondes si succès
      if (result.success && result.presetsDeleted > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      setCleanResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Bouton principal */}
      <Button
        variant="outlined"
        color="warning"
        startIcon={<CleanIcon />}
        onClick={() => setShowDialog(true)}
        size="small"
      >
        Nettoyer les doublons
      </Button>

      {/* Dialog de confirmation */}
      <Dialog
        open={showDialog}
        onClose={() => !isLoading && setShowDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Nettoyer les doublons Supabase
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Cette action va supprimer les presets en doublon dans la base de données Supabase.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2 }}>
            Pour chaque immatriculation en doublon, seul le preset le plus récent sera conservé.
          </Alert>
          <Alert severity="warning" sx={{ mt: 2 }}>
            ⚠️ Cette action est irréversible. Il est recommandé de d'abord voir un aperçu.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setShowDialog(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handlePreview}
            startIcon={isLoading ? <CircularProgress size={20} /> : <PreviewIcon />}
            disabled={isLoading}
            variant="outlined"
          >
            Aperçu
          </Button>
          <Button
            onClick={handleClean}
            startIcon={isLoading ? <CircularProgress size={20} /> : <CleanIcon />}
            disabled={isLoading}
            variant="contained"
            color="warning"
          >
            Nettoyer maintenant
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'aperçu */}
      <Dialog
        open={showPreview}
        onClose={() => !isLoading && setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Aperçu du nettoyage</DialogTitle>
        <DialogContent>
          {previewResult && (
            <>
              {previewResult.success ? (
                <>
                  {previewResult.wouldDelete === 0 ? (
                    <Alert severity="success">
                      ✅ Aucun doublon trouvé! La base de données est propre.
                    </Alert>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        {previewResult.wouldDelete} doublon(s) serai(en)t supprimé(s) sur {previewResult.duplicatesFound} immatriculation(s)
                      </Alert>

                      <Typography variant="subtitle2" gutterBottom>
                        Détails des doublons:
                      </Typography>
                      <List dense>
                        {Object.entries(previewResult.duplicates || {}).map(([registration, presets]) => (
                          <ListItem key={registration}>
                            <ListItemText
                              primary={registration}
                              secondary={`${presets.length} preset(s) trouvé(s) - ${presets.length - 1} serai(en)t supprimé(s)`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </>
              ) : (
                <Alert severity="error">
                  ❌ Erreur: {previewResult.error}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setShowPreview(false)}>
            Fermer
          </Button>
          {previewResult?.wouldDelete > 0 && (
            <Button
              onClick={() => {
                setShowPreview(false);
                handleClean();
              }}
              variant="contained"
              color="warning"
              startIcon={<CleanIcon />}
            >
              Confirmer le nettoyage
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Message de résultat */}
      {cleanResult && (
        <Dialog
          open={!!cleanResult}
          onClose={() => setCleanResult(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {cleanResult.success ? '✅ Nettoyage terminé' : '❌ Erreur'}
          </DialogTitle>
          <DialogContent>
            {cleanResult.success ? (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {cleanResult.message}
                </Alert>
                {cleanResult.presetsDeleted > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    La page va se recharger dans quelques secondes...
                  </Typography>
                )}
              </>
            ) : (
              <Alert severity="error">
                Erreur: {cleanResult.error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCleanResult(null)}>
              Fermer
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default CleanDuplicatesButton;
