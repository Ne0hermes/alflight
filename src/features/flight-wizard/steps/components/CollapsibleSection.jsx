import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { theme } from '../../../../styles/theme';

/**
 * Composant pour afficher une section collapsible/réductible
 * @param {string} title - Titre de la section
 * @param {React.ReactNode} children - Contenu de la section
 * @param {boolean} defaultExpanded - État initial (ouvert/fermé)
 * @param {string} titleColor - Couleur du titre (optionnel)
 * @param {object} containerStyle - Styles additionnels pour le container
 */
export const CollapsibleSection = ({
  title,
  children,
  defaultExpanded = false, // 🔧 FIX: Fermé par défaut
  titleColor = theme.colors.primary,
  containerStyle = {}
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <>
      {/* Styles pour l'impression PDF */}
      <style>{`
        @media print {
          .collapsible-section {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .collapsible-content {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          .collapsible-content * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .collapsible-chevron {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="collapsible-section"
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden',
          ...containerStyle
        }}
      >
        {/* Header cliquable */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            cursor: 'pointer',
            backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'white',
            borderBottom: isExpanded ? `1px solid ${theme.colors.border}` : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <h4 style={{
            fontSize: '16px',
            color: titleColor,
            margin: 0,
            fontWeight: '600'
          }}>
            {title}
          </h4>

          <span className="collapsible-chevron">
            {isExpanded ? (
              <ChevronUp size={20} style={{ color: theme.colors.textSecondary }} />
            ) : (
              <ChevronDown size={20} style={{ color: theme.colors.textSecondary }} />
            )}
          </span>
        </div>

        {/* Contenu collapsible */}
        <div
          className="collapsible-content"
          style={{
            display: isExpanded ? 'block' : 'none',
            padding: '16px'
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default CollapsibleSection;
