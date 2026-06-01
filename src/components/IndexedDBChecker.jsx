import React, { useEffect, useState } from 'react';
import { diagnoseIndexedDB, deleteAndRecreateDB } from '../utils/diagnoseIndexedDB';

/**
 * Composant qui vérifie la santé d'IndexedDB au démarrage
 * et propose de réparer en cas de problème
 */
export function IndexedDBChecker({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);

  useEffect(() => {
    // Désactivé temporairement car le diagnostic bloque l'ouverture de la base
    // checkIndexedDB();

    // Laisser la base s'ouvrir normalement
    setIsChecking(false);
  }, []);

  const checkIndexedDB = async () => {
    

    try {
      const result = await diagnoseIndexedDB();
      setDiagnosis(result);

      if (!result.supported) {
        console.error('❌ IndexedDB non supporté');
        setHasError(true);
        setIsChecking(false);
        return;
      }

      if (!result.canOpen) {
        console.error('❌ Impossible d\'ouvrir IndexedDB');
        setHasError(true);
        setIsChecking(false);
        return;
      }

      if (!result.healthy) {
        
        setHasError(true);
        setIsChecking(false);
        return;
      }

      
      setIsChecking(false);
    } catch (error) {
      console.error('❌ Erreur lors du diagnostic IndexedDB:', error);
      setHasError(true);
      setIsChecking(false);
    }
  };

  const handleFix = async () => {
    if (!window.confirm(
      '⚠️  La base de données IndexedDB doit être réparée.\n\n' +
      'Cette action va :\n' +
      '• Supprimer la base de données corrompue\n' +
      '• Recharger la page pour recréer une base saine\n\n' +
      '⚠️  ATTENTION: Les données stockées localement seront perdues.\n' +
      'Assurez-vous d\'avoir exporté vos avions et vols importants.\n\n' +
      'Continuer ?'
    )) {
      return;
    }

    try {
      await deleteAndRecreateDB();
    } catch (error) {
      console.error('❌ Erreur lors de la réparation:', error);
      alert('Erreur lors de la réparation:\n' + error.message);
    }
  };

  const handleContinueAnyway = () => {
    
    setIsChecking(false);
    setHasError(false);
  };

  // Affichage pendant la vérification
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-overlay)',
        padding: '20px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px'
        }}>
          🔍
        </div>
        <h2 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>
          Vérification du stockage local...
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Veuillez patienter
        </p>
      </div>
    );
  }

  // Affichage en cas d'erreur
  if (hasError && diagnosis) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'rgba(242, 105, 33, 0.10)',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '600px',
          backgroundColor: 'var(--bg-overlay)',
          padding: '30px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '2px solid var(--accent-primary)'
        }}>
          <div style={{
            fontSize: '48px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            ⚠️
          </div>

          <h2 style={{
            textAlign: 'center',
            marginBottom: '20px',
            color: 'var(--accent-primary)'
          }}>
            Problème de stockage détecté
          </h2>

          <div style={{
            backgroundColor: 'rgba(242, 105, 33, 0.10)',
            padding: '15px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            fontSize: '14px',
            color: 'var(--accent-primary)'
          }}>
            {!diagnosis.supported && (
              <p>❌ Votre navigateur ne supporte pas IndexedDB.</p>
            )}
            {diagnosis.supported && !diagnosis.canOpen && (
              <>
                <p><strong>Erreur:</strong> {diagnosis.error?.message || diagnosis.error}</p>
                <p style={{ marginTop: '10px' }}>
                  <strong>Recommandation:</strong> {diagnosis.recommendation}
                </p>
              </>
            )}
            {diagnosis.supported && diagnosis.canOpen && !diagnosis.healthy && (
              <>
                <p>⚠️  La base de données est incomplète.</p>
                <p style={{ marginTop: '10px' }}>
                  <strong>Stores manquants:</strong> {diagnosis.missingStores?.join(', ')}
                </p>
              </>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleFix}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              🔧 Réparer maintenant
            </button>

            <button
              onClick={handleContinueAnyway}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Continuer quand même
            </button>
          </div>

          <p style={{
            marginTop: '20px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}>
            💡 Astuce: Exportez régulièrement vos données importantes
          </p>
        </div>
      </div>
    );
  }

  // Si tout va bien, afficher l'application normalement
  return children;
}
