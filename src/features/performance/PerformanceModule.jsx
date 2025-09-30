import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, TrendingUp, Wind, Compass, FileText } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceCalculator from './components/PerformanceCalculator';
import AdvancedPerformanceCalculator from './components/AdvancedPerformanceCalculator';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore } from '../../core/stores/weatherStore';

const PerformanceModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  const weatherData = useWeatherStore(state => state.weatherData || {});
  
  
  // Récupérer les aérodromes de départ et d'arrivée
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];
  
  // Récupérer la météo pour les aérodromes
  const departureWeather = departureAirport?.name && weatherData[departureAirport.name];
  const arrivalWeather = arrivalAirport?.name && weatherData[arrivalAirport.name];
  
  // Si aucun avion sélectionné, afficher un message
  if (!selectedAircraft) {
    return (
      <div style={sx.spacing.p(6)}>
        <div style={sx.combine(sx.components.card.base, sx.text.left, sx.spacing.p(8))}>
          <AlertCircle size={48} style={{ marginBottom: '16px', color: '#f59e0b' }} />
          <p style={sx.combine(sx.text.lg, sx.text.secondary)}>
            Sélectionnez un avion pour voir ses performances
          </p>
        </div>
      </div>
    );
  }


  return (
    <div style={sx.spacing.p(6)}>
      {/* Header du module */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.flex.start)}>
            <TrendingUp size={24} style={{ marginRight: '8px', color: '#10b981' }} />
            Calcul des performances
          </h2>
          
        </div>
        
        {/* Info avion */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
          <div style={sx.combine(sx.flex.between)}>
            <div>
              <h4 style={sx.text.bold}>{selectedAircraft.registration}</h4>
              <p style={sx.text.secondary}>{selectedAircraft.model}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={sx.text.sm}>
                <span style={sx.text.secondary}>MTOW: </span>
                <span style={sx.text.bold}>{selectedAircraft.maxTakeoffWeight || 'N/A'} kg</span>
              </p>
              <p style={sx.text.sm}>
                <span style={sx.text.secondary}>Vitesse: </span>
                <span style={sx.text.bold}>{selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 'N/A'} kt</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Affichage des performances si disponibles */}
      {selectedAircraft.performance && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
            <Calculator size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Performances de l'avion
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {selectedAircraft.performance.takeoff && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
                <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  ✈️ Décollage (conditions standards)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <p style={sx.text.xs}>TOD</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.tod} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>15m</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.toda15m} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>50ft</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.toda50ft} m
                    </p>
                  </div>
                </div>
                {selectedAircraft.performance.conditions?.takeoff && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    Conditions: {selectedAircraft.performance.conditions.takeoff.mass}kg, 
                    {selectedAircraft.performance.conditions.takeoff.altitude}ft, 
                    {selectedAircraft.performance.conditions.takeoff.temperature}°C
                  </p>
                )}
              </div>
            )}
            
            {selectedAircraft.performance.landing && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
                <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  🛬 Atterrissage (conditions standards)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <p style={sx.text.xs}>LD</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.ld} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>15m</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.lda15m} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>50ft</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.lda50ft} m
                    </p>
                  </div>
                </div>
                {selectedAircraft.performance.conditions?.landing && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    Conditions: {selectedAircraft.performance.conditions.landing.mass}kg, 
                    {selectedAircraft.performance.conditions.landing.altitude}ft, 
                    {selectedAircraft.performance.conditions.landing.temperature}°C
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Section Analyse du vent et pistes recommandées */}
      {(departureWeather || arrivalWeather) && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Wind size={20} style={{ marginRight: '8px' }} />
            Analyse du vent et pistes recommandées
          </h3>
          
          {/* Explication des calculs */}
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              <Compass size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Calcul des composantes de vent
            </h4>
            <div style={sx.text.xs}>
              <p style={sx.spacing.mb(1)}>
                <strong>Vent de face (Headwind):</strong> VF = V × cos(α) où α = angle entre vent et piste
              </p>
              <p style={sx.spacing.mb(1)}>
                <strong>Vent traversier (Crosswind):</strong> VT = V × sin(α)
              </p>
              <p style={sx.spacing.mb(1)}>
                <strong>Critères de sélection:</strong>
              </p>
              <ul style={{ marginLeft: '20px', marginTop: '4px' }}>
                <li>Piste recommandée = vent de face maximal (meilleure performance)</li>
                <li>Vent traversier {'<'} 15 kt = acceptable</li>
                <li>Vent traversier {'>'} 20 kt = attention requise</li>
                <li>Vent arrière {'>'} 10 kt = déconseillé (augmente distance de décollage/atterrissage)</li>
              </ul>
            </div>
          </div>
          
          {/* Pistes recommandées pour le départ */}
          {departureWeather?.metar?.wind && departureAirport?.name && (
            <div style={sx.spacing.mb(4)}>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                ✈️ Départ - {departureAirport.name}
              </h4>
              <RunwaySuggestionEnhanced 
                icao={departureAirport.name} 
                wind={departureWeather.metar.wind}
                showDetails={true}
              />
            </div>
          )}
          
          {/* Pistes recommandées pour l'arrivée */}
          {arrivalWeather?.metar?.wind && arrivalAirport?.name && (
            <div>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                🛬 Arrivée - {arrivalAirport.name}
              </h4>
              <RunwaySuggestionEnhanced 
                icao={arrivalAirport.name} 
                wind={arrivalWeather.metar.wind}
                showDetails={true}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Calculateur avancé si tableaux extraits disponibles */}
      {selectedAircraft.advancedPerformance?.tables && selectedAircraft.advancedPerformance.tables.length > 0 && (
        <AdvancedPerformanceCalculator aircraft={selectedAircraft} />
      )}
      
      {/* Calculateur de performances standard */}
      {(!selectedAircraft.advancedPerformance || selectedAircraft.advancedPerformance.tables?.length === 0) && (
        <PerformanceCalculator />
      )}
    </div>
  );
};

export default PerformanceModule;