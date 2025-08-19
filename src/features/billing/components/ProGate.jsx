import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../account/stores/authStore';
import { Paywall } from './Paywall';

/**
 * ProGate component - Gates content behind PRO subscription
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to show when user has PRO
 * @param {string} props.feature - Feature name to display in paywall
 * @param {boolean} props.showTeaser - Show blurred/locked preview of content
 * @param {React.ReactNode} props.fallback - Custom fallback instead of paywall
 */
export const ProGate = ({ 
  children, 
  feature = 'cette fonctionnalité',
  showTeaser = false,
  fallback = null 
}) => {
  const [showPaywall, setShowPaywall] = useState(false);
  const { hasEntitlement, status } = useAuthStore();
  
  const isPro = hasEntitlement('pro');
  const isLoading = status === 'loading';

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Vérification de l'abonnement...</p>
      </div>
    );
  }

  // User has PRO - show content
  if (isPro) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show teaser with overlay
  if (showTeaser) {
    return (
      <div style={styles.teaserContainer}>
        <div style={styles.teaserContent}>
          {children}
        </div>
        <div style={styles.teaserOverlay}>
          <div style={styles.lockCard}>
            <Lock size={32} />
            <h3 style={styles.lockTitle}>Fonctionnalité PRO</h3>
            <p style={styles.lockDescription}>
              {feature} est disponible avec l'abonnement PRO
            </p>
            <button
              style={styles.unlockButton}
              onClick={() => setShowPaywall(true)}
            >
              Débloquer avec PRO
            </button>
          </div>
        </div>
        {showPaywall && (
          <Paywall 
            feature={feature}
            onClose={() => setShowPaywall(false)}
          />
        )}
      </div>
    );
  }

  // Default: Show locked state with option to open paywall
  return (
    <>
      <div style={styles.lockedContainer}>
        <div style={styles.lockedCard}>
          <Lock size={48} style={{ color: '#9ca3af' }} />
          <h3 style={styles.lockedTitle}>Fonctionnalité PRO</h3>
          <p style={styles.lockedDescription}>
            {feature} nécessite un abonnement PRO pour être utilisée.
          </p>
          <button
            style={styles.upgradeButton}
            onClick={() => setShowPaywall(true)}
          >
            Passer à PRO
          </button>
        </div>
      </div>
      {showPaywall && (
        <Paywall 
          feature={feature}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </>
  );
};

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  teaserContainer: {
    position: 'relative',
  },
  teaserContent: {
    filter: 'blur(4px)',
    opacity: 0.5,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  teaserOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  lockCard: {
    textAlign: 'center',
    padding: '32px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px',
  },
  lockTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '16px 0 8px',
  },
  lockDescription: {
    color: '#6b7280',
    marginBottom: '24px',
  },
  unlockButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  lockedContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: '40px',
  },
  lockedCard: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: '#f9fafb',
    borderRadius: '16px',
    border: '2px dashed #e5e7eb',
    maxWidth: '500px',
  },
  lockedTitle: {
    fontSize: '24px',
    fontWeight: '600',
    margin: '24px 0 12px',
    color: '#374151',
  },
  lockedDescription: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px',
    lineHeight: '1.5',
  },
  upgradeButton: {
    backgroundColor: '#fbbf24',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
};