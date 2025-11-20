import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Flight as FlightIcon } from '@mui/icons-material';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Affichage du loader pendant la vérification de la session
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <FlightIcon sx={{ fontSize: 64, color: 'white', mb: 2 }} />
        <CircularProgress size={40} sx={{ color: 'white', mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'white' }}>
          Chargement...
        </Typography>
      </Box>
    );
  }

  // Si pas d'utilisateur connecté, redirection vers login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Utilisateur connecté, afficher le contenu protégé
  return children;
};

export default ProtectedRoute;
