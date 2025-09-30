import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Composant global pour les boutons d'accordéon/déroulants
 * Centralise le style et le comportement des boutons déroulants dans toute l'application
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - État ouvert/fermé de l'accordéon
 * @param {Function} props.onClick - Fonction de callback lors du clic
 * @param {React.ReactNode} props.icon - Icône à afficher (optionnel)
 * @param {string} props.title - Titre du bouton
 * @param {string} props.color - Couleur du bouton (optionnel, défaut: #3b82f6)
 * @param {boolean} props.fullWidth - Si le bouton doit prendre toute la largeur (défaut: true)
 * @param {Object} props.style - Styles personnalisés additionnels (optionnel)
 * @param {string} props.variant - Variante du bouton: 'default', 'minimal', 'outlined' (défaut: 'default')
 */
const AccordionButton = ({
  isOpen = false,
  onClick,
  icon,
  title,
  color = '#3b82f6',
  fullWidth = true,
  style = {},
  variant = 'default',
  className = '',
  disabled = false,
  children
}) => {
  // Styles de base selon la variante
  const baseStyles = {
    default: {
      padding: '12px 16px',
      backgroundColor: isOpen ? color : 'white',
      color: isOpen ? 'white' : '#374151',
      border: `1px solid ${isOpen ? color : '#e5e7eb'}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1,
      ...style
    },
    minimal: {
      padding: '8px 12px',
      backgroundColor: 'transparent',
      color: isOpen ? color : '#6b7280',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1,
      ':hover': {
        backgroundColor: '#f3f4f6'
      },
      ...style
    },
    outlined: {
      padding: '10px 14px',
      backgroundColor: 'white',
      color: isOpen ? color : '#374151',
      border: `2px solid ${isOpen ? color : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  };

  const selectedStyle = baseStyles[variant] || baseStyles.default;

  // Icône chevron
  const ChevronIcon = isOpen ? ChevronUp : ChevronDown;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={selectedStyle}
      className={className}
      disabled={disabled}
      type="button"
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ flex: 1, textAlign: icon ? 'left' : 'center' }}>
        {children || title}
      </span>
      <ChevronIcon size={18} />
    </button>
  );
};

export default AccordionButton;

// Export des variantes pour faciliter l'utilisation
export const AccordionButtonVariants = {
  DEFAULT: 'default',
  MINIMAL: 'minimal',
  OUTLINED: 'outlined'
};