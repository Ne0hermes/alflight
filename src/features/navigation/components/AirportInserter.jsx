/**
 * Composant pour insérer des aérodromes supplémentaires dans la navigation
 * Charge directement depuis les fichiers XML SIA/AIXM locaux
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plane, Search, X, MapPin } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { AIRPORT_NAMES } from '@data/airportNames';

export const AirportInserter = ({ 
  waypoints = [],
  onInsertWaypoint,
  insertPosition = null // Position où insérer l'aérodrome (null = avant dernier)
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableAirports, setAvailableAirports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customAirport, setCustomAirport] = useState({
    icao: '',
    name: '',
    lat: '',
    lon: ''
  });

  // Charger TOUS les aérodromes directement depuis les fichiers XML
  useEffect(() => {
    const loadAllAirports = async () => {
      if (loading || availableAirports.length > 0) return;
      
      setLoading(true);
      try {
        
        const allAirports = [];
        const processedIcaos = new Set();
        
        // 1. Essayer de charger depuis AIXM (plus complet)
        try {
          const response = await fetch('/src/data/AIXM4.5_all_FR_OM_2025-09-04.xml');
          if (response.ok) {
            const xmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            
            // Extraire TOUS les aérodromes
            const aerodromes = doc.querySelectorAll('Ahp');
            
            
            // Statistiques pour debug
            const typeStats = {};
            aerodromes.forEach(ahp => {
              const codeType = ahp.querySelector('codeType')?.textContent || 'UNKNOWN';
              typeStats[codeType] = (typeStats[codeType] || 0) + 1;
            });
            
            
            aerodromes.forEach(ahp => {
              try {
                const ahpUid = ahp.querySelector('AhpUid');
                const icao = ahpUid?.querySelector('codeId')?.textContent;
                const codeType = ahp.querySelector('codeType')?.textContent;
                let name = ahp.querySelector('txtName')?.textContent || '';
                
                // Ne garder que les aérodromes (type AD) et héliports (type AH/HP)
                // Exclure seulement les Landing Sites (LS) qui ne sont pas de vrais aérodromes
                if (codeType === 'LS') {
                  return; // Ignorer les landing sites
                }
                
                // Vérifier qu'on a un code ICAO
                if (!icao) return;
                
                // Si le nom est générique, chercher le vrai nom
                if (name === 'FRANCE' || name === 'POLYNESIE FRANCAISE' || name === 'NOUVELLE CALEDONIE' || !name) {
                  // D'abord chercher dans la table des noms
                  if (AIRPORT_NAMES[icao]) {
                    name = AIRPORT_NAMES[icao];
                  } else {
                    // Sinon chercher d'autres champs
                    const txtNameAlt = ahp.querySelector('txtNameAlt')?.textContent;
                    const txtNameCitySer = ahp.querySelector('txtNameCitySer')?.textContent;
                    name = txtNameAlt || txtNameCitySer || icao || 'Aérodrome';
                  }
                }
                
                // Accepter TOUS les aérodromes sans autre filtre
                if (!processedIcaos.has(icao)) {
                  processedIcaos.add(icao);
                  
                  const geoLat = ahp.querySelector('geoLat')?.textContent;
                  const geoLong = ahp.querySelector('geoLong')?.textContent;
                  
                  // Parser les coordonnées
                  let lat = 0, lon = 0;
                  if (geoLat && geoLong) {
                    // Format: 485953N pour 48°59'53"N
                    const latMatch = geoLat.match(/(\d{2})(\d{2})(\d{2})([NS])/);
                    const lonMatch = geoLong.match(/(\d{3})(\d{2})(\d{2})([EW])/);
                    
                    if (latMatch) {
                      lat = parseInt(latMatch[1]) + parseInt(latMatch[2])/60 + parseInt(latMatch[3])/3600;
                      if (latMatch[4] === 'S') lat = -lat;
                    }
                    if (lonMatch) {
                      lon = parseInt(lonMatch[1]) + parseInt(lonMatch[2])/60 + parseInt(lonMatch[3])/3600;
                      if (lonMatch[4] === 'W') lon = -lon;
                    }
                  }
                  
                  const elevation = parseInt(ahp.querySelector('valElev')?.textContent || 0);
                  
                  // Utiliser le nom depuis AIRPORT_NAMES si disponible
                  const finalName = AIRPORT_NAMES[icao] || name;
                  
                  // N'ajouter que si on a des coordonnées valides
                  if (lat !== 0 && lon !== 0) {
                    allAirports.push({
                      icao,
                      name: finalName.replace(/\s*(FRANCE|SUISSE|BELGIQUE)$/i, '').trim(),
                      city: finalName.split(/[-–]/)[0]?.trim() || '',
                      lat,
                      lon,
                      elevation,
                      runways: [],
                      type: codeType || 'AD',
                      displayName: `${icao} - ${finalName}`,
                      searchName: `${icao} ${finalName}`.toLowerCase()
                    });
                  }
                }
              } catch (err) {
                // Ignorer les erreurs individuelles
              }
            });
            
            
          }
        } catch (e) {
          console.error('❌ Erreur chargement AIXM:', e);
        }
        
        // 2. Si pas assez d'aérodromes, essayer XML_SIA comme fallback
        if (allAirports.length < 100) {
          try {
            const response = await fetch('/src/data/XML_SIA_2025-09-04.xml');
            if (response.ok) {
              const xmlText = await response.text();
              const parser = new DOMParser();
              const doc = parser.parseFromString(xmlText, 'text/xml');
              
              const aerodromes = doc.querySelectorAll('Ahp');
              
              
              aerodromes.forEach(ahp => {
                try {
                  const ahpUid = ahp.querySelector('AhpUid');
                  const icao = ahpUid?.querySelector('codeId')?.textContent;
                  const codeType = ahp.querySelector('codeType')?.textContent;
                  const name = ahp.querySelector('txtName')?.textContent || icao;
                  
                  // Même logique simple que pour AIXM
                  if (codeType === 'LS') return; // Ignorer les landing sites
                  
                  if (!icao || processedIcaos.has(icao)) return;
                  
                  // Si le nom est générique, chercher le vrai nom
                  if (name === 'FRANCE' || !name) {
                    name = AIRPORT_NAMES[icao] || icao;
                  }
                  
                  // Ajouter l'aérodrome
                  processedIcaos.add(icao);
                  
                  const geoLat = ahp.querySelector('geoLat')?.textContent;
                  const geoLong = ahp.querySelector('geoLong')?.textContent;
                  
                  let lat = 0, lon = 0;
                  if (geoLat && geoLong) {
                    const latMatch = geoLat.match(/(\d{2})(\d{2})(\d{2})([NS])/);
                    const lonMatch = geoLong.match(/(\d{3})(\d{2})(\d{2})([EW])/);
                    
                    if (latMatch) {
                      lat = parseInt(latMatch[1]) + parseInt(latMatch[2])/60 + parseInt(latMatch[3])/3600;
                      if (latMatch[4] === 'S') lat = -lat;
                    }
                    if (lonMatch) {
                      lon = parseInt(lonMatch[1]) + parseInt(lonMatch[2])/60 + parseInt(lonMatch[3])/3600;
                      if (lonMatch[4] === 'W') lon = -lon;
                    }
                  }
                  
                  const elevation = parseInt(ahp.querySelector('valElev')?.textContent || 0);
                  const finalName = AIRPORT_NAMES[icao] || name;
                  
                  if (lat !== 0 && lon !== 0) {
                    allAirports.push({
                      icao,
                      name: finalName,
                      city: finalName.split(/[-–]/)[0]?.trim() || '',
                      lat,
                      lon,
                      elevation,
                      runways: [],
                      type: codeType || 'AD',
                      displayName: `${icao} - ${finalName}`,
                      searchName: `${icao} ${finalName}`.toLowerCase()
                    });
                  }
                } catch (err) {
                  // Ignorer les erreurs individuelles
                }
              });
              
              
            }
          } catch (e) {
            console.error('❌ Erreur chargement XML SIA:', e);
          }
        }
        
        // 3. Ajouter manuellement les aérodromes principaux s'ils manquent
        const mainAirports = [
          { icao: 'LFPG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5478, elevation: 392 },
          { icao: 'LFPO', name: 'Paris-Orly', lat: 48.7233, lon: 2.3794, elevation: 291 },
          { icao: 'LFPB', name: 'Le Bourget', lat: 48.9694, lon: 2.4414, elevation: 218 },
          { icao: 'LFST', name: 'Strasbourg-Entzheim', lat: 48.5444, lon: 7.6283, elevation: 505 },
          { icao: 'LFML', name: 'Marseille-Provence', lat: 43.4367, lon: 5.2150, elevation: 69 },
          { icao: 'LFMN', name: 'Nice-Côte d\'Azur', lat: 43.6584, lon: 7.2158, elevation: 13 },
          { icao: 'LFLL', name: 'Lyon-Saint Exupéry', lat: 45.7256, lon: 5.0811, elevation: 821 },
          { icao: 'LFBO', name: 'Toulouse-Blagnac', lat: 43.6294, lon: 1.3678, elevation: 499 },
          { icao: 'LFBD', name: 'Bordeaux-Mérignac', lat: 44.8283, lon: -0.7156, elevation: 162 },
          { icao: 'LFRN', name: 'Rennes-Saint-Jacques', lat: 48.0695, lon: -1.7348, elevation: 124 },
          { icao: 'LFRS', name: 'Nantes-Atlantique', lat: 47.1532, lon: -1.6107, elevation: 90 },
          { icao: 'LFRB', name: 'Brest-Bretagne', lat: 48.4479, lon: -4.4185, elevation: 325 },
          { icao: 'LFQQ', name: 'Lille-Lesquin', lat: 50.5619, lon: 3.0897, elevation: 157 },
          { icao: 'LFSB', name: 'Bâle-Mulhouse', lat: 47.5896, lon: 7.5296, elevation: 885 },
          { icao: 'LFLS', name: 'Grenoble-Alpes-Isère', lat: 45.3629, lon: 5.3294, elevation: 1302 },
          { icao: 'LFLB', name: 'Chambéry-Savoie', lat: 45.6381, lon: 5.8803, elevation: 779 },
          { icao: 'LFBT', name: 'Tarbes-Lourdes-Pyrénées', lat: 43.1787, lon: 0.0006, elevation: 1260 },
          { icao: 'LFBP', name: 'Pau-Pyrénées', lat: 43.3800, lon: -0.4186, elevation: 616 },
          { icao: 'LFKJ', name: 'Ajaccio-Napoléon-Bonaparte', lat: 41.9236, lon: 8.8029, elevation: 18 },
          { icao: 'LFKB', name: 'Bastia-Poretta', lat: 42.5527, lon: 9.4837, elevation: 26 }
        ];
        
        mainAirports.forEach(apt => {
          if (!processedIcaos.has(apt.icao)) {
            allAirports.push({
              ...apt,
              city: apt.name.split('-')[0],
              runways: [],
              type: 'AD',
              displayName: `${apt.icao} - ${apt.name}`,
              searchName: `${apt.icao} ${apt.name}`.toLowerCase()
            });
            processedIcaos.add(apt.icao);
          }
        });
        
        // Trier par code ICAO
        allAirports.sort((a, b) => a.icao.localeCompare(b.icao));
        
        setAvailableAirports(allAirports);
        
        .map(a => a.icao));
      } catch (error) {
        console.error('❌ Erreur chargement des aérodromes:', error);
        setAvailableAirports([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      loadAllAirports();
    }
  }, [isOpen]);

  // Identifier les aérodromes déjà présents dans la navigation
  const airportsInRoute = useMemo(() => {
    const airports = new Set();
    waypoints.forEach(wp => {
      if (wp.type === 'airport') {
        if (wp.icaoCode) {
          airports.add(wp.icaoCode);
        } else if (wp.name && wp.name.match(/^[A-Z]{4}$/)) {
          airports.add(wp.name);
        }
      } else if (wp.name && wp.name.match(/^[A-Z]{4}$/)) {
        airports.add(wp.name);
      }
    });
    return airports;
  }, [waypoints]);

  // Filtrer les aérodromes selon la recherche (permettre les doublons pour navigation circulaire)
  const filteredAirports = useMemo(() => {
    if (!searchTerm) {
      return availableAirports;
    }

    const term = searchTerm.toLowerCase();
    return availableAirports.filter(apt =>
      apt.searchName.includes(term) ||
      apt.icao.toLowerCase().includes(term)
    );
  }, [availableAirports, searchTerm]);

  // Fonction pour insérer un aérodrome
  const handleInsertAirport = (airport) => {
    const newWaypoint = {
      id: `airport-${Date.now()}`,
      name: airport.icao,
      icaoCode: airport.icao,
      lat: airport.lat,
      lon: airport.lon,
      type: 'airport',
      airportName: airport.name,
      elevation: airport.elevation,
      runways: airport.runways,
      displayName: airport.displayName,
      city: airport.city,
      coordinates: { lat: airport.lat, lon: airport.lon }
    };

    // Déterminer la position d'insertion
    let position = insertPosition;
    if (position === null) {
      // Par défaut, insérer avant le dernier waypoint (arrivée)
      position = Math.max(0, waypoints.length - 1);
    }
    
    onInsertWaypoint(newWaypoint, position);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Fonction pour ajouter un aérodrome personnalisé
  const handleAddCustomAirport = () => {
    if (!customAirport.icao || !customAirport.lat || !customAirport.lon) {
      alert('Veuillez remplir au minimum le code ICAO et les coordonnées');
      return;
    }

    const newWaypoint = {
      id: `airport-${Date.now()}`,
      name: customAirport.icao.toUpperCase(),
      icaoCode: customAirport.icao.toUpperCase(),
      lat: parseFloat(customAirport.lat),
      lon: parseFloat(customAirport.lon),
      type: 'airport',
      airportName: customAirport.name || customAirport.icao.toUpperCase(),
      elevation: 0,
      runways: [],
      displayName: `${customAirport.icao.toUpperCase()} - ${customAirport.name || 'Aérodrome personnalisé'}`,
      coordinates: { lat: parseFloat(customAirport.lat), lon: parseFloat(customAirport.lon) }
    };

    // Déterminer la position d'insertion
    let position = insertPosition;
    if (position === null) {
      position = Math.max(0, waypoints.length - 1);
    }
    
    onInsertWaypoint(newWaypoint, position);
    setIsOpen(false);
    setShowCustomForm(false);
    setCustomAirport({ icao: '', name: '', lat: '', lon: '' });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton pour ouvrir le sélecteur */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={sx.combine(
          sx.components.button.base,
          sx.components.button.secondary,
          {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '13px'
          }
        )}
        title="Ajouter un aérodrome"
      >
        <Plane size={14} />
        Ajouter un aérodrome
      </button>

      {/* Popup de sélection */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '8px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '12px',
          minWidth: '350px',
          maxWidth: '450px',
          zIndex: 1000
        }}>
          {/* En-tête avec recherche */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '12px',
            gap: '8px'
          }}>
            <div style={{ 
              flex: 1,
              position: 'relative'
            }}>
              <Search size={14} style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher (ex: LFPG, Paris)..."
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
                autoFocus
              />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Liste des aérodromes */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {loading ? (
              <p style={{
                padding: '12px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px'
              }}>
                Chargement des aérodromes...
              </p>
            ) : filteredAirports.length === 0 ? (
              <p style={{
                padding: '12px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px'
              }}>
                {searchTerm 
                  ? "Aucun aérodrome trouvé"
                  : availableAirports.length === 0 
                    ? "Chargement en cours..."
                    : "Tous les aérodromes disponibles sont déjà dans votre route"}
              </p>
            ) : (
              filteredAirports.slice(0, 50).map(airport => (
                <div
                  key={airport.icao}
                  onClick={() => handleInsertAirport(airport)}
                  style={{
                    padding: '10px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '14px',
                        marginBottom: '3px',
                        color: '#1f2937'
                      }}>
                        {airport.icao}
                        <span style={{ 
                          fontWeight: '400', 
                          fontSize: '13px',
                          marginLeft: '8px',
                          color: '#4b5563'
                        }}>
                          {airport.name}
                        </span>
                      </div>
                      {airport.city && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          marginBottom: '2px'
                        }}>
                          📍 {airport.city}
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#9ca3af',
                        display: 'flex',
                        gap: '12px'
                      }}>
                        <span>🌐 {airport.lat?.toFixed(4)}°, {airport.lon?.toFixed(4)}°</span>
                        {airport.elevation && (
                          <span>⛰️ {airport.elevation} ft</span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      padding: '2px 6px',
                      background: airport.type === 'AD' ? '#dbeafe' : '#e5e7eb',
                      color: airport.type === 'AD' ? '#1e40af' : '#374151',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      marginLeft: '8px'
                    }}>
                      {airport.type || 'AD'}
                    </div>
                  </div>
                </div>
            )}
            {filteredAirports.length > 50 && (
              <div style={{
                padding: '8px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#6b7280',
                borderTop: '1px solid #e5e7eb'
              }}>
                ... et {filteredAirports.length - 50} autres aérodromes
              </div>
            )}
          </div>

          {/* Stats de chargement */}
          {!loading && availableAirports.length > 0 && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: '#eff6ff',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#1e40af',
              textAlign: 'center'
            }}>
              📊 {availableAirports.length} aérodromes disponibles
            </div>
          )}

          {/* Bouton pour basculer vers le formulaire personnalisé */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#78350f' }}>
              Aérodrome non trouvé ?
            </div>
            <button
              onClick={() => setShowCustomForm(!showCustomForm)}
              style={{
                padding: '8px 16px',
                background: '#fbbf24',
                color: '#78350f',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {showCustomForm ? '← Retour à la liste' : '+ Ajouter manuellement'}
            </button>
          </div>

          {/* Formulaire personnalisé */}
          {showCustomForm && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Ajouter un aérodrome personnalisé
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                    Code ICAO *
                  </label>
                  <input
                    type="text"
                    value={customAirport.icao}
                    onChange={(e) => setCustomAirport({...customAirport, icao: e.target.value.toUpperCase()})}
                    placeholder="Ex: LFXX"
                    maxLength="4"
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                    Nom (optionnel)
                  </label>
                  <input
                    type="text"
                    value={customAirport.name}
                    onChange={(e) => setCustomAirport({...customAirport, name: e.target.value})}
                    placeholder="Ex: Mon Aérodrome"
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                      Latitude *
                    </label>
                    <input
                      type="number"
                      value={customAirport.lat}
                      onChange={(e) => setCustomAirport({...customAirport, lat: e.target.value})}
                      placeholder="Ex: 48.8566"
                      step="0.0001"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                      Longitude *
                    </label>
                    <input
                      type="number"
                      value={customAirport.lon}
                      onChange={(e) => setCustomAirport({...customAirport, lon: e.target.value})}
                      placeholder="Ex: 2.3522"
                      step="0.0001"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddCustomAirport}
                  style={{
                    padding: '8px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  Ajouter cet aérodrome
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          {!showCustomForm && (
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: '#f0f9ff',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#0369a1'
            }}>
              💡 L'aérodrome sera ajouté avant votre destination. Vous pouvez le déplacer ensuite.
            </div>
          )}
        </div>
      )}
    </div>

};

export default AirportInserter;