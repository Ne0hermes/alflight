// src/features/weather/WeatherModule.jsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { Cloud, Search, RefreshCw, AlertTriangle, Wind, Eye, Thermometer, Gauge, Clock, Plane, Navigation2, Info, ChevronDown, ChevronUp, Map, ExternalLink, Download } from 'lucide-react';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import { useNavigation } from '@core/contexts';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { sx } from '@shared/styles/styleSystem';
import { RunwaySuggestionEnhanced } from './components/RunwaySuggestionEnhanced';
import { DataSourceBadge, DataField, DataFieldGroup } from '@shared/components';

export const WeatherModule = memo(() => {
  const { waypoints } = useNavigation();
  const { selectedAlternates } = useAlternatesStore();
  const { fetchWeather, fetchMultiple } = weatherSelectors.useWeatherActions();
  const [searchIcao, setSearchIcao] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const searchRef = useRef(null);
  
  
  // Extraire les codes OACI des waypoints
  const waypointIcaos = waypoints
    .map(wp => wp.name)
    .filter(name => name && name.match(/^[A-Z]{4}$/));
  
  // Charger automatiquement la météo des waypoints
  useEffect(() => {
    if (waypointIcaos.length > 0) {
      fetchMultiple(waypointIcaos);
    }
  }, [waypointIcaos.join(','), fetchMultiple]);
  
  // Charger automatiquement la météo des alternates
  useEffect(() => {
    if (selectedAlternates && selectedAlternates.length > 0) {
      const alternateIcaos = selectedAlternates.map(alt => alt.icao).filter(Boolean);
      if (alternateIcaos.length > 0) {
        fetchMultiple(alternateIcaos);
      }
    }
  }, [selectedAlternates, fetchMultiple]);
  
  // Gérer le clic en dehors pour fermer les suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Charger les suggestions d'aérodromes
  useEffect(() => {
    const loadSuggestions = async () => {
      if (searchIcao.length >= 2) {
        try {
          // Essayer de charger depuis le service OpenAIP
          const { openAIPService } = await import('@services/openAIPService');
          const airports = await openAIPService.getAirports('FR');
          
          // Filtrer les aérodromes qui correspondent à la recherche
          const filtered = airports
            .filter(apt => 
              apt.icao && 
              (apt.icao.toUpperCase().includes(searchIcao.toUpperCase()) ||
               apt.name?.toUpperCase().includes(searchIcao.toUpperCase()))
            )
            .slice(0, 10) // Limiter à 10 suggestions
            .map(apt => ({
              icao: apt.icao,
              name: apt.name,
              type: apt.type,
              lat: apt.coordinates?.lat || apt.lat,
              lon: apt.coordinates?.lon || apt.lon || apt.lng,
              elevation: apt.elevation,
              runways: apt.runways || []
            }));
          
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        } catch (error) {
          console.error('Erreur chargement suggestions:', error);
          // Utiliser des suggestions statiques en cas d'erreur
          const staticSuggestions = [
            { icao: 'LFPG', name: 'Paris Charles de Gaulle', type: 'large_airport' },
            { icao: 'LFPO', name: 'Paris Orly', type: 'large_airport' },
            { icao: 'LFBO', name: 'Toulouse Blagnac', type: 'large_airport' },
            { icao: 'LFML', name: 'Marseille Provence', type: 'large_airport' },
            { icao: 'LFLL', name: 'Lyon Saint-Exupéry', type: 'large_airport' },
            { icao: 'LFBD', name: 'Bordeaux Mérignac', type: 'large_airport' },
            { icao: 'LFMN', name: 'Nice Côte d\'Azur', type: 'large_airport' },
            { icao: 'LFSB', name: 'Bâle Mulhouse', type: 'large_airport' },
            { icao: 'LFLS', name: 'Grenoble Alpes Isère', type: 'medium_airport' },
            { icao: 'LFST', name: 'Strasbourg Entzheim', type: 'medium_airport' }
          ].filter(apt => 
            apt.icao.includes(searchIcao.toUpperCase()) ||
            apt.name.toUpperCase().includes(searchIcao.toUpperCase())
          );
          
          setSuggestions(staticSuggestions);
          setShowSuggestions(staticSuggestions.length > 0);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    
    loadSuggestions();
  }, [searchIcao]);
  
  const handleSelectAirport = async (airport) => {
    setSearchIcao(airport.icao);
    setSelectedAirport(airport);
    setShowSuggestions(false);
    
    // Charger la météo
    await fetchWeather(airport.icao);
    
    // Ajouter aux recherches récentes
    setRecentSearches(prev => {
      const updated = [airport.icao, ...prev.filter(s => s !== airport.icao)].slice(0, 5);
      return updated;
    });
  };
  
  const handleSearch = async () => {
    if (searchIcao && searchIcao.match(/^[A-Z]{4}$/i)) {
      const icao = searchIcao.toUpperCase();
      await fetchWeather(icao);
      
      // Chercher l'aérodrome dans les suggestions pour avoir ses détails
      const airport = suggestions.find(s => s.icao === icao) || { icao, name: 'Inconnu' };
      setSelectedAirport(airport);
      
      // Ajouter aux recherches récentes
      setRecentSearches(prev => {
        const updated = [icao, ...prev.filter(s => s !== icao)].slice(0, 5);
        return updated;
      });
      
      setShowSuggestions(false);
    }
  };
  
  return (
    <div style={sx.spacing.p(6)}>
      {/* En-tête et recherche */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Cloud size={20} />
          <span style={sx.spacing.ml(2)}>Recherche météo</span>
        </h3>
        
        <div style={{ position: 'relative' }}>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(3))}>
            <div ref={searchRef} style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Code OACI ou nom d'aérodrome"
                value={searchIcao}
                onChange={(e) => {
                  setSearchIcao(e.target.value.toUpperCase());
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => searchIcao.length >= 2 && setShowSuggestions(true)}
                style={sx.combine(sx.components.input.base, { width: '100%' })}
              />
              
              {/* Liste des suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginTop: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}>
                  {suggestions.map(airport => (
                    <div
                      key={airport.icao}
                      onClick={() => handleSelectAirport(airport)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        ':hover': { backgroundColor: '#f9fafb' }
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '14px' }}>{airport.icao}</strong>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          backgroundColor: '#e5e7eb',
                          borderRadius: '4px'
                        }}>
                          {airport.type === 'large_airport' ? 'Grand' : 
                           airport.type === 'medium_airport' ? 'Moyen' : 'Petit'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {airport.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleSearch}
              disabled={!searchIcao.match(/^[A-Z]{4}$/i)}
              style={sx.combine(
                sx.components.button.base,
                sx.components.button.primary,
                !searchIcao.match(/^[A-Z]{4}$/i) && { opacity: 0.5, cursor: 'not-allowed' }
              )}
            >
              <Search size={16} />
              Rechercher
            </button>
          </div>
        </div>
        
        {/* Recherches récentes */}
        {recentSearches.length > 0 && (
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mt(3))}>
            <span style={sx.combine(sx.text.sm, sx.text.secondary)}>Récent :</span>
            {recentSearches.map(icao => (
              <button
                key={icao}
                onClick={() => fetchWeather(icao)}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary,
                  { padding: '4px 12px', fontSize: '13px' }
                )}
              >
                {icao}
              </button>
            ))}
          </div>
        )}
      </section>
      
      {/* Détails de l'aérodrome sélectionné */}
      {selectedAirport && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Plane size={20} />
            <span style={sx.spacing.ml(2)}>Aérodrome recherché</span>
          </h3>
          <WeatherCard 
            icao={selectedAirport.icao} 
            label="Recherche"
            additionalInfo={selectedAirport.name}
            customBorderColor="#8b5cf6"
            customBgColor="#f3e8ff"
            customTextColor="#5b21b6"
          />
          
          {/* Informations supplémentaires si disponibles */}
          {selectedAirport.runways && selectedAirport.runways.length > 0 && (
            <div style={sx.combine(sx.components.card.base, sx.spacing.mt(3))}>
              <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                Informations aérodrome
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {selectedAirport.elevation && (
                  <DataField
                    label="Altitude"
                    value={selectedAirport.elevation}
                    unit="ft"
                    dataSource="static"
                    size="sm"
                  />
                )}
                {selectedAirport.runways.length > 0 && (
                  <DataField
                    label="Pistes"
                    value={selectedAirport.runways.length}
                    dataSource="static"
                    size="sm"
                  />
                )}
                {selectedAirport.runways[0]?.length && (
                  <DataField
                    label="Longueur max"
                    value={selectedAirport.runways[0].length}
                    unit="m"
                    dataSource="static"
                    size="sm"
                  />
                )}
                {selectedAirport.type && (
                  <DataField
                    label="Type"
                    value={
                      selectedAirport.type === 'large_airport' ? 'Grand aéroport' :
                      selectedAirport.type === 'medium_airport' ? 'Aéroport moyen' :
                      'Petit aérodrome'
                    }
                    dataSource="static"
                    size="sm"
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}
      
      {/* Météo de la navigation (waypoints + déroutements) */}
      {(waypointIcaos.length > 0 || (selectedAlternates && selectedAlternates.length > 0)) && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Plane size={20} />
            <span style={sx.spacing.ml(2)}>Météo de la navigation</span>
          </h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Waypoints (Départ, Étapes, Arrivée) */}
            {waypointIcaos.map((icao, index) => (
              <WeatherCard 
                key={icao} 
                icao={icao} 
                label={index === 0 ? 'Départ' : index === waypointIcaos.length - 1 ? 'Arrivée' : 'Étape'}
              />
            ))}
            
            {/* Aérodromes de déroutement - affichés en ligne */}
            {selectedAlternates && selectedAlternates.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {selectedAlternates.map((alternate, index) => (
                  <WeatherCard 
                    key={`alt-${alternate.icao}`} 
                    icao={alternate.icao}
                    label="Déroutement"
                    customBorderColor="#8b5cf6"
                    customBgColor="#f3e8ff"
                    customTextColor="#5b21b6"
                    additionalInfo={alternate.name ? `${alternate.name}` : ''}
                    compact={true}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Section Cartes météo WINTEM et TEMSI */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mt(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Map size={20} />
          <span style={sx.spacing.ml(2)}>Cartes météo aéronautiques</span>
        </h3>
        
        <WeatherChartsSection />
      </section>
      
      {/* Guide d'interprétation des pistes - En bas du module */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mt(6), { 
        backgroundColor: '#f9fafb',
        borderTop: '2px solid #e5e7eb'
      })}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          📚 Guide d'interprétation des pistes
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
          {/* Colonne gauche - Codes couleur */}
          <div>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Codes couleur des pistes
            </h5>
            <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
              <div style={sx.combine(sx.spacing.mb(2), sx.flex.start)}>
                <span style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: '#10b981', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <strong>Optimal (±30°):</strong> Vent de face idéal, conditions optimales
              </div>
              <div style={sx.combine(sx.spacing.mb(2), sx.flex.start)}>
                <span style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: '#f59e0b', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <strong>Bon (±45°):</strong> Vent favorable, légère composante traversière
              </div>
              <div style={sx.combine(sx.spacing.mb(2), sx.flex.start)}>
                <span style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: '#ea580c', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <strong>Acceptable (±90°):</strong> Vent traversier dominant, prudence requise
              </div>
              <div style={sx.combine(sx.spacing.mb(2), sx.flex.start)}>
                <span style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: '#dc2626', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <strong>Déconseillé ({'>'}90°):</strong> Vent arrière, éviter sauf urgence
              </div>
            </div>
          </div>
          
          {/* Colonne droite - Conseils pratiques */}
          <div>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              Conseils pratiques
            </h5>
            <ul style={sx.combine(sx.text.sm, sx.text.secondary, { 
              listStyleType: 'disc',
              paddingLeft: '20px',
              lineHeight: '1.6'
            })}>
              <li>Ajoutez 5kt à votre vitesse d'approche par tranche de 10kt de rafales</li>
              <li>Anticipez la dérive due au vent traversier</li>
              <li>Préparez-vous à une remise de gaz si conditions instables</li>
              <li>Vérifiez les limites vent traversier de votre appareil</li>
              <li>Considérez le déroutement si vent arrière sur toutes les pistes</li>
            </ul>
            
            <div style={sx.combine(sx.spacing.mt(3), sx.components.alert.base, sx.components.alert.info, { padding: '8px' })}>
              <Info size={14} />
              <p style={sx.text.xs}>
                Les icônes 🛫 et 🛬 dans le tableau indiquent les pistes recommandées pour le décollage et l'atterrissage
              </p>
            </div>
          </div>
        </div>
      </section>
      
    </div>
  );
});

// Composant pour afficher une carte météo
const WeatherCard = memo(({ icao, label, customBorderColor, customBgColor, customTextColor, additionalInfo, compact = false }) => {
  const weather = weatherSelectors.useWeatherByIcao(icao);
  const isLoading = weatherSelectors.useIsLoading(icao);
  const error = weatherSelectors.useError(icao);
  const { fetchWeather } = weatherSelectors.useWeatherActions();
  const [showDecoded, setShowDecoded] = useState(false);
  
  if (isLoading) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.flex.center, { minHeight: '120px' })}>
        <div style={sx.text.center}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={sx.text.secondary}>Chargement météo {icao}...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.components.alert.danger)}>
        <AlertTriangle size={20} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>{icao} - Erreur</p>
          <p style={sx.text.sm}>{error}</p>
        </div>
      </div>
    );
  }
  
  if (!weather) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.flex.between)}>
        <div>
          <p style={sx.combine(sx.text.base, sx.text.bold)}>{icao}</p>
          <p style={sx.text.sm}>Pas de données météo</p>
        </div>
        <button
          onClick={() => fetchWeather(icao)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          <Search size={16} />
          Charger
        </button>
      </div>
    );
  }
  
  const metar = weather.metar?.decoded;
  const isOld = Date.now() - weather.timestamp > 60 * 60 * 1000; // Plus d'une heure
  
  // Version compacte pour les déroutements
  if (compact) {
    return (
      <div style={sx.combine(
        sx.components.card.base,
        { 
          border: `1px solid ${customBorderColor}`,
          padding: '6px 10px',
          minWidth: '0'
        }
      )}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(1))}>
          <div>
            <strong style={sx.combine(sx.text.sm, sx.spacing.mr(1))}>{icao}</strong>
            <span style={sx.combine(
              sx.text.xs,
              { 
                padding: '0px 4px', 
                borderRadius: '2px',
                backgroundColor: customBgColor,
                color: customTextColor,
                fontSize: '10px'
              }
            )}>
              {label}
            </span>
          </div>
          <button
            onClick={() => fetchWeather(icao)}
            style={{ 
              padding: '2px 4px', 
              fontSize: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280'
            }}
            title="Actualiser"
          >
            <RefreshCw size={10} />
          </button>
        </div>
        
        {additionalInfo && (
          <div style={sx.combine(sx.text.xs, sx.text.secondary, { fontSize: '10px' })}>
            {additionalInfo}
          </div>
        )}
        
        {metar && (
          <div style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.4' }}>
            <div>💨 {metar.wind.direction === 'Calme' ? 'Calme' : `${metar.wind.direction}°/${metar.wind.speed}kt`}</div>
            <div>👁 {metar.visibility === 'CAVOK' ? 'CAVOK' : `${metar.visibility}m`} | 🌡 {metar.temperature}°C | 📊 {metar.pressure}hPa</div>
          </div>
        )}
        
        {!metar && (
          <div style={sx.combine(sx.text.xs, sx.text.secondary, { fontSize: '10px' })}>
            Pas de données météo
          </div>
        )}
      </div>
    );
  }
  
  // Version complète pour les autres
  return (
    <div style={sx.combine(
      sx.components.card.base,
      { 
        border: `1px solid ${
          customBorderColor ||
          (label === 'Départ' ? '#10b981' : 
          label === 'Arrivée' ? '#f59e0b' : 
          '#3b82f6')
        }` 
      }
    )}>
      {/* En-tête */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
        <div>
          <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            {icao}
            {label && (
              <span style={sx.combine(
                sx.text.sm,
                sx.spacing.ml(2),
                { 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  backgroundColor: customBgColor || 
                    (label === 'Départ' ? '#d1fae5' : label === 'Arrivée' ? '#fef3c7' : '#dbeafe'),
                  color: customTextColor ||
                    (label === 'Départ' ? '#065f46' : label === 'Arrivée' ? '#92400e' : '#1e40af')
                }
              )}>
                {label}
              </span>
            )}
            <DataSourceBadge source="api" size="sm" inline={true} style={{ marginLeft: '8px' }} />
          </h4>
          {additionalInfo && (
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              {additionalInfo}
            </p>
          )}
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.flex.start)}>
            <Clock size={12} />
            <span style={sx.spacing.ml(1)}>
              {new Date(weather.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {isOld && <span style={{ color: '#f59e0b' }}> (données anciennes)</span>}
            </span>
          </p>
        </div>
        <button
          onClick={() => fetchWeather(icao)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px' })}
          title="Actualiser"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      {/* METAR brut - affiché en premier et bien visible */}
      {weather.metar?.raw && (
        <div style={sx.combine(sx.spacing.mt(3))}>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>METAR :</p>
          <div style={{ 
            fontSize: '13px', 
            backgroundColor: '#f3f4f6', 
            padding: '12px', 
            borderRadius: '6px',
            fontFamily: 'monospace',
            lineHeight: '1.5',
            color: '#1f2937',
            border: '1px solid #d1d5db'
          }}>
            {weather.metar.raw}
          </div>
        </div>
      )}
      
      {/* TAF si disponible */}
      {weather.taf?.raw && (
        <div style={sx.spacing.mt(3)}>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>TAF :</p>
          <div style={{ 
            fontSize: '13px', 
            backgroundColor: '#f3f4f6', 
            padding: '12px', 
            borderRadius: '6px',
            fontFamily: 'monospace',
            lineHeight: '1.5',
            color: '#1f2937',
            border: '1px solid #d1d5db'
          }}>
            {weather.taf.raw}
          </div>
        </div>
      )}
      
      {/* Données METAR décodées - juste après le METAR/TAF */}
      {metar && (
        <div style={sx.combine(sx.spacing.mt(3), sx.components.card.base, { backgroundColor: '#fafafa' })}>
          <div style={sx.combine(sx.flex.start, sx.spacing.mb(showDecoded ? 2 : 0))}>
            <button
              onClick={() => setShowDecoded(!showDecoded)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                color: '#6b7280'
              }}
              title={showDecoded ? 'Réduire' : 'Afficher'}
            >
              {showDecoded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>Données décodées</p>
          </div>
          
          {showDecoded && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <DataField
                  label="Vent"
                  value={
                    metar.wind.direction === 'Calme' || metar.wind.direction === 'Variable' 
                      ? metar.wind.direction 
                      : `${metar.wind.direction}° / ${metar.wind.speed}kt${metar.wind.gust ? ` G${metar.wind.gust}kt` : ''}`
                  }
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
                
                <DataField
                  label="Visibilité"
                  value={
                    metar.visibility === 'CAVOK' 
                      ? 'CAVOK' 
                      : typeof metar.visibility === 'number' 
                        ? `${metar.visibility}m` 
                        : metar.visibility
                  }
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
                
                <DataField
                  label="Temp/Rosée"
                  value={`${metar.temperature !== null ? metar.temperature : 'N/A'}°C / ${metar.dewpoint !== null ? metar.dewpoint : 'N/A'}°C`}
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
                
                <DataField
                  label="QNH"
                  value={metar.pressure !== null ? metar.pressure : 'N/A'}
                  unit="hPa"
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
              </div>
              
              {/* Nuages si présents */}
              {metar.clouds.length > 0 && (
                <div style={sx.combine(sx.spacing.mt(2))}>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1))}>Nuages :</p>
                  <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), { flexWrap: 'wrap' })}>
                    {metar.clouds.map((cloud, i) => (
                      <span key={i} style={sx.combine(sx.text.sm, {
                        padding: '2px 8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        fontSize: '12px'
                      })}>
                        {cloud.type} {cloud.altitude}ft
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Suggestion de piste selon le vent - TOUJOURS VISIBLE */}
      {metar && metar.wind && (
        <RunwaySuggestionEnhanced icao={icao} wind={metar.wind} />
      )}
    </div>
  );
});

// Composant pour afficher toutes les stations
const AllWeatherStations = memo(() => {
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const stations = Object.keys(weatherData).sort();
  
  if (stations.length === 0) {
    return (
      <div style={sx.combine(sx.text.center, sx.text.secondary, sx.spacing.p(8))}>
        Aucune donnée météo chargée
      </div>
    );
  }
  
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {stations.map(icao => (
        <WeatherCard key={icao} icao={icao} />
      ))}
    </div>
  );
});

