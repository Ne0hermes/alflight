// src/features/navigation/components/MapDiagnostic.jsx
import React, { useEffect, useState } from 'react';

const MapDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState({});
  
  useEffect(() => {
    const results = {};
    
    // Test 1: Leaflet global
    try {
      if (typeof window !== 'undefined' && window.L) {
        results.leafletGlobal = `✅ Leaflet global disponible (v${window.L.version})`;
      } else {
        results.leafletGlobal = '❌ Leaflet global non trouvé';
      }
    } catch (e) {
      results.leafletGlobal = `❌ Erreur: ${e.message}`;
    }
    
    // Test 2: Import Leaflet (ES6)
    try {
      import('leaflet').then(L => {
        setDiagnostics(prev => ({
          ...prev,
          leafletImport: `✅ Import Leaflet OK (v${L.version})`
        }));
      }).catch(e => {
        setDiagnostics(prev => ({
          ...prev,
          leafletImport: `❌ Import Leaflet échoué: ${e.message}`
        }));
      });
      results.leafletImport = '⏳ Test import en cours...';
    } catch (e) {
      results.leafletImport = `❌ Import Leaflet échoué: ${e.message}`;
    }
    
    // Test 3: React-Leaflet (ES6)
    try {
      import('react-leaflet').then(RL => {
        setDiagnostics(prev => ({
          ...prev,
          reactLeaflet: '✅ React-Leaflet importé',
          reactLeafletComponents: {
            MapContainer: !!RL.MapContainer,
            TileLayer: !!RL.TileLayer,
            Marker: !!RL.Marker,
            Popup: !!RL.Popup
          }
        }));
      }).catch(e => {
        setDiagnostics(prev => ({
          ...prev,
          reactLeaflet: `❌ React-Leaflet erreur: ${e.message}`
        }));
      });
      results.reactLeaflet = '⏳ Test import en cours...';
    } catch (e) {
      results.reactLeaflet = `❌ React-Leaflet erreur: ${e.message}`;
    }
    
    // Test 4: CSS Leaflet
    try {
      const styles = document.styleSheets;
      let leafletCssFound = false;
      
      for (let i = 0; i < styles.length; i++) {
        try {
          if (styles[i].href && styles[i].href.includes('leaflet')) {
            leafletCssFound = true;
            results.leafletCSS = `✅ CSS Leaflet trouvé: ${styles[i].href}`;
            break;
          }
        } catch (e) {
          // Ignorer les erreurs CORS
        }
      }
      
      if (!leafletCssFound) {
        // Vérifier si des classes Leaflet existent
        const testDiv = document.createElement('div');
        testDiv.className = 'leaflet-container';
        document.body.appendChild(testDiv);
        const computed = window.getComputedStyle(testDiv);
        document.body.removeChild(testDiv);
        
        if (computed.position === 'relative') {
          results.leafletCSS = '✅ Classes Leaflet détectées';
        } else {
          results.leafletCSS = '⚠️ CSS Leaflet peut-être manquant';
        }
      }
    } catch (e) {
      results.leafletCSS = `❌ Test CSS échoué: ${e.message}`;
    }
    
    // Test 5: Container de test
    try {
      const container = document.createElement('div');
      container.id = 'test-map-container';
      container.style.width = '400px';
      container.style.height = '300px';
      document.body.appendChild(container);
      
      if (window.L && window.L.map) {
        const testMap = window.L.map(container).setView([48.8566, 2.3522], 10);
        results.leafletMapCreation = '✅ Carte Leaflet créée avec succès';
        testMap.remove();
      } else {
        results.leafletMapCreation = '❌ Impossible de créer une carte Leaflet';
      }
      
      document.body.removeChild(container);
    } catch (e) {
      results.leafletMapCreation = `❌ Erreur création carte: ${e.message}`;
    }
    
    // Test 6: Vérification des erreurs console
    if (window.console && window.console.error) {
      const originalError = console.error;
      const errors = [];
      console.error = function(...args) {
        errors.push(args.join(' '));
        originalError.apply(console, args);
      };
      
      setTimeout(() => {
        console.error = originalError;
        if (errors.length > 0) {
          results.consoleErrors = `⚠️ ${errors.length} erreurs console détectées`;
        } else {
          results.consoleErrors = '✅ Aucune erreur console';
        }
        setDiagnostics(results);
      }, 1000);
    } else {
      setDiagnostics(results);
    }
  }, []);
  
  return (
    <div style={{
      backgroundColor: 'white',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ 
        marginTop: 0,
        color: '#1e40af',
        borderBottom: '2px solid #3b82f6',
        paddingBottom: '10px'
      }}>
        🔍 Diagnostic de la carte
      </h3>
      
      <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
        {Object.entries(diagnostics).map(([key, value]) => (
          <div key={key} style={{ 
            padding: '8px',
            marginBottom: '8px',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
            borderLeft: '4px solid ' + (
              value.toString().includes('✅') ? '#10b981' :
              value.toString().includes('❌') ? '#ef4444' : '#f59e0b'
            )
          }}>
            <strong>{key}:</strong>
            {typeof value === 'object' ? (
              <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                {Object.entries(value).map(([k, v]) => (
                  <li key={k}>{k}: {v ? '✅' : '❌'}</li>
                ))}
              </ul>
            ) : (
              <div>{value}</div>
            )}
          </div>
        ))}
      </div>
      
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>Actions de debug:</strong>
        <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Ouvrir la console (F12) pour voir les logs détaillés</li>
          <li>Vérifier l'onglet Network pour les tuiles de carte</li>
          <li>Vérifier l'onglet Console pour les erreurs JavaScript</li>
          <li>Rafraîchir la page (Ctrl+F5) pour forcer le rechargement</li>
        </ol>
      </div>
    </div>
  );
};

export default MapDiagnostic;