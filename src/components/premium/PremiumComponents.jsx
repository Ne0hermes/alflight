import React from 'react';

// PremiumButton component
export const PremiumButton = ({ children, onClick, style, disabled, ...props }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        background: 'linear-gradient(135deg, #f26921, #FF7E36)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.3s ease',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};

// PremiumCard component
export const PremiumCard = ({ children, style, ...props }) => {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(147, 22, 60, 0.1)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// PremiumBadge component
export const PremiumBadge = ({ children, variant = 'default', style, ...props }) => {
  const variants = {
    default: {
      background: 'rgba(147, 22, 60, 0.1)',
      color: '#f26921'
    },
    success: {
      background: 'rgba(16, 185, 129, 0.1)',
      color: 'var(--text-primary)'
    },
    warning: {
      background: 'rgba(251, 191, 36, 0.1)',
      color: 'var(--accent-primary)'
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#C04534'
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        ...variants[variant],
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  );
};

// PremiumSpinner component
export const PremiumSpinner = ({ size = 24, style, ...props }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid rgba(147, 22, 60, 0.2)`,
        borderTopColor: '#f26921',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        ...style
      }}
      {...props}
    />
  );
};

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  if (!document.head.querySelector('style[data-premium-components]')) {
    style.setAttribute('data-premium-components', 'true');
    document.head.appendChild(style);
  }
}