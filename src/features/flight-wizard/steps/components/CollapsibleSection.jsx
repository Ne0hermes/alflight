import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { theme } from '../../../../styles/theme';

/**
 * Composant pour afficher une section collapsible/réductible
 * @param {string} title - Titre de la section
 * @param {React.ReactNode} children - Contenu de la section
 * @param {boolean} defaultExpanded - État initial (ouvert/fermé)
 * @param {string} titleColor - Couleur du titre (optionnel)
 * @param {object} containerStyle - Styles additionnels pour le container
 * @param {object} expandSignal - Signal « Tout déplier/replier » du parent :
 *   { value: boolean, tick: number } — appliqué à chaque nouveau tick
 * @param {boolean} pdfHideHeader - Masque l'en-tête d'accordéon dans la
 *   capture PDF (pour les sections dont le CONTENU porte déjà son titre et
 *   saute en page suivante — évite un bandeau orphelin + titre en doublon)
 */
export const CollapsibleSection = ({
  title,
  children,
  defaultExpanded = false, // 🔧 FIX: Fermé par défaut
  titleColor = theme.colors.primary,
  containerStyle = {},
  expandSignal = null,
  pdfHideHeader = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 🔧 LOT 4 — contrôle global depuis le parent (Tout déplier / Tout replier)
  useEffect(() => {
    if (expandSignal && typeof expandSignal.value === 'boolean') {
      setIsExpanded(expandSignal.value);
    }
  }, [expandSignal]);

  return (
    <>
      {/* 🔧 LOT 3 : l'ancien bloc @media print était MORT — le PDF est une
          capture html2canvas, jamais une impression. Le dépliage forcé des
          sections et le masquage des chevrons dans le PDF sont désormais dans
          src/styles/pdf-capture.css (scope .html2pdf__container). */}

      <div
        className="collapsible-section"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden',
          ...containerStyle
        }}
      >
        {/* Header cliquable — fond aux variables de thème (le 'white' codé en
            dur rendait les titres illisibles en thème sombre, Lot 4) */}
        <div
          className={pdfHideHeader ? 'collapsible-header pdf-hidden' : 'collapsible-header'}
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            cursor: 'pointer',
            backgroundColor: isExpanded ? 'var(--bg-overlay)' : 'var(--bg-surface)',
            borderBottom: isExpanded ? `1px solid ${theme.colors.border}` : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <h4 style={{
            fontSize: 'var(--fs-title)',
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
