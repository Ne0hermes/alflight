// src/features/logbook/LogbookModule.jsx
// ============================================================================
//  LogbookModule — Refonte charte éditoriale ALFlight (Phase 3.4)
//
//  Conteneur sur fond --bg-surface avec bordure éditoriale subtile.
//  Plus aucune couleur hardcodée (white/box-shadow remplacés par variables).
// ============================================================================

import React, { useState, lazy, Suspense, useEffect } from 'react';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

// Import lazy pour éviter les problèmes de dépendances circulaires
const PilotLogbook = lazy(() =>
  import('../pilot/components/PilotLogbook').then((module) => ({ default: module.default }))
);
// Note: TechnicalLogModule supprimé - fonctionnalité retirée de l'application

const LogbookModule = () => {
  // Vérifier si on doit ouvrir le formulaire dès le début
  const shouldOpenForm = window.logbookAction === 'add';
  const [forceShowForm, setForceShowForm] = useState(shouldOpenForm);

  // Écouter les changements de navigation pour détecter si on vient du bouton "Ajouter un vol"
  useEffect(() => {
    if (window.logbookAction === 'add') {
      setForceShowForm(true);
      window.logbookAction = null;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      setForceShowForm(true);
    }
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié.
          PLACEHOLDER : splash-cockpit.jpg en attendant hero-logbook.jpg dédié.
          Une fois le fichier hero-logbook.jpg ajouté dans public/assets/photos/,
          changer cette URL pour /assets/photos/hero-logbook.jpg. */}
      <ModuleHero
        image="/assets/photos/splash-cockpit.jpg"
        eyebrow="LOGBOOK · CARNET ÉLECTRONIQUE"
        title="Carnet de bord"
      />

      {/* Conteneur principal */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: tokens.radius?.sm || '2px',
          padding: tokens.spacing[6],
          marginBottom: tokens.spacing[5],
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <PilotLogbook showFormProp={forceShowForm} />
        </Suspense>
      </section>
    </div>
  );
};

export default LogbookModule;
