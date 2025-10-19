// Rapport unique pour tous les aérodromes avec données SIA/AIXM
import React, { useState, useEffect } from 'react';
import { Search, Download, Printer, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { aixmParser } from '@services/aixmParser';

export const SIAReport = () => {
  const [aerodromes, setAerodromes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editedData, setEditedData] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [selectedAerodrome, setSelectedAerodrome] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Charger toutes les données au montage
  useEffect(() => {
    loadAllAerodromes();
  }, []);

  const loadAllAerodromes = async () => {
    setLoading(true);
    try {
      
      const data = await aixmParser.loadAndParse();
      
      setAerodromes(data);
      
      // Initialiser les données éditables
      const edited = {};
      data.forEach(ad => {
        edited[ad.icao] = { ...ad };
      });
      setEditedData(edited);
    } catch (error) {
      console.error('❌ Erreur chargement SIA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour une valeur
  const updateValue = (icao, path, value) => {
    const newData = { ...editedData };
    const keys = path.split('.');
    let obj = newData[icao];
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    setEditedData(newData);
    setHasChanges(true);
  };

  // Sauvegarder les modifications
  const saveAllChanges = () => {
    localStorage.setItem('sia_edited_data', JSON.stringify(editedData));
    setHasChanges(false);
    alert('✅ Modifications sauvegardées');
  };

  // Exporter en PDF
  const exportPDF = () => {
    window.print();
  };

  // Basculer l'expansion d'une section
  const toggleSection = (icao, section) => {
    setExpandedSections(prev => ({
      ...prev,
      [`${icao}_${section}`]: !prev[`${icao}_${section}`]
    }));
  };

  // Filtrer les aérodromes
  const filteredAerodromes = aerodromes.filter(ad =>
    !searchTerm ||
    ad.icao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Styles
  const styles = {
    container: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f9fafb'
    },
    header: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    title: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: '16px'
    },
    controls: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchBox: {
      flex: '1',
      minWidth: '300px',
      padding: '10px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px'
    },
    button: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s'
    },
    primaryButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: 'white',
      color: '#374151',
      border: '1px solid #d1d5db'
    },
    successButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    aerodrome: {
      backgroundColor: 'white',
      borderRadius: '12px',
      marginBottom: '20px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    aerodromeHeader: {
      padding: '20px',
      backgroundColor: '#1e293b',
      color: 'white',
      cursor: 'pointer'
    },
    aerodromeTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      marginBottom: '4px'
    },
    aerodromeSubtitle: {
      fontSize: '14px',
      opacity: '0.9'
    },
    aerodromeContent: {
      padding: '24px'
    },
    section: {
      marginBottom: '24px',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '24px'
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '6px',
      backgroundColor: '#f3f4f6'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#374151'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px'
    },
    field: {
      marginBottom: '12px'
    },
    label: {
      fontSize: '12px',
      fontWeight: '500',
      color: '#6b7280',
      marginBottom: '4px',
      display: 'block'
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: 'white',
      transition: 'border-color 0.2s'
    },
    inputFocus: {
      outline: 'none',
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      minHeight: '80px',
      resize: 'vertical',
      fontFamily: 'inherit'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    th: {
      textAlign: 'left',
      padding: '8px',
      backgroundColor: '#f3f4f6',
      borderBottom: '1px solid #e5e7eb',
      fontSize: '12px',
      fontWeight: '600',
      color: '#374151'
    },
    td: {
      padding: '8px',
      borderBottom: '1px solid #f3f4f6'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600'
    },
    badgeBlue: {
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    badgeGreen: {
      backgroundColor: '#d1fae5',
      color: '#065f46'
    },
    badgeRed: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p>Chargement des données SIA/AIXM...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* En-tête avec contrôles */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          📊 Rapport SIA - Données Aérodromes France
        </h1>
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="Rechercher un aérodrome (ICAO, nom, ville)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchBox}
          />
          <button
            onClick={loadAllAerodromes}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
          <button
            onClick={exportPDF}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            <Printer size={16} />
            Imprimer
          </button>
          {hasChanges && (
            <button
              onClick={saveAllChanges}
              style={{ ...styles.button, ...styles.successButton }}
            >
              <Save size={16} />
              Sauvegarder
            </button>
          )}
        </div>
        <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
          {filteredAerodromes.length} aérodrome(s) affiché(s) sur {aerodromes.length}
        </div>
      </div>

      {/* Liste des aérodromes */}
      {filteredAerodromes.map(aerodrome => {
        const data = editedData[aerodrome.icao] || aerodrome;
        const isExpanded = selectedAerodrome === aerodrome.icao;
        
        return (
          <div key={aerodrome.icao} style={styles.aerodrome}>
            {/* En-tête de l'aérodrome */}
            <div 
              style={styles.aerodromeHeader}
              onClick={() => setSelectedAerodrome(isExpanded ? null : aerodrome.icao)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={styles.aerodromeTitle}>
                    {data.icao} - {data.name || 'Sans nom'}
                  </div>
                  <div style={styles.aerodromeSubtitle}>
                    {data.city && `${data.city} • `}
                    {data.elevation?.value && `Altitude: ${data.elevation.value} ft • `}
                    {data.runways?.length > 0 && `${data.runways.length} piste(s)`}
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </div>
            </div>

            {/* Contenu détaillé */}
            {isExpanded && (
              <div style={styles.aerodromeContent}>
                {/* Section Informations générales */}
                <div style={styles.section}>
                  <div 
                    style={styles.sectionHeader}
                    onClick={() => toggleSection(aerodrome.icao, 'general')}
                  >
                    <span style={styles.sectionTitle}>📍 Informations générales</span>
                    {expandedSections[`${aerodrome.icao}_general`] ? 
                      <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                  
                  {expandedSections[`${aerodrome.icao}_general`] !== false && (
                    <div style={styles.grid}>
                      <div style={styles.field}>
                        <label style={styles.label}>Code ICAO</label>
                        <input
                          type="text"
                          value={data.icao || ''}
                          onChange={(e) => updateValue(aerodrome.icao, 'icao', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Code IATA</label>
                        <input
                          type="text"
                          value={data.iata || ''}
                          onChange={(e) => updateValue(aerodrome.icao, 'iata', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Nom</label>
                        <input
                          type="text"
                          value={data.name || ''}
                          onChange={(e) => updateValue(aerodrome.icao, 'name', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Ville</label>
                        <input
                          type="text"
                          value={data.city || ''}
                          onChange={(e) => updateValue(aerodrome.icao, 'city', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Type</label>
                        <input
                          type="text"
                          value={data.type || ''}
                          onChange={(e) => updateValue(aerodrome.icao, 'type', e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Altitude (ft)</label>
                        <input
                          type="number"
                          value={data.elevation?.value || 0}
                          onChange={(e) => updateValue(aerodrome.icao, 'elevation.value', parseInt(e.target.value) || 0)}
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Latitude</label>
                        <input
                          type="number"
                          value={data.coordinates?.lat || 0}
                          onChange={(e) => updateValue(aerodrome.icao, 'coordinates.lat', parseFloat(e.target.value) || 0)}
                          step="0.000001"
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Longitude</label>
                        <input
                          type="number"
                          value={data.coordinates?.lon || 0}
                          onChange={(e) => updateValue(aerodrome.icao, 'coordinates.lon', parseFloat(e.target.value) || 0)}
                          step="0.000001"
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Variation magnétique (°)</label>
                        <input
                          type="number"
                          value={data.magneticVariation?.value || 0}
                          onChange={(e) => updateValue(aerodrome.icao, 'magneticVariation.value', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          style={styles.input}
                        />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Altitude de transition (ft)</label>
                        <input
                          type="number"
                          value={data.transitionAltitude || 0}
                          onChange={(e) => updateValue(aerodrome.icao, 'transitionAltitude', parseInt(e.target.value) || 0)}
                          style={styles.input}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section Pistes */}
                {data.runways && data.runways.length > 0 && (
                  <div style={styles.section}>
                    <div 
                      style={styles.sectionHeader}
                      onClick={() => toggleSection(aerodrome.icao, 'runways')}
                    >
                      <span style={styles.sectionTitle}>✈️ Pistes ({data.runways.length})</span>
                      {expandedSections[`${aerodrome.icao}_runways`] ? 
                        <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {expandedSections[`${aerodrome.icao}_runways`] !== false && (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Désignation</th>
                            <th style={styles.th}>QFU</th>
                            <th style={styles.th}>Dimensions</th>
                            <th style={styles.th}>Surface</th>
                            <th style={styles.th}>TORA/TODA/ASDA/LDA</th>
                            <th style={styles.th}>ILS</th>
                            <th style={styles.th}>PCN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.runways.map((runway, idx) => (
                            <tr key={idx}>
                              <td style={styles.td}>
                                <input
                                  type="text"
                                  value={runway.designation || runway.identifier || ''}
                                  onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.designation`, e.target.value)}
                                  style={{ ...styles.input, padding: '4px 8px' }}
                                />
                              </td>
                              <td style={styles.td}>
                                <input
                                  type="number"
                                  value={runway.qfu || runway.magneticBearing || 0}
                                  onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.qfu`, parseInt(e.target.value) || 0)}
                                  style={{ ...styles.input, padding: '4px 8px', width: '60px' }}
                                />
                              </td>
                              <td style={styles.td}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <input
                                    type="number"
                                    value={runway.length || 0}
                                    onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.length`, parseInt(e.target.value) || 0)}
                                    style={{ ...styles.input, padding: '4px', width: '60px', fontSize: '12px' }}
                                    placeholder="L"
                                  />
                                  <span>×</span>
                                  <input
                                    type="number"
                                    value={runway.width || 0}
                                    onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.width`, parseInt(e.target.value) || 0)}
                                    style={{ ...styles.input, padding: '4px', width: '50px', fontSize: '12px' }}
                                    placeholder="W"
                                  />
                                  <span>m</span>
                                </div>
                              </td>
                              <td style={styles.td}>
                                <input
                                  type="text"
                                  value={runway.surface || ''}
                                  onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.surface`, e.target.value)}
                                  style={{ ...styles.input, padding: '4px 8px' }}
                                />
                              </td>
                              <td style={styles.td}>
                                <div style={{ fontSize: '12px' }}>
                                  {runway.tora || runway.length || 0}/
                                  {runway.toda || runway.length || 0}/
                                  {runway.asda || runway.length || 0}/
                                  {runway.lda || runway.length || 0}
                                </div>
                              </td>
                              <td style={styles.td}>
                                {runway.ils ? (
                                  <span style={{ ...styles.badge, ...styles.badgeGreen }}>
                                    CAT {runway.ils.category || 'I'}
                                  </span>
                                ) : (
                                  <span style={{ ...styles.badge, ...styles.badgeRed }}>NON</span>
                                )}
                              </td>
                              <td style={styles.td}>
                                <input
                                  type="text"
                                  value={runway.pcn || ''}
                                  onChange={(e) => updateValue(aerodrome.icao, `runways.${idx}.pcn`, e.target.value)}
                                  style={{ ...styles.input, padding: '4px 8px', fontSize: '12px' }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Section Fréquences */}
                {data.frequencies && Object.keys(data.frequencies).length > 0 && (
                  <div style={styles.section}>
                    <div 
                      style={styles.sectionHeader}
                      onClick={() => toggleSection(aerodrome.icao, 'frequencies')}
                    >
                      <span style={styles.sectionTitle}>📻 Fréquences radio</span>
                      {expandedSections[`${aerodrome.icao}_frequencies`] ? 
                        <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {expandedSections[`${aerodrome.icao}_frequencies`] !== false && (
                      <div style={styles.grid}>
                        {Object.entries(data.frequencies).map(([service, freqs]) => (
                          <div key={service} style={styles.field}>
                            <label style={styles.label}>{service.toUpperCase()}</label>
                            {Array.isArray(freqs) ? (
                              freqs.map((freq, idx) => (
                                <div key={idx} style={{ marginBottom: '4px' }}>
                                  <input
                                    type="text"
                                    value={freq.frequency || ''}
                                    onChange={(e) => {
                                      const newFreqs = [...freqs];
                                      newFreqs[idx] = { ...freq, frequency: e.target.value };
                                      updateValue(aerodrome.icao, `frequencies.${service}`, newFreqs);
                                    }}
                                    placeholder="Fréquence MHz"
                                    style={{ ...styles.input, marginBottom: '2px' }}
                                  />
                                  {freq.schedule && freq.schedule !== 'H24' && (
                                    <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                                      {freq.schedule}
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <input
                                type="text"
                                value={freqs || ''}
                                onChange={(e) => updateValue(aerodrome.icao, `frequencies.${service}`, e.target.value)}
                                style={styles.input}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section Aides à la navigation */}
                {data.navaids && data.navaids.length > 0 && (
                  <div style={styles.section}>
                    <div 
                      style={styles.sectionHeader}
                      onClick={() => toggleSection(aerodrome.icao, 'navaids')}
                    >
                      <span style={styles.sectionTitle}>📡 Aides à la navigation ({data.navaids.length})</span>
                      {expandedSections[`${aerodrome.icao}_navaids`] ? 
                        <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {expandedSections[`${aerodrome.icao}_navaids`] !== false && (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Indicatif</th>
                            <th style={styles.th}>Fréquence</th>
                            <th style={styles.th}>Distance</th>
                            <th style={styles.th}>Radial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.navaids.map((navaid, idx) => (
                            <tr key={idx}>
                              <td style={styles.td}>
                                <span style={{ ...styles.badge, ...styles.badgeBlue }}>
                                  {navaid.type}
                                </span>
                              </td>
                              <td style={styles.td}>{navaid.identifier}</td>
                              <td style={styles.td}>{navaid.frequency} MHz</td>
                              <td style={styles.td}>{navaid.distance} NM</td>
                              <td style={styles.td}>{navaid.radial}°</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Section Remarques */}
                <div style={{ ...styles.section, borderBottom: 'none' }}>
                  <div 
                    style={styles.sectionHeader}
                    onClick={() => toggleSection(aerodrome.icao, 'remarks')}
                  >
                    <span style={styles.sectionTitle}>📝 Remarques et informations complémentaires</span>
                    {expandedSections[`${aerodrome.icao}_remarks`] ? 
                      <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                  
                  {expandedSections[`${aerodrome.icao}_remarks`] !== false && (
                    <div>
                      <textarea
                        value={data.remarks || ''}
                        onChange={(e) => updateValue(aerodrome.icao, 'remarks', e.target.value)}
                        placeholder="Ajoutez des remarques, restrictions, informations particulières..."
                        style={styles.textarea}
                      />
                      {data.referencePoint && (
                        <div style={{ marginTop: '12px' }}>
                          <label style={styles.label}>Point de référence</label>
                          <input
                            type="text"
                            value={data.referencePoint}
                            onChange={(e) => updateValue(aerodrome.icao, 'referencePoint', e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* État vide */}
      {filteredAerodromes.length === 0 && (
        <div style={styles.emptyState}>
          <Search size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>Aucun aérodrome trouvé</p>
          {searchTerm && (
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Essayez avec un autre terme de recherche
            </p>
          )}
        </div>
      )}

      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          button { display: none !important; }
          input, textarea { border: none !important; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SIAReport;