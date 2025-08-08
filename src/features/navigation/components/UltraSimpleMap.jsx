// src/features/navigation/components/UltraSimpleMap.jsx
import React, { useEffect, useState } from 'react';

const UltraSimpleMap = () => {
  const [status, setStatus] = useState('Initialisation...');
  const [logs, setLogs] = useState([]);
  
  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
    console.log(`[MAP ${time}] ${message}`);
  };
  
  useEffect(() => {
    addLog('Démarrage du test de carte');
    
    // Étape 1: Vérifier Leaflet
    if (typeof window === 'undefined') {
      addLog('Window non défini!', 'error');
      setStatus('❌ Erreur: Window non défini');
      return;
    }
    
    if (!window.L) {
      addLog('Leaflet non trouvé, chargement...', 'warning');
      
      // Charger Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      addLog('CSS Leaflet ajouté');
      
      // Charger Leaflet JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        addLog('Leaflet JS chargé!', 'success');
        createMap();
      };
      script.onerror = (e) => {
        addLog(`Erreur chargement Leaflet: ${e}`, 'error');
        setStatus('❌ Impossible de charger Leaflet');
      };
      document.head.appendChild(script);
    } else {
      addLog(`Leaflet déjà disponible (v${window.L.version})`, 'success');
      createMap();
    }
    
    function createMap() {
      const container = document.getElementById('ultra-simple-map');
      if (!container) {
        addLog('Container non trouvé!', 'error');
        setStatus('❌ Container non trouvé');
        return;
      }
      
      // Vérifier les dimensions du container
      const rect = container.getBoundingClientRect();
      addLog(`Container: ${rect.width}x${rect.height}px`);
      
      if (rect.width === 0 || rect.height === 0) {
        addLog('Container sans dimensions!', 'error');
        setStatus('❌ Container invisible');
        return;
      }
      
      try {
        addLog('Création de la carte...');
        
        // Supprimer toute carte existante
        if (container._leaflet_id) {
          addLog('Carte existante détectée, suppression...');
          const existingMap = window.L.map(container);
          existingMap.remove();
        }
        
        // Créer une nouvelle carte
        const map = window.L.map('ultra-simple-map', {
          center: [48.8566, 2.3522], // Paris
          zoom: 5,
          preferCanvas: true // Utiliser Canvas au lieu de SVG
        });
        
        addLog('Instance carte créée', 'success');
        
        // Ajouter la couche de tuiles
        const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OSM',
          maxZoom: 19,
          crossOrigin: true
        });
        
        tileLayer.on('tileload', () => {
          addLog('Tuile chargée', 'success');
        });
        
        tileLayer.on('tileerror', (e) => {
          addLog(`Erreur tuile: ${e.coords}`, 'error');
        });
        
        tileLayer.addTo(map);
        addLog('Couche OSM ajoutée', 'success');
        
        // Ajouter un marqueur de test
        const marker = window.L.marker([48.8566, 2.3522]);
        marker.addTo(map);
        marker.bindPopup('Test - Paris').openPopup();
        addLog('Marqueur ajouté', 'success');
        
        // Forcer le redimensionnement
        setTimeout(() => {
          map.invalidateSize();
          addLog('InvalidateSize appelé');
        }, 500);
        
        // Sauvegarder la carte globalement pour debug
        window.debugMap = map;
        addLog('Carte sauvegardée dans window.debugMap', 'success');
        
        setStatus('✅ Carte créée avec succès!');
        
      } catch (error) {
        addLog(`Erreur création: ${error.message}`, 'error');
        setStatus(`❌ Erreur: ${error.message}`);
      }
    }
    
    // Cleanup
    return () => {
      if (window.debugMap) {
        try {
          window.debugMap.remove();
          window.debugMap = null;
        } catch (e) {
          console.error('Erreur cleanup:', e);
        }
      }
    };
  }, []);
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
      <h3 style={{ marginTop: 0, color: '#1e40af' }}>
        🗺️ Test Ultra Simple - Carte Leaflet Vanilla
      </h3>
      
      {/* Status */}
      <div style={{
        padding: '10px',
        marginBottom: '10px',
        backgroundColor: status.includes('✅') ? '#d1fae5' : status.includes('❌') ? '#fee2e2' : '#fef3c7',
        borderRadius: '4px',
        border: `1px solid ${status.includes('✅') ? '#34d399' : status.includes('❌') ? '#f87171' : '#fbbf24'}`
      }}>
        <strong>Status:</strong> {status}
      </div>
      
      {/* Container de la carte avec style inline forcé */}
      <div 
        id="ultra-simple-map"
        style={{
          width: '100%',
          minWidth: '400px',
          height: '400px',
          minHeight: '400px',
          border: '3px solid #3b82f6',
          borderRadius: '8px',
          backgroundColor: '#e5e7eb',
          position: 'relative',
          display: 'block',
          visibility: 'visible',
          opacity: 1,
          zIndex: 1
        }}
      >
        {/* Indicateur de chargement */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <div>📍 Zone de la carte</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Si rien ne s'affiche, vérifiez la console
          </div>
        </div>
      </div>
      
      {/* Logs */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
        maxHeight: '200px',
        overflow: 'auto',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}>
        <strong>Logs de debug:</strong>
        {logs.map((log, i) => (
          <div key={i} style={{
            padding: '2px 0',
            color: log.type === 'error' ? '#dc2626' : 
                   log.type === 'warning' ? '#f59e0b' : 
                   log.type === 'success' ? '#10b981' : '#374151'
          }}>
            [{log.time}] {log.message}
          </div>
        ))}
      </div>
      
      {/* Instructions */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>Debug dans la console:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>Tapez <code>window.debugMap</code> pour accéder à la carte</li>
          <li>Tapez <code>window.L.version</code> pour vérifier Leaflet</li>
          <li>Vérifiez l'onglet Network pour les tuiles (*.png)</li>
          <li>Vérifiez l'onglet Console pour les erreurs</li>
        </ul>
      </div>
    </div>
  );
};

export default UltraSimpleMap;