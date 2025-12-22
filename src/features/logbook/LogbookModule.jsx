// src/features/logbook/LogbookModule.jsx
// Module Carnet de bord - Carnet de vol électronique

import React, { useState, lazy, Suspense, useEffect } from 'react';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

// Import lazy pour éviter les problèmes de dépendances circulaires
const PilotLogbook = lazy(() => import('../pilot/components/PilotLogbook').then(module => ({ default: module.default })));
// Note: TechnicalLogModule supprimé - fonctionnalité retirée de l'application

const LogbookModule = () => {
  // Vérifier si on doit ouvrir le formulaire dès le début
  const shouldOpenForm = window.logbookAction === 'add';
  const [forceShowForm, setForceShowForm] = useState(shouldOpenForm);

  // Écouter les changements de navigation pour détecter si on vient du bouton "Ajouter un vol"
  useEffect(() => {
    // Si on avait l'action 'add', la réinitialiser
    if (window.logbookAction === 'add') {
      setForceShowForm(true);
      window.logbookAction = null; // Réinitialiser pour la prochaine fois
    }

    // Vérifier aussi les paramètres d'URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      setForceShowForm(true);
    }
  }, []);


  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '20px',
      padding: '20px'
    }}>
      <Suspense fallback={<LoadingSpinner />}>
        <PilotLogbook showFormProp={forceShowForm} />
      </Suspense>
    </div>
  );
};

export default LogbookModule;