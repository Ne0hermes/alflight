// src/features/navigation/components/AirspaceAnalyzer.jsx
import React, { memo, useMemo } from 'react';
import { Radio, Plane, AlertTriangle, ArrowRight, Layers, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { FRENCH_AIRSPACES } from '@data/frenchAirspaces';

// Fonction pour calculer si un point est dans un espace aérien circulaire
const isPointInAirspace = (point, airspace) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (airspace.center.lat - point.lat) * Math.PI / 180;
  const dLon = (airspace.center.lon - point.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point.lat * Math.PI / 180) * Math.cos(airspace.center.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance <= airspace.radius;
};

// Fonction pour interpoler des points le long d'une route
const interpolateRoute = (start, end, numPoints = 50) => {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    points.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lon: start.lon + (end.lon - start.lon) * ratio,
      distance: i / numPoints * calculateDistance(start, end)
    });
  }
  return points;
};

// Calcul de distance
const calculateDistance = (point1, point2) => {
  const R = 3440.065; // Rayon en NM
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lon - point1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const AirspaceAnalyzer = memo(({ waypoints }) => {
  // Analyser les espaces traversés
  const airspaceAnalysis = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return null;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length < 2) return null;
    
    const segments = [];
    const traversedAirspaces = new Map();
    
    // Analyser chaque segment de route
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const start = validWaypoints[i];
      const end = validWaypoints[i + 1];
      const routePoints = interpolateRoute(start, end);
      
      // Vérifier chaque point contre tous les espaces aériens
      routePoints.forEach(point => {
        // Vérifier les CTR
        FRENCH_AIRSPACES.CTR.forEach(ctr => {
          if (isPointInAirspace(point, ctr)) {
            if (!traversedAirspaces.has(ctr.id)) {
              traversedAirspaces.set(ctr.id, {
                ...ctr,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les TMA
        FRENCH_AIRSPACES.TMA.forEach(tma => {
          if (isPointInAirspace(point, tma)) {
            if (!traversedAirspaces.has(tma.id)) {
              traversedAirspaces.set(tma.id, {
                ...tma,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les zones réglementées
        FRENCH_AIRSPACES.RESTRICTED.forEach(zone => {
          if (isPointInAirspace(point, zone)) {
            if (!traversedAirspaces.has(zone.id)) {
              traversedAirspaces.set(zone.id, {
                ...zone,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les SIV (zones d'information de vol spéciales)
        if (FRENCH_AIRSPACES.SIV) {
          FRENCH_AIRSPACES.SIV.forEach(siv => {
            if (isPointInAirspace(point, siv)) {
              if (!traversedAirspaces.has(siv.id)) {
                traversedAirspaces.set(siv.id, {
                  ...siv,
                  entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
                });
              }
            }
          });
        }
      });
      
      segments.push({
        from: start,
        to: end,
        distance: calculateDistance(start, end)
      });
    }
    
    // Trier les espaces par ordre de traversée
    const sortedAirspaces = Array.from(traversedAirspaces.values())
      .sort((a, b) => a.entryDistance - b.entryDistance);
    
    // Calculer la distance totale
    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
    
    return {
      segments,
      airspaces: sortedAirspaces,
      totalDistance,
      departure: validWaypoints[0],
      arrival: validWaypoints[validWaypoints.length - 1]
    };
  }, [waypoints]);
  
  if (!airspaceAnalysis || airspaceAnalysis.airspaces.length === 0) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
        <Navigation size={16} />
        <p style={sx.text.sm}>
          Aucun espace aérien contrôlé détecté sur cette route.
          Vol en espace G (non contrôlé) - Fréquence auto-info recommandée.
        </p>
      </div>
    );
  }
  
  return (
    <div>
      <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        <Layers size={16} style={{ marginRight: '8px' }} />
        Analyse des espaces aériens traversés
      </h4>
      
      {/* Résumé */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <p style={sx.text.sm}>
          <strong>{airspaceAnalysis.airspaces.length}</strong> espaces aériens identifiés sur 
          <strong> {airspaceAnalysis.totalDistance.toFixed(1)} NM</strong>
        </p>
      </div>
      
      {/* Timeline des espaces */}
      <div style={styles.timeline}>
        {/* Départ */}
        <div style={styles.timelineItem}>
          <div style={styles.timelineIcon}>
            <Plane size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={styles.timelineContent}>
            <div style={sx.text.bold}>Départ : {airspaceAnalysis.departure.name}</div>
            <div style={sx.text.sm}>0 NM</div>
          </div>
        </div>
        
        {/* Espaces traversés */}
        {airspaceAnalysis.airspaces.map((airspace, index) => (
          <div key={airspace.id}>
            {/* Changement d'espace */}
            <div style={styles.changeIndicator}>
              <ArrowRight size={16} />
              <span style={sx.text.xs}>
                {airspace.entryDistance.toFixed(1)} NM
              </span>
            </div>
            
            <div style={styles.timelineItem}>
              <div style={sx.combine(
                styles.timelineIcon,
                airspace.type === 'R' || airspace.type === 'P' 
                  ? { backgroundColor: '#fef3c7' }
                  : airspace.type === 'CTR'
                  ? { backgroundColor: '#dbeafe' }
                  : airspace.type === 'TMA'
                  ? { backgroundColor: '#e0e7ff' }
                  : airspace.type === 'SIV'
                  ? { backgroundColor: '#dcfce7' }
                  : { backgroundColor: '#f3f4f6' }
              )}>
                {airspace.type === 'CTR' && <Radio size={16} style={{ color: '#2563eb' }} />}
                {airspace.type === 'TMA' && <Layers size={16} style={{ color: '#4f46e5' }} />}
                {(airspace.type === 'R' || airspace.type === 'P') && 
                  <AlertTriangle size={16} style={{ color: '#f59e0b' }} />}
                {airspace.type === 'SIV' && <Navigation size={16} style={{ color: '#16a34a' }} />}
                {airspace.type === 'FIR' && <Plane size={16} style={{ color: '#6b7280' }} />}
              </div>
              
              <div style={styles.timelineContent}>
                <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                  <div>
                    <div style={sx.text.bold}>{airspace.name}</div>
                    <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
                      Type : {airspace.type} - Classe {airspace.class}
                    </div>
                  </div>
                  <div style={styles.typeTag(airspace.type)}>
                    {airspace.type}
                  </div>
                </div>
                
                {/* Détails de l'espace */}
                <div style={styles.airspaceDetails}>
                  <div style={styles.detailRow}>
                    <Radio size={14} style={{ color: '#6b7280' }} />
                    <span><strong>Fréquence :</strong> {airspace.frequency} MHz</span>
                  </div>
                  <div style={styles.detailRow}>
                    <Plane size={14} style={{ color: '#6b7280' }} />
                    <span><strong>Contact :</strong> {airspace.unit}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <Layers size={14} style={{ color: '#6b7280' }} />
                    <span><strong>Altitudes :</strong> {airspace.floor} → {airspace.ceiling}</span>
                  </div>
                  {airspace.activity && (
                    <div style={styles.detailRow}>
                      <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                      <span><strong>Activité :</strong> {airspace.activity}</span>
                    </div>
                  )}
                </div>
                
                {/* Alertes spéciales */}
                {(airspace.type === 'R' || airspace.type === 'P') && (
                  <div style={sx.combine(
                    sx.components.alert.base, 
                    sx.components.alert.warning,
                    sx.spacing.mt(2)
                  )}>
                    <AlertTriangle size={14} />
                    <p style={sx.text.xs}>
                      Zone {airspace.type === 'R' ? 'réglementée' : 'interdite'} - 
                      {airspace.type === 'R' ? ' Contournement ou autorisation requise' : ' Contournement obligatoire'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Arrivée */}
        <div style={styles.changeIndicator}>
          <ArrowRight size={16} />
          <span style={sx.text.xs}>
            {airspaceAnalysis.totalDistance.toFixed(1)} NM
          </span>
        </div>
        
        <div style={styles.timelineItem}>
          <div style={styles.timelineIcon}>
            <Plane size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={styles.timelineContent}>
            <div style={sx.text.bold}>Arrivée : {airspaceAnalysis.arrival.name}</div>
            <div style={sx.text.sm}>{airspaceAnalysis.totalDistance.toFixed(1)} NM</div>
          </div>
        </div>
      </div>
      
      {/* Résumé des fréquences */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
          📻 Séquence radio recommandée
        </h5>
        <div style={styles.frequencyList}>
          {airspaceAnalysis.airspaces.map((airspace, index) => (
            <div key={airspace.id} style={styles.frequencyItem}>
              <span style={sx.text.bold}>{index + 1}.</span>
              <span>{airspace.unit} :</span>
              <span style={sx.combine(sx.text.bold, { color: '#2563eb' })}>
                {airspace.frequency}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const styles = {
  timeline: {
    position: 'relative',
    paddingLeft: '40px'
  },
  timelineItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  timelineIcon: {
    position: 'absolute',
    left: '-40px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  timelineContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  changeIndicator: {
    position: 'relative',
    left: '-24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
    margin: '8px 0'
  },
  airspaceDetails: {
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '8px'
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '13px'
  },
  typeTag: (type) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 
      type === 'CTR' ? '#dbeafe' :
      type === 'TMA' ? '#e0e7ff' :
      type === 'R' || type === 'P' ? '#fef3c7' :
      type === 'SIV' ? '#dcfce7' :
      type === 'FIR' ? '#f3f4f6' :
      '#f3f4f6',
    color:
      type === 'CTR' ? '#1e40af' :
      type === 'TMA' ? '#4338ca' :
      type === 'R' || type === 'P' ? '#92400e' :
      type === 'SIV' ? '#14532d' :
      type === 'FIR' ? '#374151' :
      '#374151'
  }),
  frequencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  frequencyItem: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '8px',
    backgroundColor: '#f9fafb',
    borderRadius: '4px',
    fontSize: '14px'
  }
};

AirspaceAnalyzer.displayName = 'AirspaceAnalyzer';

export default AirspaceAnalyzer;