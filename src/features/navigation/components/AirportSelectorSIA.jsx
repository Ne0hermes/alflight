/**
 * Sélecteur d'aérodromes avec données SIA et suggestions VFR
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { geoJSONDataService } from '../services/GeoJSONDataService';
import { useNavigationStore } from '@core/stores';
import './AirportSelectorSIA.css';

export const AirportSelectorSIA = ({ 
  onSelect, 
  placeholder = "Rechercher un aérodrome...",
  showVFRSuggestions = true,
  label = "Aérodrome"
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [vfrPoints, setVfrPoints] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(null);
  
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  
  // Recherche d'aérodromes
  const searchAirports = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const results = await geoJSONDataService.searchAerodromes(searchQuery);
      
      // Formater les résultats
      const formatted = results.slice(0, 10).map(feature => ({
        icao: feature.properties.icao,
        name: feature.properties.name,
        city: feature.properties.city,
        elevation: feature.properties.elevation_ft,
        type: feature.properties.type,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        feature
      }));
      
      setSuggestions(formatted);
      setIsOpen(true);
    } catch (error) {
      console.error('Erreur recherche aérodromes:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Obtenir les points VFR proches
  const loadNearbyVFRPoints = useCallback(async (lat, lon) => {
    if (!showVFRSuggestions) return;
    
    try {
      const points = await geoJSONDataService.getNearbyVFRPoints(lat, lon, 30);
      
      // Formater les points VFR
      const formatted = points.slice(0, 5).map(point => ({
        code: point.properties.code,
        name: point.properties.name,
        type: point.properties.type,
        distance: Math.round(point.distance),
        mandatory: point.properties.mandatory,
        lat: point.geometry.coordinates[1],
        lon: point.geometry.coordinates[0]
      }));
      
      setVfrPoints(formatted);
    } catch (error) {
      console.error('Erreur chargement points VFR:', error);
      setVfrPoints([]);
    }
  }, [showVFRSuggestions]);
  
  // Gestion de la saisie
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAirports(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, searchAirports]);
  
  // Fermer le dropdown en cliquant dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Sélection d'un aérodrome
  const handleSelect = useCallback((airport) => {
    setSelectedAirport(airport);
    setQuery(`${airport.icao} - ${airport.name}`);
    setIsOpen(false);
    
    // Charger les points VFR proches
    loadNearbyVFRPoints(airport.lat, airport.lon);
    
    // Callback parent
    if (onSelect) {
      onSelect({
        icao: airport.icao,
        name: airport.name,
        coordinates: {
          lat: airport.lat,
          lon: airport.lon
        },
        elevation: airport.elevation,
        type: airport.type,
        city: airport.city
      });
    }
  }, [onSelect, loadNearbyVFRPoints]);
  
  // Formater l'affichage de l'élévation
  const formatElevation = (elevation) => {
    if (!elevation) return '';
    return `${elevation} ft`;
  };
  
  // Formater le type d'aérodrome
  const formatType = (type) => {
    const types = {
      'AD': 'Aérodrome',
      'HP': 'Héliport',
      'LS': 'Altisurface',
      'OTHER': 'Autre'
    };
    return types[type] || type;
  };
  
  return (
    <div className="airport-selector-sia">
      {label && <label className="selector-label">{label}</label>}
      
      <div className="selector-container" ref={dropdownRef}>
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="selector-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
          />
          
          {loading && (
            <div className="input-spinner">
              <div className="mini-spinner"></div>
            </div>
          )}
          
          {selectedAirport && (
            <button 
              className="clear-button"
              onClick={() => {
                setQuery('');
                setSelectedAirport(null);
                setVfrPoints([]);
                setSuggestions([]);
              }}
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Dropdown des suggestions */}
        {isOpen && suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            <div className="suggestions-header">Aérodromes</div>
            {suggestions.map((airport) => (
              <div
                key={airport.icao}
                className="suggestion-item"
                onClick={() => handleSelect(airport)}
              >
                <div className="suggestion-main">
                  <span className="suggestion-icao">{airport.icao}</span>
                  <span className="suggestion-name">{airport.name}</span>
                </div>
                <div className="suggestion-details">
                  {airport.city && (
                    <span className="suggestion-city">{airport.city}</span>
                  )}
                  {airport.elevation && (
                    <span className="suggestion-elevation">
                      {formatElevation(airport.elevation)}
                    </span>
                  )}
                  <span className="suggestion-type">
                    {formatType(airport.type)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Points VFR suggérés */}
      {showVFRSuggestions && vfrPoints.length > 0 && (
        <div className="vfr-suggestions">
          <h4 className="vfr-title">Points VFR proches</h4>
          <div className="vfr-list">
            {vfrPoints.map((point) => (
              <div key={point.code} className="vfr-item">
                <div className="vfr-header">
                  <span className="vfr-code">{point.code}</span>
                  <span className="vfr-distance">{point.distance} km</span>
                </div>
                <div className="vfr-name">{point.name}</div>
                <div className="vfr-details">
                  <span className={`vfr-type ${point.type.toLowerCase()}`}>
                    {point.type}
                  </span>
                  {point.mandatory && (
                    <span className="vfr-mandatory">Obligatoire</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Info aérodrome sélectionné */}
      {selectedAirport && (
        <div className="selected-info">
          <div className="info-header">Aérodrome sélectionné</div>
          <div className="info-content">
            <div className="info-row">
              <span className="info-label">ICAO:</span>
              <span className="info-value">{selectedAirport.icao}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Nom:</span>
              <span className="info-value">{selectedAirport.name}</span>
            </div>
            {selectedAirport.city && (
              <div className="info-row">
                <span className="info-label">Ville:</span>
                <span className="info-value">{selectedAirport.city}</span>
              </div>
            )}
            {selectedAirport.elevation && (
              <div className="info-row">
                <span className="info-label">Altitude:</span>
                <span className="info-value">{formatElevation(selectedAirport.elevation)}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Coordonnées:</span>
              <span className="info-value">
                {selectedAirport.lat.toFixed(6)}, {selectedAirport.lon.toFixed(6)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
