// src/features/navigation/components/TestMapMinimal.jsx
import React from 'react';

const TestMapMinimal = () => {
  // Test avec une carte en pur HTML/JS sans React
  React.useEffect(() => {
    console.log('TestMapMinimal: Tentative de création de carte...');
    
    // Créer un conteneur
    const container = document.getElementById('test-map-minimal');
    if (!container) {
      console.error('TestMapMinimal: Conteneur non trouvé!');
      return;
    }
    
    // Vérifier si Leaflet est disponible
    if (typeof window.L === 'undefined') {
      console.error('TestMapMinimal: Leaflet non disponible!');
      
      // Essayer de charger Leaflet dynamiquement
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        console.log('TestMapMinimal: Leaflet chargé dynamiquement');
        createMap();
      };
      document.head.appendChild(script);
    } else {
      console.log('TestMapMinimal: Leaflet disponible, version:', window.L.version);
      createMap();
    }
    
    function createMap() {
      try {
        // Créer la carte
        const map = window.L.map('test-map-minimal').setView([48.8566, 2.3522], 10);
        console.log('TestMapMinimal: Carte créée avec succès');
        
        // Ajouter une couche de tuiles
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        console.log('TestMapMinimal: Couche OSM ajoutée');
        
        // Ajouter un marqueur
        window.L.marker([48.8566, 2.3522])
          .addTo(map)
          .bindPopup('Test Marker - Paris')
          .openPopup();
        console.log('TestMapMinimal: Marqueur ajouté');
        
        // Stocker la carte pour debug
        window.testMap = map;
      } catch (error) {
        console.error('TestMapMinimal: Erreur création carte:', error);
      }
    }
    
    // Cleanup
    return () => {
      if (window.testMap) {
        window.testMap.remove();
        window.testMap = null;
      }
    };
  }, []);
  
  return (
    <div style={{
      border: '3px solid orange',
      borderRadius: '8px',
      padding: '10px',
      marginBottom: '20px',
      backgroundColor: '#fff7ed'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#ea580c' }}>
        🗺️ Test Carte Minimale (Vanilla JS)
      </h3>
      
      <div 
        id="test-map-minimal"
        style={{
          width: '100%',
          height: '300px',
          border: '2px dashed #fb923c',
          backgroundColor: '#f3f4f6',
          position: 'relative'
        }}
      >
        {/* La carte sera créée ici par JavaScript */}
      </div>
      
      <div style={{
        marginTop: '10px',
        padding: '8px',
        backgroundColor: '#fed7aa',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>Instructions:</strong>
        <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>
          <li>Ouvrir la console (F12)</li>
          <li>Chercher les logs commençant par "TestMapMinimal:"</li>
          <li>Si la carte s'affiche ici mais pas ailleurs, le problème vient de React-Leaflet</li>
          <li>Taper <code>window.testMap</code> dans la console pour accéder à l'objet carte</li>
        </ol>
      </div>
    </div>
  );
};

export default TestMapMinimal;