// src/components/SupabaseInitializer.jsx
// Composant pour initialiser l'application avec Supabase uniquement
import React, { useEffect, useState } from 'react';
import { Box, Alert, AlertTitle, CircularProgress, Button, Typography } from '@mui/material';
import { CloudOff, Refresh, Warning, CheckCircle } from '@mui/icons-material';
import { useSupabaseAircraftStore } from '@stores/supabaseAircraftStore';
import { cleanAllLocalData, hasLocalData } from '@utils/cleanLocalData';
import supabaseHealthCheck from '@utils/supabaseHealthCheck';
import { cleanAllTestAircraft, hasTestAircraft } from '@utils/cleanTestAircraft';

export function SupabaseInitializer({ children }) {
  const [initStatus, setInitStatus] = useState('checking'); // checking, health-check, repairing, cleaning, loading, ready, error
  const [errorMessage, setErrorMessage] = useState(null);
  const [healthCheckDetails, setHealthCheckDetails] = useState(null);
  const loadAircraft = useSupabaseAircraftStore(state => state.loadAircraft);
  const aircraftList = useSupabaseAircraftStore(state => state.aircraftList);
  const error = useSupabaseAircraftStore(state => state.error);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      

      // 1. Vérifier la connexion Supabase
      
      setInitStatus('health-check');

      const healthResult = await supabaseHealthCheck.initCheck();

      if (!healthResult.healthy) {
        throw new Error(healthResult.error || 'Connexion Supabase impossible');
      }

      if (healthResult.repaired) {
        
        setHealthCheckDetails({ repaired: true });
      } else {
        
      }

      // 2. Nettoyer les avions de test
      
      const hasTest = await hasTestAircraft();

      if (hasTest) {
        
        setInitStatus('cleaning');

        const cleanResult = await cleanAllTestAircraft();
         de test supprimé(s)`);
      }

      // 3. Vérifier si des données locales existent
      if (hasLocalData()) {
        
        setInitStatus('cleaning');

        await cleanAllLocalData();
        

        // Attendre un peu pour que le nettoyage soit bien effectif
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 4. Charger depuis Supabase
      
      setInitStatus('loading');

      await loadAircraft();

      
      setInitStatus('ready');
    } catch (err) {
      console.error('❌ Erreur d\'initialisation:', err);
      setErrorMessage(err.message || 'Erreur inconnue');
      setInitStatus('error');
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setInitStatus('checking');
    initializeApp();
  };

  // Écran de chargement
  if (initStatus === 'checking' || initStatus === 'health-check' || initStatus === 'repairing' || initStatus === 'cleaning' || initStatus === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          gap: 3
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h5" color="text.secondary">
          {initStatus === 'health-check' && '🔍 Vérification connexion Supabase...'}
          {initStatus === 'repairing' && '🔧 Réparation connexion Supabase...'}
          {initStatus === 'cleaning' && '🧹 Nettoyage des données locales...'}
          {initStatus === 'loading' && '📡 Chargement depuis Supabase...'}
          {initStatus === 'checking' && '🔍 Vérification...'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {initStatus === 'health-check' && 'Test de la connexion à la base de données'}
          {initStatus === 'repairing' && 'Tentative de rétablissement de la connexion'}
          {initStatus === 'loading' && 'Connexion à la base de données communautaire'}
        </Typography>
        {healthCheckDetails?.repaired && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <CheckCircle sx={{ mr: 1 }} />
            Connexion rétablie avec succès
          </Alert>
        )}
      </Box>
    );
  }

  // Écran d'erreur
  if (initStatus === 'error') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 3
        }}
      >
        <Alert
          severity="error"
          icon={<CloudOff fontSize="large" />}
          sx={{
            maxWidth: 600,
            width: '100%',
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          <AlertTitle sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
            ❌ Erreur de connexion à Supabase
          </AlertTitle>

          <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
            {errorMessage || 'Impossible de se connecter à la base de données Supabase'}
          </Typography>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              <Warning sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
              Vérifications à effectuer :
            </Typography>
            <Typography variant="body2" component="div">
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Connexion Internet active</li>
                <li>URL Supabase correcte dans le fichier .env</li>
                <li>Clé API (ANON KEY) valide</li>
                <li>Table <code>community_presets</code> existante et accessible</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<Refresh />}
              onClick={handleRetry}
              fullWidth
            >
              Réessayer
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Configuration : {import.meta.env.VITE_SUPABASE_URL || 'Non configurée'}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Application prête
  if (initStatus === 'ready') {
    // Vérifier si des avions ont été chargés
    if (aircraftList.length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Alert severity="warning" sx={{ maxWidth: 600 }}>
            <AlertTitle>⚠️ Aucun avion disponible</AlertTitle>
            <Typography variant="body1">
              La base de données Supabase est vide ou inaccessible.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Refresh />}
              onClick={handleRetry}
              sx={{ mt: 2 }}
            >
              Recharger
            </Button>
          </Alert>
        </Box>
      );
    }

    return children;
  }

  return null;
}

export default SupabaseInitializer;
