// src/features/navigation/components/AirspacesSummaryTable.jsx
import React, { memo, useMemo } from 'react';
import { AlertTriangle, Shield, Info, Radio, Plane, FileText } from 'lucide-react';
import { useAirspaceAnalysis } from '../hooks/useAirspaceAnalysis';

/**
 * Tableau récapitulatif des espaces aériens et zones traversés
 * selon l'altitude choisie pour la navigation
 */
const AirspacesSummaryTable = memo(({ waypoints, segmentAltitudes, plannedAltitude = 3000 }) => {
  // Utiliser le hook d'analyse des espaces aériens
  const { analysis, loading, hasData } = useAirspaceAnalysis(waypoints, segmentAltitudes, plannedAltitude);

  // Agréger toutes les zones traversées (dédupliquées)
  const aggregatedData = useMemo(() => {
    if (!analysis || analysis.length === 0) {
      return {
        controlledAirspaces: [],
        restrictedZones: [],
        informationalAirspaces: [],
        allFrequencies: []
      };
    }

    const controlledMap = new Map();
    const restrictedMap = new Map();
    const informationalMap = new Map();
    const frequenciesMap = new Map();

    analysis.forEach(segment => {
      // Espaces contrôlés
      segment.controlledAirspaces?.forEach(airspace => {
        const key = `${airspace.name}-${airspace.class}`;
        if (!controlledMap.has(key)) {
          controlledMap.set(key, {
            ...airspace,
            segments: [segment.segmentId]
          });
        } else {
          controlledMap.get(key).segments.push(segment.segmentId);
        }
      });

      // Zones réglementées/interdites/dangereuses
      segment.restrictedZones?.forEach(zone => {
        const key = zone.name;
        if (!restrictedMap.has(key)) {
          restrictedMap.set(key, {
            ...zone,
            segments: [segment.segmentId]
          });
        } else {
          restrictedMap.get(key).segments.push(segment.segmentId);
        }
      });

      // Espaces informatifs (FIR, ATZ, SIV, etc.)
      segment.informationalAirspaces?.forEach(airspace => {
        const key = `${airspace.name}-${airspace.type}`;
        if (!informationalMap.has(key)) {
          informationalMap.set(key, {
            ...airspace,
            segments: [segment.segmentId]
          });
        } else {
          informationalMap.get(key).segments.push(segment.segmentId);
        }
      });

      // Fréquences
      segment.frequencies?.forEach(freq => {
        const key = `${freq.airspace}-${freq.frequency}`;
        if (!frequenciesMap.has(key)) {
          frequenciesMap.set(key, freq);
        }
      });
    });

    return {
      controlledAirspaces: Array.from(controlledMap.values()),
      restrictedZones: Array.from(restrictedMap.values()),
      informationalAirspaces: Array.from(informationalMap.values()),
      allFrequencies: Array.from(frequenciesMap.values())
    };
  }, [analysis]);

  // Styles
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  };

  const thStyle = {
    padding: '10px 8px',
    textAlign: 'left',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: '600',
    color: '#374151'
  };

  const tdStyle = {
    padding: '8px',
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'top'
  };

  const badgeStyle = (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: color,
    color: 'white',
    marginRight: '4px'
  });

  const sectionTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
    marginTop: '16px'
  };

  // Fonction pour formater l'altitude
  const formatAltitude = (floor, ceiling, floor_raw, ceiling_raw) => {
    if (floor_raw && ceiling_raw) {
      return `${floor_raw} - ${ceiling_raw}`;
    }
    return `${floor || 0} ft - ${ceiling || '∞'} ft`;
  };

  // Fonction pour obtenir la couleur selon le type de zone
  const getTypeColor = (type, airspaceClass) => {
    if (['R', 'RESTRICTED'].includes(type)) return '#dc2626'; // Rouge
    if (['P', 'PROHIBITED'].includes(type)) return '#7c3aed'; // Violet
    if (['D', 'DANGER'].includes(type)) return '#f59e0b'; // Orange
    if (['A', 'B'].includes(airspaceClass)) return '#dc2626'; // Rouge
    if (['C', 'D'].includes(airspaceClass)) return '#3b82f6'; // Bleu
    if (airspaceClass === 'E') return '#10b981'; // Vert
    return '#6b7280'; // Gris
  };

  // Si pas de waypoints
  if (!waypoints || waypoints.length < 2) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <Plane size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
        <p>Ajoutez au moins 2 waypoints pour voir les espaces aériens traversés</p>
      </div>
    );
  }

  // Chargement
  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <div className="spinner" style={{ marginBottom: '8px' }}>Chargement...</div>
        <p>Analyse des espaces aériens en cours...</p>
      </div>
    );
  }

  // Aucune donnée
  const hasAnyData = aggregatedData.controlledAirspaces.length > 0 ||
                     aggregatedData.restrictedZones.length > 0 ||
                     aggregatedData.informationalAirspaces.length > 0;

  if (!hasAnyData) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#10b981',
        backgroundColor: '#ecfdf5',
        borderRadius: '8px',
        border: '1px solid #a7f3d0'
      }}>
        <Shield size={24} style={{ marginBottom: '8px' }} />
        <p style={{ fontWeight: '500' }}>Aucun espace aérien spécifique détecté à {plannedAltitude} ft</p>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          La route est en espace aérien non contrôlé (classe G)
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Altitude de référence */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid #bfdbfe'
      }}>
        <Plane size={18} color="#3b82f6" />
        <span style={{ fontWeight: '500', color: '#1e40af' }}>
          Analyse à l'altitude : {plannedAltitude} ft
        </span>
      </div>

      {/* Zones réglementées/interdites/dangereuses */}
      {aggregatedData.restrictedZones.length > 0 && (
        <>
          <div style={sectionTitleStyle}>
            <AlertTriangle size={18} color="#dc2626" />
            <span style={{ color: '#dc2626' }}>Zones Réglementées / Dangereuses ({aggregatedData.restrictedZones.length})</span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Altitudes</th>
                <th style={thStyle}>Activité / Remarques</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.restrictedZones.map((zone, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fef2f2' }}>
                  <td style={tdStyle}>
                    <span style={badgeStyle(getTypeColor(zone.type))}>
                      {zone.type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{zone.name}</td>
                  <td style={tdStyle}>
                    {formatAltitude(zone.floor, zone.ceiling, zone.floor_raw, zone.ceiling_raw)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280' }}>
                    {zone.activity || zone.schedule || zone.remarks || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Espaces contrôlés */}
      {aggregatedData.controlledAirspaces.length > 0 && (
        <>
          <div style={sectionTitleStyle}>
            <Shield size={18} color="#3b82f6" />
            <span>Espaces Contrôlés ({aggregatedData.controlledAirspaces.length})</span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Classe</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Altitudes</th>
                <th style={thStyle}>Fréquences</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.controlledAirspaces.map((airspace, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td style={tdStyle}>
                    <span style={badgeStyle(getTypeColor(airspace.type, airspace.class))}>
                      {airspace.class}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{airspace.name}</td>
                  <td style={tdStyle}>{airspace.type}</td>
                  <td style={tdStyle}>
                    {formatAltitude(airspace.floor, airspace.ceiling, airspace.floor_raw, airspace.ceiling_raw)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12px' }}>
                    {airspace.frequencies && airspace.frequencies.length > 0 ? (
                      airspace.frequencies.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Radio size={12} color="#6b7280" />
                          <span>{f.frequency} MHz</span>
                          {f.type && <span style={{ color: '#9ca3af' }}>({f.type})</span>}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Espaces informatifs */}
      {aggregatedData.informationalAirspaces.length > 0 && (
        <>
          <div style={sectionTitleStyle}>
            <Info size={18} color="#6b7280" />
            <span style={{ color: '#6b7280' }}>Espaces Informatifs ({aggregatedData.informationalAirspaces.length})</span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Classe</th>
                <th style={thStyle}>Altitudes</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.informationalAirspaces.map((airspace, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={tdStyle}>
                    <span style={{
                      ...badgeStyle('#9ca3af'),
                      backgroundColor: '#e5e7eb',
                      color: '#374151'
                    }}>
                      {airspace.type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{airspace.name}</td>
                  <td style={tdStyle}>{airspace.class || 'N/A'}</td>
                  <td style={tdStyle}>
                    {formatAltitude(airspace.floor, airspace.ceiling, airspace.floor_raw, airspace.ceiling_raw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Compléments aux cartes (SUP AIP) */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#fefce8',
        borderRadius: '8px',
        border: '1px solid #fde047'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <FileText size={18} color="#ca8a04" />
          <span style={{ fontWeight: '600', color: '#854d0e', fontSize: '14px' }}>
            Compléments aux cartes (SUP AIP)
          </span>
        </div>
        <p style={{
          fontSize: '13px',
          color: '#a16207',
          margin: 0,
          fontStyle: 'italic'
        }}>
          Compléments aux cartes indisponible, API à ajouter
        </p>
        <p style={{
          fontSize: '11px',
          color: '#ca8a04',
          margin: '6px 0 0 0'
        }}>
          Les SUP AIP et NOTAM ne sont pas encore intégrés. Consultez le site du SIA pour les informations à jour.
        </p>
      </div>

      {/* Légende */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        <strong>Légende :</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          <span><span style={badgeStyle('#dc2626')}>R</span> Zone Réglementée</span>
          <span><span style={badgeStyle('#7c3aed')}>P</span> Zone Interdite</span>
          <span><span style={badgeStyle('#f59e0b')}>D</span> Zone Dangereuse</span>
          <span><span style={badgeStyle('#3b82f6')}>C/D</span> Espace Contrôlé</span>
          <span><span style={badgeStyle('#10b981')}>E</span> Espace Semi-contrôlé</span>
        </div>
      </div>
    </div>
  );
});

AirspacesSummaryTable.displayName = 'AirspacesSummaryTable';

export default AirspacesSummaryTable;
