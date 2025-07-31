// src/shared/components/OpenAIPStatus.jsx
import React, { useState, useEffect } from 'react';
import { openAIPService } from '../../services/openAIPService';

export function OpenAIPStatus() {
  const [status, setStatus] = useState({
    isConnected: false,
    isLoading: true,
    airportCount: 0,
    lastUpdate: null,
    error: null,
    dataMode: 'static' // 'static' ou 'api'
  });

  useEffect(() => {
    checkAPIStatus();
  }, []);

  const checkAPIStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Tester la connexion en récupérant les aéroports
      const airports = await openAIPService.getAirports('FR');
      
      setStatus({
        isConnected: true,
        isLoading: false,
        airportCount: airports.length,
        lastUpdate: new Date().toLocaleTimeString(),
        error: null,
        dataMode: airports.length > 0 ? 'static' : 'api'
      });
    } catch (error) {
      setStatus({
        isConnected: false,
        isLoading: false,
        airportCount: 0,
        lastUpdate: new Date().toLocaleTimeString(),
        error: error.message,
        dataMode: 'error'
      });
    }
  };

  const toggleDataSource = async () => {
    openAIPService.toggleDataSource();
    await checkAPIStatus();
  };

  const getStatusColor = () => {
    if (status.isLoading) return 'bg-yellow-500';
    if (status.isConnected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (status.isLoading) return 'Connexion...';
    if (status.isConnected) return 'Connecté';
    return 'Déconnecté';
  };

  const getDataModeIcon = () => {
    if (status.dataMode === 'static') return '📚';
    if (status.dataMode === 'api') return '🌐';
    return '❌';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">OpenAIP Status</h3>
        <div className="flex gap-2">
          <button
            onClick={toggleDataSource}
            disabled={status.isLoading}
            className="text-sm bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 disabled:opacity-50"
            title="Basculer entre API et données statiques"
          >
            {getDataModeIcon()} Mode
          </button>
          <button
            onClick={checkAPIStatus}
            disabled={status.isLoading}
            className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        {status.isConnected && (
          <div className="text-sm text-gray-600">
            <p>Mode : {status.dataMode === 'static' ? 'Données statiques' : 'API en ligne'}</p>
            <p>Aéroports FR chargés : {status.airportCount}</p>
            <p>Dernière mise à jour : {status.lastUpdate}</p>
          </div>
        )}

        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            Erreur : {status.error}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        <p>API Key : {process.env.VITE_OPENAIP_API_KEY ? 'Configurée' : 'Mode démo'}</p>
        <p>Cache : 24h</p>
        <p className="mt-1 text-amber-600">
          {status.dataMode === 'static' && '⚠️ Utilisation des données hors ligne'}
        </p>
      </div>
    </div>
  );
}

// Export par défaut aussi pour plus de flexibilité
export default OpenAIPStatus;