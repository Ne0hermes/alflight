import React, { useState } from 'react';
import { useAuth } from '../../core/contexts/AuthContext';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Flight as FlightIcon
} from '@mui/icons-material';
import { Button } from '../../shared/components/Button';

const LoginPage = () => {
  const { signIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('Sign in error details:', signInError);

        if (signInError.message === 'Invalid login credentials') {
          setError('Email ou mot de passe incorrect');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Veuillez confirmer votre email avant de vous connecter');
        } else if (signInError.message.includes('Failed to fetch') ||
                   signInError.message.includes('Load failed') ||
                   signInError.message.includes('network') ||
                   signInError.message.includes('NetworkError')) {
          setError('Erreur de connexion réseau. Vérifiez votre connexion internet et désactivez les bloqueurs de contenu.');
        } else {
          setError(`Erreur: ${signInError.message}`);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Connexion réussie, l'app va automatiquement afficher le contenu
        // car MobileApp.jsx vérifie user et redirige automatiquement
        window.location.reload();
      }
    } catch (err) {
      console.error('Login error:', err);

      // Meilleure gestion des erreurs réseau
      if (err.message && (err.message.includes('Failed to fetch') ||
          err.message.includes('Load failed') ||
          err.message.includes('network') ||
          err.message.includes('NetworkError'))) {
        setError('Erreur de connexion réseau. Vérifiez votre connexion internet et désactivez les bloqueurs de contenu (AdBlock, etc.)');
      } else {
        setError('Une erreur est survenue lors de la connexion');
      }
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #8B1538 0%, #6B0F2B 100%)',
        padding: 2
      }}
    >
      <Paper
        elevation={10}
        sx={{
          padding: 4,
          maxWidth: 450,
          width: '100%',
          borderRadius: 2
        }}
      >
        {/* Logo et Titre */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <FlightIcon sx={{ fontSize: 48, color: '#93163C', mb: 1 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            ALFlight
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Votre assistant de préparation de vol
          </Typography>
        </Box>

        {/* Message Phase Beta */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Phase Beta Privée</strong><br />
            Accès réservé aux testeurs invités
          </Typography>
        </Alert>

        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading || authLoading}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading || authLoading}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            type="submit"
            variant="primary"
            size="large"
            disabled={loading || authLoading || !email || !password}
            sx={{ mb: 2 }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </Button>

          {/* Mot de passe oublié - désactivé pour la beta */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Mot de passe oublié ? Contactez l'administrateur.
            </Typography>
          </Box>
        </form>

        {/* Informations pour les testeurs */}
        <Box sx={{ mt: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>Testeurs Beta :</strong> Vous n'avez pas encore de compte ?
            Contactez l'administrateur pour recevoir vos identifiants.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
