import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Alert, Chip } from '@mui/material';
import { Delete, CloudUpload, Restore, Warning } from '@mui/icons-material';
import { useAircraftStore } from '@core/stores/aircraftStore';
// 🎨 Charte éditoriale ALFlight
import { EditorialHeading } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

/**
 * Panel d'administration pour gérer le localStorage et la migration Supabase
 */
export default function AdminPanel() {
  const [status, setStatus] = useState(null);
  const aircraftList = useAircraftStore(state => state.aircraftList);
  const resetToDefault = useAircraftStore(state => state.resetToDefault);

  const handleClearLocalStorage = () => {
    const confirmed = window.confirm(
      `⚠️ ATTENTION!\n\n` +
      `Vous allez supprimer ${aircraftList.length} avion(s) du stockage local:\n` +
      aircraftList.map(a => `- ${a.registration} (${a.model})`).join('\n') +
      `\n\nUn backup sera créé automatiquement.\n\nContinuer?`

    if (!confirmed) return;

    try {
      // Créer un backup
      const backup = {
        timestamp: new Date().toISOString(),
        data: {
          aircraftList,
          count: aircraftList.length
        }
      };
      localStorage.setItem('aircraft-storage-backup', JSON.stringify(backup));

      // Réinitialiser le store (vide)
      resetToDefault();

      setStatus({
        type: 'success',
        message: `✅ ${aircraftList.length} avion(s) supprimé(s) avec succès! Backup créé.`
      });

      // Recharger la page après 2 secondes
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      setStatus({
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      });
    }
  };

  const handleRestoreBackup = () => {
    try {
      const backupStr = localStorage.getItem('aircraft-storage-backup');
      if (!backupStr) {
        setStatus({
          type: 'warning',
          message: 'Aucun backup trouvé'
        });
        return;
      }

      const backup = JSON.parse(backupStr);
      const confirmed = window.confirm(
        `Restaurer le backup du ${new Date(backup.timestamp).toLocaleString()}?\n` +
        `(${backup.data.count} avion(s))`

      if (confirmed) {
        // Restaurer les données
        const aircraftStorageKey = 'aircraft-storage';
        const restoredData = {
          state: {
            aircraftList: backup.data.aircraftList,
            selectedAircraftId: backup.data.aircraftList[0]?.id || null
          },
          version: 0
        };

        localStorage.setItem(aircraftStorageKey, JSON.stringify(restoredData));

        setStatus({
          type: 'success',
          message: '✅ Backup restauré! Rechargement...'
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: `❌ Erreur: ${error.message}`
      });
    }
  };

  const getBackupInfo = () => {
    try {
      const backupStr = localStorage.getItem('aircraft-storage-backup');
      if (!backupStr) return null;

      const backup = JSON.parse(backupStr);
      return {
        timestamp: new Date(backup.timestamp).toLocaleString('fr-FR'),
        count: backup.data.count
      };
    } catch {
      return null;
    }
  };

  const backupInfo = getBackupInfo();

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', color: 'var(--text-primary)' }}>
      {/* 🎨 En-tête éditorial ALFlight */}
      <Box sx={{ mb: tokens.spacing[6] }}>
        <EditorialHeading level={2} eyebrow="SYS · OUTILS DE MAINTENANCE">
          Administration
        </EditorialHeading>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 État actuel du stockage
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Chip
              label={`${aircraftList.length} avion(s) en local`}
              color={aircraftList.length > 0 ? 'primary' : 'default'}
              sx={{ mr: 1 }}
            />
          </Box>

          {aircraftList.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Avions en mémoire locale:
              </Typography>
              {aircraftList.map(aircraft => (
                <Chip
                  key={aircraft.id}
                  label={`${aircraft.registration} - ${aircraft.model}`}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}

          {backupInfo && (
            <Alert severity="info" sx={{ mt: 2 }}>
              📦 Backup disponible: {backupInfo.count} avion(s) - {backupInfo.timestamp}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🧹 Actions de nettoyage
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            <Warning sx={{ mr: 1 }} />
            <strong>Important:</strong> Les avions doivent être récupérés depuis Supabase via le wizard communautaire.
            <br />
            Le module Aircraft doit être vide au démarrage.
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<Delete />}
              onClick={handleClearLocalStorage}
              disabled={aircraftList.length === 0}
            >
              Vider le localStorage
            </Button>

            <Button
              variant="outlined"
              color="primary"
              startIcon={<Restore />}
              onClick={handleRestoreBackup}
              disabled={!backupInfo}
            >
              Restaurer le backup
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ☁️ Migration Supabase
          </Typography>

          <Alert severity="success" sx={{ mb: 2 }}>
            ✅ F-HSTR est déjà présent dans Supabase (ID: 0bda59c9-61bc-4a29-bacf-115159957607)
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Les avions sont maintenant centralisés dans Supabase.
            <br />
            Pour ajouter un avion: utilisez le Wizard de création et importez depuis la communauté.
          </Typography>

          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            href="https://supabase.com/dashboard/project/bgmscwckawgybymbimga/editor"
            target="_blank"
            sx={{ mt: 2 }}
          >
            Ouvrir Supabase Dashboard
          </Button>
        </CardContent>
      </Card>

      {status && (
        <Alert severity={status.type} sx={{ mt: 3 }}>
          {status.message}
        </Alert>
      )}
    </Box>
}
