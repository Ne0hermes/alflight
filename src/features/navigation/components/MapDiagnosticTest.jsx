// src/features/navigation/components/MapDiagnosticTest.jsx
import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, CheckCircle, Loader, Map, Globe } from 'lucide-react';

const MapDiagnosticTest = () => {
  const [tests, setTests] = useState({
    leafletGlobal: { status: 'testing', message: 'Test de Leaflet global...' },
    leafletVersion: { status: 'testing', message: 'Vérification version...' },
    osmTile: { status: 'testing', message: 'Test tuile OSM...' },
    mapCreation: { status: 'testing', message: 'Test création carte...' },
    alternativeTiles: { status: 'testing', message: 'Test fournisseurs alternatifs...' }
  });
  
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(null);
  const [tileTests, setTileTests] = useState({});

  useEffect(() => {
    runTests();
  }, []);

  const updateTest = (key, status, message) => {
    setTests(prev => ({
      ...prev,
      [key]: { status, message }
    }));
  };

  const runTests = async () => {
    // Test 1: Leaflet disponible globalement
    if (window.L) {
      updateTest('leafletGlobal', 'success', `✅ Leaflet disponible (window.L existe)`);
      
      // Test 2: Version de Leaflet
      if (window.L.version) {
        updateTest('leafletVersion', 'success', `✅ Leaflet version ${window.L.version}`);
      } else {
        updateTest('leafletVersion', 'warning', '⚠️ Version Leaflet non détectable');
      }
    } else {
      updateTest('leafletGlobal', 'error', '❌ Leaflet non chargé (window.L undefined)');
      updateTest('leafletVersion', 'error', '❌ Pas de version (Leaflet absent)');
    }

    // Test 3: Chargement direct d'une tuile OSM
    try {
      const testUrls = [
        { name: 'OSM serveur A', url: 'https://a.tile.openstreetmap.org/1/0/0.png' },
        { name: 'OSM serveur B', url: 'https://b.tile.openstreetmap.org/1/0/0.png' },
        { name: 'OSM serveur C', url: 'https://c.tile.openstreetmap.org/1/0/0.png' },
        { name: 'CartoDB (backup)', url: 'https://a.basemaps.cartocdn.com/light_all/1/0/0.png' }
      ];

      let successCount = 0;
      const results = [];

      for (const test of testUrls) {
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
          
          img.src = test.url;
        });

        if (loaded) {
          successCount++;
          results.push(`✅ ${test.name}`);
          setTileTests(prev => ({ ...prev, [test.name]: 'success' }));
        } else {
          results.push(`❌ ${test.name}`);
          setTileTests(prev => ({ ...prev, [test.name]: 'error' }));
        }
      }

      if (successCount > 0) {
        updateTest('osmTile', 'success', `✅ Tuiles OK (${successCount}/4 serveurs)`);
      } else {
        updateTest('osmTile', 'error', '❌ Aucune tuile ne charge');
      }

    } catch (error) {
      updateTest('osmTile', 'error', `❌ Erreur test tuiles: ${error.message}`);
    }

    // Test 4: Création d'une carte simple
    if (window.L && mapRef.current) {
      try {
        // Nettoyer toute carte existante
        if (mapRef.current._leaflet_id) {
          const existingMap = window.L.map(mapRef.current);
          existingMap.remove();
        }

        // Créer une nouvelle carte
        const map = window.L.map(mapRef.current, {
          center: [48.8566, 2.3522],
          zoom: 5,
          preferCanvas: true
        });

        // Essayer OSM d'abord
        let tileLayerAdded = false;
        
        try {
          const osmLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
            crossOrigin: true
          });
          
          osmLayer.addTo(map);
          tileLayerAdded = true;
          updateTest('mapCreation', 'success', '✅ Carte créée avec OSM');
        } catch (osmError) {
          console.error('Erreur OSM:', osmError);
          
          // Essayer CartoDB en fallback
          try {
            const cartoLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
              attribution: '© CartoDB',
              maxZoom: 19
            });
            
            cartoLayer.addTo(map);
            tileLayerAdded = true;
            updateTest('mapCreation', 'warning', '⚠️ Carte créée avec CartoDB (OSM échoué)');
          } catch (cartoError) {
            updateTest('mapCreation', 'error', '❌ Impossible d\'ajouter les tuiles');
          }
        }

        // Ajouter un marqueur de test
        if (tileLayerAdded) {
          window.L.marker([48.8566, 2.3522])
            .addTo(map)
            .bindPopup('Paris - Test')
            .openPopup();

          // Forcer le redimensionnement
          setTimeout(() => {
            map.invalidateSize();
          }, 500);
        }

        // Sauvegarder pour debug
        window.testMap = map;

      } catch (error) {
        setMapError(error.message);
        updateTest('mapCreation', 'error', `❌ Erreur création carte: ${error.message}`);
      }
    } else {
      updateTest('mapCreation', 'error', '❌ Leaflet ou container non disponible');
    }

    // Test 5: Vérifier les alternatives
    const alternatives = [];
    
    // Test fetch direct OSM
    try {
      const response = await fetch('https://tile.openstreetmap.org/1/0/0.png', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      alternatives.push('Fetch OSM: OK');
    } catch (e) {
      alternatives.push('Fetch OSM: Bloqué');
    }

    // Test CORS
    try {
      const testCors = await fetch('https://api.github.com/zen');
      if (testCors.ok) {
        alternatives.push('CORS: OK');
      }
    } catch (e) {
      alternatives.push('CORS: Restrictions');
    }

    updateTest('alternativeTiles', 'info', alternatives.join(' | '));
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success': return <CheckCircle size={16} color="#10b981" />;
      case 'error': return <AlertCircle size={16} color="#ef4444" />;
      case 'warning': return <AlertCircle size={16} color="#f59e0b" />;
      default: return <Loader size={16} className="animate-spin" color="#3b82f6" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return { bg: '#d1fae5', border: '#10b981' };
      case 'error': return { bg: '#fee2e2', border: '#ef4444' };
      case 'warning': return { bg: '#fef3c7', border: '#f59e0b' };
      default: return { bg: '#dbeafe', border: '#3b82f6' };
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
        <Map size={20} />
        Diagnostic complet de la carte
      </h3>

      {/* Tests principaux */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {Object.entries(tests).map(([key, test]) => {
          const colors = getStatusColor(test.status);
          return (
            <div key={key} style={{
              padding: '8px 12px',
              backgroundColor: colors.bg,
              borderRadius: '4px',
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}>
              {getStatusIcon(test.status)}
              <span>{test.message}</span>
            </div>
          );
        })}
      </div>

      {/* Détails des serveurs de tuiles */}
      {Object.keys(tileTests).length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          marginBottom: '16px'
        }}>
          <strong style={{ fontSize: '13px' }}>Test des serveurs de tuiles:</strong>
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            {Object.entries(tileTests).map(([name, status]) => (
              <div key={name} style={{ padding: '2px 0' }}>
                {status === 'success' ? '✅' : '❌'} {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carte de test */}
      <div style={{
        marginBottom: '16px',
        border: '2px solid #3b82f6',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          Carte de test (devrait afficher Paris)
        </div>
        <div 
          ref={mapRef}
          id="diagnostic-map"
          style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#e5e7eb'
          }}
        >
          {mapError && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#ef4444',
              fontSize: '12px'
            }}>
              Erreur: {mapError}
            </div>
          )}
        </div>
      </div>

      {/* Solutions */}
      <div style={{
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <strong>🔧 Solutions possibles:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Si OSM est bloqué → Le système basculera automatiquement sur CartoDB</li>
          <li>Si Leaflet n'est pas chargé → Rafraîchir la page (F5)</li>
          <li>Si aucune tuile ne charge → Vérifier pare-feu/proxy d'entreprise</li>
          <li>Console: <code>window.testMap</code> pour accéder à la carte de test</li>
        </ul>
      </div>
    </div>
  );
};

export default MapDiagnosticTest;