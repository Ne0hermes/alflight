// src/features/navigation/components/MapConnectionTest.jsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader, MapPin, Globe, Server } from 'lucide-react';

const MapConnectionTest = () => {
  const [tests, setTests] = useState({
    leaflet: { status: 'testing', message: 'Vérification de Leaflet...' },
    osm: { status: 'testing', message: 'Test de connexion à OpenStreetMap...' },
    tile: { status: 'testing', message: 'Test de chargement des tuiles...' },
    cors: { status: 'testing', message: 'Vérification CORS...' }
  });

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    // Test 1: Leaflet disponible
    if (window.L && window.L.version) {
      updateTest('leaflet', 'success', `Leaflet v${window.L.version} chargé`);
    } else {
      updateTest('leaflet', 'error', 'Leaflet non disponible');
    }

    // Test 2: Connexion OSM via fetch
    try {
      const testUrl = 'https://tile.openstreetmap.org/1/0/0.png';
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        mode: 'no-cors' // Éviter les erreurs CORS
      });
      updateTest('osm', 'success', 'Serveur OSM accessible');
    } catch (error) {
      updateTest('osm', 'error', `Erreur connexion OSM: ${error.message}`);
    }

    // Test 3: Chargement d'une tuile test
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const loaded = await new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = 'https://a.tile.openstreetmap.org/1/0/0.png';
        
        // Timeout après 5 secondes
        setTimeout(() => resolve(false), 5000);
      });

      if (loaded) {
        updateTest('tile', 'success', 'Tuiles OSM chargées avec succès');
      } else {
        updateTest('tile', 'warning', 'Tuiles OSM lentes ou bloquées');
      }
    } catch (error) {
      updateTest('tile', 'error', `Erreur tuiles: ${error.message}`);
    }

    // Test 4: Test CORS et proxy
    try {
      // Vérifier si on peut accéder à l'API OpenAIP via proxy
      const proxyUrl = 'http://localhost:3001/api/openaip/airports?country=FR&limit=1';
      const response = await fetch(proxyUrl).catch(() => null);
      
      if (response && response.ok) {
        updateTest('cors', 'success', 'Proxy OpenAIP fonctionnel');
      } else {
        updateTest('cors', 'warning', 'Proxy OpenAIP non disponible (normal si non démarré)');
      }
    } catch (error) {
      updateTest('cors', 'warning', 'Proxy non configuré');
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

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Globe size={20} />
        Test de connexion carte & API
      </h3>

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
            <div>
              <strong style={{ textTransform: 'capitalize' }}>{key}:</strong> {test.message}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <strong>Résolution des problèmes:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Si Leaflet n'est pas chargé → Rafraîchir la page (F5)</li>
          <li>Si OSM est bloqué → Vérifier votre connexion internet</li>
          <li>Si les tuiles sont lentes → Possibilité de pare-feu ou proxy d'entreprise</li>
          <li>Si le proxy OpenAIP n'est pas disponible → Normal, démarrez-le avec `npm run proxy`</li>
        </ul>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '8px',
        backgroundColor: '#fef3c7',
        borderRadius: '4px',
        fontSize: '11px'
      }}>
        <strong>Alternative:</strong> Si OpenStreetMap est bloqué, essayez d'autres fournisseurs de tuiles comme CartoDB ou Stamen
      </div>
    </div>
  );
};

export default MapConnectionTest;