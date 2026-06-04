// src/features/vac/VACModule.jsx
import React, { memo, useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SIAReportEnhanced } from './components/SIAReportEnhanced';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';
import { sx } from '@shared/styles/styleSystem'; // helper de styles centralisé (sx.combine/flex/text/…)

export const VACModule = memo(({ wizardMode = false, config = {} }) => {
  const [showWizardReturn, setShowWizardReturn] = useState(false);

  // Vérifier si on vient du wizard
  useEffect(() => {
    const hasTempDraft = localStorage.getItem('flightPlanDraft_temp');
    if (hasTempDraft) {
      setShowWizardReturn(true);
    }
  }, []);

  const handleReturnToWizard = () => {
    if (window.restoreFlightPlanWizard) {
      window.restoreFlightPlanWizard();
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-vac.jpg"
          eyebrow="DOCS · CARTES VAC SIA"
          title="Cartes VAC"
        />
      )}

      {/* Bandeau de retour au wizard — couleurs éditoriales */}
      {showWizardReturn && (
        <div style={{
          backgroundColor: 'var(--accent-primary)',
          color: 'var(--text-inverse)',
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: tokens.radius?.sm || '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontFamily: tokens.fontFamily.mono,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              EN VOL
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                Préparation de vol en cours
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                Après avoir mis à jour vos VAC, cliquez sur le bouton pour continuer votre préparation
              </div>
            </div>
          </div>
          <button
            onClick={handleReturnToWizard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-regular)',
              borderRadius: tokens.radius?.sm || '2px',
              fontFamily: tokens.fontFamily.mono,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: `transform ${tokens.motion.fast}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <ArrowLeft size={14} />
            Retour wizard
          </button>
        </div>
      )}

      {/* Afficher directement le rapport SIA amélioré */}
      <SIAReportEnhanced />
    </div>
  );
});


// Export des display names
VACModule.displayName = 'VACModule';

export default VACModule;