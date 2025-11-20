import React, { useState } from 'react';
import { useAuth } from '../../core/contexts/AuthContext';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { LogOut } from 'lucide-react';

const LogoutButton = ({ variant = 'text', size = 'small', fullWidth = false }) => {
  const { signOut, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (!window.confirm('Voulez-vous vraiment vous déconnecter ?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
        alert('Erreur lors de la déconnexion');
      }
      // La redirection se fera automatiquement via MobileApp
    } catch (err) {
      console.error('Logout error:', err);
      alert('Erreur lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Tooltip title={`Déconnexion (${user.email})`}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={handleLogout}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} /> : <LogOut size={16} />}
        sx={{
          color: variant === 'text' ? '#dc2626' : undefined,
          '&:hover': {
            backgroundColor: variant === 'text' ? 'rgba(220, 38, 38, 0.1)' : undefined,
          }
        }}
      >
        {loading ? 'Déconnexion...' : 'Se déconnecter'}
      </Button>
    </Tooltip>
  );
};

export default LogoutButton;
