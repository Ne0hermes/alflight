import React, { useState } from 'react';
import { User, LogOut, Trash2, Crown, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { GoogleSignIn } from './GoogleSignIn';
import { AppleSignIn } from './AppleSignIn';
import { ManageSubscriptionButton } from '../../billing/components/ManageSubscriptionButton';
// 🎨 Charte éditoriale ALFlight
import { EditorialHeading } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

export const AccountPanel = () => {
  const { user, status, isOffline, actions, hasEntitlement } = useAuthStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    try {
      await actions.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await actions.deleteAccount();
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Impossible de supprimer le compte. Veuillez réessayer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAuthSuccess = () => {
    // Optionally refresh the page or navigate
    
  };

  const handleAuthError = (error) => {
    console.error('Authentication error:', error);
    alert(`Erreur de connexion: ${error.message}`);
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="account-panel" style={styles.container}>
        <div style={styles.loading}>Chargement...</div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="account-panel" style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Connexion</h2>
        </div>
        
        <div style={styles.signInSection}>
          <p style={styles.description}>
            Connectez-vous pour accéder à toutes les fonctionnalités
          </p>
          
          <div style={styles.signInButtons}>
            <GoogleSignIn 
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
            
            <div style={styles.divider}>
              <span style={styles.dividerText}>ou</span>
            </div>
            
            <AppleSignIn 
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
          </div>
        </div>
      </div>
    );
  }

  // Authenticated
  const isPro = hasEntitlement('pro');

  return (
    <div className="account-panel" style={{ ...styles.container, color: 'var(--text-primary)' }}>
      {/* 🎨 En-tête éditorial ALFlight */}
      <header style={{ marginBottom: tokens.spacing[6] }}>
        <EditorialHeading level={2} eyebrow="ACCOUNT · IDENTIFIANT ALFLIGHT">
          Mon compte
        </EditorialHeading>
      </header>

      {/* Connection status */}
      {isOffline && (
        <div style={styles.offlineBar}>
          <WifiOff size={16} />
          <span style={{ marginLeft: '8px' }}>Mode hors ligne</span>
        </div>
      )}

      {/* User info */}
      <div style={styles.userSection}>
        <div style={styles.avatar}>
          {user.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name || user.email}
              style={styles.avatarImage}
            />
          ) : (
            <User size={32} />
          )}
        </div>
        
        <div style={styles.userInfo}>
          {user.name && <h3 style={styles.userName}>{user.name}</h3>}
          <p style={styles.userEmail}>{user.email}</p>
          
          {isPro && (
            <div style={styles.proBadge}>
              <Crown size={14} />
              <span>PRO</span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription management */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Abonnement</h4>
        {isPro ? (
          <div>
            <p style={styles.subscriptionStatus}>
              <span style={styles.statusDot}></span>
              Abonnement PRO actif
            </p>
            <ManageSubscriptionButton />
          </div>
        ) : (
          <div>
            <p style={styles.subscriptionStatus}>
              Compte gratuit
            </p>
            <button 
              style={{ ...styles.button, ...styles.upgradeButton }}
              onClick={() => window.location.href = '/billing'}
            >
              <Crown size={16} />
              Passer à PRO
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button 
          style={styles.button}
          onClick={handleLogout}
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
        
        <button 
          style={{ ...styles.button, ...styles.dangerButton }}
          onClick={handleDeleteAccount}
          disabled={isDeleting}
        >
          <Trash2 size={16} />
          {isDeleting ? 'Suppression...' : 'Supprimer le compte'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '400px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    margin: 0,
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-secondary)',
  },
  signInSection: {
    padding: '20px 0',
  },
  description: {
    color: 'var(--text-secondary)',
    marginBottom: '24px',
    textAlign: 'center',
  },
  signInButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
  },
  divider: {
    position: 'relative',
    textAlign: 'center',
    margin: '16px 0',
    width: '100%',
  },
  dividerText: {
    backgroundColor: 'var(--bg-overlay)',
    padding: '0 16px',
    color: '#999',
    fontSize: '14px',
  },
  offlineBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px',
    fontSize: '14px',
  },
  userSection: {
    display: 'flex',
    gap: '16px',
    padding: '20px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 4px 0',
  },
  userEmail: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '0 0 8px 0',
  },
  proBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--app-bg)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: '600',
  },
  section: {
    padding: '20px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  subscriptionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-primary)',
  },
  actions: {
    padding: '20px 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'var(--bg-overlay)',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  upgradeButton: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--app-bg)',
  },
  dangerButton: {
    backgroundColor: 'var(--bg-overlay)',
    color: '#C04534',
  },
};