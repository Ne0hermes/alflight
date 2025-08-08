// src/components/OpenAIPConfig.jsx
import React, { useState, useEffect } from 'react';
import { Database, Cloud, AlertCircle, CheckCircle, Loader, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@/services/openAIPService';
import { useOpenAIPStore } from '@core/stores/openAIPStore';

export const OpenAIPConfig = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { loadAirports, loadAirspaces, loadNavaids } = useOpenAIPStore();

  // Vérifier la connexion au montage
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const status = await openAIPService.testConnection();
      setConnectionStatus(status);
      console.log('🔍 État de la connexion:', status);
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const reloadData = async () => {
    setIsLoading(true);
    try {
      // Vider le cache et recharger
      openAIPService.clearCache();
      
      // Recharger toutes les données
      console.log('🔄 Rechargement de toutes les données OpenAIP...');
      await Promise.all([
        loadAirports('FR'),
        loadAirspaces('FR'),
        loadNavaids('FR')
      ]);
      
      console.log('✅ Données rechargées avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du rechargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionError = () => {
    return openAIPService.getConnectionError();
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
          <Database size={20} />
          <span style={sx.spacing.ml(2)}>Configuration OpenAIP</span>
        </h3>
        <button
          onClick={checkConnection}
          disabled={isLoading}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            { minWidth: '40px', padding: '6px' }
          )}
          title="Tester la connexion"
        >
          {isLoading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {/* État de la connexion */}
      <div style={sx.spacing.mb(3)}>
        <div style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          État de la connexion
        </div>
        
        {connectionStatus && (
          <div style={sx.combine(
            sx.components.alert.base,
            connectionStatus.success ? sx.components.alert.success : sx.components.alert.error,
            sx.spacing.mb(2)
          )}>
            {connectionStatus.success ? (
              <>
                <CheckCircle size={16} />
                <div>
                  <strong>Connexion établie</strong>
                  <p style={sx.text.xs}>
                    Mode: {connectionStatus.mode === 'proxy' ? 'Proxy local (port 3001)' : 'API directe'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <div>
                  <strong>Connexion impossible</strong>
                  <p style={sx.text.xs}>
                    {connectionStatus.error || 'Ni le proxy ni l\'API directe ne sont accessibles'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Message d'erreur persistant */}
        {!connectionStatus?.success && getConnectionError() && (
          <div style={sx.combine(
            sx.components.alert.base,
            sx.components.alert.warning,
            sx.spacing.mb(2)
          )}>
            <AlertCircle size={16} />
            <div style={{ flex: 1 }}>
              <p style={sx.text.sm}>
                <strong>Dernière erreur:</strong> {getConnectionError()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mode actuel */}
      <div style={sx.spacing.mb(3)}>
        <div style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Configuration
        </div>
        <div style={sx.combine(sx.bg.gray, sx.rounded.md, sx.spacing.p(3))}>
          <div style={sx.flex.start}>
            <Cloud size={16} style={{ marginRight: '8px', color: '#3b82f6' }} />
            <div style={{ flex: 1 }}>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>Mode API uniquement</p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Les données sont récupérées depuis l'API OpenAIP
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Solutions en cas d'erreur */}
      {!connectionStatus?.success && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
          <AlertCircle size={16} />
          <div>
            <strong style={sx.text.sm}>Pour activer la connexion:</strong>
            <ol style={sx.combine(sx.text.xs, sx.spacing.mt(2), { marginLeft: '20px' })}>
              <li>Démarrez le proxy OpenAIP sur le port 3001</li>
              <li>Ou configurez votre clé API dans le fichier .env</li>
              <li>Vérifiez votre connexion internet</li>
            </ol>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={sx.flex.row}>
        <button
          onClick={reloadData}
          disabled={isLoading || !connectionStatus?.success}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.primary,
            isLoading || !connectionStatus?.success ? { opacity: 0.5, cursor: 'not-allowed' } : {}
          )}
        >
          {isLoading ? (
            <>
              <Loader size={16} className="animate-spin" />
              Chargement...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Recharger les données
            </>
          )}
        </button>
      </div>

      {/* Statistiques */}
      {connectionStatus?.success && (
        <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
            Cache actif pendant 5 minutes après chaque chargement
          </p>
        </div>
      )}
    </div>
  );
};

export default OpenAIPConfig;