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
    backgroundColor: 'var(--bg-overlay)',
    borderBottom: '2px solid var(--border-subtle)',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  };

  const tdStyle = {
    padding: '8px',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'top'
  };

  const badgeStyle = (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: color,
    color: 'var(--text-primary)',
    marginRight: '4px'
  });

  const sectionTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
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
    if (['R', 'RESTRICTED'].includes(type)) return 'var(--color-red-critical)'; // Rouge
    if (['P', 'PROHIBITED'].includes(type)) return 'var(--accent-primary)'; // Violet
    if (['D', 'DANGER'].includes(type)) return 'var(--accent-primary)'; // Orange
    if (['A', 'B'].includes(airspaceClass)) return 'var(--color-red-critical)'; // Rouge
    if (['C', 'D'].includes(airspaceClass)) return 'var(--text-secondary)'; // Bleu
    if (airspaceClass === 'E') return 'var(--text-primary)'; // Vert
    return 'var(--text-secondary)'; // Gris
  };

  // Si pas de waypoints
  if (!waypoints || waypoints.length < 2) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)'
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
        color: 'var(--text-secondary)'
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
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid #a7f3d0'
      }}>
        <Shield size={24} style={{ marginBottom: '8px' }} />
        <p style={{ fontWeight: '500' }}>Aucun espace aérien spécifique détecté à {plannedAltitude} ft</p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '16px',
        border: '1px solid var(--border-subtle)'
      }}>
        <Plane size={18} color="var(--text-secondary)" />
        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
          Analyse à l'altitude : {plannedAltitude} ft
        </span>
      </div>

      {/* Zones réglementées/interdites/dangereuses */}
      {aggregatedData.restrictedZones.length > 0 && (
        <>
          <div style={sectionTitleStyle}>
            <AlertTriangle size={18} color="var(--color-red-critical)" />
            <span style={{ color: 'var(--color-red-critical)' }}>Zones Réglementées / Dangereuses ({aggregatedData.restrictedZones.length})</span>
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
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : 'var(--bg-overlay)' }}>
                  <td style={tdStyle}>
                    <span style={badgeStyle(getTypeColor(zone.type))}>
                      {zone.type}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '500' }}>{zone.name}</td>
                  <td style={tdStyle}>
                    {formatAltitude(zone.floor, zone.ceiling, zone.floor_raw, zone.ceiling_raw)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '12px', color: 'var(--text-secondary)' }}>
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
            <Shield size={18} color="var(--text-secondary)" />
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
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : 'var(--bg-overlay)' }}>
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
                          <Radio size={12} color="var(--text-secondary)" />
                          <span>{f.frequency} MHz</span>
                          {f.type && <span style={{ color: 'var(--text-tertiary)' }}>({f.type})</span>}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>-</span>
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
            <Info size={18} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-secondary)' }}>Espaces Informatifs ({aggregatedData.informationalAirspaces.length})</span>
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
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : 'var(--bg-overlay)' }}>
                  <td style={tdStyle}>
                    <span style={{
                      ...badgeStyle('var(--text-tertiary)'),
                      backgroundColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)'
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
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid #f26921'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <FileText size={18} color="var(--accent-primary)" />
          <span style={{ fontWeight: '600', color: 'var(--accent-primary)', fontSize: '14px' }}>
            Compléments aux cartes (SUP AIP)
          </span>
        </div>
        <p style={{
          fontSize: '13px',
          color: 'var(--accent-primary)',
          margin: 0,
          fontStyle: 'italic'
        }}>
          Compléments aux cartes indisponible, API à ajouter
        </p>
        <p style={{
          fontSize: '11px',
          color: 'var(--accent-primary)',
          margin: '6px 0 0 0'
        }}>
          Les SUP AIP et NOTAM ne sont pas encore intégrés. Consultez le site du SIA pour les informations à jour.
        </p>
      </div>

      {/* Légende */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        color: 'var(--text-secondary)'
      }}>
        <strong>Légende :</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          <span><span style={badgeStyle('var(--color-red-critical)')}>R</span> Zone Réglementée</span>
          <span><span style={badgeStyle('var(--accent-primary)')}>P</span> Zone Interdite</span>
          <span><span style={badgeStyle('var(--accent-primary)')}>D</span> Zone Dangereuse</span>
          <span><span style={badgeStyle('var(--text-secondary)')}>C/D</span> Espace Contrôlé</span>
          <span><span style={badgeStyle('var(--text-primary)')}>E</span> Espace Semi-contrôlé</span>
        </div>
      </div>
    </div>
  );
});

AirspacesSummaryTable.displayName = 'AirspacesSummaryTable';

export default AirspacesSummaryTable;
