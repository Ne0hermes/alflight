// src/modules/weather/components/MeteoCharts.jsx
import React, { useState, useEffect } from 'react';
import { Map, Cloud, Wind, ZoomIn, ZoomOut, RefreshCw, Download, Calendar, Clock, AlertTriangle } from 'lucide-react';

export const MeteoCharts = ({ selectedAltitude = 0 }) => {
  const [chartType, setChartType] = useState('TEMSI');
  const [selectedRegion, setSelectedRegion] = useState('FRANCE');
  const [selectedLevel, setSelectedLevel] = useState('FL050');
  const [scale, setScale] = useState(100);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartUrl, setChartUrl] = useState(null);

  // Niveaux de vol disponibles pour WINTEM
  const flightLevels = [
    { value: 'FL020', label: 'FL020 (2000 ft)', altitude: 2000 },
    { value: 'FL050', label: 'FL050 (5000 ft)', altitude: 5000 },
    { value: 'FL080', label: 'FL080 (8000 ft)', altitude: 8000 },
    { value: 'FL100', label: 'FL100 (10000 ft)', altitude: 10000 },
    { value: 'FL140', label: 'FL140 (14000 ft)', altitude: 14000 },
    { value: 'FL180', label: 'FL180 (18000 ft)', altitude: 18000 },
    { value: 'FL240', label: 'FL240 (24000 ft)', altitude: 24000 },
    { value: 'FL300', label: 'FL300 (30000 ft)', altitude: 30000 },
    { value: 'FL340', label: 'FL340 (34000 ft)', altitude: 34000 },
    { value: 'FL390', label: 'FL390 (39000 ft)', altitude: 39000 }
  ];

  // Régions disponibles
  const regions = [
    { value: 'FRANCE', label: 'France Métropolitaine' },
    { value: 'EUROC', label: 'Europe Centrale' },
    { value: 'ATL', label: 'Atlantique Nord' },
    { value: 'MED', label: 'Méditerranée' }
  ];

  // Sélectionner automatiquement le niveau de vol en fonction de l'altitude
  useEffect(() => {
    if (selectedAltitude && chartType === 'WINTEM') {
      const closestLevel = flightLevels.reduce((prev, curr) => {
        return Math.abs(curr.altitude - selectedAltitude) < Math.abs(prev.altitude - selectedAltitude) ? curr : prev;
      });
      setSelectedLevel(closestLevel.value);
    }
  }, [selectedAltitude, chartType]);

  // Charger la carte
  const loadChart = async () => {
    setLoading(true);
    try {
      // Simuler le chargement d'une carte
      // En production, cela devrait appeler une vraie API météo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // URL simulée - en production, utiliser les vraies URLs des cartes météo
      const baseUrl = 'https://aviation.meteo.fr/';
      let url = '';
      
      if (chartType === 'TEMSI') {
        url = `${baseUrl}temsi/${selectedRegion.toLowerCase()}/latest`;
      } else {
        url = `${baseUrl}wintem/${selectedRegion.toLowerCase()}/${selectedLevel.toLowerCase()}/latest`;
      }
      
      // Pour la démo, utiliser une image placeholder
      setChartUrl('/api/placeholder/800/600');
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Erreur chargement carte:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger la carte au montage et lors des changements
  useEffect(() => {
    loadChart();
  }, [chartType, selectedRegion, selectedLevel]);

  const handleZoom = (delta) => {
    setScale(prevScale => {
      const newScale = prevScale + delta;
      return Math.min(Math.max(50, newScale), 200);
    });
  };

  const handleDownload = () => {
    if (chartUrl) {
      const link = document.createElement('a');
      link.href = chartUrl;
      link.download = `${chartType}_${selectedRegion}_${selectedLevel}_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Map size={20} />
        Cartes Météorologiques
      </h3>

      {/* Sélecteurs */}
      <div style={{ 
        display: 'flex', 
        gap: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Type de carte */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '13px', 
            color: '#6b7280', 
            marginBottom: '4px' 
          }}>
            Type de carte
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setChartType('TEMSI')}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: chartType === 'TEMSI' ? '#3b82f6' : '#f3f4f6',
                color: chartType === 'TEMSI' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Cloud size={16} />
              TEMSI
            </button>
            <button
              onClick={() => setChartType('WINTEM')}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: chartType === 'WINTEM' ? '#3b82f6' : '#f3f4f6',
                color: chartType === 'WINTEM' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Wind size={16} />
              WINTEM
            </button>
          </div>
        </div>

        {/* Région */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '13px', 
            color: '#6b7280', 
            marginBottom: '4px' 
          }}>
            Région
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px 12px', 
              border: '1px solid #d1d5db', 
              borderRadius: '6px',
              backgroundColor: 'white',
              fontSize: '14px'
            }}
          >
            {regions.map(region => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
        </div>

        {/* Niveau de vol (uniquement pour WINTEM) */}
        {chartType === 'WINTEM' && (
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Niveau de vol
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: 'white',
                fontSize: '14px'
              }}
            >
              {flightLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Zone d'affichage de la carte */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        {/* Barre d'outils */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
              {chartType === 'TEMSI' ? 'Temps Significatif' : 'Vents et Températures'} - {selectedRegion}
              {chartType === 'WINTEM' && ` - ${selectedLevel}`}
            </h4>
            {lastUpdate && (
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Zoom */}
            <button
              onClick={() => handleZoom(-10)}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Zoom arrière"
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ 
              padding: '6px 12px', 
              backgroundColor: '#f3f4f6', 
              borderRadius: '6px',
              fontSize: '13px',
              minWidth: '50px',
              textAlign: 'center'
            }}>
              {scale}%
            </span>
            <button
              onClick={() => handleZoom(10)}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Zoom avant"
            >
              <ZoomIn size={16} />
            </button>

            <div style={{ width: '1px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />

            {/* Actions */}
            <button
              onClick={loadChart}
              disabled={loading}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: loading ? 0.5 : 1
              }}
              title="Actualiser"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleDownload}
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Télécharger"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Affichage de la carte */}
        <div style={{
          position: 'relative',
          overflow: 'auto',
          backgroundColor: '#f3f4f6',
          minHeight: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e5e7eb',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <p style={{ color: '#6b7280' }}>Chargement de la carte...</p>
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : chartUrl ? (
            <div style={{
              transform: `scale(${scale / 100})`,
              transformOrigin: 'center',
              transition: 'transform 0.3s'
            }}>
              {/* Simulation de carte météo avec SVG */}
              <svg width="800" height="600" viewBox="0 0 800 600" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}>
                {/* Fond de carte */}
                <rect width="800" height="600" fill="#f0f9ff" />
                
                {/* Titre */}
                <text x="400" y="30" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">
                  {chartType} - {selectedRegion} {chartType === 'WINTEM' && `- ${selectedLevel}`}
                </text>
                <text x="400" y="50" textAnchor="middle" fontSize="14" fill="#64748b">
                  {new Date().toLocaleDateString('fr-FR')} - {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} UTC
                </text>
                
                {/* Contour France simplifié */}
                <path
                  d="M 300 200 L 350 180 L 400 170 L 450 180 L 480 220 L 470 280 L 450 320 L 400 340 L 350 330 L 300 300 Z"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
                
                {chartType === 'TEMSI' ? (
                  // Éléments TEMSI
                  <>
                    {/* Front froid */}
                    <line x1="200" y1="250" x2="350" y2="300" stroke="#3b82f6" strokeWidth="3" />
                    <text x="275" y="270" fill="#3b82f6" fontSize="12" fontWeight="bold">FRONT FROID</text>
                    
                    {/* Zone de précipitations */}
                    <circle cx="420" cy="250" r="60" fill="#60a5fa" fillOpacity="0.3" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" />
                    <text x="420" y="255" textAnchor="middle" fill="#1e40af" fontSize="14">RA</text>
                    
                    {/* Nuages */}
                    <ellipse cx="300" cy="350" rx="40" ry="20" fill="#e5e7eb" />
                    <text x="300" y="355" textAnchor="middle" fill="#374151" fontSize="12">SCT 030</text>
                    
                    {/* Zone de turbulence */}
                    <rect x="500" y="200" width="80" height="60" fill="#fbbf24" fillOpacity="0.3" stroke="#f59e0b" strokeWidth="2" />
                    <text x="540" y="235" textAnchor="middle" fill="#d97706" fontSize="12" fontWeight="bold">TURB</text>
                  </>
                ) : (
                  // Éléments WINTEM
                  <>
                    {/* Barbules de vent */}
                    <g transform="translate(350, 250)">
                      <line x1="0" y1="0" x2="30" y2="-20" stroke="#374151" strokeWidth="2" />
                      <line x1="30" y1="-20" x2="25" y2="-15" stroke="#374151" strokeWidth="2" />
                      <line x1="30" y1="-20" x2="35" y2="-15" stroke="#374151" strokeWidth="2" />
                      <text x="40" y="-15" fill="#374151" fontSize="12">280°/45kt</text>
                      <text x="0" y="15" fill="#dc2626" fontSize="12" textAnchor="middle">-25°C</text>
                    </g>
                    
                    <g transform="translate(450, 300)">
                      <line x1="0" y1="0" x2="25" y2="-30" stroke="#374151" strokeWidth="2" />
                      <line x1="25" y1="-30" x2="20" y2="-25" stroke="#374151" strokeWidth="2" />
                      <text x="30" y="-25" fill="#374151" fontSize="12">270°/30kt</text>
                      <text x="0" y="15" fill="#dc2626" fontSize="12" textAnchor="middle">-22°C</text>
                    </g>
                    
                    {/* Isothermes */}
                    <path d="M 250 200 Q 400 180 500 220" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
                    <text x="375" y="195" fill="#ef4444" fontSize="11">-20°C</text>
                    
                    <path d="M 250 280 Q 400 260 500 300" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
                    <text x="375" y="275" fill="#ef4444" fontSize="11">-25°C</text>
                  </>
                )}
                
                {/* Légende */}
                <g transform="translate(50, 450)">
                  <text x="0" y="0" fontSize="14" fontWeight="bold" fill="#1e293b">Légende:</text>
                  {chartType === 'TEMSI' ? (
                    <>
                      <text x="0" y="20" fontSize="12" fill="#64748b">RA = Pluie</text>
                      <text x="0" y="35" fontSize="12" fill="#64748b">SCT = Épars (Scattered)</text>
                      <text x="0" y="50" fontSize="12" fill="#64748b">TURB = Zone de turbulence</text>
                    </>
                  ) : (
                    <>
                      <text x="0" y="20" fontSize="12" fill="#64748b">Barbules = Direction et force du vent</text>
                      <text x="0" y="35" fontSize="12" fill="#64748b">Lignes rouges = Isothermes</text>
                      <text x="0" y="50" fontSize="12" fill="#64748b">Température en °C</text>
                    </>
                  )}
                </g>
              </svg>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <AlertTriangle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Impossible de charger la carte</p>
            </div>
          )}
        </div>

        {/* Informations */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {chartType === 'TEMSI' 
                ? 'Carte du temps significatif prévu - Phénomènes météorologiques dangereux pour l\'aviation'
                : `Carte des vents et températures au ${selectedLevel}`
              }
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              Validité: {new Date().toLocaleDateString('fr-FR')} 00:00 - 24:00 UTC
            </span>
          </div>
        </div>
      </div>

      {/* Légende détaillée */}
      <div style={{ 
        marginTop: '16px',
        padding: '16px',
        backgroundColor: '#e0f2fe',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0c4a6e'
      }}>
        <p style={{ margin: '0', fontWeight: '600' }}>
          ℹ️ Guide de lecture des cartes :
        </p>
        {chartType === 'TEMSI' ? (
          <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
            <li><strong>Fronts</strong> : Lignes bleues (froid) ou rouges (chaud) avec symboles</li>
            <li><strong>Précipitations</strong> : RA (pluie), SN (neige), TS (orage), SH (averses)</li>
            <li><strong>Nuages</strong> : FEW (1-2/8), SCT (3-4/8), BKN (5-7/8), OVC (8/8)</li>
            <li><strong>Turbulence</strong> : TURB MOD (modérée), TURB SEV (sévère)</li>
            <li><strong>Givrage</strong> : ICE MOD (modéré), ICE SEV (sévère)</li>
            <li><strong>Visibilité</strong> : Zones hachurées pour vis &lt; 5km</li>
          </ul>
        ) : (
          <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
            <li><strong>Barbules de vent</strong> : Direction d'où vient le vent, force en nœuds</li>
            <li><strong>Pennant</strong> : 50 kt | <strong>Barbule longue</strong> : 10 kt | <strong>Barbule courte</strong> : 5 kt</li>
            <li><strong>Températures</strong> : En degrés Celsius, négatives en altitude</li>
            <li><strong>Isothermes</strong> : Lignes d'égale température</li>
            <li><strong>Jet Stream</strong> : Flèches doubles pour vents &gt; 80 kt</li>
          </ul>
        )}
        <p style={{ margin: '8px 0 0 0', fontStyle: 'italic' }}>
          Note : Ces cartes sont des exemples. En conditions réelles, consultez les cartes officielles de Météo-France.
        </p>
      </div>
    </div>
  );
};