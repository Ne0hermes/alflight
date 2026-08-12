// src/features/navigation/components/DangerousZonesDetector.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Waves, Mountain, MapPin, Shield, Info, CheckSquare, Square } from 'lucide-react';
import { analyzeRoute } from '@utils/geographicZones';
import { sampleRouteGreatCircle, analyzeTerrain, analyzeObstacles } from '@utils/terrainAnalysis';
import { fetchTerrainElevationsFt } from '@services/terrainService';
import { geoJSONDataService } from '../services/GeoJSONDataService';

const DangerousZonesDetector = ({ waypoints, onZonesChange, plannedAltitude = 3000 }) => {
  // — Analyse verticale relief/obstacles (à la demande : évite de solliciter
  //   l'API d'élévation à chaque changement de route).
  const [alt, setAlt] = useState(plannedAltitude);
  const [terrainState, setTerrainState] = useState(null);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainError, setTerrainError] = useState(null);

  const runTerrainAnalysis = async () => {
    setTerrainLoading(true);
    setTerrainError(null);
    setTerrainState(null);
    try {
      const samples = sampleRouteGreatCircle(waypoints, { stepNM: 2, maxPoints: 100 });
      if (samples.length < 2) {
        setTerrainError('Route insuffisante : ajoutez au moins un départ et une arrivée.');
        return;
      }
      const altFt = Number(alt);
      if (!Number.isFinite(altFt)) {
        setTerrainError('Altitude prévue invalide.');
        return;
      }
      const terrainFt = await fetchTerrainElevationsFt(samples); // null si l'API échoue
      const terrain = analyzeTerrain({ samples, terrainFt: terrainFt || [], plannedAltitudeFt: altFt, clearanceFt: 1000 });
      let obstacleConflicts = [];
      try {
        const obs = await geoJSONDataService.getObstacles();
        obstacleConflicts = analyzeObstacles({ waypoints, obstacles: obs, plannedAltitudeFt: altFt, corridorNM: 1, clearanceFt: 500 }).conflicts;
      } catch { /* obstacles best-effort — ne bloque pas l'analyse relief */ }
      setTerrainState({ ...terrain, obstacleConflicts, altFt, terrainAvailable: terrainFt != null });
    } catch (e) {
      setTerrainError('Analyse impossible : ' + (e?.message || String(e)));
    } finally {
      setTerrainLoading(false);
    }
  };

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
      <h3 style={{ fontSize: 'var(--fs-title)', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
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
          <p style={{ fontSize: 'var(--fs-body)' }}>
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
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Waves size={16} style={{ marginRight: '6px' }} />
                  Survol maritime
                </div>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
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
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Mountain size={16} style={{ marginRight: '6px' }} />
                  Survol montagneux
                </div>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
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
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <MapPin size={16} style={{ marginRight: '6px' }} />
                  Région hostile/inhabitée
                </div>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
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
          <h4 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
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
              <h5 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '8px' }}>
                {category.category}
              </h5>
              <ul style={{ fontSize: 'var(--fs-body)', marginLeft: '20px' }}>
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '8px' }}>
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
            <p style={{ fontSize: 'var(--fs-body)' }}>
              Ces équipements seront automatiquement marqués comme requis dans votre checklist SAR.
              Vérifiez leur présence avant le vol.
            </p>
          </div>
        </div>
      )}

      {/* ─── Analyse relief & obstacles sur la route ─────────────────────── */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)'
      }}>
        <h4 style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
          <Mountain size={16} style={{ marginRight: '6px' }} />
          Conflit vertical relief &amp; obstacles
        </h4>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <label style={{ fontSize: 'var(--fs-body)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Altitude prévue
            <input
              type="number"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              style={{ width: '90px', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: '#ffffff' }}
            />
            ft
          </label>
          <button
            onClick={runTerrainAnalysis}
            disabled={terrainLoading}
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: terrainLoading ? 'default' : 'pointer',
              backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600, fontSize: 'var(--fs-body)', opacity: terrainLoading ? 0.6 : 1
            }}
          >
            {terrainLoading ? 'Analyse en cours…' : 'Analyser le relief sur la route'}
          </button>
        </div>

        {terrainError && (
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)' }}>{terrainError}</p>
        )}

        {terrainState && (() => {
          const s = terrainState;
          const styleByStatus = {
            collision: { bg: 'rgba(220, 38, 38, 0.12)', border: 'var(--color-red-critical)', color: 'var(--color-red-critical)' },
            proximity: { bg: 'rgba(242, 105, 33, 0.12)', border: '#f26921', color: '#b45309' },
            ok: { bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981', color: '#065f46' },
            unchecked: { bg: 'var(--bg-overlay)', border: 'var(--text-secondary)', color: 'var(--text-secondary)' },
          }[s.status];
          const label = {
            collision: '⛔ COLLISION TERRAIN PROBABLE',
            proximity: '⚠️ Proximité du relief (marge insuffisante)',
            ok: '✅ Aucun conflit relief détecté',
            unchecked: '❔ Relief NON VÉRIFIÉ',
          }[s.status];
          return (
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: styleByStatus.bg, border: `1px solid ${styleByStatus.border}` }}>
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', color: styleByStatus.color, marginBottom: '6px' }}>{label}</p>

              {s.status === 'unchecked' ? (
                <p style={{ fontSize: 'var(--fs-body)' }}>
                  Données d'élévation indisponibles (réseau ou service). <strong>Vérifiez impérativement le relief sur votre carte</strong> — l'application ne peut pas confirmer l'absence de conflit.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 'var(--fs-body)', marginBottom: '4px' }}>
                    À {s.altFt} ft, relief maximal rencontré : <strong>{s.maxTerrainFt != null ? Math.round(s.maxTerrainFt) : '—'} ft</strong>
                    {s.minMarginFt != null && <> · marge minimale : <strong>{Math.round(s.minMarginFt)} ft</strong></>}
                  </p>
                  {s.conflicts.length > 0 && (
                    <ul style={{ fontSize: 'var(--fs-body)', marginLeft: '18px', marginTop: '4px' }}>
                      {s.conflicts.slice(0, 4).map((c, i) => (
                        <li key={i} style={{ marginBottom: '2px' }}>
                          {c.kind === 'collision' ? '⛔' : '⚠️'} à ~{Math.round(c.distanceNM)} NM : terrain {Math.round(c.terrainFt)} ft
                          {' '}(marge {Math.round(c.marginFt)} ft)
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    Source relief : open-meteo (modèle numérique ~90 m), marge de garde 1000 ft. À recouper avec votre carte officielle.
                  </p>
                </>
              )}

              {s.obstacleConflicts && s.obstacleConflicts.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold', marginBottom: '4px' }}>
                    Obstacles proches menaçant l'altitude ({s.obstacleConflicts.length}) :
                  </p>
                  <ul style={{ fontSize: 'var(--fs-body)', marginLeft: '18px' }}>
                    {s.obstacleConflicts.slice(0, 5).map((o, i) => (
                      <li key={i}>{o.name} — sommet {Math.round(o.topFt)} ft, à {o.lateralNM} NM (marge {Math.round(o.marginFt)} ft)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Résumé pour transmission */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)'
      }}>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
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