// src/shared/components/PlaceholderDev.jsx
import React from 'react';
import { AlertCircle, Construction, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

/**
 * Composant placeholder pour indiquer les fonctionnalités en cours de développement
 * Remplace les éléments OpenAIP supprimés
 */
export const PlaceholderDev = ({ 
  area, 
  message, 
  showIcon = true,
  variant = 'warning', // 'warning', 'info', 'error'
  compact = false,
  action = null // Composant ou fonction pour action alternative
}) => {
  const variants = {
    warning: {
      bg: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
      icon: Construction,
      iconColor: '#f59e0b'
    },
    info: {
      bg: '#dbeafe',
      border: '#3b82f6',
      text: '#1e40af',
      icon: Info,
      iconColor: '#3b82f6'
    },
    error: {
      bg: '#fee2e2',
      border: '#ef4444',
      text: '#991b1b',
      icon: AlertCircle,
      iconColor: '#ef4444'
    }
  };

  const style = variants[variant] || variants.warning;
  const Icon = style.icon;

  const containerStyle = {
    padding: compact ? '8px 12px' : '16px',
    backgroundColor: style.bg,
    border: `1px solid ${style.border}`,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: compact ? '8px' : '12px',
    marginBottom: '16px'
  };

  const titleStyle = {
    fontWeight: 600,
    color: style.text,
    fontSize: compact ? '14px' : '16px'
  };

  const messageStyle = {
    fontSize: compact ? '12px' : '14px',
    color: style.text,
    marginTop: compact ? '2px' : '4px',
    opacity: 0.9
  };

  return (
    <div style={containerStyle}>
      {showIcon && <Icon size={compact ? 16 : 20} color={style.iconColor} />}
      <div style={{ flex: 1 }}>
        <div style={titleStyle}>
          {area ? `${area} - En cours de développement` : 'En cours de développement'}
        </div>
        {message && (
          <div style={messageStyle}>
            {message}
          </div>
        )}
        {action && (
          <div style={{ marginTop: '8px' }}>
            {typeof action === 'function' ? action() : action}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Badge compact pour indiquer le statut de développement
 */
export const DevBadge = ({ compact = false, text = 'DEV' }) => {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: compact ? '2px 6px' : '4px 8px',
    backgroundColor: '#f59e0b',
    color: 'white',
    borderRadius: '4px',
    fontSize: compact ? '10px' : '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return <span style={style}>{text}</span>;
};

/**
 * Overlay pour sections entières en développement
 */
export const DevOverlay = ({ children, message = "Cette section est en cours de développement" }) => {
  const overlayStyle = {
    position: 'relative',
    opacity: 0.5,
    pointerEvents: 'none',
    filter: 'grayscale(100%)'
  };

  const bannerStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '16px',
    zIndex: 1000,
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div style={overlayStyle}>
      {children}
      <div style={bannerStyle}>
        <Construction size={24} style={{ marginBottom: '8px' }} />
        <div>{message}</div>
      </div>
    </div>
  );
};

/**
 * Message inline pour remplacer du contenu manquant
 */
export const DevInlineMessage = ({ text = "Données non disponibles", icon = true }) => {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#f59e0b',
    fontSize: '14px',
    fontStyle: 'italic'
  };

  return (
    <span style={style}>
      {icon && <AlertCircle size={14} />}
      {text}
    </span>
  );
};

export default PlaceholderDev;