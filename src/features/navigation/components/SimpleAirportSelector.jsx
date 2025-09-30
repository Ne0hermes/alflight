// src/features/navigation/components/SimpleAirportSelector.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';

export const SimpleAirportSelector = ({ label, value, onChange, placeholder, excludeIcao }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  
  // Récupérer les aéroports depuis le provider
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadAirports = async () => {
      try {
        setLoading(true);
        const data = await aeroDataProvider.getAirfields({ country: 'FR' });
        setAirports(data || []);
      } catch (error) {
        console.error('Erreur chargement aéroports:', error);
        setAirports([]);
      } finally {
        setLoading(false);
      }
    };
    loadAirports();
  }, []);
  
  // Debug : vérifier si LFST est présent
  React.useEffect(() => {
    const lfst = airports.find(a => a.icao === 'LFST');
    if (lfst) {
      console.log('✅ LFST trouvé:', lfst);
    } else {
      console.log('❌ LFST non trouvé. Total aéroports:', airports.length);
      console.log('Exemples:', airports.slice(0, 5).map(a => a.icao));
    }
  }, [airports]);
  
  // Suggestions basées sur l'input
  const suggestions = useMemo(() => {
    const searchTerm = inputValue.toUpperCase();
    
    // Si pas d'input, montrer les 10 aéroports principaux
    if (!inputValue) {
      const mainAirports = ['LFPG', 'LFPO', 'LFLL', 'LFML', 'LFBO', 'LFMN', 'LFRS', 'LFST', 'LFBD', 'LFRB'];
      return airports
        .filter(a => mainAirports.includes(a.icao) && a.icao !== excludeIcao)
        .sort((a, b) => mainAirports.indexOf(a.icao) - mainAirports.indexOf(b.icao))
        .slice(0, 10);
    }
    
    // Sinon, filtrer par recherche
    return airports
      .filter(airport => {
        if (excludeIcao && airport.icao === excludeIcao) return false;
        
        const matchIcao = airport.icao?.toUpperCase().includes(searchTerm);
        const matchName = airport.name?.toUpperCase().includes(searchTerm);
        const matchCity = airport.city?.toUpperCase().includes(searchTerm);
        
        return matchIcao || matchName || matchCity;
      })
      .sort((a, b) => {
        // Prioriser les correspondances exactes ICAO
        if (a.icao === searchTerm) return -1;
        if (b.icao === searchTerm) return 1;
        
        // Puis ceux qui commencent par le terme
        const aStarts = a.icao?.startsWith(searchTerm);
        const bStarts = b.icao?.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return 0;
      })
      .slice(0, 10);
  }, [inputValue, airports, excludeIcao]);
  
  // Gérer la sélection
  const handleSelect = (airport) => {
    setInputValue('');
    onChange({
      icao: airport.icao,
      name: airport.name,
      coordinates: airport.coordinates,
      elevation: airport.elevation,
      city: airport.city
    });
    setIsOpen(false);
    setSelectedIndex(-1);
  };
  
  // Gérer l'input
  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setInputValue(value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };
  
  // Navigation au clavier
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          handleSelect(suggestions[0]);
        }
        break;
        
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };
  
  // Fermer en cliquant dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Formater l'affichage
  const formatAirport = (airport) => {
    if (!airport) return '';
    const parts = [airport.icao];
    if (airport.name) parts.push(airport.name);
    if (airport.city && airport.city !== airport.name) parts.push(`(${airport.city})`);
    return parts.join(' - ');
  };
  
  // Afficher la valeur actuelle dans l'input
  const displayValue = value ? formatAirport(value) : inputValue;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <label style={sx.components.label.base}>{label}</label>
      
      {/* Input toujours visible */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue || (value && !isOpen ? formatAirport(value) : '')}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsOpen(true);
            if (value && !inputValue) {
              setInputValue('');
            }
          }}
          onBlur={(e) => {
            // Délai pour permettre le clic sur les suggestions
            setTimeout(() => {
              // Si on a tapé un code ICAO valide de 4 lettres
              if (inputValue.length === 4 && inputValue.match(/^[A-Z]{4}$/)) {
                const airport = airports.find(a => a.icao === inputValue);
                if (airport) {
                  handleSelect(airport);
                } else {
                  // Créer un aéroport personnalisé
                  onChange({
                    icao: inputValue,
                    name: `Aéroport ${inputValue}`,
                    coordinates: { lat: 48.8566, lon: 2.3522 }, // Paris par défaut
                    custom: true
                  });
                  setInputValue('');
                }
              }
            }, 200);
          }}
          placeholder={placeholder || "Code OACI ou nom..."}
          style={sx.combine(
            sx.components.input.base,
            { 
              paddingLeft: '36px', 
              paddingRight: '36px',
              color: value && !inputValue ? '#374151' : '#111827'
            }
          )}
        />
        
        {/* Icône à gauche */}
        {value && !inputValue ? (
          <MapPin size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#10b981'
          }} />
        ) : (
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6b7280'
          }} />
        )}
        
        {/* Flèche dropdown */}
        <ChevronDown 
          size={16} 
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#6b7280',
            cursor: 'pointer'
          }} 
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }} 
        />
      </div>
      
      {/* Info pour aéroport personnalisé */}
      {value && value.custom && (
        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
          ⚠️ Aéroport personnalisé - Coordonnées par défaut (Paris)
        </p>
      )}
      
      {/* Dropdown */}
      {isOpen && (
        <div style={styles.dropdown}>
          {loading ? (
            <div style={styles.dropdownItem}>
              <span>Chargement des aéroports...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div style={styles.dropdownItem}>
              <span>Aucun aéroport trouvé</span>
            </div>
          ) : (
            suggestions.map((airport, index) => (
            <div
              key={airport.id || airport.icao}
              onClick={() => handleSelect(airport)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={sx.combine(
                styles.dropdownItem,
                selectedIndex === index && styles.dropdownItemSelected
              )}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={sx.text.bold}>{airport.icao}</span>
                    <span style={sx.combine(sx.text.sm, sx.spacing.ml(2))}>
                      {airport.name}
                    </span>
                  </div>
                  {airport.city && (
                    <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      {airport.city}
                      {airport.elevation && ` • ${airport.elevation} ft`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    maxHeight: '320px',
    overflowY: 'auto',
    zIndex: 1000
  },
  
  dropdownItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s ease'
  },
  
  dropdownItemSelected: {
    backgroundColor: '#eff6ff'
  }
};

export default SimpleAirportSelector;