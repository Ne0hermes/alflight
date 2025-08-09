// src/features/navigation/components/MapConnectionTestV2.jsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader, MapPin, Globe, Server, Wifi, WifiOff } from 'lucide-react';

const MapConnectionTestV2 = () => {
  const [tests, setTests] = useState({
    leaflet: { status: 'testing', message: 'Vérification de Leaflet...' },
    tiles: { status: 'testing', message: 'Test de connexion OpenStreetMap...' },
    proxy: { status: 'testing', message: 'Test du proxy OpenAIP...' },
    network: { status: 'testing', message: 'Test de connectivité réseau...' }
  });

  const [tileProviders, setTileProviders] = useState({});

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    // Test 1: Leaflet
    if (window.L && window.L.version) {
      updateTest('leaflet', 'success', `Leaflet v${window.L.version} chargé`);
    } else {
      updateTest('leaflet', 'error', 'Leaflet non disponible');
    }

    // Test 2: Fournisseur de tuiles OpenStreetMap
    const providers = {
      'OpenStreetMap': 'https://a.tile.openstreetmap.org/1/0/0.png'
    };

    let workingProviders = [];
    
    for (const [name, url] of Object.entries(providers)) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const loaded = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 3000);
          img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
          img.src = url;
        });

        setTileProviders(prev => ({
          ...prev,
          [name]: loaded ? 'success' : 'failed'
        }));

        if (loaded) {
          workingProviders.push(name);
        }
      } catch (error) {
        setTileProviders(prev => ({
          ...prev,
          [name]: 'error'
        }));
      }
    }

    if (workingProviders.length > 0) {
      updateTest('tiles', 'success', `OpenStreetMap disponible et fonctionnel`);
    } else {
      updateTest('tiles', 'error', 'OpenStreetMap non disponible');
    }

    // Test 3: Proxy OpenAIP
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('http://localhost:3001/api/openaip/airports?country=FR&limit=1', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        updateTest('proxy', 'success', `Proxy OpenAIP OK - ${data.totalCount || 0} aéroports disponibles`);
      } else {
        updateTest('proxy', 'warning', `Proxy répond mais erreur: ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        updateTest('proxy', 'error', 'Proxy OpenAIP timeout (>5s)');
      } else {
        updateTest('proxy', 'error', 'Proxy non disponible - Impossible de charger les aérodromes');
      }
    }

    // Test 4: Connectivité réseau générale
    try {
      const online = navigator.onLine;
      if (online) {
        // Test avec un service public qui autorise CORS
        const testUrl = 'https://api.github.com/zen';
        const response = await fetch(testUrl, { 
          method: 'GET',
          mode: 'cors'
        }).catch(() => null);
        
        if (response && response.ok) {
          updateTest('network', 'success', 'Connexion internet OK');
        } else {
          updateTest('network', 'warning', 'Internet OK mais restrictions possibles');
        }
      } else {
        updateTest('network', 'error', 'Pas de connexion internet');
      }
    } catch (error) {
      updateTest('network', 'warning', 'Test réseau incertain');
    }
  };

  const updateTest = (key, status, message) => {
    setTests(prev => ({
      ...prev,
      [key]: { status, message }
    }));
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success': return <CheckCircle size={20} color="#10b981" />;
      case 'error': return <AlertCircle size={20} color="#ef4444" />;
      case 'warning': return <AlertCircle size={20} color="#f59e0b" />;
      default: return <Loader size={20} className="animate-spin" color="#3b82f6" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return '#d1fae5';
      case 'error': return '#fee2e2';
      case 'warning': return '#fef3c7';
      default: return '#dbeafe';
    }
  };

  const getTileIcon = (status) => {
    switch(status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'error': return '⚠️';
      default: return '⏳';
    }
  };

  // Calculer le statut global
  const allSuccess = Object.values(tests).every(t => t.status === 'success');
  const hasErrors = Object.values(tests).some(t => t.status === 'error');
  const hasWarnings = Object.values(tests).some(t => t.status === 'warning');

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      {/* En-tête avec statut global */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: 0
        }}>
          <Globe size={20} />
          Test de connexion carte & API
        </h3>
        
        <div style={{
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '500',
          backgroundColor: allSuccess ? '#d1fae5' : hasErrors ? '#fee2e2' : '#fef3c7',
          color: allSuccess ? '#065f46' : hasErrors ? '#991b1b' : '#92400e'
        }}>
          {allSuccess ? '✅ Tout fonctionne' : hasErrors ? '⚠️ Problèmes détectés' : '⚡ Fonctionnel avec limitations'}
        </div>
      </div>

      {/* Tests principaux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(tests).map(([key, test]) => (
          <div key={key} style={{
            padding: '12px',
            backgroundColor: getStatusColor(test.status),
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: `1px solid ${
              test.status === 'success' ? '#86efac' :
              test.status === 'error' ? '#fca5a5' :
              test.status === 'warning' ? '#fde047' :
              '#93c5fd'
            }`
          }}>
            {getStatusIcon(test.status)}
            <div style={{ flex: 1 }}>
              <strong style={{ textTransform: 'capitalize' }}>{
                key === 'leaflet' ? 'Bibliothèque carte' :
                key === 'tiles' ? 'OpenStreetMap' :
                key === 'proxy' ? 'API OpenAIP' :
                'Connexion réseau'
              }:</strong> {test.message}
            </div>
          </div>
        ))}
      </div>


      {/* Recommandations */}
      {!allSuccess && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <strong>Recommandations:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {tests.tiles.status === 'error' && (
              <li>Vérifiez votre connexion internet ou essayez un autre réseau</li>
            )}
            {tests.proxy.status !== 'success' && (
              <li>Le proxy OpenAIP n'est pas disponible - Les aérodromes ne peuvent pas être chargés</li>
            )}
            {tests.network.status === 'warning' && (
              <li>Des restrictions réseau peuvent limiter certaines fonctionnalités</li>
            )}
            {tests.leaflet.status === 'error' && (
              <li>Rafraîchissez la page (F5) pour recharger Leaflet</li>
            )}
          </ul>
        </div>
      )}

      {/* Info sur le mode de fonctionnement */}
      <div style={{
        marginTop: '12px',
        padding: '8px',
        backgroundColor: '#fef3c7',
        borderRadius: '4px',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {tests.proxy.status === 'success' ? (
          <>
            <Wifi size={14} />
            <strong>Mode API:</strong> Données en temps réel depuis OpenAIP
          </>
        ) : (
          <>
            <WifiOff size={14} />
            <strong>Erreur API:</strong> Impossible de charger les données OpenAIP
          </>
        )}
      </div>
    </div>
  );
};

export default MapConnectionTestV2;