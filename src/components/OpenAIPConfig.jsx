// src/components/OpenAIPConfig.jsx
import React, { useState, useEffect } from 'react';
import { Database, Cloud, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@/services/openAIPService';
import { useOpenAIPStore } from '@core/stores/openAIPStore';

export const OpenAIPConfig = () => {
  const [isStaticMode, setIsStaticMode] = useState(openAIPService.isUsingStaticData());
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { loadAirports } = useOpenAIPStore();

  // Vérifier le mode actuel au montage
  useEffect(() => {
    const currentMode = openAIPService.isUsingStaticData();
    console.log('🔍 Mode actuel:', currentMode ? 'Statique' : 'API');
    setIsStaticMode(currentMode);
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const status = await openAIPService.testConnection();
      setConnectionStatus(status);
    } catch (error) {
      setConnectionStatus({ connected: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = async () => {
    setIsLoading(true);
    try {
      const newMode = openAIPService.toggleDataSource();
      setIsStaticMode(newMode);
      await checkConnection();
      
      // Recharger les aéroports avec le nouveau mode
      console.log('🔄 Rechargement des aéroports avec le mode:', newMode ? 'Statique' : 'API');
      await loadAirports('FR');
      
    } catch (error) {
      console.error('Erreur lors du changement de mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModeIcon = () => {
    return isStaticMode ? <Database size={16} /> : <Cloud size={16} />;
  };

  const getStatusIcon = () => {
    if (isLoading) return <Loader size={16} className="animate-spin" />;
    if (!connectionStatus) return null;
    
    if (connectionStatus.connected) {
      return <CheckCircle size={16} style={{ color: '#10b981' }} />;
    } else {
      return <AlertCircle size={16} style={{ color: '#ef4444' }} />;
    }
  };

  const getModeDescription = () => {
    if (isStaticMode) {
      return "Données statiques (80 aéroports FR)";
    } else {
      return "API OpenAIP via proxy";
    }
  };

  const getStatusDescription = () => {
    if (!connectionStatus) return '';
    
    if (connectionStatus.mode === 'static') {
      return `${connectionStatus.airports} aéroports disponibles (statique)`;
    } else if (connectionStatus.mode === 'api') {
      return `${connectionStatus.totalAirports || '?'} aéroports disponibles (API)`;
    } else if (connectionStatus.mode === 'proxy') {
      return 'Proxy connecté';
    } else if (connectionStatus.mode === 'api-error') {
      return `API error: ${connectionStatus.error}`;
    } else {
      return connectionStatus.error || 'Erreur de connexion';
    }
  };

  return (
    <div style={sx.combine(
      sx.components.card.base,
      sx.spacing.p(3),
      sx.spacing.mb(4),
      { backgroundColor: '#f9fafb' }
    )}>
      <div style={sx.combine(sx.flex.between, sx.flex.alignCenter)}>
        <div style={sx.flex.col}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(1))}>
            {getModeIcon()} Source des données OpenAIP
          </h4>
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {getModeDescription()}
          </p>
          {connectionStatus && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              {getStatusIcon()} {getStatusDescription()}
            </p>
          )}
        </div>
        
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <button
            onClick={checkConnection}
            disabled={isLoading}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary,
              { padding: '8px 12px' }
            )}
            title="Tester la connexion"
          >
            <RefreshCw size={16} />
          </button>
          
          <button
            onClick={toggleMode}
            disabled={isLoading}
            style={sx.combine(
              sx.components.button.base,
              !isStaticMode ? sx.components.button.primary : sx.components.button.secondary,
              { minWidth: '120px' }
            )}
          >
            {isLoading ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <>
                {isStaticMode ? 'Activer API' : 'Mode statique'}
              </>
            )}
          </button>
        </div>
      </div>
      
      {!isStaticMode && (!connectionStatus || !connectionStatus.connected) && (
        <div style={sx.combine(
          sx.components.alert.base,
          sx.components.alert.warning,
          sx.spacing.mt(3)
        )}>
          <AlertCircle size={16} />
          <div>
            <p style={sx.text.sm}>
              Le serveur proxy n'est pas accessible.
            </p>
            <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
              Assurez-vous que le serveur est démarré : <code>cd server && npm run dev</code>
            </p>
          </div>
        </div>
      )}
      
      {/* Panneau de debug temporaire */}
      {process.env.NODE_ENV === 'development' && (
        <div style={sx.combine(sx.spacing.mt(3), sx.text.xs, sx.text.secondary)}>
          <details>
            <summary style={{ cursor: 'pointer' }}>🔧 Debug Info</summary>
            <div style={sx.combine(sx.spacing.mt(2), sx.spacing.p(2), { backgroundColor: '#f3f4f6', borderRadius: '4px' })}>
              <p>Mode Component: {isStaticMode ? 'Statique' : 'API'}</p>
              <p>Service OpenAIP: {openAIPService.isUsingStaticData() ? 'Statique' : 'API'}</p>
              <p>LocalStorage: {localStorage.getItem('openaip_use_static_data') || 'not set'}</p>
              <p>Proxy URL: {import.meta.env.VITE_OPENAIP_PROXY_URL || 'http://localhost:3001/api/openaip'}</p>
              <details style={sx.spacing.mt(2)}>
                <summary>Status complet</summary>
                <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                  {JSON.stringify(connectionStatus, null, 2)}
                </pre>
              </details>
              <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mt(2))}>
                <button
                  onClick={() => {
                    localStorage.removeItem('openaip_use_static_data');
                    window.location.reload();
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.danger, { fontSize: '11px' })}
                >
                  Reset & Reload
                </button>
                <button
                  onClick={async () => {
                    console.log('Force API mode');
                    openAIPService.toggleDataSource(false);
                    setIsStaticMode(false);
                    await checkConnection();
                    await loadAirports('FR');
                  }}
                  style={sx.combine(sx.components.button.base, sx.components.button.primary, { fontSize: '11px' })}
                >
                  Force API Mode
                </button>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default OpenAIPConfig;