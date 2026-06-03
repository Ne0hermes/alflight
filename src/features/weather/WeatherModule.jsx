// src/features/weather/WeatherModule.jsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { Cloud, Search, RefreshCw, AlertTriangle, Wind, Eye, Thermometer, Gauge, Clock, Plane, Navigation2, Info, ChevronDown, ChevronUp, Map, ExternalLink, Download } from 'lucide-react';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import AccordionButton from '@shared/components/AccordionButton';
import { useNavigation } from '@core/contexts';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { sx } from '@shared/styles/styleSystem';
// RunwaySuggestionEnhanced déplacé vers le module Performance
import { DataSourceBadge, DataField, DataFieldGroup } from '@shared/components';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

export const WeatherModule = memo(({ wizardMode = false, config = {} }) => {
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
  
  useEffect(() => {
    const loadSuggestions = async () => {
      if (searchIcao.length >= 2) {
        try {
          const { aeroDataProvider } = await import('@core/data');
          const airports = await aeroDataProvider.getAirfields({ country: 'FR' });
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
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-weather.jpg"
          eyebrow="MÉTÉO · CONDITIONS DE VOL"
          title="Briefing météorologique"
        />
      )}

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
                  backgroundColor: 'var(--bg-overlay)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
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
                        borderBottom: '1px solid var(--bg-overlay)',
                        ':hover': { backgroundColor: 'var(--bg-overlay)' }
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-overlay)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '14px' }}>{airport.icao}</strong>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          backgroundColor: 'var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          {airport.type === 'large_airport' ? 'Grand' : 
                           airport.type === 'medium_airport' ? 'Moyen' : 'Petit'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
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
            customBorderColor="var(--accent-primary)"
            customBgColor="var(--bg-overlay)"
            customTextColor="var(--accent-primary)"
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
            {/* 🔧 FIX: Retirer les doublons si départ = arrivée (vol local) */}
            {(() => {
              // Créer un Map pour garder seulement la première occurrence de chaque ICAO
              const uniqueWaypoints = [];
              const seen = new Set();

              waypointIcaos.forEach((icao, index) => {
                if (!seen.has(icao)) {
                  seen.add(icao);
                  uniqueWaypoints.push({
                    icao,
                    index,
                    label: index === 0 ? 'Départ' : index === waypointIcaos.length - 1 ? 'Arrivée' : 'Étape'
                  });
                }
              });

              // Si départ = arrivée (vol local), afficher "Départ/Arrivée"
              if (waypointIcaos.length >= 2 && waypointIcaos[0] === waypointIcaos[waypointIcaos.length - 1]) {
                uniqueWaypoints[0].label = 'Départ/Arrivée';
              }

              return uniqueWaypoints.map(({ icao, label }) => (
                <WeatherCard
                  key={icao}
                  icao={icao}
                  label={label}
                />
              ));
            })()}
            
            {/* Aérodromes de déroutement - affichés en ligne */}
            {selectedAlternates && selectedAlternates.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {selectedAlternates.map((alternate, index) => (
                  <WeatherCard 
                    key={`alt-${alternate.icao}`} 
                    icao={alternate.icao}
                    label="Déroutement"
                    customBorderColor="var(--accent-primary)"
                    customBgColor="var(--bg-overlay)"
                    customTextColor="var(--accent-primary)"
                    additionalInfo={alternate.name ? `${alternate.name}` : ''}
                    compact={true}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Section Cartes météo - À venir */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mt(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Map size={20} />
          <span style={sx.spacing.ml(2)}>Cartes météo aéronautiques</span>
        </h3>

        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4), {
          backgroundColor: 'var(--bg-overlay)',
          textAlign: 'center'
        })}>
          <Info size={32} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
          <p style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
            Cartes WINTEM/TEMSI - Fonction à venir
          </p>
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Les cartes météorologiques aéronautiques (WINTEM et TEMSI) seront disponibles dans une prochaine mise à jour.
          </p>
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
  const { format, getSymbol } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change
  
  if (isLoading) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.flex.center, { minHeight: '120px' })}>
        <div style={sx.text.left}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--text-secondary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '12px'
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
                borderRadius: 'var(--radius-sm)',
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
              color: 'var(--text-secondary)'
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
            <div>💨 {metar.wind.direction === 'Calme' ? 'Calme' : `${metar.wind.direction}°/${format(metar.wind.speed, 'windSpeed', 0)}`}</div>
            <div>👁 {metar.visibility === 'CAVOK' ? 'CAVOK' : format(metar.visibility, 'visibility', 0)} | 🌡 {format(metar.temperature, 'temperature', 0)} | 📊 {format(metar.pressure, 'pressure', 0)}</div>
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
          (label === 'Départ' ? 'var(--text-primary)' : 
          label === 'Arrivée' ? 'var(--accent-primary)' : 
          'var(--text-secondary)')
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
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: customBgColor || 
                    (label === 'Départ' ? 'var(--bg-overlay)' : label === 'Arrivée' ? 'rgba(242, 105, 33, 0.10)' : 'var(--bg-overlay)'),
                  color: customTextColor ||
                    (label === 'Départ' ? 'var(--text-primary)' : label === 'Arrivée' ? 'var(--accent-primary)' : 'var(--text-primary)')
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
              {isOld && <span style={{ color: 'var(--accent-primary)' }}> (données anciennes)</span>}
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
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            lineHeight: '1.5',
            color: 'var(--text-primary)',
            border: '1px solid var(--text-tertiary)'
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
            backgroundColor: 'var(--bg-overlay)', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            lineHeight: '1.5',
            color: 'var(--text-primary)',
            border: '1px solid var(--text-tertiary)'
          }}>
            {weather.taf.raw}
          </div>
        </div>
      )}
      
      {/* Données METAR décodées - juste après le METAR/TAF */}
      {metar && (
        <div style={sx.combine(sx.spacing.mt(3), sx.components.card.base, { backgroundColor: 'var(--bg-overlay)' })}>
          <div style={sx.spacing.mb(showDecoded ? 2 : 0)}>
            <AccordionButton
              isOpen={showDecoded}
              onClick={() => setShowDecoded(!showDecoded)}
              title="Données décodées"
              variant="minimal"
              style={{ justifyContent: 'flex-start', fontSize: '14px', fontWeight: '600' }}
            />
          </div>
          
          {showDecoded && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <DataField
                  label="Vent"
                  value={
                    metar.wind.direction === 'Calme' || metar.wind.direction === 'Variable' 
                      ? metar.wind.direction 
                      : `${metar.wind.direction}° / ${format(metar.wind.speed, 'windSpeed', 0)}${metar.wind.gust ? ` G${format(metar.wind.gust, 'windSpeed', 0)}` : ''}`
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
                        ? format(metar.visibility / 1000, 'visibility', 1) // Convert m to km
                        : metar.visibility
                  }
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
                
                <DataField
                  label="Temp/Rosée"
                  value={`${metar.temperature !== null ? format(metar.temperature, 'temperature', 0) : 'N/A'} / ${metar.dewpoint !== null ? format(metar.dewpoint, 'temperature', 0) : 'N/A'}`}
                  dataSource="api"
                  emphasis={true}
                  size="sm"
                />
                
                <DataField
                  label="QNH"
                  value={metar.pressure !== null ? format(metar.pressure, 'pressure', 0) : 'N/A'}
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
                        backgroundColor: 'var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px'
                      })}>
                        {cloud.type} {format(cloud.altitude, 'altitude', 0)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Suggestion de piste selon le vent - Déplacé vers le module Performance */}
    </div>
  );
});

// Composant pour afficher toutes les stations
const AllWeatherStations = memo(() => {
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const stations = Object.keys(weatherData).sort();
  
  if (stations.length === 0) {
    return (
      <div style={sx.combine(sx.text.left, sx.text.secondary, sx.spacing.p(8))}>
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


WeatherModule.displayName = 'WeatherModule';
WeatherCard.displayName = 'WeatherCard';
AllWeatherStations.displayName = 'AllWeatherStations';

export default WeatherModule;