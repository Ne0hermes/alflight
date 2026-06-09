// src/shared/components/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { isStaleChunkError, recoverFromStaleChunks } from '@utils/staleChunkReload';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
    // 🔁 FILET DE SECOURS chunk périmé : si l'erreur vient d'un import dynamique
    // disparu (déploiement pendant que l'onglet tournait), un simple reload
    // retomberait sur le service worker PÉRIMÉ → même 404 → boucle. On purge donc
    // le SW + les caches AVANT de recharger (garde anti-boucle fenêtrée dans
    // recoverFromStaleChunks). C'est le 2e filet derrière le handler
    // `vite:preloadError` de main.jsx, au cas où celui-ci manque (bundle ancien).
    if (isStaleChunkError(error)) {
      this.setState({ recovering: true });
      recoverFromStaleChunks();
    }
  }

  render() {
    if (this.state.hasError) {
      const recovering = this.state.recovering || isStaleChunkError(this.state.error);
      return (
        <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
          <div style={sx.text.center}>
            <AlertTriangle size={48} color="var(--color-red-critical)" />
            <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mt(4))}>
              {recovering ? "Mise à jour de l'application…" : 'Une erreur est survenue'}
            </h2>
            {recovering && (
              <p style={{ marginTop: '8px', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                Une nouvelle version vient d'être déployée. Rechargement en cours…
              </p>
            )}
            <button
              onClick={() => recoverFromStaleChunks({ force: true })}
              style={sx.combine(sx.components.button.base, sx.components.button.primary, sx.spacing.mt(4))}
            >
              {recovering ? 'Recharger maintenant' : 'Rafraîchir'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
