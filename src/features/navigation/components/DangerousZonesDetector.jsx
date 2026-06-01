// src/features/navigation/components/DangerousZonesDetector.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Waves, Mountain, MapPin, Shield, Info, CheckSquare, Square } from 'lucide-react';
import { analyzeRoute } from '@utils/geographicZones';

const DangerousZonesDetector = ({ waypoints, onZonesChange }) => {
  const [zones, setZones] = useState({
    maritime: false,
    maritimeDistance: 0,
    mountain: false,
    mountainAltitude: 0,
    hostile: false,
    hostileType: '',
    desert: false,
    arctic: false,
    jungle: false,
    populated: true,
    internationalWaters: false
  });

  const [manualOverride, setManualOverride] = useState({
    maritime: null,
    mountain: null,
    hostile: null
  });

  // Détecter automatiquement les zones basées sur les waypoints
  const detectedZones = useMemo(() => {
        
    // Utiliser la fonction d'analyse complète
    const analysis = analyzeRoute(waypoints);
    
    const detected = {
      maritime: analysis.maritime,
      maritimeDistance: analysis.maritimeDistance,
      mountain: analysis.mountain,
      mountainAltitude: analysis.mountainAltitude,
      hostile: false,
      hostileType: '',
      corsicaFlight: analysis.corsicaFlight,
      mountainZones: analysis.mountainZones,
      coastalAirports: analysis.coastalAirports
    };

    // Log détaillé pour debug
            return detected;
  }, [waypoints]);

  // Combiner les détections automatiques avec les override manuels
  useEffect(() => {
    const finalZones = {
      maritime: manualOverride.maritime !== null ? manualOverride.maritime : detectedZones.maritime,
      mountain: manualOverride.mountain !== null ? manualOverride.mountain : detectedZones.mountain,
      hostile: manualOverride.hostile !== null ? manualOverride.hostile : detectedZones.hostile,
      ...detectedZones
    };
    
    setZones(finalZones);
    
    // Notifier le parent des changements
    if (onZonesChange) {
      onZonesChange(finalZones);
    }
  }, [detectedZones, manualOverride, onZonesChange]);

  // Gérer les changements manuels
  const handleManualToggle = (zoneType) => {
    setManualOverride(prev => ({
      ...prev,
      [zoneType]: prev[zoneType] === null 
        ? !detectedZones[zoneType]
        : prev[zoneType] === true 
          ? false 
          : null
    }));
  };

  // Obtenir les équipements requis selon les zones
  const getRequiredEquipment = () => {
    const required = [];
    
    if (zones.maritime) {
      required.push({
        category: 'Maritime',
        items: [
          'Gilets de sauvetage avec lampe pour tous les occupants',
          'Canot(s) de sauvetage (survol > 50 NM des côtes)',
          'ELT 406 MHz avec GPS',
          'Fusées de détresse pyrotechniques',
          'Miroir de signalisation',
          'Colorant marqueur',
          'Sifflet sur chaque gilet'
        ],
        regulation: 'NCO.IDE.A.165 - Survol de l\'eau'
      });
    }
    
    if (zones.mountain) {
      required.push({
        category: 'Montagne',
        items: [
          'ELT 406 MHz',
          'Kit de survie adapté au froid',
          'Couvertures de survie',
          'Fusées de détresse',
          'Lampes torches avec piles de rechange',
          'Corde (minimum 20m)',
          'Sifflet de détresse'
        ],
        regulation: 'Recommandations montagne - Manuel VFR'
      });
    }
    
    if (zones.hostile) {
      required.push({
        category: 'Région hostile',
        items: [
          'Kit de survie climatique approprié',
          'Eau potable (3L/personne/jour pour 48h)',
          'Rations de survie (48h minimum)',
          'Abri de survie / Tente',
          'Trousse de premiers secours étendue',
          'Moyen de communication satellite',
          'Balise de détresse personnelle (PLB)'
        ],
        regulation: 'NCO.IDE.A.170 - Survol de régions hostiles'
      });
    }
    
    return required;
  };

  const requiredEquipment = getRequiredEquipment();
  
  const zoneCheckboxStyle = (zoneType) => ({
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
    borderColor: zones[zoneType] ? 'var(--accent-primary)' : 'var(--border-subtle)',
    backgroundColor: zones[zoneType] ? 'rgba(242, 105, 33, 0.10)' : '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--bg-overlay)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
        <AlertTriangle size={20} style={{ marginRight: '8px' }} />
        Analyse des zones dangereuses
      </h3>

      {/* Détection automatique */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '16px',
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--text-secondary)'
      }}>
        <Info size={16} />
        <div>
          <p style={{ fontSize: '14px' }}>
            Détection automatique basée sur votre route. Vous pouvez ajuster manuellement si nécessaire.
          </p>
        </div>
      </div>

      {/* Zones détectées/sélectionnées */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
        {/* Zone maritime */}
        <div 
          style={zoneCheckboxStyle('maritime')}
          onClick={() => handleManualToggle('maritime')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {zones.maritime ? <CheckSquare size={20} /> : <Square size={20} />}
              <div style={{ marginLeft: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Waves size={16} style={{ marginRight: '6px' }} />
                  Survol maritime
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Vol au-dessus de l'eau à plus de 50 NM des côtes ou temps de vol {'>'} 30 min
                  {detectedZones.maritime && !manualOverride.maritime && 
                    <span style={{ color: 'var(--text-primary)' }}> (Détecté automatiquement)</span>
                  }
                  {detectedZones.corsicaFlight && 
                    <span style={{ color: 'var(--accent-primary)' }}> - Vol vers/depuis la Corse</span>
                  }
                  {detectedZones.coastalAirports?.length > 0 && 
                    <span style={{ color: 'var(--text-secondary)' }}> - Aéroports: {detectedZones.coastalAirports.join(', ')}</span>
                  }
                  {manualOverride.maritime !== null && 
                    <span style={{ color: 'var(--text-secondary)' }}> (Ajusté manuellement)</span>
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Zone montagneuse */}
        <div 
          style={zoneCheckboxStyle('mountain')}
          onClick={() => handleManualToggle('mountain')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {zones.mountain ? <CheckSquare size={20} /> : <Square size={20} />}
              <div style={{ marginLeft: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Mountain size={16} style={{ marginRight: '6px' }} />
                  Survol montagneux
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Vol au-dessus de reliefs {'>'} 1500m ou zones difficiles d'accès
                  {detectedZones.mountain && !manualOverride.mountain && 
                    <span style={{ color: 'var(--text-primary)' }}> (Détecté automatiquement)</span>
                  }
                  {detectedZones.mountainZones?.length > 0 && 
                    <span style={{ color: 'var(--text-secondary)' }}> - Zones: {detectedZones.mountainZones.join(', ')}</span>
                  }
                  {detectedZones.mountainAltitude > 0 && 
                    <span style={{ color: 'var(--accent-primary)' }}> - Alt. max: {detectedZones.mountainAltitude}m</span>
                  }
                  {manualOverride.mountain !== null && 
                    <span style={{ color: 'var(--text-secondary)' }}> (Ajusté manuellement)</span>
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Région hostile */}
        <div 
          style={zoneCheckboxStyle('hostile')}
          onClick={() => handleManualToggle('hostile')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {zones.hostile ? <CheckSquare size={20} /> : <Square size={20} />}
              <div style={{ marginLeft: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <MapPin size={16} style={{ marginRight: '6px' }} />
                  Région hostile/inhabitée
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Désert, arctique, jungle ou zone sans infrastructure de secours
                  {manualOverride.hostile !== null && 
                    <span style={{ color: 'var(--text-secondary)' }}> (Sélection manuelle)</span>
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Équipements requis selon les zones */}
      {requiredEquipment.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
            <Shield size={16} style={{ marginRight: '6px' }} />
            Équipements SAR obligatoires pour ces zones
          </h4>
          
          {requiredEquipment.map((category, idx) => (
            <div key={idx} style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: 'rgba(242, 105, 33, 0.10)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-overlay)'
            }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                {category.category}
              </h5>
              <ul style={{ fontSize: '12px', marginLeft: '20px' }}>
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                📋 Référence: {category.regulation}
              </p>
            </div>
          ))}
          
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid #f26921'
          }}>
            <AlertTriangle size={16} />
            <p style={{ fontSize: '14px' }}>
              Ces équipements seront automatiquement marqués comme requis dans votre checklist SAR.
              Vérifiez leur présence avant le vol.
            </p>
          </div>
        </div>
      )}

      {/* Résumé pour transmission */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <strong>Pour le plan de vol (case 19) :</strong><br/>
          {zones.maritime && 'J (Gilets) '}
          {zones.maritime && zones.maritimeDistance > 50 && 'D (Canots) '}
          {(zones.maritime || zones.mountain || zones.hostile) && 'E (ELT) '}
          {zones.hostile && 'S (Survie) '}
        </p>
      </div>
    </div>
  );
};

export default DangerousZonesDetector;