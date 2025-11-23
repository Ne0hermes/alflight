import React, { useState } from 'react';
import { useAuth } from '../../core/contexts/AuthContext';
import { CircularProgress, Tooltip } from '@mui/material';
import { LogOut } from 'lucide-react';
import { Button } from '../../shared/components/Button';

const LogoutButton = ({ variant = 'text', size = 'small', fullWidth = false, sx = {} }) => {
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
      <span>
        <Button
          variant={variant}
          size={size}
          fullWidth={fullWidth}
          onClick={handleLogout}
          disabled={loading}
          sx={{
            color: variant === 'text' ? '#dc2626' : undefined,
            '&:hover': {
              backgroundColor: variant === 'text' ? 'rgba(220, 38, 38, 0.1)' : undefined,
            },
            minWidth: 'auto',
            textTransform: 'none',
            ...sx  // Custom sx props override internal styles
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Déconnexion...
            </>
          ) : (
            <>
              <LogOut size={16} style={{ marginRight: '8px' }} />
              Se déconnecter
            </>
          )}
        </Button>
      </span>
    </Tooltip>
  );
};

export default LogoutButton;