// Composant pour les cartes météo WINTEM et TEMSI
const WeatherChartsSection = memo(() => {
  const [selectedChart, setSelectedChart] = useState('wintem');
  const [selectedLevel, setSelectedLevel] = useState('FL100');
  const [validityTime, setValidityTime] = useState('');
  
  // Options pour l'accès aux cartes
  // Option 1: AEROWEB API (nécessite inscription gratuite)
  // Option 2: URLs directes (nécessite authentification)
  // Option 3: SOFIA-Briefing (accès public limité)
  
  const chartUrls = {
    wintem: {
      FL020: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL020&TYPE_IMAGE=WINTEM',
      FL050: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL050&TYPE_IMAGE=WINTEM',
      FL100: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL100&TYPE_IMAGE=WINTEM',
      FL180: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL180&TYPE_IMAGE=WINTEM',
      FL240: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL240&TYPE_IMAGE=WINTEM',
      FL300: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL300&TYPE_IMAGE=WINTEM',
      FL340: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL340&TYPE_IMAGE=WINTEM',
      FL390: 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&NIVEAU=FL390&TYPE_IMAGE=WINTEM'
    },
    temsi: {
      'EUROC': 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&TYPE_IMAGE=TEMSI_EUROC',
      'France': 'https://aviation.meteo.fr/FR/aviation/affiche_image.jsp?LOGIN=pro&TYPE_IMAGE=TEMSI_FRANCE'
    }
  };
  
  // Générer l'heure de validité (prochaine heure synoptique)
  useEffect(() => {
    const now = new Date();
    const hours = now.getUTCHours();
    const synopticHour = Math.floor(hours / 6) * 6; // 00, 06, 12, 18
    const validity = new Date(now);
    validity.setUTCHours(synopticHour + 6, 0, 0, 0);
    
    if (validity > now) {
      setValidityTime(validity.toISOString().slice(11, 16) + ' UTC');
    } else {
      validity.setUTCHours(synopticHour + 12, 0, 0, 0);
      setValidityTime(validity.toISOString().slice(11, 16) + ' UTC');
    }
  }, []);
  
  return (
    <div>
      {/* Sélecteur de type de carte */}
      <div style={sx.combine(sx.flex.start, sx.spacing.mb(4), sx.spacing.gap(2))}>
        <button
          onClick={() => {
            setSelectedChart('wintem');
            setSelectedLevel('FL100');
          }}
          style={sx.combine(
            sx.components.button.base,
            selectedChart === 'wintem' ? sx.components.button.primary : sx.components.button.secondary
          )}
        >
          <Wind size={16} />
          WINTEM
        </button>
        <button
          onClick={() => {
            setSelectedChart('temsi');
            setSelectedLevel('EUROC');
          }}
          style={sx.combine(
            sx.components.button.base,
            selectedChart === 'temsi' ? sx.components.button.primary : sx.components.button.secondary
          )}
        >
          <Cloud size={16} />
          TEMSI
        </button>
        
        {validityTime && (
          <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(3))}>
            <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Validité estimée: {validityTime}
          </span>
        )}
      </div>
      
      {/* Sélecteur de niveau pour WINTEM */}
      {selectedChart === 'wintem' && (
        <div style={sx.combine(sx.spacing.mb(3))}>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Niveau de vol :
          </p>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), { flexWrap: 'wrap' })}>
            {Object.keys(chartUrls.wintem).map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary,
                  selectedLevel === level && sx.components.button.primary,
                  { padding: '6px 12px', fontSize: '13px' }
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Sélecteur de zone pour TEMSI */}
      {selectedChart === 'temsi' && (
        <div style={sx.combine(sx.spacing.mb(3))}>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Zone :
          </p>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            {Object.keys(chartUrls.temsi).map(zone => (
              <button
                key={zone}
                onClick={() => setSelectedLevel(zone)}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary,
                  selectedLevel === zone && sx.components.button.primary,
                  { padding: '6px 12px', fontSize: '13px' }
                )}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Zone d'affichage de la carte */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold)}>
            {selectedChart === 'wintem' ? `WINTEM ${selectedLevel}` : `TEMSI ${selectedLevel}`}
          </h4>
          <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
            <a
              href={chartUrls[selectedChart][selectedLevel]}
              target="_blank"
              rel="noopener noreferrer"
              style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
            >
              <ExternalLink size={16} />
              Ouvrir dans un nouvel onglet
            </a>
            <a
              href={chartUrls[selectedChart][selectedLevel]}
              download
              style={sx.combine(sx.components.button.base, sx.components.button.primary)}
            >
              <Download size={16} />
              Télécharger
            </a>
          </div>
        </div>
        
        {/* Image de la carte */}
        <div style={{ 
          width: '100%', 
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img
            src={chartUrls[selectedChart][selectedLevel]}
            alt={`${selectedChart === 'wintem' ? 'WINTEM' : 'TEMSI'} ${selectedLevel}`}
            style={{ 
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '4px',
              border: '1px solid #d1d5db'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <div style={{ 
            display: 'none',
            padding: '32px',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            border: '1px solid #fca5a5'
          }}>
            <AlertTriangle size={48} style={{ color: '#dc2626', marginBottom: '16px' }} />
            <p style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
              Carte non disponible
            </p>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Les cartes WINTEM et TEMSI nécessitent un accès authentifié.
            </p>
            
            <div style={sx.combine(sx.text.sm, sx.spacing.mt(3), { textAlign: 'left' })}>
              <p style={sx.combine(sx.text.bold, sx.spacing.mb(2))}>Options disponibles :</p>
              
              <div style={sx.spacing.mb(2)}>
                <strong>1. AEROWEB API (Gratuit avec inscription)</strong>
                <p style={sx.text.secondary}>
                  API XML officielle de Météo-France pour l'aviation.
                  Nécessite de signer une convention AEROWEB Server.
                </p>
              </div>
              
              <div style={sx.spacing.mb(2)}>
                <strong>2. SOFIA-Briefing</strong>
                <p style={sx.text.secondary}>
                  Plateforme de briefing de la DGAC avec accès aux cartes TEMSI.
                </p>
              </div>
              
              <div style={sx.spacing.mb(2)}>
                <strong>3. Accès direct Météo-France</strong>
                <p style={sx.text.secondary}>
                  Compte professionnel sur aviation.meteo.fr
                </p>
              </div>
            </div>
            
            <div style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mt(3))}>
              <a
                href="https://aviation.meteo.fr"
                target="_blank"
                rel="noopener noreferrer"
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.primary
                )}
              >
                <ExternalLink size={16} />
                Météo-France Aviation
              </a>
              <a
                href="https://sofia-briefing.aviation-civile.gouv.fr"
                target="_blank"
                rel="noopener noreferrer"
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.secondary
                )}
              >
                <ExternalLink size={16} />
                SOFIA-Briefing
              </a>
            </div>
          </div>
        </div>
        
        {/* Informations supplémentaires */}
        <div style={sx.combine(sx.spacing.mt(3), sx.components.alert.base, sx.components.alert.info)}>
          <Info size={16} />
          <div>
            <p style={sx.text.sm}>
              <strong>{selectedChart === 'wintem' ? 'WINTEM' : 'TEMSI'} :</strong>
              {selectedChart === 'wintem' 
                ? ' Carte des vents et températures en altitude pour la planification du vol.'
                : ' Carte du temps significatif prévu (fronts, zones de turbulence, givrage, etc.).'
              }
            </p>
            {selectedChart === 'wintem' && (
              <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                Les vents sont représentés par des barbules (triangle = 50kt, trait long = 10kt, trait court = 5kt)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

WeatherChartsSection.displayName = 'WeatherChartsSection';

WeatherModule.displayName = 'WeatherModule';
WeatherCard.displayName = 'WeatherCard';
AllWeatherStations.displayName = 'AllWeatherStations';

export default WeatherModule;